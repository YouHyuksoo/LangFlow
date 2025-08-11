"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, AlertTriangle } from "lucide-react";

interface DuplicateFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplace: () => void;
  onCancel: () => void;
  fileName: string;
  existingFileName: string;
  fileSize: number;
  category: string;
}

export function DuplicateFileModal({
  isOpen,
  onClose,
  onReplace,
  onCancel,
  fileName,
  existingFileName,
  fileSize,
  category,
}: DuplicateFileModalProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            중복 파일 감지
          </DialogTitle>
          <DialogDescription>
            동일한 내용의 파일이 이미 존재합니다. 어떻게 처리하시겠습니까?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 새 파일 정보 */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h4 className="font-medium text-blue-900 mb-2">업로드하려는 파일</h4>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-sm">{fileName}</p>
                <div className="flex items-center gap-4 text-xs text-blue-700">
                  <span>{formatFileSize(fileSize)}</span>
                  <span>카테고리: {category}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 기존 파일 정보 */}
          <div className="border rounded-lg p-4 bg-amber-50">
            <h4 className="font-medium text-amber-900 mb-2">이미 존재하는 파일</h4>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-sm">{existingFileName}</p>
                <p className="text-xs text-amber-700">
                  동일한 내용의 파일이 이미 업로드되어 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 경고 메시지 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">주의사항:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong>교체</strong>: 기존 파일을 삭제하고 새 파일로 대체합니다.</li>
                  <li><strong>취소</strong>: 업로드를 취소하고 기존 파일을 유지합니다.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            onClick={onReplace}
            className="flex-1 bg-amber-600 hover:bg-amber-700"
          >
            교체하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}