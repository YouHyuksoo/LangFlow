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
    
    # PDF 자동 변환 관련 필드
    is_converted_to_pdf: bool = Field(default=False)  # PDF로 변환되었는지 여부
    original_extension: Optional[str] = None  # 원본 파일 확장자 (.docx, .xlsx 등)
    conversion_method: Optional[str] = None  # 변환 방법 (python_lib, external_tool 등)
    
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
    """벡터 메타데이터 SQLite 서비스 (싱글톤)"""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        # 이미 초기화된 경우 중복 실행 방지
        if VectorMetadataService._initialized:
            return
            
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
        print(f"✅ Vector 메타데이터 데이터베이스 초기화 완료: {self.db_path}")
        
        # 초기화 완료 플래그 설정
        VectorMetadataService._initialized = True
    
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
        print(f"✅ File 메타데이터 데이터베이스 초기화 완료: {self.db_path}")
        
        # 데이터베이스 마이그레이션 실행
        self._run_migrations()
        
        # 초기화 완료 플래그 설정
        FileMetadataService._initialized = True

    def _run_migrations(self):
        """데이터베이스 마이그레이션 실행"""
        try:
            with self.engine.connect() as conn:
                # PDF 변환 관련 컬럼이 없는 경우 추가
                try:
                    conn.execute(text("ALTER TABLE file_metadata ADD COLUMN is_converted_to_pdf BOOLEAN DEFAULT 0"))
                    print("Added is_converted_to_pdf column")
                except Exception:
                    pass  # 컬럼이 이미 존재하는 경우
                
                try:
                    conn.execute(text("ALTER TABLE file_metadata ADD COLUMN original_extension VARCHAR"))
                    print("Added original_extension column")
                except Exception:
                    pass  # 컬럼이 이미 존재하는 경우
                
                try:
                    conn.execute(text("ALTER TABLE file_metadata ADD COLUMN conversion_method VARCHAR"))
                    print("Added conversion_method column")
                except Exception:
                    pass  # 컬럼이 이미 존재하는 경우
                
                conn.commit()
                print("✅ 데이터베이스 마이그레이션 완료")
                
        except Exception as e:
            print(f"Migration error (non-critical): {e}")
            # 마이그레이션 실패는 치명적이지 않음 (SQLModel이 알아서 처리)
    
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


# ==================== 수동 전처리 워크스페이스 모델들 ====================

class PreprocessingRunStatus(str, Enum):
    """전처리 작업 상태"""
    NOT_STARTED = "NOT_STARTED"    # 작업 미시작
    IN_PROGRESS = "IN_PROGRESS"    # 작업 진행중
    COMPLETED = "COMPLETED"        # 작업 완료
    FAILED = "FAILED"              # 작업 실패


class AnnotationType(str, Enum):
    """주석 타입"""
    TITLE = "title"              # 제목
    PARAGRAPH = "paragraph"      # 본문 단락
    LIST = "list"               # 목록
    TABLE = "table"             # 표
    IMAGE = "image"             # 이미지
    CAPTION = "caption"         # 캡션
    HEADER = "header"           # 헤더
    FOOTER = "footer"           # 푸터
    SIDEBAR = "sidebar"         # 사이드바
    CUSTOM = "custom"           # 사용자 정의


class AnnotationRelationType(str, Enum):
    """주석 관계 타입"""
    CONNECTS_TO = "connects_to"    # 연결됨
    PART_OF = "part_of"           # 부분임
    FOLLOWS = "follows"           # 뒤따름
    REFERENCES = "references"      # 참조함
    CAPTION_OF = "caption_of"      # 캡션임


class PreprocessingRun(SQLModel, table=True):
    """수동 전처리 작업 실행 기록"""
    __tablename__ = "preprocessing_runs"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    file_id: str = Field(index=True, foreign_key="file_metadata.file_id")
    status: PreprocessingRunStatus = Field(default=PreprocessingRunStatus.NOT_STARTED, index=True)
    
    # 작업 정보
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    processing_time: float = Field(default=0.0)  # 초 단위
    
    # 에러 정보
    error_message: Optional[str] = None
    error_details: Optional[str] = None  # JSON string for detailed error info
    
    # 메타데이터
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    def set_error_details(self, details: Dict[str, Any]):
        """에러 상세 정보를 JSON 문자열로 저장"""
        self.error_details = json.dumps(details) if details else None
    
    def get_error_details(self) -> Optional[Dict[str, Any]]:
        """에러 상세 정보를 딕셔너리로 반환"""
        if self.error_details:
            try:
                return json.loads(self.error_details)
            except json.JSONDecodeError:
                return None
        return None


class Annotation(SQLModel, table=True):
    """문서 주석 메타데이터"""
    __tablename__ = "annotations"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="preprocessing_runs.id", index=True)
    
    # 주석 순서 및 식별
    order: int = Field(index=True)  # 처리 순서
    label: str  # 사용자 정의 레이블
    annotation_type: AnnotationType = Field(default=AnnotationType.PARAGRAPH)
    
    # 좌표 정보 (JSON string)
    coordinates: str  # {"x": 100, "y": 200, "width": 300, "height": 150} 형태
    
    # OCR/추출된 텍스트
    ocr_text: Optional[str] = None
    extracted_text: Optional[str] = None
    
    # 처리 옵션
    processing_options: Optional[str] = None  # JSON string
    
    # 메타데이터
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    def set_coordinates(self, coords: Dict[str, float]):
        """좌표 정보를 JSON 문자열로 저장"""
        self.coordinates = json.dumps(coords)
    
    def get_coordinates(self) -> Optional[Dict[str, float]]:
        """좌표 정보를 딕셔너리로 반환"""
        try:
            return json.loads(self.coordinates) if self.coordinates else None
        except json.JSONDecodeError:
            return None
    
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


class AnnotationRelationship(SQLModel, table=True):
    """주석 간 관계 정의"""
    __tablename__ = "annotation_relationships"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="preprocessing_runs.id", index=True)
    
    # 관계 정의
    from_annotation_id: int = Field(foreign_key="annotations.id")
    to_annotation_id: int = Field(foreign_key="annotations.id")
    relationship_type: AnnotationRelationType
    
    # 관계 메타데이터
    description: Optional[str] = None  # 관계 설명
    weight: float = Field(default=1.0)  # 관계 가중치
    
    # 메타데이터
    created_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        # 동일한 주석 간 중복 관계 방지
        indexes = [
            ("run_id", "from_annotation_id", "to_annotation_id", "relationship_type")
        ]


class ManualPreprocessingService:
    """수동 전처리 워크스페이스 서비스"""
    
    def __init__(self):
        # SQLite 데이터베이스 경로 (users.db 사용)
        import sqlite3
        self.db_path = os.path.join(settings.DATA_DIR, "db", "users.db")
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        # 기존 파일 메타데이터 서비스와 동일한 데이터베이스 사용
        self.file_service = FileMetadataService()
        print("✅ 수동 전처리 서비스 초기화 완료")
    
    def get_files_for_preprocessing(self, limit: Optional[int] = None) -> list[Dict[str, Any]]:
        """전처리 가능한 파일 목록 조회 (상태 정보 포함)"""
        import sqlite3
        try:
            # 두 개의 데이터베이스에서 조회: users.db(전처리 상태)와 file_metadata.db(파일 목록)
            files_data = []
            
            # 1. 먼저 file_metadata.db에서 파일 목록 가져오기
            with Session(self.file_service.engine) as session:
                basic_query = """
                SELECT 
                    file_id,
                    filename,
                    upload_time,
                    file_size,
                    category_name
                FROM file_metadata
                WHERE status != 'DELETED'
                ORDER BY upload_time DESC
                """
                
                if limit:
                    basic_query += f" LIMIT {limit}"
                
                file_result = session.execute(text(basic_query)).fetchall()
                
                # 2. users.db에서 전처리 상태 가져오기
                preprocessing_status_map = {}
                try:
                    with sqlite3.connect(self.db_path) as conn:
                        cursor = conn.cursor()
                        cursor.execute("""
                            SELECT file_id, status, completed_at, processing_time
                            FROM preprocessing_runs
                        """)
                        for row in cursor.fetchall():
                            preprocessing_status_map[row[0]] = {
                                "status": row[1],
                                "completed_at": row[2],
                                "processing_time": row[3] or 0.0
                            }
                except sqlite3.Error as e:
                    print(f"전처리 상태 조회 실패: {e}")
                
                # 3. 파일 목록과 전처리 상태 결합
                for row in file_result:
                    file_id = row[0]
                    preprocessing_info = preprocessing_status_map.get(file_id, {
                        "status": "NOT_STARTED",
                        "completed_at": None,
                        "processing_time": 0.0
                    })
                    
                    files_data.append({
                        "file_id": file_id,
                        "filename": row[1],
                        "upload_time": row[2],
                        "file_size": row[3],
                        "category_name": row[4],
                        "preprocessing_status": preprocessing_info["status"],
                        "preprocessing_completed_at": preprocessing_info["completed_at"],
                        "processing_time": preprocessing_info["processing_time"]
                    })
                
            return files_data
            
        except Exception as e:
            print(f"전처리 파일 목록 조회 실패: {e}")
            return []
    
    def start_preprocessing(self, file_id: str) -> Optional[int]:
        """전처리 작업 시작"""
        import sqlite3
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # 기존 전처리 작업이 있는지 확인
                cursor.execute("""
                    SELECT id, status FROM preprocessing_runs WHERE file_id = ?
                """, (file_id,))
                existing_run = cursor.fetchone()
                
                if existing_run and existing_run[1] == 'COMPLETED':
                    # 이미 완료된 작업이 있으면 기존 ID 반환
                    return existing_run[0]
                
                current_time = datetime.now().isoformat()
                
                if existing_run:
                    # 기존 작업을 IN_PROGRESS로 업데이트
                    cursor.execute("""
                        UPDATE preprocessing_runs 
                        SET status = 'IN_PROGRESS', started_at = ?, updated_at = ?,
                            error_message = NULL, error_details = NULL
                        WHERE id = ?
                    """, (current_time, current_time, existing_run[0]))
                    return existing_run[0]
                else:
                    # 새로운 전처리 작업 생성
                    cursor.execute("""
                        INSERT INTO preprocessing_runs 
                        (file_id, status, started_at, created_at, updated_at) 
                        VALUES (?, 'IN_PROGRESS', ?, ?, ?)
                    """, (file_id, current_time, current_time, current_time))
                    return cursor.lastrowid
                    
        except sqlite3.Error as e:
            print(f"전처리 작업 시작 실패: {e}")
            return None
    
    def get_preprocessing_data(self, file_id: str) -> Optional[Dict[str, Any]]:
        """파일의 전처리 데이터 조회 (수정용)"""
        import sqlite3
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # 전처리 작업 조회
                cursor.execute("""
                    SELECT id, status, completed_at FROM preprocessing_runs 
                    WHERE file_id = ?
                """, (file_id,))
                run = cursor.fetchone()
                
                if not run:
                    return None
                
                run_id = run[0]
                
                # 주석들 조회
                cursor.execute("""
                    SELECT id, order_index, label, annotation_type, coordinates, 
                           ocr_text, extracted_text, processing_options
                    FROM annotations 
                    WHERE run_id = ?
                    ORDER BY order_index
                """, (run_id,))
                annotations = cursor.fetchall()
                
                # 관계들 조회
                cursor.execute("""
                    SELECT from_annotation_id, to_annotation_id, relationship_type, 
                           description, weight
                    FROM annotation_relationships 
                    WHERE run_id = ?
                """, (run_id,))
                relationships = cursor.fetchall()
                
                return {
                    "run_id": run_id,
                    "status": run[1],
                    "completed_at": run[2],
                    "annotations": [
                        {
                            "id": ann[0],
                            "order": ann[1],
                            "label": ann[2],
                            "type": ann[3],
                            "coordinates": json.loads(ann[4]) if ann[4] else {},
                            "ocr_text": ann[5],
                            "extracted_text": ann[6],
                            "processing_options": json.loads(ann[7]) if ann[7] else {}
                        } for ann in annotations
                    ],
                    "relationships": [
                        {
                            "from_annotation_id": rel[0],
                            "to_annotation_id": rel[1],
                            "type": rel[2],
                            "description": rel[3],
                            "weight": rel[4]
                        } for rel in relationships
                    ]
                }
                
        except sqlite3.Error as e:
            print(f"전처리 데이터 조회 실패: {e}")
            return None
    
    def save_preprocessing_data(self, file_id: str, annotations_data: list, relationships_data: list = None) -> bool:
        """전처리 데이터 저장"""
        import sqlite3
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # 전처리 작업 조회/생성
                cursor.execute("SELECT id FROM preprocessing_runs WHERE file_id = ?", (file_id,))
                run = cursor.fetchone()
                
                if not run:
                    current_time = datetime.now().isoformat()
                    cursor.execute("""
                        INSERT INTO preprocessing_runs (file_id, status, created_at, updated_at)
                        VALUES (?, 'COMPLETED', ?, ?)
                    """, (file_id, current_time, current_time))
                    run_id = cursor.lastrowid
                else:
                    run_id = run[0]
                    # 기존 데이터 삭제
                    cursor.execute("DELETE FROM annotation_relationships WHERE run_id = ?", (run_id,))
                    cursor.execute("DELETE FROM annotations WHERE run_id = ?", (run_id,))
                
                # 주석 데이터 저장
                for ann_data in annotations_data:
                    cursor.execute("""
                        INSERT INTO annotations 
                        (run_id, order_index, label, annotation_type, coordinates, 
                         ocr_text, extracted_text, processing_options, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        run_id,
                        ann_data.get("order", 0),
                        ann_data.get("label", ""),
                        ann_data.get("type", "paragraph"),
                        json.dumps(ann_data.get("coordinates", {})),
                        ann_data.get("ocr_text"),
                        ann_data.get("extracted_text"),
                        json.dumps(ann_data.get("processing_options", {})),
                        datetime.now().isoformat(),
                        datetime.now().isoformat()
                    ))
                
                # 관계 데이터 저장 (있다면)
                if relationships_data:
                    for rel_data in relationships_data:
                        cursor.execute("""
                            INSERT INTO annotation_relationships 
                            (run_id, from_annotation_id, to_annotation_id, relationship_type,
                             description, weight, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            run_id,
                            rel_data.get("from_annotation_id"),
                            rel_data.get("to_annotation_id"),
                            rel_data.get("type", "connects_to"),
                            rel_data.get("description"),
                            rel_data.get("weight", 1.0),
                            datetime.now().isoformat(),
                            datetime.now().isoformat()
                        ))
                
                # 전처리 작업 완료 표시
                cursor.execute("""
                    UPDATE preprocessing_runs 
                    SET status = 'COMPLETED', completed_at = ?, updated_at = ?
                    WHERE id = ?
                """, (datetime.now().isoformat(), datetime.now().isoformat(), run_id))
                
                return True
                
        except sqlite3.Error as e:
            print(f"전처리 데이터 저장 실패: {e}")
            return False


# 전역 서비스 인스턴스
vector_metadata_service = VectorMetadataService()
file_metadata_service = FileMetadataService()
manual_preprocessing_service = ManualPreprocessingService()