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
  Home,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuthContext } from "@/context/auth-context";
import { getAvatarUrl } from "@/lib/config";

const chatNavItems = [
  {
    name: "홈",
    href: "/",
    icon: Home,
    description: "랜딩 페이지로 이동",
  },
  {
    name: "채팅",
    href: "/chat",
    icon: MessageSquare,
    description: "현재 페이지",
  },
  {
    name: "관리자",
    href: "/admin",
    icon: Settings,
    description: "관리자 대시보드",
    isAdmin: true,
  },
];

export function ChatNavigation() {
  const pathname = usePathname();
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
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Logo와 Navigation Links */}
          <div className="flex items-center space-x-8">
            {/* Logo/Brand */}
            <div className="flex-shrink-0">
              <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-slate-800 via-blue-600 to-purple-600 dark:from-white dark:via-purple-200 dark:to-cyan-200 bg-clip-text text-transparent">
                ThinkFlow
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex lg:space-x-2">
              {chatNavItems.map((item) => {
                if (item.isAdmin && !isAdminUser) {
                  return null;
                }

                const Icon = item.icon;
                const isActive = pathname === item.href;

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

          {/* Right side - User menu and theme toggle */}
          <div className="flex items-center space-x-4">
            {/* 사용자 메뉴 */}
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
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                      <div className="flex items-center justify-start gap-2 p-3">
                        <div className="flex flex-col space-y-1 leading-none">
                          <p className="font-medium">{getUserDisplayName()}</p>
                          <p className="w-[200px] truncate text-sm text-muted-foreground">
                            {user.email}
                          </p>
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
                        className="cursor-pointer text-red-600 focus:text-red-600"
                        onClick={logout}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>로그아웃</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" asChild>
                      <Link href="/login">로그인</Link>
                    </Button>
                    <Button asChild>
                      <Link href="/register">회원가입</Link>
                    </Button>
                  </div>
                )}
              </>
            )}

            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}