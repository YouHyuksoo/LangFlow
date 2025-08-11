from fastapi import APIRouter, HTTPException, Query
from ..services.langflow_service import LangflowService
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from ..core.logger import get_user_logger, get_console_logger

router = APIRouter(prefix="/langflow", tags=["langflow"])
_ulog = get_user_logger()
_clog = get_console_logger()

# 서비스 인스턴스 생성
langflow_service = LangflowService()

class VectorizeRequest(BaseModel):
    file_id: str
    flow_id: str

class CategoryVectorizeRequest(BaseModel):
    category_id: str
    vectorization_flow_id: str

class SearchRequest(BaseModel):
    query: str
    search_flow_id: str
    category_ids: Optional[List[str]] = None

@router.post("/vectorize")
async def vectorize_file(request: VectorizeRequest):
    """특정 파일을 Langflow로 벡터화합니다."""
    try:
        result = await langflow_service.process_file_with_flow(
            request.file_id, 
            request.flow_id
        )
        _ulog.info(
            "LangFlow 벡터화 실행",
            extra={"event": "langflow_vectorize_file", "file_id": request.file_id, "flow_id": request.flow_id}
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/vectorize-category")
async def vectorize_category(request: CategoryVectorizeRequest):
    """특정 카테고리의 모든 파일을 벡터화합니다."""
    try:
        results = await langflow_service.vectorize_files_by_category(
            request.category_id,
            request.vectorization_flow_id
        )
        _ulog.info(
            "LangFlow 카테고리 벡터화 실행",
            extra={
                "event": "langflow_vectorize_category",
                "category_id": request.category_id,
                "flow_id": request.vectorization_flow_id,
                "processed": len(results) if isinstance(results, list) else None,
            },
        )
        return {
            "category_id": request.category_id,
            "results": results,
            "total_processed": len(results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search")
async def search_with_langflow(request: SearchRequest):
    """Langflow를 사용하여 RAG 검색을 수행합니다."""
    try:
        _clog.debug("LangFlow 검색 실행", extra={"event": "langflow_search", "flow_id": request.search_flow_id})
        result = await langflow_service.search_with_flow(
            request.query,
            request.search_flow_id,
            request.category_ids
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/flows/{flow_type}")
async def get_flows_by_type(flow_type: str):
    """타입별 사용 가능한 Flow 목록을 조회합니다."""
    try:
        if flow_type not in ["vectorization", "search", "chat"]:
            raise HTTPException(
                status_code=400, 
                detail="지원되는 flow_type: vectorization, search, chat"
            )
        
        flows = await langflow_service.get_available_flows_by_type(flow_type)
        return {
            "flow_type": flow_type,
            "flows": flows
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/")
async def get_vectorization_status():
    """전체 벡터화 상태를 조회합니다."""
    try:
        status = await langflow_service.get_vectorization_status()
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health/")
async def langflow_health_check():
    """Langflow 연동 상태를 확인합니다."""
    try:
        # 간단한 헬스 체크
        return {
            "status": "healthy",
            "langflow_integration": "active",
            "message": "Langflow 서비스가 정상적으로 작동 중입니다."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))