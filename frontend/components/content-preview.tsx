"use client";

import React from "react";
import {
  detectContentType,
  type ContentDetectionResult,
} from "@/utils/contentDetection";
import { HtmlPreview } from "@/components/html-preview";
import { CodePreview } from "@/components/code-preview";
import { MarkdownPreview } from "@/components/markdown-preview";
import { SimpleTablePreview } from "@/components/simple-table-preview";

interface ContentPreviewProps {
  content: string;
  className?: string;
}

/**
 * 통합 콘텐츠 미리보기 컴포넌트
 * HTML, 코드, 마크다운을 자동으로 감지하고 적절한 미리보기를 제공
 */
export function ContentPreview({
  content,
  className = "",
}: ContentPreviewProps) {
  // 콘텐츠 타입 자동 감지
  const detectionResult: ContentDetectionResult = detectContentType(content);

  // 콘텐츠 타입에 따라 적절한 미리보기 컴포넌트 렌더링
  switch (detectionResult.contentType) {
    case "html":
      if (detectionResult.confidence > 0.7) {
        return <HtmlPreview content={content} className={className} />;
      }
      break;

    case "code":
    case "json":
    case "xml":
      if (detectionResult.confidence > 0.7) {
        return (
          <CodePreview
            code={content}
            language={detectionResult.language || detectionResult.contentType}
            confidence={detectionResult.confidence}
            className={className}
          />
        );
      }
      break;

    case "markdown":
      if (detectionResult.confidence > 0.5) {
        return (
          <MarkdownPreview
            markdown={content}
            confidence={detectionResult.confidence}
            className={className}
          />
        );
      }
      break;

    case "text":
    default:
      // 기본적으로 SimpleTablePreview를 사용 (내부적으로 표 또는 일반 텍스트 처리)
      return <SimpleTablePreview content={content} className={className} />;
  }
  // confidence가 기준 미달일 경우 기본 렌더러 사용
  return <SimpleTablePreview content={content} className={className} />;
}

/**
 * 콘텐츠 타입 감지 결과만 반환하는 훅
 */
export function useContentDetection(content: string): ContentDetectionResult {
  return detectContentType(content);
}

/**
 * 여러 콘텐츠 타입을 지원하는지 확인
 */
export function isPreviewSupported(content: string): boolean {
  const result = detectContentType(content);
  return (
    result.confidence >= 0.4 &&
    ["html", "code", "json", "xml", "markdown"].includes(result.contentType)
  );
}

/**
 * 콘텐츠 타입별 아이콘 매핑
 */
export function getContentTypeIcon(contentType: string): string {
  const iconMap: Record<string, string> = {
    html: "🌐",
    code: "💻",
    json: "📊",
    xml: "📋",
    markdown: "📝",
    javascript: "🟨",
    typescript: "🔷",
    python: "🐍",
    java: "☕",
    cpp: "⚡",
    css: "🎨",
    sql: "🗃️",
  };

  return iconMap[contentType] || "📄";
}

/**
 * 콘텐츠 타입별 색상 매핑
 */
export function getContentTypeColor(contentType: string): string {
  const colorMap: Record<string, string> = {
    html: "text-red-600",
    code: "text-blue-600",
    json: "text-green-600",
    xml: "text-purple-600",
    markdown: "text-gray-600",
    javascript: "text-yellow-600",
    typescript: "text-blue-500",
    python: "text-green-500",
    java: "text-orange-600",
    cpp: "text-purple-500",
    css: "text-pink-600",
    sql: "text-indigo-600",
  };

  return colorMap[contentType] || "text-gray-500";
}
