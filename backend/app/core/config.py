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
    GOOGLE_API_KEY: Optional[str] = None
    MISTRAL_API_KEY: Optional[str] = None
    XAI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    AZURE_OPENAI_API_KEY: Optional[str] = None
    OLLAMA_API_KEY: Optional[str] = None
    GITHUB_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    
    # Supabase 설정
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    
    # 벡터 DB 설정
    VECTOR_DB_TYPE: str = "faiss"
    VECTOR_DB_PATH: str = "./vector_db"
    
    # 파일 업로드 설정
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10485760  # 10MB
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