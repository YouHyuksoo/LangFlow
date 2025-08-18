"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 컴포넌트 마운트 후에만 테마 상태를 표시
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-16 h-8 bg-slate-700/50 rounded-full animate-pulse"></div>
    );
  }

  const isDark = theme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative w-16 h-8 rounded-full transition-all duration-500 ease-in-out focus:outline-none focus:ring-4 focus:ring-purple-500/20 group"
      style={{
        background: isDark 
          ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)'
          : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
        boxShadow: isDark 
          ? '0 4px 20px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          : '0 4px 20px rgba(251, 191, 36, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
      }}
      title={isDark ? "라이트 모드로 변경" : "다크 모드로 변경"}
    >
      {/* 슬라이더 트랙 */}
      <div className="absolute inset-0 rounded-full overflow-hidden">
        <div 
          className="absolute inset-0 rounded-full transition-opacity duration-500"
          style={{
            background: isDark 
              ? 'radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)'
              : 'radial-gradient(circle at 80% 50%, rgba(249, 115, 22, 0.3) 0%, transparent 50%)'
          }}
        />
      </div>

      {/* 슬라이더 버튼 */}
      <div
        className={`absolute top-1 w-6 h-6 rounded-full transition-all duration-500 ease-in-out transform flex items-center justify-center ${
          isDark ? 'translate-x-9' : 'translate-x-1'
        }`}
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #e2e8f0 100%)',
          boxShadow: isDark 
            ? '0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(139, 92, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            : '0 2px 8px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
        }}
      >
        {/* 아이콘들 */}
        <Sun 
          className={`h-3 w-3 text-orange-600 transition-all duration-500 ${
            isDark ? 'opacity-0 scale-0 rotate-180' : 'opacity-100 scale-100 rotate-0'
          }`}
        />
        <Moon 
          className={`absolute h-3 w-3 text-purple-200 transition-all duration-500 ${
            isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-0 -rotate-180'
          }`}
        />
      </div>

      {/* 상태 표시 점들 */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-0.5 h-0.5 rounded-full transition-all duration-700 ${
              isDark ? 'bg-purple-300' : 'bg-orange-200'
            }`}
            style={{
              top: '50%',
              left: `${25 + i * 20}%`,
              transform: 'translateY(-50%)',
              animationDelay: `${i * 200}ms`,
              opacity: isDark === (i < 1) ? 1 : 0.3,
            }}
          />
        ))}
      </div>

      {/* 호버 효과 */}
      <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: isDark 
            ? 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, transparent 70%)'
        }}
      />
    </button>
  );
}
