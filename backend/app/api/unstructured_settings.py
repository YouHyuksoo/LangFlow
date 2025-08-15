from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import json
import os
from ..core.config import settings as config_settings
from ..core.logger import get_console_logger
from ..models.schemas import UnstructuredSettings, UnstructuredSettingsUpdateRequest

router = APIRouter(prefix="/unstructured-settings", tags=["unstructured-settings"])
_clog = get_console_logger()

# 기본 unstructured 설정값
DEFAULT_UNSTRUCTURED_SETTINGS = {
    "enabled": True,
    "use_as_primary": True,
    "strategy": "auto",
    "hi_res_model_name": None,
    "infer_table_structure": True,
    "extract_images_in_pdf": False,
    "include_page_breaks": True,
    "ocr_languages": ["kor", "eng"],
    "skip_infer_table_types": [],
    "chunking_strategy": "by_title",
    "max_characters": 1500,
    "combine_text_under_n_chars": 150,
    "new_after_n_chars": 1200,
    "max_file_size_mb": 100,
    "supported_formats": [".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm", ".txt", ".md", ".csv"],
    "enable_fallback": True,
    "fallback_order": ["pymupdf", "pypdf", "pdfminer"]
}

def get_settings_file_path():
    """unstructured 설정 파일 경로 반환"""
    return os.path.join(config_settings.DATA_DIR, "unstructured_settings.json")

def load_unstructured_settings() -> Dict[str, Any]:
    """unstructured 설정 파일에서 설정 로드"""
    settings_file = get_settings_file_path()
    
    try:
        if os.path.exists(settings_file):
            with open(settings_file, 'r', encoding='utf-8') as f:
                saved_settings = json.load(f)
                # 기본 설정과 병합 (새로운 설정이 추가되었을 경우를 대비)
                merged_settings = DEFAULT_UNSTRUCTURED_SETTINGS.copy()
                merged_settings.update(saved_settings)
                return merged_settings
        else:
            # 설정 파일이 없으면 기본 설정 반환
            return DEFAULT_UNSTRUCTURED_SETTINGS.copy()
    except Exception as e:
        _clog.error(f"Unstructured 설정 로드 중 오류: {str(e)}")
        return DEFAULT_UNSTRUCTURED_SETTINGS.copy()

def save_unstructured_settings(new_settings: Dict[str, Any]) -> bool:
    """unstructured 설정을 파일에 저장"""
    settings_file = get_settings_file_path()
    
    try:
        # 데이터 디렉토리가 없으면 생성
        os.makedirs(os.path.dirname(settings_file), exist_ok=True)
        
        with open(settings_file, 'w', encoding='utf-8') as f:
            json.dump(new_settings, f, ensure_ascii=False, indent=2)
        
        _clog.info(f"Unstructured 설정 저장 완료: {settings_file}")
        return True
    except Exception as e:
        _clog.error(f"Unstructured 설정 저장 중 오류: {str(e)}")
        return False

@router.get("/")
async def get_unstructured_settings():
    """Unstructured 설정 조회"""
    try:
        settings_data = load_unstructured_settings()
        _clog.info("Unstructured 설정 조회 완료")
        return settings_data
    except Exception as e:
        _clog.error(f"Unstructured 설정 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="Unstructured 설정 조회 중 오류가 발생했습니다.")

@router.post("/")
async def update_unstructured_settings(new_settings: UnstructuredSettingsUpdateRequest):
    """Unstructured 설정 업데이트"""
    try:
        # 현재 설정 로드
        current_settings = load_unstructured_settings()
        
        # 새 설정으로 업데이트 (None이 아닌 값들만)
        update_data = new_settings.dict(exclude_unset=True, exclude_none=True)
        current_settings.update(update_data)
        
        # 설정 유효성 검증
        if "max_file_size_mb" in update_data:
            max_size = update_data["max_file_size_mb"]
            if not isinstance(max_size, int) or max_size <= 0 or max_size > 1000:
                raise HTTPException(
                    status_code=400, 
                    detail="최대 파일 크기는 0보다 크고 1000MB 이하여야 합니다."
                )
        
        if "strategy" in update_data:
            strategy = update_data["strategy"]
            if strategy not in ["auto", "hi_res", "fast"]:
                raise HTTPException(
                    status_code=400,
                    detail="처리 전략은 auto, hi_res, fast 중 하나여야 합니다."
                )
        
        if "chunking_strategy" in update_data:
            chunking = update_data["chunking_strategy"]
            if chunking not in ["by_title", "basic"]:
                raise HTTPException(
                    status_code=400,
                    detail="청킹 전략은 by_title, basic 중 하나여야 합니다."
                )
        
        # 설정 저장
        if save_unstructured_settings(current_settings):
            _clog.info("Unstructured 설정 업데이트 완료")
            return {"message": "Unstructured 설정이 성공적으로 업데이트되었습니다.", "settings": current_settings}
        else:
            raise HTTPException(status_code=500, detail="Unstructured 설정 저장에 실패했습니다.")
            
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"Unstructured 설정 업데이트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="Unstructured 설정 업데이트 중 오류가 발생했습니다.")

@router.post("/reset")
async def reset_unstructured_settings():
    """Unstructured 설정을 기본값으로 초기화"""
    try:
        if save_unstructured_settings(DEFAULT_UNSTRUCTURED_SETTINGS.copy()):
            _clog.info("Unstructured 설정 초기화 완료")
            return {"message": "Unstructured 설정이 기본값으로 초기화되었습니다.", "settings": DEFAULT_UNSTRUCTURED_SETTINGS}
        else:
            raise HTTPException(status_code=500, detail="Unstructured 설정 초기화에 실패했습니다.")
    except Exception as e:
        _clog.error(f"Unstructured 설정 초기화 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="Unstructured 설정 초기화 중 오류가 발생했습니다.")

@router.get("/status")
async def get_unstructured_status():
    """Unstructured 라이브러리 상태 확인"""
    try:
        status = {
            "available": False,
            "version": None,
            "error": None,
            "settings": load_unstructured_settings()
        }
        
        try:
            import sys
            _clog.info(f"Python 경로: {sys.executable}")
            _clog.info(f"site-packages: {[p for p in sys.path if 'site-packages' in p]}")
            
            import unstructured
            status["available"] = True
            
            # 버전 정보 안전하게 추출
            try:
                # 여러 방망으로 버전 정보 시도
                version = None
                
                # 방법 1: __version__ 모듈의 __version__ 속성
                if hasattr(unstructured, '__version__') and hasattr(unstructured.__version__, '__version__'):
                    version = str(unstructured.__version__.__version__)
                # 방법 2: __version__ 모듈의 version 속성  
                elif hasattr(unstructured, '__version__') and hasattr(unstructured.__version__, 'version'):
                    version = str(unstructured.__version__.version)
                # 방법 3: pkg_resources 사용
                else:
                    try:
                        import pkg_resources
                        version = pkg_resources.get_distribution('unstructured').version
                    except:
                        # 방법 4: importlib.metadata 사용 (Python 3.8+)
                        try:
                            import importlib.metadata
                            version = importlib.metadata.version('unstructured')
                        except:
                            version = 'unknown'
                
                status["version"] = version or 'unknown'
                _clog.info(f"Unstructured 라이브러리 사용 가능 - 버전: {status['version']}")
                
            except Exception as version_error:
                status["version"] = 'unknown'
                _clog.warning(f"Unstructured 버전 정보 추출 실패: {version_error}")
                _clog.info(f"Unstructured 라이브러리 사용 가능 - 버전: {status['version']}")
        except ImportError as e:
            import sys
            status["error"] = f"Unstructured 라이브러리를 찾을 수 없습니다: {str(e)}"
            _clog.error(f"Unstructured 라이브러리 import 실패: {e}")
            _clog.error(f"Python 경로: {sys.executable}")
            _clog.error(f"sys.path: {sys.path[:3]}")
        except Exception as e:
            status["error"] = f"Unstructured 라이브러리 확인 중 오류: {str(e)}"
            status["version"] = None  # JSON 직렬화 안전성을 위해 None 설정
            _clog.error(f"Unstructured 라이브러리 확인 중 예상치 못한 오류: {e}")
        
        return status
        
    except Exception as e:
        _clog.error(f"Unstructured 상태 확인 실패: {str(e)}")
        # JSON 직렬화 안전한 기본 상태 반환
        return {
            "available": False,
            "version": None,
            "error": f"Unstructured 상태 확인 실패: {str(e)}",
            "settings": load_unstructured_settings()
        }

@router.post("/test")
async def test_unstructured_processing():
    """Unstructured 처리 테스트"""
    try:
        settings_data = load_unstructured_settings()
        
        if not settings_data.get("enabled", False):
            return {
                "success": False,
                "message": "Unstructured가 비활성화되어 있습니다.",
                "settings": settings_data
            }
        
        try:
            from unstructured.partition.text import partition_text
            
            # 간단한 텍스트로 테스트
            test_text = "이것은 Unstructured 라이브러리 테스트입니다.\n\n테이블 추론과 한글 처리가 정상적으로 작동하는지 확인합니다."
            
            elements = partition_text(text=test_text)
            
            result = {
                "success": True,
                "message": "Unstructured 처리 테스트 성공",
                "elements_count": len(elements),
                "elements": [str(elem) for elem in elements[:3]],  # 처음 3개만 보여줌
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