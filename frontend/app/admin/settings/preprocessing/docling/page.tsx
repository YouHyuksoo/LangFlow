"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Save, TestTube, Eye, CheckCircle, XCircle, Image, Table } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { settingsAPI } from "@/lib/api";

interface DoclingSettings {
  enabled: boolean;
  extract_tables: boolean;
  extract_images: boolean;
  ocr_enabled: boolean;
  output_format: string;
  max_file_size_mb: number;
  supported_formats: string[];
  
  // 청크 설정 (Docling 전용)
  chunk_size?: number;
  chunk_overlap?: number;
  enable_semantic_chunking?: boolean;
}

export default function DoclingSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<DoclingSettings>({
    enabled: true,
    extract_tables: true,
    extract_images: false,
    ocr_enabled: true,
    output_format: "markdown",
    max_file_size_mb: 50,
    supported_formats: ["pdf", "docx", "pptx", "xlsx"],
    chunk_size: 1000,
    chunk_overlap: 150,
    enable_semantic_chunking: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchSettings = async () => {
    try {
      const data = await settingsAPI.getDoclingSettings();
      setSettings({
        enabled: data.enabled ?? true,
        extract_tables: data.extract_tables ?? true,
        extract_images: data.extract_images ?? false,
        ocr_enabled: data.ocr_enabled ?? true,
        output_format: data.output_format || "markdown",
        max_file_size_mb: data.max_file_size_mb || 50,
        supported_formats: data.supported_formats || ["pdf", "docx", "pptx", "xlsx"],
        chunk_size: data.chunk_size || 1000,
        chunk_overlap: data.chunk_overlap || 150,
        enable_semantic_chunking: data.enable_semantic_chunking ?? false,
      });
    } catch (error) {
      console.error("Docling 설정 로드 오류:", error);
      toast({
        title: "오류",
        description: "Docling 설정을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchSettings();
      setLoading(false);
    };
    loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateDoclingSettings(settings);
      toast({
        title: "성공",
        description: "Docling 설정이 저장되었습니다.",
      });
    } catch (error) {
      console.error("Docling 설정 저장 오류:", error);
      toast({
        title: "오류",
        description: "Docling 설정 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testDoclingProcessor = async () => {
    setTesting(true);
    try {
      await settingsAPI.testDoclingProcessor();
      toast({
        title: "성공",
        description: "Docling 프로세서 테스트가 성공했습니다.",
      });
    } catch (error) {
      toast({
        title: "오류",
        description: "Docling 프로세서 테스트에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const formatOptions = [
    { value: "markdown", label: "Markdown" },
    { value: "text", label: "Plain Text" },
    { value: "json", label: "JSON" },
  ];

  const supportedFormats = ["pdf", "docx", "pptx", "xlsx", "html"];

  const toggleFormat = (format: string) => {
    setSettings({
      ...settings,
      supported_formats: settings.supported_formats.includes(format)
        ? settings.supported_formats.filter((f) => f !== format)
        : [...settings.supported_formats, format],
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Docling 설정을 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Docling 전처리 설정
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Docling 문서 전처리 프로세서를 설정하고 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={testDoclingProcessor} disabled={testing}>
            <TestTube className="h-4 w-4 mr-2" />
            {testing ? "테스트 중..." : "연결 테스트"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>

      {/* Docling 활성화 상태 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${settings.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
            Docling 프로세서
            <Badge variant={settings.enabled ? "default" : "secondary"}>
              {settings.enabled ? "활성화" : "비활성화"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Docling 문서 전처리 프로세서의 활성화 상태를 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="docling-enabled"
              checked={settings.enabled}
              onChange={(e) =>
                setSettings({ ...settings, enabled: e.target.checked })
              }
              className="rounded"
            />
            <label htmlFor="docling-enabled" className="text-sm font-medium">
              Docling 프로세서 사용
            </label>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
            비활성화하면 기본 문서 처리기가 사용됩니다.
          </p>
        </CardContent>
      </Card>

      {/* 추출 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            추출 설정
          </CardTitle>
          <CardDescription>
            문서에서 추출할 요소들을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="extract-tables"
                checked={settings.extract_tables}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    extract_tables: e.target.checked,
                  })
                }
                className="rounded"
              />
              <label htmlFor="extract-tables" className="text-sm font-medium flex items-center gap-2">
                <Table className="h-4 w-4" />
                테이블 추출
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="extract-images"
                checked={settings.extract_images}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    extract_images: e.target.checked,
                  })
                }
                className="rounded"
              />
              <label htmlFor="extract-images" className="text-sm font-medium flex items-center gap-2">
                <Image className="h-4 w-4" />
                이미지 추출
              </label>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="ocr-enabled"
              checked={settings.ocr_enabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ocr_enabled: e.target.checked,
                })
              }
              className="rounded"
            />
            <label htmlFor="ocr-enabled" className="text-sm font-medium">
              OCR (광학 문자 인식) 사용
            </label>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            OCR은 이미지나 스캔된 문서의 텍스트를 추출할 때 사용됩니다.
          </p>
        </CardContent>
      </Card>

      {/* 출력 형식 및 파일 설정 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>출력 형식</CardTitle>
            <CardDescription>
              처리된 문서의 출력 형식을 선택합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <select
              className="w-full border rounded-md p-2 text-sm"
              value={settings.output_format}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  output_format: e.target.value,
                })
              }
            >
              {formatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Markdown 형식이 가장 구조화된 출력을 제공합니다.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>파일 크기 제한</CardTitle>
            <CardDescription>
              처리할 수 있는 최대 파일 크기를 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              min="1"
              max="1000"
              value={settings.max_file_size_mb}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  max_file_size_mb: parseInt(e.target.value),
                })
              }
              className="mb-2"
            />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              단위: MB (권장: 50MB 이하)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 지원 파일 형식 */}
      <Card>
        <CardHeader>
          <CardTitle>지원 파일 형식</CardTitle>
          <CardDescription>
            Docling으로 처리할 파일 형식을 선택합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {supportedFormats.map((format) => (
              <Badge
                key={format}
                variant={settings.supported_formats.includes(format) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleFormat(format)}
              >
                {settings.supported_formats.includes(format) ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1" />
                )}
                {format.toUpperCase()}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
            클릭하여 지원 형식을 추가/제거할 수 있습니다.
          </p>
        </CardContent>
      </Card>

      {/* Docling 전용 청크 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>Docling 청크 설정</CardTitle>
          <CardDescription>
            Docling 처리된 문서의 청크 분할 방식을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">청크 크기</label>
              <Input
                type="number"
                min="100"
                max="8000"
                value={settings.chunk_size || 1000}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    chunk_size: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">청크 오버랩</label>
              <Input
                type="number"
                min="0"
                max="500"
                value={settings.chunk_overlap || 150}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    chunk_overlap: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="semantic-chunking"
              checked={settings.enable_semantic_chunking || false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  enable_semantic_chunking: e.target.checked,
                })
              }
              className="rounded"
            />
            <label htmlFor="semantic-chunking" className="text-sm font-medium">
              의미 기반 청킹 사용
            </label>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>💡 Docling 특징:</strong> 문서의 구조적 정보를 활용하여 더 정확한 텍스트 추출이 가능합니다. 
              테이블과 이미지 추출 기능이 특히 강력합니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}