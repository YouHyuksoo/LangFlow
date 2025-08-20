"""
PRD3: AI 기반 청킹 서비스
LLM에게 문서를 보내서 JSON 형태로 청킹 기준을 받아 지능형 청킹 수행
"""

import os
import json
import re
import uuid
import time
import logging
import asyncio
import base64
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from .chunking_service import ChunkProposal, ChunkingRules, QualityWarning, ChunkQualityIssue
from .settings_service import settings_service

logger = logging.getLogger(__name__)


class AIProvider(str, Enum):
    """AI 제공업체"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    UPSTAGE = "upstage"
    GOOGLE = "google"


@dataclass
class AIChunkingOptions:
    """AI 청킹 옵션"""
    provider: AIProvider = AIProvider.OPENAI
    model: str = "gpt-4o-mini"
    max_tokens: int = 800
    min_tokens: int = 200
    overlap_tokens: int = 80
    respect_headings: bool = True
    snap_to_sentence: bool = True
    hard_sentence_max_tokens: int = 400
    temperature: float = 0.1
    max_retries: int = 2
    use_multimodal: bool = False
    pdf_file_path: Optional[str] = None


@dataclass
class AIChunkItem:
    """AI가 제안한 청크 아이템"""
    order: int
    text: str
    heading_path: Optional[List[str]] = None
    reasoning: Optional[str] = None  # AI의 청킹 이유


class AIChunkingService:
    """AI 기반 청킹 서비스"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        # 하드코딩된 시스템 프롬프트 제거 - 모델 프로필에서 관리
    
    def _convert_pdf_to_images(self, pdf_path: str, max_pages: int = 10) -> List[str]:
        """PDF를 이미지로 변환하여 base64 인코딩된 문자열 목록 반환"""
        try:
            import fitz  # PyMuPDF
            
            if not os.path.exists(pdf_path):
                raise FileNotFoundError(f"PDF 파일을 찾을 수 없습니다: {pdf_path}")
            
            doc = fitz.open(pdf_path)
            images = []
            
            # 최대 페이지 수 제한 (토큰 및 비용 제한)
            num_pages = min(len(doc), max_pages)
            
            for page_num in range(num_pages):
                page = doc[page_num]
                
                # 고해상도로 렌더링 (DPI 150)
                mat = fitz.Matrix(150/72, 150/72)  # 150 DPI
                pix = page.get_pixmap(matrix=mat)
                
                # PNG 바이트로 변환
                img_data = pix.tobytes("png")
                
                # base64 인코딩
                img_base64 = base64.b64encode(img_data).decode('utf-8')
                images.append(img_base64)
                
                self.logger.info(f"PDF 페이지 {page_num + 1}/{num_pages} 변환 완료")
            
            doc.close()
            
            self.logger.info(f"PDF 변환 완료: {len(images)}개 페이지")
            return images
            
        except ImportError:
            raise RuntimeError("PyMuPDF (fitz) 패키지가 설치되지 않았습니다. 'pip install PyMuPDF'로 설치하세요.")
        except Exception as e:
            self.logger.error(f"PDF → 이미지 변환 실패: {e}")
            raise RuntimeError(f"PDF 변환 실패: {e}")

    def _get_user_prompt(self, text: str, options: AIChunkingOptions) -> str:
        """사용자 프롬프트 생성"""
        return f"""Analyze this document and create optimal chunks for RAG retrieval.

CONSTRAINTS:
- max_tokens per chunk: {options.max_tokens}
- min_tokens per chunk: {options.min_tokens}
- overlap_tokens between chunks: {options.overlap_tokens}
- respect_headings: {options.respect_headings}
- snap_to_sentence: {options.snap_to_sentence}
- hard_sentence_max_tokens: {options.hard_sentence_max_tokens}

If a single sentence exceeds hard_sentence_max_tokens, split it safely.
Add overlap by including the tail of previous chunk in the next chunk.
Focus on semantic coherence and retrieval quality.

DOCUMENT:
\"\"\"
{text[:20000]}  # 토큰 제한을 위해 처음 20k 문자만
\"\"\""""

    def _get_multimodal_user_prompt(self, text: str, options: AIChunkingOptions) -> str:
        """멀티모달 사용자 프롬프트 생성"""
        return f"""Analyze both the visual document pages (images) and the extracted text below to create optimal chunks for RAG retrieval.

MULTIMODAL ANALYSIS INSTRUCTIONS:
- Examine the visual layout, structure, and formatting from the images
- Cross-reference with the extracted text for accurate content understanding
- Identify visual elements like headers, sections, tables, figures, and their hierarchy
- Preserve semantic relationships between visual and textual elements
- Consider page boundaries and visual flow when creating chunks

CONSTRAINTS:
- max_tokens per chunk: {options.max_tokens}
- min_tokens per chunk: {options.min_tokens}
- overlap_tokens between chunks: {options.overlap_tokens}
- respect_headings: {options.respect_headings}
- snap_to_sentence: {options.snap_to_sentence}
- hard_sentence_max_tokens: {options.hard_sentence_max_tokens}

Use the visual context to enhance chunking decisions. If images show clear structural divisions, respect them.
Focus on creating chunks that maintain both visual and semantic coherence for optimal retrieval.

EXTRACTED TEXT:
\"\"\"
{text[:20000]}  # 토큰 제한을 위해 처음 20k 문자만
\"\"\""""

    async def _call_llm(self, provider: AIProvider, model: str, system_prompt: str, user_prompt: str, temperature: float = 0.1, api_key: str = None, images: Optional[List[str]] = None) -> str:
        """LLM API 호출 (멀티모달 지원)"""
        try:
            if provider == AIProvider.OPENAI:
                return await self._call_openai(model, system_prompt, user_prompt, temperature, api_key, images)
            elif provider == AIProvider.ANTHROPIC:
                return await self._call_anthropic(model, system_prompt, user_prompt, temperature, api_key, images)
            elif provider == AIProvider.UPSTAGE:
                return await self._call_upstage(model, system_prompt, user_prompt, temperature, api_key, images)
            elif provider == AIProvider.GOOGLE:
                return await self._call_google(model, system_prompt, user_prompt, temperature, api_key, images)
            else:
                raise ValueError(f"지원하지 않는 AI 제공업체: {provider}")
        except Exception as e:
            self.logger.error(f"LLM 호출 실패 ({provider}): {e}")
            raise

    async def _call_openai(self, model: str, system_prompt: str, user_prompt: str, temperature: float, api_key: str = None, images: Optional[List[str]] = None) -> str:
        """OpenAI API 호출 (멀티모달 지원)"""
        try:
            from openai import AsyncOpenAI
            
            # API 키 사용 (모델 프로필에서 전달된 키 우선 사용)
            if not api_key:
                # 폴백: 기존 설정 방식
                system_settings = settings_service.get_section_settings("system")
                api_key = system_settings.get("openai_api_key") or os.getenv("OPENAI_API_KEY")
            
            if not api_key:
                raise RuntimeError("OpenAI API 키가 설정되지 않았습니다. 모델 프로필에 API 키를 설정하거나 시스템 설정에서 openai_api_key를 추가하세요.")
            
            client = AsyncOpenAI(api_key=api_key)
            
            # 메시지 구성
            messages = [{"role": "system", "content": system_prompt}]
            
            if images and len(images) > 0:
                # 멀티모달 메시지 (이미지 + 텍스트)
                content = []
                
                # 이미지들 추가
                for i, img_base64 in enumerate(images[:5]):  # 최대 5개 이미지로 제한
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{img_base64}",
                            "detail": "high"  # 고해상도 분석
                        }
                    })
                    self.logger.info(f"이미지 {i+1}/{len(images[:5])} 추가됨")
                
                # 텍스트 프롬프트 추가
                content.append({
                    "type": "text",
                    "text": user_prompt
                })
                
                messages.append({
                    "role": "user", 
                    "content": content
                })
            else:
                # 텍스트만
                messages.append({"role": "user", "content": user_prompt})
            
            response = await client.chat.completions.create(
                model=model,
                temperature=temperature,
                messages=messages,
                max_tokens=4000
            )
            
            return response.choices[0].message.content or ""
            
        except Exception as e:
            self.logger.error(f"OpenAI API 호출 실패: {e}")
            raise RuntimeError(f"OpenAI API 호출 실패: {e}")

    async def _call_anthropic(self, model: str, system_prompt: str, user_prompt: str, temperature: float, api_key: str = None, images: Optional[List[str]] = None) -> str:
        """Anthropic (Claude) API 호출 (멀티모달 지원)"""
        try:
            import anthropic
            
            # API 키 사용 (모델 프로필에서 전달된 키 우선 사용)
            if not api_key:
                # 폴백: 기존 설정 방식
                system_settings = settings_service.get_section_settings("system")
                api_key = system_settings.get("anthropic_api_key") or os.getenv("ANTHROPIC_API_KEY")
            
            if not api_key:
                raise RuntimeError("Anthropic API 키가 설정되지 않았습니다. 모델 프로필에 API 키를 설정하거나 시스템 설정에서 anthropic_api_key를 추가하세요.")
            
            client = anthropic.AsyncAnthropic(api_key=api_key)
            
            if images and len(images) > 0:
                # 멀티모달 메시지 구성
                content = []
                
                # 이미지들 추가 (Claude는 최대 20개 이미지 지원)
                for i, img_base64 in enumerate(images[:10]):  # 최대 10개로 제한
                    content.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": img_base64
                        }
                    })
                    self.logger.info(f"Claude 이미지 {i+1}/{len(images[:10])} 추가됨")
                
                # 텍스트 프롬프트 추가
                content.append({
                    "type": "text",
                    "text": user_prompt
                })
                
                response = await client.messages.create(
                    model=model,
                    max_tokens=4000,
                    temperature=temperature,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": content}
                    ]
                )
            else:
                # 텍스트만
                response = await client.messages.create(
                    model=model,
                    max_tokens=4000,
                    temperature=temperature,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_prompt}
                    ]
                )
            
            return response.content[0].text
            
        except Exception as e:
            self.logger.error(f"Anthropic API 호출 실패: {e}")
            raise RuntimeError(f"Anthropic API 호출 실패: {e}")

    async def _call_upstage(self, model: str, system_prompt: str, user_prompt: str, temperature: float, api_key: str = None, images: Optional[List[str]] = None) -> str:
        """Upstage API 호출 (멀티모달 제한적 지원)"""
        try:
            import httpx
            
            # 멀티모달 이미지가 있는 경우 경고
            if images and len(images) > 0:
                self.logger.warning("Upstage Solar 모델은 현재 이미지를 지원하지 않습니다. 텍스트만 처리됩니다.")
            
            # API 키 사용 (모델 프로필에서 전달된 키 우선 사용)
            if not api_key:
                # 폴백: 기존 설정 방식
                system_settings = settings_service.get_section_settings("system")
                api_key = system_settings.get("upstage_api_key") or os.getenv("UPSTAGE_API_KEY")
            
            if not api_key:
                raise RuntimeError("Upstage API 키가 설정되지 않았습니다. 모델 프로필에 API 키를 설정하거나 시스템 설정에서 upstage_api_key를 추가하세요.")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.upstage.ai/v1/solar/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model,
                        "temperature": temperature,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ]
                    },
                    timeout=60.0
                )
                
                if response.status_code != 200:
                    raise RuntimeError(f"Upstage API HTTP {response.status_code}: {response.text}")
                
                data = response.json()
                return data["choices"][0]["message"]["content"]
                
        except Exception as e:
            self.logger.error(f"Upstage API 호출 실패: {e}")
            raise RuntimeError(f"Upstage API 호출 실패: {e}")

    async def _call_google(self, model: str, system_prompt: str, user_prompt: str, temperature: float, api_key: str = None, images: Optional[List[str]] = None) -> str:
        """Google Gemini API 호출 (멀티모달 지원)"""
        try:
            import google.generativeai as genai
            from PIL import Image
            import io
            
            # API 키 사용 (모델 프로필에서 전달된 키 우선 사용)
            if not api_key:
                # 폴백: 기존 설정 방식
                system_settings = settings_service.get_section_settings("system")
                api_key = system_settings.get("google_api_key") or os.getenv("GOOGLE_API_KEY")
            
            if not api_key:
                raise RuntimeError("Google API 키가 설정되지 않았습니다. 모델 프로필에 API 키를 설정하거나 시스템 설정에서 google_api_key를 추가하세요.")
            
            # Gemini API 설정
            genai.configure(api_key=api_key)
            model_instance = genai.GenerativeModel(model)
            
            # 시스템 프롬프트와 사용자 프롬프트 결합
            combined_prompt = f"{system_prompt}\n\n{user_prompt}"
            
            if images and len(images) > 0:
                # 멀티모달 컨텐츠 구성
                content_parts = [combined_prompt]
                
                # 이미지 처리 및 추가
                for i, img_base64 in enumerate(images[:8]):  # Gemini는 최대 20개 이미지 지원, 비용 고려해서 8개로 제한
                    try:
                        # base64를 PIL Image로 변환
                        img_bytes = base64.b64decode(img_base64)
                        img = Image.open(io.BytesIO(img_bytes))
                        
                        content_parts.append(img)
                        self.logger.info(f"Gemini 이미지 {i+1}/{len(images[:8])} 추가됨")
                    except Exception as img_error:
                        self.logger.warning(f"이미지 {i+1} 처리 실패: {img_error}")
                        continue
                
                response = await model_instance.generate_content_async(
                    content_parts,
                    generation_config=genai.types.GenerationConfig(
                        temperature=temperature,
                        max_output_tokens=8192,  # 더 긴 응답 허용
                    )
                )
            else:
                # 텍스트만
                response = await model_instance.generate_content_async(
                    combined_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=temperature,
                        max_output_tokens=8192,  # 더 긴 응답 허용
                    )
                )
            
            # 응답 안전 처리
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                self.logger.info(f"Gemini 응답 상태: finish_reason={candidate.finish_reason}")
                
                # finish_reason 확인
                if candidate.finish_reason == 1:  # STOP
                    if hasattr(candidate, 'content') and candidate.content and candidate.content.parts:
                        # parts가 있는 경우에만 텍스트 추출
                        text_parts = []
                        for part in candidate.content.parts:
                            if hasattr(part, 'text') and part.text:
                                text_parts.append(part.text)
                        if text_parts:
                            full_text = ''.join(text_parts)
                            self.logger.warning(f"Gemini 응답이 잘렸을 수 있습니다. 길이: {len(full_text)} 문자")
                            return full_text
                    
                    # parts가 없거나 비어있는 경우
                    self.logger.error("Gemini 응답이 완전히 비어있습니다 - 토큰 제한 초과 가능성")
                    raise RuntimeError("Gemini API 응답이 비어있습니다. 프롬프트가 너무 길거나 응답이 토큰 제한을 초과했을 수 있습니다.")
                
                # 정상 응답 처리
                return response.text if response.text else ""
            
            # 응답 자체가 없는 경우
            self.logger.error("Gemini API에서 유효하지 않은 응답을 받았습니다")
            raise RuntimeError("Gemini API 응답을 받지 못했습니다")
            
        except ImportError as ie:
            if "PIL" in str(ie):
                raise RuntimeError("이미지 처리를 위해 Pillow 패키지가 필요합니다. 'pip install Pillow'로 설치하세요.")
            raise
        except Exception as e:
            self.logger.error(f"Google API 호출 실패: {e}")
            raise RuntimeError(f"Google API 호출 실패: {e}")

    def _safe_json_parse(self, text: str) -> Dict[str, Any]:
        """JSON 안전 파싱 (LLM 응답에서 JSON 추출)"""
        try:
            # 먼저 전체 텍스트 파싱 시도
            return json.loads(text.strip())
        except json.JSONDecodeError:
            # JSON 블록 찾기 시도
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', text, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group(1))
                except json.JSONDecodeError:
                    pass
            
            # { ... } 패턴 찾기
            brace_match = re.search(r'\{.*\}', text, re.DOTALL)
            if brace_match:
                try:
                    return json.loads(brace_match.group())
                except json.JSONDecodeError:
                    pass
            
            raise ValueError(f"유효한 JSON을 찾을 수 없습니다: {text[:200]}...")

    def _validate_and_fix_chunks(self, chunks_data: List[Dict], options: AIChunkingOptions) -> List[AIChunkItem]:
        """청크 데이터 검증 및 수정"""
        validated_chunks = []
        
        for i, chunk_data in enumerate(chunks_data):
            try:
                # 필수 필드 확인
                text = chunk_data.get("text", "").strip()
                if not text:
                    self.logger.warning(f"청크 {i+1}: 빈 텍스트, 건너뜀")
                    continue
                
                order = chunk_data.get("order", i + 1)
                heading_path = chunk_data.get("heading_path")
                reasoning = chunk_data.get("reasoning")
                
                # 헤딩 경로 정리
                if heading_path and isinstance(heading_path, list):
                    heading_path = [str(h).strip() for h in heading_path if str(h).strip()]
                    if not heading_path:
                        heading_path = None
                else:
                    heading_path = None
                
                validated_chunks.append(AIChunkItem(
                    order=order,
                    text=text,
                    heading_path=heading_path,
                    reasoning=reasoning
                ))
                
            except Exception as e:
                self.logger.warning(f"청크 {i+1} 검증 실패: {e}")
                continue
        
        # 순서 재정렬
        for i, chunk in enumerate(validated_chunks, 1):
            chunk.order = i
        
        return validated_chunks

    def _apply_overlap(self, chunks: List[AIChunkItem], overlap_tokens: int) -> List[AIChunkItem]:
        """오버랩 적용"""
        if overlap_tokens <= 0 or len(chunks) <= 1:
            return chunks
        
        overlapped_chunks = []
        
        for i, chunk in enumerate(chunks):
            if i == 0:
                overlapped_chunks.append(chunk)
                continue
            
            # 이전 청크의 끝부분 추출
            prev_chunk = chunks[i - 1]
            prev_words = prev_chunk.text.split()
            
            # 대략적인 오버랩 단어 수 계산
            overlap_words = min(overlap_tokens, len(prev_words) // 2)
            if overlap_words > 0:
                overlap_text = " ".join(prev_words[-overlap_words:])
                
                # 현재 청크와 중복되지 않는 경우에만 추가
                if not chunk.text.startswith(overlap_text[:50]):
                    chunk.text = f"{overlap_text} {chunk.text}"
            
            overlapped_chunks.append(chunk)
        
        return overlapped_chunks

    def _convert_to_chunk_proposals(self, ai_chunks: List[AIChunkItem]) -> List[ChunkProposal]:
        """AI 청크를 ChunkProposal로 변환"""
        proposals = []
        
        for ai_chunk in ai_chunks:
            # 토큰 수 계산
            from .chunking_service import TokenCounter
            token_counter = TokenCounter()
            token_estimate = token_counter.count_tokens(ai_chunk.text)
            
            # 기본 품질 경고 생성
            warnings = []
            if len(ai_chunk.text.strip()) < 10:
                warnings.append(QualityWarning(
                    issue_type=ChunkQualityIssue.TOO_SHORT,
                    severity="warning",
                    message="청크가 매우 짧습니다",
                    suggestion="다른 청크와 병합을 고려하세요"
                ))
            
            proposal = ChunkProposal(
                chunk_id=str(uuid.uuid4()),
                order=ai_chunk.order,
                text=ai_chunk.text,
                token_estimate=token_estimate,
                heading_path=ai_chunk.heading_path,
                quality_warnings=warnings,
                created_at=datetime.now().isoformat()
            )
            
            # AI 추론 정보를 메타데이터로 저장
            if hasattr(proposal, 'metadata'):
                proposal.metadata = proposal.metadata or {}
                proposal.metadata['ai_reasoning'] = ai_chunk.reasoning
                proposal.metadata['ai_generated'] = True
            
            proposals.append(proposal)
        
        return proposals

    async def propose_chunks_with_ai(self, text: str, options: AIChunkingOptions, api_key: str = None, system_message: str = None) -> List[ChunkProposal]:
        """AI를 사용한 청킹 제안 (멀티모달 지원)"""
        mode = "멀티모달" if options.use_multimodal else "텍스트"
        self.logger.info(f"AI 청킹 시작 ({mode}) - 제공업체: {options.provider}, 모델: {options.model}")
        
        # 프롬프트 선택 (멀티모달 vs 텍스트)
        if options.use_multimodal:
            user_prompt = self._get_multimodal_user_prompt(text, options)
        else:
            user_prompt = self._get_user_prompt(text, options)
        
        # PDF → 이미지 변환 (멀티모달 모드)
        images = None
        if options.use_multimodal and options.pdf_file_path:
            try:
                self.logger.info(f"PDF 변환 시작: {options.pdf_file_path}")
                images = self._convert_pdf_to_images(options.pdf_file_path)
                self.logger.info(f"PDF 변환 완료: {len(images)}개 이미지")
            except Exception as img_error:
                self.logger.error(f"PDF → 이미지 변환 실패: {img_error}")
                # 멀티모달 실패 시 텍스트 모드로 폴백
                self.logger.warning("멀티모달 실패, 텍스트 모드로 폴백")
                user_prompt = self._get_user_prompt(text, options)
                images = None
        
        # 재시도 로직
        last_error = None
        for attempt in range(options.max_retries + 1):
            try:
                # LLM 호출 (API 키, 시스템 메시지, 이미지 포함)
                if not system_message:
                    raise RuntimeError("AI 청킹을 위한 시스템 메시지가 설정되지 않았습니다. 모델 프로필에서 'AI 청킹 시스템 메시지'를 설정하세요.")
                
                effective_system_prompt = system_message
                response = await self._call_llm(
                    options.provider,
                    options.model,
                    effective_system_prompt,
                    user_prompt,
                    options.temperature,
                    api_key,
                    images  # 멀티모달 이미지 추가
                )
                
                # JSON 파싱
                response_data = self._safe_json_parse(response)
                chunks_data = response_data.get("chunks", [])
                
                if not chunks_data:
                    raise ValueError("AI가 청크를 생성하지 않았습니다")
                
                # 청크 검증 및 변환
                ai_chunks = self._validate_and_fix_chunks(chunks_data, options)
                if not ai_chunks:
                    raise ValueError("유효한 청크가 없습니다")
                
                # 오버랩 적용
                ai_chunks = self._apply_overlap(ai_chunks, options.overlap_tokens)
                
                # ChunkProposal로 변환
                proposals = self._convert_to_chunk_proposals(ai_chunks)
                
                self.logger.info(f"AI 청킹 성공 - {len(proposals)}개 청크 생성 (시도: {attempt + 1})")
                return proposals
                
            except Exception as e:
                last_error = e
                self.logger.warning(f"AI 청킹 시도 {attempt + 1} 실패: {e}")
                
                if attempt < options.max_retries:
                    await asyncio.sleep(1.0)  # 재시도 전 대기
                    continue
        
        # 모든 재시도 실패 시 폴백
        self.logger.error(f"AI 청킹 완전 실패: {last_error}")
        raise RuntimeError(f"AI 청킹 실패: {last_error}")

    async def propose_chunks_with_fallback(self, text: str, options: AIChunkingOptions, api_key: str = None, system_message: str = None) -> Tuple[List[ChunkProposal], bool]:
        """AI 청킹 + 폴백 (기존 알고리즘)"""
        try:
            # 1차: AI 청킹 시도
            proposals = await self.propose_chunks_with_ai(text, options, api_key, system_message)
            return proposals, False  # AI 성공
            
        except Exception as ai_error:
            self.logger.warning(f"AI 청킹 실패, 폴백 모드로 전환: {ai_error}")
            
            # 2차: 기존 알고리즘 폴백
            try:
                from .chunking_service import chunking_service, ChunkingRules
                
                rules = ChunkingRules(
                    max_tokens=options.max_tokens,
                    min_tokens=options.min_tokens,
                    overlap_tokens=options.overlap_tokens,
                    respect_headings=options.respect_headings,
                    snap_to_sentence=options.snap_to_sentence,
                    hard_sentence_max_tokens=options.hard_sentence_max_tokens
                )
                
                proposals = chunking_service.propose_chunks(text, rules, use_hierarchical=True)
                
                # 폴백 표시를 위한 경고 추가
                for proposal in proposals:
                    if not proposal.quality_warnings:
                        proposal.quality_warnings = []
                    proposal.quality_warnings.append(QualityWarning(
                        issue_type=ChunkQualityIssue.NO_CONTENT,  # 임시 타입
                        severity="info",
                        message="AI 청킹 실패로 알고리즘 폴백 사용",
                        suggestion="AI 모델 설정을 확인하세요"
                    ))
                
                self.logger.info(f"폴백 청킹 성공 - {len(proposals)}개 청크 생성")
                return proposals, True  # 폴백 성공
                
            except Exception as fallback_error:
                self.logger.error(f"폴백 청킹도 실패: {fallback_error}")
                raise RuntimeError(f"AI 청킹 및 폴백 모두 실패: AI={ai_error}, Fallback={fallback_error}")


# 전역 서비스 인스턴스
ai_chunking_service = AIChunkingService()