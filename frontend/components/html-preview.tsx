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
      
      // Chart.js가 포함되어 있는지 확인
      const hasChartJs = /new Chart\(|Chart\s*\(/i.test(detectionResult.sanitizedHtml);
      console.log('HTML에 Chart.js 코드 포함 여부:', hasChartJs);

      // 다크테마에 맞는 CSS 스타일 추가
      const htmlWithStyles = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${hasChartJs ? '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>' : ''}
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              color: #212529; /* 기본 검은색 텍스트 */
              margin: 16px;
              background: #ffffff; /* 항상 흰색 배경 */
            }
            h1, h2, h3, h4, h5, h6, p, ul, ol, li, blockquote {
              color: #212529; /* 모든 텍스트 요소 색상 강제 */
            }
            h1 { font-size: 1.5em; }
            h2 { font-size: 1.3em; }
            h3 { font-size: 1.1em; }
            h4, h5, h6 { font-size: 1em; }
            p { font-size: 14px; }
            a {
              color: #0056b3; /* 링크 색상 */
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 1em 0;
            }
            th, td {
              border: 1px solid #dee2e6;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f8f9fa;
            }
            code, pre {
              background-color: #f1f3f5;
              color: #212529;
              padding: 2px 4px;
              border-radius: 3px;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            blockquote {
              border-left: 4px solid #0056b3;
              margin-left: 0;
              padding-left: 16px;
              background-color: #f8f9fa;
              padding: 12px 16px;
            }
            hr {
              border: none;
              height: 1px;
              background-color: #dee2e6;
              margin: 2em 0;
            }
            /* Chart.js 컨테이너 스타일링 */
            canvas {
              max-width: 100%;
              height: auto;
              border: 1px solid #dee2e6;
              border-radius: 8px;
              background: white;
            }
            .chart-container {
              margin: 20px 0;
              padding: 20px;
              border: 1px solid #e9ecef;
              border-radius: 8px;
              background: #f8f9fa;
            }
          </style>
        </head>
        <body>
          ${detectionResult.sanitizedHtml}
          ${hasChartJs ? `
          <script>
            // Chart.js 초기화 디버깅 및 실행 보장
            console.log('Chart.js 로드됨:', typeof Chart !== 'undefined');
            
            // 원본 HTML의 스크립트를 다시 실행하는 함수
            function executeScripts() {
              console.log('스크립트 재실행 시작');
              
              // 페이지 내의 모든 스크립트 태그를 찾아 실행
              const scripts = document.querySelectorAll('script:not([src])');
              console.log('실행할 인라인 스크립트:', scripts.length + '개');
              
              scripts.forEach((script, index) => {
                const scriptContent = script.textContent || script.innerHTML;
                if (scriptContent.includes('new Chart') || scriptContent.includes('Chart(')) {
                  console.log('Chart.js 스크립트 실행 중... (인덱스:', index + ')');
                  try {
                    // 안전한 스크립트 실행을 위해 Function 생성자 사용
                    const cleanScript = scriptContent.replace(/\\\\/g, '').replace(/\\'/g, "'");
                    const func = new Function(cleanScript);
                    func();
                    console.log('Chart.js 스크립트 실행 성공');
                  } catch (error) {
                    console.error('Chart.js 스크립트 실행 오류:', error);
                  }
                }
              });
            }
            
            // Chart.js 라이브러리 로드 확인 후 스크립트 실행
            function waitForChartJs() {
              if (typeof Chart !== 'undefined') {
                console.log('Chart.js 준비 완료, 스크립트 실행');
                executeScripts();
              } else {
                console.log('Chart.js 대기 중...');
                setTimeout(waitForChartJs, 100);
              }
            }
            
            // DOM 로드 완료 후 Chart.js 대기
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
              waitForChartJs();
            } else {
              document.addEventListener('DOMContentLoaded', waitForChartJs);
            }
          </script>
          ` : ''}
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
  const hasChartJs = /new Chart\(|Chart\s*\(/i.test(content);

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* HTML 감지 상태 표시 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Code className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">HTML 콘텐츠 감지됨</span>
          <Badge variant="secondary" className="text-xs">
            {detectionResult.htmlType}
          </Badge>
          {hasChartJs && (
            <Badge variant="default" className="text-xs bg-green-600">
              📊 Chart.js 포함
            </Badge>
          )}
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
        <Card className="w-full border dark:border-slate-600 dark:bg-slate-800">
          <CardHeader className="pb-2 px-3 py-3">
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
              className={`border-t dark:border-slate-600 ${
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
                <div className="p-1">
                  <iframe
                    ref={iframeRef}
                    className={`w-full border-0 ${
                      isFullscreen ? "h-[calc(100vh-80px)]" : "h-[600px]"
                    }`}
                    title="HTML 미리보기"
                    sandbox="allow-same-origin"
                    style={{
                      minHeight: isFullscreen ? "calc(100vh - 80px)" : "600px"
                    }}
                  />
                </div>
              ) : (
                <div
                  className={`p-1 ${isFullscreen ? "h-[calc(100vh-80px)]" : ""}`}
                >
                  <CanvasHtmlRenderer
                    htmlContent={detectionResult.sanitizedHtml || ""}
                    width={isFullscreen ? 1000 : 800}
                    height={isFullscreen ? 700 : 600}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* HTML 코드 보기 */}
      {showCode && (
        <Card className="w-full border dark:border-slate-600 dark:bg-slate-800">
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

    </div>
  );
}
