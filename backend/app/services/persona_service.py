import os
import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from ..models.schemas import Persona, PersonaCreateRequest
from ..core.config import settings

class PersonaService:
    def __init__(self):
        self.personas_file = os.path.join(settings.DATA_DIR, "personas.json")
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        
        # 기본 페르소나들로 초기화
        if not os.path.exists(self.personas_file):
            self._create_default_personas()
    
    def _create_default_personas(self):
        """기본 페르소나들을 생성합니다."""
        default_personas = [
            {
                "persona_id": "default",
                "name": "기본 어시스턴트",
                "description": "일반적인 질문에 도움을 주는 기본 AI 어시스턴트입니다.",
                "system_message": "당신은 도움이 되는 AI 어시스턴트입니다. 정확하고 유용한 정보를 제공하며, 답변할 때 관련된 출처를 [1], [2] 형태로 인라인에 표시해주세요.",
                "is_active": True,
                "created_at": datetime.now().isoformat()
            },
            {
                "persona_id": "professional",
                "name": "전문 업무 도우미",
                "description": "전문적인 업무 환경에 특화된 AI 어시스턴트입니다.",
                "system_message": "당신은 전문적인 업무 지원 AI입니다. 정확하고 신뢰할 수 있는 정보를 제공하며, 비즈니스 환경에 적합한 공식적인 톤으로 답변해주세요. 답변 시 출처를 [1], [2] 형태로 명확히 표시해주세요.",
                "is_active": True,
                "created_at": datetime.now().isoformat()
            },
            {
                "persona_id": "friendly",
                "name": "친근한 도우미",
                "description": "편안하고 친근한 톤으로 소통하는 AI 어시스턴트입니다.",
                "system_message": "당신은 친근하고 따뜻한 AI 도우미입니다. 편안하고 이해하기 쉬운 방식으로 답변하며, 사용자와 자연스럽게 소통해주세요. 답변할 때 관련 출처를 [1], [2] 형태로 표시해주세요.",
                "is_active": True,
                "created_at": datetime.now().isoformat()
            },
            {
                "persona_id": "technical",
                "name": "기술 전문가",
                "description": "기술적인 질문에 전문적으로 답변하는 AI입니다.",
                "system_message": "당신은 기술 분야의 전문가 AI입니다. 기술적인 내용을 정확하고 체계적으로 설명하며, 필요시 단계별 가이드를 제공해주세요. 기술 문서나 매뉴얼을 참조할 때는 출처를 [1], [2] 형태로 명시해주세요.",
                "is_active": True,
                "created_at": datetime.now().isoformat()
            }
        ]
        
        with open(self.personas_file, 'w', encoding='utf-8') as f:
            json.dump(default_personas, f, ensure_ascii=False, indent=2)
        
        print(f"기본 페르소나 {len(default_personas)}개를 생성했습니다.")
    
    def _load_personas(self) -> List[Dict[str, Any]]:
        """페르소나 데이터를 로드합니다."""
        try:
            if os.path.exists(self.personas_file):
                with open(self.personas_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return []
        except Exception as e:
            print(f"페르소나 데이터 로드 중 오류: {str(e)}")
            return []
    
    def _save_personas(self, personas: List[Dict[str, Any]]):
        """페르소나 데이터를 저장합니다."""
        try:
            with open(self.personas_file, 'w', encoding='utf-8') as f:
                json.dump(personas, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"페르소나 데이터 저장 중 오류: {str(e)}")
            raise e
    
    async def list_personas(self) -> List[Persona]:
        """모든 페르소나 목록을 조회합니다."""
        try:
            personas_data = self._load_personas()
            personas = []
            
            for data in personas_data:
                personas.append(Persona(**data))
            
            # 생성 시간 순으로 정렬 (최신순)
            personas.sort(key=lambda x: x.created_at, reverse=True)
            return personas
            
        except Exception as e:
            print(f"페르소나 목록 조회 중 오류: {str(e)}")
            return []
    
    async def get_persona(self, persona_id: str) -> Optional[Persona]:
        """특정 페르소나를 조회합니다."""
        try:
            personas_data = self._load_personas()
            
            for data in personas_data:
                if data.get("persona_id") == persona_id:
                    return Persona(**data)
            
            return None
            
        except Exception as e:
            print(f"페르소나 조회 중 오류: {str(e)}")
            return None
    
    async def create_persona(self, request: PersonaCreateRequest) -> Persona:
        """새 페르소나를 생성합니다."""
        try:
            personas_data = self._load_personas()
            
            # 고유 ID 생성
            persona_id = str(uuid.uuid4())[:8]
            
            # 새 페르소나 데이터 생성
            persona_data = {
                "persona_id": persona_id,
                "name": request.name,
                "description": request.description,
                "system_message": request.system_message,
                "is_active": True,
                "created_at": datetime.now().isoformat()
            }
            
            personas_data.append(persona_data)
            self._save_personas(personas_data)
            
            return Persona(**persona_data)
            
        except Exception as e:
            print(f"페르소나 생성 중 오류: {str(e)}")
            raise e
    
    async def update_persona(self, persona_id: str, request: PersonaCreateRequest) -> Optional[Persona]:
        """페르소나를 수정합니다."""
        try:
            personas_data = self._load_personas()
            
            for i, data in enumerate(personas_data):
                if data.get("persona_id") == persona_id:
                    # 수정할 필드 업데이트
                    if request.name is not None:
                        data["name"] = request.name
                    if request.description is not None:
                        data["description"] = request.description
                    if request.system_message is not None:
                        data["system_message"] = request.system_message
                    
                    personas_data[i] = data
                    self._save_personas(personas_data)
                    
                    return Persona(**data)
            
            return None
            
        except Exception as e:
            print(f"페르소나 수정 중 오류: {str(e)}")
            raise e
    
    async def delete_persona(self, persona_id: str) -> bool:
        """페르소나를 삭제합니다."""
        try:
            # 기본 페르소나는 삭제 불가
            if persona_id == "default":
                raise ValueError("기본 페르소나는 삭제할 수 없습니다.")
            
            personas_data = self._load_personas()
            
            for i, data in enumerate(personas_data):
                if data.get("persona_id") == persona_id:
                    personas_data.pop(i)
                    self._save_personas(personas_data)
                    return True
            
            return False
            
        except Exception as e:
            print(f"페르소나 삭제 중 오류: {str(e)}")
            raise e
    
    async def toggle_persona_status(self, persona_id: str) -> Optional[Persona]:
        """페르소나 활성/비활성 상태를 토글합니다."""
        try:
            personas_data = self._load_personas()
            
            for i, data in enumerate(personas_data):
                if data.get("persona_id") == persona_id:
                    data["is_active"] = not data.get("is_active", True)
                    personas_data[i] = data
                    self._save_personas(personas_data)
                    
                    return Persona(**data)
            
            return None
            
        except Exception as e:
            print(f"페르소나 상태 변경 중 오류: {str(e)}")
            raise e
    
    async def get_active_personas(self) -> List[Persona]:
        """활성화된 페르소나 목록을 조회합니다."""
        try:
            all_personas = await self.list_personas()
            return [p for p in all_personas if p.is_active]
            
        except Exception as e:
            print(f"활성 페르소나 조회 중 오류: {str(e)}")
            return []