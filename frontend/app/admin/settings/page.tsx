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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Save, Settings, ExternalLink, Upload, FileText, HardDrive, Cog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { settingsAPI, personaAPI } from "@/lib/api";
import Link from "next/link";
import MDEditor from "@uiw/react-md-editor";
import { useTheme } from "next-themes";

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
  const { theme } = useTheme();
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
      toast({ title: "오류", description: "설정을 불러오는 중 오류가 발생했습니다.", variant: "destructive" });
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
      toast({ title: "성공", description: "기본 설정이 저장되었습니다." });
    } catch (error) {
      console.error("설정 저장 오류:", error);
      toast({ title: "오류", description: "설정 저장 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64 text-muted-foreground">설정을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            기본 설정
          </h1>
          <p className="text-muted-foreground">
            시스템 메시지와 기본 페르소나를 설정합니다.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>

      <Card className="stat-card relative overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-blue-500" />시스템 메시지 및 기본 페르소나</CardTitle>
          <CardDescription>기본 시스템 메시지와 채팅의 기본 페르소나를 설정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">기본 시스템 메시지</Label>
            <div data-color-mode={theme}>
              <MDEditor
                value={settings.default_system_message || ""}
                onChange={(value) => setSettings({ ...settings, default_system_message: value || "" })}
                height={450}
                textareaProps={{ placeholder: "AI의 기본 동작을 정의하는 시스템 메시지를 입력하세요." }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">시스템 메시지는 AI의 기본 성격과 응답 방식을 정의합니다. <strong>마크다운</strong>을 사용할 수 있습니다.</p>
          </div>
          <div>
            <Label>기본 페르소나</Label>
            <Select value={settings.default_persona_id || "none"} onValueChange={(value) => setSettings({ ...settings, default_persona_id: value === "none" ? "" : value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안 함 (기본 시스템 메시지만 사용)</SelectItem>
                {personas.map((p) => (<SelectItem key={p.persona_id} value={p.persona_id}>{p.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">선택한 페르소나의 시스템 메시지가 기본 시스템 메시지와 함께 사용됩니다.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="stat-card relative overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Cog className="h-5 w-5 text-purple-500" />문서 전처리 방식 설정</CardTitle>
          <CardDescription>업로드된 문서를 처리할 기본 전처리 엔진을 선택합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>전처리 방식</Label>
            <Select value={settings.preprocessing_method || "basic"} onValueChange={(value) => setSettings({ ...settings, preprocessing_method: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">기본 처리 (빠른 처리, 기본 텍스트 추출)</SelectItem>
                <SelectItem value="docling">Docling (고급 문서 구조 분석, 표/이미지 추출)</SelectItem>
                <SelectItem value="unstructured">Unstructured (포괄적 문서 분석, 다양한 형식 지원)</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <p><strong>기본 처리:</strong> 빠른 텍스트 추출, 간단한 문서에 적합</p>
              <p><strong>Docling:</strong> PDF/Office 문서의 고급 구조 분석, 표와 이미지 추출</p>
              <p><strong>Unstructured:</strong> 가장 포괄적인 분석, 다양한 파일 형식 지원</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="stat-card relative overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-blue-500" />파일 업로드 설정</CardTitle>
          <CardDescription>파일 업로드 시 적용되는 크기 제한과 지원 파일 형식을 설정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="flex items-center gap-1"><HardDrive className="h-4 w-4 text-green-500" />최대 파일 크기 (MB)</Label>
              <Input type="number" min="1" max="1000" value={settings.maxFileSize || 10} onChange={(e) => setSettings({ ...settings, maxFileSize: parseInt(e.target.value) || 10 })} className="mt-1" placeholder="10" />
              <p className="text-xs text-muted-foreground mt-1">업로드할 수 있는 최대 파일 크기를 MB 단위로 설정합니다 (권장: 1-100MB)</p>
            </div>
            <div>
              <Label className="flex items-center gap-1"><FileText className="h-4 w-4 text-blue-500" />지원 파일 형식</Label>
              <div className="mt-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.md', '.html'].map((type) => (
                    <Badge key={type} variant={settings.allowedFileTypes?.includes(type) ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => { const currentTypes = settings.allowedFileTypes || []; if (currentTypes.includes(type)) { setSettings({ ...settings, allowedFileTypes: currentTypes.filter(t => t !== type) }); } else { setSettings({ ...settings, allowedFileTypes: [...currentTypes, type] }); } }}>
                      {type.toUpperCase()}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">클릭하여 지원할 파일 형식을 선택/해제할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="stat-card relative overflow-hidden">
        <CardHeader>
          <CardTitle>다른 설정</CardTitle>
          <CardDescription>다음 설정들은 별도의 페이지에서 관리할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/admin/settings/models" className="block p-4 border rounded-lg hover:bg-accent transition-colors">
              <h3 className="font-medium flex items-center gap-2">모델 설정<ExternalLink className="h-4 w-4 text-purple-500" /></h3>
              <p className="text-sm text-muted-foreground mt-1">LLM 및 임베딩 모델 설정</p>
            </Link>
            <Link href="/admin/settings/performance" className="block p-4 border rounded-lg hover:bg-accent transition-colors">
              <h3 className="font-medium flex items-center gap-2">성능 관리<ExternalLink className="h-4 w-4 text-purple-500" /></h3>
              <p className="text-sm text-muted-foreground mt-1">병렬 처리 및 성능 최적화 설정</p>
            </Link>
            <Link href="/admin/settings/preprocessing/docling" className="block p-4 border rounded-lg hover:bg-accent transition-colors">
              <h3 className="font-medium flex items-center gap-2">Docling 전처리<ExternalLink className="h-4 w-4 text-blue-500" /></h3>
              <p className="text-sm text-muted-foreground mt-1">Docling 문서 전처리 설정</p>
            </Link>
            <Link href="/admin/settings/preprocessing/unstructured" className="block p-4 border rounded-lg hover:bg-accent transition-colors">
              <h3 className="font-medium flex items-center gap-2">Unstructured 전처리<ExternalLink className="h-4 w-4 text-blue-500" /></h3>
              <p className="text-sm text-muted-foreground mt-1">Unstructured 문서 전처리 설정</p>
            </Link>
            <Link href="/admin/settings/database" className="block p-4 border rounded-lg hover:bg-accent transition-colors">
              <h3 className="font-medium flex items-center gap-2">데이터베이스 관리<ExternalLink className="h-4 w-4 text-green-500" /></h3>
              <p className="text-sm text-muted-foreground mt-1">Vector DB 및 백업/복원 설정</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
