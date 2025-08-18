"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageSquare,
  Settings,
  User,
  LogOut,
  Shield,
  Bot,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuthContext } from "@/context/auth-context";
import { getAvatarUrl } from "@/lib/config";

const navItems = [
  {
    name: "홈",
    href: "/",
    icon: Bot,
    description: "랜딩 페이지",
  },
  {
    name: "채팅",
    href: "/chat",
    icon: MessageSquare,
    description: "AI와 채팅하기",
  },
  {
    name: "관리자",
    href: "/admin",
    icon: Settings,
    description: "관리자 대시보드",
    isAdmin: true,
  },
];

export function MainNavigation() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, loading, isAdminUser, logout } = useAuthContext();

  useEffect(() => {
    setMounted(true);
  }, []);

  const getUserDisplayName = () => {
    if (!user) return "";
    return user.full_name || user.username;
  };

  const getUserInitials = () => {
    if (!user) return "";
    const displayName = getUserDisplayName();
    return displayName
      .split(" ")
      .map((name) => name[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="bg-gradient-to-br from-white via-slate-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border-b border-slate-200/80 dark:border-slate-700/50 shadow-lg dark:shadow-2xl backdrop-blur-sm sticky top-0 z-50">
      {/* TODO(human): 라이트 모드 네비게이션 색상 수정 필요 - 기본은 라이트, dark: 접두사로 다크모드 오버라이드 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo/Brand */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-slate-800 via-blue-600 to-purple-600 dark:from-white dark:via-purple-200 dark:to-cyan-200 bg-clip-text text-transparent">
                ThinkFlow
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:ml-8 lg:flex lg:space-x-2">
              {navItems.map((item) => {
                if (item.isAdmin && !isAdminUser) {
                  return null;
                }

                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center px-4 py-2 text-sm font-medium transition-all duration-300 rounded-xl relative group overflow-hidden",
                      isActive
                        ? "text-purple-700 dark:text-white bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-500/20 dark:to-cyan-500/20 border border-purple-300 dark:border-purple-500/30 shadow-lg shadow-purple-300/50 dark:shadow-purple-500/20"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100 dark:hover:from-slate-800/50 dark:hover:to-slate-700/50 border border-transparent hover:border-slate-300/50 dark:hover:border-slate-600/30 hover:shadow-md dark:hover:shadow-lg"
                    )}
                    title={item.description}
                  >
                    <div className={`p-1.5 rounded-lg mr-2 ${
                      isActive 
                        ? 'bg-purple-200/60 dark:bg-purple-500/20'
                        : 'bg-slate-100/80 dark:bg-white/10 group-hover:bg-slate-200/80 dark:group-hover:bg-white/20'
                    }`}>
                      <Icon className={`h-4 w-4 ${
                        isActive 
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white'
                      }`} />
                    </div>
                    {item.name}
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent rounded-xl animate-pulse"></div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side - User menu, theme toggle and mobile menu */}
          <div className="flex items-center space-x-4">
            {/* 사용자 메뉴 - 클라이언트에서만 렌더링 */}
            {mounted && (
              <>
                {loading ? (
                  <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                ) : user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="relative h-auto px-3 py-2 rounded-xl bg-gradient-to-r from-slate-100/80 to-slate-200/80 dark:from-slate-800/50 dark:to-slate-700/50 border border-slate-300/50 dark:border-slate-600/30 hover:from-slate-200/80 hover:to-slate-300/80 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:border-slate-400/60 dark:hover:border-slate-500/50 transition-all duration-300 hover:shadow-lg backdrop-blur-sm"
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8 ring-2 ring-purple-500/20">
                            {user.avatar_url && (
                              <AvatarImage 
                                src={getAvatarUrl(user.avatar_url)} 
                                alt={user.full_name || user.username}
                              />
                            )}
                            <AvatarFallback className="text-sm bg-gradient-to-br from-purple-500 to-cyan-500 text-white font-semibold">
                              {getUserInitials()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="hidden sm:flex flex-col text-left">
                            <span className="text-sm font-medium max-w-[120px] truncate text-slate-700 dark:text-white">
                              {getUserDisplayName()}
                            </span>
                            {isAdminUser && (
                              <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center">
                                <Shield className="h-3 w-3 mr-1" />
                                관리자
                              </span>
                            )}
                          </div>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-56 bg-gradient-to-br from-white/95 to-slate-50/95 dark:from-slate-900/95 dark:to-slate-800/95 backdrop-blur-xl border-slate-300/50 dark:border-slate-700/50 shadow-2xl"
                      align="end"
                      forceMount
                    >
                      <div className="flex items-center justify-start gap-2 p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-slate-800/50 dark:to-slate-700/50 rounded-lg m-2 border border-purple-200/50 dark:border-slate-600/30">
                        <div className="flex flex-col space-y-1 leading-none">
                          <p className="font-medium text-slate-800 dark:text-white">{getUserDisplayName()}</p>
                          <p className="w-[200px] truncate text-sm text-slate-600 dark:text-slate-400">
                            {user.email}
                          </p>
                          {isAdminUser && (
                            <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                              <Shield className="h-3 w-3" />
                              관리자
                            </div>
                          )}
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/profile" className="cursor-pointer">
                          <User className="mr-2 h-4 w-4" />
                          <span>프로필</span>
                        </Link>
                      </DropdownMenuItem>
                      {isAdminUser && (
                        <DropdownMenuItem asChild>
                          <Link href="/admin" className="cursor-pointer">
                            <Settings className="mr-2 h-4 w-4" />
                            <span>관리자</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer text-red-600 focus:text-red-600 dark:focus:text-red-400"
                        onClick={logout}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>로그아웃</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-slate-800/50 hover:to-slate-700/50 border border-transparent hover:border-slate-600/30 rounded-xl" asChild>
                      <Link href="/login">로그인</Link>
                    </Button>
                    <Button className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl" asChild>
                      <Link href="/register">회원가입</Link>
                    </Button>
                  </div>
                )}
              </>
            )}

            <ThemeToggle />

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-xl text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-slate-800/50 hover:to-slate-700/50 border border-transparent hover:border-slate-600/30"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-700/50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 backdrop-blur-sm">
          <div className="pt-4 pb-3 space-y-2 max-h-96 overflow-y-auto px-4">
            {navItems.map((item) => {
              if (item.isAdmin && !isAdminUser) {
                return null;
              }

              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-4 py-4 text-base font-medium transition-all duration-300 rounded-xl relative group overflow-hidden",
                    isActive
                      ? "text-purple-700 dark:text-white bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-500/20 dark:to-cyan-500/20 border border-purple-300 dark:border-purple-500/30 shadow-lg shadow-purple-300/50 dark:shadow-purple-500/20"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100 dark:hover:from-slate-800/50 dark:hover:to-slate-700/50 border border-transparent hover:border-slate-300/50 dark:hover:border-slate-600/30 hover:shadow-md dark:hover:shadow-lg"
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className={`p-2 rounded-lg mr-3 ${
                    isActive 
                      ? 'bg-purple-200/60 dark:bg-purple-500/20'
                      : 'bg-slate-100/80 dark:bg-white/10 group-hover:bg-slate-200/80 dark:group-hover:bg-white/20'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      isActive 
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">{item.name}</div>
                    <div className="text-sm text-slate-400 group-hover:text-slate-300">
                      {item.description}
                    </div>
                  </div>
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent rounded-xl animate-pulse"></div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
