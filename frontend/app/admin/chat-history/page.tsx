'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { CalendarIcon, SearchIcon, TrashIcon, UserIcon, ClockIcon, MessageSquareIcon, Trash2Icon, AlertTriangleIcon } from "lucide-react"
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { chatAPI, categoryAPI } from '@/lib/api'
import { convertCategoryIdsToNames, type Category } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

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
  const { toast } = useToast()
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
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  
  const [filters, setFilters] = useState({
    search: '',
    user_id: '',
    start_date: '',
    end_date: ''
  })

  const loadCategories = async () => {
    try {
      const data = await categoryAPI.getCategories()
      setCategories(data)
    } catch (error) {
      console.error('카테고리 로드 오류:', error)
    }
  }

  const loadStats = async () => {
    try {
      const data = await chatAPI.getChatHistoryStats()
      setStats(data)
    } catch (error) {
      console.error('통계 로드 오류:', error)
    }
  }

  const loadHistory = async (page: number = 1) => {
    setLoading(true)
    try {
      const params: any = { page, limit: pagination.limit, ...filters };
      const data = await chatAPI.getAdminChatHistory(params)
      setHistory(data.history)
      setPagination(data.pagination)
    } catch (error) {
      console.error('채팅 기록 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteHistory = async (historyId: number) => {
    if (!confirm('이 채팅 기록을 정말 삭제하시겠습니까?')) return;

    try {
      await chatAPI.deleteChatHistory(historyId)
      await loadHistory(pagination.page)
      await loadStats()
      toast({ title: "삭제 완료", description: "채팅 기록이 성공적으로 삭제되었습니다." })
    } catch (error: any) {
      let errorMessage = "채팅 기록 삭제 중 오류가 발생했습니다."
      if (error?.response?.status === 401) errorMessage = "로그인이 필요합니다."
      else if (error?.response?.status === 403) errorMessage = "관리자 권한이 필요합니다."
      else if (error?.response?.data?.detail) errorMessage = error.response.data.detail
      toast({ title: "삭제 실패", description: errorMessage, variant: "destructive" })
    }
  }

  const openDeleteAllModal = () => {
    setDeleteConfirmText('')
    setIsDeleteAllModalOpen(true)
  }

  const closeDeleteAllModal = () => {
    setDeleteConfirmText('')
    setIsDeleteAllModalOpen(false)
  }

  const executeDeleteAll = async () => {
    if (deleteConfirmText.trim() !== '삭제') return;

    try {
      const result = await chatAPI.deleteAllChatHistory()
      await loadHistory(1)
      await loadStats()
      setIsDeleteAllModalOpen(false)
      setDeleteConfirmText('')
      toast({ title: "전체 삭제 완료", description: `총 ${result.deleted_count || pagination.total}개의 채팅 기록이 삭제되었습니다.` })
    } catch (error: any) {
      let errorMessage = "전체 채팅 기록 삭제 중 오류가 발생했습니다."
      if (error?.response?.status === 401) errorMessage = "로그인이 필요합니다. 다시 로그인해주세요."
      else if (error?.response?.status === 403) errorMessage = "관리자 권한이 필요합니다."
      else if (error?.response?.data?.detail) errorMessage = error.response.data.detail
      toast({ title: "전체 삭제 실패", description: errorMessage, variant: "destructive" })
    }
  }

  const handleSearch = () => loadHistory(1)

  const clearFilters = () => {
    setFilters({ search: '', user_id: '', start_date: '', end_date: '' })
    loadHistory(1)
  }

  useEffect(() => {
    loadCategories()
    loadStats()
    loadHistory()
  }, [])

  const StatCards = () => {
    if (!stats) return null
    const statItems = [
      { title: "전체 채팅", value: stats.total_chats, icon: MessageSquareIcon },
      { title: "오늘", value: stats.today_chats, icon: CalendarIcon },
      { title: "이번 주", value: stats.week_chats, icon: CalendarIcon },
      { title: "활성 사용자", value: stats.active_users, icon: UserIcon },
      { title: "평균 응답시간", value: `${stats.avg_response_time}s`, icon: ClockIcon },
    ]
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {statItems.map(item => (
          <Card key={item.title} className="stat-card relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              <item.icon className={`h-4 w-4 ${
                item.icon === MessageSquareIcon ? 'text-purple-500' :
                item.icon === CalendarIcon ? 'text-orange-500' :
                item.icon === UserIcon ? 'text-orange-500' :
                item.icon === ClockIcon ? 'text-orange-500' :
                'text-muted-foreground'
              }`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">채팅 기록 관리</h1>
        <p className="text-muted-foreground">사용자들의 채팅 기록을 조회하고 관리할 수 있습니다.</p>
      </div>

      <StatCards />

      <Card>
        <CardHeader>
          <CardTitle>필터 및 검색</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Input placeholder="질문 또는 답변 검색..." value={filters.search} onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))} />
            <Input placeholder="사용자 ID" value={filters.user_id} onChange={(e) => setFilters(prev => ({ ...prev, user_id: e.target.value }))} />
            <Input type="date" value={filters.start_date} onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))} />
            <Input type="date" value={filters.end_date} onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSearch}><SearchIcon className="h-4 w-4 mr-2" />검색</Button>
            <Button variant="outline" onClick={clearFilters}>필터 초기화</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>채팅 기록 ({pagination.total}개)</CardTitle>
            {pagination.total > 0 && (
              <Button variant="destructive" size="sm" onClick={openDeleteAllModal}>
                <Trash2Icon className="h-4 w-4 mr-2" />
                전체 삭제
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">로딩 중...</div>
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
                      <TableCell>{format(new Date(item.created_at), 'MM/dd HH:mm', { locale: ko })}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.username}</div>
                        <div className="text-xs text-muted-foreground">{item.email}</div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate cursor-pointer hover:text-primary" onClick={() => setSelectedHistory(item)}>{item.query}</TableCell>
                      <TableCell>{item.category && <Badge variant="secondary">{convertCategoryIdsToNames(item.category, categories) || item.category}</Badge>}</TableCell>
                      <TableCell>{item.response_time && `${Number(item.response_time).toFixed(1)}s`}</TableCell>
                      <TableCell>{item.relevance_score && <Badge variant={item.relevance_score > 0.7 ? "default" : "secondary"}>{(item.relevance_score * 100).toFixed(0)}%</Badge>}</TableCell>
                      <TableCell><Button variant="destructive" size="icon" onClick={() => deleteHistory(item.id)}><TrashIcon className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination.total_pages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                  <Button variant="outline" onClick={() => loadHistory(pagination.page - 1)} disabled={pagination.page <= 1}>이전</Button>
                  <span>{pagination.page} / {pagination.total_pages}</span>
                  <Button variant="outline" onClick={() => loadHistory(pagination.page + 1)} disabled={pagination.page >= pagination.total_pages}>다음</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedHistory && (
        <Dialog open={!!selectedHistory} onOpenChange={() => setSelectedHistory(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>채팅 상세 정보</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>사용자</Label><p>{selectedHistory.username} ({selectedHistory.email})</p></div>
                <div><Label>날짜</Label><p>{format(new Date(selectedHistory.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}</p></div>
                <div><Label>세션 ID</Label><p className="font-mono text-xs">{selectedHistory.session_id}</p></div>
                <div><Label>응답 시간</Label><p>{Number(selectedHistory.response_time).toFixed(1)}초</p></div>
              </div>
              <div><Label>사용자 질문</Label><Textarea value={selectedHistory.query} readOnly className="min-h-[100px]" /></div>
              <div><Label>AI 응답</Label><Textarea value={selectedHistory.response} readOnly className="min-h-[200px]" /></div>
              {selectedHistory.category && <div><Label>카테고리</Label><Badge>{convertCategoryIdsToNames(selectedHistory.category, categories) || selectedHistory.category}</Badge></div>}
              {selectedHistory.relevance_score && <div><Label>관련성 점수</Label><Badge variant={selectedHistory.relevance_score > 0.7 ? "default" : "secondary"}>{(selectedHistory.relevance_score * 100).toFixed(1)}%</Badge></div>}
              {selectedHistory.feedback && <div><Label>피드백</Label><div className="p-2 bg-muted rounded">{selectedHistory.feedback}</div></div>}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setSelectedHistory(null)}>닫기</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={isDeleteAllModalOpen} onOpenChange={setIsDeleteAllModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangleIcon className="text-destructive"/>위험한 작업</DialogTitle>
            <DialogDescription>전체 채팅 기록을 삭제하려고 합니다. 이 작업은 되돌릴 수 없습니다.</DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <p className="font-bold">경고: 총 {pagination.total}개의 기록이 영구적으로 사라집니다.</p>
          </div>
          <div className="space-y-2">
            <Label>계속하려면 아래에 <span className="font-bold text-destructive">"삭제"</span>를 입력하세요:</Label>
            <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="삭제" autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteAllModal}>취소</Button>
            <Button variant="destructive" onClick={executeDeleteAll} disabled={deleteConfirmText.trim() !== '삭제'}>
              <Trash2Icon className="h-4 w-4 mr-2" />
              전체 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
