"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Eye,
  EyeOff,
  Code,
  Download,
  Copy,
  ExternalLink,
  AlertTriangle,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  detectHtmlContent,
  isPreviewSafe,
  estimateHtmlComplexity,
  type HtmlDetectionResult,
} from "@/utils/htmlDetection";
import { CanvasHtmlRenderer } from "@/components/canvas-html-renderer";
import { useToast } from "@/hooks/use-toast";

interface HtmlPreviewProps {
  content: string;
  className?: string;
}

export function HtmlPreview({ content, className = "" }: HtmlPreviewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderMode, setRenderMode] = useState<"iframe" | "canvas">("iframe");
  const [detectionResult, setDetectionResult] =
    useState<HtmlDetectionResult | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const result = detectHtmlContent(content);
    setDetectionResult(result);

    // HTML이 감지되면 자동으로 미리보기 활성화
    if (result.isHtml && result.confidence > 0.6) {
      setShowPreview(true);
    }
  }, [content]);

  // HTML 콘텐츠를 iframe에 안전하게 로드
  const loadHtmlInIframe = () => {
    if (!iframeRef.current || !detectionResult?.sanitizedHtml) return;

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!doc) return;

    try {
      // 다크테마 감지
      const isDarkMode = document.documentElement.classList.contains('dark');
      
      // 다크테마에 맞는 CSS 스타일 추가
      const htmlWithStyles = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: ${isDarkMode ? '#e2e8f0' : '#333'};
              margin: 16px;
              background: ${isDarkMode ? '#1e293b' : 'white'};
            }
            h1, h2, h3, h4, h5, h6 {
              color: ${isDarkMode ? '#60a5fa' : '#2563eb'};
              margin-top: 1.5em;
              margin-bottom: 0.5em;
            }
            p {
              margin-bottom: 1em;
            }
            a {
              color: ${isDarkMode ? '#60a5fa' : '#2563eb'};
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 1em 0;
              background: ${isDarkMode ? '#334155' : 'white'};
            }
            th, td {
              border: 1px solid ${isDarkMode ? '#475569' : '#ddd'};
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: ${isDarkMode ? '#475569' : '#f5f5f5'};
              color: ${isDarkMode ? '#f1f5f9' : '#333'};
            }
            code {
              background-color: ${isDarkMode ? '#475569' : '#f1f5f9'};
              color: ${isDarkMode ? '#e2e8f0' : '#333'};
              padding: 2px 4px;
              border-radius: 3px;
              font-family: 'Courier New', monospace;
            }
            pre {
              background-color: ${isDarkMode ? '#475569' : '#f1f5f9'};
              color: ${isDarkMode ? '#e2e8f0' : '#333'};
              padding: 12px;
              border-radius: 6px;
              overflow-x: auto;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            /* 리스트 스타일 */
            ul, ol {
              color: ${isDarkMode ? '#e2e8f0' : '#333'};
            }
            li {
              margin-bottom: 0.5em;
            }
            /* 인용구 스타일 */
            blockquote {
              border-left: 4px solid ${isDarkMode ? '#60a5fa' : '#2563eb'};
              margin-left: 0;
              padding-left: 16px;
              background-color: ${isDarkMode ? '#374151' : '#f8fafc'};
              padding: 12px 16px;
              border-radius: 4px;
            }
            /* HR 스타일 */
            hr {
              border: none;
              height: 1px;
              background-color: ${isDarkMode ? '#475569' : '#ddd'};
              margin: 2em 0;
            }
          </style>
        </head>
        <body>
          ${detectionResult.sanitizedHtml}
        </body>
        </html>
      `;

      doc.open();
      doc.write(htmlWithStyles);
      doc.close();
    } catch (error) {
      console.error("HTML 로드 실패:", error);
      toast({
        title: "미리보기 오류",
        description: "HTML 콘텐츠를 로드하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (showPreview && detectionResult?.sanitizedHtml) {
      // iframe 로드 후 HTML 콘텐츠 삽입
      const timer = setTimeout(loadHtmlInIframe, 100);
      return () => clearTimeout(timer);
    }
  }, [showPreview, detectionResult?.sanitizedHtml]);

  // 다크테마 변경 감지를 위한 useEffect
  useEffect(() => {
    if (showPreview && detectionResult?.sanitizedHtml) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            // 테마가 변경되면 iframe을 다시 로드
            setTimeout(loadHtmlInIframe, 50);
          }
        });
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });

      return () => observer.disconnect();
    }
  }, [showPreview, detectionResult?.sanitizedHtml]);

  // 복사 기능
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "복사 완료",
        description: "클립보드에 복사되었습니다.",
      });
    } catch (error) {
      console.error("복사 실패:", error);
      toast({
        title: "복사 실패",
        description: "클립보드 복사 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 다운로드 기능
  const downloadHtml = () => {
    if (!detectionResult?.sanitizedHtml) return;

    const blob = new Blob([detectionResult.sanitizedHtml], {
      type: "text/html",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-response-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "다운로드 완료",
      description: "HTML 파일이 다운로드되었습니다.",
    });
  };

  // 새 탭에서 열기
  const openInNewTab = () => {
    if (!detectionResult?.sanitizedHtml) return;

    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(detectionResult.sanitizedHtml);
      newWindow.document.close();
    }
  };

  if (!detectionResult?.isHtml) {
    return null;
  }

  const complexity = estimateHtmlComplexity(content);
  const isSafe = isPreviewSafe(content);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* HTML 감지 상태 표시 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Code className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">HTML 콘텐츠 감지됨</span>
          <Badge variant="secondary" className="text-xs">
            {detectionResult.htmlType}
          </Badge>
          <Badge
            variant={isSafe ? "default" : "destructive"}
            className="text-xs"
          >
            {isSafe ? "안전" : "주의"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            복잡도: {complexity}
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs"
          >
            {showPreview ? (
              <EyeOff className="h-3 w-3 mr-1" />
            ) : (
              <Eye className="h-3 w-3 mr-1" />
            )}
            {showPreview ? "미리보기 숨기기" : "미리보기"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCode(!showCode)}
            className="text-xs"
          >
            <Code className="h-3 w-3 mr-1" />
            {showCode ? "코드 숨기기" : "코드 보기"}
          </Button>
        </div>
      </div>

      {/* 안전하지 않은 콘텐츠 경고 */}
      {!isSafe && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            이 HTML 콘텐츠에는 잠재적으로 위험한 요소가 포함되어 있을 수
            있습니다. 미리보기는 안전하게 처리되지만 주의해서 사용하시기
            바랍니다.
          </AlertDescription>
        </Alert>
      )}

      {/* HTML 미리보기 */}
      {showPreview && (
        <Card className="border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">HTML 미리보기</CardTitle>
              <div className="flex items-center space-x-2">
                {/* 렌더링 모드 선택 */}
                <div className="flex items-center space-x-1 border rounded-md p-1">
                  <Button
                    variant={renderMode === "iframe" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setRenderMode("iframe")}
                    className="text-xs px-2 py-1"
                  >
                    iframe
                  </Button>
                  <Button
                    variant={renderMode === "canvas" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setRenderMode("canvas")}
                    className="text-xs px-2 py-1"
                  >
                    Canvas
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(detectionResult.sanitizedHtml || "")
                  }
                  className="text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  복사
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadHtml}
                  className="text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  다운로드
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openInNewTab}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />새 탭
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="text-xs"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3 w-3" />
                  ) : (
                    <Maximize2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div
              className={`border-t ${
                isFullscreen ? "fixed inset-0 z-50 bg-white dark:bg-slate-900" : "relative"
              }`}
            >
              {isFullscreen && (
                <div className="flex items-center justify-between p-4 border-b bg-gray-50 dark:bg-slate-800 dark:border-slate-600">
                  <span className="text-sm font-medium">
                    HTML 미리보기 - 전체화면
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFullscreen(false)}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* 렌더링 모드에 따른 컴포넌트 표시 */}
              {renderMode === "iframe" ? (
                <iframe
                  ref={iframeRef}
                  className={`w-full border-0 bg-white dark:bg-slate-900 ${
                    isFullscreen ? "h-[calc(100vh-80px)]" : "h-64 md:h-80"
                  }`}
                  title="HTML 미리보기"
                  sandbox="allow-same-origin"
                  style={{
                    minHeight: isFullscreen ? "calc(100vh - 80px)" : "256px",
                  }}
                />
              ) : (
                <div
                  className={isFullscreen ? "h-[calc(100vh-80px)] p-4" : "p-4"}
                >
                  <CanvasHtmlRenderer
                    htmlContent={detectionResult.sanitizedHtml || ""}
                    width={isFullscreen ? 800 : 600}
                    height={isFullscreen ? 600 : 400}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* HTML 코드 보기 */}
      {showCode && (
        <Card className="border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">HTML 소스 코드</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  copyToClipboard(detectionResult.sanitizedHtml || "")
                }
                className="text-xs"
              >
                <Copy className="h-3 w-3 mr-1" />
                복사
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-50 dark:bg-slate-800 dark:text-slate-200 p-4 rounded-lg overflow-x-auto max-h-64">
              <code>{detectionResult.sanitizedHtml}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {/* HTML 정보 요약 */}
      <div className="text-xs text-muted-foreground flex items-center space-x-4">
        <span>신뢰도: {Math.round(detectionResult.confidence * 100)}%</span>
        <span>크기: {content.length} 문자</span>
        <span>태그 수: {(content.match(/<[^>]*>/g) || []).length}개</span>
      </div>
    </div>
  );
}
