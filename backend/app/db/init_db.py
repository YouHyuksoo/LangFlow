import sqlite3
import os
from app.core.config import settings

def initialize_database():
    """
    데이터베이스를 초기화하고 chat_history 테이블을 생성합니다.
    """
    db_path = os.path.join(settings.DATA_DIR, "db", "users.db")
    
    # data 디렉토리가 없으면 생성
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # chat_history 테이블 생성 (IF NOT EXISTS 사용)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            query TEXT NOT NULL,
            response TEXT,
            category TEXT,
            relevance_score REAL,
            feedback TEXT, -- 'like', 'dislike', or NULL
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id TEXT,
            flow_id TEXT,
            response_time REAL 
        )
        """)
        
        print("Database initialized and 'chat_history' table is ready.")
        conn.commit()
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    initialize_database()
