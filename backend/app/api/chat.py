from fastapi import APIRouter, HTTPException, Body, Depends, Request, Cookie
from ..models.schemas import ChatRequest, ChatResponse
from ..services.chat_service import ChatService
from ..services.user_service import UserService
from ..services import get_category_service
from ..models.user_models import user_db
from typing import Optional, List
import time
import sqlite3
import os
from ..core.logger import get_user_logger, get_console_logger
from ..core.config import settings

router = APIRouter(prefix="/chat", tags=["chat"])

# 서비스 인스턴스 생성
chat_service = ChatService()
user_service = UserService()
_ulog = get_user_logger()
_clog = get_console_logger()

def log_chat_history(request: ChatRequest, response: ChatResponse, user_id: Optional[str], session_id: Optional[str]):
    """
    채팅 기록을 데이터베이스에 로깅합니다.
    """
    db_path = os.path.join(settings.DATA_DIR, "users.db")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # category_ids 리스트를 문자열로 변환
        category_str = ",".join(request.category_ids) if request.category_ids else None
        
        # 테이블 구조 확인을 위한 디버깅
        cursor.execute("PRAGMA table_info(chat_history)")
        columns = cursor.fetchall()
        print(f"chat_history 테이블 컬럼 구조: {columns}")
        
        # INSERT할 데이터 확인
        insert_data = (
            session_id,
            request.message,
            response.response,
            category_str,
            response.confidence,
            None,  # 초기 피드백은 없음
            user_id,
            request.flow_id,
            response.processing_time
        )
        print(f"INSERT할 데이터 개수: {len(insert_data)}")
        print(f"INSERT 데이터: {insert_data}")

        cursor.execute("""
            INSERT INTO chat_history (session_id, query, response, category, relevance_score, feedback, user_id, flow_id, response_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, insert_data)
        conn.commit()
        print("채팅 기록이 성공적으로 저장되었습니다.")
    except sqlite3.Error as e:
        print(f"채팅 기록 저장 실패: {e}")
    finally:
        if conn:
            conn.close()

# Authentication dependency (same as users.py)
async def get_current_user(session_id: Optional[str] = Cookie(None)):
    """Get current user from session"""
    if not session_id:
        return None
    
    session = user_db.get_session(session_id)
    if not session:
        return None
    
    return session

# Admin authentication dependency (same as users.py)
async def get_admin_user(current_user = Depends(get_current_user)):
    """Get current admin user"""
    if not current_user:
        raise HTTPException(
            status_code=401,
            detail="로그인이 필요합니다."
        )
    
    if current_user.get('role') != 'admin':
        raise HTTPException(
            status_code=403,
            detail="관리자 권한이 필요합니다."
        )
    
    return current_user

async def get_current_user_optional(session_id: Optional[str] = Cookie(None)):
    """현재 로그인한 사용자 정보를 가져옵니다. (선택적)"""
    try:
        if not session_id:
            return None
        
        session = user_db.get_session(session_id)
        return session
    except Exception as e:
        print(f"사용자 인증 오류 (선택적): {str(e)}")
        return None

@router.post("/", response_model=ChatResponse)
async def chat_endpoint(req_body: ChatRequest, http_request: Request, current_user = Depends(get_current_user_optional)):
    """사용자 질문에 대한 RAG 응답 (선택적 인증)"""
    try:
        _clog.debug("채팅 API 요청", extra={"event": "chat_request"})
        user_id = current_user['user_id'] if current_user else None
        session_id = http_request.cookies.get("session_id")
        
        _clog.debug(
            "요청 메타",
            extra={
                "event": "chat_request_meta",
                "user_id": user_id,
                "session_id": session_id,
                "category_ids": ",".join(req_body.category_ids) if req_body.category_ids else None,
                "flow_id": req_body.flow_id,
            },
        )
        
        # 사용자 ID를 요청에 추가 (익명 사용자는 None)
        req_body.user_id = user_id
        
        response = await chat_service.process_chat(req_body)
        
        # 채팅 기록 로깅
        log_chat_history(req_body, response, user_id, session_id)
        _ulog.info(
            "채팅 처리 완료",
            extra={
                "event": "chat_processed",
                "user_id": user_id,
                "session_id": session_id,
                "flow_id": req_body.flow_id,
            },
        )
        
        _clog.debug(
            "채팅 API 응답",
            extra={
                "event": "chat_response",
                "response_length": len(response.response),
                "sources_count": len(response.sources),
                "processing_time": response.processing_time,
            },
        )
        
        return response
        
    except HTTPException:
        # HTTPException은 그대로 전달
        raise
    except Exception as e:
        _clog.exception("채팅 API 오류", extra={"event": "chat_error"})
        
        # 상세 오류 정보 로깅
        error_detail = str(e)
        if hasattr(e, '__class__'):
            error_detail = f"{e.__class__.__name__}: {str(e)}"
            
        raise HTTPException(
            status_code=500, 
            detail={
                "error": "채팅 처리 중 오류가 발생했습니다",
                "detail": error_detail,
                "timestamp": time.time()
            }
        )

@router.post("/simple")
async def simple_chat(
    message: str = Body(..., embed=True),
    category_ids: Optional[List[str]] = Body(None, embed=True),
    flow_id: Optional[str] = Body(None, embed=True),
    current_user = Depends(get_current_user_optional)
):
    """간단한 채팅 요청 (JSON 바디에서 직접 파라미터 추출) - 선택적 인증"""
    try:
        request = ChatRequest(
            message=message,
            category_ids=category_ids or [],
            categories=[],
            flow_id=flow_id,
            user_id=current_user['user_id'] if current_user else None
        )
        
        response = await chat_service.process_chat(request)
        
        return {
            "message": response.response,
            "sources": response.sources,
            "processing_time": response.processing_time,
            "confidence": response.confidence
        }
        
    except Exception as e:
        print(f"간단 채팅 API 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/flow/{flow_id}")
async def chat_with_flow(flow_id: str, request: ChatRequest, current_user = Depends(get_current_user_optional)):
    """특정 Flow를 사용한 채팅 - 선택적 인증"""
    try:
        # Flow ID와 사용자 ID를 요청에 설정
        request.flow_id = flow_id
        request.user_id = current_user['user_id'] if current_user else None
        response = await chat_service.process_chat(request)
        
        return {
            "message": response.response,
            "sources": response.sources,
            "processing_time": response.processing_time,
            "confidence": response.confidence
        }
        
    except Exception as e:
        print(f"Flow 채팅 API 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/flows/")
async def get_available_search_flows():
    """사용 가능한 검색 Flow 목록을 조회합니다."""
    try:
        flows = await chat_service.langflow_service.get_available_flows_by_type("search")
        
        # 기본 검색 Flow ID 확인
        default_flow_id = await chat_service._get_default_search_flow()
        
        # 각 Flow에 기본 여부 표시
        for flow in flows:
            flow["is_default"] = flow["flow_id"] == default_flow_id
        
        return {
            "flows": flows,
            "default_flow_id": default_flow_id,
            "total_flows": len(flows)
        }
        
    except Exception as e:
        print(f"검색 Flow 목록 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/")
async def get_chat_status():
    """채팅 시스템 상태를 조회합니다."""
    try:
        # 기본 검색 Flow 확인
        default_search_flow = await chat_service._get_default_search_flow()
        
        # OpenAI API 키 확인
        openai_configured = chat_service.openai_client is not None
        
        # 벡터화된 파일 수 확인
        all_files = await chat_service.file_service.list_files()
        vectorized_files_count = len([f for f in all_files if f.vectorized])
        total_files_count = len(all_files)
        
        return {
            "chat_ready": bool(default_search_flow and (openai_configured or vectorized_files_count > 0)),
            "default_search_flow_id": default_search_flow,
            "openai_configured": openai_configured,
            "vectorized_files": vectorized_files_count,
            "total_files": total_files_count,
            "vectorization_rate": round(vectorized_files_count / total_files_count * 100, 1) if total_files_count > 0 else 0
        }
        
    except Exception as e:
        print(f"채팅 상태 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test")
async def test_chat():
    """채팅 시스템 테스트"""
    try:
        test_request = ChatRequest(
            message="테스트 질문입니다. 업로드된 문서에 대해 알려주세요.",
            category_ids=[],
            categories=[],
            flow_id=None
        )
        
        response = await chat_service.process_chat(test_request)
        
        return {
            "test_result": "success",
            "response_length": len(response.response),
            "sources_count": len(response.sources),
            "processing_time": response.processing_time,
            "sample_response": response.response[:200] + "..." if len(response.response) > 200 else response.response
        }
        
    except Exception as e:
        print(f"채팅 테스트 오류: {str(e)}")
        return {
            "test_result": "failed",
            "error": str(e)
        }

@router.get("/history/")
async def get_chat_history(
    user_id: Optional[str] = None, 
    limit: int = 50,
    current_user = Depends(get_current_user)  # 히스토리는 로그인 필수
):
    """사용자별 채팅 히스토리 조회 (로그인 필수)"""
    try:
        # 로그인 확인
        if not current_user:
            raise HTTPException(status_code=401, detail="로그인이 필요합니다")
        
        # 로그인한 사용자의 히스토리만 조회
        user_id = current_user['user_id']
        
        history = await chat_service.get_chat_history(user_id, limit)
        
        return {
            "history": history,
            "user_id": user_id,
            "limit": limit
        }
        
    except Exception as e:
        print(f"채팅 히스토리 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/history")
async def save_chat_history(
    user_id: str = Body(...),
    user_message: dict = Body(...),
    assistant_message: dict = Body(...),
    current_user = Depends(get_current_user)  # 히스토리 저장은 로그인 필수
):
    """채팅 히스토리 저장 (로그인 필수)"""
    try:
        # 로그인 확인
        if not current_user:
            raise HTTPException(status_code=401, detail="로그인이 필요합니다")
        
        # 로그인한 사용자의 히스토리만 저장
        user_id = current_user['user_id']
        
        success = await chat_service.save_chat_history(
            user_id, 
            user_message, 
            assistant_message
        )
        
        if success:
            return {
                "message": "채팅 히스토리가 성공적으로 저장되었습니다.",
                "user_id": user_id
            }
        else:
            raise HTTPException(status_code=500, detail="채팅 히스토리 저장에 실패했습니다.")
        
    except Exception as e:
        print(f"채팅 히스토리 저장 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/history")
async def get_admin_chat_history(
    page: int = 1,
    limit: int = 50,
    user_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    admin_user = Depends(get_admin_user)
):
    """관리자용 채팅 기록 전체 조회"""
    try:
        # 관리자 권한은 get_admin_user에서 이미 확인됨
        
        db_path = os.path.join(settings.DATA_DIR, "users.db")
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # 기본 쿼리
            base_query = """
                SELECT 
                    ch.id,
                    ch.session_id,
                    ch.query,
                    ch.response,
                    ch.category,
                    ch.relevance_score,
                    ch.feedback,
                    ch.user_id,
                    ch.flow_id,
                    ch.response_time,
                    ch.timestamp,
                    u.username,
                    u.email
                FROM chat_history ch
                LEFT JOIN users u ON ch.user_id = u.user_id
                WHERE 1=1
            """
            
            # 필터 조건 추가
            conditions = []
            params = []
            
            if user_id:
                conditions.append("ch.user_id = ?")
                params.append(user_id)
            
            if start_date:
                conditions.append("DATE(ch.timestamp) >= ?")
                params.append(start_date)
            
            if end_date:
                conditions.append("DATE(ch.timestamp) <= ?")
                params.append(end_date)
            
            if search:
                conditions.append("(ch.query LIKE ? OR ch.response LIKE ?)")
                params.extend([f"%{search}%", f"%{search}%"])
            
            if conditions:
                base_query += " AND " + " AND ".join(conditions)
            
            # 전체 개수 조회
            count_query = f"SELECT COUNT(*) FROM ({base_query}) as filtered"
            cursor.execute(count_query, params)
            total_count = cursor.fetchone()[0]
            
            # 페이징 처리
            offset = (page - 1) * limit
            final_query = f"{base_query} ORDER BY ch.timestamp DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            
            cursor.execute(final_query, params)
            rows = cursor.fetchall()
            
            # 결과 포맷팅
            history = []
            for row in rows:
                history.append({
                    "id": row[0],
                    "session_id": row[1],
                    "query": row[2],
                    "response": row[3][:500] + "..." if len(row[3]) > 500 else row[3],  # 응답 길이 제한
                    "category": row[4],
                    "relevance_score": row[5],
                    "feedback": row[6],
                    "user_id": row[7],
                    "flow_id": row[8],
                    "response_time": row[9],
                    "created_at": row[10],
                    "username": row[11] or "익명 사용자",
                    "email": row[12] or ""
                })
            
            return {
                "history": history,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "total_pages": (total_count + limit - 1) // limit
                },
                "filters": {
                    "user_id": user_id,
                    "start_date": start_date,
                    "end_date": end_date,
                    "search": search
                }
            }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"관리자 채팅 기록 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/history/stats")
async def get_chat_history_stats(
    admin_user = Depends(get_admin_user)
):
    """관리자용 채팅 통계 조회"""
    try:
        # 관리자 권한은 get_admin_user에서 이미 확인됨
        
        db_path = os.path.join(settings.DATA_DIR, "users.db")
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # 전체 채팅 수
            cursor.execute("SELECT COUNT(*) FROM chat_history")
            total_chats = cursor.fetchone()[0]
            
            # 오늘 채팅 수
            cursor.execute("SELECT COUNT(*) FROM chat_history WHERE DATE(timestamp) = DATE('now')")
            today_chats = cursor.fetchone()[0]
            
            # 이번 주 채팅 수
            cursor.execute("""
                SELECT COUNT(*) FROM chat_history 
                WHERE DATE(timestamp) >= DATE('now', 'weekday 0', '-6 days')
            """)
            week_chats = cursor.fetchone()[0]
            
            # 활성 사용자 수 (최근 30일)
            cursor.execute("""
                SELECT COUNT(DISTINCT user_id) FROM chat_history 
                WHERE user_id IS NOT NULL 
                AND timestamp >= datetime('now', '-30 days')
            """)
            active_users = cursor.fetchone()[0]
            
            # 평균 응답 시간
            cursor.execute("SELECT AVG(response_time) FROM chat_history WHERE response_time IS NOT NULL")
            avg_response_time = cursor.fetchone()[0] or 0
            
            # 카테고리별 통계
            cursor.execute("""
                SELECT category, COUNT(*) as count 
                FROM chat_history 
                WHERE category IS NOT NULL AND category != ''
                GROUP BY category 
                ORDER BY count DESC 
                LIMIT 10
            """)
            category_stats = [{"category": row[0], "count": row[1]} for row in cursor.fetchall()]
            
            # 최근 7일간 일별 채팅 수
            cursor.execute("""
                SELECT DATE(timestamp) as date, COUNT(*) as count
                FROM chat_history 
                WHERE timestamp >= datetime('now', '-7 days')
                GROUP BY DATE(timestamp)
                ORDER BY date DESC
            """)
            daily_stats = [{"date": row[0], "count": row[1]} for row in cursor.fetchall()]
            
            return {
                "total_chats": total_chats,
                "today_chats": today_chats,
                "week_chats": week_chats,
                "active_users": active_users,
                "avg_response_time": round(avg_response_time, 2),
                "category_stats": category_stats,
                "daily_stats": daily_stats
            }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"채팅 통계 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/admin/history/{history_id}")
async def delete_chat_history(
    history_id: int,
    admin_user = Depends(get_admin_user)
):
    """관리자용 채팅 기록 삭제"""
    try:
        # 관리자 권한은 get_admin_user에서 이미 확인됨
        
        db_path = os.path.join(settings.DATA_DIR, "users.db")
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # 기록 존재 확인
            cursor.execute("SELECT id FROM chat_history WHERE id = ?", (history_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="채팅 기록을 찾을 수 없습니다")
            
            # 삭제
            cursor.execute("DELETE FROM chat_history WHERE id = ?", (history_id,))
            conn.commit()
            
            return {"message": f"채팅 기록 {history_id}이(가) 삭제되었습니다"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"채팅 기록 삭제 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 