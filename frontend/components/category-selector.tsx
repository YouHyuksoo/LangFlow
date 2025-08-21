"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  Users,
  Factory,
  Code,
  TrendingUp,
  Truck,
  FileText,
  Settings,
  Target,
  BookOpen,
  Plus,
  Edit,
  Trash2,
  Folder,
  Tag,
  Database,
  Globe,
  Home,
  Briefcase,
  Heart,
  Star,
  Zap,
  Shield,
  Camera,
  Music,
  Video,
  Image,
  File,
  Archive,
  Search,
  Filter,
  Building,
  Car,
  Plane,
  Ship,
  Train,
  Bus,
  Bike,
  MapPin,
  Navigation,
  Compass,
  Globe2,
  Map,
  Calendar,
  Clock,
  Timer,
  Watch,
  AlarmClock,
  Bell,
  Phone,
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  Reply,
  Forward,
  Share,
  Link,
  ExternalLink,
  Download,
  Upload,
  Save,
  Edit3,
  Copy,
  Scissors,
  RotateCcw,
  RefreshCw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Move,
  Grid,
  List,
  Columns,
  Rows,
  Layout,
  Sidebar,
  SidebarClose,
  SidebarOpen,
  Menu,
  MenuSquare,
  MoreHorizontal,
  MoreVertical,
  PlusCircle,
  MinusCircle,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Info,
  HelpCircle,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Key,
  ShieldCheck,
  ShieldOff,
  User,
  UserCheck,
  UserX,
  Users2,
  UserPlus,
  UserMinus,
  UserCog,
  Settings2,
  Cog,
  Wrench,
  Hammer,
  Ruler,
  Crown,
  Medal,
  Trophy,
  Award,
  Gift,
  Package,
  Box,
  Container,
  Circle,
  Square,
  Triangle,
  ThumbsUp,
  ThumbsDown,
  Smile,
  Frown,
  Meh,
  Laugh,
  Angry,
  Ear,
  Brain,
  Skull,
  Bone,
  Stethoscope,
  Pill,
  Syringe,
  Thermometer,
  Scale,
  Microscope,
  Tv,
  Radio,
  Speaker,
  Headphones,
  Mic,
  MicOff,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Shuffle,
  Repeat,
  Repeat1,
  PlayCircle,
  PauseCircle,
  StopCircle,
  PlaySquare,
} from "lucide-react";
import { categoryAPI } from "@/lib/api";

export interface Category {
  category_id: string;
  name: string;
  description: string;
  icon?: string;
  color: string;
  document_count?: number;
}

// 아이콘 매핑
const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } =
  {
    Target,
    Users,
    Factory,
    Code,
    TrendingUp,
    Truck,
    FileText,
    Settings,
    BookOpen,
    Folder,
    Tag,
    Database,
    Globe,
    Home,
    Briefcase,
    Heart,
    Star,
    Zap,
    Shield,
    Camera,
    Music,
    Video,
    Image,
    File,
    Archive,
    Search,
    Filter,
    Building,
    Car,
    Plane,
    Ship,
    Train,
    Bus,
    Bike,
    MapPin,
    Navigation,
    Compass,
    Globe2,
    Map,
    Calendar,
    Clock,
    Timer,
    Watch,
    AlarmClock,
    Bell,
    Phone,
    Mail,
    MessageSquare,
    MessageCircle,
    Send,
    Reply,
    Forward,
    Share,
    Link,
    ExternalLink,
    Download,
    Upload,
    Save,
    Edit3,
    Copy,
    Scissors,
    RotateCcw,
    RefreshCw,
    RotateCw,
    ZoomIn,
    ZoomOut,
    Maximize,
    Minimize,
    Move,
    Grid,
    List,
    Columns,
    Rows,
    Layout,
    Sidebar,
    SidebarClose,
    SidebarOpen,
    Menu,
    MenuSquare,
    MoreHorizontal,
    MoreVertical,
    PlusCircle,
    MinusCircle,
    XCircle,
    CheckCircle2,
    AlertCircle,
    Info,
    HelpCircle,
    Eye,
    EyeOff,
    Lock,
    Unlock,
    Key,
    ShieldCheck,
    ShieldOff,
    User,
    UserCheck,
    UserX,
    Users2,
    UserPlus,
    UserMinus,
    UserCog,
    Settings2,
    Cog,
    Wrench,
    Hammer,
    Ruler,
    Crown,
    Medal,
    Trophy,
    Award,
    Gift,
    Package,
    Box,
    Container,
    Circle,
    Square,
    Triangle,
    ThumbsUp,
    ThumbsDown,
    Smile,
    Frown,
    Meh,
    Laugh,
    Angry,
    Ear,
    Brain,
    Skull,
    Bone,
    Stethoscope,
    Pill,
    Syringe,
    Thermometer,
    Scale,
    Microscope,
    Tv,
    Radio,
    Speaker,
    Headphones,
    Mic,
    MicOff,
    Volume,
    Volume1,
    Volume2,
    VolumeX,
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Rewind,
    FastForward,
    Shuffle,
    Repeat,
    Repeat1,
    PlayCircle,
    PauseCircle,
    StopCircle,
    PlaySquare,
  };

interface CategorySelectorProps {
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  categories?: Category[];
  categoryStats?: { [key: string]: any };
  showDocumentCount?: boolean;
  multiSelect?: boolean;
  showManageButtons?: boolean;
  compactMode?: boolean; // 사이드바용 컴팩트 모드 추가
}

export function CategorySelector({
  selectedCategories,
  onCategoryChange,
  categories: externalCategories,
  categoryStats: externalCategoryStats,
  showDocumentCount = false,
  multiSelect = true,
  showManageButtons = false,
  compactMode = false,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryStats, setCategoryStats] = useState<{ [key: string]: any }>(
    {}
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedCategories, setHasLoadedCategories] = useState(false);

  // 카테고리 데이터 로드 (강화된 중복 호출 방지)
  useEffect(() => {
    const loadCategories = async () => {
      // 중복 호출 방지
      if (hasLoadedCategories) {
        console.log("CategorySelector - 이미 로드됨, 중복 호출 방지");
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // 외부에서 카테고리 데이터가 제공된 경우 사용
        if (externalCategories && externalCategoryStats) {
          setCategories(externalCategories);
          setCategoryStats(externalCategoryStats);
          setIsLoading(false);
          setHasLoadedCategories(true);
          return;
        }

        // 카테고리 목록 로드
        const categoriesData = await categoryAPI.getCategories();

        // 통계 정보는 showDocumentCount가 true일 때만 로드
        let statsData = {};
        if (showDocumentCount) {
          try {
            statsData = await categoryAPI.getCategoryDocumentCounts();
          } catch (error) {
            console.warn("카테고리 통계 로드 실패:", error);
            statsData = {};
          }
        }

        console.log("로드된 카테고리 데이터:", categoriesData);
        setCategories(categoriesData);
        setCategoryStats(statsData);
        setHasLoadedCategories(true);
      } catch (err) {
        console.error("카테고리 로드 실패:", err);
        setError("카테고리를 불러오는데 실패했습니다.");
        // 에러가 발생해도 다시 시도할 수 있도록 hasLoadedCategories는 설정하지 않음
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, []); // 빈 의존성 배열 - 컴포넌트 마운트 시 한 번만 실행

  const handleCategoryToggle = (categoryId: string) => {
    if (multiSelect) {
      const newCategories = selectedCategories.includes(categoryId)
        ? selectedCategories.filter((id) => id !== categoryId)
        : [...selectedCategories, categoryId];
      onCategoryChange(newCategories);
    } else {
      onCategoryChange([categoryId]);
    }
  };

  const handleSelectChange = (value: string) => {
    setSelectedCategory(value);
    if (value) {
      onCategoryChange([value]);
    }
  };

  const getCategoryById = (id: string) => {
    return categories.find((cat) => cat.category_id === id);
  };

  const refreshCategories = async () => {
    setHasLoadedCategories(false);
    try {
      setIsLoading(true);
      setError(null);

      console.log("카테고리 새로고침 시작...");

      // 카테고리 목록 가져오기
      console.log("카테고리 목록 요청 중...");
      const categoriesData = await categoryAPI.getCategories();
      console.log("카테고리 목록 응답:", categoriesData);
      setCategories(categoriesData);

      // 카테고리 통계 가져오기 (실패해도 목록은 표시)
      try {
        console.log("카테고리 통계 요청 중...");
        const statsData = await categoryAPI.getCategoryStats();
        console.log("카테고리 통계 응답:", statsData);
        setCategoryStats(statsData);
      } catch (statsError) {
        console.warn("카테고리 통계 로드 실패, 기본값 사용:", statsError);
        setCategoryStats({});
      }
      setHasLoadedCategories(true);
      console.log("카테고리 새로고침 완료!");
    } catch (error) {
      console.error("카테고리 새로고침 실패 - 상세 정보:", error);
      console.error("에러 타입:", typeof error);

      const errorObj = error as any;
      console.error("에러 메시지:", errorObj?.message);
      console.error("에러 응답:", errorObj?.response);
      console.error("에러 스택:", errorObj?.stack);

      let errorMessage = "카테고리 데이터를 새로고침하는데 실패했습니다.";
      if (errorObj?.response?.status) {
        errorMessage += ` (HTTP ${errorObj.response.status})`;
      }
      if (errorObj?.message) {
        errorMessage += ` - ${errorObj.message}`;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getIconComponent = (iconName?: string) => {
    const iconComponent = iconName ? iconMap[iconName] || FileText : FileText;
    return iconComponent;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">
            카테고리를 불러오는 중...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-center p-4 border border-red-200 rounded-lg bg-red-50">
          <p className="text-red-800">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={refreshCategories}
          >
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 카테고리 관리 버튼 */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshCategories}
          disabled={isLoading}
        >
          <Search className="h-4 w-4 mr-1" />
          새로고침
        </Button>

        {showManageButtons && (
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />새 카테고리
            </Button>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-1" />
              편집
            </Button>
          </div>
        )}
      </div>

      {/* 단일 선택 모드 (드롭다운) */}
      {!multiSelect && (
        <div className="space-y-2">
          <Select value={selectedCategory} onValueChange={handleSelectChange}>
            <SelectTrigger>
              <SelectValue placeholder="카테고리를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => {
                const IconComponent = getIconComponent(category.icon);
                return (
                  <SelectItem
                    key={category.category_id}
                    value={category.category_id}
                  >
                    <div className="flex items-center space-x-2">
                      <IconComponent className="h-4 w-4" />
                      <span>{category.name}</span>
                      {showDocumentCount && (
                        <Badge variant="secondary" className="ml-auto">
                          {categoryStats[category.category_id]
                            ?.document_count || 0}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 다중 선택 모드 (버튼 그리드) */}
      {multiSelect && (
        <div
          className={`grid ${
            compactMode
              ? "grid-cols-1 category-grid-compact" // 컴팩트 모드: 한 줄에 1개 + 최적화 스타일
              : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" // 기본 모드: 반응형
          }`}
        >
          {categories.map((category) => {
            const isSelected = selectedCategories.includes(
              category.category_id
            );
            const IconComponent = getIconComponent(category.icon);
            const colorClass = category.color || "bg-gray-500";
            const textColorClass = colorClass.replace("bg-", "text-");

            return (
              <Button
                key={category.category_id}
                variant="outline"
                size="default"
                className={`h-auto ${
                  compactMode
                    ? "category-card-compact flex items-center space-x-2 text-left justify-start" // 컴팩트 모드: 최적화 스타일
                    : "px-3 py-1.5 flex items-center justify-start transition-all duration-200 ease-in-out transform hover:scale-[1.02]" // 기본 모드: 높이 줄임
                } ${
                  isSelected
                    ? `${colorClass} text-white shadow-md hover:brightness-110 border-transparent`
                    : `bg-muted/50 hover:bg-muted`
                }`}
                onClick={() => handleCategoryToggle(category.category_id)}
              >
                <div
                  className={`flex items-center ${
                    compactMode
                      ? "space-x-2 flex-1 min-w-0" // 컴팩트 모드: 가로 정렬
                      : "space-x-2 flex-1 min-w-0" // 기본 모드: 가로 정렬로 변경
                  }`}
                >
                  <IconComponent
                    className={`${
                      compactMode ? "category-icon" : "h-4 w-4"
                    } flex-shrink-0 ${
                      isSelected ? "text-white" : textColorClass
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`${
                        compactMode
                          ? "category-name"
                          : "text-xs font-medium leading-tight"
                      } ${
                        isSelected ? "text-white" : "text-foreground"
                      } truncate`}
                      title={category.name}
                    >
                      {category.name}
                    </div>
                    {showDocumentCount && !compactMode && (
                      <div className="flex items-center mt-0.5">
                        <Badge
                          variant={isSelected ? "default" : "secondary"}
                          className="text-xs px-1.5 py-0.5 h-5"
                        >
                          {categoryStats[category.category_id]?.document_count || 0}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
                {showDocumentCount && compactMode && (
                  <Badge
                    variant={isSelected ? "default" : "secondary"}
                    className="category-badge ml-2 flex-shrink-0"
                  >
                    {categoryStats[category.category_id]?.document_count || 0}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
