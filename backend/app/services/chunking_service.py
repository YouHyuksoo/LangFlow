"""
PRD 방식 사용자 개입형 청킹 서비스
자동 제안 → 사용자 편집/확정 → 임베딩/저장 파이프라인
"""

import re
import uuid
import json
import math
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict, field
from datetime import datetime
from enum import Enum
import logging
from collections import Counter

# 콘솔 로거 사용을 위한 import 추가 시도
try:
    from ..core.logger import get_console_logger
    logger = get_console_logger()
except ImportError:
    logger = logging.getLogger(__name__)


class ChunkQualityIssue(str, Enum):
    """청크 품질 이슈 타입"""
    TOO_LONG = "too_long"           # 너무 긴 청크
    TOO_SHORT = "too_short"         # 너무 짧은 청크
    HEADING_SPLIT = "heading_split"  # 헤딩이 분할됨
    HEADING_BOUNDARY = "heading_boundary"  # 헤딩 경계 위반
    TABLE_SPLIT = "table_split"     # 표가 분할됨
    LIST_SPLIT = "list_split"       # 목록이 분할됨
    NO_CONTENT = "no_content"       # 내용 없음
    DUPLICATE_CONTENT = "duplicate_content"  # 중복 의심 콘텐츠
    ISOLATED_CAPTION = "isolated_caption"   # 고립된 캡션


@dataclass
class ChunkingRules:
    """청킹 규칙 설정 (중앙 집중 설정 기반)"""
    # 공통 규칙
    max_tokens: int = 800
    min_tokens: int = 200
    overlap_tokens: int = 80
    hard_sentence_max_tokens: int = 1000  # 강제 분절 임계값
    respect_headings: bool = True
    preserve_tables: bool = True
    preserve_lists: bool = True
    drop_short_chunks: bool = False
    
    # 문장 분할 방법 선택
    sentence_splitter: str = "kss"  # "kss", "kiwi", "regex", "recursive"
    
    # KSS 전용 옵션 (Python KSS 6.0.5 호환)
    kss_backend: str = "punct"  # 분석 백엔드: 'mecab', 'pecab', 'punct', 'fast' (pecab overflow 이슈로 punct 기본)
    kss_num_workers: int = 1  # 멀티프로세싱 워커 수
    kss_strip: bool = True  # 문장 양끝 공백 제거
    kss_return_morphemes: bool = False  # 형태소 반환 여부 (True시 복잡한 구조 반환)
    kss_ignores: List[str] = field(default_factory=list)  # 무시할 문자열 리스트
    
    # Kiwi 전용 옵션
    kiwi_model_path: str = ""
    kiwi_integrate_allomorph: bool = True
    kiwi_load_default_dict: bool = True
    kiwi_max_unk_form_len: int = 8
    
    # 정규식 전용 옵션
    regex_sentence_endings: str = "[.!?]"
    regex_preserve_abbreviations: bool = True
    regex_custom_patterns: List[str] = field(default_factory=list)
    
    # RecursiveCharacterTextSplitter 전용 옵션
    recursive_separators: List[str] = field(default_factory=lambda: ["\n\n", "\n", " ", ""])
    recursive_keep_separator: bool = False
    recursive_is_separator_regex: bool = False
    
    # 품질 및 중복 검사 설정
    enable_quality_check: bool = True
    enable_duplicate_check: bool = True
    similarity_threshold: float = 0.95
    word_overlap_threshold: float = 0.85
    
    # 이미지 처리 설정 (PDF용)
    enable_image_extraction: bool = False
    max_image_distance: float = 100.0
    max_images_per_chunk: int = 3
    
    # 감사 메타데이터
    created_at: Optional[str] = None
    version: str = "2.0"
    
    @classmethod
    def from_settings(cls, settings: Dict[str, Any]) -> 'ChunkingRules':
        """중앙 집중 설정에서 청킹 규칙 생성"""
        from ..services.settings_service import settings_service
        
        # manual_preprocessing 설정 로드
        manual_settings = settings_service.get_section_settings("manual_preprocessing")
        
        # 설정값들을 ChunkingRules로 변환
        return cls(
            max_tokens=manual_settings.get("max_tokens", 800),
            min_tokens=manual_settings.get("min_tokens", 200), 
            overlap_tokens=manual_settings.get("overlap_tokens", 80),
            hard_sentence_max_tokens=manual_settings.get("hard_sentence_max_tokens", 1000),
            respect_headings=manual_settings.get("respect_headings", True),
            preserve_tables=manual_settings.get("preserve_tables", True),
            preserve_lists=manual_settings.get("preserve_lists", True),
            drop_short_chunks=manual_settings.get("drop_short_chunks", False),
            sentence_splitter=manual_settings.get("default_sentence_splitter", "kss"),
            kss_backend=manual_settings.get("kss_backend", "punct"),
            kss_num_workers=manual_settings.get("kss_num_workers", 1),
            kss_strip=manual_settings.get("kss_strip", True),
            kss_return_morphemes=manual_settings.get("kss_return_morphemes", False),
            kss_ignores=manual_settings.get("kss_ignores", []),
            kiwi_model_path=manual_settings.get("kiwi_model_path", ""),
            kiwi_integrate_allomorph=manual_settings.get("kiwi_integrate_allomorph", True),
            kiwi_load_default_dict=manual_settings.get("kiwi_load_default_dict", True),
            kiwi_max_unk_form_len=manual_settings.get("kiwi_max_unk_form_len", 8),
            regex_sentence_endings=manual_settings.get("regex_sentence_endings", "[.!?]"),
            regex_preserve_abbreviations=manual_settings.get("regex_preserve_abbreviations", True),
            regex_custom_patterns=manual_settings.get("regex_custom_patterns", []),
            recursive_separators=manual_settings.get("recursive_separators", ["\n\n", "\n", " ", ""]),
            recursive_keep_separator=manual_settings.get("recursive_keep_separator", False),
            recursive_is_separator_regex=manual_settings.get("recursive_is_separator_regex", False),
            enable_quality_check=manual_settings.get("enable_quality_check", True),
            enable_duplicate_check=manual_settings.get("enable_duplicate_check", True),
            similarity_threshold=manual_settings.get("similarity_threshold", 0.95),
            word_overlap_threshold=manual_settings.get("word_overlap_threshold", 0.85),
            enable_image_extraction=manual_settings.get("enable_image_extraction", False),
            max_image_distance=manual_settings.get("max_image_distance", 100.0),
            max_images_per_chunk=manual_settings.get("max_images_per_chunk", 3),
            created_at=datetime.now().isoformat(),
            version="2.1"
        )
    
    def to_audit_snapshot(self) -> Dict[str, Any]:
        """감사용 스냅샷 생성"""
        return {
            "rules": asdict(self),
            "timestamp": datetime.now().isoformat(),
            "version": self.version
        }


@dataclass
class QualityWarning:
    """품질 경고"""
    issue_type: ChunkQualityIssue
    severity: str  # "warning", "error"
    message: str
    suggestion: Optional[str] = None


@dataclass
class BBox:
    """문서 내 영역 좌표 (프로덕션 개선 - 이미지-텍스트 연관성)"""
    x0: float  # 좌측 x 좌표
    y0: float  # 하단 y 좌표 (PDF 좌표계)
    x1: float  # 우측 x 좌표 
    y1: float  # 상단 y 좌표 (PDF 좌표계)
    page: int  # 페이지 번호 (0부터 시작)
    
    @property
    def width(self) -> float:
        return self.x1 - self.x0
    
    @property
    def height(self) -> float:
        return self.y1 - self.y0
    
    @property
    def center_x(self) -> float:
        return (self.x0 + self.x1) / 2
    
    @property
    def center_y(self) -> float:
        return (self.y0 + self.y1) / 2
    
    def distance_to(self, other: 'BBox') -> float:
        """다른 bbox와의 중심점 거리"""
        if self.page != other.page:
            return float('inf')  # 다른 페이지는 무한대 거리
        
        dx = self.center_x - other.center_x
        dy = self.center_y - other.center_y
        return (dx * dx + dy * dy) ** 0.5
    
    def vertical_distance_to(self, other: 'BBox') -> float:
        """세로 거리만 계산 (같은 페이지일 때)"""
        if self.page != other.page:
            return float('inf')
        
        return abs(self.center_y - other.center_y)

@dataclass
class ImageRef:
    """이미지 참조 정보 (프로덕션 개선)"""
    image_id: str  # 고유 이미지 ID
    bbox: BBox     # 이미지 위치
    image_type: str = "unknown"  # 이미지 타입 (jpeg, png 등)
    description: Optional[str] = None  # 이미지 설명 (OCR 등으로 추출 가능)
    distance_to_text: float = 0.0  # 텍스트와의 거리

@dataclass
class HeadingNode:
    """계층적 헤딩 노드 (프로덕션 개선)"""
    text: str
    level: int  # 1-6, HTML h1-h6와 동일
    start_index: int  # 문장 시작 인덱스
    end_index: Optional[int] = None  # 문장 끝 인덱스 (다음 헤딩 전까지)
    children: List['HeadingNode'] = None
    parent: Optional['HeadingNode'] = None
    
    def __post_init__(self):
        if self.children is None:
            self.children = []

@dataclass
class SentenceInfo:
    """문장 정보 (프로덕션 개선)"""
    text: str
    tokens: int
    page: Optional[int] = None
    is_heading: bool = False
    is_list_item: bool = False
    is_table_content: bool = False
    index: int = 0
    heading_level: Optional[int] = None  # 헤딩인 경우 레벨 (1-6)
    heading_path: Optional[List[str]] = None  # 헤딩 경로 (상위 헤딩들)
    bbox: Optional[BBox] = None  # 문장의 위치 정보 (프로덕션 개선)
    image_refs: List[ImageRef] = None  # 근접한 이미지들 (프로덕션 개선)
    
    def __post_init__(self):
        if self.image_refs is None:
            self.image_refs = []


@dataclass 
class ChunkEditLog:
    """청크 편집 로그 (감사 추적용)"""
    timestamp: str
    user_id: Optional[str]
    action: str  # "create", "merge", "split", "edit_text", "delete"
    chunk_ids: List[str]
    details: Dict[str, Any]
    
    @classmethod
    def create_log(cls, action: str, chunk_ids: List[str], user_id: Optional[str] = None, **details):
        return cls(
            timestamp=datetime.now().isoformat(),
            user_id=user_id,
            action=action,
            chunk_ids=chunk_ids,
            details=details
        )


@dataclass
class ChunkProposal:
    """청크 제안 (프로덕션 감사 지원)"""
    chunk_id: str
    order: int
    text: str
    token_estimate: int
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    heading_path: Optional[List[str]] = None
    sentences: Optional[List[SentenceInfo]] = None
    quality_warnings: List[QualityWarning] = None
    image_refs: List[ImageRef] = None  # 청크 내 이미지 참조들 (프로덕션 개선)
    
    # 감사 메타데이터
    created_at: Optional[str] = None
    last_modified_at: Optional[str] = None
    edit_logs: List[ChunkEditLog] = None
    
    def __post_init__(self):
        if self.quality_warnings is None:
            self.quality_warnings = []
        if self.edit_logs is None:
            self.edit_logs = []
        if self.image_refs is None:
            self.image_refs = []
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()
    
    def add_edit_log(self, action: str, user_id: Optional[str] = None, **details):
        """편집 로그 추가"""
        log = ChunkEditLog.create_log(action, [self.chunk_id], user_id, **details)
        self.edit_logs.append(log)
        self.last_modified_at = datetime.now().isoformat()


class TokenCounter:
    """프로덕션 수준 토큰 카운터 - 설정 기반 폴백 제어"""
    
    def __init__(self):
        self._tiktoken_encoder = None
        self._init_tiktoken()
    
    def _get_fallback_settings(self) -> Dict[str, Any]:
        """폴백 제어 설정 조회"""
        try:
            from .settings_service import settings_service
            return settings_service.get_section_settings("fallback_control")
        except Exception:
            return {"enable_token_counter_fallback": False, "strict_mode": True}
    
    def _init_tiktoken(self):
        """tiktoken 초기화 (프로덕션용)"""
        try:
            import tiktoken
            # OpenAI GPT-3.5/GPT-4 호환 인코딩
            self._tiktoken_encoder = tiktoken.get_encoding("cl100k_base")
            logger.info("tiktoken 초기화 성공 - 정확한 토큰 계산 사용")
        except ImportError:
            fallback_settings = self._get_fallback_settings()
            if fallback_settings.get("enable_token_counter_fallback", False):
                logger.warning("tiktoken 미설치 - 설정에 따라 추정 모드 사용")
                self._tiktoken_encoder = None
            else:
                error_msg = "tiktoken 패키지가 필요합니다. pip install tiktoken으로 설치하거나 설정에서 폴백을 활성화하세요."
                logger.error(error_msg)
                if fallback_settings.get("strict_mode", True):
                    raise RuntimeError(error_msg)
                self._tiktoken_encoder = None
        except Exception as e:
            fallback_settings = self._get_fallback_settings()
            if fallback_settings.get("enable_token_counter_fallback", False):
                logger.error(f"tiktoken 초기화 실패: {e} - 설정에 따라 추정 모드 사용")
                self._tiktoken_encoder = None
            else:
                error_msg = f"tiktoken 초기화 실패: {e}. 설정에서 폴백을 활성화하거나 tiktoken 패키지를 재설치하세요."
                logger.error(error_msg)
                if fallback_settings.get("strict_mode", True):
                    raise RuntimeError(error_msg)
                self._tiktoken_encoder = None
    
    def count_tokens(self, text: str) -> int:
        """정확한 토큰 수 계산"""
        if not text or not text.strip():
            return 0
        
        try:
            if self._tiktoken_encoder:
                # tiktoken으로 정확한 계산
                return len(self._tiktoken_encoder.encode(text))
            else:
                fallback_settings = self._get_fallback_settings()
                if fallback_settings.get("enable_token_counter_fallback", False):
                    # 폴백: 한국어 + 영어 혼합 텍스트 추정
                    word_count = len(re.findall(r'\S+', text))
                    return max(1, int(word_count * 1.3))
                else:
                    error_msg = "tiktoken을 사용할 수 없습니다. 패키지를 설치하거나 설정에서 폴백을 활성화하세요."
                    logger.error(error_msg)
                    if fallback_settings.get("strict_mode", True):
                        raise RuntimeError(error_msg)
                    return 1  # 최소값 반환
        except Exception as e:
            fallback_settings = self._get_fallback_settings()
            if fallback_settings.get("enable_token_counter_fallback", False):
                logger.error(f"토큰 계산 실패: {e} - 문자 기반 추정 사용")
                return max(1, len(text) // 4)
            else:
                error_msg = f"토큰 계산 실패: {e}. 설정에서 폴백을 활성화하세요."
                logger.error(error_msg)
                if fallback_settings.get("strict_mode", True):
                    raise RuntimeError(error_msg)
                return 1  # 최소값 반환


class PDFImageExtractor:
    """PDF 이미지 bbox 추출기 (프로덕션 개선)"""
    
    def __init__(self):
        self._pymupdf_available = False
        self._pdfplumber_available = False
        self._init_pdf_libraries()
    
    def _init_pdf_libraries(self):
        """PDF 라이브러리 초기화"""
        try:
            import fitz  # PyMuPDF
            self._pymupdf_available = True
            logger.info("PyMuPDF 초기화 성공 - 고정밀 이미지 bbox 추출 사용")
        except ImportError:
            logger.warning("PyMuPDF 미설치")
        
        try:
            import pdfplumber
            self._pdfplumber_available = True
            logger.info("pdfplumber 이용 가능 - 폴백 이미지 추출 지원")
        except ImportError:
            logger.warning("pdfplumber 미설치")
        
        if not self._pymupdf_available and not self._pdfplumber_available:
            logger.error("PDF 이미지 추출 라이브러리가 없습니다 (PyMuPDF 또는 pdfplumber 필요)")
    
    def extract_images_from_pdf(self, pdf_path: str) -> List[ImageRef]:
        """PDF에서 이미지 bbox 추출"""
        if self._pymupdf_available:
            return self._extract_with_pymupdf(pdf_path)
        elif self._pdfplumber_available:
            return self._extract_with_pdfplumber(pdf_path)
        else:
            logger.error("PDF 이미지 추출 불가능 - 라이브러리 없음")
            return []
    
    def _extract_with_pymupdf(self, pdf_path: str) -> List[ImageRef]:
        """PyMuPDF로 이미지 추출 (고정밀)"""
        try:
            import fitz
            images = []
            
            doc = fitz.open(pdf_path)
            for page_num in range(len(doc)):
                page = doc[page_num]
                image_list = page.get_images(full=True)
                
                for img_index, img in enumerate(image_list):
                    # 이미지 객체 정보 추출
                    xref = img[0]
                    bbox_info = page.get_image_bbox(img)
                    
                    if bbox_info:
                        # PyMuPDF bbox: (x0, y0, x1, y1) - PDF 좌표계
                        bbox = BBox(
                            x0=bbox_info.x0,
                            y0=bbox_info.y0,
                            x1=bbox_info.x1,
                            y1=bbox_info.y1,
                            page=page_num
                        )
                        
                        # 이미지 타입 추출
                        try:
                            base_image = doc.extract_image(xref)
                            image_type = base_image.get("ext", "unknown")
                        except:
                            image_type = "unknown"
                        
                        image_ref = ImageRef(
                            image_id=f"page_{page_num}_img_{img_index}",
                            bbox=bbox,
                            image_type=image_type
                        )
                        images.append(image_ref)
                        
            doc.close()
            logger.info(f"PyMuPDF로 {len(images)}개 이미지 추출 완료")
            return images
            
        except Exception as e:
            logger.error(f"PyMuPDF 이미지 추출 실패: {e}")
            return []
    
    def _extract_with_pdfplumber(self, pdf_path: str) -> List[ImageRef]:
        """pdfplumber로 이미지 추출 (폴백)"""
        try:
            import pdfplumber
            images = []
            
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    page_images = page.images
                    
                    for img_index, img in enumerate(page_images):
                        # pdfplumber bbox: 'x0', 'y0', 'x1', 'y1'
                        bbox = BBox(
                            x0=float(img['x0']),
                            y0=float(img['y0']),
                            x1=float(img['x1']),
                            y1=float(img['y1']),
                            page=page_num
                        )
                        
                        image_ref = ImageRef(
                            image_id=f"page_{page_num}_img_{img_index}",
                            bbox=bbox,
                            image_type="unknown"  # pdfplumber는 타입 정보 제한적
                        )
                        images.append(image_ref)
                        
            logger.info(f"pdfplumber로 {len(images)}개 이미지 추출 완료")
            return images
            
        except Exception as e:
            logger.error(f"pdfplumber 이미지 추출 실패: {e}")
            return []


class SmartTextSplitter:
    """프로덕션 수준 지능형 텍스트 분할기"""
    
    def __init__(self):        
        # PDF 이미지 추출기 초기화 (프로덕션 개선)
        self.pdf_image_extractor = PDFImageExtractor()
        
        # 헤딩 패턴들 (레벨 포함 - 프로덕션 개선)
        self.heading_patterns = [
            (re.compile(r'^(#{1,6})\s+(.+)'), 'markdown'),  # 마크다운 헤딩 (# ## ###)
            (re.compile(r'^(\d+(?:\.\d+)*)\s+(.+)'), 'numbered'),  # 1. 1.1. 2.3.4 등
            (re.compile(r'^([가-힣])[\s]*\d*[\s]*[\.)]?\s*(.+)'), 'korean'),  # 가. 나1) 등
            (re.compile(r'^([A-Z][A-Z\s]{2,})$'), 'caps'),  # 전체 대문자 (짧은 제목)
        ]
        
        # 목록 아이템 패턴
        self.list_patterns = [
            re.compile(r'^\s*[-*+•·]\s+'),  # 불릿 포인트
            re.compile(r'^\s*\d+[.)]\s+'),   # 숫자 목록
            re.compile(r'^\s*[가-힣][.)]\s+'),  # 한글 목록
            re.compile(r'^\s*[a-zA-Z][.)]\s+')  # 영문 목록
        ]
        
        # 표 패턴 (간단한 버전)
        self.table_pattern = re.compile(r'\|.*\|')
    
    
    def split_into_sentences(self, text: str, rules: ChunkingRules) -> List[SentenceInfo]:
        """프로덕션 수준 문장 분할 (KSS/Kiwi 통합)"""
        if not text or not text.strip():
            return []
        
        sentences = []
        lines = text.split('\n')
        sentence_index = 0
        token_counter = TokenCounter()
        
        # 헤딩 트리 구축용 (프로덕션 개선)
        heading_stack = []  # 현재 헤딩 계층 추적
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # 라인 단위로 분석
            heading_info = self._get_heading_info(line)
            is_heading = heading_info is not None
            is_list_item = self._is_list_item(line)
            is_table_content = self._is_table_content(line)
            
            # 헤딩 경로 구축 (프로덕션 개선)
            heading_level = None
            heading_path = None
            if is_heading:
                heading_level, heading_text = heading_info
                # 현재 레벨보다 높거나 같은 레벨의 헤딩들을 스택에서 제거
                while heading_stack and heading_stack[-1][0] >= heading_level:
                    heading_stack.pop()
                # 현재 헤딩을 스택에 추가
                heading_stack.append((heading_level, heading_text))
                # 헤딩 경로 생성 (상위 헤딩들의 텍스트)
                heading_path = [h[1] for h in heading_stack[:-1]]  # 현재 헤딩 제외
            
            if is_heading or is_list_item or is_table_content:
                # 특수 구조는 라인 단위로 유지
                if line:
                    sentences.append(SentenceInfo(
                        text=line,
                        tokens=token_counter.count_tokens(line),
                        is_heading=is_heading,
                        is_list_item=is_list_item,
                        is_table_content=is_table_content,
                        index=sentence_index,
                        heading_level=heading_level,
                        heading_path=heading_path
                    ))
                    sentence_index += 1
            else:
                # 일반 텍스트는 사용자 선택 방법으로 문장 분리
                line_sentences = self._split_sentences_by_method(line, rules)
                # 현재 헤딩 경로를 일반 텍스트에도 적용 (프로덕션 개선)
                current_heading_path = [h[1] for h in heading_stack] if heading_stack else None
                
                for sent in line_sentences:
                    # 문장이 문자열인지 확인하고 안전하게 처리
                    if not isinstance(sent, str):
                        logger.warning(f"예상치 못한 문장 타입: {type(sent)}, 값: {sent}")
                        sent = str(sent) if sent is not None else ""
                    
                    sent = sent.strip()
                    if sent:
                        sentences.append(SentenceInfo(
                            text=sent,
                            tokens=token_counter.count_tokens(sent),
                            is_heading=False,
                            is_list_item=False,
                            is_table_content=False,
                            index=sentence_index,
                            heading_level=None,
                            heading_path=current_heading_path
                        ))
                        sentence_index += 1
        
        return sentences
    
    def _get_fallback_settings(self) -> Dict[str, Any]:
        """폴백 제어 설정 조회"""
        try:
            from .settings_service import settings_service
            return settings_service.get_section_settings("fallback_control")
        except Exception:
            return {"enable_sentence_splitter_fallback": False, "strict_mode": True}
    
    def _split_sentences_by_method(self, text: str, rules: ChunkingRules) -> List[str]:
        """사용자 선택 방법으로 문장 분리 - 설정 기반 폴백 제어"""
        if not text.strip():
            return []
        
        method = rules.sentence_splitter.lower()
        logger.info(f"📝 문장분할방법 선택: {method.upper()}")
        
        try:
            if method == "kss":
                return self._split_sentences_kss(text, rules)
            elif method == "kiwi":
                return self._split_sentences_kiwi(text, rules)
            elif method == "regex":
                return self._split_sentences_regex(text, rules)
            elif method == "recursive":
                return self._split_sentences_recursive(text, rules)
            else:
                raise ValueError(f"지원하지 않는 문장 분할 방법: {method}")
        except ImportError as e:
            fallback_settings = self._get_fallback_settings()
            if fallback_settings.get("enable_sentence_splitter_fallback", False):
                logger.warning(f"{method.upper()} 라이브러리 미설치 - 설정에 따라 정규식 방법으로 폴백")
                # 정규식 방법으로 폴백
                return self._split_sentences_regex(text, rules)
            else:
                error_msg = f"{method.upper()} 라이브러리가 설치되지 않았습니다: {e}. 패키지를 설치하거나 설정에서 폴백을 활성화하세요."
                logger.error(error_msg)
                if fallback_settings.get("strict_mode", True):
                    raise RuntimeError(error_msg)
                return [text]  # 원본 텍스트를 그대로 반환
        except Exception as e:
            fallback_settings = self._get_fallback_settings()
            if fallback_settings.get("enable_sentence_splitter_fallback", False):
                logger.error(f"{method.upper()} 문장 분리 실패: {e} - 설정에 따라 정규식 방법으로 폴백")
                # 정규식 방법으로 폴백
                try:
                    return self._split_sentences_regex(text, rules)
                except Exception as regex_error:
                    logger.error(f"정규식 폴백도 실패: {regex_error} - 원본 텍스트 반환")
                    return [text]
            else:
                error_msg = f"{method.upper()} 문장 분리 중 오류 발생: {e}. 설정에서 폴백을 활성화하세요."
                logger.error(error_msg)
                if fallback_settings.get("strict_mode", True):
                    raise RuntimeError(error_msg)
                return [text]  # 원본 텍스트를 그대로 반환

    def _split_sentences_kss(self, text: str, rules: ChunkingRules) -> List[str]:
        """KSS를 사용한 문장 분리 (Python KSS 6.0.5 옵션 적용)"""
        try:
            from kss import Kss
            
            # KSS 6.0.5 새로운 API 사용
            split_sentences = Kss("split_sentences")
            
            # 파라미터 설정
            kwargs = {
                "backend": rules.kss_backend,
                "num_workers": rules.kss_num_workers,
                "strip": rules.kss_strip,
                "return_morphemes": rules.kss_return_morphemes
            }
            
            # ignores 리스트가 비어있지 않은 경우만 추가
            if rules.kss_ignores:
                kwargs["ignores"] = rules.kss_ignores
            
            logger.debug(f"KSS 6.0.5 파라미터: {kwargs}")
            result = split_sentences(text, **kwargs)
            
            # KSS 6.0.5는 return_morphemes=False일 때 List[str]을 반환해야 함
            if not isinstance(result, list):
                logger.error(f"KSS 6.0.5 예상치 못한 반환 타입: {type(result)}")
                logger.error(f"현재 설정: return_morphemes={rules.kss_return_morphemes}")
                logger.error("return_morphemes=True로 설정되어 있다면 False로 변경하세요")
                return []
            
            # 빈 결과 처리
            if not result:
                logger.debug("KSS 6.0.5에서 빈 결과 반환")
                return []
            
            # 문자열 리스트 확인 및 정리
            sentences = []
            for item in result:
                if isinstance(item, str) and item.strip():
                    sentences.append(item.strip())
                elif item is not None:
                    logger.warning(f"KSS 결과에 문자열이 아닌 항목: {type(item)} - {item}")
            
            logger.info(f"🔍 KSS 분리 결과: {len(sentences)}개 문장")
            logger.debug(f"KSS 첫 3개 문장 샘플: {sentences[:3] if len(sentences) >= 3 else sentences}")
            return sentences
            
        except ImportError:
            logger.error("KSS 6.x 라이브러리가 설치되지 않았습니다")
            raise RuntimeError("KSS 라이브러리가 설치되지 않았습니다. pip install kss로 설치하세요.")
                
        except Exception as e:
            logger.error(f"KSS 6.0.5 문장 분리 실패: {e}")
            raise RuntimeError(f"KSS 문장 분리 실패: {e}")

    def _split_sentences_kiwi(self, text: str, rules: ChunkingRules) -> List[str]:
        """Kiwi를 사용한 문장 분리"""
        from kiwipiepy import Kiwi
        
        # Kiwi 인스턴스 생성 (옵션 적용)
        kiwi_config = {}
        if rules.kiwi_model_path:
            kiwi_config['model_path'] = rules.kiwi_model_path
        if not rules.kiwi_load_default_dict:
            kiwi_config['load_default_dict'] = False
        if rules.kiwi_max_unk_form_len != 8:
            kiwi_config['max_unk_form_len'] = rules.kiwi_max_unk_form_len
        if not rules.kiwi_integrate_allomorph:
            kiwi_config['integrate_allomorph'] = False
        
        kiwi = Kiwi(**kiwi_config)
        result = kiwi.split_into_sents(text)
        return [sent.text for sent in result]

    def _split_sentences_regex(self, text: str, rules: ChunkingRules) -> List[str]:
        """정규식을 사용한 문장 분리 (사용자 정의 옵션 적용)"""
        import re
        
        # 사용자 정의 패턴 적용
        pattern = rules.regex_sentence_endings
        
        # 줄임말 보존 처리
        if rules.regex_preserve_abbreviations:
            # 일반적인 줄임말 보존
            text = re.sub(r'\b(Dr|Mr|Mrs|Ms|Prof|etc|vs|Inc|Ltd|Co)\.',
                         r'\1〈DOT〉', text)
        
        # 사용자 정의 패턴들 적용
        for custom_pattern in rules.regex_custom_patterns:
            try:
                # 사용자 패턴을 〈DOT〉으로 임시 치환
                text = re.sub(custom_pattern + r'\.', 
                            custom_pattern.replace('.', '〈DOT〉'), text)
            except re.error as e:
                logger.warning(f"잘못된 사용자 정의 패턴 무시: {custom_pattern} - {e}")
        
        # 문장 종료 패턴으로 분할
        try:
            sentences = re.split(pattern, text)
        except re.error as e:
            logger.error(f"잘못된 문장 종료 패턴: {pattern} - {e}")
            # 기본 패턴으로 폴백
            sentences = re.split(r'[.!?]', text)
        
        # 원래 점 복원 및 정리
        cleaned_sentences = []
        for sent in sentences:
            sent = sent.replace('〈DOT〉', '.').strip()
            if sent:
                cleaned_sentences.append(sent)
        
        logger.info(f"🔍 정규식 분리 결과: {len(cleaned_sentences)}개 문장")
        logger.debug(f"정규식 첫 3개 문장 샘플: {cleaned_sentences[:3] if len(cleaned_sentences) >= 3 else cleaned_sentences}")
        return cleaned_sentences

    def _split_sentences_recursive(self, text: str, rules: ChunkingRules) -> List[str]:
        """RecursiveCharacterTextSplitter를 사용한 문장 분리"""
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            
            # RecursiveCharacterTextSplitter 설정
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=rules.max_tokens * 4,  # 대략적인 character 수 (토큰 * 4)
                chunk_overlap=rules.overlap_tokens * 4,  # 대략적인 character 수
                separators=rules.recursive_separators,
                keep_separator=rules.recursive_keep_separator,
                is_separator_regex=rules.recursive_is_separator_regex,
            )
            
            # 텍스트 분할
            chunks = text_splitter.split_text(text)
            
            # 빈 청크 제거
            sentences = [chunk.strip() for chunk in chunks if chunk.strip()]
            
            logger.info(f"🔍 Recursive 분리 결과: {len(sentences)}개 문장")
            logger.debug(f"Recursive 첫 3개 문장 샘플: {sentences[:3] if len(sentences) >= 3 else sentences}")
            return sentences
            
        except ImportError:
            logger.error("langchain_text_splitters 라이브러리가 설치되지 않았습니다")
            raise RuntimeError("langchain_text_splitters 라이브러리가 설치되지 않았습니다")
        except Exception as e:
            logger.error(f"RecursiveCharacterTextSplitter 오류: {e}")
            raise RuntimeError(f"RecursiveCharacterTextSplitter 문장 분리 실패: {e}")
    
    
    def _is_heading(self, line: str) -> bool:
        """헤딩인지 판단"""
        return self._get_heading_info(line) is not None
    
    def _get_heading_info(self, line: str) -> Optional[Tuple[int, str]]:
        """헤딩 정보 추출 (레벨, 텍스트) - 프로덕션 개선"""
        line_stripped = line.strip()
        if not line_stripped:
            return None
        
        for pattern, pattern_type in self.heading_patterns:
            match = pattern.match(line_stripped)
            if match:
                if pattern_type == 'markdown':
                    # 마크다운: # ## ### 개수가 레벨
                    level = len(match.group(1))
                    text = match.group(2).strip()
                    return (level, text)
                
                elif pattern_type == 'numbered':
                    # 번호: 점의 개수로 레벨 결정 (1=1, 1.1=2, 1.1.1=3)
                    numbering = match.group(1)
                    level = numbering.count('.') + 1
                    text = match.group(2).strip()
                    return (min(level, 6), text)  # 최대 6레벨
                
                elif pattern_type == 'korean':
                    # 한국어: 가나다 순서로 레벨 추정
                    char = match.group(1)
                    korean_order = ['가', '나', '다', '라', '마', '바']
                    if char in korean_order:
                        level = korean_order.index(char) + 1
                    else:
                        level = 1
                    text = match.group(2).strip() if len(match.groups()) > 1 else char
                    return (min(level, 6), text)
                
                elif pattern_type == 'caps':
                    # 대문자: 기본 1레벨
                    text = match.group(1).strip()
                    return (1, text)
        
        return None
    
    def _is_list_item(self, line: str) -> bool:
        """목록 아이템인지 판단"""
        return any(pattern.match(line) for pattern in self.list_patterns)
    
    def _is_table_content(self, line: str) -> bool:
        """표 내용인지 판단"""
        return bool(self.table_pattern.search(line))
    
    def split_into_sentences_with_images(self, text: str, rules: ChunkingRules, pdf_path: Optional[str] = None) -> List[SentenceInfo]:
        """이미지 정보를 포함한 문장 분할 (프로덕션 개선)"""
        # 기본 문장 분할
        sentences = self.split_into_sentences(text, rules)
        
        # PDF 이미지 추출 및 매칭
        if pdf_path and sentences:
            try:
                images = self.pdf_image_extractor.extract_images_from_pdf(pdf_path)
                if images:
                    self._attach_images_to_sentences(sentences, images)
                    logger.info(f"{len(images)}개 이미지와 {len(sentences)}개 문장 매칭 완료")
            except Exception as e:
                logger.error(f"이미지-텍스트 매칭 실패: {e}")
        
        return sentences
    
    def _attach_images_to_sentences(self, sentences: List[SentenceInfo], images: List[ImageRef], max_distance: float = 100.0):
        """문장에 근접 이미지 연결 (프로덕션 개선)"""
        if not sentences or not images:
            return
        
        # 문장 bbox가 없는 경우 추정 (단순화된 구현)
        self._estimate_sentence_bboxes(sentences)
        
        # 각 문장에 대해 가장 가까운 이미지들 찾기
        for sentence in sentences:
            if not sentence.bbox:
                continue
                
            nearby_images = []
            for image in images:
                # 같은 페이지의 이미지만 고려
                if sentence.bbox.page == image.bbox.page:
                    distance = sentence.bbox.vertical_distance_to(image.bbox)
                    if distance <= max_distance:
                        # 거리 정보 추가
                        image_copy = ImageRef(
                            image_id=image.image_id,
                            bbox=image.bbox,
                            image_type=image.image_type,
                            description=image.description,
                            distance_to_text=distance
                        )
                        nearby_images.append(image_copy)
            
            # 거리 순으로 정렬
            nearby_images.sort(key=lambda img: img.distance_to_text)
            sentence.image_refs = nearby_images[:3]  # 최대 3개까지만
    
    def _estimate_sentence_bboxes(self, sentences: List[SentenceInfo]):
        """문장 bbox 추정 (단순화된 구현 - 프로덕션 개선)"""
        # 실제 구현에서는 PDF 파싱 시 단어 bbox를 수집해서 문장 bbox를 계산해야 함
        # 여기서는 페이지별로 균등 분배하는 단순한 방식 사용
        
        current_page = 0
        page_sentences = []
        
        for sentence in sentences:
            if sentence.page is None:
                sentence.page = current_page
            
            if sentence.page != current_page:
                # 이전 페이지 문장들의 bbox 추정
                if page_sentences:
                    self._distribute_sentences_on_page(page_sentences, current_page)
                
                current_page = sentence.page
                page_sentences = [sentence]
            else:
                page_sentences.append(sentence)
        
        # 마지막 페이지 처리
        if page_sentences:
            self._distribute_sentences_on_page(page_sentences, current_page)
    
    def _distribute_sentences_on_page(self, sentences: List[SentenceInfo], page_num: int, page_width: float = 595, page_height: float = 842):
        """페이지 내에서 문장들을 균등 분배 (단순화된 구현)"""
        if not sentences:
            return
        
        # 페이지 여백 고려
        margin_x, margin_y = 50, 50
        content_width = page_width - 2 * margin_x
        content_height = page_height - 2 * margin_y
        
        # 각 문장의 세로 위치 계산
        sentence_height = content_height / len(sentences)
        
        for i, sentence in enumerate(sentences):
            y_top = page_height - margin_y - (i * sentence_height)
            y_bottom = y_top - sentence_height
            
            sentence.bbox = BBox(
                x0=margin_x,
                y0=y_bottom,
                x1=margin_x + content_width,
                y1=y_top,
                page=page_num
            )


class SmartChunkingService:
    """PRD 방식의 지능형 청킹 서비스 (프로덕션 개선)"""
    
    def __init__(self):
        self.text_splitter = SmartTextSplitter()
        self.token_counter = TokenCounter()
    
    def _get_fallback_settings(self) -> Dict[str, Any]:
        """폴백 제어 설정 조회"""
        try:
            from .settings_service import settings_service
            return settings_service.get_section_settings("fallback_control")
        except Exception as e:
            logger.warning(f"폴백 설정 조회 실패: {e} - 기본값(엄격 모드) 사용")
            return {
                "enable_similarity_fallback": False,
                "enable_sentence_splitter_fallback": False,
                "enable_token_counter_fallback": False,
                "enable_pdf_extraction_fallback": False,
                "strict_mode": True
            }
    
    def propose_chunks_hierarchical(self, full_text: str, rules: ChunkingRules, pdf_path: Optional[str] = None) -> List[ChunkProposal]:
        """계층적 헤딩 기반 청킹 제안 (프로덕션 개선)"""
        try:
            logger.info(f"계층적 청킹 제안 시작 - 텍스트 길이: {len(full_text)}")
            
            # 1. 문장 단위 분할 (헤딩 경로 + 이미지 정보 포함 - 프로덕션 개선)
            if pdf_path:
                sentences = self.text_splitter.split_into_sentences_with_images(full_text, rules, pdf_path)
                logger.info("이미지-텍스트 연관성 포함 계층적 모드로 문장 분할")
            else:
                sentences = self.text_splitter.split_into_sentences(full_text, rules)
            
            if not sentences:
                return []
            
            logger.info(f"문장 분할 완료 - {len(sentences)}개 문장")
            
            # 2. 헤딩 기반 섹션 분할
            sections = self._group_by_headings(sentences)
            logger.info(f"헤딩 기반 섹션 분할 완료 - {len(sections)}개 섹션")
            
            # 3. 각 섹션 내에서 토큰 기반 청킹
            all_proposals = []
            chunk_order = 1
            
            for section in sections:
                section_proposals = self._chunk_section(section, rules, chunk_order)
                all_proposals.extend(section_proposals)
                chunk_order += len(section_proposals)
            
            # 4. 전체 청크 간 중복 검사
            duplicate_warnings = self.check_duplicate_chunks(all_proposals)
            for warning in duplicate_warnings:
                for proposal in all_proposals[:-1]:
                    if "연속 청크" in warning.message:
                        proposal.quality_warnings.append(warning)
                        break
            
            logger.info(f"계층적 청킹 제안 완료 - {len(all_proposals)}개 청크 생성")
            return all_proposals
            
        except Exception as e:
            logger.error(f"계층적 청킹 제안 실패: {e}")
            raise
    
    def _group_by_headings(self, sentences: List[SentenceInfo]) -> List[Dict[str, Any]]:
        """헤딩 기반 섹션 그룹핑 (프로덕션 개선)"""
        sections = []
        current_section = {
            "heading": None,
            "heading_level": None,
            "heading_path": [],
            "sentences": [],
            "start_index": 0
        }
        
        for i, sentence in enumerate(sentences):
            if sentence.is_heading:
                # 이전 섹션 완료
                if current_section["sentences"]:
                    current_section["end_index"] = i - 1
                    sections.append(current_section.copy())
                
                # 새 섹션 시작
                current_section = {
                    "heading": sentence.text,
                    "heading_level": sentence.heading_level,
                    "heading_path": sentence.heading_path or [],
                    "sentences": [sentence],
                    "start_index": i
                }
            else:
                current_section["sentences"].append(sentence)
        
        # 마지막 섹션 추가
        if current_section["sentences"]:
            current_section["end_index"] = len(sentences) - 1
            sections.append(current_section)
        
        return sections
    
    def _chunk_section(self, section: Dict[str, Any], rules: ChunkingRules, start_order: int) -> List[ChunkProposal]:
        """섹션 내 토큰 기반 청킹 (프로덕션 개선)"""
        sentences = section["sentences"]
        if not sentences:
            return []
        
        # 섹션이 작으면 하나의 청크로
        total_tokens = sum(s.tokens for s in sentences)
        if total_tokens <= rules.max_tokens:
            chunk = self._create_section_chunk(section, start_order, rules)
            return [chunk] if chunk else []
        
        # 큰 섹션은 토큰 기준으로 분할
        chunk_groups = self._group_by_tokens(sentences, rules)
        proposals = []
        
        for i, group in enumerate(chunk_groups):
            # 섹션 정보 추가
            group["section_heading"] = section["heading"]
            group["section_heading_path"] = section["heading_path"]
            chunk = self._create_chunk_proposal(group, start_order + i, rules)
            proposals.append(chunk)
        
        return proposals
    
    def _create_section_chunk(self, section: Dict[str, Any], order: int, rules: ChunkingRules) -> Optional[ChunkProposal]:
        """섹션 전체를 하나의 청크로 생성 (프로덕션 개선)"""
        sentences = section["sentences"]
        if not sentences:
            return None
        
        text = " ".join(s.text for s in sentences)
        total_tokens = sum(s.tokens for s in sentences)
        
        # 품질 검사
        group = {
            "sentences": sentences,
            "total_tokens": total_tokens,
            "has_heading": any(s.is_heading for s in sentences),
            "has_table": any(s.is_table_content for s in sentences),
            "has_list": any(s.is_list_item for s in sentences)
        }
        warnings = self._check_chunk_quality(group, rules)
        
        # 헤딩 경로 (섹션 헤딩 포함)
        heading_path = section["heading_path"].copy()
        if section["heading"]:
            heading_path.append(section["heading"])
        
        # 이미지 참조 통합 (프로덕션 개선)
        image_refs = self._consolidate_image_refs(sentences)
        
        # 페이지 범위 계산
        pages = [s.page for s in sentences if s.page is not None]
        page_start = min(pages) if pages else None
        page_end = max(pages) if pages else None
        
        return ChunkProposal(
            chunk_id=str(uuid.uuid4()),
            order=order,
            text=text,
            token_estimate=total_tokens,
            page_start=page_start,
            page_end=page_end,
            heading_path=heading_path if heading_path else None,
            sentences=sentences,
            quality_warnings=warnings,
            image_refs=image_refs
        )
    
    def propose_chunks(self, full_text: str, rules: ChunkingRules, use_hierarchical: bool = True, pdf_path: Optional[str] = None) -> List[ChunkProposal]:
        """자동 청킹 제안 (PRD 핵심 로직 - 프로덕션 개선)"""
        try:
            logger.info(f"청킹 제안 시작 - 텍스트 길이: {len(full_text)}, 규칙: {asdict(rules)}, 계층적: {use_hierarchical}")
            
            # 헤딩이 있고 계층적 모드를 사용하는 경우
            if use_hierarchical and self._has_headings(full_text):
                logger.info("계층적 헤딩 기반 청킹 모드 사용")
                return self.propose_chunks_hierarchical(full_text, rules, pdf_path)
            
            # 기존 토큰 기반 청킹 모드
            logger.info("토큰 기반 청킹 모드 사용")
            
            # 1. 문장 단위 분할 (이미지 정보 포함 - 프로덕션 개선)
            if pdf_path:
                sentences = self.text_splitter.split_into_sentences_with_images(full_text, rules, pdf_path)
                logger.info("이미지-텍스트 연관성 포함 모드로 문장 분할")
            else:
                sentences = self.text_splitter.split_into_sentences(full_text, rules)
            
            if not sentences:
                return []
            
            logger.info(f"문장 분할 완료 - {len(sentences)}개 문장")
            
            # 2. 토큰 기반 그룹핑
            chunk_groups = self._group_by_tokens(sentences, rules)
            logger.info(f"토큰 기반 그룹핑 완료 - {len(chunk_groups)}개 그룹")
            
            # 3. 헤딩 경계 조정 (옵션)
            if rules.respect_headings:
                chunk_groups = self._adjust_heading_boundaries(chunk_groups, rules)
                logger.info("헤딩 경계 조정 완료")
            
            # 4. 구조 보존 (표, 목록)
            if rules.preserve_tables or rules.preserve_lists:
                chunk_groups = self._preserve_structures(chunk_groups, rules)
                logger.info("구조 보존 조정 완료")
            
            # 5. 오버랩 적용
            if rules.overlap_tokens > 0:
                chunk_groups = self._apply_overlap(chunk_groups, rules)
                logger.info(f"오버랩 적용 완료 - {rules.overlap_tokens} 토큰")
            
            # 6. 청크 제안 생성
            proposals = []
            for i, group in enumerate(chunk_groups):
                chunk = self._create_chunk_proposal(group, i + 1, rules)
                proposals.append(chunk)
            
            # 7. 전체 청크 간 중복 검사
            duplicate_warnings = self.check_duplicate_chunks(proposals)
            
            # 중복 경고를 해당 청크에 추가
            for warning in duplicate_warnings:
                # 메시지에서 청크 순서 추출하여 해당 청크에 경고 추가
                for i, proposal in enumerate(proposals[:-1]):  # 마지막 제외
                    if f"연속 청크" in warning.message:
                        proposal.quality_warnings.append(warning)
                        break
            
            logger.info(f"청킹 제안 완료 - {len(proposals)}개 청크 생성")
            return proposals
            
        except Exception as e:
            logger.error(f"청킹 제안 실패: {e}")
            raise
    
    def _has_headings(self, text: str) -> bool:
        """텍스트에 헤딩이 있는지 확인 (프로덕션 개선)"""
        lines = text.split('\n')[:50]  # 처음 50줄만 확인 (성능상)
        heading_count = 0
        
        for line in lines:
            if self.text_splitter._is_heading(line.strip()):
                heading_count += 1
                if heading_count >= 2:  # 2개 이상의 헤딩이 있으면 계층적 모드 사용
                    return True
        
        return False
    
    def _consolidate_image_refs(self, sentences: List[SentenceInfo]) -> List[ImageRef]:
        """문장들의 이미지 참조 통합 (프로덕션 개선)"""
        if not sentences:
            return []
        
        # 모든 이미지 참조 수집
        all_image_refs = []
        for sentence in sentences:
            if sentence.image_refs:
                all_image_refs.extend(sentence.image_refs)
        
        if not all_image_refs:
            return []
        
        # 이미지 ID 기준으로 중복 제거 (가장 가까운 거리 우선)
        unique_images = {}
        for img_ref in all_image_refs:
            existing = unique_images.get(img_ref.image_id)
            if not existing or img_ref.distance_to_text < existing.distance_to_text:
                unique_images[img_ref.image_id] = img_ref
        
        # 거리순으로 정렬
        consolidated = list(unique_images.values())
        consolidated.sort(key=lambda img: img.distance_to_text)
        
        logger.debug(f"청크 이미지 참조 통합: {len(all_image_refs)}개 → {len(consolidated)}개")
        return consolidated
    
    def _group_by_tokens(self, sentences: List[SentenceInfo], rules: ChunkingRules) -> List[Dict[str, Any]]:
        """토큰 수 기준으로 문장들을 그룹핑 (PRD2: 강제 분절 포함)"""
        groups = []
        current_group = {
            "sentences": [],
            "total_tokens": 0,
            "has_heading": False,
            "has_table": False,
            "has_list": False
        }
        
        for sentence in sentences:
            # PRD2: 강제 분절 - 한 문장이 너무 길면 자동 분절
            if sentence.tokens > rules.hard_sentence_max_tokens:
                logger.info(f"긴 문장 강제 분절: {sentence.tokens} > {rules.hard_sentence_max_tokens} 토큰")
                
                # 현재 그룹이 있으면 먼저 완료
                if current_group["sentences"]:
                    groups.append(current_group.copy())
                    current_group = {
                        "sentences": [],
                        "total_tokens": 0,
                        "has_heading": False,
                        "has_table": False,
                        "has_list": False
                    }
                
                # 긴 문장을 여러 조각으로 분할
                split_sentences = self._force_split_sentence(sentence, rules)
                
                # 분할된 조각들을 그룹핑
                for split_sentence in split_sentences:
                    potential_tokens = current_group["total_tokens"] + split_sentence.tokens
                    
                    if potential_tokens > rules.max_tokens and current_group["sentences"]:
                        groups.append(current_group.copy())
                        current_group = {
                            "sentences": [split_sentence],
                            "total_tokens": split_sentence.tokens,
                            "has_heading": split_sentence.is_heading,
                            "has_table": split_sentence.is_table_content,
                            "has_list": split_sentence.is_list_item
                        }
                    else:
                        current_group["sentences"].append(split_sentence)
                        current_group["total_tokens"] = potential_tokens
                        if split_sentence.is_heading:
                            current_group["has_heading"] = True
                        if split_sentence.is_table_content:
                            current_group["has_table"] = True
                        if split_sentence.is_list_item:
                            current_group["has_list"] = True
                
                continue
            
            # 일반적인 문장 처리
            potential_tokens = current_group["total_tokens"] + sentence.tokens
            
            # 최대 토큰 초과 시 현재 그룹 완료
            if potential_tokens > rules.max_tokens and current_group["sentences"]:
                groups.append(current_group.copy())
                current_group = {
                    "sentences": [sentence],
                    "total_tokens": sentence.tokens,
                    "has_heading": sentence.is_heading,
                    "has_table": sentence.is_table_content,
                    "has_list": sentence.is_list_item
                }
            else:
                # 현재 그룹에 추가
                current_group["sentences"].append(sentence)
                current_group["total_tokens"] = potential_tokens
                if sentence.is_heading:
                    current_group["has_heading"] = True
                if sentence.is_table_content:
                    current_group["has_table"] = True
                if sentence.is_list_item:
                    current_group["has_list"] = True
        
        # 마지막 그룹 추가
        if current_group["sentences"]:
            groups.append(current_group)
        
        return groups
    
    def _adjust_heading_boundaries(self, groups: List[Dict[str, Any]], rules: ChunkingRules) -> List[Dict[str, Any]]:
        """헤딩 경계에서 청크 분할 조정"""
        adjusted_groups = []
        
        for group in groups:
            sentences = group["sentences"]
            
            # 헤딩이 중간에 있으면 분할
            split_points = []
            for i, sentence in enumerate(sentences):
                if sentence.is_heading and i > 0:  # 첫 번째가 아닌 헤딩
                    split_points.append(i)
            
            if split_points:
                # 헤딩 위치에서 분할
                start = 0
                for split_point in split_points:
                    if start < split_point:
                        new_group = self._create_group_from_sentences(sentences[start:split_point])
                        adjusted_groups.append(new_group)
                    start = split_point
                
                # 마지막 부분
                if start < len(sentences):
                    new_group = self._create_group_from_sentences(sentences[start:])
                    adjusted_groups.append(new_group)
            else:
                adjusted_groups.append(group)
        
        return adjusted_groups
    
    def _preserve_structures(self, groups: List[Dict[str, Any]], rules: ChunkingRules) -> List[Dict[str, Any]]:
        """표와 목록 구조 보존"""
        # 간단한 구현: 표나 목록이 분할되지 않도록 인접 그룹과 병합
        preserved_groups = []
        
        i = 0
        while i < len(groups):
            current_group = groups[i]
            
            # 다음 그룹과 병합 가능한지 체크
            if (i + 1 < len(groups) and 
                (current_group["has_table"] or current_group["has_list"]) and
                current_group["total_tokens"] + groups[i + 1]["total_tokens"] <= rules.max_tokens * 1.2):
                
                # 병합
                merged_group = self._merge_groups(current_group, groups[i + 1])
                preserved_groups.append(merged_group)
                i += 2  # 두 그룹을 건너뜀
            else:
                preserved_groups.append(current_group)
                i += 1
        
        return preserved_groups
    
    def _apply_overlap(self, groups: List[Dict[str, Any]], rules: ChunkingRules) -> List[Dict[str, Any]]:
        """오버랩 적용"""
        if len(groups) <= 1:
            return groups
        
        overlapped_groups = [groups[0]]  # 첫 번째 그룹은 그대로
        
        for i in range(1, len(groups)):
            current_group = groups[i].copy()
            prev_group = groups[i - 1]
            
            # 이전 그룹에서 오버랩할 문장들 추출
            overlap_sentences = self._extract_overlap_sentences(
                prev_group["sentences"], 
                rules.overlap_tokens
            )
            
            if overlap_sentences:
                # 오버랩 문장들을 현재 그룹 앞에 추가
                current_group["sentences"] = overlap_sentences + current_group["sentences"]
                current_group["total_tokens"] += sum(s.tokens for s in overlap_sentences)
            
            overlapped_groups.append(current_group)
        
        return overlapped_groups
    
    def _extract_overlap_sentences(self, sentences: List[SentenceInfo], target_tokens: int) -> List[SentenceInfo]:
        """오버랩용 문장들 추출 (뒤에서부터)"""
        overlap_sentences = []
        current_tokens = 0
        
        for sentence in reversed(sentences):
            if current_tokens + sentence.tokens <= target_tokens:
                overlap_sentences.insert(0, sentence)
                current_tokens += sentence.tokens
            else:
                break
        
        return overlap_sentences
    
    def _create_group_from_sentences(self, sentences: List[SentenceInfo]) -> Dict[str, Any]:
        """문장 리스트로부터 그룹 생성"""
        return {
            "sentences": sentences,
            "total_tokens": sum(s.tokens for s in sentences),
            "has_heading": any(s.is_heading for s in sentences),
            "has_table": any(s.is_table_content for s in sentences),
            "has_list": any(s.is_list_item for s in sentences)
        }
    
    def _merge_groups(self, group1: Dict[str, Any], group2: Dict[str, Any]) -> Dict[str, Any]:
        """두 그룹 병합"""
        return {
            "sentences": group1["sentences"] + group2["sentences"],
            "total_tokens": group1["total_tokens"] + group2["total_tokens"],
            "has_heading": group1["has_heading"] or group2["has_heading"],
            "has_table": group1["has_table"] or group2["has_table"],
            "has_list": group1["has_list"] or group2["has_list"]
        }
    
    def _create_chunk_proposal(self, group: Dict[str, Any], order: int, rules: ChunkingRules) -> ChunkProposal:
        """그룹으로부터 청크 제안 생성"""
        sentences = group["sentences"]
        text = " ".join(s.text for s in sentences)
        
        # 품질 검사
        warnings = self._check_chunk_quality(group, rules)
        
        # 헤딩 경로 추출
        heading_path = [s.text for s in sentences if s.is_heading]
        
        # 이미지 참조 통합 (프로덕션 개선)
        image_refs = self._consolidate_image_refs(sentences)
        
        # 페이지 범위 계산
        pages = [s.page for s in sentences if s.page is not None]
        page_start = min(pages) if pages else None
        page_end = max(pages) if pages else None
        
        return ChunkProposal(
            chunk_id=str(uuid.uuid4()),
            order=order,
            text=text,
            token_estimate=group["total_tokens"],
            page_start=page_start,
            page_end=page_end,
            heading_path=heading_path if heading_path else None,
            sentences=sentences,
            quality_warnings=warnings,
            image_refs=image_refs
        )
    
    def _check_chunk_quality(self, group: Dict[str, Any], rules: ChunkingRules) -> List[QualityWarning]:
        """청크 품질 검사"""
        warnings = []
        total_tokens = group["total_tokens"]
        sentences = group["sentences"]
        
        # 너무 긴 청크
        if total_tokens > rules.max_tokens * 1.1:
            warnings.append(QualityWarning(
                issue_type=ChunkQualityIssue.TOO_LONG,
                severity="warning",
                message=f"청크가 너무 깁니다 ({total_tokens} > {rules.max_tokens} 토큰)",
                suggestion="경계 조정 권장 - 청크를 분할하거나 최대 토큰 수를 늘려보세요"
            ))
        
        # 너무 짧은 청크 (표/목록 예외 고려)
        is_special_content = group.get("has_table", False) or group.get("has_list", False)
        if total_tokens < rules.min_tokens and not rules.drop_short_chunks and not is_special_content:
            warnings.append(QualityWarning(
                issue_type=ChunkQualityIssue.TOO_SHORT,
                severity="warning",
                message=f"청크가 너무 짧습니다 ({total_tokens} < {rules.min_tokens} 토큰)",
                suggestion="인접 청크와 병합하거나 최소 토큰 수를 줄여보세요"
            ))
        
        # 내용이 없는 청크
        if not sentences or all(not s.text.strip() for s in sentences):
            warnings.append(QualityWarning(
                issue_type=ChunkQualityIssue.NO_CONTENT,
                severity="error",
                message="청크에 유효한 내용이 없습니다",
                suggestion="이 청크를 제거하거나 다른 청크와 병합하세요"
            ))
        
        # 헤딩 경계 위반 검사
        has_heading = group.get("has_heading", False)
        if has_heading and len(sentences) > 1:
            # 헤딩이 중간에 있는지 확인
            heading_positions = [i for i, s in enumerate(sentences) if s.is_heading]
            if heading_positions and (heading_positions[0] > 0 or heading_positions[-1] < len(sentences) - 1):
                warnings.append(QualityWarning(
                    issue_type=ChunkQualityIssue.HEADING_BOUNDARY,
                    severity="warning",
                    message="헤딩 경계 위반 - 헤딩 직후/직전에 청크 경계가 없음",
                    suggestion="헤딩 경계 스냅 버튼을 사용하여 경계를 조정하세요"
                ))
        
        # 고립된 캡션 검사
        text_content = " ".join(s.text for s in sentences)
        if self._is_isolated_caption(text_content):
            warnings.append(QualityWarning(
                issue_type=ChunkQualityIssue.ISOLATED_CAPTION,
                severity="warning",
                message="표/그림 캡션이 고립되어 있습니다",
                suggestion="인접 문단과 병합을 권장합니다"
            ))
        
        return warnings
    
    def _is_isolated_caption(self, text: str) -> bool:
        """캡션만 있는 청크인지 판단"""
        text_lower = text.lower().strip()
        
        # 캡션 패턴들
        caption_patterns = [
            r'^\s*(그림|figure|fig\.?)\s*\d+',  # 그림 1, Figure 1, Fig. 1
            r'^\s*(표|table|tab\.?)\s*\d+',     # 표 1, Table 1, Tab. 1
            r'^\s*(도|chart)\s*\d+',            # 도 1, Chart 1
            r'^\s*<.*>$',                       # <캡션 텍스트>
        ]
        
        for pattern in caption_patterns:
            if re.match(pattern, text_lower):
                return True
        
        # 짧고 설명적인 텍스트 (캡션 가능성)
        if len(text.split()) < 10 and ('설명' in text or '보여주' in text or '나타내' in text):
            return True
        
        return False
    
    def _calculate_text_similarity(self, text1: str, text2: str) -> float:
        """프로덕션 수준 텍스트 유사도 계산 (MinHash/SimHash 우선, 코사인 폴백)"""
        if not text1.strip() or not text2.strip():
            return 0.0
        
        try:
            # MinHash 시도 (더 빠르고 정확)
            return self._calculate_minhash_similarity(text1, text2)
        except:
            # 폴백: 코사인 유사도
            return self._calculate_cosine_similarity(text1, text2)
    
    def _calculate_minhash_similarity(self, text1: str, text2: str) -> float:
        """MinHash 기반 유사도 (프로덕션용) - 설정 기반 폴백 제어"""
        try:
            from datasketch import MinHash
            
            # 문서를 shingle 단위로 분할 (3-gram)
            def get_shingles(text: str, k: int = 3) -> set:
                words = text.lower().split()
                if len(words) < k:
                    return {' '.join(words)}
                return {' '.join(words[i:i+k]) for i in range(len(words) - k + 1)}
            
            shingles1 = get_shingles(text1)
            shingles2 = get_shingles(text2)
            
            # MinHash 객체 생성
            mh1, mh2 = MinHash(), MinHash()
            
            # 문자열을 바이트로 인코딩하여 추가
            for shingle in shingles1:
                mh1.update(shingle.encode('utf8'))
            for shingle in shingles2:
                mh2.update(shingle.encode('utf8'))
            
            return mh1.jaccard(mh2)
            
        except ImportError:
            # 설정 기반 폴백 제어
            fallback_settings = self._get_fallback_settings()
            if fallback_settings.get("enable_similarity_fallback", False):
                logger.warning("datasketch 미설치 - 설정에 따라 코사인 유사도 폴백 사용")
                return self._calculate_cosine_similarity(text1, text2)
            else:
                error_msg = "datasketch 패키지가 필요합니다. pip install datasketch로 설치하거나 설정에서 폴백을 활성화하세요."
                logger.error(error_msg)
                if fallback_settings.get("strict_mode", True):
                    raise RuntimeError(error_msg)
                return 0.0
        except Exception as e:
            # 설정 기반 폴백 제어
            fallback_settings = self._get_fallback_settings()
            if fallback_settings.get("enable_similarity_fallback", False):
                logger.error(f"MinHash 계산 실패: {e} - 설정에 따라 코사인 유사도 폴백 사용")
                return self._calculate_cosine_similarity(text1, text2)
            else:
                error_msg = f"MinHash 계산 실패: {e}. 설정에서 폴백을 활성화하거나 datasketch 패키지를 재설치하세요."
                logger.error(error_msg)
                if fallback_settings.get("strict_mode", True):
                    raise RuntimeError(error_msg)
                return 0.0
    
    def _calculate_cosine_similarity(self, text1: str, text2: str) -> float:
        """코사인 유사도 계산 (폴백)"""
        # 단어 빈도 계산
        words1 = Counter(text1.lower().split())
        words2 = Counter(text2.lower().split())
        
        # 공통 단어
        common_words = set(words1.keys()) & set(words2.keys())
        if not common_words:
            return 0.0
        
        # 코사인 유사도 계산
        dot_product = sum(words1[word] * words2[word] for word in common_words)
        magnitude1 = math.sqrt(sum(count ** 2 for count in words1.values()))
        magnitude2 = math.sqrt(sum(count ** 2 for count in words2.values()))
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        return dot_product / (magnitude1 * magnitude2)
    
    def check_duplicate_chunks(self, chunks: List[ChunkProposal]) -> List[QualityWarning]:
        """청크 간 중복 검사 (PRD2: 단어 기반 중복 검사 포함)"""
        warnings = []
        
        for i in range(len(chunks) - 1):
            current_chunk = chunks[i]
            next_chunk = chunks[i + 1]
            
            # 1. 기존 전체 유사도 검사 (정밀 검사)
            similarity = self._calculate_text_similarity(current_chunk.text, next_chunk.text)
            
            # 2. PRD2: 단어 기반 겹침율 검사 (빠른 검사)
            word_overlap_ratio = self._calculate_word_overlap_ratio(current_chunk.text, next_chunk.text)
            
            # 3. 중복 판정 기준 (둘 중 하나라도 임계값 초과 시)
            high_similarity = similarity > 0.95
            high_word_overlap = word_overlap_ratio > 0.85
            
            if high_similarity or high_word_overlap:
                # 더 높은 값을 기준으로 경고 메시지 생성
                if high_similarity and similarity >= word_overlap_ratio:
                    main_score = similarity
                    method = "전체 유사도"
                else:
                    main_score = word_overlap_ratio
                    method = "단어 겹침율"
                
                warnings.append(QualityWarning(
                    issue_type=ChunkQualityIssue.DUPLICATE_CONTENT,
                    severity="warning",
                    message=f"연속 청크 간 높은 중복 감지 ({method}: {main_score:.2f})",
                    suggestion="병합 또는 하나 제거를 고려하세요"
                ))
        
        return warnings
    
    def _calculate_word_overlap_ratio(self, text1: str, text2: str) -> float:
        """PRD2: 단어 기반 겹침율 계산 (빠른 중복 검사)"""
        if not text1.strip() or not text2.strip():
            return 0.0
        
        try:
            # 단어 집합 생성 (소문자 변환, 중복 제거)
            words1 = set(re.findall(r'\w+', text1.lower()))
            words2 = set(re.findall(r'\w+', text2.lower()))
            
            if not words1 or not words2:
                return 0.0
            
            # 교집합과 합집합 계산
            intersection = len(words1 & words2)
            union = len(words1 | words2)
            
            if union == 0:
                return 0.0
            
            # Jaccard 유사도 (교집합 / 합집합)
            overlap_ratio = intersection / union
            
            logger.debug(f"단어 겹침율 계산: {intersection}/{union} = {overlap_ratio:.3f}")
            return overlap_ratio
            
        except Exception as e:
            logger.error(f"단어 겹침율 계산 실패: {e}")
            return 0.0
    
    def merge_chunks(self, chunk1: ChunkProposal, chunk2: ChunkProposal, rules: ChunkingRules) -> ChunkProposal:
        """두 청크 병합"""
        # 문장 리스트 병합
        sentences1 = chunk1.sentences or []
        sentences2 = chunk2.sentences or []
        merged_sentences = sentences1 + sentences2
        
        # 병합된 그룹 생성
        merged_group = self._create_group_from_sentences(merged_sentences)
        
        # 새로운 청크 제안 생성
        merged_chunk = self._create_chunk_proposal(
            merged_group, 
            min(chunk1.order, chunk2.order), 
            rules
        )
        
        # 편집 로그 추가 (프로덕션 개선)
        merged_chunk.add_edit_log("merge", chunk_ids=[chunk1.chunk_id, chunk2.chunk_id])
        
        return merged_chunk
    
    def split_chunk(self, chunk: ChunkProposal, split_position: int, rules: ChunkingRules) -> Tuple[ChunkProposal, ChunkProposal]:
        """청크를 문장 기준으로 분할"""
        if not chunk.sentences or split_position <= 0 or split_position >= len(chunk.sentences):
            raise ValueError("유효하지 않은 분할 위치입니다")
        
        # 문장 분할
        sentences1 = chunk.sentences[:split_position]
        sentences2 = chunk.sentences[split_position:]
        
        # 두 그룹 생성
        group1 = self._create_group_from_sentences(sentences1)
        group2 = self._create_group_from_sentences(sentences2)
        
        # 새로운 청크 제안들 생성
        chunk1 = self._create_chunk_proposal(group1, chunk.order, rules)
        chunk2 = self._create_chunk_proposal(group2, chunk.order + 1, rules)
        
        # 편집 로그 추가 (프로덕션 개선)
        chunk1.add_edit_log("split", original_chunk_id=chunk.chunk_id, split_position=split_position, part="first")
        chunk2.add_edit_log("split", original_chunk_id=chunk.chunk_id, split_position=split_position, part="second")
        
        return chunk1, chunk2
    
    def snap_to_heading_boundaries(self, chunks: List[ChunkProposal], rules: ChunkingRules) -> List[ChunkProposal]:
        """헤딩 경계 위반을 자동 수정 (프로덕션 개선)"""
        if not chunks:
            return chunks
        
        corrected_chunks = []
        i = 0
        
        while i < len(chunks):
            current_chunk = chunks[i]
            
            # 헤딩 경계 위반 검사
            if self._has_heading_boundary_violation(current_chunk):
                logger.info(f"청크 {current_chunk.order}의 헤딩 경계 위반 자동 수정 시작")
                
                # 헤딩 위치 기준으로 재분할
                corrected = self._split_by_heading_boundaries(current_chunk, rules)
                corrected_chunks.extend(corrected)
                
                # 청크 번호 재정렬
                for j, chunk in enumerate(corrected):
                    chunk.order = len(corrected_chunks) - len(corrected) + j + 1
                    chunk.add_edit_log("heading_boundary_snap", auto_correction=True)
                
                logger.info(f"헤딩 경계 수정 완료: 1개 → {len(corrected)}개 청크로 분할")
            else:
                corrected_chunks.append(current_chunk)
            
            i += 1
        
        return corrected_chunks
    
    def _has_heading_boundary_violation(self, chunk: ChunkProposal) -> bool:
        """헤딩 경계 위반 여부 검사 (프로덕션 개선)"""
        if not chunk.sentences or len(chunk.sentences) <= 1:
            return False
        
        heading_positions = [i for i, s in enumerate(chunk.sentences) if s.is_heading]
        if not heading_positions:
            return False
        
        # 첫 번째 헤딩이 첫 문장이 아니거나, 마지막 헤딩이 마지막 문장이 아님
        return (heading_positions[0] > 0 or heading_positions[-1] < len(chunk.sentences) - 1)
    
    def _split_by_heading_boundaries(self, chunk: ChunkProposal, rules: ChunkingRules) -> List[ChunkProposal]:
        """헤딩 경계 기준으로 청크 재분할 (프로덕션 개선)"""
        if not chunk.sentences:
            return [chunk]
        
        # 헤딩 위치 찾기
        heading_positions = [i for i, s in enumerate(chunk.sentences) if s.is_heading]
        if not heading_positions:
            return [chunk]
        
        # 분할 지점 결정 (각 헤딩 직전에서 분할)
        split_points = []
        for pos in heading_positions:
            if pos > 0:  # 첫 번째 헤딩이 아닌 경우만
                split_points.append(pos)
        
        if not split_points:
            return [chunk]
        
        # 실제 분할 수행
        chunks = []
        start = 0
        
        for split_point in split_points:
            if start < split_point:
                section_sentences = chunk.sentences[start:split_point]
                section_chunk = self._create_chunk_from_sentences(section_sentences, chunk.order, rules)
                chunks.append(section_chunk)
            start = split_point
        
        # 마지막 섹션
        if start < len(chunk.sentences):
            section_sentences = chunk.sentences[start:]
            section_chunk = self._create_chunk_from_sentences(section_sentences, chunk.order, rules)
            chunks.append(section_chunk)
        
        return chunks
    
    def _force_split_sentence(self, sentence: SentenceInfo, rules: ChunkingRules) -> List[SentenceInfo]:
        """PRD2: 긴 문장을 강제 분절 (공백 기준 n등분)"""
        if sentence.tokens <= rules.hard_sentence_max_tokens:
            return [sentence]
        
        try:
            # 단어 단위로 분할
            words = sentence.text.split()
            if len(words) <= 1:
                # 분할 불가능한 경우 원본 반환 (URL, 긴 단어 등)
                logger.warning(f"분할 불가능한 긴 문장: {sentence.text[:100]}...")
                return [sentence]
            
            # 필요한 분할 수 계산
            approx_splits = max(1, sentence.tokens // rules.hard_sentence_max_tokens)
            words_per_split = max(1, len(words) // (approx_splits + 1))
            
            logger.debug(f"문장 분절: {len(words)}개 단어를 {approx_splits + 1}개 조각으로 분할 (조각당 ~{words_per_split}개 단어)")
            
            split_sentences = []
            current_words = []
            
            for i, word in enumerate(words):
                current_words.append(word)
                
                # 조각 완성 조건: 지정된 단어 수에 도달하거나 마지막 단어
                if (len(current_words) >= words_per_split and i < len(words) - 1) or i == len(words) - 1:
                    segment_text = " ".join(current_words).strip()
                    
                    if segment_text:
                        # 새로운 SentenceInfo 생성 (기본 속성 유지)
                        segment_tokens = self.token_counter.count_tokens(segment_text)
                        
                        split_sentence = SentenceInfo(
                            text=segment_text,
                            tokens=segment_tokens,
                            page=sentence.page,
                            is_heading=sentence.is_heading and len(split_sentences) == 0,  # 첫 조각만 헤딩 유지
                            is_list_item=sentence.is_list_item,
                            is_table_content=sentence.is_table_content,
                            index=sentence.index + len(split_sentences),  # 인덱스 조정
                            heading_level=sentence.heading_level if len(split_sentences) == 0 else None,
                            heading_path=sentence.heading_path,
                            bbox=sentence.bbox,  # bbox는 원본 유지 (근사치)
                            image_refs=sentence.image_refs if len(split_sentences) == 0 else []  # 첫 조각만 이미지 유지
                        )
                        
                        split_sentences.append(split_sentence)
                        current_words = []
            
            logger.info(f"문장 강제 분절 완료: 1개 → {len(split_sentences)}개 조각")
            return split_sentences
            
        except Exception as e:
            logger.error(f"문장 강제 분절 실패: {e} - 원본 반환")
            return [sentence]
    
    def _create_chunk_from_sentences(self, sentences: List[SentenceInfo], base_order: int, rules: ChunkingRules) -> ChunkProposal:
        """문장 리스트로부터 새 청크 생성 (프로덕션 개선)"""
        if not sentences:
            raise ValueError("빈 문장 리스트로는 청크를 생성할 수 없습니다")
        
        group = self._create_group_from_sentences(sentences)
        return self._create_chunk_proposal(group, base_order, rules)


# 전역 서비스 인스턴스
chunking_service = SmartChunkingService()