"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";

// Web Speech API 타입 정의 (브라우저 호환성)
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};
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
  Paperclip,
  Image,
  X,
  Menu,
  ChevronLeft,
  FileText,
  Code2,
  Hash,
  Globe,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { chatAPI, categoryAPI, personaAPI, modelProfileAPI } from "@/lib/api";
import { CategorySelector } from "@/components/category-selector";
import { ContentPreview } from "@/components/content-preview";
import { FloatingNavigation } from "@/components/floating-navigation";
import { MessageWithImages, hasImageReferences } from "@/components/message-with-images";
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
  images?: string[]; // 첨부된 이미지 URL 배열
  outputFormat?: string; // 요청된 출력 형식
}

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
}

// ChatHistory: 좌측 채팅 히스토리 패널 (메모이제이션으로 최적화)
const ChatHistory = memo(
  ({
    sessions,
    onNewChat,
    onSelectSession,
    // 대화 주제 선택 관련 props 추가
    selectedCategories,
    onCategoryChange,
    categories,
    isEditingCategories,
    setIsEditingCategories,
    personas,
    selectedPersonaId,
    setSelectedPersonaId,
    topK,
    setTopK,
    getCategoryName,
    inputRef,
  }: {
    sessions: ChatSession[];
    onNewChat: () => void;
    onSelectSession: (id: string) => void;
    selectedCategories: string[];
    onCategoryChange: (categories: string[]) => void;
    categories: any[];
    isEditingCategories: boolean;
    setIsEditingCategories: (editing: boolean) => void;
    personas: any[];
    selectedPersonaId: string | undefined;
    setSelectedPersonaId: (id: string | undefined) => void;
    topK: number;
    setTopK: (k: number) => void;
    getCategoryName: (id: string) => string;
    inputRef: React.RefObject<HTMLTextAreaElement>;
  }) => (
    <aside className="w-80 h-full flex-col border-r border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-b from-white/95 to-slate-50/95 dark:from-slate-900/95 dark:to-slate-800/95 backdrop-blur-xl p-4 flex overflow-hidden shadow-lg dark:shadow-2xl">
      <Button onClick={onNewChat} className="mb-4 flex-shrink-0 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl">
        <div className="p-1 rounded-md bg-white/10 mr-2">
          <Plus className="h-4 w-4" />
        </div>
        새 대화
      </Button>
      
      {/* 대화 주제 선택 섹션 */}
      <div className="flex-shrink-0 mb-4 p-4 bg-gradient-to-r from-white to-slate-50/80 dark:from-slate-800/50 dark:to-slate-700/50 rounded-xl border border-slate-300/50 dark:border-slate-600/30 space-y-3 backdrop-blur-sm">
        {isEditingCategories ? (
          <>
            <h3 className="text-sm font-medium text-slate-800 dark:text-white flex items-center gap-2">
              <div className="p-1 rounded-md bg-purple-500/20">
                <Settings className="h-3 w-3 text-purple-400" />
              </div>
              대화 주제 선택
            </h3>
            <CategorySelector
              selectedCategories={selectedCategories}
              onCategoryChange={onCategoryChange}
              categories={categories}
              showDocumentCount={true}
              compactMode={true}
            />
            
            {/* 페르소나 선택 */}
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-slate-400">페르소나</label>
                <select
                  className="w-full bg-slate-700/50 border border-slate-600/30 rounded-lg p-2 text-sm mt-1 text-white focus:border-purple-500/50 focus:ring-purple-500/20"
                  value={selectedPersonaId || ""}
                  onChange={(e) =>
                    setSelectedPersonaId(e.target.value || undefined)
                  }
                >
                  {personas.map((p: any) => (
                    <option key={p.persona_id} value={p.persona_id} className="bg-slate-800">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* 검색 개수 설정 */}
              <div>
                <label className="text-xs font-medium text-slate-400">검색 개수</label>
                <select
                  className="w-full bg-slate-700/50 border border-slate-600/30 rounded-lg p-2 text-sm mt-1 text-white focus:border-purple-500/50 focus:ring-purple-500/20"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                >
                  <option value={3} className="bg-slate-800">3개</option>
                  <option value={5} className="bg-slate-800">5개</option>
                  <option value={10} className="bg-slate-800">10개</option>
                  <option value={15} className="bg-slate-800">15개</option>
                  <option value={20} className="bg-slate-800">20개</option>
                </select>
              </div>
            </div>
            
            <Button
              size="sm"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg"
              onClick={() => {
                setIsEditingCategories(false);
                setTimeout(() => {
                  if (inputRef.current) {
                    inputRef.current.focus();
                  }
                }, 100);
              }}
            >
              완료
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-800 dark:text-white flex items-center gap-2">
                <div className="p-1 rounded-md bg-cyan-500/20">
                  <Settings className="h-3 w-3 text-cyan-400" />
                </div>
                대화 설정
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingCategories(true)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
            
            {/* 선택된 주제 표시 */}
            <div>
              <label className="text-xs font-medium text-slate-400">대화 주제</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedCategories.length > 0 ? (
                  selectedCategories.map((id) => (
                    <Badge key={id} className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30">
                      {getCategoryName(id)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">주제를 선택해주세요</span>
                )}
              </div>
            </div>
            
            {/* 선택된 페르소나 표시 */}
            <div>
              <label className="text-xs font-medium text-slate-400">페르소나</label>
              <div className="mt-1">
                <Badge className="text-xs bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                  {personas.find(p => p.persona_id === selectedPersonaId)?.name || "기본"}
                </Badge>
              </div>
            </div>
          </>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className="w-full text-left p-3 rounded-lg hover:bg-gradient-to-r hover:from-slate-800/50 hover:to-slate-700/50 border border-transparent hover:border-slate-600/30 transition-all duration-300"
            >
              <p className="text-sm font-medium truncate text-white">{session.title}</p>
              <p className="text-xs text-slate-400 truncate">
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
      <div
        className={`flex items-start gap-4 w-full ${
          isUser ? "justify-end" : ""
        }`}
      >
        {!isUser && (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}
        <div
          className={`group relative rounded-lg px-4 py-3 ${
            isUser
              ? "max-w-2xl bg-primary text-primary-foreground"
              : "w-full bg-muted dark:bg-slate-800 dark:text-slate-100 border dark:border-slate-600"
          }`}
        >
          {/* 이미지 미리보기 (사용자 메시지만) */}
          {isUser && message.images && message.images.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2 max-w-xs">
              {message.images.map((imageUrl, index) => (
                <div key={index} className="relative">
                  <img
                    src={imageUrl}
                    alt={`첨부 이미지 ${index + 1}`}
                    className="rounded-lg object-cover w-full h-24 border"
                  />
                </div>
              ))}
            </div>
          )}

          {isUser ? (
            <div className="whitespace-pre-wrap text-sm">{message.content}</div>
          ) : (
            // Assistant 메시지에서 이미지 참조가 있으면 MessageWithImages 사용
            <div className="text-sm w-full" style={{ width: '100%', maxWidth: 'none' }}>
              {hasImageReferences(message.content) ? (
                <MessageWithImages content={message.content} />
              ) : (
                <ContentPreview 
                  content={message.content} 
                  outputFormat={message.outputFormat}
                />
              )}
            </div>
          )}

          {!isUser && (
            <div className="mt-3 pt-3 border-t border-border/50 dark:border-slate-600 space-y-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground dark:text-slate-400">
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
                        className="p-2 bg-background/50 dark:bg-slate-700/50 rounded-md border dark:border-slate-600 text-xs w-full"
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
            <div className="mt-3 pt-3 border-t border-border/50 dark:border-slate-600 flex items-center justify-between">
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
  SIDEBAR_VISIBLE: "chat_sidebar_visible",
};

const OUTPUT_FORMATS = [
  { value: "auto", label: "자동 판단", description: "시스템이 자동으로 최적 형식 선택", icon: Zap },
  { value: "text", label: "일반 텍스트", description: "플레인 텍스트 형식", icon: FileText },
  { value: "markdown", label: "마크다운", description: "Markdown 형식으로 구조화된 텍스트", icon: Hash },
  { value: "html", label: "HTML", description: "HTML 태그를 사용한 구조화된 출력", icon: Globe },
  { value: "json", label: "JSON", description: "구조화된 JSON 데이터 형식", icon: Settings },
  { value: "code", label: "코드", description: "프로그래밍 코드 형식", icon: Code2 },
];

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
  
  // 채팅 페이지에서만 body 스크롤 막기
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);
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
  
  // 모델 프로필 관련 상태
  const [modelProfiles, setModelProfiles] = useState<any[]>([]);
  const [activeModelProfile, setActiveModelProfile] = useState<any>(null);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
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
  // 이미지 업로드 관련 상태
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 사용자 정보 상태 추가
  const [userName, setUserName] = useState(() =>
    loadFromStorage("chat_user_name", "사용자")
  );

  // 사이드바 표시/숨김 상태 추가
  const [sidebarVisible, setSidebarVisible] = useState(() =>
    loadFromStorage(STORAGE_KEYS.SIDEBAR_VISIBLE, true)
  );

  // 음성입력 관련 상태
  const [isListening, setIsListening] = useState(false);
  const [speechRecognition, setSpeechRecognition] = useState<SpeechRecognition | null>(null);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);

  // 출력 형식 관련 상태
  const [outputFormat, setOutputFormat] = useState(() =>
    loadFromStorage("chat_output_format", "auto")
  );

  // 로그인된 사용자 정보로 userName 업데이트
  useEffect(() => {
    if (user) {
      const displayName = user.full_name || user.username || "사용자";
      setUserName(displayName);
    }
  }, [user]);

  // 음성인식 초기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'ko-KR';
        
        recognition.onstart = () => {
          setIsListening(true);
        };
        
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInputValue(prev => prev + transcript);
        };
        
        recognition.onerror = (event) => {
          console.error('음성인식 오류:', event.error);
          setIsListening(false);
          
          let errorMessage = '음성인식 중 오류가 발생했습니다.';
          if (event.error === 'not-allowed') {
            errorMessage = '마이크 접근 권한이 필요합니다.';
          } else if (event.error === 'no-speech') {
            errorMessage = '음성이 감지되지 않았습니다.';
          }
          
          toast({
            title: "음성인식 오류",
            description: errorMessage,
            variant: "destructive",
          });
        };
        
        recognition.onend = () => {
          setIsListening(false);
        };
        
        setSpeechRecognition(recognition);
        setIsVoiceSupported(true);
      } else {
        setIsVoiceSupported(false);
        console.warn('이 브라우저는 음성인식을 지원하지 않습니다.');
      }
    }
  }, [toast]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 인증 체크
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
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
      saveToStorage(STORAGE_KEYS.SIDEBAR_VISIBLE, sidebarVisible);
      saveToStorage("chat_output_format", outputFormat);
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
    sidebarVisible,
    outputFormat,
  ]);

  // 이미지 처리 함수들
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages = Array.from(files).filter(
      (file) => file.type.startsWith("image/") && file.size <= 5 * 1024 * 1024 // 5MB 제한
    );

    if (newImages.length === 0) {
      toast({
        title: "파일 오류",
        description:
          "이미지 파일만 업로드 가능하며, 크기는 5MB 이하여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    // 기존 이미지와 합쳐서 최대 3개까지만
    const totalImages = [...selectedImages, ...newImages].slice(0, 3);
    setSelectedImages(totalImages);

    // 미리보기 URL 생성
    const previewUrls = totalImages.map((file) => URL.createObjectURL(file));
    setImagePreviewUrls(previewUrls);
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviewUrls = imagePreviewUrls.filter((_, i) => i !== index);

    // 제거된 URL 해제
    URL.revokeObjectURL(imagePreviewUrls[index]);

    setSelectedImages(newImages);
    setImagePreviewUrls(newPreviewUrls);
  };

  const clearImages = () => {
    imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedImages([]);
    setImagePreviewUrls([]);
  };

  const handleNewChat = useCallback(() => {
    // localStorage 클리어
    clearChatStorage();
    // 상태 초기화
    setMessages([initialMessage]);
    setSelectedCategories([]);
    setIsEditingCategories(true);
    setInputValue("");
    // 이미지 상태도 초기화
    clearImages();
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

        // 모델 프로필 데이터 로드
        const modelProfilesData = await modelProfileAPI.getProfiles();
        setModelProfiles(modelProfilesData.profiles || []);
        
        // 활성 모델 프로필 로드
        const activeProfile = modelProfilesData.profiles?.find((p: any) => 
          p.id === modelProfilesData.active_profile_id
        );
        setActiveModelProfile(activeProfile || null);

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
    if (
      (!inputValue.trim() && selectedImages.length === 0) ||
      selectedCategories.length === 0
    ) {
      toast({
        title: "알림",
        description: "카테고리를 선택하고 텍스트나 이미지를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      role: "user",
      timestamp: new Date(),
      images: imagePreviewUrls.length > 0 ? [...imagePreviewUrls] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInputValue = inputValue;
    const currentImages = [...selectedImages];
    setInputValue("");
    setIsLoading(true);
    setIsEditingCategories(false);

    try {
      // Base64로 이미지 인코딩
      let base64Images: string[] = [];

      if (currentImages.length > 0) {
        console.log(`이미지 ${currentImages.length}개를 Base64로 변환 중...`);

        const imagePromises = currentImages.map((file, index) => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (reader.result && typeof reader.result === "string") {
                console.log(`이미지 ${index + 1} 변환 완료: ${file.name}`);
                resolve(reader.result);
              } else {
                reject(
                  new Error(`이미지 ${index + 1} 변환 실패: ${file.name}`)
                );
              }
            };
            reader.onerror = () =>
              reject(new Error(`이미지 읽기 실패: ${file.name}`));
            reader.readAsDataURL(file);
          });
        });

        try {
          base64Images = await Promise.all(imagePromises);
          console.log(`${base64Images.length}개 이미지 Base64 변환 완료`);
        } catch (imageError) {
          console.error("이미지 변환 중 오류:", imageError);
          toast({
            title: "이미지 처리 오류",
            description:
              "이미지를 처리하는 중 오류가 발생했습니다. 텍스트만 전송합니다.",
            variant: "destructive",
          });
          base64Images = [];
        }
      }

      // 이미지 상태 정리 (API 호출 전에)
      clearImages();

      // 출력 형식 전달
      const selectedFormat = outputFormat;

      const response = await chatAPI.sendMessage(
        userMessage.content,
        selectedCategories,
        undefined,
        undefined,
        topK,
        undefined,
        selectedPersonaId,
        base64Images.length > 0 ? base64Images : undefined, // Base64 이미지 데이터 전송
        selectedFormat
      );

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
        outputFormat: selectedFormat,
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

  const handleVoiceInput = () => {
    if (!isVoiceSupported) {
      toast({
        title: "음성인식 미지원",
        description: "이 브라우저는 음성인식을 지원하지 않습니다.",
        variant: "destructive",
      });
      return;
    }

    if (!speechRecognition) {
      toast({
        title: "음성인식 오류",
        description: "음성인식 기능을 초기화할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      speechRecognition.stop();
      toast({
        title: "음성인식 중지",
        description: "음성 입력이 중지되었습니다.",
      });
    } else {
      try {
        speechRecognition.start();
        toast({
          title: "음성인식 시작",
          description: "말씀해주세요. 음성이 텍스트로 변환됩니다.",
        });
      } catch (error) {
        console.error('음성인식 시작 오류:', error);
        toast({
          title: "음성인식 오류",
          description: "음성인식을 시작할 수 없습니다.",
          variant: "destructive",
        });
      }
    }
  };

  const getCategoryName = (id: string) =>
    categories.find((c) => c.category_id === id)?.name || id;

  const handleModelProfileChange = async (profileId: string) => {
    try {
      await modelProfileAPI.activateProfile(profileId);
      const updatedProfile = modelProfiles.find(p => p.id === profileId);
      setActiveModelProfile(updatedProfile);
      setModelSelectorOpen(false);
      
      toast({
        title: "모델 변경",
        description: `"${updatedProfile?.name}" 모델로 변경되었습니다.`,
      });
    } catch (error) {
      console.error("모델 변경 실패:", error);
      toast({
        title: "오류",
        description: "모델 변경에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

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
    <div className="flex h-screen w-full bg-gradient-to-br from-gray-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden" style={{height: 'calc(100vh - 64px)'}}>
      {/* 사이드바 - 조건부 렌더링 */}
      {sidebarVisible && (
        <ChatHistory
          sessions={[]}
          onNewChat={handleNewChat}
          onSelectSession={() => {}}
          selectedCategories={selectedCategories}
          onCategoryChange={setSelectedCategories}
          categories={categories}
          isEditingCategories={isEditingCategories}
          setIsEditingCategories={setIsEditingCategories}
          personas={personas}
          selectedPersonaId={selectedPersonaId}
          setSelectedPersonaId={setSelectedPersonaId}
          topK={topK}
          setTopK={setTopK}
          getCategoryName={getCategoryName}
          inputRef={inputRef}
        />
      )}
      <main className="flex flex-1 flex-col h-full overflow-hidden relative">
        {/* 사이드바 숨김 상태에서 복원 버튼 */}
        {!sidebarVisible && (
          <div className="fixed top-4 left-4 z-50 flex flex-col gap-2">
            <Button
              variant="default"
              size="icon"
              className="shadow-lg hover:shadow-xl transition-shadow"
              onClick={() => setSidebarVisible(true)}
              title="사이드바 열기"
            >
              <Menu className="h-5 w-5" />
            </Button>
            {selectedCategories.length === 0 && (
              <Button
                variant="outline"
                size="icon"
                className="shadow-lg hover:shadow-xl transition-shadow bg-orange-500 text-white hover:bg-orange-600"
                onClick={() => {
                  setSidebarVisible(true);
                  setIsEditingCategories(true);
                }}
                title="대화 주제 선택"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
        
        <header className="flex-shrink-0 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-700/50 p-4 bg-gradient-to-r from-white/95 to-slate-50/95 dark:from-slate-900/95 dark:to-slate-800/95 backdrop-blur-xl">
          <div className="flex items-center">
            {/* 사이드바 토글 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              className="mr-3 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-xl"
              onClick={() => setSidebarVisible(!sidebarVisible)}
            >
              {sidebarVisible ? (
                <ChevronLeft className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
            <h1 className="text-xl font-semibold bg-gradient-to-r from-white via-purple-200 to-cyan-200 dark:from-white dark:via-purple-200 dark:to-cyan-200 light:from-slate-800 light:via-purple-600 light:to-blue-600 bg-clip-text text-transparent">AI 챗봇</h1>
          </div>

          {/* 모델 선택 드롭다운 */}
          <div className="flex items-center gap-3">
            {activeModelProfile && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
                <div className="p-1 rounded-md bg-emerald-500/20">
                  <Bot className="h-3 w-3 text-emerald-400" />
                </div>
                <span className="text-white">{activeModelProfile.name}</span>
              </div>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600/30 hover:from-slate-700/50 hover:to-slate-600/50 hover:border-slate-500/50 text-slate-300 hover:text-white transition-all duration-300 rounded-xl shadow-lg hover:shadow-xl backdrop-blur-sm" size="sm">
                  <div className="p-1 rounded-md bg-white/10">
                    <Settings className="h-3 w-3" />
                  </div>
                  <span className="hidden sm:inline">모델 선택</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {modelProfiles.length > 0 ? (
                  modelProfiles.map((profile) => (
                    <DropdownMenuItem
                      key={profile.id}
                      onClick={() => handleModelProfileChange(profile.id)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{profile.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {profile.provider} • {profile.model}
                          </div>
                        </div>
                      </div>
                      {activeModelProfile?.id === profile.id && (
                        <Badge variant="default" className="text-xs">
                          활성
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>
                    등록된 모델이 없습니다
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>


        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div
            className="h-full overflow-y-auto overflow-x-hidden"
            ref={scrollAreaRef}
          >
            <div className="p-6 space-y-6 min-h-full">
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
                  <div className="max-w-full rounded-lg px-4 py-3 bg-muted dark:bg-slate-800 border dark:border-slate-600">
                    <div className="flex items-center gap-2 text-sm">
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

        <div className="flex-shrink-0 border-t border-slate-700/50 p-4 bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto">
            {/* 이미지 미리보기 영역 */}
            {imagePreviewUrls.length > 0 && (
              <div className="mb-3 p-3 bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-lg border border-slate-600/30 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center gap-2 text-white">
                    <div className="p-1 rounded-md bg-blue-500/20">
                      <Image className="h-3 w-3 text-blue-400" />
                    </div>
                    첨부된 이미지 ({imagePreviewUrls.length}/3)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearImages}
                    className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  {imagePreviewUrls.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`미리보기 ${index + 1}`}
                        className="w-16 h-16 rounded-lg object-cover border"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeImage(index)}
                        className="absolute -top-1 -right-1 h-5 w-5 p-0 rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}


            <div className="relative rainbow-focus rounded-2xl">
              <Textarea
                ref={inputRef}
                placeholder={
                  selectedCategories.length > 0
                    ? "메시지를 입력하거나 이미지를 첨부하세요..."
                    : "먼저 대화 주제를 선택해주세요."
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                rows={1}
                className="min-h-[48px] rounded-2xl resize-none p-4 pr-36 border-2 border-transparent"
                disabled={isLoading || selectedCategories.length === 0}
              />
              <div className="absolute top-1/2 right-3 transform -translate-y-1/2 flex items-center gap-1 z-10">
                {/* 이미지 업로드 버튼 */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={
                    selectedCategories.length === 0 ||
                    selectedImages.length >= 3
                  }
                  onClick={() => fileInputRef.current?.click()}
                  title="이미지 첨부"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                {/* 출력 형식 선택 버튼 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={selectedCategories.length === 0}
                      title={`출력 형식: ${OUTPUT_FORMATS.find(f => f.value === outputFormat)?.label || "자동 판단"}`}
                    >
                      {(() => {
                        const currentFormat = OUTPUT_FORMATS.find(f => f.value === outputFormat);
                        const IconComponent = currentFormat?.icon || Zap;
                        return <IconComponent className="h-4 w-4" />;
                      })()}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {OUTPUT_FORMATS.map((format) => {
                      const IconComponent = format.icon;
                      return (
                        <DropdownMenuItem
                          key={format.value}
                          onClick={() => setOutputFormat(format.value)}
                          className="flex items-start gap-3 p-3"
                        >
                          <IconComponent className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{format.label}</span>
                              {outputFormat === format.value && (
                                <Badge variant="default" className="text-xs ml-2">
                                  선택됨
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format.description}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${isListening ? 'bg-red-100 text-red-600 hover:bg-red-200' : ''}`}
                  disabled={selectedCategories.length === 0 || !isVoiceSupported}
                  onClick={handleVoiceInput}
                  title={isListening ? "음성인식 중지" : "음성인식 시작"}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>

                <Button
                  onClick={handleSendMessage}
                  disabled={
                    isLoading ||
                    (!inputValue.trim() && selectedImages.length === 0) ||
                    selectedCategories.length === 0
                  }
                  size="icon"
                  className="h-8 w-8 rounded-full"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* 숨겨진 파일 입력 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
