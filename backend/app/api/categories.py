from fastapi import APIRouter, HTTPException
from ..models.schemas import Category, CategoryRequest, CategoryStats
from ..services import get_category_service
from typing import List, Dict, Any
from ..core.logger import get_console_logger

router = APIRouter(prefix="/categories", tags=["categories"])

_log = get_console_logger()

# 서비스 인스턴스는 싱글톤으로 처리

@router.post("/", response_model=Category)
async def create_category(request: CategoryRequest):
    """새 카테고리 생성"""
    try:
        category_service = get_category_service()
        category = await category_service.create_category(request)
        return category
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[Category])
async def list_categories():
    """모든 카테고리 목록 조회"""
    try:
        category_service = get_category_service()
        categories = await category_service.list_categories()
        _log.info("카테고리 목록 조회", extra={"event": "categories_list", "count": len(categories)})
        return categories
    except Exception as e:
        _log.exception("카테고리 목록 API 오류", extra={"event": "categories_list_error"})
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/", response_model=Dict[str, Any])
async def get_category_stats():
    """카테고리별 통계 정보"""
    try:
        category_service = get_category_service()
        stats = await category_service.get_category_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{category_id}", response_model=Category)
async def get_category(category_id: str):
    """특정 카테고리 조회"""
    try:
        category_service = get_category_service()
        category = await category_service.get_category(category_id)
        if not category:
            raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
        return category
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{category_id}", response_model=Category)
async def update_category(category_id: str, request: CategoryRequest):
    """카테고리 업데이트"""
    try:
        category_service = get_category_service()
        category = await category_service.update_category(category_id, request)
        if not category:
            raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
        return category
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{category_id}")
async def delete_category(category_id: str):
    """카테고리 삭제"""
    try:
        category_service = get_category_service()
        success = await category_service.delete_category(category_id)
        if not success:
            raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
        return {"message": "카테고리가 성공적으로 삭제되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/name/{name}", response_model=Category)
async def get_category_by_name(name: str):
    """이름으로 카테고리 검색"""
    try:
        category_service = get_category_service()
        category = await category_service.get_category_by_name(name)
        if not category:
            raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
        return category
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))