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
import { AlertTriangle, CheckCircle, Trash2 } from "lucide-react";

interface DeleteFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  fileName: string;
  isVectorized: boolean;
  isLoading?: boolean;
}

export function DeleteFileModal({
  open,
  onOpenChange,
  onConfirm,
  fileName,
  isVectorized,
  isLoading = false,
}: DeleteFileModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {isVectorized ? (
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-orange-500 dark:text-orange-400" />
            )}
            <DialogTitle>
              {isVectorized ? "안전한 파일 삭제" : "파일 삭제 경고"}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <DialogDescription asChild>
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="font-medium text-foreground mb-2">
                삭제할 파일: <span className="text-primary">{fileName}</span>
              </p>
              
              {isVectorized ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">벡터화가 완료되어 검색/채팅에 영향이 없습니다</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    • 원본 파일과 벡터 데이터가 모두 삭제됩니다<br/>
                    • 이미 처리된 데이터로 계속 검색 가능합니다
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">벡터화가 완료되지 않았습니다</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    • 검색/채팅에서 이 파일을 사용할 수 없게 됩니다<br/>
                    • 파일을 다시 업로드해야 합니다
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-sm text-center font-medium">
              정말 삭제하시겠습니까?
            </p>
          </div>
        </DialogDescription>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isLoading ? "삭제 중..." : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}