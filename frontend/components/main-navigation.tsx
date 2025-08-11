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
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo/Brand */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                LangFlow
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:ml-6 lg:flex lg:space-x-1">
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
                      "inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium transition-colors rounded-t-md",
                      isActive
                        ? item.isAdmin
                          ? "border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400"
                          : "border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200 dark:hover:bg-gray-800"
                    )}
                    title={item.description}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.name}
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
                        className="relative h-auto px-3 py-2 rounded-full"
                      >
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            {user.avatar_url && (
                              <AvatarImage 
                                src={getAvatarUrl(user.avatar_url)} 
                                alt={user.full_name || user.username}
                              />
                            )}
                            <AvatarFallback className="text-sm">
                              {getUserInitials()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="hidden sm:flex flex-col text-left">
                            <span className="text-sm font-medium max-w-[120px] truncate">
                              {getUserDisplayName()}
                            </span>
                            {isAdminUser && (
                              <span className="text-xs text-orange-600 dark:text-orange-400 flex items-center">
                                <Shield className="h-3 w-3 mr-1" />
                                관리자
                              </span>
                            )}
                          </div>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-56"
                      align="end"
                      forceMount
                    >
                      <div className="flex items-center justify-start gap-2 p-2">
                        <div className="flex flex-col space-y-1 leading-none">
                          <p className="font-medium">{getUserDisplayName()}</p>
                          <p className="w-[200px] truncate text-sm text-muted-foreground">
                            {user.email}
                          </p>
                          {isAdminUser && (
                            <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
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

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
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
        <div className="lg:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="pt-2 pb-3 space-y-1 max-h-96 overflow-y-auto">
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
                    "flex items-center px-4 py-3 text-base font-medium transition-colors",
                    isActive
                      ? item.isAdmin
                        ? "text-orange-700 bg-orange-50 border-r-4 border-orange-500 dark:bg-orange-900/20 dark:text-orange-400"
                        : "text-indigo-700 bg-indigo-50 border-r-4 border-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-400"
                      : "text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  <div>
                    <div>{item.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
