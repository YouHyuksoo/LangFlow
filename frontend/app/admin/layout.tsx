'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  UsersIcon, 
  FolderIcon, 
  SettingsIcon, 
  DatabaseIcon,
  MessageSquareIcon,
  ChevronLeftIcon,
  MenuIcon,
  ShieldIcon,
  AlertTriangleIcon,
  UploadIcon,
  LayoutDashboardIcon,
  ZapIcon
} from 'lucide-react'
import { useAuth } from '@/lib/auth'

const navigation = [
  { name: '대시보드', href: '/admin', icon: LayoutDashboardIcon },
  { name: '사용자 관리', href: '/admin/users', icon: UsersIcon },
  { name: '카테고리 관리', href: '/admin/categories', icon: FolderIcon },
  { name: '파일 업로드', href: '/admin/upload', icon: UploadIcon },
  { name: '벡터화 관리', href: '/admin/vectorization', icon: DatabaseIcon },
  { name: '벡터 분석', href: '/admin/vectors', icon: ZapIcon },
  { name: '채팅 기록', href: '/admin/chat-history', icon: MessageSquareIcon },
  { name: '설정', href: '/admin/settings', icon: SettingsIcon },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, isAuthenticated, isAdminUser, logout } = useAuth()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    } else if (!loading && isAuthenticated && !isAdminUser) {
      router.push('/') // 관리자가 아닌 경우 홈으로 리다이렉트
    }
  }, [loading, isAuthenticated, isAdminUser, router])

  // 로딩 중이거나 인증되지 않은 경우
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">인증 확인 중...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center p-8 bg-card rounded-lg shadow-md border">
          <AlertTriangleIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-foreground">로그인이 필요합니다</h2>
          <p className="text-muted-foreground mb-4">관리자 페이지에 접근하려면 로그인해주세요.</p>
          <Link href="/login">
            <Button>로그인하기</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!isAdminUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center p-8 bg-card rounded-lg shadow-md border">
          <ShieldIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-foreground">접근 권한이 없습니다</h2>
          <p className="text-muted-foreground mb-4">관리자 권한이 필요한 페이지입니다.</p>
          <div className="space-x-2">
            <Link href="/">
              <Button variant="outline">홈으로 이동</Button>
            </Link>
            <Button onClick={logout}>로그아웃</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* 사이드바 */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* 사이드바 헤더 */}
        <div className="h-16 px-6 border-b border-border">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center space-x-3">
              <ShieldIcon className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">관리자</h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 네비게이션 메뉴 */}
        <nav className="mt-6 px-3">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary border-r-2 border-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-5 w-5 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* 홈으로 돌아가기 */}
        <div className="absolute bottom-6 left-6 right-6">
          <Link href="/">
            <Button variant="outline" className="w-full">
              <ChevronLeftIcon className="mr-2 h-4 w-4" />
              홈으로 돌아가기
            </Button>
          </Link>
        </div>
      </div>

      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 헤더 (모바일) */}
        <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-card border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">관리자 대시보드</h1>
          <div /> {/* 스페이서 */}
        </div>

        {/* 메인 컨텐츠 영역 */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
