from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.logger import setup_logging, get_console_logger
from app.api import chat, files, flows, stats, categories, langflow, users, personas, system_settings
from app.api import settings as settings_api
from app.db.init_db import initialize_database
import uvicorn
import os

# 데이터베이스 초기화
initialize_database()

# FastAPI 애플리케이션 생성
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="사내 지식관리 RAG 시스템 API",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# 로깅 초기화
setup_logging()
_log = get_console_logger()
_log.info("API 서버 초기화 완료", extra={"event": "server_start", "version": settings.VERSION})

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(files.router, prefix=settings.API_V1_STR)
app.include_router(flows.router, prefix=settings.API_V1_STR)
app.include_router(stats.router, prefix=settings.API_V1_STR)
app.include_router(categories.router, prefix=settings.API_V1_STR)
app.include_router(langflow.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(settings_api.router, prefix=settings.API_V1_STR)
app.include_router(personas.router, prefix=settings.API_V1_STR)
app.include_router(system_settings.router, prefix=settings.API_V1_STR)

# 정적 파일 서빙 설정 (아바타 이미지용)
uploads_dir = "uploads"
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.get("/")
async def root():
    """API 루트 엔드포인트"""
    return {
        "message": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {
        "status": "healthy",
        "timestamp": "2024-01-01T00:00:00Z"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        ws="none"  # 웹소켓 미사용 시 종속성 없이 구동
    ) 