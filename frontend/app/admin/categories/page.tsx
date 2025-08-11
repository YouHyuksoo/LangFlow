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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Factory,
  FileText,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Target,
  Users,
  Code,
  TrendingUp,
  Truck,
  Settings,
  BookOpen,
  CheckCircle,
  Eye,
  BarChart3,
  Calendar,
  Clock,
  RefreshCw,
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
} from "lucide-react";
import { categoryAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import React from "react"; // Added missing import for React

interface Category {
  category_id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  created_at?: string;
  file_count?: number;
  usage_count?: number;
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
  };

// 색상 옵션
const colorOptions = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-red-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-teal-500",
];

export default function CategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingRef, setIsLoadingRef] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    icon: "Factory",
    color: "bg-blue-500",
  });

  // 필터링 및 정렬 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "created_at" | "file_count">(
    "name"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterBy, setFilterBy] = useState<"all" | "with_files" | "empty">(
    "all"
  );

  const loadCategories = async () => {
    // 중복 호출 방지
    if (isLoadingRef) {
      console.log("카테고리 로드 중복 호출 방지");
      return;
    }

    try {
      setIsLoadingRef(true);
      setLoading(true);
      console.log("카테고리 로드 시작...");

      const data = await categoryAPI.getCategories();
      console.log("카테고리 API 응답:", data);
      console.log("응답 타입:", typeof data);
      console.log("응답이 배열인가?", Array.isArray(data));

      // 데이터가 배열인지 확인
      if (!Array.isArray(data)) {
        console.error("카테고리 데이터가 배열이 아닙니다:", data);
        toast({
          title: "데이터 형식 오류",
          description: "카테고리 데이터 형식이 올바르지 않습니다.",
          variant: "destructive",
        });
        return;
      }

      // 백엔드에서 제공하는 document_count를 file_count로 매핑
      const processedCategories: Category[] = data.map(
        (category: Category) => ({
          ...category,
          file_count: (category as any).document_count || 0, // 백엔드의 document_count 사용
          icon: category.icon || "Factory",
          color: category.color || "bg-blue-500",
        })
      );

      console.log("최종 카테고리 데이터:", processedCategories);
      setCategories(processedCategories);
    } catch (error) {
      console.error("카테고리 로드 실패:", error);
      console.error(
        "오류 상세:",
        error instanceof Error ? error.message : error
      );
      toast({
        title: "로드 실패",
        description: "카테고리 목록을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsLoadingRef(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // 필터링 및 정렬 적용
  useEffect(() => {
    let filtered = [...categories];

    // 검색 필터
    if (searchTerm) {
      filtered = filtered.filter(
        (cat) =>
          cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cat.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 상태 필터
    if (filterBy === "with_files") {
      filtered = filtered.filter((cat) => (cat.file_count || 0) > 0);
    } else if (filterBy === "empty") {
      filtered = filtered.filter((cat) => (cat.file_count || 0) === 0);
    }

    // 정렬
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "created_at":
          aValue = new Date(a.created_at || 0);
          bValue = new Date(b.created_at || 0);
          break;
        case "file_count":
          aValue = a.file_count || 0;
          bValue = b.file_count || 0;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredCategories(filtered);
  }, [categories, searchTerm, sortBy, sortOrder, filterBy]);

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      toast({
        title: "입력 오류",
        description: "카테고리 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await categoryAPI.createCategory(newCategory);
      toast({
        title: "카테고리 생성 완료",
        description: `"${newCategory.name}" 카테고리가 성공적으로 생성되었습니다.`,
      });
      setNewCategory({
        name: "",
        description: "",
        icon: "Factory",
        color: "bg-blue-500",
      });
      setIsCreateDialogOpen(false);
      loadCategories();
    } catch (error) {
      toast({
        title: "생성 실패",
        description: "카테고리 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleEditCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      toast({
        title: "입력 오류",
        description: "카테고리 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await categoryAPI.updateCategory(editingCategory.category_id, {
        name: editingCategory.name,
        description: editingCategory.description,
        icon: editingCategory.icon,
        color: editingCategory.color,
      });
      toast({
        title: "카테고리 수정 완료",
        description: `카테고리가 성공적으로 수정되었습니다.`,
      });
      setEditingCategory(null);
      setIsEditDialogOpen(false);
      loadCategories();
    } catch (error) {
      toast({
        title: "수정 실패",
        description: "카테고리 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCategory = async (
    categoryId: string,
    categoryName: string
  ) => {
    if (!confirm(`"${categoryName}" 카테고리를 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await categoryAPI.deleteCategory(categoryId);
      toast({
        title: "카테고리 삭제 완료",
        description: `"${categoryName}" 카테고리가 성공적으로 삭제되었습니다.`,
      });
      loadCategories();
    } catch (error) {
      toast({
        title: "삭제 실패",
        description: "카테고리 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const getIconComponent = (iconName?: string) => {
    return iconName ? iconMap[iconName] || FileText : FileText;
  };

  const getCategoryStats = () => {
    const totalFiles = categories.reduce(
      (sum, cat) => sum + (cat.file_count || 0),
      0
    );
    const emptyCategories = categories.filter(
      (cat) => (cat.file_count || 0) === 0
    ).length;
    const activeCategories = categories.filter(
      (cat) => (cat.file_count || 0) > 0
    ).length;

    return {
      totalCategories: categories.length,
      totalFiles,
      emptyCategories,
      activeCategories,
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">카테고리 관리</h1>
        </div>
        <div className="text-center py-8">
          <div className="animate-pulse">
            <div className="text-muted-foreground">
              카테고리를 불러오는 중...
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = getCategoryStats();

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">카테고리 관리</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadCategories}>
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />새 카테고리
          </Button>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 카테고리</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCategories}</div>
            <p className="text-xs text-muted-foreground">등록된 카테고리 수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 파일 수</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFiles}</div>
            <p className="text-xs text-muted-foreground">
              모든 카테고리의 파일 수
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 카테고리</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCategories}</div>
            <p className="text-xs text-muted-foreground">
              파일이 있는 카테고리
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">빈 카테고리</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.emptyCategories}</div>
            <p className="text-xs text-muted-foreground">
              파일이 없는 카테고리
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 검색 및 필터 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            검색 및 필터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="카테고리 이름 또는 설명으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">정렬</label>
              <Select
                value={`${sortBy}-${sortOrder}`}
                onValueChange={(value) => {
                  const [sort, order] = value.split("-");
                  setSortBy(sort as any);
                  setSortOrder(order as any);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">이름 (오름차순)</SelectItem>
                  <SelectItem value="name-desc">이름 (내림차순)</SelectItem>
                  <SelectItem value="created_at-desc">최신순</SelectItem>
                  <SelectItem value="created_at-asc">오래된순</SelectItem>
                  <SelectItem value="file_count-desc">파일 많은순</SelectItem>
                  <SelectItem value="file_count-asc">파일 적은순</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">필터</label>
              <Select
                value={filterBy}
                onValueChange={(value) => setFilterBy(value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="with_files">파일 있는 카테고리</SelectItem>
                  <SelectItem value="empty">빈 카테고리</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 카테고리 목록 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCategories.map((category) => {
          const IconComponent = getIconComponent(category.icon);

          return (
            <Card
              key={category.category_id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-2 rounded-full ${
                        category.color || "bg-blue-500"
                      } text-white`}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <span className="truncate">{category.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCategory(category);
                        setIsDetailDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingCategory(category);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleDeleteCategory(
                          category.category_id,
                          category.name
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  {category.description || "설명이 없습니다."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge
                    variant={
                      category.file_count && category.file_count > 0
                        ? "default"
                        : "secondary"
                    }
                  >
                    {category.file_count || 0}개 파일
                  </Badge>
                  {category.created_at && (
                    <span className="text-sm text-muted-foreground">
                      {new Date(category.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredCategories.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="text-center py-8">
              <Factory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || filterBy !== "all"
                  ? "검색 조건에 맞는 카테고리가 없습니다."
                  : "등록된 카테고리가 없습니다."}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />첫 번째 카테고리 만들기
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 카테고리 생성 다이얼로그 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>새 카테고리 생성</DialogTitle>
            <DialogDescription>
              새로운 파일 카테고리를 생성합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">카테고리 이름 *</label>
              <Input
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, name: e.target.value })
                }
                placeholder="카테고리 이름을 입력하세요"
              />
            </div>
            <div>
              <label className="text-sm font-medium">설명</label>
              <Textarea
                value={newCategory.description}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    description: e.target.value,
                  })
                }
                placeholder="카테고리 설명을 입력하세요"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">아이콘</label>
                <Select
                  value={newCategory.icon}
                  onValueChange={(value) =>
                    setNewCategory({ ...newCategory, icon: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(iconMap).map((icon) => {
                      const IconComponent = getIconComponent(
                        icon || "FileText"
                      );
                      return (
                        <SelectItem key={icon} value={icon}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            <span>{icon}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">색상</label>
                <Select
                  value={newCategory.color}
                  onValueChange={(value) =>
                    setNewCategory({ ...newCategory, color: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color} value={color}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${color}`} />
                          <span>
                            {color.replace("bg-", "").replace("-500", "")}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewCategory({
                  name: "",
                  description: "",
                  icon: "Factory",
                  color: "bg-blue-500",
                });
                setIsCreateDialogOpen(false);
              }}
            >
              <X className="h-4 w-4 mr-2" />
              취소
            </Button>
            <Button onClick={handleCreateCategory}>
              <Save className="h-4 w-4 mr-2" />
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 카테고리 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>카테고리 수정</DialogTitle>
            <DialogDescription>카테고리 정보를 수정합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">카테고리 이름 *</label>
              <Input
                value={editingCategory?.name || ""}
                onChange={(e) =>
                  setEditingCategory((prev) =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
                placeholder="카테고리 이름을 입력하세요"
              />
            </div>
            <div>
              <label className="text-sm font-medium">설명</label>
              <Textarea
                value={editingCategory?.description || ""}
                onChange={(e) =>
                  setEditingCategory((prev) =>
                    prev ? { ...prev, description: e.target.value } : null
                  )
                }
                placeholder="카테고리 설명을 입력하세요"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">아이콘</label>
                <Select
                  value={editingCategory?.icon || "Factory"}
                  onValueChange={(value) =>
                    setEditingCategory((prev) =>
                      prev ? { ...prev, icon: value } : null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(iconMap).map((icon) => {
                      const IconComponent = getIconComponent(
                        icon || "FileText"
                      );
                      return (
                        <SelectItem key={icon} value={icon}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            <span>{icon}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">색상</label>
                <Select
                  value={editingCategory?.color || "bg-blue-500"}
                  onValueChange={(value) =>
                    setEditingCategory((prev) =>
                      prev ? { ...prev, color: value } : null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color} value={color}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${color}`} />
                          <span>
                            {color.replace("bg-", "").replace("-500", "")}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingCategory(null);
                setIsEditDialogOpen(false);
              }}
            >
              <X className="h-4 w-4 mr-2" />
              취소
            </Button>
            <Button onClick={handleEditCategory}>
              <Save className="h-4 w-4 mr-2" />
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 카테고리 상세 보기 다이얼로그 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCategory && (
                <>
                  <div
                    className={`p-2 rounded-full ${
                      selectedCategory.color || "bg-blue-500"
                    } text-white`}
                  >
                    {React.createElement(
                      getIconComponent(selectedCategory.icon || "FileText"),
                      { className: "h-4 w-4" }
                    )}
                  </div>
                  {selectedCategory.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              카테고리 상세 정보를 확인합니다.
            </DialogDescription>
          </DialogHeader>
          {selectedCategory && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">카테고리 이름</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedCategory.name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">파일 수</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedCategory.file_count || 0}개
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">생성일</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedCategory.created_at
                      ? new Date(
                          selectedCategory.created_at
                        ).toLocaleDateString()
                      : "알 수 없음"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">아이콘</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedCategory.icon || "Factory"}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">설명</label>
                <p className="text-sm text-muted-foreground">
                  {selectedCategory.description || "설명이 없습니다."}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDetailDialogOpen(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
