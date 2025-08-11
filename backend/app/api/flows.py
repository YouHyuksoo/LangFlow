from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from ..models.schemas import FlowRequest, FlowResponse
from ..services.flow_service import FlowService
from typing import List, Dict, Any
import os
import tempfile

router = APIRouter(prefix="/flows", tags=["flows"])

# 서비스 인스턴스 생성 - 지연 로딩으로 변경
# flow_service = FlowService()

def get_flow_service_instance():
    """FlowService 인스턴스를 지연 로딩으로 가져옵니다."""
    from ..services.flow_service import FlowService
    return FlowService()

@router.post("/load", response_model=FlowResponse)
async def load_flow(request: FlowRequest):
    """Langflow JSON Flow 로드"""
    try:
        # Flow JSON 유효성 검증
        is_valid = await get_flow_service_instance().validate_flow_json(request.flow_json)
        if not is_valid:
            raise HTTPException(status_code=400, detail="유효하지 않은 Flow JSON입니다.")
        
        response = await get_flow_service_instance().load_flow(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/import", response_model=FlowResponse)
async def import_flow(file: UploadFile = File(...)):
    """Flow 파일 가져오기"""
    try:
        # 파일 확장자 검증
        if not file.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="JSON 파일만 업로드 가능합니다.")
        
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Flow 가져오기
            response = await get_flow_service_instance().import_flow_from_file(temp_file_path)
            return response
        finally:
            # 임시 파일 삭제
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[FlowResponse])
async def list_flows():
    """로드된 Flow 목록 조회"""
    try:
        flows = await get_flow_service_instance().list_flows()
        return flows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{flow_id}")
async def get_flow(flow_id: str):
    """특정 Flow 정보 조회"""
    try:
        flow_info = await get_flow_service_instance().get_flow(flow_id)
        if not flow_info:
            raise HTTPException(status_code=404, detail="Flow를 찾을 수 없습니다.")
        return flow_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{flow_id}/execute")
async def execute_flow(flow_id: str, input_data: Dict[str, Any]):
    """Flow 실행"""
    try:
        result = await get_flow_service_instance().execute_flow(flow_id, input_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{flow_id}")
async def update_flow(flow_id: str, flow_json: Dict[str, Any]):
    """Flow 업데이트"""
    try:
        # Flow JSON 유효성 검증
        is_valid = await get_flow_service_instance().validate_flow_json(flow_json)
        if not is_valid:
            raise HTTPException(status_code=400, detail="유효하지 않은 Flow JSON입니다.")
        
        success = await get_flow_service_instance().update_flow(flow_id, flow_json)
        if not success:
            raise HTTPException(status_code=404, detail="Flow를 찾을 수 없습니다.")
        
        return {"message": "Flow가 성공적으로 업데이트되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{flow_id}")
async def delete_flow(flow_id: str):
    """Flow 삭제"""
    try:
        success = await get_flow_service_instance().delete_flow(flow_id)
        if not success:
            raise HTTPException(status_code=404, detail="Flow를 찾을 수 없습니다.")
        
        return {"message": "Flow가 성공적으로 삭제되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{flow_id}/nodes")
async def get_flow_nodes(flow_id: str):
    """Flow 노드 정보 조회"""
    try:
        flow_info = await get_flow_service_instance().get_flow(flow_id)
        if not flow_info:
            raise HTTPException(status_code=404, detail="Flow를 찾을 수 없습니다.")
        
        nodes = await get_flow_service_instance().parse_flow_nodes(flow_info["json"])
        return {"nodes": nodes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{flow_id}/export")
async def export_flow(flow_id: str):
    """Flow 내보내기"""
    try:
        flow_info = await get_flow_service_instance().get_flow(flow_id)
        if not flow_info:
            raise HTTPException(status_code=404, detail="Flow를 찾을 수 없습니다.")
        
        # Flow JSON 반환
        return {
            "flow_id": flow_id,
            "name": flow_info["name"],
            "json": flow_info["json"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/statistics/")
async def get_flow_statistics():
    """Flow 통계 정보"""
    try:
        stats = await get_flow_service_instance().get_flow_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 