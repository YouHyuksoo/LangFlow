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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bot, Plus, Edit, Trash2, TestTube, Check, Star, Settings, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { modelProfileAPI, modelSettingsAPI } from "@/lib/api";

interface ModelProfile {
  id: string;
  name: string;
  provider: string;
  model: string;
  api_key: string;
  base_url?: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ModelProfilesResponse {
  profiles: ModelProfile[];
  active_profile_id?: string;
}

// 제공업체별 사용 가능한 모델
const LLM_PROVIDERS = {
  openai: {
    name: "OpenAI",
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    ]
  },
  google: {
    name: "Google",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
    ]
  },
  anthropic: {
    name: "Anthropic",
    models: [
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
    ]
  }
};

const EMBEDDING_PROVIDERS = {
  openai: {
    name: "OpenAI",
    models: [
      { id: "text-embedding-3-large", name: "Text Embedding 3 Large", dimension: 3072 },
      { id: "text-embedding-3-small", name: "Text Embedding 3 Small", dimension: 1536 },
      { id: "text-embedding-ada-002", name: "Text Embedding Ada 002", dimension: 1536 },
    ]
  },
  huggingface: {
    name: "HuggingFace",
    models: [
      { id: "sentence-transformers/all-MiniLM-L6-v2", name: "All MiniLM L6 v2", dimension: 384 },
      { id: "sentence-transformers/all-mpnet-base-v2", name: "All MPNet Base v2", dimension: 768 },
    ]
  }
};

function ModelProfileCard({ 
  profile, 
  isActive, 
  onEdit, 
  onDelete, 
  onActivate, 
  onTest 
}: {
  profile: ModelProfile;
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onActivate: () => void;
  onTest: () => void;
}) {
  const providerInfo = LLM_PROVIDERS[profile.provider as keyof typeof LLM_PROVIDERS];
  const modelInfo = providerInfo?.models.find(m => m.id === profile.model);

  return (
    <Card className={`relative ${isActive ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''}`}>
      {isActive && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white p-1 rounded-full">
          <Check className="h-4 w-4" />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {profile.name}
            {isActive && <Badge variant="default" className="text-xs">활성</Badge>}
          </CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          {providerInfo?.name} • {modelInfo?.name || profile.model}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">온도:</span>
            <span className="ml-2 font-mono">{profile.temperature}</span>
          </div>
          <div>
            <span className="text-muted-foreground">토큰:</span>
            <span className="ml-2 font-mono">{profile.max_tokens}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {!isActive && (
            <Button size="sm" variant="outline" onClick={onActivate} className="flex-1">
              <Star className="h-4 w-4 mr-1" />
              활성화
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onTest} className="flex-1">
            <TestTube className="h-4 w-4 mr-1" />
            테스트
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ModelProfileForm({ 
  profile, 
  isOpen, 
  onClose, 
  onSuccess 
}: {
  profile?: ModelProfile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    provider: "openai",
    model: "gpt-4o-mini",
    api_key: "",
    base_url: "",
    temperature: 0.7,
    max_tokens: 2000,
    top_p: 1.0,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        provider: profile.provider,
        model: profile.model,
        api_key: profile.api_key,
        base_url: profile.base_url || "",
        temperature: profile.temperature,
        max_tokens: profile.max_tokens,
        top_p: profile.top_p,
      });
    } else {
      setFormData({
        name: "",
        provider: "openai",
        model: "gpt-4o-mini",
        api_key: "",
        base_url: "",
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 1.0,
      });
    }
  }, [profile, isOpen]);

  const handleProviderChange = (provider: string) => {
    const providerInfo = LLM_PROVIDERS[provider as keyof typeof LLM_PROVIDERS];
    const firstModel = providerInfo?.models[0];
    
    setFormData({
      ...formData,
      provider,
      model: firstModel?.id || "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // 1. 필수 필드 검증
      if (!formData.name.trim()) {
        toast({
          title: "입력 오류",
          description: "프로필 이름을 입력해주세요.",
          variant: "destructive",
        });
        return;
      }
      
      if (!formData.api_key.trim()) {
        toast({
          title: "입력 오류", 
          description: "API 키를 입력해주세요.",
          variant: "destructive",
        });
        return;
      }

      // 2. profile이 있으면 수정(update), 없으면 생성(create)
      if (profile) {
        // 수정 모드
        await modelProfileAPI.updateProfile(profile.id, {
          name: formData.name.trim(),
          api_key: formData.api_key.trim(),
          base_url: formData.base_url.trim() || undefined,
          temperature: formData.temperature,
          max_tokens: formData.max_tokens,
          top_p: formData.top_p,
        });
        
        toast({
          title: "성공",
          description: `"${formData.name}" 프로필이 수정되었습니다.`,
        });
      } else {
        // 생성 모드
        await modelProfileAPI.createProfile({
          name: formData.name.trim(),
          provider: formData.provider,
          model: formData.model,
          api_key: formData.api_key.trim(),
          base_url: formData.base_url.trim() || undefined,
          temperature: formData.temperature,
          max_tokens: formData.max_tokens,
          top_p: formData.top_p,
        });
        
        toast({
          title: "성공",
          description: `"${formData.name}" 프로필이 등록되었습니다.`,
        });
      }
      
      // 3. 성공 시 onSuccess() 호출하여 목록 새로고침
      onSuccess();
      
    } catch (error) {
      console.error("모델 프로필 저장 오류:", error);
      toast({
        title: "오류",
        description: "모델 프로필 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const currentProvider = LLM_PROVIDERS[formData.provider as keyof typeof LLM_PROVIDERS];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {profile ? "모델 프로필 수정" : "새 모델 프로필 등록"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">프로필 이름</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 개발용 GPT-4o"
                className="mt-1"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">제공업체</label>
              <select
                className="mt-1 w-full border rounded-md p-2 text-sm"
                value={formData.provider}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                {Object.entries(LLM_PROVIDERS).map(([key, provider]) => (
                  <option key={key} value={key}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">모델</label>
              <select
                className="mt-1 w-full border rounded-md p-2 text-sm"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              >
                {currentProvider?.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">API 키</label>
              <Input
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="API 키를 입력하세요"
                className="mt-1"
                required
              />
            </div>
          </div>

          {formData.provider === "openai" && (
            <div>
              <label className="text-sm font-medium">Base URL (선택사항)</label>
              <Input
                value={formData.base_url}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                placeholder="예: https://api.openai.com/v1"
                className="mt-1"
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">온도 (Temperature)</label>
              <Input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">최대 토큰</label>
              <Input
                type="number"
                min="1"
                value={formData.max_tokens}
                onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
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
                value={formData.top_p}
                onChange={(e) => setFormData({ ...formData, top_p: parseFloat(e.target.value) })}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "저장 중..." : profile ? "수정" : "등록"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// 임베딩 설정 인터페이스
interface EmbeddingSettings {
  provider: string;
  model: string;
  api_key: string;
  dimension: number;
}

export default function ModelsPage() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | undefined>();
  const [embeddingSettings, setEmbeddingSettings] = useState<EmbeddingSettings>({
    provider: "openai",
    model: "text-embedding-3-small", 
    api_key: "",
    dimension: 1536
  });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ModelProfile | undefined>();
  const [savingEmbedding, setSavingEmbedding] = useState(false);

  const loadProfiles = async () => {
    try {
      const data: ModelProfilesResponse = await modelProfileAPI.getProfiles();
      setProfiles(data.profiles);
      setActiveProfileId(data.active_profile_id);
    } catch (error) {
      console.error("모델 프로필 로드 오류:", error);
      toast({
        title: "오류",
        description: "모델 프로필을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const loadEmbeddingSettings = async () => {
    try {
      const data = await modelSettingsAPI.getSettings();
      setEmbeddingSettings({
        provider: data.embedding_provider || "openai",
        model: data.embedding_model || "text-embedding-3-small",
        api_key: data.embedding_api_key || "",
        dimension: data.embedding_dimension || 1536
      });
    } catch (error) {
      console.error("임베딩 설정 로드 오류:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadProfiles(), loadEmbeddingSettings()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleEdit = (profile: ModelProfile) => {
    setEditingProfile(profile);
    setFormOpen(true);
  };

  const handleDelete = async (profile: ModelProfile) => {
    if (!confirm(`"${profile.name}" 프로필을 삭제하시겠습니까?`)) return;
    
    try {
      await modelProfileAPI.deleteProfile(profile.id);
      toast({
        title: "성공",
        description: "모델 프로필이 삭제되었습니다.",
      });
      await loadProfiles();
    } catch (error) {
      console.error("모델 프로필 삭제 오류:", error);
      toast({
        title: "오류",
        description: "모델 프로필 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleActivate = async (profile: ModelProfile) => {
    try {
      await modelProfileAPI.activateProfile(profile.id);
      toast({
        title: "성공",
        description: `"${profile.name}" 프로필이 활성화되었습니다.`,
      });
      await loadProfiles();
    } catch (error) {
      console.error("모델 프로필 활성화 오류:", error);
      toast({
        title: "오류",
        description: "모델 프로필 활성화 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleTest = async (profile: ModelProfile) => {
    try {
      const result = await modelProfileAPI.testProfile(profile.id);
      toast({
        title: "테스트 성공",
        description: result.message || `"${profile.name}" 연결 테스트가 성공했습니다.`,
      });
    } catch (error) {
      console.error("모델 프로필 테스트 오류:", error);
      toast({
        title: "테스트 실패",
        description: "모델 연결 테스트에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleFormSuccess = async () => {
    setFormOpen(false);
    setEditingProfile(undefined);
    await loadProfiles();
  };

  const handleEmbeddingProviderChange = (provider: string) => {
    const providerInfo = EMBEDDING_PROVIDERS[provider as keyof typeof EMBEDDING_PROVIDERS];
    const firstModel = providerInfo?.models[0];
    
    setEmbeddingSettings({
      ...embeddingSettings,
      provider,
      model: firstModel?.id || "",
      dimension: firstModel?.dimension || 1536,
    });
  };

  const handleEmbeddingModelChange = (modelId: string) => {
    const currentProvider = EMBEDDING_PROVIDERS[embeddingSettings.provider as keyof typeof EMBEDDING_PROVIDERS];
    const selectedModel = currentProvider?.models.find(model => model.id === modelId);
    
    setEmbeddingSettings({
      ...embeddingSettings,
      model: modelId,
      dimension: selectedModel?.dimension || embeddingSettings.dimension,
    });
  };

  const saveEmbeddingSettings = async () => {
    setSavingEmbedding(true);
    try {
      console.log("임베딩 설정 저장 시도:", embeddingSettings);
      
      const result = await modelSettingsAPI.updateModelSettings({
        embedding_provider: embeddingSettings.provider,
        embedding_model: embeddingSettings.model,
        embedding_api_key: embeddingSettings.api_key,
        embedding_dimension: embeddingSettings.dimension,
      });
      
      console.log("임베딩 설정 저장 결과:", result);
      
      toast({
        title: "성공",
        description: "임베딩 모델 설정이 저장되었습니다.",
      });
    } catch (error: any) {
      console.error("임베딩 설정 저장 오류:", error);
      console.error("오류 상세:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });
      
      toast({
        title: "오류",
        description: `임베딩 설정 저장 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
        variant: "destructive",
      });
    } finally {
      setSavingEmbedding(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">모델 프로필을 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <Settings className="h-8 w-8" />
            모델 프로필 관리
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            여러 모델을 등록하고 필요에 따라 활성 모델을 전환하세요.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          새 프로필 등록
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">등록된 모델 프로필이 없습니다</p>
            <p className="text-slate-600 dark:text-slate-400 mb-4">첫 번째 모델 프로필을 등록해보세요.</p>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              첫 프로필 등록
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <ModelProfileCard
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeProfileId}
              onEdit={() => handleEdit(profile)}
              onDelete={() => handleDelete(profile)}
              onActivate={() => handleActivate(profile)}
              onTest={() => handleTest(profile)}
            />
          ))}
        </div>
      )}

      {/* 임베딩 모델 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            임베딩 모델 설정
          </CardTitle>
          <CardDescription>
            문서 벡터화에 사용할 임베딩 모델을 설정합니다. (LLM 프로필과 별도 관리)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">제공업체</label>
              <select
                className="mt-1 w-full border rounded-md p-2 text-sm"
                value={embeddingSettings.provider}
                onChange={(e) => handleEmbeddingProviderChange(e.target.value)}
              >
                {Object.entries(EMBEDDING_PROVIDERS).map(([key, provider]) => (
                  <option key={key} value={key}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">모델</label>
              <select
                className="mt-1 w-full border rounded-md p-2 text-sm"
                value={embeddingSettings.model}
                onChange={(e) => handleEmbeddingModelChange(e.target.value)}
              >
                {EMBEDDING_PROVIDERS[embeddingSettings.provider as keyof typeof EMBEDDING_PROVIDERS]?.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.dimension}차원)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">API 키</label>
            <Input
              type="password"
              value={embeddingSettings.api_key}
              onChange={(e) => setEmbeddingSettings({ ...embeddingSettings, api_key: e.target.value })}
              placeholder="임베딩 모델 API 키"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              임베딩 차원
              <Badge variant="secondary" className="text-xs">
                현재: {embeddingSettings.dimension}차원
              </Badge>
            </label>
            <Input
              type="number"
              value={embeddingSettings.dimension}
              onChange={(e) => setEmbeddingSettings({ ...embeddingSettings, dimension: parseInt(e.target.value) })}
              className="mt-1"
              placeholder="1536"
            />
          </div>
          <Button
            onClick={saveEmbeddingSettings}
            disabled={savingEmbedding}
            className="w-full"
          >
            {savingEmbedding ? "저장 중..." : "임베딩 설정 저장"}
          </Button>
        </CardContent>
      </Card>

      <ModelProfileForm
        profile={editingProfile}
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingProfile(undefined);
        }}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}