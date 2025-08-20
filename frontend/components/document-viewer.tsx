'use client'

import { useState, useEffect } from 'react'
import { AlertCircleIcon, FileTextIcon, ImageIcon, TableIcon } from 'lucide-react'


// PDF 뷰어 컴포넌트 - 이미지로 변환하여 표시
function PDFViewer({ fileInfo, content, currentTool }: { fileInfo: FileInfo, content: DocumentContent, currentTool: 'select' | 'draw' }) {
  const [pdfImageUrl, setPdfImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // PDF를 이미지로 변환하는 API 호출
    const convertPdfToImage = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // 현재는 PDF 이미지 변환 API가 없으므로 바로 fallback 사용 (조용히 처리)
        console.log('PDF 이미지 변환 API 준비 중 - 기본 뷰어 사용')
        setError(null) // 오류 메시지 없이 기본 뷰어 사용
        
        // TODO: 나중에 PDF 이미지 변환 API가 준비되면 아래 코드 활성화
        // const response = await fetch(`/api/convert-pdf/${fileInfo.file_id}`)
        // if (response.ok) {
        //   const blob = await response.blob()
        //   const imageUrl = URL.createObjectURL(blob)
        //   setPdfImageUrl(imageUrl)
        // } else {
        //   console.warn('PDF 이미지 변환 실패, 기본 뷰어 사용')
        //   setError('PDF 이미지 변환을 사용할 수 없어 기본 뷰어를 사용합니다.')
        // }
      } catch (err) {
        console.log('PDF 이미지 변환 기능 비활성화 - 기본 뷰어 사용:', err instanceof Error ? err.message : String(err))
        setError(null) // 오류 메시지 표시하지 않음
      } finally {
        setLoading(false)
      }
    }

    convertPdfToImage()

    // cleanup
    return () => {
      if (pdfImageUrl) {
        URL.revokeObjectURL(pdfImageUrl)
      }
    }
  }, [fileInfo.file_id])

  return (
    <div>
      <div>
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : pdfImageUrl ? (
          /* PDF 이미지 표시 */
          <div className="relative bg-white rounded-lg shadow-inner p-4">
            <img 
              src={pdfImageUrl}
              alt={content.filename}
              className="w-full h-auto mx-auto shadow-lg"
              style={{ 
                maxHeight: '800px',
                objectFit: 'contain'
              }}
            />
          </div>
        ) : (
          /* 기본 PDF 뷰어 (fallback) - 마우스 이벤트 차단 오버레이 포함 */
          <div className="relative bg-white overflow-hidden">
            <div className="relative w-full">
              <object
                data={`http://localhost:8000${content.view_url}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&view=FitH`}
                type="application/pdf"
                className="w-full"
                style={{ 
                  height: '80vh',
                  border: 'none',
                  display: 'block',
                  pointerEvents: currentTool === 'draw' ? 'none' : 'auto', // 드로우 모드에서만 이벤트 차단
                  userSelect: currentTool === 'draw' ? 'none' : 'auto'     // 드로우 모드에서만 텍스트 선택 차단
                }}
              >
                <div className="bg-red-50 border border-red-200 rounded p-4 text-center h-full flex items-center justify-center">
                  <div>
                    <p className="text-red-600 mb-4">PDF를 표시할 수 없습니다.</p>
                    <a 
                      href={`http://localhost:8000${content.view_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      새 탭에서 열기
                    </a>
                  </div>
                </div>
              </object>
              
              {/* 조건부 오버레이 - 영역 그리기 모드에서만 활성화 */}
              {currentTool === 'draw' && (
                <div 
                  className="absolute inset-0 bg-transparent cursor-crosshair"
                  style={{
                    zIndex: 10,
                    pointerEvents: 'auto'
                  }}
                  onMouseDown={(e) => {
                    console.log('🖱️ PDF 드로우 모드 - 마우스 다운 이벤트 캐치됨')
                    // 마우스 이벤트를 부모 컴포넌트로 전달
                    const parentElement = e.currentTarget.closest('[onmousedown]')
                    if (parentElement) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const syntheticEvent = {
                        ...e,
                        currentTarget: parentElement,
                        clientX: e.clientX,
                        clientY: e.clientY,
                      }
                      console.log('🖱️ 부모로 이벤트 전달:', { x: e.clientX, y: e.clientY })
                      // @ts-ignore
                      parentElement.onmousedown?.(syntheticEvent)
                    }
                  }}
                  onMouseUp={(e) => {
                    console.log('🖱️ PDF 드로우 모드 - 마우스 업 이벤트 캐치됨')
                    // 마우스 이벤트를 부모 컴포넌트로 전달
                    const parentElement = e.currentTarget.closest('[onmouseup]')
                    if (parentElement) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const syntheticEvent = {
                        ...e,
                        currentTarget: parentElement,
                        clientX: e.clientX,
                        clientY: e.clientY,
                      }
                      // @ts-ignore
                      parentElement.onmouseup?.(syntheticEvent)
                    }
                  }}
                  onMouseMove={(e) => {
                    // 마우스 이벤트를 부모 컴포넌트로 전달
                    const parentElement = e.currentTarget.closest('[onmousemove]')
                    if (parentElement) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const syntheticEvent = {
                        ...e,
                        currentTarget: parentElement,
                        clientX: e.clientX,
                        clientY: e.clientY,
                      }
                      // @ts-ignore
                      parentElement.onmousemove?.(syntheticEvent)
                    }
                  }}
                />
              )}
            </div>
          </div>
        )}
        
      </div>
    </div>
  )
}

interface FileInfo {
  file_id: string
  filename: string
  file_path: string
  file_size: number
  category_name?: string
}

interface DocumentContent {
  success: boolean
  file_type: 'text' | 'pdf' | 'image' | 'docx' | 'xlsx' | 'pptx'
  content?: string
  view_url?: string
  error?: string
  filename: string
  file_size: number
  page_count?: number
  slide_count?: number
  message?: string
}

interface DocumentViewerProps {
  fileInfo: FileInfo
  currentTool?: 'select' | 'draw'
  onContentLoad?: (content: DocumentContent | null) => void
}

export default function DocumentViewer({ fileInfo, currentTool = 'select', onContentLoad }: DocumentViewerProps) {
  const [content, setContent] = useState<DocumentContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDocumentContent()
  }, [fileInfo.file_id])

  const loadDocumentContent = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('📄 문서 내용 로드 시작 - fileId:', fileInfo.file_id)
      console.log('📄 파일 정보:', fileInfo)
      
      const filename = fileInfo.filename.toLowerCase()
      
      // 파일 확장자로 타입 결정
      let fileType: 'text' | 'pdf' | 'image' | 'docx' | 'xlsx' | 'pptx' = 'pdf'
      if (filename.endsWith('.pdf')) {
        fileType = 'pdf'
      } else if (filename.match(/\.(jpg|jpeg|png|gif|bmp)$/)) {
        fileType = 'image'
      } else if (filename.match(/\.(txt|md|html|json|xml|csv)$/)) {
        fileType = 'text'
      } else if (filename.endsWith('.docx')) {
        fileType = 'docx'
      } else if (filename.match(/\.(xlsx|xls)$/)) {
        fileType = 'xlsx'
      } else if (filename.endsWith('.pptx')) {
        fileType = 'pptx'
      }
      
      console.log('📄 감지된 파일 타입:', fileType)
      
      // 파일 타입별 API 호출
      if (['text', 'docx', 'xlsx', 'pptx'].includes(fileType)) {
        // 텍스트 추출이 가능한 파일들은 content API 사용
        try {
          const response = await fetch(`http://localhost:8000/api/v1/files/${fileInfo.file_id}/content`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          })

          if (response.ok) {
            const data = await response.json()
            console.log(`📥 ${fileType.toUpperCase()} 파일 API 응답:`, data)
            setContent(data)
            onContentLoad?.(data)
            return
          }
        } catch (contentErr) {
          console.warn(`📄 ${fileType} content API 실패, preview API로 fallback`)
        }
      }
      
      // PDF, 이미지 파일이거나 content API가 실패한 경우 preview API 사용
      const mockContent: DocumentContent = {
        success: true,
        file_type: fileType,
        view_url: `/api/v1/files/${fileInfo.file_id}/preview`,
        filename: fileInfo.filename,
        file_size: fileInfo.file_size
      }
      
      console.log('📥 생성된 모의 응답:', mockContent)
      setContent(mockContent)
      onContentLoad?.(mockContent)
      
    } catch (err: any) {
      console.error('📋 문서 내용 로드 실패:', err)
      console.error('📋 오류 세부사항:', {
        message: err.message,
        stack: err.stack
      })
      setError(err.message || '문서 내용을 불러오는데 실패했습니다.')
      onContentLoad?.(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">문서를 불러오는 중...</p>
      </div>
    )
  }

  if (error || !content) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">문서 로드 오류</h3>
          <p className="text-red-600 mb-4">{error || '알 수 없는 오류가 발생했습니다.'}</p>
          <button 
            onClick={loadDocumentContent}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  if (!content.success) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircleIcon className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">지원되지 않는 파일</h3>
          <p className="text-yellow-600 mb-4">{content.error}</p>
          <p className="text-sm text-gray-600">
            파일명: {content.filename}
          </p>
        </div>
      </div>
    )
  }

  // 파일 타입별 렌더링 - 디버깅 정보 포함
  console.log('🎨 렌더링 시작 - content:', content)
  console.log('🎨 파일 타입:', content.file_type)

  switch (content.file_type) {
    case 'text':
      return (
        <div className="p-4">
          <div className="bg-white border rounded-lg">
            <div className="bg-gray-50 border-b px-4 py-3 flex items-center gap-2">
              <FileTextIcon className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-gray-800">{content.filename}</h3>
              <span className="text-sm text-gray-500">({Math.round(content.file_size / 1024)}KB)</span>
            </div>
            <div className="p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto">
                {content.content}
              </pre>
            </div>
          </div>
        </div>
      )

    case 'pdf':
      return (
        <PDFViewer fileInfo={fileInfo} content={content} currentTool={currentTool} />
      )

    case 'image':
      return (
        <div className="p-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="text-center mb-4">
              <ImageIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">이미지 문서</h3>
              <p className="text-green-600 mb-4">{content.filename}</p>
            </div>
            
            {/* 이미지 표시 */}
            <div className="bg-white rounded-lg shadow-inner p-4 text-center">
              <img 
                src={`http://localhost:8000${content.view_url}`}
                alt={content.filename}
                className="max-w-full h-auto mx-auto rounded-lg shadow-md"
                style={{ maxHeight: '500px' }}
                onError={(e) => {
                  console.error('이미지 로드 실패:', content.view_url)
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextElementSibling?.classList.remove('hidden')
                }}
              />
              <div className="hidden bg-red-50 border border-red-200 rounded p-4 mt-4">
                <p className="text-red-600">이미지를 로드할 수 없습니다.</p>
                <p className="text-xs text-gray-500 mt-2">경로: {content.view_url}</p>
              </div>
            </div>
            
            {/* 주석 작성 안내 */}
            <div className="mt-4 text-center">
              <p className="text-sm text-green-600">
                👆 이미지 위에 영역을 그려서 텍스트 구조를 정의하세요
              </p>
            </div>
          </div>
        </div>
      )

    case 'docx':
      return (
        <div className="p-4">
          <div className="bg-white border rounded-lg">
            <div className="bg-blue-50 border-b px-4 py-3 flex items-center gap-2">
              <FileTextIcon className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-gray-800">{content.filename}</h3>
              <span className="text-sm text-gray-500">({Math.round(content.file_size / 1024)}KB)</span>
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">DOCX</span>
            </div>
            <div className="p-4">
              {content.message && (
                <div className="mb-4 text-sm text-green-600 bg-green-50 p-2 rounded">
                  {content.message}
                </div>
              )}
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto">
                {content.content}
              </pre>
            </div>
          </div>
        </div>
      )

    case 'xlsx':
      return (
        <div className="p-4">
          <div className="bg-white border rounded-lg">
            <div className="bg-green-50 border-b px-4 py-3 flex items-center gap-2">
              <TableIcon className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold text-gray-800">{content.filename}</h3>
              <span className="text-sm text-gray-500">({Math.round(content.file_size / 1024)}KB)</span>
              <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">XLSX</span>
            </div>
            <div className="p-4">
              {content.message && (
                <div className="mb-4 text-sm text-green-600 bg-green-50 p-2 rounded">
                  {content.message}
                </div>
              )}
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto">
                {content.content}
              </pre>
            </div>
          </div>
        </div>
      )

    case 'pptx':
      return (
        <div className="p-4">
          <div className="bg-white border rounded-lg">
            <div className="bg-purple-50 border-b px-4 py-3 flex items-center gap-2">
              <FileTextIcon className="h-5 w-5 text-purple-500" />
              <h3 className="font-semibold text-gray-800">{content.filename}</h3>
              <span className="text-sm text-gray-500">({Math.round(content.file_size / 1024)}KB)</span>
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">PPTX</span>
              {content.slide_count && (
                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded ml-1">
                  {content.slide_count}슬라이드
                </span>
              )}
            </div>
            <div className="p-4">
              {content.message && (
                <div className="mb-4 text-sm text-purple-600 bg-purple-50 p-2 rounded">
                  {content.message}
                </div>
              )}
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto">
                {content.content}
              </pre>
            </div>
          </div>
        </div>
      )

    default:
      return (
        <div className="p-8">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <FileTextIcon className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">알 수 없는 파일 형식</h3>
            <p className="text-gray-600">{content.filename}</p>
          </div>
        </div>
      )
  }
}