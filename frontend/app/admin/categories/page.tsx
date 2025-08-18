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
import { Label } from "@/components/ui/label";
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
import React from "react";

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

const colorOptions = [
  "bg-slate-500",
  "bg-gray-500",
  "bg-zinc-500",
  "bg-neutral-500",
  "bg-stone-500",
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-sky-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500",
  "bg-fuchsia-500",
  "bg-pink-500",
  "bg-rose-500",
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
    color: "bg-primary",
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
    if (isLoadingRef) return;

    try {
      setIsLoadingRef(true);
      setLoading(true);
      const data = await categoryAPI.getCategories();

      if (!Array.isArray(data)) {
        toast({
          title: "데이터 형식 오류",
          description: "카테고리 데이터 형식이 올바르지 않습니다.",
          variant: "destructive",
        });
        return;
      }

      const processedCategories: Category[] = data.map(
        (category: Category) => ({
          ...category,
          file_count: (category as any).document_count || 0,
          icon: category.icon || "Factory",
          color: category.color || "bg-primary",
        })
      );

      setCategories(processedCategories);
    } catch (error) {
      console.error("카테고리 로드 실패:", error);
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

  useEffect(() => {
    let filtered = [...categories];

    if (searchTerm) {
      filtered = filtered.filter(
        (cat) =>
          cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cat.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterBy === "with_files") {
      filtered = filtered.filter((cat) => (cat.file_count || 0) > 0);
    } else if (filterBy === "empty") {
      filtered = filtered.filter((cat) => (cat.file_count || 0) === 0);
    }

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
      toast({ title: "입력 오류", description: "카테고리 이름을 입력해주세요.", variant: "destructive" });
      return;
    }
    try {
      await categoryAPI.createCategory(newCategory);
      toast({ title: "카테고리 생성 완료", description: `"${newCategory.name}" 카테고리가 성공적으로 생성되었습니다.` });
      setNewCategory({ name: "", description: "", icon: "Factory", color: "bg-primary" });
      setIsCreateDialogOpen(false);
      loadCategories();
    } catch (error) {
      toast({ title: "생성 실패", description: "카테고리 생성 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const handleEditCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      toast({ title: "입력 오류", description: "카테고리 이름을 입력해주세요.", variant: "destructive" });
      return;
    }
    try {
      await categoryAPI.updateCategory(editingCategory.category_id, { ...editingCategory });
      toast({ title: "카테고리 수정 완료", description: `카테고리가 성공적으로 수정되었습니다.` });
      setEditingCategory(null);
      setIsEditDialogOpen(false);
      loadCategories();
    } catch (error) {
      toast({ title: "수정 실패", description: "카테고리 수정 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`"${categoryName}" 카테고리를 정말 삭제하시겠습니까?`)) return;
    try {
      await categoryAPI.deleteCategory(categoryId);
      toast({ title: "카테고리 삭제 완료", description: `"${categoryName}" 카테고리가 성공적으로 삭제되었습니다.` });
      loadCategories();
    } catch (error) {
      toast({ title: "삭제 실패", description: "카테고리 삭제 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const getIconComponent = (iconName?: string) => iconName ? iconMap[iconName] || FileText : FileText;

  const stats = {
    totalCategories: categories.length,
    totalFiles: categories.reduce((sum, cat) => sum + (cat.file_count || 0), 0),
    emptyCategories: categories.filter((cat) => (cat.file_count || 0) === 0).length,
    activeCategories: categories.filter((cat) => (cat.file_count || 0) > 0).length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">카테고리 관리</h1>
        <div className="text-center py-8 text-muted-foreground">카테고리를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">카테고리 관리</h1>
          <p className="text-muted-foreground">파일 분류를 위한 카테고리를 생성하고 관리하세요.</p>
        </div>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card relative overflow-hidden"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">전체 카테고리</CardTitle><Factory className="h-4 w-4 text-purple-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalCategories}</div></CardContent></Card>
        <Card className="stat-card relative overflow-hidden"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">총 파일 수</CardTitle><FileText className="h-4 w-4 text-blue-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalFiles}</div></CardContent></Card>
        <Card className="stat-card relative overflow-hidden"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">활성 카테고리</CardTitle><CheckCircle className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.activeCategories}</div></CardContent></Card>
        <Card className="stat-card relative overflow-hidden"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">빈 카테고리</CardTitle><Clock className="h-4 w-4 text-orange-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.emptyCategories}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>검색 및 필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>검색</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-500" />
                <Input placeholder="이름 또는 설명으로 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>정렬</Label>
              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => { const [sort, order] = value.split("-"); setSortBy(sort as any); setSortOrder(order as any); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>필터</Label>
              <Select value={filterBy} onValueChange={(value) => setFilterBy(value as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCategories.map((category) => {
          const IconComponent = getIconComponent(category.icon);
          return (
            <Card key={category.category_id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-full ${category.color || "bg-primary"} text-primary-foreground`}><IconComponent className="h-4 w-4" /></div>
                    <span className="truncate">{category.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedCategory(category); setIsDetailDialogOpen(true); }}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingCategory(category); setIsEditDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(category.category_id, category.name)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardTitle>
                <CardDescription>{category.description || "설명이 없습니다."}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant={(category.file_count || 0) > 0 ? "default" : "secondary"}>{category.file_count || 0}개 파일</Badge>
                  {category.created_at && <span className="text-sm text-muted-foreground">{new Date(category.created_at).toLocaleDateString()}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredCategories.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground mb-4">{searchTerm || filterBy !== "all" ? "검색 조건에 맞는 카테고리가 없습니다." : "등록된 카테고리가 없습니다."}</p>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />첫 번째 카테고리 만들기</Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>새 카테고리 생성</DialogTitle><DialogDescription>새로운 파일 카테고리를 생성합니다.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>카테고리 이름 *</Label><Input value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} placeholder="카테고리 이름을 입력하세요" /></div>
            <div><Label>설명</Label><Textarea value={newCategory.description} onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} placeholder="카테고리 설명을 입력하세요" rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>아이콘</Label><Select value={newCategory.icon} onValueChange={(value) => setNewCategory({ ...newCategory, icon: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(iconMap).map((icon) => { const IconComponent = getIconComponent(icon); return (<SelectItem key={icon} value={icon}><div className="flex items-center gap-2"><IconComponent className="h-4 w-4" /><span>{icon}</span></div></SelectItem>);})}</SelectContent></Select></div>
              <div><Label>색상</Label><Select value={newCategory.color} onValueChange={(value) => setNewCategory({ ...newCategory, color: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{colorOptions.map((color) => (<SelectItem key={color} value={color}><div className="flex items-center gap-2"><div className={`w-4 h-4 rounded ${color}`} /><span>{color.replace("bg-", "").replace("-500", "")}</span></div></SelectItem>))}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}><X className="h-4 w-4 mr-2" />취소</Button><Button onClick={handleCreateCategory}><Save className="h-4 w-4 mr-2" />생성</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>카테고리 수정</DialogTitle><DialogDescription>카테고리 정보를 수정합니다.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>카테고리 이름 *</Label><Input value={editingCategory?.name || ""} onChange={(e) => setEditingCategory((prev) => prev ? { ...prev, name: e.target.value } : null)} placeholder="카테고리 이름을 입력하세요" /></div>
            <div><Label>설명</Label><Textarea value={editingCategory?.description || ""} onChange={(e) => setEditingCategory((prev) => prev ? { ...prev, description: e.target.value } : null)} placeholder="카테고리 설명을 입력하세요" rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>아이콘</Label><Select value={editingCategory?.icon || "Factory"} onValueChange={(value) => setEditingCategory((prev) => prev ? { ...prev, icon: value } : null)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(iconMap).map((icon) => { const IconComponent = getIconComponent(icon); return (<SelectItem key={icon} value={icon}><div className="flex items-center gap-2"><IconComponent className="h-4 w-4" /><span>{icon}</span></div></SelectItem>);})}</SelectContent></Select></div>
              <div><Label>색상</Label><Select value={editingCategory?.color || "bg-primary"} onValueChange={(value) => setEditingCategory((prev) => prev ? { ...prev, color: value } : null)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{colorOptions.map((color) => (<SelectItem key={color} value={color}><div className="flex items-center gap-2"><div className={`w-4 h-4 rounded ${color}`} /><span>{color.replace("bg-", "").replace("-500", "")}</span></div></SelectItem>))}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsEditDialogOpen(false)}><X className="h-4 w-4 mr-2" />취소</Button><Button onClick={handleEditCategory}><Save className="h-4 w-4 mr-2" />저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedCategory?.name}</DialogTitle><DialogDescription>카테고리 상세 정보를 확인합니다.</DialogDescription></DialogHeader>
          {selectedCategory && <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>파일 수</Label><p>{selectedCategory.file_count || 0}개</p></div>
              <div><Label>생성일</Label><p>{selectedCategory.created_at ? new Date(selectedCategory.created_at).toLocaleDateString() : "알 수 없음"}</p></div>
            </div>
            <div><Label>설명</Label><p>{selectedCategory.description || "설명이 없습니다."}</p></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>닫기</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
