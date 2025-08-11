import time
import os
import json
from typing import Dict, Any, List
from ..models.schemas import ChatRequest, ChatResponse
from ..core.config import settings
from .file_service import FileService
from .langflow_service import LangflowService
from .persona_service import PersonaService
from .system_settings_service import SystemSettingsService
import openai
from datetime import datetime

class ChatService:
    def __init__(self):
        self.openai_client = None
        self.file_service = FileService()
        self.langflow_service = LangflowService()
        self.persona_service = PersonaService()
        self.system_settings_service = SystemSettingsService()
        if settings.OPENAI_API_KEY:
            openai.api_key = settings.OPENAI_API_KEY
            self.openai_client = openai
    
    async def process_chat(self, request: ChatRequest) -> ChatResponse:
        """채팅 요청을 처리하고 응답을 생성합니다."""
        start_time = time.time()
        
        try:
            print(f"=== 채팅 요청 처리 시작 ===")
            print(f"사용자 ID: {request.user_id}")
            print(f"메시지: {request.message}")
            print(f"카테고리 IDs: {request.category_ids}")
            print(f"Flow ID: {request.flow_id}")
            print(f"페르소나 ID: {request.persona_id}")
            print(f"시스템 메시지: {request.system_message}")
            
            # 최종 시스템 메시지 구성 (페르소나 + 설정 조합)
            final_system_message = await self._build_system_message(request.system_message, request.persona_id)
            print(f"최종 시스템 메시지: {final_system_message}")
            
            # 채팅 히스토리에 사용자 메시지 저장
            if request.user_id:
                await self._save_chat_message(
                    user_id=request.user_id,
                    message=request.message,
                    role="user",
                    category_ids=request.category_ids
                )
            
            # 기본 검색 Flow ID 확인
            search_flow_id = request.flow_id or await self._get_default_search_flow()
            
            if search_flow_id:
                print(f"LangFlow 검색 Flow 사용: {search_flow_id}")
                # LangFlow 검색 플로우 실행
                langflow_result = await self.langflow_service.search_with_flow(
                    request.message,
                    search_flow_id,
                    request.category_ids,
                    top_k=request.top_k  # 요청에서 top_k 설정 사용
                )
                
                print(f"LangFlow 결과: {langflow_result}")
                
                # LangFlow 결과에서 응답과 소스 추출
                if langflow_result.get("status") == "success":
                    # 직접 ChromaDB 검색 결과 처리
                    search_results = langflow_result.get("results", [])
                    print(f"검색 결과: {len(search_results)}개 발견")
                    
                    if search_results:
                        # 검색 결과 구조 확인을 위한 디버그
                        print(f"첫 번째 검색 결과 구조: {search_results[0] if search_results else 'None'}")
                        
                        # 검색 결과를 문서 형식으로 변환
                        relevant_documents = []
                        for i, result in enumerate(search_results):
                            metadata = result.get("metadata", {})
                            filename = metadata.get("filename", "") or metadata.get("file_name", "") or metadata.get("source", "")
                            
                            doc = {
                                "file_id": metadata.get("file_id", ""),
                                "filename": filename,
                                "category_id": metadata.get("category_id", ""),
                                "category_name": metadata.get("category_name", ""),
                                "content": result.get("text", "") or result.get("content", ""),
                                "score": result.get("score", 1.0)
                            }
                            relevant_documents.append(doc)
                            
                            if i < 3:  # 처음 3개만 로그
                                print(f"변환된 문서 {i}: file_id={doc['file_id']}, filename='{doc['filename']}', score={doc['score']}")
                        
                        # OpenAI를 사용하여 응답 생성
                        response_text = await self.generate_response(request.message, relevant_documents, final_system_message)
                    else:
                        print("검색 결과가 없습니다.")
                        response_text = "죄송합니다, 관련 문서를 찾을 수 없습니다."
                        relevant_documents = []
                else:
                    print(f"LangFlow 실행 실패: {langflow_result.get('error', '알 수 없는 오류')}")
                    # LangFlow 실패 시 기본 검색으로 폴백
                    relevant_documents = await self.search_documents(
                        request.message, 
                        request.category_ids,
                        request.categories
                    )
                    response_text = await self.generate_response(request.message, relevant_documents, final_system_message)
            else:
                print("검색 Flow가 설정되지 않았습니다. 기본 검색을 사용합니다.")
                # 기본 검색 (fallback)
                relevant_documents = await self.search_documents(
                    request.message, 
                    request.category_ids,
                    request.categories
                )
                response_text = await self.generate_response(request.message, relevant_documents, final_system_message)
            
            processing_time = time.time() - start_time
            print(f"처리 시간: {processing_time:.2f}초")
            
            # 소스 문서: 파일 단위로 중복 제거(동일 문서는 1개만)
            print(f"중복 제거 전 relevant_documents: {[doc.get('filename', 'NO_NAME') for doc in relevant_documents]}")
            sources_for_response = self._unique_sources(relevant_documents)
            print(f"중복 제거 후 sources_for_response: {[src.get('filename', 'NO_NAME') for src in sources_for_response]}")

            # 채팅 히스토리에 어시스턴트 응답 저장
            if request.user_id:
                await self._save_chat_message(
                    user_id=request.user_id,
                    message=response_text,
                    role="assistant",
                    category_ids=request.category_ids,
                    sources=sources_for_response
                )
            
            # 신뢰도 계산 (단순화)
            confidence = 0.7  # 고정값으로 설정 (임시)
            if relevant_documents:
                print(f"문서 {len(relevant_documents)}개 발견, 신뢰도: {confidence}")
            else:
                confidence = 0.3
                print(f"문서 없음, 신뢰도: {confidence}")
            
            print(f"계산된 신뢰도: {confidence:.3f} (원본 문서 {len(relevant_documents)}개, 유니크 소스 {len(sources_for_response)}개)")
            
            return ChatResponse(
                response=response_text,
                sources=sources_for_response,
                confidence=confidence,
                processing_time=processing_time,
                categories=request.categories,
                flow_id=search_flow_id,
                user_id=request.user_id
            )
            
        except Exception as e:
            print(f"채팅 처리 중 오류: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # 에러 발생 시 기본 응답 반환
            processing_time = time.time() - start_time
            return ChatResponse(
                response=f"죄송합니다. 요청 처리 중 오류가 발생했습니다: {str(e)}",
                sources=[],
                confidence=0.0,
                processing_time=processing_time,
                categories=request.categories or [],
                flow_id=request.flow_id,
                user_id=request.user_id
            )
    
    async def execute_langflow_flow(self, flow_id: str, message: str, context: List[Dict[str, Any]] = None) -> str:
        """특정 Langflow Flow를 실행합니다."""
        try:
            # TODO: 실제 Langflow Flow 실행 로직 구현
            # 1. Flow ID로 Flow JSON 로드
            # 2. 컨텍스트와 메시지를 Flow에 전달
            # 3. Flow 실행 결과 반환
            
            # 임시 구현
            context_text = ""
            if context:
                context_text = "\n".join([doc.get("content", "") for doc in context])
            
            return f"Flow {flow_id} 실행 결과: {message}\n\n참고 문서:\n{context_text}"
            
        except Exception as e:
            return f"Flow 실행 중 오류가 발생했습니다: {str(e)}"
    
    async def search_documents(self, query: str, category_ids: List[str] = None, categories: List[str] = None) -> List[Dict[str, Any]]:
        """벡터 DB에서 관련 문서를 검색합니다."""
        try:
            # 카테고리별 파일 필터링
            if category_ids or categories:
                files = await self.file_service.get_files_by_categories(category_ids, categories)
            else:
                files = await self.file_service.list_files()
            
            # 벡터화된 문서에서 검색
            documents = []
            for file_info in files[:5]:  # 최대 5개 파일
                if file_info.vectorized:
                    # 벡터 데이터 로드
                    vector_content = await self._load_vector_data(file_info.file_id)
                    if vector_content:
                        # 간단한 키워드 매칭 (실제로는 임베딩 유사도 계산)
                        relevant_chunks = await self._search_chunks(query, vector_content.get("chunks", []))
                        
                        for chunk in relevant_chunks[:3]:  # 파일당 최대 3개 청크
                            documents.append({
                                "file_id": file_info.file_id,
                                "filename": file_info.filename,
                                "category_id": file_info.category_id,
                                "category_name": file_info.category_name,
                                "content": chunk,
                                "score": 0.8
                            })
                else:
                    # 벡터화되지 않은 파일은 메타데이터만 제공
                    documents.append({
                        "file_id": file_info.file_id,
                        "filename": file_info.filename,
                        "category_id": file_info.category_id,
                        "category_name": file_info.category_name,
                        "content": f"{file_info.filename} (아직 벡터화되지 않음)",
                        "score": 0.3
                    })
            
            return documents
            
        except Exception as e:
            print(f"문서 검색 중 오류: {str(e)}")
            return []
    
    async def generate_response(self, query: str, context: List[Dict[str, Any]], system_message: str = None) -> str:
        """OpenAI를 사용하여 응답을 생성합니다."""
        if not self.openai_client:
            return "OpenAI API 키가 설정되지 않았습니다."
        
        try:
            # 컨텍스트를 포함한 프롬프트 생성
            context_text = "\n".join([doc.get("content", "") for doc in context])
            
            # 출처 정보를 포함한 프롬프트 생성
            sources_info = []
            for i, doc in enumerate(context):
                source_name = doc.get("filename", f"문서{i+1}")
                sources_info.append(f"[{i+1}] {source_name}")
            
            sources_text = "\n".join(sources_info) if sources_info else "참고 문서 없음"
            
            prompt = f"""다음 문서를 참고하여 질문에 답변해주세요. 답변할 때 관련된 출처를 [1], [2] 형태로 인라인에 표시해주세요.

참고 문서:
{sources_text}

문서 내용:
{context_text}

질문: {query}

답변 형식: 답변 내용에 관련된 출처를 [1], [2] 형태로 표시하세요."""
            
            # OpenAI API 1.0+ 버전 사용
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            
            # 전달받은 시스템 메시지 사용 (이미 _build_system_message에서 처리됨)
            final_system_message = system_message
            
            print(f"사용된 시스템 메시지: {final_system_message}")
            
            # OpenAI API 호출 시작 시간 기록
            openai_start_time = time.time()
            print(f"OpenAI API 호출 시작: gpt-4, max_tokens=1500")
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",  # 빠른 응답을 위해 gpt-3.5-turbo 사용
                messages=[
                    {"role": "system", "content": final_system_message},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1500,
                temperature=0.7
            )
            
            openai_time = time.time() - openai_start_time
            print(f"OpenAI API 호출 완료: {openai_time:.2f}초")
            
            return response.choices[0].message.content
            
        except Exception as e:
            return f"응답 생성 중 오류가 발생했습니다: {str(e)}"
    
    async def _load_vector_data(self, file_id: str) -> Dict[str, Any]:
        """벡터 데이터를 로드합니다."""
        try:
            vector_file_path = os.path.join(
                settings.DATA_DIR, 
                f"vectors_{file_id}.json"
            )
            
            if os.path.exists(vector_file_path):
                with open(vector_file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return None
            
        except Exception as e:
            print(f"벡터 데이터 로드 중 오류: {str(e)}")
            return None
    
    async def _search_chunks(self, query: str, chunks: List[str]) -> List[str]:
        """간단한 키워드 기반 청크 검색 (실제로는 임베딩 유사도 계산)"""
        try:
            query_lower = query.lower()
            relevant_chunks = []
            
            for chunk in chunks:
                # 간단한 키워드 매칭
                if any(keyword in chunk.lower() for keyword in query_lower.split()):
                    relevant_chunks.append(chunk)
            
            # 최대 5개 청크 반환
            return relevant_chunks[:5]
            
        except Exception as e:
            print(f"청크 검색 중 오류: {str(e)}")
            return []
    
    async def _get_default_search_flow(self) -> str:
        """기본 검색 Flow ID를 가져옵니다."""
        try:
            # 설정 파일에서 기본 검색 Flow ID 읽기
            config_file = os.path.join(settings.BASE_DIR, "langflow", "config.json")
            
            if os.path.exists(config_file):
                with open(config_file, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)
                return config_data.get("default_search_flow_id")
            
            return None
            
        except Exception as e:
            print(f"기본 검색 Flow ID 조회 중 오류: {str(e)}")
            return None
    
    async def _extract_sources_from_langflow_result(self, langflow_result: Dict[str, Any], category_ids: List[str] = None) -> List[Dict[str, Any]]:
        """LangFlow 결과에서 소스 문서를 추출합니다."""
        try:
            sources = []
            
            # LangFlow 결과에서 사용된 파일 정보 추출 (구현 필요)
            # 현재는 카테고리 기반으로 관련 문서 반환
            if category_ids:
                files = await self.file_service.get_files_by_categories(category_ids, None)
                for file_info in files[:3]:  # 최대 3개 파일
                    if file_info.vectorized:
                        sources.append({
                            "file_id": file_info.file_id,
                            "filename": file_info.filename,
                            "category_id": file_info.category_id,
                            "category_name": file_info.category_name,
                            "content": f"📄 {file_info.filename}에서 관련 정보를 찾았습니다.",
                            "score": 0.9
                        })
            
            return sources
            
        except Exception as e:
            print(f"소스 추출 중 오류: {str(e)}")
            return [] 

    def _unique_sources(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """파일명 기준 중복 제거: 동일 파일명은 1개만 반환"""
        if not documents:
            print("=== 중복 제거: 입력 문서 없음 ===")
            return []
            
        print(f"=== 중복 제거 시작 ===")
        print(f"입력 문서 수: {len(documents)}")
        
        # 입력 문서들의 파일명 확인
        filenames = [doc.get("filename", "EMPTY") for doc in documents]
        print(f"모든 파일명: {filenames}")
        
        # 강력한 중복 제거: filename을 정규화하고 중복 제거
        seen_filenames = set()
        result = []
        
        for i, doc in enumerate(documents):
            filename = doc.get("filename", "").strip()
            if not filename:
                print(f"문서 {i}: filename이 비어있음, 건너뜀")
                continue
                
            # 파일명 정규화 (공백 제거, 소문자 변환)
            normalized_filename = filename.lower().strip()
            
            if normalized_filename not in seen_filenames:
                seen_filenames.add(normalized_filename)
                result.append({
                    "file_id": doc.get("file_id", ""),
                    "filename": filename,  # 원본 파일명 유지
                    "category_id": doc.get("category_id", ""),
                    "category_name": doc.get("category_name", ""),
                })
                print(f"문서 {i}: filename='{filename}' 추가됨 (정규화: {normalized_filename})")
            else:
                print(f"문서 {i}: filename='{filename}' 중복 (정규화: {normalized_filename}), 건너뜀")
        
        print(f"최종 유니크 소스 수: {len(result)}")
        print(f"유니크 소스들: {[r['filename'] for r in result]}")
        print(f"=== 중복 제거 완료 ===")
        return result

    async def get_chat_history(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """사용자별 채팅 히스토리를 조회합니다."""
        try:
            history_file = os.path.join(
                settings.DATA_DIR, 
                'chat_history.json'
            )
            
            if not os.path.exists(history_file):
                return []
            
            with open(history_file, 'r', encoding='utf-8') as f:
                all_history = json.load(f)
            
            # 사용자별 히스토리 필터링
            user_history = all_history.get(user_id, [])
            
            # 최신 순으로 정렬하고 limit만큼 반환
            sorted_history = sorted(user_history, key=lambda x: x.get('timestamp', ''), reverse=True)
            return sorted_history[:limit]
            
        except Exception as e:
            print(f"채팅 히스토리 조회 오류: {str(e)}")
            return []

    async def save_chat_history(self, user_id: str, user_message: dict, assistant_message: dict) -> bool:
        """채팅 히스토리를 저장합니다."""
        try:
            history_file = os.path.join(
                settings.DATA_DIR, 
                'chat_history.json'
            )
            
            # 기존 히스토리 로드
            all_history = {}
            if os.path.exists(history_file):
                with open(history_file, 'r', encoding='utf-8') as f:
                    all_history = json.load(f)
            
            # 사용자 히스토리 초기화
            if user_id not in all_history:
                all_history[user_id] = []
            
            # 사용자 메시지 저장
            user_msg = {
                "id": user_message.get("id", str(int(time.time() * 1000))),
                "message": user_message.get("content", ""),
                "role": "user",
                "timestamp": user_message.get("timestamp", datetime.now().isoformat()),
                "category_ids": user_message.get("categories", []),
                "sources": user_message.get("sources", [])
            }
            
            # 어시스턴트 메시지 저장
            assistant_msg = {
                "id": assistant_message.get("id", str(int(time.time() * 1000) + 1)),
                "message": assistant_message.get("content", ""),
                "role": "assistant",
                "timestamp": assistant_message.get("timestamp", datetime.now().isoformat()),
                "category_ids": assistant_message.get("categories", []),
                "sources": assistant_message.get("sources", []),
                "source_details": assistant_message.get("sourceDetails", []),
                "processing_time": assistant_message.get("processingTime"),
                "confidence": assistant_message.get("confidence")
            }
            
            # 히스토리에 추가
            all_history[user_id].extend([user_msg, assistant_msg])
            
            # 최대 100개 메시지로 제한 (50개 대화)
            if len(all_history[user_id]) > 100:
                all_history[user_id] = all_history[user_id][-100:]
            
            # 파일에 저장
            os.makedirs(os.path.dirname(history_file), exist_ok=True)
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(all_history, f, ensure_ascii=False, indent=2)
            
            print(f"채팅 히스토리 저장 완료: {user_id}")
            return True
            
        except Exception as e:
            print(f"채팅 히스토리 저장 오류: {str(e)}")
            return False

    async def _save_chat_message(
        self, 
        user_id: str, 
        message: str, 
        role: str, 
        category_ids: List[str] = None,
        sources: List[Dict[str, Any]] = None
    ):
        """채팅 메시지를 히스토리에 저장합니다."""
        try:
            history_file = os.path.join(
                settings.DATA_DIR, 
                'chat_history.json'
            )
            
            # 기존 히스토리 로드
            all_history = {}
            if os.path.exists(history_file):
                with open(history_file, 'r', encoding='utf-8') as f:
                    all_history = json.load(f)
            
            # 사용자별 히스토리 초기화
            if user_id not in all_history:
                all_history[user_id] = []
            
            # 새 메시지 추가
            chat_message = {
                "id": f"{user_id}_{int(time.time() * 1000)}",
                "user_id": user_id,
                "message": message,
                "role": role,
                "timestamp": datetime.now().isoformat(),
                "category_ids": category_ids or [],
                "sources": sources or []
            }
            
            all_history[user_id].append(chat_message)
            
            # 최대 1000개 메시지 유지
            if len(all_history[user_id]) > 1000:
                all_history[user_id] = all_history[user_id][-1000:]
            
            # 히스토리 저장
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(all_history, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            print(f"채팅 메시지 저장 중 오류: {str(e)}")
    
    async def _build_system_message(self, custom_message: str = None, persona_id: str = None) -> str:
        """시스템 메시지를 구성합니다: 기본/사용자 지정 메시지 + (선택) 페르소나 메시지 결합."""
        try:
            # 기본 시스템 메시지 (설정 or 사용자 지정)
            if custom_message:
                print("사용자 지정 시스템 메시지 사용")
                base_message = custom_message
            else:
                base_message = await self.system_settings_service.get_default_system_message()
                print("기본 시스템 메시지 사용")

            # 사용할 페르소나 결정: 요청 > 시스템 기본
            chosen_persona_id = persona_id or await self.system_settings_service.get_default_persona_id()

            persona_text = None
            if chosen_persona_id:
                persona = await self.persona_service.get_persona(chosen_persona_id)
                if persona and persona.system_message:
                    print(f"페르소나 시스템 메시지 포함: {persona.name}")
                    persona_text = persona.system_message
                else:
                    print(f"페르소나를 찾을 수 없거나 시스템 메시지가 없음: {chosen_persona_id}")

            if persona_text:
                return f"{base_message}\n\n{persona_text}"
            return base_message

        except Exception as e:
            print(f"시스템 메시지 구성 중 오류: {str(e)}")
            # 최종 폴백: 하드코딩된 기본값
            return "당신은 도움이 되는 AI 어시스턴트입니다. 정확하고 유용한 정보를 제공하며, 답변할 때 관련된 출처를 [1], [2] 형태로 인라인에 표시해주세요."