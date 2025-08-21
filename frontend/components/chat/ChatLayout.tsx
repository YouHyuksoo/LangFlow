"use client";

import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, ChevronLeft, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import "./animations.css";

interface ChatLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  header?: ReactNode;
  sidebarVisible?: boolean;
  onSidebarToggle?: () => void;
  className?: string;
}

export function ChatLayout({
  children,
  sidebar,
  header,
  sidebarVisible = true,
  onSidebarToggle,
  className
}: ChatLayoutProps) {
  return (
    <div className={cn(
      "flex h-screen w-full bg-background overflow-hidden",
      className
    )} style={{height: 'calc(100vh - 64px)'}}>
      
      {/* Desktop & Tablet Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col border-r bg-muted/30 shadow-sm",
        "transition-all duration-300 ease-in-out smooth-height-transition",
        sidebarVisible 
          ? "w-80 lg:w-80 xl:w-96 opacity-100 min-w-80" 
          : "w-0 opacity-0 overflow-hidden min-w-0"
      )}>
        {sidebarVisible && (
          <div className="w-full h-full animate-in slide-in-from-left duration-300">
            {sidebar}
          </div>
        )}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarVisible && (
        <div className="md:hidden fixed inset-0 z-50 flex animate-in fade-in duration-300">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={onSidebarToggle}
          />
          <aside className="relative w-80 max-w-[85vw] min-w-80 bg-background border-r shadow-2xl animate-in slide-in-from-left duration-300 sidebar-container">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col h-full overflow-hidden relative">
        
        {/* Floating Action Buttons for Hidden Sidebar */}
        {!sidebarVisible && (
          <div className="fixed top-4 left-4 z-40 flex flex-col gap-2 floating-fade-in">
            <Button
              variant="default"
              size="icon"
              className="shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 enhanced-focus-ring"
              onClick={onSidebarToggle}
              title="사이드바 열기"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Header */}
        {header && (
          <header className="flex-shrink-0 flex items-center justify-between border-b bg-muted/30 backdrop-blur-sm p-4">
            <div className="flex items-center">
              {/* Sidebar Toggle Button */}
              <Button
                variant="ghost"
                size="icon"
                className="mr-3 hover:bg-muted/60"
                onClick={onSidebarToggle}
              >
                {sidebarVisible ? (
                  <ChevronLeft className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
              {header}
            </div>
          </header>
        )}

        {/* Chat Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}

// Layout Hook for managing sidebar state
export function useChatLayout() {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const toggleSidebar = () => setSidebarVisible(!sidebarVisible);
  const showSidebar = () => setSidebarVisible(true);
  const hideSidebar = () => setSidebarVisible(false);

  return {
    sidebarVisible,
    setSidebarVisible,
    toggleSidebar,
    showSidebar,
    hideSidebar
  };
}