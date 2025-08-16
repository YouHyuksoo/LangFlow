from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional
import os
import sqlite3
import shutil
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
            "path": os.path.join(data_dir, "vectors"),
            "type": "directory",
            "description": "ChromaDB 벡터 데이터베이스"
        },
        "metadata": {
            "path": os.path.join(data_dir, "vectors", "metadata.db"),
            "type": "file", 
            "description": "벡터 메타데이터 SQLite 데이터베이스"
        },
        "users": {
            "path": os.path.join(data_dir, "users.db"),
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
    """ChromaDB 초기화 (자동 백업 포함)"""
    backup_info = None
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
        
        # 2단계: 초기화 실행
        db_paths = get_database_paths()
        chromadb_path = db_paths["chromadb"]["path"]
        
        if os.path.exists(chromadb_path):
            shutil.rmtree(chromadb_path)
        
        # 디렉토리 재생성
        os.makedirs(chromadb_path, exist_ok=True)
        
        # VectorService 클라이언트 재초기화
        vector_service._client = None
        
        return {
            "status": "success",
            "message": "ChromaDB가 백업 후 초기화되었습니다",
            "backup_info": backup_info,
            "reset_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        _clog.error(f"ChromaDB 초기화 오류: {e}")
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