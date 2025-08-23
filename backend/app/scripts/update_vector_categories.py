#!/usr/bin/env python3
"""
벡터 메타데이터 테이블의 누락된 카테고리명 업데이트 스크립트

이 스크립트는 file_metadata 테이블의 category_name을 사용하여
vector_metadata 테이블의 category_name 필드를 업데이트합니다.
"""

import os
import sys
import logging
from pathlib import Path

# 상위 디렉토리를 Python 경로에 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from app.models.vector_models import VectorMetadataService, FileMetadataService
from app.services.category_service import CategoryService

def setup_logging():
    """로깅 설정"""
    # 윈도우 콘솔 인코딩 문제 해결을 위해 이모지 제거
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('update_vector_categories.log', encoding='utf-8')
        ]
    )
    return logging.getLogger(__name__)

async def update_vector_categories():
    """벡터 메타데이터의 카테고리명 업데이트"""
    logger = setup_logging()
    logger.info("벡터 메타데이터 카테고리명 업데이트 시작")
    
    try:
        # 서비스 인스턴스 사용
        from ..models.vector_models import vector_metadata_service, file_metadata_service
        category_service = CategoryService()
        
        # 모든 벡터 메타데이터 조회
        all_vector_metadata = vector_metadata_service.list_all_metadata()
        logger.info(f"총 {len(all_vector_metadata)}개의 벡터 메타데이터 발견")
        
        updated_count = 0
        failed_count = 0
        
        for vector_meta in all_vector_metadata:
            try:
                # category_name이 이미 있는 경우 스킵
                if vector_meta.category_name:
                    logger.debug(f"{vector_meta.file_id}: 카테고리명이 이미 있음 ({vector_meta.category_name})")
                    continue
                
                # category_id가 없는 경우 스킵
                if not vector_meta.category_id:
                    logger.debug(f"{vector_meta.file_id}: 카테고리 ID가 없음")
                    continue
                
                # file_metadata에서 category_name 가져오기
                file_meta = file_metadata_service.get_file(vector_meta.file_id)
                if file_meta and file_meta.category_name:
                    # vector_metadata 업데이트
                    success = vector_metadata_service.update_metadata(
                        file_id=vector_meta.file_id,
                        category_name=file_meta.category_name
                    )
                    
                    if success:
                        logger.info(f"{vector_meta.file_id}: 카테고리명 업데이트 완료 ({file_meta.category_name})")
                        updated_count += 1
                    else:
                        logger.error(f"{vector_meta.file_id}: 메타데이터 업데이트 실패")
                        failed_count += 1
                        
                # file_metadata에도 category_name이 없는 경우 category_service에서 가져오기
                elif file_meta and vector_meta.category_id:
                    category = await category_service.get_category(vector_meta.category_id)
                    if category:
                        # file_metadata와 vector_metadata 모두 업데이트
                        file_success = file_metadata_service.update_file(
                            file_id=vector_meta.file_id,
                            category_name=category.name
                        )
                        
                        vector_success = vector_metadata_service.update_metadata(
                            file_id=vector_meta.file_id,
                            category_name=category.name
                        )
                        
                        if file_success and vector_success:
                            logger.info(f"{vector_meta.file_id}: 카테고리명 복원 완료 ({category.name})")
                            updated_count += 1
                        else:
                            logger.error(f"{vector_meta.file_id}: 카테고리명 복원 실패")
                            failed_count += 1
                    else:
                        logger.warning(f"{vector_meta.file_id}: 카테고리 ID {vector_meta.category_id}를 찾을 수 없음")
                        failed_count += 1
                else:
                    logger.warning(f"{vector_meta.file_id}: 파일 메타데이터를 찾을 수 없음")
                    failed_count += 1
                    
            except Exception as e:
                logger.error(f"{vector_meta.file_id}: 처리 중 오류 - {str(e)}")
                failed_count += 1
        
        logger.info(f"업데이트 완료! 성공: {updated_count}개, 실패: {failed_count}개")
        
        return {
            "success": True,
            "updated": updated_count,
            "failed": failed_count,
            "total": len(all_vector_metadata)
        }
        
    except Exception as e:
        logger.error(f"스크립트 실행 중 오류: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import asyncio
    result = asyncio.run(update_vector_categories())
    
    if result["success"]:
        print(f"\n업데이트 완료: {result['updated']}개 성공, {result['failed']}개 실패")
        exit_code = 0 if result['failed'] == 0 else 1
    else:
        print(f"\n스크립트 실패: {result['error']}")
        exit_code = 2
    
    sys.exit(exit_code)