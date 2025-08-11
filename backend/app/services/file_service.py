import os
import uuid
import aiofiles
import json
from typing import List, Optional, Dict, Any
from fastapi import UploadFile, HTTPException
from ..models.schemas import FileUploadResponse, FileInfo
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
        # 동적으로 설정에서 허용 확장자 로드
        from ..api.settings import load_settings
        current_settings = load_settings()
        # 설정에서 허용된 파일 형식을 가져와서 확장자로 변환 (.pdf -> .pdf)
        allowed_file_types = current_settings.get("allowedFileTypes", ["pdf"])
        self.allowed_extensions = {f".{ext}" if not ext.startswith('.') else ext for ext in allowed_file_types}
        self.category_service = CategoryService()
        # 벡터 서비스는 지연 로딩으로 처리 - 벡터화 관련 작업에서만 초기화
        self._vector_service = None
        
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
    
    async def upload_file(self, file: UploadFile, category_id: Optional[str] = None, allow_global_duplicates: bool = False, force_replace: bool = False) -> FileUploadResponse:
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
                "status": "uploaded",  # 단순 업로드 상태로 변경
                "upload_time": datetime.now(),
                "vectorized": False
            }
            
            # 메타데이터 저장
            self.files_metadata[file_id] = file_info
            self._save_files_metadata()
            
            # 모든 지원 파일에 대해 동일한 벡터화 안내 메시지 (PDF, Office 파일 모두 지원)
            message = "파일이 성공적으로 업로드되었습니다. 벡터화는 별도 관리 페이지에서 실행해주세요."
            
            return FileUploadResponse(
                file_id=file_id,
                filename=file.filename,
                status="uploaded",  # 상태 변경
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
        try:
            print(f"=== 벡터화 시작: {file_id} ===")
            
            # 파일 정보 조회
            file_info = await self.get_file_info(file_id)
            if not file_info:
                print(f"파일 정보를 찾을 수 없습니다: {file_id}")
                return
            
            print(f"파일 정보: {file_info.filename}, 카테고리: {file_info.category_name}")
            
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
            
            # LangFlow를 통한 벡터화 실행
            print("LangFlow 벡터화 실행 시작...")
            try:
                from .langflow_service import LangflowService
                langflow_service = LangflowService()
                result = await langflow_service.process_file_with_flow(file_id, vectorization_flow_id, file_info)
                print(f"LangFlow 벡터화 결과: {result}")
            except Exception as e:
                print(f"LangflowService 초기화 실패: {str(e)}")
                result = {"status": "failed", "error": str(e)}
            
            # 벡터화 완료 후 상태 업데이트
            if file_id in self.files_metadata:
                if result.get("status") == "completed":
                    self.files_metadata[file_id]["status"] = "vectorized"
                    self.files_metadata[file_id]["vectorized"] = True
                    self.files_metadata[file_id]["vectorized_at"] = datetime.now()
                    self.files_metadata[file_id]["used_flow_id"] = vectorization_flow_id
                    print(f"벡터화 완료: {file_id} (Flow: {vectorization_flow_id})")
                else:
                    self.files_metadata[file_id]["status"] = "vectorization_failed"
                    self.files_metadata[file_id]["error"] = result.get("error", "알 수 없는 오류")
                    print(f"벡터화 실패: {file_id}")
                    print(f"오류 내용: {result.get('error')}")
                
                self._save_files_metadata()
                print(f"최종 상태 업데이트: {self.files_metadata[file_id]['status']}")
                
        except Exception as e:
            print(f"벡터화 중 오류 발생: {file_id}, 오류: {str(e)}")
            import traceback
            traceback.print_exc()
            # 오류 발생 시 상태 업데이트
            if file_id in self.files_metadata:
                self.files_metadata[file_id]["status"] = "vectorization_failed"
                self.files_metadata[file_id]["error"] = str(e)
                self._save_files_metadata()
    
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
                active_flows = await langflow_service.get_flows()
                vectorization_flows = [flow for flow in active_flows if flow.get("is_active", False)]
                
                if vectorization_flows:
                    # 가장 최근에 수정된 Flow 선택
                    latest_flow = max(vectorization_flows, key=lambda x: x.get("updated_at", x.get("created_at", "")))
                    print(f"활성 Flow 사용: {latest_flow['flow_id']} ({latest_flow['name']})")
                    return latest_flow['flow_id']
            except Exception as e:
                print(f"LangflowService 초기화 실패: {str(e)}")
            
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
            
            # LangFlow를 통한 벡터화
            file_info = await self.get_file_info(file_id)
            if not file_info:
                print(f"파일 정보를 찾을 수 없습니다: {file_id}")
                return False
                
            try:
                from .langflow_service import LangflowService
                langflow_service = LangflowService()
                result = await langflow_service.process_file_with_flow(file_id, vectorization_flow_id, file_info)
            except Exception as e:
                print(f"LangflowService 초기화 실패: {str(e)}")
                return False
            
            if result.get("status") == "completed":
                print(f"LangFlow 벡터화 완료: {file_id}")
                return True
            else:
                print(f"LangFlow 벡터화 실패: {file_id}")
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
                            "category_id": file_data.get("category_id"),
                            "category_name": file_data.get("category_name"),
                            "upload_time": upload_time,
                            "vectorized": vectorized,
                            "vectorization_status": file_data.get("vectorization_status"),
                            "error_message": file_data.get("error_message")
                        }
                        
                        # 벡터화 상태가 변경된 경우만 로그 출력
                        if file_data.get('vectorized') != vectorized:
                            print(f"🔄 벡터화 상태 변경 - {file_data.get('filename', 'Unknown')}: {file_data.get('vectorized')} → {vectorized}")
                        
                        # 디버그: 벡터화 상태 정보 출력 (필요시 활성화)
                        # print(f"🔍 파일 {file_data.get('filename', 'Unknown')}: vectorized={vectorized} (raw: {file_data.get('vectorized')}), status={file_data.get('status')}, vectorization_status={file_data.get('vectorization_status')}")
                        
                        # 생성 시도 로그 제거
                        
                        try:
                            file_info = FileInfo(**file_info_data)
                            files.append(file_info)
                            # 성공 로그 제거
                        except Exception as e:
                            # 실패 시만 간소 메시지
                            print(f"FileInfo 생성 실패 - 파일 ID: {file_id}, 오류: {str(e)}")
                            continue
                        
                    except Exception as e:
                        print(f"파일 정보 변환 중 오류 (파일 ID: {file_id}): {str(e)}")
                        import traceback
                        traceback.print_exc()
                        continue
                        
                except Exception as file_error:
                    print(f"개별 파일 처리 중 오류 (파일 ID: {file_id}): {str(file_error)}")
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
            
        except Exception as e:
            print(f"list_files에서 예외 발생: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
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
            
            # 벡터 데이터 파일 삭제 (실패해도 계속 진행)
            try:
                vector_file_path = os.path.join(
                    settings.DATA_DIR, 
                    f"vectors_{file_id}.json"
                )
                if os.path.exists(vector_file_path):
                    os.remove(vector_file_path)
                    print(f"벡터 데이터 파일 삭제 완료: {vector_file_path}")
                else:
                    print(f"벡터 데이터 파일이 이미 존재하지 않음: {vector_file_path}")
            except Exception as e:
                error_msg = f"벡터 데이터 파일 삭제 실패: {str(e)}"
                print(error_msg)
                deletion_errors.append(error_msg)
            
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
        """PDF에서 텍스트를 추출합니다."""
        try:
            from pypdf import PdfReader
            
            text = ""
            with open(file_path, 'rb') as file:
                pdf_reader = PdfReader(file)
                
                for page_num, page in enumerate(pdf_reader.pages):
                    try:
                        page_text = page.extract_text()
                        if page_text.strip():
                            text += f"[페이지 {page_num + 1}]\n{page_text}\n\n"
                    except Exception as e:
                        print(f"페이지 {page_num + 1} 텍스트 추출 실패: {str(e)}")
                        continue
            
            return text.strip()
            
        except Exception as e:
            print(f"PDF 텍스트 추출 중 오류: {str(e)}")
            return ""

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
        """파일 확장자에 따라 적절한 텍스트 추출 방법을 선택합니다."""
        try:
            file_extension = os.path.splitext(file_path)[1].lower()
            
            if file_extension == '.pdf':
                return await self.extract_text_from_pdf(file_path)
            elif file_extension in ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx']:
                return await self.extract_text_from_office(file_path)
            else:
                return f"⚠️ 지원되지 않는 파일 형식입니다: {file_extension}"
                
        except Exception as e:
            print(f"파일 텍스트 추출 중 오류: {str(e)}")
            return f"⚠️ 파일 처리 중 오류가 발생했습니다: {str(e)}"
    
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

    async def update_file_vectorization_status(self, file_id: str, vectorized: bool = True, error_message: str = None, vectorized_at: str = None) -> bool:
        """파일의 벡터화 상태를 업데이트합니다."""
        try:
            if file_id not in self.files_metadata:
                print(f"파일 메타데이터를 찾을 수 없습니다: {file_id}")
                return False
            
            # 현재 시간
            if vectorized_at is None:
                vectorized_at = datetime.now().isoformat()
            
            # 메타데이터 업데이트
            self.files_metadata[file_id].update({
                "vectorized": vectorized,
                "vectorized_at": vectorized_at,
                "status": "vectorized" if vectorized else "vectorization_failed"
            })
            
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