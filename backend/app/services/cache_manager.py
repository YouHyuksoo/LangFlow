"""
고성능 캐싱 및 연결 풀링 시스템
- LRU 캐시 with TTL
- ChromaDB 연결 풀링
- 임베딩 결과 캐싱
- 메모리 사용량 모니터링
"""
import asyncio
import time
import hashlib
import threading
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from collections import OrderedDict
import weakref
import psutil
import logging

from ..core.config import settings


@dataclass
class CacheEntry:
    """캐시 엔트리"""
    data: Any
    timestamp: float
    access_count: int = 0
    last_access: float = field(default_factory=time.time)
    size_bytes: int = 0


@dataclass
class CacheStats:
    """캐시 통계"""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    total_size_bytes: int = 0
    entry_count: int = 0
    hit_rate: float = 0.0
    memory_usage_mb: float = 0.0


class TTLCache:
    """TTL 기능이 있는 LRU 캐시"""
    
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self.lock = threading.RLock()
        self.stats = CacheStats()
        
        # 메모리 모니터링
        self.max_memory_mb = 500  # 최대 500MB
        self.cleanup_threshold = 0.8  # 80% 사용시 정리
        
        # 정리 작업 스케줄링
        self._cleanup_task = None
        self._start_cleanup_scheduler()
    
    def _start_cleanup_scheduler(self):
        """정리 작업 스케줄러 시작"""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
    
    async def _periodic_cleanup(self):
        """주기적 캐시 정리"""
        while True:
            try:
                await asyncio.sleep(300)  # 5분마다 정리
                self._cleanup_expired()
                self._check_memory_usage()
            except Exception as e:
                logging.getLogger(__name__).error(f"캐시 정리 중 오류: {e}")
    
    def _calculate_size(self, data: Any) -> int:
        """데이터 크기 추정"""
        try:
            import sys
            return sys.getsizeof(data)
        except:
            return len(str(data)) * 2  # 대략적 추정
    
    def put(self, key: str, value: Any) -> bool:
        """캐시에 값 저장"""
        with self.lock:
            try:
                current_time = time.time()
                entry_size = self._calculate_size(value)
                
                # 메모리 제한 확인
                if (self.stats.total_size_bytes + entry_size) / 1024 / 1024 > self.max_memory_mb:
                    self._evict_lru_entries(entry_size)
                
                # 기존 엔트리 업데이트 또는 새 엔트리 생성
                if key in self.cache:
                    old_entry = self.cache[key]
                    self.stats.total_size_bytes -= old_entry.size_bytes
                    del self.cache[key]
                
                entry = CacheEntry(
                    data=value,
                    timestamp=current_time,
                    access_count=1,
                    last_access=current_time,
                    size_bytes=entry_size
                )
                
                self.cache[key] = entry
                self.stats.total_size_bytes += entry_size
                self.stats.entry_count = len(self.cache)
                
                # LRU 제한 확인
                if len(self.cache) > self.max_size:
                    self._evict_lru_entries(0)
                
                return True
                
            except Exception as e:
                logging.getLogger(__name__).error(f"캐시 저장 실패: {e}")
                return False
    
    def get(self, key: str) -> Optional[Any]:
        """캐시에서 값 조회"""
        with self.lock:
            if key not in self.cache:
                self.stats.misses += 1
                self._update_hit_rate()
                return None
            
            entry = self.cache[key]
            current_time = time.time()
            
            # TTL 확인
            if current_time - entry.timestamp > self.ttl_seconds:
                del self.cache[key]
                self.stats.total_size_bytes -= entry.size_bytes
                self.stats.entry_count = len(self.cache)
                self.stats.misses += 1
                self.stats.evictions += 1
                self._update_hit_rate()
                return None
            
            # LRU 업데이트
            entry.access_count += 1
            entry.last_access = current_time
            self.cache.move_to_end(key)
            
            self.stats.hits += 1
            self._update_hit_rate()
            return entry.data
    
    def _evict_lru_entries(self, needed_space: int = 0):
        """LRU 방식으로 엔트리 제거"""
        target_size = self.max_memory_mb * 1024 * 1024 * self.cleanup_threshold
        
        while (len(self.cache) > self.max_size or 
               self.stats.total_size_bytes + needed_space > target_size):
            if not self.cache:
                break
                
            # 가장 오래된 엔트리 제거
            key, entry = self.cache.popitem(last=False)
            self.stats.total_size_bytes -= entry.size_bytes
            self.stats.evictions += 1
        
        self.stats.entry_count = len(self.cache)
    
    def _cleanup_expired(self):
        """만료된 엔트리 정리"""
        with self.lock:
            current_time = time.time()
            expired_keys = [
                key for key, entry in self.cache.items()
                if current_time - entry.timestamp > self.ttl_seconds
            ]
            
            for key in expired_keys:
                entry = self.cache[key]
                del self.cache[key]
                self.stats.total_size_bytes -= entry.size_bytes
                self.stats.evictions += 1
            
            self.stats.entry_count = len(self.cache)
    
    def _check_memory_usage(self):
        """메모리 사용량 확인 및 정리"""
        current_usage_mb = self.stats.total_size_bytes / 1024 / 1024
        self.stats.memory_usage_mb = current_usage_mb
        
        if current_usage_mb > self.max_memory_mb * self.cleanup_threshold:
            self._evict_lru_entries()
    
    def _update_hit_rate(self):
        """적중률 업데이트"""
        total_requests = self.stats.hits + self.stats.misses
        if total_requests > 0:
            self.stats.hit_rate = self.stats.hits / total_requests
    
    def clear(self):
        """캐시 전체 삭제"""
        with self.lock:
            self.cache.clear()
            self.stats = CacheStats()
    
    def get_stats(self) -> CacheStats:
        """캐시 통계 반환"""
        with self.lock:
            return self.stats


class ConnectionPool:
    """ChromaDB 연결 풀"""
    
    def __init__(self, max_connections: int = None):
        self.max_connections = max_connections or settings.CONNECTION_POOL_SIZE
        self.connections: List[Any] = []
        self.in_use: Dict[int, Any] = {}
        self.lock = asyncio.Lock()
        self.created_count = 0
        self.logger = logging.getLogger(__name__)
    
    async def get_connection(self):
        """연결 풀에서 연결 가져오기"""
        async with self.lock:
            # 사용 가능한 연결 확인
            if self.connections:
                connection = self.connections.pop()
                connection_id = id(connection)
                self.in_use[connection_id] = connection
                self.logger.debug(f"기존 연결 재사용: {connection_id}")
                return connection
            
            # 새 연결 생성 (최대 개수 제한)
            if self.created_count < self.max_connections:
                try:
                    from ..services.vector_service import VectorService
                    connection = await VectorService()._create_fresh_client()
                    connection_id = id(connection)
                    self.in_use[connection_id] = connection
                    self.created_count += 1
                    self.logger.debug(f"새 연결 생성: {connection_id}")
                    return connection
                except Exception as e:
                    self.logger.error(f"연결 생성 실패: {e}")
                    raise
            
            # 연결 풀 한계 도달, 대기
            self.logger.warning("연결 풀 한계 도달, 연결 반환 대기")
            return None
    
    async def return_connection(self, connection):
        """연결을 풀로 반환"""
        async with self.lock:
            connection_id = id(connection)
            if connection_id in self.in_use:
                del self.in_use[connection_id]
                self.connections.append(connection)
                self.logger.debug(f"연결 반환: {connection_id}")
    
    async def close_all(self):
        """모든 연결 종료"""
        async with self.lock:
            all_connections = list(self.connections) + list(self.in_use.values())
            for connection in all_connections:
                try:
                    if hasattr(connection, 'close'):
                        await connection.close()
                except Exception as e:
                    self.logger.error(f"연결 종료 실패: {e}")
            
            self.connections.clear()
            self.in_use.clear()
            self.created_count = 0
    
    def get_pool_stats(self) -> Dict[str, int]:
        """연결 풀 통계"""
        return {
            "available_connections": len(self.connections),
            "in_use_connections": len(self.in_use),
            "total_created": self.created_count,
            "max_connections": self.max_connections
        }


class CacheManager:
    """통합 캐시 관리자"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # 다양한 용도의 캐시들
        self.embedding_cache = TTLCache(
            max_size=5000, 
            ttl_seconds=settings.CACHE_TTL_SECONDS
        )
        self.chunk_cache = TTLCache(
            max_size=2000, 
            ttl_seconds=settings.CACHE_TTL_SECONDS
        )
        self.metadata_cache = TTLCache(
            max_size=1000, 
            ttl_seconds=settings.CACHE_TTL_SECONDS // 2
        )
        
        # 연결 풀
        self.connection_pool = ConnectionPool()
        
        # 전역 통계
        self.start_time = time.time()
        
        self.logger.info("CacheManager 초기화 완료")
    
    def cache_embedding(self, text_chunks: List[str], embeddings: List[List[float]]) -> str:
        """임베딩 결과 캐싱"""
        cache_key = self._generate_cache_key(text_chunks)
        success = self.embedding_cache.put(cache_key, embeddings)
        if success:
            self.logger.debug(f"임베딩 캐시 저장: {cache_key[:16]}...")
        return cache_key
    
    def get_cached_embedding(self, text_chunks: List[str]) -> Optional[List[List[float]]]:
        """캐시된 임베딩 조회"""
        cache_key = self._generate_cache_key(text_chunks)
        result = self.embedding_cache.get(cache_key)
        if result:
            self.logger.debug(f"임베딩 캐시 히트: {cache_key[:16]}...")
        return result
    
    def cache_chunks(self, file_path: str, chunks: List[str]) -> str:
        """청크 결과 캐싱"""
        cache_key = self._generate_file_cache_key(file_path)
        success = self.chunk_cache.put(cache_key, chunks)
        if success:
            self.logger.debug(f"청크 캐시 저장: {file_path}")
        return cache_key
    
    def get_cached_chunks(self, file_path: str) -> Optional[List[str]]:
        """캐시된 청크 조회"""
        cache_key = self._generate_file_cache_key(file_path)
        result = self.chunk_cache.get(cache_key)
        if result:
            self.logger.debug(f"청크 캐시 히트: {file_path}")
        return result
    
    def cache_metadata(self, file_id: str, metadata: Dict[str, Any]) -> str:
        """메타데이터 캐싱"""
        cache_key = f"metadata_{file_id}"
        success = self.metadata_cache.put(cache_key, metadata)
        if success:
            self.logger.debug(f"메타데이터 캐시 저장: {file_id}")
        return cache_key
    
    def get_cached_metadata(self, file_id: str) -> Optional[Dict[str, Any]]:
        """캐시된 메타데이터 조회"""
        cache_key = f"metadata_{file_id}"
        result = self.metadata_cache.get(cache_key)
        if result:
            self.logger.debug(f"메타데이터 캐시 히트: {file_id}")
        return result
    
    def _generate_cache_key(self, text_chunks: List[str]) -> str:
        """텍스트 청크들의 캐시 키 생성"""
        combined_text = "".join(text_chunks)
        return hashlib.md5(combined_text.encode('utf-8')).hexdigest()
    
    def _generate_file_cache_key(self, file_path: str) -> str:
        """파일 기반 캐시 키 생성 (파일 수정 시간 포함)"""
        try:
            import os
            stat = os.stat(file_path)
            key_data = f"{file_path}_{stat.st_size}_{stat.st_mtime}"
            return hashlib.md5(key_data.encode('utf-8')).hexdigest()
        except:
            return hashlib.md5(file_path.encode('utf-8')).hexdigest()
    
    async def get_connection(self):
        """연결 풀에서 연결 가져오기"""
        return await self.connection_pool.get_connection()
    
    async def return_connection(self, connection):
        """연결 풀로 연결 반환"""
        await self.connection_pool.return_connection(connection)
    
    def clear_all_caches(self):
        """모든 캐시 삭제"""
        self.embedding_cache.clear()
        self.chunk_cache.clear()
        self.metadata_cache.clear()
        self.logger.info("모든 캐시가 삭제되었습니다")
    
    def get_comprehensive_stats(self) -> Dict[str, Any]:
        """종합 캐시 통계"""
        return {
            "uptime_seconds": time.time() - self.start_time,
            "embedding_cache": self.embedding_cache.get_stats().__dict__,
            "chunk_cache": self.chunk_cache.get_stats().__dict__,
            "metadata_cache": self.metadata_cache.get_stats().__dict__,
            "connection_pool": self.connection_pool.get_pool_stats(),
            "system_memory_mb": psutil.virtual_memory().used / 1024 / 1024,
            "system_memory_percent": psutil.virtual_memory().percent
        }
    
    async def cleanup(self):
        """리소스 정리"""
        await self.connection_pool.close_all()
        self.clear_all_caches()
        self.logger.info("CacheManager 정리 완료")


# 싱글톤 인스턴스
_cache_manager = None
_cache_manager_lock = threading.Lock()


def get_cache_manager() -> CacheManager:
    """CacheManager 싱글톤 인스턴스 반환"""
    global _cache_manager
    
    if _cache_manager is None:
        with _cache_manager_lock:
            if _cache_manager is None:
                _cache_manager = CacheManager()
    
    return _cache_manager