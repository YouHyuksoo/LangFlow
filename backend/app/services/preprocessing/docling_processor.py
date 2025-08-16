import os
import logging
import time

from ..docling_service import DoclingService
from ...models.schemas import DoclingOptions
from ..exceptions import FallbackException
from ..settings_service import settings_service

# 로거 설정
logger = logging.getLogger(__name__)

# Docling 서비스 인스턴스
docling_service = DoclingService()

async def process(file_path: str, options: DoclingOptions = None) -> str:
    """Docling을 사용하여 문서를 전처리하고 텍스트를 추출합니다."""
    logger.info(f"⚙️ Docling Processor 실행: {os.path.basename(file_path)}")

    if not docling_service.is_available:
        logger.warning("Docling을 사용할 수 없어 폴백을 요청합니다.")
        raise FallbackException("Docling service not available.")

    is_supported = await docling_service.is_supported_format(file_path)
    if not is_supported:
        logger.warning(f"Docling이 지원하지 않는 파일 형식: {file_path}")
        raise FallbackException(f"Unsupported format for Docling: {os.path.splitext(file_path)[1]}")

    # 통합 설정에서 Docling 옵션 가져오기
    if options is None:
        try:
            docling_settings = settings_service.get_section_settings("docling")
            options = DoclingOptions(
                output_format=docling_settings.get("outputFormat", "markdown"),
                extract_tables=docling_settings.get("extractTables", True),
                extract_images=docling_settings.get("extractImages", False),
                ocr_enabled=docling_settings.get("ocrEnabled", False)
            )
        except Exception as e:
            logger.warning(f"Docling 설정 로드 실패, 기본값 사용: {e}")
            options = DoclingOptions(
                output_format="markdown",
                extract_tables=True,
                extract_images=False,
                ocr_enabled=False
            )

    logger.info(f"🔄 Docling으로 문서 전처리 시작: {file_path}")
    start_time = time.time()
    docling_result = await docling_service.process_document(file_path, options)
    elapsed = time.time() - start_time

    if not docling_result.success:
        error_msg = docling_result.error
        logger.error(f"❌ Docling 처리 실패 ({elapsed:.2f}초 소요): {error_msg}")
        raise FallbackException(f"Docling processing failed: {error_msg}")

    logger.info(f"✅ Docling 처리 성공 ({elapsed:.2f}초 소요)")
    
    # 주요 콘텐츠 선택 (우선순위: markdown > text)
    content = docling_result.content
    if options.output_format == "markdown" and content.get("markdown"):
        main_content = content["markdown"]
    elif content.get("text"):
        main_content = content["text"]
    else:
        logger.warning("⚠️ Docling 결과에서 유효한 텍스트 콘텐츠를 찾을 수 없습니다.")
        raise FallbackException("No valid text content in Docling result.")

    return main_content