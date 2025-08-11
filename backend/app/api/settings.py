from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import json
import os
from ..core.config import settings as config_settings
from ..core.logger import get_console_logger

router = APIRouter(prefix="/settings", tags=["settings"])
_clog = get_console_logger()

# 기본 설정값
DEFAULT_SETTINGS = {
    "maxFileSize": 10,  # MB
    "allowedFileTypes": ["pdf", "docx", "pptx", "xlsx"],
    "uploadDirectory": "uploads/",
    "vectorDimension": 1536,
    "chunkSize": 1000,
    "chunkOverlap": 200,
    "enableAutoVectorization": True,
    "enableNotifications": True,
    "debugMode": False,
}

def get_settings_file_path():
    """설정 파일 경로 반환"""
    return os.path.join(config_settings.DATA_DIR, "system_settings.json")

def load_settings() -> Dict[str, Any]:
    """설정 파일에서 설정 로드"""
    settings_file = get_settings_file_path()
    
    try:
        if os.path.exists(settings_file):
            with open(settings_file, 'r', encoding='utf-8') as f:
                saved_settings = json.load(f)
                # 기본 설정과 병합 (새로운 설정이 추가되었을 경우를 대비)
                merged_settings = DEFAULT_SETTINGS.copy()
                merged_settings.update(saved_settings)
                return merged_settings
        else:
            # 설정 파일이 없으면 기본 설정 반환
            return DEFAULT_SETTINGS.copy()
    except Exception as e:
        _clog.error(f"설정 로드 중 오류: {str(e)}")
        return DEFAULT_SETTINGS.copy()

def save_settings(new_settings: Dict[str, Any]) -> bool:
    """설정을 파일에 저장"""
    settings_file = get_settings_file_path()
    
    try:
        # 데이터 디렉토리가 없으면 생성
        os.makedirs(os.path.dirname(settings_file), exist_ok=True)
        
        with open(settings_file, 'w', encoding='utf-8') as f:
            json.dump(new_settings, f, ensure_ascii=False, indent=2)
        
        _clog.info(f"설정 저장 완료: {settings_file}")
        return True
    except Exception as e:
        _clog.error(f"설정 저장 중 오류: {str(e)}")
        return False

@router.get("/")
async def get_settings():
    """시스템 설정 조회"""
    try:
        settings_data = load_settings()
        _clog.info("설정 조회 완료")
        return settings_data
    except Exception as e:
        _clog.error(f"설정 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="설정 조회 중 오류가 발생했습니다.")

@router.post("/")
async def update_settings(new_settings: Dict[str, Any]):
    """시스템 설정 업데이트"""
    try:
        # 현재 설정 로드
        current_settings = load_settings()
        
        # 새 설정으로 업데이트
        current_settings.update(new_settings)
        
        # 설정 유효성 검증
        if "maxFileSize" in new_settings:
            max_size = new_settings["maxFileSize"]
            if not isinstance(max_size, (int, float)) or max_size <= 0 or max_size > 100:
                raise HTTPException(
                    status_code=400, 
                    detail="최대 파일 크기는 0보다 크고 100MB 이하여야 합니다."
                )
        
        # 설정 저장
        if save_settings(current_settings):
            _clog.info("설정 업데이트 완료")
            return {"message": "설정이 성공적으로 업데이트되었습니다.", "settings": current_settings}
        else:
            raise HTTPException(status_code=500, detail="설정 저장에 실패했습니다.")
            
    except HTTPException:
        raise
    except Exception as e:
        _clog.error(f"설정 업데이트 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="설정 업데이트 중 오류가 발생했습니다.")

@router.post("/reset")
async def reset_settings():
    """설정을 기본값으로 초기화"""
    try:
        if save_settings(DEFAULT_SETTINGS.copy()):
            _clog.info("설정 초기화 완료")
            return {"message": "설정이 기본값으로 초기화되었습니다.", "settings": DEFAULT_SETTINGS}
        else:
            raise HTTPException(status_code=500, detail="설정 초기화에 실패했습니다.")
    except Exception as e:
        _clog.error(f"설정 초기화 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="설정 초기화 중 오류가 발생했습니다.")