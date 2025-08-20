"use client";

import { useState, Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Bot, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { userAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// useSearchParams를 사용하는 컴포넌트를 분리
function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // 리다이렉트 URL 가져오기
  const redirectUrl = searchParams.get("redirect") || "/";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await userAPI.login(username, password);

      if (response.success) {
        // Store session information
        if (response.session_id) {
          document.cookie = `session_id=${response.session_id}; path=/; max-age=86400`; // 1 day
        }

        // Store user info in localStorage
        if (response.user) {
          localStorage.setItem("user", JSON.stringify(response.user));
        }

        toast({
          title: "로그인 성공",
          description: "환영합니다!",
        });

        // 역할에 따른 리다이렉트
        if (response.user?.role === "admin") {
          // 관리자인 경우 관리자 페이지로 이동합니다.
          // SPA 라우팅 대신 전체 페이지 새로고침을 사용하여 모든 상태를 안정적으로 초기화합니다.
          window.location.href = "/admin";
        } else {
          // 일반 사용자인 경우 지정된 페이지 또는 홈으로 이동합니다.
          // SPA 라우팅 대신 전체 페이지 새로고침을 사용합니다.
          window.location.href = redirectUrl;
        }
      } else {
        setError(response.message || "로그인에 실패했습니다.");
      }
    } catch (error) {
      console.error("로그인 오류:", error);
      setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
      toast({
        title: "로그인 실패",
        description: "로그인 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 헤더 */}
      <div className="text-center space-y-4 mb-8">
        <div className="flex items-center justify-center space-x-3 mb-6">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg">
            <Bot className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              SmartKnowBot
            </h1>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-300 text-lg">
          사내 지식관리 AI 도우미 시스템
        </p>
      </div>

      {/* 로그인 카드 */}
      <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-0 shadow-2xl shadow-blue-500/10 dark:shadow-purple-500/20">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle className="text-2xl text-center font-semibold text-gray-800 dark:text-white">
            로그인
          </CardTitle>
          <CardDescription className="text-center text-gray-600 dark:text-gray-300">
            {redirectUrl !== "/"
              ? "채팅을 시작하려면 로그인이 필요합니다"
              : "계정 정보를 입력하여 로그인하세요"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center space-x-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm mb-6">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                사용자명
              </label>
              <Input
                id="username"
                type="text"
                placeholder="사용자명을 입력하세요"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                비밀번호
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500 rounded-xl pr-12"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200" 
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>로그인 중...</span>
                </div>
              ) : (
                "로그인"
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              계정이 없으신가요?{" "}
              <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium hover:underline">
                관리자에게 문의
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 테마 토글 */}
      <div className="flex justify-center">
        <div className="p-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full shadow-lg">
          <ThemeToggle />
        </div>
      </div>

      {/* 기본 계정 정보 */}
      <Card className="backdrop-blur-sm bg-white/60 dark:bg-gray-900/60 border-0 shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-800 dark:text-white">기본 계정 정보</CardTitle>
          <CardDescription className="text-xs text-gray-600 dark:text-gray-300">
            시스템 기본 관리자 계정
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
            <p className="text-gray-800 dark:text-gray-200">
              <strong className="text-blue-600 dark:text-blue-400">관리자:</strong> admin / admin123
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              * 보안을 위해 기본 비밀번호를 변경하세요
            </p>
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            관리자는 <code className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200">/admin</code> 페이지에서 사용자를 관리할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* 배경 장식 요소들 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-72 h-72 bg-blue-200/20 dark:bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-purple-200/20 dark:bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-80 h-80 bg-indigo-200/20 dark:bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="w-full max-w-md space-y-6 relative z-10">
        <Suspense fallback={<div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
