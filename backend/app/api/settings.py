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

@router.get("/fallback-control")
async def get_fallback_control_settings():
    """폴백 제어 설정 조회"""
    try:
        fallback_settings = settings_service.get_section_settings("fallback_control")
        _clog.info("폴백 제어 설정 조회 완료")
        return {
            "fallback_control": fallback_settings,
            "description": "시스템 폴백 동작 제어 설정",
            "recommendations": {
                "strict_mode": "프로덕션 환경에서는 True 권장",
                "enable_similarity_fallback": "datasketch 없을 때만 False→True",
                "enable_sentence_splitter_fallback": "KSS/Kiwi 없을 때만 False→True",
                "enable_token_counter_fallback": "tiktoken 없을 때만 False→True"
            }
        }
    except Exception as e:
        _clog.error(f"폴백 제어 설정 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="폴백 제어 설정 조회 중 오류가 발생했습니다.")

@router.get("/manual-preprocessing")
async def get_manual_preprocessing_settings():
    """수동 전처리 설정 조회"""
    try:
        manual_settings = settings_service.get_section_settings("manual_preprocessing")
        fallback_settings = settings_service.get_section_settings("fallback_control")
        
        _clog.info("수동 전처리 설정 조회 완료")
        return {
            "manual_preprocessing": manual_settings,
            "fallback_control": fallback_settings,
            "description": "수동 전처리 중앙 집중 설정 관리",
            "splitter_options": [
                {"value": "kss", "label": "KSS (한국어 문장 분할)", "requires": "kss"},
                {"value": "kiwi", "label": "Kiwi (형태소 분석 기반)", "requires": "kiwipiepy"},
                {"value": "regex", "label": "정규식 (사용자 정의)", "requires": None},
                {"value": "recursive", "label": "RecursiveCharacterTextSplitter", "requires": "langchain_text_splitters"}
            ],
            "kss_backend_options": [
                {"value": "punct", "label": "Punct (빠름, 안정적)", "description": "구두점 기반 분할"},
                {"value": "mecab", "label": "MeCab (정확함)", "description": "형태소 분석 기반"},
                {"value": "pecab", "label": "Pecab (균형)", "description": "성능과 정확도 균형"},
                {"value": "fast", "label": "Fast (가장 빠름)", "description": "단순 규칙 기반"}
            ],
            "recommendations": {
                "max_tokens": "일반적으로 800-1200 토큰 권장",
                "min_tokens": "200-400 토큰 권장",
                "overlap_tokens": "max_tokens의 10-15% 권장",
                "kss_backend": "안정성을 위해 punct 권장",
                "similarity_threshold": "0.90-0.95 사이 권장"
            }
        }
    except Exception as e:
        _clog.error(f"수동 전처리 설정 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="수동 전처리 설정 조회 중 오류가 발생했습니다.")

@router.post("/manual-preprocessing")
async def update_manual_preprocessing_settings(new_settings: Dict[str, Any]):
    """수동 전처리 설정 업데이트"""
    try:
        # 설정 유효성 검증
        validation_errors = []
        
        # 숫자 범위 검증
        if "max_tokens" in new_settings:
            if not isinstance(new_settings["max_tokens"], int) or new_settings["max_tokens"] < 100 or new_settings["max_tokens"] > 4000:
                validation_errors.append("max_tokens는 100-4000 사이의 정수여야 합니다.")
        
        if "min_tokens" in new_settings:
            if not isinstance(new_settings["min_tokens"], int) or new_settings["min_tokens"] < 50 or new_settings["min_tokens"] > 2000:
                validation_errors.append("min_tokens는 50-2000 사이의 정수여야 합니다.")
        
        if "overlap_tokens" in new_settings:
            if not isinstance(new_settings["overlap_tokens"], int) or new_settings["overlap_tokens"] < 0 or new_settings["overlap_tokens"] > 500:
                validation_errors.append("overlap_tokens는 0-500 사이의 정수여야 합니다.")
        
        # 문장 분할기 옵션 검증
        if "default_sentence_splitter" in new_settings:
            valid_splitters = ["kss", "kiwi", "regex", "recursive"]
            if new_settings["default_sentence_splitter"] not in valid_splitters:
                validation_errors.append(f"default_sentence_splitter는 {valid_splitters} 중 하나여야 합니다.")
        
        # KSS 백엔드 검증
        if "kss_backend" in new_settings:
            valid_backends = ["punct", "mecab", "pecab", "fast"]
            if new_settings["kss_backend"] not in valid_backends:
                validation_errors.append(f"kss_backend는 {valid_backends} 중 하나여야 합니다.")
        
        # 임계값 검증
        if "similarity_threshold" in new_settings:
            if not isinstance(new_settings["similarity_threshold"], (int, float)) or not (0.0 <= new_settings["similarity_threshold"] <= 1.0):
                validation_errors.append("similarity_threshold는 0.0-1.0 사이의 숫자여야 합니다.")
        
        if "word_overlap_threshold" in new_settings:
            if not isinstance(new_settings["word_overlap_threshold"], (int, float)) or not (0.0 <= new_settings["word_overlap_threshold"] <= 1.0):
                validation_errors.append("word_overlap_threshold는 0.0-1.0 사이의 숫자여야 합니다.")
        
        if validation_errors:
            raise HTTPException(status_code=400, detail=f"설정 검증 실패: {'; '.join(validation_errors)}")
        
        # 논리적 일관성 검증
        current_settings = settings_service.get_section_settings("manual_preprocessing")
        merged_settings = {**current_settings, **new_settings}
        
        if merged_settings["min_tokens"] >= merged_settings["max_tokens"]:
            raise HTTPException(status_code=400, detail="min_tokens는 max_tokens보다 작아야 합니다.")
        
        if merged_settings["overlap_tokens"] >= merged_settings["max_tokens"]:
            raise HTTPException(status_code=400, detail="overlap_tokens는 max_tokens보다 작아야 합니다.")
        
        # 설정 업데이트
        if settings_service.update_section_settings("manual_preprocessing", new_settings):
            updated_settings = settings_service.get_section_settings("manual_preprocessing")
            _clog.info("수동 전처리 설정 업데이트 완료")
            return {
                "message": "수동 전처리 설정이 업데이트되었습니다.",
                "manual_preprocessing": updated_settings
            }
        else:
            raise HTTPException(status_code=500, detail="수동 전처리 설정 업데이트에 실패했습니다.")
            
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"수동 전처리 설정 업데이트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="수동 전처리 설정 업데이트 중 오류가 발생했습니다.")

@router.post("/manual-preprocessing/test-splitter")
async def test_sentence_splitter(test_data: Dict[str, Any]):
    """문장 분할기 테스트"""
    try:
        text = test_data.get("text", "")
        splitter = test_data.get("splitter", "kss")
        settings_override = test_data.get("settings", {})
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="테스트할 텍스트를 입력해주세요.")
        
        # 현재 설정 가져오기
        current_settings = settings_service.get_section_settings("manual_preprocessing")
        test_settings = {**current_settings, **settings_override}
        
        # 청킹 규칙 생성
        from ..services.chunking_service import ChunkingRules
        rules = ChunkingRules(
            max_tokens=test_settings["max_tokens"],
            min_tokens=test_settings["min_tokens"],
            overlap_tokens=test_settings["overlap_tokens"],
            sentence_splitter=splitter,
            kss_backend=test_settings["kss_backend"],
            kss_num_workers=test_settings["kss_num_workers"],
            kss_strip=test_settings["kss_strip"],
            kss_return_morphemes=test_settings["kss_return_morphemes"],
            kss_ignores=test_settings["kss_ignores"],
            regex_sentence_endings=test_settings["regex_sentence_endings"],
            regex_preserve_abbreviations=test_settings["regex_preserve_abbreviations"],
            regex_custom_patterns=test_settings["regex_custom_patterns"],
            recursive_separators=test_settings["recursive_separators"],
            recursive_keep_separator=test_settings["recursive_keep_separator"],
            recursive_is_separator_regex=test_settings["recursive_is_separator_regex"]
        )
        
        # 문장 분할 테스트
        from ..services.chunking_service import SmartTextSplitter
        splitter_service = SmartTextSplitter()
        
        try:
            sentences = splitter_service.split_into_sentences(text, rules)
            result = {
                "success": True,
                "splitter": splitter,
                "sentence_count": len(sentences),
                "sentences": [
                    {
                        "text": sent.text,
                        "tokens": sent.tokens,
                        "is_heading": sent.is_heading,
                        "is_list_item": sent.is_list_item,
                        "is_table_content": sent.is_table_content
                    } for sent in sentences[:10]  # 처음 10개만 반환
                ],
                "total_tokens": sum(sent.tokens for sent in sentences),
                "avg_tokens_per_sentence": sum(sent.tokens for sent in sentences) / len(sentences) if sentences else 0
            }
            
            if len(sentences) > 10:
                result["note"] = f"처음 10개 문장만 표시됨 (전체 {len(sentences)}개)"
            
            return result
        
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "splitter": splitter,
                "suggestion": "폴백 설정을 확인하거나 다른 분할기를 시도해보세요."
            }
            
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"문장 분할기 테스트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="문장 분할기 테스트 중 오류가 발생했습니다.")

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

@router.post("/fallback-control")
async def update_fallback_control_settings(new_settings: Dict[str, Any]):
    """폴백 제어 설정 업데이트"""
    try:
        # 설정 유효성 검증
        required_keys = ["enable_similarity_fallback", "enable_sentence_splitter_fallback", 
                        "enable_token_counter_fallback", "enable_pdf_extraction_fallback", "strict_mode"]
        
        for key in required_keys:
            if key in new_settings and not isinstance(new_settings[key], bool):
                raise HTTPException(status_code=400, detail=f"{key}는 불린 값이어야 합니다.")
        
        # 위험한 설정 조합 경고
        if new_settings.get("strict_mode") is False and any(new_settings.get(key) is False for key in required_keys[:-1]):
            _clog.warning("⚠️ 위험한 설정: strict_mode=False이면서 폴백도 비활성화됨 - 시스템 오류 발생 가능")
        
        # 설정 업데이트
        if settings_service.update_section_settings("fallback_control", new_settings):
            updated_settings = settings_service.get_section_settings("fallback_control")
            _clog.info("폴백 제어 설정 업데이트 완료")
            return {
                "message": "폴백 제어 설정이 업데이트되었습니다.",
                "fallback_control": updated_settings
            }
        else:
            raise HTTPException(status_code=500, detail="폴백 제어 설정 업데이트에 실패했습니다.")
            
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"폴백 제어 설정 업데이트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="폴백 제어 설정 업데이트 중 오류가 발생했습니다.")

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