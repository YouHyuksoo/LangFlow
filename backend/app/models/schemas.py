from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
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
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    upload_time: datetime
    vectorized: bool = False
    vectorization_status: Optional[str] = None
    error_message: Optional[str] = None

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

# 시스템 설정 스키마
class SystemSettings(BaseModel):
    default_system_message: str = Field(..., description="기본 시스템 메시지")
    default_persona_id: Optional[str] = Field(None, description="기본 페르소나 ID")
    updated_at: datetime = Field(default_factory=datetime.now, description="수정 시간")

class SystemSettingsUpdateRequest(BaseModel):
    default_system_message: Optional[str] = Field(None, description="기본 시스템 메시지")
    default_persona_id: Optional[str] = Field(None, description="기본 페르소나 ID")

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