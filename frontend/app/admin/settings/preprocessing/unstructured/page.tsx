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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { FileSearch, Save, TestTube, Settings, Eye, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { unstructuredAPI } from "@/lib/api";

interface UnstructuredSettings {
  enabled: boolean;
  strategy: string;
  hi_res_model_name: string | null;
  infer_table_structure: boolean;
  extract_images_in_pdf: boolean;
  include_page_breaks: boolean;
  ocr_languages: string[];
  skip_infer_table_types: string[];
  chunking_strategy: string;
  max_characters: number;
  combine_text_under_n_chars: number;
  new_after_n_chars: number;
  max_file_size_mb: number;
  supported_formats: string[];
  enable_fallback: boolean;
  fallback_order: string[];

  // 추가 청크 설정
  chunk_size?: number;
  chunk_overlap?: number;
}

export default function UnstructuredSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<UnstructuredSettings>({
    enabled: true,
    strategy: "hi_res",
    hi_res_model_name: "yolox",
    infer_table_structure: true,
    extract_images_in_pdf: false,
    include_page_breaks: false,
    ocr_languages: ["kor", "eng"],
    skip_infer_table_types: [],
    chunking_strategy: "by_title",
    max_characters: 4000,
    combine_text_under_n_chars: 500,
    new_after_n_chars: 3800,
    max_file_size_mb: 100,
    supported_formats: ["pdf", "docx", "pptx", "xlsx", "html", "txt"],
    enable_fallback: true,
    fallback_order: ["docling", "basic"],
    chunk_size: 1000,
    chunk_overlap: 150,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const strategies = [
    { value: "hi_res", label: "고해상도 (Hi-Res)" },
    { value: "fast", label: "고속 처리 (Fast)" },
    { value: "ocr_only", label: "OCR 전용" },
    { value: "auto", label: "자동 선택" },
  ];

  const chunkingStrategies = [
    { value: "by_title", label: "제목별" },
    { value: "basic", label: "기본" },
    { value: "by_page", label: "페이지별" },
  ];

  const availableLanguages = ["kor", "eng", "jpn", "chi_sim", "chi_tra"];
  const supportedFormats = ["pdf", "docx", "pptx", "xlsx", "html", "txt", "md", "rtf"];
  const fallbackOptions = ["docling", "basic"];

  const fetchSettings = async () => {
    try {
      const data = await unstructuredAPI.getUnstructuredSettings();
      setSettings({
        enabled: data.enabled ?? true,
        strategy: data.strategy || "hi_res",
        hi_res_model_name: data.hi_res_model_name || "yolox",
        infer_table_structure: data.infer_table_structure ?? true,
        extract_images_in_pdf: data.extract_images_in_pdf ?? false,
        include_page_breaks: data.include_page_breaks ?? false,
        ocr_languages: data.ocr_languages || ["kor", "eng"],
        skip_infer_table_types: data.skip_infer_table_types || [],
        chunking_strategy: data.chunking_strategy || "by_title",
        max_characters: data.max_characters || 4000,
        combine_text_under_n_chars: data.combine_text_under_n_chars || 500,
        new_after_n_chars: data.new_after_n_chars || 3800,
        max_file_size_mb: data.max_file_size_mb || 100,
        supported_formats: data.supported_formats || ["pdf", "docx", "pptx", "xlsx", "html", "txt"],
        enable_fallback: data.enable_fallback ?? true,
        fallback_order: data.fallback_order || ["docling", "basic"],
        chunk_size: data.chunk_size || 1000,
        chunk_overlap: data.chunk_overlap || 150,
      });
    } catch (error) {
      console.error("Unstructured 설정 로드 오류:", error);
      toast({
        title: "오류",
        description: "Unstructured 설정을 불러오는 중 오류가 발생했습니다.",
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
      await unstructuredAPI.updateUnstructuredSettings(settings);
      toast({
        title: "성공",
        description: "Unstructured 설정이 저장되었습니다.",
      });
    } catch (error) {
      console.error("Unstructured 설정 저장 오류:", error);
      toast({
        title: "오류",
        description: "Unstructured 설정 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testUnstructuredProcessor = async () => {
    setTesting(true);
    try {
      await unstructuredAPI.testUnstructuredProcessor();
      toast({
        title: "성공",
        description: "Unstructured 프로세서 테스트가 성공했습니다.",
      });
    } catch (error) {
      toast({
        title: "오류",
        description: "Unstructured 프로세서 테스트에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const toggleFormat = (format: string) => {
    setSettings({
      ...settings,
      supported_formats: settings.supported_formats.includes(format)
        ? settings.supported_formats.filter((f) => f !== format)
        : [...settings.supported_formats, format],
    });
  };

  const toggleLanguage = (lang: string) => {
    setSettings({
      ...settings,
      ocr_languages: settings.ocr_languages.includes(lang)
        ? settings.ocr_languages.filter((l) => l !== lang)
        : [...settings.ocr_languages, lang],
    });
  };

  const toggleFallback = (option: string) => {
    setSettings({
      ...settings,
      fallback_order: settings.fallback_order.includes(option)
        ? settings.fallback_order.filter((o) => o !== option)
        : [...settings.fallback_order, option],
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Unstructured 설정을 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <FileSearch className="h-8 w-8 text-blue-500" />
            Unstructured 전처리 설정
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Unstructured 문서 전처리 프로세서를 설정하고 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={testUnstructuredProcessor} disabled={testing}>
            <TestTube className="h-4 w-4 mr-2 text-blue-500" />
            {testing ? "테스트 중..." : "연결 테스트"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>

      {/* Unstructured 활성화 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${settings.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
            Unstructured 프로세서
            <Badge variant={settings.enabled ? "default" : "secondary"}>
              {settings.enabled ? "활성화" : "비활성화"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Unstructured 문서 전처리 프로세서의 활성화를 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="unstructured-enabled"
              checked={settings.enabled}
              onChange={(e) =>
                setSettings({ ...settings, enabled: e.target.checked })
              }
              className="rounded"
            />
            <label htmlFor="unstructured-enabled" className="text-sm font-medium">
              Unstructured 프로세서 사용
            </label>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              <strong>💡 전처리 방식 선택:</strong> 기본 설정 페이지에서 문서 전처리 방식(기본/Docling/Unstructured)을 선택할 수 있습니다.
              기본 설정에서 설정한 방식에 따라 문서 처리가 진행됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 처리 전략 설정 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-purple-500" />
              처리 전략
            </CardTitle>
            <CardDescription>
              문서 처리 방식을 선택합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">전략</label>
              <Select
                value={settings.strategy}
                onValueChange={(value) =>
                  setSettings({ ...settings, strategy: value })
                }
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {strategies.map((strategy) => (
                    <SelectItem key={strategy.value} value={strategy.value}>
                      {strategy.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {settings.strategy === "hi_res" && (
              <div>
                <label className="text-sm font-medium">고해상도 모델</label>
                <Input
                  value={settings.hi_res_model_name || "yolox"}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      hi_res_model_name: e.target.value,
                    })
                  }
                  className="mt-1"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>청킹 전략</CardTitle>
            <CardDescription>
              문서를 청크로 나누는 방식을 선택합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={settings.chunking_strategy}
              onValueChange={(value) =>
                setSettings({ ...settings, chunking_strategy: value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chunkingStrategies.map((strategy) => (
                  <SelectItem key={strategy.value} value={strategy.value}>
                    {strategy.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* 추출 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-500" />
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
                id="infer-table"
                checked={settings.infer_table_structure}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    infer_table_structure: e.target.checked,
                  })
                }
                className="rounded"
              />
              <label htmlFor="infer-table" className="text-sm font-medium">
                테이블 구조 추론
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="extract-images"
                checked={settings.extract_images_in_pdf}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    extract_images_in_pdf: e.target.checked,
                  })
                }
                className="rounded"
              />
              <label htmlFor="extract-images" className="text-sm font-medium">
                PDF 이미지 추출
              </label>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="page-breaks"
              checked={settings.include_page_breaks}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  include_page_breaks: e.target.checked,
                })
              }
              className="rounded"
            />
            <label htmlFor="page-breaks" className="text-sm font-medium">
              페이지 구분 포함
            </label>
          </div>
        </CardContent>
      </Card>

      {/* OCR 언어 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>OCR 언어</CardTitle>
          <CardDescription>
            OCR에서 인식할 언어를 선택합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {availableLanguages.map((lang) => (
              <Badge
                key={lang}
                variant={settings.ocr_languages.includes(lang) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleLanguage(lang)}
              >
                {settings.ocr_languages.includes(lang) ? (
                  <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1 text-red-500" />
                )}
                {lang === "kor" ? "한국어" : lang === "eng" ? "영어" : lang === "jpn" ? "일본어" : lang === "chi_sim" ? "중국어(간체)" : "중국어(번체)"}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 청킹 매개변수 */}
      <Card>
        <CardHeader>
          <CardTitle>청킹 매개변수</CardTitle>
          <CardDescription>
            문서를 청크로 나누는 세부 설정입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">최대 문자 수</label>
              <Input
                type="number"
                min="1000"
                max="10000"
                value={settings.max_characters}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_characters: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">최소 결합 문자 수</label>
              <Input
                type="number"
                min="100"
                max="2000"
                value={settings.combine_text_under_n_chars}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    combine_text_under_n_chars: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">새 청크 시작 문자 수</label>
            <Input
              type="number"
              min="1000"
              max="8000"
              value={settings.new_after_n_chars}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  new_after_n_chars: parseInt(e.target.value),
                })
              }
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* 지원 파일 형식 */}
      <Card>
        <CardHeader>
          <CardTitle>지원 파일 형식</CardTitle>
          <CardDescription>
            Unstructured로 처리할 파일 형식을 선택합니다.
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
                  <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1 text-red-500" />
                )}
                {format.toUpperCase()}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 폴백 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>폴백 설정</CardTitle>
          <CardDescription>
            Unstructured 처리가 실패할 경우 사용할 대체 프로세서를 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enable-fallback"
              checked={settings.enable_fallback}
              onChange={(e) =>
                setSettings({ ...settings, enable_fallback: e.target.checked })
              }
              className="rounded"
            />
            <label htmlFor="enable-fallback" className="text-sm font-medium">
              폴백 활성화
            </label>
          </div>
          {settings.enable_fallback && (
            <div>
              <label className="text-sm font-medium mb-2 block">폴백 순서</label>
              <div className="flex flex-wrap gap-2">
                {fallbackOptions.map((option) => (
                  <Badge
                    key={option}
                    variant={settings.fallback_order.includes(option) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleFallback(option)}
                  >
                    {settings.fallback_order.includes(option) ? (
                      <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 mr-1 text-red-500" />
                    )}
                    {option === "docling" ? "Docling" : "Basic"}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 파일 크기 제한 */}
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
            단위: MB (권장: 100MB 이하)
          </p>
          <div className="p-4 bg-purple-50 rounded-lg mt-4">
            <p className="text-sm text-purple-800">
              <strong>💡 Unstructured 특징:</strong> 다양한 문서 형식을 지원하며, 
              구조화되지 않은 데이터를 효과적으로 처리할 수 있습니다. 
              특히 복잡한 레이아웃의 문서에 강점이 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}