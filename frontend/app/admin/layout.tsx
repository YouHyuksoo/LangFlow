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
  ZapIcon,
  BotIcon,
  CpuIcon,
  FileTextIcon,
  FileSearchIcon,
  ChevronDownIcon,
  ChevronRightIcon
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
  { 
    name: '설정', 
    href: '/admin/settings', 
    icon: SettingsIcon,
    children: [
      { name: '기본 설정', href: '/admin/settings', icon: SettingsIcon },
      { name: '모델 설정', href: '/admin/settings/models', icon: BotIcon },
      { name: '성능 관리', href: '/admin/settings/performance', icon: CpuIcon },
      { name: 'Docling 전처리', href: '/admin/settings/preprocessing/docling', icon: FileTextIcon },
      { name: 'Unstructured 전처리', href: '/admin/settings/preprocessing/unstructured', icon: FileSearchIcon },
      { name: '데이터베이스 관리', href: '/admin/settings/database', icon: DatabaseIcon },
    ]
  },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, isAuthenticated, isAdminUser, logout } = useAuth()

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }))
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    } else if (!loading && isAuthenticated && !isAdminUser) {
      router.push('/') // 관리자가 아닌 경우 홈으로 리다이렉트
    }
  }, [loading, isAuthenticated, isAdminUser, router])

  // 현재 경로가 설정 페이지인 경우 설정 메뉴 자동 확장
  useEffect(() => {
    if (pathname.startsWith('/admin/settings')) {
      setExpandedMenus(prev => ({ ...prev, '설정': true }))
    }
  }, [pathname])

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
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* 사이드바 */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-white/95 to-slate-50/95 dark:from-slate-900/95 dark:to-slate-800/95 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50 shadow-lg dark:shadow-2xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* 사이드바 헤더 */}
        <div className="h-16 px-6 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-100/80 to-blue-100/80 dark:from-purple-500/20 dark:to-cyan-500/20 border border-purple-300/50 dark:border-purple-500/30">
                <ShieldIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-800 via-purple-600 to-blue-600 dark:from-white dark:via-purple-200 dark:to-cyan-200 bg-clip-text text-transparent">관리자</h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-xl"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 네비게이션 메뉴 */}
        <nav className="mt-6 px-3">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const hasChildren = item.children && item.children.length > 0
              const isExpanded = expandedMenus[item.name]
              const isChildActive = hasChildren && item.children.some(child => pathname === child.href)

              return (
                <li key={item.name}>
                  {hasChildren ? (
                    <div>
                      <button
                        onClick={() => toggleMenu(item.name)}
                        className={cn(
                          "group flex items-center justify-between w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 relative overflow-hidden",
                          isActive || isChildActive
                            ? "text-purple-700 dark:text-white bg-gradient-to-r from-purple-100/80 to-blue-100/80 dark:from-purple-500/20 dark:to-cyan-500/20 border border-purple-300/50 dark:border-purple-500/30 shadow-lg shadow-purple-300/20 dark:shadow-purple-500/10"
                            : "text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-gradient-to-r hover:from-white hover:to-slate-100/50 dark:hover:from-slate-800/50 dark:hover:to-slate-700/50 border border-transparent hover:border-slate-300/50 dark:hover:border-slate-600/30"
                        )}
                      >
                        <div className="flex items-center">
                          <div className={`p-1.5 rounded-lg mr-3 ${
                            isActive || isChildActive 
                              ? 'bg-purple-200/50 dark:bg-purple-500/20' 
                              : 'bg-slate-200/30 dark:bg-white/10 group-hover:bg-slate-300/40 dark:group-hover:bg-white/20'
                          }`}>
                            <item.icon
                              className={cn(
                                "h-4 w-4 transition-colors",
                                isActive || isChildActive ? "text-purple-600 dark:text-purple-400" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white"
                              )}
                            />
                          </div>
                          {item.name}
                        </div>
                        <div className={`p-1 rounded-md ${
                          isActive || isChildActive 
                            ? 'bg-purple-200/50 dark:bg-purple-500/20' 
                            : 'bg-slate-200/30 dark:bg-white/10 group-hover:bg-slate-300/40 dark:group-hover:bg-white/20'
                        }`}>
                          {isExpanded ? (
                            <ChevronDownIcon className={`h-3 w-3 ${
                              isActive || isChildActive ? "text-purple-600 dark:text-purple-400" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white"
                            }`} />
                          ) : (
                            <ChevronRightIcon className={`h-3 w-3 ${
                              isActive || isChildActive ? "text-purple-600 dark:text-purple-400" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white"
                            }`} />
                          )}
                        </div>
                        {(isActive || isChildActive) && (
                          <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent rounded-xl animate-pulse"></div>
                        )}
                      </button>
                      {isExpanded && (
                        <ul className="mt-2 ml-6 space-y-1">
                          {item.children.map((child) => {
                            const isChildItemActive = pathname === child.href
                            return (
                              <li key={child.name}>
                                <Link
                                  href={child.href}
                                  className={cn(
                                    "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 relative overflow-hidden",
                                    isChildItemActive
                                      ? "text-cyan-700 dark:text-white bg-gradient-to-r from-cyan-100/70 to-blue-100/70 dark:from-cyan-500/20 dark:to-blue-500/20 border-l-2 border-cyan-500 dark:border-cyan-400 shadow-lg shadow-cyan-300/20 dark:shadow-cyan-500/10"
                                      : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-gradient-to-r hover:from-white hover:to-slate-100/30 dark:hover:from-slate-800/30 dark:hover:to-slate-700/30 hover:border-l-2 hover:border-slate-400 dark:hover:border-slate-500"
                                  )}
                                  onClick={() => setSidebarOpen(false)}
                                >
                                  <div className={`p-1 rounded-md mr-3 ${
                                    isChildItemActive 
                                      ? 'bg-cyan-200/50 dark:bg-cyan-500/20' 
                                      : 'bg-slate-200/20 dark:bg-white/5 group-hover:bg-slate-300/30 dark:group-hover:bg-white/15'
                                  }`}>
                                    <child.icon
                                      className={cn(
                                        "h-3.5 w-3.5 transition-colors",
                                        isChildItemActive ? "text-cyan-600 dark:text-cyan-400" : "text-slate-600 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                                      )}
                                    />
                                  </div>
                                  {child.name}
                                  {isChildItemActive && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/3 to-transparent rounded-lg animate-pulse"></div>
                                  )}
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 relative overflow-hidden",
                        isActive
                          ? "text-purple-700 dark:text-white bg-gradient-to-r from-purple-100/80 to-blue-100/80 dark:from-purple-500/20 dark:to-cyan-500/20 border border-purple-300/50 dark:border-purple-500/30 shadow-lg shadow-purple-300/20 dark:shadow-purple-500/10"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-gradient-to-r hover:from-white hover:to-slate-100/50 dark:hover:from-slate-800/50 dark:hover:to-slate-700/50 border border-transparent hover:border-slate-300/50 dark:hover:border-slate-600/30"
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <div className={`p-1.5 rounded-lg mr-3 ${
                        isActive 
                          ? 'bg-purple-200/50 dark:bg-purple-500/20' 
                          : 'bg-slate-200/30 dark:bg-white/10 group-hover:bg-slate-300/40 dark:group-hover:bg-white/20'
                      }`}>
                        <item.icon
                          className={cn(
                            "h-4 w-4 transition-colors",
                            isActive ? "text-purple-600 dark:text-purple-400" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white"
                          )}
                        />
                      </div>
                      {item.name}
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent rounded-xl animate-pulse"></div>
                      )}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

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
        <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-gradient-to-r from-white/95 to-slate-50/95 dark:from-slate-900/95 dark:to-slate-800/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50 rounded-xl"
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold bg-gradient-to-r from-slate-800 via-purple-600 to-blue-600 dark:from-white dark:via-purple-200 dark:to-cyan-200 bg-clip-text text-transparent">관리자 대시보드</h1>
          <div /> {/* 스페이서 */}
        </div>

        {/* 메인 컨텐츠 영역 */}
        <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-gray-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          {children}
        </main>
      </div>
    </div>
  )
}