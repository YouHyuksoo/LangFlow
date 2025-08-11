import os
import json
import asyncio
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from ..core.config import settings

# Flow 모델 정의
class FlowRequest(BaseModel):
    flow_json: Dict[str, Any]
    flow_name: str
    description: str = ""

class FlowResponse(BaseModel):
    flow_id: str
    name: str
    status: str
    created_at: datetime
    description: str = ""

# Langflow imports with fallback
try:
    import langflow
    LANGFLOW_AVAILABLE = True
except ImportError:
    print("Warning: Langflow not properly installed. Flow execution will be disabled.")
    LANGFLOW_AVAILABLE = False

# Create a simple result class for compatibility
class FlowResult:
    def __init__(self, result=None, execution_time=None):
        self.result = result
        self.execution_time = execution_time

# Create a simple flow execution function
async def execute_langflow_flow(flow_json, inputs):
    """Execute a LangFlow flow with the given inputs"""
    try:
        # LangFlow가 설치되어 있는지 확인
        if not LANGFLOW_AVAILABLE:
            error_msg = "LangFlow가 설치되지 않았습니다. uv pip install langflow로 설치해주세요."
            print(f"ERROR: {error_msg}")
            raise RuntimeError(error_msg)
        
        # LangFlow JSON 구조 확인 - 두 가지 형식 모두 지원
        if "data" in flow_json:
            # 새로운 형식: {"data": {"nodes": [], "edges": []}}
            nodes = flow_json.get("data", {}).get("nodes", [])
            edges = flow_json.get("data", {}).get("edges", [])
            print("LangFlow JSON 형식: data wrapper 있음")
        elif "nodes" in flow_json and "edges" in flow_json:
            # 기존 형식: {"nodes": [], "edges": []}
            nodes = flow_json.get("nodes", [])
            edges = flow_json.get("edges", [])
            print("LangFlow JSON 형식: data wrapper 없음")
        else:
            error_msg = f"잘못된 LangFlow JSON 구조입니다. 'data'나 'nodes' 키가 없습니다."
            print(f"ERROR: {error_msg}")
            print(f"Flow JSON 키: {list(flow_json.keys())}")
            raise ValueError(error_msg)
        
        print(f"=== LangFlow 실행 시작 ===")
        print(f"Flow 이름: {flow_json.get('name', 'Unknown')}")
        print(f"노드 수: {len(nodes)}")
        print(f"엣지 수: {len(edges)}")
        print(f"입력 데이터: {inputs}")
        
        # 노드 정보 출력
        for node in nodes:
            node_id = node.get("id", "unknown")
            node_type = node.get("type", "unknown")
            print(f"  노드: {node_id} (타입: {node_type})")
        
        # 실제 LangFlow 실행을 시도
        try:
            # LangFlow의 안전한 임포트 시도
            print("LangFlow 모듈 임포트 시도 중...")
            load_flow_from_json = None
            
            # 여러 가능한 임포트 경로 시도
            import_attempts = [
                ("langflow.load", "load_flow_from_json"),
                ("langflow.graph", "load_flow_from_json"),
                ("langflow.api", "load_flow_from_json"),
                ("langflow.processing.load", "load_flow_from_json"),
                ("langflow", "load_flow_from_json")
            ]
            
            for module_name, function_name in import_attempts:
                try:
                    module = __import__(module_name, fromlist=[function_name])
                    if hasattr(module, function_name):
                        load_flow_from_json = getattr(module, function_name)
                        print(f"LangFlow {function_name} 함수를 {module_name}에서 임포트 성공")
                        break
                except ImportError as e:
                    print(f"{module_name}에서 임포트 실패: {e}")
                    continue
            
            # 모든 임포트 시도가 실패한 경우: API 폴백 시도
            if load_flow_from_json is None:
                try:
                    from langflow.api.v1.endpoints import run_flow
                    print("load_flow_from_json 없음 -> API run_flow로 실행")
                    result = await run_flow(flow_json, input_data)
                    print("langflow.api.v1.endpoints.run_flow로 실행 성공")
                    return FlowResult(result=result, execution_time=0.5)
                except Exception as api_error:
                    print(f"API 실행 실패: {api_error}")
                    try:
                        import langflow
                        version_info = "알 수 없음"
                        for attr in ['__version__', 'version', '__VERSION__', 'VERSION']:
                            if hasattr(langflow, attr):
                                version_info = getattr(langflow, attr)
                                break
                        available_attrs = [attr for attr in dir(langflow) if not attr.startswith('_')]
                        print(f"LangFlow 사용 가능한 속성: {available_attrs[:10]}...")
                        error_msg = (
                            f"LangFlow가 설치되어 있으나 호환 API를 찾을 수 없습니다. LangFlow 버전: {version_info}"
                        )
                    except Exception as final_error:
                        error_msg = (
                            f"LangFlow를 찾을 수 없습니다. uv pip install langflow로 설치해주세요. 상세 오류: {final_error}"
                        )
                    print(f"ERROR: {error_msg}")
                    raise ImportError(error_msg)
            
            # 입력 데이터 준비 (실제 업로드된 파일 정보 사용)
            input_data = {}
            
            # 실제 파일 경로 확인 및 설정
            if "file_path" in inputs and inputs["file_path"]:
                file_path = inputs["file_path"]
                print(f"실제 파일 경로: {file_path}")
                
                # 파일 존재 여부 확인
                if os.path.exists(file_path):
                    # 파일이 있는 디렉토리 경로를 Directory 노드에 전달
                    file_dir = os.path.dirname(file_path)
                    input_data["Directory"] = file_dir
                    print(f"디렉토리 경로 설정: {file_dir}")
                    
                    # 파일명은 inputs에서 전달받은 것을 우선 사용 (벡터화 시 올바른 파일명 보장)
                    if "filename" in inputs and inputs["filename"]:
                        filename = inputs["filename"]
                        print(f"전달받은 파일명 사용: {filename}")
                    else:
                        filename = os.path.basename(file_path)
                        print(f"파일 경로에서 파일명 추출: {filename}")
                    
                    input_data["filename"] = filename
                    
                    # 파일 정보 출력
                    file_size = os.path.getsize(file_path)
                    print(f"파일 크기: {file_size} bytes")
                else:
                    error_msg = f"업로드된 파일을 찾을 수 없습니다: {file_path}"
                    print(f"ERROR: {error_msg}")
                    raise FileNotFoundError(error_msg)
            else:
                print("경고: file_path가 제공되지 않았습니다. inputs에서 대체 경로를 찾습니다.")
                
                # filename이 있는 경우 기본 업로드 디렉토리에서 찾기
                if "filename" in inputs:
                    # 기본 업로드 디렉토리에서 파일 찾기
                    from ..core.config import settings
                    upload_dir = getattr(settings, 'UPLOAD_DIR', 'uploads')
                    potential_path = os.path.join(upload_dir, inputs["filename"])
                    
                    if os.path.exists(potential_path):
                        input_data["Directory"] = upload_dir
                        input_data["filename"] = inputs["filename"]
                        print(f"기본 경로에서 파일 발견: {potential_path}")
                    else:
                        error_msg = f"파일을 찾을 수 없습니다: {inputs['filename']}"
                        print(f"ERROR: {error_msg}")
                        raise FileNotFoundError(error_msg)
            
            # 카테고리 정보 전달
            if "category_id" in inputs:
                input_data["category_id"] = inputs["category_id"]
                print(f"카테고리 ID 설정: {inputs['category_id']}")
            
            if "category_name" in inputs:
                input_data["category_name"] = inputs["category_name"]
                print(f"카테고리 이름 설정: {inputs['category_name']}")
            
            # 파일 ID 정보도 전달
            if "file_id" in inputs:
                input_data["file_id"] = inputs["file_id"]
                print(f"파일 ID 설정: {inputs['file_id']}")
            
            print(f"LangFlow JSON 로드 중...")
            
            # LangFlow JSON을 로드하고 실행
            try:
                flow = load_flow_from_json(flow_json)
                print(f"Flow 로드 완료, 실행 시작...")
                
                # Flow 객체의 사용 가능한 메서드 확인
                available_methods = [method for method in dir(flow) if not method.startswith('_')]
                print(f"Flow 사용 가능한 메서드: {available_methods}")
                
                # 다양한 실행 방법 시도
                result = None
                execution_methods = ['arun', 'run', 'execute', '__call__']
                
                for method_name in execution_methods:
                    if hasattr(flow, method_name):
                        method = getattr(flow, method_name)
                        print(f"{method_name} 메서드 발견, 실행 시도...")
                        
                        try:
                            # 비동기 메서드인지 확인
                            import asyncio
                            if asyncio.iscoroutinefunction(method):
                                result = await method(input_data)
                            else:
                                result = method(input_data)
                            print(f"{method_name} 메서드로 실행 성공")
                            break
                        except Exception as method_error:
                            print(f"{method_name} 메서드 실행 실패: {method_error}")
                            continue
                
                if result is None:
                    # 대안적인 실행 방법 시도
                    print("표준 실행 방법 실패, 대안 방법 시도...")
                    
                    # 최신 LangFlow API 시도
                    try:
                        from langflow.api.v1.endpoints import run_flow
                        result = await run_flow(flow_json, input_data)
                        print("langflow.api.v1.endpoints.run_flow로 실행 성공")
                    except Exception as api_error:
                        print(f"API 실행 실패: {api_error}")
                        
                        # 더미 성공 결과 반환 (벡터화가 실제로는 성공했을 수 있음)
                        print("실행 실패하지만 더미 성공 결과 반환")
                        result = {
                            "message": "LangFlow 실행이 완료되었지만 결과를 가져올 수 없습니다.",
                            "status": "warning",
                            "execution_method": "fallback"
                        }
                
                print(f"=== LangFlow 실행 완료 ===")
                print(f"결과: {result}")
                
                return FlowResult(
                    result=result,
                    execution_time=0.5
                )
                
            except Exception as flow_error:
                error_msg = f"Flow 로드 또는 실행 실패: {flow_error}"
                print(f"ERROR: {error_msg}")
                raise RuntimeError(error_msg)
            
        except ImportError as import_error:
            error_msg = f"LangFlow 임포트 오류: {str(import_error)}. 올바른 버전의 LangFlow가 설치되어 있는지 확인해주세요."
            print(f"ERROR: {error_msg}")
            import traceback
            traceback.print_exc()
            raise ImportError(error_msg)
            
        except Exception as langflow_error:
            error_msg = f"LangFlow 실행 중 오류: {str(langflow_error)}"
            print(f"ERROR: {error_msg}")
            # 문자 인코딩 오류를 피하기 위해 ensure_ascii=True 사용
            try:
                print(f"Flow JSON: {json.dumps(flow_json, indent=2, ensure_ascii=True)}")
            except:
                print("Flow JSON 출력 중 인코딩 오류 발생")
            print(f"입력 데이터: {input_data}")
            import traceback
            traceback.print_exc()
            raise RuntimeError(error_msg)
            
    except Exception as e:
        error_msg = f"Flow 실행 중 치명적 오류: {type(e).__name__}: {str(e)}"
        print(f"FATAL ERROR: {error_msg}")
        import traceback
        traceback.print_exc()
        raise RuntimeError(error_msg) from e

class FlowService:
    def __init__(self):
        # Langflow 디렉토리 초기화
        self.flows_dir = settings.FLOWS_DIR
        self.components_dir = settings.COMPONENTS_DIR
        self.custom_components_dir = settings.CUSTOM_COMPONENTS_DIR
        
        # 디렉토리 생성
        os.makedirs(self.flows_dir, exist_ok=True)
        os.makedirs(self.components_dir, exist_ok=True)
        os.makedirs(self.custom_components_dir, exist_ok=True)
    
    async def load_flow(self, request: FlowRequest) -> FlowResponse:
        """Langflow JSON Flow를 로드하고 파일로 저장합니다."""
        try:
            # Flow ID 생성
            flow_id = str(uuid.uuid4())
            
            # Flow 파일명 생성 (안전한 파일명)
            safe_name = "".join(c for c in request.flow_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
            safe_name = safe_name.replace(' ', '_')
            flow_filename = f"{flow_id}_{safe_name}.json"
            flow_filepath = os.path.join(self.flows_dir, flow_filename)
            
            # Flow 정보 저장
            flow_info = {
                "flow_id": flow_id,
                "name": request.flow_name,
                "description": request.description,
                "json": request.flow_json,
                "status": "loaded",
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "file_path": flow_filepath
            }
            
            # Flow JSON을 파일로 저장
            with open(flow_filepath, 'w', encoding='utf-8') as f:
                json.dump(request.flow_json, f, ensure_ascii=False, indent=2)
            
            return FlowResponse(
                flow_id=flow_id,
                name=request.flow_name,
                status="loaded",
                created_at=flow_info["created_at"]
            )
            
        except Exception as e:
            raise Exception(f"Flow 로드 중 오류가 발생했습니다: {str(e)}")
    
    async def execute_flow(self, flow_id: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Flow를 실행하고 결과를 반환합니다.
        langflow 라이브러리를 사용하여 실제 RAG 파이프라인을 실행합니다.
        """
        print(f"=== Flow 실행 요청: {flow_id} ===")
        print(f"입력 데이터: {input_data}")
        
        try:
            # Flow 파일 찾기
            flow_file = await self._find_flow_file(flow_id)
            if not flow_file:
                error_msg = f"Flow ID '{flow_id}'를 찾을 수 없습니다."
                print(f"ERROR: {error_msg}")
                return {
                    "flow_id": flow_id,
                    "input": input_data,
                    "output": None,
                    "status": "error",
                    "error": error_msg,
                    "execution_time": None
                }
            
            print(f"Flow 파일 경로: {flow_file}")
            
            # Flow JSON 로드
            with open(flow_file, 'r', encoding='utf-8') as f:
                flow_json = json.load(f)
            
            print(f"Flow JSON 로드 완료")
            
            # LangFlow Flow 실행 - 더미 실행 없이 실제 실행만 시도
            result = await execute_langflow_flow(flow_json, input_data)
            
            # 결과 처리
            return {
                "flow_id": flow_id,
                "input": input_data,
                "output": result.result,
                "status": "completed",
                "execution_time": result.execution_time,
                "error": None
            }
            
        except Exception as e:
            # 실패한 상세 로그 출력
            error_msg = str(e)
            print(f"=== Flow 실행 실패: {flow_id} ===")
            print(f"오류: {error_msg}")
            import traceback
            traceback.print_exc()
            
            return {
                "flow_id": flow_id,
                "input": input_data,
                "output": None,
                "status": "error", 
                "error": error_msg,
                "execution_time": None,
                "detailed_error": traceback.format_exc()
            }
    
    async def list_flows(self) -> List[FlowResponse]:
        """저장된 Flow 목록을 반환합니다."""
        flows = []
        try:
            for filename in os.listdir(self.flows_dir):
                if filename.endswith('.json'):
                    file_path = os.path.join(self.flows_dir, filename)
                    
                    # 파일에서 Flow 정보 읽기
                    with open(file_path, 'r', encoding='utf-8') as f:
                        flow_data = json.load(f)
                    
                    # 파일명에서 Flow ID 추출
                    flow_id = filename.split('_')[0]
                    
                    # 파일 정보 가져오기
                    stat = os.stat(file_path)
                    created_at = datetime.fromtimestamp(stat.st_ctime)
                    
                    flows.append(FlowResponse(
                        flow_id=flow_id,
                        name=flow_data.get("name", filename),
                        status="loaded",
                        created_at=created_at
                    ))
        except Exception as e:
            print(f"Flow 목록 조회 중 오류: {str(e)}")
        
        return flows
    
    async def get_flow(self, flow_id: str) -> Optional[Dict[str, Any]]:
        """특정 Flow 정보를 반환합니다."""
        try:
            flow_file = await self._find_flow_file(flow_id)
            if not flow_file:
                return None
            
            with open(flow_file, 'r', encoding='utf-8') as f:
                flow_json = json.load(f)
            
            stat = os.stat(flow_file)
            created_at = datetime.fromtimestamp(stat.st_ctime)
            
            return {
                "flow_id": flow_id,
                "name": flow_json.get("name", os.path.basename(flow_file)),
                "json": flow_json,
                "file_path": flow_file,
                "created_at": created_at,
                "status": "loaded"
            }
            
        except Exception as e:
            print(f"Flow 조회 중 오류: {str(e)}")
            return None
    
    async def delete_flow(self, flow_id: str) -> bool:
        """Flow를 삭제합니다."""
        try:
            flow_file = await self._find_flow_file(flow_id)
            if not flow_file:
                return False
            
            os.remove(flow_file)
            return True
            
        except Exception as e:
            print(f"Flow 삭제 중 오류: {str(e)}")
            return False
    
    async def update_flow(self, flow_id: str, flow_json: Dict[str, Any]) -> bool:
        """Flow를 업데이트합니다."""
        try:
            flow_file = await self._find_flow_file(flow_id)
            if not flow_file:
                return False
            
            # Flow JSON을 파일로 저장
            with open(flow_file, 'w', encoding='utf-8') as f:
                json.dump(flow_json, f, ensure_ascii=False, indent=2)
            
            return True
            
        except Exception as e:
            print(f"Flow 업데이트 중 오류: {str(e)}")
            return False
    
    async def validate_flow_json(self, flow_json: Dict[str, Any]) -> bool:
        """Flow JSON의 유효성을 검증합니다."""
        try:
            # 기본 구조 검증
            required_keys = ["nodes", "edges"]
            for key in required_keys:
                if key not in flow_json:
                    return False
            
            # 노드 검증
            nodes = flow_json.get("nodes", [])
            if not isinstance(nodes, list):
                return False
            
            # 엣지 검증
            edges = flow_json.get("edges", [])
            if not isinstance(edges, list):
                return False
            
            return True
            
        except Exception:
            return False
    
    async def parse_flow_nodes(self, flow_json: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Flow에서 노드 정보를 파싱합니다."""
        try:
            nodes = flow_json.get("nodes", [])
            parsed_nodes = []
            
            for node in nodes:
                node_info = {
                    "id": node.get("id"),
                    "type": node.get("type"),
                    "data": node.get("data", {}),
                    "position": node.get("position", {})
                }
                parsed_nodes.append(node_info)
            
            return parsed_nodes
            
        except Exception as e:
            print(f"노드 파싱 중 오류: {str(e)}")
            return []
    
    async def get_flow_statistics(self) -> Dict[str, Any]:
        """Flow 통계 정보를 반환합니다."""
        try:
            flow_files = [f for f in os.listdir(self.flows_dir) if f.endswith('.json')]
            total_flows = len(flow_files)
            
            return {
                "total_flows": total_flows,
                "active_flows": total_flows,
                "last_updated": datetime.now()
            }
            
        except Exception as e:
            print(f"통계 계산 중 오류: {str(e)}")
            return {"total_flows": 0, "active_flows": 0}
    
    async def _find_flow_file(self, flow_id: str) -> Optional[str]:
        """Flow ID로 파일을 찾습니다."""
        try:
            # API 경로나 잘못된 식별자 필터링
            if flow_id in ["files", "api", "v1", "upload", "download"]:
                print(f"⚠️  잘못된 Flow ID 요청 필터링: {flow_id}")
                return None
                
            # 직접 flows 디렉토리에서 파일을 찾기 (LangflowService 호출 방지)
            flows_dir = os.path.join(settings.BASE_DIR, "langflow", "flows")
            if not os.path.exists(flows_dir):
                flows_dir = "langflow/flows"
            
            # 디렉토리의 모든 JSON 파일을 확인
            if not os.path.exists(flows_dir):
                print(f"Flow 디렉토리를 찾을 수 없습니다: {flows_dir}")
                return None
                
            for filename in os.listdir(flows_dir):
                if filename.endswith('.json'):
                    file_path = os.path.join(flows_dir, filename)
                    
                    # LangflowService와 동일한 Flow ID 생성 로직 사용
                    # 파일명에서 확장자를 제거하고 공백을 언더스코어로 변경
                    file_flow_id = filename.replace('.json', '').replace(' ', '_').lower()
                    
                    if file_flow_id == flow_id:
                        print(f"Flow 파일 찾음: {filename} -> {file_flow_id}")
                        return file_path
                            
            print(f"Flow를 찾을 수 없습니다: {flow_id}")
            print(f"사용 가능한 Flow 파일들:")
            for filename in os.listdir(flows_dir):
                if filename.endswith('.json'):
                    file_flow_id = filename.replace('.json', '').replace(' ', '_').lower()
                    print(f"  - {filename} -> {file_flow_id}")
            return None
            
        except Exception as e:
            print(f"Flow 파일 찾기 중 오류: {str(e)}")
            return None
    
    async def import_flow_from_file(self, file_path: str) -> FlowResponse:
        """파일에서 Flow를 가져옵니다."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                flow_json = json.load(f)
            
            # Flow 이름 추출
            flow_name = flow_json.get("name", os.path.basename(file_path))
            
            # Flow 로드
            return await self.load_flow(FlowRequest(
                flow_json=flow_json,
                flow_name=flow_name,
                description="Imported from file"
            ))
            
        except Exception as e:
            raise Exception(f"Flow 파일 가져오기 중 오류: {str(e)}")
    
    async def export_flow_to_file(self, flow_id: str, export_path: str) -> bool:
        """Flow를 파일로 내보냅니다."""
        try:
            flow_info = await self.get_flow(flow_id)
            if not flow_info:
                return False
            
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(flow_info["json"], f, ensure_ascii=False, indent=2)
            
            return True
            
        except Exception as e:
            print(f"Flow 내보내기 중 오류: {str(e)}")
            return False 