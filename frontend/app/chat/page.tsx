"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Settings,
  Clock,
  Search,
  BookOpen,
  TrendingUp,
  Mic,
  MicOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { chatAPI, categoryAPI, personaAPI } from "@/lib/api";
import { CategorySelector } from "@/components/category-selector";
import { ContentPreview } from "@/components/content-preview";
import { FloatingNavigation } from "@/components/floating-navigation";
import { useAuthContext } from "@/context/auth-context";

// --- 데이터 인터페이스 ---
interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  sourceDetails?: Array<{
    file_id?: string;
    filename?: string;
    category_name?: string;
    content?: string;
    score?: number;
  }>;
  processingTime?: number;
  confidence?: number;
}

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
}

// --- 재사용 컴포넌트 ---

// ChatHistory: 좌측 채팅 히스토리 패널 (메모이제이션으로 최적화)
const ChatHistory = memo(
  ({
    sessions,
    onNewChat,
    onSelectSession,
  }: {
    sessions: ChatSession[];
    onNewChat: () => void;
    onSelectSession: (id: string) => void;
  }) => (
    <aside className="w-64 flex-col border-r bg-muted/40 p-4 hidden md:flex">
      <Button onClick={onNewChat} className="mb-4">
        <Plus className="mr-2 h-4 w-4" /> 새 대화
      </Button>
      <ScrollArea className="flex-1">
        <div className="space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className="w-full text-left p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <p className="text-sm font-medium truncate">{session.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {session.lastMessage}
              </p>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
);

// ChatMessage: 개별 채팅 메시지 컴포넌트 (메모이제이션으로 최적화)
const ChatMessage = memo(
  ({
    message,
    toast,
    userName,
  }: {
    message: Message;
    toast: any;
    userName: string;
  }) => {
    const isUser = message.role === "user";

    const handleCopy = () => {
      navigator.clipboard.writeText(message.content);
      toast({
        title: "복사 완료",
        description: "메시지가 클립보드에 복사되었습니다.",
      });
    };

    return (
      <div className={`flex items-start gap-4 ${isUser ? "justify-end" : ""}`}>
        {!isUser && (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}
        <div
          className={`group relative max-w-xl rounded-lg px-4 py-3 ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <ContentPreview content={message.content} />
          )}

          {!isUser && (
            <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {message.processingTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{" "}
                    {message.processingTime.toFixed(2)}초
                  </span>
                )}
                {message.confidence && (
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> 신뢰도{" "}
                    {Math.round(message.confidence * 100)}%
                  </span>
                )}
                {message.sourceDetails && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> 소스{" "}
                    {message.sourceDetails.length}개
                  </span>
                )}
              </div>

              {message.sourceDetails && message.sourceDetails.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2">참조 소스:</h4>
                  <div className="flex flex-wrap gap-2">
                    {message.sourceDetails.map((source, index) => (
                      <div
                        key={index}
                        className="p-2 bg-background/50 rounded-md border text-xs w-full"
                      >
                        <p className="font-medium truncate">
                          {source.filename}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isUser && (
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopy}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <ThumbsUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <ThumbsDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

// --- 상수 정의 ---
const STORAGE_KEYS = {
  MESSAGES: "chat_messages",
  SELECTED_CATEGORIES: "chat_selected_categories",
  SELECTED_PERSONA_ID: "chat_selected_persona_id",
  IS_EDITING_CATEGORIES: "chat_is_editing_categories",
  TOP_K: "chat_top_k",
  INPUT_VALUE: "chat_input_value",
};

const initialMessage: Message = {
  id: "init",
  role: "assistant",
  content: "안녕하세요! 먼저 대화할 주제의 카테고리를 선택해주세요.",
  timestamp: new Date(),
};

// --- localStorage 유틸리티 함수들 ---
const saveToStorage = (key: string, value: any) => {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    console.error("localStorage 저장 실패:", error);
  }
};

const loadFromStorage = (key: string, defaultValue: any): any => {
  try {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Date 객체 복원
        if (key === STORAGE_KEYS.MESSAGES && Array.isArray(parsed)) {
          return parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
        }
        return parsed;
      }
    }
  } catch (error) {
    console.error("localStorage 로드 실패:", error);
  }
  return defaultValue;
};

const clearChatStorage = () => {
  try {
    if (typeof window !== "undefined") {
      Object.values(STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key);
      });
    }
  } catch (error) {
    console.error("localStorage 클리어 실패:", error);
  }
};

// --- 메인 채팅 페이지 ---
export default function ChatPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuthContext();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>(() =>
    loadFromStorage(STORAGE_KEYS.MESSAGES, [initialMessage])
  );
  const [inputValue, setInputValue] = useState(() =>
    loadFromStorage(STORAGE_KEYS.INPUT_VALUE, "")
  );
  const [isLoading, setIsLoading] = useState(false);
  // 카테고리 선택 상태
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    () => loadFromStorage(STORAGE_KEYS.SELECTED_CATEGORIES, []) as string[]
  );
  const [categories, setCategories] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<
    string | undefined
  >(() => loadFromStorage(STORAGE_KEYS.SELECTED_PERSONA_ID, undefined));
  const [isEditingCategories, setIsEditingCategories] = useState(() => {
    const storedCategories = loadFromStorage(
      STORAGE_KEYS.SELECTED_CATEGORIES,
      []
    );
    const storedEditingState = loadFromStorage(
      STORAGE_KEYS.IS_EDITING_CATEGORIES,
      true
    );
    // 카테고리가 있으면 편집 모드를 false로, 없으면 true로
    return storedCategories.length === 0 ? true : storedEditingState;
  });
  const [topK, setTopK] = useState(() =>
    loadFromStorage(STORAGE_KEYS.TOP_K, 5)
  );
  // 사용자 정보 상태 추가
  const [userName, setUserName] = useState(() =>
    loadFromStorage("chat_user_name", "사용자")
  );

  // 로그인된 사용자 정보로 userName 업데이트
  useEffect(() => {
    if (user) {
      const displayName = user.full_name || user.username || "사용자";
      setUserName(displayName);
    }
  }, [user]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 인증 체크
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, isLoading]);

  // 카테고리 편집 완료 후 또는 페이지 로드 후 입력창에 포커스
  useEffect(() => {
    if (!isEditingCategories && selectedCategories.length > 0 && !isLoading) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 200);
    }
  }, [isEditingCategories, selectedCategories.length, isLoading]);

  // 페이지 초기 로드 시 포커스 설정 (카테고리가 있는 경우)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        !isEditingCategories &&
        selectedCategories.length > 0 &&
        inputRef.current
      ) {
        inputRef.current.focus();
      }
    }, 500); // 페이지 로드 완료를 위해 조금 더 긴 지연

    return () => clearTimeout(timer);
  }, []); // 마운트 시에만 실행

  // 상태 변경 시 localStorage에 저장 (통합)
  useEffect(() => {
    // localStorage 저장을 디바운스하여 성능 최적화
    const timeoutId = setTimeout(() => {
      saveToStorage(STORAGE_KEYS.MESSAGES, messages);
      saveToStorage(STORAGE_KEYS.INPUT_VALUE, inputValue);
      saveToStorage(STORAGE_KEYS.SELECTED_CATEGORIES, selectedCategories);
      saveToStorage(STORAGE_KEYS.SELECTED_PERSONA_ID, selectedPersonaId);
      saveToStorage(STORAGE_KEYS.IS_EDITING_CATEGORIES, isEditingCategories);
      saveToStorage(STORAGE_KEYS.TOP_K, topK);
      saveToStorage("chat_user_name", userName);
    }, 100); // 100ms 디바운스

    return () => clearTimeout(timeoutId);
  }, [
    messages,
    inputValue,
    selectedCategories,
    selectedPersonaId,
    isEditingCategories,
    topK,
    userName,
  ]);

  const handleNewChat = useCallback(() => {
    // localStorage 클리어
    clearChatStorage();
    // 상태 초기화
    setMessages([initialMessage]);
    setSelectedCategories([]);
    setIsEditingCategories(true);
    setInputValue("");
    setIsLoading(false);
    setSelectedPersonaId(undefined);
    setTopK(5);
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const categoriesData = await categoryAPI.getCategories();
        setCategories(categoriesData);
        const personasData = await personaAPI.getPersonas();
        setPersonas(personasData);

        // localStorage에서 페르소나 ID 확인
        const storedPersonaId = loadFromStorage(
          STORAGE_KEYS.SELECTED_PERSONA_ID,
          undefined
        );

        if (!storedPersonaId) {
          // 저장된 페르소나가 없으면 기본값 설정
          const defaultPersona = personasData.find(
            (p: any) => p.persona_id === "default"
          );
          const defaultPersonaId = defaultPersona
            ? defaultPersona.persona_id
            : personasData[0]?.persona_id;
          setSelectedPersonaId(defaultPersonaId);
        }
        // 저장된 페르소나가 있으면 이미 useState 초기값에서 로드됨
      } catch (error) {
        console.error("초기 데이터 로드 실패:", error);
        toast({
          title: "오류",
          description: "카테고리 정보를 불러오는데 실패했습니다.",
          variant: "destructive",
        });
      }
    };
    loadInitialData();
  }, [toast]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || selectedCategories.length === 0) {
      toast({
        title: "알림",
        description: "카테고리를 선택하고 질문을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setIsEditingCategories(false);

    try {
      const response = await chatAPI.sendMessage(
        userMessage.content,
        selectedCategories,
        undefined,
        undefined,
        topK,
        undefined,
        selectedPersonaId
      );

      // 디버그: 백엔드 응답 확인
      console.log("백엔드 응답:", response);
      console.log("응답의 sources:", response.sources);
      console.log("sources 개수:", response.sources?.length || 0);
      console.log("신뢰도:", response.confidence);

      // 프론트엔드에서 중복 제거 (동일한 파일명의 소스는 하나만 표시)
      const uniqueSources = (
        response.sources ||
        response.source_details ||
        []
      ).reduce((acc: any[], source: any) => {
        const filename = source.filename?.toLowerCase().trim();
        if (filename) {
          // 기존에 같은 파일명이 있는지 확인
          const existingSource = acc.find(
            (s) => s.filename?.toLowerCase().trim() === filename
          );

          if (!existingSource) {
            // 새로운 파일명인 경우 추가
            acc.push(source);
          } else if (
            source.score &&
            (!existingSource.score || source.score > existingSource.score)
          ) {
            // 같은 파일명이지만 더 높은 점수를 가진 경우 교체
            const index = acc.indexOf(existingSource);
            acc[index] = source;
          }
        }
        return acc;
      }, []);

      console.log("백엔드에서 받은 sources:", response.sources);
      console.log("프론트엔드 중복 제거 후:", uniqueSources);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.response || "응답을 받지 못했습니다.",
        role: "assistant",
        timestamp: new Date(),
        sourceDetails: uniqueSources,
        processingTime: response.processing_time,
        confidence: response.confidence,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("메시지 전송 실패:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "메시지 전송에 실패했습니다. 잠시 후 다시 시도해주세요.",
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // LLM 응답 완료 후 입력창에 포커스 설정
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getCategoryName = (id: string) =>
    categories.find((c) => c.category_id === id)?.name || id;

  // 인증 로딩 중이거나 인증되지 않은 경우
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <ChatHistory
        sessions={[]}
        onNewChat={handleNewChat}
        onSelectSession={() => {}}
      />
      <main className="flex flex-1 flex-col h-full">
        <header className="flex-shrink-0 flex items-center border-b p-4">
          <h1 className="text-xl font-semibold">AI 챗봇</h1>
        </header>

        <div className="flex-shrink-0 border-b p-4 space-y-2 bg-muted/20">
          {isEditingCategories ? (
            <>
              <h2 className="text-sm font-medium">대화 주제 선택:</h2>
              <CategorySelector
                selectedCategories={selectedCategories}
                onCategoryChange={setSelectedCategories}
                categories={categories}
                showDocumentCount={false}
              />
              {/* 페르소나 선택 & 검색 개수 설정 */}
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">페르소나:</span>
                  <select
                    className="border rounded-md p-2 text-sm"
                    value={selectedPersonaId || ""}
                    onChange={(e) =>
                      setSelectedPersonaId(e.target.value || undefined)
                    }
                  >
                    {personas.map((p: any) => (
                      <option key={p.persona_id} value={p.persona_id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">검색 개수:</span>
                  <select
                    className="border rounded-md p-2 text-sm"
                    value={topK}
                    onChange={(e) => setTopK(parseInt(e.target.value))}
                  >
                    <option value={3}>3개</option>
                    <option value={5}>5개</option>
                    <option value={10}>10개</option>
                    <option value={15}>15개</option>
                    <option value={20}>20개</option>
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setIsEditingCategories(false);
                    // 카테고리 설정 완료 후 입력창에 포커스
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.focus();
                      }
                    }, 100);
                  }}
                >
                  완료
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm font-medium">대화 주제:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedCategories.map((id) => (
                    <Badge key={id} variant="secondary">
                      {getCategoryName(id)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">페르소나:</span>
                <select
                  className="border rounded-md p-2 text-sm"
                  value={selectedPersonaId || ""}
                  onChange={(e) =>
                    setSelectedPersonaId(e.target.value || undefined)
                  }
                >
                  {personas.map((p: any) => (
                    <option key={p.persona_id} value={p.persona_id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditingCategories(true)}
              >
                변경
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          <div 
            className="absolute inset-0 overflow-y-auto overflow-x-hidden"
            ref={scrollAreaRef}
          >
            <div className="p-6 space-y-6">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  toast={toast}
                  userName={userName}
                />
              ))}
              {isLoading && (
                <div className="flex items-start gap-4">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-xl rounded-lg px-4 py-3 bg-muted">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      />
                      <div
                        className="w-2 h-2 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* 플로팅 네비게이션 */}
          <FloatingNavigation scrollContainerRef={scrollAreaRef} />
        </div>

        <div className="flex-shrink-0 border-t p-4 bg-background">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <Textarea
                ref={inputRef}
                placeholder={
                  selectedCategories.length > 0
                    ? "메시지를 입력하세요..."
                    : "먼저 대화 주제를 선택해주세요."
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                rows={1}
                className="min-h-[48px] rounded-2xl resize-none p-4 pr-24"
                disabled={isLoading || selectedCategories.length === 0}
              />
              <div className="absolute top-1/2 right-3 transform -translate-y-1/2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={selectedCategories.length === 0}
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={
                    isLoading ||
                    !inputValue.trim() ||
                    selectedCategories.length === 0
                  }
                  size="icon"
                  className="h-8 w-8 rounded-full"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
