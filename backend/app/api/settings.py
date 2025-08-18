from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from ..services.settings_service import settings_service
from ..core.logger import get_console_logger

router = APIRouter(prefix="/settings", tags=["settings"])
_clog = get_console_logger()

# 통합 설정 서비스를 사용하므로 기존 함수들은 제거됨

@router.get("/")
async def get_settings():
    """시스템 설정 조회"""
    try:
        settings_data = settings_service.get_section_settings("system")
        _clog.info("설정 조회 완료")
        return settings_data
    except Exception as e:
        _clog.error(f"설정 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="설정 조회 중 오류가 발생했습니다.")

@router.post("/")
async def update_settings(new_settings: Dict[str, Any]):
    """시스템 설정 업데이트"""
    try:
        # 설정 유효성 검증
        is_valid, error_message = settings_service.validate_settings("system", new_settings)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)
        
        # 설정 저장
        if settings_service.update_section_settings("system", new_settings):
            updated_settings = settings_service.get_section_settings("system")
            _clog.info("설정 업데이트 완료")
            return {"message": "설정이 성공적으로 업데이트되었습니다.", "settings": updated_settings}
        else:
            raise HTTPException(status_code=500, detail="설정 저장에 실패했습니다.")
            
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"설정 업데이트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="설정 업데이트 중 오류가 발생했습니다.")

@router.get("/vectorization")
async def get_vectorization_settings():
    """벡터화 관련 설정 조회 (임베딩 모델, 성능 설정 등)"""
    try:
        # 여러 섹션의 설정을 한 번에 가져오기
        system_settings = settings_service.get_section_settings("system")
        model_settings = settings_service.get_section_settings("models") 
        performance_settings = settings_service.get_section_settings("performance")
        
        # 임베딩 모델 정보 추출
        embedding_model = model_settings.get("embedding_model", "text-embedding-ada-002")
        
        # 모델 타입 및 차원 감지
        if embedding_model.startswith("text-embedding-") or "openai" in embedding_model.lower():
            model_type = "OpenAI API"
            model_description = "클라우드 기반 임베딩"
            # OpenAI 모델 차원 설정
            if "text-embedding-3-small" in embedding_model:
                model_dimension = 1536
            elif "text-embedding-3-large" in embedding_model:
                model_dimension = 3072
            elif "text-embedding-ada-002" in embedding_model:
                model_dimension = 1536
            else:
                model_dimension = 1536  # 기본값
        elif "/" in embedding_model:
            model_type = "HuggingFace 로컬"
            model_description = "로컬 실행 임베딩"
            # HuggingFace 모델 차원 설정
            if "bge" in embedding_model.lower():
                model_dimension = 768
            elif "all-MiniLM-L6-v2" in embedding_model:
                model_dimension = 384
            elif "all-mpnet-base-v2" in embedding_model:
                model_dimension = 768
            else:
                model_dimension = 768  # 기본값
        else:
            model_type = "OpenAI API"
            model_description = "클라우드 기반 임베딩"
            model_dimension = 1536
        
        # 벡터화 관련 설정 통합
        vectorization_info = {
            "embedding_model": {
                "name": embedding_model,
                "type": model_type,
                "description": model_description,
                "dimension": model_dimension,
                "is_local": "/" in embedding_model
            },
            "chunk_settings": {
                "chunk_size": system_settings.get("chunkSize", 1000),
                "chunk_overlap": system_settings.get("chunkOverlap", 200)
            },
            "performance_settings": {
                "enable_parallel": performance_settings.get("enableParallelProcessing", True),
                "max_concurrent_embeddings": performance_settings.get("maxConcurrentEmbeddings", 5),
                "max_concurrent_chunks": performance_settings.get("maxConcurrentChunks", 20),
                "batch_size": performance_settings.get("batchSize", 10)
            },
            "preprocessing_method": system_settings.get("preprocessing_method", "basic")
        }
        
        _clog.info(f"벡터화 설정 조회 완료 - 임베딩 모델: {embedding_model}")
        return vectorization_info
        
    except Exception as e:
        _clog.error(f"벡터화 설정 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="벡터화 설정 조회 중 오류가 발생했습니다.")

@router.post("/reset")
async def reset_settings():
    """설정을 기본값으로 초기화"""
    try:
        if settings_service.reset_section_settings("system"):
            default_settings = settings_service.get_section_settings("system")
            _clog.info("설정 초기화 완료")
            return {"message": "설정이 기본값으로 초기화되었습니다.", "settings": default_settings}
        else:
            raise HTTPException(status_code=500, detail="설정 초기화에 실패했습니다.")
    except Exception as e:
        _clog.error(f"설정 초기화 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="설정 초기화 중 오류가 발생했습니다.")

@router.get("/performance")
async def get_performance_settings():
    """성능 설정 조회"""
    try:
        settings_data = settings_service.get_section_settings("performance")
        _clog.info("성능 설정 조회 완료")
        return settings_data
    except Exception as e:
        _clog.error(f"성능 설정 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="성능 설정 조회 중 오류가 발생했습니다.")

@router.post("/performance")
async def update_performance_settings(new_settings: Dict[str, Any]):
    """성능 설정 업데이트"""
    try:
        # 설정 유효성 검증
        is_valid, error_message = settings_service.validate_settings("performance", new_settings)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)
        
        # 설정 저장
        if settings_service.update_section_settings("performance", new_settings):
            updated_settings = settings_service.get_section_settings("performance")
            _clog.info("성능 설정 업데이트 완료")
            return {"message": "성능 설정이 성공적으로 업데이트되었습니다.", "settings": updated_settings}
        else:
            raise HTTPException(status_code=500, detail="성능 설정 저장에 실패했습니다.")
            
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"성능 설정 업데이트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="성능 설정 업데이트 중 오류가 발생했습니다.")

@router.get("/system-stats")
async def get_system_statistics():
    """시스템 통계 조회"""
    try:
        stats_data = settings_service.get_system_stats()
        _clog.info("시스템 통계 조회 완료")
        return stats_data
    except Exception as e:
        _clog.error(f"시스템 통계 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="시스템 통계 조회 중 오류가 발생했습니다.")

# 모델 설정 관련 엔드포인트들
@router.get("/models")
async def get_model_settings():
    """모델 설정 조회"""
    try:
        settings = settings_service.get_section_settings("models")
        _clog.info("모델 설정 조회 완료")
        return settings
    except Exception as e:
        _clog.error(f"모델 설정 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/models")
async def update_model_settings(new_settings: Dict[str, Any]):
    """모델 설정 수정"""
    try:
        is_valid, error_message = settings_service.validate_settings("models", new_settings)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)
        
        if settings_service.update_section_settings("models", new_settings):
            updated_settings = settings_service.get_section_settings("models")
            _clog.info("모델 설정 수정 완료")
            return updated_settings
        else:
            raise HTTPException(status_code=500, detail="모델 설정 저장에 실패했습니다.")
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"모델 설정 수정 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/providers")
async def get_available_providers():
    """사용 가능한 모델 제공업체 목록 조회"""
    try:
        providers = settings_service.get_available_providers()
        _clog.info("모델 제공업체 목록 조회 완료")
        return providers
    except Exception as e:
        _clog.error(f"모델 제공업체 목록 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/{provider}")
async def get_models_by_provider(provider: str):
    """특정 제공업체의 모델 목록 조회"""
    try:
        models = settings_service.get_models_by_provider(provider)
        _clog.info(f"{provider} 모델 목록 조회 완료")
        return {"models": models}
    except Exception as e:
        _clog.error(f"{provider} 모델 목록 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/models/test")
async def test_model_settings():
    """현재 모델 설정으로 연결 테스트"""
    try:
        result = settings_service.test_model_connection()
        _clog.info("모델 연결 테스트 완료")
        return result
    except Exception as e:
        _clog.error(f"모델 연결 테스트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/models/test-llm")
async def test_llm_connection(test_settings: Dict[str, Any]):
    """LLM 연결 테스트"""
    try:
        # 테스트용 설정으로 연결 확인
        result = settings_service.test_llm_connection(test_settings)
        _clog.info("LLM 연결 테스트 완료")
        return result
    except Exception as e:
        _clog.error(f"LLM 연결 테스트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/models/test-embedding")
async def test_embedding_connection(test_settings: Dict[str, Any]):
    """임베딩 모델 연결 테스트"""
    try:
        # 테스트용 설정으로 연결 확인
        result = settings_service.test_embedding_connection(test_settings)
        _clog.info("임베딩 연결 테스트 완료")
        return result
    except Exception as e:
        _clog.error(f"임베딩 연결 테스트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Docling 관련 엔드포인트
@router.get("/docling")
async def get_docling_settings():
    """Docling 설정 조회"""
    try:
        settings = settings_service.get_section_settings("docling")
        _clog.info("Docling 설정 조회 완료")
        return settings
    except Exception as e:
        _clog.error(f"Docling 설정 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/docling")
async def update_docling_settings(new_settings: Dict[str, Any]):
    """Docling 설정 수정"""
    try:
        is_valid, error_message = settings_service.validate_settings("docling", new_settings)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)
        
        if settings_service.update_section_settings("docling", new_settings):
            updated_settings = settings_service.get_section_settings("docling")
            _clog.info("Docling 설정 수정 완료")
            return updated_settings
        else:
            raise HTTPException(status_code=500, detail="Docling 설정 저장에 실패했습니다.")
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"Docling 설정 수정 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/docling/status")
async def get_docling_status():
    """Docling 서비스 상태 확인"""
    try:
        status = settings_service.get_docling_status()
        _clog.info("Docling 상태 확인 완료")
        return status
    except Exception as e:
        _clog.error(f"Docling 상태 확인 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Unstructured 관련 엔드포인트
@router.get("/unstructured")
async def get_unstructured_settings():
    """Unstructured 설정 조회"""
    try:
        settings_data = settings_service.get_section_settings("unstructured")
        _clog.info("Unstructured 설정 조회 완료")
        return settings_data
    except Exception as e:
        _clog.error(f"Unstructured 설정 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="Unstructured 설정 조회 중 오류가 발생했습니다.")

@router.post("/unstructured")
async def update_unstructured_settings(new_settings: Dict[str, Any]):
    """Unstructured 설정 업데이트"""
    try:
        is_valid, error_message = settings_service.validate_settings("unstructured", new_settings)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)
        
        if settings_service.update_section_settings("unstructured", new_settings):
            updated_settings = settings_service.get_section_settings("unstructured")
            _clog.info("Unstructured 설정 업데이트 완료")
            return {"message": "Unstructured 설정이 성공적으로 업데이트되었습니다.", "settings": updated_settings}
        else:
            raise HTTPException(status_code=500, detail="Unstructured 설정 저장에 실패했습니다.")
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"Unstructured 설정 업데이트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="Unstructured 설정 업데이트 중 오류가 발생했습니다.")

@router.get("/unstructured/status")
async def get_unstructured_status():
    """Unstructured 라이브러리 상태 확인"""
    try:
        status = settings_service.get_unstructured_status()
        _clog.info("Unstructured 상태 확인 완료")
        return status
    except Exception as e:
        _clog.error(f"Unstructured 상태 확인 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/unstructured/test")
async def test_unstructured_processing():
    """Unstructured 처리 테스트"""
    try:
        settings_data = settings_service.get_section_settings("unstructured")
        
        if not settings_data.get("enabled", False):
            return {
                "success": False,
                "message": "Unstructured가 비활성화되어 있습니다.",
                "settings": settings_data
            }
        
        try:
            from unstructured.partition.text import partition_text
            
            test_text = "이것은 Unstructured 라이브러리 테스트입니다.\n\n테이블 추론과 한글 처리가 정상적으로 작동하는지 확인합니다."
            elements = partition_text(text=test_text)
            
            result = {
                "success": True,
                "message": "Unstructured 처리 테스트 성공",
                "elements_count": len(elements),
                "elements": [str(elem) for elem in elements[:3]],
                "settings": settings_data
            }
            
            _clog.info("Unstructured 처리 테스트 성공")
            return result
            
        except ImportError:
            return {
                "success": False,
                "message": "Unstructured 라이브러리가 설치되지 않았습니다.",
                "settings": settings_data
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Unstructured 테스트 실패: {str(e)}",
                "settings": settings_data
            }
            
    except Exception as e:
        _clog.error(f"Unstructured 테스트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="Unstructured 테스트 중 오류가 발생했습니다.")

# 통합 설정 관리를 위한 새로운 엔드포인트들

@router.get("/all")
async def get_all_settings():
    """모든 설정 조회"""
    try:
        all_settings = settings_service.load_settings()
        _clog.info("전체 설정 조회 완료")
        return all_settings
    except Exception as e:
        _clog.error(f"전체 설정 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="전체 설정 조회 중 오류가 발생했습니다.")

@router.get("/{section}")
async def get_section_settings(section: str):
    """특정 섹션 설정 조회"""
    try:
        settings_data = settings_service.get_section_settings(section)
        if not settings_data:
            raise HTTPException(status_code=404, detail=f"'{section}' 섹션을 찾을 수 없습니다.")
        
        _clog.info(f"{section} 설정 조회 완료")
        return settings_data
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"{section} 설정 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"{section} 설정 조회 중 오류가 발생했습니다.")

@router.post("/{section}")
async def update_section_settings(section: str, new_settings: Dict[str, Any]):
    """특정 섹션 설정 업데이트"""
    try:
        # 설정 유효성 검증
        is_valid, error_message = settings_service.validate_settings(section, new_settings)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)
        
        # 설정 저장
        if settings_service.update_section_settings(section, new_settings):
            updated_settings = settings_service.get_section_settings(section)
            _clog.info(f"{section} 설정 업데이트 완료")
            return {"message": f"{section} 설정이 성공적으로 업데이트되었습니다.", "settings": updated_settings}
        else:
            raise HTTPException(status_code=500, detail=f"{section} 설정 저장에 실패했습니다.")
            
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"{section} 설정 업데이트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"{section} 설정 업데이트 중 오류가 발생했습니다.")

@router.post("/reset-all")
async def reset_all_settings():
    """모든 설정을 기본값으로 초기화"""
    try:
        if settings_service.reset_all_settings():
            default_settings = settings_service.load_settings()
            _clog.info("전체 설정 초기화 완료")
            return {"message": "모든 설정이 기본값으로 초기화되었습니다.", "settings": default_settings}
        else:
            raise HTTPException(status_code=500, detail="전체 설정 초기화에 실패했습니다.")
    except Exception as e:
        _clog.error(f"전체 설정 초기화 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="전체 설정 초기화 중 오류가 발생했습니다.")