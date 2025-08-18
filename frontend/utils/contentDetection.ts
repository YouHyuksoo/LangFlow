/**
 * 다양한 콘텐츠 타입 감지 및 검증 유틸리티
 */

// 공통 정규식 상수들
const HTML_TAG_REGEX = /<\/?[a-z][\s\S]*>/i;
const HTML_STRUCTURE_REGEX = /<html[\s\S]*<\/html>/i;
const DOCTYPE_REGEX = /<!DOCTYPE\s+html/i;
const CODE_BLOCK_REGEX = /```[\s\S]*?```/g;
const INLINE_CODE_REGEX = /`[^`]+`/g;
const MARKDOWN_HEADER_REGEX = /^#{1,6}\s+.+$/m;
const SCRIPT_TAG_REGEX = /<script[^>]*>([\s\S]*?)<\/script>/gi;

// 타입 가드 함수들
function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isValidContentType(type: string): type is "html" | "markdown" | "code" | "json" | "xml" | "text" {
  return ["html", "markdown", "code", "json", "xml", "text"].includes(type);
}

function isValidConfidence(confidence: number): boolean {
  return typeof confidence === 'number' && confidence >= 0 && confidence <= 1;
}

export interface ContentDetectionResult {
  contentType: "html" | "markdown" | "code" | "json" | "xml" | "text";
  confidence: number;
  language?: string; // 코드 언어 (javascript, python, etc.)
  subType?: string; // 세부 타입 (snippet, full-file, etc.)
  sanitizedContent?: string;
  textContent?: string;
  metadata?: {
    lineCount: number;
    characterCount: number;
    hasCodeBlocks: boolean;
    hasMarkdownSyntax: boolean;
    detectedLanguages: string[];
  };
}

/**
 * 콘텐츠 타입을 자동으로 감지합니다
 */
export function detectContentType(content: string): ContentDetectionResult {
  if (!isValidString(content)) {
    return {
      contentType: "text",
      confidence: 0,
      textContent: String(content || ''),
    };
  }

  const trimmedContent = content.trim();

  // 강제 마크다운 처리: 모든 Assistant 응답을 마크다운으로 처리
  // 다음 조건 중 하나라도 만족하면 무조건 마크다운으로 처리:
  // 1. 볼드 텍스트가 포함된 경우 (**텍스트**)
  // 2. 이모지가 포함된 경우
  // 3. 구조화된 번호가 포함된 경우 (①②③)
  // 4. ASCII 테이블 문자가 포함된 경우 (│├└┌┐┘┴┬)
  // 5. 텍스트가 100자 이상인 경우 (긴 텍스트는 보통 구조화된 내용)
  
  const hasBold = /\*\*.*?\*\*/.test(trimmedContent);
  const hasEmoji = /[🔹📊📄💡📑📈📉🔍⭐✅❌🎯📝🔧⚡🚀🎨📋📌🔎💼🏢]/.test(trimmedContent);
  const hasStructuredNumbers = /[①②③④⑤⑥⑦⑧⑨⑩]/.test(trimmedContent);
  const hasAsciiTable = /[│├└┌┐┘┴┬─]/.test(trimmedContent);
  const isLongText = trimmedContent.length > 100;
  
  if (hasBold || hasEmoji || hasStructuredNumbers || hasAsciiTable || isLongText) {
    return {
      contentType: "markdown",
      confidence: 0.95, // 높은 신뢰도로 강제 설정
      subType: "forced",
      sanitizedContent: trimmedContent,
      textContent: extractTextFromMarkdown(trimmedContent),
      metadata: generateMetadata(trimmedContent),
    };
  }

  // HTML과 마크다운 동시 감지 (혼합 콘텐츠 처리)
  const htmlResult = detectHtmlContent(trimmedContent);
  const markdownResult = detectMarkdownContent(trimmedContent);
  
  // 혼합 콘텐츠 판단: HTML 태그와 마크다운 문법이 모두 있는 경우
  const hasSignificantHtml = htmlResult.confidence > 0.5;
  const hasSignificantMarkdown = markdownResult.confidence > 0.5;
  
  if (hasSignificantHtml && hasSignificantMarkdown) {
    // 혼합 콘텐츠: HTML이 더 구조적이면 HTML로, 마크다운이 더 많으면 마크다운으로
    const htmlTagCount = (trimmedContent.match(/<[^>]+>/g) || []).length;
    const markdownElementCount = (trimmedContent.match(/^[#*-`|]/gm) || []).length;
    
    console.log(`혼합 콘텐츠 감지 - HTML 태그: ${htmlTagCount}개, 마크다운 요소: ${markdownElementCount}개`);
    
    if (htmlTagCount > markdownElementCount) {
      return {
        contentType: "html",
        confidence: Math.max(htmlResult.confidence, 0.8),
        subType: "mixed",
        sanitizedContent: htmlResult.sanitizedHtml,
        textContent: htmlResult.textContent,
        metadata: generateMetadata(trimmedContent),
      };
    } else {
      return {
        contentType: "markdown",
        confidence: Math.max(markdownResult.confidence, 0.8),
        subType: "mixed",
        sanitizedContent: trimmedContent,
        textContent: markdownResult.textContent,
        metadata: generateMetadata(trimmedContent),
      };
    }
  }

  // 단일 콘텐츠 타입 처리 - 마크다운 우선순위 개선
  
  // 강력한 마크다운 지표가 있는 경우 HTML보다 우선
  if (markdownResult.confidence > 0.7) {
    return {
      contentType: "markdown",
      confidence: markdownResult.confidence,
      subType: markdownResult.subType,
      sanitizedContent: trimmedContent,
      textContent: markdownResult.textContent,
      metadata: generateMetadata(trimmedContent),
    };
  }

  if (htmlResult.confidence > 0.6) {
    return {
      contentType: "html",
      confidence: htmlResult.confidence,
      subType: htmlResult.htmlType,
      sanitizedContent: htmlResult.sanitizedHtml,
      textContent: htmlResult.textContent,
      metadata: generateMetadata(trimmedContent),
    };
  }

  // 일반 마크다운 처리 (HTML 체크 후)
  if (markdownResult.confidence > 0.5) {
    return {
      contentType: "markdown",
      confidence: markdownResult.confidence,
      subType: markdownResult.subType,
      sanitizedContent: trimmedContent,
      textContent: markdownResult.textContent,
      metadata: generateMetadata(trimmedContent),
    };
  }

  // 코드 감지
  const codeResult = detectCodeContent(trimmedContent);
  if (codeResult.confidence > 0.6) {
    return {
      contentType: "code",
      confidence: codeResult.confidence,
      language: codeResult.language,
      subType: codeResult.subType,
      sanitizedContent: trimmedContent,
      textContent: trimmedContent,
      metadata: generateMetadata(trimmedContent),
    };
  }

  // JSON 감지
  const jsonResult = detectJsonContent(trimmedContent);
  if (jsonResult.confidence > 0.8) {
    return {
      contentType: "json",
      confidence: jsonResult.confidence,
      language: "json",
      sanitizedContent: jsonResult.formatted,
      textContent: trimmedContent,
      metadata: generateMetadata(trimmedContent),
    };
  }

  // XML 감지
  const xmlResult = detectXmlContent(trimmedContent);
  if (xmlResult.confidence > 0.7) {
    return {
      contentType: "xml",
      confidence: xmlResult.confidence,
      language: "xml",
      sanitizedContent: trimmedContent,
      textContent: trimmedContent,
      metadata: generateMetadata(trimmedContent),
    };
  }

  // 기본값: 일반 텍스트
  return {
    contentType: "text",
    confidence: 1.0,
    textContent: trimmedContent,
    metadata: generateMetadata(trimmedContent),
  };
}

/**
 * HTML 콘텐츠 감지 (기존 함수 개선)
 */
function detectHtmlContent(content: string) {

  let confidence = 0;
  let htmlType: "full-page" | "snippet" | "mixed" | "none" = "none";

  if (DOCTYPE_REGEX.test(content) || HTML_STRUCTURE_REGEX.test(content)) {
    confidence = 0.95;
    htmlType = "full-page";
  } else if (HTML_TAG_REGEX.test(content)) {
    const tagCount = (content.match(/<\/?[a-z][^>]*>/gi) || []).length;
    const commonTags = [
      "div",
      "span",
      "p",
      "a",
      "img",
      "br",
      "hr",
      "h1",
      "h2",
      "h3",
    ];
    const hasCommonTags = commonTags.some((tag) =>
      new RegExp(`<${tag}(\\s|>|/>)`, "i").test(content)
    );

    if (tagCount >= 3 && hasCommonTags) {
      confidence = 0.8;
      htmlType = "snippet";
    } else if (tagCount >= 1) {
      confidence = 0.5;
      htmlType = "mixed";
    }
  }

  return {
    confidence,
    htmlType,
    sanitizedHtml: confidence > 0 ? sanitizeHtml(content) : undefined,
    textContent: confidence > 0 ? extractTextFromHtml(content) : content,
  };
}

/**
 * 마크다운 감지를 위한 텍스트 전처리
 */
function cleanContentForMarkdownDetection(content: string): string {
  // 텍스트 끝부분의 메타데이터 제거 (UUID, 숫자, 콤마 등으로 구성된 부분)
  // 예: ', 'a843dc62-a63b-455c-91d5-5e756579ee6b', 0.7, None, '7aed7515-1938-4fbe-b5d5-aa61f5e2e0aa', None, 30.705079793930054)'
  
  // 패턴 1: 긴 UUID와 숫자가 포함된 메타데이터 라인 제거
  let cleaned = content.replace(/,\s*'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}'.*$/gm, '');
  
  // 패턴 2: 끝부분의 숫자, None, 콤마로만 구성된 부분 제거
  cleaned = cleaned.replace(/,\s*\d+\.\d+.*?\)?\s*$/gm, '');
  
  // 패턴 3: 여러 개의 콤마와 None, 숫자가 섞인 패턴 제거
  cleaned = cleaned.replace(/,\s*(None|\d+(\.\d+)?),?\s*$/gm, '');
  
  // 패턴 4: 줄 끝의 불필요한 괄호와 콤마 제거
  cleaned = cleaned.replace(/[,\s\)]+$/, '');
  
  return cleaned.trim();
}

/**
 * 마크다운 테이블 감지 헬퍼 함수
 */
function detectMarkdownTable(content: string): boolean {
  return /^\s*\|.+\|\s*\n\s*\|[-:\s|]+\|\s*\n(?:\s*\|.+\|\s*\n?)+/m.test(content) ||
         /^\s*\|.*\|\s*$[\r\n]+^\s*\|[-:\s|]+\|\s*$[\r\n]+^\s*\|.*\|\s*$/m.test(content);
}

/**
 * 마크다운 콘텐츠 감지
 */
function detectMarkdownContent(content: string) {
  // 메타데이터가 포함된 텍스트 전처리
  const cleanedContent = cleanContentForMarkdownDetection(content);
  const markdownPatterns = [
    /^#{1,6}\s+.+$/m, // 헤더 (#, ##, ###)
    /\*\*.*?\*\*/, // 볼드 텍스트 (줄 시작 제한 제거)
    /_.*?_/, // 이탤릭 텍스트 (줄 시작 제한 제거)
    /^\s*[-*+]\s+.+$/m, // 리스트 (-, *, +) - 공백 허용
    /^\s*\d+\.\s+.+$/m, // 번호 리스트 - 공백 허용
    /```[\s\S]*?```/, // 코드 블록
    /`[^`]+`/, // 인라인 코드
    /\[.*?\]\(.*?\)/, // 링크
    /!\[.*?\]\(.*?\)/, // 이미지
    /^\s*>\s*.+$/m, // 인용문 - 공백 허용
    /^\s*\|.+\|\s*$/m, // 테이블 행 - 공백 허용
    /^\s*\|[-:\s|]+\|\s*$/m, // 테이블 구분선 - 공백 허용
    /^\s*\|.*\|\s*$[\r\n]+^\s*\|[-:\s|]+\|\s*$/m, // 테이블 헤더 + 구분선 조합
    /^-{3,}$/m, // 구분선 (3개 이상)
  ];

  let confidence = 0;
  let matchedPatterns = 0;

  markdownPatterns.forEach((pattern) => {
    if (pattern.test(cleanedContent)) {
      matchedPatterns++;
    }
  });

  // 기본 신뢰도 계산
  confidence = Math.min(matchedPatterns * 0.12, 0.95);
  
  // 테이블이 있는지 체크 (가장 강한 지표)
  const hasTable = detectMarkdownTable(cleanedContent);
  
  if (hasTable) {
    confidence = Math.max(confidence, 0.7); // 테이블이 있으면 최소 0.7 보장
    confidence += 0.2; // 추가 점수
  }

  // 코드 블록이 있으면 추가 점수
  if (CODE_BLOCK_REGEX.test(cleanedContent)) {
    confidence += 0.2;
    CODE_BLOCK_REGEX.lastIndex = 0; // 글로벌 플래그 리셋
  }

  // 헤더가 있으면 추가 점수
  if (MARKDOWN_HEADER_REGEX.test(cleanedContent)) {
    confidence += 0.15;
  }

  // 번호 리스트와 볼드 조합이 있는 경우 (LLM 응답에서 흔함)
  const hasNumberedListWithBold = /^\s*\d+\.\s+\*\*.*?\*\*/m.test(cleanedContent);
  if (hasNumberedListWithBold) {
    confidence = Math.max(confidence, 0.8); // 번호 리스트 + 볼드가 있으면 최소 0.8 보장
    confidence += 0.15; // 추가 점수
  }

  // 볼드 텍스트가 많은 경우 추가 점수
  const boldMatches = cleanedContent.match(/\*\*.*?\*\*/g) || [];
  if (boldMatches.length >= 3) {
    confidence += 0.1;
  } else if (boldMatches.length >= 1) {
    confidence += 0.05; // 볼드가 하나라도 있으면 약간의 점수
  }

  // 번호 리스트가 3개 이상인 경우 추가 점수
  const numberedListMatches = cleanedContent.match(/^\s*\d+\.\s+/gm) || [];
  if (numberedListMatches.length >= 3) {
    confidence += 0.15;
  }

  // 이모지와 볼드 조합 (📑 **제목** 형태)
  const emojiWithBold = /[📑📊📈📉🔍💡⭐✅❌🎯📝🔧⚡🚀🎨📋📌🔎💼🏢]\s*\*\*.*?\*\*/g.test(cleanedContent);
  if (emojiWithBold) {
    confidence += 0.2; // 이모지+볼드 조합은 강한 마크다운 지표
  }

  // 구조화된 텍스트 패턴 (① ② ③ 같은 번호 기호)
  const structuredPattern = /[①②③④⑤⑥⑦⑧⑨⑩]/g.test(cleanedContent);
  if (structuredPattern) {
    confidence += 0.15; // 구조화된 번호는 문서 스타일의 강한 지표
  }

  // 화살표와 함께 사용된 순서 표현 (→)
  const arrowPattern = /[①②③④⑤⑥⑦⑧⑨⑩].*?→.*?[①②③④⑤⑥⑦⑧⑨⑩]/g.test(cleanedContent);
  if (arrowPattern) {
    confidence += 0.1;
  }

  confidence = Math.min(confidence, 0.95);

  return {
    confidence,
    subType: confidence > 0.7 ? "structured" : "simple",
    textContent: extractTextFromMarkdown(cleanedContent),
  };
}

/**
 * 코드 콘텐츠 감지
 */
function detectCodeContent(content: string) {
  const codePatterns = {
    javascript: [
      /function\s+\w+\s*\(/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /=>\s*{/,
      /console\.log\(/,
      /require\s*\(/,
      /import\s+.*from/,
      /export\s+(default\s+)?/,
    ],
    python: [
      /def\s+\w+\s*\(/,
      /class\s+\w+/,
      /import\s+\w+/,
      /from\s+\w+\s+import/,
      /if\s+__name__\s*==\s*['"']__main__['"']/,
      /print\s*\(/,
      /^\s*#.*$/m,
    ],
    java: [
      /public\s+class\s+\w+/,
      /public\s+static\s+void\s+main/,
      /System\.out\.println/,
      /import\s+java\./,
      /public\s+\w+\s+\w+\s*\(/,
    ],
    cpp: [
      /#include\s*<.*>/,
      /int\s+main\s*\(/,
      /std::/,
      /cout\s*<<|cin\s*>>/,
      /using\s+namespace\s+std/,
    ],
    css: [
      /\w+\s*{[^}]*}/,
      /@media\s*\(/,
      /\.\w+\s*{/,
      /#\w+\s*{/,
      /:\s*\w+\s*;/,
    ],
    sql: [
      /SELECT\s+.*FROM/i,
      /INSERT\s+INTO/i,
      /UPDATE\s+.*SET/i,
      /DELETE\s+FROM/i,
      /CREATE\s+TABLE/i,
      /ALTER\s+TABLE/i,
    ],
    html: [/<\/?[a-z][\s\S]*>/i, /<!DOCTYPE/i],
    json: [/^\s*{[\s\S]*}\s*$/, /^\s*\[[\s\S]*\]\s*$/],
  };

  let bestMatch = { language: "", confidence: 0, matchCount: 0 };

  Object.entries(codePatterns).forEach(([language, patterns]) => {
    let matchCount = 0;
    patterns.forEach((pattern) => {
      if (pattern.test(content)) {
        matchCount++;
      }
    });

    const confidence = Math.min(matchCount * 0.2, 0.9);
    if (confidence > bestMatch.confidence) {
      bestMatch = { language, confidence, matchCount };
    }
  });

  // 중괄호, 세미콜론 등 일반적인 코드 특징 확인
  const codeCharacteristics = [
    /[{}();]/, // 일반적인 코드 문자
    /^\s*\/\/.*$/m, // 주석 (//)
    /^\s*\/\*[\s\S]*?\*\//, // 블록 주석 (/* */)
    /^\s*#.*$/m, // 주석 (#)
    /\w+\s*\([^)]*\)\s*{/, // 함수 정의
    /\w+\.\w+/, // 메서드 호출
    /=\s*['"'][^'"]*['"]/, // 문자열 할당
  ];

  let characteristicMatches = 0;
  codeCharacteristics.forEach((pattern) => {
    if (pattern.test(content)) {
      characteristicMatches++;
    }
  });

  // 특징 점수 추가
  bestMatch.confidence += characteristicMatches * 0.1;
  bestMatch.confidence = Math.min(bestMatch.confidence, 0.95);

  return {
    confidence: bestMatch.confidence,
    language: bestMatch.language || "text",
    subType: bestMatch.confidence > 0.7 ? "structured" : "snippet",
  };
}

/**
 * JSON 콘텐츠 감지
 */
function detectJsonContent(content: string) {
  try {
    const parsed = JSON.parse(content);
    const formatted = JSON.stringify(parsed, null, 2);
    return {
      confidence: 0.95,
      formatted,
    };
  } catch {
    // JSON-like 구조 확인
    const jsonLikePatterns = [
      /^\s*{[\s\S]*}\s*$/,
      /^\s*\[[\s\S]*\]\s*$/,
      /"[\w\s]*":\s*"[^"]*"/,
      /"[\w\s]*":\s*\d+/,
      /"[\w\s]*":\s*(true|false|null)/,
    ];

    let matches = 0;
    jsonLikePatterns.forEach((pattern) => {
      if (pattern.test(content)) matches++;
    });

    return {
      confidence: matches * 0.2,
      formatted: content,
    };
  }
}

/**
 * XML 콘텐츠 감지
 */
function detectXmlContent(content: string) {
  const xmlPatterns = [
    /^\s*<\?xml/, // XML 선언
    /<\w+[^>]*>[\s\S]*<\/\w+>/, // XML 태그 구조
    /<\w+[^>]*\/>/, // 자체 닫는 태그
    /xmlns:/, // 네임스페이스
  ];

  let confidence = 0;
  xmlPatterns.forEach((pattern) => {
    if (pattern.test(content)) {
      confidence += 0.25;
    }
  });

  return { confidence: Math.min(confidence, 0.9) };
}

/**
 * 콘텐츠 메타데이터 생성
 */
function generateMetadata(content: string) {
  const lines = content.split("\n");
  const codeBlockMatches = content.match(CODE_BLOCK_REGEX) || [];
  CODE_BLOCK_REGEX.lastIndex = 0; // 글로벌 플래그 리셋
  const markdownSyntaxPatterns = [
    /^#{1,6}\s+/m,
    /\*\*.*\*\*/,
    /`[^`]+`/,
    /\[.*?\]\(.*?\)/,
  ];

  const hasMarkdownSyntax = markdownSyntaxPatterns.some((pattern) =>
    pattern.test(content)
  );

  // 언어 감지
  const detectedLanguages: string[] = [];
  codeBlockMatches.forEach((block) => {
    const langMatch = block.match(/```(\w+)/);
    if (langMatch && langMatch[1]) {
      detectedLanguages.push(langMatch[1]);
    }
  });

  return {
    lineCount: lines.length,
    characterCount: content.length,
    hasCodeBlocks: codeBlockMatches.length > 0,
    hasMarkdownSyntax,
    detectedLanguages: Array.from(new Set(detectedLanguages)),
  };
}

/**
 * HTML에서 텍스트 추출
 */
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<style[^>]*>.*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 마크다운에서 텍스트 추출
 */
function extractTextFromMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "") // 코드 블록 제거
    .replace(/`[^`]+`/g, "") // 인라인 코드 제거
    .replace(/^#{1,6}\s+/gm, "") // 헤더 마크 제거
    .replace(/\*\*(.*?)\*\*/g, "$1") // 볼드 제거
    .replace(/_(.*?)_/g, "$1") // 이탤릭 제거
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 링크 텍스트만 남김
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // 이미지 alt 텍스트만 남김
    .replace(/^\s*[-*+]\s+/gm, "") // 리스트 마커 제거
    .replace(/^\s*\d+\.\s+/gm, "") // 번호 리스트 마커 제거
    .replace(/^\s*>\s+/gm, "") // 인용문 마커 제거
    .replace(/^\s*\|.*\|\s*$/gm, "") // 테이블 제거
    .replace(/^-{3,}$/gm, "") // 구분선 제거
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * HTML 새니타이징 (보안) - Chart.js 스크립트는 허용
 */
function sanitizeHtml(html: string): string {
  const dangerousTags = [
    "object",
    "embed",
    "form",
    "input",
    "iframe",
    "link",
    "meta",
  ];
  let sanitized = html;

  // Chart.js 관련 스크립트인지 확인
  const isChartJsScript = (content: string): boolean => {
    return /Chart\.js|new Chart\(|Chart\s*\(|chart\.js/i.test(content);
  };

  // script 태그는 Chart.js 관련만 허용
  const scriptRegex = SCRIPT_TAG_REGEX;
  let match;
  const scriptsToRemove: string[] = [];
  
  // 무한루프 방지를 위한 안전장치
  scriptRegex.lastIndex = 0;
  let iterationCount = 0;
  const maxIterations = 100;
  
  while ((match = scriptRegex.exec(html)) !== null && iterationCount < maxIterations) {
    const scriptContent = match[1];
    const fullScript = match[0];
    
    // Chart.js CDN 로드나 Chart.js 코드가 아닌 스크립트는 제거
    const isChartCdn = /cdn\.jsdelivr\.net\/npm\/chart\.js|chartjs\.org/i.test(fullScript);
    const hasChartCode = isChartJsScript(scriptContent);
    
    if (!isChartCdn && !hasChartCode) {
      scriptsToRemove.push(fullScript);
      console.log('위험한 스크립트 제거:', fullScript.substring(0, 100) + '...');
    } else {
      console.log('Chart.js 스크립트 허용:', fullScript.substring(0, 100) + '...');
    }
    
    iterationCount++;
  }
  
  // 위험한 스크립트만 제거
  scriptsToRemove.forEach(script => {
    sanitized = sanitized.replace(script, '');
  });

  dangerousTags.forEach((tag) => {
    const regex = new RegExp(`<${tag}[^>]*>.*?<\/${tag}>`, "gis");
    sanitized = sanitized.replace(regex, "");

    const selfClosingRegex = new RegExp(`<${tag}[^>]*\/?>`, "gi");
    sanitized = sanitized.replace(selfClosingRegex, "");
  });

  const dangerousAttrs = [
    "onclick",
    "onload",
    "onerror",
    "onmouseover",
    "onfocus",
    "onblur",
  ];
  dangerousAttrs.forEach((attr) => {
    const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, "gi");
    sanitized = sanitized.replace(regex, "");
  });

  sanitized = sanitized.replace(
    /href\s*=\s*["']javascript:[^"']*["']/gi,
    'href="#"'
  );

  return sanitized;
}
