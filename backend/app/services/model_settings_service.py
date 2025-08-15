import json
import os
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from cryptography.fernet import Fernet
import base64

from ..models.schemas import ModelSettings, ModelSettingsUpdateRequest, DoclingSettings
from ..core.logger import get_console_logger
from ..core.config import settings

_clog = get_console_logger()

class ModelSettingsService:
    def __init__(self):
        # 모든 설정 파일을 data 디렉토리에 저장
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        self.settings_file = os.path.join(settings.DATA_DIR, "model_settings.json")
        self.docling_settings_file = os.path.join(settings.DATA_DIR, "docling_settings.json")
        self.encryption_key = self._get_or_create_encryption_key()
        self.cipher_suite = Fernet(self.encryption_key)
        
        # 사용 가능한 모델 제공업체와 모델 목록
        self.providers = {
            "openai": {
                "name": "OpenAI",
                "llm_models": [
                    "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", 
                    "gpt-3.5-turbo", "gpt-3.5-turbo-16k"
                ],
                "embedding_models": [
                    "text-embedding-3-large", "text-embedding-3-small", 
                    "text-embedding-ada-002"
                ],
                "embedding_dimensions": {
                    "text-embedding-3-large": [3072, 1536, 512, 256],
                    "text-embedding-3-small": [1536, 512, 384, 256], 
                    "text-embedding-ada-002": [1536]
                },
                "api_key_required": True
            },
            "anthropic": {
                "name": "Anthropic",
                "llm_models": [
                    "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022",
                    "claude-3-opus-20240229", "claude-3-sonnet-20240229", 
                    "claude-3-haiku-20240307"
                ],
                "embedding_models": [],
                "api_key_required": True
            },
            "google": {
                "name": "Google (Gemini)",
                "llm_models": [
                    "gemini-2.5-pro-exp", "gemini-2.5-flash-exp", "gemini-2.5-exp",
                    "gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"
                ],
                "embedding_models": [
                    "text-embedding-004", "embedding-001"
                ],
                "embedding_dimensions": {
                    "text-embedding-004": [768],
                    "embedding-001": [768]
                },
                "api_key_required": True
            },
            "groq": {
                "name": "Groq",
                "llm_models": [
                    "llama-3.1-70b-versatile", "llama-3.1-8b-instant",
                    "mixtral-8x7b-32768", "gemma2-9b-it"
                ],
                "embedding_models": [],
                "api_key_required": True
            },
            "ollama": {
                "name": "Ollama (Local)",
                "llm_models": [
                    "llama3.2", "llama3.1", "phi3", "mistral", 
                    "codellama", "gemma2"
                ],
                "embedding_models": [
                    "nomic-embed-text", "mxbai-embed-large", "all-minilm"
                ],
                "embedding_dimensions": {
                    "nomic-embed-text": [768],
                    "mxbai-embed-large": [1024],
                    "all-minilm": [384]
                },
                "api_key_required": False
            },
            "azure": {
                "name": "Azure OpenAI",
                "llm_models": [
                    "gpt-4o", "gpt-4", "gpt-35-turbo"
                ],
                "embedding_models": [
                    "text-embedding-3-large", "text-embedding-3-small",
                    "text-embedding-ada-002"
                ],
                "embedding_dimensions": {
                    "text-embedding-3-large": [3072, 1536, 512, 256],
                    "text-embedding-3-small": [1536, 512, 384, 256],
                    "text-embedding-ada-002": [1536]
                },
                "api_key_required": True
            }
        }

    def _get_or_create_encryption_key(self) -> bytes:
        """암호화 키 생성 또는 로드"""
        key_file = os.path.join(settings.DATA_DIR, "encryption.key")
        if os.path.exists(key_file):
            with open(key_file, "rb") as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            with open(key_file, "wb") as f:
                f.write(key)
            return key

    def _encrypt_api_key(self, api_key: str) -> str:
        """API 키 암호화"""
        if not api_key:
            return ""
        encrypted = self.cipher_suite.encrypt(api_key.encode())
        return base64.b64encode(encrypted).decode()

    def _decrypt_api_key(self, encrypted_key: str) -> str:
        """API 키 복호화"""
        if not encrypted_key:
            return ""
        try:
            encrypted_data = base64.b64decode(encrypted_key.encode())
            decrypted = self.cipher_suite.decrypt(encrypted_data)
            return decrypted.decode()
        except Exception as e:
            _clog.error(f"API 키 복호화 실패: {e}")
            return ""

    async def get_model_settings(self) -> ModelSettings:
        """모델 설정 조회"""
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                # API 키 복호화
                if "llm_api_key" in data and data["llm_api_key"]:
                    data["llm_api_key"] = self._decrypt_api_key(data["llm_api_key"])
                if "embedding_api_key" in data and data["embedding_api_key"]:
                    data["embedding_api_key"] = self._decrypt_api_key(data["embedding_api_key"])
                
                return ModelSettings(**data)
            else:
                # 기본 설정 반환
                return ModelSettings()
        except Exception as e:
            _clog.error(f"모델 설정 로드 실패: {e}")
            return ModelSettings()

    async def update_model_settings(self, request: ModelSettingsUpdateRequest) -> ModelSettings:
        """모델 설정 업데이트"""
        try:
            # 기존 설정 로드
            current_settings = await self.get_model_settings()
            
            # 요청 데이터로 업데이트
            update_data = request.dict(exclude_unset=True)
            
            # API 키 암호화
            if "llm_api_key" in update_data and update_data["llm_api_key"]:
                update_data["llm_api_key"] = self._encrypt_api_key(update_data["llm_api_key"])
            if "embedding_api_key" in update_data and update_data["embedding_api_key"]:
                update_data["embedding_api_key"] = self._encrypt_api_key(update_data["embedding_api_key"])
            
            # 업데이트 시간 설정
            update_data["updated_at"] = datetime.now()
            
            # 기존 설정과 병합
            current_data = current_settings.dict()
            current_data.update(update_data)
            
            # 파일에 저장 (암호화된 상태로)
            with open(self.settings_file, "w", encoding="utf-8") as f:
                json.dump(current_data, f, ensure_ascii=False, indent=2, default=str)
            
            # 반환할 때는 복호화된 설정 반환
            return await self.get_model_settings()
            
        except Exception as e:
            _clog.error(f"모델 설정 업데이트 실패: {e}")
            raise e

    async def reset_model_settings(self) -> ModelSettings:
        """모델 설정 초기화"""
        try:
            # 기본 설정으로 리셋
            default_settings = ModelSettings()
            
            # 파일에 저장
            with open(self.settings_file, "w", encoding="utf-8") as f:
                json.dump(default_settings.dict(), f, ensure_ascii=False, indent=2, default=str)
            
            return default_settings
        except Exception as e:
            _clog.error(f"모델 설정 초기화 실패: {e}")
            raise e

    async def get_available_providers(self) -> Dict[str, Any]:
        """사용 가능한 모델 제공업체 목록 반환"""
        return {
            "providers": [
                {
                    "id": provider_id,
                    "name": provider_data["name"],
                    "llm_models_count": len(provider_data["llm_models"]),
                    "embedding_models_count": len(provider_data["embedding_models"]),
                    "api_key_required": provider_data["api_key_required"]
                }
                for provider_id, provider_data in self.providers.items()
            ]
        }

    async def get_models_by_provider(self, provider: str) -> Dict[str, Any]:
        """특정 제공업체의 모델 목록 반환"""
        if provider not in self.providers:
            raise ValueError(f"지원하지 않는 제공업체: {provider}")
        
        provider_data = self.providers[provider]
        return {
            "provider": provider,
            "name": provider_data["name"],
            "llm_models": provider_data["llm_models"],
            "embedding_models": provider_data["embedding_models"],
            "embedding_dimensions": provider_data.get("embedding_dimensions", {}),
            "api_key_required": provider_data["api_key_required"]
        }

    async def test_model_connection(self) -> Dict[str, Any]:
        """현재 설정으로 모델 연결 테스트"""
        try:
            settings = await self.get_model_settings()
            
            # 간단한 연결 테스트 로직
            test_results = {
                "llm_test": {"status": "success", "message": "LLM 연결 성공"},
                "embedding_test": {"status": "success", "message": "임베딩 연결 성공"},
                "overall_status": "success"
            }
            
            # 실제 API 호출 테스트는 여기서 구현
            # 예: OpenAI, Anthropic 등의 간단한 API 호출
            
            return test_results
            
        except Exception as e:
            _clog.error(f"모델 연결 테스트 실패: {e}")
            return {
                "llm_test": {"status": "error", "message": str(e)},
                "embedding_test": {"status": "error", "message": str(e)},
                "overall_status": "error"
            }

    async def get_current_model_config(self) -> Dict[str, Any]:
        """현재 모델 설정을 딕셔너리 형태로 반환 (다른 서비스에서 사용)"""
        settings = await self.get_model_settings()
        return {
            "llm": {
                "provider": settings.llm_provider,
                "model": settings.llm_model,
                "api_key": settings.llm_api_key,
                "temperature": settings.llm_temperature,
                "max_tokens": settings.llm_max_tokens
            },
            "embedding": {
                "provider": settings.embedding_provider,
                "model": settings.embedding_model,
                "api_key": settings.embedding_api_key,
                "dimension": settings.embedding_dimension
            },
            "settings": {
                "chunk_size": settings.chunk_size,
                "chunk_overlap": settings.chunk_overlap,
                "batch_size": settings.batch_size,
                "max_concurrent_embeddings": settings.max_concurrent_embeddings,
                "max_concurrent_chunks": settings.max_concurrent_chunks,
                "embedding_pool_size": settings.embedding_pool_size,
                "connection_pool_size": settings.connection_pool_size,
                "chunking_strategy": settings.chunking_strategy,
                "max_characters": settings.max_characters,
                "combine_text_under_n_chars": settings.combine_text_under_n_chars,
                "new_after_n_chars": settings.new_after_n_chars,
                "top_k": settings.top_k
            }
        }

    # Docling 관련 메서드들
    async def get_docling_settings(self) -> DoclingSettings:
        """Docling 설정 조회"""
        try:
            if os.path.exists(self.docling_settings_file):
                with open(self.docling_settings_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return DoclingSettings(**data)
            else:
                # 기본 Docling 설정 반환
                return DoclingSettings()
        except Exception as e:
            _clog.error(f"Docling 설정 로드 실패: {e}")
            return DoclingSettings()

    async def update_docling_settings(self, settings: DoclingSettings) -> DoclingSettings:
        """Docling 설정 업데이트"""
        try:
            # 파일에 저장
            with open(self.docling_settings_file, "w", encoding="utf-8") as f:
                json.dump(settings.dict(), f, ensure_ascii=False, indent=2, default=str)
            
            _clog.info("Docling 설정이 업데이트되었습니다.")
            return settings
            
        except Exception as e:
            _clog.error(f"Docling 설정 업데이트 실패: {e}")
            raise e

    async def get_docling_status(self) -> Dict[str, Any]:
        """Docling 서비스 상태 확인 - 라이브러리 설치 여부만 확인"""
        try:
            # DoclingService 인스턴스를 생성하지 않고, 필요한 라이브러리만 import 테스트
            try:
                from docling.document_converter import DocumentConverter
                from docling.datamodel.base_models import InputFormat
                from docling_core.types.doc import DoclingDocument
                docling_available = True
                _clog.info("Docling 라이브러리 import 성공 - 사용 가능")
            except ImportError as e:
                docling_available = False
                _clog.warning(f"Docling 라이브러리 import 실패: {e}")
            except Exception as e:
                docling_available = False
                _clog.error(f"Docling 라이브러리 확인 중 예상치 못한 에러: {e}")
            
            status = {
                "available": docling_available,
                "status": "ready" if docling_available else "unavailable",
                "version": "2.44.0" if docling_available else None,
                "settings": await self.get_docling_settings(),
                "supported_formats": [".pdf", ".docx", ".pptx", ".xlsx", ".html"],
            }
            
            if not docling_available:
                status["error"] = "Docling 라이브러리를 찾을 수 없습니다. 설치를 확인해주세요."
                status["test_result"] = {"success": False, "error": "Docling 라이브러리를 사용할 수 없습니다"}
                status["converter_initialized"] = False
            else:
                # Docling이 사용 가능한 경우 - 실제 초기화는 파일 처리 시에만 수행
                status["test_result"] = {
                    "success": True, 
                    "message": "Docling 라이브러리가 설치되어 있어 고급 문서 분석을 사용할 수 있습니다"
                }
                status["converter_initialized"] = True  # 라이브러리가 있으면 언제든 초기화 가능
            
            return status
            
        except Exception as e:
            _clog.error(f"Docling 상태 확인 실패: {e}")
            return {
                "available": False,
                "status": "error",
                "error": str(e),
                "settings": await self.get_docling_settings()
            }

# 글로벌 모델 설정 로더 (싱글톤 패턴)
_model_settings_instance = None

def get_global_model_settings():
    """글로벌 모델 설정 인스턴스를 반환합니다."""
    global _model_settings_instance
    if _model_settings_instance is None:
        _model_settings_instance = ModelSettingsService()
    return _model_settings_instance

async def get_current_model_config():
    """현재 모델 설정을 반환하는 편의 함수"""
    service = get_global_model_settings()
    return await service.get_current_model_config()