import os
import json
from datetime import datetime
from typing import Optional
from ..models.schemas import SystemSettings, SystemSettingsUpdateRequest
from ..core.config import settings

class SystemSettingsService:
    def __init__(self):
        self.settings_file = os.path.join(settings.DATA_DIR, "system_settings.json")
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        
        # 기본 설정으로 초기화
        if not os.path.exists(self.settings_file):
            self._create_default_settings()
    
    def _create_default_settings(self):
        """기본 시스템 설정을 생성합니다."""
        default_settings = {
            "default_system_message": "당신은 도움이 되는 AI 어시스턴트입니다. 정확하고 유용한 정보를 제공하며, 답변할 때 관련된 출처를 [1], [2] 형태로 인라인에 표시해주세요.",
            "default_persona_id": "default",
            "updated_at": datetime.now().isoformat()
        }
        
        with open(self.settings_file, 'w', encoding='utf-8') as f:
            json.dump(default_settings, f, ensure_ascii=False, indent=2)
        
        print("기본 시스템 설정을 생성했습니다.")
    
    def _load_settings(self) -> dict:
        """시스템 설정을 로드합니다."""
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            print(f"시스템 설정 로드 중 오류: {str(e)}")
            return {}
    
    def _save_settings(self, settings_data: dict):
        """시스템 설정을 저장합니다."""
        try:
            settings_data["updated_at"] = datetime.now().isoformat()
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(settings_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"시스템 설정 저장 중 오류: {str(e)}")
            raise e
    
    async def get_settings(self) -> SystemSettings:
        """시스템 설정을 조회합니다."""
        try:
            settings_data = self._load_settings()
            
            # 필수 키 보정 및 기본값 설정
            changed = False
            if not settings_data:
                self._create_default_settings()
                settings_data = self._load_settings()
            
            if "default_system_message" not in settings_data:
                settings_data["default_system_message"] = (
                    "당신은 도움이 되는 AI 어시스턴트입니다. 정확하고 유용한 정보를 제공하며, 답변할 때 관련된 출처를 [1], [2] 형태로 인라인에 표시해주세요."
                )
                changed = True
            if "default_persona_id" not in settings_data:
                settings_data["default_persona_id"] = "default"
                changed = True
            if changed:
                self._save_settings(settings_data)
            
            return SystemSettings(**settings_data)
            
        except Exception as e:
            print(f"시스템 설정 조회 중 오류: {str(e)}")
            # 오류 시 기본 설정 반환
            return SystemSettings(
                default_system_message="당신은 도움이 되는 AI 어시스턴트입니다.",
                default_persona_id="default",
                updated_at=datetime.now()
            )
    
    async def update_settings(self, request: SystemSettingsUpdateRequest) -> SystemSettings:
        """시스템 설정을 수정합니다."""
        try:
            settings_data = self._load_settings()
            
            # 수정할 필드만 업데이트
            if request.default_system_message is not None:
                settings_data["default_system_message"] = request.default_system_message
            
            if request.default_persona_id is not None:
                settings_data["default_persona_id"] = request.default_persona_id
            
            self._save_settings(settings_data)
            
            return SystemSettings(**settings_data)
            
        except Exception as e:
            print(f"시스템 설정 수정 중 오류: {str(e)}")
            raise e
    
    async def reset_settings(self) -> SystemSettings:
        """시스템 설정을 초기화합니다."""
        try:
            # 기존 설정 파일 삭제
            if os.path.exists(self.settings_file):
                os.remove(self.settings_file)
            
            # 기본 설정 재생성
            self._create_default_settings()
            settings_data = self._load_settings()
            
            return SystemSettings(**settings_data)
            
        except Exception as e:
            print(f"시스템 설정 초기화 중 오류: {str(e)}")
            raise e
    
    async def get_default_system_message(self) -> str:
        """기본 시스템 메시지를 조회합니다."""
        try:
            settings = await self.get_settings()
            return settings.default_system_message
        except Exception as e:
            print(f"기본 시스템 메시지 조회 중 오류: {str(e)}")
            return "당신은 도움이 되는 AI 어시스턴트입니다."
    
    async def get_default_persona_id(self) -> Optional[str]:
        """기본 페르소나 ID를 조회합니다."""
        try:
            settings = await self.get_settings()
            return settings.default_persona_id
        except Exception as e:
            print(f"기본 페르소나 ID 조회 중 오류: {str(e)}")
            return "default"