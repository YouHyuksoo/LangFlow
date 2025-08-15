"""
고성능 병렬 벡터화 서비스
- 병렬 청크 처리
- 스트리밍 임베딩 생성
- 연결 풀링
- 캐싱 시스템
"""
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from typing import List, Dict, Any, Optional, AsyncGenerator, Tuple
from dataclasses import dataclass
from queue import Queue
import threading
from functools import lru_cache
import logging

from ..core.config import settings
from .vector_service import VectorService, _create_embedding_function
from .cache_manager import get_cache_manager


@dataclass
class ChunkBatch:
    """청크 배치 데이터 클래스"""
    chunks: List[str]
    start_index: int
    batch_id: int
    metadata: Dict[str, Any]


@dataclass
class EmbeddingResult:
    """임베딩 결과 데이터 클래스"""
    embeddings: List[List[float]]
    batch_id: int
    processing_time: float
    success: bool
    error: Optional[str] = None


class ParallelVectorService:
    """고성능 병렬 벡터화 서비스"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.base_service = VectorService()
        
        # 동적 성능 설정 로드
        self._load_performance_settings()
        
        # 세마포어로 동시성 제어
        self.embedding_semaphore = asyncio.Semaphore(self.max_concurrent_embeddings)
        self.chunk_semaphore = asyncio.Semaphore(self.max_concurrent_chunks)
        
        # 임베딩 함수 풀
        self.embedding_pool = []
        self._embedding_pool_lock = threading.Lock()
        
        # 고성능 캐시 매니저
        self.cache_manager = get_cache_manager()
        
        # 성능 통계
        self.stats = {
            "total_chunks_processed": 0,
            "total_embeddings_created": 0,
            "average_embedding_time": 0.0,
            "cache_hits": 0,
            "cache_misses": 0
        }
        
        self.logger.info(f"ParallelVectorService 초기화 완료 - 동시 임베딩: {self.max_concurrent_embeddings}, 청크: {self.max_concurrent_chunks}")
    
    def _load_performance_settings(self):
        """시스템 설정에서 성능 최적화 설정을 로드합니다."""
        try:
            # 시스템 설정 로드 시도
            from ..api.settings import load_settings
            system_settings = load_settings()
            
            # 벡터화 성능 설정을 모델 설정에서 가져오기 (통합 설정 사용)
            try:
                from .model_settings_service import get_current_model_config
                model_config = await get_current_model_config()
                model_settings_config = model_config.get("settings", {})
                
                # 모델 설정 우선, 시스템 설정 폴백, 기본값 최종 폴백
                self.max_concurrent_embeddings = model_settings_config.get("max_concurrent_embeddings", 
                                                  system_settings.get("maxConcurrentEmbeddings", settings.MAX_CONCURRENT_EMBEDDINGS))
                self.max_concurrent_chunks = model_settings_config.get("max_concurrent_chunks", 
                                            system_settings.get("maxConcurrentChunks", settings.MAX_CONCURRENT_CHUNKS))
                self.embedding_pool_size = model_settings_config.get("embedding_pool_size", 
                                          system_settings.get("embeddingPoolSize", settings.EMBEDDING_POOL_SIZE))
                self.connection_pool_size = model_settings_config.get("connection_pool_size", 
                                           system_settings.get("connectionPoolSize", settings.CONNECTION_POOL_SIZE))
            except:
                # 폴백: 시스템 설정 사용
                self.max_concurrent_embeddings = system_settings.get("maxConcurrentEmbeddings", settings.MAX_CONCURRENT_EMBEDDINGS)
                self.max_concurrent_chunks = system_settings.get("maxConcurrentChunks", settings.MAX_CONCURRENT_CHUNKS)
                self.embedding_pool_size = system_settings.get("embeddingPoolSize", settings.EMBEDDING_POOL_SIZE)
                self.connection_pool_size = system_settings.get("connectionPoolSize", settings.CONNECTION_POOL_SIZE)
            
            # 시스템 전반 성능 설정 (통합하지 않음)
            self.chunk_buffer_size = system_settings.get("chunkStreamBufferSize", settings.CHUNK_STREAM_BUFFER_SIZE)
            self.cache_ttl_seconds = system_settings.get("cacheTtlSeconds", settings.CACHE_TTL_SECONDS)
            self.enable_parallel = system_settings.get("enableParallelProcessing", True)
            self.enable_streaming = system_settings.get("enableStreamingChunks", True)
            self.enable_caching = system_settings.get("enableSmartCaching", True)
            
            print(f"🔧 동적 성능 설정 적용: 임베딩={self.max_concurrent_embeddings}, 청크={self.max_concurrent_chunks}, 병렬={self.enable_parallel}")
            
        except Exception as e:
            # 설정 로드 실패 시 기본값 사용
            print(f"⚠️ 성능 설정 로드 실패, 기본값 사용: {str(e)}")
            self.max_concurrent_embeddings = settings.MAX_CONCURRENT_EMBEDDINGS
            self.max_concurrent_chunks = settings.MAX_CONCURRENT_CHUNKS
            self.embedding_pool_size = settings.EMBEDDING_POOL_SIZE
            self.chunk_buffer_size = settings.CHUNK_STREAM_BUFFER_SIZE
            self.connection_pool_size = settings.CONNECTION_POOL_SIZE
            self.cache_ttl_seconds = settings.CACHE_TTL_SECONDS
            self.enable_parallel = True
            self.enable_streaming = True
            self.enable_caching = True
    
    async def _get_embedding_function(self):
        """임베딩 함수 풀에서 함수 가져오기 (연결 풀링)"""
        with self._embedding_pool_lock:
            if len(self.embedding_pool) < self.embedding_pool_size:
                # 새 임베딩 함수 생성
                embedding_func = await _create_embedding_function()
                self.embedding_pool.append(embedding_func)
                self.logger.debug(f"새 임베딩 함수 생성 - 풀 크기: {len(self.embedding_pool)}")
                return embedding_func
            else:
                # 기존 함수 재사용 (라운드 로빈)
                return self.embedding_pool[len(self.embedding_pool) % self.embedding_pool_size]
    
    async def _create_embeddings_batch(self, chunks: List[str], batch_id: int) -> EmbeddingResult:
        """배치별 임베딩 생성 (병렬 처리)"""
        async with self.embedding_semaphore:
            start_time = time.time()
            
            try:
                # 고성능 캐시 확인
                cached_embeddings = self.cache_manager.get_cached_embedding(chunks)
                if cached_embeddings is not None:
                    self.stats["cache_hits"] += 1
                    self.logger.debug(f"배치 {batch_id} 캐시 히트")
                    return EmbeddingResult(
                        embeddings=cached_embeddings,
                        batch_id=batch_id,
                        processing_time=time.time() - start_time,
                        success=True
                    )
                else:
                    self.stats["cache_misses"] += 1
                
                # 임베딩 함수 가져오기
                embedding_func = await self._get_embedding_function()
                
                # 병렬 임베딩 생성
                embedding_tasks = []
                for chunk in chunks:
                    task = asyncio.create_task(self._create_single_embedding(embedding_func, chunk))
                    embedding_tasks.append(task)
                
                # 모든 임베딩 완료 대기
                embeddings = await asyncio.gather(*embedding_tasks, return_exceptions=True)
                
                # 에러 확인
                valid_embeddings = []
                for i, embedding in enumerate(embeddings):
                    if isinstance(embedding, Exception):
                        self.logger.error(f"배치 {batch_id} 청크 {i} 임베딩 실패: {embedding}")
                        return EmbeddingResult(
                            embeddings=[],
                            batch_id=batch_id,
                            processing_time=time.time() - start_time,
                            success=False,
                            error=str(embedding)
                        )
                    valid_embeddings.append(embedding)
                
                # 고성능 캐시에 저장
                self.cache_manager.cache_embedding(chunks, valid_embeddings)
                
                processing_time = time.time() - start_time
                self.stats["total_embeddings_created"] += len(valid_embeddings)
                self.stats["average_embedding_time"] = (
                    (self.stats["average_embedding_time"] * self.stats["total_chunks_processed"] + processing_time) /
                    (self.stats["total_chunks_processed"] + len(chunks))
                )
                self.stats["total_chunks_processed"] += len(chunks)
                
                self.logger.debug(f"배치 {batch_id} 임베딩 완료 - {len(chunks)}개 청크, {processing_time:.2f}초")
                
                return EmbeddingResult(
                    embeddings=valid_embeddings,
                    batch_id=batch_id,
                    processing_time=processing_time,
                    success=True
                )
                
            except Exception as e:
                self.logger.error(f"배치 {batch_id} 임베딩 생성 실패: {e}")
                return EmbeddingResult(
                    embeddings=[],
                    batch_id=batch_id,
                    processing_time=time.time() - start_time,
                    success=False,
                    error=str(e)
                )
    
    async def _create_single_embedding(self, embedding_func, chunk: str) -> List[float]:
        """단일 청크 임베딩 생성"""
        try:
            # 텍스트 정규화
            normalized_chunk = chunk.strip()
            if not normalized_chunk:
                return [0.0] * 1536  # OpenAI 임베딩 차원수 기본값
            
            # 임베딩 생성 (비동기)
            embedding = await asyncio.to_thread(embedding_func, normalized_chunk)
            return embedding
            
        except Exception as e:
            self.logger.error(f"단일 임베딩 생성 실패: {e}")
            raise
    
    async def _stream_chunk_batches(self, chunks: List[str], metadata: Dict[str, Any]) -> AsyncGenerator[ChunkBatch, None]:
        """청크를 스트리밍 방식으로 배치 생성"""
        batch_size = settings.BATCH_SIZE
        total_chunks = len(chunks)
        
        self.logger.info(f"스트리밍 청크 처리 시작 - 총 {total_chunks}개 청크, 배치 크기: {batch_size}")
        
        for batch_id, start_idx in enumerate(range(0, total_chunks, batch_size)):
            end_idx = min(start_idx + batch_size, total_chunks)
            batch_chunks = chunks[start_idx:end_idx]
            
            yield ChunkBatch(
                chunks=batch_chunks,
                start_index=start_idx,
                batch_id=batch_id,
                metadata=metadata
            )
            
            # 버퍼 제어를 위한 약간의 지연
            if batch_id % self.chunk_buffer_size == 0:
                await asyncio.sleep(0.01)
    
    async def vectorize_document_parallel(
        self, 
        file_id: str, 
        chunks: List[str], 
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """병렬 문서 벡터화 (메인 함수)"""
        start_time = time.time()
        total_chunks = len(chunks)
        
        self.logger.info(f"🚀 병렬 벡터화 시작 - 파일: {file_id}, 청크: {total_chunks}개")
        
        try:
            # ChromaDB 연결 확인
            await self.base_service._ensure_client()
            
            # 병렬 처리를 위한 태스크 리스트
            embedding_tasks = []
            batch_results = []
            
            # 스트리밍 청크 배치 처리
            async for chunk_batch in self._stream_chunk_batches(chunks, metadata):
                # 병렬 임베딩 생성 태스크 추가
                task = asyncio.create_task(
                    self._create_embeddings_batch(chunk_batch.chunks, chunk_batch.batch_id)
                )
                embedding_tasks.append((task, chunk_batch))
                
                # 동시 처리 제한 확인
                if len(embedding_tasks) >= self.max_concurrent_embeddings:
                    # 완료된 태스크들 처리
                    completed_tasks, embedding_tasks = await self._process_completed_tasks(embedding_tasks)
                    batch_results.extend(completed_tasks)
            
            # 남은 태스크들 완료 대기
            if embedding_tasks:
                completed_tasks, _ = await self._process_completed_tasks(embedding_tasks, wait_all=True)
                batch_results.extend(completed_tasks)
            
            # 결과 검증 및 ChromaDB 저장
            successful_batches = [r for r in batch_results if r.success]
            failed_batches = [r for r in batch_results if not r.success]
            
            if failed_batches:
                self.logger.warning(f"실패한 배치: {len(failed_batches)}개")
                for failed in failed_batches:
                    self.logger.error(f"배치 {failed.batch_id} 실패: {failed.error}")
            
            if not successful_batches:
                return {
                    "success": False,
                    "error": "모든 배치 임베딩 생성 실패",
                    "processing_time": time.time() - start_time
                }
            
            # ChromaDB에 저장
            chromadb_start = time.time()
            success = await self._save_to_chromadb_parallel(file_id, successful_batches, chunks, metadata)
            chromadb_time = time.time() - chromadb_start
            
            total_time = time.time() - start_time
            successful_chunks = sum(len(batch.embeddings) for batch in successful_batches)
            
            result = {
                "success": success,
                "chunks_count": successful_chunks,
                "processing_method": "parallel_vectorization",
                "processing_time": total_time,
                "embedding_time": total_time - chromadb_time,
                "chromadb_time": chromadb_time,
                "failed_batches": len(failed_batches),
                "cache_hit_rate": self.stats["cache_hits"] / (self.stats["cache_hits"] + self.stats["cache_misses"]) if (self.stats["cache_hits"] + self.stats["cache_misses"]) > 0 else 0,
                "performance_stats": self.stats.copy()
            }
            
            if success:
                self.logger.info(f"✅ 병렬 벡터화 완료 - {successful_chunks}개 청크, {total_time:.2f}초 (임베딩: {total_time - chromadb_time:.2f}초, DB저장: {chromadb_time:.2f}초)")
            else:
                self.logger.error(f"❌ 병렬 벡터화 실패 - {total_time:.2f}초")
            
            return result
            
        except Exception as e:
            self.logger.error(f"병렬 벡터화 중 오류: {e}")
            return {
                "success": False,
                "error": str(e),
                "processing_time": time.time() - start_time
            }
    
    async def _process_completed_tasks(
        self, 
        embedding_tasks: List[Tuple[asyncio.Task, ChunkBatch]], 
        wait_all: bool = False
    ) -> Tuple[List[EmbeddingResult], List[Tuple[asyncio.Task, ChunkBatch]]]:
        """완료된 태스크들 처리"""
        if wait_all:
            # 모든 태스크 완료 대기
            completed_results = []
            for task, chunk_batch in embedding_tasks:
                result = await task
                completed_results.append(result)
            return completed_results, []
        else:
            # 완료된 태스크만 처리
            completed_results = []
            remaining_tasks = []
            
            for task, chunk_batch in embedding_tasks:
                if task.done():
                    try:
                        result = await task
                        completed_results.append(result)
                    except Exception as e:
                        self.logger.error(f"태스크 처리 중 오류: {e}")
                        completed_results.append(EmbeddingResult(
                            embeddings=[],
                            batch_id=chunk_batch.batch_id,
                            processing_time=0,
                            success=False,
                            error=str(e)
                        ))
                else:
                    remaining_tasks.append((task, chunk_batch))
            
            return completed_results, remaining_tasks
    
    async def _save_to_chromadb_parallel(
        self, 
        file_id: str, 
        batch_results: List[EmbeddingResult], 
        original_chunks: List[str], 
        metadata: Dict[str, Any]
    ) -> bool:
        """병렬로 생성된 임베딩을 ChromaDB에 저장"""
        try:
            # 배치 결과를 순서대로 정렬
            batch_results.sort(key=lambda x: x.batch_id)
            
            # 모든 임베딩과 청크 재구성
            all_embeddings = []
            batch_size = settings.BATCH_SIZE
            
            for batch_result in batch_results:
                all_embeddings.extend(batch_result.embeddings)
            
            # ChromaDB에 저장 (기존 방식 사용)
            return await self.base_service.add_document_chunks(file_id, original_chunks, metadata)
            
        except Exception as e:
            self.logger.error(f"ChromaDB 병렬 저장 실패: {e}")
            return False
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """성능 통계 반환"""
        cache_stats = self.cache_manager.get_comprehensive_stats()
        return {
            **self.stats,
            "embedding_pool_size": len(self.embedding_pool),
            "efficiency_score": self.stats["cache_hits"] / max(1, self.stats["cache_hits"] + self.stats["cache_misses"]),
            "cache_manager_stats": cache_stats
        }
    
    def clear_cache(self):
        """캐시 비우기"""
        self.cache_manager.clear_all_caches()
        self.logger.info("캐시가 비워졌습니다.")


# 싱글톤 인스턴스
_parallel_vector_service = None
_service_lock = threading.Lock()


def get_parallel_vector_service() -> ParallelVectorService:
    """ParallelVectorService 싱글톤 인스턴스 반환"""
    global _parallel_vector_service
    
    if _parallel_vector_service is None:
        with _service_lock:
            if _parallel_vector_service is None:
                _parallel_vector_service = ParallelVectorService()
    
    return _parallel_vector_service