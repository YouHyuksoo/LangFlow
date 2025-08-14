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