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
import { Bot, Save, Zap, Key, TestTube, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { modelSettingsAPI } from "@/lib/api";

interface ModelSettings {
  // LLM 모델 설정
  llm_provider: string;
  llm_model: string;
  llm_api_key: string;
  llm_temperature: number;
  llm_max_tokens?: number;
  llm_top_p?: number;

  // 임베딩 모델 설정
  embedding_provider: string;
  embedding_model: string;
  embedding_api_key: string;
  embedding_dimension?: number;

}

// 제공업체별 모델 데이터 타입 정의
interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  dimension?: number;
}

interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
}

interface ProvidersData {
  llm_providers: ProviderInfo[];
  embedding_providers: ProviderInfo[];
}

export default function ModelsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ModelSettings>({
    llm_provider: "openai",
    llm_model: "gpt-4o-mini",
    llm_api_key: "",
    llm_temperature: 0.7,
    llm_max_tokens: 4000,
    llm_top_p: 1.0,
    embedding_provider: "openai",
    embedding_model: "text-embedding-3-small",
    embedding_api_key: "",
    embedding_dimension: 1536,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingLLM, setTestingLLM] = useState(false);
  const [testingEmbedding, setTestingEmbedding] = useState(false);
  const [providersData, setProvidersData] = useState<ProvidersData>({
    llm_providers: [],
    embedding_providers: []
  });

  // 제공업체별 사용 가능한 모델들
  const getCurrentLLMProvider = () => providersData.llm_providers.find(p => p.id === settings.llm_provider);
  const getCurrentEmbeddingProvider = () => providersData.embedding_providers.find(p => p.id === settings.embedding_provider);
  
  const availableLLMModels = getCurrentLLMProvider()?.models || [];
  const availableEmbeddingModels = getCurrentEmbeddingProvider()?.models || [];

  // LLM 제공업체 변경 핸들러
  const handleLLMProviderChange = (provider: string) => {
    const providerData = providersData.llm_providers.find(p => p.id === provider);
    const firstModel = providerData?.models[0];
    
    setSettings({
      ...settings,
      llm_provider: provider,
      llm_model: firstModel?.id || "",
    });
  };

  // 임베딩 제공업체 변경 핸들러
  const handleEmbeddingProviderChange = (provider: string) => {
    const providerData = providersData.embedding_providers.find(p => p.id === provider);
    const firstModel = providerData?.models[0];
    
    setSettings({
      ...settings,
      embedding_provider: provider,
      embedding_model: firstModel?.id || "",
      embedding_dimension: firstModel?.dimension || 1536,
    });
  };

  // 임베딩 모델 변경 핸들러 (차원 자동 업데이트)
  const handleEmbeddingModelChange = (modelId: string) => {
    const selectedModel = availableEmbeddingModels.find(model => model.id === modelId);
    
    setSettings({
      ...settings,
      embedding_model: modelId,
      embedding_dimension: selectedModel?.dimension || settings.embedding_dimension,
    });
  };

  const fetchProviders = async () => {
    try {
      const data = await modelSettingsAPI.getAvailableProviders();
      setProvidersData(data);
    } catch (error) {
      console.error("제공업체 정보 로드 오류:", error);
      toast({
        title: "오류",
        description: "제공업체 정보를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await modelSettingsAPI.getSettings();
      setSettings({
        llm_provider: data.llm_provider || "openai",
        llm_model: data.llm_model || "gpt-4o-mini",
        llm_api_key: data.llm_api_key || "",
        llm_temperature: data.llm_temperature || 0.7,
        llm_max_tokens: data.llm_max_tokens || 4000,
        llm_top_p: data.llm_top_p || 1.0,
        embedding_provider: data.embedding_provider || "openai",
        embedding_model: data.embedding_model || "text-embedding-3-small",
        embedding_api_key: data.embedding_api_key || "",
        embedding_dimension: data.embedding_dimension || 1536,
      });
    } catch (error) {
      console.error("모델 설정 로드 오류:", error);
      toast({
        title: "오류",
        description: "모델 설정을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProviders(), fetchSettings()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await modelSettingsAPI.updateSettings(settings);
      toast({
        title: "성공",
        description: "모델 설정이 저장되었습니다.",
      });
    } catch (error) {
      console.error("모델 설정 저장 오류:", error);
      toast({
        title: "오류",
        description: "모델 설정 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testLLMConnection = async () => {
    setTestingLLM(true);
    try {
      const result = await modelSettingsAPI.testLLMConnection({
        provider: settings.llm_provider,
        model: settings.llm_model,
        api_key: settings.llm_api_key,
      });
      
      if (result.status === "success") {
        toast({
          title: "성공",
          description: result.message || "LLM 연결 테스트가 성공했습니다.",
        });
      } else {
        toast({
          title: "테스트 실패",
          description: result.message || "LLM 연결 테스트에 실패했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("LLM 연결 테스트 오류:", error);
      toast({
        title: "오류",
        description: "LLM 연결 테스트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setTestingLLM(false);
    }
  };

  const testEmbeddingConnection = async () => {
    setTestingEmbedding(true);
    try {
      const result = await modelSettingsAPI.testEmbeddingConnection({
        provider: settings.embedding_provider,
        model: settings.embedding_model,
        api_key: settings.embedding_api_key,
      });
      
      if (result.status === "success") {
        toast({
          title: "성공",
          description: result.message || "임베딩 연결 테스트가 성공했습니다.",
        });
      } else {
        toast({
          title: "테스트 실패",
          description: result.message || "임베딩 연결 테스트에 실패했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("임베딩 연결 테스트 오류:", error);
      toast({
        title: "오류",
        description: "임베딩 연결 테스트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setTestingEmbedding(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">모델 설정을 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-8 w-8" />
            모델 설정
          </h1>
          <p className="text-muted-foreground">
            LLM 및 임베딩 모델을 설정하고 관리합니다.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "저장 중..." : "저장"}
        </Button>
      </div>

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
                value={settings.llm_provider}
                onChange={(e) => handleLLMProviderChange(e.target.value)}
              >
                {providersData.llm_providers.map((provider) => (
                  <option key={provider.id} value={provider.id} disabled={provider.models.length === 0}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">모델</label>
              <select
                className="mt-1 w-full border rounded-md p-2 text-sm"
                value={settings.llm_model}
                onChange={(e) =>
                  setSettings({ ...settings, llm_model: e.target.value })
                }
                disabled={availableLLMModels.length === 0}
              >
                {availableLLMModels.length === 0 ? (
                  <option value="">사용 가능한 모델이 없습니다</option>
                ) : (
                  availableLLMModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.id} ({model.name})
                    </option>
                  ))
                )}
              </select>
              {availableLLMModels.find(m => m.id === settings.llm_model)?.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {availableLLMModels.find(m => m.id === settings.llm_model)?.description}
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-1">
              <Key className="h-4 w-4" />
              API 키
            </label>
            <Input
              type="password"
              value={settings.llm_api_key}
              onChange={(e) =>
                setSettings({ ...settings, llm_api_key: e.target.value })
              }
              placeholder="API 키를 입력하세요"
              className="mt-1"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">온도 (Temperature)</label>
              <Input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={settings.llm_temperature}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    llm_temperature: parseFloat(e.target.value),
                  })
                }
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                0-2 사이 값 (낮을수록 일관적)
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">최대 토큰</label>
              <Input
                type="number"
                min="1"
                value={settings.llm_max_tokens || 4000}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    llm_max_tokens: parseInt(e.target.value),
                  })
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Top P</label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={settings.llm_top_p || 1.0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    llm_top_p: parseFloat(e.target.value),
                  })
                }
                className="mt-1"
              />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={testLLMConnection}
            disabled={testingLLM}
            className="w-full"
          >
            <TestTube className="h-4 w-4 mr-2" />
            {testingLLM ? "연결 테스트 중..." : "LLM 연결 테스트"}
          </Button>
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
                value={settings.embedding_provider}
                onChange={(e) => handleEmbeddingProviderChange(e.target.value)}
              >
                {providersData.embedding_providers.map((provider) => (
                  <option key={provider.id} value={provider.id} disabled={provider.models.length === 0}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">모델</label>
              <select
                className="mt-1 w-full border rounded-md p-2 text-sm"
                value={settings.embedding_model}
                onChange={(e) => handleEmbeddingModelChange(e.target.value)}
                disabled={availableEmbeddingModels.length === 0}
              >
                {availableEmbeddingModels.length === 0 ? (
                  <option value="">사용 가능한 모델이 없습니다</option>
                ) : (
                  availableEmbeddingModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.id} ({model.name})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-1">
              <Key className="h-4 w-4" />
              API 키
            </label>
            <Input
              type="password"
              value={settings.embedding_api_key}
              onChange={(e) =>
                setSettings({ ...settings, embedding_api_key: e.target.value })
              }
              placeholder="API 키를 입력하세요"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              임베딩 차원
              {availableEmbeddingModels.find(m => m.id === settings.embedding_model) && (
                <Badge variant="secondary" className="text-xs">
                  자동: {availableEmbeddingModels.find(m => m.id === settings.embedding_model)?.dimension}차원
                </Badge>
              )}
            </label>
            <Input
              type="number"
              value={settings.embedding_dimension || 1536}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  embedding_dimension: parseInt(e.target.value),
                })
              }
              className="mt-1"
              placeholder="1536"
            />
            <div className="text-xs text-muted-foreground mt-1 space-y-1">
              <p>선택한 모델에 따라 자동으로 설정됩니다.</p>
              {availableEmbeddingModels.length > 0 && (
                <div className="grid gap-1">
                  <span className="font-medium">사용 가능한 차원:</span>
                  {availableEmbeddingModels.map((model) => (
                    <div key={model.id} className="flex justify-between text-xs">
                      <span>{model.name}:</span>
                      <span className="font-mono">{model.dimension}차원</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={testEmbeddingConnection}
            disabled={testingEmbedding}
            className="w-full"
          >
            <TestTube className="h-4 w-4 mr-2" />
            {testingEmbedding ? "연결 테스트 중..." : "임베딩 연결 테스트"}
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}