# Langflow 디렉토리

이 디렉토리는 Langflow Flow와 컴포넌트를 관리하는 저장소입니다.

## 디렉토리 구조

```
langflow/
├── flows/              # Flow JSON 파일들
│   ├── README.md       # Flow 관리 가이드
│   └── example_flow.json # 예제 Flow 파일
├── components/         # 기본 컴포넌트
│   └── README.md       # 컴포넌트 설명
├── custom_components/  # 커스텀 컴포넌트
│   └── README.md       # 커스텀 컴포넌트 설명
└── README.md          # 이 파일
```

## Flow 파일 형식

Flow 파일은 JSON 형식으로 저장되며, 다음과 같은 구조를 가집니다:

```json
{
  "name": "Flow 이름",
  "description": "Flow 설명",
  "nodes": [
    {
      "id": "node_id",
      "type": "node_type",
      "data": {
        "node_data": "value"
      },
      "position": {
        "x": 100,
        "y": 100
      }
    }
  ],
  "edges": [
    {
      "id": "edge_id",
      "source": "source_node_id",
      "target": "target_node_id"
    }
  ]
}
```

## 파일명 규칙

Flow 파일은 다음 형식으로 저장됩니다:

- `{flow_id}_{flow_name}.json`
- 예: `550e8400-e29b-41d4-a716-446655440000_rag_chat_flow.json`

## 사용 방법

1. **Flow 생성**: Langflow GUI에서 Flow를 설계하고 JSON으로 내보내기
2. **Flow 업로드**: API를 통해 Flow JSON 파일 업로드
3. **Flow 실행**: API를 통해 저장된 Flow 실행
4. **Flow 관리**: Flow 목록 조회, 수정, 삭제
