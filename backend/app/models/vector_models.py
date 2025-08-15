"""
벡터 메타데이터를 위한 SQLite 데이터베이스 모델
"""
from sqlmodel import SQLModel, Field, create_engine, Session
from sqlalchemy import text
from typing import Optional, Dict, Any
from datetime import datetime
import json
import os
from ..core.config import settings


class VectorMetadata(SQLModel, table=True):
    """벡터 메타데이터 테이블"""
    __tablename__ = "vector_metadata"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    file_id: str = Field(index=True, unique=True)
    filename: str
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    flow_id: Optional[str] = None
    processing_method: str = Field(default="basic_text")
    processing_time: float = Field(default=0.0)
    chunk_count: int = Field(default=0)
    file_size: int = Field(default=0)
    page_count: Optional[int] = None
    table_count: Optional[int] = None
    image_count: Optional[int] = None
    docling_options: Optional[str] = None  # JSON string for docling options
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    def set_docling_options(self, options: Dict[str, Any]):
        """Docling 옵션을 JSON 문자열로 저장"""
        self.docling_options = json.dumps(options) if options else None
    
    def get_docling_options(self) -> Optional[Dict[str, Any]]:
        """Docling 옵션을 딕셔너리로 반환"""
        if self.docling_options:
            try:
                return json.loads(self.docling_options)
            except json.JSONDecodeError:
                return None
        return None


class VectorMetadataService:
    """벡터 메타데이터 SQLite 서비스"""
    
    def __init__(self):
        # SQLite 데이터베이스 파일 경로
        self.db_path = os.path.join(settings.DATA_DIR, 'vectors', 'metadata.db')
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        # SQLite 엔진 생성 (WAL 모드로 동시성 개선)
        self.engine = create_engine(
            f"sqlite:///{self.db_path}",
            connect_args={
                "check_same_thread": False,
                "timeout": 30.0
            }
        )
        
        # WAL 모드 및 기타 pragma 설정을 별도로 실행
        with self.engine.connect() as conn:
            conn.execute(text("PRAGMA journal_mode=WAL"))
            conn.execute(text("PRAGMA synchronous=NORMAL"))
            conn.execute(text("PRAGMA cache_size=-64000"))
            conn.execute(text("PRAGMA foreign_keys=ON"))
            conn.commit()
        
        # 테이블 생성
        SQLModel.metadata.create_all(self.engine)
        print(f"Vector metadata database initialized: {self.db_path}")
    
    def create_metadata(self, metadata: VectorMetadata) -> bool:
        """메타데이터 생성"""
        try:
            with Session(self.engine) as session:
                session.add(metadata)
                session.commit()
                session.refresh(metadata)
                return True
        except Exception as e:
            print(f"메타데이터 생성 실패: {e}")
            return False
    
    def get_metadata(self, file_id: str) -> Optional[VectorMetadata]:
        """파일 ID로 메타데이터 조회"""
        try:
            with Session(self.engine) as session:
                return session.query(VectorMetadata).filter(
                    VectorMetadata.file_id == file_id
                ).first()
        except Exception as e:
            print(f"메타데이터 조회 실패: {e}")
            return None
    
    def update_metadata(self, file_id: str, **kwargs) -> bool:
        """메타데이터 업데이트"""
        try:
            with Session(self.engine) as session:
                metadata = session.query(VectorMetadata).filter(
                    VectorMetadata.file_id == file_id
                ).first()
                
                if metadata:
                    for key, value in kwargs.items():
                        if hasattr(metadata, key):
                            setattr(metadata, key, value)
                    
                    metadata.updated_at = datetime.now()
                    session.commit()
                    return True
                return False
        except Exception as e:
            print(f"메타데이터 업데이트 실패: {e}")
            return False
    
    def delete_metadata(self, file_id: str) -> bool:
        """메타데이터 삭제"""
        try:
            with Session(self.engine) as session:
                metadata = session.query(VectorMetadata).filter(
                    VectorMetadata.file_id == file_id
                ).first()
                
                if metadata:
                    session.delete(metadata)
                    session.commit()
                    return True
                return False
        except Exception as e:
            print(f"메타데이터 삭제 실패: {e}")
            return False
    
    def list_all_metadata(self) -> list[VectorMetadata]:
        """모든 메타데이터 조회"""
        try:
            with Session(self.engine) as session:
                return session.query(VectorMetadata).all()
        except Exception as e:
            print(f"메타데이터 목록 조회 실패: {e}")
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """통계 정보 조회"""
        try:
            with Session(self.engine) as session:
                total_files = session.query(VectorMetadata).count()
                total_chunks = session.query(
                    session.query(VectorMetadata.chunk_count).label('sum')
                ).scalar() or 0
                
                # 처리 방법별 통계
                processing_methods = session.query(
                    VectorMetadata.processing_method,
                    session.query(VectorMetadata.processing_method).count()
                ).group_by(VectorMetadata.processing_method).all()
                
                return {
                    "total_files": total_files,
                    "total_chunks": total_chunks,
                    "processing_methods": dict(processing_methods),
                    "database_path": self.db_path
                }
        except Exception as e:
            print(f"통계 조회 실패: {e}")
            return {
                "total_files": 0,
                "total_chunks": 0,
                "processing_methods": {},
                "database_path": self.db_path
            }

    def reset_database(self) -> bool:
        """메타데이터 데이터베이스를 완전히 초기화합니다."""
        try:
            # 엔진 연결 해제
            try:
                self.engine.dispose()
            except Exception:
                pass

            # DB 파일 삭제 (잠금 회피를 위해 재시도)
            if os.path.exists(self.db_path):
                import time
                for attempt in range(6):  # 최대 약 3초 대기 (0.5s * 6)
                    try:
                        os.remove(self.db_path)
                        break
                    except PermissionError:
                        time.sleep(0.5)
                    except Exception:
                        # 기타 예외도 동일 재시도 (Windows 잠금 변형 케이스)
                        time.sleep(0.5)
            # WAL/SHM 사이드카 파일도 삭제 (Windows 잠금 이슈 방지)
            wal_path = f"{self.db_path}-wal"
            shm_path = f"{self.db_path}-shm"
            for side_file in (wal_path, shm_path):
                try:
                    if os.path.exists(side_file):
                        os.remove(side_file)
                except Exception:
                    # 사이드카가 없거나 이미 닫혔으면 무시
                    pass

            # 디렉터리 보장 후 엔진 재생성 및 테이블 재생성
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            self.engine = create_engine(
                f"sqlite:///{self.db_path}",
                connect_args={
                    "check_same_thread": False,
                    "timeout": 30.0
                }
            )
            with self.engine.connect() as conn:
                conn.execute(text("PRAGMA journal_mode=WAL"))
                conn.execute(text("PRAGMA synchronous=NORMAL"))
                conn.execute(text("PRAGMA cache_size=-64000"))
                conn.execute(text("PRAGMA foreign_keys=ON"))
                conn.commit()

            SQLModel.metadata.create_all(self.engine)
            print("Vector metadata database reset completed")
            return True
        except Exception as e:
            print(f"메타데이터 데이터베이스 초기화 실패: {e}")
            return False

    def clear_all(self) -> int:
        """데이터 파일은 유지하고 모든 메타데이터 레코드만 삭제합니다."""
        try:
            with Session(self.engine) as session:
                # 삭제 전 레코드 수 확인
                count = session.query(VectorMetadata).count()
                
                # 모든 레코드 삭제
                session.query(VectorMetadata).delete()
                session.commit()
                
                print(f"메타데이터 레코드 {count}개 삭제 완료")
                return count
        except Exception as e:
            print(f"메타데이터 데이터 삭제 실패: {e}")
            return 0