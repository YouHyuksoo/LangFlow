# 커스텀 컴포넌트

이 디렉토리는 프로젝트 특화 커스텀 컴포넌트들을 저장합니다.

## 커스텀 컴포넌트 예제

### PDF 처리 컴포넌트

- **PDFTextExtractorNode**: PDF에서 텍스트 추출
- **PDFChunkerNode**: PDF 텍스트 청킹
- **PDFEmbeddingNode**: PDF 임베딩 생성

### RAG 특화 컴포넌트

- **DocumentRetrieverNode**: 문서 검색
- **ContextBuilderNode**: 컨텍스트 구성
- **AnswerGeneratorNode**: 답변 생성

### 통계 컴포넌트

- **UsageTrackerNode**: 사용량 추적
- **PerformanceMonitorNode**: 성능 모니터링
- **AnalyticsNode**: 분석 데이터 생성

## 컴포넌트 개발 가이드

### 1. 컴포넌트 구조

```python
from langflow import CustomComponent
from typing import Dict, Any

class CustomNode(CustomComponent):
    display_name = "커스텀 노드"
    description = "커스텀 노드 설명"

    def build(self, **kwargs) -> Dict[str, Any]:
        # 컴포넌트 로직 구현
        return {"output": "result"}
```

### 2. 컴포넌트 등록

```python
# components/__init__.py
from .custom_node import CustomNode

__all__ = ["CustomNode"]
```

### 3. 컴포넌트 사용

- Langflow GUI에서 커스텀 컴포넌트 선택
- Flow에 추가하여 사용
- API를 통해 프로그래밍 방식으로 사용

## 파일 구조

```
custom_components/
├── README.md              # 이 파일
├── pdf_components/        # PDF 처리 컴포넌트
├── rag_components/        # RAG 특화 컴포넌트
├── analytics_components/  # 분석 컴포넌트
└── utils/                # 유틸리티 컴포넌트
```

## 개발 가이드라인

1. **명명 규칙**: `{기능}_{타입}Node` 형식
2. **문서화**: 각 컴포넌트에 대한 상세한 문서 작성
3. **테스트**: 단위 테스트 및 통합 테스트 작성
4. **버전 관리**: 컴포넌트 버전 관리 및 호환성 유지
