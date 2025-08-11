from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, Body
from typing import List, Optional
from ..core.config import settings
from ..core.logger import get_user_logger, get_console_logger
from ..models.schemas import FileUploadResponse, FileInfo
from ..services import get_file_service
from .settings import load_settings
import os
import json

router = APIRouter(prefix="/files", tags=["files"])
_ulog = get_user_logger()
_clog = get_console_logger()

def get_file_service_instance():
    """FileService 인스턴스를 지연 로딩으로 가져옵니다."""
    return get_file_service()

@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    category_id: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    force_replace: bool = Form(False)
):
    """PDF 파일 업로드 및 자동 벡터화"""
    try:
        _clog.info(f"파일 업로드 요청 수신: filename={file.filename}, category_id={category_id}, category={category}, force_replace={force_replace}")
        
        # 카테고리 검증
        if not category_id and not category:
            _clog.error("카테고리 누락된 업로드 요청")
            raise HTTPException(
                status_code=400, 
                detail="카테고리를 지정해야 합니다. category_id 또는 category를 제공해주세요."
            )
        
        # 파일 형식 검증 - 동적 설정 사용
        from .settings import load_settings
        current_settings = load_settings()
        allowed_file_types = current_settings.get("allowedFileTypes", ["pdf"])
        allowed_extensions = [f".{ext}" if not ext.startswith('.') else ext for ext in allowed_file_types]
        
        file_extension = None
        if file.filename:
            file_extension = '.' + file.filename.lower().split('.')[-1]
        
        if not file_extension or file_extension not in allowed_extensions:
            _clog.error(f"잘못된 파일 형식: {file.filename}")
            raise HTTPException(
                status_code=400,
                detail=f"지원되지 않는 파일 형식입니다. 지원 형식: {', '.join(allowed_extensions)}"
            )
        
        # 파일 크기 로깅 (검증은 FileService에서 처리)
        _clog.info(f"파일 크기: {file.size} bytes")
        
        # FileService 업로드 시도
        _clog.info("FileService.upload_file 호출 시작")
        response = await get_file_service_instance().upload_file(file, category_id or category, force_replace=force_replace)
        _clog.info("FileService.upload_file 호출 완료")
        
        _ulog.info(
            "파일 업로드 완료",
            extra={
                "event": "file_uploaded",
                "file_id": response.file_id,
                "category": category_id or category,
                "uploaded_filename": response.filename,
            },
        )
        return response
    except HTTPException as he:
        _clog.error(f"HTTP 예외 발생: {he.status_code} - {he.detail}")
        raise
    except Exception as e:
        _clog.exception(f"파일 업로드 중 예기치 못한 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"파일 업로드 중 오류가 발생했습니다: {str(e)}")

@router.get("/", response_model=List[FileInfo])
async def list_files(category_id: Optional[str] = Query(None)):
    """업로드된 파일 목록 조회"""
    try:
        _clog.debug(f"파일 목록 조회 - category_id: {category_id}")
        files = await get_file_service_instance().list_files(category_id)
        _clog.debug(f"파일 목록 조회 완료 - {len(files)}개")
        return files
    except Exception as e:
        _clog.exception("파일 목록 조회 중 오류", extra={"event": "file_list_error"})
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/category/{category_id}", response_model=List[FileInfo])
async def get_files_by_category(category_id: str):
    """카테고리별 파일 목록 조회"""
    try:
        files = await get_file_service_instance().list_files(category_id)
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{file_id}", response_model=FileInfo)
async def get_file_info(file_id: str):
    """특정 파일 정보 조회"""
    try:
        file_info = await get_file_service_instance().get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        return file_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{file_id}")
async def delete_file(file_id: str):
    """파일 삭제"""
    try:
        success = await get_file_service_instance().delete_file(file_id)
        if not success:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        _ulog.info("파일 삭제", extra={"event": "file_deleted", "file_id": file_id})
        return {"message": "파일이 성공적으로 삭제되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-hashes")
async def generate_missing_hashes():
    """기존 파일들의 누락된 해시를 생성합니다."""
    try:
        result = await get_file_service_instance().generate_missing_hashes()
        _ulog.info("파일 해시 생성", extra={"event": "file_hash_generated", "count": result.get("updated", 0) if isinstance(result, dict) else None})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{file_id}/vectorize")
async def vectorize_file(file_id: str):
    """파일 벡터화"""
    try:
        success = await get_file_service_instance().vectorize_file(file_id)
        if not success:
            raise HTTPException(status_code=500, detail="벡터화에 실패했습니다.")
        _ulog.info("파일 벡터화 완료", extra={"event": "file_vectorized", "file_id": file_id})
        return {"message": "파일이 성공적으로 벡터화되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{file_id}/download")
async def download_file(file_id: str):
    """파일 다운로드"""
    try:
        file_path = await get_file_service_instance().get_file_path(file_id)
        if not file_path:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        
        from fastapi.responses import FileResponse
        return FileResponse(
            path=file_path,
            filename=file_path.split('/')[-1],
            media_type='application/pdf'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{file_id}/view")
async def view_file(file_id: str):
    """파일 보기"""
    try:
        file_path = await get_file_service_instance().get_file_path(file_id)
        if not file_path:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        
        from fastapi.responses import FileResponse
        return FileResponse(
            path=file_path,
            media_type='application/pdf'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{file_id}/vectorization-status")
async def get_vectorization_status(file_id: str):
    """파일의 벡터화 상태 조회"""
    try:
        file_info = await get_file_service_instance().get_file_info(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
        
        return {
            "file_id": file_id,
            "filename": file_info.filename,
            "status": file_info.status,
            "vectorized": file_info.vectorized,
            "vectorized_at": file_info.vectorized_at if hasattr(file_info, 'vectorized_at') else None,
            "error": getattr(file_info, 'error', None)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{file_id}/vectorization/retry")
async def retry_vectorization(file_id: str):
    """벡터화 재시도"""
    try:
        success = await get_file_service_instance().retry_vectorization(file_id)
        if not success:
            raise HTTPException(status_code=500, detail="벡터화 재시도에 실패했습니다.")
        return {"message": "벡터화 재시도가 시작되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search/")
async def search_documents(query: str, top_k: int = 5, category_ids: str = None):
    """문서 검색"""
    try:
        # 카테고리 ID 파싱
        category_list = None
        if category_ids:
            category_list = category_ids.split(',')
        
        # VectorService를 통한 검색 (지연 로딩)
        file_service = get_file_service_instance()
        if not file_service.vector_service:
            raise HTTPException(status_code=500, detail="벡터 검색 서비스를 초기화할 수 없습니다.")
        
        results = await file_service.vector_service.search_similar_chunks(
            query, top_k, category_list
        )
        
        return {
            "query": query,
            "results": results,
            "total_results": len(results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vectorization/status/")
async def get_vectorization_status():
    """전체 벡터화 상태 조회 (대시보드용 - 메타데이터 기반, ChromaDB 초기화 없이)"""
    try:
        all_files = await get_file_service_instance().list_files()
        
        # 파일 상태별 통계
        status_stats = {
            "total_files": len(all_files),
            "uploaded": 0,
            "pending_vectorization": 0,
            "vectorizing": 0,
            "vectorized": 0,
            "vectorization_failed": 0
        }
        
        # 메타데이터 기반으로 상태 집계
        files_summary = []
        
        for file_info in all_files:
            status = file_info.status
            if status in status_stats:
                status_stats[status] += 1
            
            # 파일별 요약 정보 (메타데이터만 사용)
            files_summary.append({
                "file_id": file_info.file_id,
                "filename": file_info.filename,
                "status": file_info.status,
                "vectorized": file_info.vectorized,
                "category_name": file_info.category_name,
                "upload_time": file_info.upload_time,
                "file_size": file_info.file_size
            })
        
        # ChromaDB 상태는 현재 초기화된 상태만 확인 (초기화 시도 없이)
        chromadb_status = "unknown"
        chromadb_message = "ChromaDB 상태를 확인하려면 별도 조회가 필요합니다."
        
        # 이미 초기화된 VectorService가 있다면 상태만 확인
        file_service = get_file_service_instance()
        if hasattr(file_service, '_vector_service') and file_service._vector_service:
            try:
                chroma_status = file_service._vector_service.get_chromadb_status()
                chromadb_status = chroma_status.get("status", "unknown")
                chromadb_message = chroma_status.get("message", "상태 정보 없음")
            except Exception:
                chromadb_status = "error"
                chromadb_message = "ChromaDB 상태 조회 중 오류 발생"
        else:
            chromadb_status = "not_loaded"
            chromadb_message = "ChromaDB가 로드되지 않았습니다. 벡터화 작업 시 자동으로 로드됩니다."
        
        return {
            "status_stats": status_stats,
            "files": files_summary,
            "chromadb_status": chromadb_status,
            "chromadb_message": chromadb_message,
            "total_vectorized_files": status_stats["vectorized"],
            "message": f"총 {len(all_files)}개 파일 중 {status_stats['vectorized']}개가 벡터화되었습니다."
        }
        
    except Exception as e:
        print(f"벡터화 상태 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/vectorization/execute")
async def execute_vectorization(
    file_ids: Optional[List[str]] = Body(None),
    category_id: Optional[str] = Body(None)
):
    """선택된 파일들의 벡터화를 실행합니다."""
    try:
        # 설정 파일에서 기본 벡터화 Flow ID 읽기
        config_file = os.path.join(settings.BASE_DIR, "langflow", "config.json")
        vectorization_flow_id = None
        
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)
                vectorization_flow_id = config_data.get("default_vectorization_flow_id")
            except Exception as e:
                print(f"설정 파일 읽기 오류: {str(e)}")
        
        if not vectorization_flow_id:
            raise HTTPException(
                status_code=400, 
                detail="LangFlow Flow ID가 설정되지 않았습니다. 관리자 설정에서 Flow ID를 설정해주세요."
            )
        
        # 대상 파일 목록 조회
        target_files = []
        if file_ids:
            # 특정 파일들만 벡터화
            for file_id in file_ids:
                file_info = await get_file_service_instance().get_file_info(file_id)
                if file_info and file_info.status in ["pending_vectorization", "vectorization_failed"]:
                    target_files.append(file_info)
        elif category_id:
            # 특정 카테고리의 모든 파일 벡터화 (최근 업로드된 것만)
            from datetime import datetime, timedelta
            recent_cutoff = datetime.now() - timedelta(hours=1)
            files = await get_file_service_instance().list_files(category_id)
            target_files = [f for f in files if f.status in ["uploaded", "pending_vectorization", "vectorization_failed"] and f.upload_time >= recent_cutoff]
        else:
            # 모든 대기 중인 파일 벡터화 (최근 업로드된 것만)
            from datetime import datetime, timedelta
            recent_cutoff = datetime.now() - timedelta(hours=1)
            all_files = await get_file_service_instance().list_files()
            target_files = [f for f in all_files if f.status in ["uploaded", "pending_vectorization", "vectorization_failed"] and f.upload_time >= recent_cutoff]
        
        if not target_files:
            _clog.debug("벡터화 대상 없음")
            return {"message": "벡터화할 파일이 없습니다."}
        
        # 백그라운드에서 벡터화 실행
        import asyncio
        for file_info in target_files:
            asyncio.create_task(get_file_service_instance()._start_vectorization(file_info.file_id))
        _ulog.info(
            "벡터화 배치 시작",
            extra={"event": "vectorization_batch_started", "count": len(target_files)},
        )
        
        return {
            "message": f"{len(target_files)}개 파일의 벡터화가 시작되었습니다.",
            "target_files": [f.filename for f in target_files]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/langflow/status/")
async def get_langflow_status():
    """LangFlow 등록 현황 조회"""
    try:
        # LangFlow 서비스를 직접 초기화하여 사용
        from ..services.langflow_service import LangflowService
        langflow_service = LangflowService()
        flows = await langflow_service.get_flows()
        
        # 설정 파일에서 기본 Flow ID 읽기
        config_file = os.path.join(settings.BASE_DIR, "langflow", "config.json")
        default_flow_id = None
        default_search_flow_id = None
        
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)
                default_flow_id = config_data.get("default_vectorization_flow_id")
                default_search_flow_id = config_data.get("default_search_flow_id")
            except Exception as e:
                print(f"설정 파일 읽기 오류: {str(e)}")
        
        return {
            "default_vectorization_flow_id": default_flow_id,
            "default_search_flow_id": default_search_flow_id,
            "total_flows": len(flows) if flows else 0,
            "flows": flows or [],
            "langflow_configured": bool(default_flow_id or default_search_flow_id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/langflow/flows/{flow_id}")
async def get_langflow_flow_details(flow_id: str):
    """특정 LangFlow Flow의 상세 정보 조회"""
    try:
        from ..services.langflow_service import LangflowService
        langflow_service = LangflowService()
        flow_details = await langflow_service.get_flow_details(flow_id)
        
        if not flow_details:
            raise HTTPException(status_code=404, detail="Flow를 찾을 수 없습니다.")
        
        return flow_details
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/langflow/flows/{flow_id}/toggle")
async def toggle_flow_status(flow_id: str):
    """Flow 활성/비활성 상태를 토글합니다."""
    try:
        from ..services.langflow_service import LangflowService
        langflow_service = LangflowService()
        success = await langflow_service.toggle_flow_status(flow_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Flow를 찾을 수 없습니다.")
        
        return {"message": "Flow 상태가 변경되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/langflow/flows/{flow_id}/set-default")
async def set_default_vectorization_flow(flow_id: str):
    """Flow를 기본 벡터화 Flow로 설정합니다."""
    try:
        from ..services.langflow_service import LangflowService
        langflow_service = LangflowService()
        success = await langflow_service.set_default_vectorization_flow(flow_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Flow를 찾을 수 없습니다.")
        _ulog.info("기본 벡터화 Flow 설정", extra={"event": "langflow_set_default", "flow_id": flow_id})
        return {"message": "기본 벡터화 Flow가 설정되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/langflow/flows/{flow_id}/set-search")
async def set_search_flow(flow_id: str):
    """검색 Flow 설정"""
    try:
        success = await get_file_service_instance().set_search_flow(flow_id)
        if not success:
            raise HTTPException(status_code=404, detail="Flow를 찾을 수 없습니다.")
        _ulog.info("검색 Flow 설정", extra={"event": "langflow_set_search", "flow_id": flow_id})
        return {"message": f"검색 Flow가 {flow_id}로 설정되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/langflow/flows/{flow_id}")
async def delete_flow(flow_id: str):
    """Flow 삭제"""
    try:
        success = await get_file_service_instance().delete_flow(flow_id)
        if not success:
            raise HTTPException(status_code=404, detail="Flow를 찾을 수 없습니다.")
        _ulog.info("Flow 삭제", extra={"event": "langflow_deleted", "flow_id": flow_id})
        return {"message": f"Flow {flow_id}가 성공적으로 삭제되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/maintenance/diagnose-and-fix")
async def diagnose_and_fix_database():
    """ChromaDB 데이터베이스 진단 및 정상화를 순차적으로 실행합니다."""
    try:
        file_service = get_file_service_instance()
        vector_service = file_service.vector_service
        
        results = {
            "steps": [],
            "summary": {
                "total_issues_found": 0,
                "total_issues_fixed": 0,
                "status": "completed"
            }
        }
        
        # 1단계: 고아 메타데이터 검색 및 정리
        try:
            orphaned_metadata_count = await file_service.cleanup_orphaned_metadata()
            results["steps"].append({
                "step": "orphaned_metadata_cleanup",
                "name": "고아 메타데이터 정리",
                "status": "completed",
                "issues_found": orphaned_metadata_count,
                "issues_fixed": orphaned_metadata_count,
                "message": f"{orphaned_metadata_count}개의 고아 메타데이터를 정리했습니다."
            })
            results["summary"]["total_issues_found"] += orphaned_metadata_count
            results["summary"]["total_issues_fixed"] += orphaned_metadata_count
        except Exception as e:
            results["steps"].append({
                "step": "orphaned_metadata_cleanup",
                "name": "고아 메타데이터 정리",
                "status": "failed",
                "error": str(e),
                "message": f"고아 메타데이터 정리 중 오류: {str(e)}"
            })
        
        # 2단계: 고아 벡터 검색
        try:
            orphaned_vectors_info = await vector_service.find_orphaned_vectors()
            orphaned_vectors_count = orphaned_vectors_info.get('orphaned_count', 0)
            results["steps"].append({
                "step": "orphaned_vectors_detection",
                "name": "고아 벡터 검색",
                "status": "completed",
                "issues_found": orphaned_vectors_count,
                "message": f"{orphaned_vectors_count}개의 고아 벡터를 발견했습니다."
            })
            results["summary"]["total_issues_found"] += orphaned_vectors_count
        except Exception as e:
            results["steps"].append({
                "step": "orphaned_vectors_detection",
                "name": "고아 벡터 검색",
                "status": "failed",
                "error": str(e),
                "message": f"고아 벡터 검색 중 오류: {str(e)}"
            })
        
        # 3단계: 고아 벡터 정리
        try:
            cleanup_result = await vector_service.cleanup_orphaned_vectors()
            cleaned_count = cleanup_result.get('cleaned_count', 0)
            results["steps"].append({
                "step": "orphaned_vectors_cleanup",
                "name": "고아 벡터 정리",
                "status": "completed",
                "issues_fixed": cleaned_count,
                "message": f"{cleaned_count}개의 고아 벡터를 정리했습니다."
            })
            results["summary"]["total_issues_fixed"] += cleaned_count
        except Exception as e:
            results["steps"].append({
                "step": "orphaned_vectors_cleanup",
                "name": "고아 벡터 정리",
                "status": "failed",
                "error": str(e),
                "message": f"고아 벡터 정리 중 오류: {str(e)}"
            })
        
        # 4단계: 벡터화 상태 동기화
        try:
            sync_results = await file_service.sync_vectorization_status()
            status_corrected = sync_results.get('status_corrected', 0)
            results["steps"].append({
                "step": "vectorization_status_sync",
                "name": "벡터화 상태 동기화",
                "status": "completed",
                "issues_fixed": status_corrected,
                "message": f"{status_corrected}개 파일의 벡터화 상태를 동기화했습니다."
            })
            results["summary"]["total_issues_fixed"] += status_corrected
        except Exception as e:
            results["steps"].append({
                "step": "vectorization_status_sync",
                "name": "벡터화 상태 동기화",
                "status": "failed",
                "error": str(e),
                "message": f"벡터화 상태 동기화 중 오류: {str(e)}"
            })
        
        # 5단계: ChromaDB 상태 확인
        try:
            chromadb_status = vector_service.get_chromadb_status()
            results["steps"].append({
                "step": "chromadb_status_check",
                "name": "ChromaDB 상태 확인",
                "status": "completed",
                "chromadb_status": chromadb_status,
                "message": f"ChromaDB 상태: {chromadb_status.get('status', 'unknown')}"
            })
        except Exception as e:
            results["steps"].append({
                "step": "chromadb_status_check",
                "name": "ChromaDB 상태 확인",
                "status": "failed",
                "error": str(e),
                "message": f"ChromaDB 상태 확인 중 오류: {str(e)}"
            })
        
        # 최종 요약 메시지 생성
        if results["summary"]["total_issues_found"] == 0:
            results["summary"]["message"] = "모든 진단이 완료되었습니다. 문제가 발견되지 않았습니다."
        else:
            results["summary"]["message"] = f"진단 및 정상화가 완료되었습니다. 총 {results['summary']['total_issues_found']}개 문제 중 {results['summary']['total_issues_fixed']}개를 해결했습니다."
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"진단 및 정상화 중 오류가 발생했습니다: {str(e)}")




@router.get("/chromadb/status/")
async def get_chromadb_status():
    """ChromaDB 상태 조회 (안전한 버전)"""
    try:
        # VectorService를 지연 로딩으로 가져오기
        file_service = get_file_service_instance()
        
        # VectorService 초기화를 시도하지만 오류 시 안전하게 처리
        try:
            vector_service = file_service.vector_service
            if not vector_service:
                return {
                    "chromadb_available": False,
                    "client_initialized": False,
                    "collection_initialized": False,
                    "collection_count": 0,
                    "error": "VectorService를 초기화할 수 없습니다."
                }
            
            status = vector_service.get_chromadb_status()
            return status
        except Exception as ve:
            # VectorService 오류는 안전하게 처리
            error_msg = str(ve)
            return {
                "chromadb_available": False,
                "client_initialized": False,
                "collection_initialized": False,
                "collection_count": 0,
                "error": error_msg,
                "requires_migration": "no such column" in error_msg.lower(),
                "error_type": "chromadb_schema_error" if "no such column" in error_msg.lower() else "initialization_error"
            }
            
    except Exception as e:
        return {
            "chromadb_available": False,
            "client_initialized": False,
            "collection_initialized": False,
            "collection_count": 0,
            "error": str(e),
            "error_type": "api_error"
        }

@router.post("/chromadb/migrate")
async def migrate_chromadb():
    """ChromaDB를 새로운 설정으로 마이그레이션"""
    try:
        # VectorService를 지연 로딩으로 가져오기
        file_service = get_file_service_instance()
        vector_service = file_service.vector_service
        if not vector_service:
            raise HTTPException(status_code=500, detail="벡터 서비스를 초기화할 수 없습니다.")
        
        success = await vector_service.migrate_from_deprecated_config()
        
        if success:
            return {
                "message": "ChromaDB 마이그레이션이 성공적으로 완료되었습니다.",
                "status": vector_service.get_chromadb_status()
            }
        else:
            return {
                "message": "ChromaDB 마이그레이션에 실패했지만 JSON fallback으로 작동합니다.",
                "status": vector_service.get_chromadb_status()
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chromadb/reset")
async def reset_chromadb():
    """ChromaDB 데이터베이스를 완전히 리셋 (스키마 오류 해결용)"""
    try:
        # VectorService를 안전하게 가져오기
        file_service = get_file_service_instance()
        
        # 현재 상태 확인 (오류가 있어도 계속 진행)
        current_status = None
        reset_needed = False
        
        try:
            vector_service = file_service.vector_service
            if vector_service:
                current_status = vector_service.get_chromadb_status()
                reset_needed = (current_status.get("requires_migration") or 
                               current_status.get("error") or
                               current_status.get("status") == "schema_error")
            else:
                reset_needed = True
                current_status = {"error": "VectorService 초기화 실패"}
        except Exception as status_error:
            print(f"상태 조회 실패, 강제 리셋 진행: {str(status_error)}")
            reset_needed = True
            current_status = {"error": str(status_error)}
        
        if reset_needed:
            print("ChromaDB 리셋 실행 중...")
            try:
                # 직접 VectorService 인스턴스를 생성하여 리셋
                from ..services.vector_service import VectorService
                vector_service = VectorService()
                vector_service.reset_chromadb()
                
                # 리셋 후 새로운 상태 확인
                try:
                    new_status = vector_service.get_chromadb_status()
                except Exception as new_status_error:
                    new_status = {"error": f"리셋 후 상태 조회 실패: {str(new_status_error)}"}
                
                return {
                    "message": "ChromaDB 데이터베이스 리셋이 완료되었습니다. 기존 벡터 데이터는 백업되었습니다.",
                    "old_status": current_status,
                    "new_status": new_status,
                    "reset_performed": True
                }
                
            except Exception as reset_error:
                return {
                    "message": f"ChromaDB 리셋 중 오류가 발생했습니다: {str(reset_error)}",
                    "old_status": current_status,
                    "reset_performed": False,
                    "error": str(reset_error)
                }
        else:
            return {
                "message": "ChromaDB가 정상 상태입니다. 리셋이 필요하지 않습니다.",
                "status": current_status,
                "reset_performed": False
            }
            
    except Exception as e:
        return {
            "message": f"ChromaDB 리셋 요청 처리 중 오류: {str(e)}",
            "reset_performed": False,
            "error": str(e)
        } 



@router.get("/chromadb/status/")
async def get_chromadb_status():
    """출력하지 않고 ChromaDB 상태만 확인합니다."""
    try:
        file_service = get_file_service_instance()
        vector_service = file_service.vector_service
        
        if not vector_service:
            return {
                "status": "error",
                "message": "벡터 서비스를 초기화할 수 없습니다.",
                "chromadb_available": False
            }
        
        # ChromaDB 상태 확인
        from ..services.vector_service import VectorService
        
        status = {
            "chromadb_available": False,
            "client_initialized": bool(VectorService._client),
            "collection_initialized": bool(VectorService._collection),
            "error_message": None
        }
        
        try:
            # 새 구조에 맞게 클라이언트 확인
            vector_service._ensure_client()
            
            # 초기화 후 상태 업데이트
            status["client_initialized"] = bool(VectorService._client)
            status["collection_initialized"] = bool(VectorService._collection)
            
            if VectorService._client and VectorService._collection:
                # 간단한 테스트 수행
                try:
                    collections = VectorService._client.list_collections()
                    status["chromadb_available"] = True
                    status["collections_count"] = len(collections)
                except Exception as test_e:
                    status["error_message"] = f"컬렉션 접근 실패: {str(test_e)}"
            else:
                status["error_message"] = "ChromaDB 초기화 실패"
                
        except Exception as init_e:
            status["error_message"] = f"초기화 오류: {str(init_e)}"
        
        # 전체 상태 결정
        if status["chromadb_available"]:
            status["status"] = "healthy"
            status["message"] = "ChromaDB가 정상적으로 작동 중입니다."
        elif status["error_message"]:
            status["status"] = "error"
            status["message"] = f"ChromaDB 또는 컬렉션에 문제가 있습니다: {status['error_message']}"
        else:
            status["status"] = "warning"
            status["message"] = "ChromaDB가 초기화되지 않았습니다."
        
        return status
        
    except Exception as e:
        print(f"ChromaDB 상태 확인 오류: {str(e)}")
        return {
            "status": "error",
            "message": f"ChromaDB 상태 확인 중 오류가 발생했습니다: {str(e)}",
            "chromadb_available": False,
            "error_message": str(e)
        }

@router.post("/chromadb/initialize")
async def initialize_chromadb():
    """ChromaDB를 수동으로 초기화합니다."""
    try:
        file_service = get_file_service_instance()
        vector_service = file_service.vector_service
        
        if not vector_service:
            return {
                "success": False,
                "error": "VectorService를 초기화할 수 없습니다.",
                "message": "VectorService 인스턴스 생성에 실패했습니다."
            }
        
        # ChromaDB 수동 초기화 시도
        result = vector_service.initialize_chromadb_manually()
        
        if result["success"]:
            # 초기화 후 상태 확인
            status = vector_service.get_chromadb_status()
            result["status"] = status
            
        return result
        
    except Exception as e:
        error_msg = str(e)
        print(f"ChromaDB 초기화 API 오류: {error_msg}")
        return {
            "success": False,
            "error": error_msg,
            "message": f"초기화 중 API 오류가 발생했습니다: {error_msg}"
        } 