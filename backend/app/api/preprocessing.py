"""
수동 전처리 워크스페이스 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging
import os
import json

from ..models.vector_models import (
    manual_preprocessing_service, 
    file_metadata_service,
    PreprocessingRunStatus,
    AnnotationType,
    AnnotationRelationType
)
from .users import get_admin_user
from ..core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

# ==================== 데이터 스키마 ====================

class PreprocessingFileResponse:
    """전처리 파일 정보 응답 스키마"""
    def __init__(self, **data):
        self.file_id = data.get("file_id")
        self.filename = data.get("filename")
        self.upload_time = data.get("upload_time")
        self.file_size = data.get("file_size")
        self.category_name = data.get("category_name")
        self.preprocessing_status = data.get("preprocessing_status", "NOT_STARTED")
        self.preprocessing_completed_at = data.get("preprocessing_completed_at")
        self.processing_time = data.get("processing_time", 0.0)

class AnnotationRequest:
    """주석 생성/수정 요청 스키마"""
    def __init__(self, **data):
        self.order = data.get("order", 0)
        self.label = data.get("label", "")
        self.annotation_type = data.get("type", "paragraph")
        self.coordinates = data.get("coordinates", {})
        self.ocr_text = data.get("ocr_text")
        self.extracted_text = data.get("extracted_text")
        self.processing_options = data.get("processing_options", {})
        self.temp_id = data.get("temp_id")  # 클라이언트 임시 ID

class RelationshipRequest:
    """관계 생성 요청 스키마"""
    def __init__(self, **data):
        self.from_annotation_id = data.get("from_annotation_id")
        self.to_annotation_id = data.get("to_annotation_id")
        self.relationship_type = data.get("type", "connects_to")
        self.description = data.get("description")
        self.weight = data.get("weight", 1.0)

# ==================== 인증 및 권한 ====================
# get_admin_user를 사용하여 다른 API와 동일한 권한 체크 방식 사용

# ==================== API 엔드포인트 ====================

@router.get("/files", 
           summary="전처리 대상 파일 목록 조회",
           description="업로드된 파일 목록과 각 파일의 전처리 상태를 조회합니다.")
async def get_preprocessing_files(
    limit: Optional[int] = None,
    admin_user = Depends(get_admin_user)
):
    """전처리 대상 파일 목록 조회"""
    try:
        files_data = manual_preprocessing_service.get_files_for_preprocessing(limit=limit)
        
        response_data = []
        for file_data in files_data:
            # 날짜 필드 안전하게 처리
            upload_time = file_data["upload_time"]
            if upload_time and hasattr(upload_time, 'isoformat'):
                upload_time = upload_time.isoformat()
            elif upload_time and not isinstance(upload_time, str):
                upload_time = str(upload_time)
            
            completed_at = file_data["preprocessing_completed_at"]
            if completed_at and hasattr(completed_at, 'isoformat'):
                completed_at = completed_at.isoformat()
            elif completed_at and not isinstance(completed_at, str):
                completed_at = str(completed_at)
            
            response_data.append({
                "file_id": file_data["file_id"],
                "filename": file_data["filename"],
                "upload_time": upload_time,
                "file_size": file_data["file_size"],
                "category_name": file_data["category_name"],
                "preprocessing_status": file_data["preprocessing_status"],
                "preprocessing_completed_at": completed_at,
                "processing_time": file_data["processing_time"]
            })
        
        return {
            "success": True,
            "data": response_data,
            "total": len(response_data)
        }
        
    except Exception as e:
        logger.error(f"전처리 파일 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"파일 목록 조회 중 오류가 발생했습니다: {str(e)}")


@router.post("/files/{file_id}/start", 
            summary="전처리 작업 시작",
            description="특정 파일에 대한 수동 전처리 작업을 시작합니다.")
async def start_preprocessing(
    file_id: str,
    admin_user = Depends(get_admin_user)
):
    """전처리 작업 시작"""
    try:
        logger.info(f"전처리 작업 시작 요청 받음 - file_id: {file_id}")
        
        # 파일 존재 확인
        file_metadata = file_metadata_service.get_file(file_id)
        if not file_metadata:
            logger.error(f"파일을 찾을 수 없음 - file_id: {file_id}")
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
        
        logger.info(f"파일 확인 완료 - filename: {file_metadata.filename}")
        
        # 전처리 작업 시작
        run_id = manual_preprocessing_service.start_preprocessing(file_id)
        if not run_id:
            logger.error(f"전처리 작업 시작 실패 - file_id: {file_id}")
            raise HTTPException(status_code=500, detail="전처리 작업 시작에 실패했습니다")
        
        logger.info(f"전처리 작업 시작 성공 - run_id: {run_id}")
        
        return {
            "success": True,
            "message": "전처리 작업이 시작되었습니다",
            "data": {
                "run_id": run_id,
                "file_id": file_id,
                "status": "IN_PROGRESS"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"전처리 작업 시작 실패: {e}")
        raise HTTPException(status_code=500, detail=f"전처리 작업 시작 중 오류가 발생했습니다: {str(e)}")


@router.get("/files/{file_id}/metadata", 
           summary="전처리 메타데이터 조회",
           description="완료된 전처리 작업의 주석 및 관계 데이터를 조회합니다.")
async def get_preprocessing_metadata(
    file_id: str,
    admin_user = Depends(get_admin_user)
):
    """전처리 메타데이터 조회"""
    try:
        preprocessing_data = manual_preprocessing_service.get_preprocessing_data(file_id)
        
        if not preprocessing_data:
            return {
                "success": True,
                "message": "전처리 데이터가 없습니다",
                "data": None
            }
        
        # ISO 형식으로 날짜 변환 (안전하게 처리)
        completed_at = preprocessing_data.get("completed_at")
        if completed_at:
            if hasattr(completed_at, 'isoformat'):
                preprocessing_data["completed_at"] = completed_at.isoformat()
            elif not isinstance(completed_at, str):
                preprocessing_data["completed_at"] = str(completed_at)
        
        return {
            "success": True,
            "data": preprocessing_data
        }
        
    except Exception as e:
        logger.error(f"전처리 메타데이터 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"메타데이터 조회 중 오류가 발생했습니다: {str(e)}")


@router.post("/files/{file_id}/metadata", 
            summary="전처리 메타데이터 저장",
            description="수동 전처리 작업의 주석 및 관계 데이터를 저장합니다.")
async def save_preprocessing_metadata(
    file_id: str,
    request_data: Dict[str, Any],
    admin_user = Depends(get_admin_user)
):
    """전처리 메타데이터 저장"""
    try:
        # 파일 존재 확인
        file_metadata = file_metadata_service.get_file(file_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
        
        # 요청 데이터 검증
        annotations_data = request_data.get("annotations", [])
        relationships_data = request_data.get("relationships", [])
        
        if not annotations_data:
            raise HTTPException(status_code=400, detail="주석 데이터가 필요합니다")
        
        # 데이터 저장
        success = manual_preprocessing_service.save_preprocessing_data(
            file_id=file_id,
            annotations_data=annotations_data,
            relationships_data=relationships_data
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="전처리 데이터 저장에 실패했습니다")
        
        return {
            "success": True,
            "message": "전처리 데이터가 성공적으로 저장되었습니다",
            "data": {
                "file_id": file_id,
                "annotations_count": len(annotations_data),
                "relationships_count": len(relationships_data) if relationships_data else 0
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"전처리 메타데이터 저장 실패: {e}")
        raise HTTPException(status_code=500, detail=f"메타데이터 저장 중 오류가 발생했습니다: {str(e)}")


@router.post("/simulate_chunking", 
            summary="청킹 시뮬레이션",
            description="저장하지 않고 현재 주석 설정으로 청킹 결과를 미리보기합니다.")
async def simulate_chunking(
    request_data: Dict[str, Any],
    admin_user = Depends(get_admin_user)
):
    """청킹 시뮬레이션"""
    try:
        file_id = request_data.get("file_id")
        annotations_data = request_data.get("annotations", [])
        
        if not file_id:
            raise HTTPException(status_code=400, detail="file_id가 필요합니다")
        
        if not annotations_data:
            raise HTTPException(status_code=400, detail="주석 데이터가 필요합니다")
        
        # 파일 정보 조회
        file_metadata = file_metadata_service.get_file(file_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
        
        # 시뮬레이션 결과 생성 (실제로는 주석 순서에 따라 텍스트 청킹)
        chunks = []
        for i, annotation in enumerate(sorted(annotations_data, key=lambda x: x.get("order", 0))):
            chunk = {
                "chunk_id": i + 1,
                "order": annotation.get("order", 0),
                "label": annotation.get("label", f"청크 {i + 1}"),
                "type": annotation.get("type", "paragraph"),
                "text": annotation.get("extracted_text", "") or annotation.get("ocr_text", "") or f"[{annotation.get('label', '텍스트')} 영역]",
                "coordinates": annotation.get("coordinates", {}),
                "estimated_tokens": len((annotation.get("extracted_text", "") or annotation.get("ocr_text", "")).split()) * 1.3  # 대략적인 토큰 수
            }
            chunks.append(chunk)
        
        # 통계 정보
        total_text_length = sum(len(chunk["text"]) for chunk in chunks)
        total_tokens = sum(chunk["estimated_tokens"] for chunk in chunks)
        
        return {
            "success": True,
            "message": "청킹 시뮬레이션이 완료되었습니다",
            "data": {
                "file_id": file_id,
                "filename": file_metadata.filename,
                "chunks": chunks,
                "statistics": {
                    "total_chunks": len(chunks),
                    "total_text_length": total_text_length,
                    "estimated_total_tokens": total_tokens,
                    "average_chunk_size": total_text_length / max(1, len(chunks)),
                    "average_tokens_per_chunk": total_tokens / max(1, len(chunks))
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"청킹 시뮬레이션 실패: {e}")
        raise HTTPException(status_code=500, detail=f"시뮬레이션 중 오류가 발생했습니다: {str(e)}")


@router.get("/stats", 
           summary="전처리 워크스페이스 통계",
           description="전처리 작업 통계 정보를 조회합니다.")
async def get_preprocessing_stats(
    admin_user = Depends(get_admin_user)
):
    """전처리 워크스페이스 통계"""
    try:
        files_data = manual_preprocessing_service.get_files_for_preprocessing()
        
        # 상태별 파일 수 계산
        status_counts = {}
        for file_data in files_data:
            status = file_data["preprocessing_status"]
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # 전체 통계
        total_files = len(files_data)
        completed_files = status_counts.get("COMPLETED", 0)
        in_progress_files = status_counts.get("IN_PROGRESS", 0)
        not_started_files = status_counts.get("NOT_STARTED", 0)
        
        # 완료된 작업의 평균 처리 시간
        completed_processing_times = [
            file_data["processing_time"] 
            for file_data in files_data 
            if file_data["preprocessing_status"] == "COMPLETED" and file_data["processing_time"]
        ]
        average_processing_time = sum(completed_processing_times) / max(1, len(completed_processing_times))
        
        return {
            "success": True,
            "data": {
                "total_files": total_files,
                "completed_files": completed_files,
                "in_progress_files": in_progress_files,
                "not_started_files": not_started_files,
                "completion_rate": completed_files / max(1, total_files),
                "average_processing_time": average_processing_time,
                "status_distribution": status_counts
            }
        }
        
    except Exception as e:
        logger.error(f"전처리 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"통계 조회 중 오류가 발생했습니다: {str(e)}")


@router.get("/annotation-types", 
           summary="주석 타입 목록",
           description="사용 가능한 주석 타입 목록을 반환합니다.")
async def get_annotation_types(
    admin_user = Depends(get_admin_user)
):
    """주석 타입 목록"""
    return {
        "success": True,
        "data": [
            {"value": "title", "label": "제목", "description": "문서 제목이나 헤딩"},
            {"value": "paragraph", "label": "본문", "description": "일반적인 본문 텍스트"},
            {"value": "list", "label": "목록", "description": "순서가 있거나 없는 목록"},
            {"value": "table", "label": "표", "description": "테이블 데이터"},
            {"value": "image", "label": "이미지", "description": "이미지 영역"},
            {"value": "caption", "label": "캡션", "description": "이미지나 표의 설명"},
            {"value": "header", "label": "헤더", "description": "페이지 상단 영역"},
            {"value": "footer", "label": "푸터", "description": "페이지 하단 영역"},
            {"value": "sidebar", "label": "사이드바", "description": "측면 영역"},
            {"value": "custom", "label": "사용자 정의", "description": "기타 사용자 정의 타입"}
        ]
    }


@router.get("/relationship-types", 
           summary="관계 타입 목록",
           description="사용 가능한 주석 간 관계 타입 목록을 반환합니다.")
async def get_relationship_types(
    admin_user = Depends(get_admin_user)
):
    """관계 타입 목록"""
    return {
        "success": True,
        "data": [
            {"value": "connects_to", "label": "연결됨", "description": "두 영역이 논리적으로 연결됨"},
            {"value": "part_of", "label": "부분임", "description": "한 영역이 다른 영역의 일부임"},
            {"value": "follows", "label": "뒤따름", "description": "순차적으로 뒤따르는 관계"},
            {"value": "references", "label": "참조함", "description": "다른 영역을 참조하는 관계"},
            {"value": "caption_of", "label": "캡션임", "description": "이미지나 표의 캡션 관계"}
        ]
    }


@router.post("/reset-status", 
            summary="전처리 상태 리셋",
            description="모든 진행중 상태를 미시작으로 변경합니다 (개발/관리용)")
async def reset_preprocessing_status(
    admin_user = Depends(get_admin_user)
):
    """전처리 상태 리셋 (관리자용)"""
    try:
        import sqlite3
        from ..core.config import settings
        
        db_path = os.path.join(settings.DATA_DIR, "db", "users.db")
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # 진행중 상태를 미시작으로 변경
            cursor.execute('UPDATE preprocessing_runs SET status = "NOT_STARTED" WHERE status = "IN_PROGRESS"')
            affected = cursor.rowcount
            
        logger.info(f"전처리 상태 리셋 완료 - {affected}개 파일 변경")
        
        return {
            "success": True,
            "message": f"{affected}개 파일의 상태를 미시작으로 변경했습니다",
            "data": {
                "affected_count": affected
            }
        }
        
    except Exception as e:
        logger.error(f"전처리 상태 리셋 실패: {e}")
        raise HTTPException(status_code=500, detail=f"상태 리셋 중 오류가 발생했습니다: {str(e)}")