'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { 
  ArrowLeftIcon,
  SaveIcon,
  EyeIcon,
  PlayIcon,
  SettingsIcon,
  SlidersIcon,
  MergeIcon,
  SplitIcon,
  Edit3Icon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  RefreshCwIcon,
  BrainIcon,
  SparklesIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { preprocessingAPI, api, vectorAPI } from '@/lib/api'
import DocumentViewer from '@/components/document-viewer'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'

// ==================== 유틸리티 함수 ====================

// 에러 객체에서 안전하게 메시지 추출
const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'string') {
    return err
  }
  return '알 수 없는 오류가 발생했습니다.'
}

// 에러 객체에서 HTTP 응답 정보 추출
const getErrorResponse = (err: unknown) => {
  if (err && typeof err === 'object' && 'response' in err) {
    const errorObj = err as any
    return {
      data: errorObj.response?.data,
      status: errorObj.response?.status
    }
  }
  return { data: undefined, status: undefined }
}

// ==================== PRD 방식 인터페이스 ====================

// 문장 분할 방법
type SentenceSplitterMethod = 'kss' | 'kiwi' | 'regex' | 'recursive'

// 공통 청킹 규칙
interface BaseChunkingRules {
  max_tokens: number
  min_tokens: number
  overlap_tokens: number
  hard_sentence_max_tokens: number  // 강제 문장 분절 임계값
  respect_headings: boolean
  preserve_tables: boolean
  preserve_lists: boolean
  drop_short_chunks: boolean
  snap_to_sentence: boolean        // 문장 경계 스냅
  use_hierarchical: boolean        // 계층적 청킹 사용
  created_at?: string              // 생성일시
  version: string                  // 버전 정보
}

// KSS 전용 옵션 (Python KSS 6.0.5 호환)
interface KSSOptions {
  backend: string                     // 분석 백엔드: 'mecab', 'pecab', 'punct', 'fast'
  num_workers: number                 // 멀티프로세싱 워커 수
  strip: boolean                      // 문장 양끝 공백 제거
  return_morphemes: boolean           // 형태소 반환 여부
  ignores: string[]                   // 무시할 문자열 리스트
}

// Kiwi 전용 옵션
interface KiwiOptions {
  model_path: string              // 모델 경로 (선택사항)
  integrate_allomorph: boolean    // 이형태 통합
  load_default_dict: boolean      // 기본 사전 로드
  max_unk_form_len: number        // 최대 미등록어 길이
}

// 정규식 전용 옵션
interface RegexOptions {
  sentence_endings: string        // 문장 종료 패턴
  preserve_abbreviations: boolean // 줄임말 보존
  custom_patterns: string[]       // 사용자 정의 패턴
}

// RecursiveCharacterTextSplitter 전용 옵션
interface RecursiveOptions {
  separators: string[]            // 구분자 리스트 (우선순위 순)
  keep_separator: boolean         // 구분자 유지 여부
  is_separator_regex: boolean     // 구분자를 정규식으로 처리할지 여부
}

// 통합 청킹 규칙
interface ChunkingRules extends BaseChunkingRules {
  sentence_splitter: SentenceSplitterMethod
  kss_options: KSSOptions
  kiwi_options: KiwiOptions
  regex_options: RegexOptions
  recursive_options: RecursiveOptions
}

// PRD3: AI 청킹 인터페이스 (모델 프로필 기반 + 멀티모달 지원)
interface AIChunkingRequest {
  text: string
  model_profile_id: string
  max_tokens: number
  min_tokens: number
  overlap_tokens: number
  respect_headings: boolean
  snap_to_sentence: boolean
  hard_sentence_max_tokens: number
  use_fallback: boolean
  use_multimodal?: boolean
  pdf_file_path?: string
}

interface ModelProfile {
  id: string
  name: string
  model: string
  is_active: boolean
}

interface AIProvider {
  name: string
  display_name: string
  profiles: ModelProfile[]
  fallback?: boolean
}

interface QualityWarning {
  issue_type: string
  severity: 'warning' | 'error'
  message: string
  suggestion?: string
}

interface ChunkProposal {
  chunk_id: string
  order: number
  text: string
  token_estimate: number
  page_start?: number
  page_end?: number
  heading_path?: string[]
  quality_warnings: QualityWarning[]
  label?: string
  selected?: boolean
}

interface ChunkingStatistics {
  total_chunks: number
  total_tokens: number
  average_tokens_per_chunk: number
  rules_applied: ChunkingRules
}

interface AnnotationType {
  value: string
  label: string
  description: string
}

export default function PreprocessingEditorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const fileId = searchParams.get('fileId')
  const { toast } = useToast()

  // fileId가 없을 경우 처리
  if (!fileId) {
    router.push('/admin/preprocessing')
    return null
  }

  // ==================== PRD 방식 상태 관리 ====================
  
  const [loading, setLoading] = useState(true)
  const [proposing, setProposing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<any>(null)
  
  // PRD3: AI 청킹 상태 (모델 프로필 기반)
  const [aiProposing, setAiProposing] = useState(false)
  const [aiProviders, setAiProviders] = useState<AIProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedProfile, setSelectedProfile] = useState('')
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [useMultimodal, setUseMultimodal] = useState(false)  // 멀티모달 옵션
  
  // 설정 저장/로드 관련 상태
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [settingName, setSettingName] = useState('')
  const [savedSettings, setSavedSettings] = useState<any[]>([])
  const [savingSettings, setSavingSettings] = useState(false)
  
  // 청킹 규칙 및 상태
  const [chunkingRules, setChunkingRules] = useState<ChunkingRules>({
    // 공통 규칙
    max_tokens: 800,
    min_tokens: 200,
    overlap_tokens: 80,
    hard_sentence_max_tokens: 1000,  // 강제 문장 분절 임계값
    respect_headings: true,
    preserve_tables: true,
    preserve_lists: true,
    drop_short_chunks: false,
    snap_to_sentence: true,          // 문장 경계 스냅
    use_hierarchical: true,          // 계층적 청킹 사용
    version: '2.0',                  // 버전 정보
    
    // 문장 분할 방법 선택
    sentence_splitter: 'kss' as SentenceSplitterMethod,
    
    // KSS 전용 옵션 (기본값 사용)
    kss_options: {
      backend: 'punct',  // pecab overflow 이슈 회피를 위해 punct 사용
      num_workers: 1,
      strip: true,
      return_morphemes: false,
      ignores: []
    },
    
    // Kiwi 전용 옵션  
    kiwi_options: {
      model_path: '',
      integrate_allomorph: true,
      load_default_dict: true,
      max_unk_form_len: 8
    },
    
    // 정규식 전용 옵션
    regex_options: {
      sentence_endings: '[.!?]',
      preserve_abbreviations: true,
      custom_patterns: []
    },
    
    // RecursiveCharacterTextSplitter 전용 옵션
    recursive_options: {
      separators: ['\n\n', '\n', ' ', ''],
      keep_separator: false,
      is_separator_regex: false
    }
  })
  
  // 청크 관련 상태
  const [proposedChunks, setProposedChunks] = useState<ChunkProposal[]>([])
  const [editingChunks, setEditingChunks] = useState<ChunkProposal[]>([])
  const [selectedChunk, setSelectedChunk] = useState<ChunkProposal | null>(null)
  const [statistics, setStatistics] = useState<ChunkingStatistics | null>(null)
  
  // UI 상태
  const [currentMode, setCurrentMode] = useState<'rules' | 'chunks' | 'preview'>('rules')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [annotationTypes, setAnnotationTypes] = useState<AnnotationType[]>([])
  
  // 레거시 ref (문서 뷰어용)
  const documentViewerRef = useRef<HTMLDivElement>(null)

  // ==================== PRD 방식 핵심 함수들 ====================

  // 초기 데이터 로드
  useEffect(() => {
    loadEditorData()
    loadAIProviders() // PRD3: AI 제공업체 목록 로드
  }, [fileId])
  
  // PRD3: AI 제공업체 목록 로드
  const loadAIProviders = async () => {
    try {
      console.log('🔍 AI 제공업체 목록 로드 시작...')
      const response = await api.get('/api/v1/ai-chunking/providers', { timeout: 10000 }) // 10초로 단축
      const data = response.data
      
      console.log('📡 AI 제공업체 API 응답:', data)
      console.log('📋 제공업체 개수:', data.providers?.length || 0)
      
      setAiProviders(data.providers || [])
      
      // 기본 선택값 설정
      if (data.providers && data.providers.length > 0) {
        const firstProvider = data.providers[0]
        console.log('🏢 첫 번째 제공업체:', firstProvider)
        setSelectedProvider(firstProvider.name)
        
        if (firstProvider.profiles && firstProvider.profiles.length > 0) {
          console.log('🤖 첫 번째 모델 프로필:', firstProvider.profiles[0])
          setSelectedProfile(firstProvider.profiles[0].id)
        } else {
          console.warn('⚠️ 첫 번째 제공업체에 프로필이 없음')
        }
      } else {
        console.warn('⚠️ 제공업체 목록이 비어있음')
      }
    } catch (err) {
      console.error('❌ AI 제공업체 목록 로드 실패:', err)
      const { data, status } = getErrorResponse(err)
      console.error('❌ 오류 상세:', {
        message: getErrorMessage(err),
        response: data,
        status: status
      })
    }
  }

  // 자동 청킹 제안 (PRD 핵심 기능) - PDF 전용
  const handleProposeChunks = async () => {
    // PDF 파일만 처리 가능
    if (!fileInfo?.file_path?.endsWith('.pdf')) {
      setError('빠른 청킹은 PDF 파일에서만 지원됩니다.')
      return
    }

    try {
      console.log("🚀 빠른 청킹 작업 시작 (PDF 전용)")
      console.log("📤 전송할 청킹 규칙:", chunkingRules)
      console.log("📋 문장분할방법:", chunkingRules.sentence_splitter)
      setProposing(true)
      setError(null)

      const response = await fetch(`http://localhost:8000/api/v1/preprocessing/propose_chunks/${fileId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rules: chunkingRules
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('🔥 청킹 API 오류 상세:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
          url: response.url
        })
        throw new Error(`청킹 제안 실패: ${response.status} ${response.statusText}\n${errorText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        setProposedChunks(data.data.chunks)
        setEditingChunks([...data.data.chunks])
        setStatistics(data.data.statistics)
        setCurrentMode('chunks')
        console.log(`✅ 빠른 청킹 작업 완료: ${data.data.chunks.length}개 청크 생성`)
        console.log("🏁 빠른 청킹 작업 종료 (성공)")
      } else {
        throw new Error(data.message || '청킹 제안 실패')
      }
    } catch (err) {
      setError(getErrorMessage(err) || '청킹 제안 중 오류가 발생했습니다.')
      console.error('❌ 빠른 청킹 작업 실패:', err)
      console.log("🏁 빠른 청킹 작업 종료 (실패)")
    } finally {
      setProposing(false)
    }
  }
  
  // PRD3: AI 청킹 제안 - PDF 전용
  const handleAIChunking = async () => {
    // PDF 파일만 처리 가능
    if (!fileInfo?.file_path?.endsWith('.pdf')) {
      setError('AI 청킹은 PDF 파일에서만 지원됩니다.')
      return
    }

    try {
      setAiProposing(true)
      setError(null)
      
      // PDF 파일 텍스트 가져오기
      console.log(`🔍 PDF 파일 내용 요청 시작: fileId=${fileId}`)
      const fileContentResponse = await api.get(`/api/v1/files/${fileId}/content`)
      
      console.log(`📡 API 응답 상태: 200 OK`)
      
      const fileContentData = fileContentResponse.data
      console.log('📄 파일 내용 응답:', {
        success: fileContentData.success,
        file_type: fileContentData.file_type,
        content_length: fileContentData.content?.length || 0,
        error: fileContentData.error
      })
      
      if (!fileContentData.success) {
        throw new Error(fileContentData.error || '파일 내용 로드 실패')
      }
      
      // AI 청킹 요청 (모델 프로필 기반 + 멀티모달 지원)
      const aiRequest: AIChunkingRequest = {
        text: fileContentData.content,
        model_profile_id: selectedProfile,
        max_tokens: chunkingRules.max_tokens,
        min_tokens: chunkingRules.min_tokens,
        overlap_tokens: chunkingRules.overlap_tokens,
        respect_headings: chunkingRules.respect_headings,
        snap_to_sentence: chunkingRules.snap_to_sentence,
        hard_sentence_max_tokens: chunkingRules.hard_sentence_max_tokens,
        use_fallback: true,
        use_multimodal: useMultimodal,
        pdf_file_path: useMultimodal && fileInfo ? fileInfo.file_path : undefined
      }
      
      const response = await api.post('/api/v1/ai-chunking/propose', aiRequest, { timeout: 600000 }) // 10분으로 늘림
      
      const data = response.data
      
      // 응답 데이터를 ChunkProposal 형식으로 변환
      const aiChunks: ChunkProposal[] = data.chunks.map((chunk: any) => ({
        chunk_id: chunk.chunk_id,
        order: chunk.order,
        text: chunk.text,
        token_estimate: chunk.token_estimate,
        page_start: chunk.page_start,
        page_end: chunk.page_end,
        heading_path: chunk.heading_path,
        quality_warnings: chunk.quality_warnings?.map((msg: string) => ({
          issue_type: 'ai_generated',
          severity: 'info' as const,
          message: msg
        })) || []
      }))
      
      setProposedChunks(aiChunks)
      setEditingChunks([...aiChunks])
      
      // 통계 생성
      const totalTokens = aiChunks.reduce((sum, chunk) => sum + chunk.token_estimate, 0)
      const avgTokens = aiChunks.length > 0 ? totalTokens / aiChunks.length : 0
      
      setStatistics({
        total_chunks: aiChunks.length,
        total_tokens: totalTokens,
        average_tokens_per_chunk: avgTokens,
        rules_applied: chunkingRules
      })
      
      setCurrentMode('chunks')
      setAiDialogOpen(false)
      
      console.log(`✅ AI 청킹 완료: ${aiChunks.length}개 청크 (폴백: ${data.from_fallback})`)
      
      if (data.from_fallback) {
        setError('AI 청킹 실패로 알고리즘 폴백을 사용했습니다. AI 모델 설정을 확인하세요.')
      }
      
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      const errorCode = err && typeof err === 'object' && 'code' in err ? (err as any).code : null
      
      // 타임아웃일 경우 백엔드에서 처리가 완료되었을 수 있으니 다시 로드해봄
      if (errorMessage?.includes('timeout') || errorCode === 'ECONNABORTED') {
        console.log('⏰ 타임아웃 발생 - 기존 전처리 데이터 다시 확인 중...')
        setTimeout(() => {
          loadEditorData()
        }, 2000)
        setError('처리 시간이 오래 걸리고 있습니다. 잠시 후 결과를 확인해보세요.')
      } else {
        setError(errorMessage || 'AI 청킹 중 오류가 발생했습니다.')
      }
      console.error('AI 청킹 실패:', err)
    } finally {
      setAiProposing(false)
    }
  }

  // 청크 병합
  const handleMergeChunks = async (chunkIds: string[]) => {
    try {
      if (chunkIds.length < 2) {
        setError('병합하려면 최소 2개의 청크가 필요합니다.')
        return
      }

      const response = await fetch('http://localhost:8000/api/v1/preprocessing/merge_chunks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chunk_ids: chunkIds
        })
      })

      if (response.ok) {
        // 로컬 상태에서 청크들을 병합
        const mergingChunks = editingChunks.filter(c => chunkIds.includes(c.chunk_id))
        const otherChunks = editingChunks.filter(c => !chunkIds.includes(c.chunk_id))
        
        if (mergingChunks.length >= 2) {
          // 순서대로 정렬하여 병합
          const sortedMergingChunks = mergingChunks.sort((a, b) => a.order - b.order)
          const mergedText = sortedMergingChunks.map(c => c.text).join('\n\n')
          
          // 토큰 수 재계산 (더 정확하게)
          const mergedTokens = Math.ceil(mergedText.split(/\s+/).length * 1.3)
          
          const mergedChunk: ChunkProposal = {
            chunk_id: `merged_${Date.now()}`,
            order: sortedMergingChunks[0].order,
            text: mergedText,
            token_estimate: mergedTokens,
            quality_warnings: []
          }
          
          // 순서 재정렬
          const newChunks = [...otherChunks, mergedChunk]
            .sort((a, b) => a.order - b.order)
            .map((chunk, index) => ({...chunk, order: index + 1}))
          
          setEditingChunks(newChunks)
          
          // 병합된 청크를 선택
          setSelectedChunk(mergedChunk)
        }
        
        console.log(`✅ 청크 병합 완료: ${chunkIds.length}개 → 1개`)
      } else {
        throw new Error(`병합 실패: ${response.status}`)
      }
    } catch (err) {
      console.error('청크 병합 실패:', err)
      setError(`청크 병합 중 오류가 발생했습니다: ${getErrorMessage(err)}`)
    }
  }

  // 청크 분할
  const handleSplitChunk = async (chunkId: string, splitPosition?: number) => {
    try {
      const targetChunk = editingChunks.find(c => c.chunk_id === chunkId)
      if (!targetChunk) {
        setError('분할할 청크를 찾을 수 없습니다.')
        return
      }

      // 더 정확한 문장 분리 (한국어 + 영어)
      const sentences = targetChunk.text
        .split(/(?<=[.!?])\s+|(?<=[。！？])\s*/)
        .filter(s => s.trim())
        .map(s => s.trim())

      if (sentences.length < 2) {
        setError('분할하기에는 문장이 너무 짧습니다.')
        return
      }

      const response = await fetch('http://localhost:8000/api/v1/preprocessing/split_chunk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chunk_id: chunkId,
          split_position: splitPosition || Math.floor(sentences.length / 2)
        })
      })

      if (response.ok) {
        // 로컬 상태에서 청크 분할
        const midPoint = splitPosition || Math.floor(sentences.length / 2)
        
        const part1Text = sentences.slice(0, midPoint).join(' ')
        const part2Text = sentences.slice(midPoint).join(' ')
        
        // 토큰 수 재계산
        const part1Tokens = Math.ceil(part1Text.split(/\s+/).length * 1.3)
        const part2Tokens = Math.ceil(part2Text.split(/\s+/).length * 1.3)
        
        const chunk1: ChunkProposal = {
          ...targetChunk,
          chunk_id: `${chunkId}_part1_${Date.now()}`,
          text: part1Text,
          token_estimate: part1Tokens,
          quality_warnings: []
        }
        
        const chunk2: ChunkProposal = {
          ...targetChunk,
          chunk_id: `${chunkId}_part2_${Date.now()}`,
          order: targetChunk.order + 1,
          text: part2Text,
          token_estimate: part2Tokens,
          quality_warnings: []
        }
        
        // 기존 청크를 제거하고 새로운 청크들 추가
        const otherChunks = editingChunks.filter(c => c.chunk_id !== chunkId)
        const newChunks = [...otherChunks, chunk1, chunk2]
          .sort((a, b) => a.order - b.order)
          .map((chunk, index) => ({...chunk, order: index + 1}))
        
        setEditingChunks(newChunks)
        
        // 첫 번째 분할된 청크를 선택
        setSelectedChunk(chunk1)
        
        console.log(`✅ 청크 분할 완료: ${chunkId} → 2개 (${part1Tokens} + ${part2Tokens} 토큰)`)
      } else {
        throw new Error(`분할 실패: ${response.status}`)
      }
    } catch (err) {
      console.error('청크 분할 실패:', err)
      setError(`청크 분할 중 오류가 발생했습니다: ${getErrorMessage(err)}`)
    }
  }

  // 청크 텍스트 편집
  const handleChunkTextEdit = (chunkId: string, newText: string) => {
    setEditingChunks(prev => 
      prev.map(chunk => 
        chunk.chunk_id === chunkId 
          ? { 
              ...chunk, 
              text: newText, 
              token_estimate: Math.ceil(newText.trim().split(/\s+/).length * 1.3),
              quality_warnings: [] // 편집 후 경고 초기화
            }
          : chunk
      )
    )
    
    // 선택된 청크도 업데이트
    if (selectedChunk?.chunk_id === chunkId) {
      setSelectedChunk(prev => prev ? {
        ...prev,
        text: newText,
        token_estimate: Math.ceil(newText.trim().split(/\s+/).length * 1.3),
        quality_warnings: []
      } : null)
    }
  }

  // 설정 저장
  const handleSaveSettings = async () => {
    if (!settingName.trim()) {
      setError('설정명을 입력해주세요.')
      return
    }

    try {
      setSavingSettings(true)
      setError(null)

      const response = await fetch('http://localhost:8000/api/v1/preprocessing/save_chunking_settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: settingName,
          rules: chunkingRules
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('설정 저장 성공:', result)
        setShowSaveDialog(false)
        setSettingName('')
        // 토스트로 성공 메시지 표시
        toast({
          title: "✅ 설정 저장 완료",
          description: `'${settingName}'이 성공적으로 저장되었습니다.`,
          variant: "default"
        })
      } else {
        throw new Error(`설정 저장 실패: ${response.status}`)
      }
    } catch (err) {
      console.error('설정 저장 실패:', err)
      setError(`설정 저장 중 오류가 발생했습니다: ${getErrorMessage(err)}`)
    } finally {
      setSavingSettings(false)
    }
  }

  // 저장된 설정 목록 로드
  const loadSavedSettings = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/preprocessing/load_chunking_settings')
      
      if (response.ok) {
        const result = await response.json()
        setSavedSettings(result.data || [])
      } else {
        console.error('설정 목록 로드 실패:', response.status)
        setSavedSettings([])
      }
    } catch (err) {
      console.error('설정 목록 로드 실패:', err)
      setSavedSettings([])
    }
  }

  // 설정 로드
  const handleLoadSetting = async (settingName: string) => {
    try {
      setError(null)

      const response = await fetch(`http://localhost:8000/api/v1/preprocessing/load_chunking_settings/${encodeURIComponent(settingName)}`)
      
      if (response.ok) {
        const result = await response.json()
        const settingData = result.data
        
        if (settingData && settingData.rules) {
          setChunkingRules(settingData.rules)
          setShowLoadDialog(false)
          // 토스트로 성공 메시지 표시
          toast({
            title: "📎 설정 로드 완료",
            description: `'${settingName}'이 성공적으로 로드되었습니다.`,
            variant: "default"
          })
        } else {
          throw new Error('설정 데이터가 올바르지 않습니다.')
        }
      } else {
        throw new Error(`설정 로드 실패: ${response.status}`)
      }
    } catch (err) {
      console.error('설정 로드 실패:', err)
      setError(`설정 로드 중 오류가 발생했습니다: ${getErrorMessage(err)}`)
    }
  }

  // 로드 다이얼로그 열 때 설정 목록 로드
  useEffect(() => {
    if (showLoadDialog) {
      loadSavedSettings()
    }
  }, [showLoadDialog])

  // 최종 저장
  const handleSaveChunks = async (embedNow: boolean = true) => {
    try {
      setSaving(true)
      setError(null)

      if (editingChunks.length === 0) {
        setError('저장할 청크가 없습니다.')
        return
      }

      const response = await fetch('http://localhost:8000/api/v1/preprocessing/save_chunks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_id: fileId,
          chunks: editingChunks.map(chunk => ({
            chunk_id: chunk.chunk_id,
            order: chunk.order,
            text: chunk.text,
            label: chunk.label || `청크 ${chunk.order}`,
            type: 'paragraph',
            extracted_text: chunk.text,
            coordinates: {},
            processing_options: {}
          })),
          embed_now: embedNow
        })
      })

      if (!response.ok) {
        throw new Error(`저장 실패: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        console.log(`✅ 청크 저장 완료: ${editingChunks.length}개`)
        router.push('/admin/preprocessing') // 대시보드로 돌아가기
      } else {
        throw new Error(data.message || '저장 실패')
      }
    } catch (err) {
      setError(getErrorMessage(err) || '저장 중 오류가 발생했습니다.')
      console.error('저장 실패:', err)
    } finally {
      setSaving(false)
    }
  }

  const loadEditorData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 설정 페이지에서 기본 문장 분할기 설정을 불러와서 초기값으로 설정
      try {
        console.log('🔍 수동 전처리 설정 로드 시작...')
        const settingsResponse = await vectorAPI.getManualPreprocessingSettings()
        if (settingsResponse && settingsResponse.manual_preprocessing) {
          const defaultSplitter = settingsResponse.manual_preprocessing.default_sentence_splitter
          console.log('📋 설정에서 불러온 기본 문장 분할기:', defaultSplitter)
          
          // 현재 청킹 규칙의 문장 분할기를 기본값으로 설정 (사용자가 아직 선택하지 않은 경우에만)
          setChunkingRules(prev => ({
            ...prev,
            sentence_splitter: defaultSplitter as SentenceSplitterMethod || prev.sentence_splitter
          }))
          
          console.log('✅ 기본 문장 분할기 설정 적용:', defaultSplitter)
        }
      } catch (err) {
        console.warn('⚠️ 수동 전처리 설정 로드 실패:', err)
      }
      
      // 주석 타입 조회
      try {
        const annotationTypesResponse = await preprocessingAPI.getAnnotationTypes()
        if (annotationTypesResponse.success) {
          setAnnotationTypes(annotationTypesResponse.data || [])
        }
      } catch (err) {
        console.warn('주석 타입 조회 실패:', err)
      }

      // 파일 정보 조회
      try {
        const fileInfoResponse = await fetch(`http://localhost:8000/api/v1/files/${fileId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        })

        if (!fileInfoResponse.ok) {
          throw new Error(`파일 정보 API 오류: ${fileInfoResponse.status}`)
        }

        const fileData = await fileInfoResponse.json()

        // API 응답이 직접 파일 정보를 반환함
        if (fileData && fileData.file_id) {
          setFileInfo({
            file_id: fileId,
            filename: fileData.filename,
            file_size: fileData.file_size,
            category_name: fileData.category_name || '미분류',
            file_path: fileData.file_path
          })
        } else {
          throw new Error('파일 정보를 찾을 수 없습니다')
        }
      } catch (err) {
        console.error('파일 정보 조회 실패:', err)
        setError(`파일 정보 로드 실패: ${getErrorMessage(err)}`)
        setFileInfo({
          file_id: fileId,
          filename: '파일 정보 로드 실패',
          file_size: 0,
          category_name: '미분류',
          file_path: null
        })
      }

      // 기존 전처리 데이터 조회 (PRD 방식으로 변환)
      try {
        const preprocessingDataResponse = await preprocessingAPI.getPreprocessingMetadata(fileId)
        if (preprocessingDataResponse.success && preprocessingDataResponse.data) {
          const data = preprocessingDataResponse.data
          if (data.annotations && data.annotations.length > 0) {
            // 기존 주석들을 청크 형태로 변환
            const convertedChunks: ChunkProposal[] = data.annotations.map((ann: any, index: number) => ({
              chunk_id: ann.id || `legacy_${index}`,
              order: ann.order || index + 1,
              text: ann.extracted_text || ann.ocr_text || `[${ann.label || '텍스트'} 영역]`,
              token_estimate: Math.ceil((ann.extracted_text || ann.ocr_text || '').split(/\s+/).length * 1.3) || 50,
              label: ann.label,
              quality_warnings: []
            }))
            
            setEditingChunks(convertedChunks)
            setCurrentMode('chunks')
            console.log(`📁 기존 전처리 데이터 로드: ${convertedChunks.length}개 청크`)
          }
        }
      } catch (err) {
        console.warn('기존 전처리 데이터 조회 실패:', err)
      }

    } catch (err) {
      setError(getErrorMessage(err) || '에디터 데이터 로드 중 오류가 발생했습니다.')
      console.error('에디터 데이터 로드 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  // ==================== PRD 방식 렌더링 헬퍼 함수들 ====================

  const renderQualityWarnings = (warnings: QualityWarning[]) => {
    if (!warnings || warnings.length === 0) return null

    const getWarningStyle = (warning: QualityWarning) => {
      const issueType = warning.issue_type
      
      switch (issueType) {
        case 'too_long':
          return { 
            bg: 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800', 
            icon: <AlertTriangleIcon className="h-3 w-3" />,
            badge: '길이 초과'
          }
        case 'too_short':
          return { 
            bg: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800', 
            icon: <AlertTriangleIcon className="h-3 w-3" />,
            badge: '짧음'
          }
        case 'duplicate_content':
          return { 
            bg: 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800', 
            icon: <AlertTriangleIcon className="h-3 w-3" />,
            badge: '중복 의심'
          }
        case 'heading_boundary':
          return { 
            bg: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800', 
            icon: <AlertTriangleIcon className="h-3 w-3" />,
            badge: '헤딩 경계'
          }
        case 'isolated_caption':
          return { 
            bg: 'bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800', 
            icon: <AlertTriangleIcon className="h-3 w-3" />,
            badge: '고립 캡션'
          }
        case 'no_content':
          return { 
            bg: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800', 
            icon: <XCircleIcon className="h-3 w-3" />,
            badge: '내용 없음'
          }
        default:
          return { 
            bg: warning.severity === 'error' 
              ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' 
              : 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
            icon: warning.severity === 'error' ? <XCircleIcon className="h-3 w-3" /> : <AlertTriangleIcon className="h-3 w-3" />,
            badge: '경고'
          }
      }
    }

    return (
      <div className="space-y-2">
        {warnings.map((warning, index) => {
          const style = getWarningStyle(warning)
          return (
            <div key={index} className={`flex items-start gap-2 text-xs p-3 rounded-md border ${style.bg}`}>
              <div className="flex items-center gap-2 flex-shrink-0">
                {style.icon}
                <Badge variant="outline" className="text-xs px-1 py-0">
                  {style.badge}
                </Badge>
              </div>
              <div className="flex-1">
                <div className="font-medium mb-1">{warning.message}</div>
                {warning.suggestion && (
                  <div className="text-xs opacity-75">💡 {warning.suggestion}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const getTotalTokens = () => {
    return editingChunks.reduce((sum, chunk) => sum + chunk.token_estimate, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">PRD 방식 청킹 에디터를 로드하는 중...</p>
        </div>
      </div>
    )
  }

  // ==================== PRD 방식 3-Panel 레이아웃 ====================
  return (
    <div className="h-full flex flex-col">
      {/* 네비게이션 바 */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-background" style={{minHeight: '80px'}}>
        {/* 왼쪽: 뒤로가기 + 파일 이름 */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/admin/preprocessing')}
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {fileInfo?.filename || '파일 에디터'}
            </h1>
            <p className="text-sm text-muted-foreground">
              PRD 방식 사용자 개입형 청킹
            </p>
          </div>
        </div>
        
        {/* 오른쪽: 버튼들 */}
        <div className="flex items-center gap-2">
          {/* 청킹 실행 버튼들 */}
          <Button 
            onClick={handleProposeChunks}
            disabled={proposing || !fileInfo?.file_path?.endsWith('.pdf')}
            size="sm"
          >
            {proposing ? (
              <>
                <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                청킹 중...
              </>
            ) : (
              <>
                <PlayIcon className="h-4 w-4 mr-2" />
                빠른 청킹
              </>
            )}
          </Button>
          
          <Button 
            onClick={() => setAiDialogOpen(true)}
            disabled={aiProposing || !fileInfo?.file_path?.endsWith('.pdf')}
            variant="outline"
            size="sm"
            className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900 dark:hover:to-purple-900"
          >
            {aiProposing ? (
              <>
                <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                AI 청킹 중...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4 mr-2" />
                AI 청킹
              </>
            )}
          </Button>
          
          {/* 구분선 */}
          <div className="h-6 w-px bg-border mx-1"></div>
          
          {statistics && (
            <Badge variant="outline" className="text-xs">
              {editingChunks.length}개 청크 | {getTotalTokens()} 토큰
            </Badge>
          )}
          {(() => {
            const totalWarnings = editingChunks.reduce((sum, chunk) => sum + chunk.quality_warnings.length, 0)
            if (totalWarnings > 0) {
              return (
                <Badge variant="destructive" className="text-xs">
                  {totalWarnings}개 품질 경고
                </Badge>
              )
            }
            return null
          })()}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            disabled={editingChunks.length === 0}
          >
            <EyeIcon className="h-4 w-4 mr-2" />
            미리보기
          </Button>
          <Button
            onClick={() => handleSaveChunks(true)}
            disabled={saving || editingChunks.length === 0}
            className="bg-primary hover:bg-primary/90"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                저장 중...
              </>
            ) : (
              <>
                <SaveIcon className="h-4 w-4 mr-2" />
                저장 & 임베딩
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="flex-shrink-0 p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center justify-between">
            <p className="text-red-800">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setError(null)}
            >
              닫기
            </Button>
          </div>
        </div>
      )}

      {/* 메인 3-Panel 영역 */}
      <div className="flex-1 flex">
        {/* 왼쪽 패널: 청킹 규칙 및 설정 */}
        <div className="w-80 bg-muted/30 border-r flex flex-col h-full">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-4 pb-6 space-y-6">
            
            <Tabs value={currentMode} onValueChange={(value) => setCurrentMode(value as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="rules">규칙</TabsTrigger>
                <TabsTrigger value="chunks">청크</TabsTrigger>
                <TabsTrigger value="preview">미리보기</TabsTrigger>
              </TabsList>

              {/* 청킹 규칙 설정 탭 */}
              <TabsContent value="rules" className="space-y-4">
                <Card className="min-h-[calc(100vh-240px)]">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <SlidersIcon className="h-4 w-4" />
                        청킹 규칙
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setShowSaveDialog(true)}
                          className="text-xs"
                        >
                          <SaveIcon className="h-3 w-3 mr-1" />
                          저장
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setShowLoadDialog(true)}
                          className="text-xs"
                        >
                          <EyeIcon className="h-3 w-3 mr-1" />
                          불러오기
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar">
                    {/* 문장 분할 방법 선택 */}
                    <div>
                      <Label className="text-sm font-medium">문장 분할 방법</Label>
                      <Select 
                        value={chunkingRules.sentence_splitter}
                        onValueChange={(value: SentenceSplitterMethod) => 
                          setChunkingRules(prev => ({...prev, sentence_splitter: value}))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kss">KSS (Korean Sentence Splitter)</SelectItem>
                          <SelectItem value="kiwi">Kiwi (형태소 분석기)</SelectItem>
                          <SelectItem value="regex">정규식 기반</SelectItem>
                          <SelectItem value="recursive">Recursive Character Text Splitter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 공통 규칙 */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">공통 규칙</h4>
                      
                      <div>
                        <Label className="text-xs">최대 토큰: {chunkingRules.max_tokens}</Label>
                        <Slider
                          value={[chunkingRules.max_tokens]}
                          onValueChange={([value]) => setChunkingRules(prev => ({...prev, max_tokens: value}))}
                          min={200}
                          max={2000}
                          step={50}
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs">최소 토큰: {chunkingRules.min_tokens}</Label>
                        <Slider
                          value={[chunkingRules.min_tokens]}
                          onValueChange={([value]) => setChunkingRules(prev => ({...prev, min_tokens: value}))}
                          min={50}
                          max={500}
                          step={25}
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs">오버랩 토큰: {chunkingRules.overlap_tokens}</Label>
                        <Slider
                          value={[chunkingRules.overlap_tokens]}
                          onValueChange={([value]) => setChunkingRules(prev => ({...prev, overlap_tokens: value}))}
                          min={0}
                          max={200}
                          step={10}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* 공통 옵션 */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">공통 옵션</h4>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          checked={chunkingRules.respect_headings}
                          onCheckedChange={(checked) => setChunkingRules(prev => ({...prev, respect_headings: !!checked}))}
                        />
                        <Label className="text-sm">헤딩 경계 존중</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          checked={chunkingRules.preserve_tables}
                          onCheckedChange={(checked) => setChunkingRules(prev => ({...prev, preserve_tables: !!checked}))}
                        />
                        <Label className="text-sm">표 구조 보존</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          checked={chunkingRules.preserve_lists}
                          onCheckedChange={(checked) => setChunkingRules(prev => ({...prev, preserve_lists: !!checked}))}
                        />
                        <Label className="text-sm">목록 구조 보존</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          checked={chunkingRules.drop_short_chunks}
                          onCheckedChange={(checked) => setChunkingRules(prev => ({...prev, drop_short_chunks: !!checked}))}
                        />
                        <Label className="text-sm">짧은 청크 제거</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          checked={chunkingRules.snap_to_sentence}
                          onCheckedChange={(checked) => setChunkingRules(prev => ({...prev, snap_to_sentence: !!checked}))}
                        />
                        <Label className="text-sm">문장 경계 스냅</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          checked={chunkingRules.use_hierarchical}
                          onCheckedChange={(checked) => setChunkingRules(prev => ({...prev, use_hierarchical: !!checked}))}
                        />
                        <Label className="text-sm">계층적 청킹 사용</Label>
                      </div>
                    </div>

                    {/* 고급 설정 */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">고급 설정</h4>
                      
                      <div>
                        <Label className="text-xs">강제 문장 분절 토큰: {chunkingRules.hard_sentence_max_tokens}</Label>
                        <Slider
                          value={[chunkingRules.hard_sentence_max_tokens]}
                          onValueChange={([value]) => setChunkingRules(prev => ({...prev, hard_sentence_max_tokens: value}))}
                          min={500}
                          max={2000}
                          step={100}
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs">규칙 버전</Label>
                        <Input
                          value={chunkingRules.version}
                          onChange={(e) => setChunkingRules(prev => ({...prev, version: e.target.value}))}
                          placeholder="버전 정보 (예: 2.0)"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* 방법별 전용 옵션 */}
                    {chunkingRules.sentence_splitter === 'kss' && (
                      <div className="space-y-3 border-t pt-3">
                        <h4 className="text-sm font-medium text-muted-foreground">KSS 전용 옵션</h4>
                        
                        <div>
                          <Label className="text-sm font-medium">백엔드 선택</Label>
                          <Select 
                            value={chunkingRules.kss_options.backend}
                            onValueChange={(value: 'fast' | 'mecab' | 'pecab' | 'punct') => 
                              setChunkingRules(prev => ({
                                ...prev, 
                                kss_options: {...prev.kss_options, backend: value}
                              }))
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="punct">구두점 (기본, 안정적)</SelectItem>
                              <SelectItem value="fast">빠름</SelectItem>
                              <SelectItem value="mecab">MeCab (권장)</SelectItem>
                              <SelectItem value="pecab">PeCab (overflow 주의)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs">워커 수: {chunkingRules.kss_options.num_workers}</Label>
                          <Slider
                            value={[chunkingRules.kss_options.num_workers]}
                            onValueChange={([value]) => setChunkingRules(prev => ({
                              ...prev, 
                              kss_options: {...prev.kss_options, num_workers: value}
                            }))}
                            min={1}
                            max={8}
                            step={1}
                            className="mt-1"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={chunkingRules.kss_options.strip}
                            onCheckedChange={(checked) => setChunkingRules(prev => ({
                              ...prev, 
                              kss_options: {...prev.kss_options, strip: !!checked}
                            }))}
                          />
                          <Label className="text-sm">공백 제거</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={chunkingRules.kss_options.return_morphemes}
                            onCheckedChange={(checked) => setChunkingRules(prev => ({
                              ...prev, 
                              kss_options: {...prev.kss_options, return_morphemes: !!checked}
                            }))}
                          />
                          <Label className="text-sm">형태소 반환</Label>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">무시 문자열</Label>
                          <Input
                            value={chunkingRules.kss_options.ignores.join(', ')}
                            onChange={(e) => {
                              const ignores = e.target.value.split(',').map(s => s.trim()).filter(s => s)
                              setChunkingRules(prev => ({
                                ...prev,
                                kss_options: {...prev.kss_options, ignores}
                              }))
                            }}
                            placeholder="쌍표로 구분 (예: Dr., Mr., 등)"
                            className="mt-1"
                          />
                        </div>

                      </div>
                    )}

                    {chunkingRules.sentence_splitter === 'kiwi' && (
                      <div className="space-y-3 border-t pt-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Kiwi 전용 옵션</h4>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={chunkingRules.kiwi_options.integrate_allomorph}
                            onCheckedChange={(checked) => setChunkingRules(prev => ({
                              ...prev, 
                              kiwi_options: {...prev.kiwi_options, integrate_allomorph: !!checked}
                            }))}
                          />
                          <Label className="text-sm">이형태 통합</Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={chunkingRules.kiwi_options.load_default_dict}
                            onCheckedChange={(checked) => setChunkingRules(prev => ({
                              ...prev, 
                              kiwi_options: {...prev.kiwi_options, load_default_dict: !!checked}
                            }))}
                          />
                          <Label className="text-sm">기본 사전 로드</Label>
                        </div>

                        <div>
                          <Label className="text-xs">미등록어 길이: {chunkingRules.kiwi_options.max_unk_form_len}</Label>
                          <Slider
                            value={[chunkingRules.kiwi_options.max_unk_form_len]}
                            onValueChange={([value]) => setChunkingRules(prev => ({
                              ...prev, 
                              kiwi_options: {...prev.kiwi_options, max_unk_form_len: value}
                            }))}
                            min={1}
                            max={20}
                            step={1}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}

                    {chunkingRules.sentence_splitter === 'regex' && (
                      <div className="space-y-3 border-t pt-3">
                        <h4 className="text-sm font-medium text-muted-foreground">정규식 전용 옵션</h4>
                        
                        <div>
                          <Label className="text-sm font-medium">문장 종료 패턴</Label>
                          <Input
                            value={chunkingRules.regex_options.sentence_endings}
                            onChange={(e) => setChunkingRules(prev => ({
                              ...prev, 
                              regex_options: {...prev.regex_options, sentence_endings: e.target.value}
                            }))}
                            placeholder="[.!?]"
                            className="mt-1 font-mono text-xs"
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={chunkingRules.regex_options.preserve_abbreviations}
                            onCheckedChange={(checked) => setChunkingRules(prev => ({
                              ...prev, 
                              regex_options: {...prev.regex_options, preserve_abbreviations: !!checked}
                            }))}
                          />
                          <Label className="text-sm">줄임말 보존</Label>
                        </div>
                      </div>
                    )}

                    {chunkingRules.sentence_splitter === 'recursive' && (
                      <div className="space-y-3 border-t pt-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Recursive 전용 옵션</h4>
                        
                        <div>
                          <Label className="text-sm font-medium">구분자 (우선순위 순)</Label>
                          <div className="mt-1 space-y-1">
                            {chunkingRules.recursive_options.separators.map((sep, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Input
                                  value={sep === '\n\n' ? '\\n\\n' : sep === '\n' ? '\\n' : sep}
                                  onChange={(e) => {
                                    const newSeparators = [...chunkingRules.recursive_options.separators];
                                    let value = e.target.value;
                                    if (value === '\\n\\n') value = '\n\n';
                                    else if (value === '\\n') value = '\n';
                                    newSeparators[index] = value;
                                    setChunkingRules(prev => ({
                                      ...prev, 
                                      recursive_options: {...prev.recursive_options, separators: newSeparators}
                                    }));
                                  }}
                                  placeholder={`구분자 ${index + 1}`}
                                  className="font-mono text-xs flex-1"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={chunkingRules.recursive_options.keep_separator}
                            onCheckedChange={(checked) => setChunkingRules(prev => ({
                              ...prev, 
                              recursive_options: {...prev.recursive_options, keep_separator: !!checked}
                            }))}
                          />
                          <Label className="text-sm">구분자 유지</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            checked={chunkingRules.recursive_options.is_separator_regex}
                            onCheckedChange={(checked) => setChunkingRules(prev => ({
                              ...prev, 
                              recursive_options: {...prev.recursive_options, is_separator_regex: !!checked}
                            }))}
                          />
                          <Label className="text-sm">정규식 구분자</Label>
                        </div>
                      </div>
                    )}

                  </CardContent>
                </Card>
              </TabsContent>

              {/* 청크 목록 탭 */}
              <TabsContent value="chunks" className="space-y-4">
                <Card className="min-h-[calc(100vh-240px)]">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      청크 목록
                      <Badge variant="outline">{editingChunks.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editingChunks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">먼저 자동 청킹 제안을 실행하세요</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar">
                        {editingChunks.map((chunk) => (
                          <div 
                            key={chunk.chunk_id}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedChunk?.chunk_id === chunk.chunk_id 
                                ? 'border-primary bg-primary/5' 
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => setSelectedChunk(chunk)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  #{chunk.order}
                                </Badge>
                                {chunk.quality_warnings.length > 0 && (
                                  <Badge variant="destructive" className="text-xs px-1 py-0">
                                    {chunk.quality_warnings.length}개 경고
                                  </Badge>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {chunk.token_estimate} 토큰
                              </Badge>
                            </div>
                            <p className="text-sm font-medium line-clamp-2">
                              {chunk.text.substring(0, 100)}
                              {chunk.text.length > 100 && '...'}
                            </p>
                            {chunk.quality_warnings.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-muted-foreground">
                                  {chunk.quality_warnings.slice(0, 2).map((w, i) => (
                                    <span key={i} className="block">• {w.message.substring(0, 50)}...</span>
                                  ))}
                                  {chunk.quality_warnings.length > 2 && (
                                    <span className="text-primary">+{chunk.quality_warnings.length - 2}개 더...</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 미리보기 탭 */}
              <TabsContent value="preview" className="space-y-4">
                <Card className="min-h-[calc(100vh-240px)]">
                  <CardHeader>
                    <CardTitle className="text-sm">통계 정보</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statistics ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>총 청크 수:</span>
                          <span className="font-medium">{statistics.total_chunks}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>총 토큰 수:</span>
                          <span className="font-medium">{statistics.total_tokens}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>평균 토큰/청크:</span>
                          <span className="font-medium">{Math.round(statistics.average_tokens_per_chunk)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        청킹 제안을 실행하면 통계가 표시됩니다.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            </div>
          </div>
        </div>

        {/* 중앙 패널: 문서 뷰어 */}
        <div className="flex-1 bg-gray-50">
          <div 
            ref={documentViewerRef}
            className="h-full overflow-auto p-4 custom-scrollbar"
          >
            {fileInfo?.file_path ? (
              <div className="bg-white shadow-lg rounded-lg">
                <DocumentViewer 
                  fileInfo={fileInfo}
                  onContentLoad={(content) => {
                    // 문서 로드 완료 시 추가 작업
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <p>문서를 로딩 중입니다...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽 패널: 청크 편집 */}
        <div className="w-96 bg-muted/30 border-l flex flex-col h-full max-h-screen">
          <div 
            className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar" 
            style={{maxHeight: 'calc(100vh - 80px)'}}
          >
            {selectedChunk ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>청크 #{selectedChunk.order} 편집</span>
                    <Badge variant="outline">{selectedChunk.token_estimate} 토큰</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>청크 텍스트</Label>
                    <Textarea 
                      value={selectedChunk.text}
                      onChange={(e) => handleChunkTextEdit(selectedChunk.chunk_id, e.target.value)}
                      rows={6}
                      className="mt-2 min-h-[150px] max-h-[300px] resize-y"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const currentIndex = editingChunks.findIndex(c => c.chunk_id === selectedChunk.chunk_id)
                        if (currentIndex > 0) {
                          const prevChunk = editingChunks[currentIndex - 1]
                          handleMergeChunks([prevChunk.chunk_id, selectedChunk.chunk_id])
                        }
                      }}
                      disabled={(() => {
                        const currentIndex = editingChunks.findIndex(c => c.chunk_id === selectedChunk.chunk_id)
                        return currentIndex <= 0
                      })()}
                      className="flex-1"
                    >
                      <MergeIcon className="h-3 w-3 mr-1" />
                      이전과 병합
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const currentIndex = editingChunks.findIndex(c => c.chunk_id === selectedChunk.chunk_id)
                        if (currentIndex < editingChunks.length - 1) {
                          const nextChunk = editingChunks[currentIndex + 1]
                          handleMergeChunks([selectedChunk.chunk_id, nextChunk.chunk_id])
                        }
                      }}
                      disabled={(() => {
                        const currentIndex = editingChunks.findIndex(c => c.chunk_id === selectedChunk.chunk_id)
                        return currentIndex >= editingChunks.length - 1
                      })()}
                      className="flex-1"
                    >
                      <MergeIcon className="h-3 w-3 mr-1" />
                      다음과 병합
                    </Button>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => handleSplitChunk(selectedChunk.chunk_id)}
                    disabled={(() => {
                      // 문장이 2개 미만이면 분할 불가
                      const sentences = selectedChunk.text
                        .split(/(?<=[.!?])\s+|(?<=[。！？])\s*/)
                        .filter(s => s.trim())
                      return sentences.length < 2
                    })()}
                    className="w-full"
                  >
                    <SplitIcon className="h-4 w-4 mr-2" />
                    문장 기준 분할
                  </Button>
                  
                  {selectedChunk.quality_warnings.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-amber-700 dark:text-amber-300">품질 경고</Label>
                      <div className="mt-2 max-h-[200px] overflow-y-auto space-y-2">
                        {renderQualityWarnings(selectedChunk.quality_warnings)}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Edit3Icon className="h-8 w-8 mx-auto mb-4 opacity-50" />
                  <p>청크를 선택하면 편집할 수 있습니다</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* 청킹 미리보기 다이얼로그 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>청크 미리보기</DialogTitle>
            <DialogDescription>
              현재 편집된 청크들을 확인하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editingChunks.map((chunk) => (
              <Card key={chunk.chunk_id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="secondary">#{chunk.order}</Badge>
                    청크 {chunk.order}
                    <Badge variant="outline" className="ml-auto">
                      {chunk.token_estimate} 토큰
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{chunk.text}</p>
                  {chunk.quality_warnings.length > 0 && (
                    <div className="mt-3">
                      {renderQualityWarnings(chunk.quality_warnings)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PRD3: AI 청킹 설정 다이얼로그 */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-blue-500" />
              AI 청킹 설정
            </DialogTitle>
            <DialogDescription>
              AI 모델을 사용하여 문서의 의미와 구조를 분석해 최적의 청킹을 수행합니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* AI 제공업체 선택 */}
            <div>
              <Label>AI 제공업체</Label>
              <Select 
                value={selectedProvider} 
                onValueChange={(provider) => {
                  setSelectedProvider(provider)
                  // 제공업체 변경 시 첫 번째 프로필 자동 선택
                  const providerData = aiProviders.find(p => p.name === provider)
                  if (providerData && providerData.profiles.length > 0) {
                    setSelectedProfile(providerData.profiles[0].id)
                  } else {
                    setSelectedProfile('')
                  }
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="제공업체를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    console.log('🎨 AI 제공업체 렌더링:', aiProviders)
                    return aiProviders.map((provider) => (
                      <SelectItem key={provider.name} value={provider.name}>
                        {provider.display_name}
                        {provider.fallback && ' (설정 필요)'}
                      </SelectItem>
                    ))
                  })()}
                </SelectContent>
              </Select>
            </div>

            {/* 모델 프로필 선택 */}
            <div>
              <Label>모델 프로필</Label>
              <Select 
                value={selectedProfile} 
                onValueChange={setSelectedProfile}
                disabled={!selectedProvider}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="모델 프로필을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const currentProvider = aiProviders.find(p => p.name === selectedProvider)
                    if (!currentProvider) return null
                    
                    if (currentProvider.fallback) {
                      return (
                        <SelectItem value="" disabled>
                          모델 프로필을 먼저 설정해주세요
                        </SelectItem>
                      )
                    }
                    
                    return currentProvider.profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <div className="flex items-center gap-2">
                          <span>{profile.name}</span>
                          <span className="text-xs text-muted-foreground">({profile.model})</span>
                          {profile.is_active && (
                            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1 rounded">활성</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  })()}
                </SelectContent>
              </Select>
            </div>

            {/* 멀티모달 청킹 옵션 */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">청킹 모드</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <input 
                      type="radio"
                      id="text-mode"
                      name="chunking-mode"
                      checked={!useMultimodal}
                      onChange={() => setUseMultimodal(false)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="text-mode" className="text-sm">
                      텍스트 기반 청킹
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="radio"
                      id="multimodal-mode"
                      name="chunking-mode"
                      checked={useMultimodal}
                      onChange={() => setUseMultimodal(true)}
                      disabled={!fileInfo?.file_path?.endsWith('.pdf')}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="multimodal-mode" className="text-sm">
                      멀티모달 청킹 (PDF 시각 분석)
                    </Label>
                  </div>
                  {useMultimodal && (
                    <div className="ml-6 text-xs text-muted-foreground">
                      💡 PDF 문서를 이미지로 변환하여 AI가 시각적 레이아웃을 분석합니다
                    </div>
                  )}
                  {!fileInfo?.file_path?.endsWith('.pdf') && (
                    <div className="ml-6 text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ 멀티모달 청킹은 PDF 파일에서만 사용 가능합니다
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 현재 청킹 규칙 표시 */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-sm font-medium mb-2">현재 청킹 규칙</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>최대 토큰: {chunkingRules.max_tokens}</div>
                <div>최소 토큰: {chunkingRules.min_tokens}</div>
                <div>오버랩: {chunkingRules.overlap_tokens}</div>
                <div>헤딩 존중: {chunkingRules.respect_headings ? '예' : '아니오'}</div>
                <div className="col-span-2">
                  모드: {useMultimodal ? '멀티모달 (시각+텍스트)' : '텍스트 전용'}
                </div>
              </div>
            </div>

            {/* 모델 프로필 안내 */}
            {(() => {
              const currentProvider = aiProviders.find(p => p.name === selectedProvider)
              const currentProfile = currentProvider?.profiles.find(p => p.id === selectedProfile)
              
              if (currentProvider?.fallback) {
                return (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <BrainIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <div className="font-medium text-amber-900 dark:text-amber-100">모델 프로필 설정 필요</div>
                        <div className="text-amber-700 dark:text-amber-300 mt-1">
                          AI 청킹을 사용하려면 <strong>설정 → 모델</strong>에서 {currentProvider.display_name} 모델 프로필을 먼저 등록하세요.
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }
              
              if (currentProfile) {
                return (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <BrainIcon className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <div className="font-medium text-blue-900 dark:text-blue-100">선택된 프로필</div>
                        <div className="text-blue-700 dark:text-blue-300 mt-1">
                          <strong>{currentProfile.name}</strong> - {currentProfile.model}
                          {currentProfile.is_active && ' (현재 활성 프로필)'}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }
              
              return null
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
              취소
            </Button>
            <Button 
              onClick={() => {
                setAiDialogOpen(false)
                handleAIChunking()
              }}
              disabled={!selectedProvider || !selectedProfile}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              <SparklesIcon className="h-4 w-4 mr-2" />
              AI 청킹 시작
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 설정 저장 다이얼로그 */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>청킹 규칙 설정 저장</DialogTitle>
            <DialogDescription>
              현재 청킹 규칙 설정을 저장하여 나중에 재사용할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="setting-name">설정명</Label>
              <Input
                id="setting-name"
                value={settingName}
                onChange={(e) => setSettingName(e.target.value)}
                placeholder="설정명을 입력하세요 (예: PDF용 고품질 설정)"
                className="mt-1"
              />
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">저장될 설정</div>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <div>최대 토큰: {chunkingRules.max_tokens}</div>
                <div>최소 토큰: {chunkingRules.min_tokens}</div>
                <div>오버랩: {chunkingRules.overlap_tokens}</div>
                <div>문장 분할: {chunkingRules.sentence_splitter}</div>
                <div>헤딩 존중: {chunkingRules.respect_headings ? '예' : '아니오'}</div>
                <div>계층적: {chunkingRules.use_hierarchical ? '예' : '아니오'}</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              취소
            </Button>
            <Button 
              onClick={handleSaveSettings}
              disabled={!settingName.trim() || savingSettings}
            >
              {savingSettings ? (
                <>
                  <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <SaveIcon className="h-4 w-4 mr-2" />
                  저장
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 설정 로드 다이얼로그 */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>청킹 규칙 설정 불러오기</DialogTitle>
            <DialogDescription>
              저장된 청킹 규칙 설정을 선택하여 현재 설정에 적용합니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {savedSettings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <SaveIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <div>저장된 설정이 없습니다</div>
                <div className="text-xs mt-2">먼저 설정을 저장해보세요</div>
              </div>
            ) : (
              savedSettings.map((setting) => (
                <div 
                  key={setting.name}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleLoadSetting(setting.name)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{setting.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {setting.created_at ? new Date(setting.created_at).toLocaleDateString('ko-KR') : '날짜 없음'}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost">
                      <EyeIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadDialog(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Toaster />
    </div>
  )
}
