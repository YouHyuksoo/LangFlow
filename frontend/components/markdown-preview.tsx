"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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

  // 마크다운을 HTML로 변환하고 차트 데이터 추출
  const { renderedHtml, chartData, tableData, hasInlineChartJs } =
    useMemo(() => {
      const html = parseMarkdownToHtml(markdown);
      const charts = extractChartData(markdown);
      const tables = extractTableData(html); // HTML 테이블 데이터도 추출
      
      // 차트로 변환 가능한 테이블만 필터링
      const chartableTableData = tables.filter(table => isChartableTable(table));

      // 인라인 Chart.js 코드가 있는지 확인 (HTML 코드 블록 내)
      const hasInlineChartCode =
        /```html[\s\S]*?new Chart\([\s\S]*?```/i.test(markdown) ||
        /<script[\s\S]*?new Chart\([\s\S]*?<\/script>/i.test(markdown);

      console.log("마크다운에 인라인 Chart.js 코드 포함:", hasInlineChartCode);
      console.log("전체 테이블 수:", tables.length, "차트 가능한 테이블 수:", chartableTableData.length);

      return {
        renderedHtml: html,
        chartData: charts,
        tableData: chartableTableData,
        hasInlineChartJs: hasInlineChartCode,
      };
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
    <div className={`space-y-4 w-full max-w-none ${className}`} style={{ width: '100%', maxWidth: 'none' }}>
      {/* 마크다운 감지 상태 표시 - 통합된 정보 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">마크다운 문서</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {stats.lines}줄 • {stats.words}단어 • 신뢰도 {Math.round(confidence * 100)}%
            {stats.headers > 0 && ` • ${stats.headers}개 헤더`}
            {stats.codeBlocks > 0 && ` • ${stats.codeBlocks}개 코드블록`}
          </div>
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
            <CardTitle className="text-sm">미리보기</CardTitle>

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
              isFullscreen
                ? "fixed inset-0 z-50 bg-white dark:bg-slate-900"
                : "relative"
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
                isFullscreen ? "h-[calc(100vh-80px)]" : "h-96"
              } overflow-auto`}
            >
              {renderMode === "rendered" ? (
                <div className="p-6">
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />

                  {/* 인라인 Chart.js 스크립트 실행 */}
                  {hasInlineChartJs && (
                    <ChartJsScriptExecutor html={renderedHtml} />
                  )}

                  {/* 차트 렌더링 */}
                  {(chartData.length > 0 || tableData.length > 0) && (
                    <div className="mt-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold">
                          📊 데이터 시각화
                        </h4>
                        <div className="text-xs text-gray-500">
                          총 {chartData.length + tableData.length}개 차트
                        </div>
                      </div>

                      {chartData.length > 0 && (
                        <div className="space-y-4">
                          <h5 className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            🎯 스크립트에서 추출된 차트 ({chartData.length}개)
                          </h5>
                          {chartData.map((chart, index) => (
                            <div
                              key={`script-${index}`}
                              className="border-l-4 border-blue-500 pl-4"
                            >
                              <ChartRenderer chartConfig={chart} />
                            </div>
                          ))}
                        </div>
                      )}

                      {tableData.length > 0 && (
                        <div className="space-y-4">
                          <h5 className="text-sm font-medium text-green-600 dark:text-green-400">
                            📈 테이블에서 생성된 차트 ({tableData.length}개)
                          </h5>
                          {tableData.map((table, index) => (
                            <div
                              key={`table-${index}`}
                              className="border-l-4 border-green-500 pl-4"
                            >
                              <TableChartRenderer tableData={table} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 인라인 Chart.js 코드가 있는 경우 특별 알림 */}
                  {hasInlineChartJs && (
                    <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                        <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          📊 Chart.js 코드가 포함된 HTML 블록 감지됨
                        </h4>
                      </div>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                        HTML 코드 블록에 Chart.js 차트가 포함되어 있습니다. 더
                        나은 렌더링을 위해 HTML 미리보기를 사용해보세요.
                      </p>
                      <div className="text-xs text-yellow-600 dark:text-yellow-400">
                        💡 팁: 이 콘텐츠는 HTML 콘텐츠로 감지되어 HTML
                        미리보기에서 차트가 정상 작동할 것입니다.
                      </div>
                    </div>
                  )}

                  {/* 디버깅 정보 (개발 환경에서만) */}
                  {process.env.NODE_ENV === "development" && (
                    <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-300">
                          🔍 차트 디버깅 정보
                        </summary>
                        <div className="mt-2 space-y-2 text-xs">
                          <div>
                            <strong>추출된 차트 데이터:</strong>{" "}
                            {chartData.length}개
                          </div>
                          <div>
                            <strong>테이블 데이터:</strong> {tableData.length}개
                          </div>
                          <div>
                            <strong>마크다운 길이:</strong> {markdown.length}{" "}
                            문자
                          </div>
                          <div>
                            <strong>Chart.js 스크립트 포함:</strong>{" "}
                            {/<script[\s\S]*?Chart[\s\S]*?<\/script>/i.test(
                              markdown
                            )
                              ? "✅ 예"
                              : "❌ 아니오"}
                          </div>
                          <div>
                            <strong>인라인 Chart.js 코드:</strong>{" "}
                            {hasInlineChartJs ? "✅ 예" : "❌ 아니오"}
                          </div>
                          <div>
                            <strong>HTML 테이블 포함:</strong>{" "}
                            {/<table[\s\S]*?<\/table>/i.test(renderedHtml)
                              ? "✅ 예"
                              : "❌ 아니오"}
                          </div>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ) : (
                <pre className="p-6 text-xs bg-gray-50 dark:bg-slate-800 dark:text-slate-200 whitespace-pre-wrap font-mono">
                  {markdown}
                </pre>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

/**
 * 간단한 마크다운 → HTML 파서
 */
function parseMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // 구분선 (제일 먼저 처리)
  html = html.replace(
    /^(\s*---+\s*)$/gm,
    '<hr class="my-6 border-gray-300 dark:border-slate-600" />'
  );
  html = html.replace(
    /\n(\s*---+\s*)\n/g,
    '\n<hr class="my-6 border-gray-300 dark:border-slate-600" />\n'
  );

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
  html = html.replace(/<p class="mb-4">(<hr[^>]*>)<\/p>/g, "$1");

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
 * ASCII 아트 표를 HTML 테이블로 변환
 */
function parseAsciiTables(html: string): string {
  // ASCII 표 패턴 감지 (유니코드 박스 문자와 일반 ASCII 모두 지원)
  const patterns = [
    // 유니코드 박스 문자 패턴 (┌─┬─┐, ├─┼─┤, └─┴─┘)
    /([┌├└](?:[─┬┼┴]+[─┬┼┴]*)*[┐┤┘]\s*\n(?:(?:[│┃]\s*[^│┃\n]*[│┃]?\s*\n)*(?:[├┼└](?:[─┬┼┴]+[─┬┼┴]*)*[┤┼┘]\s*\n)?)*)/gm,
    
    // 유니코드 단순 라인 패턴 (──┴────────┴────────┴)
    /((?:.*[┌┬┐├┼┤└┴┘─│┃].*\n){2,})/gm,
    
    // ASCII 문자 패턴 (+---+---+)
    /(\+(?:[-=]+\+)+\s*\n(?:(?:\|[^|\n]*\|?\s*\n)*(?:\+(?:[-=]+\+)+\s*\n)?)*)/gm,
  ];

  patterns.forEach(pattern => {
    html = html.replace(pattern, (match) => {
      try {
        return convertAsciiTableToHtml(match);
      } catch (error) {
        console.log('ASCII 표 변환 실패:', error);
        return match; // 변환 실패시 원본 반환
      }
    });
  });

  return html;
}

/**
 * ASCII 표 텍스트를 HTML 테이블로 변환
 */
function convertAsciiTableToHtml(asciiTable: string): string {
  const lines = asciiTable.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) return asciiTable;

  // 표 데이터 추출
  const tableData: string[][] = [];
  let isInTable = false;
  
  for (const line of lines) {
    // 경계선 스킵 (┌─┬─┐, ├─┼─┤, └─┴─┘, +---+---+)
    if (/^[┌├└\+]?[─\-=┬┼┴\+]*[┐┤┘\+]?$/.test(line.trim())) {
      isInTable = true;
      continue;
    }
    
    // 데이터 행 처리
    if (line.includes('│') || line.includes('┃') || line.includes('|')) {
      const cells = line
        .split(/[│┃|]/)
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);
      
      if (cells.length > 0) {
        tableData.push(cells);
      }
    }
  }

  if (tableData.length === 0) return asciiTable;

  // HTML 테이블 생성
  let tableHtml = '<div class="overflow-x-auto my-6">';
  tableHtml += '<table class="min-w-full border-collapse border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm rounded-lg">';

  // 첫 번째 행을 헤더로 처리
  const headers = tableData[0];
  const bodyRows = tableData.slice(1);

  // 헤더 생성
  if (headers.length > 0) {
    tableHtml += '<thead class="bg-gray-50 dark:bg-slate-700">';
    tableHtml += '<tr>';
    headers.forEach(header => {
      tableHtml += `<th class="border border-gray-300 dark:border-slate-600 px-4 py-3 font-semibold text-gray-900 dark:text-slate-100 text-left">${header}</th>`;
    });
    tableHtml += '</tr>';
    tableHtml += '</thead>';
  }

  // 바디 생성
  if (bodyRows.length > 0) {
    tableHtml += '<tbody>';
    bodyRows.forEach((row, rowIndex) => {
      const rowClass = rowIndex % 2 === 0 
        ? "bg-white dark:bg-slate-800" 
        : "bg-gray-50 dark:bg-slate-700";
      tableHtml += `<tr class="${rowClass} hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">`;
      
      // 컬럼 수를 헤더와 맞춤
      const maxCols = Math.max(headers.length, row.length);
      for (let i = 0; i < maxCols; i++) {
        const cellContent = row[i] || '';
        tableHtml += `<td class="border border-gray-300 dark:border-slate-600 px-4 py-3 text-gray-700 dark:text-slate-200 text-left">${cellContent}</td>`;
      }
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody>';
  }

  tableHtml += '</table>';
  tableHtml += '</div>';

  return tableHtml;
}

/**
 * 마크다운 표를 HTML 테이블로 변환 (개선된 버전)
 */
function parseMarkdownTables(html: string): string {
  // 먼저 ASCII 아트 표 처리
  html = parseAsciiTables(html);
  
  // 더 포괄적인 마크다운 표 패턴 매칭 (공백과 줄바꿈 허용)
  const tableRegex =
    /^\s*(\|.+\|)\s*\n\s*(\|[-:\s|]+\|)\s*\n((?:\s*\|.+\|\s*\n?)*)/gm;

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
        const rowClass =
          rowIndex % 2 === 0
            ? "bg-white dark:bg-slate-800"
            : "bg-gray-50 dark:bg-slate-700";
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

/**
 * 마크다운에서 차트 데이터 추출 (개선된 버전)
 */
function extractChartData(markdown: string): ChartConfig[] {
  const charts: ChartConfig[] = [];

  console.log("차트 데이터 추출 시작, 마크다운 길이:", markdown.length);

  // 더 포괄적인 Chart.js 스크립트 패턴 매칭
  const scriptPatterns = [
    // 기본 스크립트 태그
    /<script[\s\S]*?new Chart\(([\s\S]*?)\)<\/script>/gi,
    // 더 복잡한 구조
    /<script[\s\S]*?Chart\(([\s\S]*?)\)[\s\S]*?<\/script>/gi,
    // 직접적인 Chart 생성
    /new Chart\([^,]+,\s*(\{[\s\S]*?\})\)/gi,
    // Chart 객체 생성
    /Chart\([^,]+,\s*(\{[\s\S]*?\})\)/gi,
  ];

  scriptPatterns.forEach((pattern, patternIndex) => {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      try {
        console.log(
          `패턴 ${patternIndex + 1}에서 매치 발견:`,
          match[1].substring(0, 200) + "..."
        );

        const configStr = match[1];

        // 차트 타입 감지 (더 유연하게)
        const typeMatch = configStr.match(
          /['"']?type['"']?\s*:\s*['"'](\w+)['"']/i
        );
        const chartType = typeMatch ? typeMatch[1].toLowerCase() : "pie";

        console.log("감지된 차트 타입:", chartType);

        if (chartType === "pie" || chartType === "doughnut") {
          // 레이블과 데이터 추출 (더 강력한 정규식)
          const labelPatterns = [
            /labels\s*:\s*\[([\s\S]*?)\]/i,
            /['"']labels['"']\s*:\s*\[([\s\S]*?)\]/i,
          ];

          const dataPatterns = [
            /data\s*:\s*\[([\s\S]*?)\]/i,
            /['"']data['"']\s*:\s*\[([\s\S]*?)\]/i,
          ];

          let labels: string[] = [];
          let data: number[] = [];

          // 레이블 추출
          for (const pattern of labelPatterns) {
            const labelMatch = configStr.match(pattern);
            if (labelMatch) {
              labels = labelMatch[1]
                .split(",")
                .map((l) => l.trim().replace(/['"]/g, ""))
                .filter((l) => l.length > 0);
              console.log("추출된 레이블:", labels);
              break;
            }
          }

          // 데이터 추출
          for (const pattern of dataPatterns) {
            const dataMatch = configStr.match(pattern);
            if (dataMatch) {
              data = dataMatch[1]
                .split(",")
                .map((d) => parseFloat(d.trim()) || 0)
                .filter((d) => !isNaN(d));
              console.log("추출된 데이터:", data);
              break;
            }
          }

          if (
            labels.length > 0 &&
            data.length > 0 &&
            labels.length === data.length
          ) {
            console.log("유효한 차트 데이터 발견, 차트 생성");

            charts.push({
              type: chartType,
              data: {
                labels,
                datasets: [
                  {
                    data,
                    backgroundColor: [
                      "#FF6384",
                      "#36A2EB",
                      "#FFCE56",
                      "#4BC0C0",
                      "#9966FF",
                      "#FF9F40",
                      "#FF6B6B",
                      "#4ECDC4",
                      "#45B7D1",
                      "#96CEB4",
                      "#FFEAA7",
                      "#DDA0DD",
                    ],
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  title: {
                    display: true,
                    text: `${chartType} 차트`,
                  },
                  legend: {
                    position: "bottom",
                  },
                },
              },
            });
          } else {
            console.log(
              "차트 데이터 불일치 - 레이블:",
              labels.length,
              "데이터:",
              data.length
            );
          }
        } else if (chartType === "bar" || chartType === "line") {
          // 바 차트 및 라인 차트 지원
          const labelMatch = configStr.match(/labels\s*:\s*\[([\s\S]*?)\]/i);
          const dataMatch = configStr.match(/data\s*:\s*\[([\s\S]*?)\]/i);

          if (labelMatch && dataMatch) {
            const labels = labelMatch[1]
              .split(",")
              .map((l) => l.trim().replace(/['"]/g, ""));
            const data = dataMatch[1]
              .split(",")
              .map((d) => parseFloat(d.trim()) || 0);

            charts.push({
              type: chartType,
              data: {
                labels,
                datasets: [
                  {
                    label: `${chartType} 데이터`,
                    data,
                    backgroundColor:
                      chartType === "bar" ? "#36A2EB" : "transparent",
                    borderColor: "#36A2EB",
                    borderWidth: 2,
                    fill: chartType === "line" ? false : true,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  title: {
                    display: true,
                    text: `${chartType} 차트`,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              },
            });
          }
        }
      } catch (error) {
        console.error("차트 데이터 파싱 오류:", error);
      }
    }
  });

  console.log("추출된 차트 개수:", charts.length);
  return charts;
}

interface ChartConfig {
  type: "pie" | "doughnut" | "bar" | "line";
  data: any;
  options: any;
}

interface TableData {
  headers: string[];
  rows: string[][];
  title?: string;
}

/**
 * 테이블이 차트로 변환 가능한지 확인
 */
function isChartableTable(tableData: TableData): boolean {
  // 2열 테이블이 아니면 차트 불가능
  if (tableData.headers.length !== 2) {
    return false;
  }

  // 두 번째 열의 값들을 카운트
  const counts: { [key: string]: number } = {};
  let validDataCount = 0;
  
  tableData.rows.forEach((row) => {
    const value = row[1];
    if (value && value.trim() !== '') {
      counts[value] = (counts[value] || 0) + 1;
      validDataCount++;
    }
  });

  const uniqueValues = Object.keys(counts);
  
  // 차트로 만들기에 충분한 데이터가 있는지 확인
  // - 최소 2개 이상의 행
  // - 최소 2개 이상의 고유값 (또는 1개 값이지만 여러 번 나타남)
  // - 전체 데이터의 80% 이상이 유효한 데이터
  const hasEnoughData = validDataCount >= 2;
  const hasVariation = uniqueValues.length >= 2 || (uniqueValues.length === 1 && validDataCount >= 2);
  const hasGoodDataQuality = validDataCount >= tableData.rows.length * 0.8;
  
  return hasEnoughData && hasVariation && hasGoodDataQuality;
}

/**
 * HTML에서 테이블 데이터 추출
 */
function extractTableData(html: string): TableData[] {
  const tables: TableData[] = [];

  // HTML 테이블 패턴 매칭
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let match;

  while ((match = tableRegex.exec(html)) !== null) {
    try {
      const tableContent = match[1];

      // 헤더 추출
      const headRegex = /<thead[^>]*>([\s\S]*?)<\/thead>/i;
      const headMatch = headRegex.exec(tableContent);
      let headers: string[] = [];

      if (headMatch) {
        const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
        let thMatch;
        while ((thMatch = thRegex.exec(headMatch[1])) !== null) {
          headers.push(thMatch[1].trim());
        }
      }

      // 바디 데이터 추출
      const bodyRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i;
      const bodyMatch = bodyRegex.exec(tableContent);
      const rows: string[][] = [];

      if (bodyMatch) {
        const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let trMatch;
        while ((trMatch = trRegex.exec(bodyMatch[1])) !== null) {
          const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
          let tdMatch;
          const row: string[] = [];
          while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
            row.push(tdMatch[1].trim());
          }
          if (row.length > 0) {
            rows.push(row);
          }
        }
      }

      if (headers.length > 0 && rows.length > 0) {
        tables.push({ headers, rows });
      }
    } catch (error) {
      console.error("테이블 데이터 추출 오류:", error);
    }
  }

  return tables;
}

/**
 * 차트 렌더러 컴포넌트 (개선된 버전)
 */
function ChartRenderer({ chartConfig }: { chartConfig: ChartConfig }) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chartRef.current || !chartConfig) {
      console.error("ChartRenderer: 캔버스 또는 차트 설정이 없습니다");
      setError("차트 렌더링에 필요한 요소가 없습니다");
      setIsLoading(false);
      return;
    }

    console.log("ChartRenderer: 차트 렌더링 시작", chartConfig);
    setIsLoading(true);
    setError(null);

    // Chart.js 동적 import
    import("chart.js/auto")
      .then((Chart) => {
        console.log("Chart.js 로드 성공:", Chart);

        try {
          // 기존 차트 인스턴스 정리
          if (chartInstance.current) {
            console.log("기존 차트 인스턴스 제거");
            chartInstance.current.destroy();
            chartInstance.current = null;
          }

          // 새 차트 인스턴스 생성
          console.log("새 차트 인스턴스 생성 중...");
          chartInstance.current = new Chart.default(
            chartRef.current!,
            chartConfig as any
          );
          console.log("차트 인스턴스 생성 완료:", chartInstance.current);

          setIsLoading(false);
        } catch (chartError) {
          console.error("차트 인스턴스 생성 실패:", chartError);
          setError(`차트 생성 실패: ${chartError}`);
          setIsLoading(false);
        }
      })
      .catch((importError) => {
        console.error("Chart.js 동적 임포트 실패:", importError);
        setError(`Chart.js 로드 실패: ${importError.message}`);
        setIsLoading(false);
      });

    return () => {
      if (chartInstance.current) {
        console.log("ChartRenderer cleanup: 차트 인스턴스 정리");
        try {
          chartInstance.current.destroy();
          chartInstance.current = null;
        } catch (cleanupError) {
          console.error("차트 인스턴스 정리 실패:", cleanupError);
        }
      }
    };
  }, [chartConfig]);

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 bg-red-500 rounded-full"></div>
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
            차트 렌더링 오류
          </h4>
        </div>
        <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
        <details className="mt-2">
          <summary className="text-xs cursor-pointer text-red-500">
            차트 설정 보기
          </summary>
          <pre className="mt-1 text-xs bg-red-100 dark:bg-red-900/40 p-2 rounded overflow-x-auto">
            {JSON.stringify(chartConfig, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {chartConfig.options?.plugins?.title?.text ||
            `${chartConfig.type} 차트`}
        </h4>
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin"></div>
            로딩 중...
          </div>
        )}
      </div>

      <div
        style={{
          position: "relative",
          height: "300px",
          opacity: isLoading ? 0.5 : 1,
          transition: "opacity 0.3s ease",
        }}
      >
        <canvas
          ref={chartRef}
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            display: "block",
          }}
        />
      </div>

      {process.env.NODE_ENV === "development" && (
        <details className="mt-2">
          <summary className="text-xs cursor-pointer text-gray-500">
            개발자 정보
          </summary>
          <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
            {JSON.stringify(chartConfig, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * Chart.js 스크립트 실행기 컴포넌트
 */
function ChartJsScriptExecutor({ html }: { html: string }) {
  const executedRef = useRef(false);

  useEffect(() => {
    if (executedRef.current) return;

    console.log("Chart.js 스크립트 실행기 시작");

    // Chart.js 라이브러리가 로드될 때까지 대기
    const waitForChartJs = () => {
      if (typeof window !== "undefined" && (window as any).Chart) {
        console.log("📚 Chart.js 라이브러리 준비됨, DOM 대기 후 스크립트 실행");

        // DOM이 완전히 렌더링될 때까지 잠시 대기
        setTimeout(() => {
          executeChartJsScripts();
          executedRef.current = true;
        }, 200); // DOM 렌더링 대기 시간 증가
      } else {
        console.log("⏳ Chart.js 라이브러리 대기 중...");
        setTimeout(waitForChartJs, 100);
      }
    };

    // Chart.js 스크립트를 추출하고 실행
    const executeChartJsScripts = () => {
      console.log("🔍 Chart.js 스크립트 추출 시작");
      console.log("HTML 내용 길이:", html.length);

      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      let scriptCount = 0;

      while ((match = scriptRegex.exec(html)) !== null) {
        scriptCount++;
        const scriptContent = match[1];
        console.log(
          `📝 스크립트 ${scriptCount} 발견:`,
          scriptContent.substring(0, 200) + "..."
        );

        if (/new Chart\(|Chart\s*\(/i.test(scriptContent)) {
          console.log("✅ Chart.js 스크립트 확인됨, 실행 시작");

          // Canvas 요소가 존재하는지 먼저 확인
          const canvasIdMatch = scriptContent.match(
            /getElementById\(['"`]([^'"`]+)['"`]\)/
          );
          const canvasId = canvasIdMatch ? canvasIdMatch[1] : null;

          if (canvasId) {
            const canvasElement = document.getElementById(canvasId);
            console.log(
              `🎨 Canvas 요소 (${canvasId}) 존재 여부:`,
              !!canvasElement
            );

            if (!canvasElement) {
              console.error(`❌ Canvas 요소 '${canvasId}'를 찾을 수 없습니다!`);
              // DOM에서 모든 canvas 요소 찾기
              const allCanvases = document.querySelectorAll("canvas");
              console.log(
                "📊 현재 DOM의 모든 canvas 요소:",
                allCanvases.length + "개"
              );
              allCanvases.forEach((canvas, index) => {
                console.log(`  Canvas ${index + 1}:`, {
                  id: canvas.id || "(ID 없음)",
                  width: canvas.width,
                  height: canvas.height,
                  parentElement: canvas.parentElement?.tagName,
                });
              });
              return; // canvas가 없으면 실행하지 않음
            }
          }

          try {
            // 스크립트 내용 정리 (이스케이프 문자 제거)
            const cleanScript = scriptContent
              .replace(/\\\\/g, "")
              .replace(/\\'/g, "'")
              .replace(/\\"/g, '"');

            console.log("🚀 정리된 스크립트 실행 중...");
            console.log(
              "실행할 스크립트:",
              cleanScript.substring(0, 300) + "..."
            );

            // 안전한 실행을 위해 Function 생성자 사용
            const func = new Function(cleanScript);
            func();

            console.log("✅ Chart.js 스크립트 실행 성공!");

            // 실행 후 차트 인스턴스 확인
            setTimeout(() => {
              if (canvasId) {
                const canvas = document.getElementById(canvasId);
                if (canvas && (canvas as any).__chart) {
                  console.log(
                    "🎉 Chart 인스턴스가 성공적으로 생성됨:",
                    (canvas as any).__chart
                  );
                } else {
                  console.log(
                    "⚠️  Chart 인스턴스를 찾을 수 없음 (차트가 생성되지 않았을 수 있음)"
                  );
                }
              }
            }, 500);
          } catch (error) {
            console.error("❌ Chart.js 스크립트 실행 오류:", error);
            console.log("실패한 스크립트 내용:", scriptContent);
          }
        } else {
          console.log("⏭️  Chart.js가 아닌 스크립트, 건너뛰기");
        }
      }

      console.log(`📊 총 ${scriptCount}개의 스크립트 검사 완료`);
    };

    // Chart.js CDN 동적 로드
    if (!document.querySelector('script[src*="chart.js"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js";
      script.onload = () => {
        console.log("Chart.js CDN 로드 완료");
        waitForChartJs();
      };
      script.onerror = () => {
        console.error("Chart.js CDN 로드 실패");
      };
      document.head.appendChild(script);
    } else {
      waitForChartJs();
    }

    return () => {
      // cleanup 시 실행 플래그 리셋
      executedRef.current = false;
    };
  }, [html]);

  return (
    <div className="chart-js-executor" style={{ display: "none" }}>
      {/* Chart.js 스크립트 실행용 숨겨진 컴포넌트 */}
    </div>
  );
}

/**
 * 테이블 차트 렌더러 컴포넌트
 */
function TableChartRenderer({ tableData }: { tableData: TableData }) {
  const [showChart, setShowChart] = useState(false);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  // 테이블 데이터를 차트 데이터로 변환
  const chartConfig = useMemo(() => {
    if (tableData.headers.length !== 2) return null;

    // 두 번째 열의 값들을 카운트
    const counts: { [key: string]: number } = {};
    tableData.rows.forEach((row) => {
      const value = row[1];
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);

    if (labels.length === 0) return null;

    return {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: [
              "#FF6384",
              "#36A2EB",
              "#FFCE56",
              "#4BC0C0",
              "#9966FF",
              "#FF9F40",
              "#FF6B6B",
              "#4ECDC4",
              "#45B7D1",
              "#96CEB4",
              "#FFEAA7",
              "#DDA0DD",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `${tableData.headers[1]} 분포`,
          },
          legend: {
            position: "bottom",
          },
        },
      },
    };
  }, [tableData]);

  useEffect(() => {
    if (!chartRef.current || !showChart || !chartConfig) return;

    // Chart.js 동적 import
    import("chart.js/auto")
      .then((Chart) => {
        if (chartInstance.current) {
          chartInstance.current.destroy();
        }

        chartInstance.current = new Chart.default(
          chartRef.current!,
          chartConfig as any
        );
      })
      .catch((error) => {
        console.error("Chart.js 로드 실패:", error);
      });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [showChart, chartConfig]);

  if (!chartConfig) return null;

  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border">
      <div className="flex items-center justify-between mb-4">
        <h5 className="text-sm font-medium">테이블 데이터 시각화</h5>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowChart(!showChart)}
        >
          {showChart ? "차트 숨기기" : "차트 보기"}
        </Button>
      </div>

      {showChart && (
        <div style={{ position: "relative", height: "300px" }}>
          <canvas ref={chartRef}></canvas>
        </div>
      )}

      {!showChart && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {Object.keys(chartConfig.data.labels).length}개 항목의 분포를 차트로
          확인할 수 있습니다.
        </div>
      )}
    </div>
  );
}
