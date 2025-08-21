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
import { Checkbox } from "@/components/ui/checkbox";
import { CategorySelector } from "@/components/category-selector";
import { categoryAPI, settingsAPI } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  X,
  AlertTriangle,
  FileText,
} from "lucide-react";


interface FileUploadProps {
  onFileUpload: (file: File, category: string, convertToPdf?: boolean) => void;
  onLoadFiles?: () => void;
  onUploadStart?: (fileName: string) => void;
  onUploadComplete?: (fileName: string) => void;
}

export function FileUpload({
  onFileUpload,
  onLoadFiles,
  onUploadStart,
  onUploadComplete,
}: FileUploadProps) {
  const { toast } = useToast();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showCategoryWarning, setShowCategoryWarning] = useState(false);
  const [categoryNames, setCategoryNames] = useState<{ [key: string]: string }>(
    {}
  );
  const [hasCalledOnLoadFiles, setHasCalledOnLoadFiles] = useState(false);
  const [maxFileSize, setMaxFileSize] = useState<number>(10);
  const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx']);
  const [convertToPdf, setConvertToPdf] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsAPI.getSettings();
        setMaxFileSize(settings.maxFileSize || 10);
        const fileTypes = settings.allowedFileTypes || ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
        const formattedTypes = fileTypes.map((type: string) => type.startsWith('.') ? type : `.${type}`);
        setAllowedFileTypes(formattedTypes);
      } catch (error) {
        console.error("설정 로드 실패:", error);
      }
    };
    loadSettings();
  }, []);

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
      }
    };
    loadCategoryNames();
  }, []);

  useEffect(() => {
    if (onLoadFiles && !hasCalledOnLoadFiles) {
      onLoadFiles();
      setHasCalledOnLoadFiles(true);
    }
  }, []);

  const handleCategoryChange = (categories: string[]) => {
    setSelectedCategories(categories);
    if (categories.length > 0) {
      setShowCategoryWarning(false);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (selectedCategories.length === 0) {
        setShowCategoryWarning(true);
        setTimeout(() => setShowCategoryWarning(false), 3000);
        return;
      }

      for (const file of acceptedFiles) {
        const maxSizeBytes = maxFileSize * 1024 * 1024;
        if (file.size > maxSizeBytes) {
          const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
          toast({ title: "파일 크기 초과", description: `"${file.name}" 파일의 크기가 너무 큽니다. (현재: ${fileSizeMB}MB, 최대: ${maxFileSize}MB)`, variant: "destructive" });
          return;
        }

        const fileName = file.name.toLowerCase();
        const hasValidExtension = allowedFileTypes.some(ext => fileName.endsWith(ext.toLowerCase()));
        
        if (!hasValidExtension) {
          const allowedTypesText = allowedFileTypes.map(type => type.toUpperCase()).join(', ');
          toast({ title: "잘못된 파일 형식", description: `"${file.name}"은 지원되지 않는 파일 형식입니다. 지원 형식: ${allowedTypesText}`, variant: "destructive" });
          return;
        }
      }

      setIsUploading(true);

      for (const file of acceptedFiles) {
        onUploadStart?.(file.name);
        try {
          for (const category of selectedCategories) {
            await onFileUpload(file, category, convertToPdf);
          }
          onUploadComplete?.(file.name);
        } catch (error) {
          console.error("파일 업로드 실패:", error);
          throw error;
        }
      }

      setIsUploading(false);
    },
    [selectedCategories, onFileUpload, onUploadStart, onUploadComplete, allowedFileTypes, maxFileSize, toast, convertToPdf]
  );

  const getAcceptTypes = () => {
    const acceptMap: { [key: string]: string[] } = {};
    allowedFileTypes.forEach(type => {
      const lowerType = type.toLowerCase();
      switch (lowerType) {
        case '.pdf': acceptMap["application/pdf"] = [".pdf"]; break;
        case '.doc': acceptMap["application/msword"] = [".doc"]; break;
        case '.docx': acceptMap["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] = [".docx"]; break;
        case '.ppt': acceptMap["application/vnd.ms-powerpoint"] = [".ppt"]; break;
        case '.pptx': acceptMap["application/vnd.openxmlformats-officedocument.presentationml.presentation"] = [".pptx"]; break;
        case '.xls': acceptMap["application/vnd.ms-excel"] = [".xls"]; break;
        case '.xlsx': acceptMap["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] = [".xlsx"]; break;
        case '.txt': acceptMap["text/plain"] = [".txt"]; break;
        case '.md': acceptMap["text/markdown"] = [".md"]; break;
        case '.html': acceptMap["text/html"] = [".html"]; break;
        default: acceptMap[`*/*`] = [lowerType]; break;
      }
    });
    return acceptMap;
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: getAcceptTypes(),
    multiple: true,
  });

  return (
    <div className="space-y-4">
      {/* 카테고리 선택 카드 */}
      <Card className="border-2 border-primary/20">
        <CardContent className="py-4">
          <CategorySelector selectedCategories={selectedCategories} onCategoryChange={handleCategoryChange} showDocumentCount={true} multiSelect={true} showManageButtons={true} />
          
          {/* 경고 메시지 */}
          {selectedCategories.length === 0 && (
            <div className="mt-3 p-2 bg-accent/20 border border-accent rounded text-xs">
              <div className="flex items-center space-x-1">
                <AlertTriangle className="h-3 w-3 text-accent-foreground" />
                <span className="text-accent-foreground">카테고리를 선택해야 파일을 업로드할 수 있습니다.</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF 자동 변환 옵션 */}
      <Card className="border border-border">
        <CardContent className="py-3">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="convert-to-pdf"
              checked={convertToPdf}
              onCheckedChange={setConvertToPdf}
            />
            <label
              htmlFor="convert-to-pdf"
              className="text-sm font-medium leading-none"
            >
              PDF 자동 변환
            </label>
            <span className="text-xs text-muted-foreground">
              (DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, HTML 등)
            </span>
          </div>
        </CardContent>
      </Card>

      {showCategoryWarning && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-destructive-foreground" />
            <span className="font-medium text-destructive-foreground">카테고리를 먼저 선택해주세요!</span>
          </div>
          <p className="text-sm text-destructive-foreground/80 mt-1">파일을 업로드하기 전에 위에서 카테고리를 선택해주세요.</p>
        </div>
      )}

      <Card className={selectedCategories.length === 0 ? "opacity-50" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">문서 업로드</CardTitle>
          <CardDescription className="text-sm">{selectedCategories.length > 0 ? `${allowedFileTypes.map(type => type.toUpperCase()).join(', ')} 파일을 드래그하거나 클릭하여 업로드` : "카테고리를 선택한 후 파일을 업로드할 수 있습니다"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragActive ? "border-primary bg-primary/5" : selectedCategories.length === 0 ? "border-border bg-muted" : "border-border hover:border-primary/50"} ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
            <input {...getInputProps()} />
            <Upload className={`h-8 w-8 mx-auto mb-3 text-muted-foreground`} />
            {isDragActive ? (
              <p className="text-base font-medium text-primary">파일을 여기에 놓으세요</p>
            ) : (
              <>
                <p className={`text-base font-medium mb-2 ${selectedCategories.length === 0 ? "text-muted-foreground" : ""}`}>
                  {selectedCategories.length === 0 ? "카테고리를 먼저 선택해주세요" : "파일을 드래그하거나 클릭하여 업로드"}
                </p>
                <p className="text-xs text-muted-foreground mb-3">{allowedFileTypes.map(type => type.toUpperCase()).join(', ')} 파일 지원 (최대 {maxFileSize}MB)</p>
                <Button disabled={selectedCategories.length === 0} size="sm">
                  <Upload className="h-3 w-3 mr-1" />
                  파일 선택
                </Button>
              </>
            )}
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">업로드 진행 중...</span>
                <span className="text-sm text-muted-foreground">0%</span>
              </div>
              <Progress value={0} className="w-full" />
            </div>
          )}

          {selectedCategories.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground">선택된 카테고리</h4>
              <div className="flex flex-wrap gap-1">
                {selectedCategories.map((category) => (
                  <Badge key={category} variant="secondary" className="flex items-center space-x-1 text-xs px-2 py-1">
                    <span>{categoryNames[category] || category}</span>
                    <Button variant="ghost" size="sm" className="h-3 w-3 p-0 ml-1 hover:bg-transparent" onClick={() => setSelectedCategories(selectedCategories.filter((c) => c !== category))}>
                      <X className="h-2 w-2" />
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
