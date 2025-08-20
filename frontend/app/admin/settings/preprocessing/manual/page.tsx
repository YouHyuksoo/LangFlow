'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Slider } from '@/components/ui/slider'
import { 
  SettingsIcon, 
  SaveIcon, 
  RefreshCwIcon, 
  TestTubeIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  BrainIcon,
  SlidersIcon,
  ShieldIcon,
  PlayCircleIcon
} from 'lucide-react'
import { vectorAPI } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface ManualPreprocessingSettings {
  enabled: boolean
  default_sentence_splitter: string
  max_tokens: number
  min_tokens: number
  overlap_tokens: number
  hard_sentence_max_tokens: number
  respect_headings: boolean
  preserve_tables: boolean
  preserve_lists: boolean
  drop_short_chunks: boolean
  
  // KSS 설정
  kss_backend: string
  kss_num_workers: number
  kss_strip: boolean
  kss_return_morphemes: boolean
  kss_ignores: string[]
  
  // Kiwi 설정
  kiwi_model_path: string
  kiwi_integrate_allomorph: boolean
  kiwi_load_default_dict: boolean
  kiwi_max_unk_form_len: number
  
  // 정규식 설정
  regex_sentence_endings: string
  regex_preserve_abbreviations: boolean
  regex_custom_patterns: string[]
  
  // RecursiveCharacterTextSplitter 설정
  recursive_separators: string[]
  recursive_keep_separator: boolean
  recursive_is_separator_regex: boolean
  
  // 품질 및 중복 검사 설정
  enable_quality_check: boolean
  enable_duplicate_check: boolean
  similarity_threshold: number
  word_overlap_threshold: number
  
  // 이미지 처리 설정
  enable_image_extraction: boolean
  max_image_distance: number
  max_images_per_chunk: number
}

interface FallbackControlSettings {
  enable_similarity_fallback: boolean
  enable_sentence_splitter_fallback: boolean
  enable_token_counter_fallback: boolean
  enable_pdf_extraction_fallback: boolean
  strict_mode: boolean
}

interface SplitterOption {
  value: string
  label: string
  requires: string | null
}

interface KSSBackendOption {
  value: string
  label: string
  description: string
}

interface TestResult {
  success: boolean
  splitter: string
  sentence_count: number
  sentences: Array<{
    text: string
    tokens: number
    is_heading: boolean
    is_list_item: boolean
    is_table_content: boolean
  }>
  total_tokens: number
  avg_tokens_per_sentence: number
  error?: string
  suggestion?: string
  note?: string
}

export default function ManualPreprocessingSettingsPage() {
  const [settings, setSettings] = useState<ManualPreprocessingSettings | null>(null)
  const [fallbackSettings, setFallbackSettings] = useState<FallbackControlSettings | null>(null)
  const [splitterOptions, setSplitterOptions] = useState<SplitterOption[]>([])
  const [kssBackendOptions, setKSSBackendOptions] = useState<KSSBackendOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testText, setTestText] = useState('이것은 테스트 문장입니다. 문장 분할이 제대로 작동하는지 확인해보겠습니다. 한국어 문장 분할은 매우 중요한 기능입니다.')
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const { toast } = useToast()

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await vectorAPI.get('/settings/manual-preprocessing')
      setSettings(response.data.manual_preprocessing)
      setFallbackSettings(response.data.fallback_control)
      setSplitterOptions(response.data.splitter_options)
      setKSSBackendOptions(response.data.kss_backend_options)
    } catch (error) {
      console.error('설정 로드 실패:', error)
      toast({
        title: "설정 로드 실패",
        description: "수동 전처리 설정을 불러오는데 실패했습니다.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings) return

    try {
      setSaving(true)
      await vectorAPI.post('/settings/manual-preprocessing', settings)
      toast({
        title: "설정 저장 완료",
        description: "수동 전처리 설정이 성공적으로 저장되었습니다.",
      })
    } catch (error: any) {
      console.error('설정 저장 실패:', error)
      toast({
        title: "설정 저장 실패",
        description: error.response?.data?.detail || "설정 저장 중 오류가 발생했습니다.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const saveFallbackSettings = async () => {
    if (!fallbackSettings) return

    try {
      setSaving(true)
      await vectorAPI.post('/settings/fallback-control', fallbackSettings)
      toast({
        title: "폴백 설정 저장 완료",
        description: "폴백 제어 설정이 성공적으로 저장되었습니다.",
      })
    } catch (error: any) {
      console.error('폴백 설정 저장 실패:', error)
      toast({
        title: "폴백 설정 저장 실패",
        description: error.response?.data?.detail || "폴백 설정 저장 중 오류가 발생했습니다.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const testSplitter = async () => {
    if (!settings || !testText.trim()) {
      toast({
        title: "테스트 실패",
        description: "테스트할 텍스트를 입력해주세요.",
        variant: "destructive"
      })
      return
    }

    try {
      setTesting(true)
      const response = await vectorAPI.post('/settings/manual-preprocessing/test-splitter', {
        text: testText,
        splitter: settings.default_sentence_splitter,
        settings: settings
      })
      setTestResult(response.data)
    } catch (error: any) {
      console.error('문장 분할 테스트 실패:', error)
      toast({
        title: "테스트 실패",
        description: error.response?.data?.detail || "문장 분할 테스트 중 오류가 발생했습니다.",
        variant: "destructive"
      })
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const updateSettings = (key: keyof ManualPreprocessingSettings, value: any) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  const updateFallbackSettings = (key: keyof FallbackControlSettings, value: any) => {
    if (!fallbackSettings) return
    setFallbackSettings({ ...fallbackSettings, [key]: value })
  }

  if (loading || !settings || !fallbackSettings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCwIcon className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">설정을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BrainIcon className="w-8 h-8 text-primary" />
            수동 전처리 설정
          </h1>
          <p className="text-muted-foreground mt-2">
            KSS, Kiwi, 정규식, RecursiveCharacterTextSplitter 등의 수동 전처리 옵션을 중앙에서 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadSettings} variant="outline" disabled={loading}>
            <RefreshCwIcon className="w-4 h-4 mr-2" />
            새로고침
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            <SaveIcon className="w-4 h-4 mr-2" />
            {saving ? '저장 중...' : '설정 저장'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">기본 설정</TabsTrigger>
          <TabsTrigger value="splitters">문장 분할기</TabsTrigger>
          <TabsTrigger value="quality">품질 검사</TabsTrigger>
          <TabsTrigger value="fallback">폴백 제어</TabsTrigger>
          <TabsTrigger value="test">테스트</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SlidersIcon className="w-5 h-5" />
                기본 청킹 설정
              </CardTitle>
              <CardDescription>
                토큰 수, 오버랩, 구조 보존 등의 기본 청킹 규칙을 설정합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={settings.enabled}
                  onCheckedChange={(checked) => updateSettings('enabled', checked)}
                />
                <Label htmlFor="enabled">수동 전처리 활성화</Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="max-tokens">최대 토큰 수</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    min="100"
                    max="4000"
                    value={settings.max_tokens}
                    onChange={(e) => updateSettings('max_tokens', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">권장: 800-1200</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-tokens">최소 토큰 수</Label>
                  <Input
                    id="min-tokens"
                    type="number"
                    min="50"
                    max="2000"
                    value={settings.min_tokens}
                    onChange={(e) => updateSettings('min_tokens', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">권장: 200-400</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overlap-tokens">오버랩 토큰 수</Label>
                  <Input
                    id="overlap-tokens"
                    type="number"
                    min="0"
                    max="500"
                    value={settings.overlap_tokens}
                    onChange={(e) => updateSettings('overlap_tokens', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">권장: max_tokens의 10-15%</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hard-sentence-max">강제 분절 임계값 (토큰)</Label>
                <Input
                  id="hard-sentence-max"
                  type="number"
                  min="100"
                  max="5000"
                  value={settings.hard_sentence_max_tokens}
                  onChange={(e) => updateSettings('hard_sentence_max_tokens', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  이 값보다 긴 문장은 강제로 분할됩니다.
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">구조 보존 설정</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="respect-headings"
                      checked={settings.respect_headings}
                      onCheckedChange={(checked) => updateSettings('respect_headings', checked)}
                    />
                    <Label htmlFor="respect-headings">헤딩 경계 존중</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="preserve-tables"
                      checked={settings.preserve_tables}
                      onCheckedChange={(checked) => updateSettings('preserve_tables', checked)}
                    />
                    <Label htmlFor="preserve-tables">표 구조 보존</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="preserve-lists"
                      checked={settings.preserve_lists}
                      onCheckedChange={(checked) => updateSettings('preserve_lists', checked)}
                    />
                    <Label htmlFor="preserve-lists">목록 구조 보존</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="drop-short-chunks"
                      checked={settings.drop_short_chunks}
                      onCheckedChange={(checked) => updateSettings('drop_short_chunks', checked)}
                    />
                    <Label htmlFor="drop-short-chunks">짧은 청크 제거</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="splitters" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>기본 문장 분할기</CardTitle>
              <CardDescription>
                사용할 문장 분할 방법을 선택하고 각 분할기별 옵션을 설정합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="default-splitter">기본 문장 분할기</Label>
                <Select
                  value={settings.default_sentence_splitter}
                  onValueChange={(value) => updateSettings('default_sentence_splitter', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {splitterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          {option.label}
                          {option.requires && (
                            <Badge variant="secondary" className="text-xs">
                              {option.requires} 필요
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* KSS 설정 */}
              {settings.default_sentence_splitter === 'kss' && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-lg">KSS 설정</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="kss-backend">KSS 백엔드</Label>
                      <Select
                        value={settings.kss_backend}
                        onValueChange={(value) => updateSettings('kss_backend', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {kssBackendOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div>
                                <div className="font-medium">{option.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {option.description}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="kss-workers">워커 수</Label>
                        <Input
                          id="kss-workers"
                          type="number"
                          min="1"
                          max="8"
                          value={settings.kss_num_workers}
                          onChange={(e) => updateSettings('kss_num_workers', parseInt(e.target.value))}
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="kss-strip"
                            checked={settings.kss_strip}
                            onCheckedChange={(checked) => updateSettings('kss_strip', checked)}
                          />
                          <Label htmlFor="kss-strip">양끝 공백 제거</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id="kss-morphemes"
                            checked={settings.kss_return_morphemes}
                            onCheckedChange={(checked) => updateSettings('kss_return_morphemes', checked)}
                          />
                          <Label htmlFor="kss-morphemes">형태소 반환</Label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Kiwi 설정 */}
              {settings.default_sentence_splitter === 'kiwi' && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Kiwi 설정</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="kiwi-model-path">모델 경로 (선택사항)</Label>
                      <Input
                        id="kiwi-model-path"
                        placeholder="기본 모델 사용"
                        value={settings.kiwi_model_path}
                        onChange={(e) => updateSettings('kiwi_model_path', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kiwi-max-unk">최대 미지 형태소 길이</Label>
                      <Input
                        id="kiwi-max-unk"
                        type="number"
                        min="1"
                        max="20"
                        value={settings.kiwi_max_unk_form_len}
                        onChange={(e) => updateSettings('kiwi_max_unk_form_len', parseInt(e.target.value))}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="kiwi-allomorph"
                          checked={settings.kiwi_integrate_allomorph}
                          onCheckedChange={(checked) => updateSettings('kiwi_integrate_allomorph', checked)}
                        />
                        <Label htmlFor="kiwi-allomorph">이형태 통합</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="kiwi-default-dict"
                          checked={settings.kiwi_load_default_dict}
                          onCheckedChange={(checked) => updateSettings('kiwi_load_default_dict', checked)}
                        />
                        <Label htmlFor="kiwi-default-dict">기본 사전 로드</Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 정규식 설정 */}
              {settings.default_sentence_splitter === 'regex' && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-lg">정규식 설정</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="regex-endings">문장 종료 패턴</Label>
                      <Input
                        id="regex-endings"
                        placeholder="[.!?]"
                        value={settings.regex_sentence_endings}
                        onChange={(e) => updateSettings('regex_sentence_endings', e.target.value)}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="regex-abbreviations"
                        checked={settings.regex_preserve_abbreviations}
                        onCheckedChange={(checked) => updateSettings('regex_preserve_abbreviations', checked)}
                      />
                      <Label htmlFor="regex-abbreviations">줄임말 보존</Label>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="regex-custom">사용자 정의 패턴</Label>
                      <Textarea
                        id="regex-custom"
                        placeholder="한 줄에 하나씩 정규식 패턴 입력"
                        value={settings.regex_custom_patterns.join('\n')}
                        onChange={(e) => updateSettings('regex_custom_patterns', e.target.value.split('\n').filter(p => p.trim()))}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* RecursiveCharacterTextSplitter 설정 */}
              {settings.default_sentence_splitter === 'recursive' && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-lg">RecursiveCharacterTextSplitter 설정</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recursive-separators">구분자 목록</Label>
                      <Textarea
                        id="recursive-separators"
                        placeholder="한 줄에 하나씩 구분자 입력"
                        value={settings.recursive_separators.join('\n')}
                        onChange={(e) => updateSettings('recursive_separators', e.target.value.split('\n'))}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="recursive-keep"
                          checked={settings.recursive_keep_separator}
                          onCheckedChange={(checked) => updateSettings('recursive_keep_separator', checked)}
                        />
                        <Label htmlFor="recursive-keep">구분자 유지</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="recursive-regex"
                          checked={settings.recursive_is_separator_regex}
                          onCheckedChange={(checked) => updateSettings('recursive_is_separator_regex', checked)}
                        />
                        <Label htmlFor="recursive-regex">정규식 구분자</Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>품질 검사 및 중복 제거</CardTitle>
              <CardDescription>
                청킹 품질 검사와 중복 검사 설정을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="quality-check"
                    checked={settings.enable_quality_check}
                    onCheckedChange={(checked) => updateSettings('enable_quality_check', checked)}
                  />
                  <Label htmlFor="quality-check">품질 검사 활성화</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="duplicate-check"
                    checked={settings.enable_duplicate_check}
                    onCheckedChange={(checked) => updateSettings('enable_duplicate_check', checked)}
                  />
                  <Label htmlFor="duplicate-check">중복 검사 활성화</Label>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="similarity-threshold">
                    유사도 임계값: {settings.similarity_threshold.toFixed(2)}
                  </Label>
                  <Slider
                    id="similarity-threshold"
                    min={0.5}
                    max={1.0}
                    step={0.05}
                    value={[settings.similarity_threshold]}
                    onValueChange={(value) => updateSettings('similarity_threshold', value[0])}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    이 값보다 높은 유사도를 가진 청크는 중복으로 간주됩니다.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="word-overlap-threshold">
                    단어 겹침 임계값: {settings.word_overlap_threshold.toFixed(2)}
                  </Label>
                  <Slider
                    id="word-overlap-threshold"
                    min={0.5}
                    max={1.0}
                    step={0.05}
                    value={[settings.word_overlap_threshold]}
                    onValueChange={(value) => updateSettings('word_overlap_threshold', value[0])}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    단어 기준 겹침율이 이 값보다 높으면 중복으로 간주됩니다.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">이미지 처리 설정 (PDF용)</h3>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="image-extraction"
                    checked={settings.enable_image_extraction}
                    onCheckedChange={(checked) => updateSettings('enable_image_extraction', checked)}
                  />
                  <Label htmlFor="image-extraction">이미지 추출 활성화</Label>
                </div>

                {settings.enable_image_extraction && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max-image-distance">최대 이미지 거리</Label>
                      <Input
                        id="max-image-distance"
                        type="number"
                        min="10"
                        max="500"
                        value={settings.max_image_distance}
                        onChange={(e) => updateSettings('max_image_distance', parseFloat(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">픽셀 단위</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max-images">청크당 최대 이미지 수</Label>
                      <Input
                        id="max-images"
                        type="number"
                        min="1"
                        max="10"
                        value={settings.max_images_per_chunk}
                        onChange={(e) => updateSettings('max_images_per_chunk', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fallback" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldIcon className="w-5 h-5" />
                폴백 제어 설정
              </CardTitle>
              <CardDescription>
                패키지 미설치 시 폴백 동작을 제어합니다. 엄격 모드에서는 패키지가 없으면 명시적 오류가 발생합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  폴백 설정은 수동 전처리와 별도로 저장됩니다. 변경 후 별도의 저장 버튼을 클릭해주세요.
                </AlertDescription>
              </Alert>

              <div className="flex items-center space-x-2">
                <Switch
                  id="strict-mode"
                  checked={fallbackSettings.strict_mode}
                  onCheckedChange={(checked) => updateFallbackSettings('strict_mode', checked)}
                />
                <Label htmlFor="strict-mode">엄격 모드 (권장)</Label>
                {fallbackSettings.strict_mode && (
                  <Badge variant="default">활성화됨</Badge>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">개별 폴백 설정</h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">datasketch → 코사인 유사도</div>
                      <div className="text-sm text-muted-foreground">
                        고정밀 중복 검사 실패 시 단순 코사인 유사도로 폴백
                      </div>
                    </div>
                    <Switch
                      checked={fallbackSettings.enable_similarity_fallback}
                      onCheckedChange={(checked) => updateFallbackSettings('enable_similarity_fallback', checked)}
                      disabled={fallbackSettings.strict_mode}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">KSS/Kiwi → 정규식</div>
                      <div className="text-sm text-muted-foreground">
                        전문 문장 분할기 실패 시 정규식 분할로 폴백
                      </div>
                    </div>
                    <Switch
                      checked={fallbackSettings.enable_sentence_splitter_fallback}
                      onCheckedChange={(checked) => updateFallbackSettings('enable_sentence_splitter_fallback', checked)}
                      disabled={fallbackSettings.strict_mode}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">tiktoken → 단어 기반 추정</div>
                      <div className="text-sm text-muted-foreground">
                        정확한 토큰 계산 실패 시 단어 수 기반 추정으로 폴백
                      </div>
                    </div>
                    <Switch
                      checked={fallbackSettings.enable_token_counter_fallback}
                      onCheckedChange={(checked) => updateFallbackSettings('enable_token_counter_fallback', checked)}
                      disabled={fallbackSettings.strict_mode}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">PyMuPDF → pdfplumber</div>
                      <div className="text-sm text-muted-foreground">
                        고정밀 PDF 처리 실패 시 기본 PDF 처리로 폴백
                      </div>
                    </div>
                    <Switch
                      checked={fallbackSettings.enable_pdf_extraction_fallback}
                      onCheckedChange={(checked) => updateFallbackSettings('enable_pdf_extraction_fallback', checked)}
                      disabled={fallbackSettings.strict_mode}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveFallbackSettings} disabled={saving}>
                  <SaveIcon className="w-4 h-4 mr-2" />
                  {saving ? '저장 중...' : '폴백 설정 저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTubeIcon className="w-5 h-5" />
                문장 분할 테스트
              </CardTitle>
              <CardDescription>
                현재 설정으로 문장 분할이 어떻게 작동하는지 테스트해볼 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="test-text">테스트 텍스트</Label>
                <Textarea
                  id="test-text"
                  placeholder="여기에 테스트할 텍스트를 입력하세요..."
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={testSplitter} disabled={testing || !testText.trim()}>
                  <PlayCircleIcon className="w-4 h-4 mr-2" />
                  {testing ? '테스트 중...' : '분할 테스트 실행'}
                </Button>
                <Badge variant="outline">
                  분할기: {settings.default_sentence_splitter.toUpperCase()}
                </Badge>
              </div>

              {testResult && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertTriangleIcon className="w-5 h-5 text-red-500" />
                      )}
                      테스트 결과
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {testResult.success ? (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-500">
                              {testResult.sentence_count}
                            </div>
                            <div className="text-sm text-muted-foreground">문장 수</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-500">
                              {testResult.total_tokens}
                            </div>
                            <div className="text-sm text-muted-foreground">총 토큰</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-500">
                              {testResult.avg_tokens_per_sentence.toFixed(1)}
                            </div>
                            <div className="text-sm text-muted-foreground">평균 토큰/문장</div>
                          </div>
                        </div>

                        {testResult.note && (
                          <Alert>
                            <InfoIcon className="h-4 w-4" />
                            <AlertDescription>{testResult.note}</AlertDescription>
                          </Alert>
                        )}

                        <div className="space-y-2">
                          <h4 className="font-medium">분할된 문장들:</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {testResult.sentences.map((sentence, index) => (
                              <div
                                key={index}
                                className="p-3 border rounded-lg bg-muted/50"
                              >
                                <div className="text-sm mb-1">
                                  <span className="font-medium">문장 {index + 1}</span>
                                  <span className="ml-2 text-muted-foreground">
                                    ({sentence.tokens} 토큰)
                                  </span>
                                  {sentence.is_heading && (
                                    <Badge variant="secondary" className="ml-2">헤딩</Badge>
                                  )}
                                  {sentence.is_list_item && (
                                    <Badge variant="secondary" className="ml-2">목록</Badge>
                                  )}
                                  {sentence.is_table_content && (
                                    <Badge variant="secondary" className="ml-2">표</Badge>
                                  )}
                                </div>
                                <div className="text-sm">{sentence.text}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <Alert variant="destructive">
                          <AlertTriangleIcon className="h-4 w-4" />
                          <AlertDescription>
                            <strong>오류:</strong> {testResult.error}
                          </AlertDescription>
                        </Alert>
                        {testResult.suggestion && (
                          <Alert>
                            <InfoIcon className="h-4 w-4" />
                            <AlertDescription>
                              <strong>제안:</strong> {testResult.suggestion}
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}