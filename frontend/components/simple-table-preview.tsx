"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SimpleTablePreviewProps {
  content: string;
  className?: string;
}

/**
 * 간단한 표 형태 텍스트를 감지하고 테이블로 렌더링
 */
export function SimpleTablePreview({
  content,
  className = "",
}: SimpleTablePreviewProps) {
  const { toast } = useToast();

  // 간단한 표 패턴 감지 (| 없이도 동작)
  const detectSimpleTable = (text: string) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // 최소 3줄 이상이어야 표로 인식
    if (lines.length < 3) return null;

    // 각 줄에서 구분자 찾기 (|, 탭, 여러 공백)
    const separatorPatterns = [
      /\s*\|\s*/g, // | 구분자
      /\t+/g, // 탭 구분자
      /\s{2,}/g, // 2개 이상의 공백
    ];

    let bestPattern = null;
    let maxColumns = 0;

    // 가장 적합한 구분자 패턴 찾기
    for (const pattern of separatorPatterns) {
      const testColumns = lines[0].split(pattern).length;
      if (testColumns > maxColumns && testColumns >= 2) {
        maxColumns = testColumns;
        bestPattern = pattern;
      }
    }

    if (!bestPattern || maxColumns < 2) return null;

    // 모든 행을 파싱
    const rows = lines
      .map((line) => {
        const cells = line.split(bestPattern).map((cell) => cell.trim());
        // 빈 셀 제거 (시작과 끝의 빈 셀만)
        while (cells.length > 0 && cells[0] === "") cells.shift();
        while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
        return cells;
      })
      .filter((row) => row.length >= 2);

    if (rows.length < 2) return null;

    // 헤더와 데이터 분리
    const headers = rows[0];
    const dataRows = rows.slice(1);

    return { headers, dataRows, columnCount: headers.length };
  };

  const tableData = detectSimpleTable(content);

  if (!tableData) return null;

  const copyTable = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "복사 완료",
        description: "표 데이터가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      console.error("복사 실패:", error);
      toast({
        title: "복사 실패",
        description: "표 복사 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 표 감지 상태 표시 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Table className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">표 형태 데이터 감지됨</span>
          <Badge variant="secondary" className="text-xs">
            {tableData.columnCount}열
          </Badge>
          <Badge variant="outline" className="text-xs">
            {tableData.dataRows.length}행
          </Badge>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={copyTable}
          className="text-xs"
        >
          <Copy className="h-3 w-3 mr-1" />
          복사
        </Button>
      </div>

      {/* 표 미리보기 */}
      <Card className="border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">표 미리보기</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {tableData.columnCount}×{tableData.dataRows.length + 1}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300 bg-white">
              {/* 헤더 */}
              <thead className="bg-gray-50">
                <tr>
                  {tableData.headers.map((header, index) => (
                    <th
                      key={index}
                      className="border border-gray-300 px-4 py-3 font-semibold text-gray-900 text-left"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* 데이터 행들 */}
              <tbody>
                {tableData.dataRows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={`${
                      rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-gray-100 transition-colors`}
                  >
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="border border-gray-300 px-4 py-3 text-gray-700"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 표 통계 */}
      <div className="text-xs text-muted-foreground flex items-center space-x-4">
        <span>열 수: {tableData.columnCount}</span>
        <span>행 수: {tableData.dataRows.length + 1}</span>
        <span>
          총 셀: {tableData.columnCount * (tableData.dataRows.length + 1)}
        </span>
      </div>
    </div>
  );
}
