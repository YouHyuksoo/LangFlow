"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategorySelector } from "@/components/category-selector";
import { categoryAPI, settingsAPI } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  X,
  AlertTriangle,
} from "lucide-react";


interface FileUploadProps {
  onFileUpload: (file: File, category: string) => void;
  onLoadFiles?: () => void;
}

export function FileUpload({
  onFileUpload,
  onLoadFiles,
}: FileUploadProps) {
  const { toast } = useToast();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showCategoryWarning, setShowCategoryWarning] = useState(false);
  const [categoryNames, setCategoryNames] = useState<{ [key: string]: string }>(
    {}
  );
  const [hasCalledOnLoadFiles, setHasCalledOnLoadFiles] = useState(false);
  const [maxFileSize, setMaxFileSize] = useState<number>(10); // MB, 기본값 10MB

  // 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsAPI.getSettings();
        setMaxFileSize(settings.maxFileSize);
      } catch (error) {
        console.error("설정 로드 실패:", error);
        // 에러가 발생해도 기본값(10MB) 사용
      }
    };

    loadSettings();
  }, []);

  // 카테고리 이름 로드 (최적화된 버전)
  useEffect(() => {
    const loadCategoryNames = async () => {
      try {
        const categories = await categoryAPI.getCategories();
        const nameMap: { [key: string]: string } = {};
        categories.forEach((cat: any) => {
          nameMap[cat.category_id] = cat.name;
        });
        setCategoryNames(nameMap);
      } catch (error) {
        console.error("카테고리 이름 로드 실패:", error);
        // 에러가 발생해도 계속 진행
      }
    };

    loadCategoryNames();
  }, []); // 빈 의존성 배열 - 컴포넌트 마운트 시 한 번만 실행

  // 파일 목록 로드 (개선된 onLoadFiles 호출)
  useEffect(() => {
    console.log("FileUpload - onLoadFiles 호출 활성화 (개선된 에러 처리)");
    if (onLoadFiles && !hasCalledOnLoadFiles) {
      console.log("FileUpload에서 onLoadFiles 최초 호출");
      onLoadFiles();
      setHasCalledOnLoadFiles(true);
    }
  }, []); // 빈 의존성 배열 - 컴포넌트 마운트 시 한 번만 실행

  // 기본 카테고리 자동 선택 (첫 번째 카테고리)
  const handleCategoryChange = (categories: string[]) => {
    setSelectedCategories(categories);
    // 카테고리가 선택되면 경고 메시지 숨기기
    if (categories.length > 0) {
      setShowCategoryWarning(false);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (selectedCategories.length === 0) {
        setShowCategoryWarning(true);
        // 3초 후 경고 메시지 숨기기
        setTimeout(() => setShowCategoryWarning(false), 3000);
        return;
      }

      // 파일 검증
      for (const file of acceptedFiles) {
        // 파일 크기 검증 (설정에서 가져온 크기 제한 사용)
        const maxSizeBytes = maxFileSize * 1024 * 1024; // MB를 bytes로 변환
        if (file.size > maxSizeBytes) {
          const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
          toast({
            title: "파일 크기 초과",
            description: `"${file.name}" 파일의 크기가 너무 큽니다. (현재: ${fileSizeMB}MB, 최대: ${maxFileSize}MB)`,
            variant: "destructive",
          });
          return;
        }

        // 파일 형식 검증
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
        const fileName = file.name.toLowerCase();
        const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
        
        if (!hasValidExtension) {
          toast({
            title: "잘못된 파일 형식",
            description: `"${file.name}"은 지원되지 않는 파일 형식입니다. PDF, DOC, PPT, XLS 파일만 업로드할 수 있습니다.`,
            variant: "destructive",
          });
          return;
        }
      }

      setIsUploading(true);

      for (const file of acceptedFiles) {
        try {
          // 각 카테고리별로 파일 업로드
          for (const category of selectedCategories) {
            await onFileUpload(file, category);
          }
        } catch (error) {
          console.error("파일 업로드 실패:", error);
          throw error; // 에러를 상위로 전파하여 부모 컴포넌트가 처리할 수 있게 함
        }
      }

      setIsUploading(false);
    },
    [selectedCategories, onFileUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    multiple: true,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };


  return (
    <div className="space-y-6">
      {/* 카테고리 선택 */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <span>업로드 카테고리 선택 (필수)</span>
          </CardTitle>
          <CardDescription>
            문서를 업로드할 카테고리를 선택해주세요. 카테고리 선택 없이는
            업로드할 수 없습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategorySelector
            selectedCategories={selectedCategories}
            onCategoryChange={handleCategoryChange}
            showDocumentCount={false}
            multiSelect={true}
          />

          {/* 카테고리 선택 안내 */}
          {selectedCategories.length === 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  카테고리를 선택해야 파일을 업로드할 수 있습니다.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 카테고리 경고 메시지 */}
      {showCategoryWarning && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-red-800 font-medium">
              카테고리를 먼저 선택해주세요!
            </span>
          </div>
          <p className="text-sm text-red-700 mt-1">
            파일을 업로드하기 전에 위에서 카테고리를 선택해주세요.
          </p>
        </div>
      )}

      {/* 파일 업로드 영역 */}
      <Card className={selectedCategories.length === 0 ? "opacity-50" : ""}>
        <CardHeader>
          <CardTitle>문서 업로드</CardTitle>
          <CardDescription>
            {selectedCategories.length > 0
              ? "PDF, DOC, PPT, XLS 파일을 드래그하거나 클릭하여 업로드하세요"
              : "카테고리를 선택한 후 파일을 업로드할 수 있습니다"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 드래그 앤 드롭 영역 */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : selectedCategories.length === 0
                ? "border-gray-300 bg-gray-50"
                : "border-border hover:border-primary/50"
            } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
          >
            <input {...getInputProps()} />
            <Upload
              className={`h-12 w-12 mx-auto mb-4 ${
                selectedCategories.length === 0
                  ? "text-gray-400"
                  : "text-muted-foreground"
              }`}
            />
            {isDragActive ? (
              <p className="text-lg font-medium text-primary">
                파일을 여기에 놓으세요
              </p>
            ) : (
              <>
                <p
                  className={`text-lg font-medium mb-2 ${
                    selectedCategories.length === 0 ? "text-gray-500" : ""
                  }`}
                >
                  {selectedCategories.length === 0
                    ? "카테고리를 먼저 선택해주세요"
                    : "파일을 드래그하거나 클릭하여 업로드"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  PDF, DOC, PPT, XLS 파일만 지원됩니다 (최대 {maxFileSize}MB)
                </p>
                <Button
                  disabled={selectedCategories.length === 0}
                  className={
                    selectedCategories.length === 0
                      ? "bg-gray-300 cursor-not-allowed"
                      : ""
                  }
                >
                  <Upload className="h-4 w-4 mr-2" />
                  파일 선택
                </Button>
              </>
            )}
          </div>

          {/* 업로드 진행 상황 */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">업로드 진행 중...</span>
                <span className="text-sm text-muted-foreground">0%</span>
              </div>
              <Progress value={0} className="w-full" />
            </div>
          )}

          {/* 선택된 카테고리 표시 */}
          {selectedCategories.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">선택된 업로드 카테고리</h4>
              <div className="flex flex-wrap gap-2">
                {selectedCategories.map((category) => (
                  <Badge
                    key={category}
                    variant="secondary"
                    className="flex items-center space-x-1"
                  >
                    <span>{categoryNames[category] || category}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                      onClick={() =>
                        setSelectedCategories(
                          selectedCategories.filter((c) => c !== category)
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
