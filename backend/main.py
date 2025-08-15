from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.logger import setup_logging, get_console_logger
from app.api import chat, files, flows, stats, categories, langflow, users, personas, system_settings, sse, model_settings, vectors, unstructured_settings
from app.api import settings as settings_api
from app.db.init_db import initialize_database
import uvicorn
import os
import signal
import sys
import subprocess
import time
import psutil

# 포트 사용 중인 프로세스 체크 및 종료
def kill_process_on_port(port):
    """지정된 포트를 사용하는 프로세스를 찾아서 종료합니다."""
    try:
        print(f"🔍 포트 {port} 사용 중인 프로세스 확인 중...")
        
        # psutil을 사용하여 포트를 사용하는 프로세스 찾기
        killed_processes = []
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                # net_connections() 메서드 사용 (connections는 deprecated)
                connections = proc.net_connections(kind='inet')
                for conn in connections:
                    if hasattr(conn, 'laddr') and conn.laddr.port == port and conn.status == 'LISTEN':
                        pid = proc.info['pid']
                        name = proc.info['name']
                        
                        print(f"📍 포트 {port}를 사용하는 프로세스 발견: PID {pid} ({name})")
                        
                        # 프로세스 종료 시도
                        try:
                            process = psutil.Process(pid)
                            process.terminate()  # 우선 정상 종료 시도
                            
                            # 3초 대기 후 강제 종료
                            try:
                                process.wait(timeout=3)
                                print(f"✅ 프로세스 {pid} ({name}) 정상 종료됨")
                            except psutil.TimeoutExpired:
                                print(f"⚠️ 프로세스 {pid} ({name}) 강제 종료 시도...")
                                process.kill()
                                print(f"✅ 프로세스 {pid} ({name}) 강제 종료됨")
                            
                            killed_processes.append(f"PID {pid} ({name})")
                            
                        except psutil.NoSuchProcess:
                            print(f"💭 프로세스 {pid}가 이미 종료되었습니다.")
                        except psutil.AccessDenied:
                            print(f"❌ 프로세스 {pid} 종료 권한이 없습니다.")
                        except Exception as e:
                            print(f"❌ 프로세스 {pid} 종료 중 오류: {e}")
                            
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
                
        if killed_processes:
            print(f"🧹 총 {len(killed_processes)}개 프로세스 종료: {', '.join(killed_processes)}")
            time.sleep(1)  # 1초 대기하여 포트 해제 확인
        else:
            print(f"✅ 포트 {port}는 사용 가능합니다.")
            
    except Exception as e:
        print(f"❌ 포트 {port} 체크 중 오류: {e}")
        # 오류가 발생해도 서버 시작은 계속 진행

def check_port_available(port):
    """포트가 사용 가능한지 확인합니다."""
    try:
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result = s.connect_ex(('localhost', port))
            return result != 0  # 연결 실패 시 포트 사용 가능
    except Exception:
        return True  # 오류 시 사용 가능한 것으로 간주

# 시그널 핸들러 설정 (Ctrl+C 종료 처리)
def signal_handler(sig, frame):
    print(f"\n\n🛑 프로그램 종료 신호 수신 ({sig})")
    print("📦 서버를 안전하게 종료합니다...")
    sys.exit(0)

# SIGINT (Ctrl+C) 및 SIGTERM 시그널 핸들러 등록
signal.signal(signal.SIGINT, signal_handler)
if hasattr(signal, 'SIGTERM'):
    signal.signal(signal.SIGTERM, signal_handler)

# 데이터베이스 초기화
initialize_database()

# unstructured 라이브러리 사전 로딩 테스트
try:
    import unstructured
    print(f"✅ unstructured 라이브러리 사전 로딩 성공 - 버전: {getattr(unstructured, '__version__', 'unknown')}")
except ImportError as e:
    print(f"❌ unstructured 라이브러리 사전 로딩 실패: {e}")
    import sys
    print(f"Python 경로: {sys.executable}")
    print(f"site-packages: {[p for p in sys.path if 'site-packages' in p]}")
except Exception as e:
    print(f"❌ unstructured 라이브러리 로딩 중 예상치 못한 오류: {e}")

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
app.include_router(model_settings.router, prefix=settings.API_V1_STR)
app.include_router(vectors.router, prefix=settings.API_V1_STR)
app.include_router(unstructured_settings.router, prefix=settings.API_V1_STR)
app.include_router(sse.router)  # SSE는 별도 prefix 사용

# 정적 파일 서빙 설정 (아바타 이미지 및 문서 이미지용)
uploads_dir = "uploads"
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir, exist_ok=True)

# 이미지 디렉토리 생성
images_dir = os.path.join(uploads_dir, "images")
if not os.path.exists(images_dir):
    os.makedirs(images_dir, exist_ok=True)

# 아바타 디렉토리 생성
avatars_dir = os.path.join(uploads_dir, "avatars")
if not os.path.exists(avatars_dir):
    os.makedirs(avatars_dir, exist_ok=True)

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
    # 서버 시작 전 포트 체크 및 기존 프로세스 종료
    print(f"🚀 {settings.PROJECT_NAME} 서버 시작 준비 중...")
    print(f"📍 호스트: {settings.HOST}, 포트: {settings.PORT}")
    
    # 동일 포트 사용 프로세스 자동 종료
    kill_process_on_port(settings.PORT)
    
    # 포트 사용 가능 여부 최종 확인
    if not check_port_available(settings.PORT):
        print(f"⚠️ 포트 {settings.PORT}가 여전히 사용 중입니다. 다른 포트를 사용하거나 수동으로 프로세스를 종료해주세요.")
        print("📋 실행 중인 Python 프로세스 확인: tasklist /fi \"imagename eq python.exe\"")
        sys.exit(1)
    
    print(f"✅ 포트 {settings.PORT} 사용 가능 확인완료!")
    print("🎯 FastAPI 서버를 시작합니다...\n")
    
    try:
        uvicorn.run(
            "main:app",
            host=settings.HOST,
            port=settings.PORT,
            reload=settings.DEBUG,
            ws="none",  # 웹소켓 미사용 시 종속성 없이 구동
            log_level="warning"  # INFO 로그 숨기기 - WARNING 이상만 출력
        )
    except KeyboardInterrupt:
        print("\n🛑 사용자에 의해 서버가 중단되었습니다.")
    except Exception as e:
        print(f"\n❌ 서버 실행 중 오류 발생: {e}")
        sys.exit(1) 