"use client";

import { useState, useEffect } from "react";
import { ArrowUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingNavigationProps {
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  className?: string;
}

/**
 * 플로팅 네비게이션 컴포넌트
 * 스크롤 위치에 따라 맨위로 가는 버튼을 표시/숨김
 */
export function FloatingNavigation({ 
  scrollContainerRef, 
  className = "" 
}: FloatingNavigationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // 스크롤 위치 감지
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      
      // 스크롤이 100px 이상 내려갔을 때 버튼 표시
      const shouldShowButton = scrollTop > 100;
      
      // 하단에 가까운지 확인 (하단 150px 이내)
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isNearBottomArea = distanceFromBottom < 150;
      
      setIsVisible(shouldShowButton);
      setIsNearBottom(isNearBottomArea);
    };

    container.addEventListener('scroll', handleScroll);
    
    // 초기 상태 설정
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainerRef]);

  // 맨위로 스크롤
  const scrollToTop = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // 맨아래로 스크롤
  const scrollToBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  };

  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 flex flex-col gap-2",
      className
    )}>
      {/* 맨위로 가기 버튼 */}
      <Button
        onClick={scrollToTop}
        size="icon"
        className={cn(
          "h-12 w-12 rounded-full shadow-lg transition-all duration-300 ease-in-out",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          "hover:scale-110 active:scale-95",
          "border-2 border-background"
        )}
        title="맨위로 가기"
      >
        <ArrowUp className="h-5 w-5" />
      </Button>

      {/* 맨아래로 가기 버튼 (맨위에 있을 때만 표시) */}
      {!isNearBottom && (
        <Button
          onClick={scrollToBottom}
          size="icon"
          variant="secondary"
          className={cn(
            "h-10 w-10 rounded-full shadow-lg transition-all duration-300 ease-in-out",
            "hover:scale-110 active:scale-95",
            "border-2 border-background"
          )}
          title="맨아래로 가기"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/**
 * 스크롤 위치 훅 (선택적으로 사용)
 */
export function useScrollPosition(ref: React.RefObject<HTMLDivElement>) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      
      setScrollPosition(scrollTop);
      setIsAtTop(scrollTop < 10);
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 10);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // 초기값 설정

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [ref]);

  return { scrollPosition, isAtTop, isAtBottom };
}