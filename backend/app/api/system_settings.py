from fastapi import APIRouter, HTTPException
from ..models.schemas import SystemSettings, SystemSettingsUpdateRequest
from ..services.system_settings_service import SystemSettingsService
from ..core.logger import get_console_logger

router = APIRouter(prefix="/system-settings", tags=["system-settings"])
_clog = get_console_logger()

def get_system_settings_service_instance():
    """SystemSettingsService 인스턴스를 지연 로딩으로 가져옵니다."""
    return SystemSettingsService()

@router.get("/", response_model=SystemSettings)
async def get_system_settings():
    """시스템 설정 조회"""
    try:
        settings = await get_system_settings_service_instance().get_settings()
        return settings
    except Exception as e:
        _clog.exception("시스템 설정 조회 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/", response_model=SystemSettings)
async def update_system_settings(request: SystemSettingsUpdateRequest):
    """시스템 설정 수정"""
    try:
        settings = await get_system_settings_service_instance().update_settings(request)
        _clog.info("시스템 설정 수정됨")
        return settings
    except Exception as e:
        _clog.exception("시스템 설정 수정 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reset")
async def reset_system_settings():
    """시스템 설정 초기화"""
    try:
        settings = await get_system_settings_service_instance().reset_settings()
        _clog.info("시스템 설정 초기화됨")
        return settings
    except Exception as e:
        _clog.exception("시스템 설정 초기화 중 오류")
        raise HTTPException(status_code=500, detail=str(e))