from fastapi import APIRouter, HTTPException
from ..models.schemas import ModelSettings, ModelSettingsUpdateRequest, DoclingSettings
from ..services.model_settings_service import ModelSettingsService
from ..core.logger import get_console_logger

router = APIRouter(prefix="/model-settings", tags=["model-settings"])
_clog = get_console_logger()

def get_model_settings_service_instance():
    """ModelSettingsService 인스턴스를 지연 로딩으로 가져옵니다."""
    return ModelSettingsService()

@router.get("/", response_model=ModelSettings)
async def get_model_settings():
    """모델 설정 조회"""
    try:
        settings = await get_model_settings_service_instance().get_model_settings()
        return settings
    except Exception as e:
        _clog.exception("모델 설정 조회 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/", response_model=ModelSettings)
async def update_model_settings(request: ModelSettingsUpdateRequest):
    """모델 설정 수정"""
    try:
        settings = await get_model_settings_service_instance().update_model_settings(request)
        _clog.info("모델 설정 수정됨")
        return settings
    except Exception as e:
        _clog.exception("모델 설정 수정 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reset")
async def reset_model_settings():
    """모델 설정 초기화"""
    try:
        settings = await get_model_settings_service_instance().reset_model_settings()
        _clog.info("모델 설정 초기화됨")
        return {"status": "success", "message": "모델 설정이 초기화되었습니다.", "settings": settings}
    except Exception as e:
        _clog.exception("모델 설정 초기화 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/providers")
async def get_available_providers():
    """사용 가능한 모델 제공업체 목록 조회"""
    try:
        providers = await get_model_settings_service_instance().get_available_providers()
        return providers
    except Exception as e:
        _clog.exception("모델 제공업체 목록 조회 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/{provider}")
async def get_models_by_provider(provider: str):
    """특정 제공업체의 모델 목록 조회"""
    try:
        models = await get_model_settings_service_instance().get_models_by_provider(provider)
        return models
    except Exception as e:
        _clog.exception(f"{provider} 모델 목록 조회 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test")
async def test_model_settings():
    """현재 모델 설정으로 연결 테스트"""
    try:
        result = await get_model_settings_service_instance().test_model_connection()
        return result
    except Exception as e:
        _clog.exception("모델 연결 테스트 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

# Docling 관련 엔드포인트
@router.get("/docling", response_model=DoclingSettings)
async def get_docling_settings():
    """Docling 설정 조회"""
    try:
        settings = await get_model_settings_service_instance().get_docling_settings()
        return settings
    except Exception as e:
        _clog.exception("Docling 설정 조회 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/docling", response_model=DoclingSettings)
async def update_docling_settings(settings: DoclingSettings):
    """Docling 설정 수정"""
    try:
        updated_settings = await get_model_settings_service_instance().update_docling_settings(settings)
        _clog.info("Docling 설정 수정됨")
        return updated_settings
    except Exception as e:
        _clog.exception("Docling 설정 수정 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/docling/status")
async def get_docling_status():
    """Docling 서비스 상태 확인"""
    try:
        status = await get_model_settings_service_instance().get_docling_status()
        return status
    except Exception as e:
        _clog.exception("Docling 상태 확인 중 오류")
        raise HTTPException(status_code=500, detail=str(e))