'use client'

import { useState, useEffect } from 'react'
import { AlertCircleIcon } from 'lucide-react'

interface FileInfo {
  file_id: string
  filename: string
  file_path: string
  file_size: number
  category_name?: string
}

interface DocumentContent {
  file_type: 'pdf'
  view_url: string
  filename: string
  file_size: number
}

interface DocumentViewerProps {
  fileInfo: FileInfo
  currentTool?: 'select' | 'draw'
  onContentLoad?: (content: DocumentContent | null) => void
}

function PDFViewer({ fileInfo, content, currentTool }: { fileInfo: FileInfo, content: DocumentContent, currentTool: 'select' | 'draw' }) {
  return (
    <div className="relative bg-white overflow-hidden">
      <div className="relative w-full">
        <iframe
          src={`http://localhost:8000${content.view_url}`}
          className="w-full"
          style={{ 
            height: '80vh',
            border: 'none',
            display: 'block',
            pointerEvents: currentTool === 'draw' ? 'none' : 'auto',
            userSelect: currentTool === 'draw' ? 'none' : 'auto'
          }}
        />
        {/* iframe fallback은 별도 처리 불가 */}
      </div>
    </div>
  )
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
      
      // 모든 파일을 PDF 뷰어로 처리
      const content: DocumentContent = {
        file_type: 'pdf',
        view_url: `/api/v1/files/${fileInfo.file_id}/preview`,
        filename: fileInfo.filename,
        file_size: fileInfo.file_size
      }
      
      setContent(content)
      onContentLoad?.(content)
      
    } catch (err: any) {
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

  // 모든 파일을 PDF 뷰어로 표시
  return <PDFViewer fileInfo={fileInfo} content={content} currentTool={currentTool} />
}