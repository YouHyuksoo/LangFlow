# 레이아웃 작업 가이드라인

## 🚨 중요한 교훈: 레이아웃 작업 시 주의사항

### 문제가 되었던 접근 방식들
1. **무작정 CSS 속성 변경**: 문제 원인 파악 없이 `h-screen`, `min-h-screen`, `overflow` 등을 임의로 변경
2. **JavaScript DOM 조작**: `document.body.style.overflow` 같은 직접적인 DOM 조작 시도
3. **복합적 수정**: 여러 부분을 동시에 수정하여 문제 원인 파악 어려움
4. **되돌리기 없는 실험**: 실패했을 때 원상복구하지 않고 계속 다른 시도

### ✅ 올바른 레이아웃 작업 절차

#### 1. 문제 정확히 파악하기
- **현상**: 무엇이 문제인지 구체적으로 파악
- **원인**: 어떤 CSS 속성이나 레이아웃 구조가 문제인지 분석
- **범위**: 영향받는 영역과 컴포넌트 확인

#### 2. 단계별 접근
1. **현재 상태 백업**: 문제가 생기면 즉시 되돌릴 수 있도록
2. **최소한의 변경**: 한 번에 하나씩만 수정
3. **테스트 후 다음 단계**: 각 변경사항의 효과를 확인한 후 진행

#### 3. CSS 우선, JavaScript 최후
- **CSS 레이아웃 규칙 활용**: `flexbox`, `grid`, `position` 등으로 해결
- **JavaScript는 최후의 수단**: DOM 직접 조작은 부작용 위험

## 🎯 성공한 레이아웃 패턴

### 관리자 페이지 3-영역 레이아웃
```tsx
// ✅ 성공한 구조
<div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
  {/* 1. 상단 네비게이션 - 고정 */}
  <div className="flex-shrink-0 z-50 h-16">
    {/* 네비게이션 영역 */}
  </div>
  
  {/* 2. 메인 영역 - 사이드바 + 콘텐츠 */}
  <div className="flex-1 flex overflow-hidden">
    
    {/* 2-1. 좌측 사이드바 - 독립 스크롤 */}
    <div className="lg:static flex flex-col">
      <div className="flex-shrink-0 h-16">{/* 사이드바 헤더 */}</div>
      <div className="flex-1 overflow-y-auto">{/* 사이드바 메뉴 */}</div>
    </div>
    
    {/* 2-2. 중앙 콘텐츠 - 독립 스크롤 */}
    <div className="flex-1 flex flex-col overflow-hidden">
      <main className="flex-1 bg-background overflow-y-auto">
        {children}
      </main>
    </div>
    
  </div>
</div>
```

### 핵심 원칙
1. **`fixed inset-0`**: 전체 뷰포트를 차지하여 외부 스크롤 방지
2. **`overflow-hidden`**: 외부 컨테이너는 스크롤 차단
3. **`overflow-y-auto`**: 내부 영역만 독립적 스크롤
4. **`flex-shrink-0`**: 고정 높이 영역은 축소 방지
5. **`flex-1`**: 나머지 공간을 차지하는 영역

## ❌ 피해야 할 실수들

### 1. 이중 스크롤바 만들기
```tsx
// ❌ 잘못된 예시 - 이중 스크롤 발생
<div className="min-h-screen"> {/* 외부 스크롤 생성 */}
  <main className="overflow-y-auto"> {/* 내부 스크롤 추가 */}
    {children}
  </main>
</div>
```

### 2. JavaScript로 DOM 조작
```tsx
// ❌ 피해야 할 방식
useEffect(() => {
  document.body.style.overflow = 'hidden'; // 부작용 위험
}, []);
```

### 3. 높이 설정 혼재
```tsx
// ❌ 혼란스러운 높이 설정
<div className="h-screen min-h-screen"> {/* 충돌 가능성 */}
<div style={{height: 'calc(100vh - 64px)'}} className="h-full"> {/* 중복/충돌 */}
```

## 🔧 문제 해결 체크리스트

### 스크롤 문제 발생 시
1. [ ] 전체 컨테이너의 높이 설정 확인 (`h-screen` vs `min-h-screen`)
2. [ ] 외부 컨테이너의 `overflow` 설정 확인
3. [ ] 내부 스크롤 영역의 `overflow-y-auto` 설정 확인
4. [ ] `flex-1`과 `flex-shrink-0` 적절한 사용 확인
5. [ ] 중첩된 레이아웃에서 높이 계산 충돌 확인

### 레이아웃 깨짐 발생 시
1. [ ] 한 번에 하나씩만 수정했는지 확인
2. [ ] 변경 전 상태로 되돌리기
3. [ ] 문제 원인을 정확히 파악한 후 재시도
4. [ ] CSS 우선, JavaScript 최후 원칙 준수

## 📝 작업 원칙

1. **이해 먼저**: 현재 구조를 완전히 이해한 후 수정
2. **점진적 개선**: 한 번에 하나씩, 단계별로 접근
3. **백업 습관**: 실패 시 되돌릴 수 있도록 준비
4. **테스트 철저**: 각 변경사항의 영향을 확인
5. **문서화**: 성공한 패턴은 기록하여 재활용

---
*이 가이드라인을 항상 참고하여 레이아웃 작업 시 혼란을 방지하고 체계적으로 접근하자.*