import json
import os
from typing import Optional, Dict, Any, List
from ..core.config import settings
from ..models.user_models import User

class UserService:
    def __init__(self):
        self.users_file = os.path.join(
            settings.DATA_DIR, 
            'users.json'
        )
        self.sessions_file = os.path.join(
            settings.DATA_DIR, 
            'sessions.json'
        )
    
    async def get_user_by_session(self, session_id: str) -> Optional[User]:
        """세션 ID로 사용자 정보를 조회합니다."""
        try:
            # 세션 정보 로드
            if not os.path.exists(self.sessions_file):
                return None
            
            with open(self.sessions_file, 'r', encoding='utf-8') as f:
                sessions = json.load(f)
            
            # 세션에서 사용자 ID 찾기
            user_id = sessions.get(session_id)
            if not user_id:
                return None
            
            # 사용자 정보 조회
            return await self.get_user_by_id(user_id)
            
        except Exception as e:
            print(f"세션 기반 사용자 조회 오류: {str(e)}")
            return None
    
    async def get_user_by_id(self, user_id: str) -> Optional[User]:
        """사용자 ID로 사용자 정보를 조회합니다."""
        try:
            if not os.path.exists(self.users_file):
                return None
            
            with open(self.users_file, 'r', encoding='utf-8') as f:
                users = json.load(f)
            
            user_data = users.get(user_id)
            if not user_data:
                return None
            
            return User(**user_data)
            
        except Exception as e:
            print(f"사용자 조회 오류: {str(e)}")
            return None
    
    async def create_session(self, user_id: str) -> str:
        """사용자 세션을 생성합니다."""
        try:
            # 세션 ID 생성
            import uuid
            session_id = str(uuid.uuid4())
            
            # 세션 정보 로드
            sessions = {}
            if os.path.exists(self.sessions_file):
                with open(self.sessions_file, 'r', encoding='utf-8') as f:
                    sessions = json.load(f)
            
            # 새 세션 추가
            sessions[session_id] = user_id
            
            # 세션 저장
            with open(self.sessions_file, 'w', encoding='utf-8') as f:
                json.dump(sessions, f, ensure_ascii=False, indent=2)
            
            return session_id
            
        except Exception as e:
            print(f"세션 생성 오류: {str(e)}")
            raise
    
    async def delete_session(self, session_id: str):
        """사용자 세션을 삭제합니다."""
        try:
            if not os.path.exists(self.sessions_file):
                return
            
            with open(self.sessions_file, 'r', encoding='utf-8') as f:
                sessions = json.load(f)
            
            if session_id in sessions:
                del sessions[session_id]
                
                with open(self.sessions_file, 'w', encoding='utf-8') as f:
                    json.dump(sessions, f, ensure_ascii=False, indent=2)
                    
        except Exception as e:
            print(f"세션 삭제 오류: {str(e)}")
    
    async def get_all_users(self) -> List[User]:
        """모든 사용자 목록을 조회합니다."""
        try:
            if not os.path.exists(self.users_file):
                return []
            
            with open(self.users_file, 'r', encoding='utf-8') as f:
                users_data = json.load(f)
            
            return [User(**user_data) for user_data in users_data.values()]
            
        except Exception as e:
            print(f"사용자 목록 조회 오류: {str(e)}")
            return []
    
    async def create_user(self, user_data: Dict[str, Any]) -> User:
        """새 사용자를 생성합니다."""
        try:
            # 사용자 ID 생성
            import uuid
            user_id = str(uuid.uuid4())
            
            # 사용자 정보 로드
            users = {}
            if os.path.exists(self.users_file):
                with open(self.users_file, 'r', encoding='utf-8') as f:
                    users = json.load(f)
            
            # 새 사용자 추가
            user_data['user_id'] = user_id
            users[user_id] = user_data
            
            # 사용자 정보 저장
            with open(self.users_file, 'w', encoding='utf-8') as f:
                json.dump(users, f, ensure_ascii=False, indent=2)
            
            return User(**user_data)
            
        except Exception as e:
            print(f"사용자 생성 오류: {str(e)}")
            raise
    
    async def update_user(self, user_id: str, user_data: Dict[str, Any]) -> Optional[User]:
        """사용자 정보를 업데이트합니다."""
        try:
            if not os.path.exists(self.users_file):
                return None
            
            with open(self.users_file, 'r', encoding='utf-8') as f:
                users = json.load(f)
            
            if user_id not in users:
                return None
            
            # 사용자 정보 업데이트
            users[user_id].update(user_data)
            users[user_id]['user_id'] = user_id
            
            # 저장
            with open(self.users_file, 'w', encoding='utf-8') as f:
                json.dump(users, f, ensure_ascii=False, indent=2)
            
            return User(**users[user_id])
            
        except Exception as e:
            print(f"사용자 업데이트 오류: {str(e)}")
            return None
    
    async def delete_user(self, user_id: str) -> bool:
        """사용자를 삭제합니다."""
        try:
            if not os.path.exists(self.users_file):
                return False
            
            with open(self.users_file, 'r', encoding='utf-8') as f:
                users = json.load(f)
            
            if user_id not in users:
                return False
            
            # 사용자 삭제
            del users[user_id]
            
            # 저장
            with open(self.users_file, 'w', encoding='utf-8') as f:
                json.dump(users, f, ensure_ascii=False, indent=2)
            
            return True
            
        except Exception as e:
            print(f"사용자 삭제 오류: {str(e)}")
            return False 