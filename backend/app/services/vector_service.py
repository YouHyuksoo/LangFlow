import os
import json
import asyncio
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from ..core.config import settings
from .model_settings_service import get_current_model_config
from .docling_service import DoclingService
from ..models.schemas import DoclingOptions

# ChromaDB 관련 패키지 임포트 시도 (필수: chromadb만 확인)
try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    print("ChromaDB 패키지가 설치되지 않았습니다. pip install chromadb 로 설치해주세요.")

def _create_embedding_function():
    """현재 모델 설정에 따라 임베딩 함수를 생성합니다."""
    try:
        # 동기적으로 모델 설정 로드
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            model_config = loop.run_until_complete(get_current_model_config())
        except RuntimeError:
            # 이벤트 루프가 없는 경우 새로 생성
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            model_config = loop.run_until_complete(get_current_model_config())
        
        embedding_config = model_config.get("embedding", {})
        
        provider = embedding_config.get("provider", "openai")
        model = embedding_config.get("model", "text-embedding-3-small")
        api_key = embedding_config.get("api_key", "")
        
        print(f"임베딩 함수 생성: {provider} - {model}")
        
        if provider == "openai" and api_key:
            from chromadb.utils import embedding_functions
            return embedding_functions.OpenAIEmbeddingFunction(
                api_key=api_key,
                model_name=model
            )
        elif provider == "google" and api_key:
            # Google 임베딩 함수 (향후 확장)
            from chromadb.utils import embedding_functions
            # Google용 임베딩 함수가 있다면 여기에 추가
            return None
        elif provider == "ollama":
            # Ollama 임베딩 함수 (향후 확장)
            return None
        else:
            print(f"지원하지 않는 임베딩 제공업체이거나 API 키가 없음: {provider}")
            return None
            
    except Exception as e:
        print(f"임베딩 함수 생성 실패: {e}")
        return None

class VectorService:
    """ChromaDB 기반 벡터 데이터베이스 관리를 담당하는 서비스 (개선된 싱글톤)"""
    
    _instance = None
    _initialized = False
    _client = None
    _collection = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(VectorService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if VectorService._initialized:
            return
            
        self.vector_dir = os.path.join(settings.DATA_DIR, 'vectors')
        self.metadata_dir = os.path.join(settings.DATA_DIR, 'vector_metadata')
        
        os.makedirs(self.vector_dir, exist_ok=True)
        os.makedirs(self.metadata_dir, exist_ok=True)
        
        # Docling 서비스 초기화
        self.docling_service = DoclingService()
        
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
            # 메모리 부족을 방지하기 위해 청크를 배치로 처리
            batch_size = 10  # 한 번에 10개씩 처리
            total_chunks = len(chunks)
            
            print(f"ChromaDB에 {total_chunks}개 청크를 {batch_size}개씩 배치 처리합니다.")
            
            for batch_start in range(0, total_chunks, batch_size):
                batch_end = min(batch_start + batch_size, total_chunks)
                batch_chunks = chunks[batch_start:batch_end]
                
                print(f"배치 처리 중: {batch_start + 1}-{batch_end}/{total_chunks}")
                
                # 배치의 각 청크에 고유 ID 생성
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
                    # ChromaDB에 배치 추가
                    VectorService._collection.add(
                        ids=chunk_ids,
                        documents=chunk_texts,
                        metadatas=chunk_metadatas
                    )
                    print(f"배치 {batch_start + 1}-{batch_end} 저장 완료")
                    
                except Exception as batch_error:
                    print(f"배치 {batch_start + 1}-{batch_end} 저장 실패: {str(batch_error)}")
                    raise batch_error
            
            # 메타데이터 인덱스 업데이트
            await self._update_metadata_index(file_id, metadata)
            
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
                    # 일반적으로 0.0~2.0 사이 값이므로 2.0으로 정규화
                    similarity_score = max(0.0, 1.0 - (distance / 2.0))
                    
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
            
            # 메타데이터 인덱스에서도 제거
            await self._remove_from_metadata_index(file_id)
            
            print(f"✅ ChromaDB에서 문서 벡터 삭제 완료: {file_id}")
            return True
            
        except Exception as e:
            print(f"❌ ChromaDB 문서 벡터 삭제 중 오류: {str(e)}")
            raise RuntimeError(f"ChromaDB 문서 벡터 삭제 중 오류가 발생했습니다: {str(e)}")
    
    async def _update_metadata_index(self, file_id: str, metadata: Dict[str, Any]):
        """메타데이터 인덱스를 업데이트합니다."""
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
        """메타데이터 인덱스에서 파일 정보를 제거합니다."""
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
    
    async def _get_file_metadata(self, file_id: str) -> Optional[Dict[str, Any]]:
        """파일의 메타데이터를 조회합니다."""
        try:
            metadata_file_path = os.path.join(self.metadata_dir, "index.json")
            
            if os.path.exists(metadata_file_path):
                with open(metadata_file_path, 'r', encoding='utf-8') as f:
                    metadata_index = json.load(f)
                
                return metadata_index.get(file_id)
            
            return None
            
        except Exception as e:
            print(f"파일 메타데이터 조회 중 오류: {str(e)}")
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
        docling_options: Optional[DoclingOptions] = None
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
            
            # ChromaDB에 벡터 저장
            print(f"💾 ChromaDB에 벡터 저장 시작... ({len(chunks)}개 청크)")
            vector_start_time = time.time()
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
            
            # 기본 청킹 (1500자 단위, 200자 오버랩)
            chunk_size = 1500
            overlap_size = 200
            
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
        """Markdown 형식에 최적화된 스마트 청킹"""
        chunks = []
        
        # Markdown 섹션별로 분할
        sections = content.split('\n## ')
        
        for i, section in enumerate(sections):
            if i > 0:  # 첫 번째 섹션이 아니면 헤더 복원
                section = '## ' + section
            
            if len(section) <= chunk_size:
                # 섹션이 청크 크기보다 작으면 그대로 사용
                chunks.append(section.strip())
            else:
                # 섹션이 큰 경우 하위 분할
                subsections = section.split('\n### ')
                current_chunk = ""
                
                for j, subsection in enumerate(subsections):
                    if j > 0:
                        subsection = '### ' + subsection
                    
                    if len(current_chunk + subsection) <= chunk_size:
                        current_chunk += ('\n' if current_chunk else '') + subsection
                    else:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                        
                        # 서브섹션도 큰 경우 텍스트 청킹
                        if len(subsection) > chunk_size:
                            text_chunks = await self._smart_text_chunking(subsection, chunk_size, overlap_size)
                            chunks.extend(text_chunks)
                            current_chunk = ""
                        else:
                            current_chunk = subsection
                
                if current_chunk:
                    chunks.append(current_chunk.strip())
        
        return [chunk for chunk in chunks if chunk.strip()]
    
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
        """Docling을 사용할 수 없을 때의 폴백 처리"""
        try:
            print(f"📄 기본 텍스트 처리로 진행: {file_path}")
            
            # 파일 확장자에 따른 텍스트 추출
            import os
            file_extension = os.path.splitext(file_path)[1].lower()
            
            if file_extension == '.pdf':
                # PDF 파일 처리 - FileService의 extract_text_from_pdf 사용
                from .file_service import FileService
                file_service = FileService()
                content = await file_service.extract_text_from_pdf(file_path)
            elif file_extension in ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx']:
                # Office 파일 처리
                from .file_service import FileService
                file_service = FileService()
                content = await file_service.extract_text_from_office(file_path)
            else:
                # 텍스트 파일 처리 (txt, md 등)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                except UnicodeDecodeError:
                    # UTF-8로 읽을 수 없으면 다른 인코딩 시도
                    try:
                        with open(file_path, 'r', encoding='cp949') as f:
                            content = f.read()
                    except:
                        with open(file_path, 'r', encoding='latin-1') as f:
                            content = f.read()
            
            if not content or content.strip() == "":
                return {
                    "success": False,
                    "error": "파일에서 텍스트를 추출할 수 없습니다.",
                    "chunks_count": 0
                }
            
            # 기본 청킹
            chunks = await self._smart_text_chunking(content, 1500, 200)
            
            if not chunks:
                return {
                    "success": False,
                    "error": "유효한 청크를 생성할 수 없습니다.",
                    "chunks_count": 0
                }
            
            # 메타데이터 업데이트
            fallback_metadata = {
                **metadata,
                "processing_method": "basic_text",
                "processing_time": 0.1,
                "file_type": file_extension
            }
            
            # 벡터 저장
            success = await self.add_document_chunks(file_id, chunks, fallback_metadata)
            
            return {
                "success": success,
                "chunks_count": len(chunks),
                "processing_method": "basic_text",
                "processing_time": 0.1
            }
            
        except Exception as e:
            print(f"❌ 폴백 텍스트 처리 실패: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "chunks_count": 0
            }
    
    async def vectorize_with_docling_pipeline(
        self, 
        file_path: str, 
        file_id: str, 
        metadata: Dict[str, Any],
        enable_docling: bool = True,
        docling_options: Optional[DoclingOptions] = None
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
            print(f"🚀 통합 벡터화 파이프라인 시작: {file_path}")
            print(f"📊 파일 정보: {file_size / 1024 / 1024:.2f} MB, Docling 활성화: {enable_docling}")
            
            if enable_docling:
                print("🔧 Docling 기반 처리 시작...")
                # Docling을 우선적으로 시도
                result = await self.process_document_with_docling(
                    file_path, file_id, metadata, docling_options
                )
                
                if result["success"]:
                    print("✅ Docling 기반 벡터화 성공")
                    return result
                else:
                    print(f"⚠️ Docling 처리 실패: {result.get('error', '알 수 없는 오류')}")
                    print("↪️ 기본 텍스트 처리로 전환 중...")
            else:
                print("📝 Docling 비활성화 - 기본 처리 사용")
            
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
    
    def _create_fresh_chromadb(self):
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
                embedding_function = _create_embedding_function()
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