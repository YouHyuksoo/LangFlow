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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  fileAPI,
  settingsAPI,
  modelSettingsAPI,
  chatAPI,
  vectorAPI,
  unstructuredAPI,
} from "@/lib/api";
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

  // 성능 최적화 설정
  maxConcurrentEmbeddings?: number;
  maxConcurrentChunks?: number;
  embeddingPoolSize?: number;
  chunkStreamBufferSize?: number;
  connectionPoolSize?: number;
  cacheTtlSeconds?: number;
  enableParallelProcessing?: boolean;
  enableStreamingChunks?: boolean;
  enableSmartCaching?: boolean;
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

interface UnstructuredSettings {
  enabled: boolean;
  use_as_primary: boolean;
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
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSettings>({
    maxFileSize: 10,
    allowedFileTypes: ["pdf", "docx", "pptx", "xlsx"],
    uploadDirectory: "uploads/",
    vectorDimension: 1536,
    chunkSize: 1000,    // 모델 설정과 동일
    chunkOverlap: 150,   // 모델 설정과 동일
    enableAutoVectorization: true,
    enableNotifications: true,
    debugMode: false,
    // 성능 최적화 기본값
    maxConcurrentEmbeddings: 5,
    maxConcurrentChunks: 20,
    embeddingPoolSize: 3,
    chunkStreamBufferSize: 100,
    connectionPoolSize: 10,
    cacheTtlSeconds: 3600,
    enableParallelProcessing: true,
    enableStreamingChunks: true,
    enableSmartCaching: true,
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
    chunk_size: 1000,  // 안전한 기본값
    chunk_overlap: 150, // 비율 15%로 조정
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
  const [availableModels, setAvailableModels] = useState<{
    [key: string]: any;
  }>({});
  const [testingConnection, setTestingConnection] = useState(false);
  const [doclingSettings, setDoclingSettings] = useState<DoclingSettings>({
    enabled: false,
    default_extract_tables: true,
    default_extract_images: true,
    default_ocr_enabled: false,
    default_output_format: "markdown",
    max_file_size_mb: 50,
    supported_formats: [".pdf", ".docx", ".pptx", ".xlsx", ".html"],
  });
  const [doclingStatus, setDoclingStatus] = useState<any>(null);
  const [showDeleteChatModal, setShowDeleteChatModal] = useState(false);
  const [unstructuredSettings, setUnstructuredSettings] = useState<UnstructuredSettings>({
    enabled: true,
    use_as_primary: true,
    strategy: "auto",
    hi_res_model_name: null,
    infer_table_structure: true,
    extract_images_in_pdf: false,
    include_page_breaks: true,
    ocr_languages: ["kor", "eng"],
    skip_infer_table_types: [],
    chunking_strategy: "by_title",
    max_characters: 1000,  // 마스터 청크와 동일
    combine_text_under_n_chars: 150, // 오버랩과 동일
    new_after_n_chars: 800,         // 80% 기준
    max_file_size_mb: 100,
    supported_formats: [".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm", ".txt", ".md", ".csv"],
    enable_fallback: true,
    fallback_order: ["pymupdf", "pypdf", "pdfminer"]
  });
  const [unstructuredStatus, setUnstructuredStatus] = useState<any>(null);

  // 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);

        // 병렬로 모든 데이터 로드
        const [
          settingsData,
          modelSettingsData,
          personasData,
          providersData,
          doclingSettingsData,
          doclingStatusData,
          unstructuredSettingsData,
          unstructuredStatusData,
        ] = await Promise.all([
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
            supported_formats: [".pdf", ".docx", ".pptx", ".xlsx", ".html"],
          })),
          modelSettingsAPI
            .getDoclingStatus()
            .catch(() => ({ available: false, status: "error" })),
          unstructuredAPI.getSettings().catch(() => ({
            enabled: true,
            use_as_primary: true,
            strategy: "auto",
            hi_res_model_name: null,
            infer_table_structure: true,
            extract_images_in_pdf: false,
            include_page_breaks: true,
            ocr_languages: ["kor", "eng"],
            skip_infer_table_types: [],
            chunking_strategy: "by_title",
            max_characters: 1500,
            combine_text_under_n_chars: 150,
            new_after_n_chars: 1200,
            max_file_size_mb: 100,
            supported_formats: [".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm", ".txt", ".md", ".csv"],
            enable_fallback: true,
            fallback_order: ["pymupdf", "pypdf", "pdfminer"]
          })),
          unstructuredAPI.getStatus().catch(() => ({ available: false, status: "error" })),
        ]);

        setSettings(settingsData);
        setModelSettings(modelSettingsData);
        setPersonas(personasData);
        setProviders(providersData.providers || []);
        setDoclingSettings(doclingSettingsData);
        setDoclingStatus(doclingStatusData);
        setUnstructuredSettings(unstructuredSettingsData);
        setUnstructuredStatus(unstructuredStatusData);

        // 각 제공업체별 모델 목록 로드
        const modelsData: { [key: string]: any } = {};
        for (const provider of providersData.providers || []) {
          try {
            const models = await modelSettingsAPI.getModelsByProvider(
              provider.id
            );
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

      // 시스템, 모델, Docling, Unstructured 설정을 각각 병렬로 저장
      await Promise.all([
        settingsAPI.updateSettings(settings),
        modelSettingsAPI.updateModelSettings(modelSettings),
        modelSettingsAPI.updateDoclingSettings(doclingSettings),
        unstructuredAPI.updateSettings(unstructuredSettings),
      ]);

      toast({
        title: "설정 저장 완료",
        description:
          "시스템 설정, 모델 설정, Docling 설정, Unstructured 설정이 성공적으로 저장되었습니다.",
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
        description:
          error.response?.data?.detail || "연결 테스트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleProviderChange = async (
    type: "llm" | "embedding",
    provider: string
  ) => {
    if (type === "llm") {
      setModelSettings((prev) => ({
        ...prev,
        llm_provider: provider,
        // 첫 번째 모델로 기본 설정
        llm_model: availableModels[provider]?.llm_models?.[0] || "",
      }));
    } else {
      const firstModel = availableModels[provider]?.embedding_models?.[0] || "";
      const dimensions =
        availableModels[provider]?.embedding_dimensions?.[firstModel];
      const defaultDimension = dimensions ? dimensions[0] : 1536;

      setModelSettings((prev) => ({
        ...prev,
        embedding_provider: provider,
        // 첫 번째 모델로 기본 설정
        embedding_model: firstModel,
        embedding_dimension: defaultDimension,
      }));
      // 시스템 설정의 벡터 차원도 동기화
      setSettings((prev) => ({
        ...prev,
        vectorDimension: defaultDimension,
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
                onChange={(e) => handleProviderChange("llm", e.target.value)}
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
                onChange={(e) =>
                  setModelSettings((prev) => ({
                    ...prev,
                    llm_model: e.target.value,
                  }))
                }
              >
                {(
                  availableModels[modelSettings.llm_provider]?.llm_models || []
                ).map((model: string) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* API 키 입력 */}
          {providers.find((p) => p.id === modelSettings.llm_provider)
            ?.api_key_required && (
            <div>
              <label className="text-sm font-medium">API 키</label>
              <Input
                type="password"
                value={modelSettings.llm_api_key}
                onChange={(e) =>
                  setModelSettings((prev) => ({
                    ...prev,
                    llm_api_key: e.target.value,
                  }))
                }
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
                onChange={(e) =>
                  setModelSettings((prev) => ({
                    ...prev,
                    llm_temperature: parseFloat(e.target.value) || 0.7,
                  }))
                }
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">최대 토큰</label>
              <Input
                type="number"
                min="1"
                value={modelSettings.llm_max_tokens}
                onChange={(e) =>
                  setModelSettings((prev) => ({
                    ...prev,
                    llm_max_tokens: parseInt(e.target.value) || 4096,
                  }))
                }
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
                onChange={(e) =>
                  handleProviderChange("embedding", e.target.value)
                }
              >
                {providers
                  .filter(
                    (p) => availableModels[p.id]?.embedding_models?.length > 0
                  )
                  .map((provider) => (
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
                onChange={(e) => {
                  const selectedModel = e.target.value;
                  const provider = modelSettings.embedding_provider;
                  const dimensions =
                    availableModels[provider]?.embedding_dimensions?.[
                      selectedModel
                    ];
                  const defaultDimension = dimensions
                    ? dimensions[0]
                    : modelSettings.embedding_dimension;

                  setModelSettings((prev) => ({
                    ...prev,
                    embedding_model: selectedModel,
                    embedding_dimension: defaultDimension,
                  }));
                  // 시스템 설정의 벡터 차원도 동기화
                  setSettings((prev) => ({
                    ...prev,
                    vectorDimension: defaultDimension,
                  }));
                }}
              >
                {(
                  availableModels[modelSettings.embedding_provider]
                    ?.embedding_models || []
                ).map((model: string) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 임베딩 API 키 입력 */}
          {providers.find((p) => p.id === modelSettings.embedding_provider)
            ?.api_key_required && (
            <div>
              <label className="text-sm font-medium">API 키</label>
              <Input
                type="password"
                value={modelSettings.embedding_api_key}
                onChange={(e) =>
                  setModelSettings((prev) => ({
                    ...prev,
                    embedding_api_key: e.target.value,
                  }))
                }
                placeholder="임베딩용 API 키를 입력하세요"
                className="mt-1"
              />
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">벡터 차원</label>
              <select
                className="mt-1 w-full border rounded-md p-2 text-sm"
                value={modelSettings.embedding_dimension}
                onChange={(e) => {
                  const newDimension = parseInt(e.target.value);
                  setModelSettings((prev) => ({
                    ...prev,
                    embedding_dimension: newDimension,
                  }));
                  // 시스템 설정의 벡터 차원도 동기화
                  setSettings((prev) => ({
                    ...prev,
                    vectorDimension: newDimension,
                  }));
                }}
              >
                {(
                  availableModels[modelSettings.embedding_provider]
                    ?.embedding_dimensions?.[modelSettings.embedding_model] || [
                    modelSettings.embedding_dimension,
                  ]
                ).map((dimension: number) => (
                  <option key={dimension} value={dimension}>
                    {dimension}차원{" "}
                    {dimension === 384
                      ? "(빠름, 권장)"
                      : dimension === 1536
                      ? "(표준)"
                      : dimension >= 3072
                      ? "(최고 품질)"
                      : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                높은 차원일수록 정확하지만 느리고 비용이 많이 듭니다.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">검색 결과</label>
              <Input
                type="number"
                min="1"
                max="50"
                value={modelSettings.top_k}
                onChange={(e) =>
                  setModelSettings((prev) => ({
                    ...prev,
                    top_k: parseInt(e.target.value) || 5,
                  }))
                }
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                검색 시 반환할 최대 문서 수
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">청크 크기 설정</label>
              <div className="mt-1 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center gap-2 text-blue-800">
                  <Info className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    현재 청크 크기: {modelSettings.chunk_size}문자
                  </span>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  청크 크기는 위의 <strong>마스터 청크 설정</strong>에서 변경해주세요.
                  전처리와 벡터화에서 일관성 있게 적용됩니다.
                </p>
              </div>
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

  // Unstructured 설정 카드 
  const renderUnstructuredSettingsCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Unstructured 문서 처리
          {unstructuredStatus?.available ? (
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
          Unstructured를 사용한 고급 문서 처리 및 구조 분석 설정입니다. PDF, Office
          문서의 테이블, 이미지, 구조를 정확하게 추출할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unstructured 활성화 토글 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <label className="text-sm font-medium">Unstructured 기능 활성화</label>
            <p className="text-xs text-muted-foreground">
              파일 업로드 시 Unstructured를 사용한 고급 문서 분석을 기본으로
              사용합니다.
            </p>
          </div>
          <input
            type="checkbox"
            checked={unstructuredSettings.enabled}
            onChange={(e) =>
              setUnstructuredSettings((prev) => ({
                ...prev,
                enabled: e.target.checked,
              }))
            }
            className="h-4 w-4"
          />
        </div>

        {/* 상세 설정 (Unstructured가 활성화된 경우에만 표시) */}
        {unstructuredSettings.enabled && (
          <>
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-medium">처리 전략 설정</h4>

              {/* 처리 전략 */}
              <div>
                <label className="text-sm font-medium">처리 전략</label>
                <select
                  className="mt-1 w-full border rounded-md p-2 text-sm"
                  value={unstructuredSettings.strategy}
                  onChange={(e) =>
                    setUnstructuredSettings((prev) => ({
                      ...prev,
                      strategy: e.target.value,
                    }))
                  }
                >
                  <option value="auto">자동 (추천)</option>
                  <option value="hi_res">고해상도 (느림, 정확)</option>
                  <option value="fast">빠름 (빠름, 기본)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  문서 처리 전략을 선택합니다. auto는 문서 유형에 따라 자동 선택됩니다.
                </p>
              </div>

              {/* 청킹 전략 */}
              <div>
                <label className="text-sm font-medium">청킹 전략</label>
                <select
                  className="mt-1 w-full border rounded-md p-2 text-sm"
                  value={unstructuredSettings.chunking_strategy}
                  onChange={(e) =>
                    setUnstructuredSettings((prev) => ({
                      ...prev,
                      chunking_strategy: e.target.value,
                    }))
                  }
                >
                  <option value="by_title">제목 기준 (추천)</option>
                  <option value="basic">기본</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  문서를 청크로 나누는 방식을 선택합니다.
                </p>
              </div>

              {/* 테이블 및 이미지 추출 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Table className="h-4 w-4" />
                    <div>
                      <label className="text-sm font-medium">
                        테이블 구조 분석
                      </label>
                      <p className="text-xs text-muted-foreground">
                        문서 내 테이블을 구조화하여 추출합니다.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={unstructuredSettings.infer_table_structure}
                    onChange={(e) =>
                      setUnstructuredSettings((prev) => ({
                        ...prev,
                        infer_table_structure: e.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    <div>
                      <label className="text-sm font-medium">PDF 이미지 추출</label>
                      <p className="text-xs text-muted-foreground">
                        PDF 문서 내 이미지와 차트를 추출합니다.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={unstructuredSettings.extract_images_in_pdf}
                    onChange={(e) =>
                      setUnstructuredSettings((prev) => ({
                        ...prev,
                        extract_images_in_pdf: e.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <div>
                      <label className="text-sm font-medium">
                        페이지 구분 포함
                      </label>
                      <p className="text-xs text-muted-foreground">
                        문서에서 페이지 구분 정보를 포함합니다.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={unstructuredSettings.include_page_breaks}
                    onChange={(e) =>
                      setUnstructuredSettings((prev) => ({
                        ...prev,
                        include_page_breaks: e.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />
                </div>
              </div>

              {/* 마스터 청크 설정 연동 안내 */}
              <div className="border-t pt-4 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <div className="text-sm text-green-800">
                      <p className="font-medium mb-1">마스터 청크 설정 연동</p>
                      <p className="text-xs">
                        청크 관련 설정은 위의 <strong>마스터 청크 설정</strong>에서 통합 관리됩니다.
                        <br />
                        • 현재 전처리 청크: <strong>{unstructuredSettings.max_characters}문자</strong>
                        <br />
                        • 현재 결합 기준: <strong>{unstructuredSettings.combine_text_under_n_chars}문자</strong>
                        <br />
                        • 마스터 설정 변경 시 자동으로 동기화됩니다.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 파일 크기 제한만 유지 */}
                <div>
                  <label className="text-sm font-medium">
                    Unstructured 처리 최대 파일 크기 (MB)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="500"
                    value={unstructuredSettings.max_file_size_mb}
                    onChange={(e) =>
                      setUnstructuredSettings((prev) => ({
                        ...prev,
                        max_file_size_mb: parseInt(e.target.value) || 100,
                      }))
                    }
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    이 크기를 초과하는 파일은 기존 방식으로 처리됩니다.
                    (마스터 청크 설정에서 청크 크기 설정 가능)
                  </p>
                </div>
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
                {unstructuredSettings.supported_formats.map((format) => (
                  <Badge key={format} variant="secondary" className="text-xs">
                    {format}
                  </Badge>
                ))}
              </div>
              <p className="text-xs mt-2">
                Unstructured는 이러한 파일 형식에서 구조화된 콘텐츠 추출과 고급 문서
                분석을 제공합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 상태 정보 */}
        {unstructuredStatus && (
          <div
            className={`border rounded-lg p-3 ${
              unstructuredStatus.available
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-start gap-2">
              {unstructuredStatus.available ? (
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
              )}
              <div
                className={`text-sm ${
                  unstructuredStatus.available ? "text-green-800" : "text-red-800"
                }`}
              >
                <p className="font-medium">
                  Unstructured 상태:{" "}
                  {unstructuredStatus.available ? "사용 가능" : "사용 불가"}
                </p>
                <p className="text-xs mt-1">
                  {unstructuredStatus.available
                    ? `버전 ${
                        unstructuredStatus.version || "unknown"
                      } - 모든 기능이 정상 작동합니다.`
                    : "패키지가 설치되지 않았거나 초기화에 실패했습니다. 설치를 확인해주세요."}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
          Docling을 사용한 고급 문서 구조 분석 및 처리 설정입니다. PDF, Office
          문서의 테이블, 이미지, 구조를 정확하게 추출할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Docling 활성화 토글 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <label className="text-sm font-medium">Docling 기능 활성화</label>
            <p className="text-xs text-muted-foreground">
              파일 업로드 시 Docling을 사용한 고급 문서 분석을 기본으로
              사용합니다.
            </p>
          </div>
          <input
            type="checkbox"
            checked={doclingSettings.enabled}
            onChange={(e) =>
              setDoclingSettings((prev) => ({
                ...prev,
                enabled: e.target.checked,
              }))
            }
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
                    <label className="text-sm font-medium">
                      테이블 구조 분석
                    </label>
                    <p className="text-xs text-muted-foreground">
                      문서 내 표를 구조화하여 추출합니다.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={doclingSettings.default_extract_tables}
                  onChange={(e) =>
                    setDoclingSettings((prev) => ({
                      ...prev,
                      default_extract_tables: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
              </div>

              {/* 이미지 추출 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  <div>
                    <label className="text-sm font-medium">이미지 추출</label>
                    <p className="text-xs text-muted-foreground">
                      문서 내 이미지와 차트를 추출합니다.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={doclingSettings.default_extract_images}
                  onChange={(e) =>
                    setDoclingSettings((prev) => ({
                      ...prev,
                      default_extract_images: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
              </div>

              {/* OCR 활성화 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <div>
                    <label className="text-sm font-medium">
                      OCR (광학 문자 인식)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      이미지나 스캔된 문서의 텍스트를 인식합니다.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={doclingSettings.default_ocr_enabled}
                  onChange={(e) =>
                    setDoclingSettings((prev) => ({
                      ...prev,
                      default_ocr_enabled: e.target.checked,
                    }))
                  }
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
                  onChange={(e) =>
                    setDoclingSettings((prev) => ({
                      ...prev,
                      default_output_format: e.target.value,
                    }))
                  }
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
                <label className="text-sm font-medium">
                  Docling 처리 최대 파일 크기 (MB)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="500"
                  value={doclingSettings.max_file_size_mb}
                  onChange={(e) =>
                    setDoclingSettings((prev) => ({
                      ...prev,
                      max_file_size_mb: parseInt(e.target.value) || 50,
                    }))
                  }
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
                Docling은 이러한 파일 형식에서 구조화된 콘텐츠 추출과 고급 문서
                분석을 제공합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 상태 정보 */}
        {doclingStatus && (
          <div
            className={`border rounded-lg p-3 ${
              doclingStatus.available
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-start gap-2">
              {doclingStatus.available ? (
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
              )}
              <div
                className={`text-sm ${
                  doclingStatus.available ? "text-green-800" : "text-red-800"
                }`}
              >
                <p className="font-medium">
                  Docling 상태:{" "}
                  {doclingStatus.available ? "사용 가능" : "사용 불가"}
                </p>
                <p className="text-xs mt-1">
                  {doclingStatus.available
                    ? `버전 ${
                        doclingStatus.version || "2.44.0"
                      } - 모든 기능이 정상 작동합니다.`
                    : "패키지가 설치되지 않았거나 초기화에 실패했습니다. 설치를 확인해주세요."}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // 마스터 청크 설정 카드
  const renderMasterChunkSettingsCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          마스터 청크 설정
        </CardTitle>
        <CardDescription>
          전처리, 벡터화, 검색 등 모든 단계에서 사용되는 통합 청크 설정입니다.
          한 곳에서 설정하면 모든 처리 단계에 일관성 있게 적용됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 청크 크기 설정 */}
        <div className="space-y-4">
          {/* 토큰 초과 경고 */}
          {modelSettings.chunk_size > 2000 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium mb-2">⚠️ 토큰 초과 위험!</p>
                  <p className="text-xs mb-2">
                    현재 청크 크기({modelSettings.chunk_size})가 너무 쿄니다.
                    임베딩 모델의 토큰 한계(8,192)를 초과할 수 있습니다.
                  </p>
                  <p className="text-xs font-medium">
                    권장: 1,500 이하로 설정하세요.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* 안전 영역 표시 */}
          {modelSettings.chunk_size <= 1500 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-medium mb-2">✅ 안전한 청크 설정</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li><strong>일관성:</strong> 전처리와 벡터화에서 동일한 청크 크기 사용</li>
                    <li><strong>토큰 안전:</strong> 임베딩 모델 토큰 한계 내에서 안전하게 처리</li>
                    <li><strong>단순화:</strong> 여러 곳에 흔어져 있던 설정을 한 곳에서 관리</li>
                    <li><strong>자동 동기화:</strong> 변경 시 자동으로 모든 관련 설정 업데이트</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {/* 주의 영역 */}
          {modelSettings.chunk_size > 1500 && modelSettings.chunk_size <= 2000 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-2">⚠️ 주의 영역</p>
                  <p className="text-xs">
                    일부 문서에서 토큰 초과가 발생할 수 있습니다. 
                    안전한 처리를 위해 1,500 이하로 설정을 고려해주세요.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 마스터 청크 크기 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                마스터 청크 크기
                <span className="ml-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  통합
                </span>
              </label>
              <Input
                type="number"
                min="100"
                max="5000"
                value={modelSettings.chunk_size}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value) || 1000;
                  // 모든 청크 관련 설정 동기화
                  setModelSettings(prev => ({ ...prev, chunk_size: newSize }));
                  setSettings(prev => ({ ...prev, chunkSize: newSize }));
                  setUnstructuredSettings(prev => ({ 
                    ...prev, 
                    max_characters: newSize,
                    new_after_n_chars: Math.floor(newSize * 0.8) // 80% 기준
                  }));
                }}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground">
                전처리 및 벡터화에서 사용할 기본 청크 크기
                <br />
                <span className="text-green-600 font-medium">
                  ✓ 자동 동기화: 벡터화({settings.chunkSize}), 전처리({unstructuredSettings.max_characters})
                </span>
              </p>
            </div>

            {/* 청크 오버랩 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                청크 오버랩
                <span className="ml-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  통합
                </span>
              </label>
              <Input
                type="number"
                min="0"
                max="500"
                value={modelSettings.chunk_overlap}
                onChange={(e) => {
                  const newOverlap = parseInt(e.target.value) || 200;
                  // 청크 오버랩 동기화
                  setModelSettings(prev => ({ ...prev, chunk_overlap: newOverlap }));
                  setSettings(prev => ({ ...prev, chunkOverlap: newOverlap }));
                  setUnstructuredSettings(prev => ({ 
                    ...prev, 
                    combine_text_under_n_chars: Math.min(150, newOverlap) // 오버랩보다 작게
                  }));
                }}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground">
                인접한 청크 간의 겹치는 문자 수
                <br />
                <span className="text-green-600 font-medium">
                  ✓ 자동 동기화: 벡터화({settings.chunkOverlap}), 결합기준({unstructuredSettings.combine_text_under_n_chars})
                </span>
              </p>
            </div>
          </div>

          {/* 청크 제어 비율 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">지능형 청크 제어</p>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p><strong>전처리 단계:</strong></p>
                    <p>• 최대 문자: {unstructuredSettings.max_characters}</p>
                    <p>• 새 청크 기준: {unstructuredSettings.new_after_n_chars}</p>
                    <p>• 결합 기준: {unstructuredSettings.combine_text_under_n_chars}</p>
                  </div>
                  <div>
                    <p><strong>벡터화 단계:</strong></p>
                    <p>• 청크 크기: {modelSettings.chunk_size}</p>
                    <p>• 청크 오버랩: {modelSettings.chunk_overlap}</p>
                    <p>• 벡터 차원: {modelSettings.embedding_dimension}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 청크 품질 및 토큰 분석 */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">청크 품질 및 토큰 분석</h4>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className={`p-3 rounded-lg border ${
              modelSettings.chunk_size <= 800 
                ? 'bg-green-50 border-green-200 text-green-800'
                : modelSettings.chunk_size <= 1500
                ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="font-medium text-sm">{
                modelSettings.chunk_size <= 800 ? '안전 영역'
                : modelSettings.chunk_size <= 1500 ? '주의 영역'
                : '위험 영역'
              }</div>
              <div className="text-xs mt-1">{
                modelSettings.chunk_size <= 800 ? '토큰 안전한 크기'
                : modelSettings.chunk_size <= 1500 ? '일부 토큰 초과 가능'
                : '토큰 초과 위험'
              }</div>
            </div>
            <div className={`p-3 rounded-lg border ${
              modelSettings.chunk_overlap / modelSettings.chunk_size > 0.25
                ? 'bg-red-50 border-red-200 text-red-800'
                : modelSettings.chunk_overlap / modelSettings.chunk_size > 0.1
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}>
              <div className="font-medium text-sm">오버랩 비율</div>
              <div className="text-xs mt-1">{Math.round((modelSettings.chunk_overlap / modelSettings.chunk_size) * 100)}%</div>
            </div>
            <div className={`p-3 rounded-lg border ${
              modelSettings.embedding_dimension >= 1536
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}>
              <div className="font-medium text-sm">벡터 품질</div>
              <div className="text-xs mt-1">{
                modelSettings.embedding_dimension >= 1536 ? '고품질' : '표준'
              }</div>
            </div>
            <div className={`p-3 rounded-lg border ${
              modelSettings.chunk_size <= 1200
                ? 'bg-green-50 border-green-200 text-green-800'
                : modelSettings.chunk_size <= 1500
                ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="font-medium text-sm">예상 토큰</div>
              <div className="text-xs mt-1">
                {Math.round(modelSettings.chunk_size * 1.3)} / 8,192
                <br />
                <span className={modelSettings.chunk_size > 1500 ? 'text-red-600 font-bold' : ''}>
                  {modelSettings.chunk_size > 1500 ? '⚠️ 초과위험' : '✅ 안전'}
                </span>
              </div>
            </div>
          </div>
          
          {/* 토큰 초과 경고 */}
          {modelSettings.chunk_size > 1500 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  현재 청크 크기로 로그에서 본 오류가 발생할 수 있습니다!
                </span>
              </div>
              <p className="text-xs text-red-700 mt-1">
                "이 모델의 최대 컨텍스트 길이는 8192 토큰입니다" - 1,500 이하로 설정해주세요.
              </p>
            </div>
          )}
        </div>

        {/* 빠른 설정 버튼들 */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">빠른 설정</h4>
            <div className="text-xs text-muted-foreground">클릭 한 번으로 최적화</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => {
                const newSize = 600;
                const newOverlap = 100;
                setModelSettings(prev => ({ ...prev, chunk_size: newSize, chunk_overlap: newOverlap }));
                setSettings(prev => ({ ...prev, chunkSize: newSize, chunkOverlap: newOverlap }));
                setUnstructuredSettings(prev => ({ 
                  ...prev, 
                  max_characters: newSize,
                  new_after_n_chars: Math.floor(newSize * 0.8),
                  combine_text_under_n_chars: newOverlap
                }));
                toast({ title: "세밀 설정 적용", description: "정확한 검색에 최적화 (토큰 안전)" });
              }}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              세밀 모드
              <br />
              (600/100) ✅
            </Button>
            <Button
              onClick={() => {
                const newSize = 1000;
                const newOverlap = 150;
                setModelSettings(prev => ({ ...prev, chunk_size: newSize, chunk_overlap: newOverlap }));
                setSettings(prev => ({ ...prev, chunkSize: newSize, chunkOverlap: newOverlap }));
                setUnstructuredSettings(prev => ({ 
                  ...prev, 
                  max_characters: newSize,
                  new_after_n_chars: Math.floor(newSize * 0.8),
                  combine_text_under_n_chars: newOverlap
                }));
                toast({ title: "균형 설정 적용", description: "속도와 정확성 균형 (토큰 안전)" });
              }}
              variant="default"
              size="sm"
              className="text-xs bg-green-600 hover:bg-green-700"
            >
              균형 모드 ★
              <br />
              (1000/150) ✅
            </Button>
            <Button
              onClick={() => {
                const newSize = 1400;
                const newOverlap = 200;
                setModelSettings(prev => ({ ...prev, chunk_size: newSize, chunk_overlap: newOverlap }));
                setSettings(prev => ({ ...prev, chunkSize: newSize, chunkOverlap: newOverlap }));
                setUnstructuredSettings(prev => ({ 
                  ...prev, 
                  max_characters: newSize,
                  new_after_n_chars: Math.floor(newSize * 0.8),
                  combine_text_under_n_chars: newOverlap
                }));
                toast({ title: "고속 설정 적용", description: "빠른 처리에 최적화 (토큰 안전 한계내)" });
              }}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              고속 모드
              <br />
              (1400/200) ⚠️
            </Button>
          </div>
        </div>
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
              preview="edit"
              hideToolbar={false}
              visibleDragbar={false}
              style={{
                backgroundColor: "white",
              }}
              textareaProps={{
                placeholder:
                  "AI의 기본 동작을 정의하는 시스템 메시지를 입력하세요.\n\n예시:\n```\n당신은 도움이 되고 정확한 정보를 제공하는 AI 어시스턴트입니다.\n\n**역할:**\n- 사용자의 질문에 친절하고 상세하게 답변\n- 정확하지 않은 정보는 제공하지 않음\n- 필요시 추가 설명이나 예시 제공\n\n**응답 스타일:**\n- 정중하고 전문적인 톤\n- 구조화된 답변 제공\n- 마크다운 형식 활용\n```",
                style: {
                  fontSize: "14px",
                  lineHeight: "1.5",
                  fontFamily: "inherit",
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
            페르소나를 선택하면 해당 페르소나의 성격과 응답 스타일이 기본 시스템
            메시지와 함께 적용됩니다.
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
        case "reset-vector-data":
          result = await fileAPI.resetVectorData();
          break;
        case "wipe-all":
          result = await fileAPI.wipeAllData();
          break;
        case "reset-chromadb":
          result = await fileAPI.resetChromaDB();
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

  // 채팅 기록 전체 삭제 함수
  const handleDeleteAllChatHistory = async () => {
    try {
      setMaintenanceLoading("delete-all-chats");
      const result = await chatAPI.deleteAllChatHistory();

      toast({
        title: "채팅 기록 삭제 완료",
        description: `총 ${result.deleted_count}개의 채팅 기록이 삭제되었습니다.`,
      });
      setShowDeleteChatModal(false);
    } catch (error: any) {
      console.error("채팅 기록 전체 삭제 실패:", error);
      toast({
        title: "채팅 기록 삭제 실패",
        description:
          error.response?.data?.detail ||
          "채팅 기록 삭제 중 오류가 발생했습니다.",
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

      {/* 모델 설정 카드 (전체 폭) */}
      {renderModelSettingsCard()}

      {/* 마스터 청크 설정 (전체 폭) */}
      {renderMasterChunkSettingsCard()}

      {/* 시스템 메시지와 문서 처리 설정을 좌우 배치 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 시스템 메시지 및 기본 페르소나 설정 */}
        {renderSystemMessageCard()}

        {/* Unstructured 문서 처리 설정 */}
        {renderUnstructuredSettingsCard()}
      </div>

      {/* Docling과 기타 설정들 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Docling 고급 문서 분석 설정 */}
        {renderDoclingSettingsCard()}

      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 파일 업로드 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              기본 파일 업로드 설정
            </CardTitle>
            <CardDescription>
              일반적인 파일 업로드와 관련된 기본 설정을 관리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">파일 크기 제한 안내</p>
                  <p className="text-xs">
                    각 문서 처리 라이브러리의 크기 제한은 <strong>통합 처리 설정</strong>에서 개별 관리됩니다.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">허용된 파일 형식</label>
              <div className="mt-1 flex gap-2 flex-wrap">
                {settings.allowedFileTypes.map((type) => (
                  <Badge key={type} variant="secondary">
                    .{type}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                시스템에서 기본적으로 허용하는 파일 형식들입니다.
              </p>
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
              <p className="text-xs text-muted-foreground mt-1">
                업로드된 파일이 저장될 기본 디렉토리입니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ChromaDB 관리 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              데이터베이스 관리
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

                {/* 벡터 데이터만 초기화 */}
                <div className="space-y-2 border-t pt-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    벡터 데이터 초기화
                  </h4>
                  <Button
                    onClick={() =>
                      handleMaintenanceAction(
                        "reset-vector-data",
                        "벡터 데이터 초기화"
                      )
                    }
                    disabled={maintenanceLoading !== null}
                    variant="outline"
                    className="w-full justify-start border-orange-300 hover:bg-orange-50"
                    size="sm"
                  >
                    {maintenanceLoading === "reset-vector-data" ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4 mr-2" />
                    )}
                    벡터 데이터만 초기화
                  </Button>
                  <p className="text-xs text-muted-foreground px-3">
                    ChromaDB의 벡터 데이터와 metadata.db의 레코드만 삭제합니다.
                    업로드된 파일과 DB 구조는 그대로 유지됩니다.
                  </p>
                </div>

                {/* 데이터베이스 완전 초기화 섹션 (단일 버튼) */}
                <div className="space-y-3 border-t pt-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    전체 데이터 완전 초기화
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-1">
                    <Button
                      onClick={() =>
                        handleMaintenanceAction(
                          "wipe-all",
                          "전체 데이터 완전 초기화"
                        )
                      }
                      disabled={maintenanceLoading !== null}
                      variant="destructive"
                      className="justify-start"
                      size="sm"
                    >
                      {maintenanceLoading === "wipe-all" ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      전체 데이터 완전 초기화
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground px-3">
                    위험: 이 작업은 업로드된 파일, 벡터 DB, 메타데이터 DB를 모두
                    완전히 삭제합니다. 되돌릴 수 없으므로 반드시 백업 후
                    사용하세요.
                  </p>
                </div>

                {/* 채팅 기록 전체 삭제 */}
                <div className="space-y-2 border-t pt-3">
                  <Dialog
                    open={showDeleteChatModal}
                    onOpenChange={setShowDeleteChatModal}
                  >
                    <DialogTrigger asChild>
                      <Button
                        disabled={maintenanceLoading !== null}
                        variant="destructive"
                        className="w-full justify-start"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        모든 채팅 기록 삭제
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                          채팅 기록 전체 삭제
                        </DialogTitle>
                        <DialogDescription>
                          정말로 모든 채팅 기록을 삭제하시겠습니까?
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div className="text-sm text-red-800">
                              <p className="font-medium mb-2">주의사항</p>
                              <ul className="list-disc list-inside space-y-1">
                                <li>
                                  모든 사용자의 채팅 기록이 영구적으로
                                  삭제됩니다
                                </li>
                                <li>삭제된 데이터는 복구할 수 없습니다</li>
                                <li>채팅 통계 및 히스토리가 초기화됩니다</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowDeleteChatModal(false)}
                          disabled={maintenanceLoading === "delete-all-chats"}
                        >
                          취소
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteAllChatHistory}
                          disabled={maintenanceLoading === "delete-all-chats"}
                        >
                          {maintenanceLoading === "delete-all-chats" ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              삭제 중...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              삭제 확인
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <p className="text-xs text-muted-foreground px-3">
                    시스템의 모든 채팅 기록을 영구적으로 삭제합니다. 이 작업은
                    되돌릴 수 없으므로 신중하게 진행하세요.
                  </p>
                </div>
              </div>
            </div>

            {/* 안내 메시지 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">
                    데이터베이스 관리 기능 안내
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>
                      <strong>진단 및 정상화:</strong> 고아 벡터 정리, 상태
                      동기화 등 자동 진단
                    </li>
                    <li>
                      <strong>벡터 데이터 초기화:</strong> 파일은 유지하고 벡터
                      데이터와 메타데이터만 삭제
                    </li>
                    <li>
                      <strong>전체 데이터 삭제:</strong> 모든 파일과 데이터를
                      완전히 삭제 (복구 불가)
                    </li>
                    <li>작업 전에는 반드시 백업을 권장합니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 성능 최적화 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              성능 최적화 설정
            </CardTitle>
            <CardDescription>
              벡터화 처리 성능과 시스템 리소스 사용량을 최적화하는 설정입니다.
              시스템 사양에 맞게 조정하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 병렬 처리 설정 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                병렬 처리 설정
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 동시 임베딩 처리 수 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    동시 임베딩 처리 수
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={settings.maxConcurrentEmbeddings || 5}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxConcurrentEmbeddings: parseInt(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    동시에 처리할 수 있는 임베딩 배치 수 (권장: 3-10)
                  </p>
                </div>

                {/* 동시 청크 처리 수 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    동시 청크 처리 수
                  </label>
                  <Input
                    type="number"
                    min="5"
                    max="100"
                    value={settings.maxConcurrentChunks || 20}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxConcurrentChunks: parseInt(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    동시에 처리할 수 있는 텍스트 청크 수 (권장: 10-50)
                  </p>
                </div>

                {/* 임베딩 풀 크기 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    임베딩 함수 풀 크기
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.embeddingPoolSize || 3}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        embeddingPoolSize: parseInt(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    재사용할 임베딩 함수 인스턴스 수 (권장: 2-5)
                  </p>
                </div>

                {/* 연결 풀 크기 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">연결 풀 크기</label>
                  <Input
                    type="number"
                    min="5"
                    max="50"
                    value={settings.connectionPoolSize || 10}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        connectionPoolSize: parseInt(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    ChromaDB 연결 풀 최대 크기 (권장: 5-20)
                  </p>
                </div>
              </div>
            </div>

            {/* 캐싱 설정 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                캐싱 설정
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 캐시 TTL */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    캐시 만료 시간 (초)
                  </label>
                  <Input
                    type="number"
                    min="300"
                    max="86400"
                    value={settings.cacheTtlSeconds || 3600}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cacheTtlSeconds: parseInt(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    임베딩 캐시 유지 시간 (기본: 3600초 = 1시간)
                  </p>
                </div>

                {/* 스트림 버퍼 크기 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    스트림 버퍼 크기
                  </label>
                  <Input
                    type="number"
                    min="50"
                    max="1000"
                    value={settings.chunkStreamBufferSize || 100}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        chunkStreamBufferSize: parseInt(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    스트리밍 청크 처리 버퍼 크기 (권장: 50-200)
                  </p>
                </div>
              </div>
            </div>

            {/* 기능 활성화 토글 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                성능 기능 활성화
              </h4>

              <div className="space-y-3">
                {/* 병렬 처리 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      병렬 벡터화 처리
                    </label>
                    <p className="text-xs text-muted-foreground">
                      대용량 파일에 대해 병렬 처리로 2-5배 빠른 벡터화
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableParallelProcessing}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        enableParallelProcessing: e.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                </div>

                {/* 스트리밍 청크 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      스트리밍 청크 처리
                    </label>
                    <p className="text-xs text-muted-foreground">
                      메모리 효율적인 대용량 파일 처리 (70-80% 메모리 절약)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableStreamingChunks}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        enableStreamingChunks: e.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                </div>

                {/* 스마트 캐싱 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">스마트 캐싱</label>
                    <p className="text-xs text-muted-foreground">
                      임베딩 결과 캐싱으로 반복 처리 시 90% 시간 단축
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableSmartCaching}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        enableSmartCaching: e.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                </div>
              </div>
            </div>

            {/* 성능 권장 사항 */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-green-600 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-medium mb-2">성능 최적화 권장 사항</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>
                      <strong>낮은 사양 (4GB RAM 이하):</strong> 동시 임베딩
                      3개, 동시 청크 10개
                    </li>
                    <li>
                      <strong>중간 사양 (8GB RAM):</strong> 동시 임베딩 5개,
                      동시 청크 20개
                    </li>
                    <li>
                      <strong>높은 사양 (16GB+ RAM):</strong> 동시 임베딩 8개,
                      동시 청크 50개
                    </li>
                    <li>
                      <strong>모든 성능 기능 활성화 권장:</strong> 최대 5배 성능
                      향상 가능
                    </li>
                    <li>
                      <strong>캐시 TTL:</strong> 자주 처리하는 문서가 많으면
                      길게 설정
                    </li>
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
