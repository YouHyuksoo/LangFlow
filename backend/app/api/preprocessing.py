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
from ..services.chunking_service import (
    chunking_service,
    ChunkingRules,
    ChunkProposal,
    QualityWarning,
    ChunkQualityIssue
)
from ..services.file_service import FileService
from .users import get_admin_user
from ..core.config import settings
from ..core.logger import get_console_logger

logger = get_console_logger()
router = APIRouter()
security = HTTPBearer()

# 서비스 인스턴스 생성
file_service = FileService()

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


# ==================== PRD 방식 청킹 스키마 ====================

class ChunkingRulesRequest:
    """청킹 규칙 요청 스키마"""
    def __init__(self, **data):
        # 공통 규칙
        self.max_tokens = data.get("max_tokens", 800)
        self.min_tokens = data.get("min_tokens", 200)
        self.overlap_tokens = data.get("overlap_tokens", 80)
        self.respect_headings = data.get("respect_headings", True)
        self.preserve_tables = data.get("preserve_tables", True)
        self.preserve_lists = data.get("preserve_lists", True)
        self.drop_short_chunks = data.get("drop_short_chunks", False)
        self.snap_to_sentence = data.get("snap_to_sentence", True)
        self.use_hierarchical = data.get("use_hierarchical", True)
        self.hard_sentence_max_tokens = data.get("hard_sentence_max_tokens", 1000)
        self.version = data.get("version", "2.0")
        self.created_at = data.get("created_at")
        
        # 문장 분할 방법 선택
        self.sentence_splitter = data.get("sentence_splitter", "kss")
        
        # 방법별 전용 옵션
        # KSS 옵션 (Python KSS 6.0.5 호환)
        kss_options = data.get("kss_options", {})
        self.kss_backend = kss_options.get("backend", "punct")
        self.kss_num_workers = kss_options.get("num_workers", 1)
        self.kss_strip = kss_options.get("strip", True)
        self.kss_return_morphemes = kss_options.get("return_morphemes", False)
        self.kss_ignores = kss_options.get("ignores", [])
        
        kiwi_options = data.get("kiwi_options", {})
        self.kiwi_model_path = kiwi_options.get("model_path", "")
        self.kiwi_integrate_allomorph = kiwi_options.get("integrate_allomorph", True)
        self.kiwi_load_default_dict = kiwi_options.get("load_default_dict", True)
        self.kiwi_max_unk_form_len = kiwi_options.get("max_unk_form_len", 8)
        
        regex_options = data.get("regex_options", {})
        self.regex_sentence_endings = regex_options.get("sentence_endings", "[.!?]")
        self.regex_preserve_abbreviations = regex_options.get("preserve_abbreviations", True)
        self.regex_custom_patterns = regex_options.get("custom_patterns", [])
        
        # Recursive 옵션
        recursive_options = data.get("recursive_options", {})
        self.recursive_separators = recursive_options.get("separators", ["\n\n", "\n", " ", ""])
        self.recursive_keep_separator = recursive_options.get("keep_separator", False)
        self.recursive_is_separator_regex = recursive_options.get("is_separator_regex", False)
    
    def to_chunking_rules(self) -> ChunkingRules:
        """ChunkingRules 객체로 변환 (중앙 집중 설정 기반)"""
        # TODO(human): 에디터에서 전달받은 규칙을 중앙 집중 설정과 병합하는 로직 구현
        # 중앙 집중 설정을 기본값으로 하고, 에디터에서 오버라이드된 값만 적용
        return ChunkingRules.from_settings({
            # 에디터에서 오버라이드된 값들 전달
            "max_tokens": getattr(self, 'max_tokens', None),
            "min_tokens": getattr(self, 'min_tokens', None),
            "overlap_tokens": getattr(self, 'overlap_tokens', None),
            "sentence_splitter": getattr(self, 'sentence_splitter', None),
            # 기타 필요한 오버라이드 값들...
        })


class ChunkEditRequest:
    """청크 편집 요청 스키마"""
    def __init__(self, **data):
        self.chunk_id = data.get("chunk_id")
        self.text = data.get("text")
        self.label = data.get("label")
        self.order = data.get("order")


class ChunkMergeRequest:
    """청크 병합 요청 스키마"""
    def __init__(self, **data):
        self.chunk_ids = data.get("chunk_ids", [])  # 병합할 청크 ID 리스트


class ChunkSplitRequest:
    """청크 분할 요청 스키마"""
    def __init__(self, **data):
        self.chunk_id = data.get("chunk_id")
        self.split_position = data.get("split_position", 0)  # 문장 인덱스


class SaveChunksRequest:
    """청크 저장 요청 스키마"""
    def __init__(self, **data):
        self.file_id = data.get("file_id")
        self.chunks = data.get("chunks", [])
        self.embed_now = data.get("embed_now", True)

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


# ==================== PRD 방식 청킹 엔드포인트 ====================

@router.post("/propose_chunks/{file_id}", 
            summary="자동 청킹 제안 (PRD 방식)",
            description="파일 내용을 분석하여 최적의 청크 분할을 자동으로 제안합니다.")
async def propose_chunks(
    file_id: str,
    request_data: Dict[str, Any]
    # 임시로 인증 제거: admin_user = Depends(get_admin_user)
):
    """PRD 방식: 자동 청킹 제안"""
    try:
        logger.info("="*80)
        logger.info(f"🚀 청킹 제안 API 호출 시작 - file_id: {file_id}")
        logger.info(f"📊 요청 데이터 크기: {len(str(request_data))} characters")
        
        # 청킹 규칙 파싱
        rules_data = request_data.get("rules", {})
        logger.info(f"⚙️  청킹 규칙 설정:")
        logger.info(f"   - 최대 토큰: {rules_data.get('max_tokens', 'N/A')}")
        logger.info(f"   - 최소 토큰: {rules_data.get('min_tokens', 'N/A')}")
        logger.info(f"   - 오버랩: {rules_data.get('overlap_tokens', 'N/A')}")
        logger.info(f"   - 문장 분할기: {rules_data.get('sentence_splitter', 'N/A')}")
        logger.info(f"   - 계층적 모드: {rules_data.get('use_hierarchical', 'N/A')}")
        
        # KSS 옵션 로깅
        kss_options = rules_data.get('kss_options', {})
        if kss_options:
            logger.info(f"   - KSS 백엔드: {kss_options.get('backend', 'N/A')}")
            logger.info(f"   - KSS 워커 수: {kss_options.get('num_workers', 'N/A')}")
        
        rules_request = ChunkingRulesRequest(**rules_data)
        rules = rules_request.to_chunking_rules()
        
        # 파일 정보 조회
        file_metadata = file_metadata_service.get_file(file_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
        
        # 파일에서 전체 텍스트 추출
        try:
            # file_service를 통해 텍스트 추출
            content_response = await file_service.get_file_content(file_id)
            if not content_response["success"]:
                raise HTTPException(status_code=400, detail="파일 내용을 추출할 수 없습니다")
            
            full_text = content_response["content"]
            if not full_text or not full_text.strip():
                raise HTTPException(status_code=400, detail="파일에 텍스트 내용이 없습니다")
                
        except Exception as e:
            logger.error(f"텍스트 추출 실패: {e}")
            raise HTTPException(status_code=500, detail=f"텍스트 추출 중 오류 발생: {str(e)}")
        
        # 청킹 제안 생성
        try:
            proposed_chunks = chunking_service.propose_chunks(
                full_text, 
                rules, 
                use_hierarchical=rules_request.use_hierarchical
            )
            logger.info(f"청킹 제안 완료 - {len(proposed_chunks)}개 청크 생성 (계층적: {rules_request.use_hierarchical})")
        except Exception as e:
            logger.error(f"청킹 제안 생성 실패: {e}")
            raise HTTPException(status_code=500, detail=f"청킹 제안 생성 중 오류 발생: {str(e)}")
        
        # 응답 데이터 구성
        chunks_data = []
        total_tokens = 0
        
        for chunk in proposed_chunks:
            # 품질 경고 직렬화
            warnings_data = []
            for warning in chunk.quality_warnings:
                warnings_data.append({
                    "issue_type": warning.issue_type.value,
                    "severity": warning.severity,
                    "message": warning.message,
                    "suggestion": warning.suggestion
                })
            
            chunk_data = {
                "chunk_id": chunk.chunk_id,
                "order": chunk.order,
                "text": chunk.text,
                "token_estimate": chunk.token_estimate,
                "page_start": chunk.page_start,
                "page_end": chunk.page_end,
                "heading_path": chunk.heading_path,
                "quality_warnings": warnings_data
            }
            chunks_data.append(chunk_data)
            total_tokens += chunk.token_estimate
        
        logger.info(f"🏁 청킹 제안 API 완료 - 총 {len(proposed_chunks)}개 청크, {total_tokens}개 토큰")
        logger.info("="*80)
        
        return {
            "success": True,
            "message": f"청킹 제안이 완료되었습니다 ({len(proposed_chunks)}개 청크)",
            "data": {
                "file_id": file_id,
                "filename": file_metadata.filename,
                "chunks": chunks_data,
                "statistics": {
                    "total_chunks": len(proposed_chunks),
                    "total_tokens": total_tokens,
                    "average_tokens_per_chunk": total_tokens / max(1, len(proposed_chunks)),
                    "rules_applied": {
                        "max_tokens": rules.max_tokens,
                        "min_tokens": rules.min_tokens,
                        "overlap_tokens": rules.overlap_tokens,
                        "respect_headings": rules.respect_headings
                    }
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 청킹 제안 API 실패: {e}")
        logger.info("="*80)
        raise HTTPException(status_code=500, detail=f"청킹 제안 중 오류가 발생했습니다: {str(e)}")


@router.post("/merge_chunks", 
            summary="청크 병합",
            description="선택된 청크들을 하나로 병합합니다.")
async def merge_chunks(
    request_data: Dict[str, Any]
    # 임시로 인증 제거: admin_user = Depends(get_admin_user)
):
    """청크 병합"""
    try:
        merge_request = ChunkMergeRequest(**request_data)
        
        if len(merge_request.chunk_ids) < 2:
            raise HTTPException(status_code=400, detail="병합하려면 최소 2개의 청크가 필요합니다")
        
        # TODO: 실제 청크 데이터 조회 및 병합 로직 구현
        # 현재는 성공 응답만 반환
        
        return {
            "success": True,
            "message": f"{len(merge_request.chunk_ids)}개 청크가 병합되었습니다",
            "data": {
                "merged_chunk_id": f"merged_{'-'.join(merge_request.chunk_ids[:2])}",
                "original_chunk_ids": merge_request.chunk_ids
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"청크 병합 실패: {e}")
        raise HTTPException(status_code=500, detail=f"청크 병합 중 오류가 발생했습니다: {str(e)}")


@router.post("/split_chunk", 
            summary="청크 분할",
            description="선택된 청크를 지정된 위치에서 분할합니다.")
async def split_chunk(
    request_data: Dict[str, Any]
    # 임시로 인증 제거: admin_user = Depends(get_admin_user)
):
    """청크 분할"""
    try:
        split_request = ChunkSplitRequest(**request_data)
        
        if not split_request.chunk_id:
            raise HTTPException(status_code=400, detail="분할할 청크 ID가 필요합니다")
        
        if split_request.split_position <= 0:
            raise HTTPException(status_code=400, detail="유효한 분할 위치가 필요합니다")
        
        # TODO: 실제 청크 데이터 조회 및 분할 로직 구현
        # 현재는 성공 응답만 반환
        
        return {
            "success": True,
            "message": "청크가 분할되었습니다",
            "data": {
                "original_chunk_id": split_request.chunk_id,
                "split_position": split_request.split_position,
                "new_chunk_ids": [
                    f"{split_request.chunk_id}_part1",
                    f"{split_request.chunk_id}_part2"
                ]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"청크 분할 실패: {e}")
        raise HTTPException(status_code=500, detail=f"청크 분할 중 오류가 발생했습니다: {str(e)}")


@router.post("/save_chunks", 
            summary="편집된 청크 저장 (PRD 방식)",
            description="사용자가 편집한 청크들을 저장하고 임베딩을 진행합니다.")
async def save_chunks(
    request_data: Dict[str, Any]
    # 임시로 인증 제거: admin_user = Depends(get_admin_user)
):
    """편집된 청크 저장"""
    try:
        save_request = SaveChunksRequest(**request_data)
        
        if not save_request.file_id:
            raise HTTPException(status_code=400, detail="file_id가 필요합니다")
        
        if not save_request.chunks:
            raise HTTPException(status_code=400, detail="저장할 청크 데이터가 필요합니다")
        
        # 파일 정보 조회
        file_metadata = file_metadata_service.get_file(save_request.file_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
        
        # 청크 데이터 검증 및 정규화
        normalized_chunks = []
        for i, chunk_data in enumerate(save_request.chunks):
            normalized_chunk = {
                "order": chunk_data.get("order", i + 1),
                "label": chunk_data.get("label", f"청크 {i + 1}"),
                "type": chunk_data.get("type", "paragraph"),
                "text": chunk_data.get("text", ""),
                "coordinates": chunk_data.get("coordinates", {}),
                "ocr_text": chunk_data.get("ocr_text"),
                "extracted_text": chunk_data.get("extracted_text") or chunk_data.get("text", ""),
                "processing_options": chunk_data.get("processing_options", {}),
                "temp_id": chunk_data.get("chunk_id", f"chunk_{i + 1}")
            }
            normalized_chunks.append(normalized_chunk)
        
        # 수동 전처리 서비스를 통해 저장
        success = manual_preprocessing_service.save_preprocessing_data(
            save_request.file_id,
            normalized_chunks,
            []  # relationships는 현재 사용하지 않음
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="청크 데이터 저장에 실패했습니다")
        
        # 임베딩 작업 큐 추가 (옵션)
        embed_job = None
        if save_request.embed_now:
            embed_job = {
                "file_id": save_request.file_id,
                "chunk_count": len(normalized_chunks),
                "status": "queued"
            }
            # TODO: 실제 임베딩 서비스 연동
        
        return {
            "success": True,
            "message": f"청크 데이터가 저장되었습니다 ({len(normalized_chunks)}개 청크)",
            "data": {
                "file_id": save_request.file_id,
                "filename": file_metadata.filename,
                "saved_chunks": len(normalized_chunks),
                "embed_job": embed_job
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"청크 저장 실패: {e}")
        raise HTTPException(status_code=500, detail=f"청크 저장 중 오류가 발생했습니다: {str(e)}")


@router.get("/annotation_types", 
           summary="주석 타입 목록 조회",
           description="사용 가능한 주석 타입들의 목록을 조회합니다.")
async def get_annotation_types(admin_user = Depends(get_admin_user)):
    """주석 타입 목록 조회"""
    try:
        # AnnotationType enum에서 타입 목록 생성
        annotation_types = []
        for annotation_type in AnnotationType:
            type_info = {
                "value": annotation_type.value,
                "label": {
                    "title": "제목",
                    "paragraph": "본문 단락", 
                    "list": "목록",
                    "table": "표",
                    "image": "이미지",
                    "caption": "캡션",
                    "header": "헤더",
                    "footer": "푸터", 
                    "sidebar": "사이드바",
                    "custom": "사용자 정의"
                }.get(annotation_type.value, annotation_type.value),
                "description": {
                    "title": "문서의 제목이나 섹션 헤딩",
                    "paragraph": "일반적인 본문 단락",
                    "list": "목록이나 나열된 항목들",
                    "table": "표 형태의 데이터", 
                    "image": "이미지나 그림",
                    "caption": "이미지나 표의 캡션",
                    "header": "페이지나 섹션의 헤더",
                    "footer": "페이지나 섹션의 푸터",
                    "sidebar": "사이드바나 별도 정보",
                    "custom": "사용자가 정의한 특별한 타입"
                }.get(annotation_type.value, "")
            }
            annotation_types.append(type_info)
        
        return {
            "success": True,
            "data": annotation_types
        }
        
    except Exception as e:
        logger.error(f"주석 타입 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"주석 타입 조회 중 오류가 발생했습니다: {str(e)}")


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


# ==================== 청킹 규칙 설정 저장 ====================

@router.post("/save_chunking_settings",
            summary="청킹 규칙 설정 저장",
            description="청킹 규칙 설정을 전역 설정으로 저장합니다.")
async def save_chunking_settings(
    request_data: Dict[str, Any]
    # 임시로 인증 제거: admin_user = Depends(get_admin_user)
):
    """청킹 규칙 설정 저장"""
    try:
        logger.info("💾 청킹 규칙 설정 저장 요청")
        
        rules_data = request_data.get("rules", {})
        setting_name = request_data.get("name", "기본 설정")
        
        logger.info(f"   - 설정명: {setting_name}")
        logger.info(f"   - 규칙 데이터: {rules_data}")
        
        # 파이썬 디렉토리를 사용해서 설정 저장
        import json
        import os
        from pathlib import Path
        
        # 설정 저장 디렉토리 생성
        settings_dir = Path("chunking_settings")
        settings_dir.mkdir(exist_ok=True)
        
        # 설정 파일 저장
        settings_file = settings_dir / f"{setting_name.replace(' ', '_')}.json"
        
        settings_data = {
            "name": setting_name,
            "rules": rules_data,
            "created_at": datetime.now().isoformat(),
            "version": "1.0"
        }
        
        with open(settings_file, 'w', encoding='utf-8') as f:
            json.dump(settings_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"✅ 청킹 규칙 설정 저장 완료: {settings_file}")
        
        return {
            "success": True,
            "message": f"청킹 규칙 '{setting_name}'이 성공적으로 저장되었습니다.",
            "data": {
                "setting_name": setting_name,
                "file_path": str(settings_file),
                "created_at": settings_data["created_at"]
            }
        }
        
    except Exception as e:
        logger.error(f"❌ 청킹 규칙 설정 저장 실패: {e}")
        raise HTTPException(status_code=500, detail=f"설정 저장 중 오류가 발생했습니다: {str(e)}")


@router.get("/load_chunking_settings",
           summary="청킹 규칙 설정 목록 조회",
           description="저장된 청킹 규칙 설정 목록을 조회합니다.")
async def load_chunking_settings(
    # 임시로 인증 제거: admin_user = Depends(get_admin_user)
):
    """저장된 청킹 규칙 설정 목록 조회"""
    try:
        import json
        from pathlib import Path
        
        logger.info("📁 청킹 규칙 설정 목록 조회")
        
        settings_dir = Path("chunking_settings")
        if not settings_dir.exists():
            return {
                "success": True,
                "message": "저장된 설정이 없습니다.",
                "data": []
            }
        
        settings_list = []
        for settings_file in settings_dir.glob("*.json"):
            try:
                with open(settings_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    settings_list.append({
                        "name": data.get("name", settings_file.stem),
                        "created_at": data.get("created_at"),
                        "version": data.get("version", "1.0"),
                        "file_path": str(settings_file)
                    })
            except Exception as e:
                logger.warning(f"설정 파일 로드 실패 {settings_file}: {e}")
                continue
        
        # 생성일순 정렬
        settings_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        logger.info(f"✅ {len(settings_list)}개 설정 로드 완료")
        
        return {
            "success": True,
            "message": f"{len(settings_list)}개의 저장된 설정을 찾았습니다.",
            "data": settings_list
        }
        
    except Exception as e:
        logger.error(f"❌ 청킹 규칙 설정 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"설정 목록 조회 중 오류가 발생했습니다: {str(e)}")


@router.get("/load_chunking_settings/{setting_name}",
           summary="청킹 규칙 설정 로드",
           description="지정된 청킹 규칙 설정을 로드합니다.")
async def load_chunking_setting(
    setting_name: str
    # 임시로 인증 제거: admin_user = Depends(get_admin_user)
):
    """지정된 청킹 규칙 설정 로드"""
    try:
        import json
        from pathlib import Path
        
        logger.info(f"📎 청킹 규칙 설정 로드: {setting_name}")
        
        settings_dir = Path("chunking_settings")
        settings_file = settings_dir / f"{setting_name.replace(' ', '_')}.json"
        
        if not settings_file.exists():
            raise HTTPException(status_code=404, detail=f"설정 '{setting_name}'을 찾을 수 없습니다.")
        
        with open(settings_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        logger.info(f"✅ 청킹 규칙 설정 로드 완료: {setting_name}")
        
        return {
            "success": True,
            "message": f"청킹 규칙 '{setting_name}'이 로드되었습니다.",
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 청킹 규칙 설정 로드 실패: {e}")
        raise HTTPException(status_code=500, detail=f"설정 로드 중 오류가 발생했습니다: {str(e)}")