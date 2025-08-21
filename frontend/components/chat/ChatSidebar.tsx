"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, MoreHorizontal, MessageSquare, Clock, Filter } from "lucide-react";
import { ChatSettingsForm } from "./ChatSettingsForm";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
  categories?: string[];
}

interface ChatSidebarProps {
  // Sessions
  sessions: ChatSession[];
  currentSessionId?: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  
  // Settings
  categories: any[];
  personas: any[];
  selectedCategories: string[];
  selectedPersonaId?: string;
  topK: number;
  onCategoryChange: (categories: string[]) => void;
  onPersonaChange: (personaId?: string) => void;
  onTopKChange: (topK: number) => void;
  
  // UI State
  className?: string;
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  categories,
  personas,
  selectedCategories,
  selectedPersonaId,
  topK,
  onCategoryChange,
  onPersonaChange,
  onTopKChange,
  className
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [settingsMode, setSettingsMode] = useState<"compact" | "expanded">("compact");

  // Filter sessions based on search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    
    const query = searchQuery.toLowerCase();
    return sessions.filter(session => 
      session.title.toLowerCase().includes(query) ||
      session.lastMessage.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const groups: { [key: string]: ChatSession[] } = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    filteredSessions.forEach(session => {
      const sessionDate = new Date(session.timestamp);
      let groupKey: string;
      
      if (sessionDate >= today) {
        groupKey = "오늘";
      } else if (sessionDate >= yesterday) {
        groupKey = "어제";
      } else if (sessionDate >= thisWeek) {
        groupKey = "이번 주";
      } else {
        groupKey = "이전";
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(session);
    });
    
    return groups;
  }, [filteredSessions]);

  const handleSettingsChange = (data: any) => {
    onCategoryChange(data.categories || []);
    onPersonaChange(data.personaId);
    onTopKChange(data.topK || 5);
  };

  const getCategoryName = (id: string) => {
    const category = categories.find(c => c.category_id === id);
    return category?.name || id;
  };

  return (
    <div className={cn("h-full flex flex-col bg-background border-r overflow-hidden sidebar-container", className)}>
      
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">채팅</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSettingsMode(settingsMode === "compact" ? "expanded" : "compact")}>
                {settingsMode === "compact" ? "설정 확장" : "설정 축소"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowFilters(!showFilters)}>
                {showFilters ? "필터 숨기기" : "필터 보기"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>모든 대화 삭제</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <Button 
          onClick={onNewChat}
          className="w-full" 
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          새 대화
        </Button>
      </div>

      {/* Scrollable Content Area */}
      <ScrollArea className="flex-1">
        <div className="space-y-0">
          
          {/* Search & Filters */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="대화 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Quick Filters */}
            {showFilters && (
              <div className="mt-3 flex flex-wrap gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  전체
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  오늘
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  즐겨찾기
                </Button>
              </div>
            )}
          </div>

          {/* Settings Form */}
          <div className="p-4 border-b bg-muted/20">
            <ChatSettingsForm
              initialData={{
                categories: selectedCategories,
                personaId: selectedPersonaId,
                topK: topK
              }}
              categories={categories}
              personas={personas}
              onSubmit={handleSettingsChange}
              onChange={handleSettingsChange}
              autoSave={true}
              compact={settingsMode === "compact"}
            />
          </div>

          {/* Sessions List */}
          <div className="p-4 space-y-4">
          {Object.entries(groupedSessions).map(([groupName, groupSessions]) => (
            <div key={groupName}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {groupName}
                </h3>
                <div className="flex-1 h-px bg-border" />
                <Badge variant="secondary" className="text-xs h-5">
                  {groupSessions.length}
                </Badge>
              </div>
              
              <div className="space-y-1">
                {groupSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className={cn(
                      "sidebar-session-item text-left p-3 rounded-lg transition-all duration-200 group enhanced-focus-ring",
                      "hover:bg-muted/60 border border-transparent hover:border-border/50 hover:scale-[1.02]",
                      "active:scale-[0.98] active:transition-transform active:duration-75",
                      currentSessionId === session.id && "bg-primary/10 border-primary/20 ring-1 ring-primary/20 scale-[1.01]"
                    )}
                  >
                    <div className="flex items-start justify-between mb-1 overflow-hidden">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary flex-1 min-w-0 sidebar-session-title">
                        {session.title}
                      </p>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {session.messageCount}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-2 overflow-hidden sidebar-session-message">
                      {session.lastMessage}
                    </p>
                    
                    <div className="flex items-center justify-between overflow-hidden">
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {(() => {
                            try {
                              const date = session.timestamp instanceof Date 
                                ? session.timestamp 
                                : new Date(session.timestamp);
                              return date.toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              });
                            } catch (error) {
                              return '시간 오류';
                            }
                          })()}
                        </span>
                      </div>
                      
                      {session.categories && session.categories.length > 0 && (
                        <div className="flex gap-1 ml-2 flex-1 min-w-0 justify-end overflow-hidden">
                          {session.categories.slice(0, 1).map((categoryId) => (
                            <Badge 
                              key={categoryId} 
                              variant="outline" 
                              className="text-xs h-4 px-1 sidebar-category-badge"
                            >
                              {getCategoryName(categoryId)}
                            </Badge>
                          ))}
                          {session.categories.length > 1 && (
                            <Badge variant="outline" className="text-xs h-4 px-1 flex-shrink-0">
                              +{session.categories.length - 1}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          
          {filteredSessions.length === 0 && (
            <div className="text-center py-8 animate-in fade-in duration-500">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "검색 결과가 없습니다" : "아직 대화가 없습니다"}
              </p>
              {!searchQuery && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onNewChat}
                  className="mt-3 button-pulse enhanced-focus-ring hover:scale-105 transition-transform duration-200"
                >
                  첫 대화 시작하기
                </Button>
              )}
            </div>
          )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}