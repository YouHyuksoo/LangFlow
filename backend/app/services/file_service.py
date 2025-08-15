import os
import uuid
import aiofiles
import json
import time
import logging
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import UploadFile, HTTPException
from ..models.schemas import FileUploadResponse, FileInfo, FileProcessingOptions, DoclingResult
from ..core.config import settings
from datetime import datetime
from .category_service import CategoryService
from ..api.settings import load_settings
# LangflowService는 지연 로딩으로 처리 (순환 import 방지)
# VectorService는 지연 로딩으로 처리

class FileService:
    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        self.max_file_size = settings.MAX_FILE_SIZE
        # 로거 설정
        self.logger = logging.getLogger(__name__)
        # 동적으로 설정에서 허용 확장자 로드
        from ..api.settings import load_settings
        current_settings = load_settings()
        # 설정에서 허용된 파일 형식을 가져와서 확장자로 변환 (.pdf -> .pdf)
        allowed_file_types = current_settings.get("allowedFileTypes", ["pdf"])
        self.allowed_extensions = {f".{ext}" if not ext.startswith('.') else ext for ext in allowed_file_types}
        self.category_service = CategoryService()
        # 벡터 서비스는 지연 로딩으로 처리 - 벡터화 관련 작업에서만 초기화
        self._vector_service = None
        # Docling 서비스는 지연 로딩으로 처리
        self._docling_service = None
        
        # 업로드 디렉토리 생성
        os.makedirs(self.upload_dir, exist_ok=True)
        
        # 파일 메타데이터 저장 파일
        self.files_metadata_file = os.path.join(settings.DATA_DIR, "files_metadata.json")
        self._ensure_data_dir()
        self._load_files_metadata()
    
    @property
    def vector_service(self):
        """벡터 서비스를 지연 로딩으로 가져옵니다 (벡터화 작업에서만 초기화)."""
        if self._vector_service is None:
            print("VectorService 지연 로딩 초기화 중...")
            try:
                from .vector_service import VectorService
                self._vector_service = VectorService()
            except Exception as e:
                print(f"VectorService 초기화 실패: {str(e)}")
                # VectorService 초기화 실패 시에도 에러를 발생시키지 않음
                # 대신 None을 반환하여 상위에서 처리
                self._vector_service = None
        return self._vector_service
    
    @property
    def docling_service(self):
        """Docling 서비스를 지연 로딩으로 가져옵니다."""
        if self._docling_service is None:
            print("DoclingService 지연 로딩 초기화 중...")
            try:
                from .docling_service import DoclingService
                self._docling_service = DoclingService()
            except Exception as e:
                print(f"DoclingService 초기화 실패: {str(e)}")
                self._docling_service = None
        return self._docling_service
    
    def _ensure_data_dir(self):
        """데이터 디렉토리 생성"""
        data_dir = settings.DATA_DIR
        os.makedirs(data_dir, exist_ok=True)
    
    def _load_files_metadata(self):
        """파일 메타데이터 로드"""
        if os.path.exists(self.files_metadata_file):
            try:
                with open(self.files_metadata_file, 'r', encoding='utf-8') as f:
                    loaded_metadata = json.load(f)
                
                # 로드된 데이터가 딕셔너리인지 확인
                if isinstance(loaded_metadata, dict):
                    self.files_metadata = loaded_metadata
                elif isinstance(loaded_metadata, list):
                    print("files_metadata가 리스트 형태입니다. 빈 딕셔너리로 초기화합니다.")
                    self.files_metadata = {}
                else:
                    print(f"files_metadata의 예상치 못한 타입: {type(loaded_metadata)}")
                    self.files_metadata = {}
            except Exception as e:
                print(f"파일 메타데이터 로드 중 오류: {str(e)}")
                self.files_metadata = {}
        else:
            self.files_metadata = {}
    
    def _save_files_metadata(self):
        """파일 메타데이터 저장"""
        try:
            with open(self.files_metadata_file, 'w', encoding='utf-8') as f:
                json.dump(self.files_metadata, f, ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            print(f"파일 메타데이터 저장 중 오류: {str(e)}")

    def reset_files_metadata(self) -> Dict[str, Any]:
        """파일 메타데이터 JSON을 완전 초기화합니다."""
        try:
            removed_entries = len(getattr(self, 'files_metadata', {}) or {})
            # 파일 닫힘을 보장하기 위해 먼저 메모리 데이터 비움
            self.files_metadata = {}
            # 파일 자체 삭제 시도 (존재하면)
            if os.path.exists(self.files_metadata_file):
                try:
                    os.remove(self.files_metadata_file)
                except Exception:
                    # 삭제 실패 시 빈 내용으로 덮어쓰기
                    self._save_files_metadata()
            else:
                # 파일이 없으면 빈 파일로 생성해 일관성 유지
                self._save_files_metadata()
            return {"status": "success", "removed_entries": removed_entries}
        except Exception as e:
            print(f"파일 메타데이터 초기화 실패: {str(e)}")
            return {"status": "error", "error": str(e)}
    
    async def upload_file(self, file: UploadFile, category_id: Optional[str] = None, allow_global_duplicates: bool = False, force_replace: bool = False, processing_options: Optional[FileProcessingOptions] = None) -> FileUploadResponse:
        """파일을 업로드하고 벡터화 준비를 합니다."""
        try:
            # 파일 확장자 검증
            file_extension = os.path.splitext(file.filename)[1].lower()
            if file_extension not in self.allowed_extensions:
                raise HTTPException(
                    status_code=400, 
                    detail=f"지원하지 않는 파일 형식입니다. 지원 형식: {', '.join(self.allowed_extensions)}"
                )
            
            # 파일 크기 검증 (동적 설정 사용)
            current_settings = load_settings()
            max_file_size_mb = current_settings.get("maxFileSize", 10)
            max_file_size_bytes = max_file_size_mb * 1024 * 1024
            
            if file.size and file.size > max_file_size_bytes:
                raise HTTPException(
                    status_code=400,
                    detail=f"파일 크기가 너무 큽니다. 최대 크기: {max_file_size_mb}MB"
                )
            
            # 중복 파일 검출
            content = await file.read()
            file_size = len(content)
            
            # 파일 내용으로 해시 생성 (중복 검출용)
            import hashlib
            file_hash = hashlib.md5(content).hexdigest()
            
            # 중복 파일 검출 - 삭제되지 않은 파일들만 확인
            print(f"파일 중복 검사 시작: {file.filename} (해시: {file_hash[:8]}...)")
            for existing_file_id, existing_file_data in self.files_metadata.items():
                # 삭제된 파일은 건너뛰기
                if existing_file_data.get("status") == "deleted":
                    continue
                
                existing_hash = existing_file_data.get("file_hash")
                existing_filename = existing_file_data.get("filename")
                existing_category = existing_file_data.get("category_id")
                
                print(f"기존 파일 확인: {existing_filename} (해시: {existing_hash[:8] if existing_hash else 'None'}...)")
                
                # 해시가 같은 파일 검출 (카테고리 조건 확인)
                if (existing_hash == file_hash and 
                    existing_hash is not None and  # 해시가 있는 파일만 비교
                    (allow_global_duplicates or existing_category == category_id)):  # 전역 허용 또는 같은 카테고리
                    
                    print(f"중복 파일 발견: {existing_filename} (ID: {existing_file_id})")
                    
                    if force_replace:
                        # 강제 교체 모드: 기존 파일 삭제 후 새 파일로 교체
                        print(f"기존 파일 교체 모드: {existing_filename}")
                        await self.delete_file(existing_file_id)
                        # 교체 후 새 파일 업로드를 계속 진행하기 위해 continue
                        continue
                    else:
                        # 중복 파일 정보와 함께 응답 생성
                        raise HTTPException(
                            status_code=409,
                            detail={
                                "error": "duplicate_file",
                                "message": "동일한 파일이 이미 존재합니다.",
                                "existing_file": {
                                    "file_id": existing_file_id,
                                    "filename": existing_filename,
                                    "category_id": existing_category,
                                    "category_name": existing_file_data.get("category_name", ""),
                                },
                                "new_file": {
                                    "filename": file.filename,
                                    "size": file_size,
                                    "category_id": category_id,
                                }
                            }
                        )
                
                # 파일명과 크기가 동일하지만 해시가 없는 기존 파일의 경우 (이전 버전 호환성)
                elif (existing_filename == file.filename and 
                      existing_file_data.get("file_size") == file_size and
                      existing_category == category_id and
                      existing_hash is None):  # 기존 파일에 해시가 없는 경우
                    
                    print(f"해시 없는 기존 파일 발견: {existing_filename}")
                    
                    if force_replace:
                        # 강제 교체 모드: 기존 파일 삭제 후 새 파일로 교체
                        print(f"기존 파일 교체 모드 (해시 없음): {existing_filename}")
                        await self.delete_file(existing_file_id)
                        # 교체 후 새 파일 업로드를 계속 진행하기 위해 continue
                        continue
                    else:
                        # 기존 파일에 해시 정보 추가
                        existing_file_data["file_hash"] = file_hash
                        self._save_files_metadata()
                        
                        # 중복 파일 응답 생성 (해시 추가됨)
                        response = FileUploadResponse(
                            file_id=existing_file_id,
                            filename=file.filename,
                            status=existing_file_data.get("status", "pending_vectorization"),
                            file_size=file_size,
                            category_id=category_id,
                            category_name=existing_file_data.get("category_name"),
                            message=f"중복 파일 감지: '{existing_filename}'과 동일한 파일이 이미 존재합니다."
                        )
                        # 중복 플래그 추가 (동적 속성)
                        response.__dict__['is_duplicate'] = True
                        response.__dict__['existing_file_id'] = existing_file_id
                        return response
            
            print(f"중복 파일 없음, 새로운 파일로 업로드 진행: {file.filename}")
            
            # 고유 파일 ID 생성
            file_id = str(uuid.uuid4())
            file_extension = os.path.splitext(file.filename)[1]
            saved_filename = f"{file_id}{file_extension}"
            file_path = os.path.join(self.upload_dir, saved_filename)
            
            # 카테고리 검증
            category_name = None
            if category_id:
                category = await self.category_service.get_category(category_id)
                if not category:
                    raise HTTPException(status_code=400, detail="존재하지 않는 카테고리입니다.")
                category_name = category.name
            
            # 파일 저장
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(content)
            
            # 업로드 단계에서는 Docling 전처리를 하지 않음 (벡터화 단계에서 처리)

            # 파일 정보 저장
            file_info = {
                "file_id": file_id,
                "filename": file.filename,
                "saved_filename": saved_filename,
                "file_path": file_path,
                "file_size": file_size,
                "file_hash": file_hash,  # 중복 검출용 해시 추가
                "category_id": category_id,
                "category_name": category_name,
                "status": "uploaded",  # 업로드 완료 상태
                "upload_time": datetime.now(),
                "vectorized": False  # 벡터화는 별도 단계에서 수행
            }
            
            # 메타데이터 저장
            self.files_metadata[file_id] = file_info
            self._save_files_metadata()
            
            # 업로드 완료 메시지
            message = "파일이 성공적으로 업로드되었습니다. 벡터화는 벡터화 페이지에서 수행해주세요."
            
            return FileUploadResponse(
                file_id=file_id,
                filename=file.filename,
                status="uploaded",  # 업로드만 완료
                file_size=file_size,
                category_id=category_id,
                category_name=category_name,
                message=message
            )
            
        except HTTPException:
            # HTTPException은 그대로 전파
            raise
        except Exception as e:
            print(f"파일 업로드 중 오류: {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"파일 업로드 중 오류가 발생했습니다: {str(e)}")
    
    async def _start_vectorization(self, file_id: str):
        """백그라운드에서 파일 벡터화를 시작합니다."""
        vectorization_start_time = time.time()
        try:
            print(f"=== 벡터화 시작: {file_id} ===")
            print(f"🕰️ 벡터화 시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            # 파일 정보 조회
            print("🔍 파일 정보 조회 중...")
            file_info = await self.get_file_info(file_id)
            if not file_info:
                print(f"❌ 파일 정보를 찾을 수 없습니다: {file_id}")
                return
            
            file_size = file_info.file_size or 0
            print(f"✅ 파일 정보 확인: {file_info.filename} ({file_size / 1024 / 1024:.2f} MB)")
            print(f"📊 파일 세부사항:")
            print(f"   - 파일명: {file_info.filename}")
            print(f"   - 카테고리: {file_info.category_name}")
            print(f"   - 파일 사이즈: {file_size / 1024 / 1024:.2f} MB")
            print(f"   - 업로드 경로: {file_info.file_path}")
            
            # 파일 상태를 벡터화 대기 중으로 업데이트
            if file_id in self.files_metadata:
                self.files_metadata[file_id]["status"] = "pending_vectorization"
                self._save_files_metadata()
                print(f"상태 업데이트: pending_vectorization")
            
            # 벡터화 Flow ID 결정
            print("벡터화 Flow ID 결정 중...")
            vectorization_flow_id = await self._determine_vectorization_flow(file_id)
            
            if not vectorization_flow_id:
                print(f"적절한 벡터화 Flow를 찾을 수 없습니다. 벡터화를 건너뜁니다: {file_id}")
                # 벡터화 대기 상태로 유지
                if file_id in self.files_metadata:
                    self.files_metadata[file_id]["status"] = "pending_vectorization"
                    self.files_metadata[file_id]["vectorized"] = False
                    self._save_files_metadata()
                return
            
            print(f"선택된 Flow ID: {vectorization_flow_id}")
            
            # 벡터화 시작 - 상태를 벡터화 중으로 변경
            if file_id in self.files_metadata:
                self.files_metadata[file_id]["status"] = "vectorizing"
                self._save_files_metadata()
                print(f"상태 업데이트: vectorizing")
                
                # SSE 벡터화 시작 이벤트 발송
                print("📡 SSE 이벤트 전송 시도 중...")
                try:
                    from ..api.sse import get_sse_manager
                    sse_manager = get_sse_manager()
                    await sse_manager.broadcast("vectorization_started", {
                        "file_id": file_id,
                        "filename": file_info.filename if file_info else "Unknown",
                        "status": "started",
                        "message": "벡터화가 시작되었습니다."
                    })
                    print(f"✅ SSE 벡터화 시작 이벤트 전송 성공: {file_id}")
                    print("📢 클라이언트에 벡터화 시작 알림 전송")
                except Exception as sse_error:
                    print(f"❌ SSE 이벤트 전송 실패: {sse_error}")
            
            # Docling 통합 벡터화 파이프라인 실행
            print("Docling 통합 벡터화 파이프라인 실행 시작...")
            result = {"status": "failed", "error": "벡터화 실패"}
            
            try:
                # VectorService의 새로운 통합 파이프라인 사용
                if self.vector_service:
                    # 파일 메타데이터 준비
                    vector_metadata = {
                        "filename": file_info.filename,
                        "category_id": file_info.category_id,
                        "category_name": file_info.category_name,
                        "flow_id": vectorization_flow_id,  # 결정된 flow_id 추가
                        "upload_time": file_info.upload_time.isoformat() if file_info.upload_time else None,
                        "file_size": file_info.file_size
                    }
                    
                    # Docling 옵션 결정 (메타데이터 우선, 없으면 설정값)
                    from ..models.schemas import DoclingOptions, FileProcessingOptions

                    enable_docling = False
                    docling_options = None
                    
                    # 1. 파일 메타데이터에 저장된 처리 옵션 확인
                    processing_options_data = file_info.dict().get("processing_options")
                    if processing_options_data and processing_options_data.get("use_docling"):
                        docling_options_data = processing_options_data.get("docling_options")
                        if docling_options_data:
                            enable_docling = True
                            docling_options = DoclingOptions(**docling_options_data)
                            print(f"🔧 벡터화 시점 Docling 활성화 (파일 메타데이터 기반): {file_info.filename} (OCR: {docling_options.ocr_enabled})")

                    # 2. 메타데이터에 없으면, 전역 설정값 사용
                    if not docling_options and not enable_docling:
                        from .model_settings_service import ModelSettingsService
                        model_settings_service = ModelSettingsService()
                        docling_settings = await model_settings_service.get_docling_settings()
                        enable_docling = docling_settings.enabled

                        if enable_docling:
                            docling_options = DoclingOptions(
                                enabled=docling_settings.enabled,
                                extract_tables=docling_settings.default_extract_tables,
                                extract_images=docling_settings.default_extract_images,
                                ocr_enabled=docling_settings.default_ocr_enabled,
                                output_format=docling_settings.default_output_format
                            )
                            print(f"🔧 벡터화 시점 Docling 활성화 (전역 설정 기반): {file_info.filename} (OCR: {docling_options.ocr_enabled})")
                        else:
                            print(f"🔧 벡터화 시점 Docling 비활성화 (전역 설정 기반): {file_info.filename}")
                    
                    # 통합 벡터화 파이프라인 실행 (병렬 처리 활성화)
                    vectorization_result = await self.vector_service.vectorize_with_docling_pipeline(
                        file_path=file_info.file_path,
                        file_id=file_id,
                        metadata=vector_metadata,
                        enable_docling=enable_docling,
                        docling_options=docling_options,
                        use_parallel=True  # 고성능 병렬 처리 활성화
                    )
                    
                    if vectorization_result["success"]:
                        result = {
                            "status": "completed",
                            "chunks_count": vectorization_result["chunks_count"],
                            "processing_method": vectorization_result.get("processing_method", "unknown"),
                            "processing_time": vectorization_result.get("processing_time", 0)
                        }
                        print(f"✅ 통합 벡터화 완료: {vectorization_result['chunks_count']}개 청크, 방법: {vectorization_result.get('processing_method')}")
                    else:
                        result = {
                            "status": "failed", 
                            "error": vectorization_result.get("error", "벡터화 실패")
                        }
                        print(f"❌ 통합 벡터화 실패: {vectorization_result.get('error')}")
                else:
                    print("❌ VectorService를 사용할 수 없습니다.")
                    result = {"status": "failed", "error": "VectorService 초기화 실패"}
                    
            except Exception as e:
                print(f"❌ 통합 벡터화 파이프라인 실행 중 오류: {str(e)}")
                result = {"status": "failed", "error": str(e)}
            
            # 벡터화 완료 후 상태 업데이트
            print("📋 벡터화 결과 상태 업데이트 중...")
            total_elapsed = time.time() - vectorization_start_time
            
            if file_id in self.files_metadata:
                if result.get("status") == "completed":
                    self.files_metadata[file_id]["status"] = "vectorized"
                    self.files_metadata[file_id]["vectorized"] = True
                    self.files_metadata[file_id]["vectorized_at"] = datetime.now()
                    self.files_metadata[file_id]["used_flow_id"] = vectorization_flow_id
                    print(f"🎉 벡터화 성공 완료: {file_id} (Flow: {vectorization_flow_id})")
                    print(f"⏱️ 전체 벡터화 시간: {total_elapsed:.2f}초")
                    
                    # SSE 벡터화 완료 이벤트 발송
                    try:
                        from ..api.sse import get_sse_manager
                        sse_manager = get_sse_manager()
                        await sse_manager.broadcast("vectorization_completed", {
                            "file_id": file_id,
                            "filename": file_info.filename if file_info else "Unknown",
                            "status": "completed",
                            "vectorized": True
                        })
                        print(f"✅ SSE 벡터화 완료 이벤트 전송: {file_id}")
                    except Exception as sse_error:
                        print(f"❌ SSE 이벤트 전송 실패: {sse_error}")
                else:
                    self.files_metadata[file_id]["status"] = "vectorization_failed"
                    self.files_metadata[file_id]["error"] = result.get("error", "알 수 없는 오류")
                    print(f"❌ 벡터화 실패: {file_id} (소요 시간: {total_elapsed:.2f}초)")
                    print(f"🔍 오류 내용: {result.get('error')}")
                    print(f"⏱️ 실패까지 경과 시간: {total_elapsed:.2f}초")
                    
                    # SSE 벡터화 실패 이벤트 발송
                    try:
                        from ..api.sse import get_sse_manager
                        sse_manager = get_sse_manager()
                        await sse_manager.broadcast("vectorization_failed", {
                            "file_id": file_id,
                            "filename": file_info.filename if file_info else "Unknown",
                            "status": "failed",
                            "error": result.get("error", "알 수 없는 오류")
                        })
                        print(f"⚠️ SSE 벡터화 실패 이벤트 전송: {file_id}")
                    except Exception as sse_error:
                        print(f"❌ SSE 이벤트 전송 실패: {sse_error}")
                
                self._save_files_metadata()
                print("✅ 파일 메타데이터 업데이트 완료")
            else:
                print("⚠️ 메타데이터에서 파일을 찾을 수 없어 상태 업데이트를 건너뜀니다.")
            
            print(f"=== 벡터화 최종 완료: {file_id} ===")
            print(f"📊 전체 통계:")
            print(f"   - 총 소요 시간: {total_elapsed:.2f}초")
            print(f"   - 파일 크기: {file_size / 1024 / 1024:.2f} MB")
            print(f"   - 처리 속도: {(file_size / 1024 / 1024) / total_elapsed:.2f} MB/초")
            print(f"   - 최종 상태: {result.get('status', '알 수 없음')}")
            if result.get('status') == 'completed':
                print(f"   - 생성된 청크: {result.get('chunks_count', 0)}개")
            print(f"=== 벡터화 세션 종료: {datetime.now().strftime('%H:%M:%S')} ===")
                
        except Exception as e:
            total_elapsed = time.time() - vectorization_start_time
            print(f"❌ 벡터화 중 예상치 못한 오류: {str(e)} (소요 시간: {total_elapsed:.2f}초)")
            import traceback
            print(f"🔍 오류 상세: {traceback.format_exc()}")
            # 오류 발생 시 상태 업데이트
            if file_id in self.files_metadata:
                self.files_metadata[file_id]["status"] = "vectorization_failed"
                self.files_metadata[file_id]["error"] = str(e)
                self._save_files_metadata()
                print("✅ 오류 상태로 메타데이터 업데이트 완료")
            
            print(f"=== 벡터화 오류 종료: {file_id} (소요 시간: {total_elapsed:.2f}초) ===")
    
    async def _determine_vectorization_flow(self, file_id: str) -> Optional[str]:
        """관리자가 활성화한 벡터화 Flow를 결정합니다."""
        try:
            # 1. 환경 변수에서 기본 벡터화 Flow ID 확인
            default_flow_id = getattr(settings, 'DEFAULT_VECTORIZATION_FLOW_ID', None)
            
            if default_flow_id:
                print(f"환경 변수에서 기본 벡터화 Flow 사용: {default_flow_id}")
                return default_flow_id
            
            # 2. 설정 파일에서 기본 벡터화 Flow ID 확인
            config_file = os.path.join(settings.BASE_DIR, "langflow", "config.json")
            if os.path.exists(config_file):
                try:
                    with open(config_file, 'r', encoding='utf-8') as f:
                        config_data = json.load(f)
                    config_flow_id = config_data.get("default_vectorization_flow_id")
                    if config_flow_id:
                        print(f"설정 파일에서 기본 벡터화 Flow 사용: {config_flow_id}")
                        return config_flow_id
                except Exception as e:
                    print(f"설정 파일 읽기 오류: {str(e)}")
            
            # 3. LangflowService에서 활성 Flow 확인
            try:
                from .langflow_service import LangflowService
                langflow_service = LangflowService()
                all_flows = await langflow_service.get_flows()
                
                print(f"=== Flow 결정 디버깅 정보 ===")
                print(f"총 발견된 Flow 수: {len(all_flows)}")
                for flow in all_flows:
                    print(f"Flow ID: {flow.get('flow_id')}, Name: {flow.get('name')}")
                    print(f"  - is_active: {flow.get('is_active')}")
                    print(f"  - is_default_vectorization: {flow.get('flow_data', {}).get('is_default_vectorization', False)}")
                
                # 먼저 기본 벡터화 Flow 찾기 (is_default_vectorization: true)
                default_vectorization_flows = [flow for flow in all_flows if flow.get("flow_data", {}).get("is_default_vectorization", False) == True]
                
                print(f"기본 벡터화 Flow 개수: {len(default_vectorization_flows)}")
                
                if default_vectorization_flows:
                    # 기본 벡터화 Flow가 있으면 첫 번째 것 사용
                    default_flow = default_vectorization_flows[0]
                    print(f"✅ 기본 벡터화 Flow 사용: {default_flow['flow_id']} ({default_flow['name']})")
                    return default_flow['flow_id']
                
                # 기본 벡터화 Flow가 없으면 활성 Flow 중에서 선택
                vectorization_flows = [flow for flow in all_flows if flow.get("is_active", True)]
                
                print(f"활성 Flow 개수: {len(vectorization_flows)}")
                
                if vectorization_flows:
                    # 가장 최근에 수정된 Flow 선택
                    latest_flow = max(vectorization_flows, key=lambda x: x.get("updated_at", x.get("created_at", "")))
                    print(f"✅ 활성 Flow 사용: {latest_flow['flow_id']} ({latest_flow['name']})")
                    return latest_flow['flow_id']
                
                print(f"❌ {len(all_flows)}개 Flow를 찾았지만 사용 가능한 것이 없습니다.")
            except Exception as e:
                print(f"❌ LangflowService 초기화 실패: {str(e)}")
                import traceback
                traceback.print_exc()
            
            print("활성화된 벡터화 Flow가 없습니다.")
            return None
            
        except Exception as e:
            print(f"Flow 결정 중 오류: {str(e)}")
            return getattr(settings, 'DEFAULT_VECTORIZATION_FLOW_ID', None)
    
    async def vectorize_file(self, file_id: str) -> bool:
        """파일을 벡터화합니다. (LangFlow만 사용)"""
        try:
            # 벡터화 Flow ID 결정
            vectorization_flow_id = await self._determine_vectorization_flow(file_id)
            
            if not vectorization_flow_id:
                print(f"LangFlow Flow ID가 설정되지 않았습니다: {file_id}")
                return False
            
            # Docling 통합 벡터화 파이프라인을 통한 벡터화
            file_info = await self.get_file_info(file_id)
            if not file_info:
                print(f"파일 정보를 찾을 수 없습니다: {file_id}")
                return False
            
            try:
                # VectorService의 새로운 통합 파이프라인 사용
                if self.vector_service:
                    # 파일 메타데이터 준비
                    vector_metadata = {
                        "filename": file_info.filename,
                        "category_id": file_info.category_id,
                        "category_name": file_info.category_name,
                        "flow_id": vectorization_flow_id,  # 결정된 flow_id 추가
                        "upload_time": file_info.upload_time.isoformat() if file_info.upload_time else None,
                        "file_size": file_info.file_size
                    }
                    
                    # Docling 옵션 결정 (메타데이터 우선, 없으면 설정값)
                    from ..models.schemas import DoclingOptions, FileProcessingOptions

                    enable_docling = False
                    docling_options = None
                    
                    # 1. 파일 메타데이터에 저장된 처리 옵션 확인
                    processing_options_data = file_info.dict().get("processing_options")
                    if processing_options_data and processing_options_data.get("use_docling"):
                        docling_options_data = processing_options_data.get("docling_options")
                        if docling_options_data:
                            enable_docling = True
                            docling_options = DoclingOptions(**docling_options_data)
                            print(f"🔧 벡터화 시점 Docling 활성화 (파일 메타데이터 기반): {file_info.filename} (OCR: {docling_options.ocr_enabled})")

                    # 2. 메타데이터에 없으면, 전역 설정값 사용
                    if not docling_options and not enable_docling:
                        from .model_settings_service import ModelSettingsService
                        model_settings_service = ModelSettingsService()
                        docling_settings = await model_settings_service.get_docling_settings()
                        enable_docling = docling_settings.enabled

                        if enable_docling:
                            docling_options = DoclingOptions(
                                enabled=docling_settings.enabled,
                                extract_tables=docling_settings.default_extract_tables,
                                extract_images=docling_settings.default_extract_images,
                                ocr_enabled=docling_settings.default_ocr_enabled,
                                output_format=docling_settings.default_output_format
                            )
                            print(f"🔧 벡터화 시점 Docling 활성화 (전역 설정 기반): {file_info.filename} (OCR: {docling_options.ocr_enabled})")
                        else:
                            print(f"🔧 벡터화 시점 Docling 비활성화 (전역 설정 기반): {file_info.filename}")
                    
                    # 통합 벡터화 파이프라인 실행 (병렬 처리 활성화)
                    vectorization_result = await self.vector_service.vectorize_with_docling_pipeline(
                        file_path=file_info.file_path,
                        file_id=file_id,
                        metadata=vector_metadata,
                        enable_docling=enable_docling,
                        docling_options=docling_options,
                        use_parallel=True  # 고성능 병렬 처리 활성화
                    )
                    
                    if vectorization_result["success"]:
                        print(f"✅ 강제 벡터화 완료: {file_id}, {vectorization_result['chunks_count']}개 청크")
                        
                        # 파일 상태 업데이트
                        if file_id in self.files_metadata:
                            self.files_metadata[file_id]["status"] = "vectorized"
                            self.files_metadata[file_id]["vectorized"] = True
                            self.files_metadata[file_id]["vectorization_method"] = vectorization_result.get("processing_method", "unknown")
                            self.files_metadata[file_id]["vectorization_time"] = datetime.now()
                            self._save_files_metadata()
                        
                        return True
                    else:
                        print(f"❌ 강제 벡터화 실패: {file_id}, 오류: {vectorization_result.get('error')}")
                        return False
                else:
                    print("❌ VectorService를 사용할 수 없습니다.")
                    return False
                    
            except Exception as e:
                print(f"❌ 강제 벡터화 중 오류: {str(e)}")
                return False
                
        except Exception as e:
            print(f"벡터화 중 오류: {str(e)}")
            return False
    
    async def get_file_info(self, file_id: str) -> Optional[FileInfo]:
        """파일 정보를 조회합니다."""
        try:
            file_data = self.files_metadata.get(file_id)
            if file_data:
                return FileInfo(**file_data)
            return None
        except Exception as e:
            print(f"파일 정보 조회 중 오류: {str(e)}")
            return None
    
    async def list_files(self, category_id: Optional[str] = None) -> List[FileInfo]:
        """업로드된 파일 목록을 조회합니다."""
        try:
            # 상세 디버그 출력 제거
            files = []
            orphaned_metadata = []  # 실제 파일이 없는 메타데이터 수집
            
            # 메타데이터 파일 존재 확인
            if not hasattr(self, 'files_metadata') or self.files_metadata is None:
                # 조용히 재로드
                self._load_files_metadata()
            
            if not self.files_metadata:
                # 메타데이터 없음
                return []
            
            # 과도한 디버그 제거
            
            # 파일 목록 조회 - LangflowService 사용하지 않음
            for file_id, file_data in self.files_metadata.items():
                try:
                    # 상세 처리 로그 제거
                    
                    # file_data 타입 검증
                    if not isinstance(file_data, dict):
                        # 타입 비정상은 스킵
                        continue
                    
                    # 삭제된 파일 제외
                    if file_data.get("status") == "deleted":
                        # 삭제된 파일 스킵
                        continue
                        
                    # 카테고리 필터링
                    if category_id is not None and file_data.get("category_id") != category_id:
                        # 카테고리 필터 스킵
                        continue
                    
                    # 실제 파일 존재 여부 확인
                    file_path = file_data.get("file_path")
                    # 경로 확인 디버그 제거
                    
                    # Windows 경로 구분자 정규화
                    if file_path:
                        file_path = file_path.replace('\\', '/')
                        # 경로 정규화 디버그 제거
                    
                    if file_path and os.path.exists(file_path):
                        pass
                    else:
                        # 실제 파일이 없으면 스킵 기록
                        # 실제 파일이 없는 경우 기록하고 건너뛰기
                        orphaned_metadata.append(file_id)
                        continue
                    try:
                        # upload_time 처리 - 문자열인 경우 datetime으로 변환
                        upload_time_raw = file_data.get("upload_time")
                        upload_time = datetime.now()  # 기본값 설정
                        
                        if isinstance(upload_time_raw, str):
                            try:
                                # 다양한 날짜 형식 처리
                                if upload_time_raw.endswith('Z'):
                                    upload_time = datetime.fromisoformat(upload_time_raw.replace('Z', '+00:00'))
                                elif 'T' in upload_time_raw:
                                    upload_time = datetime.fromisoformat(upload_time_raw)
                                else:
                                    # "2025-08-05 19:56:50.113296" 형식 처리
                                    upload_time = datetime.strptime(upload_time_raw, "%Y-%m-%d %H:%M:%S.%f")
                            except ValueError as e:
                                # 파싱 실패 시 현재 시간 사용
                                upload_time = datetime.now()
                        elif isinstance(upload_time_raw, datetime):
                            upload_time = upload_time_raw
                        else:
                            # 기본값 사용
                            pass
                        
                        # 안전한 데이터 타입 변환
                        try:
                            file_size = int(file_data.get("file_size", file_data.get("size", 0)))
                        except (ValueError, TypeError):
                            file_size = 0
                        
                        try:
                            vectorized = bool(file_data.get("vectorized", False))
                        except (ValueError, TypeError):
                            vectorized = False
                        
                        # FileInfo 스키마에 맞게 데이터 정리
                        file_info_data = {
                            "file_id": str(file_id),
                            "filename": str(file_data.get("filename", "")),
                            "status": str(file_data.get("status", "unknown")),
                            "file_size": file_size,
                            "file_path": file_data.get("file_path"),
                            "category_id": file_data.get("category_id"),
                            "category_name": file_data.get("category_name"),
                            "upload_time": upload_time,
                            "vectorized": vectorized,
                            "vectorization_status": file_data.get("vectorization_status"),
                            "error_message": file_data.get("error_message"),
                            "chunk_count": file_data.get("chunk_count")
                        }
                        
                        # 벡터화 상태가 변경된 경우만 로그 출력
                        if file_data.get('vectorized') != vectorized:
                            print(f"🔄 벡터화 상태 변경 - {file_data.get('filename', 'Unknown')}: {file_data.get('vectorized')} → {vectorized}")
                        
                        # 디버그: 벡터화 상태 정보 출력 (필요시 활성화)
                        # print(f"🔍 파일 {file_data.get('filename', 'Unknown')}: vectorized={vectorized} (raw: {file_data.get('vectorized')}), status={file_data.get('status')}, vectorization_status={file_data.get('vectorization_status')}")
                        
                        # 생성 시도 로그 제거
                        
                        try:
                            file_info = FileInfo(**file_info_data)
                            # 전역 Docling 설정을 반영하여 처리 옵션 동적 업데이트
                            # 전역 Docling 설정(ModelSettingsService) 기준으로 반영
                            from .model_settings_service import ModelSettingsService
                            model_settings_service = ModelSettingsService()
                            docling_settings = await model_settings_service.get_docling_settings()
                            docling_enabled = docling_settings.enabled

                            if file_info.processing_options:
                                file_info.processing_options.use_docling = docling_enabled
                            else:
                                file_info.processing_options = FileProcessingOptions(use_docling=docling_enabled)
                            
                            files.append(file_info)
                            # 성공 로그 제거
                        except Exception as e:
                            # 실패 시만 간소 메시지
                            print(f"FileInfo 생성 실패 - 파일 ID: {file_id}, 오류: {str(e)}")
                            continue
                        
                    except (KeyError, ValueError, TypeError) as e:
                        self.logger.warning(f"파일 메타데이터 형식 오류 (파일 ID: {file_id}): {str(e)}")
                        continue
                    except Exception as e:
                        self.logger.error(f"파일 정보 변환 중 예상치 못한 오류 (파일 ID: {file_id}): {str(e)}")
                        continue
                        
                except (FileNotFoundError, PermissionError) as file_error:
                    self.logger.warning(f"파일 시스템 오류 (파일 ID: {file_id}): {str(file_error)}")
                    continue
                except Exception as file_error:
                    self.logger.error(f"개별 파일 처리 중 예상치 못한 오류 (파일 ID: {file_id}): {str(file_error)}")
                    continue
            
            # 고아 메타데이터 정리 (선택사항)
            if orphaned_metadata:
                print(f"발견된 고아 메타데이터 {len(orphaned_metadata)}개를 정리합니다.")
                for file_id in orphaned_metadata:
                    del self.files_metadata[file_id]
                self._save_files_metadata()
            
            # 업로드 시간 순으로 정렬
            files.sort(key=lambda x: x.upload_time, reverse=True)
            
            # 완료 로그 제거
            return files
            
        except FileNotFoundError as e:
            self.logger.warning(f"메타데이터 파일을 찾을 수 없음: {str(e)}")
            return []
        except PermissionError as e:
            self.logger.error(f"메타데이터 파일 권한 오류: {str(e)}")
            raise HTTPException(status_code=500, detail="파일 시스템 권한 오류")
        except json.JSONDecodeError as e:
            self.logger.error(f"메타데이터 JSON 파싱 오류: {str(e)}")
            raise HTTPException(status_code=500, detail="메타데이터 파일 손상")
        except Exception as e:
            self.logger.error(f"list_files에서 예상치 못한 오류: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail="파일 목록 조회 중 오류 발생")
    
    async def get_files_by_categories(self, category_ids: List[str] = None, categories: List[str] = None) -> List[FileInfo]:
        """특정 카테고리들의 파일 목록을 조회합니다."""
        try:
            files = []
            for file_data in self.files_metadata.values():
                # 삭제된 파일 제외
                if file_data.get("status") == "deleted":
                    continue
                    
                file_category_id = file_data.get("category_id")
                file_category_name = file_data.get("category_name")
                
                # 실제 파일 존재 여부 확인 먼저
                file_path = file_data.get("file_path")
                # Windows 경로 구분자 정규화
                if file_path:
                    file_path = file_path.replace('\\', '/')
                if not (file_path and os.path.exists(file_path)):
                    continue  # 실제 파일이 없으면 스킵
                
                # upload_time 처리
                upload_time_raw = file_data.get("upload_time")
                if isinstance(upload_time_raw, str):
                    try:
                        if upload_time_raw.endswith('Z'):
                            upload_time = datetime.fromisoformat(upload_time_raw.replace('Z', '+00:00'))
                        elif 'T' in upload_time_raw:
                            upload_time = datetime.fromisoformat(upload_time_raw)
                        else:
                            upload_time = datetime.strptime(upload_time_raw, "%Y-%m-%d %H:%M:%S.%f")
                    except ValueError:
                        upload_time = datetime.now()
                elif isinstance(upload_time_raw, datetime):
                    upload_time = upload_time_raw
                else:
                    upload_time = datetime.now()
                
                # FileInfo 데이터 준비
                file_info_data = {
                    "file_id": file_data.get("file_id", ""),
                    "filename": file_data.get("filename", ""),
                    "status": file_data.get("status", "unknown"),
                    "file_size": int(file_data.get("file_size", file_data.get("size", 0))),
                    "file_path": file_data.get("file_path"),
                    "category_id": file_data.get("category_id"),
                    "category_name": file_data.get("category_name"),
                    "upload_time": upload_time,
                    "vectorized": bool(file_data.get("vectorized", False))
                }
                
                # 카테고리 ID로 필터링
                if category_ids and file_category_id in category_ids:
                    try:
                        files.append(FileInfo(**file_info_data))
                    except Exception as e:
                        print(f"FileInfo 생성 실패 (카테고리 ID): {e}")
                    continue
                
                # 카테고리 이름으로 필터링
                if categories and file_category_name in categories:
                    try:
                        files.append(FileInfo(**file_info_data))
                    except Exception as e:
                        print(f"FileInfo 생성 실패 (카테고리 이름): {e}")
                    continue
            
            # 업로드 시간 순으로 정렬
            files.sort(key=lambda x: x.upload_time, reverse=True)
            return files
            
        except Exception as e:
            print(f"카테고리별 파일 조회 중 오류: {str(e)}")
            return []
    
    async def delete_file(self, file_id: str) -> bool:
        """파일을 삭제합니다."""
        try:
            # 파일 정보 조회
            file_data = self.files_metadata.get(file_id)
            if not file_data:
                print(f"파일 메타데이터를 찾을 수 없습니다: {file_id}")
                return False
            
            deletion_errors = []
            
            # 물리적 파일 삭제 (실패해도 계속 진행)
            try:
                file_path = file_data.get("file_path")
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"물리적 파일 삭제 완료: {file_path}")
                elif file_path:
                    print(f"물리적 파일이 이미 존재하지 않음: {file_path}")
                else:
                    print(f"파일 경로 정보가 없음: {file_id}")
            except Exception as e:
                error_msg = f"물리적 파일 삭제 실패: {str(e)}"
                print(error_msg)
                deletion_errors.append(error_msg)
            
            # 레거시 벡터 파일 삭제 코드 제거됨 - ChromaDB와 SQLite 메타데이터 사용
            
            # 벡터 서비스에서 벡터 데이터 삭제 (실패해도 계속 진행)
            try:
                from .vector_service import VectorService
                vector_service = VectorService()
                await vector_service.delete_document_vectors(file_id)
                print(f"ChromaDB 벡터 데이터 삭제 완료: {file_id}")
            except Exception as e:
                error_msg = f"ChromaDB 벡터 데이터 삭제 실패: {str(e)}"
                print(error_msg)
                deletion_errors.append(error_msg)
            
            # 메타데이터에서 파일을 삭제된 것으로 마킹 (완전 삭제 대신)
            try:
                self.files_metadata[file_id]["status"] = "deleted"
                self.files_metadata[file_id]["deleted_at"] = datetime.now()
                self.files_metadata[file_id]["deletion_errors"] = deletion_errors if deletion_errors else None
                self._save_files_metadata()
                print(f"파일을 삭제됨으로 마킹 완료: {file_id}")
            except Exception as e:
                print(f"메타데이터 상태 업데이트 실패: {str(e)}")
                return False
            
            # 삭제 과정에서 오류가 있었는지 확인하지만, 메타데이터는 삭제되었으므로 성공으로 처리
            if deletion_errors:
                print(f"파일 삭제 과정에서 일부 오류 발생했지만 메타데이터는 삭제됨: {deletion_errors}")
            
            return True
            
        except Exception as e:
            print(f"파일 삭제 중 예상치 못한 오류: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    async def generate_missing_hashes(self) -> Dict[str, Any]:
        """기존 파일들의 누락된 해시를 생성합니다."""
        try:
            import hashlib
            updated_files = []
            error_files = []
            
            for file_id, file_data in self.files_metadata.items():
                # 해시가 없고 삭제되지 않은 파일들
                if (file_data.get("file_hash") is None and 
                    file_data.get("status") != "deleted"):
                    
                    file_path = file_data.get("file_path")
                    if file_path and os.path.exists(file_path):
                        try:
                            # 파일 내용으로 해시 생성
                            with open(file_path, 'rb') as f:
                                content = f.read()
                                file_hash = hashlib.md5(content).hexdigest()
                            
                            # 해시 정보 추가
                            file_data["file_hash"] = file_hash
                            updated_files.append({
                                "file_id": file_id,
                                "filename": file_data.get("filename"),
                                "hash": file_hash[:8]
                            })
                            
                        except Exception as e:
                            error_files.append({
                                "file_id": file_id,
                                "filename": file_data.get("filename"),
                                "error": str(e)
                            })
            
            # 메타데이터 저장
            if updated_files:
                self._save_files_metadata()
                print(f"✅ {len(updated_files)}개 파일의 해시를 생성했습니다.")
            
            return {
                "updated_count": len(updated_files),
                "error_count": len(error_files),
                "updated_files": updated_files,
                "error_files": error_files
            }
            
        except Exception as e:
            print(f"해시 생성 중 오류: {str(e)}")
            return {"error": str(e)}
    
    async def extract_text_from_pdf(self, file_path: str) -> str:
        """PDF에서 텍스트를 추출합니다 (pymupdf 사용 - 한글 폰트 매핑 최적화)."""
        try:
            extracted_text = ""
            
            # 1) pymupdf 우선 사용 (한글 폰트 매핑에 가장 강력)
            try:
                import fitz  # pymupdf
                print("📄 pymupdf로 PDF 텍스트 추출 시도...")
                
                doc = fitz.open(file_path)
                
                for page_num in range(len(doc)):
                    try:
                        page = doc.load_page(page_num)
                        
                        # 텍스트 추출 (다양한 옵션으로 한글 처리 최적화)
                        text_dict = page.get_text("dict")
                        page_text = ""
                        
                        # 블록별로 텍스트 추출 (레이아웃 보존)
                        for block in text_dict["blocks"]:
                            if "lines" in block:  # 텍스트 블록
                                for line in block["lines"]:
                                    line_text = ""
                                    for span in line["spans"]:
                                        # 폰트 정보와 함께 텍스트 추출
                                        span_text = span.get("text", "")
                                        if span_text.strip():
                                            line_text += span_text
                                    if line_text.strip():
                                        page_text += line_text + "\n"
                                page_text += "\n"
                        
                        # 대체 방법: 간단한 텍스트 추출
                        if not page_text.strip():
                            page_text = page.get_text()
                        
                        # CID 코드 확인 및 처리
                        if page_text.strip():
                            if "(cid:" not in page_text.lower():
                                extracted_text += f"[페이지 {page_num + 1}]\n{page_text}\n\n"
                                print(f"✅ 페이지 {page_num + 1} 텍스트 추출 성공")
                            else:
                                print(f"⚠️ 페이지 {page_num + 1}에서 CID 코드 감지 - OCR 방법 필요")
                        
                    except Exception as e:
                        print(f"pymupdf 페이지 {page_num + 1} 추출 실패: {str(e)}")
                        continue
                
                doc.close()
                
                # pymupdf로 성공적으로 추출된 경우
                if extracted_text.strip():
                    print("✅ pymupdf로 텍스트 추출 성공")
                    return extracted_text.strip()
                else:
                    print("⚠️ pymupdf 추출 결과가 비어있음 - 다른 방법 시도")
                    
            except ImportError:
                print("❌ pymupdf 라이브러리가 설치되지 않음 - pip install pymupdf 필요")
            except Exception as e:
                print(f"pymupdf 추출 실패: {str(e)}")

            # 2) pypdf 폴백
            try:
                from pypdf import PdfReader
                print("📄 pypdf로 PDF 텍스트 추출 시도...")
                
                with open(file_path, 'rb') as file:
                    pdf_reader = PdfReader(file)
                    for page_num, page in enumerate(pdf_reader.pages):
                        try:
                            page_text = page.extract_text() or ""
                            if page_text.strip() and "(cid:" not in page_text.lower():
                                extracted_text += f"[페이지 {page_num + 1}]\n{page_text}\n\n"
                        except Exception as e:
                            print(f"pypdf 페이지 {page_num + 1} 추출 실패: {str(e)}")
                            continue
                
                if extracted_text.strip():
                    print("✅ pypdf로 텍스트 추출 성공")
                    return extracted_text.strip()
                    
            except Exception as e:
                print(f"pypdf 추출 실패: {str(e)}")

            # 3) pdfminer.six 마지막 폴백
            try:
                from pdfminer.high_level import extract_text as pdf_extract_text
                print("📄 pdfminer.six로 PDF 텍스트 추출 시도...")
                
                text = pdf_extract_text(file_path) or ""
                if text.strip():
                    # CID 패턴 제거 및 대체
                    import re
                    # CID 코드를 적절한 텍스트로 대체
                    text = re.sub(r'\(cid:\d+\)', '', text)
                    text = re.sub(r'\s+', ' ', text)  # 공백 정리
                    
                    if text.strip():
                        print("✅ pdfminer.six로 텍스트 추출 성공")
                        return text.strip()
                        
            except Exception as e:
                print(f"pdfminer.six 추출 실패: {str(e)}")

            # 모든 방법 실패
            print("❌ 모든 PDF 텍스트 추출 방법 실패")
            return "⚠️ PDF에서 텍스트를 추출할 수 없습니다.\n\n이 PDF는 다음 중 하나일 수 있습니다:\n1. 이미지 기반 PDF (OCR 필요)\n2. 특수 폰트 인코딩 사용\n3. 보안 설정으로 텍스트 추출 제한\n\n해결책: Docling을 활성화하거나 OCR 처리를 사용해보세요."
            
        except Exception as e:
            print(f"PDF 텍스트 추출 중 오류: {str(e)}")
            return f"⚠️ PDF 텍스트 추출 중 오류: {str(e)}"

    async def extract_text_from_office(self, file_path: str) -> str:
        """Office 파일(DOC, PPT, XLS)에서 텍스트를 추출합니다."""
        try:
            file_extension = os.path.splitext(file_path)[1].lower()
            text = ""
            
            if file_extension in ['.doc', '.docx']:
                # Word 문서 처리
                try:
                    from docx import Document
                    if file_extension == '.docx':
                        doc = Document(file_path)
                        for paragraph in doc.paragraphs:
                            if paragraph.text.strip():
                                text += paragraph.text + "\n"
                    else:
                        # .doc 파일은 python-docx로 직접 처리 불가, 에러 메시지 추가
                        text = f"⚠️ .doc 파일은 현재 지원되지 않습니다. .docx 파일로 변환 후 업로드해주세요."
                except ImportError:
                    text = f"⚠️ Word 파일 처리에 필요한 라이브러리가 설치되지 않았습니다. (python-docx)"
                except Exception as e:
                    text = f"⚠️ Word 파일 텍스트 추출 실패: {str(e)}"
                    
            elif file_extension in ['.ppt', '.pptx']:
                # PowerPoint 파일 처리
                try:
                    from pptx import Presentation
                    if file_extension == '.pptx':
                        prs = Presentation(file_path)
                        for slide_num, slide in enumerate(prs.slides):
                            text += f"[슬라이드 {slide_num + 1}]\n"
                            for shape in slide.shapes:
                                if hasattr(shape, 'text') and shape.text.strip():
                                    text += shape.text + "\n"
                            text += "\n"
                    else:
                        # .ppt 파일은 python-pptx로 직접 처리 불가
                        text = f"⚠️ .ppt 파일은 현재 지원되지 않습니다. .pptx 파일로 변환 후 업로드해주세요."
                except ImportError:
                    text = f"⚠️ PowerPoint 파일 처리에 필요한 라이브러리가 설치되지 않았습니다. (python-pptx)"
                except Exception as e:
                    text = f"⚠️ PowerPoint 파일 텍스트 추출 실패: {str(e)}"
                    
            elif file_extension in ['.xls', '.xlsx']:
                # Excel 파일 처리
                try:
                    import openpyxl
                    if file_extension == '.xlsx':
                        wb = openpyxl.load_workbook(file_path, data_only=True)
                        for sheet_name in wb.sheetnames:
                            text += f"[시트: {sheet_name}]\n"
                            sheet = wb[sheet_name]
                            for row in sheet.iter_rows(values_only=True):
                                row_text = []
                                for cell_value in row:
                                    if cell_value is not None:
                                        row_text.append(str(cell_value))
                                if row_text:
                                    text += " | ".join(row_text) + "\n"
                            text += "\n"
                    else:
                        # .xls 파일은 xlrd 등이 필요하지만 복잡하므로 경고 메시지
                        text = f"⚠️ .xls 파일은 현재 지원되지 않습니다. .xlsx 파일로 변환 후 업로드해주세요."
                except ImportError:
                    text = f"⚠️ Excel 파일 처리에 필요한 라이브러리가 설치되지 않았습니다. (openpyxl)"
                except Exception as e:
                    text = f"⚠️ Excel 파일 텍스트 추출 실패: {str(e)}"
            
            return text.strip() if text else "⚠️ 텍스트를 추출할 수 없습니다."
            
        except Exception as e:
            print(f"Office 파일 텍스트 추출 중 오류: {str(e)}")
            return f"⚠️ 파일 처리 중 오류가 발생했습니다: {str(e)}"

    async def extract_text_from_file(self, file_path: str) -> str:
        """파일 확장자에 따라 적절한 텍스트 추출 방법을 선택합니다 (Docling 비활성화 시 사용)."""
        try:
            file_extension = os.path.splitext(file_path)[1].lower()
            filename = os.path.basename(file_path)
            
            print(f"📄 FileService 텍스트 추출 시작: {filename} ({file_extension})")
            
            # PDF 파일
            if file_extension == '.pdf':
                print("📄 PDF 처리 - pymupdf + 다중 폴백 방식")
                return await self.extract_text_from_pdf(file_path)
            
            # Office 파일들
            elif file_extension in ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx']:
                print(f"📄 Office 파일 처리 - {file_extension}")
                return await self.extract_text_from_office(file_path)
            
            # 텍스트 파일들
            elif file_extension in ['.txt', '.md', '.csv']:
                print(f"📝 텍스트 파일 처리 - {file_extension}")
                return await self.extract_text_from_text_file(file_path)
            
            # HTML 파일들
            elif file_extension in ['.html', '.htm']:
                print(f"🌐 HTML 파일 처리 - {file_extension}")
                return await self.extract_text_from_html(file_path)
            
            # JSON 파일
            elif file_extension == '.json':
                print("📋 JSON 파일 처리")
                return await self.extract_text_from_json(file_path)
            
            # XML 파일
            elif file_extension == '.xml':
                print("🏷️ XML 파일 처리")
                return await self.extract_text_from_xml(file_path)
            
            # 기타 텍스트로 읽기 시도
            else:
                print(f"❓ 알 수 없는 형식 ({file_extension}) - 텍스트로 읽기 시도")
                return await self.extract_text_from_unknown(file_path)
                
        except Exception as e:
            print(f"❌ FileService 텍스트 추출 실패: {str(e)}")
            return f"⚠️ 텍스트 추출 실패: {str(e)}"
    
    async def extract_text_from_text_file(self, file_path: str) -> str:
        """텍스트 파일에서 텍스트를 추출합니다 (한글 인코딩 처리 포함)."""
        try:
            # UTF-8 우선 시도
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                print("✅ UTF-8 인코딩으로 읽기 성공")
                return content.strip()
            except UnicodeDecodeError:
                pass
            
            # CP949 (한글 인코딩) 시도
            try:
                with open(file_path, 'r', encoding='cp949') as f:
                    content = f.read()
                print("✅ CP949 인코딩으로 읽기 성공")
                return content.strip()
            except UnicodeDecodeError:
                pass
            
            # EUC-KR 시도
            try:
                with open(file_path, 'r', encoding='euc-kr') as f:
                    content = f.read()
                print("✅ EUC-KR 인코딩으로 읽기 성공")
                return content.strip()
            except UnicodeDecodeError:
                pass
            
            # Latin-1 폴백 (바이너리 데이터도 읽음)
            with open(file_path, 'r', encoding='latin-1') as f:
                content = f.read()
            print("⚠️ Latin-1 폴백 인코딩 사용")
            return content.strip()
                
        except Exception as e:
            print(f"텍스트 파일 읽기 실패: {str(e)}")
            return f"⚠️ 텍스트 파일 읽기 실패: {str(e)}"
    
    async def extract_text_from_html(self, file_path: str) -> str:
        """HTML 파일에서 텍스트를 추출합니다."""
        try:
            # BeautifulSoup 사용 시도
            try:
                from bs4 import BeautifulSoup
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    html_content = f.read()
                
                soup = BeautifulSoup(html_content, 'html.parser')
                # 스크립트와 스타일 태그 제거
                for script in soup(["script", "style"]):
                    script.extract()
                
                text = soup.get_text()
                # 줄바꿈 정리
                lines = (line.strip() for line in text.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                text = '\n'.join(chunk for chunk in chunks if chunk)
                
                print("✅ BeautifulSoup으로 HTML 파싱 완료")
                return text
                
            except ImportError:
                print("⚠️ BeautifulSoup이 설치되지 않음. 직접 읽기로 대체")
                with open(file_path, 'r', encoding='utf-8') as f:
                    return f.read().strip()
                    
        except Exception as e:
            print(f"HTML 파일 처리 실패: {str(e)}")
            return f"⚠️ HTML 파일 처리 실패: {str(e)}"
    
    async def extract_text_from_json(self, file_path: str) -> str:
        """JSON 파일을 텍스트로 변환합니다."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # JSON을 보기 좋은 텍스트로 변환
            text_content = json.dumps(data, ensure_ascii=False, indent=2)
            print("✅ JSON 파일 처리 완료")
            return text_content
            
        except Exception as e:
            print(f"JSON 파일 처리 실패: {str(e)}")
            # JSON 파싱이 실패하면 텍스트로 읽기
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return f.read().strip()
            except:
                return f"⚠️ JSON 파일 처리 실패: {str(e)}"
    
    async def extract_text_from_xml(self, file_path: str) -> str:
        """XML 파일에서 텍스트를 추출합니다."""
        try:
            # xml.etree 사용 시도
            try:
                import xml.etree.ElementTree as ET
                tree = ET.parse(file_path)
                root = tree.getroot()
                
                def extract_text_from_element(element):
                    text_parts = []
                    if element.text:
                        text_parts.append(element.text.strip())
                    for child in element:
                        text_parts.extend(extract_text_from_element(child))
                        if child.tail:
                            text_parts.append(child.tail.strip())
                    return [part for part in text_parts if part]
                
                all_texts = extract_text_from_element(root)
                text = '\n'.join(all_texts)
                print("✅ XML 파싱으로 텍스트 추출 완료")
                return text
                
            except Exception as xml_error:
                print(f"XML 파싱 실패: {xml_error}. 직접 읽기로 대체")
                with open(file_path, 'r', encoding='utf-8') as f:
                    return f.read().strip()
                    
        except Exception as e:
            print(f"XML 파일 처리 실패: {str(e)}")
            return f"⚠️ XML 파일 처리 실패: {str(e)}"
    
    async def extract_text_from_unknown(self, file_path: str) -> str:
        """알 수 없는 파일 형식을 텍스트로 읽기 시도합니다."""
        try:
            # 먼저 텍스트로 읽기 시도
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if content.strip():
                    print("✅ 알 수 없는 파일을 텍스트로 성공적으로 읽음")
                    return content.strip()
            except UnicodeDecodeError:
                pass
            
            # CP949로 시도
            try:
                with open(file_path, 'r', encoding='cp949') as f:
                    content = f.read()
                if content.strip():
                    print("✅ 알 수 없는 파일을 CP949로 성공적으로 읽음")
                    return content.strip()
            except UnicodeDecodeError:
                pass
            
            # 바이너리로 읽고 텍스트 부분만 추출
            with open(file_path, 'rb') as f:
                raw_data = f.read()
            
            # UTF-8로 디코드 시도 (오류 무시)
            content = raw_data.decode('utf-8', errors='ignore')
            
            if content.strip():
                print("✅ 바이너리에서 텍스트 부분 추출 완료")
                return content.strip()
            else:
                return "⚠️ 파일에서 읽을 수 있는 텍스트가 없습니다."
                
        except Exception as e:
            print(f"알 수 없는 파일 처리 실패: {str(e)}")
            return f"⚠️ 파일 처리 실패: {str(e)}"
    
    async def chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """텍스트를 청크로 분할합니다."""
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start = end - overlap
            
            if start >= len(text):
                break
        
        return chunks

    async def update_file_vectorization_status(self, file_id: str, vectorized: bool = True, error_message: str = None, vectorized_at: str = None, chunk_count: int = None) -> bool:
        """파일의 벡터화 상태를 업데이트합니다."""
        try:
            if file_id not in self.files_metadata:
                print(f"파일 메타데이터를 찾을 수 없습니다: {file_id}")
                return False
            
            # 현재 시간
            if vectorized_at is None:
                vectorized_at = datetime.now().isoformat()
            
            # 메타데이터 업데이트
            update_data = {
                "vectorized": vectorized,
                "vectorized_at": vectorized_at,
                "status": "vectorized" if vectorized else "vectorization_failed"
            }
            
            # 청크 수가 제공된 경우 추가
            if chunk_count is not None:
                update_data["chunk_count"] = chunk_count
                
            self.files_metadata[file_id].update(update_data)
            
            # 오류 메시지가 있는 경우 추가
            if error_message:
                self.files_metadata[file_id]["error_message"] = error_message
                self.files_metadata[file_id]["vectorization_status"] = "failed"
            else:
                # 성공한 경우 오류 정보 제거
                self.files_metadata[file_id].pop("error_message", None)
                self.files_metadata[file_id]["vectorization_status"] = "completed" if vectorized else "failed"
            
            # 메타데이터 파일에 저장
            self._save_files_metadata()
            
            print(f"파일 벡터화 상태 업데이트 완료: {file_id} -> vectorized={vectorized}")
            return True
            
        except Exception as e:
            print(f"파일 벡터화 상태 업데이트 중 오류: {str(e)}")
            return False

    async def get_file_path(self, file_id: str) -> Optional[str]:
        """파일 경로를 반환합니다."""
        try:
            if file_id not in self.files_metadata:
                return None
            
            file_info = self.files_metadata[file_id]
            file_path = file_info.get("file_path")
            
            if file_path and os.path.exists(file_path):
                return file_path
            
            return None
        except Exception as e:
            print(f"파일 경로 조회 중 오류: {str(e)}")
            return None

    async def cleanup_orphaned_metadata(self) -> int:
        """고아 메타데이터를 정리합니다. (실제 파일이 없는 메타데이터 제거)"""
        try:
            orphaned_count = 0
            orphaned_ids = []
            
            for file_id, file_data in self.files_metadata.items():
                file_path = file_data.get("file_path")
                if not (file_path and os.path.exists(file_path)):
                    orphaned_ids.append(file_id)
                    print(f"고아 메타데이터 발견: {file_data.get('filename')} ({file_path})")
            
            # 고아 메타데이터 제거
            for file_id in orphaned_ids:
                del self.files_metadata[file_id]
                orphaned_count += 1
            
            if orphaned_count > 0:
                self._save_files_metadata()
                print(f"총 {orphaned_count}개의 고아 메타데이터를 정리했습니다.")
            
            return orphaned_count
            
        except Exception as e:
            print(f"고아 메타데이터 정리 중 오류: {str(e)}")
            return 0

    async def sync_files_with_storage(self) -> dict:
        """스토리지와 메타데이터 동기화 상태를 확인합니다."""
        try:
            # 메타데이터에는 있지만 파일이 없는 경우
            orphaned_metadata = []
            # 파일은 있지만 메타데이터에 없는 경우
            orphaned_files = []
            
            # 메타데이터 확인
            for file_id, file_data in self.files_metadata.items():
                file_path = file_data.get("file_path")
                if not (file_path and os.path.exists(file_path)):
                    orphaned_metadata.append({
                        "file_id": file_id,
                        "filename": file_data.get("filename"),
                        "file_path": file_path
                    })
            
            # 실제 파일 확인
            if os.path.exists(self.upload_dir):
                for filename in os.listdir(self.upload_dir):
                    file_path = os.path.join(self.upload_dir, filename)
                    if os.path.isfile(file_path):
                        # 이 파일에 대한 메타데이터가 있는지 확인
                        found_metadata = False
                        for file_data in self.files_metadata.values():
                            if file_data.get("file_path") == file_path:
                                found_metadata = True
                                break
                        
                        if not found_metadata:
                            orphaned_files.append({
                                "filename": filename,
                                "file_path": file_path,
                                "size": os.path.getsize(file_path)
                            })
            
            return {
                "orphaned_metadata": orphaned_metadata,
                "orphaned_files": orphaned_files,
                "orphaned_metadata_count": len(orphaned_metadata),
                "orphaned_files_count": len(orphaned_files)
            }
            
        except Exception as e:
            print(f"파일 동기화 확인 중 오류: {str(e)}")
            return {
                "orphaned_metadata": [],
                "orphaned_files": [],
                "orphaned_metadata_count": 0,
                "orphaned_files_count": 0,
                "error": str(e)
            }

    async def retry_vectorization(self, file_id: str) -> bool:
        """파일의 벡터화를 재시도합니다."""
        try:
            # 파일 정보 확인
            file_info = await self.get_file_info(file_id)
            if not file_info:
                print(f"파일 정보를 찾을 수 없습니다: {file_id}")
                return False
            
            print(f"=== 벡터화 재시도 시작: {file_id} ({file_info.filename}) ===")
            
            # 파일 상태를 pending_vectorization으로 재설정
            if file_id in self.files_metadata:
                self.files_metadata[file_id]["status"] = "pending_vectorization"
                self.files_metadata[file_id]["vectorized"] = False
                # 이전 오류 정보 제거
                if "error" in self.files_metadata[file_id]:
                    del self.files_metadata[file_id]["error"]
                self._save_files_metadata()
                print(f"파일 상태를 pending_vectorization으로 재설정: {file_id}")
            
            # 백그라운드에서 벡터화 재시작
            import asyncio
            asyncio.create_task(self._start_vectorization(file_id))
            
            print(f"벡터화 재시도 작업 시작: {file_id}")
            return True
            
        except Exception as e:
            print(f"벡터화 재시도 중 오류: {file_id}, {str(e)}")
            return False 

    async def set_search_flow(self, flow_id: str) -> bool:
        """검색 Flow 설정"""
        try:
            from .langflow_service import LangflowService
            langflow_service = LangflowService()
            return await langflow_service.set_search_flow(flow_id)
        except Exception as e:
            print(f"검색 Flow 설정 실패: {str(e)}")
            return False

    async def delete_flow(self, flow_id: str) -> bool:
        """Flow 삭제"""
        try:
            from .langflow_service import LangflowService
            langflow_service = LangflowService()
            return await langflow_service.delete_flow(flow_id)
        except Exception as e:
            print(f"Flow 삭제 실패: {str(e)}")
            return False 

    async def sync_vectorization_status(self) -> dict:
        """벡터화 상태를 실제 ChromaDB 데이터와 동기화합니다."""
        try:
            print("=== 벡터화 상태 동기화 시작 ===")
            
            # VectorService 인스턴스 가져오기
            from .vector_service import VectorService
            vector_service = VectorService()
            
            # ChromaDB 상태 확인
            chroma_status = vector_service.get_chromadb_status()
            actual_vector_count = chroma_status.get("collection_count", 0)
            
            print(f"실제 ChromaDB 총 벡터 개수: {actual_vector_count}")
            
            # 파일별 벡터 존재 여부 확인
            sync_results = {
                "total_files": len(self.files_metadata),
                "files_with_vectors": 0,
                "files_without_vectors": 0,
                "status_corrected": 0,
                "details": []
            }
            
            for file_id, file_data in self.files_metadata.items():
                filename = file_data.get("filename", "Unknown")
                current_status = file_data.get("status", "unknown")
                current_vectorized = file_data.get("vectorized", False)
                
                # ChromaDB에서 해당 파일의 벡터 존재 여부 확인
                try:
                    file_vectors = await vector_service.get_document_chunks(file_id)
                    has_vectors = len(file_vectors) > 0
                    
                    # 상태 불일치 확인
                    status_mismatch = False
                    if has_vectors and not current_vectorized:
                        # 벡터는 있지만 메타데이터에 vectorized=False
                        status_mismatch = True
                        self.files_metadata[file_id]["vectorized"] = True
                        self.files_metadata[file_id]["status"] = "vectorized"
                        sync_results["status_corrected"] += 1
                        print(f"✅ 수정: {filename} - 벡터 존재하지만 메타데이터에 vectorized=False")
                        
                    elif not has_vectors and current_vectorized:
                        # 벡터는 없지만 메타데이터에 vectorized=True
                        status_mismatch = True
                        self.files_metadata[file_id]["vectorized"] = False
                        self.files_metadata[file_id]["status"] = "vectorization_failed"
                        sync_results["status_corrected"] += 1
                        print(f"❌ 수정: {filename} - 벡터 없지만 메타데이터에 vectorized=True")
                    
                    # 통계 업데이트
                    if has_vectors:
                        sync_results["files_with_vectors"] += 1
                    else:
                        sync_results["files_without_vectors"] += 1
                    
                    sync_results["details"].append({
                        "file_id": file_id,
                        "filename": filename,
                        "has_vectors": has_vectors,
                        "metadata_vectorized": current_vectorized,
                        "status_mismatch": status_mismatch,
                        "vector_count": len(file_vectors)
                    })
                    
                except Exception as e:
                    print(f"⚠️ 파일 벡터 확인 실패: {filename} - {str(e)}")
                    sync_results["details"].append({
                        "file_id": file_id,
                        "filename": filename,
                        "has_vectors": False,
                        "metadata_vectorized": current_vectorized,
                        "status_mismatch": False,
                        "error": str(e)
                    })
                    sync_results["files_without_vectors"] += 1
            
            # 메타데이터 저장
            if sync_results["status_corrected"] > 0:
                self._save_files_metadata()
                print(f"✅ {sync_results['status_corrected']}개 파일의 상태를 수정했습니다.")
            
            print(f"=== 벡터화 상태 동기화 완료 ===")
            print(f"총 파일: {sync_results['total_files']}")
            print(f"벡터 있는 파일: {sync_results['files_with_vectors']}")
            print(f"벡터 없는 파일: {sync_results['files_without_vectors']}")
            print(f"상태 수정된 파일: {sync_results['status_corrected']}")
            
            return sync_results
            
        except Exception as e:
            print(f"벡터화 상태 동기화 실패: {str(e)}")
            return {
                "error": str(e),
                "total_files": 0,
                "files_with_vectors": 0,
                "files_without_vectors": 0,
                "status_corrected": 0,
                "details": []
            } 