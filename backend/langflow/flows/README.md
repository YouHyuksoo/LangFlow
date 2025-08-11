# Flow 저장소

이 디렉토리는 Langflow Flow JSON 파일들을 저장합니다.

## 파일명 규칙

Flow 파일은 다음 형식으로 저장됩니다:

- `{flow_id}_{flow_name}.json`
- 예: `550e8400-e29b-41d4-a716-446655440000_rag_chat_flow.json`

## Flow 파일 구조

```json
{
  "name": "RAG Chat Flow",
  "description": "문서 기반 질문-답변 Flow",
  "nodes": [
    {
      "id": "input_node",
      "type": "InputNode",
      "data": {
        "input_type": "text",
        "placeholder": "질문을 입력하세요"
      },
      "position": {
        "x": 100,
        "y": 100
      }
    },
    {
      "id": "vector_search_node",
      "type": "VectorSearchNode",
      "data": {
        "collection_name": "documents",
        "top_k": 5
      },
      "position": {
        "x": 300,
        "y": 100
      }
    },
    {
      "id": "llm_node",
      "type": "LLMNode",
      "data": {
        "model": "gpt-4",
        "temperature": 0.7,
        "max_tokens": 1000
      },
      "position": {
        "x": 500,
        "y": 100
      }
    }
  ],
  "edges": [
    {
      "id": "edge1",
      "source": "input_node",
      "target": "vector_search_node"
    },
    {
      "id": "edge2",
      "source": "vector_search_node",
      "target": "llm_node"
    }
  ]
}
```

## 관리 방법

1. **Flow 생성**: Langflow GUI에서 Flow를 설계
2. **Flow 내보내기**: JSON 형식으로 내보내기
3. **Flow 업로드**: API를 통해 파일 업로드
4. **Flow 실행**: API를 통해 Flow 실행
5. **Flow 관리**: 목록 조회, 수정, 삭제

## 예제 Flow

- `example_rag_flow.json`: 기본 RAG Flow 예제
- `example_chat_flow.json`: 채팅 Flow 예제
- `example_analysis_flow.json`: 문서 분석 Flow 예제
