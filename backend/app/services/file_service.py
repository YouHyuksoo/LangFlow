
import os
import uuid
import aiofiles
import json
import time
import logging
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import UploadFile, HTTPException
from datetime import datetime

from ..models.schemas import FileUploadResponse, FileInfo, FileProcessingOptions
from ..core.config import settings
from .category_service import CategoryService
from .preprocessing_service import PreprocessingService
from .vector_service import VectorService

class FileService:
    """파일 관리 및 벡터화 파이프라인 오케스트레이션을 담당합니다."""
    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        self.logger = logging.getLogger(__name__)
        self._load_allowed_extensions()
        self.category_service = CategoryService()
        
        # Refactored services
        self.preprocessing_service = PreprocessingService()
        self.vector_service = VectorService()

        self.files_metadata_file = os.path.join(settings.DATA_DIR, "files_metadata.json")
        self._ensure_data_dir()
        self._load_files_metadata()

    # --- Vectorization Pipeline (Orchestrator) ---
    async def start_vectorization_pipeline(self, file_id: str):
        """전체 벡터화 파이프라인을 시작하고 관리합니다."""
        vectorization_start_time = time.time()
        self.logger.info(f"🚀 === 벡터화 파이프라인 시작: {file_id} ===")

        try:
            file_info = await self.get_file_info(file_id)
            if not file_info or not file_info.file_path or not os.path.exists(file_info.file_path):
                self.logger.error(f"파일 정보를 찾을 수 없거나 파일이 존재하지 않습니다: {file_id}")
                await self._update_vectorization_status(file_id, "failed", error="File not found or path is invalid.")
                return

            await self._update_vectorization_status(file_id, "processing")

            # 1. 전처리 단계
            self.logger.info(f"[1/2] 텍스트 추출 및 전처리 시작...")
            # 통합 설정에서 우선 전처리 방식 결정
            try:
                system_settings = settings_service.get_section_settings("system")
                preferred_method = system_settings.get("preprocessing_method", "basic")
                self.logger.info(f"기본 설정에서 전처리 방식 로드: {preferred_method}")
            except Exception as e:
                self.logger.warning(f"전처리 방식 설정 로드 실패, 기본값 사용: {e}")
                preferred_method = "basic"
            
            text_content = await self.preprocessing_service.process_file(file_info.file_path, preferred_method)
            self.logger.info(f"✅ 전처리 완료. 추출된 텍스트 길이: {len(text_content)}")

            # 2. 청킹 및 임베딩 단계
            self.logger.info(f"[2/2] 청킹 및 임베딩 시작...")
            vector_metadata = { "filename": file_info.filename, "category_id": file_info.category_id }
            result = await self.vector_service.chunk_and_embed_text(file_id, text_content, vector_metadata)

            if result.get("success"):
                self.logger.info(f"✅ 벡터화 성공. 청크 수: {result.get('chunks_count', 0)}")
                await self._update_vectorization_status(file_id, "completed", chunks_count=result.get('chunks_count'))
            else:
                self.logger.error(f"❌ 벡터화 실패: {result.get('error')}")
                await self._update_vectorization_status(file_id, "failed", error=result.get('error'))

        except Exception as e:
            self.logger.error(f"💥 벡터화 파이프라인 전체 오류: {e}", exc_info=True)
            await self._update_vectorization_status(file_id, "failed", error=str(e))
        finally:
            elapsed = time.time() - vectorization_start_time
            self.logger.info(f"🏁 === 벡터화 파이프라인 종료: {file_id} (소요 시간: {elapsed:.2f}초) ===")

    async def _update_vectorization_status(self, file_id: str, status: str, error: str = None, chunks_count: int = None):
        if file_id in self.files_metadata:
            self.files_metadata[file_id]["status"] = status
            if status == "completed":
                self.files_metadata[file_id]["vectorized"] = True
                self.files_metadata[file_id]["vectorized_at"] = datetime.now().isoformat()
                self.files_metadata[file_id]["error"] = None
                if chunks_count is not None:
                    self.files_metadata[file_id]["chunk_count"] = chunks_count
            elif status == "failed":
                self.files_metadata[file_id]["vectorized"] = False
                self.files_metadata[file_id]["error"] = error
            self._save_files_metadata()

    # --- File Management Methods (Preserved) ---
    def _load_allowed_extensions(self):
        try:
            from .settings_service import settings_service
            system_settings = settings_service.get_section_settings("system")
            allowed_file_types = system_settings.get("allowedFileTypes", ["pdf"])
            self.allowed_extensions = {f".{ext}" if not ext.startswith('.') else ext for ext in allowed_file_types}
        except Exception as e:
            self.logger.warning(f"설정 로드 실패, 기본 확장자 사용: {str(e)}")
            self.allowed_extensions = {".pdf", ".docx", ".pptx", ".xlsx", ".txt"}

    def _ensure_data_dir(self):
        os.makedirs(settings.DATA_DIR, exist_ok=True)

    def _load_files_metadata(self):
        if os.path.exists(self.files_metadata_file):
            try:
                with open(self.files_metadata_file, 'r', encoding='utf-8') as f:
                    self.files_metadata = json.load(f)
            except Exception as e:
                self.logger.error(f"파일 메타데이터 로드 실패: {e}")
                self.files_metadata = {}
        else:
            self.files_metadata = {}

    def _save_files_metadata(self):
        try:
            with open(self.files_metadata_file, 'w', encoding='utf-8') as f:
                json.dump(self.files_metadata, f, ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            self.logger.error(f"파일 메타데이터 저장 실패: {e}")

    async def upload_file(self, file: UploadFile, category_id: Optional[str] = None, allow_global_duplicates: bool = False, force_replace: bool = False, processing_options: Optional[FileProcessingOptions] = None) -> FileUploadResponse:
        try:
            file_extension = os.path.splitext(file.filename)[1].lower()
            if file_extension not in self.allowed_extensions:
                raise HTTPException(status_code=400, detail=f"지원하지 않는 파일 형식입니다. 지원 형식: {', '.join(self.allowed_extensions)}")
            
            from .settings_service import settings_service
            system_settings = settings_service.get_section_settings("system")
            max_file_size_mb = system_settings.get("maxFileSize", 10)
            max_file_size_bytes = max_file_size_mb * 1024 * 1024
            
            if file.size and file.size > max_file_size_bytes:
                raise HTTPException(status_code=400, detail=f"파일 크기가 너무 큽니다. 최대 크기: {max_file_size_mb}MB")
            
            content = await file.read()
            file_size = len(content)
            
            import hashlib
            file_hash = hashlib.md5(content).hexdigest()
            
            for existing_file_id, existing_file_data in self.files_metadata.items():
                if existing_file_data.get("status") == "deleted":
                    continue
                
                if (existing_file_data.get("file_hash") == file_hash and 
                    (allow_global_duplicates or existing_file_data.get("category_id") == category_id)):
                    if force_replace:
                        await self.delete_file(existing_file_id)
                        continue
                    else:
                        raise HTTPException(
                            status_code=409,
                            detail={"error": "duplicate_file", "message": "동일한 파일이 이미 존재합니다."}
                        )
            
            file_id = str(uuid.uuid4())
            saved_filename = f"{file_id}{file_extension}"
            file_path = os.path.join(self.upload_dir, saved_filename)
            
            category_name = None
            if category_id:
                category = await self.category_service.get_category(category_id)
                if not category:
                    raise HTTPException(status_code=400, detail="존재하지 않는 카테고리입니다.")
                category_name = category.name
            
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(content)
            
            file_info = {
                "file_id": file_id,
                "filename": file.filename,
                "saved_filename": saved_filename,
                "file_path": file_path,
                "file_size": file_size,
                "file_hash": file_hash,
                "category_id": category_id,
                "category_name": category_name,
                "status": "uploaded",
                "upload_time": datetime.now(),
                "vectorized": False
            }
            
            self.files_metadata[file_id] = file_info
            self._save_files_metadata()
            
            return FileUploadResponse(
                file_id=file_id,
                filename=file.filename,
                status="uploaded",
                file_size=file_size,
                category_id=category_id,
                category_name=category_name,
                message="파일이 성공적으로 업로드되었습니다. 벡터화는 별도로 시작해야 합니다."
            )
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"파일 업로드 중 오류: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"파일 업로드 중 오류가 발생했습니다: {str(e)}")

    async def list_files(self, category_id: Optional[str] = None) -> List[FileInfo]:
        files = []
        for file_id, file_data in self.files_metadata.items():
            if file_data.get("status") == "deleted":
                continue
            if category_id is not None and file_data.get("category_id") != category_id:
                continue
            if os.path.exists(file_data.get("file_path", "")):
                files.append(FileInfo(**file_data))
        files.sort(key=lambda x: x.upload_time, reverse=True)
        return files

    async def get_file_info(self, file_id: str) -> Optional[FileInfo]:
        file_data = self.files_metadata.get(file_id)
        return FileInfo(**file_data) if file_data else None

    async def delete_file(self, file_id: str) -> bool:
        file_data = self.files_metadata.get(file_id)
        if not file_data:
            return False
        
        try:
            if os.path.exists(file_data["file_path"]):
                os.remove(file_data["file_path"])
            await self.vector_service.delete_document_vectors(file_id)
            self.files_metadata[file_id]["status"] = "deleted"
            self.files_metadata[file_id]["deleted_at"] = datetime.now().isoformat()
            self._save_files_metadata()
            return True
        except Exception as e:
            self.logger.error(f"파일 삭제 실패: {e}", exc_info=True)
            return False
