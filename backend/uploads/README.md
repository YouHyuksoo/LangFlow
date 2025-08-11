# 업로드된 파일 저장소

이 디렉토리는 사용자가 업로드한 PDF 파일들을 저장합니다.

## 파일 구조

```
uploads/
├── README.md              # 이 파일
├── {file_id}_{filename}.pdf  # 업로드된 PDF 파일들
└── temp/                  # 임시 파일들
```

## 파일명 규칙

업로드된 파일은 다음 형식으로 저장됩니다:

- `{file_id}_{original_filename}.pdf`
- 예: `550e8400-e29b-41d4-a716-446655440000_document.pdf`

## 파일 처리 과정

1. **업로드**: 사용자가 PDF 파일 업로드
2. **검증**: 파일 형식 및 크기 검증
3. **저장**: 고유 ID와 함께 파일 저장
4. **벡터화**: PDF 텍스트 추출 및 벡터화
5. **인덱싱**: 벡터 데이터베이스에 인덱싱

## 보안 고려사항

- 파일 크기 제한: 10MB
- 허용된 확장자: .pdf만
- 파일명 보안: 특수문자 필터링
- 접근 권한: 인증된 사용자만 접근

## 관리 방법

### 파일 업로드

```bash
# API를 통한 파일 업로드
curl -X POST "http://localhost:8000/api/v1/files/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@document.pdf"
```

### 파일 목록 조회

```bash
# 업로드된 파일 목록 조회
curl -X GET "http://localhost:8000/api/v1/files/"
```

### 파일 삭제

```bash
# 특정 파일 삭제
curl -X DELETE "http://localhost:8000/api/v1/files/{file_id}"
```

## 백업 및 복구

- 정기적인 파일 백업 권장
- 벡터 데이터베이스와 함께 백업
- 파일 메타데이터 데이터베이스 백업
