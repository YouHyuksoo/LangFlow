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
}

export function CategorySelector({
  selectedCategories,
  onCategoryChange,
  categories: externalCategories,
  categoryStats: externalCategoryStats,
  showDocumentCount = false,
  multiSelect = true,
  showManageButtons = false,
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
            onClick={() => window.location.reload()}
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
      {showManageButtons && (
        <div className="flex justify-end space-x-2">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />새 카테고리
          </Button>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-1" />
            편집
          </Button>
        </div>
      )}

      {/* 단일 선택 모드 (드롭다운) */}
      {!multiSelect && (
        <div className="space-y-2">
          <label className="text-sm font-medium">카테고리 선택</label>
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
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
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
                size="sm"
                className={`h-auto px-2.5 py-1.5 flex items-center justify-start space-x-2 transition-all duration-200 ease-in-out transform hover:scale-105 ${
                  isSelected
                    ? `${colorClass} text-white shadow-md hover:brightness-110 border-transparent`
                    : `bg-muted/50 hover:bg-muted`
                }`}
                onClick={() => handleCategoryToggle(category.category_id)}
              >
                <IconComponent className={`h-4 w-4 flex-shrink-0 ${
                    isSelected ? 'text-white' : textColorClass
                  }`} 
                />
                <span className={`text-xs font-medium truncate ${
                    isSelected ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {category.name}
                </span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
