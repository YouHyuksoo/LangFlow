from fastapi import APIRouter, HTTPException, status, Depends, Cookie, UploadFile, File
from typing import List, Optional
import os
import shutil
from uuid import uuid4
from PIL import Image
from io import BytesIO
from app.models.schemas import (
    User, UserCreateRequest, UserUpdateRequest, LoginRequest, LoginResponse,
    Persona, InterestArea, PersonaCreateRequest, InterestAreaCreateRequest,
    ProfileUpdateRequest, PasswordChangeRequest, AvatarUploadResponse,
    ErrorResponse
)
from app.models.user_models import user_db
from app.core.logger import get_user_logger

router = APIRouter(prefix="/users", tags=["users"])
_ulog = get_user_logger()


# Authentication dependency
async def get_current_user(session_id: Optional[str] = Cookie(None)):
    """Get current user from session"""
    if not session_id:
        return None
    
    session = user_db.get_session(session_id)
    if not session:
        return None
    
    return session


# Admin authentication dependency
async def get_admin_user(current_user = Depends(get_current_user)):
    """Get current admin user"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다."
        )
    
    if current_user.get('role') != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다."
        )
    
    return current_user


# Authentication endpoints
@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """User login"""
    try:
        user = user_db.verify_password(request.username, request.password)
        if not user:
            # Check if user exists but is not approved
            existing_user = user_db.get_user_by_username(request.username)
            if existing_user and existing_user.get('status') == 'pending':
                return LoginResponse(
                    success=False,
                    message="계정이 관리자 승인 대기 중입니다. 승인 후 이용 가능합니다."
                )
            elif existing_user and existing_user.get('status') == 'rejected':
                return LoginResponse(
                    success=False,
                    message="계정 신청이 거부되었습니다. 관리자에게 문의하세요."
                )
            else:
                return LoginResponse(
                    success=False,
                    message="잘못된 사용자명 또는 비밀번호입니다."
                )
        
        # Create session
        session_id = user_db.create_session(user['user_id'])
        _ulog.info(
            "사용자 로그인",
            extra={"event": "user_login", "user_id": user['user_id']}
        )
        
        return LoginResponse(
            success=True,
            session_id=session_id,
            user=User(**user),
            message="로그인에 성공했습니다."
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"로그인 처리 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/register", response_model=LoginResponse)
async def register(request: UserCreateRequest):
    """User registration - creates a pending user for admin approval"""
    try:
        # Check if username or email already exists
        existing_user = user_db.get_user_by_username(request.username)
        if existing_user:
            return LoginResponse(
                success=False,
                message="이미 존재하는 사용자명입니다."
            )
        
        existing_email = user_db.get_user_by_email(request.email)
        if existing_email:
            return LoginResponse(
                success=False,
                message="이미 존재하는 이메일입니다."
            )
        
        # Create user with pending status
        user_id = user_db.create_user(
            username=request.username,
            email=request.email,
            password=request.password,
            full_name=request.full_name,
            persona=request.persona or 'general',
            interest_areas=request.interest_areas or [],
            role='user',
            status='pending'
        )
        
        _ulog.info(
            "사용자 회원가입 신청",
            extra={"event": "user_registration", "user_id": user_id, "username": request.username}
        )
        
        return LoginResponse(
            success=True,
            message="회원가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다."
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"회원가입 처리 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/logout")
async def logout(session_id: Optional[str] = Cookie(None)):
    """User logout"""
    if session_id:
        user_db.invalidate_session(session_id)
        _ulog.info("사용자 로그아웃", extra={"event": "user_logout"})
    
    return {"message": "로그아웃되었습니다."}


@router.get("/me/")
async def get_current_user_info(current_user = Depends(get_current_user)):
    """Get current user information"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다."
        )
    
    user_info = user_db.get_user_by_id(current_user['user_id'])
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다."
        )
    
    # Remove password hash
    del user_info['password_hash']
    return User(**user_info)


@router.put("/me/profile")
async def update_profile(request: ProfileUpdateRequest, current_user = Depends(get_current_user)):
    """Update current user profile"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다."
        )
    
    try:
        # 업데이트할 데이터 준비
        update_data = request.dict(exclude_unset=True)
        
        # 이메일 중복 체크
        if 'email' in update_data:
            existing_user = user_db.get_user_by_email(update_data['email'])
            if existing_user and existing_user['user_id'] != current_user['user_id']:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="이미 사용 중인 이메일입니다."
                )
        
        # 사용자 정보 업데이트
        success = user_db.update_user(current_user['user_id'], **update_data)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="프로필 업데이트에 실패했습니다."
            )
        
        # 업데이트된 사용자 정보 반환
        user_info = user_db.get_user_by_id(current_user['user_id'])
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="업데이트된 사용자 정보를 불러올 수 없습니다."
            )
        
        del user_info['password_hash']
        _ulog.info(
            "프로필 업데이트",
            extra={"event": "profile_updated", "user_id": current_user['user_id']}
        )
        
        return User(**user_info)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"프로필 업데이트 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/me/change-password")
async def change_password(request: PasswordChangeRequest, current_user = Depends(get_current_user)):
    """Change current user password"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다."
        )
    
    try:
        # 현재 비밀번호 확인
        user_info = user_db.get_user_by_id(current_user['user_id'])
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다."
            )
        
        # 현재 비밀번호 검증
        if not user_db.verify_password(user_info['username'], request.currentPassword):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="현재 비밀번호가 일치하지 않습니다."
            )
        
        # 새 비밀번호로 업데이트
        success = user_db.update_user(current_user['user_id'], password=request.newPassword)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="비밀번호 변경에 실패했습니다."
            )
        
        _ulog.info(
            "비밀번호 변경",
            extra={"event": "password_changed", "user_id": current_user['user_id']}
        )
        
        return {"message": "비밀번호가 성공적으로 변경되었습니다."}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"비밀번호 변경 중 오류가 발생했습니다: {str(e)}"
        )



@router.post("/me/upload-avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    """Upload user avatar image"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다."
        )
    
    try:
        # 파일이 업로드되었는지 확인
        if not file or not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="파일이 업로드되지 않았습니다."
            )
        
        # 파일 타입 확인
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미지 파일만 업로드 가능합니다."
            )
        
        # 파일 내용 읽기
        try:
            file_content = await file.read()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"파일 읽기에 실패했습니다: {str(e)}"
            )
        
        # 파일 크기 확인 (5MB 제한)
        if len(file_content) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="파일 크기는 5MB 이하여야 합니다."
            )
        
        # 빈 파일 체크
        if len(file_content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="빈 파일은 업로드할 수 없습니다."
            )
        
        # 아바타 저장 디렉토리 생성
        avatar_dir = "uploads/avatars"
        try:
            os.makedirs(avatar_dir, exist_ok=True)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"디렉토리 생성에 실패했습니다: {str(e)}"
            )
        
        # 파일 확장자 추출
        file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
        if file_extension not in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
            file_extension = 'jpg'
        
        # 고유한 파일명 생성
        avatar_filename = f"{current_user['user_id']}_{uuid4().hex}.{file_extension}"
        avatar_path = os.path.join(avatar_dir, avatar_filename)
        
        # 이미지 처리 및 저장
        try:
            # BytesIO를 사용하여 이미지 열기
            image_stream = BytesIO(file_content)
            image = Image.open(image_stream)
            
            # 이미지가 올바른지 확인
            image.verify()
            
            # 이미지를 다시 열기 (verify 후에는 이미지가 닫힘)
            image_stream.seek(0)
            image = Image.open(image_stream)
            
            # RGBA를 RGB로 변환 (PNG의 투명도 처리)
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                if image.mode == 'RGBA':
                    background.paste(image, mask=image.split()[-1])
                else:
                    background.paste(image)
                image = background
            
            # RGB가 아닌 경우 RGB로 변환
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # 이미지 크기 조정 (최대 300x300)
            image.thumbnail((300, 300), Image.Resampling.LANCZOS)
            
            # 이미지 저장
            image.save(avatar_path, format='JPEG', quality=85, optimize=True)
            
        except Exception as img_error:
            print(f"PIL 이미지 처리 실패: {img_error}")
            # PIL 처리 실패 시 원본 파일 저장 시도
            try:
                with open(avatar_path, "wb") as buffer:
                    buffer.write(file_content)
            except Exception as save_error:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"파일 저장에 실패했습니다: {str(save_error)}"
                )
        
        # 사용자 아바타 URL 업데이트
        avatar_url = f"/uploads/avatars/{avatar_filename}"
        try:
            success = user_db.update_user(current_user['user_id'], avatar_url=avatar_url)
            
            if not success:
                # 파일 삭제 후 실패 처리
                if os.path.exists(avatar_path):
                    try:
                        os.remove(avatar_path)
                    except:
                        pass
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="아바타 정보 업데이트에 실패했습니다."
                )
        except Exception as db_error:
            # 파일 삭제 후 실패 처리
            if os.path.exists(avatar_path):
                try:
                    os.remove(avatar_path)
                except:
                    pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"데이터베이스 업데이트에 실패했습니다: {str(db_error)}"
            )
        
        _ulog.info(
            "아바타 업로드",
            extra={"event": "avatar_uploaded", "user_id": current_user['user_id'], "avatar_filename": avatar_filename}
        )
        
        return AvatarUploadResponse(
            avatar_url=avatar_url,
            message="아바타가 성공적으로 업로드되었습니다."
        )
    
    except HTTPException:
        raise
    except Exception as e:
        _ulog.error(f"아바타 업로드 중 예상치 못한 오류: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"아바타 업로드 중 오류가 발생했습니다: {str(e)}"
        )


# User management endpoints (admin only)
@router.get("/", response_model=List[User])
async def get_all_users(admin_user = Depends(get_admin_user)):
    """Get all users (admin endpoint)"""
    
    try:
        users = user_db.get_all_users()
        # Remove password hashes
        for user in users:
            if 'password_hash' in user:
                del user['password_hash']
        
        return [User(**user) for user in users]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사용자 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/", response_model=User)
async def create_user(request: UserCreateRequest, admin_user = Depends(get_admin_user)):
    """Create a new user (admin endpoint)"""
    
    try:
        # Check if username or email already exists
        existing_user = user_db.get_user_by_username(request.username)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 존재하는 사용자명입니다."
            )
        
        existing_email = user_db.get_user_by_email(request.email)
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 존재하는 이메일입니다."
            )
        
        # Create user
        user_id = user_db.create_user(
            username=request.username,
            email=request.email,
            password=request.password,
            full_name=request.full_name,
            persona=request.persona,
            interest_areas=request.interest_areas,
            role=request.role
        )
        
        # Get created user
        user = user_db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="사용자 생성 후 조회에 실패했습니다."
            )
        
        # Remove password hash
        del user['password_hash']
        _ulog.info("사용자 생성", extra={"event": "user_created", "user_id": user_id})
        return User(**user)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사용자 생성 중 오류가 발생했습니다: {str(e)}"
        )


# User approval management endpoints (admin only)
@router.get("/pending", response_model=List[User])
async def get_pending_users(admin_user = Depends(get_admin_user)):
    """Get all pending approval users (admin endpoint)"""
    
    try:
        users = user_db.get_pending_users()
        # Remove password hashes
        for user in users:
            if 'password_hash' in user:
                del user['password_hash']
        
        return [User(**user) for user in users]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"대기 중인 사용자 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/{user_id}", response_model=User)
async def get_user_by_id(user_id: str, admin_user = Depends(get_admin_user)):
    """Get user by ID (admin endpoint)"""
    
    user = user_db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다."
        )
    
    # Remove password hash
    del user['password_hash']
    return User(**user)


@router.put("/{user_id}", response_model=User)
async def update_user(user_id: str, request: UserUpdateRequest, admin_user = Depends(get_admin_user)):
    """Update user (admin endpoint)"""
    
    try:
        # Check if user exists
        existing_user = user_db.get_user_by_id(user_id)
        if not existing_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다."
            )
        
        # Check for username/email conflicts if they're being updated
        update_data = request.dict(exclude_unset=True)
        
        if 'username' in update_data:
            username_user = user_db.get_user_by_username(update_data['username'])
            if username_user and username_user['user_id'] != user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="이미 존재하는 사용자명입니다."
                )
        
        if 'email' in update_data:
            email_user = user_db.get_user_by_email(update_data['email'])
            if email_user and email_user['user_id'] != user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="이미 존재하는 이메일입니다."
                )
        
        # Update user
        success = user_db.update_user(user_id, **update_data)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="사용자 정보 업데이트에 실패했습니다."
            )
        
        # Get updated user
        updated_user = user_db.get_user_by_id(user_id)
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="업데이트된 사용자 정보 조회에 실패했습니다."
            )
        
        # Remove password hash
        del updated_user['password_hash']
        return User(**updated_user)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사용자 정보 업데이트 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/{user_id}")
async def delete_user(user_id: str, admin_user = Depends(get_admin_user)):
    """Delete user (soft delete, admin endpoint)"""
    
    try:
        # Check if user exists
        existing_user = user_db.get_user_by_id(user_id)
        if not existing_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다."
            )
        
        # Delete user
        success = user_db.delete_user(user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="사용자 삭제에 실패했습니다."
            )
        
        return {"message": "사용자가 삭제되었습니다."}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사용자 삭제 중 오류가 발생했습니다: {str(e)}"
        )


# Personas endpoints
@router.get("/personas/", response_model=List[Persona])
async def get_personas():
    """Get all available personas"""
    try:
        personas = user_db.get_personas()
        return [Persona(**persona) for persona in personas]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"페르소나 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/personas/", response_model=Persona)
async def create_persona(request: PersonaCreateRequest, admin_user = Depends(get_admin_user)):
    """Create a new persona (admin endpoint)"""
    
    try:
        persona_id = user_db.create_persona(
            name=request.name,
            description=request.description,
            system_message=request.system_message
        )
        
        # Get created persona
        personas = user_db.get_personas()
        persona = next((p for p in personas if p['persona_id'] == persona_id), None)
        
        if not persona:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="페르소나 생성 후 조회에 실패했습니다."
            )
        
        return Persona(**persona)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"페르소나 생성 중 오류가 발생했습니다: {str(e)}"
        )


# Interest areas endpoints
@router.get("/interest-areas/", response_model=List[InterestArea])
async def get_interest_areas():
    """Get all available interest areas"""
    try:
        areas = user_db.get_interest_areas()
        return [InterestArea(**area) for area in areas]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"관심 영역 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/interest-areas/", response_model=InterestArea)
async def create_interest_area(request: InterestAreaCreateRequest, admin_user = Depends(get_admin_user)):
    """Create a new interest area (admin endpoint)"""
    
    try:
        area_id = user_db.create_interest_area(
            name=request.name,
            description=request.description,
            category_ids=request.category_ids
        )
        
        # Get created interest area
        areas = user_db.get_interest_areas()
        area = next((a for a in areas if a['area_id'] == area_id), None)
        
        if not area:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="관심 영역 생성 후 조회에 실패했습니다."
            )
        
        return InterestArea(**area)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"관심 영역 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.put("/personas/{persona_id}", response_model=Persona)
async def update_persona(persona_id: str, request: PersonaCreateRequest, admin_user = Depends(get_admin_user)):
    """Update persona (admin endpoint)"""
    
    try:
        updated_persona = user_db.update_persona(persona_id, request.dict())
        if not updated_persona:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="페르소나를 찾을 수 없습니다."
            )
        
        return Persona(**updated_persona)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"페르소나 업데이트 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/personas/{persona_id}")
async def delete_persona(persona_id: str, admin_user = Depends(get_admin_user)):
    """Delete persona (admin endpoint)"""
    
    try:
        success = user_db.delete_persona(persona_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="페르소나를 찾을 수 없습니다."
            )
        
        return {"message": "페르소나가 삭제되었습니다."}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"페르소나 삭제 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/interest-areas/{area_id}")
async def delete_interest_area(area_id: str, admin_user = Depends(get_admin_user)):
    """Delete interest area (admin endpoint)"""
    
    try:
        success = user_db.delete_interest_area(area_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="관심 영역을 찾을 수 없습니다."
            )
        
        return {"message": "관심 영역이 삭제되었습니다."}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"관심 영역 삭제 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/{user_id}/approve")
async def approve_user(user_id: str, admin_user = Depends(get_admin_user)):
    """Approve a pending user (admin endpoint)"""
    
    try:
        success = user_db.approve_user(user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="승인 대기 중인 사용자를 찾을 수 없습니다."
            )
        
        _ulog.info(
            "사용자 승인",
            extra={"event": "user_approved", "user_id": user_id, "admin_id": admin_user['user_id']}
        )
        
        return {"message": "사용자가 승인되었습니다."}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사용자 승인 처리 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/{user_id}/reject")
async def reject_user(user_id: str, admin_user = Depends(get_admin_user)):
    """Reject a pending user (admin endpoint)"""
    
    try:
        success = user_db.reject_user(user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="승인 대기 중인 사용자를 찾을 수 없습니다."
            )
        
        _ulog.info(
            "사용자 거부",
            extra={"event": "user_rejected", "user_id": user_id, "admin_id": admin_user['user_id']}
        )
        
        return {"message": "사용자 신청이 거부되었습니다."}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사용자 거부 처리 중 오류가 발생했습니다: {str(e)}"
        )