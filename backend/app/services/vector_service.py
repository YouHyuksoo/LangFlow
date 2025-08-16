
import os
import json
import asyncio
import time
import threading
import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Union

import numpy as np
from ..core.config import settings
from .settings_service import settings_service
from ..models.schemas import DoclingOptions
from ..models.vector_models import VectorMetadata, VectorMetadataService

# ChromaDB 관련 패키지 임포트 시도
try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    print("ChromaDB 패키지가 설치되지 않았습니다. pip install chromadb 로 설치해주세요.")

# --- Embedding Function Wrapper (유지) ---
class EmbeddingFunction:
    # ... (기존 EmbeddingFunction 코드와 _normalize_embedding, _create_embedding_function은 변경 없음)
    pass

async def _create_embedding_function() -> Union[EmbeddingFunction, None]:
    # ... (기존 코드와 동일)
    pass

# --- Main Vector Service ---
class VectorService:
    _instance = None
    _initialized = False
    _client = None
    _collection = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(VectorService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        with VectorService._lock:
            if VectorService._initialized:
                return
            self.vector_dir = os.path.join(settings.DATA_DIR, 'vectors')
            self.metadata_dir = os.path.join(settings.DATA_DIR, 'vector_metadata')
            os.makedirs(self.vector_dir, exist_ok=True)
            os.makedirs(self.metadata_dir, exist_ok=True)
            self.metadata_service = VectorMetadataService()
            print("VectorService 초기화 완료 (ChromaDB는 지연 로딩)")
            VectorService._initialized = True

    # --- 핵심적인 새 파이프라인 함수 ---
    async def chunk_and_embed_text(
        self, 
        file_id: str, 
        text_content: str, 
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """전처리된 텍스트를 받아 청킹, 임베딩, 저장을 수행합니다."""
        try:
            # 1. 청킹
            system_settings = settings_service.get_section_settings("system")
            chunk_size = system_settings.get("chunkSize", settings.DEFAULT_CHUNK_SIZE)
            overlap_size = system_settings.get("chunkOverlap", settings.DEFAULT_CHUNK_OVERLAP)
            
            chunks = self._robust_chunking(text_content, chunk_size, overlap_size)
            if not chunks:
                return {"success": False, "error": "유효한 청크를 생성할 수 없습니다."}

            # 2. 임베딩 및 저장
            success = await self.add_document_chunks(file_id, chunks, metadata)
            if success:
                return {"success": True, "chunks_count": len(chunks)}
            else:
                return {"success": False, "error": "벡터 저장에 실패했습니다."}

        except Exception as e:
            import traceback
            print(f"❌ 청킹 및 임베딩 파이프라인 오류: {traceback.format_exc()}")
            return {"success": False, "error": str(e)}

    def _robust_chunking(self, content: str, chunk_size: int, overlap_size: int) -> List[str]:
        """
        안정성을 위한 고정 크기 슬라이딩 윈도우 청킹.
        """
        if not content or chunk_size <= 0:
            return []
        chunks = []
        start_index = 0
        while start_index < len(content):
            end_index = start_index + chunk_size
            chunks.append(content[start_index:end_index])
            next_start = start_index + chunk_size - overlap_size
            if next_start <= start_index:
                start_index += 1
            else:
                start_index = next_start
        return [chunk for chunk in chunks if chunk.strip()]

    # --- ChromaDB 및 데이터베이스 관련 함수들 (기존 코드 유지) ---
    async def _ensure_client(self):
        """ChromaDB 클라이언트 초기화"""
        if self._client is not None or not CHROMADB_AVAILABLE:
            return
            
        try:
            # ChromaDB 클라이언트 생성
            self._client = chromadb.PersistentClient(
                path=self.vector_dir
            )
            print(f"ChromaDB 클라이언트 초기화 완료: {self.vector_dir}")
        except Exception as e:
            print(f"ChromaDB 클라이언트 초기화 실패: {e}")
            self._client = None

    async def create_chromadb_database(self) -> bool:
        # ... (기존 코드와 동일)
        pass

    async def _connect_to_chromadb(self):
        # ... (기존 코드와 동일)
        pass

    async def add_document_chunks(self, file_id: str, chunks: List[str], metadata: Dict[str, Any]) -> bool:
        # ... (기존 코드와 동일)
        pass

    async def search_similar_chunks(self, query: str, top_k: int = 5, category_ids: List[str] = None) -> List[Dict[str, Any]]:
        # ... (기존 코드와 동일)
        pass
    
    async def get_status(self) -> Dict[str, Any]:
        """
        Provides a standardized status report for the ChromaDB connection and data.
        """
        # ChromaDB 패키지 가용성 먼저 확인
        if not CHROMADB_AVAILABLE:
            return {
                "connected": False,
                "total_vectors": 0,
                "collection_count": 0,
                "collections": [],
                "error": "ChromaDB 패키지가 설치되지 않았습니다."
            }
        
        # 클라이언트 초기화 시도
        await self._ensure_client()
        
        if not self._client:
            return {
                "connected": False,
                "total_vectors": 0,
                "collection_count": 0,
                "collections": [],
                "error": "ChromaDB 클라이언트 초기화에 실패했습니다."
            }

        try:
            # Check connection
            self._client.heartbeat() # Returns a nanosecond timestamp
            
            collections = self._client.list_collections()
            total_vectors = 0
            collection_names = []
            
            for collection in collections:
                try:
                    total_vectors += collection.count()
                    collection_names.append(collection.name)
                except Exception as e:
                    # Could fail if a collection is corrupt, but we can still report others
                    print(f"Could not get count for collection {collection.name}: {e}")

            return {
                "connected": True,
                "total_vectors": total_vectors,
                "collection_count": len(collections),
                "collections": collection_names,
                "error": None
            }

        except Exception as e:
            return {
                "connected": False,
                "total_vectors": 0,
                "collection_count": 0,
                "collections": [],
                "error": f"Failed to connect or retrieve status from ChromaDB: {str(e)}"
            }
    
    # ... (get_document_chunks, delete_document_vectors 등 나머지 DB 관련 함수들도 모두 그대로 유지) ...

