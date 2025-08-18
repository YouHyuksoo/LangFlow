
import os
import logging
from typing import Dict, Any

# 순환 참조 방지를 위해, 폴백 처리는 예외를 발생시켜 상위 서비스가 처리하도록 함
from ..exceptions import FallbackException

# 설정 로딩은 중앙 설정 서비스를 통해 이루어지도록 수정될 예정
# 현재는 기존 방식을 임시로 사용
from ..settings_service import settings_service

# 로거 설정
logger = logging.getLogger(__name__)

def _group_elements_by_title(elements, max_chars: int, combine_under_n_chars: int) -> str:
    """제목별로 요소들을 그룹화하여 텍스트를 조합합니다."""
    grouped_text = []
    current_section = []
    current_length = 0
    
    for element in elements:
        element_text = str(element).strip()
        if not element_text:
            continue
        
        is_title = hasattr(element, 'category') and element.category in ['Title', 'Header']
        
        if (is_title and current_section) or current_length > max_chars:
            section_text = "\n".join(current_section)
            if len(section_text) >= combine_under_n_chars:
                grouped_text.append(section_text)
            current_section = []
            current_length = 0
        
        current_section.append(element_text)
        current_length += len(element_text)
    
    if current_section:
        section_text = "\n".join(current_section)
        if len(section_text) >= combine_under_n_chars:
            grouped_text.append(section_text)
    
    return "\n\n".join(grouped_text)

def _combine_elements_basic(elements, max_chars: int, new_after_n_chars: int) -> str:
    """기본 방식으로 요소들을 조합합니다."""
    combined_text = []
    current_chunk = []
    current_length = 0
    
    for element in elements:
        element_text = str(element).strip()
        if not element_text:
            continue
        
        if current_length + len(element_text) > new_after_n_chars:
            if current_chunk:
                chunk_text = "\n".join(current_chunk)
                combined_text.append(chunk_text)
            current_chunk = []
            current_length = 0
        
        current_chunk.append(element_text)
        current_length += len(element_text)
    
    if current_chunk:
        chunk_text = "\n".join(current_chunk)
        combined_text.append(chunk_text)
    
    return "\n\n".join(combined_text)

async def process(file_path: str, file_extension: str) -> str:
    """unstructured를 사용하여 다양한 문서 형식에서 텍스트를 추출합니다."""
    settings = settings_service.get_section_settings("unstructured")
    
    if not settings.get("enabled", True):
        logger.info("Unstructured 프로세서가 비활성화되어 있어 폴백을 요청합니다.")
        raise FallbackException("Unstructured processor disabled.")
    
    try:
        file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
        max_size_mb = settings.get("max_file_size_mb", 100)
        
        if file_size_mb > max_size_mb:
            logger.warning(f"파일 크기 {file_size_mb:.1f}MB가 제한 {max_size_mb}MB를 초과하여 폴백을 요청합니다.")
            raise FallbackException("File size exceeds limit.")
        
        supported_formats = settings.get("supported_formats", ["pdf", "docx", "pptx", "xlsx"])
        # 파일 확장자에서 점(.) 제거하여 비교
        file_ext_without_dot = file_extension.lower().lstrip('.')
        if file_ext_without_dot not in [fmt.lower().lstrip('.') for fmt in supported_formats]:
            logger.info(f"지원하지 않는 형식 {file_extension} - 폴백을 요청합니다.")
            raise FallbackException(f"Unsupported file format: {file_extension}")
        
        logger.info(f"📄 Unstructured 프로세서로 {file_extension} 파일 처리 시도...")
        
        from unstructured.partition.auto import partition
        
        partition_kwargs = {
            "filename": file_path,
            "strategy": settings.get("strategy", "auto"),
            "infer_table_structure": settings.get("infer_table_structure", True),
            "include_page_breaks": settings.get("include_page_breaks", True),
        }
        
        if file_extension.lower() == '.pdf':
            partition_kwargs["extract_images_in_pdf"] = settings.get("extract_images_in_pdf", False)
        
        if settings.get("strategy") == "hi_res" and settings.get("hi_res_model_name"):
            partition_kwargs["model_name"] = settings.get("hi_res_model_name")
        
        # 새로운 languages 필드를 우선 사용, 없으면 기존 ocr_languages 사용 (호환성)
        languages = settings.get("languages") or settings.get("ocr_languages", ["kor", "eng"])
        if languages:
            partition_kwargs["languages"] = languages
        
        elements = partition(**partition_kwargs)
        
        try:
            chunking_strategy = settings.get("chunking_strategy", "by_title")
            max_chars = settings.get("max_characters", 800)
            combine_under_n_chars = settings.get("combine_text_under_n_chars", 120)
            new_after_n_chars = settings.get("new_after_n_chars", 600)
        except:
            chunking_strategy = settings.get("chunking_strategy", "by_title")
            max_chars = settings.get("max_characters", 800)
            combine_under_n_chars = settings.get("combine_text_under_n_chars", 120)
            new_after_n_chars = settings.get("new_after_n_chars", 600)
        
        if chunking_strategy == "by_title":
            extracted_text = _group_elements_by_title(elements, max_chars, combine_under_n_chars)
        else:
            extracted_text = _combine_elements_basic(elements, max_chars, new_after_n_chars)
        
        if extracted_text.strip():
            if "(cid:" in extracted_text.lower():
                logger.warning("Unstructured 추출 결과에서 CID 깨짐 감지 - 폴백을 요청합니다.")
                raise FallbackException("CID characters detected in output.")
            
            logger.info(f"✅ Unstructured 프로세서로 {file_extension} 텍스트 추출 성공")
            return extracted_text.strip()
        else:
            logger.warning("Unstructured 추출 결과가 비어있어 폴백을 요청합니다.")
            raise FallbackException("Empty result from Unstructured.")
            
    except ImportError as e:
        logger.error(f"Unstructured 라이브러리 import 실패: {str(e)}")
        raise FallbackException(f"Unstructured library not installed: {e}")
    except Exception as e:
        # FallbackException이 아닌 다른 모든 예외를 포함
        if not isinstance(e, FallbackException):
            logger.error(f"Unstructured 프로세서 실패: {str(e)} - 폴백을 요청합니다.")
            raise FallbackException(f"Unstructured processor failed: {e}")
        else:
            # 이미 FallbackException인 경우 그대로 다시 발생시킴
            raise e
