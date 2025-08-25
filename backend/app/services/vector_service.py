
import os
import json
import asyncio
import time
import threading
import re
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional, Union

# 윈도우 환경에서 유니코드 출력 지원
if sys.platform == "win32":
    import codecs
    try:
        if hasattr(sys.stdout, 'detach'):
            sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
        if hasattr(sys.stderr, 'detach'):
            sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())
    except (AttributeError, OSError):
        # detach가 실패하거나 지원되지 않는 경우 건너뛰기
        pass

import numpy as np
from ..core.config import settings
from .settings_service import settings_service
from ..models.schemas import DoclingOptions
from ..models.vector_models import VectorMetadata, VectorMetadataService

# PRD2 개선: 스마트 청킹 서비스 임포트 (헤딩 헤더 임베딩용)
try:
    from .chunking_service import ChunkProposal
except ImportError:
    ChunkProposal = None

# ChromaDB 관련 패키지 임포트 시도
try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    print("ChromaDB 패키지가 설치되지 않았습니다. pip install chromadb 로 설치해주세요.")

# --- Embedding Function Wrapper ---
class EmbeddingFunction:
    """ChromaDB와 호환되는 임베딩 함수 래퍼 (OpenAI + HuggingFace 지원)"""
    
    def __init__(self, embedding_model: str = None):
        # 설정에서 실제 사용 중인 임베딩 모델 가져오기
        model_settings = settings_service.get_section_settings("models")
        self.embedding_model = embedding_model or model_settings.get("embedding_model", "text-embedding-ada-002")
        self.embedding_provider = model_settings.get("embedding_provider", "openai")
        
        self._openai_client = None
        self._hf_model = None
        self._hf_tokenizer = None
        
        print(f"🔧 임베딩 설정 로드: {self.embedding_provider} - {self.embedding_model}")
        
        # 설정에 따른 모델 타입 결정
        if self.embedding_provider == "openai":
            self.model_type = "openai"
            print(f"✅ OpenAI 임베딩 사용: {self.embedding_model}")
        elif self.embedding_provider == "huggingface":
            self.model_type = "huggingface"
            print(f"✅ HuggingFace 임베딩 사용: {self.embedding_model}")
        else:
            # 모델 이름으로 자동 감지
            self.model_type = self._detect_model_type(self.embedding_model)
            print(f"✅ 자동 감지된 임베딩 타입: {self.model_type} - {self.embedding_model}")
    
    def _detect_model_type(self, model_name: str) -> str:
        """모델 이름을 기반으로 모델 타입 감지 (OpenAI 우선 적용)"""
        # OpenAI 모델 강제 적용 - 명시적으로 설정된 경우 우선권을 가짐
        openai_models = ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"]
        
        if model_name in openai_models or model_name.startswith("text-embedding-") or "openai" in model_name.lower():
            print(f"🔹 OpenAI 임베딩 모델 감지: {model_name}")
            return "openai"
        elif "/" in model_name or model_name.startswith("huggingface"):
            print(f"🔹 HuggingFace 임베딩 모델 감지: {model_name}")
            return "huggingface"
        else:
            # 기본값은 OpenAI (1536차원으로 통일)
            print(f"🔹 알 수 없는 모델, OpenAI로 처리: {model_name}")
            return "openai"
    
    def get_embedding_dimension(self) -> int:
        """현재 임베딩 모델의 차원 수를 반환"""
        if self.model_type == "openai":
            # OpenAI 모델별 차원 설정
            if "text-embedding-3-small" in self.embedding_model:
                return 1536
            elif "text-embedding-3-large" in self.embedding_model:
                return 3072
            elif "text-embedding-ada-002" in self.embedding_model:
                return 1536
            else:
                return 1536  # 기본값
        elif self.model_type == "huggingface":
            # HuggingFace 모델의 경우 동적으로 감지하거나 일반적인 값 사용
            if "bge" in self.embedding_model.lower():
                return 768  # BGE 모델들의 일반적인 차원
            else:
                # 1536차원으로 통일 (차원 불일치 방지)
                return 1536
        else:
            return 1536  # 기본값
    
    def _get_openai_client(self):
        """OpenAI 클라이언트 초기화"""
        if self._openai_client is None:
            try:
                import openai
                # 설정에서 API 키 가져오기
                model_settings = settings_service.get_section_settings("models")
                api_key = model_settings.get("embedding_api_key", "")
                
                if not api_key:
                    print("OpenAI API 키가 설정되지 않았습니다.")
                    return None
                
                self._openai_client = openai.OpenAI(api_key=api_key)
            except ImportError:
                print("OpenAI 패키지가 설치되지 않았습니다.")
                return None
        
        return self._openai_client
    
    def _get_huggingface_model(self):
        """HuggingFace 모델 초기화"""
        if self._hf_model is None or self._hf_tokenizer is None:
            try:
                from sentence_transformers import SentenceTransformer
                import torch
                import traceback
                import os
                
                # GPU 사용 비활성화 - CPU만 사용
                os.environ["CUDA_VISIBLE_DEVICES"] = ""
                torch.cuda.is_available = lambda: False
                
                print(f"허깅페이스 모델 로딩 중: {self.embedding_model}")
                print(f"PyTorch 버전: {torch.__version__}")
                print(f"CPU 전용 모드로 실행")
                
                # CPU만 사용하도록 명시적 설정
                self._hf_model = SentenceTransformer(
                    self.embedding_model, 
                    device='cpu',
                    cache_folder='./model_cache'  # 로컬 캐시 폴더 지정
                )
                
                # 모델을 명시적으로 CPU로 이동
                self._hf_model = self._hf_model.to('cpu')
                    
                print(f"✅ 허깅페이스 모델 로딩 완료 (CPU 모드): {self.embedding_model}")
                
            except ImportError as ie:
                print("sentence-transformers 패키지가 설치되지 않았습니다.")
                print("pip install sentence-transformers 로 설치해주세요.")
                print(f"상세 오류: {ie}")
                return None
            except Exception as e:
                print(f"허깅페이스 모델 로딩 실패: {e}")
                print(f"오류 타입: {type(e).__name__}")
                print("전체 스택 트레이스:")
                traceback.print_exc()
                return None
        
        return self._hf_model
    
    def __call__(self, input):
        """ChromaDB에서 호출되는 임베딩 함수 (ChromaDB v0.4.16+ 호환)"""
        # ChromaDB 0.4.16+ 버전은 정확히 (self, input) 시그니처만 허용
        if not input:
            return []
        
        if self.model_type == "huggingface":
            return self._create_huggingface_embeddings(input)
        else:
            return self._create_openai_embeddings(input)
    
    def _create_openai_embeddings(self, input_texts):
        """OpenAI 임베딩 생성"""
        client = self._get_openai_client()
        if not client:
            print("OpenAI 클라이언트를 사용할 수 없어 더미 임베딩을 반환합니다.")
            dim = self.get_embedding_dimension()
            return [[0.0] * dim for _ in input_texts]
        
        try:
            # OpenAI 임베딩 API 호출
            response = client.embeddings.create(
                model=self.embedding_model,
                input=input_texts
            )
            
            # 임베딩 벡터 추출
            embeddings = []
            for item in response.data:
                embeddings.append(item.embedding)
            
            return embeddings
            
        except Exception as e:
            print(f"OpenAI 임베딩 생성 실패: {e}")
            # 실패 시 더미 임베딩 반환
            dim = self.get_embedding_dimension()
            return [[0.0] * dim for _ in input_texts]
    
    def _create_huggingface_embeddings(self, input_texts):
        """HuggingFace 로컬 임베딩 생성"""
        model = self._get_huggingface_model()
        if not model:
            print("허깅페이스 모델을 사용할 수 없어 더미 임베딩을 반환합니다.")
            dim = self.get_embedding_dimension()
            return [[0.0] * dim for _ in input_texts]
        
        try:
            # CPU에서 임베딩 생성 (텐서 변환 비활성화)
            embeddings = model.encode(
                input_texts, 
                convert_to_tensor=False,
                convert_to_numpy=True,
                device='cpu',
                show_progress_bar=False
            )
            
            # numpy array를 list로 변환
            if hasattr(embeddings, 'tolist'):
                embeddings = embeddings.tolist()
            
            # 2D 배열인지 확인하고 1D인 경우 2D로 변환
            if len(embeddings) > 0 and not isinstance(embeddings[0], list):
                embeddings = [embeddings]
            
            print(f"✅ 허깅페이스 로컬 임베딩 생성 완료 - {len(input_texts)}개 텍스트, 차원: {len(embeddings[0]) if embeddings else 0}")
            return embeddings
            
        except Exception as e:
            print(f"허깅페이스 임베딩 생성 실패: {e}")
            # 실패 시 더미 임베딩 반환
            dim = self.get_embedding_dimension()
            return [[0.0] * dim for _ in input_texts]

async def _create_embedding_function() -> Union[EmbeddingFunction, None]:
    """임베딩 함수 생성"""
    try:
        # 설정에서 임베딩 모델 정보 가져오기
        model_settings = settings_service.get_section_settings("models")
        embedding_model = model_settings.get("embedding_model", "text-embedding-ada-002")
        
        return EmbeddingFunction(embedding_model)
    except Exception as e:
        print(f"임베딩 함수 생성 실패: {e}")
        return None

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
            self.vector_dir = os.path.join(settings.DATA_DIR, 'db', 'chromadb')
            self.metadata_dir = os.path.join(settings.DATA_DIR, 'vector_metadata')
            # 디렉토리는 필요할 때만 생성하도록 변경 (자동 생성 제거)
            self.metadata_service = VectorMetadataService()
            
            # 병렬 처리 설정 (성능 설정에서 가져옴)
            from .settings_service import settings_service
            perf_settings = settings_service.get_section_settings("performance")
            self.enable_parallel = perf_settings.get("enableParallelProcessing", True)
            self.max_concurrent_embeddings = perf_settings.get("maxConcurrentEmbeddings", 5)
            self.max_concurrent_chunks = perf_settings.get("maxConcurrentChunks", 20)
            self.batch_size = perf_settings.get("batchSize", 10)
            self.embedding_pool_size = perf_settings.get("embeddingPoolSize", 3)
            
            # 병렬 처리용 세마포어
            self.embedding_semaphore = asyncio.Semaphore(self.max_concurrent_embeddings)
            self.chunk_semaphore = asyncio.Semaphore(self.max_concurrent_chunks)
            
            # 임베딩 함수 풀
            self.embedding_pool = []
            self._embedding_pool_lock = threading.Lock()
            
            # 성능 통계
            self.stats = {
                "total_chunks_processed": 0,
                "total_embeddings_created": 0,
                "average_embedding_time": 0.0,
                "parallel_operations": 0,
                "sequential_operations": 0
            }
            
            print(f"✅ Vector 서비스 초기화 완료 - 병렬 처리: {self.enable_parallel}")
            VectorService._initialized = True

    # --- 핵심적인 새 파이프라인 함수 ---
    async def chunk_and_embed_text(
        self, 
        file_id: str, 
        text_content: str, 
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """전처리된 텍스트를 받아 청킹, 임베딩, 저장을 수행합니다. (PRD2: 스마트 청킹 지원)"""
        try:
            from .settings_service import settings_service
            system_settings = settings_service.get_section_settings("system")
            
            # PRD2: 스마트 청킹 활성화 여부 확인
            use_smart_chunking = system_settings.get("use_smart_chunking", True)
            enable_heading_headers = system_settings.get("enable_heading_headers", True)
            
            if use_smart_chunking and ChunkProposal is not None:
                # 1. PRD2 스마트 청킹 사용
                print(f"🧠 스마트 청킹 모드 사용 - 헤더 임베딩: {enable_heading_headers}")
                
                from .chunking_service import chunking_service, ChunkingRules
                
                # 청킹 규칙 설정
                chunk_size = system_settings.get("chunkSize", settings.DEFAULT_CHUNK_SIZE)
                overlap_size = system_settings.get("chunkOverlap", settings.DEFAULT_CHUNK_OVERLAP)
                min_tokens = max(100, chunk_size // 4)  # 최소 토큰은 최대 토큰의 1/4
                
                rules = ChunkingRules(
                    max_tokens=chunk_size,
                    min_tokens=min_tokens,
                    overlap_tokens=overlap_size,
                    respect_headings=True,
                    preserve_tables=True,
                    preserve_lists=True,
                    hard_sentence_max_tokens=chunk_size // 2  # 강제 분절 기준
                )
                
                # PDF 경로 확인 (이미지 연관성을 위해)
                pdf_path = metadata.get("file_path") if metadata.get("filename", "").lower().endswith('.pdf') else None
                
                # 스마트 청킹 제안 생성
                chunk_proposals = chunking_service.propose_chunks(
                    text_content, 
                    rules, 
                    use_hierarchical=True, 
                    pdf_path=pdf_path
                )
                
                if not chunk_proposals:
                    return {"success": False, "error": "스마트 청킹에서 유효한 청크를 생성할 수 없습니다."}
                
                print(f"📋 스마트 청킹 완료 - {len(chunk_proposals)}개 청크 생성")
                
                # 2. 헤더 포함 임베딩 및 저장
                if enable_heading_headers:
                    success = await self.add_document_chunks_with_headers(file_id, chunk_proposals, metadata)
                    processing_method = "smart_chunking_with_headers"
                else:
                    # 헤더 없이 일반 청크로 변환
                    chunks = [chunk.text for chunk in chunk_proposals]
                    if self.enable_parallel and len(chunks) > 10:
                        success = await self._add_document_chunks_parallel(file_id, chunks, metadata)
                    else:
                        success = await self.add_document_chunks(file_id, chunks, metadata)
                    processing_method = "smart_chunking"
                
                chunks_count = len(chunk_proposals)
            else:
                # 1. 기존 고정 크기 청킹 사용
                print(f"📄 기존 청킹 모드 사용")
                chunk_size = system_settings.get("chunkSize", settings.DEFAULT_CHUNK_SIZE)
                overlap_size = system_settings.get("chunkOverlap", settings.DEFAULT_CHUNK_OVERLAP)
                
                chunks = self._robust_chunking(text_content, chunk_size, overlap_size)
                if not chunks:
                    return {"success": False, "error": "유효한 청크를 생성할 수 없습니다."}

                # 2. 임베딩 및 저장 (병렬 처리 옵션)
                if self.enable_parallel and len(chunks) > 10:  # 청크가 많을 때만 병렬 처리
                    success = await self._add_document_chunks_parallel(file_id, chunks, metadata)
                else:
                    success = await self.add_document_chunks(file_id, chunks, metadata)
                
                chunks_count = len(chunks)
                processing_method = "fixed_size_chunking"
            
            if success:
                print(f"📊 벡터화 완료 처리 시작 - 파일 ID: {file_id} ({processing_method})")
            
            if success:
                # 3. SQLite DB에 벡터 메타데이터 저장
                print(f"💾 SQLite DB에 벡터 메타데이터 저장 시작")
                try:
                    # 전처리 소스 감지 (수동 vs 자동)
                    preprocessing_source = metadata.get("source", "auto")  # get_file_content에서 전달
                    if preprocessing_source == "manual_preprocessing":
                        preprocessing_source = "manual"
                    else:
                        preprocessing_source = "auto"
                        
                    vector_metadata = VectorMetadata(
                        file_id=file_id,
                        filename=metadata.get("filename", "Unknown"),
                        category_id=metadata.get("category_id"),
                        category_name=metadata.get("category_name"),
                        processing_method=processing_method,
                        preprocessing_source=preprocessing_source,
                        chunk_count=chunks_count,
                        file_size=metadata.get("file_size", 0),
                        page_count=metadata.get("page_count"),
                        table_count=metadata.get("table_count", 0),
                        image_count=metadata.get("image_count", 0),
                        processing_time=0.0  # 실제 처리 시간은 상위에서 계산
                    )
                    
                    # 기존 메타데이터가 있는지 확인
                    existing_metadata = self.metadata_service.get_metadata(file_id)
                    if existing_metadata:
                        # 기존 메타데이터 업데이트
                        update_success = self.metadata_service.update_metadata(
                            file_id=file_id,
                            chunk_count=chunks_count,
                            processing_method=processing_method,
                            page_count=metadata.get("page_count"),
                            table_count=metadata.get("table_count", 0),
                            image_count=metadata.get("image_count", 0),
                            updated_at=datetime.now()
                        )
                        if update_success:
                            print(f"✅ SQLite DB 메타데이터 업데이트 성공 - 파일 ID: {file_id}")
                        else:
                            print(f"⚠️ SQLite DB 메타데이터 업데이트 실패 - 파일 ID: {file_id}")
                    else:
                        # 새 메타데이터 생성
                        create_success = self.metadata_service.create_metadata(vector_metadata)
                        if create_success:
                            print(f"✅ SQLite DB 메타데이터 생성 성공 - 파일 ID: {file_id}")
                        else:
                            print(f"⚠️ SQLite DB 메타데이터 생성 실패 - 파일 ID: {file_id}")
                    
                except Exception as e:
                    print(f"⚠️ SQLite DB 메타데이터 저장 중 오류: {e}")
                    # 메타데이터 저장 실패해도 벡터화는 성공으로 처리
                
                print(f"✅ 벡터화 최종 완료 - {chunks_count}개 청크 저장 성공")
                return {"success": True, "chunks_count": chunks_count}
            else:
                print(f"❌ 벡터화 실패 - 청크 저장 실패")
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
            # ChromaDB 클라이언트가 필요할 때만 디렉토리 생성
            os.makedirs(self.vector_dir, exist_ok=True)
            # ChromaDB 클라이언트 생성 - 단순화된 설정
            self._client = chromadb.PersistentClient(path=self.vector_dir)
            print(f"ChromaDB 클라이언트 초기화 완료: {self.vector_dir}")
        except Exception as e:
            print(f"ChromaDB 클라이언트 초기화 실패: {e}")
            
            # 윈도우 파일 잠금 오류 처리
            if "WinError 32" in str(e) or "다른 프로세스가 파일을 사용 중" in str(e):
                print("🔄 윈도우 파일 잠금 감지, 재시도를 시도합니다...")
                success = await self._handle_file_lock_error()
                if not success:
                    self._client = None
                    return
            # tenant 관련 오류는 보통 데이터베이스 손상이나 버전 호환성 문제
            elif "tenant" in str(e).lower():
                print("🔄 ChromaDB 데이터베이스 손상 감지, 재초기화를 시도합니다...")
                try:
                    # 기존 데이터 백업
                    backup_dir = f"{self.vector_dir}_backup_{int(time.time())}"
                    import shutil
                    if os.path.exists(self.vector_dir):
                        shutil.move(self.vector_dir, backup_dir)
                        print(f"기존 데이터를 {backup_dir}로 백업했습니다.")
                    
                    # 새 디렉토리 생성
                    os.makedirs(self.vector_dir, exist_ok=True)
                    
                    # 새 클라이언트 생성
                    self._client = chromadb.PersistentClient(path=self.vector_dir)
                    print(f"✅ ChromaDB 클라이언트 재초기화 성공: {self.vector_dir}")
                except Exception as retry_error:
                    print(f"❌ ChromaDB 재초기화도 실패: {retry_error}")
                    self._client = None
            else:
                self._client = None

    async def _handle_file_lock_error(self) -> bool:
        """윈도우 파일 잠금 오류 처리"""
        import time
        import gc
        import psutil
        
        try:
            # 기존 클라이언트 정리
            if hasattr(self, '_client') and self._client:
                try:
                    self._client = None
                except:
                    pass
            
            # 가비지 컬렉션 강제 실행
            gc.collect()
            
            print("파일 잠금 해제를 위해 잠시 대기 중...")
            for attempt in range(5):
                try:
                    # 짧은 대기
                    await asyncio.sleep(1)
                    
                    # 클라이언트 재생성 시도
                    self._client = chromadb.PersistentClient(path=self.vector_dir)
                    print(f"✅ 파일 잠금 해제 후 ChromaDB 클라이언트 초기화 성공")
                    return True
                    
                except Exception as retry_e:
                    if attempt < 4:  # 마지막 시도가 아니면
                        print(f"재시도 {attempt + 1}/5 실패, 계속 시도 중...")
                        continue
                    else:
                        print(f"❌ 모든 재시도 실패: {retry_e}")
                        
                        # 마지막 수단: 벡터 디렉토리 이름 변경
                        try:
                            backup_dir = f"{self.vector_dir}_locked_{int(time.time())}"
                            import shutil
                            if os.path.exists(self.vector_dir):
                                shutil.move(self.vector_dir, backup_dir)
                                print(f"잠긴 디렉토리를 {backup_dir}로 이동했습니다.")
                            
                            # 새 디렉토리 생성
                            os.makedirs(self.vector_dir, exist_ok=True)
                            
                            # 새 클라이언트 생성
                            self._client = chromadb.PersistentClient(path=self.vector_dir)
                            print(f"✅ 새 디렉토리로 ChromaDB 클라이언트 초기화 성공")
                            return True
                            
                        except Exception as final_error:
                            print(f"❌ 최종 복구 시도도 실패: {final_error}")
                            return False
            
            return False
            
        except Exception as e:
            print(f"❌ 파일 잠금 처리 중 오류: {e}")
            return False

    async def create_chromadb_database(self) -> bool:
        """ChromaDB 데이터베이스를 초기화합니다."""
        if not CHROMADB_AVAILABLE:
            print("ChromaDB 패키지가 설치되지 않았습니다.")
            return False
        
        await self._ensure_client()
        if not self._client:
            print("ChromaDB 클라이언트 초기화에 실패했습니다.")
            return False
        
        try:
            # 컬렉션 연결 시도
            success = await self._connect_to_chromadb()
            if success:
                print("ChromaDB 데이터베이스 초기화 완료")
                return True
            else:
                print("ChromaDB 컬렉션 연결에 실패했습니다.")
                return False
        except Exception as e:
            print(f"ChromaDB 데이터베이스 초기화 실패: {e}")
            return False

    async def _get_collection_dimension(self) -> Optional[int]:
        """기존 컬렉션의 차원을 확인합니다."""
        if not self._collection:
            return None
        
        try:
            existing_data = self._collection.get(limit=1, include=['embeddings'])
            embeddings_data = existing_data.get('embeddings') if existing_data else None
            
            if embeddings_data is not None:
                # numpy 배열 안전 검사
                if hasattr(embeddings_data, 'shape') and len(embeddings_data.shape) > 0 and embeddings_data.shape[0] > 0:
                    embedding_vector = embeddings_data[0]
                    if hasattr(embedding_vector, 'shape'):
                        return embedding_vector.shape[0]
                    else:
                        return len(embedding_vector)
            return None
        except Exception as e:
            print(f"컬렉션 차원 확인 실패: {e}")
            return None

    async def _connect_to_chromadb(self, create_if_missing: bool = False):
        """ChromaDB 컬렉션에 연결합니다."""
        if not CHROMADB_AVAILABLE or not self._client:
            return False
        
        try:
            collection_name = "langflow"
            
            # 현재 임베딩 함수 생성
            embedding_function = await _create_embedding_function()
            if not embedding_function:
                print("임베딩 함수 생성 실패")
                return False
            
            current_dimension = embedding_function.get_embedding_dimension()
            
            try:
                # 기존 컬렉션 가져오기
                self._collection = self._client.get_collection(name=collection_name)
                print(f"✅ 기존 ChromaDB 컬렉션 '{collection_name}' 발견")
                
                # 기존 컬렉션의 차원 확인
                existing_dimension = await self._get_collection_dimension()
                
                if existing_dimension is None:
                    print("📊 기존 컬렉션에 벡터 데이터가 없음")
                    # 임베딩 함수 적용하고 진행
                    self._collection._embedding_function = embedding_function
                    return True
                
                print(f"📊 기존 컬렉션 차원: {existing_dimension}차원")
                print(f"📊 현재 임베딩 설정: {embedding_function.embedding_model} ({current_dimension}차원)")
                
                # 차원 불일치 체크 - 명확한 오류 반환
                if existing_dimension != current_dimension:
                    print(f"❌ 차원 불일치: 기존 컬렉션({existing_dimension}차원) vs 현재 임베딩({current_dimension}차원)")
                    return False
                
                # 차원이 일치하면 임베딩 함수 적용하고 진행
                self._collection._embedding_function = embedding_function
                print(f"✅ ChromaDB 컬렉션 연결 완료 (차원: {existing_dimension})")
                return True
                
            except Exception as get_error:
                if not create_if_missing:
                    print("검색 모드: 컬렉션이 존재하지 않습니다.")
                    return False
                
                # 벡터화 시에만 새 컬렉션 생성
                self._collection = self._client.create_collection(
                    name=collection_name,
                    embedding_function=embedding_function
                )
                print(f"✅ 새 ChromaDB 컬렉션 '{collection_name}' 생성 완료 (차원: {current_dimension})")
                return True
            
        except Exception as e:
            print(f"ChromaDB 컬렉션 연결 실패: {e}")
            return False


    async def add_document_chunks(self, file_id: str, chunks: List[str], metadata: Dict[str, Any]) -> bool:
        """문서 청크들을 ChromaDB에 추가합니다."""
        print(f"📝 벡터화 모드: {len(chunks)}개 청크 추가 시작")
        
        if not chunks or not CHROMADB_AVAILABLE:
            return False
        
        await self._ensure_client()
        if not self._client:
            return False
        
        # 벡터화 전 차원 불일치 검사
        if not await self._connect_to_chromadb(create_if_missing=True):
            print("❌ 벡터화 실패: 임베딩 모델 차원이 기존 컬렉션과 일치하지 않습니다.")
            print("💡 관리자 페이지에서 임베딩 모델 설정을 확인하거나 벡터 데이터를 재생성해주세요.")
            return False
        
        try:
            # 청크별로 고유 ID 생성
            chunk_ids = [f"{file_id}_chunk_{i}" for i in range(len(chunks))]
            
            # 각 청크에 메타데이터 추가 (이미지 연결 정보 포함)
            chunk_metadatas = []
            for i, chunk in enumerate(chunks):
                # 기본 메타데이터만 복사 (ChromaDB 호환성을 위해 - None 값 제거)
                chunk_metadata = {
                    "file_id": file_id,
                    "filename": metadata.get("filename", "Unknown"),
                    "preprocessing_method": metadata.get("preprocessing_method", "basic"),
                    "chunk_index": i,
                    "chunk_length": len(chunk)
                }
                
                # None이 아닌 값만 추가 (ChromaDB MetadataValue 오류 방지)
                if metadata.get("category_id"):
                    chunk_metadata["category_id"] = metadata.get("category_id")
                if metadata.get("category_name"):
                    chunk_metadata["category_name"] = metadata.get("category_name")
                
                # 이미지 정보 추가 (관련 이미지만 필터링)
                file_has_images = metadata.get("image_count", 0) > 0
                file_images = metadata.get("images", [])
                
                if file_has_images and file_images:
                    # 청크와 관련된 이미지만 찾기
                    related_images = self._find_related_images_for_chunk(chunk, metadata)
                    
                    if related_images:
                        chunk_metadata["has_images"] = True
                        chunk_metadata["chunk_image_count"] = len(related_images)
                        # 관련된 이미지만 JSON으로 저장
                        import json
                        chunk_metadata["file_images_json"] = json.dumps(related_images, ensure_ascii=False)
                    else:
                        chunk_metadata["has_images"] = False
                        chunk_metadata["chunk_image_count"] = 0
                    
                    # 전체 파일 통계는 유지
                    chunk_metadata["file_image_count"] = metadata.get("image_count", 0)
                else:
                    chunk_metadata["has_images"] = False
                    chunk_metadata["file_image_count"] = 0
                    chunk_metadata["chunk_image_count"] = 0
                
                # ChromaDB 호환성을 위한 메타데이터 정리 (None 값 제거)
                cleaned_metadata = self._clean_metadata_for_chromadb(chunk_metadata)
                chunk_metadatas.append(cleaned_metadata)
            
            # ChromaDB에 추가하기 전 디버깅 로그
            print(f"🔍 ChromaDB 메타데이터 디버깅 - {len(chunk_metadatas)}개 청크")
            for i, metadata in enumerate(chunk_metadatas[:3]):  # 처음 3개만 로그
                print(f"   청크 {i+1} 메타데이터:")
                for key, value in metadata.items():
                    print(f"     {key}: {value} ({type(value).__name__})")
            
            # ChromaDB에 추가
            self._collection.add(
                documents=chunks,
                metadatas=chunk_metadatas,
                ids=chunk_ids
            )
            
            # 통계 업데이트
            self.stats["total_chunks_processed"] += len(chunks)
            self.stats["total_embeddings_created"] += len(chunks)
            self.stats["sequential_operations"] += 1
            
            print(f"✅ 파일 {file_id}의 {len(chunks)}개 청크를 ChromaDB에 추가 완료")
            return True
            
        except Exception as e:
            print(f"❌ ChromaDB에 청크 추가 실패: {e}")
            return False
    
    # TODO(human): PRD2 헤딩 헤더 임베딩 기능
    # ChunkProposal 객체들을 받아 헤딩 경로를 포함한 텍스트로 임베딩하는 메서드를 구현하세요.
    # 헤딩 경로가 있으면 "[헤딩1 > 헤딩2] 본문내용" 형식으로 구성하고,
    # settings에서 enable_heading_headers 옵션을 확인하여 기능을 활성화할지 결정하세요.
    async def add_document_chunks_with_headers(self, file_id: str, chunk_proposals: List[ChunkProposal], metadata: Dict[str, Any]) -> bool:
        """PRD2: 헤딩 헤더를 포함한 청크 임베딩 (검색 품질 개선)"""
        print(f"📝 헤더 포함 벡터화 모드: {len(chunk_proposals)}개 청크 처리 시작")
        
        if not chunk_proposals or not CHROMADB_AVAILABLE:
            return False
        
        # 설정에서 헤딩 헤더 기능 활성화 여부 확인
        try:
            from .settings_service import settings_service
            system_settings = settings_service.get_section_settings("system")
            enable_heading_headers = system_settings.get("enable_heading_headers", True)
        except:
            enable_heading_headers = True  # 기본값: 활성화
        
        await self._ensure_client()
        if not self._client:
            return False
        
        # 벡터화 전 차원 불일치 검사
        if not await self._connect_to_chromadb(create_if_missing=True):
            print("❌ 벡터화 실패: 임베딩 모델 차원이 기존 컬렉션과 일치하지 않습니다.")
            return False
        
        try:
            # 청크별로 고유 ID 생성
            chunk_ids = [f"{file_id}_chunk_{chunk.order}" for chunk in chunk_proposals]
            
            # 헤딩 헤더를 포함한 텍스트 생성
            enhanced_texts = []
            chunk_metadatas = []
            
            for i, chunk in enumerate(chunk_proposals):
                # 헤딩 헤더 생성
                if enable_heading_headers and chunk.heading_path:
                    # "[헤딩1 > 헤딩2 > 헤딩3] 본문내용" 형식
                    heading_header = " > ".join(chunk.heading_path)
                    enhanced_text = f"[{heading_header}] {chunk.text}"
                    print(f"📋 청크 {chunk.order}: 헤딩 헤더 적용 - {heading_header}")
                else:
                    enhanced_text = chunk.text
                
                enhanced_texts.append(enhanced_text)
                
                # 메타데이터 생성
                chunk_metadata = {
                    "file_id": file_id,
                    "filename": metadata.get("filename", "Unknown"),
                    "category_id": metadata.get("category_id"),
                    "category_name": metadata.get("category_name"),
                    "preprocessing_method": metadata.get("preprocessing_method", "basic"),
                    "chunk_index": i,
                    "chunk_order": chunk.order,
                    "chunk_length": len(chunk.text),
                    "enhanced_length": len(enhanced_text),
                    "has_heading_header": enable_heading_headers and bool(chunk.heading_path),
                    "heading_path": " > ".join(chunk.heading_path) if chunk.heading_path else None,
                    "page_start": chunk.page_start,
                    "page_end": chunk.page_end,
                    "token_estimate": chunk.token_estimate,
                    "quality_warnings_count": len(chunk.quality_warnings) if chunk.quality_warnings else 0
                }
                
                # 이미지 참조 정보 추가 (PRD2 개선)
                if chunk.image_refs:
                    chunk_metadata["has_images"] = True
                    chunk_metadata["chunk_image_count"] = len(chunk.image_refs)
                    # 이미지 정보를 JSON으로 저장
                    import json
                    image_data = []
                    for img_ref in chunk.image_refs:
                        image_data.append({
                            "image_id": img_ref.image_id,
                            "image_type": img_ref.image_type,
                            "distance_to_text": img_ref.distance_to_text,
                            "page": img_ref.bbox.page if img_ref.bbox else None,
                            "description": img_ref.description
                        })
                    chunk_metadata["chunk_images_json"] = json.dumps(image_data, ensure_ascii=False)
                else:
                    chunk_metadata["has_images"] = False
                    chunk_metadata["chunk_image_count"] = 0
                
                # ChromaDB 호환성을 위한 메타데이터 정리 (None 값 제거)
                cleaned_metadata = self._clean_metadata_for_chromadb(chunk_metadata)
                chunk_metadatas.append(cleaned_metadata)
            
            # ChromaDB에 추가
            self._collection.add(
                ids=chunk_ids,
                documents=enhanced_texts,
                metadatas=chunk_metadatas
            )
            
            # 성능 통계 업데이트
            if hasattr(self, '_performance_stats'):
                self._performance_stats["chunks_added"] += len(chunk_proposals)
                self._performance_stats["sequential_operations"] += 1
            
            header_count = sum(1 for chunk in chunk_proposals if chunk.heading_path)
            print(f"✅ 헤더 포함 벡터화 완료 - {len(chunk_proposals)}개 청크 저장 (헤더 적용: {header_count}개)")
            return True
            
        except Exception as e:
            print(f"❌ 헤더 포함 벡터화 실패: {e}")
            return False
    
    def _clean_metadata_for_chromadb(self, metadata: Dict) -> Dict:
        """ChromaDB 호환을 위한 메타데이터 정리 (None 값 제거)"""
        cleaned = {}
        for key, value in metadata.items():
            if value is not None:  # None 값 제외
                if isinstance(value, (str, int, float, bool)):  # ChromaDB 허용 타입만
                    cleaned[key] = value
                elif isinstance(value, (list, dict)):  # 컬렉션은 JSON 문자열로 변환
                    import json
                    cleaned[key] = json.dumps(value, ensure_ascii=False)
                else:  # 기타 타입은 문자열로 변환
                    cleaned[key] = str(value)
        return cleaned
    
    def _find_related_images_for_chunk(self, chunk_text: str, metadata: Dict) -> List[Dict]:
        """청크 텍스트와 관련된 이미지를 찾습니다."""
        related_images = []
        
        try:
            # metadata에서 text_image_relations 가져오기
            text_image_relations = metadata.get("text_image_relations", [])
            
            if not text_image_relations:
                return related_images
            
            # 청크 텍스트와 관련된 이미지들 찾기
            for relation in text_image_relations:
                related_text = relation.get("related_text", "")
                
                # 텍스트 매칭 방법들
                # 1. 직접 포함 여부 확인
                text_overlap = self._calculate_text_overlap(chunk_text, related_text)
                
                # 2. 높은 매칭도를 가진 관계만 선택
                if text_overlap > 0.3 or relation.get("confidence", 0) > 0.7:
                    image_info = {
                        "image_id": relation.get("image_id"),
                        "image_path": relation.get("image_path"),
                        "page": relation.get("page"),
                        "relationship_type": relation.get("relationship_type"),
                        "confidence": relation.get("confidence", 0),
                        "text_overlap": text_overlap
                    }
                    related_images.append(image_info)
            
            # 중복 제거 (같은 이미지가 여러 관계로 매칭된 경우)
            seen_image_ids = set()
            unique_related_images = []
            for img in related_images:
                if img["image_id"] not in seen_image_ids:
                    seen_image_ids.add(img["image_id"])
                    unique_related_images.append(img)
            
            # 신뢰도 순으로 정렬
            unique_related_images.sort(key=lambda x: x.get("confidence", 0), reverse=True)
            
            return unique_related_images[:3]  # 최대 3개까지만
            
        except Exception as e:
            return []
    
    def _calculate_text_overlap(self, text1: str, text2: str) -> float:
        """두 텍스트 간의 겹치는 정도를 계산합니다."""
        if not text1 or not text2:
            return 0.0
        
        try:
            # 간단한 단어 기반 매칭
            words1 = set(re.findall(r'\w+', text1.lower()))
            words2 = set(re.findall(r'\w+', text2.lower()))
            
            if not words1 or not words2:
                return 0.0
            
            intersection = len(words1 & words2)
            union = len(words1 | words2)
            
            return intersection / union if union > 0 else 0.0
            
        except Exception:
            return 0.0

    async def search_similar_chunks(self, query: str, top_k: int = 5, category_ids: List[str] = None) -> List[Dict[str, Any]]:
        """유사한 청크를 검색합니다."""
        print(f"🔍 검색 모드: 쿼리 '{query[:50]}...' (top_k={top_k})")
        
        if not query or not CHROMADB_AVAILABLE:
            return []
        
        await self._ensure_client()
        if not self._client:
            return []
        
        # 검색 전 차원 불일치 검사
        if not await self._connect_to_chromadb(create_if_missing=False):
            print("❌ 검색 실패: 임베딩 모델 차원이 기존 컬렉션과 일치하지 않거나 컬렉션이 존재하지 않습니다.")
            return []
        
        try:
            # 카테고리 필터 설정
            where_clause = None
            if category_ids:
                where_clause = {"category_id": {"$in": category_ids}}
            
            # 유사도 검색 실행
            results = self._collection.query(
                query_texts=[query],
                n_results=top_k,
                where=where_clause,
                include=["documents", "metadatas", "distances"]
            )
            
            if not results or not results['documents'] or not results['documents'][0]:
                return []
            
            # 결과를 딕셔너리 리스트로 변환 (이미지 정보 포함)
            similar_chunks = []
            for i in range(len(results['documents'][0])):
                metadata = results['metadatas'][0][i] if i < len(results['metadatas'][0]) else {}
                
                chunk_data = {
                    "content": results['documents'][0][i],
                    "metadata": metadata,
                    "similarity": 1 - results['distances'][0][i] if i < len(results['distances'][0]) else 0.0,
                    "has_images": metadata.get("has_images", False),
                    "related_images": metadata.get("related_images", []),
                    "image_count": metadata.get("image_count", 0)
                }
                similar_chunks.append(chunk_data)
            
            return similar_chunks
            
        except Exception as e:
            print(f"❌ 유사도 검색 실패: {e}")
            return []
    
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
            collection_dimension = None
            
            for collection in collections:
                try:
                    total_vectors += collection.count()
                    collection_names.append(collection.name)
                    
                    # 차원 정보 확인 (첫 번째 컬렉션에서)
                    if collection_dimension is None and collection.name == "langflow":
                        self._collection = collection
                        collection_dimension = await self._get_collection_dimension()
                        
                except Exception as e:
                    # Could fail if a collection is corrupt, but we can still report others
                    print(f"Could not get count for collection {collection.name}: {e}")

            return {
                "connected": True,
                "total_vectors": total_vectors,
                "collection_count": len(collections),
                "collections": collection_names,
                "dimension": collection_dimension,
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
    
    async def delete_document_vectors(self, file_id: str) -> bool:
        """특정 파일의 모든 벡터 데이터를 ChromaDB에서 삭제합니다."""
        if not CHROMADB_AVAILABLE:
            print("ChromaDB 패키지가 설치되지 않아 벡터 삭제를 건너뜁니다.")
            return True
        
        await self._ensure_client()
        if not self._client:
            print("ChromaDB 클라이언트가 초기화되지 않아 벡터 삭제를 건너뜁니다.")
            return True
        
        try:
            # 컬렉션 가져오기
            if not await self._connect_to_chromadb(create_if_missing=False):
                print("ChromaDB 컬렉션이 없어 벡터 삭제를 건너뜁니다.")
                return True
            
            # 파일 ID로 필터링하여 해당 문서의 모든 벡터 삭제
            # ChromaDB에서 where 조건으로 file_id가 일치하는 데이터를 찾아 삭제
            try:
                # 먼저 해당 file_id의 데이터가 있는지 확인
                existing_data = self._collection.get(
                    where={"file_id": file_id},
                    include=["metadatas"]
                )
                
                if existing_data and existing_data['ids']:
                    # 존재하는 데이터의 ID들을 모두 삭제
                    self._collection.delete(ids=existing_data['ids'])
                    print(f"✅ 파일 {file_id}의 벡터 데이터 {len(existing_data['ids'])}개 삭제 완료")
                else:
                    print(f"파일 {file_id}의 벡터 데이터가 존재하지 않습니다.")
                
                # 메타데이터 서비스에서도 해당 파일 데이터 삭제
                await self.metadata_service.delete_file_metadata(file_id)
                
                return True
                
            except Exception as delete_error:
                print(f"벡터 삭제 중 오류: {delete_error}")
                return False
                
        except Exception as e:
            print(f"❌ 벡터 삭제 실패: {e}")
            return False
    
    async def get_document_chunks(self, file_id: str) -> List[Dict[str, Any]]:
        """특정 파일의 모든 청크를 조회합니다."""
        if not CHROMADB_AVAILABLE:
            return []
        
        await self._ensure_client()
        if not self._client:
            return []
        
        try:
            if not await self._connect_to_chromadb(create_if_missing=False):
                return []
            
            # 파일 ID로 필터링하여 해당 문서의 모든 청크 조회
            results = self._collection.get(
                where={"file_id": file_id},
                include=["documents", "metadatas", "distances"]
            )
            
            if not results or not results['ids']:
                return []
            
            # 결과를 딕셔너리 리스트로 변환
            chunks = []
            for i in range(len(results['ids'])):
                chunk_data = {
                    "id": results['ids'][i],
                    "content": results['documents'][i] if i < len(results['documents']) else "",
                    "metadata": results['metadatas'][i] if i < len(results['metadatas']) else {}
                }
                chunks.append(chunk_data)
            
            return chunks
            
        except Exception as e:
            print(f"❌ 문서 청크 조회 실패: {e}")
            return []

    async def clear_all_data(self) -> bool:
        """ChromaDB의 모든 벡터 데이터를 삭제합니다 (데이터베이스 구조는 유지)"""
        if not CHROMADB_AVAILABLE:
            print("ChromaDB 패키지가 설치되지 않아 데이터 클리어를 건너뜁니다.")
            return True
        
        await self._ensure_client()
        if not self._client:
            print("ChromaDB 클라이언트가 초기화되지 않아 데이터 클리어를 건너뜁니다.")
            return True
        
        try:
            # 기존 컬렉션 연결
            if not await self._connect_to_chromadb(create_if_missing=False):
                print("ChromaDB 컬렉션이 없어 데이터 클리어를 건너뜁니다.")
                return True
            
            if self._collection:
                # 컬렉션의 모든 데이터 가져오기
                try:
                    all_data = self._collection.get(include=["metadatas"])
                    
                    if all_data and all_data['ids']:
                        # 모든 벡터 데이터 삭제
                        self._collection.delete(ids=all_data['ids'])
                        print(f"✅ ChromaDB에서 {len(all_data['ids'])}개의 벡터 데이터 삭제 완료")
                    else:
                        print("삭제할 벡터 데이터가 없습니다.")
                        
                except Exception as delete_error:
                    print(f"벡터 데이터 삭제 중 오류: {delete_error}")
                    return False
            
            # 메타데이터 서비스에서도 모든 데이터 삭제
            try:
                success = await self.metadata_service.clear_all_metadata()
                if success:
                    print("✅ 메타데이터 테이블 클리어 완료")
                else:
                    print("⚠️ 메타데이터 테이블 클리어 실패")
            except Exception as meta_error:
                print(f"메타데이터 클리어 중 오류: {meta_error}")
            
            return True
            
        except Exception as e:
            print(f"❌ 전체 데이터 클리어 실패: {e}")
            return False
    
    # --- 병렬 처리 메서드들 ---
    async def _get_embedding_function(self):
        """임베딩 함수 풀에서 함수 가져오기 (연결 풀링)"""
        with self._embedding_pool_lock:
            if len(self.embedding_pool) < self.embedding_pool_size:
                # 새 임베딩 함수 생성
                embedding_func = await _create_embedding_function()
                if embedding_func:
                    self.embedding_pool.append(embedding_func)
                return embedding_func
            else:
                # 기존 함수 재사용 (라운드 로빈)
                return self.embedding_pool[len(self.embedding_pool) % self.embedding_pool_size]
    
    async def _create_single_embedding(self, embedding_func, chunk: str) -> List[float]:
        """단일 청크 임베딩 생성"""
        try:
            # 텍스트 정규화
            normalized_chunk = chunk.strip()
            if not normalized_chunk:
                # 임베딩 함수에서 차원 가져오기
                embedding_func = await _create_embedding_function()
                dim = embedding_func.get_embedding_dimension() if embedding_func else 1536
                return [0.0] * dim
            
            # 임베딩 생성 (비동기) - ChromaDB 0.4.16+ 호환
            embeddings = await asyncio.to_thread(embedding_func, [normalized_chunk])
            if embeddings:
                return embeddings[0]
            else:
                dim = embedding_func.get_embedding_dimension() if hasattr(embedding_func, 'get_embedding_dimension') else 1536
                return [0.0] * dim
            
        except Exception as e:
            print(f"단일 임베딩 생성 실패: {e}")
            # 에러 시에도 적절한 차원 반환
            try:
                dim = embedding_func.get_embedding_dimension() if hasattr(embedding_func, 'get_embedding_dimension') else 1536
            except:
                dim = 1536
            return [0.0] * dim
    
    async def _add_document_chunks_parallel(self, file_id: str, chunks: List[str], metadata: Dict[str, Any]) -> bool:
        """병렬로 문서 청크들을 처리하고 ChromaDB에 추가합니다."""
        if not chunks or not CHROMADB_AVAILABLE:
            return False
        
        await self._ensure_client()
        if not self._client:
            return False
        
        if not await self._connect_to_chromadb(create_if_missing=True):
            return False
        
        try:
            start_time = time.time()
            print(f"🚀 병렬 처리 시작 - {len(chunks)}개 청크")
            
            # 배치 단위로 청크 처리
            batch_size = self.batch_size
            all_chunk_data = []
            
            for batch_start in range(0, len(chunks), batch_size):
                batch_end = min(batch_start + batch_size, len(chunks))
                batch_chunks = chunks[batch_start:batch_end]
                
                # 병렬 임베딩 생성
                async with self.embedding_semaphore:
                    embedding_func = await self._get_embedding_function()
                    if not embedding_func:
                        print(f"임베딩 함수 생성 실패")
                        continue
                    
                    # 배치 내 각 청크에 대해 병렬로 임베딩 생성
                    embedding_tasks = []
                    for chunk in batch_chunks:
                        task = asyncio.create_task(self._create_single_embedding(embedding_func, chunk))
                        embedding_tasks.append(task)
                    
                    # 모든 임베딩 완료 대기
                    embeddings = await asyncio.gather(*embedding_tasks, return_exceptions=True)
                    
                    # 결과 수집
                    for i, (chunk, embedding) in enumerate(zip(batch_chunks, embeddings)):
                        if isinstance(embedding, Exception):
                            print(f"청크 {batch_start + i} 임베딩 실패: {embedding}")
                            # 실패 시 임베딩 함수에서 차원 가져오기
                            dim = embedding_func.get_embedding_dimension() if hasattr(embedding_func, 'get_embedding_dimension') else 1536
                            embedding = [0.0] * dim
                        else:
                            # 임베딩 값 검증
                            if not embedding or len(embedding) == 0:
                                print(f"⚠️ 청크 {batch_start + i} 임베딩이 비어있음, 기본값 사용")
                                dim = embedding_func.get_embedding_dimension() if hasattr(embedding_func, 'get_embedding_dimension') else 1536
                                embedding = [0.0] * dim
                            elif not isinstance(embedding, list) or not isinstance(embedding[0], (int, float)):
                                print(f"⚠️ 청크 {batch_start + i} 임베딩 형식 오류: {type(embedding)}, 기본값 사용")
                                dim = embedding_func.get_embedding_dimension() if hasattr(embedding_func, 'get_embedding_dimension') else 1536
                                embedding = [0.0] * dim
                            else:
                                print(f"✅ 청크 {batch_start + i} 임베딩 생성 성공 (차원: {len(embedding)})")
                        
                        chunk_id = f"{file_id}_chunk_{batch_start + i}"
                        # 기본 메타데이터만 생성 (ChromaDB 호환성을 위해)
                        chunk_metadata = {
                            "file_id": file_id,
                            "filename": metadata.get("filename", "Unknown"),
                            "category_id": metadata.get("category_id"),
                            "category_name": metadata.get("category_name"),
                            "preprocessing_method": metadata.get("preprocessing_method", "basic"),
                            "chunk_index": batch_start + i,
                            "chunk_length": len(chunk)
                        }
                        
                        # 이미지 정보 추가 (페이지 기반 필터링, 병렬 처리용)
                        file_has_images = metadata.get("image_count", 0) > 0
                        file_images = metadata.get("images", [])
                        
                        if file_has_images and file_images:
                            # 청크의 페이지 번호 추출 (chunk_metadata에서 가져오거나 추론)
                            chunk_page = chunk_metadata.get("page", 0)
                            
                            # 같은 페이지에 있는 이미지만 필터링
                            page_images = []
                            for img in file_images:
                                img_page = img.get("page", 0)
                                if img_page == chunk_page:
                                    page_images.append(img)
                            
                            # 페이지에 이미지가 있는 경우에만 메타데이터 추가
                            if page_images:
                                chunk_metadata["has_images"] = True
                                chunk_metadata["chunk_image_count"] = len(page_images)
                                # 해당 페이지의 이미지만 JSON으로 저장
                                import json
                                chunk_metadata["file_images_json"] = json.dumps(page_images, ensure_ascii=False)
                            else:
                                chunk_metadata["has_images"] = False
                                chunk_metadata["chunk_image_count"] = 0
                            
                            # 전체 파일 통계는 유지
                            chunk_metadata["file_image_count"] = metadata.get("image_count", 0)
                        else:
                            chunk_metadata["has_images"] = False
                            chunk_metadata["file_image_count"] = 0
                        
                        # ChromaDB 호환성을 위한 메타데이터 정리 (None 값 제거)
                        cleaned_metadata = self._clean_metadata_for_chromadb(chunk_metadata)
                        
                        all_chunk_data.append({
                            "id": chunk_id,
                            "document": chunk,
                            "metadata": cleaned_metadata,
                            "embedding": embedding
                        })
            
            # ChromaDB에 일괄 추가
            if all_chunk_data:
                print(f"🔄 ChromaDB에 {len(all_chunk_data)}개 청크 저장 시작")
                self._collection.add(
                    documents=[d["document"] for d in all_chunk_data],
                    metadatas=[d["metadata"] for d in all_chunk_data],
                    ids=[d["id"] for d in all_chunk_data],
                    embeddings=[d["embedding"] for d in all_chunk_data]
                )
                
                # 저장 후 실제 개수 확인
                collection_count = self._collection.count()
                print(f"✅ ChromaDB 저장 완료 - {len(all_chunk_data)}개 청크 저장")
                print(f"📊 현재 컬렉션 총 벡터 수: {collection_count}개")
                
                processing_time = time.time() - start_time
                self.stats["total_chunks_processed"] += len(chunks)
                self.stats["total_embeddings_created"] += len(all_chunk_data)
                self.stats["parallel_operations"] += 1
                
                print(f"✅ 병렬 처리 완료 - {len(all_chunk_data)}개 청크, {processing_time:.2f}초")
                return True
            else:
                print(f"❌ 병렬 처리 실패 - 유효한 청크 데이터 없음")
                return False
            
        except Exception as e:
            print(f"❌ 병렬 청크 추가 실패: {e}")
            return False
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """성능 통계 반환"""
        total_ops = self.stats["parallel_operations"] + self.stats["sequential_operations"]
        return {
            **self.stats,
            "embedding_pool_size": len(self.embedding_pool),
            "parallel_ratio": self.stats["parallel_operations"] / max(1, total_ops),
            "average_chunks_per_operation": self.stats["total_chunks_processed"] / max(1, total_ops)
        }


    def cleanup_resources(self):
        """리소스 정리"""
        try:
            # ChromaDB 클라이언트 정리
            if hasattr(self, '_client') and self._client:
                try:
                    self._client = None
                except:
                    pass
            
            # 컬렉션 정리
            if hasattr(self, '_collection') and self._collection:
                try:
                    self._collection = None
                except:
                    pass
            
            # 임베딩 풀 정리
            if hasattr(self, 'embedding_pool'):
                self.embedding_pool.clear()
            
            print("VectorService 리소스 정리 완료")
            
        except Exception as e:
            print(f"리소스 정리 중 오류: {e}")

    async def vectorize_with_docling_pipeline(
        self,
        file_path: str,
        file_id: str,
        metadata: Dict[str, Any],
        enable_docling: bool = True,
        docling_options: Optional[DoclingOptions] = None
    ) -> Dict[str, Any]:
        """Docling 통합 벡터화 파이프라인 - 이미지 메타데이터 포함"""
        print(f"🚀 Docling 통합 벡터화 파이프라인 시작: {file_path}")
        start_time = time.time()
        
        try:
            # Docling 처리 수행
            if enable_docling and docling_options:
                from .docling_service import DoclingService
                docling_service = DoclingService()
                
                if docling_service.is_available:
                    print("📄 Docling 문서 처리 시작...")
                    docling_result = await docling_service.process_document(file_path, docling_options)
                    
                    if docling_result.success:
                        print(f"✅ Docling 처리 성공 - 이미지: {len(docling_result.images)}개, 테이블: {len(docling_result.tables)}개")
                        
                        # 메인 텍스트 추출
                        text_content = docling_result.content.get("markdown", "") or docling_result.content.get("text", "")
                        
                        # 이미지 메타데이터를 안전하게 정리 (base64 데이터 제거)
                        safe_images = []
                        for img in docling_result.images:
                            safe_img = {
                                "id": img.get("id"),
                                "page": img.get("page"),
                                "bbox": img.get("bbox"),
                                "description": img.get("description"),  # 이미 안전한 설명으로 설정됨
                                "image_path": img.get("image_path"),
                                "caption": img.get("caption"),
                                "label": img.get("label"),
                                "source": img.get("source")
                            }
                            safe_images.append(safe_img)
                        
                        # 이미지 메타데이터 준비 (add_document_chunks 함수와 호환되도록)
                        image_metadata = {
                            "has_images": len(safe_images) > 0,
                            "image_count": len(safe_images),
                            "table_count": len(docling_result.tables),
                            "page_count": docling_result.metadata.get("page_count", 0),
                            "images": safe_images,  # 정리된 안전한 이미지 데이터
                            "text_image_relations": docling_result.content.get("text_image_relations", []),
                            "related_images": [img.get("image_path") for img in safe_images if img.get("image_path")],
                            "image_details": json.dumps(safe_images) if safe_images else "[]"
                        }
                        
                        # 기존 메타데이터와 이미지 메타데이터 결합
                        enhanced_metadata = {**metadata, **image_metadata}
                        
                        # 텍스트 청킹 및 벡터화 (전체 파이프라인 실행)
                        chunks_result = await self.chunk_and_embed_text(file_id, text_content, enhanced_metadata)
                        
                        if chunks_result.get("success"):
                            processing_time = time.time() - start_time
                            print(f"✅ Docling 통합 벡터화 완료 ({processing_time:.2f}초)")
                            
                            return {
                                "success": True,
                                "chunks_count": chunks_result.get("chunks_count", 0),
                                "processing_method": "docling",
                                "processing_time": processing_time,
                                "image_count": len(docling_result.images),
                                "table_count": len(docling_result.tables)
                            }
                        else:
                            return {"success": False, "error": chunks_result.get("error", "청킹 및 벡터화 실패")}
                    else:
                        print(f"⚠️ Docling 처리 실패: {docling_result.error}")
                        # 폴백: 기존 처리 방식 사용
                        return await self._fallback_vectorization(file_path, file_id, metadata)
                else:
                    print("⚠️ Docling 서비스 사용 불가")
                    return await self._fallback_vectorization(file_path, file_id, metadata)
            else:
                # Docling 비활성화 시 기존 처리 방식
                return await self._fallback_vectorization(file_path, file_id, metadata)
                
        except Exception as e:
            print(f"❌ Docling 통합 벡터화 실패: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}
    
    async def _fallback_vectorization(self, file_path: str, file_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """기존 벡터화 방식 (폴백)"""
        print("🔄 기존 벡터화 방식으로 폴백")
        
        try:
            # 기본 텍스트 추출 (기존 방식)
            with open(file_path, 'rb') as file:
                import PyPDF2
                reader = PyPDF2.PdfReader(file)
                text_content = ""
                for page in reader.pages:
                    text_content += page.extract_text() + "\n"
            
            # 기본 메타데이터 (이미지 정보 없음)
            basic_metadata = {
                **metadata,
                "has_images": False,
                "image_count": 0,
                "table_count": 0,
                "page_count": len(reader.pages) if 'reader' in locals() else 0,
                "related_images": [],
                "image_details": "[]"
            }
            
            # 텍스트 청킹 및 벡터화 (전체 파이프라인 실행)
            chunks_result = await self.chunk_and_embed_text(file_id, text_content, basic_metadata)
            
            if chunks_result.get("success"):
                return {
                    "success": True,
                    "chunks_count": chunks_result.get("chunks_count", 0),
                    "processing_method": "fallback",
                    "processing_time": time.time() - time.time(),
                    "image_count": 0,
                    "table_count": 0
                }
            else:
                return {"success": False, "error": chunks_result.get("error", "폴백 벡터화 실패")}
                
        except Exception as e:
            print(f"❌ 폴백 벡터화 실패: {e}")
            return {"success": False, "error": str(e)}

    @classmethod
    def reset_instance(cls):
        """VectorService 인스턴스 재설정"""
        try:
            if cls._instance:
                cls._instance.cleanup_resources()
            cls._instance = None
            cls._initialized = False
            print("VectorService 인스턴스 재설정 완료")
        except Exception as e:
            print(f"인스턴스 재설정 중 오류: {e}")

