"use client";

import React, { useState, useEffect } from "react";
import { MarkdownPreview } from "./markdown-preview";
import { HtmlPreview } from "./html-preview";
import { CodePreview } from "./code-preview";
import { detectContentType, ContentDetectionResult } from "@/utils/contentDetection";

interface ContentPreviewProps {
  content: string;
}

const ContentPreview: React.FC<ContentPreviewProps> = ({ content }) => {
  const [detectionResult, setDetectionResult] =
    useState<ContentDetectionResult | null>(null);

  useEffect(() => {
    if (content) {
      const result = detectContentType(content);
      setDetectionResult(result);
    } else {
      setDetectionResult(null);
    }
  }, [content]);

  if (!detectionResult) {
    // 렌더링 전이나 content가 없을 때 간단한 표시
    return <div className="whitespace-pre-wrap p-2">{content || ""}</div>;
  }

  const { contentType, confidence, sanitizedContent, language, textContent } =
    detectionResult;

  // 신뢰도가 너무 낮으면 일반 텍스트로 처리 (text 타입 제외)
  if (confidence < 0.6 && contentType !== "text") {
    console.log(
      `콘텐츠 타입 '${contentType}' 신뢰도(${confidence})가 낮아 텍스트로 표시합니다.`
    );
    return (
      <div className="whitespace-pre-wrap p-2">{textContent || content}</div>
    );
  }

  switch (contentType) {
    case "markdown":
      return (
        <MarkdownPreview
          markdown={sanitizedContent || content}
          confidence={confidence}
        />
      );
    case "html":
      return <HtmlPreview content={sanitizedContent || content} />;
    case "json":
    case "xml":
    case "code":
      return (
        <CodePreview
          code={sanitizedContent || content}
          language={language || "text"}
          confidence={confidence}
        />
      );
    case "text":
    default:
      return (
        <div className="whitespace-pre-wrap p-2">{textContent || content}</div>
      );
  }
};

export { ContentPreview };