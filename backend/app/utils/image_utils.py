import base64
import os
from typing import Optional, Tuple
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

def encode_image_to_base64(image_path: str) -> Optional[str]:
    """
    이미지 파일을 Base64로 인코딩합니다.
    
    Args:
        image_path: 이미지 파일 경로
        
    Returns:
        Base64 인코딩된 이미지 문자열 또는 None (실패 시)
    """
    try:
        # 파일 존재 확인
        if not os.path.exists(image_path):
            logger.error(f"이미지 파일이 존재하지 않습니다: {image_path}")
            return None
        
        # 이미지 파일 읽기
        with open(image_path, "rb") as image_file:
            image_data = image_file.read()
            
        # Base64 인코딩
        base64_string = base64.b64encode(image_data).decode('utf-8')
        
        logger.info(f"이미지 Base64 인코딩 완료: {image_path}")
        return base64_string
        
    except Exception as e:
        logger.error(f"이미지 Base64 인코딩 실패: {image_path}, 오류: {str(e)}")
        return None

def get_image_mime_type(image_path: str) -> str:
    """
    이미지 파일의 MIME 타입을 반환합니다.
    
    Args:
        image_path: 이미지 파일 경로
        
    Returns:
        MIME 타입 문자열
    """
    try:
        file_extension = Path(image_path).suffix.lower()
        
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp'
        }
        
        return mime_types.get(file_extension, 'image/jpeg')  # 기본값은 JPEG
        
    except Exception as e:
        logger.error(f"MIME 타입 확인 실패: {image_path}, 오류: {str(e)}")
        return 'image/jpeg'

def create_vision_image_content(image_path: str) -> Optional[dict]:
    """
    Vision 모델에서 사용할 이미지 콘텐츠를 생성합니다.
    
    Args:
        image_path: 이미지 파일 경로
        
    Returns:
        Vision 모델용 이미지 콘텐츠 딕셔너리 또는 None (실패 시)
    """
    try:
        # 상대 경로를 절대 경로로 변환
        if image_path.startswith('/uploads/'):
            # 프로젝트 루트에서 backend 디렉토리 기준으로 경로 생성
            abs_image_path = os.path.join(os.getcwd(), image_path.lstrip('/'))
        else:
            abs_image_path = image_path
        
        # Base64 인코딩
        base64_image = encode_image_to_base64(abs_image_path)
        if not base64_image:
            return None
        
        # MIME 타입 확인
        mime_type = get_image_mime_type(abs_image_path)
        
        # OpenAI Vision API 형식으로 구성
        return {
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime_type};base64,{base64_image}"
            }
        }
        
    except Exception as e:
        logger.error(f"Vision 이미지 콘텐츠 생성 실패: {image_path}, 오류: {str(e)}")
        return None

def extract_image_path_from_chunk(chunk_text: str) -> Optional[str]:
    """
    청크 텍스트에서 이미지 경로를 추출합니다.
    
    Args:
        chunk_text: 청크 텍스트 (예: "[이미지: /uploads/images/file123/image_1.png] 이 이미지는...")
        
    Returns:
        추출된 이미지 경로 또는 None
    """
    try:
        import re
        
        # [이미지: 경로] 패턴 매칭
        pattern = r'\[이미지:\s*([^\]]+)\]'
        match = re.search(pattern, chunk_text)
        
        if match:
            image_path = match.group(1).strip()
            logger.info(f"청크에서 이미지 경로 추출: {image_path}")
            return image_path
        
        return None
        
    except Exception as e:
        logger.error(f"이미지 경로 추출 실패: {str(e)}")
        return None

def is_image_chunk(chunk_text: str) -> bool:
    """
    청크가 이미지 캡션 청크인지 확인합니다.
    
    Args:
        chunk_text: 청크 텍스트
        
    Returns:
        이미지 청크 여부
    """
    return chunk_text.startswith('[이미지:') and ']' in chunk_text

def get_image_info(image_path: str) -> Tuple[Optional[int], Optional[int], Optional[int]]:
    """
    이미지 파일의 정보를 반환합니다.
    
    Args:
        image_path: 이미지 파일 경로
        
    Returns:
        (width, height, file_size) 튜플
    """
    try:
        from PIL import Image
        
        if not os.path.exists(image_path):
            return None, None, None
        
        # 이미지 크기 정보
        with Image.open(image_path) as img:
            width, height = img.size
        
        # 파일 크기
        file_size = os.path.getsize(image_path)
        
        return width, height, file_size
        
    except Exception as e:
        logger.error(f"이미지 정보 확인 실패: {image_path}, 오류: {str(e)}")
        return None, None, None