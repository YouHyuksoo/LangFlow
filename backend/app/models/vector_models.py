"""
벡터 메타데이터를 위한 SQLite 데이터베이스 모델
"""
from sqlmodel import SQLModel, Field, create_engine, Session
from sqlalchemy import text
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
import json
import os
from ..core.config import settings


# FileStatus는 schemas.py에서 import
from .schemas import FileStatus


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


class FileMetadata(SQLModel, table=True):
    """통합 파일 메타데이터 테이블 (파일 관리 + 벡터 정보)"""
    __tablename__ = "file_metadata"
    
    # Primary Key
    id: Optional[int] = Field(default=None, primary_key=True)
    file_id: str = Field(index=True, unique=True)
    
    # 파일 기본 정보
    filename: str = Field(index=True)
    saved_filename: str  # UUID 기반 저장 파일명
    file_path: str  # 실제 파일 경로
    file_size: int = Field(default=0)
    file_hash: str = Field(index=True)  # 중복 체크용
    
    # 분류 정보
    category_id: Optional[str] = Field(default=None, index=True)
    category_name: Optional[str] = None
    
    # 처리 상태
    status: FileStatus = Field(default=FileStatus.UPLOADED, index=True)
    vectorized: bool = Field(default=False, index=True)
    
    # 시간 추적
    upload_time: datetime = Field(default_factory=datetime.now)
    preprocessing_started_at: Optional[datetime] = None
    preprocessing_completed_at: Optional[datetime] = None
    vectorization_started_at: Optional[datetime] = None
    vectorization_completed_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    # 처리 정보
    preprocessing_method: str = Field(default="basic")
    processing_time: float = Field(default=0.0)
    
    # 벡터화 정보
    chunk_count: int = Field(default=0)
    flow_id: Optional[str] = None
    
    # 문서 분석 정보
    page_count: Optional[int] = None
    table_count: Optional[int] = None
    image_count: Optional[int] = None
    
    # 고급 옵션
    docling_options: Optional[str] = None  # JSON string
    processing_options: Optional[str] = None  # JSON string
    
    # 에러 관리
    error_message: Optional[str] = None
    error_type: Optional[str] = None
    
    # 메타데이터
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    def set_processing_options(self, options: Dict[str, Any]):
        """처리 옵션을 JSON 문자열로 저장"""
        self.processing_options = json.dumps(options) if options else None
    
    def get_processing_options(self) -> Optional[Dict[str, Any]]:
        """처리 옵션을 딕셔너리로 반환"""
        if self.processing_options:
            try:
                return json.loads(self.processing_options)
            except json.JSONDecodeError:
                return None
        return None
    
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
        self.db_path = os.path.join(settings.DATA_DIR, 'db', 'chromadb', 'metadata.db')
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

    async def delete_file_metadata(self, file_id: str) -> bool:
        """파일 메타데이터 삭제 (비동기 호환)"""
        return self.delete_metadata(file_id)

    async def clear_all_metadata(self) -> bool:
        """모든 메타데이터 삭제 (비동기 호환)"""
        try:
            count = self.clear_all()
            return count >= 0  # 삭제된 레코드 수가 0 이상이면 성공
        except Exception as e:
            print(f"전체 메타데이터 삭제 실패: {e}")
            return False


class FileMetadataService:
    """통합 파일 메타데이터 SQLite 서비스 (싱글톤)"""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        # 이미 초기화된 경우 중복 실행 방지
        if FileMetadataService._initialized:
            return
            
        # SQLite 데이터베이스 파일 경로 (기존과 동일한 위치 사용)
        self.db_path = os.path.join(settings.DATA_DIR, 'db', 'file_metadata.db')
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        # SQLite 엔진 생성 (WAL 모드로 동시성 개선)
        self.engine = create_engine(
            f"sqlite:///{self.db_path}",
            connect_args={
                "check_same_thread": False,
                "timeout": 30.0
            }
        )
        
        # WAL 모드 및 기타 pragma 설정
        with self.engine.connect() as conn:
            conn.execute(text("PRAGMA journal_mode=WAL"))
            conn.execute(text("PRAGMA synchronous=NORMAL"))
            conn.execute(text("PRAGMA cache_size=-64000"))
            conn.execute(text("PRAGMA foreign_keys=ON"))
            conn.commit()
        
        # 테이블 생성
        SQLModel.metadata.create_all(self.engine)
        print(f"File metadata database initialized: {self.db_path}")
        
        # 초기화 완료 플래그 설정
        FileMetadataService._initialized = True
    
    def create_file(self, file_metadata: FileMetadata) -> bool:
        """파일 메타데이터 생성"""
        try:
            with Session(self.engine) as session:
                session.add(file_metadata)
                session.commit()
                session.refresh(file_metadata)
                return True
        except Exception as e:
            print(f"파일 메타데이터 생성 실패: {e}")
            return False
    
    def get_file(self, file_id: str) -> Optional[FileMetadata]:
        """파일 ID로 메타데이터 조회"""
        try:
            with Session(self.engine) as session:
                return session.query(FileMetadata).filter(
                    FileMetadata.file_id == file_id
                ).first()
        except Exception as e:
            print(f"파일 메타데이터 조회 실패: {e}")
            return None
    
    def update_file(self, file_id: str, **kwargs) -> bool:
        """파일 메타데이터 업데이트"""
        try:
            with Session(self.engine) as session:
                file_metadata = session.query(FileMetadata).filter(
                    FileMetadata.file_id == file_id
                ).first()
                
                if file_metadata:
                    for key, value in kwargs.items():
                        if hasattr(file_metadata, key):
                            setattr(file_metadata, key, value)
                    
                    file_metadata.updated_at = datetime.now()
                    session.commit()
                    return True
                return False
        except Exception as e:
            print(f"파일 메타데이터 업데이트 실패: {e}")
            return False
    
    def update_status(self, file_id: str, status: FileStatus, **kwargs) -> bool:
        """파일 상태 업데이트 (시간 추적 포함)"""
        try:
            with Session(self.engine) as session:
                file_metadata = session.query(FileMetadata).filter(
                    FileMetadata.file_id == file_id
                ).first()
                
                if not file_metadata:
                    return False
                
                # 상태 업데이트
                file_metadata.status = status
                
                # 시간 추적
                now = datetime.now()
                if status == FileStatus.PREPROCESSING:
                    file_metadata.preprocessing_started_at = now
                elif status == FileStatus.PREPROCESSED:
                    file_metadata.preprocessing_completed_at = now
                elif status == FileStatus.VECTORIZING:
                    file_metadata.vectorization_started_at = now
                elif status == FileStatus.COMPLETED:
                    file_metadata.vectorization_completed_at = now
                    file_metadata.vectorized = True
                elif status == FileStatus.DELETED:
                    file_metadata.deleted_at = now
                
                # 추가 필드 업데이트
                for key, value in kwargs.items():
                    if hasattr(file_metadata, key):
                        setattr(file_metadata, key, value)
                
                file_metadata.updated_at = now
                session.commit()
                return True
        except Exception as e:
            print(f"파일 상태 업데이트 실패: {e}")
            return False
    
    def delete_file(self, file_id: str, soft_delete: bool = True) -> bool:
        """파일 메타데이터 삭제 (소프트 삭제 옵션)"""
        try:
            with Session(self.engine) as session:
                file_metadata = session.query(FileMetadata).filter(
                    FileMetadata.file_id == file_id
                ).first()
                
                if file_metadata:
                    if soft_delete:
                        # 소프트 삭제 (deleted 상태로 변경)
                        file_metadata.status = FileStatus.DELETED
                        file_metadata.deleted_at = datetime.now()
                        file_metadata.updated_at = datetime.now()
                        session.commit()
                    else:
                        # 하드 삭제 (레코드 완전 제거)
                        session.delete(file_metadata)
                        session.commit()
                    return True
                return False
        except Exception as e:
            print(f"파일 메타데이터 삭제 실패: {e}")
            return False
    
    def list_files(self, 
                   status: Optional[FileStatus] = None,
                   category_id: Optional[str] = None,
                   include_deleted: bool = False,
                   limit: Optional[int] = None) -> list[FileMetadata]:
        """파일 목록 조회 (필터링 옵션)"""
        try:
            with Session(self.engine) as session:
                query = session.query(FileMetadata)
                
                # 삭제된 파일 제외 (기본값)
                if not include_deleted:
                    query = query.filter(FileMetadata.status != FileStatus.DELETED)
                
                # 상태 필터
                if status:
                    query = query.filter(FileMetadata.status == status)
                
                # 카테고리 필터
                if category_id:
                    query = query.filter(FileMetadata.category_id == category_id)
                
                # 최신순 정렬
                query = query.order_by(FileMetadata.updated_at.desc())
                
                # 개수 제한
                if limit:
                    query = query.limit(limit)
                
                return query.all()
        except Exception as e:
            print(f"파일 목록 조회 실패: {e}")
            return []
    
    def get_file_by_hash(self, file_hash: str) -> Optional[FileMetadata]:
        """파일 해시로 중복 파일 검색"""
        try:
            with Session(self.engine) as session:
                return session.query(FileMetadata).filter(
                    FileMetadata.file_hash == file_hash,
                    FileMetadata.status != FileStatus.DELETED
                ).first()
        except Exception as e:
            print(f"해시 기반 파일 조회 실패: {e}")
            return None
    
    def get_stats(self) -> Dict[str, Any]:
        """파일 통계 조회"""
        try:
            with Session(self.engine) as session:
                total_files = session.query(FileMetadata).filter(
                    FileMetadata.status != FileStatus.DELETED
                ).count()
                
                vectorized_files = session.query(FileMetadata).filter(
                    FileMetadata.vectorized == True,
                    FileMetadata.status != FileStatus.DELETED
                ).count()
                
                total_chunks = session.query(FileMetadata.chunk_count).filter(
                    FileMetadata.status != FileStatus.DELETED
                ).all()
                total_chunk_count = sum(chunk[0] for chunk in total_chunks if chunk[0])
                
                total_size = session.query(FileMetadata.file_size).filter(
                    FileMetadata.status != FileStatus.DELETED
                ).all()
                total_file_size = sum(size[0] for size in total_size if size[0])
                
                return {
                    "total_files": total_files,
                    "vectorized_files": vectorized_files,
                    "total_chunks": total_chunk_count,
                    "total_size_bytes": total_file_size,
                    "vectorization_rate": vectorized_files / max(1, total_files)
                }
        except Exception as e:
            print(f"통계 조회 실패: {e}")
            return {
                "total_files": 0,
                "vectorized_files": 0,
                "total_chunks": 0,
                "total_size_bytes": 0,
                "vectorization_rate": 0.0
            }
    
    def clear_all(self) -> int:
        """데이터 파일은 유지하고 모든 파일 메타데이터 레코드만 삭제합니다."""
        try:
            with Session(self.engine) as session:
                # 삭제 전 레코드 수 확인
                count = session.query(FileMetadata).count()
                
                # 모든 레코드 삭제
                session.query(FileMetadata).delete()
                session.commit()
                
                print(f"파일 메타데이터 레코드 {count}개 삭제 완료")
                return count
        except Exception as e:
            print(f"파일 메타데이터 데이터 삭제 실패: {e}")
            return 0

    async def clear_all_metadata(self) -> bool:
        """모든 파일 메타데이터 삭제 (비동기 호환)"""
        try:
            count = self.clear_all()
            return count >= 0  # 삭제된 레코드 수가 0 이상이면 성공
        except Exception as e:
            print(f"전체 파일 메타데이터 삭제 실패: {e}")
            return False