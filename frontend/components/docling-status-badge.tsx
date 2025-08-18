"use client";

import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Zap, 
  Clock, 
  XCircle, 
  CheckCircle, 
  Table,
  Image,
  FileImage
} from "lucide-react";
// Tooltip 제거 - 간단한 배지로 표시

interface DoclingStatusBadgeProps {
  docling_processed?: boolean;
  docling_success?: boolean;
  docling_result?: {
    success: boolean;
    processing_time: number;
    metadata: {
      page_count?: number;
      table_count?: number;
      image_count?: number;
      processing_time?: number;
      docling_version?: string;
    };
  };
}

export function DoclingStatusBadge({
  docling_processed,
  docling_success,
  docling_result,
}: DoclingStatusBadgeProps) {
  // Docling 처리되지 않은 경우 - 배지 표시하지 않음 (전역 설정에서 이미 표시)
  if (!docling_processed) {
    return null;
  }

  // Docling 처리 실패한 경우
  if (!docling_success) {
    return (
      <Badge variant="destructive" className="gap-1" title="Docling 전처리 실패, 기본 방식으로 처리됨">
        <XCircle className="h-3 w-3" />
        Docling 실패
      </Badge>
    );
  }

  // Docling 처리 성공한 경우
  const metadata = docling_result?.metadata;
  const processingTime = metadata?.processing_time || docling_result?.processing_time || 0;

  return (
    <Badge 
      variant="default" 
      className="gap-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
      title={`Docling 고급 전처리 완료 (${processingTime.toFixed(2)}초)`}
    >
      <Zap className="h-3 w-3" />
      Docling 처리됨
    </Badge>
  );
}

export function DoclingDetailCard({ 
  docling_result 
}: { 
  docling_result: DoclingStatusBadgeProps['docling_result'] 
}) {
  if (!docling_result?.success) return null;

  const metadata = docling_result.metadata;

  return (
    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
        <span className="font-medium text-green-800 dark:text-green-200 text-sm">
          Docling 고급 전처리 적용
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-300">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>처리: {(docling_result.processing_time || 0).toFixed(2)}초</span>
        </div>
        
        {metadata?.page_count && (
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>{metadata.page_count}페이지</span>
          </div>
        )}
        
        {metadata?.table_count && metadata.table_count > 0 && (
          <div className="flex items-center gap-1">
            <Table className="h-3 w-3" />
            <span>{metadata.table_count}개 테이블</span>
          </div>
        )}
        
        {metadata?.image_count && metadata.image_count > 0 && (
          <div className="flex items-center gap-1">
            <FileImage className="h-3 w-3" />
            <span>{metadata.image_count}개 이미지</span>
          </div>
        )}
      </div>
      
      <div className="text-xs text-green-600 dark:text-green-400 mt-2">
        구조 인식, 테이블/이미지 처리, 향상된 검색 정확도
      </div>
    </div>
  );
}