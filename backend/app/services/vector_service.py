import os
import json
import asyncio
import time
import threading
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from ..core.config import settings
from .model_settings_service import get_current_model_config
from .docling_service import DoclingService
from ..models.schemas import DoclingOptions
from ..models.vector_models import VectorMetadata, VectorMetadataService

# ChromaDB 관련 패키지 임포트 시도 (필수: chromadb만 확인)
try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    print("ChromaDB 패키지가 설치되지 않았습니다. pip install chromadb 로 설치해주세요.")

from typing import List, Union, Callable, Any
import numpy as np

class EmbeddingFunction:
    """임베딩 함수의 일관된 인터페이스를 제공하는 래퍼 클래스"""
    
    def __init__(self, base_function: Any, expected_dimension: int):
        """
        Args:
            base_function: 실제 임베딩 함수 (OpenAI, Google 등)
            expected_dimension: 예상되는 임베딩 차원
        """
        self.base_function = base_function
        self.expected_dimension = expected_dimension
    
    def __call__(self, input: List[str]) -> List[List[float]]:
        """
        텍스트를 임베딩으로 변환하고 일관된 형식으로 반환 (ChromaDB 0.4.16+ 인터페이스)
        
        Args:
            input: 변환할 텍스트 리스트
            
        Returns:
            List[List[float]]: 정규화된 임베딩 벡터 리스트
            
        Raises:
            ValueError: 임베딩 차원이 예상과 다를 때
        """
        try:
            print(f"🔄 임베딩 함수 호출 - 입력 텍스트 수: {len(input)}")
            print(f"🔍 입력 데이터 타입: {type(input)}")
            
            # 입력 검증
            if not input or len(input) == 0:
                raise ValueError("입력 텍스트가 비어있습니다")
            
            # 토큰 수 체크 및 제한 (8,192 토큰 한계 고려)
            MAX_TOKENS = 6000  # 안전 마진 남기기
            filtered_input = []
            
            for i, text in enumerate(input):
                # 대략적인 토큰 수 계산 (영어 기준 1 토큰 = 4문자, 한글은 더 적음)
                estimated_tokens = len(text) // 3  # 한글 고려 보수적 계산
                
                if estimated_tokens > MAX_TOKENS:
                    print(f"⚠️ 텍스트 {i} 토큰 초과 감지: {estimated_tokens} > {MAX_TOKENS}")
                    # 토큰 한계에 맞게 텍스트 잘라내기
                    max_chars = MAX_TOKENS * 3  # 안전한 문자 수
                    truncated_text = text[:max_chars] + "... [토큰 제한으로 인한 자른 내용]"
                    filtered_input.append(truncated_text)
                    print(f"✂️ 텍스트 자른 내용: {len(text)} -> {len(truncated_text)} 문자")
                else:
                    filtered_input.append(text)
            
            print(f"✅ 토큰 체크 완료 - 원본: {len(input)}개, 필터링: {len(filtered_input)}개")
            input = filtered_input  # 필터링된 입력 사용
            
            # 배치로 임베딩 생성 (더 효율적)
            if len(input) > 1:
                print(f"📦 배치 임베딩 생성 중... ({len(input)}개)")
                result = self.base_function(input)
                print(f"✅ 배치 임베딩 생성 완료")
                print(f"🔍 API 응답 타입: {type(result)}")
            else:
                print(f"🔍 단일 임베딩 생성 중...")
                result = self.base_function(input)
                print(f"✅ 단일 임베딩 생성 완료")
                print(f"🔍 API 응답 타입: {type(result)}")
            
            # 타입별 정규화 (항상 List[List[float]] 반환)
            normalized_embeddings = self._normalize_embedding(result)
            
            # 차원 검증
            for i, embedding in enumerate(normalized_embeddings):
                if len(embedding) != self.expected_dimension:
                    raise ValueError(
                        f"임베딩 차원 불일치 (인덱스 {i}): 예상 {self.expected_dimension}, "
                        f"실제 {len(embedding)}"
                    )
            
            print(f"✅ 임베딩 정규화 및 검증 완료 - {len(normalized_embeddings)}개 벡터")
            return normalized_embeddings
            
        except Exception as e:
            print(f"❌ 임베딩 생성 실패: {e}")
            print(f"🔍 에러 타입: {type(e).__name__}")
            import traceback
            print(f"🔍 상세 에러: {traceback.format_exc()}")
            raise e  # 에러를 다시 throw하여 상위에서 처리
    
    def _normalize_embedding(self, embedding: Any) -> List[List[float]]:
        """다양한 타입의 임베딩을 List[List[float]]로 정규화"""
        print(f"🔍 임베딩 정규화 시작 - 타입: {type(embedding)}")
        print(f"🔍 임베딩 내용: {str(embedding)[:200]}...")  # 디버깅용
        
        # None 또는 빈 값 체크
        if embedding is None:
            print("❌ 임베딩이 None입니다")
            raise TypeError("임베딩이 None입니다")
        
        # numpy array 처리
        if hasattr(embedding, 'tolist'):
            result = embedding.tolist()
            # 2차원인지 확인
            if len(result) > 0 and isinstance(result[0], list):
                print(f"✅ numpy array 2차원 정규화 완료 - {len(result)}개 벡터")
                return [[float(x) for x in vec] for vec in result]
            else:
                print(f"✅ numpy array 1차원 정규화 완료 - 2차원으로 변환")
                return [[float(x) for x in result]]
        
        # 리스트 처리
        if isinstance(embedding, list):
            # 빈 리스트 체크
            if len(embedding) == 0:
                print("❌ 빈 임베딩 리스트")
                raise TypeError("빈 임베딩 리스트")
            
            # 첫 번째 요소가 리스트인지 확인 (2차원)
            if isinstance(embedding[0], list):
                print(f"✅ 2차원 리스트 정규화 완료 - {len(embedding)}개 벡터")
                return [[float(x) for x in vec] for vec in embedding]
            
            # 첫 번째 요소가 숫자인지 확인 (1차원)
            elif isinstance(embedding[0], (int, float)):
                print(f"✅ 1차원 리스트 정규화 완료 - 2차원으로 변환")
                return [[float(x) for x in embedding]]
            
            # 첫 번째 요소가 numpy array인 경우
            elif hasattr(embedding[0], 'tolist'):
                print(f"✅ 리스트 내 numpy array 정규화 중... - {len(embedding)}개 벡터")
                return [arr.tolist() for arr in embedding]
            
            # 첫 번째 요소가 다른 타입인 경우 (예: 문자열, 객체 등)
            else:
                print(f"❌ 리스트의 첫 번째 요소가 지원하지 않는 타입: {type(embedding[0])}")
                print(f"🔍 첫 번째 요소 내용: {embedding[0]}")
                # ChromaDB OpenAI 함수의 특별한 응답 형식 확인
                if hasattr(embedding[0], '__dict__'):
                    print(f"🔍 객체 속성: {vars(embedding[0])}")
                raise TypeError(f"리스트의 첫 번째 요소가 지원하지 않는 타입: {type(embedding[0])}")
        
        # 그 외의 경우 오류 발생
        print(f"❌ 지원하지 않는 임베딩 타입: {type(embedding)}")
        if hasattr(embedding, '__dict__'):
            print(f"🔍 객체 속성: {vars(embedding)}")
        raise TypeError(f"지원하지 않는 임베딩 타입: {type(embedding)}")

async def _create_embedding_function() -> Union[EmbeddingFunction, None]:
    """현재 모델 설정에 따라 표준화된 임베딩 함수를 생성합니다."""
    try:
        # 비동기적으로 모델 설정 로드
        model_config = await get_current_model_config()
        
        embedding_config = model_config.get("embedding", {})
        
        provider = embedding_config.get("provider", "openai")
        model = embedding_config.get("model", "text-embedding-3-small")
        api_key = embedding_config.get("api_key", "")
        dimension = embedding_config.get("dimension", 384)
        
        print(f"임베딩 함수 생성: {provider} - {model} ({dimension}차원)")
        
        if provider == "openai" and api_key:
            try:
                from chromadb.utils import embedding_functions
                print(f"🔑 OpenAI API 키 길이: {len(api_key)} 문자")
                print(f"🔑 API 키 시작: {api_key[:10]}...")
                
                base_function = embedding_functions.OpenAIEmbeddingFunction(
                    api_key=api_key,
                    model_name=model,
                    dimensions=dimension  # OpenAI 차원 설정
                )
                print(f"✅ OpenAI 임베딩 함수 생성 성공")
                return EmbeddingFunction(base_function, dimension)
            except Exception as openai_error:
                print(f"❌ OpenAI 임베딩 함수 생성 실패: {str(openai_error)}")
                print(f"🔍 에러 타입: {type(openai_error).__name__}")
                return None
            
        elif provider == "google" and api_key:
            # Google 임베딩 함수 (향후 확장)
            print("Google 임베딩은 아직 구현되지 않았습니다")
            return None
            
        elif provider == "ollama":
            # Ollama 임베딩 함수 (향후 확장)  
            print("Ollama 임베딩은 아직 구현되지 않았습니다")
            return None
            
        else:
            print(f"지원하지 않는 임베딩 제공업체이거나 API 키가 없음: {provider}")
            return None
            
    except Exception as e:
        print(f"임베딩 함수 생성 실패: {e}")
        return None

class VectorService:
    """ChromaDB 기반 벡터 데이터베이스 관리를 담당하는 서비스 (Thread-Safe 싱글톤)"""
    
    _instance = None
    _initialized = False
    _client = None
    _collection = None
    _lock = threading.Lock()  # Thread-safe 싱글톤을 위한 락
    
    def __new__(cls):
        # Double-checked locking pattern for thread-safety
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(VectorService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        # Thread-safe 초기화
        with VectorService._lock:
            if VectorService._initialized:
                return
                
            self.vector_dir = os.path.join(settings.DATA_DIR, 'vectors')
            self.metadata_dir = os.path.join(settings.DATA_DIR, 'vector_metadata')
            
            os.makedirs(self.vector_dir, exist_ok=True)
            os.makedirs(self.metadata_dir, exist_ok=True)
            
            # Docling 서비스 초기화
            self.docling_service = DoclingService()
            
            # SQLite 메타데이터 서비스 초기화 (지연 사용)
            self.metadata_service = VectorMetadataService()
            
            # 지연 초기화 - 실제 벡터화 작업에서만 ChromaDB 연결을 수행
            # 파일 업로드 등 일반적인 작업에서는 ChromaDB를 초기화하지 않음
            print("VectorService 초기화 완료 (ChromaDB는 실제 사용 시 지연 로딩)")
            VectorService._initialized = True
    
    async def _ensure_client(self):
        """ChromaDB 클라이언트가 초기화되었는지 확인하고, 필요시 자동 연결을 시도합니다."""
        try:
            # 클라이언트와 컬렉션이 모두 초기화되어 있는지 확인
            if VectorService._client is None or VectorService._collection is None:
                print("ChromaDB 클라이언트가 초기화되지 않음 - 자동 연결 시도")
                
                # 데이터베이스 파일이 있는지 확인
                chroma_db_path = os.path.join(self.vector_dir, "chroma.sqlite3")
                if not os.path.exists(chroma_db_path):
                    raise RuntimeError(
                        f"ChromaDB 데이터베이스 파일이 존재하지 않습니다: {chroma_db_path}\n"
                        f"설정에서 'ChromaDB 데이터베이스 생성'을 먼저 실행해주세요."
                    )
                
                # 기존 데이터베이스에 연결 시도
                await self._connect_to_chromadb()
            
            # 컬렉션이 사용 가능한지 테스트
            try:
                count = VectorService._collection.count()
                print(f"ChromaDB 컬렉션 연결 확인: 총 벡터 개수 {count}")
            except Exception as e:
                print(f"ChromaDB 컬렉션 상태 확인 실패: {str(e)}")
                raise RuntimeError(f"ChromaDB 컬렉션에 접근할 수 없습니다: {str(e)}")
            
            return VectorService._client
        
        except Exception as e:
            print(f"ChromaDB 클라이언트 확인 실패: {str(e)}")
            raise RuntimeError(f"ChromaDB 클라이언트를 사용할 수 없습니다: {str(e)}")
    
    async def create_chromadb_database(self) -> bool:
        """ChromaDB 데이터베이스 파일과 기본 구조만 생성합니다 (설정에서만 사용)."""
        if not CHROMADB_AVAILABLE:
            raise RuntimeError("ChromaDB를 사용할 수 없습니다. pip install chromadb langchain-chroma langchain-openai로 설치해주세요.")
        
        try:
            print("ChromaDB 데이터베이스 생성 시작...")
            
            import chromadb
            from chromadb.config import Settings
            
            # 임시 클라이언트로 데이터베이스 파일과 구조 생성
            temp_client = None
            temp_collection = None
            
            try:
                # 클라이언트 생성
                temp_client = chromadb.PersistentClient(
                    path=self.vector_dir,
                    settings=Settings(
                        anonymized_telemetry=False,
                        allow_reset=True
                    )
                )
                
                # 기본 컬렉션 생성
                self.collection_name = "langflow"
                
                # 기존 컬렉션이 있는지 확인
                try:
                    existing_collection = temp_client.get_collection(name=self.collection_name)
                    print(f"기존 ChromaDB 컬렉션 발견: {self.collection_name}")
                except Exception:
                    # 새 컬렉션 생성
                    from ..core.config import settings
                    
                    # 동적 임베딩 함수 설정
                    embedding_function = await _create_embedding_function()
                    if embedding_function:
                        print("동적 임베딩 함수 설정 완료")
                    else:
                        print("임베딩 함수를 사용할 수 없습니다 - 기본 설정으로 진행")
                    
                    temp_collection = temp_client.create_collection(
                        name=self.collection_name,
                        embedding_function=embedding_function,
                        metadata={"description": "LangFlow 문서 벡터 저장소 (OpenAI 임베딩 사용)"}
                    )
                    print(f"새 ChromaDB 컬렉션 생성 완료: {self.collection_name}")
                
                # 데이터베이스 파일 존재 확인
                chroma_db_path = os.path.join(self.vector_dir, "chroma.sqlite3")
                if os.path.exists(chroma_db_path):
                    print(f"ChromaDB 데이터베이스 파일 생성됨: {chroma_db_path}")
                    return True
                else:
                    print("ChromaDB 데이터베이스 파일이 생성되지 않았습니다.")
                    return False
                    
            finally:
                # 임시 연결 해제 - 메모리 절약을 위해 즉시 해제
                temp_client = None
                temp_collection = None
                print("ChromaDB 임시 연결 해제됨")
                
        except Exception as e:
            print(f"ChromaDB 데이터베이스 생성 실패: {str(e)}")
            return False
    
    async def _connect_to_chromadb(self):
        """기존 ChromaDB 데이터베이스 파일에 연결합니다 (파일이 없으면 오류)."""
        if not CHROMADB_AVAILABLE:
            raise RuntimeError("ChromaDB를 사용할 수 없습니다. pip install chromadb langchain-chroma langchain-openai로 설치해주세요.")
        
        # 데이터베이스 파일 존재 확인
        chroma_db_path = os.path.join(self.vector_dir, "chroma.sqlite3")
        if not os.path.exists(chroma_db_path):
            raise RuntimeError(f"ChromaDB 데이터베이스 파일이 존재하지 않습니다: {chroma_db_path}\n설정에서 먼저 'ChromaDB 데이터베이스 생성'을 실행해주세요.")
        
        try:
            import chromadb
            from chromadb.config import Settings
            
            # 기존 데이터베이스에 연결
            try:
                VectorService._client = chromadb.PersistentClient(
                    path=self.vector_dir,
                    settings=Settings(
                        anonymized_telemetry=False,
                        allow_reset=True
                    )
                )
            except Exception:
                # 기본 설정으로 재시도
                VectorService._client = chromadb.PersistentClient(path=self.vector_dir)
            
            # 기본 컬렉션 연결 또는 생성
            self.collection_name = "langflow"
            try:
                VectorService._collection = VectorService._client.get_collection(name=self.collection_name)
                print(f"기존 컬렉션 '{self.collection_name}' 연결 성공")
            except Exception:
                print(f"컬렉션 '{self.collection_name}'이 존재하지 않습니다. 새로 생성합니다.")
                # 동적 임베딩 함수 설정
                embedding_function = await _create_embedding_function()
                if not embedding_function:
                    print("임베딩 함수를 사용할 수 없습니다 - 기본 설정으로 진행")
                
                VectorService._collection = VectorService._client.create_collection(
                    name=self.collection_name,
                    embedding_function=embedding_function,
                    metadata={"description": "LangFlow 문서 벡터 저장소"}
                )
                print(f"새 컬렉션 '{self.collection_name}' 생성 완료")
            
            # 연결 테스트
            count = VectorService._collection.count()
            print(f"ChromaDB 연결 성공 - 벡터 개수: {count}")
            
        except Exception as e:
            VectorService._client = None
            VectorService._collection = None
            raise RuntimeError(f"ChromaDB 연결 실패: {str(e)}")
    
    async def add_document_chunks(self, file_id: str, chunks: List[str], metadata: Dict[str, Any]) -> bool:
        """문서 청크를 ChromaDB에 추가합니다."""
        try:
            # ChromaDB가 초기화되었는지 확인
            client = await self._ensure_client()
            if not CHROMADB_AVAILABLE or not VectorService._collection:
                print("❌ ChromaDB를 사용할 수 없습니다.")
                return False
        except RuntimeError as e:
            print(f"❌ ChromaDB 초기화 확인 실패: {str(e)}")
            return False
        
        try:
            # 모델 설정에서 배치 크기 가져오기
            model_config = await get_current_model_config()
            dynamic_batch_size = model_config.get("settings", {}).get("batch_size", settings.BATCH_SIZE)
            total_chunks = len(chunks)
            
            # 임베딩 생성 시에는 설정된 배치 크기 사용 (토큰 제한 고려)
            batch_size = dynamic_batch_size
            
            print(f"ChromaDB에 {total_chunks}개 청크를 {batch_size}개씩 배치 처리합니다. (임베딩 안정성을 위해 배치 크기 조정)")
            
            for batch_start in range(0, total_chunks, batch_size):
                batch_end = min(batch_start + batch_size, total_chunks)
                batch_chunks = chunks[batch_start:batch_end]
                
                print(f"배치 처리 중: {batch_start + 1}-{batch_end}/{total_chunks}")
                print(f"🔍 ChromaDB 클라이언트 상태 확인 중...")
                
                # ChromaDB 상태 확인
                await self._ensure_client()
                if not VectorService._collection:
                    raise RuntimeError("ChromaDB 컬렉션을 초기화할 수 없습니다.")
                print(f"✅ ChromaDB 클라이언트 준비 완료")
                
                # 배치의 각 청크에 고유 ID 생성
                print(f"📝 배치 데이터 준비 중... ({len(batch_chunks)}개 청크)")
                chunk_ids = []
                chunk_texts = []
                chunk_metadatas = []
                
                for i, chunk in enumerate(batch_chunks):
                    actual_index = batch_start + i
                    chunk_id = f"{file_id}_chunk_{actual_index}"
                    chunk_ids.append(chunk_id)
                    chunk_texts.append(chunk)
                    
                    # 메타데이터 준비
                    chunk_metadata = {
                        "file_id": file_id,
                        "chunk_index": actual_index,
                        "filename": metadata.get("filename", ""),
                        "category_id": metadata.get("category_id", ""),
                        "category_name": metadata.get("category_name", ""),
                        "flow_id": metadata.get("flow_id", ""),
                        "vectorization_method": "chromadb_batch",
                        "created_at": datetime.now().isoformat()
                    }
                    chunk_metadatas.append(chunk_metadata)
                
                try:
                    # 임베딩 생성
                    embedding_function = await _create_embedding_function()
                    if not embedding_function:
                        print("임베딩 함수를 사용할 수 없습니다 - 텍스트만 저장")
                        # 임베딩 없이 저장 (ChromaDB가 내부 함수 사용)
                        VectorService._collection.add(
                            ids=chunk_ids,
                            documents=chunk_texts,
                            metadatas=chunk_metadatas
                        )
                    else:
                        # 임베딩 생성하여 저장
                        print(f"배치 {batch_start + 1}-{batch_end} 임베딩 생성 중...")
                        
                        # 배치 단위로 임베딩 생성 (타임아웃과 재시도 포함)
                        batch_texts = [chunk_text.strip() for chunk_text in chunk_texts]
                        
                        try:
                            # 임베딩 생성 (60초 타임아웃)
                            print(f"📡 OpenAI API 호출 시작... (배치 크기: {len(batch_texts)}, 최대 60초 대기)")
                            print(f"🔍 API 키 확인: {'있음' if embedding_function.base_function.api_key else '없음'}")
                            print(f"🔍 모델: {embedding_function.base_function.model_name}")
                            print(f"🔍 차원: {embedding_function.expected_dimension}")
                            
                            # 임베딩 생성 전 추가 상태 체크
                            start_time = time.time()
                            print(f"⏱️ 임베딩 생성 시작: {start_time}")
                            
                            # 첫 번째 배치인 경우 연결 테스트
                            if batch_start == 0:
                                print("🧪 첫 번째 배치 - 연결 테스트 실행 중...")
                                try:
                                    test_embedding = await asyncio.wait_for(
                                        asyncio.to_thread(embedding_function, ["연결 테스트"]),
                                        timeout=30.0
                                    )
                                    print(f"✅ 연결 테스트 성공 (임베딩 차원: {len(test_embedding[0])})")
                                except Exception as test_error:
                                    print(f"❌ 연결 테스트 실패: {str(test_error)}")
                                    raise test_error
                            
                            chunk_embeddings = await asyncio.wait_for(
                                asyncio.to_thread(embedding_function, batch_texts),
                                timeout=60.0
                            )
                            
                            end_time = time.time()
                            elapsed = end_time - start_time
                            print(f"✅ 배치 {batch_start + 1}-{batch_end} 임베딩 생성 완료 (소요시간: {elapsed:.2f}초)")
                            
                        except asyncio.TimeoutError:
                            print(f"⏰ 배치 {batch_start + 1}-{batch_end} 임베딩 생성 타임아웃 (60초) - 점진적 재시도 중...")
                            
                            # 점진적 재시도: 배치 크기를 절반으로 줄여서 재시도
                            if len(batch_texts) > 1:
                                print(f"🔄 배치 크기 축소 재시도 (크기: {len(batch_texts)} -> {len(batch_texts)//2})")
                                mid_point = len(batch_texts) // 2
                                chunk_embeddings = []
                                
                                # 첫 번째 절반 처리
                                try:
                                    first_half = await asyncio.wait_for(
                                        asyncio.to_thread(embedding_function, batch_texts[:mid_point]),
                                        timeout=45.0
                                    )
                                    chunk_embeddings.extend(first_half)
                                    print(f"✅ 첫 번째 절반 완료 ({mid_point}개)")
                                except Exception as first_error:
                                    print(f"❌ 첫 번째 절반 실패: {str(first_error)}")
                                    raise first_error
                                
                                # 두 번째 절반 처리
                                try:
                                    second_half = await asyncio.wait_for(
                                        asyncio.to_thread(embedding_function, batch_texts[mid_point:]),
                                        timeout=45.0
                                    )
                                    chunk_embeddings.extend(second_half)
                                    print(f"✅ 두 번째 절반 완료 ({len(batch_texts) - mid_point}개)")
                                except Exception as second_error:
                                    print(f"❌ 두 번째 절반 실패: {str(second_error)}")
                                    raise second_error
                            else:
                                # 단일 청크인 경우 더 긴 타임아웃으로 재시도
                                print(f"🔄 단일 청크 재시도 (90초 타임아웃)")
                                chunk_embeddings = await asyncio.wait_for(
                                    asyncio.to_thread(embedding_function, batch_texts),
                                    timeout=90.0
                                )
                                    
                        except Exception as embed_error:
                            print(f"❌ 배치 {batch_start + 1}-{batch_end} 임베딩 생성 실패: {str(embed_error)}")
                            print(f"🔍 오류 상세: {type(embed_error).__name__}")
                            raise embed_error
                        
                        # ChromaDB에 배치 추가 (임베딩 포함)
                        VectorService._collection.add(
                            ids=chunk_ids,
                            embeddings=chunk_embeddings,
                            documents=chunk_texts,
                            metadatas=chunk_metadatas
                        )
                    print(f"배치 {batch_start + 1}-{batch_end} 저장 완료")
                    
                except Exception as batch_error:
                    print(f"배치 {batch_start + 1}-{batch_end} 저장 실패: {str(batch_error)}")
                    raise batch_error
            
            # SQLite에 메타데이터 저장
            await self._save_metadata_to_sqlite(file_id, metadata, len(chunks))
            
            print(f"✅ ChromaDB 벡터 데이터 저장 완료: {file_id}, 총 청크 수: {total_chunks}")
            return True
            
        except Exception as e:
            error_message = str(e)
            print(f"❌ ChromaDB 벡터 데이터 저장 중 오류: {error_message}")
            return False
    
    async def search_similar_chunks(self, query: str, top_k: int = 5, category_ids: List[str] = None) -> List[Dict[str, Any]]:
        """ChromaDB를 사용하여 유사한 청크를 검색합니다."""
        if not CHROMADB_AVAILABLE:
            raise RuntimeError("ChromaDB를 사용할 수 없습니다. pip install chromadb langchain-chroma langchain-openai로 설치해주세요.")
        
        # ChromaDB 클라이언트와 컬렉션 초기화 확인 및 재시도
        try:
            await self._ensure_client()
        except Exception as e:
            print(f"ChromaDB 클라이언트 초기화 실패: {str(e)}")
            raise RuntimeError(f"ChromaDB를 사용할 수 없습니다. ChromaDB가 올바르게 초기화되었는지 확인해주세요. 오류: {str(e)}")
        
        if not VectorService._collection:
            print("ChromaDB 컬렉션이 초기화되지 않았습니다.")
            raise RuntimeError("ChromaDB를 사용할 수 없습니다. ChromaDB가 올바르게 초기화되었는지 확인해주세요.")
        
        try:
            # 검색 필터 준비
            where_filter = None
            if category_ids:
                where_filter = {"category_id": {"$in": category_ids}}
            
            # ChromaDB 검색 실행 (성능 최적화)
            print(f"ChromaDB 검색 시작: '{query}', top_k={top_k}")
            start_time = time.time()
            
            results = VectorService._collection.query(
                query_texts=[query],
                n_results=top_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"]  # 필요한 데이터만 요청
            )
            
            search_time = time.time() - start_time
            print(f"ChromaDB 검색 완료: {search_time:.2f}초")
            
            # 결과 형식 변환
            search_results = []
            if results['documents'] and results['documents'][0]:
                for i, doc in enumerate(results['documents'][0]):
                    # ChromaDB distance를 유사도 점수로 변환 (낮을수록 유사함 -> 높을수록 유사함)
                    distance = results['distances'][0][i] if 'distances' in results else 0.5
                    # 거리를 유사도 점수로 변환: 1 - (distance / max_distance)
                    # 설정에서 정규화 팩터 가져오기 (OpenAI 임베딩은 일반적으로 0.0~2.0)
                    similarity_score = max(0.0, 1.0 - (distance / settings.DISTANCE_NORMALIZATION_FACTOR))
                    
                    search_results.append({
                        "chunk_id": results['ids'][0][i],
                        "text": doc,
                        "metadata": results['metadatas'][0][i],
                        "score": similarity_score,
                        "distance": distance  # 원본 거리도 보관
                    })
                    
                    print(f"검색 결과 {i+1}: 거리={distance:.3f}, 점수={similarity_score:.3f}, 파일={results['metadatas'][0][i].get('filename', 'unknown')}")
            
            print(f"✅ ChromaDB 검색 완료: {len(search_results)}개 결과")
            return search_results
            
        except Exception as e:
            print(f"❌ ChromaDB 검색 중 오류: {str(e)}")
            raise RuntimeError(f"ChromaDB 검색 중 오류가 발생했습니다: {str(e)}")
    
    async def get_document_chunks(self, file_id: str) -> List[Dict[str, Any]]:
        """특정 파일의 모든 청크를 ChromaDB에서 조회합니다."""
        if not CHROMADB_AVAILABLE:
            raise RuntimeError("ChromaDB를 사용할 수 없습니다. pip install chromadb langchain-chroma langchain-openai로 설치해주세요.")
        
        # ChromaDB 클라이언트와 컬렉션 초기화 확인 및 재시도
        try:
            await self._ensure_client()
        except Exception as e:
            print(f"ChromaDB 클라이언트 초기화 실패: {str(e)}")
            raise RuntimeError(f"ChromaDB를 사용할 수 없습니다. ChromaDB가 올바르게 초기화되었는지 확인해주세요. 오류: {str(e)}")
        
        if not VectorService._collection:
            print("ChromaDB 컬렉션이 초기화되지 않았습니다.")
            raise RuntimeError("ChromaDB를 사용할 수 없습니다. ChromaDB가 올바르게 초기화되었는지 확인해주세요.")
        
        try:
            # ChromaDB에서 파일 ID로 필터링하여 조회
            results = VectorService._collection.get(
                where={"file_id": file_id}
            )
            
            chunks = []
            if results['documents']:
                for i, doc in enumerate(results['documents']):
                    chunks.append({
                        "chunk_id": results['ids'][i],
                        "text": doc,
                        "metadata": results['metadatas'][i],
                        "file_id": file_id
                    })
            
            print(f"✅ ChromaDB에서 파일 벡터 조회 완료: {file_id}, {len(chunks)}개 벡터")
            return chunks
            
        except Exception as e:
            print(f"❌ ChromaDB 문서 청크 조회 중 오류: {str(e)}")
            raise RuntimeError(f"ChromaDB 문서 청크 조회 중 오류가 발생했습니다: {str(e)}")
    
    async def delete_document_vectors(self, file_id: str) -> bool:
        """특정 파일의 모든 벡터를 ChromaDB에서 삭제합니다."""
        if not CHROMADB_AVAILABLE:
            raise RuntimeError("ChromaDB를 사용할 수 없습니다. pip install chromadb langchain-chroma langchain-openai로 설치해주세요.")
        
        # ChromaDB 클라이언트와 컬렉션 초기화 확인 및 재시도
        try:
            await self._ensure_client()
        except Exception as e:
            print(f"ChromaDB 클라이언트 초기화 실패: {str(e)}")
            raise RuntimeError(f"ChromaDB를 사용할 수 없습니다. ChromaDB가 올바르게 초기화되었는지 확인해주세요. 오류: {str(e)}")
        
        if not VectorService._collection:
            print("ChromaDB 컬렉션이 초기화되지 않았습니다.")
            raise RuntimeError("ChromaDB를 사용할 수 없습니다. ChromaDB가 올바르게 초기화되었는지 확인해주세요.")
        
        try:
            # ChromaDB에서 파일 ID로 필터링하여 삭제
            VectorService._collection.delete(
                where={"file_id": file_id}
            )
            
            # SQLite에서 메타데이터 삭제
            self.metadata_service.delete_metadata(file_id)
            
            print(f"✅ ChromaDB에서 문서 벡터 삭제 완료: {file_id}")
            return True
            
        except Exception as e:
            print(f"❌ ChromaDB 문서 벡터 삭제 중 오류: {str(e)}")
            raise RuntimeError(f"ChromaDB 문서 벡터 삭제 중 오류가 발생했습니다: {str(e)}")
    
    async def _update_metadata_index(self, file_id: str, metadata: Dict[str, Any]):
        """메타데이터 인덱스를 업데이트합니다. (DEPRECATED: ChromaDB 메타데이터 사용)"""
        try:
            index_file_path = os.path.join(self.metadata_dir, 'index.json')
            
            # 기존 인덱스 읽기
            index_data = {}
            if os.path.exists(index_file_path):
                with open(index_file_path, 'r', encoding='utf-8') as f:
                    index_data = json.load(f)
            
            # 새 메타데이터 추가
            index_data[file_id] = {
                **metadata,
                "updated_at": datetime.now().isoformat()
            }
            
            # 인덱스 저장
            with open(index_file_path, 'w', encoding='utf-8') as f:
                json.dump(index_data, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            print(f"메타데이터 인덱스 업데이트 중 오류: {str(e)}")
    
    async def _remove_from_metadata_index(self, file_id: str):
        """메타데이터 인덱스에서 파일 정보를 제거합니다. (DEPRECATED: ChromaDB 메타데이터 사용)"""
        try:
            metadata_file_path = os.path.join(self.metadata_dir, "index.json")
            
            if os.path.exists(metadata_file_path):
                with open(metadata_file_path, 'r', encoding='utf-8') as f:
                    metadata_index = json.load(f)
                
                # 파일 ID로 제거
                if file_id in metadata_index:
                    del metadata_index[file_id]
                    
                    with open(metadata_file_path, 'w', encoding='utf-8') as f:
                        json.dump(metadata_index, f, ensure_ascii=False, indent=2)
                    
                    print(f"메타데이터 인덱스에서 제거: {file_id}")
            
        except Exception as e:
            print(f"메타데이터 인덱스 제거 중 오류: {str(e)}")
    
    async def _save_metadata_to_sqlite(self, file_id: str, metadata: Dict[str, Any], chunk_count: int):
        """SQLite에 메타데이터 저장"""
        try:
            vector_metadata = VectorMetadata(
                file_id=file_id,
                filename=metadata.get("filename", ""),
                category_id=metadata.get("category_id"),
                category_name=metadata.get("category_name"),
                flow_id=metadata.get("flow_id"),
                processing_method=metadata.get("processing_method", "basic_text"),
                processing_time=metadata.get("processing_time", 0.0),
                chunk_count=chunk_count,
                file_size=metadata.get("file_size", 0),
                page_count=metadata.get("page_count"),
                table_count=metadata.get("table_count"),
                image_count=metadata.get("image_count")
            )
            
            # Docling 옵션이 있으면 저장
            if metadata.get("docling_options"):
                vector_metadata.set_docling_options(metadata["docling_options"])
            
            # 기존 메타데이터가 있으면 업데이트, 없으면 생성
            existing = self.metadata_service.get_metadata(file_id)
            if existing:
                self.metadata_service.update_metadata(
                    file_id,
                    filename=vector_metadata.filename,
                    category_id=vector_metadata.category_id,
                    category_name=vector_metadata.category_name,
                    flow_id=vector_metadata.flow_id,
                    processing_method=vector_metadata.processing_method,
                    processing_time=vector_metadata.processing_time,
                    chunk_count=vector_metadata.chunk_count,
                    file_size=vector_metadata.file_size,
                    page_count=vector_metadata.page_count,
                    table_count=vector_metadata.table_count,
                    image_count=vector_metadata.image_count,
                    docling_options=vector_metadata.docling_options
                )
            else:
                self.metadata_service.create_metadata(vector_metadata)
                
        except Exception as e:
            print(f"SQLite 메타데이터 저장 중 오류: {str(e)}")

    async def _get_file_metadata(self, file_id: str) -> Optional[Dict[str, Any]]:
        """SQLite에서 파일의 메타데이터를 조회합니다."""
        try:
            metadata = self.metadata_service.get_metadata(file_id)
            if metadata:
                return {
                    "file_id": metadata.file_id,
                    "filename": metadata.filename,
                    "category_id": metadata.category_id,
                    "category_name": metadata.category_name,
                    "flow_id": metadata.flow_id,
                    "processing_method": metadata.processing_method,
                    "processing_time": metadata.processing_time,
                    "chunk_count": metadata.chunk_count,
                    "file_size": metadata.file_size,
                    "page_count": metadata.page_count,
                    "table_count": metadata.table_count,
                    "image_count": metadata.image_count,
                    "docling_options": metadata.get_docling_options(),
                    "created_at": metadata.created_at.isoformat(),
                    "updated_at": metadata.updated_at.isoformat()
                }
            return None
            
        except Exception as e:
            print(f"SQLite 메타데이터 조회 중 오류: {str(e)}")
            return None
    
    async def reset_chromadb(self):
        """ChromaDB 데이터베이스를 완전히 리셋합니다."""
        try:
            # 기존 연결 해제
            VectorService._client = None
            VectorService._collection = None
            
            # 데이터베이스 파일 백업 및 삭제
            import shutil
            if os.path.exists(self.vector_dir):
                backup_path = f"{self.vector_dir}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                shutil.move(self.vector_dir, backup_path)
                print(f"기존 데이터베이스를 {backup_path}로 백업했습니다.")
            
            # 새 디렉토리 생성
            os.makedirs(self.vector_dir, exist_ok=True)
            print("ChromaDB 데이터베이스 리셋 완료")
            
            # 새 데이터베이스 생성
            if await self.create_chromadb_database():
                print("새 ChromaDB 데이터베이스 생성 완료")
            else:
                print("ChromaDB 데이터베이스 생성 실패")
            
        except Exception as e:
            print(f"ChromaDB 리셋 실패: {str(e)}")
    
    def get_chromadb_status(self) -> Dict[str, Any]:
        """ChromaDB 상태를 반환합니다 (대시보드용 - 초기화 시도 없이 현재 상태만 조회)."""
        # 기본 상태
        status = {
            "chromadb_available": CHROMADB_AVAILABLE,
            "collection_name": "langflow",
            "collection_count": 0,
            "client_initialized": VectorService._client is not None,
            "collection_initialized": VectorService._collection is not None,
            "vector_dir": self.vector_dir,
            "metadata_dir": self.metadata_dir,
        }
        
        # ChromaDB가 사용 불가능한 경우
        if not CHROMADB_AVAILABLE:
            status["status"] = "unavailable"
            status["message"] = "ChromaDB 패키지가 설치되지 않았습니다."
            return status
        
        # 현재 초기화 상태만 확인 (초기화 시도하지 않음)
        if VectorService._client is None:
            status["status"] = "not_initialized"
            status["message"] = "ChromaDB 클라이언트가 초기화되지 않았습니다."
            
            # 기존 데이터베이스 파일이 있는지 확인
            chroma_db_path = os.path.join(self.vector_dir, "chroma.sqlite3")
            if os.path.exists(chroma_db_path):
                status["has_existing_data"] = True
                status["message"] = "ChromaDB 있음. 벡터화시 자동 로드."
            else:
                status["has_existing_data"] = False
            
            return status
        
        if VectorService._collection is None:
            status["status"] = "client_only"
            status["message"] = "ChromaDB 클라이언트는 있지만 컬렉션이 초기화되지 않았습니다."
            return status
        
        # 클라이언트와 컬렉션이 모두 있는 경우에만 컬렉션 카운트 조회
        try:
            count = VectorService._collection.count()
            status["collection_count"] = count
            status["status"] = "healthy"
            status["message"] = f"ChromaDB가 정상 작동 중입니다. 총 {count}개의 벡터가 저장되어 있습니다."
        except Exception as e:
            error_msg = str(e).lower()
            status["collection_count"] = 0
            status["collection_error"] = str(e)
            
            # 스키마 오류 감지
            if "no such column" in error_msg:
                status["status"] = "schema_error"
                status["requires_migration"] = True
                status["migration_reason"] = "schema_mismatch"
                status["error"] = "ChromaDB 스키마 불일치"
                status["message"] = "ChromaDB 스키마가 호환되지 않습니다. 리셋이 필요합니다."
                status["solution"] = "ChromaDB 리셋 버튼을 클릭하여 스키마를 업데이트하세요."
            else:
                status["status"] = "error"
                status["error"] = str(e)
                status["message"] = f"ChromaDB 오류: {str(e)}"
        
        # 디렉토리 상태 확인
        try:
            if os.path.exists(self.vector_dir):
                status["vector_dir_exists"] = True
                status["vector_dir_files"] = len(os.listdir(self.vector_dir))
            else:
                status["vector_dir_exists"] = False
                status["vector_dir_files"] = 0
        except Exception as e:
            status["directory_error"] = str(e)
            status["vector_dir_exists"] = False
            status["vector_dir_files"] = 0
        
        return status
    
    def get_metadata_stats(self) -> Dict[str, Any]:
        """SQLite 메타데이터 통계 정보를 반환합니다."""
        try:
            return self.metadata_service.get_stats()
        except Exception as e:
            print(f"메타데이터 통계 조회 중 오류: {str(e)}")
            return {
                "total_files": 0,
                "total_chunks": 0,
                "processing_methods": {},
                "database_path": "error"
            }
    
    def debug_chromadb_status(self):
        """ChromaDB 상태를 자세히 출력합니다."""
        print("\n=== ChromaDB 상세 상태 ===")
        
        # 기본 상태
        status = self.get_chromadb_status()
        for key, value in status.items():
            print(f"{key}: {value}")
        
        # 컬렉션 정보
        if VectorService._collection:
            try:
                count = VectorService._collection.count()
                print(f"\n📊 컬렉션 문서 수: {count}")
                
                # 샘플 데이터 조회
                if count > 0:
                    sample = VectorService._collection.peek(limit=1)
                    print(f"📄 샘플 문서:")
                    print(f"  - ID: {sample['ids'][0]}")
                    print(f"  - 메타데이터: {sample['metadatas'][0]}")
                    print(f"  - 텍스트 길이: {len(sample['documents'][0])} 문자")
                    
            except Exception as e:
                print(f"❌ 컬렉션 정보 조회 실패: {str(e)}")
        
        # 파일 시스템 정보
        print(f"\n📁 벡터 디렉토리: {self.vector_dir}")
        if os.path.exists(self.vector_dir):
            files = os.listdir(self.vector_dir)
            print(f"📂 파일/폴더 수: {len(files)}")
            for item in files:
                item_path = os.path.join(self.vector_dir, item)
                if os.path.isdir(item_path):
                    size = sum(os.path.getsize(os.path.join(item_path, f)) for f in os.listdir(item_path))
                    print(f"  📁 {item}/ (벡터 데이터: {size/1024/1024:.1f}MB)")
                else:
                    size = os.path.getsize(item_path)
                    print(f"  📄 {item} ({size/1024:.1f}KB)")
        
        print("=== ChromaDB 상태 확인 완료 ===\n")
    
    async def initialize_chromadb_manually(self) -> Dict[str, Any]:
        """ChromaDB를 수동으로 초기화합니다 (데이터베이스 생성 또는 연결)."""
        result = {
            "success": False,
            "message": "",
            "error": None
        }
        
        try:
            # 이미 초기화되어 있는지 확인
            if VectorService._client is not None and VectorService._collection is not None:
                result["success"] = True
                result["message"] = "ChromaDB가 이미 초기화되어 있습니다."
                return result
            
            print("ChromaDB 수동 초기화 시작...")
            
            # 데이터베이스 파일 존재 확인
            chroma_db_path = os.path.join(self.vector_dir, "chroma.sqlite3")
            
            if os.path.exists(chroma_db_path):
                # 기존 데이터베이스에 연결
                print("기존 ChromaDB 데이터베이스 발견 - 연결 시도")
                await self._connect_to_chromadb()
            else:
                # 새 데이터베이스 생성
                print("ChromaDB 데이터베이스 없음 - 새로 생성")
                if not await self.create_chromadb_database():
                    result["error"] = "ChromaDB 데이터베이스 생성에 실패했습니다."
                    return result
                
                # 생성된 데이터베이스에 연결
                await self._connect_to_chromadb()
            
            # 초기화 성공 확인
            if VectorService._client is not None and VectorService._collection is not None:
                result["success"] = True
                result["message"] = "ChromaDB 초기화가 성공적으로 완료되었습니다."
                print("✅ ChromaDB 초기화 완료")
            else:
                result["error"] = "ChromaDB 초기화에 실패했습니다."
                print("❌ ChromaDB 초기화 실패")
                
        except Exception as e:
            error_msg = str(e)
            result["error"] = error_msg
            result["message"] = f"초기화 중 오류가 발생했습니다: {error_msg}"
            print(f"❌ ChromaDB 초기화 오류: {error_msg}")
        
        return result
    
    async def migrate_from_deprecated_config(self) -> bool:
        """Deprecated 설정에서 새 설정으로 마이그레이션 (필요한 경우)."""
        try:
            # 이미 새 형식으로 초기화되어 있으면 마이그레이션 불필요
            if VectorService._client is not None:
                print("ChromaDB가 이미 새 형식으로 초기화되어 있습니다.")
                return True
            
            # ChromaDB 수동 초기화 시도
            print("ChromaDB 마이그레이션 시도 중...")
            result = self.initialize_chromadb_manually()
            
            if result["success"]:
                print("ChromaDB 마이그레이션 완료")
                return True
            else:
                print(f"ChromaDB 마이그레이션 실패: {result.get('error', 'Unknown error')}")
                return False
                
        except Exception as e:
            print(f"ChromaDB 마이그레이션 중 오류: {str(e)}")
            return False
    
    async def _safe_ensure_client(self):
        """안전한 ChromaDB 클라이언트 초기화 (로깅 최소화)"""
        try:
            if VectorService._client is None or VectorService._collection is None:
                await self._ensure_client()
            
            # 초기화 확인
            if VectorService._client is None or VectorService._collection is None:
                return False
            
            # 컬렉션이 사용 가능한지 테스트 (오류만 로그)
            try:
                count = VectorService._collection.count()
                return True
            except Exception as e:
                print(f"ChromaDB 컬렉션 상태 확인 실패: {str(e)}")
                return False
            
        except Exception as e:
            print(f"ChromaDB 클라이언트 초기화 실패: {str(e)}")
            return False
    
    async def process_document_with_docling(
        self, 
        file_path: str, 
        file_id: str, 
        metadata: Dict[str, Any],
        docling_options: Optional[DoclingOptions] = None,
        use_parallel: bool = False
    ) -> Dict[str, Any]:
        """
        Docling을 사용하여 문서를 고급 전처리하고 벡터화합니다.
        
        Args:
            file_path: 처리할 파일 경로
            file_id: 파일 고유 ID
            metadata: 파일 메타데이터
            docling_options: Docling 처리 옵션
            
        Returns:
            처리 결과 정보
        """
        try:
            file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            print(f"🔧 Docling 문서 처리 요청: {os.path.basename(file_path)} ({file_size / 1024 / 1024:.2f} MB)")
            
            # Docling이 사용 가능한지 확인
            print("🔍 Docling 서비스 가용성 확인 중...")
            if not self.docling_service.is_available:
                print("⚠️ Docling을 사용할 수 없어 기본 텍스트 처리로 진행합니다.")
                print("↪️ 폴백 처리로 전환합니다.")
                return await self._fallback_text_processing(file_path, file_id, metadata)
            else:
                print("✅ Docling 서비스 사용 가능")
            
            # 파일 형식 지원 여부 확인
            print("📋 파일 형식 지원 여부 확인 중...")
            is_supported = await self.docling_service.is_supported_format(file_path)
            if not is_supported:
                print(f"⚠️ Docling이 지원하지 않는 파일 형식: {file_path}")
                print("↪️ 폴백 처리로 전환합니다.")
                return await self._fallback_text_processing(file_path, file_id, metadata)
            else:
                print(f"✅ 지원되는 파일 형식: {os.path.splitext(file_path)[1]}")
            
            # Docling 옵션 설정
            print("⚙️ Docling 옵션 구성 중...")
            if docling_options is None:
                docling_options = DoclingOptions(
                    output_format="markdown",
                    extract_tables=True,
                    extract_images=True,
                    ocr_enabled=False
                )
                print("📋 기본 Docling 옵션 사용")
            else:
                print("📋 사용자 정의 Docling 옵션 적용")
            
            print(f"   - 출력 형식: {docling_options.output_format}")
            print(f"   - 테이블 추출: {docling_options.extract_tables}")
            print(f"   - 이미지 추출: {docling_options.extract_images}")
            print(f"   - OCR 활성화: {docling_options.ocr_enabled}")
            
            print(f"🔄 Docling으로 문서 전처리 시작: {file_path}")
            
            # Docling으로 문서 처리
            print("🚀 Docling 문서 처리 요청 시작...")
            docling_start_time = time.time()
            docling_result = await self.docling_service.process_document(file_path, docling_options)
            docling_elapsed = time.time() - docling_start_time
            
            if not docling_result.success:
                error_msg = docling_result.error
                is_timeout = docling_result.metadata.get("timeout", False)
                
                print(f"❌ Docling 처리 실패 ({docling_elapsed:.2f}초 소요): {error_msg}")
                
                if is_timeout:
                    print("⏰ 타임아웃으로 인한 실패 - 파일이 너무 크거나 복잡함")
                    print("💡 해결방법: 파일 크기 축소 또는 OCR 비활성화 시도")
                else:
                    print(f"🔍 실패 원인: {error_msg}")
                
                print("↪️ 기본 텍스트 처리로 폴백 시도 중...")
                return await self._fallback_text_processing(file_path, file_id, metadata)
            
            print(f"✅ Docling 처리 성공 ({docling_elapsed:.2f}초 소요)")
            print(f"📊 처리 결과: {len(docling_result.content.get('text', ''))} 글자 추출")
            
            # 처리된 콘텐츠를 청크로 분할
            print("✂️ 청크 생성 프로세스 시작...")
            chunk_start_time = time.time()
            chunks = await self._create_enhanced_chunks(docling_result, docling_options)
            chunk_elapsed = time.time() - chunk_start_time
            
            if not chunks:
                print(f"⚠️ 처리된 콘텐츠에서 유효한 청크를 생성할 수 없습니다. ({chunk_elapsed:.2f}초 소요)")
                return {
                    "success": False,
                    "error": "청크 생성 실패",
                    "chunks_count": 0
                }
            
            print(f"✅ 청크 생성 완료: {len(chunks)}개 청크 ({chunk_elapsed:.2f}초 소요)")
            if chunks:
                avg_chunk_size = sum(len(chunk) for chunk in chunks) / len(chunks)
                print(f"📊 청크 통계: 평균 길이 {avg_chunk_size:.0f} 글자")
            
            # 메타데이터에 Docling 정보 추가
            print("📋 메타데이터 구성 중...")
            enhanced_metadata = {
                **metadata,
                "processing_method": "docling",
                "docling_options": docling_options.dict(),
                "processing_time": docling_result.processing_time,
                "page_count": docling_result.metadata.get("page_count", 0),
                "table_count": docling_result.metadata.get("table_count", 0),
                "image_count": docling_result.metadata.get("image_count", 0)
            }
            print(f"✅ 메타데이터 구성 완료 (페이지: {enhanced_metadata['page_count']}, 테이블: {enhanced_metadata['table_count']}, 이미지: {enhanced_metadata['image_count']})")
            
            # ChromaDB에 벡터 저장 (병렬 처리 옵션)
            print(f"💾 ChromaDB에 벡터 저장 시작... ({len(chunks)}개 청크)")
            vector_start_time = time.time()
            
            # 시스템 설정에서 병렬 처리 활성화 여부 확인
            try:
                from ..api.settings import load_settings
                system_settings = load_settings()
                parallel_enabled = system_settings.get("enableParallelProcessing", True)
            except:
                parallel_enabled = True
                
            if use_parallel and parallel_enabled and len(chunks) > settings.BATCH_SIZE * 2:
                # 병렬 처리 적용 (큰 파일에만)
                print(f"🚀 병렬 벡터화 모드 적용 - {len(chunks)}개 청크 (설정에서 활성화됨)")
                try:
                    from .parallel_vector_service import get_parallel_vector_service
                    parallel_service = get_parallel_vector_service()
                    
                    result = await parallel_service.vectorize_document_parallel(
                        file_id=file_id,
                        chunks=chunks,
                        metadata=enhanced_metadata
                    )
                    
                    success = result.get("success", False)
                    if success:
                        vector_elapsed = result.get("processing_time", time.time() - vector_start_time)
                        print(f"✅ 병렬 벡터화 완료 - 캐시 히트율: {result.get('cache_hit_rate', 0):.1%}")
                        print(f"⚡ 성능 통계: {result.get('performance_stats', {})}")
                    else:
                        print(f"❌ 병렬 벡터화 실패, 기본 방식으로 fallback: {result.get('error', '')}")
                        success = await self.add_document_chunks(file_id, chunks, enhanced_metadata)
                        vector_elapsed = time.time() - vector_start_time
                        
                except Exception as parallel_error:
                    print(f"⚠️ 병렬 처리 오류, 기본 방식으로 fallback: {parallel_error}")
                    success = await self.add_document_chunks(file_id, chunks, enhanced_metadata)
                    vector_elapsed = time.time() - vector_start_time
            else:
                # 기본 순차 처리
                success = await self.add_document_chunks(file_id, chunks, enhanced_metadata)
                vector_elapsed = time.time() - vector_start_time
            
            if success:
                print(f"✅ 벡터 저장 완료 ({vector_elapsed:.2f}초 소요)")
                total_time = docling_elapsed + chunk_elapsed + vector_elapsed
                print(f"🎉 Docling 기반 벡터화 전체 완료: {len(chunks)}개 청크 (총 {total_time:.2f}초)")
                print(f"⏱️  시간 분석: Docling {docling_elapsed:.2f}초, 청킹 {chunk_elapsed:.2f}초, 벡터화 {vector_elapsed:.2f}초")
                return {
                    "success": True,
                    "chunks_count": len(chunks),
                    "processing_method": "docling",
                    "processing_time": docling_result.processing_time,
                    "docling_metadata": docling_result.metadata,
                    "total_pipeline_time": total_time
                }
            else:
                print(f"❌ 벡터 저장 실패 ({vector_elapsed:.2f}초 소요)")
                return {
                    "success": False,
                    "error": "벡터 저장 실패",
                    "chunks_count": len(chunks)
                }
                
        except Exception as e:
            print(f"❌ Docling 기반 벡터화 중 예상치 못한 오류: {str(e)}")
            import traceback
            print(f"🔍 오류 상세: {traceback.format_exc()}")
            return {
                "success": False,
                "error": str(e),
                "chunks_count": 0
            }
    
    async def _create_enhanced_chunks(
        self, 
        docling_result, 
        options: DoclingOptions
    ) -> List[str]:
        """
        Docling 결과를 기반으로 향상된 청킹을 수행합니다.
        """
        chunks = []
        
        try:
            content = docling_result.content
            
            # 주요 콘텐츠 선택 (우선순위: markdown > text)
            if options.output_format == "markdown" and content.get("markdown"):
                main_content = content["markdown"]
                content_type = "markdown"
            elif content.get("text"):
                main_content = content["text"]
                content_type = "text"
            else:
                print("⚠️ 유효한 콘텐츠를 찾을 수 없습니다.")
                return chunks
            
            print(f"📝 {content_type} 형식으로 청킹 시작 (길이: {len(main_content)}자)")
            
            # 모델 설정에서 청킹 설정 가져오기
            model_config = await get_current_model_config()
            chunk_size = model_config.get("settings", {}).get("chunk_size", settings.DEFAULT_CHUNK_SIZE)
            overlap_size = model_config.get("settings", {}).get("chunk_overlap", settings.DEFAULT_CHUNK_OVERLAP)
            
            # 문단 기반 스마트 청킹
            if content_type == "markdown":
                chunks.extend(await self._smart_markdown_chunking(main_content, chunk_size, overlap_size))
            else:
                chunks.extend(await self._smart_text_chunking(main_content, chunk_size, overlap_size))
            
            # 테이블 콘텐츠 추가
            if options.extract_tables and docling_result.tables:
                table_chunks = await self._create_table_chunks(docling_result.tables)
                chunks.extend(table_chunks)
                print(f"📊 테이블 청크 {len(table_chunks)}개 추가")
            
            # 이미지 캡션 추가 (Vision 모델 지원)
            if options.extract_images and docling_result.images:
                image_chunks = await self._create_image_caption_chunks(docling_result.images)
                chunks.extend(image_chunks)
                print(f"🖼️ 이미지 캡션 청크 {len(image_chunks)}개 추가")
            
            # 구조 정보 기반 청크 (제목, 섹션 등)
            if content.get("structure"):
                structure_chunks = await self._create_structure_chunks(content["structure"], main_content)
                chunks.extend(structure_chunks)
                print(f"🏗️ 구조 기반 청크 {len(structure_chunks)}개 추가")
            
            # 중복 제거 및 정리
            chunks = await self._deduplicate_chunks(chunks)
            
            print(f"✅ 청킹 완료: 총 {len(chunks)}개 청크")
            return chunks
            
        except Exception as e:
            print(f"❌ 청킹 중 오류: {str(e)}")
            return chunks
    
    async def _smart_markdown_chunking(self, content: str, chunk_size: int, overlap_size: int) -> List[str]:
        """Markdown 형식에 최적화된 스마트 청킹 (개선된 버전)"""
        chunks = []
        
        # Markdown 헤더(##, ###, #### 등)를 기준으로 섹션 분할
        # 헤더 자체를 유지하기 위해 정규식의 캡처 그룹 사용
        # 헤더가 없는 긴 텍스트도 처리하기 위해 문단 분할을 기본으로 사용
        
        all_paragraphs = content.split('\n\n')
        current_chunk = ""

        for paragraph in all_paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue

            # 현재 청크에 문단을 추가할 수 있는지 확인
            if len(current_chunk) + len(paragraph) + 2 <= chunk_size:
                if current_chunk:
                    current_chunk += "\n\n" + paragraph
                else:
                    current_chunk = paragraph
            else:
                # 현재 청크를 저장
                if current_chunk:
                    chunks.append(current_chunk)
                
                # 문단 자체가 청크 크기보다 큰 경우, 문장 단위로 재분할
                if len(paragraph) > chunk_size:
                    sentence_chunks = await self._split_long_paragraph(paragraph, chunk_size, overlap_size)
                    chunks.extend(sentence_chunks)
                    current_chunk = "" # 다음 문단을 새 청크에서 시작
                else:
                    current_chunk = paragraph

        # 마지막 남은 청크 저장
        if current_chunk:
            chunks.append(current_chunk)
        
        return [chunk for chunk in chunks if chunk.strip()]

    async def _split_long_paragraph(self, paragraph: str, chunk_size: int, overlap_size: int) -> List[str]:
        """긴 문단을 문장 단위로 분할하는 헬퍼 함수"""
        sentences = re.split(r'(?<=[.!?])\s+', paragraph)
        chunks = []
        current_chunk = ""

        for sentence in sentences:
            if len(current_chunk) + len(sentence) + 1 <= chunk_size:
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = sentence
        
        if current_chunk:
            chunks.append(current_chunk)

        return chunks
    
    async def _smart_text_chunking(self, content: str, chunk_size: int, overlap_size: int) -> List[str]:
        """텍스트에 대한 스마트 청킹 (문단 경계 고려)"""
        chunks = []
        
        # 문단별로 분할
        paragraphs = content.split('\n\n')
        current_chunk = ""
        
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            
            # 현재 청크에 문단을 추가할 수 있는지 확인
            if len(current_chunk + '\n\n' + paragraph) <= chunk_size:
                current_chunk += ('\n\n' if current_chunk else '') + paragraph
            else:
                # 현재 청크를 저장
                if current_chunk:
                    chunks.append(current_chunk)
                
                # 문단이 청크 크기보다 큰 경우 문장 단위로 분할
                if len(paragraph) > chunk_size:
                    sentences = paragraph.split('. ')
                    sentence_chunk = ""
                    
                    for sentence in sentences:
                        if not sentence.endswith('.'):
                            sentence += '.'
                        
                        if len(sentence_chunk + ' ' + sentence) <= chunk_size:
                            sentence_chunk += (' ' if sentence_chunk else '') + sentence
                        else:
                            if sentence_chunk:
                                chunks.append(sentence_chunk)
                            sentence_chunk = sentence
                    
                    if sentence_chunk:
                        current_chunk = sentence_chunk
                    else:
                        current_chunk = ""
                else:
                    current_chunk = paragraph
        
        # 마지막 청크 저장
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks
    
    async def _create_table_chunks(self, tables: List[Dict[str, Any]]) -> List[str]:
        """테이블 데이터를 청크로 변환"""
        chunks = []
        
        for table in tables:
            table_content = f"[테이블 {table.get('id', 'unknown')}]\n"
            table_content += f"페이지: {table.get('page', 'unknown')}\n"
            
            if table.get('html'):
                table_content += f"HTML: {table['html']}\n"
            
            if table.get('content'):
                table_content += f"내용: {table['content']}"
            
            chunks.append(table_content)
        
        return chunks
    
    async def _create_image_caption_chunks(self, images: List[Dict[str, Any]]) -> List[str]:
        """이미지 캡션을 청크로 변환 (Vision 모델 지원을 위한 메타데이터 포함)"""
        chunks = []
        
        for image in images:
            # 이미지 경로가 있는 경우만 처리
            image_path = image.get('image_path')
            if not image_path:
                continue
                
            # 이미지 캡션 청크 생성
            caption = image.get('caption', image.get('description', ''))
            page = image.get('page', 0)
            image_id = image.get('id', 'unknown')
            
            # 캡션 텍스트에 이미지 경로 포함 (Vision 모델이 참조할 수 있도록)
            caption_text = f"[이미지: {image_path}] {caption}"
            
            # 추가 컨텍스트 정보 포함
            if page > 0:
                caption_text += f" (페이지 {page})"
            
            chunks.append(caption_text)
            print(f"🖼️ 이미지 캡션 생성: {image_id} -> {len(caption_text)} 글자")
        
        return chunks
    
    async def _create_structure_chunks(self, structure: List[Dict[str, Any]], content: str) -> List[str]:
        """문서 구조 정보를 기반으로 청크 생성"""
        chunks = []
        
        # 제목/헤딩만 별도로 인덱싱
        headings = [item for item in structure if 'title' in item.get('type', '').lower() or 'heading' in item.get('type', '').lower()]
        
        for heading in headings[:10]:  # 최대 10개의 주요 헤딩만
            heading_text = f"[구조: {heading.get('type', 'unknown')}] {heading.get('text_preview', '')}"
            chunks.append(heading_text)
        
        return chunks
    
    async def _deduplicate_chunks(self, chunks: List[str]) -> List[str]:
        """중복 청크 제거"""
        seen = set()
        unique_chunks = []
        
        for chunk in chunks:
            # 공백 정규화 후 중복 확인
            normalized = ' '.join(chunk.split())
            chunk_hash = hash(normalized)
            
            if chunk_hash not in seen and len(normalized) > 50:  # 최소 50자 이상
                seen.add(chunk_hash)
                unique_chunks.append(chunk)
        
        return unique_chunks
    
    async def _fallback_text_processing(self, file_path: str, file_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Docling 비활성화 시 또는 사용할 수 없을 때의 기본 텍스트 처리"""
        try:
            import os
            file_extension = os.path.splitext(file_path)[1].lower()
            filename = os.path.basename(file_path)
            
            print(f"📄 기본 텍스트 처리 시작: {filename} ({file_extension})")
            start_time = time.time()
            
            # FileService 통합 텍스트 추출 사용 (한글 처리에 최적화된 방식)
            from .file_service import FileService
            file_service = FileService()
            
            # 모든 파일 형식을 FileService에서 처리
            print(f"📄 FileService 통합 텍스트 추출 사용: {file_extension}")
            content = await file_service.extract_text_from_file(file_path)
            
            processing_time = time.time() - start_time
            
            # 추출 결과 검증
            if not content or content.strip() == "":
                return {
                    "success": False,
                    "error": f"파일에서 텍스트를 추출할 수 없습니다. ({file_extension})",
                    "chunks_count": 0,
                    "processing_method": "basic_text",
                    "processing_time": processing_time
                }
            
            print(f"✅ 텍스트 추출 완료: {len(content):,}자 ({processing_time:.2f}초 소요)")
            
            # 모델 설정에서 청킹 설정 가져오기
            model_config = await get_current_model_config()
            chunk_size = model_config.get("settings", {}).get("chunk_size", settings.DEFAULT_CHUNK_SIZE)
            overlap_size = model_config.get("settings", {}).get("chunk_overlap", settings.DEFAULT_CHUNK_OVERLAP)
            
            # 스마트 청킹 (동적 설정값 사용)
            chunks = await self._smart_text_chunking(content, chunk_size, overlap_size)
            
            if not chunks:
                return {
                    "success": False,
                    "error": "유효한 청크를 생성할 수 없습니다.",
                    "chunks_count": 0,
                    "processing_method": "basic_text",
                    "processing_time": processing_time
                }
            
            print(f"📝 청킹 완료: {len(chunks)}개 청크 생성")
            
            # 메타데이터 업데이트
            fallback_metadata = {
                **metadata,
                "processing_method": "basic_text_optimized",
                "processing_time": processing_time,
                "file_type": file_extension,
                "text_extraction_method": self._get_extraction_method_name(file_extension)
            }
            
            # 벡터 저장
            print("💾 벡터 데이터베이스에 저장 중...")
            success = await self.add_document_chunks(file_id, chunks, fallback_metadata)
            
            if success:
                print(f"✅ 벡터화 완료: {len(chunks)}개 청크 저장됨")
            else:
                print("❌ 벡터 저장 실패")
            
            return {
                "success": success,
                "chunks_count": len(chunks),
                "processing_method": "basic_text_optimized",
                "processing_time": processing_time,
                "text_length": len(content),
                "extraction_method": self._get_extraction_method_name(file_extension)
            }
            
        except Exception as e:
            print(f"❌ 기본 텍스트 처리 실패: {str(e)}")
            import traceback
            print(f"🔍 오류 상세: {traceback.format_exc()}")
            return {
                "success": False,
                "error": str(e),
                "chunks_count": 0,
                "processing_method": "basic_text_failed"
            }
    
    def _get_extraction_method_name(self, file_extension: str) -> str:
        """파일 확장자에 따른 추출 방법 이름 반환"""
        method_map = {
            '.pdf': 'pdfminer.six + pypdf',
            '.docx': 'python-docx',
            '.pptx': 'python-pptx', 
            '.xlsx': 'openpyxl',
            '.doc': 'python-docx (legacy)',
            '.ppt': 'python-pptx (legacy)',
            '.xls': 'openpyxl (legacy)',
            '.txt': 'direct_read',
            '.md': 'direct_read',
            '.csv': 'direct_read',
            '.html': 'beautifulsoup4',
            '.htm': 'beautifulsoup4'
        }
        return method_map.get(file_extension, 'direct_read_fallback')
    
    async def vectorize_with_docling_pipeline(
        self, 
        file_path: str, 
        file_id: str, 
        metadata: Dict[str, Any],
        enable_docling: bool = True,
        docling_options: Optional[DoclingOptions] = None,
        use_parallel: bool = True
    ) -> Dict[str, Any]:
        """
        통합된 벡터화 파이프라인 (Docling 활용 가능)
        
        Args:
            file_path: 파일 경로
            file_id: 파일 ID
            metadata: 메타데이터
            enable_docling: Docling 사용 여부
            docling_options: Docling 옵션
            
        Returns:
            벡터화 결과
        """
        try:
            file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            filename = metadata.get("filename", os.path.basename(file_path))
            docling_status = "활성화" if enable_docling else "비활성화"
            print(f"🔧 벡터화 시점 Docling {docling_status} (설정 기반): {filename}")
            print(f"🚀 통합 벡터화 파이프라인 시작: {file_path}")
            print(f"📊 파일 정보: {file_size / 1024 / 1024:.2f} MB, Docling 활성화: {enable_docling}")
            
            # Docling 설정 상태를 명확하게 출력
            print(f"🔍 Docling 설정 상태:")
            print(f"   - enable_docling: {enable_docling}")
            print(f"   - docling_service.is_available: {self.docling_service.is_available}")
            print(f"   - docling_options: {docling_options.dict() if docling_options else 'None'}")
            
            if enable_docling and self.docling_service.is_available:
                print("🔧 Docling 통합 벡터화 파이프라인 실행 시작...")
                # Docling을 우선적으로 시도
                result = await self.process_document_with_docling(
                    file_path, file_id, metadata, docling_options, use_parallel
                )
                
                if result["success"]:
                    print("✅ Docling 기반 벡터화 성공")
                    return result
                else:
                    print(f"⚠️ Docling 처리 실패: {result.get('error', '알 수 없는 오류')}")
                    print("↪️ 기본 텍스트 처리로 전환 중...")
            elif not enable_docling:
                print("📝 Docling 비활성화됨 (사용자 설정)")
            else:
                print("📝 Docling 사용 불가 (라이브러리 미설치 또는 오류)")
            
            # 기본 텍스트 처리로 폴백
            print("📝 기본 텍스트 처리 시작...")
            fallback_start_time = time.time()
            result = await self._fallback_text_processing(file_path, file_id, metadata)
            fallback_elapsed = time.time() - fallback_start_time
            
            if result["success"]:
                print(f"✅ 기본 텍스트 처리 성공 ({fallback_elapsed:.2f}초 소요)")
                print(f"⚙️ 처리 방법: {result.get('processing_method', '기본')}")
            else:
                print(f"❌ 모든 처리 방법 실패 ({fallback_elapsed:.2f}초 소요): {result.get('error', '알 수 없는 오류')}")
            
            return result
            
        except Exception as e:
            print(f"❌ 벡터화 파이프라인 예상치 못한 오류: {str(e)}")
            import traceback
            print(f"🔍 오류 상세: {traceback.format_exc()}")
            return {
                "success": False,
                "error": str(e),
                "chunks_count": 0
            }
    

    
    def _backup_and_reset_database(self):
        """데이터베이스를 안전하게 백업하고 리셋합니다."""
        try:
            # 기존 클라이언트와 컬렉션 연결 해제
            VectorService._client = None
            VectorService._collection = None
            
            import shutil
            import time
            
            # 잠깐 대기하여 파일 잠금 해제
            time.sleep(0.5)
            
            if os.path.exists(self.vector_dir):
                try:
                    backup_path = f"{self.vector_dir}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                    shutil.move(self.vector_dir, backup_path)
                    print(f"기존 데이터베이스를 {backup_path}로 백업했습니다.")
                except Exception as backup_error:
                    print(f"데이터베이스 백업 실패: {str(backup_error)}")
                    print("백업 없이 기존 데이터베이스를 정리합니다...")
                    # 백업 실패 시 개별 파일 정리 시도
                    try:
                        for file in os.listdir(self.vector_dir):
                            file_path = os.path.join(self.vector_dir, file)
                            try:
                                if os.path.isfile(file_path):
                                    os.unlink(file_path)
                                    print(f"삭제됨: {file}")
                                elif os.path.isdir(file_path):
                                    shutil.rmtree(file_path)
                                    print(f"디렉토리 삭제됨: {file}")
                            except Exception as file_error:
                                print(f"삭제 실패: {file} - {str(file_error)} (계속 진행)")
                    except Exception as cleanup_error:
                        print(f"디렉토리 정리 실패: {str(cleanup_error)}")
            
            # 새 디렉토리 생성
            os.makedirs(self.vector_dir, exist_ok=True)
            print("새로운 ChromaDB 디렉토리를 생성했습니다.")
            
        except Exception as e:
            print(f"데이터베이스 리셋 과정에서 오류: {str(e)}")
            print("ChromaDB를 사용하지 않고 계속 진행합니다.")
    
    async def _create_fresh_chromadb(self):
        """새로운 ChromaDB 클라이언트와 컬렉션을 생성합니다."""
        try:
            import chromadb
            
            # 클라이언트 생성
            try:
                VectorService._client = chromadb.PersistentClient(
                    path=self.vector_dir,
                    settings=Settings(
                        anonymized_telemetry=False,
                        allow_reset=True
                    )
                )
            except Exception:
                try:
                    VectorService._client = chromadb.PersistentClient(path=self.vector_dir)
                except Exception as fallback_error:
                    print(f"ChromaDB 클라이언트 생성 실패: {str(fallback_error)}")
                    return False
            
            # 컬렉션 생성
            self.collection_name = "langflow"
            
            try:
                VectorService._collection = VectorService._client.get_collection(name=self.collection_name)
                print(f"기존 컬렉션 '{self.collection_name}' 사용")
            except Exception:
                # 새 컬렉션 생성
                # 동적 임베딩 함수 설정
                embedding_function = await _create_embedding_function()
                if not embedding_function:
                    print("임베딩 함수를 사용할 수 없습니다 - 기본 설정으로 진행")
                
                VectorService._collection = VectorService._client.create_collection(
                    name=self.collection_name,
                    embedding_function=embedding_function,
                    metadata={"description": "LangFlow 문서 벡터 저장소"}
                )
                print(f"새 컬렉션 '{self.collection_name}' 생성 완료")
            
            return True
            
        except Exception as e:
            print(f"새 ChromaDB 생성 실패: {str(e)}")
            VectorService._client = None
            VectorService._collection = None
            return False

    async def find_orphaned_vectors(self) -> Dict[str, Any]:
        """고아 벡터(파일이 삭제되었지만 벡터는 남아있는 경우)를 찾습니다."""
        try:
            await self._ensure_client()
            
            # ChromaDB에서 모든 벡터 조회
            all_results = VectorService._collection.get()
            
            # 파일 서비스에서 현재 파일 목록 가져오기
            from ..services.file_service import FileService
            file_service = FileService()
            current_files = await file_service.list_files()
            current_file_ids = {f.file_id for f in current_files}
            
            orphaned_vectors = []
            total_vectors = len(all_results['ids']) if all_results['ids'] else 0
            
            # 벡터 데이터가 없는 경우 정상적인 응답
            if total_vectors == 0:
                return {
                    'total_vectors': 0,
                    'orphaned_vectors': [],
                    'orphaned_count': 0,
                    'current_files_count': len(current_files),
                    'message': '벡터화된 데이터가 없습니다. 파일을 업로드하고 벡터화를 진행해주세요.'
                }
            
            if all_results['metadatas']:
                for i, metadata in enumerate(all_results['metadatas']):
                    if metadata and 'file_id' in metadata:
                        file_id = metadata['file_id']
                        if file_id not in current_file_ids:
                            orphaned_vectors.append({
                                'vector_id': all_results['ids'][i],
                                'file_id': file_id,
                                'text': all_results['documents'][i] if all_results['documents'] else '',
                                'metadata': metadata
                            })
            
            return {
                'total_vectors': total_vectors,
                'orphaned_vectors': orphaned_vectors,
                'orphaned_count': len(orphaned_vectors),
                'current_files_count': len(current_files),
                'message': f'총 {total_vectors}개의 벡터 중 {len(orphaned_vectors)}개의 고아 벡터를 발견했습니다.'
            }
            
        except Exception as e:
            print(f"고아 벡터 검색 중 오류: {str(e)}")
            return {
                'error': str(e),
                'total_vectors': 0,
                'orphaned_vectors': [],
                'orphaned_count': 0,
                'current_files_count': 0,
                'message': f'고아 벡터 검색 중 오류가 발생했습니다: {str(e)}'
            }
    
    async def cleanup_orphaned_vectors(self) -> Dict[str, Any]:
        """고아 벡터를 정리합니다."""
        try:
            orphaned_info = await self.find_orphaned_vectors()

            if 'error' in orphaned_info:
                return orphaned_info

            if orphaned_info['orphaned_count'] == 0:
                return {
                    'message': orphaned_info.get('message', '정리할 고아 벡터가 없습니다.'),
                    'cleaned_count': 0,
                    'total_vectors': orphaned_info.get('total_vectors', 0)
                }

            # 고아 벡터 삭제
            orphaned_ids = [v['vector_id'] for v in orphaned_info['orphaned_vectors']]
            VectorService._collection.delete(ids=orphaned_ids)

            print(f"✅ {orphaned_info['orphaned_count']}개의 고아 벡터를 정리했습니다.")

            return {
                'message': f"{orphaned_info['orphaned_count']}개의 고아 벡터를 정리했습니다.",
                'cleaned_count': orphaned_info['orphaned_count'],
                'remaining_vectors': orphaned_info['total_vectors'] - orphaned_info['orphaned_count'],
                'total_vectors': orphaned_info['total_vectors']
            }
        except Exception as e:
            print(f"고아 벡터 정리 중 오류: {str(e)}")
            return {
                'error': str(e),
                'cleaned_count': 0,
                'message': f'고아 벡터 정리 중 오류가 발생했습니다: {str(e)}'
            }

    async def clear_chromadb_documents_only(self) -> Dict[str, Any]:
        """ChromaDB 컬렉션 구조는 유지하고, 문서(벡터)만 모두 삭제합니다."""
        try:
            await self._ensure_client()
            if not VectorService._collection:
                return {"success": False, "error": "컬렉션이 초기화되지 않았습니다."}

            # 전체 삭제: where 조건 없이 ids=None으로 delete 호출 시 모든 항목 제거
            try:
                # 일부 버전은 ids 또는 where가 필요 → 모든 ids를 가져와 삭제
                all_ids = []
                data = VectorService._collection.get()
                if data and data.get('ids'):
                    all_ids = data['ids']
                if all_ids:
                    VectorService._collection.delete(ids=all_ids)
                return {"success": True, "deleted_count": len(all_ids)}
            except Exception as e:
                return {"success": False, "error": str(e)}
        except Exception as e:
            return {"success": False, "error": str(e)}