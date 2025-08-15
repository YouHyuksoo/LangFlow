from pydantic_settings import BaseSettings
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # 기본 디렉토리 설정 (backend 디렉토리 기준)
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # API 설정
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Langflow RAG System API"
    VERSION: str = "1.0.0"
    
    # 서버 설정
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    
    # OpenAI 설정
    OPENAI_API_KEY: Optional[str] = None
    
    # AI Provider API Keys
    ANTHROPIC_API_KEY: Optional[str] = None
    PERPLEXITY_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = "AIzaSyCVuqNTQ3DWYXFoZXlKejowQYdaMwuud3w"
    MISTRAL_API_KEY: Optional[str] = None
    XAI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    AZURE_OPENAI_API_KEY: Optional[str] = None
    OLLAMA_API_KEY: Optional[str] = None
    GITHUB_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = "AIzaSyCVuqNTQ3DWYXFoZXlKejowQYdaMwuud3w"
    
    # Supabase 설정
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    
    # 벡터 DB 설정
    VECTOR_DB_TYPE: str = "faiss"
    VECTOR_DB_PATH: str = "./vector_db"
    
    # 벡터화 설정
    DEFAULT_CHUNK_SIZE: int = 800   # OpenAI 8192 토큰 제한 고려 (배치 처리 시)
    DEFAULT_CHUNK_OVERLAP: int = 120
    BATCH_SIZE: int = 2             # 임베딩 배치 크기 축소 (안정성 최우선)
    DISTANCE_NORMALIZATION_FACTOR: float = 2.0  # OpenAI 임베딩용
    
    # 성능 최적화 설정
    MAX_CONCURRENT_EMBEDDINGS: int = 5  # 동시 임베딩 처리 수
    MAX_CONCURRENT_CHUNKS: int = 20     # 동시 청크 처리 수
    EMBEDDING_POOL_SIZE: int = 3        # 임베딩 함수 풀 크기
    CHUNK_STREAM_BUFFER_SIZE: int = 100 # 스트리밍 청크 버퍼 크기
    CONNECTION_POOL_SIZE: int = 10      # ChromaDB 연결 풀 크기
    CACHE_TTL_SECONDS: int = 3600       # 캐시 만료 시간 (1시간)
    
    # 파일 업로드 설정
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10485760  # 10MB
    # 기본 허용 확장자 (실제로는 system_settings.json에서 동적 로드)
    ALLOWED_EXTENSIONS: set = {".pdf"}
    
    # 데이터 저장 설정
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    
    # Langflow 설정
    LANGFLOW_DIR: str = "./langflow"
    FLOWS_DIR: str = "./langflow/flows"
    COMPONENTS_DIR: str = "./langflow/components"
    CUSTOM_COMPONENTS_DIR: str = "./langflow/custom_components"
    DEFAULT_VECTORIZATION_FLOW_ID: Optional[str] = None
    DEFAULT_SEARCH_FLOW_ID: Optional[str] = None
    
    # CORS 설정
    CORS_ORIGINS: list = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # 추가 환경 변수 무시

settings = Settings() 