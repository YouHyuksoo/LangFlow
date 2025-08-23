import sqlite3
import hashlib
import uuid
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
from pydantic import BaseModel, Field
from app.core.config import settings

# Pydantic User 모델 추가
class User(BaseModel):
    user_id: str
    username: str
    email: str
    full_name: Optional[str] = None
    persona: str = "general"
    interest_areas: List[str] = []
    role: str = "user"  # admin 또는 user
    status: str = "pending"  # pending, approved, rejected
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class UserDatabase:
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = os.path.join(settings.DATA_DIR, "db", "users.db")
        self.db_path = db_path
        # Ensure the directory exists
        data_dir = os.path.dirname(self.db_path)
        if not os.path.exists(data_dir):
            os.makedirs(data_dir, exist_ok=True)
        self.init_database()
        self._migrate_database()
    
    def init_database(self):
        """Initialize the users database with required tables"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT,
                    persona TEXT DEFAULT 'general',
                    interest_areas TEXT, -- JSON array of interest areas
                    role TEXT DEFAULT 'user', -- admin 또는 user
                    status TEXT DEFAULT 'pending', -- pending, approved, rejected
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # User sessions table (for simple session management)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
            ''')
            
            # Available personas table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS personas (
                    persona_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    system_message TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Available interest areas table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS interest_areas (
                    area_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    category_ids TEXT, -- JSON array of related category IDs
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.commit()
            self._populate_default_data()
            self._create_default_admin()
    
    def _migrate_database(self):
        """Migrate existing database to add new columns"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Check which columns exist
            cursor.execute("PRAGMA table_info(users)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'role' not in columns:
                print("Adding role column to users table...")
                cursor.execute('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"')
                
                # Update existing admin user to have admin role
                cursor.execute('UPDATE users SET role = "admin" WHERE username = "admin"')
                
                conn.commit()
                print("Role column added.")
            
            if 'status' not in columns:
                print("Adding status column to users table...")
                cursor.execute('ALTER TABLE users ADD COLUMN status TEXT DEFAULT "pending"')
                
                # Update existing admin user to have approved status
                cursor.execute('UPDATE users SET status = "approved" WHERE username = "admin"')
                
                # Update existing non-admin users to approved status (for backward compatibility)
                cursor.execute('UPDATE users SET status = "approved" WHERE role != "admin" OR role IS NULL')
                
                conn.commit()
                print("Status column added.")
                
            if 'avatar_url' not in columns:
                print("Adding avatar_url column to users table...")
                cursor.execute('ALTER TABLE users ADD COLUMN avatar_url TEXT')
                conn.commit()
                print("Avatar_url column added.")
                
            print("✅ 사용자 모델 데이터베이스 마이그레이션 완료")
    
    def _populate_default_data(self):
        """Populate default personas and interest areas"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Check if default data already exists
            cursor.execute("SELECT COUNT(*) FROM personas")
            if cursor.fetchone()[0] == 0:
                # Default personas
                default_personas = [
                    {
                        'persona_id': 'general',
                        'name': '일반',
                        'description': '일반적인 질문에 답하는 기본 페르소나',
                        'system_message': '당신은 도움이 되는 AI 어시스턴트입니다. 사용자의 질문에 정확하고 친절하게 답변해주세요.'
                    },
                    {
                        'persona_id': 'technical',
                        'name': '기술 전문가',
                        'description': '기술적인 질문에 특화된 페르소나',
                        'system_message': '당신은 기술 전문가입니다. 복잡한 기술적 문제를 해결하고 상세한 설명을 제공해주세요.'
                    },
                    {
                        'persona_id': 'friendly',
                        'name': '친근한 도우미',
                        'description': '친근하고 대화형 스타일의 페르소나',
                        'system_message': '당신은 친근하고 대화하기 좋은 AI 어시스턴트입니다. 편안한 톤으로 도움을 제공해주세요.'
                    }
                ]
                
                for persona in default_personas:
                    cursor.execute('''
                        INSERT INTO personas (persona_id, name, description, system_message)
                        VALUES (?, ?, ?, ?)
                    ''', (persona['persona_id'], persona['name'], persona['description'], persona['system_message']))
            
            # Check if default interest areas exist
            cursor.execute("SELECT COUNT(*) FROM interest_areas")
            if cursor.fetchone()[0] == 0:
                # Default interest areas
                default_areas = [
                    {
                        'area_id': 'quality',
                        'name': '품질관리',
                        'description': '품질 관련 문서 및 프로세스',
                        'category_ids': '[]'
                    },
                    {
                        'area_id': 'hr',
                        'name': '인사',
                        'description': '인사 관련 정책 및 절차',
                        'category_ids': '[]'
                    },
                    {
                        'area_id': 'manufacturing',
                        'name': '제조',
                        'description': '제조 공정 및 기술 문서',
                        'category_ids': '[]'
                    },
                    {
                        'area_id': 'finance',
                        'name': '재무',
                        'description': '재무 관련 규정 및 절차',
                        'category_ids': '[]'
                    }
                ]
                
                for area in default_areas:
                    cursor.execute('''
                        INSERT INTO interest_areas (area_id, name, description, category_ids)
                        VALUES (?, ?, ?, ?)
                    ''', (area['area_id'], area['name'], area['description'], area['category_ids']))
            
            conn.commit()
    
    def _create_default_admin(self):
        """Create default admin user if not exists"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Check if admin user already exists
            cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
            if cursor.fetchone()[0] == 0:
                # Create default admin user
                admin_id = str(uuid.uuid4())
                password_hash = self._hash_password("admin123")
                interest_areas_json = json.dumps(["quality", "hr", "manufacturing", "finance"])
                
                cursor.execute('''
                    INSERT INTO users (user_id, username, email, password_hash, full_name, persona, interest_areas, role)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (admin_id, "admin", "admin@company.com", password_hash, "관리자", "general", interest_areas_json, "admin"))
                
                print("기본 관리자 계정이 생성되었습니다:")
                print("사용자명: admin")
                print("비밀번호: admin123")
                print("이메일: admin@company.com")
                
                conn.commit()
    
    def create_user(self, username: str, email: str, password: str, full_name: str = None, 
                   persona: str = 'general', interest_areas: List[str] = None, role: str = 'user', status: str = 'pending') -> str:
        """Create a new user"""
        user_id = str(uuid.uuid4())
        password_hash = self._hash_password(password)
        interest_areas_json = json.dumps(interest_areas or [])
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO users (user_id, username, email, password_hash, full_name, persona, interest_areas, role, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, username, email, password_hash, full_name, persona, interest_areas_json, role, status))
            conn.commit()
        
        return user_id
    
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE user_id = ? AND is_active = TRUE', (user_id,))
            row = cursor.fetchone()
            
            if row:
                user = dict(row)
                user['interest_areas'] = json.loads(user['interest_areas'] or '[]')
                return user
        return None
    
    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Get user by username"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE username = ? AND is_active = TRUE', (username,))
            row = cursor.fetchone()
            
            if row:
                user = dict(row)
                user['interest_areas'] = json.loads(user['interest_areas'] or '[]')
                return user
        return None
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE email = ? AND is_active = TRUE', (email,))
            row = cursor.fetchone()
            
            if row:
                user = dict(row)
                user['interest_areas'] = json.loads(user['interest_areas'] or '[]')
                return user
        return None
    
    def get_all_users(self) -> List[Dict[str, Any]]:
        """Get all users"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users ORDER BY created_at DESC')
            rows = cursor.fetchall()
            
            users = []
            for row in rows:
                user = dict(row)
                user['interest_areas'] = json.loads(user['interest_areas'] or '[]')
                users.append(user)
            
            return users
    
    def update_user(self, user_id: str, **kwargs) -> bool:
        """Update user information"""
        if not kwargs:
            return False
        
        # Handle interest_areas JSON serialization
        if 'interest_areas' in kwargs:
            kwargs['interest_areas'] = json.dumps(kwargs['interest_areas'])
        
        # Handle password hashing
        if 'password' in kwargs:
            kwargs['password_hash'] = self._hash_password(kwargs['password'])
            del kwargs['password']
        
        # Add updated_at timestamp
        kwargs['updated_at'] = datetime.now().isoformat()
        
        # Build dynamic update query
        set_clause = ', '.join([f"{key} = ?" for key in kwargs.keys()])
        values = list(kwargs.values()) + [user_id]
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(f'UPDATE users SET {set_clause} WHERE user_id = ?', values)
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_user(self, user_id: str) -> bool:
        """Soft delete user (set is_active to False)"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE users SET is_active = FALSE, updated_at = ? WHERE user_id = ?', 
                         (datetime.now().isoformat(), user_id))
            conn.commit()
            return cursor.rowcount > 0
    
    def verify_password(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Verify user password and return user info if valid"""
        user = self.get_user_by_username(username)
        if user and self._verify_password(password, user['password_hash']):
            # Check if user is approved (admin users are always approved)
            if user.get('status') == 'approved' or user.get('role') == 'admin':
                # Remove password hash from returned user data
                del user['password_hash']
                return user
        return None
    
    def create_session(self, user_id: str) -> str:
        """Create a new user session"""
        session_id = str(uuid.uuid4())
        expires_at = datetime.now().replace(hour=23, minute=59, second=59).isoformat()  # Expires at end of day
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO user_sessions (session_id, user_id, expires_at)
                VALUES (?, ?, ?)
            ''', (session_id, user_id, expires_at))
            conn.commit()
        
        return session_id
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session info"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('''
                SELECT s.*, u.username, u.full_name, u.persona, u.interest_areas, u.role
                FROM user_sessions s
                JOIN users u ON s.user_id = u.user_id
                WHERE s.session_id = ? AND s.is_active = TRUE AND s.expires_at > datetime('now')
            ''', (session_id,))
            row = cursor.fetchone()
            
            if row:
                session = dict(row)
                session['interest_areas'] = json.loads(session['interest_areas'] or '[]')
                return session
        return None
    
    def invalidate_session(self, session_id: str) -> bool:
        """Invalidate a session"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE user_sessions SET is_active = FALSE WHERE session_id = ?', (session_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    def get_personas(self) -> List[Dict[str, Any]]:
        """Get all available personas"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM personas WHERE is_active = TRUE ORDER BY name')
            return [dict(row) for row in cursor.fetchall()]
    
    def get_interest_areas(self) -> List[Dict[str, Any]]:
        """Get all available interest areas"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM interest_areas WHERE is_active = TRUE ORDER BY name')
            areas = []
            for row in cursor.fetchall():
                area = dict(row)
                area['category_ids'] = json.loads(area['category_ids'] or '[]')
                areas.append(area)
            return areas
    
    def create_persona(self, name: str, description: str = None, system_message: str = None) -> str:
        """Create a new persona"""
        persona_id = str(uuid.uuid4())
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO personas (persona_id, name, description, system_message)
                VALUES (?, ?, ?, ?)
            ''', (persona_id, name, description, system_message))
            conn.commit()
        
        return persona_id
    
    def create_interest_area(self, name: str, description: str = None, category_ids: List[str] = None) -> str:
        """Create a new interest area"""
        area_id = str(uuid.uuid4())
        category_ids_json = json.dumps(category_ids or [])
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO interest_areas (area_id, name, description, category_ids)
                VALUES (?, ?, ?, ?)
            ''', (area_id, name, description, category_ids_json))
            conn.commit()
        
        return area_id
    
    def update_persona(self, persona_id: str, persona_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update persona"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Build dynamic update query
            set_clause = ', '.join([f"{key} = ?" for key in persona_data.keys()])
            values = list(persona_data.values()) + [persona_id]
            
            cursor.execute(f'UPDATE personas SET {set_clause} WHERE persona_id = ?', values)
            conn.commit()
            
            if cursor.rowcount > 0:
                # Return updated persona
                cursor.execute('SELECT * FROM personas WHERE persona_id = ?', (persona_id,))
                row = cursor.fetchone()
                if row:
                    return dict(row)
        
        return None

    def delete_persona(self, persona_id: str) -> bool:
        """Delete persona (soft delete)"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE personas SET is_active = FALSE WHERE persona_id = ?', (persona_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    def delete_interest_area(self, area_id: str) -> bool:
        """Delete interest area (soft delete)"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE interest_areas SET is_active = FALSE WHERE area_id = ?', (area_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    def _hash_password(self, password: str) -> str:
        """Hash password using SHA-256"""
        return hashlib.sha256(password.encode('utf-8')).hexdigest()
    
    def _verify_password(self, password: str, password_hash: str) -> bool:
        """Verify password against hash"""
        return hashlib.sha256(password.encode('utf-8')).hexdigest() == password_hash
    
    def get_pending_users(self) -> List[Dict[str, Any]]:
        """Get all pending approval users"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE status = "pending" ORDER BY created_at DESC')
            rows = cursor.fetchall()
            
            users = []
            for row in rows:
                user = dict(row)
                # Parse interest_areas JSON
                if user['interest_areas']:
                    try:
                        user['interest_areas'] = json.loads(user['interest_areas'])
                    except json.JSONDecodeError:
                        user['interest_areas'] = []
                else:
                    user['interest_areas'] = []
                users.append(user)
            
            return users
    
    def approve_user(self, user_id: str) -> bool:
        """Approve a pending user"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE users 
                SET status = "approved", updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = ? AND status = "pending"
            ''', (user_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    def reject_user(self, user_id: str) -> bool:
        """Reject a pending user"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE users 
                SET status = "rejected", updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = ? AND status = "pending"
            ''', (user_id,))
            conn.commit()
            return cursor.rowcount > 0
    
    def get_users_by_status(self, status: str) -> List[Dict[str, Any]]:
        """Get users by status"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE status = ? ORDER BY created_at DESC', (status,))
            rows = cursor.fetchall()
            
            users = []
            for row in rows:
                user = dict(row)
                # Parse interest_areas JSON
                if user['interest_areas']:
                    try:
                        user['interest_areas'] = json.loads(user['interest_areas'])
                    except json.JSONDecodeError:
                        user['interest_areas'] = []
                else:
                    user['interest_areas'] = []
                users.append(user)
            
            return users


# Global database instance
user_db = UserDatabase()