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
import {
  Settings,
  Database,
  Bot,
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
  Cpu,
  Zap,
  Key,
  TestTube,
  FileText,
  Image,
  Table,
  Eye,
  CheckCircle,
  XCircle,
  FileSearch,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fileAPI, settingsAPI, modelSettingsAPI } from "@/lib/api";
import { personaAPI } from "@/lib/api";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

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

interface ModelSettings {
  // LLM 모델 설정
  llm_provider: string;
  llm_model: string;
  llm_api_key: string;
  llm_temperature: number;
  llm_max_tokens: number;
  
  // Embedding 모델 설정
  embedding_provider: string;
  embedding_model: string;
  embedding_api_key: string;
  embedding_dimension: number;
  
  // 기타 설정
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
}

interface DoclingSettings {
  enabled: boolean;
  default_extract_tables: boolean;
  default_extract_images: boolean;
  default_ocr_enabled: boolean;
  default_output_format: string;
  max_file_size_mb: number;
  supported_formats: string[];
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSettings>({
    maxFileSize: 10,
    allowedFileTypes: ["pdf", "docx", "pptx", "xlsx"],
    uploadDirectory: "uploads/",
    vectorDimension: 1536,
    chunkSize: 1000,
    chunkOverlap: 200,
    enableAutoVectorization: true,
    enableNotifications: true,
    debugMode: false,
  });
  const [modelSettings, setModelSettings] = useState<ModelSettings>({
    llm_provider: "openai",
    llm_model: "gpt-4o-mini",
    llm_api_key: "",
    llm_temperature: 0.7,
    llm_max_tokens: 4096,
    embedding_provider: "openai",
    embedding_model: "text-embedding-3-small",
    embedding_api_key: "",
    embedding_dimension: 1536,
    chunk_size: 1000,
    chunk_overlap: 200,
    top_k: 5,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [maintenanceLoading, setMaintenanceLoading] = useState<string | null>(
    null
  );
  const [personas, setPersonas] = useState<
    Array<{ persona_id: string; name: string }>
  >([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [availableModels, setAvailableModels] = useState<{[key: string]: any}>({});
  const [testingConnection, setTestingConnection] = useState(false);
  const [doclingSettings, setDoclingSettings] = useState<DoclingSettings>({
    enabled: false,
    default_extract_tables: true,
    default_extract_images: true,
    default_ocr_enabled: false,
    default_output_format: "markdown",
    max_file_size_mb: 50,
    supported_formats: [".pdf", ".docx", ".pptx", ".xlsx", ".html"]
  });
  const [doclingStatus, setDoclingStatus] = useState<any>(null);

  // 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        
        // 병렬로 모든 데이터 로드
        const [settingsData, modelSettingsData, personasData, providersData, doclingSettingsData, doclingStatusData] = await Promise.all([
          settingsAPI.getSettings(),
          modelSettingsAPI.getSettings(),
          personaAPI.getPersonas(),
          modelSettingsAPI.getAvailableProviders(),
          modelSettingsAPI.getDoclingSettings().catch(() => ({
            enabled: false,
            default_extract_tables: true,
            default_extract_images: true,
            default_ocr_enabled: false,
            default_output_format: "markdown",
            max_file_size_mb: 50,
            supported_formats: [".pdf", ".docx", ".pptx", ".xlsx", ".html"]
          })),
          modelSettingsAPI.getDoclingStatus().catch(() => ({ available: false, status: "error" }))
        ]);
        
        setSettings(settingsData);
        setModelSettings(modelSettingsData);
        setPersonas(personasData);
        setProviders(providersData.providers || []);
        setDoclingSettings(doclingSettingsData);
        setDoclingStatus(doclingStatusData);
        
        // 각 제공업체별 모델 목록 로드
        const modelsData: {[key: string]: any} = {};
        for (const provider of providersData.providers || []) {
          try {
            const models = await modelSettingsAPI.getModelsByProvider(provider.id);
            modelsData[provider.id] = models;
          } catch (error) {
            console.error(`${provider.id} 모델 목록 로드 실패:`, error);
          }
        }
        setAvailableModels(modelsData);
        
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
      
      // Docling 설정을 모델 설정에 포함
      const combinedModelSettings = {
        ...modelSettings,
        docling_enabled: doclingSettings.enabled,
        docling_extract_tables: doclingSettings.default_extract_tables,
        docling_extract_images: doclingSettings.default_extract_images,
        docling_ocr_enabled: doclingSettings.default_ocr_enabled,
        docling_output_format: doclingSettings.default_output_format
      };
      
      // 시스템 설정과 통합된 모델 설정 저장
      await Promise.all([
        settingsAPI.updateSettings(settings),
        modelSettingsAPI.updateModelSettings(combinedModelSettings)
      ]);

      toast({
        title: "설정 저장 완료",
        description: "시스템 설정, 모델 설정, Docling 설정이 성공적으로 저장되었습니다.",
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

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const result = await modelSettingsAPI.testModelConnection();
      
      if (result.overall_status === "success") {
        toast({
          title: "연결 테스트 성공",
          description: "모든 모델 연결이 정상적으로 작동합니다.",
        });
      } else {
        toast({
          title: "연결 테스트 실패",
          description: "일부 모델 연결에 문제가 있습니다. 설정을 확인해주세요.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "연결 테스트 실패",
        description: error.response?.data?.detail || "연결 테스트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleProviderChange = async (type: 'llm' | 'embedding', provider: string) => {
    if (type === 'llm') {
      setModelSettings(prev => ({
        ...prev,
        llm_provider: provider,
        // 첫 번째 모델로 기본 설정
        llm_model: availableModels[provider]?.llm_models?.[0] || ""
      }));
    } else {
      setModelSettings(prev => ({
        ...prev,
        embedding_provider: provider,
        // 첫 번째 모델로 기본 설정
        embedding_model: availableModels[provider]?.embedding_models?.[0] || ""
      }));
    }
  };

  // 컴팩한 모델 설정 카드 렌더링
  const renderModelSettingsCard = () => (
    <div className="grid gap-6 md:grid-cols-2">
      {/* LLM 모델 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            LLM 모델 설정
          </CardTitle>
          <CardDescription>
            대화형 AI 모델을 선택하고 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">제공업체</label>
              <select
                className="mt-1 w-full border rounded-md p-2 text-sm"
                value={modelSettings.llm_provider}
                onChange={(e) => handleProviderChange('llm', e.target.value)}
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium">모델</label>
              <select
                className="mt-1 w-full border rounded-md p-2 text-sm"
                value={modelSettings.llm_model}
                onChange={(e) => setModelSettings(prev => ({...prev, llm_model: e.target.value}))}
              >
                {(availableModels[modelSettings.llm_provider]?.llm_models || []).map((model: string) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* API 키 입력 */}
          {providers.find(p => p.id === modelSettings.llm_provider)?.api_key_required && (
            <div>
              <label className="text-sm font-medium">API 키</label>
              <Input
                type="password"
                value={modelSettings.llm_api_key}
                onChange={(e) => setModelSettings(prev => ({...prev, llm_api_key: e.target.value}))}
                placeholder="API 키를 입력하세요"
                className="mt-1"
              />
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">온도</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={modelSettings.llm_temperature}
                onChange={(e) => setModelSettings(prev => ({...prev, llm_temperature: parseFloat(e.target.value) || 0.7}))}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">최대 토큰</label>
              <Input
                type="number"
                min="1"
                value={modelSettings.llm_max_tokens}
                onChange={(e) => setModelSettings(prev => ({...prev, llm_max_tokens: parseInt(e.target.value) || 4096}))}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 임베딩 모델 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            임베딩 모델 설정
          </CardTitle>
          <CardDescription>
            문서 벡터화 모델을 선택하고 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">제공업체</label>
              <select
                className="mt-1 w-full border rounded-md p-2 text-sm"
                value={modelSettings.embedding_provider}
                onChange={(e) => handleProviderChange('embedding', e.target.value)}
              >
                {providers.filter(p => availableModels[p.id]?.embedding_models?.length > 0).map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium">모델</label>
              <select
                className="mt-1 w-full border rounded-md p-2 text-sm"
                value={modelSettings.embedding_model}
                onChange={(e) => setModelSettings(prev => ({...prev, embedding_model: e.target.value}))}
              >
                {(availableModels[modelSettings.embedding_provider]?.embedding_models || []).map((model: string) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 임베딩 API 키 입력 */}
          {providers.find(p => p.id === modelSettings.embedding_provider)?.api_key_required && (
            <div>
              <label className="text-sm font-medium">API 키</label>
              <Input
                type="password"
                value={modelSettings.embedding_api_key}
                onChange={(e) => setModelSettings(prev => ({...prev, embedding_api_key: e.target.value}))}
                placeholder="임베딩용 API 키를 입력하세요"
                className="mt-1"
              />
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">벡터 차원</label>
              <Input
                type="number"
                min="1"
                value={modelSettings.embedding_dimension}
                onChange={(e) => setModelSettings(prev => ({...prev, embedding_dimension: parseInt(e.target.value) || 1536}))}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">검색 결과</label>
              <Input
                type="number"
                min="1"
                max="50"
                value={modelSettings.top_k}
                onChange={(e) => setModelSettings(prev => ({...prev, top_k: parseInt(e.target.value) || 5}))}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">청크 크기</label>
              <Input
                type="number"
                min="100"
                value={modelSettings.chunk_size}
                onChange={(e) => setModelSettings(prev => ({...prev, chunk_size: parseInt(e.target.value) || 1000}))}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 연결 테스트 및 안내 */}
      <Card className="md:col-span-2">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              <span className="text-sm font-medium">모델 연결 테스트</span>
            </div>
            <Button
              onClick={handleTestConnection}
              disabled={testingConnection}
              variant="outline"
              size="sm"
            >
              {testingConnection ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              {testingConnection ? "테스트 중..." : "연결 테스트"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            설정 변경 후 연결 테스트를 통해 모델이 정상 작동하는지 확인하세요.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  // Docling 설정 카드
  const renderDoclingSettingsCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="h-5 w-5" />
          Docling 고급 문서 분석
          {doclingStatus?.available ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              사용 가능
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              사용 불가
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Docling을 사용한 고급 문서 구조 분석 및 처리 설정입니다. PDF, Office 문서의 테이블, 이미지, 구조를 정확하게 추출할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Docling 활성화 토글 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <label className="text-sm font-medium">Docling 기능 활성화</label>
            <p className="text-xs text-muted-foreground">
              파일 업로드 시 Docling을 사용한 고급 문서 분석을 기본으로 사용합니다.
            </p>
          </div>
          <input
            type="checkbox"
            checked={doclingSettings.enabled}
            onChange={(e) => setDoclingSettings(prev => ({...prev, enabled: e.target.checked}))}
            className="h-4 w-4"
          />
        </div>

        {/* 상세 설정 (Docling이 활성화된 경우에만 표시) */}
        {doclingSettings.enabled && (
          <>
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-medium">기본 처리 옵션</h4>
              
              {/* 테이블 추출 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table className="h-4 w-4" />
                  <div>
                    <label className="text-sm font-medium">테이블 구조 분석</label>
                    <p className="text-xs text-muted-foreground">문서 내 표를 구조화하여 추출합니다.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={doclingSettings.default_extract_tables}
                  onChange={(e) => setDoclingSettings(prev => ({...prev, default_extract_tables: e.target.checked}))}
                  className="h-4 w-4"
                />
              </div>

              {/* 이미지 추출 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  <div>
                    <label className="text-sm font-medium">이미지 추출</label>
                    <p className="text-xs text-muted-foreground">문서 내 이미지와 차트를 추출합니다.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={doclingSettings.default_extract_images}
                  onChange={(e) => setDoclingSettings(prev => ({...prev, default_extract_images: e.target.checked}))}
                  className="h-4 w-4"
                />
              </div>

              {/* OCR 활성화 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <div>
                    <label className="text-sm font-medium">OCR (광학 문자 인식)</label>
                    <p className="text-xs text-muted-foreground">이미지나 스캔된 문서의 텍스트를 인식합니다.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={doclingSettings.default_ocr_enabled}
                  onChange={(e) => setDoclingSettings(prev => ({...prev, default_ocr_enabled: e.target.checked}))}
                  className="h-4 w-4"
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-medium">출력 및 제한 설정</h4>
              
              {/* 출력 형식 */}
              <div>
                <label className="text-sm font-medium">기본 출력 형식</label>
                <select
                  className="mt-1 w-full border rounded-md p-2 text-sm"
                  value={doclingSettings.default_output_format}
                  onChange={(e) => setDoclingSettings(prev => ({...prev, default_output_format: e.target.value}))}
                >
                  <option value="markdown">Markdown</option>
                  <option value="html">HTML</option>
                  <option value="json">JSON</option>
                  <option value="all">모든 형식</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  문서 처리 후 생성될 기본 출력 형식을 선택합니다.
                </p>
              </div>

              {/* 최대 파일 크기 */}
              <div>
                <label className="text-sm font-medium">Docling 처리 최대 파일 크기 (MB)</label>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={doclingSettings.max_file_size_mb}
                  onChange={(e) => setDoclingSettings(prev => ({...prev, max_file_size_mb: parseInt(e.target.value) || 50}))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  이 크기를 초과하는 파일은 기존 방식으로 처리됩니다.
                </p>
              </div>
            </div>
          </>
        )}

        {/* 지원 형식 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">지원되는 파일 형식</p>
              <div className="flex flex-wrap gap-1">
                {doclingSettings.supported_formats.map((format) => (
                  <Badge key={format} variant="secondary" className="text-xs">
                    {format}
                  </Badge>
                ))}
              </div>
              <p className="text-xs mt-2">
                Docling은 이러한 파일 형식에서 구조화된 콘텐츠 추출과 고급 문서 분석을 제공합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 상태 정보 */}
        {doclingStatus && (
          <div className={`border rounded-lg p-3 ${doclingStatus.available ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start gap-2">
              {doclingStatus.available ? (
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
              )}
              <div className={`text-sm ${doclingStatus.available ? 'text-green-800' : 'text-red-800'}`}>
                <p className="font-medium">
                  Docling 상태: {doclingStatus.available ? '사용 가능' : '사용 불가'}
                </p>
                <p className="text-xs mt-1">
                  {doclingStatus.available 
                    ? `버전 ${doclingStatus.version || '2.44.0'} - 모든 기능이 정상 작동합니다.`
                    : '패키지가 설치되지 않았거나 초기화에 실패했습니다. 설치를 확인해주세요.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

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
          <label className="text-sm font-medium mb-2 block">기본 시스템 메시지</label>
          <div className="mt-1">
            <MDEditor
              value={settings.default_system_message || ""}
              onChange={(value) =>
                setSettings({
                  ...settings,
                  default_system_message: value || "",
                })
              }
              height={300}
              data-color-mode="light"
              preview="edit"
              hideToolbar={false}
              visibleDragbar={false}
              style={{
                backgroundColor: 'white',
              }}
              textareaProps={{
                placeholder: "AI의 기본 동작을 정의하는 시스템 메시지를 입력하세요.\n\n예시:\n```\n당신은 도움이 되고 정확한 정보를 제공하는 AI 어시스턴트입니다.\n\n**역할:**\n- 사용자의 질문에 친절하고 상세하게 답변\n- 정확하지 않은 정보는 제공하지 않음\n- 필요시 추가 설명이나 예시 제공\n\n**응답 스타일:**\n- 정중하고 전문적인 톤\n- 구조화된 답변 제공\n- 마크다운 형식 활용\n```",
                style: {
                  fontSize: '14px',
                  lineHeight: '1.5',
                  fontFamily: 'inherit',
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            시스템 메시지는 AI의 기본 성격과 응답 방식을 정의합니다. <strong>마크다운</strong>을 사용하여 구조화된 지침을 작성할 수 있습니다.
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
            페르소나를 선택하면 해당 페르소나의 성격과 응답 스타일이 기본 시스템 메시지와 함께 적용됩니다.
          </p>
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

      {/* 시스템 메시지 및 기본 페르소나 설정 (최상단 단독 섹션) */}
      {renderSystemMessageCard()}

      {/* 모델 설정 카드 (전체 폭) */}
      {renderModelSettingsCard()}

      {/* Docling 고급 문서 분석 설정 */}
      {renderDoclingSettingsCard()}

      <div className="grid gap-6 md:grid-cols-2">
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

      </div>

    </div>
  );
}
