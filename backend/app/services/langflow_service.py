import os
import json
import time
from typing import Dict, Any, List, Optional
from ..core.config import settings
from datetime import datetime

class LangflowService:
    """Langflow와의 연동을 담당하는 서비스"""
    
    def __init__(self):
        # Flow 서비스는 지연 로딩으로 처리 (순환 import 방지)
        self._flow_service = None
        # 파일 서비스 초기화 (순환 import 방지를 위해 지연 로딩)
        self._file_service = None
        # 예시 Flow 데이터 (실제로는 LangFlow API에서 가져와야 함)
        self.example_flows = [
            {
                "flow_id": "example-rag-flow",
                "name": "RAG 검색 Flow",
                "description": "문서 검색 및 질의응답을 위한 RAG Flow",
                "created_at": "2024-01-15T10:00:00Z",
                "updated_at": "2024-01-20T14:30:00Z",
                "is_active": True,
                "components": [
                    {
                        "id": "input-node",
                        "type": "node",
                        "name": "사용자 입력",
                        "position": {"x": 100, "y": 100},
                        "data": {"input_type": "text"}
                    },
                    {
                        "id": "vector-store",
                        "type": "node", 
                        "name": "벡터 저장소",
                        "position": {"x": 300, "y": 100},
                        "data": {"store_type": "chroma"}
                    },
                    {
                        "id": "llm-node",
                        "type": "node",
                        "name": "LLM 처리",
                        "position": {"x": 500, "y": 100},
                        "data": {"model": "gpt-3.5-turbo"}
                    },
                    {
                        "id": "edge-1",
                        "type": "edge",
                        "source": "input-node",
                        "target": "vector-store"
                    },
                    {
                        "id": "edge-2", 
                        "type": "edge",
                        "source": "vector-store",
                        "target": "llm-node"
                    }
                ],
                "execution_stats": {
                    "total_executions": 150,
                    "last_execution": "2024-01-20T14:25:00Z",
                    "success_rate": 95.5
                },
                "flow_data": {
                    "nodes": [
                        {"id": "input-node", "type": "input", "data": {"input_type": "text"}},
                        {"id": "vector-store", "type": "vectorstore", "data": {"store_type": "chroma"}},
                        {"id": "llm-node", "type": "llm", "data": {"model": "gpt-3.5-turbo"}}
                    ],
                    "edges": [
                        {"source": "input-node", "target": "vector-store"},
                        {"source": "vector-store", "target": "llm-node"}
                    ]
                }
            },
            {
                "flow_id": "example-vectorization-flow",
                "name": "문서 벡터화 Flow",
                "description": "PDF 문서를 벡터로 변환하는 Flow",
                "created_at": "2024-01-10T09:00:00Z",
                "updated_at": "2024-01-18T16:45:00Z",
                "is_active": True,
                "components": [
                    {
                        "id": "file-input",
                        "type": "node",
                        "name": "파일 입력",
                        "position": {"x": 100, "y": 150},
                        "data": {"file_type": "pdf"}
                    },
                    {
                        "id": "text-splitter",
                        "type": "node",
                        "name": "텍스트 분할",
                        "position": {"x": 300, "y": 150},
                        "data": {"chunk_size": 1000}
                    },
                    {
                        "id": "embedding",
                        "type": "node",
                        "name": "임베딩 생성",
                        "position": {"x": 500, "y": 150},
                        "data": {"model": "text-embedding-ada-002"}
                    },
                    {
                        "id": "edge-3",
                        "type": "edge",
                        "source": "file-input",
                        "target": "text-splitter"
                    },
                    {
                        "id": "edge-4", 
                        "type": "edge",
                        "source": "text-splitter",
                        "target": "embedding"
                    }
                ],
                "execution_stats": {
                    "total_executions": 75,
                    "last_execution": "2024-01-19T11:20:00Z",
                    "success_rate": 88.0
                },
                "flow_data": {
                    "nodes": [
                        {"id": "file-input", "type": "fileinput", "data": {"file_type": "pdf"}},
                        {"id": "text-splitter", "type": "textsplitter", "data": {"chunk_size": 1000}},
                        {"id": "embedding", "type": "embedding", "data": {"model": "text-embedding-ada-002"}}
                    ],
                    "edges": [
                        {"source": "file-input", "target": "text-splitter"},
                        {"source": "text-splitter", "target": "embedding"}
                    ]
                }
            }
        ]
    
    @property
    def flow_service(self):
        """Flow 서비스의 지연 로딩 프로퍼티"""
        if self._flow_service is None:
            from .flow_service import FlowService
            self._flow_service = FlowService()
        return self._flow_service
    
    @property
    def file_service(self):
        """파일 서비스의 지연 로딩 프로퍼티"""
        if self._file_service is None:
            from .file_service import FileService
            self._file_service = FileService()
        return self._file_service
    
    async def process_file_with_flow(self, file_id: str, flow_id: str, file_info: Any = None) -> Dict[str, Any]:
        """특정 파일을 Langflow로 처리합니다."""
        try:
            # "files"는 잘못된 Flow ID이므로 즉시 에러 반환
            if flow_id == "files":
                print(f"잘못된 Flow ID 요청: {flow_id} - 무시됨")
                return {
                    "file_id": file_id,
                    "status": "error",
                    "error": f"잘못된 Flow ID: {flow_id}"
                }
                
            # 파일 정보가 전달되지 않은 경우 None 처리
            if not file_info:
                return {
                    "file_id": file_id,
                    "status": "error",
                    "error": "파일 정보가 제공되지 않았습니다."
                }
            
            # Flow 실행을 위한 입력 데이터 준비 (실제 업로드된 파일 정보 사용)
            flow_input = {
                "file_id": file_id,
                "filename": file_info.filename,
                "category_id": file_info.category_id,
                "category_name": file_info.category_name
            }
            
            # 실제 파일 경로 설정 - 반드시 필요
            if hasattr(file_info, 'file_path') and file_info.file_path:
                flow_input["file_path"] = file_info.file_path
                print(f"실제 업로드 파일 경로 전달: {file_info.file_path}")
                
                # 파일 존재 확인
                if os.path.exists(file_info.file_path):
                    file_size = os.path.getsize(file_info.file_path)
                    print(f"파일 확인됨 - 크기: {file_size} bytes")
                else:
                    print(f"경고: 파일이 존재하지 않습니다: {file_info.file_path}")
            else:
                print(f"오류: 파일 경로 정보가 없습니다 - file_info: {file_info}")
                # 파일 서비스를 통해 파일 경로 다시 조회
                actual_file_path = await self.file_service.get_file_path(file_id)
                if actual_file_path:
                    flow_input["file_path"] = actual_file_path
                    print(f"파일 서비스에서 경로 조회 성공: {actual_file_path}")
                else:
                    print(f"오류: 파일 경로를 찾을 수 없습니다: {file_id}")
            
            # Flow 실행
            result = await self.flow_service.execute_flow(flow_id, flow_input)
            
            # Flow 실행이 성공한 경우 벡터 데이터 저장 및 파일 상태 업데이트
            if result.get("status") == "completed":
                try:
                    # 파일에서 텍스트 추출
                    file_path = await self.file_service.get_file_path(file_id)
                    if file_path and os.path.exists(file_path):
                        # PDF 파일인 경우 텍스트 추출
                        if file_path.lower().endswith('.pdf'):
                            text = await self.file_service.extract_text_from_pdf(file_path)
                        else:
                            # 다른 파일 형식은 간단히 읽기
                            with open(file_path, 'r', encoding='utf-8') as f:
                                text = f.read()
                        
                        # 텍스트를 청크로 분할
                        chunks = await self.file_service.chunk_text(text)
                        
                        # 벡터 데이터 저장을 위한 메타데이터 준비
                        metadata = {
                            "file_id": file_id,
                            "filename": file_info.filename,
                            "category_id": file_info.category_id,
                            "category_name": file_info.category_name,
                            "flow_id": flow_id,
                            "vectorization_method": "langflow",
                            "chunk_count": len(chunks),
                            "file_size": os.path.getsize(file_path) if os.path.exists(file_path) else 0
                        }
                        
                        # VectorService를 통해 벡터 데이터 저장
                        from .vector_service import VectorService
                        vector_service = VectorService()
                        save_success = await vector_service.add_document_chunks(file_id, chunks, metadata)
                        
                        if save_success:
                            print(f"벡터 데이터 저장 완료: {file_id}, 청크 수: {len(chunks)}")
                            result["vectorized_chunks"] = len(chunks)
                            
                            # 파일 벡터화 상태 업데이트 - 성공
                            await self.file_service.update_file_vectorization_status(
                                file_id=file_id,
                                vectorized=True,
                                error_message=None
                            )
                            print(f"파일 메타데이터 업데이트 완료: {file_id} -> vectorized=True")
                        else:
                            print(f"벡터 데이터 저장 실패: {file_id}")
                            result["status"] = "error"
                            result["error"] = "벡터 데이터 저장에 실패했습니다."
                            
                            # 파일 벡터화 상태 업데이트 - 실패
                            await self.file_service.update_file_vectorization_status(
                                file_id=file_id,
                                vectorized=False,
                                error_message="벡터 데이터 저장에 실패했습니다."
                            )
                    
                except Exception as e:
                    print(f"벡터 데이터 저장 중 오류: {str(e)}")
                    result["status"] = "error"
                    result["error"] = f"벡터 데이터 저장 중 오류: {str(e)}"
                    
                    # 파일 벡터화 상태 업데이트 - 오류
                    await self.file_service.update_file_vectorization_status(
                        file_id=file_id,
                        vectorized=False,
                        error_message=f"벡터 데이터 저장 중 오류: {str(e)}"
                    )
            else:
                # Flow 실행이 실패한 경우에도 파일 상태 업데이트
                error_msg = result.get("error", "Flow 실행 실패")
                await self.file_service.update_file_vectorization_status(
                    file_id=file_id,
                    vectorized=False,
                    error_message=error_msg
                )
            
            # 결과에 파일 정보 추가
            result["file_id"] = file_id
            result["filename"] = file_info.filename
            
            return result
            
        except Exception as e:
            print(f"Langflow 파일 처리 중 오류: {str(e)}")
            return {
                "file_id": file_id,
                "status": "error",
                "error": str(e)
            }
    
    async def get_flows(self) -> List[Dict[str, Any]]:
        """등록된 모든 LangFlow Flow 목록을 조회합니다."""
        try:
            flows = []
            flows_dir = os.path.join(settings.BASE_DIR, "langflow", "flows")
            
            # flows 디렉토리가 존재하는지 확인
            if not os.path.exists(flows_dir):
                print(f"Flows 디렉토리가 존재하지 않습니다: {flows_dir}")
                # 상대 경로로도 시도
                flows_dir = "langflow/flows"
                if not os.path.exists(flows_dir):
                    print(f"상대 경로도 존재하지 않습니다: {flows_dir}")
                    return []
            
            # JSON 파일들을 찾아서 Flow 정보 생성
            for filename in os.listdir(flows_dir):
                if filename.endswith('.json') and not filename.startswith('.'):
                    file_path = os.path.join(flows_dir, filename)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            flow_data = json.load(f)
                        
                        # Flow ID는 파일명에서 확장자를 제거하고 공백을 언더스코어로 변경
                        flow_id = filename.replace('.json', '').replace(' ', '_').lower()
                        
                        # Flow 정보 구성
                        flow_info = {
                            "flow_id": flow_id,
                            "name": flow_data.get("name", flow_id),
                            "description": flow_data.get("description", f"{flow_id} Flow"),
                            "created_at": flow_data.get("created_at", "2024-01-01T00:00:00Z"),
                            "updated_at": flow_data.get("updated_at", "2024-01-01T00:00:00Z"),
                            "is_active": flow_data.get("is_active", True),
                            "components": flow_data.get("components", []),
                            "flow_data": flow_data,
                            "original_filename": filename  # 원본 파일명 저장
                        }
                        
                        flows.append(flow_info)
                        print(f"Flow 로드됨: {flow_id} (파일: {filename})")
                        
                    except Exception as e:
                        print(f"Flow 파일 읽기 오류 ({filename}): {str(e)}")
                        continue
            
            # 생성 시간 순으로 정렬
            flows.sort(key=lambda x: x["created_at"], reverse=True)
            
            print(f"총 {len(flows)}개의 Flow를 로드했습니다.")
            return flows
            
        except Exception as e:
            print(f"Flow 목록 조회 중 오류: {str(e)}")
            return []
    
    async def get_flow_details(self, flow_id: str) -> Dict[str, Any]:
        """특정 Flow의 상세 정보를 조회합니다."""
        try:
            # "files"는 잘못된 Flow ID이므로 즉시 None 반환
            if flow_id == "files":
                print(f"🚨 잘못된 Flow ID 요청: {flow_id}")
                import traceback
                print("=== 호출 스택 추적 ===")
                traceback.print_stack()
                print("======================")
                return None
                
            # 실제 Flow 목록에서 해당 Flow 찾기
            flows = await self.get_flows()
            target_flow = None
            
            for flow in flows:
                if flow["flow_id"] == flow_id:
                    target_flow = flow
                    break
            
            if not target_flow:
                print(f"Flow를 찾을 수 없습니다: {flow_id}")
                return None
            
            # Flow 파일 경로 (원본 파일명 사용)
            flows_dir = os.path.join(settings.BASE_DIR, "langflow", "flows")
            if not os.path.exists(flows_dir):
                flows_dir = "langflow/flows"
            
            flow_file = os.path.join(flows_dir, target_flow["original_filename"])
            
            if not os.path.exists(flow_file):
                print(f"Flow 파일을 찾을 수 없습니다: {flow_file}")
                return None
            
            # Flow 파일 읽기
            with open(flow_file, 'r', encoding='utf-8') as f:
                flow_data = json.load(f)
            
            # Flow 상세 정보 구성
            flow_details = {
                "flow_id": flow_id,
                "name": flow_data.get("name", flow_id),
                "description": flow_data.get("description", f"{flow_id} Flow"),
                "created_at": flow_data.get("created_at", "2024-01-01T00:00:00Z"),
                "updated_at": flow_data.get("updated_at", "2024-01-01T00:00:00Z"),
                "is_active": flow_data.get("is_active", True),
                "components": flow_data.get("components", []),
                "execution_stats": flow_data.get("execution_stats", {
                    "total_executions": 0,
                    "last_execution": None,
                    "success_rate": 0.0
                }),
                "flow_data": flow_data
            }
            
            return flow_details
            
        except Exception as e:
            print(f"Flow 상세 정보 조회 중 오류: {str(e)}")
            return None
    
    async def test_flow(self, flow_id: str, test_data: Dict[str, Any]) -> Dict[str, Any]:
        """Flow를 테스트 실행합니다."""
        try:
            # Flow 실행
            result = await self.flow_service.execute_flow(flow_id, test_data)
            
            # 테스트 결과에 추가 정보 포함
            result["flow_id"] = flow_id
            result["test_data"] = test_data
            
            return result
            
        except Exception as e:
            print(f"Flow 테스트 중 오류: {str(e)}")
            return {
                "flow_id": flow_id,
                "status": "error",
                "error": str(e),
                "test_data": test_data
            }
    
    async def toggle_flow_status(self, flow_id: str) -> bool:
        """Flow의 활성/비활성 상태를 토글합니다."""
        try:
            # "files"는 잘못된 Flow ID이므로 즉시 False 반환
            if flow_id == "files":
                print(f"잘못된 Flow ID 요청: {flow_id} - 무시됨")
                return False
                
            # 실제 Flow 목록에서 해당 Flow 찾기
            flows = await self.get_flows()
            target_flow = None
            
            for flow in flows:
                if flow["flow_id"] == flow_id:
                    target_flow = flow
                    break
            
            if not target_flow:
                print(f"Flow를 찾을 수 없습니다: {flow_id}")
                return False
            
            # Flow 파일 경로 (원본 파일명 사용)
            flows_dir = os.path.join(settings.BASE_DIR, "langflow", "flows")
            if not os.path.exists(flows_dir):
                flows_dir = "langflow/flows"
            
            flow_file = os.path.join(flows_dir, target_flow["original_filename"])
            
            if not os.path.exists(flow_file):
                print(f"Flow 파일을 찾을 수 없습니다: {flow_file}")
                return False
            
            # Flow 파일 읽기
            with open(flow_file, 'r', encoding='utf-8') as f:
                flow_data = json.load(f)
            
            # 상태 토글
            current_status = flow_data.get("is_active", True)
            flow_data["is_active"] = not current_status
            
            # 파일에 다시 저장
            with open(flow_file, 'w', encoding='utf-8') as f:
                json.dump(flow_data, f, indent=2, ensure_ascii=False)
            
            print(f"Flow 상태 변경: {flow_id} -> {'활성' if flow_data['is_active'] else '비활성'}")
            return True
            
        except Exception as e:
            print(f"Flow 상태 토글 중 오류: {str(e)}")
            return False
    
    async def set_default_vectorization_flow(self, flow_id: str) -> bool:
        """Flow를 기본 벡터화 Flow로 설정합니다."""
        try:
            # "files"는 잘못된 Flow ID이므로 즉시 False 반환
            if flow_id == "files":
                print(f"잘못된 Flow ID 요청: {flow_id} - 무시됨")
                return False
                
            # 실제 Flow 목록에서 해당 Flow 찾기
            flows = await self.get_flows()
            target_flow = None
            
            for flow in flows:
                if flow["flow_id"] == flow_id:
                    target_flow = flow
                    break
            
            if not target_flow:
                print(f"Flow를 찾을 수 없습니다: {flow_id}")
                return False
            
            # 모든 Flow 파일에서 기본 벡터화 설정을 해제
            flows_dir = os.path.join(settings.BASE_DIR, "langflow", "flows")
            if not os.path.exists(flows_dir):
                flows_dir = "langflow/flows"
            
            for flow in flows:
                flow_file = os.path.join(flows_dir, flow["original_filename"])
                if os.path.exists(flow_file):
                    try:
                        with open(flow_file, 'r', encoding='utf-8') as f:
                            flow_data = json.load(f)
                        
                        # 기본 벡터화 설정 해제
                        if "is_default_vectorization" in flow_data:
                            flow_data["is_default_vectorization"] = False
                            
                        with open(flow_file, 'w', encoding='utf-8') as f:
                            json.dump(flow_data, f, indent=2, ensure_ascii=False)
                    except Exception as e:
                        print(f"Flow 파일 업데이트 오류 ({flow['flow_id']}): {str(e)}")
            
            # 대상 Flow를 기본 벡터화 Flow로 설정
            target_flow_file = os.path.join(flows_dir, target_flow["original_filename"])
            if os.path.exists(target_flow_file):
                with open(target_flow_file, 'r', encoding='utf-8') as f:
                    flow_data = json.load(f)
                
                flow_data["is_default_vectorization"] = True
                
                with open(target_flow_file, 'w', encoding='utf-8') as f:
                    json.dump(flow_data, f, indent=2, ensure_ascii=False)
            
            # 설정 파일에 기본 Flow ID 저장 (임시로 파일에 저장)
            config_file = os.path.join(settings.BASE_DIR, "langflow", "config.json")
            config_dir = os.path.dirname(config_file)
            os.makedirs(config_dir, exist_ok=True)
            
            config_data = {
                "default_vectorization_flow_id": flow_id,
                "updated_at": datetime.now().isoformat()
            }
            
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, indent=2, ensure_ascii=False)
            
            print(f"기본 벡터화 Flow 설정: {flow_id} ({target_flow['name']})")
            return True
            
        except Exception as e:
            print(f"기본 벡터화 Flow 설정 중 오류: {str(e)}")
            return False
    
    async def set_search_flow(self, flow_id: str) -> bool:
        """검색 Flow 설정"""
        try:
            # Flow 존재 여부 확인
            flows = await self.get_flows()
            flow_exists = any(flow["flow_id"] == flow_id for flow in flows)
            
            if not flow_exists:
                print(f"Flow를 찾을 수 없습니다: {flow_id}")
                return False
            
            # 설정 파일에 검색 Flow ID 저장
            config_file = os.path.join(settings.DATA_DIR, "langflow_config.json")
            config = {}
            
            if os.path.exists(config_file):
                try:
                    with open(config_file, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                except Exception as e:
                    print(f"설정 파일 로드 실패: {str(e)}")
                    config = {}
            
            config["default_search_flow_id"] = flow_id
            
            try:
                with open(config_file, 'w', encoding='utf-8') as f:
                    json.dump(config, f, ensure_ascii=False, indent=2)
                print(f"검색 Flow가 설정되었습니다: {flow_id}")
                return True
            except Exception as e:
                print(f"설정 파일 저장 실패: {str(e)}")
                return False
                
        except Exception as e:
            print(f"검색 Flow 설정 실패: {str(e)}")
            return False

    async def delete_flow(self, flow_id: str) -> bool:
        """Flow 삭제"""
        try:
            flows = await self.get_flows() # Get all flows to find the original filename
            target_flow = next((flow for flow in flows if flow["flow_id"] == flow_id), None)

            if not target_flow:
                print(f"Flow를 찾을 수 없습니다: {flow_id}")
                return False

            flow_file_path = os.path.join(settings.BASE_DIR, "langflow", "flows", target_flow["original_filename"])
            
            # Flow 존재 여부 확인
            if not os.path.exists(flow_file_path):
                print(f"Flow 파일을 찾을 수 없습니다: {flow_file_path}")
                return False
            
            # Flow가 기본 벡터화 Flow인지 확인
            config_file = os.path.join(settings.DATA_DIR, "langflow_config.json")
            if os.path.exists(config_file):
                try:
                    with open(config_file, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                    
                    # 기본 벡터화 Flow인 경우 설정 제거
                    if config.get("default_vectorization_flow_id") == flow_id:
                        config["default_vectorization_flow_id"] = None
                        with open(config_file, 'w', encoding='utf-8') as f:
                            json.dump(config, f, ensure_ascii=False, indent=2)
                        print(f"기본 벡터화 Flow 설정이 제거되었습니다: {flow_id}")
                    
                    # 기본 검색 Flow인 경우 설정 제거
                    if config.get("default_search_flow_id") == flow_id:
                        config["default_search_flow_id"] = None
                        with open(config_file, 'w', encoding='utf-8') as f:
                            json.dump(config, f, ensure_ascii=False, indent=2)
                        print(f"기본 검색 Flow 설정이 제거되었습니다: {flow_id}")
                        
                except Exception as e:
                    print(f"설정 파일 처리 실패: {str(e)}")
            
            # Flow 파일 삭제
            try:
                os.remove(flow_file_path)
                print(f"Flow 파일이 삭제되었습니다: {flow_file_path}")
                return True
            except Exception as e:
                print(f"Flow 파일 삭제 실패: {str(e)}")
                return False
                
        except Exception as e:
            print(f"Flow 삭제 실패: {str(e)}")
            return False
    
    async def vectorize_files_by_category(self, category_id: str, vectorization_flow_id: str) -> List[Dict[str, Any]]:
        """특정 카테고리의 모든 파일을 벡터화합니다."""
        try:
            # 카테고리별 파일 목록 조회
            files = await self.file_service.list_files(category_id=category_id)
            
            results = []
            for file_info in files:
                if not file_info.vectorized:  # 아직 벡터화되지 않은 파일만
                    result = await self.process_file_with_flow(
                        file_info.file_id, 
                        vectorization_flow_id,
                        file_info
                    )
                    results.append(result)
            
            return results
            
        except Exception as e:
            print(f"카테고리별 벡터화 중 오류: {str(e)}")
            return []
    
    async def search_with_flow(self, query: str, search_flow_id: str, category_ids: List[str] = None, top_k: int = 10) -> Dict[str, Any]:
        """Langflow를 사용하여 RAG 검색을 수행합니다."""
        try:
            # LangFlow Flow 대신 직접 ChromaDB 검색 사용
            from .vector_service import VectorService
            
            print(f"직접 ChromaDB 검색 실행: {search_flow_id}")
            print(f"쿼리: {query}")
            print(f"카테고리: {category_ids}")
            print(f"검색 결과 수: {top_k}개")
            
            vector_service = VectorService()
            search_results = await vector_service.search_similar_chunks(
                query=query,
                top_k=top_k,
                category_ids=category_ids
            )
            
            print(f"검색 결과: {len(search_results)}개 발견")
            
            if search_results:
                return {
                    "status": "success",
                    "results": search_results,
                    "flow_id": search_flow_id,
                    "search_method": "direct_chromadb",
                    "query": query,
                    "category_ids": category_ids,
                    "top_k": top_k
                }
            else:
                return {
                    "status": "success",
                    "results": [],
                    "flow_id": search_flow_id,
                    "search_method": "direct_chromadb",
                    "query": query,
                    "category_ids": category_ids,
                    "top_k": top_k
                }
                
        except Exception as e:
            print(f"직접 ChromaDB 검색 중 오류: {str(e)}")
            return {
                "query": query,
                "status": "error",
                "error": str(e),
                "response": "검색 중 오류가 발생했습니다."
            }
    
    async def execute_flow_with_llm(self, flow_id: str, prompt: str, system_message: str = None) -> Dict[str, Any]:
        """LangFlow를 통해 LLM 모델을 실행합니다."""
        try:
            print(f"=== LangFlow LLM 실행 시작 ===")
            print(f"Flow ID: {flow_id}")
            print(f"프롬프트 길이: {len(prompt)} 글자")
            print(f"시스템 메시지: {system_message[:100] if system_message else 'None'}...")
            
            # Flow JSON 파일 로드
            flow_file_path = os.path.join(settings.BASE_DIR, "langflow", "flows", f"{flow_id.replace('_', ' ').title()}.json")
            
            # 파일명 변환 (예: vector_store_search -> Vector Store Search.json)
            if not os.path.exists(flow_file_path):
                flow_file_path = os.path.join(settings.BASE_DIR, "langflow", "flows", "Vector Store Search.json")
            
            if not os.path.exists(flow_file_path):
                print(f"Flow 파일을 찾을 수 없습니다: {flow_file_path}")
                return {
                    "status": "error",
                    "error": f"Flow 파일을 찾을 수 없습니다: {flow_id}",
                    "response": "Flow 설정 파일이 없습니다."
                }
            
            print(f"Flow 파일 로드: {flow_file_path}")
            print(f"파일 존재 여부: {os.path.exists(flow_file_path)}")
            print(f"파일 크기: {os.path.getsize(flow_file_path) if os.path.exists(flow_file_path) else 'N/A'} bytes")
            
            # Flow JSON에서 LLM 설정 추출
            with open(flow_file_path, 'r', encoding='utf-8') as f:
                flow_data = json.load(f)
            
            # LanguageModelComponent 노드 찾기
            llm_node = None
            nodes = flow_data.get("data", {}).get("nodes", [])
            
            for node in nodes:
                if "LanguageModelComponent" in node.get("id", ""):
                    llm_node = node
                    break
            
            if not llm_node:
                print("LanguageModelComponent 노드를 찾을 수 없습니다")
                return {
                    "status": "error", 
                    "error": "LanguageModelComponent 노드를 찾을 수 없습니다",
                    "response": "LLM 설정을 찾을 수 없습니다."
                }
            
            # LLM 설정 추출 - 올바른 경로 탐색
            llm_data = llm_node.get("data", {})
            print(f"=== LLM 노드 데이터 확인 ===")
            print(f"LLM 노드 ID: {llm_node.get('id')}")
            print(f"data 키들: {list(llm_data.keys())}")
            
            # node 키 안에 실제 설정들이 있는지 확인
            node_data = llm_data.get("node", {})
            print(f"node 키들: {list(node_data.keys())}")
            
            # template 또는 inputs에서 설정 찾기
            template_data = node_data.get("template", {})
            if template_data:
                print(f"template 키들: {list(template_data.keys())}")
                
                # Provider 추출
                provider_data = template_data.get("provider", {})
                print(f"Provider 데이터: {provider_data}")
                provider = provider_data.get("value", "OpenAI")
                
                # Model Name 추출  
                model_name_data = template_data.get("model_name", {})
                print(f"Model Name 데이터: {model_name_data}")
                model_name = model_name_data.get("value", "gpt-3.5-turbo")
                
                # Temperature 추출
                temperature_data = template_data.get("temperature", {})
                print(f"Temperature 데이터: {temperature_data}")
                temperature = temperature_data.get("value", 0.1)
            else:
                # 기본값 사용
                provider = "OpenAI"
                model_name = "gpt-3.5-turbo"
                temperature = 0.1
            
            print(f"=== LLM 설정 확인 ===")
            print(f"Provider: {provider}")
            print(f"Model: {model_name}")
            print(f"Temperature: {temperature}")
            
            # Provider별 LLM 실행
            if provider == "Google":
                response_text = await self._execute_google_llm(model_name, prompt, system_message, temperature)
            elif provider == "OpenAI":
                response_text = await self._execute_openai_llm(model_name, prompt, system_message, temperature)
            elif provider == "Anthropic":
                response_text = await self._execute_anthropic_llm(model_name, prompt, system_message, temperature)
            else:
                print(f"지원하지 않는 Provider: {provider}")
                return {
                    "status": "error",
                    "error": f"지원하지 않는 Provider: {provider}",
                    "response": f"{provider} Provider는 아직 지원하지 않습니다."
                }
            
            print(f"=== LLM 실행 완료 ===")
            print(f"응답 길이: {len(response_text)} 글자")
            
            return {
                "status": "success",
                "response": response_text,
                "provider": provider,
                "model": model_name,
                "flow_id": flow_id
            }
            
        except Exception as e:
            print(f"LangFlow LLM 실행 중 오류: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "status": "error",
                "error": str(e),
                "response": f"LLM 실행 중 오류가 발생했습니다: {str(e)}"
            }
    
    async def _execute_google_llm(self, model_name: str, prompt: str, system_message: str = None, temperature: float = 0.1) -> str:
        """Google Gemini 모델을 실행합니다."""
        try:
            print(f"=== Google Gemini 실행 ===")
            print(f"모델: {model_name}")
            
            # langchain_google_genai 사용
            from langchain_google_genai import ChatGoogleGenerativeAI
            from ..core.config import settings
            
            # Google API 키 확인
            api_key = settings.GOOGLE_API_KEY or settings.GEMINI_API_KEY
            if not api_key:
                raise ValueError("Google API 키가 설정되지 않았습니다. GOOGLE_API_KEY 또는 GEMINI_API_KEY를 설정해주세요.")
            
            print(f"Google API 키 확인됨: {api_key[:10]}...")
            
            # ChatGoogleGenerativeAI 인스턴스 생성 - 기본 설정 사용
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                temperature=temperature,
                google_api_key=api_key
            )
            
            # 메시지 구성 - Gemini의 경우 system 메시지를 다르게 처리
            if system_message:
                # system 메시지를 프롬프트에 직접 포함
                combined_prompt = f"다음은 시스템 지침입니다:\n{system_message}\n\n사용자 질문:\n{prompt}"
                messages = [("human", combined_prompt)]
            else:
                messages = [("human", prompt)]
            
            print(f"Gemini API 호출 시작...")
            print(f"프롬프트 길이: {len(messages[0][1])} 글자")
            start_time = time.time()
            
            # LLM 실행
            response = llm.invoke(messages)
            
            api_time = time.time() - start_time
            print(f"Gemini API 호출 완료: {api_time:.2f}초")
            
            # 응답 내용 디버깅
            print(f"=== Gemini 응답 디버깅 ===")
            print(f"응답 타입: {type(response)}")
            print(f"응답 content: '{response.content}'")
            print(f"응답 content 길이: {len(response.content) if hasattr(response, 'content') else 'N/A'}")
            
            # 메타데이터 확인
            if hasattr(response, 'response_metadata'):
                metadata = response.response_metadata
                print(f"finish_reason: {metadata.get('finish_reason')}")
                print(f"safety_ratings: {metadata.get('safety_ratings')}")
                print(f"prompt_feedback: {metadata.get('prompt_feedback')}")
            
            # 빈 응답 처리
            content = response.content if hasattr(response, 'content') else str(response)
            
            # 빈 응답인 경우 안전 필터 메시지 반환
            if not content or content.strip() == "":
                if hasattr(response, 'response_metadata'):
                    metadata = response.response_metadata
                    safety_ratings = metadata.get('safety_ratings', [])
                    prompt_feedback = metadata.get('prompt_feedback', {})
                    
                    # 안전 필터가 작동한 경우
                    if prompt_feedback.get('block_reason'):
                        return "죄송합니다. 안전 정책으로 인해 이 질문에 대한 응답을 제공할 수 없습니다. 다른 방식으로 질문해 주세요."
                    
                    # 기타 이유로 빈 응답인 경우
                    return "죄송합니다. Gemini에서 응답을 생성하지 못했습니다. 질문을 다시 시도해 주세요."
                else:
                    return "죄송합니다. Gemini에서 빈 응답을 받았습니다. 다시 시도해 주세요."
            
            print(f"최종 반환할 content: '{content[:100]}...' ({len(content)} 글자)")
            return content
            
        except Exception as e:
            print(f"Google Gemini 실행 중 오류: {str(e)}")
            import traceback
            traceback.print_exc()
            raise e
    
    async def _execute_openai_llm(self, model_name: str, prompt: str, system_message: str = None, temperature: float = 0.1) -> str:
        """OpenAI 모델을 실행합니다."""
        try:
            print(f"=== OpenAI 실행 ===")
            print(f"모델: {model_name}")
            
            from langchain_openai import ChatOpenAI
            from ..core.config import settings
            
            if not settings.OPENAI_API_KEY:
                raise ValueError("OpenAI API 키가 설정되지 않았습니다.")
            
            llm = ChatOpenAI(
                model=model_name,
                temperature=temperature,
                openai_api_key=settings.OPENAI_API_KEY
            )
            
            messages = []
            if system_message:
                messages.append(("system", system_message))
            messages.append(("human", prompt))
            
            print(f"OpenAI API 호출 시작...")
            start_time = time.time()
            
            response = llm.invoke(messages)
            
            api_time = time.time() - start_time
            print(f"OpenAI API 호출 완료: {api_time:.2f}초")
            
            return response.content
            
        except Exception as e:
            print(f"OpenAI 실행 중 오류: {str(e)}")
            raise e
    
    async def _execute_anthropic_llm(self, model_name: str, prompt: str, system_message: str = None, temperature: float = 0.1) -> str:
        """Anthropic Claude 모델을 실행합니다."""
        try:
            print(f"=== Anthropic Claude 실행 ===")
            print(f"모델: {model_name}")
            
            from langchain_anthropic import ChatAnthropic
            from ..core.config import settings
            
            if not settings.ANTHROPIC_API_KEY:
                raise ValueError("Anthropic API 키가 설정되지 않았습니다.")
            
            llm = ChatAnthropic(
                model=model_name,
                temperature=temperature,
                anthropic_api_key=settings.ANTHROPIC_API_KEY
            )
            
            messages = []
            if system_message:
                messages.append(("system", system_message))
            messages.append(("human", prompt))
            
            print(f"Anthropic API 호출 시작...")
            start_time = time.time()
            
            response = llm.invoke(messages)
            
            api_time = time.time() - start_time
            print(f"Anthropic API 호출 완료: {api_time:.2f}초")
            
            return response.content
            
        except Exception as e:
            print(f"Anthropic 실행 중 오류: {str(e)}")
            raise e
    
    async def get_available_flows_by_type(self, flow_type: str) -> List[Dict[str, Any]]:
        """타입별 사용 가능한 Flow 목록을 조회합니다."""
        try:
            all_flows = await self.get_flows()
            
            # Flow 이름이나 설명에서 타입 필터링 (간단한 구현)
            type_keywords = {
                "vectorization": ["벡터", "vector", "embed", "chunk"],
                "search": ["검색", "search", "rag", "retrieval"],
                "chat": ["채팅", "chat", "conversation"]
            }
            
            keywords = type_keywords.get(flow_type, [])
            filtered_flows = []
            
            for flow in all_flows:
                flow_dict = {
                    "flow_id": flow["flow_id"],
                    "name": flow["name"],
                    "created_at": flow["created_at"]
                }
                
                # 키워드 매칭
                if any(keyword in flow["name"].lower() for keyword in keywords):
                    flow_dict["recommended"] = True
                else:
                    flow_dict["recommended"] = False
                
                filtered_flows.append(flow_dict)
            
            return filtered_flows
            
        except Exception as e:
            print(f"Flow 목록 조회 중 오류: {str(e)}")
            return []
    
    async def get_vectorization_status(self) -> Dict[str, Any]:
        """전체 벡터화 상태를 조회합니다."""
        try:
            all_files = await self.file_service.list_files()
            
            total_files = len(all_files)
            vectorized_files = len([f for f in all_files if f.vectorized])
            
            # 카테고리별 통계
            category_stats = {}
            for file_info in all_files:
                category_name = file_info.category_name or "미분류"
                if category_name not in category_stats:
                    category_stats[category_name] = {"total": 0, "vectorized": 0}
                
                category_stats[category_name]["total"] += 1
                if file_info.vectorized:
                    category_stats[category_name]["vectorized"] += 1
            
            return {
                "total_files": total_files,
                "vectorized_files": vectorized_files,
                "vectorization_rate": round(vectorized_files / total_files * 100, 1) if total_files > 0 else 0,
                "category_stats": category_stats
            }
            
        except Exception as e:
            print(f"벡터화 상태 조회 중 오류: {str(e)}")
            return {
                "total_files": 0,
                "vectorized_files": 0,
                "vectorization_rate": 0,
                "category_stats": {}
            }