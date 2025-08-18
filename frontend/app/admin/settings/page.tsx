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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bot, Save, Settings, ExternalLink, Upload, FileText, HardDrive, Cog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { settingsAPI, personaAPI } from "@/lib/api";
import Link from "next/link";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

interface BasicSettings {
  default_system_message?: string;
  default_persona_id?: string;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  preprocessing_method?: string;
}

interface Persona {
  persona_id: string;
  name: string;
  description: string;
  system_message: string;
  is_active: boolean;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<BasicSettings>({
    default_system_message: "",
    default_persona_id: "",
    maxFileSize: 10,
    allowedFileTypes: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'],
    preprocessing_method: "basic",
  });
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      const data = await settingsAPI.getSettings();
      setSettings({
        default_system_message: data.default_system_message || "",
        default_persona_id: data.default_persona_id || "",
        maxFileSize: data.maxFileSize || 10,
        allowedFileTypes: data.allowedFileTypes || ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'],
        preprocessing_method: data.preprocessing_method || "basic",
      });
    } catch (error) {
      console.error("설정 로드 오류:", error);
      toast({
        title: "오류",
        description: "설정을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const fetchPersonas = async () => {
    try {
      const data = await personaAPI.getPersonas();
      setPersonas(data.filter((p: Persona) => p.is_active));
    } catch (error) {
      console.error("페르소나 로드 오류:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSettings(), fetchPersonas()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateSettings(settings);
      toast({
        title: "성공",
        description: "기본 설정이 저장되었습니다.",
      });
    } catch (error) {
      console.error("설정 저장 오류:", error);
      toast({
        title: "오류",
        description: "설정 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">설정을 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-slate-800 dark:text-white">
            <Settings className="h-8 w-8" />
            기본 설정
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            시스템 메시지와 기본 페르소나를 설정합니다.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>

      {/* 시스템 메시지 및 기본 페르소나 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            시스템 메시지 및 기본 페르소나
          </CardTitle>
          <CardDescription>
            기본 시스템 메시지와 채팅의 기본 페르소나를 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              기본 시스템 메시지
            </label>
            <div className="mt-1">
              <MDEditor
                value={settings.default_system_message || ""}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    default_system_message: value || "",
                  })
                }
                height={450}
                data-color-mode="light"
                hideToolbar={false}
                visibleDragbar={false}
                textareaProps={{
                  placeholder:
                    "AI의 기본 동작을 정의하는 시스템 메시지를 입력하세요.\n\n예시:\n```\n당신은 도움이 되고 정확한 정보를 제공하는 AI 어시스턴트입니다.\n\n**역할:**\n- 사용자의 질문에 친절하고 상세하게 답변\n- 정확하지 않은 정보는 제공하지 않음\n- 필요시 추가 설명이나 예시 제공\n\n**응답 스타일:**\n- 정중하고 전문적인 톤\n- 구조화된 답변 제공\n- 마크다운 형식 활용\n```",
                  style: {
                    fontSize: "14px",
                    lineHeight: "1.5",
                    fontFamily: "ui-monospace, monospace",
                  },
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              시스템 메시지는 AI의 기본 성격과 응답 방식을 정의합니다.{" "}
              <strong>마크다운</strong>을 사용하여 구조화된 지침을 작성할 수
              있습니다.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">기본 페르소나</label>
            <select
              className="mt-1 w-full border rounded-md p-3 text-sm min-h-[44px]"
              value={settings.default_persona_id || ""}
              onChange={(e) =>
                setSettings({ ...settings, default_persona_id: e.target.value })
              }
            >
              <option value="">선택 안 함 (기본 시스템 메시지만 사용)</option>
              {personas.map((p) => (
                <option key={p.persona_id} value={p.persona_id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              선택한 페르소나의 시스템 메시지가 기본 시스템 메시지와 함께
              사용됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 전처리 방식 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            문서 전처리 방식 설정
          </CardTitle>
          <CardDescription>
            업로드된 문서를 처리할 기본 전처리 엔진을 선택합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">전처리 방식</label>
            <select
              className="mt-1 w-full border rounded-md p-3 text-sm min-h-[44px]"
              value={settings.preprocessing_method || "basic"}
              onChange={(e) =>
                setSettings({ ...settings, preprocessing_method: e.target.value })
              }
            >
              <option value="basic">기본 처리 (빠른 처리, 기본 텍스트 추출)</option>
              <option value="docling">Docling (고급 문서 구조 분석, 표/이미지 추출)</option>
              <option value="unstructured">Unstructured (포괄적 문서 분석, 다양한 형식 지원)</option>
            </select>
            <div className="mt-3 space-y-2">
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>기본 처리:</strong> 빠른 텍스트 추출, 간단한 문서에 적합</p>
                <p><strong>Docling:</strong> PDF/Office 문서의 고급 구조 분석, 표와 이미지 추출</p>
                <p><strong>Unstructured:</strong> 가장 포괄적인 분석, 다양한 파일 형식 지원</p>
              </div>
            </div>
          </div>
          
          {/* 현재 설정 표시 */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Cog className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-300">
                  현재 전처리 방식
                </p>
                <p className="text-blue-700 dark:text-blue-400 mt-1">
                  {settings.preprocessing_method === "basic" && "기본 처리 (빠른 텍스트 추출)"}
                  {settings.preprocessing_method === "docling" && "Docling (고급 문서 구조 분석)"}
                  {settings.preprocessing_method === "unstructured" && "Unstructured (포괄적 문서 분석)"}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                  모든 새로운 문서 업로드에 이 방식이 적용됩니다.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 파일 업로드 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            파일 업로드 설정
          </CardTitle>
          <CardDescription>
            파일 업로드 시 적용되는 크기 제한과 지원 파일 형식을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                <HardDrive className="h-4 w-4" />
                최대 파일 크기 (MB)
              </label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={settings.maxFileSize || 10}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxFileSize: parseInt(e.target.value) || 10,
                  })
                }
                className="mt-1"
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground mt-1">
                업로드할 수 있는 최대 파일 크기를 MB 단위로 설정합니다 (권장: 1-100MB)
              </p>
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                <FileText className="h-4 w-4" />
                지원 파일 형식
              </label>
              <div className="mt-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.md', '.html'].map((type) => (
                    <Badge
                      key={type}
                      variant={settings.allowedFileTypes?.includes(type) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        const currentTypes = settings.allowedFileTypes || [];
                        if (currentTypes.includes(type)) {
                          setSettings({
                            ...settings,
                            allowedFileTypes: currentTypes.filter(t => t !== type),
                          });
                        } else {
                          setSettings({
                            ...settings,
                            allowedFileTypes: [...currentTypes, type],
                          });
                        }
                      }}
                    >
                      {type.toUpperCase()}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  클릭하여 지원할 파일 형식을 선택/해제할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Upload className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-300">
                  현재 설정
                </p>
                <p className="text-blue-700 dark:text-blue-400 mt-1">
                  최대 크기: <span className="font-mono">{settings.maxFileSize}MB</span> | 
                  지원 형식: <span className="font-mono">{settings.allowedFileTypes?.length || 0}개</span>
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                  {settings.allowedFileTypes?.join(', ') || '설정된 형식이 없습니다'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 다른 설정 페이지 안내 */}
      <Card>
        <CardHeader>
          <CardTitle>다른 설정</CardTitle>
          <CardDescription>
            다음 설정들은 별도의 페이지에서 관리할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/admin/settings/models" className="p-4 border rounded-lg hover:bg-accent transition-colors">
              <h3 className="font-medium flex items-center gap-2">
                모델 설정
                <ExternalLink className="h-4 w-4" />
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                LLM 및 임베딩 모델 설정
              </p>
              <Badge variant="default" className="mt-2">
                이용 가능
              </Badge>
            </Link>
            <Link href="/admin/settings/performance" className="p-4 border rounded-lg hover:bg-accent transition-colors">
              <h3 className="font-medium flex items-center gap-2">
                성능 관리
                <ExternalLink className="h-4 w-4" />
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                병렬 처리 및 성능 최적화 설정
              </p>
              <Badge variant="default" className="mt-2">
                이용 가능
              </Badge>
            </Link>
            <Link href="/admin/settings/preprocessing/docling" className="p-4 border rounded-lg hover:bg-accent transition-colors">
              <h3 className="font-medium flex items-center gap-2">
                Docling 전처리
                <ExternalLink className="h-4 w-4" />
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Docling 문서 전처리 설정
              </p>
              <Badge variant="default" className="mt-2">
                이용 가능
              </Badge>
            </Link>
            <Link href="/admin/settings/preprocessing/unstructured" className="p-4 border rounded-lg hover:bg-accent transition-colors">
              <h3 className="font-medium flex items-center gap-2">
                Unstructured 전처리
                <ExternalLink className="h-4 w-4" />
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Unstructured 문서 전처리 설정
              </p>
              <Badge variant="default" className="mt-2">
                이용 가능
              </Badge>
            </Link>
            <Link href="/admin/settings/database" className="p-4 border rounded-lg hover:bg-accent transition-colors">
              <h3 className="font-medium flex items-center gap-2">
                데이터베이스 관리
                <ExternalLink className="h-4 w-4" />
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Vector DB 및 백업/복원 설정
              </p>
              <Badge variant="default" className="mt-2">
                이용 가능
              </Badge>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}