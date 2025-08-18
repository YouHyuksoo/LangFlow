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
        
        # 수동 전처리 워크스페이스 테이블들 생성
        # preprocessing_runs 테이블
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS preprocessing_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'NOT_STARTED', -- NOT_STARTED, IN_PROGRESS, COMPLETED, FAILED
            started_at DATETIME,
            completed_at DATETIME,
            processing_time REAL DEFAULT 0.0,
            error_message TEXT,
            error_details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(file_id)
        )
        """)
        
        # annotations 테이블
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS annotations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            order_index INTEGER NOT NULL DEFAULT 0,
            label TEXT NOT NULL DEFAULT '',
            annotation_type TEXT NOT NULL DEFAULT 'paragraph',
            coordinates TEXT, -- JSON 형태로 저장: {"x": 0, "y": 0, "width": 0, "height": 0}
            ocr_text TEXT,
            extracted_text TEXT,
            processing_options TEXT, -- JSON 형태로 저장
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (run_id) REFERENCES preprocessing_runs (id) ON DELETE CASCADE
        )
        """)
        
        # annotation_relationships 테이블
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS annotation_relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            from_annotation_id INTEGER NOT NULL,
            to_annotation_id INTEGER NOT NULL,
            relationship_type TEXT NOT NULL DEFAULT 'connects_to',
            description TEXT,
            weight REAL DEFAULT 1.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (run_id) REFERENCES preprocessing_runs (id) ON DELETE CASCADE,
            FOREIGN KEY (from_annotation_id) REFERENCES annotations (id) ON DELETE CASCADE,
            FOREIGN KEY (to_annotation_id) REFERENCES annotations (id) ON DELETE CASCADE
        )
        """)
        
        print("Database initialized with chat_history and manual preprocessing tables ready.")
        conn.commit()
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    initialize_database()
