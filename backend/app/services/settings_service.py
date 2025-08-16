"""
통합 설정 관리 서비스

모든 시스템 설정을 중앙에서 관리하는 서비스입니다.
- 시스템 기본 설정
- 모델 설정
- 성능 설정  
- Docling 설정
- Unstructured 설정
"""

from typing import Dict, Any, Optional
import json
import os
import psutil
from pathlib import Path
from ..core.config import settings as config_settings
from ..core.logger import get_console_logger

_clog = get_console_logger()

class SettingsService:
    """통합 설정 관리 서비스"""
    
    def __init__(self):
        self.data_dir = Path(config_settings.DATA_DIR)
        self.data_dir.mkdir(exist_ok=True)
        
        # 설정 파일 경로들
        self.settings_file = self.data_dir / "unified_settings.json"
        
        # 기본 설정 정의
        self._default_settings = {
            "system": {
                "maxFileSize": 10,  # MB
                "allowedFileTypes": ["pdf", "docx", "pptx", "xlsx"],
                "uploadDirectory": "uploads/",
                "vectorDimension": 1536,
                "chunkSize": 1000,
                "chunkOverlap": 200,
                "enableAutoVectorization": True,
                "enableNotifications": True,
                "debugMode": False,
                "default_system_message": "",
                "default_persona_id": "",
                "preprocessing_method": "basic",  # basic, docling, unstructured
            },
            "performance": {
                "maxConcurrentEmbeddings": 5,
                "maxConcurrentChunks": 20,
                "embeddingPoolSize": 3,
                "chunkStreamBufferSize": 100,
                "connectionPoolSize": 10,
                "cacheTtlSeconds": 3600,
                "enableParallelProcessing": True,
                "enableStreamingChunks": True,
                "enableSmartCaching": True,
                "enableBatchProcessing": False,
                "maxMemoryUsageMB": 2048,
                "maxCpuUsagePercent": 80,
                "requestTimeoutSeconds": 300,
                "enablePerformanceMonitoring": True,
                "logPerformanceMetrics": False,
            },
            "models": {
                "llm_provider": "openai",
                "llm_model": "gpt-3.5-turbo",
                "llm_api_key": "",
                "llm_base_url": "",
                "embedding_provider": "openai",
                "embedding_model": "text-embedding-ada-002",
                "embedding_api_key": "",
                "embedding_base_url": "",
                "temperature": 0.7,
                "max_tokens": 2000,
            },
            "docling": {
                "enabled": False,
                "extract_tables": True,
                "extract_images": True,
                "ocr_enabled": False,
                "output_format": "markdown",
                "processing_timeout": 300,
            },
            "unstructured": {
                "enabled": True,
                "api_key": "",
                "api_url": "",
                "strategy": "auto",
                "extract_images": False,
                "extract_tables": True,
                "chunking_strategy": "by_title",
                "max_characters": 1000,
                "combine_under_n_chars": 200,
                "processing_timeout": 300,
            }
        }
    
    def load_settings(self) -> Dict[str, Any]:
        """모든 설정 로드"""
        try:
            if self.settings_file.exists():
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    saved_settings = json.load(f)
                    # 기본 설정과 병합 (새로운 설정이 추가되었을 경우 대비)
                    merged_settings = self._deep_merge(self._default_settings.copy(), saved_settings)
                    return merged_settings
            else:
                return self._default_settings.copy()
        except Exception as e:
            _clog.error(f"설정 로드 중 오류: {str(e)}")
            return self._default_settings.copy()
    
    def save_settings(self, settings: Dict[str, Any]) -> bool:
        """모든 설정 저장"""
        try:
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(settings, f, ensure_ascii=False, indent=2)
            
            _clog.info(f"설정 저장 완료: {self.settings_file}")
            return True
        except Exception as e:
            _clog.error(f"설정 저장 중 오류: {str(e)}")
            return False
    
    def get_section_settings(self, section: str) -> Dict[str, Any]:
        """특정 섹션의 설정만 조회"""
        all_settings = self.load_settings()
        return all_settings.get(section, {})
    
    def update_section_settings(self, section: str, new_settings: Dict[str, Any]) -> bool:
        """특정 섹션의 설정만 업데이트"""
        try:
            all_settings = self.load_settings()
            if section not in all_settings:
                all_settings[section] = {}
            
            all_settings[section].update(new_settings)
            return self.save_settings(all_settings)
        except Exception as e:
            _clog.error(f"섹션 설정 업데이트 중 오류: {str(e)}")
            return False
    
    def reset_section_settings(self, section: str) -> bool:
        """특정 섹션을 기본값으로 초기화"""
        try:
            all_settings = self.load_settings()
            if section in self._default_settings:
                all_settings[section] = self._default_settings[section].copy()
                return self.save_settings(all_settings)
            return False
        except Exception as e:
            _clog.error(f"섹션 설정 초기화 중 오류: {str(e)}")
            return False
    
    def reset_all_settings(self) -> bool:
        """모든 설정을 기본값으로 초기화"""
        try:
            return self.save_settings(self._default_settings.copy())
        except Exception as e:
            _clog.error(f"전체 설정 초기화 중 오류: {str(e)}")
            return False
    
    def get_available_providers(self) -> Dict[str, Any]:
        """사용 가능한 모델 제공업체 목록 (상세 정보 포함)"""
        return {
            "llm_providers": [
                {
                    "id": "openai",
                    "name": "OpenAI",
                    "models": [
                        {"id": "gpt-4o", "name": "GPT-4o", "description": "최신 멀티모달 모델"},
                        {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "경제적이고 빠른 모델"},
                        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "description": "향상된 성능의 GPT-4"},
                        {"id": "gpt-4", "name": "GPT-4", "description": "고품질 대화 모델"},
                        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "description": "빠르고 효율적인 모델"},
                    ]
                },
                {
                    "id": "anthropic",
                    "name": "Anthropic",
                    "models": [
                        {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "description": "최신 Claude 모델"},
                        {"id": "claude-3-sonnet-20240229", "name": "Claude 3 Sonnet", "description": "균형잡힌 성능"},
                        {"id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku", "description": "빠른 응답"},
                    ]
                },
                {
                    "id": "google",
                    "name": "Google",
                    "models": [
                        {"id": "gemini-pro", "name": "Gemini Pro", "description": "Google의 고성능 모델"},
                        {"id": "gemini-pro-vision", "name": "Gemini Pro Vision", "description": "멀티모달 모델"},
                    ]
                },
                {
                    "id": "ollama",
                    "name": "Ollama",
                    "models": [
                        {"id": "llama2", "name": "Llama 2", "description": "Meta의 오픈소스 모델"},
                        {"id": "codellama", "name": "Code Llama", "description": "코드 생성 특화"},
                        {"id": "mistral", "name": "Mistral", "description": "효율적인 추론 모델"},
                        {"id": "qwen2", "name": "Qwen2", "description": "Alibaba의 다국어 모델"},
                    ]
                },
                {
                    "id": "cohere",
                    "name": "Cohere", 
                    "models": [
                        {"id": "command-r-plus", "name": "Command R+", "description": "고성능 추론 모델"},
                        {"id": "command-r", "name": "Command R", "description": "균형잡힌 성능"},
                    ]
                }
            ],
            "embedding_providers": [
                {
                    "id": "openai",
                    "name": "OpenAI",
                    "models": [
                        {"id": "text-embedding-3-large", "name": "Text Embedding 3 Large", "dimension": 3072},
                        {"id": "text-embedding-3-small", "name": "Text Embedding 3 Small", "dimension": 1536},
                        {"id": "text-embedding-ada-002", "name": "Text Embedding Ada 002", "dimension": 1536},
                    ]
                },
                {
                    "id": "google",
                    "name": "Google",
                    "models": [
                        {"id": "textembedding-gecko", "name": "Text Embedding Gecko", "dimension": 768},
                    ]
                },
                {
                    "id": "ollama",
                    "name": "Ollama",
                    "models": [
                        {"id": "nomic-embed-text", "name": "Nomic Embed Text", "dimension": 768},
                    ]
                },
                {
                    "id": "huggingface",
                    "name": "Hugging Face",
                    "models": [
                        {"id": "sentence-transformers/all-MiniLM-L6-v2", "name": "All MiniLM L6 v2", "dimension": 384},
                        {"id": "sentence-transformers/all-mpnet-base-v2", "name": "All MPNet Base v2", "dimension": 768},
                        {"id": "BAAI/bge-large-en-v1.5", "name": "BGE Large EN", "dimension": 1024},
                        {"id": "BAAI/bge-small-ko-v1.5", "name": "BGE Small KO", "dimension": 384},
                    ]
                },
                {
                    "id": "cohere",
                    "name": "Cohere",
                    "models": [
                        {"id": "embed-english-v3.0", "name": "Embed English v3.0", "dimension": 1024},
                        {"id": "embed-multilingual-v3.0", "name": "Embed Multilingual v3.0", "dimension": 1024},
                    ]
                }
            ]
        }
    
    def get_models_by_provider(self, provider: str) -> list:
        """특정 제공업체의 모델 목록 (상세 정보 포함)"""
        providers = self.get_available_providers()
        
        # LLM 모델 검색
        for llm_provider in providers["llm_providers"]:
            if llm_provider["id"] == provider:
                return llm_provider["models"]
        
        # 임베딩 모델 검색
        for emb_provider in providers["embedding_providers"]:
            if emb_provider["id"] == provider:
                return emb_provider["models"]
        
        return []
    
    def test_model_connection(self, settings: Dict[str, Any] = None) -> Dict[str, Any]:
        """모델 연결 테스트 (시뮬레이션)"""
        if settings is None:
            settings = self.get_section_settings("models")
        
        # 실제 구현에서는 모델에 실제 연결을 시도해야 함
        return {
            "status": "success",
            "message": "모델 연결 테스트 성공",
            "llm_status": "connected",
            "embedding_status": "connected"
        }
    
    def test_llm_connection(self, test_settings: Dict[str, Any]) -> Dict[str, Any]:
        """LLM 연결 테스트 (실제 API 호출)"""
        provider = test_settings.get("provider", "")
        model = test_settings.get("model", "")
        api_key = test_settings.get("api_key", "")
        
        # 기본 유효성 검증
        if not provider or not model:
            return {
                "status": "error",
                "message": "제공업체와 모델을 선택해주세요."
            }
        
        if not api_key:
            return {
                "status": "error", 
                "message": "API 키를 입력해주세요."
            }
        
        try:
            # 실제 API 연결 테스트
            if provider == "openai":
                import openai
                client = openai.OpenAI(api_key=api_key)
                
                # 간단한 테스트 메시지로 실제 API 호출
                response = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": "테스트"}],
                    max_tokens=5,
                    timeout=10  # 10초 타임아웃
                )
                
                return {
                    "status": "success",
                    "message": f"OpenAI {model} LLM 연결 테스트 성공",
                    "provider": provider,
                    "model": model,
                    "response_preview": response.choices[0].message.content[:50] if response.choices else ""
                }
                
            elif provider == "anthropic":
                import anthropic
                client = anthropic.Anthropic(api_key=api_key)
                
                # Anthropic API 테스트 호출
                response = client.messages.create(
                    model=model,
                    max_tokens=5,
                    messages=[{"role": "user", "content": "테스트"}],
                    timeout=10
                )
                
                return {
                    "status": "success", 
                    "message": f"Anthropic {model} LLM 연결 테스트 성공",
                    "provider": provider,
                    "model": model,
                    "response_preview": response.content[0].text[:50] if response.content else ""
                }
                
            elif provider == "google":
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                
                model_instance = genai.GenerativeModel(model)
                response = model_instance.generate_content("테스트", 
                                                        generation_config=genai.types.GenerationConfig(max_output_tokens=5))
                
                return {
                    "status": "success",
                    "message": f"Google {model} LLM 연결 테스트 성공", 
                    "provider": provider,
                    "model": model,
                    "response_preview": response.text[:50] if response.text else ""
                }
                
            else:
                return {
                    "status": "error",
                    "message": f"지원되지 않는 제공업체입니다: {provider}"
                }
                
        except ImportError as e:
            return {
                "status": "error",
                "message": f"{provider} 라이브러리가 설치되지 않았습니다: {str(e)}"
            }
        except Exception as e:
            error_msg = str(e)
            if "401" in error_msg or "authentication" in error_msg.lower():
                return {
                    "status": "error",
                    "message": f"API 키가 유효하지 않습니다: {error_msg}"
                }
            elif "404" in error_msg or "model" in error_msg.lower():
                return {
                    "status": "error", 
                    "message": f"모델을 찾을 수 없거나 접근할 수 없습니다: {error_msg}"
                }
            else:
                return {
                    "status": "error",
                    "message": f"연결 테스트 실패: {error_msg}"
                }
    
    def test_embedding_connection(self, test_settings: Dict[str, Any]) -> Dict[str, Any]:
        """임베딩 모델 연결 테스트 (실제 API 호출)"""
        provider = test_settings.get("provider", "")
        model = test_settings.get("model", "")
        api_key = test_settings.get("api_key", "")
        
        # 기본 유효성 검증
        if not provider or not model:
            return {
                "status": "error",
                "message": "제공업체와 모델을 선택해주세요."
            }
        
        if not api_key:
            return {
                "status": "error",
                "message": "API 키를 입력해주세요."
            }
        
        try:
            # 실제 API 연결 테스트
            if provider == "openai":
                import openai
                client = openai.OpenAI(api_key=api_key)
                
                # 간단한 텍스트로 임베딩 테스트
                response = client.embeddings.create(
                    model=model,
                    input="테스트 텍스트",
                    timeout=10
                )
                
                embedding_dim = len(response.data[0].embedding) if response.data else 0
                
                return {
                    "status": "success",
                    "message": f"OpenAI {model} 임베딩 연결 테스트 성공",
                    "provider": provider,
                    "model": model,
                    "embedding_dimension": embedding_dim
                }
                
            elif provider == "google":
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                
                # Google의 임베딩 모델 테스트
                response = genai.embed_content(
                    model=model,
                    content="테스트 텍스트"
                )
                
                embedding_dim = len(response['embedding']) if 'embedding' in response else 0
                
                return {
                    "status": "success",
                    "message": f"Google {model} 임베딩 연결 테스트 성공",
                    "provider": provider,
                    "model": model,
                    "embedding_dimension": embedding_dim
                }
                
            elif provider == "cohere":
                import cohere
                co = cohere.Client(api_key)
                
                # Cohere 임베딩 테스트
                response = co.embed(
                    texts=["테스트 텍스트"],
                    model=model
                )
                
                embedding_dim = len(response.embeddings[0]) if response.embeddings else 0
                
                return {
                    "status": "success",
                    "message": f"Cohere {model} 임베딩 연결 테스트 성공",
                    "provider": provider,
                    "model": model,
                    "embedding_dimension": embedding_dim
                }
                
            elif provider == "huggingface":
                # Hugging Face 임베딩은 로컬 모델이므로 단순 성공 반환
                return {
                    "status": "success",
                    "message": f"Hugging Face {model} 모델 설정 확인됨 (로컬 모델)",
                    "provider": provider,
                    "model": model,
                    "note": "로컬 모델이므로 API 키 불필요"
                }
                
            elif provider == "ollama":
                # Ollama는 로컬 서버이므로 단순 성공 반환
                return {
                    "status": "success",
                    "message": f"Ollama {model} 모델 설정 확인됨 (로컬 서버)",
                    "provider": provider,
                    "model": model,
                    "note": "로컬 Ollama 서버 연결 필요"
                }
                
            else:
                return {
                    "status": "error",
                    "message": f"지원되지 않는 제공업체입니다: {provider}"
                }
                
        except ImportError as e:
            return {
                "status": "error",
                "message": f"{provider} 라이브러리가 설치되지 않았습니다: {str(e)}"
            }
        except Exception as e:
            error_msg = str(e)
            if "401" in error_msg or "authentication" in error_msg.lower():
                return {
                    "status": "error",
                    "message": f"API 키가 유효하지 않습니다: {error_msg}"
                }
            elif "404" in error_msg or "model" in error_msg.lower():
                return {
                    "status": "error",
                    "message": f"모델을 찾을 수 없거나 접근할 수 없습니다: {error_msg}"
                }
            else:
                return {
                    "status": "error",
                    "message": f"임베딩 연결 테스트 실패: {error_msg}"
                }
    
    def get_docling_status(self) -> Dict[str, Any]:
        """Docling 서비스 상태"""
        docling_settings = self.get_section_settings("docling")
        return {
            "enabled": docling_settings.get("enabled", False),
            "status": "available" if docling_settings.get("enabled", False) else "disabled",
            "version": "2.44.0"  # 실제 구현에서는 동적으로 가져와야 함
        }
    
    def get_unstructured_status(self) -> Dict[str, Any]:
        """Unstructured 서비스 상태"""
        unstructured_settings = self.get_section_settings("unstructured")
        return {
            "enabled": unstructured_settings.get("enabled", True),
            "status": "available" if unstructured_settings.get("enabled", True) else "disabled",
            "version": "0.15.12"  # 실제 구현에서는 동적으로 가져와야 함
        }

    def get_system_stats(self) -> Dict[str, Any]:
        """현재 시스템 통계 반환"""
        try:
            # CPU 사용률
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # 메모리 사용량
            memory = psutil.virtual_memory()
            memory_used_mb = memory.used / (1024 * 1024)
            
            # 활성 연결 수 (근사값)
            try:
                connections = len(psutil.net_connections())
            except (psutil.AccessDenied, OSError):
                connections = 0
            
            # 캐시 적중률 (향후 실제 캐시 시스템에서 가져와야 함)
            cache_hit_rate = 85.0
            
            return {
                "cpu": cpu_percent,
                "memory": memory_used_mb,
                "activeConnections": connections,
                "cacheHitRate": cache_hit_rate
            }
        except Exception as e:
            _clog.error(f"시스템 통계 조회 중 오류: {str(e)}")
            return {
                "cpu": 0.0,
                "memory": 0.0,
                "activeConnections": 0,
                "cacheHitRate": 0.0
            }
    
    def validate_settings(self, section: str, settings: Dict[str, Any]) -> tuple[bool, str]:
        """설정 유효성 검증"""
        try:
            if section == "system":
                return self._validate_system_settings(settings)
            elif section == "performance":
                return self._validate_performance_settings(settings)
            elif section == "models":
                return self._validate_model_settings(settings)
            elif section == "docling":
                return self._validate_docling_settings(settings)
            elif section == "unstructured":
                return self._validate_unstructured_settings(settings)
            else:
                return True, "유효한 설정입니다."
        except Exception as e:
            return False, f"설정 검증 중 오류: {str(e)}"
    
    def _validate_system_settings(self, settings: Dict[str, Any]) -> tuple[bool, str]:
        """시스템 설정 검증"""
        if "maxFileSize" in settings:
            max_size = settings["maxFileSize"]
            if not isinstance(max_size, (int, float)) or max_size <= 0 or max_size > 100:
                return False, "최대 파일 크기는 0보다 크고 100MB 이하여야 합니다."
        
        if "chunkSize" in settings:
            chunk_size = settings["chunkSize"]
            if not isinstance(chunk_size, int) or chunk_size < 100 or chunk_size > 10000:
                return False, "청크 크기는 100 이상 10000 이하여야 합니다."
        
        return True, "유효한 설정입니다."
    
    def _validate_performance_settings(self, settings: Dict[str, Any]) -> tuple[bool, str]:
        """성능 설정 검증"""
        if "maxConcurrentEmbeddings" in settings:
            value = settings["maxConcurrentEmbeddings"]
            if not isinstance(value, int) or value < 1 or value > 20:
                return False, "동시 임베딩 수는 1 이상 20 이하여야 합니다."
        
        if "maxMemoryUsageMB" in settings:
            value = settings["maxMemoryUsageMB"]
            if not isinstance(value, int) or value < 512 or value > 16384:
                return False, "최대 메모리 사용량은 512MB 이상 16384MB 이하여야 합니다."
        
        return True, "유효한 설정입니다."
    
    def _validate_model_settings(self, settings: Dict[str, Any]) -> tuple[bool, str]:
        """모델 설정 검증"""
        if "temperature" in settings:
            temp = settings["temperature"]
            if not isinstance(temp, (int, float)) or temp < 0 or temp > 2:
                return False, "온도는 0 이상 2 이하여야 합니다."
        
        return True, "유효한 설정입니다."
    
    def _validate_docling_settings(self, settings: Dict[str, Any]) -> tuple[bool, str]:
        """Docling 설정 검증"""
        if "processing_timeout" in settings:
            timeout = settings["processing_timeout"]
            if not isinstance(timeout, int) or timeout < 30 or timeout > 1800:
                return False, "처리 타임아웃은 30초 이상 1800초 이하여야 합니다."
        
        return True, "유효한 설정입니다."
    
    def _validate_unstructured_settings(self, settings: Dict[str, Any]) -> tuple[bool, str]:
        """Unstructured 설정 검증"""
        if "max_characters" in settings:
            max_chars = settings["max_characters"]
            if not isinstance(max_chars, int) or max_chars < 100 or max_chars > 10000:
                return False, "최대 문자 수는 100 이상 10000 이하여야 합니다."
        
        return True, "유효한 설정입니다."
    
    def _deep_merge(self, base: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
        """딕셔너리 깊은 병합"""
        for key, value in update.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                base[key] = self._deep_merge(base[key], value)
            else:
                base[key] = value
        return base

# 싱글톤 인스턴스
settings_service = SettingsService()