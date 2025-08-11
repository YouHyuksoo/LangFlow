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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  Database,
  Bot,
  Shield,
  Save,
  RefreshCw,
  Info,
  HardDrive,
  Trash2,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  Stethoscope,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fileAPI, settingsAPI } from "@/lib/api";
import { personaAPI } from "@/lib/api";

interface SystemSettings {
  // 파일 업로드 설정
  maxFileSize: number;
  allowedFileTypes: string[];
  uploadDirectory: string;

  // ChromaDB 설정
  vectorDimension: number;
  chunkSize: number;
  chunkOverlap: number;

  // 시스템 설정
  enableAutoVectorization: boolean;
  enableNotifications: boolean;
  debugMode: boolean;
  // 추가: 시스템 메시지 및 기본 페르소나
  default_system_message?: string;
  default_persona_id?: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSettings>({
    maxFileSize: 10,
    allowedFileTypes: ["pdf"],
    uploadDirectory: "uploads/",
    vectorDimension: 1536,
    chunkSize: 1000,
    chunkOverlap: 200,
    enableAutoVectorization: true,
    enableNotifications: true,
    debugMode: false,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [maintenanceLoading, setMaintenanceLoading] = useState<string | null>(
    null
  );
  const [personas, setPersonas] = useState<
    Array<{ persona_id: string; name: string }>
  >([]);

  // 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const settingsData = await settingsAPI.getSettings();
        setSettings(settingsData);
        const personasData = await personaAPI.getPersonas();
        setPersonas(personasData);
      } catch (error) {
        console.error("설정 로드 실패:", error);
        toast({
          title: "설정 로드 실패",
          description:
            "설정을 불러오는 중 오류가 발생했습니다. 기본값을 사용합니다.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [toast]);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const response = await settingsAPI.updateSettings(settings);

      toast({
        title: "설정 저장 완료",
        description: "시스템 설정이 성공적으로 저장되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "설정 저장 실패",
        description:
          error.response?.data?.detail ||
          "설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  // 시스템 메시지 및 기본 페르소나 설정 카드 추가
  const renderSystemMessageCard = () => (
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
          <label className="text-sm font-medium">기본 시스템 메시지</label>
          <Textarea
            value={settings.default_system_message || ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                default_system_message: e.target.value,
              })
            }
            className="mt-1"
            rows={6}
            placeholder="AI의 기본 동작을 정의하는 시스템 메시지를 입력하세요."
          />
        </div>
        <div>
          <label className="text-sm font-medium">기본 페르소나</label>
          <select
            className="mt-1 w-full border rounded-md p-2 text-sm"
            value={settings.default_persona_id || ""}
            onChange={(e) =>
              setSettings({ ...settings, default_persona_id: e.target.value })
            }
          >
            <option value="">선택 안 함</option>
            {personas.map((p) => (
              <option key={p.persona_id} value={p.persona_id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );

  const handleResetSettings = async () => {
    try {
      const response = await settingsAPI.resetSettings();
      setSettings(response.settings);

      toast({
        title: "설정 초기화",
        description: "설정이 기본값으로 초기화되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "설정 초기화 실패",
        description:
          error.response?.data?.detail || "설정 초기화 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // ChromaDB 관리 함수들
  const handleMaintenanceAction = async (
    action: string,
    actionName: string
  ) => {
    try {
      setMaintenanceLoading(action);
      let result;

      switch (action) {
        case "diagnose-and-fix":
          result = await fileAPI.diagnoseAndFixDatabase();
          break;
        default:
          throw new Error("알 수 없는 작업입니다.");
      }

      // 상태에 따른 토스트 메시지 및 스타일 설정
      const toastVariant =
        result.status === "error"
          ? "destructive"
          : result.status === "warning"
          ? "default"
          : "default";

      toast({
        title: `${actionName} ${result.status === "error" ? "실패" : "완료"}`,
        description:
          result.message || `${actionName} 작업이 성공적으로 완료되었습니다.`,
        variant: toastVariant as any,
      });

      // 결과가 있는 경우 콘솔에 출력
      if (result.details || result.count !== undefined) {
        console.log(`${actionName} 결과:`, result);
      }
    } catch (error: any) {
      console.error(`${actionName} 실패:`, error);
      toast({
        title: `${actionName} 실패`,
        description:
          error.userMessage || `${actionName} 중 오류가 발생했습니다.`,
        variant: "destructive",
      });
    } finally {
      setMaintenanceLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">시스템 설정</h1>
        <div className="flex gap-2">
          <Button onClick={handleResetSettings} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            초기화
          </Button>
          <Button onClick={handleSaveSettings} size="sm" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "저장 중..." : "설정 저장"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {renderSystemMessageCard()}
        {/* 파일 업로드 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              파일 업로드 설정
            </CardTitle>
            <CardDescription>
              파일 업로드와 관련된 설정을 관리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">최대 파일 크기 (MB)</label>
              <Input
                type="number"
                value={settings.maxFileSize}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxFileSize: parseInt(e.target.value) || 10,
                  })
                }
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">허용된 파일 형식</label>
              <div className="mt-1 flex gap-2">
                {settings.allowedFileTypes.map((type) => (
                  <Badge key={type} variant="secondary">
                    .{type}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">업로드 디렉토리</label>
              <Input
                value={settings.uploadDirectory}
                onChange={(e) =>
                  setSettings({ ...settings, uploadDirectory: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* 벡터화 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              벡터화 설정
            </CardTitle>
            <CardDescription>
              문서 벡터화 처리에 관한 설정을 관리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">벡터 차원 수</label>
              <Input
                type="number"
                value={settings.vectorDimension}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    vectorDimension: parseInt(e.target.value) || 1536,
                  })
                }
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">청크 크기</label>
              <Input
                type="number"
                value={settings.chunkSize}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    chunkSize: parseInt(e.target.value) || 1000,
                  })
                }
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">청크 오버랩</label>
              <Input
                type="number"
                value={settings.chunkOverlap}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    chunkOverlap: parseInt(e.target.value) || 200,
                  })
                }
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* ChromaDB 관리 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              ChromaDB 데이터베이스 관리
            </CardTitle>
            <CardDescription>
              벡터 데이터베이스의 유지보수 및 관리 작업을 수행합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {/* 통합 진단 및 정상화 */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  진단 및 정상화
                </h4>

                {/* 통합 진단 및 정상화 */}
                <div className="space-y-2">
                  <Button
                    onClick={() =>
                      handleMaintenanceAction(
                        "diagnose-and-fix",
                        "진단 및 정상화"
                      )
                    }
                    disabled={maintenanceLoading !== null}
                    variant="default"
                    className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    {maintenanceLoading === "diagnose-and-fix" ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Stethoscope className="h-4 w-4 mr-2" />
                    )}
                    진단 및 정상화 실행
                  </Button>
                  <p className="text-xs text-muted-foreground px-3">
                    ChromaDB 데이터베이스의 모든 문제를 순차적으로 진단하고
                    자동으로 정상화합니다. 고아 메타데이터, 고아 벡터, 상태
                    동기화를 한 번에 처리합니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 경고 메시지 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">진단 및 정상화 기능</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>고아 메타데이터 정리: 삭제된 파일의 메타데이터 제거</li>
                    <li>
                      고아 벡터 검색 및 정리: ChromaDB에서 불필요한 벡터 제거
                    </li>
                    <li>벡터화 상태 동기화: 메타데이터와 실제 상태 동기화</li>
                    <li>ChromaDB 상태 확인: 데이터베이스 연결 및 상태 진단</li>
                    <li>모든 작업이 순차적으로 자동 실행됩니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 시스템 동작 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              시스템 동작 설정
            </CardTitle>
            <CardDescription>
              시스템의 전반적인 동작을 제어하는 설정입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">자동 벡터화</label>
                <p className="text-xs text-muted-foreground">
                  파일 업로드 시 자동으로 벡터화를 시작합니다.
                </p>
              </div>
              <Switch
                checked={settings.enableAutoVectorization}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, enableAutoVectorization: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">알림 활성화</label>
                <p className="text-xs text-muted-foreground">
                  시스템 이벤트에 대한 알림을 표시합니다.
                </p>
              </div>
              <Switch
                checked={settings.enableNotifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, enableNotifications: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">디버그 모드</label>
                <p className="text-xs text-muted-foreground">
                  상세한 로그와 디버그 정보를 표시합니다.
                </p>
              </div>
              <Switch
                checked={settings.debugMode}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, debugMode: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 개발자 정보 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <span className="text-blue-800 font-medium">개발 참고 사항</span>
          </div>
          <div className="text-sm text-blue-700 mt-2 space-y-2">
            <p>
              현재 설정 페이지는 UI 구조만 구현되어 있습니다. 실제 설정 저장 및
              적용을 위해서는 다음이 필요합니다:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>백엔드 API에 설정 저장/로드 엔드포인트 구현</li>
              <li>설정 변경 시 시스템 재시작 없이 반영되는 메커니즘 구현</li>
              <li>설정 유효성 검증 로직 추가</li>
              <li>환경별 설정 분리 (개발/운영)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
