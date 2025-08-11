# 기본 컴포넌트

이 디렉토리는 Langflow의 기본 컴포넌트들을 저장합니다.

## 컴포넌트 종류

### 입력 컴포넌트

- **InputNode**: 사용자 입력 처리
- **FileInputNode**: 파일 입력 처리
- **TextInputNode**: 텍스트 입력 처리

### 처리 컴포넌트

- **LLMNode**: 대규모 언어 모델 처리
- **VectorSearchNode**: 벡터 검색
- **PromptTemplateNode**: 프롬프트 템플릿
- **TextSplitterNode**: 텍스트 분할
- **EmbeddingNode**: 임베딩 생성

### 출력 컴포넌트

- **OutputNode**: 결과 출력
- **TextOutputNode**: 텍스트 출력
- **FileOutputNode**: 파일 출력

### 유틸리티 컴포넌트

- **ConditionNode**: 조건 처리
- **LoopNode**: 반복 처리
- **MergeNode**: 데이터 병합
- **FilterNode**: 데이터 필터링

## 사용 방법

1. **컴포넌트 로드**: Langflow에서 기본 컴포넌트 자동 로드
2. **커스텀 컴포넌트**: `custom_components/` 디렉토리에 추가
3. **컴포넌트 확장**: 새로운 컴포넌트 개발 및 등록

## 컴포넌트 구조

```json
{
  "id": "component_id",
  "type": "ComponentType",
  "data": {
    "component_data": "value"
  },
  "position": {
    "x": 100,
    "y": 100
  }
}
```
