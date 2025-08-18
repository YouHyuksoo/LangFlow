from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional
import os
import sqlite3
import shutil
import time
import gc
import psutil
from datetime import datetime
from ..core.config import settings
from ..core.logger import get_console_logger
from ..services.vector_service import VectorService
from ..models.vector_models import VectorMetadataService
from ..api.chat import get_admin_user

router = APIRouter(prefix="/admin/database", tags=["database-management"])

# 서비스 인스턴스
vector_service = VectorService()
metadata_service = VectorMetadataService()
_clog = get_console_logger()

# === 데이터베이스 경로 설정 ===
def get_database_paths():
    """모든 데이터베이스 파일 경로 반환"""
    data_dir = settings.DATA_DIR
    return {
        "chromadb": {
            "path": os.path.join(data_dir, "db", "chromadb"),
            "type": "directory",
            "description": "ChromaDB 벡터 데이터베이스"
        },
        "chromadb_main": {
            "path": os.path.join(data_dir, "db", "chromadb", "chroma.sqlite3"),
            "type": "file",
            "description": "ChromaDB 메인 SQLite 데이터베이스"
        },
        "file_metadata": {
            "path": os.path.join(data_dir, "db", "file_metadata.db"),
            "type": "file",
            "description": "파일 메타데이터 SQLite 데이터베이스"
        },
        "metadata": {
            "path": os.path.join(data_dir, "db", "chromadb", "metadata.db"),
            "type": "file", 
            "description": "벡터 메타데이터 SQLite 데이터베이스"
        },
        "users": {
            "path": os.path.join(data_dir, "db", "users.db"),
            "type": "file",
            "description": "사용자 및 인증 SQLite 데이터베이스"
        }
    }

# === 공통 유틸리티 함수 ===
def get_file_size(path: str) -> int:
    """파일 또는 디렉토리 크기 계산 (바이트)"""
    if not os.path.exists(path):
        return 0
    
    if os.path.isfile(path):
        return os.path.getsize(path)
    
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            try:
                total_size += os.path.getsize(filepath)
            except (OSError, FileNotFoundError):
                continue
    return total_size

def format_size(size_bytes: int) -> str:
    """바이트를 읽기 쉬운 형태로 변환"""
    if size_bytes == 0:
        return "0 B"
    
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"

def force_close_chromadb_connections():
    """ChromaDB 연결을 강제로 해제"""
    try:
        # VectorService 클라이언트 해제
        global vector_service
        if hasattr(vector_service, '_client') and vector_service._client:
            try:
                # ChromaDB 클라이언트 해제 시도
                vector_service._client = None
                _clog.info("ChromaDB 클라이언트 연결 해제 완료")
            except Exception as e:
                _clog.warning(f"ChromaDB 클라이언트 해제 중 오류 (무시됨): {e}")
        
        # 가비지 컬렉션 강제 실행
        gc.collect()
        
        # 잠시 대기하여 파일 핸들이 완전히 해제되도록 함
        time.sleep(2)
        
        return True
    except Exception as e:
        _clog.error(f"ChromaDB 연결 강제 해제 오류: {e}")
        return False

def force_remove_directory(path: str, max_retries: int = 5) -> bool:
    """파일이 사용 중일 때 강제로 디렉토리 삭제"""
    for attempt in range(max_retries):
        try:
            if os.path.exists(path):
                # 읽기 전용 속성 제거
                for root, dirs, files in os.walk(path):
                    for d in dirs:
                        os.chmod(os.path.join(root, d), 0o777)
                    for f in files:
                        file_path = os.path.join(root, f)
                        try:
                            os.chmod(file_path, 0o777)
                        except:
                            pass
                
                # 디렉토리 삭제 시도
                shutil.rmtree(path)
                _clog.info(f"디렉토리 삭제 성공: {path}")
                return True
            else:
                return True
                
        except PermissionError as e:
            _clog.warning(f"디렉토리 삭제 시도 {attempt + 1}/{max_retries} 실패 (권한 오류): {e}")
            if attempt < max_retries - 1:
                # 잠시 대기 후 재시도
                time.sleep(2 ** attempt)  # 지수 백오프
            else:
                _clog.error(f"디렉토리 삭제 최종 실패: {path}")
                return False
        except Exception as e:
            _clog.warning(f"디렉토리 삭제 시도 {attempt + 1}/{max_retries} 실패: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                _clog.error(f"디렉토리 삭제 최종 실패: {path}")
                return False
    
    return False

# === 전체 데이터베이스 상태 조회 ===
@router.get("/status")
async def get_all_database_status(admin_user = Depends(get_admin_user)):
    """모든 데이터베이스의 상태를 조회합니다"""
    try:
        db_paths = get_database_paths()
        status_report = {}
        
        for db_name, db_info in db_paths.items():
            path = db_info["path"]
            exists = os.path.exists(path)
            size = get_file_size(path) if exists else 0
            
            status_report[db_name] = {
                "name": db_name.upper(),
                "description": db_info["description"],
                "path": path,
                "exists": exists,
                "size_bytes": size,
                "size_formatted": format_size(size),
                "type": db_info["type"],
                "last_modified": datetime.fromtimestamp(os.path.getmtime(path)).isoformat() if exists else None
            }
            
            # 각 DB별 추가 정보
            if db_name == "chromadb" and exists:
                try:
                    chroma_status = await vector_service.get_status()
                    status_report[db_name].update({
                        "connected": chroma_status.get("connected", False),
                        "collections": chroma_status.get("collections", []),
                        "total_vectors": chroma_status.get("total_vectors", 0)
                    })
                except Exception as e:
                    status_report[db_name]["error"] = str(e)
            
            elif db_name == "metadata" and exists:
                try:
                    with sqlite3.connect(path) as conn:
                        cursor = conn.cursor()
                        cursor.execute("SELECT COUNT(*) FROM vector_metadata")
                        status_report[db_name]["record_count"] = cursor.fetchone()[0]
                except Exception as e:
                    status_report[db_name]["error"] = str(e)
            
            elif db_name == "users" and exists:
                try:
                    with sqlite3.connect(path) as conn:
                        cursor = conn.cursor()
                        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                        tables = [row[0] for row in cursor.fetchall()]
                        status_report[db_name]["tables"] = tables
                        
                        if "users" in tables:
                            cursor.execute("SELECT COUNT(*) FROM users")
                            status_report[db_name]["user_count"] = cursor.fetchone()[0]
                except Exception as e:
                    status_report[db_name]["error"] = str(e)
        
        return {
            "timestamp": datetime.now().isoformat(),
            "databases": status_report
        }
        
    except Exception as e:
        _clog.error(f"전체 데이터베이스 상태 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === ChromaDB 관리 ===
@router.get("/chromadb/status")
async def get_chromadb_status(admin_user = Depends(get_admin_user)):
    """ChromaDB 상태 조회"""
    try:
        status = await vector_service.get_status()
        return status
    except Exception as e:
        _clog.error(f"ChromaDB 상태 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chromadb/backup")
async def backup_chromadb(admin_user = Depends(get_admin_user)):
    """ChromaDB 백업 생성"""
    try:
        db_paths = get_database_paths()
        chromadb_path = db_paths["chromadb"]["path"]
        
        # 백업 디렉토리 생성
        backup_dir = os.path.join(settings.DATA_DIR, "backups", "chromadb")
        os.makedirs(backup_dir, exist_ok=True)
        
        # 백업 파일명 (타임스탬프 포함)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(backup_dir, f"chromadb_backup_{timestamp}")
        
        if os.path.exists(chromadb_path):
            shutil.copytree(chromadb_path, backup_path)
            
            return {
                "status": "success",
                "message": "ChromaDB 백업이 완료되었습니다",
                "backup_path": backup_path,
                "backup_size": format_size(get_file_size(backup_path)),
                "created_at": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=404, detail="ChromaDB 디렉토리를 찾을 수 없습니다")
            
    except Exception as e:
        _clog.error(f"ChromaDB 백업 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chromadb/reset")
async def reset_chromadb(admin_user = Depends(get_admin_user)):
    """ChromaDB 초기화 (자동 백업 포함, 강제 종료 기능)"""
    backup_info = None
    reset_details = {
        "connection_closed": False,
        "directory_removed": False,
        "directory_created": False,
        "retries_used": 0
    }
    
    try:
        # 1단계: 자동 백업 실행
        try:
            backup_result = await backup_chromadb(admin_user)
            backup_info = {
                "backup_created": True,
                "backup_path": backup_result.get("backup_path"),
                "backup_size": backup_result.get("backup_size")
            }
            _clog.info(f"ChromaDB 자동 백업 완료: {backup_result.get('backup_path')}")
        except Exception as backup_error:
            _clog.warning(f"ChromaDB 자동 백업 실패 (초기화는 계속 진행): {backup_error}")
            backup_info = {
                "backup_created": False,
                "backup_error": str(backup_error)
            }
        
        # 2단계: ChromaDB 데이터 클리어 시도 (우선 방법)
        _clog.info("ChromaDB 데이터 클리어 시작...")
        data_cleared = False
        try:
            # VectorService를 통한 데이터 클리어 시도
            data_cleared = await vector_service.clear_all_data()
            reset_details["data_cleared"] = data_cleared
            
            if data_cleared:
                _clog.info("✅ ChromaDB 데이터 클리어 완료 (디렉토리 삭제 불필요)")
                status = "success"
                message = "ChromaDB 데이터가 성공적으로 초기화되었습니다"
                
                return {
                    "status": status,
                    "message": message,
                    "backup_info": backup_info,
                    "reset_details": reset_details,
                    "reset_at": datetime.now().isoformat(),
                    "method": "data_clear"
                }
        except Exception as clear_error:
            _clog.warning(f"데이터 클리어 실패, 파일 삭제 방법으로 전환: {clear_error}")
            reset_details["data_clear_error"] = str(clear_error)
        
        # 3단계: 데이터 클리어 실패시 기존 방식 (디렉토리 삭제)
        if not data_cleared:
            _clog.info("ChromaDB 연결 강제 해제 시작...")
            connection_closed = force_close_chromadb_connections()
            reset_details["connection_closed"] = connection_closed
            
            # 디렉토리 강제 삭제
            db_paths = get_database_paths()
            chromadb_path = db_paths["chromadb"]["path"]
            
            _clog.info(f"ChromaDB 디렉토리 강제 삭제 시작: {chromadb_path}")
            directory_removed = force_remove_directory(chromadb_path)
            reset_details["directory_removed"] = directory_removed
            
            if not directory_removed:
                # 최후의 수단: 개별 파일 삭제 시도
                _clog.warning("디렉토리 전체 삭제 실패, 개별 파일 삭제 시도...")
                try:
                    if os.path.exists(chromadb_path):
                        for root, dirs, files in os.walk(chromadb_path, topdown=False):
                            for file in files:
                                file_path = os.path.join(root, file)
                                try:
                                    os.chmod(file_path, 0o777)
                                    os.remove(file_path)
                                except Exception as e:
                                    _clog.warning(f"파일 삭제 실패 (무시됨): {file_path} - {e}")
                            for dir in dirs:
                                try:
                                    os.rmdir(os.path.join(root, dir))
                                except Exception as e:
                                    _clog.warning(f"디렉토리 삭제 실패 (무시됨): {dir} - {e}")
                        
                        # 루트 디렉토리 삭제 시도
                        try:
                            os.rmdir(chromadb_path)
                            directory_removed = True
                            reset_details["directory_removed"] = True
                        except Exception as e:
                            _clog.warning(f"루트 디렉토리 삭제 실패: {e}")
                except Exception as e:
                    _clog.error(f"개별 파일 삭제 중 오류: {e}")
            
            # 디렉토리 재생성
            try:
                os.makedirs(chromadb_path, exist_ok=True)
                reset_details["directory_created"] = True
                _clog.info(f"ChromaDB 디렉토리 재생성 완료: {chromadb_path}")
            except Exception as e:
                _clog.error(f"ChromaDB 디렉토리 재생성 실패: {e}")
                reset_details["directory_created"] = False
            
            # VectorService 클라이언트 재초기화
            try:
                vector_service._client = None
                _clog.info("VectorService 클라이언트 재초기화 완료")
            except Exception as e:
                _clog.warning(f"VectorService 클라이언트 재초기화 오류 (무시됨): {e}")
            
            # 결과 메시지 생성
            if reset_details["directory_removed"] and reset_details["directory_created"]:
                status = "success"
                message = "ChromaDB가 강제 삭제 후 초기화되었습니다"
            elif reset_details["directory_created"]:
                status = "partial_success"
                message = "ChromaDB 초기화가 부분적으로 완료되었습니다 (일부 파일 삭제 실패)"
            else:
                status = "warning"
                message = "ChromaDB 초기화 중 일부 문제가 발생했지만 계속 진행됩니다"
        
        return {
            "status": status,
            "message": message,
            "backup_info": backup_info,
            "reset_details": reset_details,
            "reset_at": datetime.now().isoformat(),
            "method": "file_delete",
            "recommendations": [
                "초기화 후 시스템을 재시작하는 것을 권장합니다" if not reset_details.get("directory_removed", False) else None,
                "백그라운드에서 실행 중인 다른 Python 프로세스가 있다면 종료해주세요" if not reset_details.get("connection_closed", False) else None
            ]
        }
        
    except Exception as e:
        _clog.error(f"ChromaDB 초기화 오류: {e}")
        raise HTTPException(
            status_code=500, 
            detail={
                "error": str(e),
                "reset_details": reset_details,
                "suggestion": "수동으로 ChromaDB 디렉토리를 삭제한 후 다시 시도해보세요"
            }
        )

# === 수동 프로세스 관리 ===
@router.post("/chromadb/force-stop-processes")
async def force_stop_chromadb_processes(admin_user = Depends(get_admin_user)):
    """ChromaDB 관련 프로세스를 강제로 종료합니다 (Windows 환경)"""
    try:
        stopped_processes = []
        failed_processes = []
        
        # 현재 실행 중인 모든 프로세스 검색
        for process in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                process_info = process.info
                cmdline = process_info.get('cmdline', [])
                
                # Python 프로세스 중 ChromaDB 또는 현재 프로젝트 관련 프로세스 찾기
                if (process_info['name'] == 'python.exe' and cmdline and 
                    any('chromadb' in str(cmd).lower() or 'langflow' in str(cmd).lower() or 
                        'vector' in str(cmd).lower() for cmd in cmdline)):
                    
                    try:
                        process.terminate()  # 우선 정상 종료 시도
                        process.wait(timeout=5)  # 5초 대기
                        stopped_processes.append({
                            "pid": process_info['pid'],
                            "name": process_info['name'],
                            "method": "terminate"
                        })
                    except psutil.TimeoutExpired:
                        # 5초 내에 종료되지 않으면 강제 종료
                        process.kill()
                        stopped_processes.append({
                            "pid": process_info['pid'],
                            "name": process_info['name'],
                            "method": "kill"
                        })
                    except Exception as e:
                        failed_processes.append({
                            "pid": process_info['pid'],
                            "name": process_info['name'],
                            "error": str(e)
                        })
                        
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                # 프로세스가 이미 종료되었거나 접근 권한이 없음
                continue
        
        return {
            "status": "completed",
            "message": f"{len(stopped_processes)}개 프로세스 종료, {len(failed_processes)}개 실패",
            "stopped_processes": stopped_processes,
            "failed_processes": failed_processes,
            "recommendation": "프로세스 종료 후 ChromaDB 초기화를 다시 시도해보세요"
        }
        
    except Exception as e:
        _clog.error(f"프로세스 강제 종료 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === Metadata DB 관리 ===
@router.get("/metadata/status")
async def get_metadata_db_status(admin_user = Depends(get_admin_user)):
    """메타데이터 DB 상태 조회"""
    try:
        db_paths = get_database_paths()
        metadata_path = db_paths["metadata"]["path"]
        
        if not os.path.exists(metadata_path):
            return {
                "exists": False,
                "message": "메타데이터 데이터베이스가 존재하지 않습니다"
            }
        
        with sqlite3.connect(metadata_path) as conn:
            cursor = conn.cursor()
            
            # 테이블 정보
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            # 레코드 수
            record_count = 0
            if "vector_metadata" in tables:
                cursor.execute("SELECT COUNT(*) FROM vector_metadata")
                record_count = cursor.fetchone()[0]
            
            return {
                "exists": True,
                "path": metadata_path,
                "size_formatted": format_size(get_file_size(metadata_path)),
                "tables": tables,
                "record_count": record_count,
                "last_modified": datetime.fromtimestamp(os.path.getmtime(metadata_path)).isoformat()
            }
            
    except Exception as e:
        _clog.error(f"메타데이터 DB 상태 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/metadata/backup")
async def backup_metadata_db(admin_user = Depends(get_admin_user)):
    """메타데이터 DB 백업 생성"""
    try:
        db_paths = get_database_paths()
        metadata_path = db_paths["metadata"]["path"]
        
        if not os.path.exists(metadata_path):
            raise HTTPException(status_code=404, detail="메타데이터 데이터베이스를 찾을 수 없습니다")
        
        # 백업 디렉토리 생성
        backup_dir = os.path.join(settings.DATA_DIR, "backups", "metadata")
        os.makedirs(backup_dir, exist_ok=True)
        
        # 백업 파일명
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"metadata_backup_{timestamp}.db"
        backup_path = os.path.join(backup_dir, backup_filename)
        
        shutil.copy2(metadata_path, backup_path)
        
        return {
            "status": "success",
            "message": "메타데이터 DB 백업이 완료되었습니다",
            "backup_path": backup_path,
            "backup_size": format_size(get_file_size(backup_path)),
            "created_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        _clog.error(f"메타데이터 DB 백업 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/metadata/reset")
async def reset_metadata_db(admin_user = Depends(get_admin_user)):
    """메타데이터 DB 초기화 (자동 백업 포함)"""
    backup_info = None
    try:
        # 1단계: 자동 백업 실행
        try:
            backup_result = await backup_metadata_db(admin_user)
            backup_info = {
                "backup_created": True,
                "backup_path": backup_result.get("backup_path"),
                "backup_size": backup_result.get("backup_size")
            }
            _clog.info(f"메타데이터 DB 자동 백업 완료: {backup_result.get('backup_path')}")
        except Exception as backup_error:
            _clog.warning(f"메타데이터 DB 자동 백업 실패 (초기화는 계속 진행): {backup_error}")
            backup_info = {
                "backup_created": False,
                "backup_error": str(backup_error)
            }
        
        # 2단계: 초기화 실행
        success = metadata_service.reset_database()
        
        if success:
            return {
                "status": "success",
                "message": "메타데이터 데이터베이스가 백업 후 초기화되었습니다",
                "backup_info": backup_info,
                "reset_at": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="메타데이터 데이터베이스 초기화에 실패했습니다")
            
    except Exception as e:
        _clog.error(f"메타데이터 DB 초기화 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === File Metadata DB 관리 ===
@router.get("/file_metadata/status")
async def get_file_metadata_db_status(admin_user = Depends(get_admin_user)):
    """파일 메타데이터 DB 상태 조회"""
    try:
        db_paths = get_database_paths()
        file_metadata_path = db_paths["file_metadata"]["path"]
        
        if not os.path.exists(file_metadata_path):
            return {
                "exists": False,
                "message": "파일 메타데이터 데이터베이스가 존재하지 않습니다"
            }
        
        with sqlite3.connect(file_metadata_path) as conn:
            cursor = conn.cursor()
            
            # 테이블 정보
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            # 파일 수
            file_count = 0
            if "files" in tables or "file_metadata" in tables:
                # 테이블명 확인하여 적절한 쿼리 실행
                try:
                    cursor.execute("SELECT COUNT(*) FROM files")
                    file_count = cursor.fetchone()[0]
                except:
                    try:
                        cursor.execute("SELECT COUNT(*) FROM file_metadata")
                        file_count = cursor.fetchone()[0]
                    except:
                        pass
            
            return {
                "exists": True,
                "path": file_metadata_path,
                "size_formatted": format_size(get_file_size(file_metadata_path)),
                "tables": tables,
                "file_count": file_count,
                "last_modified": datetime.fromtimestamp(os.path.getmtime(file_metadata_path)).isoformat()
            }
            
    except Exception as e:
        _clog.error(f"파일 메타데이터 DB 상태 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/file_metadata/backup")
async def backup_file_metadata_db(admin_user = Depends(get_admin_user)):
    """파일 메타데이터 DB 백업 생성"""
    try:
        db_paths = get_database_paths()
        file_metadata_path = db_paths["file_metadata"]["path"]
        
        if not os.path.exists(file_metadata_path):
            raise HTTPException(status_code=404, detail="파일 메타데이터 데이터베이스를 찾을 수 없습니다")
        
        # 백업 디렉토리 생성
        backup_dir = os.path.join(settings.DATA_DIR, "backups", "file_metadata")
        os.makedirs(backup_dir, exist_ok=True)
        
        # 백업 파일명
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"file_metadata_backup_{timestamp}.db"
        backup_path = os.path.join(backup_dir, backup_filename)
        
        shutil.copy2(file_metadata_path, backup_path)
        
        return {
            "status": "success",
            "message": "파일 메타데이터 DB 백업이 완료되었습니다",
            "backup_path": backup_path,
            "backup_size": format_size(get_file_size(backup_path)),
            "created_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        _clog.error(f"파일 메타데이터 DB 백업 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/file_metadata/reset")
async def reset_file_metadata_db(admin_user = Depends(get_admin_user)):
    """파일 메타데이터 DB 초기화 (자동 백업 포함)"""
    backup_info = None
    try:
        # 1단계: 자동 백업 실행
        try:
            backup_result = await backup_file_metadata_db(admin_user)
            backup_info = {
                "backup_created": True,
                "backup_path": backup_result.get("backup_path"),
                "backup_size": backup_result.get("backup_size")
            }
            _clog.info(f"파일 메타데이터 DB 자동 백업 완료: {backup_result.get('backup_path')}")
        except Exception as backup_error:
            _clog.warning(f"파일 메타데이터 DB 자동 백업 실패 (초기화는 계속 진행): {backup_error}")
            backup_info = {
                "backup_created": False,
                "backup_error": str(backup_error)
            }
        
        # 2단계: 초기화 실행 (데이터만 삭제, 파일은 유지)
        try:
            from ..models.vector_models import FileMetadataService
            file_service = FileMetadataService()
            
            # 데이터만 클리어 (파일은 삭제하지 않음)
            deleted_count = await file_service.clear_all_metadata()
            
            if deleted_count:
                _clog.info(f"파일 메타데이터 데이터 클리어 완료: {deleted_count}개 레코드 삭제")
            else:
                _clog.info("파일 메타데이터 데이터 클리어 완료: 삭제할 데이터 없음")
                
        except Exception as clear_error:
            _clog.error(f"파일 메타데이터 데이터 클리어 오류: {clear_error}")
            raise HTTPException(status_code=500, detail=f"데이터 클리어 실패: {clear_error}")
        
        return {
            "status": "success",
            "message": "파일 메타데이터 데이터가 백업 후 초기화되었습니다",
            "backup_info": backup_info,
            "reset_at": datetime.now().isoformat(),
            "method": "data_clear",
            "warning": "모든 파일 메타데이터 레코드가 삭제되었습니다 (데이터베이스 파일은 유지됨)"
        }
        
    except Exception as e:
        _clog.error(f"파일 메타데이터 DB 초기화 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === Users DB 관리 ===
@router.get("/users/status")
async def get_users_db_status(admin_user = Depends(get_admin_user)):
    """사용자 DB 상태 조회"""
    try:
        db_paths = get_database_paths()
        users_path = db_paths["users"]["path"]
        
        if not os.path.exists(users_path):
            return {
                "exists": False,
                "message": "사용자 데이터베이스가 존재하지 않습니다"
            }
        
        with sqlite3.connect(users_path) as conn:
            cursor = conn.cursor()
            
            # 테이블 정보
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            # 사용자 수
            user_count = 0
            if "users" in tables:
                cursor.execute("SELECT COUNT(*) FROM users")
                user_count = cursor.fetchone()[0]
            
            return {
                "exists": True,
                "path": users_path,
                "size_formatted": format_size(get_file_size(users_path)),
                "tables": tables,
                "user_count": user_count,
                "last_modified": datetime.fromtimestamp(os.path.getmtime(users_path)).isoformat()
            }
            
    except Exception as e:
        _clog.error(f"사용자 DB 상태 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/users/backup")
async def backup_users_db(admin_user = Depends(get_admin_user)):
    """사용자 DB 백업 생성"""
    try:
        db_paths = get_database_paths()
        users_path = db_paths["users"]["path"]
        
        if not os.path.exists(users_path):
            raise HTTPException(status_code=404, detail="사용자 데이터베이스를 찾을 수 없습니다")
        
        # 백업 디렉토리 생성
        backup_dir = os.path.join(settings.DATA_DIR, "backups", "users")
        os.makedirs(backup_dir, exist_ok=True)
        
        # 백업 파일명
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"users_backup_{timestamp}.db"
        backup_path = os.path.join(backup_dir, backup_filename)
        
        shutil.copy2(users_path, backup_path)
        
        return {
            "status": "success",
            "message": "사용자 DB 백업이 완료되었습니다",
            "backup_path": backup_path,
            "backup_size": format_size(get_file_size(backup_path)),
            "created_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        _clog.error(f"사용자 DB 백업 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/users/reset")
async def reset_users_db(admin_user = Depends(get_admin_user)):
    """사용자 DB 초기화 (자동 백업 포함)"""
    backup_info = None
    try:
        # 1단계: 자동 백업 실행
        try:
            backup_result = await backup_users_db(admin_user)
            backup_info = {
                "backup_created": True,
                "backup_path": backup_result.get("backup_path"),
                "backup_size": backup_result.get("backup_size")
            }
            _clog.info(f"사용자 DB 자동 백업 완료: {backup_result.get('backup_path')}")
        except Exception as backup_error:
            _clog.warning(f"사용자 DB 자동 백업 실패 (초기화는 계속 진행): {backup_error}")
            backup_info = {
                "backup_created": False,
                "backup_error": str(backup_error)
            }
        
        # 2단계: 초기화 실행
        db_paths = get_database_paths()
        users_path = db_paths["users"]["path"]
        
        if os.path.exists(users_path):
            os.remove(users_path)
        
        # 데이터베이스 재초기화
        from ..db.init_db import initialize_database
        initialize_database()
        
        return {
            "status": "success",
            "message": "사용자 데이터베이스가 백업 후 초기화되었습니다",
            "backup_info": backup_info,
            "reset_at": datetime.now().isoformat(),
            "warning": "모든 사용자 데이터가 삭제되었습니다"
        }
        
    except Exception as e:
        _clog.error(f"사용자 DB 초기화 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === 전체 백업 ===
@router.post("/backup-all")
async def backup_all_databases(admin_user = Depends(get_admin_user)):
    """모든 데이터베이스 백업"""
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_results = []
        
        # ChromaDB 백업
        try:
            chromadb_result = await backup_chromadb(admin_user)
            backup_results.append({"database": "ChromaDB", "result": chromadb_result})
        except Exception as e:
            backup_results.append({"database": "ChromaDB", "error": str(e)})
        
        # Metadata DB 백업
        try:
            metadata_result = await backup_metadata_db(admin_user)
            backup_results.append({"database": "Metadata", "result": metadata_result})
        except Exception as e:
            backup_results.append({"database": "Metadata", "error": str(e)})
        
        # File Metadata DB 백업
        try:
            file_metadata_result = await backup_file_metadata_db(admin_user)
            backup_results.append({"database": "File_Metadata", "result": file_metadata_result})
        except Exception as e:
            backup_results.append({"database": "File_Metadata", "error": str(e)})
        
        # Users DB 백업
        try:
            users_result = await backup_users_db(admin_user)
            backup_results.append({"database": "Users", "result": users_result})
        except Exception as e:
            backup_results.append({"database": "Users", "error": str(e)})
        
        success_count = len([r for r in backup_results if "result" in r])
        
        return {
            "status": "completed",
            "message": f"{success_count}개 데이터베이스 백업 완료",
            "timestamp": timestamp,
            "results": backup_results
        }
        
    except Exception as e:
        _clog.error(f"전체 데이터베이스 백업 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))