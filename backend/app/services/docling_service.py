# -*- coding: utf-8 -*-
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
            # 각 작업에 맞는 새로운 변환기 동적 생성
            try:
                # 이미지 추출을 위한 파이프라인 옵션
                pipeline_options = PdfPipelineOptions(
                    do_ocr=options.ocr_enabled,
                    do_table_structure=options.extract_tables,
                    generate_parsed_pages=True,
                    generate_picture_images=options.extract_images  # 이미지 생성 옵션 추가
                )
                pass
            except TypeError as e:
                # generate_picture_images 옵션이 없는 경우 폴백
                pipeline_options = PdfPipelineOptions(
                    do_ocr=options.ocr_enabled,
                    do_table_structure=options.extract_tables,
                    generate_parsed_pages=True
                )
            pdf_format_option = PdfFormatOption(pipeline_options=pipeline_options)
            job_specific_converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: pdf_format_option
                }
            )
            
            # 문서 변환 실행 (타임아웃 설정과 비동기 처리)
            loop = asyncio.get_event_loop()
            
            # 파일 크기에 따른 동적 타임아웃 설정
            dynamic_timeout = max(300, min(1800, file_size / 1024 / 1024 * 60))  # 최소 5분, 최대 30분, MB당 1분
            
            # 타임아웃을 설정하여 무한 대기 방지
            try:
                conversion_result = await asyncio.wait_for(
                    loop.run_in_executor(
                        None, 
                        self._convert_document_with_progress, 
                        file_path,
                        job_specific_converter # 동적으로 생성된 변환기 사용
                    ),
                    timeout=dynamic_timeout
                )
                
            except asyncio.TimeoutError:
                raise RuntimeError(f"문서 변환이 {dynamic_timeout/60:.1f}분을 초과했습니다. 파일 크기를 줄이거나 다른 형식으로 변환해 주세요.")
            
            # DoclingDocument 추출
            docling_doc = conversion_result.document
            
            # 구조화된 콘텐츠 추출
            content_start_time = time.time()
            # 파일 ID 생성 (파일 경로에서 추출)
            file_id = Path(file_path).stem
            structured_content = await self._extract_structured_content(
                docling_doc, options, file_id
            )
            content_elapsed = time.time() - content_start_time
            
            # 처리 시간 계산
            processing_time = (datetime.now() - start_time).total_seconds()
            
            # 결과 통계 계산
            page_count = len(docling_doc.pages) if hasattr(docling_doc, 'pages') else 0
            table_count = len(structured_content.get("tables", []))
            image_count = len(structured_content.get("images", []))
            text_length = len(structured_content.get("text", ""))
            
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
            
            return result
            
        except asyncio.TimeoutError:
            processing_time = (datetime.now() - start_time).total_seconds()
            error_msg = f"문서 변환 타임아웃 ({processing_time:.0f}초 초과). 파일이 너무 크거나 복잡합니다."
            return DoclingResult(
                success=False,
                content={"text": "", "markdown": "", "html": ""},
                error=error_msg,
                metadata={"file_path": file_path, "error": error_msg, "timeout": True},
                processing_time=processing_time
            )
            
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            return DoclingResult(
                success=False,
                content={"text": "", "markdown": "", "html": ""},
                error=str(e),
                metadata={"file_path": file_path, "error": str(e)},
                processing_time=processing_time
            )
    
    def _convert_document_with_progress(self, file_path: str, converter: Any):
        """문서 변환 (조용한 처리)"""
        start_time = datetime.now()
        
        try:
            # 파일 존재 확인
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
            
            # 실제 변환 실행
            result = converter.convert(file_path)
            
            processing_time = (datetime.now() - start_time).total_seconds()
            return result
            
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
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
            "structure": [],
            "pages": [],  # 페이지별 구조화된 정보
            "text_image_relations": []  # 텍스트-이미지 연결 정보
        }
        
        try:
            # [DEBUG] 모든 노드 라벨을 로깅하여 Docling이 무엇을 반환하는지 확인
            print("\n--- [Docling DEBUG] 문서에서 발견된 모든 노드 라벨 --- ")
            all_labels = set()
            try:
                for item in docling_doc.iterate_items():
                    if hasattr(item, 'label'):
                        all_labels.add(str(item.label).lower())
                if all_labels:
                    print(f"발견된 라벨 종류 ({len(all_labels)}개): {sorted(list(all_labels))}")
                else:
                    print("문서에서 어떠한 라벨도 발견되지 않았습니다.")
            except Exception as debug_e:
                print(f"디버그 로깅 중 오류: {debug_e}")
            print("--- [Docling DEBUG] 로깅 종료 ---\n")

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
            structured_content["structure"] = await self._extract_document_structure(docling_doc)
            
            # 페이지별 구조화된 콘텐츠 추출
            structured_content["pages"] = await self._extract_page_structured_content(docling_doc)
            
            # 텍스트-이미지 연결 정보 생성
            structured_content["text_image_relations"] = await self._create_text_image_relations(
                structured_content["pages"], 
                structured_content["images"]
            )
            
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
                    # 안전한 테이블 콘텐츠 생성 (base64 데이터 방지)
                    safe_content = f"페이지 {getattr(item, 'page', 0)}의 테이블 #{len(tables) + 1}"
                    table_data = {
                        "id": getattr(item, 'id', f"table_{len(tables)}"),
                        "page": getattr(item, 'page', 0),
                        "bbox": getattr(item, 'bbox', None),
                        "content": safe_content,
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
            
            # 방법 1: 최신 Docling API - document.pictures 사용
            if hasattr(docling_doc, 'pictures') and docling_doc.pictures:
                for idx, picture in enumerate(docling_doc.pictures):
                    try:
                        image_id = f"picture_{idx}"
                        image_path = None
                        
                        if file_id:
                            # 이미지 저장
                            image_filename = f"{image_id}.png"
                            image_path_obj = images_dir / image_filename
                            
                            # PIL 이미지로 저장 (최신 API 대응)
                            if hasattr(picture, 'get_image') and callable(picture.get_image):
                                try:
                                    # 새로운 API: doc 파라미터 필요
                                    pil_image = picture.get_image(docling_doc)
                                    pil_image.save(image_path_obj, format='PNG')
                                    image_path = f"/uploads/images/{file_id}/{image_filename}"
                                except TypeError:
                                    # 이전 API 시도
                                    try:
                                        pil_image = picture.get_image()
                                        pil_image.save(image_path_obj, format='PNG')
                                        image_path = f"/uploads/images/{file_id}/{image_filename}"
                                    except Exception as old_api_error:
                                        pass
                            elif hasattr(picture, 'image') and picture.image:
                                picture.image.save(image_path_obj, format='PNG')
                                image_path = f"/uploads/images/{file_id}/{image_filename}"
                            elif hasattr(picture, 'pil_image') and picture.pil_image:
                                picture.pil_image.save(image_path_obj, format='PNG')
                                image_path = f"/uploads/images/{file_id}/{image_filename}"
                        
                        # 안전한 설명 생성 (base64 데이터 방지)
                        safe_description = f"페이지 {getattr(picture, 'page', 0)}의 이미지 #{idx + 1}"
                        
                        image_data = {
                            "id": image_id,
                            "page": getattr(picture, 'page', 0),
                            "bbox": getattr(picture, 'bbox', None),
                            "description": safe_description,  # 안전한 설명 사용
                            "image_path": image_path,
                            "caption": f"문서의 이미지 #{idx + 1}",
                            "label": "picture_api",
                            "source": "document.pictures"
                        }
                        images.append(image_data)
                        
                    except Exception as pic_error:
                        pass
            
            # 방법 2: 기존 iterate_items 방식 (보완용)
            image_labels = ['picture', 'image', 'figure', 'chart', 'graph', 'diagram']
            
            for item_idx, item_data in enumerate(docling_doc.iterate_items()):
                # iterate_items가 tuple을 반환하는 경우 처리
                if isinstance(item_data, tuple) and len(item_data) >= 2:
                    item = item_data[1]  # 일반적으로 (레벨, 아이템) 형태
                else:
                    item = item_data
                
                # item이 유효한지 확인
                if item is None:
                    continue
                    
                item_label = str(getattr(item, 'label', '')).lower()
                is_image = any(label in item_label for label in image_labels)
                
                # 추가 이미지 검출 방법들
                has_image_data = hasattr(item, 'image') and item.image is not None
                has_bbox_like_image = (hasattr(item, 'bbox') and 
                                     hasattr(item, 'page') and 
                                     getattr(item, 'bbox', None) is not None)
                
                # MIME 타입이나 content_type으로 이미지 확인
                content_type_check = False
                if hasattr(item, 'content_type'):
                    content_type = str(getattr(item, 'content_type', '')).lower()
                    content_type_check = any(img_type in content_type for img_type in ['image/', 'png', 'jpg', 'jpeg', 'gif'])
                
                # 간단한 디버깅만 (조용히)
                
                # 통합 이미지 검출
                is_image = is_image or has_image_data or content_type_check
                
                if is_image:
                    image_id = getattr(item, 'id', f"image_{len(images)}")
                    image_path = None
                    
                    # 이미지 데이터 추출 및 저장
                    if file_id:
                        try:
                            # 이미지 파일 저장
                            image_filename = f"{image_id}.png"
                            image_path = images_dir / image_filename
                            
                            # Docling에서 이미지 데이터 추출 (다양한 방법 시도)
                            image_saved = False
                            
                            # 방법 1: PIL 이미지 객체
                            if hasattr(item, 'image') and hasattr(item.image, 'pil_image'):
                                item.image.pil_image.save(image_path, format='PNG')
                                image_saved = True
                            
                            # 방법 2: 바이너리 데이터
                            elif hasattr(item, 'image') and hasattr(item.image, 'data'):
                                with open(image_path, 'wb') as f:
                                    f.write(item.image.data)
                                image_saved = True
                            
                            # 방법 3: base64 데이터
                            elif hasattr(item, 'image') and hasattr(item.image, 'base64'):
                                import base64
                                with open(image_path, 'wb') as f:
                                    f.write(base64.b64decode(item.image.base64))
                                image_saved = True
                            
                            # 방법 4: 새로운 Docling API 확인
                            elif hasattr(item, 'image'):
                                # 이미지 객체의 다른 속성들 확인
                                for attr in ['image_data', 'bytes', 'content', 'stream']:
                                    if hasattr(item.image, attr):
                                        try:
                                            data = getattr(item.image, attr)
                                            if data:
                                                with open(image_path, 'wb') as f:
                                                    f.write(data)
                                                image_saved = True
                                                break
                                        except Exception as attr_error:
                                            pass
                            
                            if image_saved:
                                # 상대 경로로 변환
                                image_path = f"/uploads/images/{file_id}/{image_filename}"
                            else:
                                image_path = None
                            
                        except Exception as img_error:
                            image_path = None
                    
                    # 안전한 설명 생성 (base64 데이터 방지)
                    safe_description = f"페이지 {getattr(item, 'page', 0)}의 {item_label} 이미지"
                    
                    image_data = {
                        "id": image_id,
                        "page": getattr(item, 'page', 0),
                        "bbox": getattr(item, 'bbox', None),
                        "description": safe_description,  # 안전한 설명 사용
                        "image_path": image_path,  # 저장된 이미지 경로
                        "caption": f"페이지 {getattr(item, 'page', 0)}의 이미지",  # 간단한 캡션
                        "label": item_label  # 디버깅용 라벨 정보
                    }
                    images.append(image_data)
                    
        except Exception as e:
            pass
        
        return images
    
    async def _generate_image_caption(self, image_item) -> str:
        """이미지 항목에 대한 캡션을 생성합니다."""
        try:
            # 안전한 캡션 생성 (base64 데이터 방지)
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
                # 안전한 미리보기 텍스트 생성 (base64 데이터 방지)
                safe_preview = f"페이지 {getattr(item, 'page', 0)}의 {str(getattr(item, 'label', 'unknown'))} 요소"
                element_info = {
                    "type": str(getattr(item, 'label', 'unknown')),
                    "level": getattr(item, 'level', 0),
                    "page": getattr(item, 'page', 0),
                    "order": len(structure),
                    "text_preview": safe_preview
                }
                structure.append(element_info)
                
        except Exception as e:
            print(f"문서 구조 추출 중 오류: {e}")
        
        return structure
    
    async def _extract_page_structured_content(self, docling_doc: 'DoclingDocument') -> List[Dict[str, Any]]:
        """페이지별로 구조화된 콘텐츠를 추출합니다."""
        pages = []
        
        try:
            # 페이지별로 콘텐츠를 분석
            if hasattr(docling_doc, 'pages'):
                for page_idx, page in enumerate(docling_doc.pages):
                    page_content = {
                        "page_number": page_idx + 1,
                        "text_blocks": [],
                        "images": [],
                        "tables": [],
                        "elements": []
                    }
                    
                    # 해당 페이지의 모든 요소 수집
                    for item in docling_doc.iterate_items():
                        # iterate_items가 tuple을 반환하는 경우 처리
                        if isinstance(item, tuple) and len(item) >= 2:
                            actual_item = item[1]
                        else:
                            actual_item = item
                        
                        if actual_item is None:
                            continue
                            
                        item_page = getattr(actual_item, 'page', 0)
                        if item_page == page_idx:
                            item_label = str(getattr(actual_item, 'label', '')).lower()
                            # 안전한 텍스트 생성 (base64 데이터 방지)
                            safe_text = f"페이지 {item_page}의 {item_label} 요소"
                            
                            element_info = {
                                "type": item_label,
                                "text": safe_text,
                                "bbox": getattr(actual_item, 'bbox', None),
                                "order": len(page_content["elements"])
                            }
                            
                            # 요소 타입별 분류
                            if any(img_label in item_label for img_label in ['picture', 'image', 'figure']):
                                page_content["images"].append(element_info)
                            elif 'table' in item_label:
                                page_content["tables"].append(element_info)
                            elif safe_text and len(safe_text) > 10:  # 의미있는 텍스트만
                                page_content["text_blocks"].append(element_info)
                            
                            page_content["elements"].append(element_info)
                    
                    pages.append(page_content)
            
        except Exception as e:
            pass
        
        return pages
    
    async def _create_text_image_relations(self, pages: List[Dict], images: List[Dict]) -> List[Dict[str, Any]]:
        """텍스트와 이미지 간의 연결 관계를 생성합니다."""
        relations = []
        
        try:
            for page_data in pages:
                page_num = page_data["page_number"]
                text_blocks = page_data["text_blocks"]
                page_images = page_data["images"]
                
                # 해당 페이지의 전체 이미지와 매칭
                page_image_list = [img for img in images if img.get("page", 0) == page_num - 1]
                
                if text_blocks and page_image_list:
                    # 페이지 내 텍스트 블록과 이미지 연결
                    for img_idx, image in enumerate(page_image_list):
                        # 근접한 텍스트 블록 찾기 (bbox 기반)
                        closest_text = self._find_closest_text_to_image(image, text_blocks)
                        
                        relation = {
                            "image_id": image["id"],
                            "image_path": image.get("image_path"),
                            "page": page_num,
                            "related_text": closest_text.get("text", "") if closest_text else "",
                            "text_block_order": closest_text.get("order", -1) if closest_text else -1,
                            "relationship_type": "adjacent",  # 인접한 텍스트
                            "confidence": 0.8 if closest_text else 0.3
                        }
                        relations.append(relation)
                        
                        # 페이지 전체 텍스트와의 관계도 추가
                        if text_blocks:
                            page_text = " ".join([block["text"] for block in text_blocks])
                            page_relation = {
                                "image_id": image["id"],
                                "image_path": image.get("image_path"),
                                "page": page_num,
                                "related_text": page_text[:500] + "..." if len(page_text) > 500 else page_text,
                                "text_block_order": -1,
                                "relationship_type": "page_context",  # 페이지 전체 맥락
                                "confidence": 0.6
                            }
                            relations.append(page_relation)
        
        except Exception as e:
            pass
        
        return relations
    
    def _find_closest_text_to_image(self, image: Dict, text_blocks: List[Dict]) -> Dict:
        """이미지에 가장 가까운 텍스트 블록을 찾습니다."""
        if not text_blocks or not image.get("bbox"):
            return text_blocks[0] if text_blocks else {}
        
        image_bbox = image["bbox"]
        closest_text = None
        min_distance = float('inf')
        
        for text_block in text_blocks:
            if not text_block.get("bbox"):
                continue
                
            # bbox 기반 거리 계산 (간단한 중심점 거리)
            try:
                img_center_x = (image_bbox[0] + image_bbox[2]) / 2
                img_center_y = (image_bbox[1] + image_bbox[3]) / 2
                
                text_bbox = text_block["bbox"]
                text_center_x = (text_bbox[0] + text_bbox[2]) / 2
                text_center_y = (text_bbox[1] + text_bbox[3]) / 2
                
                distance = ((img_center_x - text_center_x) ** 2 + (img_center_y - text_center_y) ** 2) ** 0.5
                
                if distance < min_distance:
                    min_distance = distance
                    closest_text = text_block
                    
            except (IndexError, TypeError):
                continue
        
        return closest_text if closest_text else (text_blocks[0] if text_blocks else {})
    
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