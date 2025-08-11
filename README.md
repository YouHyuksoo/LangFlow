# Langflow RAG System

사내 지식관리 AI 도우미 시스템

## 프로젝트 개요

Langflow 기반의 사내 RAG(Retrieval Augmented Generation) 시스템으로, PDF 문서를 업로드하고 AI를 통해 질문-답변 서비스를 제공합니다.

## 기술 스택

### 백엔드

- **FastAPI**: Python 웹 프레임워크
- **Langflow**: RAG Flow 설계 및 실행
- **LangChain**: LLM 통합
- **OpenAI GPT-4o**: 대화형 AI 모델
- **FAISS/ChromaDB**: 벡터 데이터베이스
- **Supabase**: 사용자 및 로그 관리
- **Pydantic**: 데이터 검증

### 프론트엔드

- **Next.js 14**: React 프레임워크
- **shadcn/ui**: UI 컴포넌트 라이브러리
- **Tailwind CSS**: 스타일링
- **TypeScript**: 타입 안전성

## 주요 기능

### 사용자 기능

- 📄 **PDF 문서 업로드**: 벡터화 및 인덱싱
- 💬 **AI 채팅**: 문서 기반 질문-답변
- 🔍 **문서 검색**: 관련 문서 검색
- 📊 **통계 대시보드**: 사용 현황 확인

### 관리자 기능

- ⚙️ **Flow 관리**: Langflow Flow 설계 및 관리
- 📈 **성능 모니터링**: 시스템 성능 추적
- 👥 **사용자 관리**: 사용자 권한 및 활동 관리
- 📋 **로그 분석**: 사용 패턴 분석

## 프로젝트 구조

```
LangFlow/
├── backend/                 # FastAPI 백엔드
│   ├── app/
│   │   ├── api/            # API 라우터
│   │   │   ├── chat.py     # 채팅 API
│   │   │   ├── files.py    # 파일 관리 API
│   │   │   ├── flows.py    # Flow 관리 API
│   │   │   └── stats.py    # 통계 API
│   │   ├── core/           # 핵심 설정
│   │   │   └── config.py   # 환경 변수 관리
│   │   ├── models/         # 데이터 모델
│   │   │   └── schemas.py  # Pydantic 스키마
│   │   ├── services/       # 비즈니스 로직
│   │   │   ├── chat_service.py
│   │   │   ├── file_service.py
│   │   │   └── flow_service.py
│   │   └── utils/          # 유틸리티
│   ├── langflow/           # Langflow Flow 저장소
│   │   ├── flows/          # Flow JSON 파일들
│   │   ├── components/     # 기본 컴포넌트
│   │   └── custom_components/ # 커스텀 컴포넌트
│   ├── uploads/            # 업로드된 PDF 파일들
│   ├── vector_db/          # 벡터 데이터베이스
│   ├── main.py             # FastAPI 애플리케이션
│   ├── requirements.txt    # Python 의존성
│   └── env.example        # 환경 변수 예제
├── frontend/               # Next.js 프론트엔드
│   ├── app/               # App Router
│   ├── components/        # React 컴포넌트
│   ├── lib/              # 유틸리티 함수
│   └── package.json      # Node.js 의존성
├── package.json           # 프로젝트 스크립트
└── README.md             # 프로젝트 문서
```

## 설치 및 실행

### 1. 의존성 설치

```bash
# 루트 디렉토리에서
npm install

# 백엔드 의존성 설치
cd backend
pip install -r requirements.txt

# 프론트엔드 의존성 설치
cd ../frontend
npm install
```

### 2. 환경 변수 설정

```bash
# 백엔드 환경 변수
cd backend
cp env.example .env
# .env 파일을 편집하여 API 키 등을 설정

# 프론트엔드 환경 변수
cd ../frontend
cp env.example .env.local
# .env.local 파일을 편집하여 API URL 등을 설정
```

### 3. 개발 서버 실행

```bash
# 루트 디렉토리에서 (백엔드 + 프론트엔드 동시 실행)
npm run dev

# 또는 개별 실행
npm run dev:backend  # 백엔드만
npm run dev:frontend # 프론트엔드만
```

## 시스템 아키텍처

### 백엔드 개발

```
backend/
├── app/
│   ├── api/          # REST API 엔드포인트
│   ├── core/         # 설정 및 유틸리티
│   ├── models/       # Pydantic 데이터 모델
│   ├── services/     # 비즈니스 로직
│   └── utils/        # 헬퍼 함수
├── langflow/         # Langflow Flow 저장소
├── uploads/          # 업로드된 파일
└── vector_db/        # 벡터 데이터베이스
```

### 프론트엔드 개발

```
frontend/
├── app/              # Next.js App Router
├── components/       # 재사용 가능한 컴포넌트
│   └── ui/          # shadcn/ui 컴포넌트
└── lib/             # 유틸리티 함수
```

## 환경 변수

### 백엔드 (.env)

```env
# OpenAI API 설정
OPENAI_API_KEY=your_openai_api_key_here

# Supabase 설정
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here

# 벡터 DB 설정
VECTOR_DB_TYPE=faiss
VECTOR_DB_PATH=./vector_db

# 서버 설정
HOST=0.0.0.0
PORT=8000
DEBUG=true

# 파일 업로드 설정
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Langflow 설정
LANGFLOW_DIR=./langflow
FLOWS_DIR=./langflow/flows
COMPONENTS_DIR=./langflow/components
CUSTOM_COMPONENTS_DIR=./langflow/custom_components
```

### 프론트엔드 (.env.local)

```env
# API 설정
NEXT_PUBLIC_API_URL=http://localhost:8000

# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# 개발 설정
NODE_ENV=development
```

## Langflow Flow 관리

### Flow 저장소 구조

```
backend/langflow/
├── flows/              # Flow JSON 파일들
│   ├── {flow_id}_{name}.json
│   └── ...
├── components/         # 기본 컴포넌트
└── custom_components/  # 커스텀 컴포넌트
```

### Flow API 엔드포인트

- `POST /api/v1/flows/load` - Flow 로드
- `POST /api/v1/flows/import` - Flow 파일 가져오기
- `GET /api/v1/flows/` - Flow 목록 조회
- `GET /api/v1/flows/{flow_id}` - Flow 정보 조회
- `POST /api/v1/flows/{flow_id}/execute` - Flow 실행
- `PUT /api/v1/flows/{flow_id}` - Flow 업데이트
- `DELETE /api/v1/flows/{flow_id}` - Flow 삭제
- `GET /api/v1/flows/{flow_id}/export` - Flow 내보내기
- `GET /api/v1/flows/{flow_id}/nodes` - Flow 노드 정보
- `GET /api/v1/flows/statistics` - Flow 통계

### Flow 파일 형식

Flow는 JSON 형식으로 저장되며, Langflow의 표준 Flow 구조를 따릅니다:

```json
{
  "name": "Flow 이름",
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

## 다음 단계

1. **환경 변수 설정**: API 키 및 데이터베이스 연결 정보 설정
2. **Langflow Flow 설계**: RAG 시스템을 위한 Flow 구성
3. **벡터 DB 설정**: FAISS 또는 ChromaDB 설정
4. **커스텀 컴포넌트 개발**: 프로젝트 특화 컴포넌트 추가
5. **테스트 및 배포**: 시스템 테스트 및 프로덕션 배포

## 참고 자료

- [Langflow 공식 문서](https://docs.langflow.org/)
- [FastAPI 공식 문서](https://fastapi.tiangolo.com/)
- [Next.js 공식 문서](https://nextjs.org/docs)
- [shadcn/ui 컴포넌트](https://ui.shadcn.com/)
"# LangFlow" 
