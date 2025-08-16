
import os
import logging
from typing import Literal, Optional

from .preprocessing import unstructured_processor, basic_processor, docling_processor
from .exceptions import FallbackException
from .settings_service import settings_service

# 로거 설정
logger = logging.getLogger(__name__)

ProcessingMethod = Literal["unstructured", "docling", "basic"]

class PreprocessingService:
    """파일 전처리를 위한 진입점 서비스(Facade)."""

    async def process_file(self, file_path: str, preferred_method: Optional[ProcessingMethod] = None) -> str:
        """
        지정된 우선순위에 따라 파일을 전처리하고 텍스트를 추출합니다.
        하나의 메소드가 실패하면 다음 메소드를 순차적으로 시도합니다.

        Args:
            file_path: 처리할 파일의 경로.
            preferred_method: 가장 먼저 시도할 전처리 방식. None이면 기본 설정에서 읽어옴.

        Returns:
            추출된 텍스트.

        Raises:
            Exception: 모든 전처리 방법이 실패했을 때.
        """
        file_extension = os.path.splitext(file_path)[1].lower()
        
        # preferred_method가 None이면 기본 설정에서 읽어옴
        if preferred_method is None:
            system_settings = settings_service.get_section_settings("system")
            preferred_method = system_settings.get("preprocessing_method", "basic")
            logger.info(f"기본 설정에서 전처리 방식 로드: {preferred_method}")
        
        # 처리 순서 정의 (선호하는 방식을 가장 앞에)
        method_order = [preferred_method]
        if preferred_method == "unstructured":
            method_order.append("basic")
        elif preferred_method == "docling":
            method_order.append("unstructured")
            method_order.append("basic")
        
        # 중복 제거
        method_order = list(dict.fromkeys(method_order))
        if "basic" not in method_order:
             method_order.append("basic")

        last_error = None

        for method in method_order:
            try:
                logger.info(f">>> 전처리 시도: '{method}' 방식으로...")
                if method == "unstructured":
                    # Unstructured 프로세서는 폴백을 위해 FallbackException을 발생시킬 수 있음
                    return await unstructured_processor.process(file_path, file_extension)
                
                elif method == "docling":
                    # Docling 프로세서도 실패 시 FallbackException을 발생시킬 수 있음
                    # TODO: Docling 옵션을 중앙 설정에서 받아와 전달해야 함
                    return await docling_processor.process(file_path)
                
                elif method == "basic":
                    return await basic_processor.process(file_path, file_extension)

            except FallbackException as e:
                logger.warning(f"''{method}' 방식 처리 실패 (폴백 요청): {e}")
                last_error = e
                continue # 다음 방식으로 계속
            except Exception as e:
                logger.error(f"''{method}' 방식 처리 중 예기치 않은 오류: {e}")
                last_error = e
                continue

        logger.error(f"모든 전처리 방식 실패: {file_path}")
        raise Exception(f"모든 전처리 방식이 실패했습니다. 최종 오류: {last_error}")
