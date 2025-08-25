'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FileTextIcon, 
  EditIcon, 
  PlayIcon,
  CalendarIcon,
  FolderIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { preprocessingAPI } from '@/lib/api'

interface PreprocessingFile {
  file_id: string
  filename: string
  upload_time: string | null
  file_size: number
  category_name: string | null
  preprocessing_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'CHUNKED' | 'VECTORIZING' | 'COMPLETED' | 'FAILED'
  preprocessing_completed_at: string | null
  processing_time: number
}

interface PreprocessingStats {
  total_files: number
  completed_files: number
  vectorizing_files: number
  chunked_files: number
  in_progress_files: number
  not_started_files: number
  failed_files: number
  completion_rate: number
  average_processing_time: number
  status_distribution: Record<string, number>
}

export default function PreprocessingWorkspacePage() {
  const router = useRouter()
  const [files, setFiles] = useState<PreprocessingFile[]>([])
  const [stats, setStats] = useState<PreprocessingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 파일 목록 및 통계 로드
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // 파일 목록과 통계를 병렬로 조회
      const [filesResponse, statsResponse] = await Promise.all([
        preprocessingAPI.getFiles(),
        preprocessingAPI.getStats()
      ])

      if (filesResponse.success) {
        setFiles(filesResponse.data || [])
      } else {
        throw new Error(filesResponse.message || '파일 목록 조회 실패')
      }

      if (statsResponse.success) {
        setStats(statsResponse.data)
      } else {
        console.warn('통계 조회 실패:', statsResponse.message)
        // 통계는 실패해도 파일 목록은 표시
      }
    } catch (err: any) {
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.')
      console.error('데이터 로드 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 전처리 작업 시작
  const handleStartPreprocessing = async (fileId: string) => {
    try {
      console.log('🚀 전처리 시작 버튼 클릭 - fileId:', fileId)
      setError(null) // 기존 오류 메시지 클리어
      
      // API 호출 전 로그
      console.log('📡 API 호출 시작 - preprocessingAPI.startPreprocessing')
      
      const response = await preprocessingAPI.startPreprocessing(fileId)
      
      console.log('📥 API 응답 받음:', response)
      
      if (response.success) {
        console.log('✅ 전처리 작업 시작 성공:', response.data)
        
        // 전처리 작업 시작 후 바로 에디터로 이동
        console.log('🔄 에디터 페이지로 이동')
        router.push(`/admin/preprocessing/editor?fileId=${fileId}`)
      } else {
        console.error('❌ API 응답 실패:', response.message)
        throw new Error(response.message || '전처리 작업 시작 실패')
      }
    } catch (err: any) {
      console.error('💥 전처리 시작 실패:', err)
      console.error('오류 세부사항:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      })
      setError(err.response?.data?.detail || err.message || '전처리 작업 시작 중 오류가 발생했습니다.')
    }
  }

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 날짜 포맷팅
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  // 상태 배지 컴포넌트
  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusConfig = (status: string) => {
      switch (status) {
        case 'COMPLETED':
          return { label: '완료', variant: 'default' as const, icon: CheckCircleIcon, color: 'text-green-500' }
        case 'VECTORIZING':
          return { label: '벡터화 중', variant: 'secondary' as const, icon: PlayIcon, color: 'text-purple-500' }
        case 'CHUNKED':
          return { label: '청킹 완료', variant: 'secondary' as const, icon: FileTextIcon, color: 'text-blue-500' }
        case 'IN_PROGRESS':
          return { label: '전처리 중', variant: 'secondary' as const, icon: ClockIcon, color: 'text-yellow-500' }
        case 'NOT_STARTED':
          return { label: '업로드만', variant: 'outline' as const, icon: AlertCircleIcon, color: 'text-orange-500' }
        case 'FAILED':
          return { label: '실패', variant: 'destructive' as const, icon: AlertCircleIcon, color: 'text-red-500' }
        default:
          return { label: '알 수 없음', variant: 'outline' as const, icon: AlertCircleIcon, color: 'text-gray-500' }
      }
    }

    const config = getStatusConfig(status)
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {config.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">수동 전처리 워크스페이스</h1>
        <p className="text-muted-foreground mt-2">
          업로드된 파일들의 전처리 상태를 관리하고 수동 청킹 작업을 수행할 수 있습니다.
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-800">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadData}
              className="mt-2"
            >
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">전체 파일</CardTitle>
              <FileTextIcon className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.total_files}</div>
              <p className="text-xs text-muted-foreground">업로드된 파일 수</p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">완료된 작업</CardTitle>
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.completed_files}</div>
              <p className="text-xs text-muted-foreground">전처리 완료</p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">완료율</CardTitle>
              <ClockIcon className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {(stats.completion_rate * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">전처리 완료율</p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">평균 처리 시간</CardTitle>
              <AlertCircleIcon className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.average_processing_time > 0 
                  ? `${Math.round(stats.average_processing_time / 1000)}s`
                  : '-'
                }
              </div>
              <p className="text-xs text-muted-foreground">평균 소요 시간</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 파일 목록 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5 text-purple-500" />
            파일 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>파일명</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>파일 크기</TableHead>
                <TableHead>업로드 일시</TableHead>
                <TableHead>전처리 상태</TableHead>
                <TableHead>완료 일시</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.file_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileTextIcon className="h-4 w-4 text-blue-500" />
                      {file.filename}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FolderIcon className="h-3 w-3 text-orange-500" />
                      <span>{file.category_name || '미분류'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatFileSize(file.file_size)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-3 w-3 text-gray-500" />
                      <span>{formatDate(file.upload_time)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={file.preprocessing_status} />
                  </TableCell>
                  <TableCell>{formatDate(file.preprocessing_completed_at)}</TableCell>
                  <TableCell className="text-right">
                    {file.preprocessing_status === 'NOT_STARTED' ? (
                      <Button
                        size="sm"
                        onClick={() => handleStartPreprocessing(file.file_id)}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <PlayIcon className="h-3 w-3 mr-1" />
                        작업 시작
                      </Button>
                    ) : file.preprocessing_status === 'IN_PROGRESS' ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => router.push(`/admin/preprocessing/editor?fileId=${file.file_id}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <EditIcon className="h-3 w-3 mr-1" />
                        에디터 열기
                      </Button>
                    ) : file.preprocessing_status === 'CHUNKED' ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => router.push(`/admin/preprocessing/editor?fileId=${file.file_id}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <EditIcon className="h-3 w-3 mr-1" />
                        청킹 편집
                      </Button>
                    ) : file.preprocessing_status === 'VECTORIZING' ? (
                      <Badge variant="secondary" className="cursor-not-allowed">
                        벡터화 진행중
                      </Badge>
                    ) : file.preprocessing_status === 'COMPLETED' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/admin/preprocessing/editor?fileId=${file.file_id}`)}
                      >
                        <EditIcon className="h-3 w-3 mr-1" />
                        보기/수정
                      </Button>
                    ) : file.preprocessing_status === 'FAILED' ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleStartPreprocessing(file.file_id)}
                      >
                        <PlayIcon className="h-3 w-3 mr-1" />
                        재시작
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="cursor-not-allowed">
                        알 수 없는 상태
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {files.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    전처리할 파일이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}