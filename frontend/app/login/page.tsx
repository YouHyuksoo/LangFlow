"use client";

import { useState, useEffect } from "react";
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

export default function LoginPage() {
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* 헤더 */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Bot className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">SmartKnowBot</h1>
          </div>
          <p className="text-muted-foreground">
            사내 지식관리 AI 도우미 시스템
          </p>
        </div>

        {/* 로그인 카드 */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">로그인</CardTitle>
            <CardDescription className="text-center">
              {redirectUrl !== "/"
                ? "채팅을 시작하려면 로그인이 필요합니다"
                : "계정 정보를 입력하여 로그인하세요"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm mb-4">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  사용자명
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="사용자명을 입력하세요"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  비밀번호
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="비밀번호를 입력하세요"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
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

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "로그인 중..." : "로그인"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                계정이 없으신가요?{" "}
                <a href="#" className="text-primary hover:underline">
                  관리자에게 문의
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 테마 토글 */}
        <div className="flex justify-center">
          <ThemeToggle />
        </div>

        {/* 기본 계정 정보 */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">기본 계정 정보</CardTitle>
            <CardDescription className="text-xs">
              시스템 기본 관리자 계정
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="p-2 bg-background rounded border">
              <p>
                <strong>관리자:</strong> admin / admin123
              </p>
              <p className="text-muted-foreground mt-1">
                * 보안을 위해 기본 비밀번호를 변경하세요
              </p>
            </div>
            <p className="text-muted-foreground">
              관리자는 <code>/admin</code> 페이지에서 사용자를 관리할 수
              있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
