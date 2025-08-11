/**
 * 다양한 콘텐츠 타입 감지 및 검증 유틸리티
 */

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
  if (!content || typeof content !== "string") {
    return {
      contentType: "text",
      confidence: 0,
      textContent: content,
    };
  }

  const trimmedContent = content.trim();

  // HTML 감지
  const htmlResult = detectHtmlContent(trimmedContent);
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

  // 마크다운 감지
  const markdownResult = detectMarkdownContent(trimmedContent);
  if (markdownResult.confidence > 0.6) {
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
  const htmlTagRegex = /<\/?[a-z][\s\S]*>/i;
  const htmlStructureRegex = /<html[\s\S]*<\/html>/i;
  const doctypeRegex = /<!DOCTYPE\s+html/i;

  let confidence = 0;
  let htmlType: "full-page" | "snippet" | "mixed" | "none" = "none";

  if (doctypeRegex.test(content) || htmlStructureRegex.test(content)) {
    confidence = 0.95;
    htmlType = "full-page";
  } else if (htmlTagRegex.test(content)) {
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
 * 마크다운 콘텐츠 감지
 */
function detectMarkdownContent(content: string) {
  const markdownPatterns = [
    /^#{1,6}\s+.+$/m, // 헤더 (#, ##, ###)
    /^\*\*.*\*\*$/m, // 볼드 텍스트
    /^_.*_$/m, // 이탤릭 텍스트
    /^\- .+$/m, // 리스트 (-)
    /^\* .+$/m, // 리스트 (*)
    /^\d+\. .+$/m, // 번호 리스트
    /```[\s\S]*?```/, // 코드 블록
    /`[^`]+`/, // 인라인 코드
    /\[.*?\]\(.*?\)/, // 링크
    /!\[.*?\]\(.*?\)/, // 이미지
    /^\>.+$/m, // 인용문
    /^\|.+\|$/m, // 테이블 행
    /^\|[-:\s|]+\|$/m, // 테이블 구분선
    /^---+$/m, // 구분선
  ];

  let confidence = 0;
  let matchedPatterns = 0;

  markdownPatterns.forEach((pattern) => {
    if (pattern.test(content)) {
      matchedPatterns++;
    }
  });

  // 마크다운 패턴이 많을수록 높은 신뢰도
  confidence = Math.min(matchedPatterns * 0.15, 0.95);

  // 코드 블록이 있으면 추가 점수
  if (/```[\s\S]*?```/.test(content)) {
    confidence += 0.2;
  }

  // 헤더가 있으면 추가 점수
  if (/^#{1,6}\s+.+$/m.test(content)) {
    confidence += 0.15;
  }

  // 표가 있으면 추가 점수 (표는 마크다운의 강한 지표)
  if (/^\|.+\|\s*\n\|[-:\s|]+\|\s*\n(?:\|.+\|\s*\n?)+/m.test(content)) {
    confidence += 0.25;
  }

  confidence = Math.min(confidence, 0.95);

  return {
    confidence,
    subType: confidence > 0.7 ? "structured" : "simple",
    textContent: extractTextFromMarkdown(content),
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
  const codeBlockMatches = content.match(/```[\s\S]*?```/g) || [];
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
 * HTML 새니타이징 (보안)
 */
function sanitizeHtml(html: string): string {
  const dangerousTags = [
    "script",
    "object",
    "embed",
    "form",
    "input",
    "iframe",
    "link",
    "meta",
  ];
  let sanitized = html;

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
