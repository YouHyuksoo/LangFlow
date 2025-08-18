import os
import json
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from ..core.config import settings
from ..models.schemas import ModelProfile, ModelProfileCreateRequest, ModelProfileUpdateRequest

class ModelProfileService:
    """모델 프로필 관리 서비스"""
    
    def __init__(self):
        self.profiles_file = os.path.join(settings.DATA_DIR, "model_profiles.json")
        self._ensure_data_dir()
        self._load_profiles()
    
    def _ensure_data_dir(self):
        """데이터 디렉토리 생성"""
        os.makedirs(settings.DATA_DIR, exist_ok=True)
    
    def _load_profiles(self):
        """프로필 파일에서 데이터 로드"""
        if os.path.exists(self.profiles_file):
            try:
                with open(self.profiles_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.profiles = {
                        profile_id: ModelProfile(**profile_data) 
                        for profile_id, profile_data in data.get("profiles", {}).items()
                    }
                    self.active_profile_id = data.get("active_profile_id")
            except Exception as e:
                print(f"프로필 로드 실패: {e}")
                self.profiles = {}
                self.active_profile_id = None
        else:
            self.profiles = {}
            self.active_profile_id = None
    
    def _save_profiles(self):
        """프로필을 파일에 저장"""
        try:
            data = {
                "profiles": {
                    profile_id: profile.dict() 
                    for profile_id, profile in self.profiles.items()
                },
                "active_profile_id": self.active_profile_id
            }
            with open(self.profiles_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            print(f"프로필 저장 실패: {e}")
            raise e
    
    def create_profile(self, request: ModelProfileCreateRequest) -> ModelProfile:
        """새 모델 프로필 생성"""
        profile_id = str(uuid.uuid4())
        now = datetime.now()
        
        profile = ModelProfile(
            id=profile_id,
            name=request.name,
            provider=request.provider,
            model=request.model,
            api_key=request.api_key,
            base_url=request.base_url,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            top_p=request.top_p,
            is_active=len(self.profiles) == 0,  # 첫 번째 프로필은 자동으로 활성화
            created_at=now,
            updated_at=now
        )
        
        self.profiles[profile_id] = profile
        
        # 첫 번째 프로필인 경우 활성화
        if len(self.profiles) == 1:
            self.active_profile_id = profile_id
            profile.is_active = True
        
        self._save_profiles()
        return profile
    
    def get_profiles(self) -> List[ModelProfile]:
        """모든 프로필 조회"""
        return list(self.profiles.values())
    
    def get_profile(self, profile_id: str) -> Optional[ModelProfile]:
        """특정 프로필 조회"""
        return self.profiles.get(profile_id)
    
    def get_active_profile(self) -> Optional[ModelProfile]:
        """활성 프로필 조회"""
        if self.active_profile_id and self.active_profile_id in self.profiles:
            return self.profiles[self.active_profile_id]
        return None
    
    def update_profile(self, profile_id: str, request: ModelProfileUpdateRequest) -> ModelProfile:
        """프로필 수정"""
        if profile_id not in self.profiles:
            raise ValueError(f"프로필을 찾을 수 없습니다: {profile_id}")
        
        profile = self.profiles[profile_id]
        
        # 수정 가능한 필드만 업데이트
        if request.name is not None:
            profile.name = request.name
        if request.api_key is not None:
            profile.api_key = request.api_key
        if request.base_url is not None:
            profile.base_url = request.base_url
        if request.temperature is not None:
            profile.temperature = request.temperature
        if request.max_tokens is not None:
            profile.max_tokens = request.max_tokens
        if request.top_p is not None:
            profile.top_p = request.top_p
        
        profile.updated_at = datetime.now()
        
        self._save_profiles()
        return profile
    
    def delete_profile(self, profile_id: str) -> bool:
        """프로필 삭제"""
        if profile_id not in self.profiles:
            return False
        
        # 활성 프로필인 경우 다른 프로필을 활성화
        if self.active_profile_id == profile_id:
            remaining_profiles = [pid for pid in self.profiles.keys() if pid != profile_id]
            if remaining_profiles:
                self.set_active_profile(remaining_profiles[0])
            else:
                self.active_profile_id = None
        
        del self.profiles[profile_id]
        self._save_profiles()
        return True
    
    def set_active_profile(self, profile_id: str) -> bool:
        """활성 프로필 설정"""
        if profile_id not in self.profiles:
            return False
        
        # 기존 활성 프로필 비활성화
        if self.active_profile_id and self.active_profile_id in self.profiles:
            self.profiles[self.active_profile_id].is_active = False
        
        # 새 프로필 활성화
        self.active_profile_id = profile_id
        self.profiles[profile_id].is_active = True
        
        self._save_profiles()
        return True
    
    def get_active_profile_for_chat(self) -> Dict[str, Any]:
        """채팅 서비스용 활성 프로필 설정 반환"""
        active_profile = self.get_active_profile()
        if not active_profile:
            # 기본값 반환
            return {
                "llm_provider": "openai",
                "llm_model": "gpt-4o-mini",
                "llm_api_key": "",
                "llm_temperature": 0.7,
                "llm_max_tokens": 2000,
                "llm_top_p": 1.0
            }
        
        return {
            "llm_provider": active_profile.provider,
            "llm_model": active_profile.model,
            "llm_api_key": active_profile.api_key if active_profile.provider == "openai" else "",
            "google_api_key": active_profile.api_key if active_profile.provider == "google" else "",
            "anthropic_api_key": active_profile.api_key if active_profile.provider == "anthropic" else "",
            "llm_temperature": active_profile.temperature,
            "llm_max_tokens": active_profile.max_tokens,
            "llm_top_p": active_profile.top_p,
            "llm_base_url": active_profile.base_url
        }

# 싱글톤 인스턴스
model_profile_service = ModelProfileService()