from fastapi import APIRouter, HTTPException
from typing import List
from ..models.schemas import Persona, PersonaCreateRequest
from ..services.persona_service import PersonaService
from ..core.logger import get_console_logger

router = APIRouter(prefix="/personas", tags=["personas"])
_clog = get_console_logger()

def get_persona_service_instance():
    """PersonaService 인스턴스를 지연 로딩으로 가져옵니다."""
    return PersonaService()

@router.get("/", response_model=List[Persona])
async def list_personas():
    """페르소나 목록 조회"""
    try:
        personas = await get_persona_service_instance().list_personas()
        return personas
    except Exception as e:
        _clog.exception("페르소나 목록 조회 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{persona_id}", response_model=Persona)
async def get_persona(persona_id: str):
    """특정 페르소나 조회"""
    try:
        persona = await get_persona_service_instance().get_persona(persona_id)
        if not persona:
            raise HTTPException(status_code=404, detail="페르소나를 찾을 수 없습니다.")
        return persona
    except HTTPException:
        raise
    except Exception as e:
        _clog.exception("페르소나 조회 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=Persona)
async def create_persona(request: PersonaCreateRequest):
    """새 페르소나 생성"""
    try:
        persona = await get_persona_service_instance().create_persona(request)
        _clog.info(f"페르소나 생성됨: {persona.name}")
        return persona
    except Exception as e:
        _clog.exception("페르소나 생성 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{persona_id}", response_model=Persona)
async def update_persona(persona_id: str, request: PersonaCreateRequest):
    """페르소나 수정"""
    try:
        persona = await get_persona_service_instance().update_persona(persona_id, request)
        if not persona:
            raise HTTPException(status_code=404, detail="페르소나를 찾을 수 없습니다.")
        _clog.info(f"페르소나 수정됨: {persona.name}")
        return persona
    except HTTPException:
        raise
    except Exception as e:
        _clog.exception("페르소나 수정 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{persona_id}")
async def delete_persona(persona_id: str):
    """페르소나 삭제"""
    try:
        success = await get_persona_service_instance().delete_persona(persona_id)
        if not success:
            raise HTTPException(status_code=404, detail="페르소나를 찾을 수 없습니다.")
        _clog.info(f"페르소나 삭제됨: {persona_id}")
        return {"message": "페르소나가 성공적으로 삭제되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        _clog.exception("페르소나 삭제 중 오류")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{persona_id}/toggle")
async def toggle_persona_status(persona_id: str):
    """페르소나 활성/비활성 토글"""
    try:
        persona = await get_persona_service_instance().toggle_persona_status(persona_id)
        if not persona:
            raise HTTPException(status_code=404, detail="페르소나를 찾을 수 없습니다.")
        _clog.info(f"페르소나 상태 변경됨: {persona.name} -> {'활성' if persona.is_active else '비활성'}")
        return persona
    except HTTPException:
        raise
    except Exception as e:
        _clog.exception("페르소나 상태 변경 중 오류")
        raise HTTPException(status_code=500, detail=str(e))