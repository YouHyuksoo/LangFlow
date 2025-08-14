"use client";

import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Settings, 
  XCircle, 
  CheckCircle, 
  Table,
  FileImage,
  Eye,
  FileText
} from "lucide-react";

interface DoclingSettingsInfoProps {
  settings?: {
    docling_enabled?: boolean;
    docling_extract_tables?: boolean;
    docling_extract_images?: boolean;
    docling_ocr_enabled?: boolean;
    docling_output_format?: string;
  };
}

export function DoclingSettingsInfo({ settings }: DoclingSettingsInfoProps) {
  console.log('DoclingSettingsInfo - 받은 설정:', settings);
  const isEnabled = settings?.docling_enabled || false;
  console.log('DoclingSettingsInfo - Docling 활성화:', isEnabled);

  if (!isEnabled) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg text-sm">
        <XCircle className="h-4 w-4 text-gray-500" />
        <span className="text-gray-600 dark:text-gray-400">
          Docling 비활성화
        </span>
        <Badge variant="secondary" className="text-xs">
          기본 처리
        </Badge>
        <span className="text-xs text-muted-foreground ml-2">
          (설정에서 활성화 가능)
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-lg text-sm">
      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
      <span className="text-green-700 dark:text-green-300 font-medium">
        Docling 활성화
      </span>
      <div className="flex items-center gap-1">
        {settings?.docling_extract_tables && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Table className="h-3 w-3" />
            테이블
          </Badge>
        )}
        {settings?.docling_extract_images && (
          <Badge variant="secondary" className="text-xs gap-1">
            <FileImage className="h-3 w-3" />
            이미지
          </Badge>
        )}
        {settings?.docling_ocr_enabled && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Eye className="h-3 w-3" />
            OCR
          </Badge>
        )}
      </div>
    </div>
  );
}