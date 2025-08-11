'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { CalendarIcon, SearchIcon, TrashIcon, UserIcon, ClockIcon, MessageSquareIcon } from "lucide-react"
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { chatAPI, categoryAPI } from '@/lib/api'
import { convertCategoryIdsToNames, type Category } from '@/lib/utils'

interface ChatHistory {
  id: number
  session_id: string
  query: string
  response: string
  category: string | null
  relevance_score: number | null
  feedback: string | null
  user_id: string | null
  flow_id: string | null
  response_time: number | null
  created_at: string
  username: string
  email: string
}

interface ChatStats {
  total_chats: number
  today_chats: number
  week_chats: number
  active_users: number
  avg_response_time: number
  category_stats: Array<{category: string, count: number}>
  daily_stats: Array<{date: string, count: number}>
}

interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

export default function ChatHistoryPage() {
  const [history, setHistory] = useState<ChatHistory[]>([])
  const [stats, setStats] = useState<ChatStats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0
  })
  const [loading, setLoading] = useState(true)
  const [selectedHistory, setSelectedHistory] = useState<ChatHistory | null>(null)
  
  // 필터 상태
  const [filters, setFilters] = useState({
    search: '',
    user_id: '',
    start_date: '',
    end_date: ''
  })

  // 카테고리 로드
  const loadCategories = async () => {
    try {
      const data = await categoryAPI.getCategories()
      setCategories(data)
    } catch (error) {
      console.error('카테고리 로드 오류:', error)
    }
  }

  // 통계 로드
  const loadStats = async () => {
    try {
      const data = await chatAPI.getChatHistoryStats()
      setStats(data)
    } catch (error) {
      console.error('통계 로드 오류:', error)
    }
  }

  // 채팅 기록 로드
  const loadHistory = async (page: number = 1) => {
    setLoading(true)
    try {
      const params: any = {
        page,
        limit: pagination.limit
      }
      
      // 필터 파라미터 추가
      if (filters.search) params.search = filters.search
      if (filters.user_id) params.user_id = filters.user_id
      if (filters.start_date) params.start_date = filters.start_date
      if (filters.end_date) params.end_date = filters.end_date

      const data = await chatAPI.getAdminChatHistory(params)
      setHistory(data.history)
      setPagination(data.pagination)
    } catch (error) {
      console.error('채팅 기록 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 채팅 기록 삭제
  const deleteHistory = async (historyId: number) => {
    if (!confirm('이 채팅 기록을 정말 삭제하시겠습니까?')) {
      return
    }

    try {
      await chatAPI.deleteChatHistory(historyId)
      await loadHistory(pagination.page)
      await loadStats()
      alert('채팅 기록이 삭제되었습니다.')
    } catch (error) {
      console.error('채팅 기록 삭제 오류:', error)
      alert('채팅 기록 삭제 중 오류가 발생했습니다.')
    }
  }

  // 검색 실행
  const handleSearch = () => {
    loadHistory(1)
  }

  // 필터 초기화
  const clearFilters = () => {
    setFilters({
      search: '',
      user_id: '',
      start_date: '',
      end_date: ''
    })
  }

  // 초기 로드
  useEffect(() => {
    loadCategories()
    loadStats()
    loadHistory()
  }, [])

  // 필터 변경시 검색
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (filters.search !== '' || filters.user_id !== '' || filters.start_date !== '' || filters.end_date !== '') {
        loadHistory(1)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [filters])

  // 통계 카드들
  const StatCards = () => {
    if (!stats) return null

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 채팅</CardTitle>
            <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_chats}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today_chats}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 주</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.week_chats}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 사용자</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_users}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 응답시간</CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avg_response_time}s</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">채팅 기록 관리</h1>
        <p className="text-muted-foreground">사용자들의 채팅 기록을 조회하고 관리할 수 있습니다.</p>
      </div>

      {/* 통계 카드 */}
      <StatCards />

      {/* 필터 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle>필터 및 검색</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">검색</label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="질문 또는 답변 검색..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">사용자 ID</label>
              <Input
                placeholder="사용자 ID"
                value={filters.user_id}
                onChange={(e) => setFilters(prev => ({ ...prev, user_id: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">시작 날짜</label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">종료 날짜</label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch}>검색</Button>
            <Button variant="outline" onClick={clearFilters}>필터 초기화</Button>
          </div>
        </CardContent>
      </Card>

      {/* 채팅 기록 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>채팅 기록 ({pagination.total}개)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="text-muted-foreground">로딩 중...</div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>날짜</TableHead>
                    <TableHead>사용자</TableHead>
                    <TableHead>질문</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead>응답시간</TableHead>
                    <TableHead>점수</TableHead>
                    <TableHead>작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {format(new Date(item.created_at), 'MM/dd HH:mm', { locale: ko })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{item.username}</span>
                          {item.email && <span className="text-xs text-muted-foreground">{item.email}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div 
                          className="truncate cursor-pointer hover:text-primary"
                          onClick={() => setSelectedHistory(item)}
                          title={item.query}
                        >
                          {item.query}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.category && (
                          <Badge variant="secondary">
                            {convertCategoryIdsToNames(item.category, categories) || item.category}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.response_time && `${Number(item.response_time).toFixed(1)}s`}
                      </TableCell>
                      <TableCell>
                        {item.relevance_score && (
                          <Badge variant={item.relevance_score > 0.7 ? "default" : "secondary"}>
                            {(item.relevance_score * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteHistory(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 페이지네이션 */}
              {pagination.total_pages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => loadHistory(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    이전
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                      const page = i + Math.max(1, pagination.page - 2)
                      if (page > pagination.total_pages) return null
                      
                      return (
                        <Button
                          key={page}
                          variant={page === pagination.page ? "default" : "outline"}
                          size="sm"
                          onClick={() => loadHistory(page)}
                        >
                          {page}
                        </Button>
                      )
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => loadHistory(pagination.page + 1)}
                    disabled={pagination.page >= pagination.total_pages}
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 채팅 상세 모달 */}
      {selectedHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl max-h-[80vh] overflow-y-auto w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">채팅 상세 정보</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedHistory(null)}
              >
                닫기
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">사용자</label>
                  <div className="text-sm">{selectedHistory.username} ({selectedHistory.email})</div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">날짜</label>
                  <div className="text-sm">
                    {format(new Date(selectedHistory.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">세션 ID</label>
                  <div className="text-sm font-mono">{selectedHistory.session_id}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">응답 시간</label>
                  <div className="text-sm">{Number(selectedHistory.response_time).toFixed(1)}초</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">사용자 질문</label>
                <Textarea
                  value={selectedHistory.query}
                  readOnly
                  className="min-h-[100px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">AI 응답</label>
                <Textarea
                  value={selectedHistory.response}
                  readOnly
                  className="min-h-[200px]"
                />
              </div>

              {selectedHistory.category && (
                <div>
                  <label className="block text-sm font-medium mb-1">카테고리</label>
                  <Badge>
                    {convertCategoryIdsToNames(selectedHistory.category, categories) || selectedHistory.category}
                  </Badge>
                </div>
              )}

              {selectedHistory.relevance_score && (
                <div>
                  <label className="block text-sm font-medium mb-1">관련성 점수</label>
                  <Badge variant={selectedHistory.relevance_score > 0.7 ? "default" : "secondary"}>
                    {(selectedHistory.relevance_score * 100).toFixed(1)}%
                  </Badge>
                </div>
              )}

              {selectedHistory.feedback && (
                <div>
                  <label className="block text-sm font-medium mb-2">피드백</label>
                  <div className="text-sm p-2 bg-gray-50 rounded">{selectedHistory.feedback}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}