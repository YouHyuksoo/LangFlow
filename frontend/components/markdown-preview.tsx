"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Copy,
  Download,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Code,
  BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MarkdownPreviewProps {
  markdown: string;
  confidence: number;
  className?: string;
}

export function MarkdownPreview({
  markdown,
  confidence,
  className = "",
}: MarkdownPreviewProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [showSource, setShowSource] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderMode, setRenderMode] = useState<"rendered" | "source">(
    "rendered"
  );
  const { toast } = useToast();

  // 마크다운을 HTML로 변환 (간단한 파서)
  const renderedHtml = useMemo(() => {
    return parseMarkdownToHtml(markdown);
  }, [markdown]);

  // 마크다운 통계
  const stats = useMemo(() => {
    const lines = markdown.split("\n").length;
    const words = markdown
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    const characters = markdown.length;
    const headers = (markdown.match(/^#{1,6}\s+/gm) || []).length;
    const codeBlocks = (markdown.match(/```[\s\S]*?```/g) || []).length;
    const links = (markdown.match(/\[.*?\]\(.*?\)/g) || []).length;
    const images = (markdown.match(/!\[.*?\]\(.*?\)/g) || []).length;
    const tables = (
      markdown.match(/^\|.+\|\s*\n\|[-:\s|]+\|\s*\n(?:\|.+\|\s*\n?)+/gm) || []
    ).length;

    return {
      lines,
      words,
      characters,
      headers,
      codeBlocks,
      links,
      images,
      tables,
    };
  }, [markdown]);

  // 마크다운 복사
  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      toast({
        title: "복사 완료",
        description: "마크다운이 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      console.error("복사 실패:", error);
      toast({
        title: "복사 실패",
        description: "마크다운 복사 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 마크다운 다운로드
  const downloadMarkdown = () => {
    try {
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `document-${Date.now()}.md`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "다운로드 완료",
        description: "마크다운 파일이 다운로드되었습니다.",
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

  if (!showPreview) {
    return (
      <div
        className={`flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-600 ${className}`}
      >
        <div className="flex items-center space-x-2">
          <FileText className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">마크다운 문서 감지됨</span>
          <Badge variant="secondary" className="text-xs">
            {stats.lines}줄
          </Badge>
          <Badge variant="outline" className="text-xs">
            {stats.headers}개 헤더
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
      {/* 마크다운 감지 상태 표시 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">마크다운 문서</span>
          <Badge variant="secondary" className="text-xs">
            신뢰도: {Math.round(confidence * 100)}%
          </Badge>
          <Badge variant="outline" className="text-xs">
            {stats.lines}줄
          </Badge>
          {stats.headers > 0 && (
            <Badge variant="outline" className="text-xs">
              {stats.headers}개 헤더
            </Badge>
          )}
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

      {/* 마크다운 미리보기 */}
      <Card className="border dark:border-slate-600 dark:bg-slate-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-sm">마크다운 미리보기</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {stats.words}단어
              </Badge>
            </div>

            <div className="flex items-center space-x-2">
              {/* 렌더링 모드 선택 */}
              <div className="flex items-center space-x-1 border rounded-md p-1">
                <Button
                  variant={renderMode === "rendered" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setRenderMode("rendered")}
                  className="text-xs px-2 py-1"
                >
                  <BookOpen className="h-3 w-3 mr-1" />
                  렌더링
                </Button>
                <Button
                  variant={renderMode === "source" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setRenderMode("source")}
                  className="text-xs px-2 py-1"
                >
                  <Code className="h-3 w-3 mr-1" />
                  소스
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={copyMarkdown}
                className="text-xs"
              >
                <Copy className="h-3 w-3 mr-1" />
                복사
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={downloadMarkdown}
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
            className={`border-t dark:border-slate-600 ${
              isFullscreen ? "fixed inset-0 z-50 bg-white dark:bg-slate-900" : "relative"
            }`}
          >
            {isFullscreen && (
              <div className="flex items-center justify-between p-4 border-b bg-gray-50 dark:bg-slate-800 dark:border-slate-600">
                <span className="text-sm font-medium">
                  마크다운 미리보기 - 전체화면
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

            <div
              className={`${
                isFullscreen ? "h-[calc(100vh-80px)]" : "max-h-96"
              } overflow-auto`}
            >
              {renderMode === "rendered" ? (
                <div
                  className="prose prose-sm max-w-none p-6 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              ) : (
                <pre className="p-6 text-xs bg-gray-50 dark:bg-slate-800 dark:text-slate-200 whitespace-pre-wrap font-mono">
                  {markdown}
                </pre>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 마크다운 통계 */}
      <div className="text-xs text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center space-x-1">
          <span className="font-medium">라인:</span>
          <span>{stats.lines}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="font-medium">단어:</span>
          <span>{stats.words}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="font-medium">헤더:</span>
          <span>{stats.headers}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="font-medium">코드블록:</span>
          <span>{stats.codeBlocks}</span>
        </div>
        {stats.links > 0 && (
          <div className="flex items-center space-x-1">
            <span className="font-medium">링크:</span>
            <span>{stats.links}</span>
          </div>
        )}
        {stats.images > 0 && (
          <div className="flex items-center space-x-1">
            <span className="font-medium">이미지:</span>
            <span>{stats.images}</span>
          </div>
        )}
        {stats.tables > 0 && (
          <div className="flex items-center space-x-1">
            <span className="font-medium">표:</span>
            <span>{stats.tables}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 간단한 마크다운 → HTML 파서
 */
function parseMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // 구분선 (제일 먼저 처리)
  html = html.replace(/^(\s*---+\s*)$/gm, '<hr class="my-6 border-gray-300 dark:border-slate-600" />');
  html = html.replace(/\n(\s*---+\s*)\n/g, '\n<hr class="my-6 border-gray-300 dark:border-slate-600" />\n');

  // 코드 블록 (먼저 처리하여 다른 변환에서 제외)
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(
      `<pre class="bg-gray-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto"><code class="language-${
        lang || "text"
      } dark:text-slate-200">${escapeHtml(code.trim())}</code></pre>`
    );
    return `__CODE_BLOCK_${index}__`;
  });

  // 인라인 코드
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-gray-100 dark:bg-slate-700 dark:text-slate-200 px-1 py-0.5 rounded text-sm">$1</code>'
  );

  // 헤더 (큰 것부터 작은 것 순으로 처리)
  html = html.replace(
    /^###### (.*$)/gm,
    '<h6 class="text-xs font-medium mt-3 mb-2 text-gray-600 dark:text-gray-400">$1</h6>'
  );
  html = html.replace(
    /^##### (.*$)/gm,
    '<h5 class="text-sm font-medium mt-4 mb-2 text-gray-700 dark:text-gray-300">$1</h5>'
  );
  html = html.replace(
    /^#### (.*$)/gm,
    '<h4 class="text-base font-semibold mt-5 mb-3 text-gray-800 dark:text-gray-200">$1</h4>'
  );
  html = html.replace(
    /^### (.*$)/gm,
    '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>'
  );
  html = html.replace(
    /^## (.*$)/gm,
    '<h2 class="text-xl font-semibold mt-8 mb-4">$1</h2>'
  );
  html = html.replace(
    /^# (.*$)/gm,
    '<h1 class="text-2xl font-bold mt-8 mb-6">$1</h1>'
  );

  // 볼드 & 이탤릭
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // 링크
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>'
  );

  // 이미지
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg" />'
  );

  // 리스트
  html = html.replace(/^\* (.+$)/gm, '<li class="ml-4">$1</li>');
  html = html.replace(/^- (.+$)/gm, '<li class="ml-4">$1</li>');
  html = html.replace(/^(\d+)\. (.+$)/gm, '<li class="ml-4">$2</li>');

  // 리스트 래핑
  html = html.replace(
    /(<li class="ml-4">.*<\/li>)/,
    '<ul class="list-disc space-y-1 mb-4">$1</ul>'
  );

  // 표 처리 (테이블)
  html = parseMarkdownTables(html);

  // 인용문
  html = html.replace(
    /^> (.+$)/gm,
    '<blockquote class="border-l-4 border-gray-300 dark:border-slate-600 pl-4 py-2 bg-gray-50 dark:bg-slate-800 dark:text-slate-200 italic">$1</blockquote>'
  );

  // 단락
  html = html.replace(/\n\n/g, '</p><p class="mb-4">');
  html = '<p class="mb-4">' + html + "</p>";

  // HR 태그가 p 태그로 감싸진 경우 수정
  html = html.replace(/<p class="mb-4">(<hr[^>]*>)<\/p>/g, '$1');

  // 빈 단락 제거
  html = html.replace(/<p class="mb-4"><\/p>/g, "");

  // 코드 블록 복원
  codeBlocks.forEach((block, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, block);
  });

  // 줄바꿈
  html = html.replace(/\n/g, "<br />");

  return html;
}

/**
 * 마크다운 표를 HTML 테이블로 변환
 */
function parseMarkdownTables(html: string): string {
  // 마크다운 표 패턴 매칭
  const tableRegex = /^(\|.+\|)\s*\n(\|[-:\s|]+\|)\s*\n((?:\|.+\|\s*\n?)*)/gm;

  return html.replace(
    tableRegex,
    (match, headerRow, separatorRow, bodyRows) => {
      // 헤더 파싱
      const headers = headerRow
        .split("|")
        .map((cell: string) => cell.trim())
        .filter((cell: string) => cell.length > 0);

      // 정렬 정보 파싱
      const alignments = separatorRow
        .split("|")
        .map((cell: string) => cell.trim())
        .filter((cell: string) => cell.length > 0)
        .map((cell: string) => {
          if (cell.startsWith(":") && cell.endsWith(":")) return "center";
          if (cell.endsWith(":")) return "right";
          return "left";
        });

      // 바디 행들 파싱
      const rows = bodyRows
        .trim()
        .split("\n")
        .map((row: string) =>
          row
            .split("|")
            .map((cell: string) => cell.trim())
            .filter((cell: string) => cell.length > 0)
        )
        .filter((row: string[]) => row.length > 0);

      // HTML 테이블 생성
      let tableHtml = '<div class="overflow-x-auto my-6">';
      tableHtml +=
        '<table class="min-w-full border-collapse border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm rounded-lg">';

      // 헤더 생성
      tableHtml += '<thead class="bg-gray-50 dark:bg-slate-700">';
      tableHtml += "<tr>";
      headers.forEach((header: string, index: number) => {
        const alignment = alignments[index] || "left";
        const alignClass =
          alignment === "center"
            ? "text-center"
            : alignment === "right"
            ? "text-right"
            : "text-left";
        tableHtml += `<th class="border border-gray-300 dark:border-slate-600 px-4 py-3 font-semibold text-gray-900 dark:text-slate-100 ${alignClass}">${header}</th>`;
      });
      tableHtml += "</tr>";
      tableHtml += "</thead>";

      // 바디 생성
      tableHtml += "<tbody>";
      rows.forEach((row: string[], rowIndex: number) => {
        const rowClass = rowIndex % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-gray-50 dark:bg-slate-700";
        tableHtml += `<tr class="${rowClass} hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">`;
        row.forEach((cell: string, cellIndex: number) => {
          const alignment = alignments[cellIndex] || "left";
          const alignClass =
            alignment === "center"
              ? "text-center"
              : alignment === "right"
              ? "text-right"
              : "text-left";
          tableHtml += `<td class="border border-gray-300 dark:border-slate-600 px-4 py-3 text-gray-700 dark:text-slate-200 ${alignClass}">${cell}</td>`;
        });
        tableHtml += "</tr>";
      });
      tableHtml += "</tbody>";

      tableHtml += "</table>";
      tableHtml += "</div>";

      return tableHtml;
    }
  );
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
