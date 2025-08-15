from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

# 채팅 관련 스키마
class ChatRequest(BaseModel):
    message: str = Field(..., description="사용자 질문")
    user_id: Optional[str] = Field(None, description="사용자 ID")
    system_message: Optional[str] = Field(None, description="시스템 메시지")
    persona_id: Optional[str] = Field(None, description="사용할 페르소나 ID")
    category_ids: Optional[List[str]] = Field(None, description="검색할 카테고리 ID 목록")
    categories: Optional[List[str]] = Field(None, description="카테고리 이름 목록 (품질, 인사, 제조 등)")
    flow_id: Optional[str] = Field(None, description="사용할 Langflow Flow ID")
    top_k: int = 10  # 검색 결과 수 (기본값: 10개)
    images: Optional[List[str]] = Field(None, description="첨부된 이미지 Base64 데이터 목록")

class ChatResponse(BaseModel):
    response: str = Field(..., description="AI 응답")
    sources: List[Dict[str, Any]] = Field(default=[], description="참조 문서")
    confidence: float = Field(..., description="신뢰도 점수")
    processing_time: Optional[float] = Field(None, description="처리 시간")
    categories: Optional[List[str]] = Field(None, description="사용된 카테고리 목록")
    flow_id: Optional[str] = Field(None, description="사용된 Flow ID")
    user_id: Optional[str] = Field(None, description="사용자 ID")

# 카테고리 관련 스키마
class Category(BaseModel):
    category_id: str = Field(..., description="카테고리 ID")
    name: str = Field(..., description="카테고리 이름")
    description: Optional[str] = Field(None, description="카테고리 설명")
    icon: Optional[str] = Field("FileText", description="아이콘 이름")
    color: Optional[str] = Field("bg-gray-500", description="색상 클래스")
    document_count: int = Field(0, description="문서 수")
    created_at: datetime = Field(default_factory=datetime.now, description="생성 시간")
    updated_at: datetime = Field(default_factory=datetime.now, description="수정 시간")

class CategoryRequest(BaseModel):
    name: str = Field(..., description="카테고리 이름")
    description: Optional[str] = Field(None, description="카테고리 설명")
    icon: Optional[str] = Field("FileText", description="아이콘 이름")
    color: Optional[str] = Field("bg-gray-500", description="색상 클래스")

class CategoryStats(BaseModel):
    category_id: str = Field(..., description="카테고리 ID")
    name: str = Field(..., description="카테고리 이름")
    document_count: int = Field(0, description="문서 수")
    icon: str = Field("FileText", description="아이콘 이름")
    color: str = Field("bg-gray-500", description="색상 클래스")

# 파일 업로드 관련 스키마
class FileUploadRequest(BaseModel):
    category_id: Optional[str] = Field(None, description="카테고리 ID")
    category: Optional[str] = Field(None, description="카테고리 이름")

class FileUploadResponse(BaseModel):
    file_id: str = Field(..., description="파일 ID")
    filename: str = Field(..., description="파일명")
    status: str = Field(..., description="처리 상태")
    file_size: Optional[int] = Field(None, description="파일 크기")
    category_id: Optional[str] = Field(None, description="카테고리 ID")
    category_name: Optional[str] = Field(None, description="카테고리 이름")
    upload_time: datetime = Field(default_factory=datetime.now, description="업로드 시간")

class FileInfo(BaseModel):
    file_id: str
    filename: str
    status: str
    file_size: int
    file_path: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    upload_time: datetime
    vectorized: bool = False
    vectorization_status: Optional[str] = None
    error_message: Optional[str] = None
    chunk_count: Optional[int] = None
    # 처리 옵션(존재할 수 있음). 런타임에 객체가 주입될 수 있어 Any 허용
    processing_options: Optional[Any] = None

# Flow 관련 스키마
class FlowRequest(BaseModel):
    flow_json: Dict[str, Any] = Field(..., description="Langflow JSON")
    flow_name: str = Field(..., description="Flow 이름")
    description: Optional[str] = Field(None, description="Flow 설명")

class FlowResponse(BaseModel):
    flow_id: str = Field(..., description="Flow ID")
    name: str = Field(..., description="Flow 이름")
    status: str = Field(..., description="상태")
    created_at: datetime = Field(default_factory=datetime.now, description="생성 시간")

# 통계 관련 스키마
class StatsResponse(BaseModel):
    total_files: int = Field(..., description="총 파일 수")
    total_flows: int = Field(..., description="총 Flow 수")
    total_users: int = Field(..., description="총 사용자 수")
    total_queries: int = Field(..., description="총 질문 수")
    average_response_time: Optional[float] = Field(None, description="평균 응답 시간")

# 사용자 관련 스키마
class UserSystemMessage(BaseModel):
    user_id: str = Field(..., description="사용자 ID")
    system_message: str = Field(..., description="시스템 메시지")
    created_at: datetime = Field(default_factory=datetime.now, description="생성 시간")
    updated_at: datetime = Field(default_factory=datetime.now, description="수정 시간")

# 사용자 관리 관련 스키마
class User(BaseModel):
    user_id: str = Field(..., description="사용자 ID")
    username: str = Field(..., description="사용자명")
    email: str = Field(..., description="이메일")
    full_name: Optional[str] = Field(None, description="전체 이름")
    persona: str = Field("general", description="페르소나")
    interest_areas: List[str] = Field(default=[], description="관심 영역 목록")
    role: str = Field("user", description="사용자 등급 (admin/user)")
    is_active: bool = Field(True, description="활성 상태")
    avatar_url: Optional[str] = Field(None, description="아바타 이미지 URL")
    created_at: datetime = Field(..., description="생성 시간")
    updated_at: datetime = Field(..., description="수정 시간")

class UserCreateRequest(BaseModel):
    username: str = Field(..., description="사용자명", min_length=3, max_length=50)
    email: str = Field(..., description="이메일")
    password: str = Field(..., description="비밀번호", min_length=6)
    full_name: Optional[str] = Field(None, description="전체 이름")
    persona: str = Field("general", description="페르소나")
    interest_areas: List[str] = Field(default=[], description="관심 영역 목록")
    role: str = Field("user", description="사용자 등급 (admin/user)")

class UserUpdateRequest(BaseModel):
    username: Optional[str] = Field(None, description="사용자명", min_length=3, max_length=50)
    email: Optional[str] = Field(None, description="이메일")
    password: Optional[str] = Field(None, description="새 비밀번호", min_length=6)
    full_name: Optional[str] = Field(None, description="전체 이름")
    persona: Optional[str] = Field(None, description="페르소나")
    interest_areas: Optional[List[str]] = Field(None, description="관심 영역 목록")
    role: Optional[str] = Field(None, description="사용자 등급 (admin/user)")
    is_active: Optional[bool] = Field(None, description="활성 상태")

class LoginRequest(BaseModel):
    username: str = Field(..., description="사용자명")
    password: str = Field(..., description="비밀번호")

class LoginResponse(BaseModel):
    success: bool = Field(..., description="로그인 성공 여부")
    session_id: Optional[str] = Field(None, description="세션 ID")
    user: Optional[User] = Field(None, description="사용자 정보")
    message: str = Field(..., description="응답 메시지")

class Persona(BaseModel):
    persona_id: str = Field(..., description="페르소나 ID")
    name: str = Field(..., description="페르소나 이름")
    description: Optional[str] = Field(None, description="페르소나 설명")
    system_message: Optional[str] = Field(None, description="시스템 메시지")
    is_active: bool = Field(True, description="활성 상태")
    created_at: datetime = Field(..., description="생성 시간")

class InterestArea(BaseModel):
    area_id: str = Field(..., description="관심 영역 ID")
    name: str = Field(..., description="관심 영역 이름")
    description: Optional[str] = Field(None, description="관심 영역 설명")
    category_ids: List[str] = Field(default=[], description="관련 카테고리 ID 목록")
    is_active: bool = Field(True, description="활성 상태")
    created_at: datetime = Field(..., description="생성 시간")

class PersonaCreateRequest(BaseModel):
    name: str = Field(..., description="페르소나 이름")
    description: Optional[str] = Field(None, description="페르소나 설명")
    system_message: Optional[str] = Field(None, description="시스템 메시지")

class InterestAreaCreateRequest(BaseModel):
    name: str = Field(..., description="관심 영역 이름")
    description: Optional[str] = Field(None, description="관심 영역 설명")
    category_ids: List[str] = Field(default=[], description="관련 카테고리 ID 목록")

# 모델 설정 스키마
class ModelSettings(BaseModel):
    # LLM 모델 설정
    llm_provider: str = Field("openai", description="LLM 제공업체 (openai, anthropic, google, etc.)")
    llm_model: str = Field("gpt-4o-mini", description="LLM 모델명")
    llm_api_key: Optional[str] = Field(None, description="LLM API 키")
    llm_temperature: float = Field(0.7, description="LLM 온도 설정", ge=0.0, le=2.0)
    llm_max_tokens: int = Field(4096, description="LLM 최대 토큰 수", ge=1)
    
    # Embedding 모델 설정
    embedding_provider: str = Field("openai", description="임베딩 제공업체")
    embedding_model: str = Field("text-embedding-3-small", description="임베딩 모델명")
    embedding_api_key: Optional[str] = Field(None, description="임베딩 API 키")
    embedding_dimension: int = Field(1536, description="임베딩 차원", ge=1)
    
    # 문서 처리 및 벡터화 설정 (통합)
    chunk_size: int = Field(800, description="청크 크기 (글자 수)", ge=100, le=2000)
    chunk_overlap: int = Field(120, description="청크 오버랩 (글자 수)", ge=0)
    
    # 벡터화 성능 설정 (통합)
    batch_size: int = Field(2, description="임베딩 배치 크기", ge=1, le=10)
    max_concurrent_embeddings: int = Field(5, description="동시 임베딩 처리 수", ge=1, le=20)
    max_concurrent_chunks: int = Field(20, description="동시 청크 처리 수", ge=5, le=100)
    embedding_pool_size: int = Field(3, description="임베딩 함수 풀 크기", ge=1, le=10)
    connection_pool_size: int = Field(10, description="ChromaDB 연결 풀 크기", ge=1, le=50)
    
    # Unstructured 청킹 설정 (chunk_size와 자동 동기화)
    chunking_strategy: str = Field("by_title", description="Unstructured 청킹 전략")
    max_characters: int = Field(800, description="Unstructured 최대 문자 수 (chunk_size와 동일)", ge=100, le=2000)
    combine_text_under_n_chars: int = Field(120, description="텍스트 결합 기준 (chunk_overlap과 동일)", ge=0)
    new_after_n_chars: int = Field(600, description="새 청크 생성 기준 (chunk_size * 0.75)", ge=300, le=1500)
    
    top_k: int = Field(5, description="검색 결과 수", ge=1, le=50)
    
    # Docling 설정
    docling_enabled: bool = Field(True, description="Docling 문서 처리 활성화")
    docling_extract_tables: bool = Field(True, description="테이블 추출 활성화")
    docling_extract_images: bool = Field(True, description="이미지 추출 활성화")
    docling_ocr_enabled: bool = Field(True, description="OCR 기능 활성화")
    docling_output_format: str = Field("markdown", description="Docling 출력 형식")
    
    updated_at: datetime = Field(default_factory=datetime.now, description="수정 시간")

class ModelSettingsUpdateRequest(BaseModel):
    # LLM 모델 설정
    llm_provider: Optional[str] = Field(None, description="LLM 제공업체")
    llm_model: Optional[str] = Field(None, description="LLM 모델명")
    llm_api_key: Optional[str] = Field(None, description="LLM API 키")
    llm_temperature: Optional[float] = Field(None, description="LLM 온도 설정", ge=0.0, le=2.0)
    llm_max_tokens: Optional[int] = Field(None, description="LLM 최대 토큰 수", ge=1)
    
    # Embedding 모델 설정
    embedding_provider: Optional[str] = Field(None, description="임베딩 제공업체")
    embedding_model: Optional[str] = Field(None, description="임베딩 모델명")
    embedding_api_key: Optional[str] = Field(None, description="임베딩 API 키")
    embedding_dimension: Optional[int] = Field(None, description="임베딩 차원", ge=1)
    
    # 기타 설정
    chunk_size: Optional[int] = Field(None, description="청크 크기", ge=100)
    chunk_overlap: Optional[int] = Field(None, description="청크 오버랩", ge=0)
    top_k: Optional[int] = Field(None, description="검색 결과 수", ge=1, le=50)
    
    # Docling 설정
    docling_enabled: Optional[bool] = Field(None, description="Docling 문서 처리 활성화")
    docling_extract_tables: Optional[bool] = Field(None, description="테이블 추출 활성화")
    docling_extract_images: Optional[bool] = Field(None, description="이미지 추출 활성화")
    docling_ocr_enabled: Optional[bool] = Field(None, description="OCR 기능 활성화")
    docling_output_format: Optional[str] = Field(None, description="Docling 출력 형식")

# 시스템 설정 스키마
class SystemSettings(BaseModel):
    default_system_message: str = Field(..., description="기본 시스템 메시지")
    default_persona_id: Optional[str] = Field(None, description="기본 페르소나 ID")
    
    # 파일 업로드 설정
    maxFileSize: int = Field(10, description="최대 파일 크기 (MB)")
    allowedFileTypes: List[str] = Field(default=["pdf", "docx", "pptx", "xlsx"], description="허용된 파일 형식")
    uploadDirectory: str = Field("uploads/", description="업로드 디렉토리")
    
    # 벡터화 설정 (vectorDimension은 deprecated - 모델 설정의 embedding_dimension 사용)
    vectorDimension: int = Field(1536, description="벡터 차원 수 (사용하지 않음 - 모델 설정 참조)")
    chunkSize: int = Field(1000, description="청크 크기")
    chunkOverlap: int = Field(200, description="청크 오버랩")
    
    # 시스템 동작 설정
    enableAutoVectorization: bool = Field(True, description="자동 벡터화 활성화")
    enableNotifications: bool = Field(True, description="알림 활성화")
    debugMode: bool = Field(False, description="디버그 모드")
    
    updated_at: datetime = Field(default_factory=datetime.now, description="수정 시간")

class SystemSettingsUpdateRequest(BaseModel):
    default_system_message: Optional[str] = Field(None, description="기본 시스템 메시지")
    default_persona_id: Optional[str] = Field(None, description="기본 페르소나 ID")
    
    # 파일 업로드 설정
    maxFileSize: Optional[int] = Field(None, description="최대 파일 크기 (MB)")
    allowedFileTypes: Optional[List[str]] = Field(None, description="허용된 파일 형식")
    uploadDirectory: Optional[str] = Field(None, description="업로드 디렉토리")
    
    # 벡터화 설정 (vectorDimension은 deprecated - 모델 설정의 embedding_dimension 사용)
    vectorDimension: Optional[int] = Field(None, description="벡터 차원 수 (사용하지 않음 - 모델 설정 참조)")
    chunkSize: Optional[int] = Field(None, description="청크 크기")
    chunkOverlap: Optional[int] = Field(None, description="청크 오버랩")
    
    # 시스템 동작 설정
    enableAutoVectorization: Optional[bool] = Field(None, description="자동 벡터화 활성화")
    enableNotifications: Optional[bool] = Field(None, description="알림 활성화")
    debugMode: Optional[bool] = Field(None, description="디버그 모드")

# 프로필 관련 스키마
class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, description="전체 이름")
    email: Optional[str] = Field(None, description="이메일")

class PasswordChangeRequest(BaseModel):
    currentPassword: str = Field(..., description="현재 비밀번호")
    newPassword: str = Field(..., description="새 비밀번호", min_length=6)

class AvatarUploadResponse(BaseModel):
    avatar_url: str = Field(..., description="아바타 이미지 URL")
    message: str = Field(..., description="응답 메시지")

# 에러 응답 스키마
class ErrorResponse(BaseModel):
    error: str = Field(..., description="에러 메시지")
    detail: Optional[str] = Field(None, description="상세 정보")
    status_code: int = Field(..., description="HTTP 상태 코드")

# Docling 관련 스키마
class DoclingOptions(BaseModel):
    """Docling 문서 처리 옵션"""
    enabled: bool = Field(False, description="Docling 전처리 활성화")
    extract_tables: bool = Field(True, description="테이블 구조 분석")
    extract_images: bool = Field(True, description="이미지 추출")
    ocr_enabled: bool = Field(False, description="OCR 활성화")
    output_format: str = Field("markdown", description="출력 형식 (markdown, html, json, all)")

class DoclingResult(BaseModel):
    """Docling 처리 결과"""
    success: bool = Field(..., description="처리 성공 여부")
    content: Dict[str, Any] = Field(default={}, description="추출된 구조화 콘텐츠")
    metadata: Dict[str, Any] = Field(default={}, description="처리 메타데이터")
    tables: List[Dict[str, Any]] = Field(default=[], description="추출된 테이블 목록")
    images: List[Dict[str, Any]] = Field(default=[], description="추출된 이미지 목록")
    error: Optional[str] = Field(None, description="에러 메시지")
    processing_time: Optional[float] = Field(None, description="처리 시간(초)")

class DoclingSettings(BaseModel):
    """Docling 전역 설정"""
    enabled: bool = Field(False, description="Docling 기능 활성화")
    default_extract_tables: bool = Field(True, description="기본 테이블 추출 설정")
    default_extract_images: bool = Field(True, description="기본 이미지 추출 설정")
    default_ocr_enabled: bool = Field(False, description="기본 OCR 활성화 설정")
    default_output_format: str = Field("markdown", description="기본 출력 형식")
    max_file_size_mb: int = Field(50, description="Docling 처리 최대 파일 크기(MB)")
    supported_formats: List[str] = Field(
        default=[".pdf", ".docx", ".pptx", ".xlsx", ".html"],
        description="지원하는 파일 형식"
    )

class FileProcessingOptions(BaseModel):
    """파일 처리 옵션 (업로드 시 사용)"""
    use_docling: bool = Field(False, description="Docling 전처리 사용")
    docling_options: Optional[DoclingOptions] = Field(None, description="Docling 상세 옵션")
    traditional_processing: bool = Field(True, description="기존 처리 방식도 함께 사용")

class UnstructuredSettings(BaseModel):
    """Unstructured 라이브러리 설정"""
    enabled: bool = Field(True, description="Unstructured 기능 활성화")
    use_as_primary: bool = Field(True, description="기본 텍스트 추출기로 사용")
    
    # 처리 전략 설정
    strategy: str = Field("auto", description="처리 전략 (auto, hi_res, fast)")
    hi_res_model_name: Optional[str] = Field(None, description="고해상도 모델명")
    
    # 문서 구조 분석
    infer_table_structure: bool = Field(True, description="테이블 구조 추론")
    extract_images_in_pdf: bool = Field(False, description="PDF 내 이미지 추출")
    include_page_breaks: bool = Field(True, description="페이지 브레이크 포함")
    
    # OCR 설정
    ocr_languages: List[str] = Field(["kor", "eng"], description="OCR 언어 (한글: kor, 영어: eng)")
    skip_infer_table_types: List[str] = Field(default=[], description="테이블 추론 제외 타입")
    
    # 청킹 설정
    chunking_strategy: str = Field("by_title", description="청킹 전략 (by_title, basic)")
    max_characters: int = Field(1500, description="최대 문자 수")
    combine_text_under_n_chars: int = Field(150, description="n자 이하 텍스트 결합")
    new_after_n_chars: int = Field(1200, description="n자 후 새 청크 생성")
    
    # 파일 크기 제한
    max_file_size_mb: int = Field(100, description="Unstructured 처리 최대 파일 크기(MB)")
    
    # 지원 형식
    supported_formats: List[str] = Field(
        default=[".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm", ".txt", ".md", ".csv"],
        description="지원하는 파일 형식"
    )
    
    # 폴백 설정
    enable_fallback: bool = Field(True, description="실패 시 개별 처리기로 폴백")
    fallback_order: List[str] = Field(
        default=["pymupdf", "pypdf", "pdfminer"],
        description="PDF 폴백 순서"
    )

class UnstructuredSettingsUpdateRequest(BaseModel):
    """Unstructured 설정 업데이트 요청"""
    enabled: Optional[bool] = Field(None, description="Unstructured 기능 활성화")
    use_as_primary: Optional[bool] = Field(None, description="기본 텍스트 추출기로 사용")
    strategy: Optional[str] = Field(None, description="처리 전략")
    hi_res_model_name: Optional[str] = Field(None, description="고해상도 모델명")
    infer_table_structure: Optional[bool] = Field(None, description="테이블 구조 추론")
    extract_images_in_pdf: Optional[bool] = Field(None, description="PDF 내 이미지 추출")
    include_page_breaks: Optional[bool] = Field(None, description="페이지 브레이크 포함")
    ocr_languages: Optional[List[str]] = Field(None, description="OCR 언어")
    skip_infer_table_types: Optional[List[str]] = Field(None, description="테이블 추론 제외 타입")
    chunking_strategy: Optional[str] = Field(None, description="청킹 전략")
    max_characters: Optional[int] = Field(None, description="최대 문자 수")
    combine_text_under_n_chars: Optional[int] = Field(None, description="n자 이하 텍스트 결합")
    new_after_n_chars: Optional[int] = Field(None, description="n자 후 새 청크 생성")
    max_file_size_mb: Optional[int] = Field(None, description="최대 파일 크기(MB)")
    supported_formats: Optional[List[str]] = Field(None, description="지원하는 파일 형식")
    enable_fallback: Optional[bool] = Field(None, description="폴백 활성화")
    fallback_order: Optional[List[str]] = Field(None, description="폴백 순서")

class DocumentAnalysis(BaseModel):
    """문서 분석 결과"""
    file_id: str = Field(..., description="파일 ID")
    filename: str = Field(..., description="파일명")
    docling_processed: bool = Field(False, description="Docling 처리 여부")
    docling_result: Optional[DoclingResult] = Field(None, description="Docling 처리 결과")
    traditional_result: Optional[Dict[str, Any]] = Field(None, description="기존 처리 결과")
    comparison: Optional[Dict[str, Any]] = Field(None, description="처리 방식 비교")
    recommended_processing: str = Field("traditional", description="권장 처리 방식") 