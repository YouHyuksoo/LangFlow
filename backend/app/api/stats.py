from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from datetime import datetime, timedelta
import sqlite3
import os
from ..core.config import settings
from ..services.category_service import CategoryService
import pandas as pd

router = APIRouter(prefix="/stats", tags=["stats"])
DB_PATH = os.path.join(settings.DATA_DIR, "users.db")

def get_db_connection():
    """데이터베이스 연결을 반환합니다."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _get_sqlite_db_status() -> Dict[str, Any]:
    """users.db의 상태를 확인합니다."""
    status = {
        "db_available": False,
        "table_found": False,
        "message": "데이터베이스를 확인할 수 없습니다.",
        "error": None,
    }
    if not os.path.exists(DB_PATH):
        status["message"] = "users.db 파일이 존재하지 않습니다."
        status["error"] = "Database file not found."
        return status

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        status["db_available"] = True
        
        # chat_history 테이블이 없어도 정상으로 처리
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_history'")
        if cursor.fetchone():
            status["table_found"] = True
            status["message"] = "SQLite DB가 정상적으로 연결되었습니다."
        else:
            status["message"] = "SQLite DB가 정상적으로 연결되었습니다. (chat_history 테이블 없음)"
            status["error"] = None  # 오류가 아님
        conn.close()
    except sqlite3.Error as e:
        status["message"] = "SQLite DB 연결에 실패했습니다."
        status["error"] = str(e)
    return status

@router.get("/dashboard/")
async def get_dashboard_stats() -> Dict[str, Any]:
    """관리자 대시보드 통계 데이터"""
    try:
        # 데이터베이스에서 모든 채팅 기록을 한 번에 로드
        df = pd.DataFrame()  # 빈 DataFrame으로 초기화
        
        try:
            conn = get_db_connection()
            # chat_history 테이블이 존재하는지 확인
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_history'")
            if cursor.fetchone():
                df = pd.read_sql_query("SELECT * FROM chat_history", conn)
                # timestamp를 datetime 객체로 변환
                if not df.empty:
                    df['timestamp'] = pd.to_datetime(df['timestamp'])
            conn.close()
        except Exception as db_error:
            print(f"데이터베이스 연결 오류 (무시됨): {str(db_error)}")
            # 데이터베이스 오류가 있어도 계속 진행

        # 파일 및 카테고리 통계
        file_stats = await _get_file_stats()
        category_service = CategoryService()
        categories = await category_service.list_categories()
        sqlite_status = _get_sqlite_db_status()

        stats = {
            "system": {
                "total_files": file_stats['total_files'],
                "vectorized_files": file_stats['vectorized_files'],
                "total_categories": len(categories),
                "sqlite_status": sqlite_status,
            },
            "usage": _get_usage_stats(df),
            "performance": _get_performance_stats(df, file_stats['total_vectors']),
            "categories": _get_category_stats(df, categories),
            "recent_activity": _get_recent_activity(df, file_stats['recent_uploads'])
        }
        
        return {
            "success": True,
            "data": stats,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"통계 데이터 로드 실패: {str(e)}")

async def _get_file_stats() -> Dict[str, Any]:
    """파일 및 벡터 통계를 가져옵니다."""
    total_files = 0
    vectorized_files = 0
    total_vectors = 0
    recent_uploads = []
    
    try:
        # ChromaDB 상태에서 벡터 수 가져오기
        from ..services.vector_service import VectorService
        vector_service = VectorService()
        chroma_status = await vector_service.get_status()
        total_vectors = chroma_status.get('total_vectors', 0)

        # 파일 메타데이터에서 파일 수 및 최근 업로드 가져오기
        from ..services.file_service import FileService
        file_service = FileService()
        files = await file_service.list_files()
        
        total_files = len(files)
        vectorized_files = sum(1 for f in files if f.vectorized)
        
        # 최근 업로드된 파일 5개
        sorted_files = sorted(files, key=lambda x: x.upload_time, reverse=True)[:5]
        recent_uploads = [
            {"filename": f.filename, "upload_time": f.upload_time.isoformat()}
            for f in sorted_files
        ]
    except Exception as e:
        print(f"파일 통계 로드 오류: {str(e)}")

    return {
        "total_files": total_files,
        "vectorized_files": vectorized_files,
        "total_vectors": total_vectors,
        "recent_uploads": recent_uploads
    }

def _get_usage_stats(df: pd.DataFrame) -> Dict[str, Any]:
    """DataFrame을 기반으로 사용량 통계를 계산합니다."""
    if df.empty:
        return {
            "daily_questions": {"today": 0, "yesterday": 0, "this_week": 0, "last_week": 0, "this_month": 0, "last_month": 0},
            "category_searches": {}, "avg_relevance": 0,
            "feedback_stats": {"likes": 0, "dislikes": 0, "like_ratio": 0}
        }

    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    this_week_start = today_start - timedelta(days=now.weekday())
    last_week_start = this_week_start - timedelta(weeks=1)
    this_month_start = today_start.replace(day=1)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)

    daily_questions = {
        "today": len(df[df['timestamp'] >= today_start]),
        "yesterday": len(df[(df['timestamp'] >= yesterday_start) & (df['timestamp'] < today_start)]),
        "this_week": len(df[df['timestamp'] >= this_week_start]),
        "last_week": len(df[(df['timestamp'] >= last_week_start) & (df['timestamp'] < this_week_start)]),
        "this_month": len(df[df['timestamp'] >= this_month_start]),
        "last_month": len(df[(df['timestamp'] >= last_month_start) & (df['timestamp'] < this_month_start)])
    }

    # 카테고리별 검색 (쉼표로 구분된 문자열 처리)
    df_categories = df.dropna(subset=['category'])
    all_categories = df_categories['category'].str.split(',').explode()
    category_searches = all_categories.value_counts().to_dict()

    avg_relevance = round(df['relevance_score'].mean() * 100, 2) if not df['relevance_score'].isnull().all() else 0
    
    likes = len(df[df['feedback'] == 'like'])
    dislikes = len(df[df['feedback'] == 'dislike'])
    like_ratio = round((likes / (likes + dislikes)) * 100, 2) if (likes + dislikes) > 0 else 0

    return {
        "daily_questions": daily_questions,
        "category_searches": category_searches,
        "avg_relevance": avg_relevance,
        "feedback_stats": {"likes": likes, "dislikes": dislikes, "like_ratio": like_ratio}
    }

def _get_performance_stats(df: pd.DataFrame, total_vectors: int) -> Dict[str, Any]:
    """성능 통계를 계산합니다."""
    avg_response_time = round(df['response_time'].mean(), 2) if not df.empty and not df['response_time'].isnull().all() else 0
    
    return {
        "avg_response_time": avg_response_time,
        "system_usage": {"cpu_avg": 0, "memory_avg": 0}, # psutil 등으로 실제 구현 필요
        "vector_performance": {"total_vectors": total_vectors}
    }

def _get_category_stats(df: pd.DataFrame, categories: List[Any]) -> Dict[str, Any]:
    """카테고리별 통계를 계산합니다."""
    print(f"=== _get_category_stats 시작 ===")
    print(f"전달받은 categories 개수: {len(categories)}")
    
    # 검색 통계 계산
    category_search_counts = {}
    if not df.empty:
        df_categories = df.dropna(subset=['category'])
        all_categories = df_categories['category'].str.split(',').explode()
        category_search_counts = all_categories.value_counts().to_dict()

    # 각 카테고리의 파일 수 계산
    category_stats = []
    categories_with_files = 0
    
    try:
        # 직접 파일 메타데이터 읽기 (비동기 없이)
        import json
        metadata_file = os.path.join(settings.DATA_DIR, "files_metadata.json")
        all_files = []
        
        print(f"파일 메타데이터 경로: {metadata_file}")
        
        if os.path.exists(metadata_file):
            with open(metadata_file, 'r', encoding='utf-8') as f:
                files_data = json.load(f)
                print(f"전체 파일 데이터 개수: {len(files_data)}")
                
                # files_data는 {file_id: file_info} 형태이므로 값들만 추출
                for file_id, file_info in files_data.items():
                    # 삭제된 파일은 제외
                    if file_info.get('status') != 'deleted':
                        all_files.append(file_info)
                        print(f"파일 추가: {file_info.get('filename')} - 카테고리 ID: {file_info.get('category_id')}")
                
                print(f"삭제되지 않은 파일 수: {len(all_files)}")
        else:
            print("파일 메타데이터 파일이 존재하지 않습니다.")
        
        # 카테고리별 파일 수 계산
        print(f"전체 카테고리 수: {len(categories)}")
        for category in categories:
            # 해당 카테고리에 속한 파일 수 계산
            file_count = sum(1 for f in all_files if f.get('category_id') == category.category_id)
            search_count = category_search_counts.get(category.name, 0)
            
            print(f"카테고리 '{category.name}' (ID: {category.category_id}): 파일 {file_count}개, 검색 {search_count}회")
            
            if file_count > 0:
                categories_with_files += 1
            
            category_stats.append({
                "name": category.name,
                "file_count": file_count,
                "search_count": search_count,
                "icon": category.icon,
                "color": category.color
            })
        
        print(f"파일이 있는 카테고리 수: {categories_with_files}")
        print(f"최종 카테고리 통계 개수: {len(category_stats)}")
            
    except Exception as e:
        print(f"카테고리 파일 통계 계산 오류: {str(e)}")
        # 오류 발생 시 기본값 사용
        for category in categories:
            search_count = category_search_counts.get(category.name, 0)
            category_stats.append({
                "name": category.name,
                "file_count": 0,
                "search_count": search_count,
                "icon": category.icon,
                "color": category.color
            })
    
    most_used = max(category_stats, key=lambda x: x['search_count']) if category_stats else None

    return {
        "categories": category_stats,
        "total_categories": len(categories),
        "categories_with_files": categories_with_files,
        "most_used_category": most_used
    }

def _get_recent_activity(df: pd.DataFrame, recent_uploads: List[Dict]) -> Dict[str, Any]:
    """최근 활동을 가져옵니다."""
    recent_searches = []
    if not df.empty:
        recent_df = df.sort_values(by='timestamp', ascending=False).head(5)
        recent_searches = [
            {"query": row['query'], "time": row['timestamp'].isoformat()}
            for index, row in recent_df.iterrows()
        ]
        
    return {
        "recent_uploads": recent_uploads,
        "recent_searches": recent_searches,
    }

 