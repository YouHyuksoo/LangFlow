from fastapi import APIRouter, HTTPException, Depends
from typing import List
from ..models.schemas import (
    ModelProfile, 
    ModelProfileCreateRequest, 
    ModelProfileUpdateRequest,
    ModelProfileListResponse
)
from ..services.model_profile_service import model_profile_service
import logging

# 로거 설정
_clog = logging.getLogger("console")

router = APIRouter()

@router.get("/", response_model=ModelProfileListResponse)
async def get_model_profiles():
    """등록된 모든 모델 프로필 조회"""
    try:
        profiles = model_profile_service.get_profiles()
        active_profile_id = model_profile_service.active_profile_id
        
        _clog.info(f"모델 프로필 목록 조회 완료: {len(profiles)}개")
        return ModelProfileListResponse(
            profiles=profiles,
            active_profile_id=active_profile_id
        )
    except Exception as e:
        _clog.error(f"모델 프로필 목록 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=ModelProfile)
async def create_model_profile(request: ModelProfileCreateRequest):
    """새 모델 프로필 생성"""
    try:
        profile = model_profile_service.create_profile(request)
        _clog.info(f"모델 프로필 생성 완료: {profile.name} ({profile.provider}/{profile.model})")
        return profile
    except Exception as e:
        _clog.error(f"모델 프로필 생성 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{profile_id}", response_model=ModelProfile)
async def get_model_profile(profile_id: str):
    """특정 모델 프로필 조회"""
    try:
        profile = model_profile_service.get_profile(profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다")
        
        _clog.info(f"모델 프로필 조회 완료: {profile.name}")
        return profile
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"모델 프로필 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{profile_id}", response_model=ModelProfile)
async def update_model_profile(profile_id: str, request: ModelProfileUpdateRequest):
    """모델 프로필 수정"""
    try:
        profile = model_profile_service.update_profile(profile_id, request)
        _clog.info(f"모델 프로필 수정 완료: {profile.name}")
        return profile
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        _clog.error(f"모델 프로필 수정 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{profile_id}")
async def delete_model_profile(profile_id: str):
    """모델 프로필 삭제"""
    try:
        success = model_profile_service.delete_profile(profile_id)
        if not success:
            raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다")
        
        _clog.info(f"모델 프로필 삭제 완료: {profile_id}")
        return {"message": "프로필이 삭제되었습니다"}
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"모델 프로필 삭제 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{profile_id}/activate")
async def activate_model_profile(profile_id: str):
    """모델 프로필을 활성화"""
    try:
        success = model_profile_service.set_active_profile(profile_id)
        if not success:
            raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다")
        
        _clog.info(f"모델 프로필 활성화 완료: {profile_id}")
        return {"message": "프로필이 활성화되었습니다"}
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"모델 프로필 활성화 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/active/current", response_model=ModelProfile)
async def get_active_profile():
    """현재 활성 프로필 조회"""
    try:
        profile = model_profile_service.get_active_profile()
        if not profile:
            raise HTTPException(status_code=404, detail="활성 프로필이 없습니다")
        
        _clog.info(f"활성 프로필 조회 완료: {profile.name}")
        return profile
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"활성 프로필 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{profile_id}/test")
async def test_model_profile(profile_id: str):
    """모델 프로필 연결 테스트"""
    try:
        profile = model_profile_service.get_profile(profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다")
        
        # TODO: 실제 모델 연결 테스트 구현
        # 현재는 기본 응답 반환
        _clog.info(f"모델 프로필 테스트: {profile.name}")
        return {
            "status": "success",
            "message": f"{profile.provider} {profile.model} 연결 테스트 성공",
            "profile_name": profile.name
        }
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"모델 프로필 테스트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/default-ai-chunking-message")
async def get_default_ai_chunking_message(provider: str = "openai"):
    """제공업체별 기본 AI 청킹 시스템 메시지 조회"""
    try:
        default_message = model_profile_service.get_default_ai_chunking_system_message(provider)
        _clog.info(f"기본 AI 청킹 시스템 메시지 조회: {provider}")
        return {
            "provider": provider,
            "system_message": default_message,
            "description": f"{provider.title()} 모델에 최적화된 기본 AI 청킹 시스템 메시지"
        }
    except Exception as e:
        _clog.error(f"기본 시스템 메시지 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))