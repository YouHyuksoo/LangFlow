"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Code2,
  Copy,
  Download,
  Play,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  FileText,
  Zap,
  Terminal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CodePreviewProps {
  code: string;
  language: string;
  confidence: number;
  className?: string;
}

export function CodePreview({
  code,
  language,
  confidence,
  className = "",
}: CodePreviewProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const codeRef = useRef<HTMLPreElement>(null);
  const { toast } = useToast();

  // 코드 복사
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "복사 완료",
        description: "코드가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      console.error("복사 실패:", error);
      toast({
        title: "복사 실패",
        description: "코드 복사 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 코드 다운로드
  const downloadCode = () => {
    try {
      const extension = getFileExtension(language);
      const blob = new Blob([code], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `code-snippet.${extension}`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "다운로드 완료",
        description: `${language} 파일이 다운로드되었습니다.`,
      });
    } catch (error) {
      console.error("다운로드 실패:", error);
      toast({
        title: "다운로드 실패",
        description: "파일 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 언어별 파일 확장자 매핑
  const getFileExtension = (lang: string): string => {
    const extensions: Record<string, string> = {
      javascript: "js",
      typescript: "ts",
      python: "py",
      java: "java",
      cpp: "cpp",
      c: "c",
      csharp: "cs",
      php: "php",
      ruby: "rb",
      go: "go",
      rust: "rs",
      swift: "swift",
      kotlin: "kt",
      scala: "scala",
      html: "html",
      css: "css",
      scss: "scss",
      sass: "sass",
      less: "less",
      json: "json",
      xml: "xml",
      yaml: "yml",
      sql: "sql",
      bash: "sh",
      powershell: "ps1",
      dockerfile: "dockerfile",
      markdown: "md",
    };
    return extensions[lang.toLowerCase()] || "txt";
  };

  // 코드 라인 수 계산
  const lineCount = code.split("\n").length;

  // 언어별 색상 매핑
  const getLanguageColor = (lang: string): string => {
    const colors: Record<string, string> = {
      javascript: "bg-yellow-100 text-yellow-800",
      typescript: "bg-blue-100 text-blue-800",
      python: "bg-green-100 text-green-800",
      java: "bg-orange-100 text-orange-800",
      cpp: "bg-purple-100 text-purple-800",
      css: "bg-pink-100 text-pink-800",
      html: "bg-red-100 text-red-800",
      json: "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200",
      sql: "bg-indigo-100 text-indigo-800",
    };
    return colors[lang.toLowerCase()] || "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200";
  };

  // 기본 신택스 하이라이팅 (간단한 버전)
  const highlightCode = (code: string, language: string): string => {
    let highlighted = code;

    // JavaScript/TypeScript 키워드
    if (["javascript", "typescript"].includes(language.toLowerCase())) {
      const keywords = [
        "function",
        "const",
        "let",
        "var",
        "if",
        "else",
        "for",
        "while",
        "return",
        "class",
        "import",
        "export",
        "async",
        "await",
      ];
      keywords.forEach((keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, "g");
        highlighted = highlighted.replace(
          regex,
          `<span class="text-blue-600 font-semibold">${keyword}</span>`
        );
      });

      // 문자열 하이라이팅
      highlighted = highlighted.replace(
        /(["'`])((?:(?!\1)[^\\]|\\.)*)(\1)/g,
        '<span class="text-green-600">$1$2$3</span>'
      );

      // 주석 하이라이팅
      highlighted = highlighted.replace(
        /(\/\/.*$)/gm,
        '<span class="text-gray-500 italic">$1</span>'
      );
    }

    // Python 키워드
    else if (language.toLowerCase() === "python") {
      const keywords = [
        "def",
        "class",
        "if",
        "elif",
        "else",
        "for",
        "while",
        "return",
        "import",
        "from",
        "try",
        "except",
        "with",
        "as",
      ];
      keywords.forEach((keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, "g");
        highlighted = highlighted.replace(
          regex,
          `<span class="text-blue-600 font-semibold">${keyword}</span>`
        );
      });

      // 문자열 하이라이팅
      highlighted = highlighted.replace(
        /(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g,
        '<span class="text-green-600">$1$2$3</span>'
      );

      // 주석 하이라이팅
      highlighted = highlighted.replace(
        /(#.*$)/gm,
        '<span class="text-gray-500 italic">$1</span>'
      );
    }

    return highlighted;
  };

  // 라인 번호 생성
  const generateLineNumbers = (lineCount: number): string[] => {
    return Array.from({ length: lineCount }, (_, i) =>
      (i + 1).toString().padStart(3, " ")
    );
  };

  if (!showPreview) {
    return (
      <div
        className={`flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-600 ${className}`}
      >
        <div className="flex items-center space-x-2">
          <Code2 className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">코드 스니펫 감지됨</span>
          <Badge className={`text-xs ${getLanguageColor(language)}`}>
            {language}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {lineCount}줄
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPreview(true)}
          className="text-xs"
        >
          <Eye className="h-3 w-3 mr-1" />
          보기
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 코드 감지 상태 표시 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Code2 className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">코드 스니펫</span>
          <Badge className={`text-xs ${getLanguageColor(language)}`}>
            {language}
          </Badge>
          <Badge variant="outline" className="text-xs">
            신뢰도: {Math.round(confidence * 100)}%
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {lineCount}줄
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(false)}
            className="text-xs"
          >
            <EyeOff className="h-3 w-3 mr-1" />
            숨기기
          </Button>
        </div>
      </div>

      {/* 코드 미리보기 */}
      <Card className="border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-sm">코드 미리보기</CardTitle>
              <Badge className={`text-xs ${getLanguageColor(language)}`}>
                {language}
              </Badge>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLineNumbers(!showLineNumbers)}
                className="text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                {showLineNumbers ? "번호 숨김" : "번호 표시"}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={copyCode}
                className="text-xs"
              >
                <Copy className="h-3 w-3 mr-1" />
                복사
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={downloadCode}
                className="text-xs"
              >
                <Download className="h-3 w-3 mr-1" />
                다운로드
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
            className={`${
              isFullscreen ? "fixed inset-0 z-50 bg-white dark:bg-slate-900" : "relative"
            }`}
          >
            {isFullscreen && (
              <div className="flex items-center justify-between p-4 border-b bg-gray-50 dark:bg-slate-800 dark:border-slate-600">
                <span className="text-sm font-medium">
                  코드 미리보기 - 전체화면
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

            <div className="bg-gray-900 dark:bg-slate-900 text-gray-100 dark:text-slate-100 overflow-auto">
              <div className="flex">
                {/* 라인 번호 */}
                {showLineNumbers && (
                  <div className="bg-gray-800 dark:bg-slate-800 px-4 py-4 text-xs text-gray-400 dark:text-slate-400 select-none border-r border-gray-700 dark:border-slate-600">
                    {generateLineNumbers(lineCount).map((num, index) => (
                      <div key={index} className="leading-6">
                        {num}
                      </div>
                    ))}
                  </div>
                )}

                {/* 코드 내용 */}
                <pre
                  ref={codeRef}
                  className={`flex-1 p-4 text-xs leading-6 overflow-x-auto ${
                    isFullscreen ? "min-h-[calc(100vh-80px)]" : "max-h-96"
                  }`}
                >
                  <code
                    dangerouslySetInnerHTML={{
                      __html: highlightCode(code, language),
                    }}
                  />
                </pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 코드 정보 요약 */}
      <div className="text-xs text-muted-foreground flex items-center space-x-4">
        <span>언어: {language}</span>
        <span>라인 수: {lineCount}</span>
        <span>문자 수: {code.length}</span>
        <span>신뢰도: {Math.round(confidence * 100)}%</span>
      </div>
    </div>
  );
}
