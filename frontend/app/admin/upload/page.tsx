"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  AlertCircle,
  Loader2,
  Folder,
  Tag,
  Eye,
  Download,
  Trash2,
} from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { DuplicateFileModal } from "@/components/duplicate-file-modal";
import { DeleteFileModal } from "@/components/delete-file-modal";
import { fileAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { emitFileUploaded, emitFileDeleted } from "@/lib/file-events";

interface UploadedFile {
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "preprocessing" | "preprocessed" | "vectorizing" | "completed" | "failed" | "pending";
  category: string;
  uploadTime: Date;
  fileId?: string;
  error?: string;
  // Docling 관련 정보 추가
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
  vectorized?: boolean;
}

interface FileStats {
  totalFiles: number;
  totalSize: number;
  vectorizedFiles: number;
  recentUploads: number;
}

export default function UploadPage() {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [stats, setStats] = useState<FileStats>({
    totalFiles: 0,
    totalSize: 0,
    vectorizedFiles: 0,
    recentUploads: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isLoadingRef, setIsLoadingRef] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);


  // 중복 파일 모달 상태
  const [duplicateModal, setDuplicateModal] = useState({
    isOpen: false,
    pendingFile: null as File | null,
    pendingCategory: "",
    duplicateInfo: null as any,
  });

  // 삭제 확인 모달 상태
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    file: null as UploadedFile | null,
    isDeleting: false,
  });

  // 삭제 핸들러 함수
  const handleDeleteClick = (file: UploadedFile) => {
    setDeleteModal({
      isOpen: true,
      file: file,
      isDeleting: false,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.file) return;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      await fileAPI.deleteFile(deleteModal.file.fileId!);

      // UI에서 즉시 해당 파일 제거
      setUploadedFiles((prevFiles) =>
        prevFiles.filter((file) => file.fileId !== deleteModal.file!.fileId)
      );

      // 통계 재계산
      const remainingFiles = uploadedFiles.filter(
        (file) => file.fileId !== deleteModal.file!.fileId
      );
      const totalSize = remainingFiles.reduce(
        (sum, file) => sum + file.size,
        0
      );
      const vectorizedCount = remainingFiles.filter(
        (file) => file.status === "completed"
      ).length;
      const recentCount = remainingFiles.filter((file) => {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return file.uploadTime > oneDayAgo;
      }).length;

      setStats({
        totalFiles: remainingFiles.length,
        totalSize,
        vectorizedFiles: vectorizedCount,
        recentUploads: recentCount,
      });

      // 파일 삭제 이벤트 발송
      emitFileDeleted(deleteModal.file.fileId!);

      toast({
        title: "파일 삭제 완료",
        description: `${deleteModal.file.name} 파일이 성공적으로 삭제되었습니다.`,
      });
    } catch (error) {
      toast({
        title: "삭제 실패",
        description: "파일 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setDeleteModal({
        isOpen: false,
        file: null,
        isDeleting: false,
      });
    }
  };

  // 파일 목록 로드 함수 (개선된 에러 처리)
  const loadUploadedFiles = useCallback(
    async (forceRefresh = false) => {
      // 강화된 중복 호출 방지 (강제 새로고침 시에는 무시)
      if (isLoadingRef && !forceRefresh) {
        return;
      }

      if (hasLoadedOnce && !forceRefresh) {
        return;
      }

      try {
        setIsLoadingRef(true);
        setLoading(true);

        const response = await fileAPI.getFiles(undefined, true); // excludeCompleted = true

        // API 응답을 UploadedFile 형태로 변환
        const serverFiles: UploadedFile[] = response.map((file: any) => {
          // 새로운 파일 상태 시스템에 맞춰 상태 결정
          let status:
            | "uploading"
            | "preprocessing" 
            | "preprocessed"
            | "vectorizing"
            | "completed"
            | "failed"
            | "pending" = "pending";

          // 새로운 상태 시스템
          if (file.status === "uploaded") {
            status = "pending"; // 업로드됨 - 전처리 대기
          } else if (file.status === "preprocessing") {
            status = "preprocessing"; // 전처리 중
          } else if (file.status === "preprocessed") {
            status = "preprocessed"; // 전처리 완료 - 벡터화 대기
          } else if (file.status === "vectorizing") {
            status = "vectorizing"; // 벡터화 중
          } else if (file.status === "completed") {
            status = "completed"; // 모든 처리 완료
          } else if (file.status === "failed") {
            status = "failed"; // 처리 실패
          } else if (file.status === "uploading") {
            status = "uploading"; // 업로드 중
          } else {
            // 하위 호환성: 기존 시스템 상태 처리
            if (file.vectorized === true) {
              status = "completed";
            } else if (file.status === "processing") {
              status = "preprocessing";
            } else if (file.status === "error") {
              status = "failed";
            } else {
              status = "pending";
            }
          }

          return {
            name: file.filename,
            size: file.file_size || file.size || 0,
            progress: 100, // 이미 업로드된 파일이므로 100%
            status: status,
            category: file.category_name || "미분류",
            uploadTime: file.upload_time
              ? new Date(file.upload_time)
              : new Date(),
            fileId: file.file_id,
            error: file.error_message || file.error || null,
          };
        });

        setUploadedFiles(serverFiles);

        // 통계 계산
        const totalSize = serverFiles.reduce((sum, file) => sum + file.size, 0);
        const vectorizedCount = serverFiles.filter(
          (file) => file.status === "completed"
        ).length;
        const recentCount = serverFiles.filter((file) => {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return file.uploadTime > oneDayAgo;
        }).length;

        setStats({
          totalFiles: serverFiles.length,
          totalSize,
          vectorizedFiles: vectorizedCount,
          recentUploads: recentCount,
        });

        // 로드 완료 플래그 설정
        setHasLoadedOnce(true);
      } catch (error) {
        console.error("업로드된 파일 목록 로드 실패:", error);

        // 에러 발생 시 빈 목록으로 설정 (무한 호출 방지)
        setUploadedFiles([]);
        setStats({
          totalFiles: 0,
          totalSize: 0,
          vectorizedFiles: 0,
          recentUploads: 0,
        });
        setHasLoadedOnce(true); // 에러가 발생해도 재시도 방지

        toast({
          title: "로드 실패",
          description: "업로드된 파일 목록을 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setIsLoadingRef(false);
      }
    },
    [toast, hasLoadedOnce]
  ); // hasLoadedOnce도 의존성에 포함

  // 컴포넌트 마운트 시 파일 목록 로드
  useEffect(() => {
    loadUploadedFiles();
  }, []); // 빈 의존성 배열 - 컴포넌트 마운트 시 한 번만 실행


  const handleFileUpload = async (
    file: File,
    category: string,
    convertToPdf: boolean = false,
    forceReplace: boolean = false
  ) => {
    try {
      // 파일 업로드 API 호출
      const response = await fileAPI.uploadFile(file, category, forceReplace, convertToPdf);

      // 업로드 성공 토스트
      const successMessage = convertToPdf 
        ? `${file.name} 파일이 PDF로 변환되어 업로드되었습니다.`
        : `${file.name} 파일이 성공적으로 업로드되었습니다.`;
      
      toast({
        title: "업로드 완료",
        description: successMessage,
      });

      // 중복 모달이 열려있으면 닫기
      if (duplicateModal.isOpen) {
        setDuplicateModal({
          isOpen: false,
          pendingFile: null,
          pendingCategory: "",
          duplicateInfo: null,
        });
      }

      // 파일 목록 즉시 갱신 (강제 새로고침)
      await loadUploadedFiles(true);

      // 파일 이벤트 발송 (다른 컴포넌트 갱신용)
      emitFileUploaded({
        fileId: response.file_id,
        filename: response.filename,
        category: category,
      });
    } catch (error: any) {
      console.error("파일 업로드 실패:", error);

      // 중복 파일 에러 처리 (409 Conflict)
      if (error.response?.status === 409) {
        const duplicateInfo =
          error.response?.data?.detail || error.response?.data;

        setDuplicateModal({
          isOpen: true,
          pendingFile: file,
          pendingCategory: category,
          duplicateInfo: duplicateInfo,
        });
        return; // 에러 토스트 표시하지 않고 모달로 처리
      }

      // 기타 에러 처리
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "파일 업로드 중 오류가 발생했습니다.";


      toast({
        title: "업로드 실패",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // 중복 파일 처리 함수들
  const handleDuplicateReplace = async () => {
    if (duplicateModal.pendingFile && duplicateModal.pendingCategory) {
      await handleFileUpload(
        duplicateModal.pendingFile,
        duplicateModal.pendingCategory,
        false, // convertToPdf는 원래 설정값 유지 필요 - 추후 state에서 가져오도록 수정 예정
        true
      );
      // 교체 완료 후 추가 갱신 (보험)
      setTimeout(() => {
        loadUploadedFiles(true); // 강제 새로고침
      }, 500);
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateModal({
      isOpen: false,
      pendingFile: null,
      pendingCategory: "",
      duplicateInfo: null,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "preprocessing":
        return <Loader2 className="h-4 w-4 text-accent-foreground animate-spin" />;
      case "preprocessed":
        return <Clock className="h-4 w-4 text-accent-foreground" />;
      case "vectorizing":
        return <Loader2 className="h-4 w-4 text-accent-foreground animate-spin" />;
      case "uploading":
        return <Loader2 className="h-4 w-4 text-accent-foreground animate-spin" />;
      case "pending":
        return <AlertCircle className="h-4 w-4 text-accent-foreground" />;
      default:
        return <Upload className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">처리 완료</Badge>;
      case "failed":
        return <Badge variant="destructive">처리 실패</Badge>;
      case "preprocessing":
        return <Badge variant="secondary">전처리 중</Badge>;
      case "preprocessed":
        return <Badge variant="secondary">벡터화 대기</Badge>;
      case "vectorizing":
        return <Badge variant="secondary">벡터화 중</Badge>;
      case "uploading":
        return <Badge variant="secondary">업로드 중</Badge>;
      case "pending":
        return <Badge variant="secondary">전처리 대기</Badge>;
      default:
        return <Badge variant="outline">알 수 없음</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">파일 업로드</h1>
        </div>
        <div className="text-center py-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <div className="text-muted-foreground">
              파일 목록을 불러오는 중...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">파일 업로드</h1>
      </div>

      {/* 통계 카드들 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 파일</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFiles}</div>
            <p className="text-xs text-muted-foreground">
              총 {formatFileSize(stats.totalSize)}
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">처리 완료</CardTitle>
            <Database className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vectorizedFiles}</div>
            <p className="text-xs text-muted-foreground">
              전체의{" "}
              {stats.totalFiles > 0
                ? Math.round((stats.vectorizedFiles / stats.totalFiles) * 100)
                : 0}
              %
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">최근 업로드</CardTitle>
            <Upload className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentUploads}</div>
            <p className="text-xs text-muted-foreground">지난 24시간 내</p>
          </CardContent>
        </Card>

        <Card className="stat-card relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">처리 대기</CardTitle>
            <Clock className="h-4 w-4 text-accent-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalFiles - stats.vectorizedFiles}
            </div>
            <p className="text-xs text-muted-foreground">처리 대기 중</p>
          </CardContent>
        </Card>
      </div>

      {/* 파일 업로드 컴포넌트 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">새 파일 업로드</CardTitle>
              <CardDescription className="text-sm">
                PDF 파일을 업로드합니다. 전처리와 벡터화는 별도로 진행됩니다.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FileUpload
            onFileUpload={handleFileUpload}
            onLoadFiles={loadUploadedFiles}
            onUploadStart={(fileName) => {
              // 업로드 시작
            }}
            onUploadComplete={(fileName) => {
              // 추가 갱신 (보험)
              setTimeout(() => {
                loadUploadedFiles(true);
              }, 200);
            }}
          />
        </CardContent>
      </Card>

      {/* 업로드된 문서 관리 */}
      <Card>
        <CardHeader>
          <CardTitle>업로드된 문서 관리</CardTitle>
          <CardDescription>
            업로드된 문서의 처리 상태를 확인하고 관리할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {uploadedFiles.length === 0 ? (
            <div className="text-center py-8">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">업로드된 문서가 없습니다.</p>
              <p className="text-sm text-muted-foreground mt-2">
                위의 업로드 영역을 사용하여 첫 번째 문서를 업로드해보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {uploadedFiles.map((file, index) => {
                const isCompleted = file.status === "completed";
                const isProcessing = ["preprocessing", "vectorizing", "uploading"].includes(
                  file.status
                );
                const hasError = file.status === "failed";

                return (
                  <div
                    key={`${file.fileId || index}-${file.name}`}
                    className={`relative p-4 border rounded-lg transition-all ${
                      isCompleted
                        ? "border-primary/20 bg-primary/5"
                        : hasError
                        ? "border-destructive/20 bg-destructive/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex-shrink-0 mt-1">
                          {getStatusIcon(file.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium truncate">{file.name}</p>
                            {isCompleted && (
                              <Badge variant="default">처리 완료</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <span>{formatFileSize(file.size)}</span>
                            <span className="flex items-center gap-1">
                              <Folder className="h-3 w-3" />
                              {file.category}
                            </span>
                            <span>{file.uploadTime.toLocaleString()}</span>
                          </div>

                          {isCompleted && (
                            <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded-md mb-2">
                              <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                              <div className="text-sm text-primary/80">
                                <span className="font-medium">모든 처리 완료!</span>
                                <span className="ml-2">원본 파일은 이제 안전하게 삭제할 수 있습니다.</span>
                              </div>
                            </div>
                          )}

                          {isProcessing && (
                            <div className="flex items-center gap-2 p-2 bg-accent/20 border-accent/30 rounded-md mb-2">
                              <Loader2 className="h-4 w-4 text-accent-foreground flex-shrink-0 animate-spin" />
                              <span className="text-sm text-accent-foreground">
                                {file.status === "preprocessing" && "파일 전처리 중..."}
                                {file.status === "vectorizing" && "벡터화 진행 중..."}
                                {file.status === "uploading" && "업로드 진행 중..."}
                              </span>
                            </div>
                          )}

                          {file.status === "pending" && (
                            <div className="flex items-center gap-2 p-2 bg-accent/20 border-accent/30 rounded-md mb-2">
                              <AlertCircle className="h-4 w-4 text-accent-foreground flex-shrink-0" />
                              <span className="text-sm text-accent-foreground">전처리 대기 중입니다.</span>
                            </div>
                          )}

                          {hasError && file.error && (
                            <div className="flex items-center gap-2 p-2 bg-destructive/10 border-destructive/20 rounded-md mb-2">
                              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                              <span className="text-sm text-destructive">{file.error}</span>
                            </div>
                          )}

                          {file.status === "uploading" && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>업로드 진행률</span>
                                <span>{file.progress}%</span>
                              </div>
                              <Progress value={file.progress} />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        <Button variant="outline" size="sm" onClick={() => { /* view logic */ }} disabled={!file.fileId || isProcessing} title="파일 미리보기"><Eye className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => { /* download logic */ }} disabled={!file.fileId || isProcessing} title="파일 다운로드"><Download className="h-4 w-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(file)} disabled={!file.fileId} title="파일 삭제"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 중복 파일 확인 모달 */}
      <DuplicateFileModal
        isOpen={duplicateModal.isOpen}
        onClose={handleDuplicateCancel}
        onReplace={handleDuplicateReplace}
        onCancel={handleDuplicateCancel}
        fileName={duplicateModal.pendingFile?.name || ""}
        existingFileName={
          duplicateModal.duplicateInfo?.existing_file?.filename ||
          duplicateModal.duplicateInfo?.filename ||
          ""
        }
        fileSize={duplicateModal.pendingFile?.size || 0}
        category={duplicateModal.pendingCategory}
      />

      <DeleteFileModal
        open={deleteModal.isOpen}
        onOpenChange={(open) =>
          setDeleteModal((prev) => ({ ...prev, isOpen: open }))
        }
        onConfirm={handleDeleteConfirm}
        fileName={deleteModal.file?.name || ""}
        isVectorized={
          deleteModal.file?.status === "completed"
        }
        isLoading={deleteModal.isDeleting}
      />
    </div>
  );
}
