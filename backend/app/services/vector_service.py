import os
import json
import asyncio
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from ..core.config import settings

# ChromaDB 관련 패키지 임포트 시도 (필수: chromadb만 확인)
try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    print("ChromaDB 패키지가 설치되지 않았습니다. pip install chromadb 로 설치해주세요.")

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
        
        # 지연 초기화 - 실제 벡터화 작업에서만 ChromaDB 연결을 수행
        # 파일 업로드 등 일반적인 작업에서는 ChromaDB를 초기화하지 않음
        print("VectorService 초기화 완료 (ChromaDB는 실제 사용 시 지연 로딩)")
        VectorService._initialized = True
    
    def _ensure_client(self):
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
                self._connect_to_chromadb()
            
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
    
    def create_chromadb_database(self) -> bool:
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
                    
                    # OpenAI 임베딩 함수 설정
                    embedding_function = None
                    if hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY:
                        try:
                            from chromadb.utils import embedding_functions
                            embedding_function = embedding_functions.OpenAIEmbeddingFunction(
                                api_key=settings.OPENAI_API_KEY,
                                model_name="text-embedding-ada-002"
                            )
                            print("OpenAI 임베딩 함수 설정 완료")
                        except Exception as e:
                            print(f"OpenAI 임베딩 함수 설정 실패: {str(e)}")
                            embedding_function = None
                    
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
    
    def _connect_to_chromadb(self):
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
                # OpenAI 임베딩 함수 설정 시도
                embedding_function = None
                if settings.OPENAI_API_KEY:
                    try:
                        import chromadb.utils.embedding_functions as embedding_functions
                        embedding_function = embedding_functions.OpenAIEmbeddingFunction(
                            api_key=settings.OPENAI_API_KEY,
                            model_name="text-embedding-ada-002"
                        )
                    except Exception:
                        embedding_function = None
                
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
            client = self._ensure_client()
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
            self._ensure_client()
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
                    search_results.append({
                        "chunk_id": results['ids'][0][i],
                        "text": doc,
                        "metadata": results['metadatas'][0][i],
                        "score": results['distances'][0][i] if 'distances' in results else 1.0
                    })
            
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
            self._ensure_client()
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
            self._ensure_client()
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
    
    def reset_chromadb(self):
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
            if self.create_chromadb_database():
                print("새 ChromaDB 데이터베이스 생성 완룼")
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
    
    def initialize_chromadb_manually(self) -> Dict[str, Any]:
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
                self._connect_to_chromadb()
            else:
                # 새 데이터베이스 생성
                print("ChromaDB 데이터베이스 없음 - 새로 생성")
                if not self.create_chromadb_database():
                    result["error"] = "ChromaDB 데이터베이스 생성에 실패했습니다."
                    return result
                
                # 생성된 데이터베이스에 연결
                self._connect_to_chromadb()
            
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
    
    def _safe_ensure_client(self):
        """안전한 ChromaDB 클라이언트 초기화 (로깅 최소화)"""
        try:
            if VectorService._client is None or VectorService._collection is None:
                self._ensure_client()
            
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
                embedding_function = None
                if hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY:
                    try:
                        from chromadb.utils import embedding_functions
                        embedding_function = embedding_functions.OpenAIEmbeddingFunction(
                            api_key=settings.OPENAI_API_KEY,
                            model_name="text-embedding-ada-002"
                        )
                    except Exception:
                        embedding_function = None
                
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
            self._ensure_client()
            
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