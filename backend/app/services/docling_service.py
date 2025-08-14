import os
import json
import asyncio
import time
import signal
import concurrent.futures
from typing import Dict, Any, List, Optional, Union
from pathlib import Path
from datetime import datetime

try:
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
    from docling_core.types.doc import DoclingDocument, NodeItem
    DOCLING_AVAILABLE = True
except ImportError as e:
    print(f"Docling import 실패: {e}")
    DOCLING_AVAILABLE = False

from ..models.schemas import DoclingOptions, DoclingResult
from ..core.config import settings


class DoclingService:
    """Docling을 사용한 고급 문서 전처리 서비스"""
    
    def __init__(self):
        self.is_available = DOCLING_AVAILABLE
        if self.is_available:
            self._init_converter()
        else:
            print("⚠️ Docling을 사용할 수 없습니다. 기본 문서 처리를 사용합니다.")
    
    def _init_converter(self):
        """DocumentConverter 초기화 - 최신 Docling API 사용"""
        try:
            # PDF 파이프라인 옵션 설정 (최신 API)
            pipeline_options = PdfPipelineOptions(
                do_ocr=False,  # 기본적으로 OCR 비활성화 (성능 향상)
                do_table_structure=True,  # 테이블 구조 분석 활성화
                generate_parsed_pages=True  # 파싱된 페이지 생성
            )
            
            # 테이블 구조 분석 상세 설정
            try:
                pipeline_options.table_structure_options.mode = TableFormerMode.ACCURATE
                pipeline_options.table_structure_options.do_cell_matching = True
                print("🔧 테이블 구조 분석 고급 옵션 활성화")
            except AttributeError as e:
                print(f"⚠️ 일부 테이블 옵션을 사용할 수 없습니다: {e}")
            
            # DocumentConverter 생성 (최신 API - PdfFormatOption 사용)
            try:
                pdf_format_option = PdfFormatOption(pipeline_options=pipeline_options)
                self.converter = DocumentConverter(
                    format_options={
                        InputFormat.PDF: pdf_format_option
                    }
                )
                print("✅ Docling DocumentConverter 초기화 완료 (고급 설정)")
                
            except Exception as format_error:
                print(f"⚠️ 고급 옵션 초기화 실패, 기본 설정으로 재시도: {format_error}")
                # 최소한의 옵션으로 재시도
                try:
                    basic_options = PdfPipelineOptions(do_ocr=False)
                    basic_format_option = PdfFormatOption(pipeline_options=basic_options)
                    self.converter = DocumentConverter(
                        format_options={
                            InputFormat.PDF: basic_format_option
                        }
                    )
                    print("✅ Docling DocumentConverter 초기화 완료 (기본 설정)")
                except Exception as basic_error:
                    print(f"⚠️ 기본 옵션도 실패, 최소 설정으로 재시도: {basic_error}")
                    # 완전 기본 DocumentConverter로 폴백
                    self.converter = DocumentConverter()
                    print("✅ Docling DocumentConverter 초기화 완료 (최소 설정)")
            
        except Exception as e:
            print(f"❌ Docling DocumentConverter 초기화 실패: {e}")
            import traceback
            traceback.print_exc()
            self.is_available = False
    
    async def is_supported_format(self, file_path: str) -> bool:
        """Docling이 지원하는 파일 형식인지 확인"""
        if not self.is_available:
            return False
            
        supported_extensions = {'.pdf', '.docx', '.pptx', '.xlsx', '.html', '.md'}
        file_extension = Path(file_path).suffix.lower()
        return file_extension in supported_extensions
    
    async def process_document(
        self, 
        file_path: str, 
        options: DoclingOptions
    ) -> DoclingResult:
        """
        Docling을 사용하여 문서를 전처리합니다.
        
        Args:
            file_path: 처리할 파일 경로
            options: Docling 처리 옵션
            
        Returns:
            DoclingResult: 처리 결과
        """
        if not self.is_available:
            raise RuntimeError("Docling을 사용할 수 없습니다.")
        
        if not await self.is_supported_format(file_path):
            raise ValueError(f"지원하지 않는 파일 형식입니다: {file_path}")
        
        start_time = datetime.now()
        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        
        try:
            print(f"🔄 Docling 문서 처리 시작: {file_path}")
            print(f"📄 파일 크기: {file_size / 1024 / 1024:.2f} MB")
            print(f"⚙️ OCR 활성화: {options.ocr_enabled}")
            print(f"📊 테이블 추출: {options.extract_tables}")
            print(f"🖼️ 이미지 추출: {options.extract_images}")
            print(f"📝 출력 형식: {options.output_format}")
            
            # OCR 설정 업데이트
            print("⚙️ Docling 변환기 설정 업데이트 중...")
            if hasattr(self.converter, 'format_options') and InputFormat.PDF in self.converter.format_options:
                pdf_options = self.converter.format_options[InputFormat.PDF]
                pdf_options.do_ocr = options.ocr_enabled
                print(f"✅ PDF 옵션 업데이트 완료 (OCR: {options.ocr_enabled})")
            else:
                print("⚠️ PDF 형식 옵션을 찾을 수 없음")
            
            # 문서 변환 실행 (타임아웃 설정과 비동기 처리)
            print("🚀 Docling 문서 변환 실행 중...")
            print(f"⏰ 변환 제한 시간: 300초 (5분)")
            
            loop = asyncio.get_event_loop()
            
            # 타임아웃을 설정하여 무한 대기 방지
            try:
                conversion_result = await asyncio.wait_for(
                    loop.run_in_executor(
                        None, 
                        self._convert_document_with_progress, 
                        file_path
                    ),
                    timeout=300.0  # 5분 타임아웃
                )
                print("✅ Docling 문서 변환 완료")
                
            except asyncio.TimeoutError:
                print("⚠️ Docling 변환 타임아웃 (5분 초과) - 처리를 중단합니다")
                raise RuntimeError("문서 변환이 너무 오래 걸리고 있습니다. 파일 크기를 줄이거나 다른 형식으로 변환해 주세요.")
            
            # DoclingDocument 추출
            print("📄 DoclingDocument 추출 중...")
            docling_doc = conversion_result.document
            print(f"📊 문서 페이지 수: {len(docling_doc.pages) if hasattr(docling_doc, 'pages') else '알 수 없음'}")
            
            # 구조화된 콘텐츠 추출
            print("🔍 구조화된 콘텐츠 추출 중...")
            content_start_time = time.time()
            # 파일 ID 생성 (파일 경로에서 추출)
            file_id = Path(file_path).stem
            structured_content = await self._extract_structured_content(
                docling_doc, options, file_id
            )
            content_elapsed = time.time() - content_start_time
            print(f"✅ 구조화된 콘텐츠 추출 완료 ({content_elapsed:.2f}초 소요)")
            
            # 처리 시간 계산
            processing_time = (datetime.now() - start_time).total_seconds()
            
            # 결과 통계 출력
            page_count = len(docling_doc.pages) if hasattr(docling_doc, 'pages') else 0
            table_count = len(structured_content.get("tables", []))
            image_count = len(structured_content.get("images", []))
            text_length = len(structured_content.get("text", ""))
            
            print(f"📊 처리 결과 통계:")
            print(f"   - 페이지 수: {page_count}")
            print(f"   - 테이블 수: {table_count}")
            print(f"   - 이미지 수: {image_count}")
            print(f"   - 텍스트 길이: {text_length:,} 글자")
            
            result = DoclingResult(
                success=True,
                content=structured_content,
                metadata={
                    "file_path": file_path,
                    "processing_time": processing_time,
                    "docling_version": "2.44.0",
                    "options_used": options.dict(),
                    "page_count": page_count,
                    "table_count": table_count,
                    "image_count": image_count,
                    "file_size_mb": file_size / 1024 / 1024
                },
                tables=structured_content.get("tables", []),
                images=structured_content.get("images", []),
                processing_time=processing_time
            )
            
            print(f"✅ Docling 처리 완료 ({processing_time:.2f}초)")
            print(f"📈 처리 속도: {file_size / 1024 / 1024 / processing_time:.2f} MB/초")
            return result
            
        except asyncio.TimeoutError:
            processing_time = (datetime.now() - start_time).total_seconds()
            error_msg = f"문서 변환 타임아웃 ({processing_time:.0f}초 초과). 파일이 너무 크거나 복잡합니다."
            print(f"⏰ {error_msg}")
            return DoclingResult(
                success=False,
                content={"text": "", "markdown": "", "html": ""},
                error=error_msg,
                metadata={"file_path": file_path, "error": error_msg, "timeout": True},
                processing_time=processing_time
            )
            
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            print(f"❌ Docling 처리 실패 ({processing_time:.2f}초 소요): {str(e)}")
            return DoclingResult(
                success=False,
                content={"text": "", "markdown": "", "html": ""},
                error=str(e),
                metadata={"file_path": file_path, "error": str(e)},
                processing_time=processing_time
            )
    
    def _convert_document_with_progress(self, file_path: str):
        """문서 변환 (진행 상황 모니터링 포함)"""
        print(f"🔄 Docling 변환기로 파일 처리 시작: {os.path.basename(file_path)}")
        file_size_mb = os.path.getsize(file_path) / 1024 / 1024
        print(f"📊 예상 처리 시간: {file_size_mb:.1f}MB - 약 {max(10, file_size_mb * 5):.0f}초 예상")
        
        start_time = datetime.now()
        print(f"🚀 변환 시작: {start_time.strftime('%H:%M:%S')}")
        
        try:
            # 실제 변환 수행 - 이 단계에서 시간이 오래 걸립니다
            print("🔄 Docling 컨버터 내부 처리 시작...")
            print("⚡ PDF 분석 및 텍스트 추출 진행 중... (잠시만 기다려주세요)")
            print(f"📋 대용량 파일의 경우 최대 {max(10, file_size_mb * 5):.0f}초까지 소요될 수 있습니다")
            print("🔄 변환 작업이 진행 중입니다. 브라우저를 닫지 마세요...")
            
            # 실제 변환을 별도 스레드에서 실행하면서 진행 상황을 주기적으로 알림
            import threading
            import time
            
            result = None
            error = None
            conversion_done = threading.Event()
            
            def convert_with_heartbeat():
                nonlocal result, error
                try:
                    print("💼 Docling 라이브러리 변환 시작... (내부 처리 중)")
                    result = self.converter.convert(file_path)
                    conversion_done.set()
                except Exception as e:
                    error = e
                    conversion_done.set()
            
            # 변환 스레드 시작 (daemon=True로 설정하여 메인 프로세스 종료 시 함께 종료)
            convert_thread = threading.Thread(target=convert_with_heartbeat, daemon=True)
            convert_thread.start()
            
            # 하트비트 메시지 제거 - 조용히 대기만 함 (KeyboardInterrupt 처리)
            try:
                while not conversion_done.is_set():
                    if conversion_done.wait(10):  # 10초 대기
                        break
            except KeyboardInterrupt:
                print("\n🛑 사용자가 변환 작업을 중단했습니다.")
                conversion_done.set()
                raise
            
            # 변환 완료 대기
            convert_thread.join()
            
            if error:
                raise error
                
            if not result:
                raise RuntimeError("변환 결과를 받을 수 없습니다")
                
            processing_time = (datetime.now() - start_time).total_seconds()
            print(f"🎉 Docling 변환기 내부 처리 완료! ({processing_time:.2f}초)")
            print(f"📊 처리 성능: {file_size_mb / processing_time:.2f} MB/초")
            
            return result
            
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            print(f"❌ Docling 변환 중 오류 발생 ({processing_time:.2f}초 경과): {str(e)}")
            raise
    
    def _convert_document(self, file_path: str):
        """문서 변환 (기본 동기 실행 - 하위 호환성)"""
        return self._convert_document_with_progress(file_path)
    
    async def _extract_structured_content(
        self, 
        docling_doc: 'DoclingDocument', 
        options: DoclingOptions,
        file_id: str = None
    ) -> Dict[str, Any]:
        """DoclingDocument에서 구조화된 콘텐츠를 추출합니다."""
        
        structured_content = {
            "text": "",
            "markdown": "",
            "html": "",
            "tables": [],
            "images": [],
            "structure": []
        }
        
        try:
            print("📝 기본 텍스트 추출 중...")
            # 기본 텍스트 추출
            if hasattr(docling_doc, 'text'):
                structured_content["text"] = docling_doc.text
                print(f"✅ 기본 텍스트 추출 완료 ({len(structured_content['text'])} 글자)")
            else:
                print("⚠️ 기본 텍스트 속성을 찾을 수 없음")
            
            # Markdown 형식으로 변환
            if options.output_format in ["markdown", "all"]:
                print("📝 Markdown 형식 변환 중...")
                try:
                    structured_content["markdown"] = docling_doc.export_to_markdown()
                    print(f"✅ Markdown 변환 완료 ({len(structured_content['markdown'])} 글자)")
                except Exception as e:
                    print(f"⚠️ Markdown 변환 실패: {e}")
                    structured_content["markdown"] = structured_content["text"]
                    print("🔄 기본 텍스트로 대체")
            
            # HTML 형식으로 변환
            if options.output_format in ["html", "all"]:
                print("🌐 HTML 형식 변환 중...")
                try:
                    structured_content["html"] = docling_doc.export_to_html()
                    print(f"✅ HTML 변환 완료 ({len(structured_content['html'])} 글자)")
                except Exception as e:
                    print(f"⚠️ HTML 변환 실패: {e}")
                    structured_content["html"] = f"<pre>{structured_content['text']}</pre>"
                    print("🔄 기본 HTML로 대체")
            
            # 테이블 추출
            if options.extract_tables:
                print("📊 테이블 추출 중...")
                structured_content["tables"] = await self._extract_tables(docling_doc)
                print(f"✅ 테이블 추출 완료 ({len(structured_content['tables'])}개)")
            
            # 이미지 추출
            if options.extract_images:
                print("🖼️ 이미지 추출 중...")
                structured_content["images"] = await self._extract_images(docling_doc, file_id)
                print(f"✅ 이미지 추출 완료 ({len(structured_content['images'])}개)")
            
            # 문서 구조 정보 추출
            print("🏗️ 문서 구조 분석 중...")
            structured_content["structure"] = await self._extract_document_structure(docling_doc)
            print(f"✅ 문서 구조 분석 완료 ({len(structured_content['structure'])}개 요소)")
            
        except Exception as e:
            print(f"구조화된 콘텐츠 추출 중 오류: {e}")
            # 최소한의 텍스트라도 반환
            if hasattr(docling_doc, 'text'):
                structured_content["text"] = docling_doc.text
                structured_content["markdown"] = docling_doc.text
        
        return structured_content
    
    async def _extract_tables(self, docling_doc: 'DoclingDocument') -> List[Dict[str, Any]]:
        """문서에서 테이블을 추출합니다."""
        tables = []
        
        try:
            # DoclingDocument에서 테이블 노드 찾기
            for item in docling_doc.iterate_items():
                if hasattr(item, 'label') and 'table' in str(item.label).lower():
                    table_data = {
                        "id": getattr(item, 'id', f"table_{len(tables)}"),
                        "page": getattr(item, 'page', 0),
                        "bbox": getattr(item, 'bbox', None),
                        "content": str(item),
                        "html": getattr(item, 'html', None) if hasattr(item, 'html') else None
                    }
                    tables.append(table_data)
                    
        except Exception as e:
            print(f"테이블 추출 중 오류: {e}")
        
        return tables
    
    async def _extract_images(self, docling_doc: 'DoclingDocument', file_id: str = None) -> List[Dict[str, Any]]:
        """문서에서 이미지를 추출하고 저장합니다."""
        images = []
        
        try:
            # 이미지 저장 디렉토리 생성
            if file_id:
                images_dir = Path(f"uploads/images/{file_id}")
                images_dir.mkdir(parents=True, exist_ok=True)
            
            # DoclingDocument에서 이미지 노드 찾기
            for item in docling_doc.iterate_items():
                if hasattr(item, 'label') and 'picture' in str(item.label).lower():
                    image_id = getattr(item, 'id', f"image_{len(images)}")
                    image_path = None
                    
                    # 이미지 데이터 추출 및 저장
                    if file_id and hasattr(item, 'image'):
                        try:
                            # 이미지 파일 저장
                            image_filename = f"{image_id}.png"
                            image_path = images_dir / image_filename
                            
                            # Docling에서 이미지 데이터 추출
                            if hasattr(item.image, 'pil_image'):
                                item.image.pil_image.save(image_path, format='PNG')
                                print(f"✅ 이미지 저장 완료: {image_path}")
                            elif hasattr(item.image, 'data'):
                                with open(image_path, 'wb') as f:
                                    f.write(item.image.data)
                                print(f"✅ 이미지 저장 완료: {image_path}")
                            
                            # 상대 경로로 변환
                            image_path = f"/uploads/images/{file_id}/{image_filename}"
                            
                        except Exception as img_error:
                            print(f"⚠️ 이미지 저장 실패: {img_error}")
                            image_path = None
                    
                    image_data = {
                        "id": image_id,
                        "page": getattr(item, 'page', 0),
                        "bbox": getattr(item, 'bbox', None),
                        "description": str(item),
                        "size": getattr(item, 'size', None),
                        "image_path": image_path,  # 저장된 이미지 경로
                        "caption": await self._generate_image_caption(item)  # 이미지 캡션 생성
                    }
                    images.append(image_data)
                    
        except Exception as e:
            print(f"이미지 추출 중 오류: {e}")
        
        return images
    
    async def _generate_image_caption(self, image_item) -> str:
        """이미지 항목에 대한 캡션을 생성합니다."""
        try:
            # Docling에서 제공하는 이미지 설명 사용
            description = str(image_item).strip()
            
            # 기본 캡션 생성
            if description and len(description) > 5:
                return description
            else:
                # 기본 캡션 생성
                page = getattr(image_item, 'page', 0)
                image_id = getattr(image_item, 'id', 'unknown')
                return f"페이지 {page}의 이미지 ({image_id})"
                
        except Exception as e:
            print(f"이미지 캡션 생성 중 오류: {e}")
            return "이미지 설명 없음"
    
    async def _extract_document_structure(self, docling_doc: 'DoclingDocument') -> List[Dict[str, Any]]:
        """문서의 구조 정보를 추출합니다."""
        structure = []
        
        try:
            # 문서 요소들의 구조 정보 추출
            for item in docling_doc.iterate_items():
                element_info = {
                    "type": str(getattr(item, 'label', 'unknown')),
                    "level": getattr(item, 'level', 0),
                    "page": getattr(item, 'page', 0),
                    "order": len(structure),
                    "text_preview": str(item)[:100] + "..." if len(str(item)) > 100 else str(item)
                }
                structure.append(element_info)
                
        except Exception as e:
            print(f"문서 구조 추출 중 오류: {e}")
        
        return structure
    
    async def convert_to_markdown(self, file_path: str) -> str:
        """문서를 Markdown으로 변환합니다."""
        options = DoclingOptions(
            output_format="markdown",
            extract_tables=True,
            extract_images=False,
            ocr_enabled=False
        )
        
        result = await self.process_document(file_path, options)
        if result.success:
            return result.content.get("markdown", "")
        else:
            raise RuntimeError(f"Markdown 변환 실패: {result.error}")
    
    async def get_document_info(self, file_path: str) -> Dict[str, Any]:
        """문서의 기본 정보를 빠르게 가져옵니다."""
        if not self.is_available:
            return {"error": "Docling을 사용할 수 없습니다."}
        
        try:
            options = DoclingOptions(
                output_format="text",
                extract_tables=False,
                extract_images=False,
                ocr_enabled=False
            )
            
            result = await self.process_document(file_path, options)
            
            return {
                "supported": True,
                "page_count": result.metadata.get("page_count", 0),
                "table_count": result.metadata.get("table_count", 0),
                "image_count": result.metadata.get("image_count", 0),
                "text_length": len(result.content.get("text", "")),
                "processing_time": result.processing_time
            }
            
        except Exception as e:
            return {
                "supported": False,
                "error": str(e)
            }