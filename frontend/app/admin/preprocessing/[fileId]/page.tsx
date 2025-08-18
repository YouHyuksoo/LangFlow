'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeftIcon,
  SaveIcon,
  EyeIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RotateCcwIcon,
  MousePointerIcon,
  SquareIcon,
  TagIcon,
  LinkIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { preprocessingAPI } from '@/lib/api'
import DocumentViewer from '@/components/document-viewer'

interface Annotation {
  id?: string
  temp_id: string
  order: number
  label: string
  type: string
  coordinates: {
    x: number
    y: number
    width: number
    height: number
  }
  ocr_text?: string
  extracted_text?: string
  processing_options?: object
}

interface AnnotationType {
  value: string
  label: string
  description: string
}

interface PreviewChunk {
  chunk_id: number
  order: number
  label: string
  type: string
  text: string
  coordinates: object
  estimated_tokens: number
}

export default function PreprocessingEditorPage() {
  const params = useParams()
  const router = useRouter()
  const fileId = params.fileId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<any>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [annotationTypes, setAnnotationTypes] = useState<AnnotationType[]>([])
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingStart, setDrawingStart] = useState<{x: number, y: number} | null>(null)
  const [currentDrawing, setCurrentDrawing] = useState<{x: number, y: number, width: number, height: number} | null>(null)
  const [currentTool, setCurrentTool] = useState<'select' | 'draw'>('select')
  const [zoom, setZoom] = useState(1)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewChunk[]>([])
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null)
  
  // 문서 뷰어 스크롤 추적용 ref
  const documentViewerRef = useRef<HTMLDivElement>(null)
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 })

  // 스크롤 상태 업데이트 함수
  const updateScrollOffset = () => {
    if (documentViewerRef.current) {
      setScrollOffset({
        x: documentViewerRef.current.scrollLeft,
        y: documentViewerRef.current.scrollTop
      })
    }
  }

  // 스크롤 이벤트 리스너 등록
  useEffect(() => {
    const viewerElement = documentViewerRef.current
    if (viewerElement) {
      viewerElement.addEventListener('scroll', updateScrollOffset)
      return () => viewerElement.removeEventListener('scroll', updateScrollOffset)
    }
  }, [fileInfo])


  // 초기 데이터 로드
  useEffect(() => {
    loadEditorData()
  }, [fileId])

  const loadEditorData = async () => {
    try {
      setLoading(true)
      setError(null)


      // 주석 타입과 파일 정보를 API를 통해 로드
      const [annotationTypesResponse] = await Promise.all([
        preprocessingAPI.getAnnotationTypes()
      ])

      if (annotationTypesResponse.success) {
        setAnnotationTypes(annotationTypesResponse.data || [])
      }

      // 파일 정보를 별도로 조회 (에러 처리 개선)
      try {
        
        const fileInfoResponse = await fetch(`http://localhost:8000/api/v1/files/${fileId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        })


        if (!fileInfoResponse.ok) {
          throw new Error(`파일 정보 API 오류: ${fileInfoResponse.status} ${fileInfoResponse.statusText}`)
        }

        const fileData = await fileInfoResponse.json()

        // API 응답 구조 확인
        if (fileData.success && fileData.data) {
          // 성공적인 API 응답
          const file = fileData.data
          setFileInfo({
            file_id: fileId,
            filename: file.filename,
            file_size: file.file_size,
            category_name: file.category_name || '미분류',
            file_path: file.file_path
          })
        } else if (fileData.file_id) {
          // 직접적인 파일 정보 응답
          setFileInfo({
            file_id: fileId,
            filename: fileData.filename,
            file_size: fileData.file_size,
            category_name: fileData.category_name || '미분류',
            file_path: fileData.file_path
          })
        } else {
          throw new Error('파일 정보 응답 구조가 예상과 다름')
        }

      } catch (fileInfoError: any) {
        console.error('📋 파일 정보 조회 실패:', fileInfoError)
        
        // 실패 시 기본값 설정
        setFileInfo({
          file_id: fileId,
          filename: '파일 정보 로드 실패',
          file_size: 0,
          category_name: '미분류',
          file_path: null
        })
        
        // 에러 상태 설정
        setError(`파일 정보 로드 실패: ${fileInfoError.message}`)
      }

      // 기존 전처리 데이터 조회 (있다면)
      try {
        const preprocessingDataResponse = await preprocessingAPI.getPreprocessingMetadata(fileId)
        if (preprocessingDataResponse.success && preprocessingDataResponse.data) {
          const data = preprocessingDataResponse.data
          if (data.annotations && data.annotations.length > 0) {
            setAnnotations(data.annotations.map((ann: any) => ({
              id: ann.id,
              temp_id: `existing_${ann.id}`,
              order: ann.order,
              label: ann.label,
              type: ann.type,
              coordinates: ann.coordinates,
              ocr_text: ann.ocr_text,
              extracted_text: ann.extracted_text,
              processing_options: ann.processing_options
            })))
          }
        }
      } catch (preprocessingErr) {
      }

    } catch (err: any) {
      setError(err.message || '에디터 데이터 로드 중 오류가 발생했습니다.')
      console.error('에디터 데이터 로드 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  // 주석 추가
  const addAnnotation = (coordinates: {x: number, y: number, width: number, height: number}) => {
    const newAnnotation: Annotation = {
      temp_id: `temp_${Date.now()}`,
      order: annotations.length + 1,
      label: `영역 ${annotations.length + 1}`,
      type: 'paragraph',
      coordinates,
      extracted_text: ''
    }
    setAnnotations([...annotations, newAnnotation])
    setEditingAnnotation(newAnnotation)
  }

  // 주석 수정
  const updateAnnotation = (tempId: string, updates: Partial<Annotation>) => {
    setAnnotations(prev => 
      prev.map(ann => 
        ann.temp_id === tempId ? { ...ann, ...updates } : ann
      )
    )
    if (editingAnnotation?.temp_id === tempId) {
      setEditingAnnotation(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  // 주석 삭제
  const deleteAnnotation = (tempId: string) => {
    setAnnotations(prev => prev.filter(ann => ann.temp_id !== tempId))
    if (editingAnnotation?.temp_id === tempId) {
      setEditingAnnotation(null)
    }
  }

  // 청킹 미리보기
  const handlePreview = async () => {
    try {
      if (annotations.length === 0) {
        setError('미리보기할 주석이 없습니다.')
        return
      }

      const response = await preprocessingAPI.simulateChunking({
        file_id: fileId,
        annotations: annotations.map(ann => ({
          order: ann.order,
          label: ann.label,
          type: ann.type,
          coordinates: ann.coordinates,
          ocr_text: ann.ocr_text,
          extracted_text: ann.extracted_text
        }))
      })

      if (response.success) {
        setPreviewData(response.data.chunks || [])
        setPreviewOpen(true)
      } else {
        throw new Error(response.message || '미리보기 생성 실패')
      }
    } catch (err: any) {
      setError(err.message || '미리보기 중 오류가 발생했습니다.')
      console.error('미리보기 실패:', err)
    }
  }

  // 저장
  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      if (annotations.length === 0) {
        setError('저장할 주석이 없습니다.')
        return
      }

      const response = await preprocessingAPI.savePreprocessingMetadata(fileId, {
        annotations: annotations.map(ann => ({
          order: ann.order,
          label: ann.label,
          type: ann.type,
          coordinates: ann.coordinates,
          ocr_text: ann.ocr_text,
          extracted_text: ann.extracted_text,
          processing_options: ann.processing_options,
          temp_id: ann.temp_id
        }))
      })

      if (response.success) {
        router.push('/admin/preprocessing') // 대시보드로 돌아가기
      } else {
        throw new Error(response.message || '저장 실패')
      }
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.')
      console.error('저장 실패:', err)
    } finally {
      setSaving(false)
    }
  }

  // 스크롤 오프셋을 고려한 올바른 좌표 계산 로직 구현
  // 마우스 이벤트 핸들러 (영역 선택용) - 스크롤 오프셋 반영
  const handleMouseDown = (e: React.MouseEvent) => {
    if (currentTool !== 'draw') return
    
    // 현재 스크롤 상태 즉시 업데이트
    updateScrollOffset()
    
    const rect = e.currentTarget.getBoundingClientRect()
    // 스크롤 오프셋을 반영한 실제 문서 내 좌표 계산
    const x = (e.clientX - rect.left + scrollOffset.x) / zoom
    const y = (e.clientY - rect.top + scrollOffset.y) / zoom
    
    
    setIsDrawing(true)
    setDrawingStart({x, y})
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawingStart || currentTool !== 'draw') return
    
    const rect = e.currentTarget.getBoundingClientRect()
    // 스크롤 오프셋을 반영한 실제 문서 내 좌표 계산
    const x = (e.clientX - rect.left + scrollOffset.x) / zoom
    const y = (e.clientY - rect.top + scrollOffset.y) / zoom
    
    // 현재 드래그 영역 업데이트 (문서 기준 절대 좌표)
    setCurrentDrawing({
      x: Math.min(drawingStart.x, x),
      y: Math.min(drawingStart.y, y),
      width: Math.abs(x - drawingStart.x),
      height: Math.abs(y - drawingStart.y)
    })
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !drawingStart || currentTool !== 'draw') return
    
    const rect = e.currentTarget.getBoundingClientRect()
    // 스크롤 오프셋을 반영한 실제 문서 내 좌표 계산
    const x = (e.clientX - rect.left + scrollOffset.x) / zoom
    const y = (e.clientY - rect.top + scrollOffset.y) / zoom
    
    const width = Math.abs(x - drawingStart.x)
    const height = Math.abs(y - drawingStart.y)
    
    
    if (width > 10 && height > 10) { // 최소 크기 확인
      // 문서 기준 절대 좌표로 주석 추가
      addAnnotation({
        x: Math.min(drawingStart.x, x),
        y: Math.min(drawingStart.y, y),
        width,
        height
      })
    }
    
    setIsDrawing(false)
    setDrawingStart(null)
    setCurrentDrawing(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">에디터를 로드하는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 왼쪽 사이드 메뉴 - position: fixed로 완전 고정 */}
      <div 
        className="fixed left-0 top-0 bottom-0 w-80 bg-muted/30 border-r"
        style={{ 
          height: '100vh',
          zIndex: 9999,
          position: 'fixed'
        }}
      >
        <div className="p-4 h-full">
          <div className="space-y-6">
              {/* 도구 선택 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">도구</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant={currentTool === 'select' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentTool('select')}
                    >
                      <MousePointerIcon className="h-4 w-4 mr-2" />
                      선택
                    </Button>
                    <Button
                      variant={currentTool === 'draw' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentTool('draw')}
                    >
                      <SquareIcon className="h-4 w-4 mr-2" />
                      영역 그리기
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
                    >
                      <ZoomOutIcon className="h-4 w-4" />
                    </Button>
                    <span className="px-2 py-1 text-sm bg-background border rounded">
                      {Math.round(zoom * 100)}%
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                    >
                      <ZoomInIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(1)}
                    >
                      <RotateCcwIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 주석 목록 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    주석 목록 ({annotations.length})
                    <Badge variant="outline">{annotations.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {annotations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      영역을 그려서 주석을 추가하세요
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {annotations.map((annotation) => (
                        <div 
                          key={annotation.temp_id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedAnnotation?.temp_id === annotation.temp_id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedAnnotation(annotation)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {annotation.order}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteAnnotation(annotation.temp_id)
                              }}
                            >
                              <TrashIcon className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                          <p className="text-sm font-medium">{annotation.label}</p>
                          <p className="text-xs text-muted-foreground">{annotation.type}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 주석 편집 */}
              {editingAnnotation && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">주석 편집</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="annotation-label">레이블</Label>
                      <Input
                        id="annotation-label"
                        value={editingAnnotation.label}
                        onChange={(e) => updateAnnotation(editingAnnotation.temp_id, { label: e.target.value })}
                        placeholder="영역 이름을 입력하세요"
                      />
                    </div>
                    <div>
                      <Label htmlFor="annotation-type">타입</Label>
                      <Select 
                        value={editingAnnotation.type} 
                        onValueChange={(value) => updateAnnotation(editingAnnotation.temp_id, { type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="타입을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {annotationTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="annotation-order">순서</Label>
                      <Input
                        id="annotation-order"
                        type="number"
                        value={editingAnnotation.order}
                        onChange={(e) => updateAnnotation(editingAnnotation.temp_id, { order: parseInt(e.target.value) || 1 })}
                        min="1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="annotation-text">추출된 텍스트</Label>
                      <Textarea
                        id="annotation-text"
                        value={editingAnnotation.extracted_text || ''}
                        onChange={(e) => updateAnnotation(editingAnnotation.temp_id, { extracted_text: e.target.value })}
                        placeholder="이 영역에서 추출할 텍스트를 입력하세요"
                        rows={4}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingAnnotation(null)}
                      className="w-full"
                    >
                      편집 완료
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      
      {/* 메인 영역 */}
      <div className="h-screen" style={{ marginLeft: '320px' }}>
          {/* 네비게이션 바 - 고정 */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-background">
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
                  수동 전처리 에디터 - 영역을 선택하고 순서를 지정하세요
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                disabled={annotations.length === 0}
              >
                <EyeIcon className="h-4 w-4 mr-2" />
                미리보기
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || annotations.length === 0}
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
                    저장
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 에러 메시지 - 고정 */}
          {error && (
            <div className="flex-shrink-0 p-4 bg-red-50 border-b border-red-200">
              <p className="text-red-800">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setError(null)}
                className="mt-2"
              >
                닫기
              </Button>
            </div>
          )}

          {/* 문서 뷰어 영역 - 문서용 스크롤 추가 */}
          <div 
            ref={documentViewerRef}
            className="bg-gray-100 p-4 overflow-auto"
            style={{ height: 'calc(100vh - 120px)' }}
            onScroll={updateScrollOffset}
          >
          <div 
            className="relative bg-white shadow-lg mx-auto"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              width: '210mm', // A4 크기
              minHeight: '297mm',
              cursor: currentTool === 'draw' ? 'crosshair' : 'default'
            }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
          >
            {/* 실제 문서 표시 영역 */}
            {fileInfo?.file_path ? (
              <DocumentViewer 
                fileInfo={fileInfo}
                currentTool={currentTool}
                onContentLoad={(content) => {
                }}
              />
            ) : (
              /* 파일 정보가 없는 경우 */
              <div className="p-8 text-gray-600">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold mb-4">문서 로드 중...</h1>
                  <p>파일 정보를 불러오고 있습니다.</p>
                  <p className="text-sm mt-2">영역 그리기 도구를 사용해서 텍스트 영역을 선택하세요.</p>
                </div>
              </div>
            )}

            {/* 현재 드래그 중인 영역 (임시) - 스크롤과 무관한 문서 기준 좌표 */}
            {currentDrawing && (
              <div
                className="absolute border-2 border-dashed border-red-400 bg-red-400/10"
                style={{
                  left: currentDrawing.x - scrollOffset.x / zoom,
                  top: currentDrawing.y - scrollOffset.y / zoom,
                  width: currentDrawing.width,
                  height: currentDrawing.height,
                  pointerEvents: 'none'
                }}
              />
            )}

            {/* 주석 오버레이 - 스크롤과 무관한 문서 기준 좌표 */}
            {annotations.map((annotation) => (
              <div
                key={annotation.temp_id}
                className={`absolute border-2 border-dashed bg-blue-500/10 cursor-pointer transition-colors ${
                  selectedAnnotation?.temp_id === annotation.temp_id 
                    ? 'border-blue-500 bg-blue-500/20' 
                    : 'border-blue-300 hover:border-blue-500'
                }`}
                style={{
                  left: annotation.coordinates.x - scrollOffset.x / zoom,
                  top: annotation.coordinates.y - scrollOffset.y / zoom,
                  width: annotation.coordinates.width,
                  height: annotation.coordinates.height
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedAnnotation(annotation)
                  setEditingAnnotation(annotation)
                }}
              >
                <div className="absolute -top-6 left-0 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                  {annotation.order}. {annotation.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    
      {/* 미리보기 다이얼로그 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>청킹 미리보기</DialogTitle>
            <DialogDescription>
              현재 설정으로 생성될 청크들을 확인하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {previewData.map((chunk) => (
              <Card key={chunk.chunk_id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="secondary">{chunk.order}</Badge>
                    {chunk.label} ({chunk.type})
                    <Badge variant="outline" className="ml-auto">
                      ~{Math.round(chunk.estimated_tokens)} 토큰
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{chunk.text}</p>
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
    </div>
  )
}