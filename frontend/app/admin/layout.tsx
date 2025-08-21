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
  ChevronRightIcon,
  EditIcon
} from 'lucide-react'
import { useAuth } from '@/lib/auth'

const navigation = [
  { name: '대시보드', href: '/admin', icon: LayoutDashboardIcon },
  { name: '사용자 관리', href: '/admin/users', icon: UsersIcon },
  { name: '카테고리 관리', href: '/admin/categories', icon: FolderIcon },
  { name: '파일 업로드', href: '/admin/upload', icon: UploadIcon },
  { name: '수동 전처리', href: '/admin/preprocessing', icon: EditIcon },
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
      { name: '수동 전처리 설정', href: '/admin/settings/preprocessing/manual', icon: EditIcon },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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

  // 현재 경로가 설정 페이지인 경우 설정 메뉴 자동 확장 및 사이드바 펼치기
  useEffect(() => {
    if (pathname.startsWith('/admin/settings')) {
      setExpandedMenus(prev => ({ ...prev, '설정': true }))
      // 설정 하위 페이지에 있을 때는 사이드바를 펼친 상태로 유지
      if (pathname !== '/admin/settings') {
        setSidebarCollapsed(false)
      }
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
          <AlertTriangleIcon className="w-12 h-12 text-orange-500 mx-auto mb-4" />
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
          <ShieldIcon className="w-12 h-12 text-purple-500 mx-auto mb-4" />
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

  // 전처리 에디터 페이지인지 확인
  const isPreprocessingEditorPage = pathname?.startsWith('/admin/preprocessing/') && pathname !== '/admin/preprocessing'

  return (
    <div className="flex h-screen bg-muted">
      {/* 사이드바 - 전처리 에디터에서는 숨김 */}
      {!isPreprocessingEditorPage && (
        <div className={cn(
          "fixed inset-y-0 left-0 z-50 bg-background border-r transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "lg:w-16" : "lg:w-64",
          "w-64" // 모바일에서는 항상 전체 너비
        )}>
          {/* 사이드바 헤더 */}
        <div className={cn("flex-shrink-0 h-16 border-b", sidebarCollapsed ? "px-2" : "px-6")}>
          <div className="flex items-center justify-between h-full">
            <div className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "space-x-3")}>
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <ShieldIcon className="h-5 w-5 text-purple-500" />
              </div>
              {!sidebarCollapsed && <h1 className="text-xl font-bold text-foreground">관리자</h1>}
            </div>
            <div className="flex items-center space-x-1">
              {/* 데스크톱 접기/펼치기 버튼 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:flex text-muted-foreground hover:text-accent-foreground hover:bg-accent"
                title={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
              >
                {sidebarCollapsed ? (
                  <ChevronRightIcon className="h-4 w-4 text-purple-500" />
                ) : (
                  <ChevronLeftIcon className="h-4 w-4 text-purple-500" />
                )}
              </Button>
              {/* 모바일 닫기 버튼 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-muted-foreground hover:text-accent-foreground hover:bg-accent"
              >
                <ChevronLeftIcon className="h-4 w-4 text-orange-500" />
              </Button>
            </div>
          </div>
        </div>

        {/* 네비게이션 메뉴 - 스크롤 개선 */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 4rem)', minHeight: '0' }}>
          <nav className={cn("py-6", sidebarCollapsed ? "px-2" : "px-3")}>
            <ul className="space-y-2 pb-12">
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
                        onClick={() => !sidebarCollapsed && toggleMenu(item.name)}
                        className={cn(
                          "group flex items-center w-full text-sm font-medium rounded-xl transition-colors",
                          sidebarCollapsed ? "px-2 py-3 justify-center" : "px-4 py-3 justify-between",
                          isActive || isChildActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-accent-foreground hover:bg-accent"
                        )}
                        title={sidebarCollapsed ? item.name : undefined}
                      >
                        <div className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "")}>
                          <item.icon
                            className={`h-4 w-4 ${sidebarCollapsed ? "" : "mr-3"} ${
                              item.icon === LayoutDashboardIcon ? 'text-purple-500' :
                              item.icon === UsersIcon ? 'text-orange-500' :
                              item.icon === FolderIcon ? 'text-blue-500' :
                              item.icon === UploadIcon ? 'text-blue-500' :
                              item.icon === EditIcon ? 'text-orange-500' :
                              item.icon === DatabaseIcon ? 'text-green-500' :
                              item.icon === ZapIcon ? 'text-green-500' :
                              item.icon === MessageSquareIcon ? 'text-purple-500' :
                              item.icon === SettingsIcon ? 'text-purple-500' :
                              'text-muted-foreground'
                            }`}
                          />
                          {!sidebarCollapsed && item.name}
                        </div>
                        {!sidebarCollapsed && (
                          <div>
                            {isExpanded ? (
                              <ChevronDownIcon className="h-3 w-3 text-orange-500" />
                            ) : (
                              <ChevronRightIcon className="h-3 w-3 text-orange-500" />
                            )}
                          </div>
                        )}
                      </button>
                      {isExpanded && !sidebarCollapsed && (
                        <ul className="mt-2 ml-6 space-y-1">
                          {item.children.map((child) => {
                            const isChildItemActive = pathname === child.href
                            return (
                              <li key={child.name}>
                                <Link
                                  href={child.href}
                                  className={cn(
                                    "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                                    isChildItemActive
                                      ? "bg-primary/10 text-primary"
                                      : "text-muted-foreground hover:text-accent-foreground hover:bg-accent"
                                  )}
                                  onClick={() => setSidebarOpen(false)}
                                >
                                  <child.icon
                                    className={`h-3.5 w-3.5 mr-3 ${
                                      child.icon === SettingsIcon ? 'text-purple-500' :
                                      child.icon === BotIcon ? 'text-blue-500' :
                                      child.icon === CpuIcon ? 'text-purple-500' :
                                      child.icon === FileTextIcon ? 'text-blue-500' :
                                      child.icon === FileSearchIcon ? 'text-blue-500' :
                                      child.icon === DatabaseIcon ? 'text-green-500' :
                                      'text-muted-foreground'
                                    }`}
                                  />
                                  {child.name}
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
                        "group flex items-center text-sm font-medium rounded-xl transition-colors",
                        sidebarCollapsed ? "px-2 py-3 justify-center" : "px-4 py-3",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-accent-foreground hover:bg-accent"
                      )}
                      onClick={() => setSidebarOpen(false)}
                      title={sidebarCollapsed ? item.name : undefined}
                    >
                      <item.icon
                        className={`h-4 w-4 ${sidebarCollapsed ? "" : "mr-3"} ${
                          item.icon === LayoutDashboardIcon ? 'text-purple-500' :
                          item.icon === UsersIcon ? 'text-orange-500' :
                          item.icon === FolderIcon ? 'text-blue-500' :
                          item.icon === UploadIcon ? 'text-blue-500' :
                          item.icon === EditIcon ? 'text-orange-500' :
                          item.icon === DatabaseIcon ? 'text-green-500' :
                          item.icon === ZapIcon ? 'text-green-500' :
                          item.icon === MessageSquareIcon ? 'text-purple-500' :
                          item.icon === SettingsIcon ? 'text-purple-500' :
                          'text-muted-foreground'
                        }`}
                      />
                      {!sidebarCollapsed && item.name}
                    </Link>
                  )}
                </li>
              )
            })}
            </ul>
          </nav>
        </div>
        </div>
      )}

      {/* 모바일 오버레이 - 전처리 에디터에서는 숨김 */}
      {!isPreprocessingEditorPage && sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 헤더 (모바일) - 전처리 에디터에서는 숨김 */}
        {!isPreprocessingEditorPage && (
          <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-background border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-accent-foreground hover:bg-accent"
            >
              <MenuIcon className="h-5 w-5 text-purple-500" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">관리자 대시보드</h1>
            <div /> {/* 스페이서 */}
          </div>
        )}

        {/* 메인 컨텐츠 영역 */}
        <main className={cn(
          "flex-1 bg-background",
          pathname.startsWith('/admin/preprocessing/') 
            ? "overflow-hidden p-0" // preprocessing 에디터는 스크롤 없음, 패딩 없음
            : "overflow-y-auto p-6" // 다른 페이지는 기존대로
        )}>
          <div className={cn(
            pathname.startsWith('/admin/preprocessing/') 
              ? "" // preprocessing 에디터는 패딩 없음
              : "pb-12" // 다른 페이지는 내부 컨텐츠에만 하단 여백
          )}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}