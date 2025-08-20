"""
PRD3: AI 청킹 API 엔드포인트
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from ..services.ai_chunking_service import (
    ai_chunking_service,
    AIChunkingOptions,
    AIProvider
)
# ChunkProposalResponse를 여기서 정의
class ChunkProposalResponse(BaseModel):
    """청크 제안 응답"""
    chunk_id: str
    order: int
    text: str
    token_estimate: int
    heading_path: Optional[List[str]] = None
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    quality_warnings: List[str] = []
    image_refs_count: int = 0
from .users import get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai-chunking", tags=["AI Chunking"])


class AIChunkingRequest(BaseModel):
    """AI 청킹 요청"""
    text: str = Field(..., description="청킹할 텍스트")
    model_profile_id: str = Field(..., description="사용할 모델 프로필 ID")
    max_tokens: int = Field(800, ge=100, le=4000, description="최대 토큰 수")
    min_tokens: int = Field(200, ge=50, le=2000, description="최소 토큰 수")
    overlap_tokens: int = Field(80, ge=0, le=500, description="오버랩 토큰 수")
    respect_headings: bool = Field(True, description="헤딩 경계 존중")
    snap_to_sentence: bool = Field(True, description="문장 경계 스냅")
    hard_sentence_max_tokens: int = Field(400, ge=100, le=2000, description="강제 분절 기준")
    use_fallback: bool = Field(True, description="AI 실패 시 폴백 사용")
    use_multimodal: bool = Field(False, description="멀티모달 청킹 사용 (PDF를 이미지로 변환하여 전송)")
    pdf_file_path: Optional[str] = Field(None, description="멀티모달 모드에서 사용할 PDF 파일 경로")
    # 모델 프로필의 temperature를 사용하므로 여기서는 제거


class AIChunkingResponse(BaseModel):
    """AI 청킹 응답"""
    chunks: List[ChunkProposalResponse]
    total_chunks: int
    from_fallback: bool = Field(False, description="폴백 모드로 생성되었는지")
    ai_provider: str
    ai_model: str
    processing_time: float
    warnings: Optional[List[str]] = None


@router.post("/propose", response_model=AIChunkingResponse)
async def propose_chunks_with_ai(
    request: AIChunkingRequest,
    admin_user = Depends(get_admin_user)
):
    """
    AI를 사용한 지능형 청킹 제안
    
    LLM에게 문서를 보내서 JSON 형태로 청킹 기준을 받아 
    문서의 구조와 의미를 고려한 최적의 청킹을 수행합니다.
    """
    import time
    start_time = time.time()
    
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="텍스트가 비어있습니다.")
        
        # 모델 프로필 조회
        from ..services.model_profile_service import model_profile_service
        profile = model_profile_service.get_profile(request.model_profile_id)
        
        if not profile:
            raise HTTPException(status_code=404, detail=f"모델 프로필을 찾을 수 없습니다: {request.model_profile_id}")
        
        # AI 제공업체 매핑
        provider_mapping = {
            "openai": AIProvider.OPENAI,
            "anthropic": AIProvider.ANTHROPIC, 
            "upstage": AIProvider.UPSTAGE,
            "google": AIProvider.GOOGLE
        }
        
        mapped_provider = provider_mapping.get(profile.provider.lower())
        if not mapped_provider:
            raise HTTPException(status_code=400, detail=f"지원하지 않는 AI 제공업체: {profile.provider}")
        
        # AI 청킹 옵션 설정 (모델 프로필 정보 사용)
        options = AIChunkingOptions(
            provider=mapped_provider,
            model=profile.model,
            max_tokens=request.max_tokens,
            min_tokens=request.min_tokens,
            overlap_tokens=request.overlap_tokens,
            respect_headings=request.respect_headings,
            snap_to_sentence=request.snap_to_sentence,
            hard_sentence_max_tokens=request.hard_sentence_max_tokens,
            temperature=profile.temperature,  # 모델 프로필의 temperature 사용
            max_retries=2,
            use_multimodal=request.use_multimodal,  # 멀티모달 옵션 추가
            pdf_file_path=request.pdf_file_path  # PDF 파일 경로 추가
        )
        
        logger.info(f"AI 청킹 요청 - 프로필: {profile.name}, 제공업체: {profile.provider}, 모델: {profile.model}")
        
        # AI 청킹 수행 (모델 프로필의 API 키 및 시스템 메시지 사용)
        if request.use_fallback:
            chunk_proposals, from_fallback = await ai_chunking_service.propose_chunks_with_fallback(
                request.text, options, profile.api_key, profile.ai_chunking_system_message
            )
        else:
            try:
                chunk_proposals = await ai_chunking_service.propose_chunks_with_ai(
                    request.text, options, profile.api_key, profile.ai_chunking_system_message
                )
                from_fallback = False
            except Exception as e:
                logger.error(f"AI 청킹 실패: {e}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"AI 청킹 실패: {str(e)}"
                )
        
        # 응답 변환
        chunks_response = []
        warnings = []
        
        for chunk in chunk_proposals:
            # 품질 경고 수집
            chunk_warnings = []
            if chunk.quality_warnings:
                for warning in chunk.quality_warnings:
                    chunk_warnings.append(warning.message)
                    warnings.extend(chunk_warnings)
            
            chunk_response = ChunkProposalResponse(
                chunk_id=chunk.chunk_id,
                order=chunk.order,
                text=chunk.text,
                token_estimate=chunk.token_estimate,
                heading_path=chunk.heading_path,
                page_start=chunk.page_start,
                page_end=chunk.page_end,
                quality_warnings=chunk_warnings,
                image_refs_count=len(chunk.image_refs) if chunk.image_refs else 0
            )
            chunks_response.append(chunk_response)
        
        processing_time = time.time() - start_time
        
        logger.info(f"AI 청킹 완료 - {len(chunks_response)}개 청크 생성 (폴백: {from_fallback}, 소요시간: {processing_time:.2f}초)")
        
        return AIChunkingResponse(
            chunks=chunks_response,
            total_chunks=len(chunks_response),
            from_fallback=from_fallback,
            ai_provider=options.provider.value,
            ai_model=options.model,
            processing_time=processing_time,
            warnings=warnings if warnings else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI 청킹 API 오류: {e}")
        raise HTTPException(status_code=500, detail=f"AI 청킹 처리 중 오류 발생: {str(e)}")


@router.get("/providers")
async def get_ai_providers():
    """사용 가능한 AI 제공업체 목록 (기존 모델 프로필에서 가져오기)"""
    try:
        from ..services.model_profile_service import model_profile_service
        
        # 등록된 모든 모델 프로필 조회
        profiles = model_profile_service.get_profiles()
        
        # AI 청킹에 지원되는 제공업체 필터링
        supported_providers = {"openai", "anthropic", "upstage", "google"}
        
        # 제공업체별로 그룹화
        provider_groups = {}
        for profile in profiles:
            if profile.provider.lower() in supported_providers:
                provider_key = profile.provider.lower()
                if provider_key not in provider_groups:
                    provider_groups[provider_key] = {
                        "name": provider_key,
                        "display_name": {
                            "openai": "OpenAI",
                            "anthropic": "Anthropic (Claude)",
                            "upstage": "Upstage (Solar)",
                            "google": "Google (Gemini)"
                        }.get(provider_key, profile.provider.title()),
                        "profiles": []
                    }
                
                provider_groups[provider_key]["profiles"].append({
                    "id": profile.id,
                    "name": profile.name,
                    "model": profile.model,
                    "is_active": profile.is_active
                })
        
        return {
            "providers": list(provider_groups.values()),
            "message": f"{len(profiles)}개의 등록된 모델 프로필에서 {len(provider_groups)}개 제공업체 발견"
        }
        
    except Exception as e:
        logger.warning(f"모델 프로필 조회 실패, 기본 목록 반환: {e}")
        # 폴백: 기본 제공업체 목록
        return {
            "providers": [
                {
                    "name": "openai",
                    "display_name": "OpenAI",
                    "profiles": [],
                    "fallback": True
                },
                {
                    "name": "anthropic", 
                    "display_name": "Anthropic (Claude)",
                    "profiles": [],
                    "fallback": True
                },
                {
                    "name": "upstage",
                    "display_name": "Upstage (Solar)", 
                    "profiles": [],
                    "fallback": True
                },
                {
                    "name": "google",
                    "display_name": "Google (Gemini)",
                    "profiles": [],
                    "fallback": True
                }
            ],
            "message": "기본 제공업체 목록 (모델 프로필 설정 필요)"
        }


@router.post("/test-connection")
async def test_ai_connection(
    provider: AIProvider,
    model: str,
    admin_user = Depends(get_admin_user)
):
    """AI 제공업체 연결 테스트"""
    try:
        options = AIChunkingOptions(
            provider=provider,
            model=model,
            max_retries=1
        )
        
        # 간단한 테스트 텍스트
        test_text = "This is a simple test document for AI chunking connectivity test."
        
        # 연결 테스트 (실제 청킹은 수행하지 않음)
        system_prompt = "You are a test assistant. Return 'OK' if you receive this message."
        user_prompt = "Connection test"
        
        response = await ai_chunking_service._call_llm(
            provider, model, system_prompt, user_prompt, 0.1
        )
        
        return {
            "success": True,
            "provider": provider.value,
            "model": model,
            "response_preview": response[:100] if response else "No response"
        }
        
    except Exception as e:
        logger.error(f"AI 연결 테스트 실패: {e}")
        return {
            "success": False,
            "provider": provider.value,
            "model": model,
            "error": str(e)
        }