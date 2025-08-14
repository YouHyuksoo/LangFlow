/**
 * HTML 콘텐츠 감지 및 검증 유틸리티
 */

export interface HtmlDetectionResult {
  isHtml: boolean;
  confidence: number;
  htmlType: 'full-page' | 'snippet' | 'mixed' | 'none';
  sanitizedHtml?: string;
  textContent?: string;
}

/**
 * 텍스트에서 HTML 콘텐츠를 감지합니다
 */
export function detectHtmlContent(content: string): HtmlDetectionResult {
  if (!content || typeof content !== 'string') {
    return {
      isHtml: false,
      confidence: 0,
      htmlType: 'none'
    };
  }

  const trimmedContent = content.trim();
  
  // HTML 태그 패턴들
  const htmlTagRegex = /<\/?[a-z][\s\S]*>/i;
  const htmlElementRegex = /<([a-z]+)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/i;
  const selfClosingTagRegex = /<[a-z]+(?:\s+[^>]*)?\/>/i;
  const doctypeRegex = /<!DOCTYPE\s+html/i;
  const htmlStructureRegex = /<html[\s\S]*<\/html>/i;
  
  // HTML 특수 문자들
  const htmlEntitiesRegex = /&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g;
  
  let confidence = 0;
  let htmlType: 'full-page' | 'snippet' | 'mixed' | 'none' = 'none';
  
  // DOCTYPE 또는 완전한 HTML 구조가 있는 경우
  if (doctypeRegex.test(trimmedContent) || htmlStructureRegex.test(trimmedContent)) {
    confidence = 0.95;
    htmlType = 'full-page';
  }
  // HTML 태그가 포함된 경우 
  else if (htmlTagRegex.test(trimmedContent)) {
    // 태그 수 계산
    const tagMatches = trimmedContent.match(/<\/?[a-z][^>]*>/gi) || [];
    const tagCount = tagMatches.length;
    
    // 일반적인 HTML 태그들
    const commonTags = ['div', 'span', 'p', 'a', 'img', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'];
    const hasCommonTags = commonTags.some(tag => 
      new RegExp(`<${tag}(\\s|>|/>)`, 'i').test(trimmedContent)
    );
    
    if (tagCount >= 3 && hasCommonTags) {
      confidence = 0.8;
      htmlType = 'snippet';
    } else if (tagCount >= 1 && hasCommonTags) {
      confidence = 0.6;
      htmlType = 'snippet';
    } else if (tagCount >= 1) {
      confidence = 0.4;
      htmlType = 'mixed';
    }
  }
  // HTML 엔티티만 포함된 경우
  else if (htmlEntitiesRegex.test(trimmedContent)) {
    confidence = 0.3;
    htmlType = 'mixed';
  }
  
  // 텍스트와 HTML이 섞여있는 경우 감지
  if (htmlType !== 'none' && htmlType !== 'full-page') {
    const textWithoutTags = trimmedContent.replace(/<[^>]*>/g, '').trim();
    const textRatio = textWithoutTags.length / trimmedContent.length;
    
    if (textRatio > 0.6) {
      htmlType = 'mixed';
    }
  }
  
  const isHtml = confidence >= 0.4;
  
  return {
    isHtml,
    confidence,
    htmlType,
    sanitizedHtml: isHtml ? sanitizeHtml(trimmedContent) : undefined,
    textContent: isHtml ? extractTextContent(trimmedContent) : trimmedContent
  };
}

/**
 * HTML 콘텐츠를 안전하게 정리합니다 - Chart.js 스크립트는 허용
 */
function sanitizeHtml(html: string): string {
  // Chart.js 관련 스크립트인지 확인
  const isChartJsScript = (content: string): boolean => {
    return /Chart\.js|new Chart\(|Chart\s*\(|chart\.js|cdn\.jsdelivr\.net\/npm\/chart\.js/i.test(content);
  };

  // 위험한 태그들 제거 (script는 제외)
  const dangerousTags = ['object', 'embed', 'form', 'input', 'iframe', 'link', 'meta'];
  let sanitized = html;
  
  // script 태그는 Chart.js 관련만 허용
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  const scriptsToRemove: string[] = [];
  
  while ((match = scriptRegex.exec(html)) !== null) {
    const scriptContent = match[1];
    const fullScript = match[0];
    
    // Chart.js CDN 로드나 Chart.js 코드가 아닌 스크립트는 제거 대상에 추가
    const isChartCdn = /cdn\.jsdelivr\.net\/npm\/chart\.js|chartjs\.org/i.test(fullScript);
    const hasChartCode = isChartJsScript(scriptContent);
    
    if (!isChartCdn && !hasChartCode) {
      scriptsToRemove.push(fullScript);
      console.log('[htmlDetection.ts] 위험한 스크립트 제거:', fullScript.substring(0, 100) + '...');
    } else {
      console.log('[htmlDetection.ts] Chart.js 스크립트 허용:', fullScript.substring(0, 100) + '...');
    }
  }
  
  // 위험한 스크립트만 제거
  scriptsToRemove.forEach(script => {
    sanitized = sanitized.replace(script, '');
  });
  
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}[^>]*>.*?<\/${tag}>`, 'gis');
    sanitized = sanitized.replace(regex, '');
    
    // 자체 닫는 태그도 제거
    const selfClosingRegex = new RegExp(`<${tag}[^>]*\/?>`, 'gi');
    sanitized = sanitized.replace(selfClosingRegex, '');
  });
  
  // 위험한 속성들 제거
  const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'];
  dangerousAttrs.forEach(attr => {
    const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });
  
  // javascript: 프로토콜 제거 (하지만 Chart.js는 예외)
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:(?!.*chart).*?["']/gi, 'href="#"');
  
  return sanitized;
}

/**
 * HTML에서 순수 텍스트 콘텐츠를 추출합니다 - Chart.js 스크립트는 보존
 */
function extractTextContent(html: string): string {
  let processedHtml = html;
  
  // Chart.js가 아닌 스크립트만 제거
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  const scriptsToRemove: string[] = [];
  
  while ((match = scriptRegex.exec(html)) !== null) {
    const scriptContent = match[1];
    const fullScript = match[0];
    
    // Chart.js 관련이 아닌 스크립트만 제거
    const isChartRelated = /Chart\.js|new Chart\(|Chart\s*\(|chart\.js|cdn\.jsdelivr\.net\/npm\/chart\.js/i.test(scriptContent + fullScript);
    
    if (!isChartRelated) {
      scriptsToRemove.push(fullScript);
    }
  }
  
  // 위험한 스크립트만 제거
  scriptsToRemove.forEach(script => {
    processedHtml = processedHtml.replace(script, '');
  });
  
  // HTML 태그 제거
  const textContent = processedHtml
    .replace(/<style[^>]*>.*?<\/style>/gi, '')   // 스타일 제거
    .replace(/<[^>]*>/g, '')                      // 모든 태그 제거
    .replace(/&amp;/g, '&')                      // HTML 엔티티 복원
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')                        // 연속된 공백 정리
    .trim();
  
  return textContent;
}

/**
 * HTML 콘텐츠가 미리보기하기에 적합한지 확인합니다 - Chart.js는 안전한 것으로 처리
 */
export function isPreviewSafe(htmlContent: string): boolean {
  // Chart.js 관련 스크립트인지 확인
  const hasChartJs = /Chart\.js|new Chart\(|Chart\s*\(|chart\.js|cdn\.jsdelivr\.net\/npm\/chart\.js/i.test(htmlContent);
  
  const dangerousPatterns = [
    /javascript:(?!.*chart)/i,  // javascript: 프로토콜 (Chart.js 제외)
    /<object/i,
    /<embed/i,
    /<iframe/i,
    /on\w+\s*=/i, // onclick, onload 등
    /data:text\/html/i
  ];
  
  // Chart.js가 포함된 경우 스크립트 태그 허용
  const scriptPattern = /<script/i;
  const hasScript = scriptPattern.test(htmlContent);
  
  if (hasScript && hasChartJs) {
    // Chart.js 스크립트가 있는 경우 다른 위험한 패턴만 검사
    return !dangerousPatterns.some(pattern => pattern.test(htmlContent));
  } else if (hasScript && !hasChartJs) {
    // Chart.js가 아닌 스크립트가 있는 경우 위험함
    return false;
  } else {
    // 스크립트가 없는 경우 기본 검사
    return !dangerousPatterns.some(pattern => pattern.test(htmlContent));
  }
}

/**
 * HTML 콘텐츠의 크기를 추정합니다 (렌더링 성능 최적화용)
 */
export function estimateHtmlComplexity(html: string): 'simple' | 'moderate' | 'complex' {
  const tagCount = (html.match(/<[^>]*>/g) || []).length;
  const length = html.length;
  
  if (tagCount < 10 && length < 1000) {
    return 'simple';
  } else if (tagCount < 50 && length < 5000) {
    return 'moderate';
  } else {
    return 'complex';
  }
}