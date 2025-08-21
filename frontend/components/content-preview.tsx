"use client";

import React, { useState, useEffect } from "react";
import { MarkdownPreview } from "./markdown-preview";
import { HtmlPreview } from "./html-preview";
import { CodePreview } from "./code-preview";
import { detectContentType, ContentDetectionResult } from "@/utils/contentDetection";

interface ContentPreviewProps {
  content: string;
  outputFormat?: string; // 사용자가 명시적으로 선택한 출력 형식
}

const ContentPreview: React.FC<ContentPreviewProps> = ({ content, outputFormat }) => {
  const [detectionResult, setDetectionResult] =
    useState<ContentDetectionResult | null>(null);

  useEffect(() => {
    if (content) {
      // 사용자가 명시적으로 출력 형식을 선택한 경우 해당 형식을 강제 적용
      if (outputFormat && outputFormat !== "auto") {
        setDetectionResult({
          contentType: outputFormat as any,
          confidence: 1.0,
          subType: "user-forced",
          sanitizedContent: content,
          textContent: content,
        });
      } else {
        // 자동 감지 모드
        const result = detectContentType(content);
        setDetectionResult(result);
      }
    } else {
      setDetectionResult(null);
    }
  }, [content, outputFormat]);

  if (!detectionResult) {
    // 렌더링 전이나 content가 없을 때 간단한 표시
    return <div className="whitespace-pre-wrap p-2">{content || ""}</div>;
  }

  const { contentType, confidence, sanitizedContent, language, textContent } =
    detectionResult;

  // 신뢰도가 너무 낮으면 일반 텍스트로 처리 (text 타입 제외)
  // 사용자가 강제 선택한 형식은 신뢰도 체크를 건너뜀
  // 마크다운의 경우 기준을 낮춰서 더 자주 렌더링되도록 함
  const confidenceThreshold = contentType === "markdown" ? 0.5 : 0.6;
  const isUserForced = detectionResult.subType === "user-forced";
  
  if (!isUserForced && confidence < confidenceThreshold && contentType !== "text") {
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
      return (
        <HtmlPreview 
          content={sanitizedContent || content}
        />
      );
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