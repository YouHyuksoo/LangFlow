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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  UserPlus,
  Shield,
  Clock,
  Activity,
  Edit,
  Trash2,
  Mail,
  User,
  Calendar,
  Bot,
  UserCheck,
  UserX,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { userAPI, personaAPI, categoryAPI } from "@/lib/api";

interface User {
  user_id: string;
  username: string;
  email: string;
  full_name?: string;
  persona: string;
  interest_areas: string[];
  role: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface Persona {
  persona_id: string;
  name: string;
  description?: string;
  system_message?: string;
}

interface InterestArea {
  area_id: string;
  name: string;
  description?: string;
  category_ids: string[];
}

interface Category {
  category_id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [interestAreas, setInterestAreas] = useState<InterestArea[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // 페르소나 관리 상태
  const [personaDialogOpen, setPersonaDialogOpen] = useState(false);
  const [editPersonaDialogOpen, setEditPersonaDialogOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [newPersona, setNewPersona] = useState({
    name: "",
    description: "",
    system_message: "",
  });
  const [editPersona, setEditPersona] = useState({
    name: "",
    description: "",
    system_message: "",
  });

  // Form state
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    persona: "general",
    role: "user",
    interest_areas: [] as string[],
  });

  const [editUser, setEditUser] = useState({
    username: "",
    email: "",
    full_name: "",
    persona: "general",
    role: "user",
    interest_areas: [] as string[],
  });

  // Load data
  useEffect(() => {
    loadUsers();
    loadPersonas();
    loadInterestAreas();
    loadCategories();
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = await userAPI.getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error("사용자 목록 로딩 실패:", error);
      toast({
        title: "오류",
        description: "사용자 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPersonas = async () => {
    try {
      const personasData = await personaAPI.getPersonas();
      setPersonas(personasData);
    } catch (error) {
      console.error("페르소나 목록 로딩 실패:", error);
    }
  };

  const loadInterestAreas = async () => {
    try {
      const areasData = await userAPI.getInterestAreas();
      setInterestAreas(areasData);
    } catch (error) {
      console.error("관심 영역 목록 로딩 실패:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const categoriesData = await categoryAPI.getCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error("카테고리 목록 로딩 실패:", error);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!newUser.username || !newUser.email || !newUser.password) {
        toast({
          title: "입력 오류",
          description: "필수 항목을 모두 입력해주세요.",
          variant: "destructive",
        });
        return;
      }

      await userAPI.createUser(newUser);
      
      toast({
        title: "성공",
        description: "새 사용자가 생성되었습니다.",
      });

      setCreateDialogOpen(false);
      setNewUser({
        username: "",
        email: "",
        password: "",
        full_name: "",
        persona: "general",
        role: "user",
        interest_areas: [],
      });
      
      loadUsers();
    } catch (error: any) {
      console.error("사용자 생성 실패:", error);
      toast({
        title: "생성 실패",
        description: error.response?.data?.detail || "사용자 생성에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      await userAPI.updateUser(selectedUser.user_id, editUser);
      
      toast({
        title: "성공",
        description: "사용자 정보가 업데이트되었습니다.",
      });

      setEditDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      console.error("사용자 업데이트 실패:", error);
      toast({
        title: "업데이트 실패",
        description: error.response?.data?.detail || "사용자 정보 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await userAPI.deleteUser(userId);
      
      toast({
        title: "성공",
        description: "사용자가 삭제되었습니다.",
      });
      
      loadUsers();
    } catch (error: any) {
      console.error("사용자 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: error.response?.data?.detail || "사용자 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditUser({
      username: user.username,
      email: user.email,
      full_name: user.full_name || "",
      persona: user.persona,
      role: user.role,
      interest_areas: user.interest_areas,
    });
    setEditDialogOpen(true);
  };

  // 페르소나 관리 함수들
  const handleCreatePersona = async () => {
    try {
      if (!newPersona.name) {
        toast({
          title: "입력 오류",
          description: "페르소나 이름을 입력해주세요.",
          variant: "destructive",
        });
        return;
      }

      await personaAPI.createPersona(newPersona);
      
      toast({
        title: "성공",
        description: "새 페르소나가 생성되었습니다.",
      });

      setPersonaDialogOpen(false);
      setNewPersona({
        name: "",
        description: "",
        system_message: "",
      });
      
      loadPersonas();
    } catch (error: any) {
      console.error("페르소나 생성 실패:", error);
      toast({
        title: "생성 실패",
        description: error.response?.data?.detail || "페르소나 생성에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleEditPersona = async () => {
    if (!selectedPersona) return;

    try {
      await personaAPI.updatePersona(selectedPersona.persona_id, editPersona);
      
      toast({
        title: "성공",
        description: "페르소나 정보가 업데이트되었습니다.",
      });

      setEditPersonaDialogOpen(false);
      setSelectedPersona(null);
      loadPersonas();
    } catch (error: any) {
      console.error("페르소나 업데이트 실패:", error);
      toast({
        title: "업데이트 실패",
        description: error.response?.data?.detail || "페르소나 정보 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeletePersona = async (personaId: string) => {
    try {
      await personaAPI.deletePersona(personaId);
      
      toast({
        title: "성공",
        description: "페르소나가 삭제되었습니다.",
      });
      
      loadPersonas();
    } catch (error: any) {
      console.error("페르소나 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: error.response?.data?.detail || "페르소나 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const openEditPersonaDialog = (persona: Persona) => {
    setSelectedPersona(persona);
    setEditPersona({
      name: persona.name,
      description: persona.description || "",
      system_message: persona.system_message || "",
    });
    setEditPersonaDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPersonaName = (personaId: string) => {
    const persona = personas.find(p => p.persona_id === personaId);
    return persona?.name || personaId;
  };

  const getCategoryNames = (categoryIds: string[]) => {
    return categoryIds.map(id => {
      const category = categories.find(c => c.category_id === id);
      return category?.name || id;
    }).join(", ");
  };

  const getInterestAreaNames = (areaIds: string[]) => {
    return areaIds.map(id => {
      const area = interestAreas.find(a => a.area_id === id);
      return area?.name || id;
    }).join(", ");
  };

  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.is_active).length,
    adminUsers: users.filter(u => u.username === "admin").length,
    recentUsers: users.filter(u => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return new Date(u.created_at) > oneWeekAgo;
    }).length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">사용자 관리</h1>
        </div>
        <div className="text-center py-8">
          <div className="animate-pulse">
            <div className="text-muted-foreground">사용자 정보를 불러오는 중...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">사용자 관리</h1>
        <div className="flex gap-2">
          <Dialog open={personaDialogOpen} onOpenChange={setPersonaDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Bot className="h-4 w-4 mr-2" />
                새 페르소나
              </Button>
            </DialogTrigger>
          </Dialog>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                새 사용자
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* 탭 구조 */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">사용자 관리</TabsTrigger>
          <TabsTrigger value="pending">승인 대기</TabsTrigger>
          <TabsTrigger value="personas">페르소나 관리</TabsTrigger>
        </TabsList>

        {/* 사용자 관리 탭 */}
        <TabsContent value="users" className="space-y-6">
          {/* 통계 카드들 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">전체 사용자</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">등록된 사용자 수</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">활성 사용자</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeUsers}</div>
                <p className="text-xs text-muted-foreground">활성 상태 사용자</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">관리자</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.adminUsers}</div>
                <p className="text-xs text-muted-foreground">관리자 계정 수</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">신규 사용자</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.recentUsers}</div>
                <p className="text-xs text-muted-foreground">최근 1주일 가입</p>
              </CardContent>
            </Card>
          </div>

          {/* 사용자 목록 */}
          <Card>
            <CardHeader>
              <CardTitle>사용자 목록</CardTitle>
              <CardDescription>
                등록된 모든 사용자를 관리할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar>
                        <AvatarFallback className="bg-primary/10">
                          {(user.full_name || user.username).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-semibold">
                            {user.full_name || user.username}
                          </h4>
                          <Badge variant={user.is_active ? "default" : "secondary"}>
                            {user.is_active ? "활성" : "비활성"}
                          </Badge>
                          <Badge variant={user.role === "admin" ? "destructive" : "outline"}>
                            {user.role === "admin" ? "관리자" : "일반사용자"}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <User className="h-3 w-3" />
                            <span>{user.username}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Mail className="h-3 w-3" />
                            <span>{user.email}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(user.created_at)}</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          페르소나: {getPersonaName(user.persona)}
                          {user.interest_areas.length > 0 && (
                            <span className="ml-2">
                              관심 분야: {getCategoryNames(user.interest_areas)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {user.username !== "admin" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>사용자 삭제</AlertDialogTitle>
                              <AlertDialogDescription>
                                정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.user_id)}
                              >
                                삭제
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 승인 대기 탭 */}
        <TabsContent value="pending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>승인 대기 사용자</CardTitle>
              <CardDescription>
                회원가입 신청을 한 사용자들의 승인 대기 목록입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PendingUsersSection />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 페르소나 관리 탭 */}
        <TabsContent value="personas" className="space-y-6">
          {/* 페르소나 목록 */}
          <Card>
            <CardHeader>
              <CardTitle>페르소나 목록</CardTitle>
              <CardDescription>
                사용자의 AI 페르소나를 관리합니다. 각 페르소나는 시스템 메시지를 포함합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {personas.map((persona) => (
                  <div
                    key={persona.persona_id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar>
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {persona.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-semibold">{persona.name}</h4>
                          <Badge variant="outline">페르소나</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {persona.description || "설명 없음"}
                        </p>
                        {persona.system_message && (
                          <p className="text-xs text-muted-foreground max-w-md truncate">
                            시스템 메시지: {persona.system_message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditPersonaDialog(persona)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>페르소나 삭제</AlertDialogTitle>
                            <AlertDialogDescription>
                              정말로 이 페르소나를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeletePersona(persona.persona_id)}
                            >
                              삭제
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 새 사용자 생성 다이얼로그 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>새 사용자 생성</DialogTitle>
            <DialogDescription>
              새로운 사용자 계정을 생성합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                사용자명*
              </Label>
              <Input
                id="username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                이메일*
              </Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                비밀번호*
              </Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="full_name" className="text-right">
                이름
              </Label>
              <Input
                id="full_name"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="persona" className="text-right">
                페르소나
              </Label>
              <Select value={newUser.persona} onValueChange={(value) => setNewUser({ ...newUser, persona: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {personas.map((persona) => (
                    <SelectItem key={persona.persona_id} value={persona.persona_id}>
                      {persona.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                사용자 등급*
              </Label>
              <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">일반 사용자</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleCreateUser}>
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 편집 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>사용자 정보 수정</DialogTitle>
            <DialogDescription>
              사용자 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_username" className="text-right">
                사용자명
              </Label>
              <Input
                id="edit_username"
                value={editUser.username}
                onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_email" className="text-right">
                이메일
              </Label>
              <Input
                id="edit_email"
                type="email"
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_full_name" className="text-right">
                이름
              </Label>
              <Input
                id="edit_full_name"
                value={editUser.full_name}
                onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_persona" className="text-right">
                페르소나
              </Label>
              <Select value={editUser.persona} onValueChange={(value) => setEditUser({ ...editUser, persona: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {personas.map((persona) => (
                    <SelectItem key={persona.persona_id} value={persona.persona_id}>
                      {persona.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_role" className="text-right">
                사용자 등급
              </Label>
              <Select value={editUser.role} onValueChange={(value) => setEditUser({ ...editUser, role: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">일반 사용자</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleEditUser}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 새 페르소나 생성 다이얼로그 */}
      <Dialog open={personaDialogOpen} onOpenChange={setPersonaDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>새 페르소나 생성</DialogTitle>
            <DialogDescription>
              새로운 AI 페르소나를 생성합니다. 시스템 메시지는 AI의 기본 동작을 정의합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="persona_name" className="text-right">
                페르소나 이름*
              </Label>
              <Input
                id="persona_name"
                value={newPersona.name}
                onChange={(e) => setNewPersona({ ...newPersona, name: e.target.value })}
                className="col-span-3"
                placeholder="예: 전문가, 친구, 선생님"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="persona_description" className="text-right">
                설명
              </Label>
              <Input
                id="persona_description"
                value={newPersona.description}
                onChange={(e) => setNewPersona({ ...newPersona, description: e.target.value })}
                className="col-span-3"
                placeholder="페르소나에 대한 간단한 설명"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="system_message" className="text-right pt-2">
                시스템 메시지*
              </Label>
              <Textarea
                id="system_message"
                value={newPersona.system_message}
                onChange={(e) => setNewPersona({ ...newPersona, system_message: e.target.value })}
                className="col-span-3"
                placeholder="AI의 기본 동작과 성격을 정의하는 시스템 메시지를 입력하세요..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleCreatePersona}>
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 페르소나 편집 다이얼로그 */}
      <Dialog open={editPersonaDialogOpen} onOpenChange={setEditPersonaDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>페르소나 정보 수정</DialogTitle>
            <DialogDescription>
              페르소나 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_persona_name" className="text-right">
                페르소나 이름*
              </Label>
              <Input
                id="edit_persona_name"
                value={editPersona.name}
                onChange={(e) => setEditPersona({ ...editPersona, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_persona_description" className="text-right">
                설명
              </Label>
              <Input
                id="edit_persona_description"
                value={editPersona.description}
                onChange={(e) => setEditPersona({ ...editPersona, description: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit_system_message" className="text-right pt-2">
                시스템 메시지*
              </Label>
              <Textarea
                id="edit_system_message"
                value={editPersona.system_message}
                onChange={(e) => setEditPersona({ ...editPersona, system_message: e.target.value })}
                className="col-span-3"
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleEditPersona}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 승인 대기 사용자 관리 컴포넌트
function PendingUsersSection() {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getPendingUsers();
      setPendingUsers(response);
    } catch (error) {
      console.error('승인 대기 사용자 조회 실패:', error);
      toast({
        title: "오류",
        description: "승인 대기 사용자 목록을 불러오지 못했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const categoriesData = await categoryAPI.getCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error("카테고리 목록 로딩 실패:", error);
    }
  };

  const getCategoryNames = (categoryIds: string[]) => {
    return categoryIds.map(id => {
      const category = categories.find(c => c.category_id === id);
      return category?.name || id;
    }).join(", ");
  };

  const handleApprove = async (userId: string) => {
    try {
      await userAPI.approveUser(userId);
      toast({
        title: "승인 완료",
        description: "사용자가 승인되었습니다.",
      });
      fetchPendingUsers(); // 목록 새로고침
    } catch (error) {
      console.error('사용자 승인 실패:', error);
      toast({
        title: "오류",
        description: "사용자 승인 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await userAPI.rejectUser(userId);
      toast({
        title: "거부 완료",
        description: "사용자 신청이 거부되었습니다.",
      });
      fetchPendingUsers(); // 목록 새로고침
    } catch (error) {
      console.error('사용자 거부 실패:', error);
      toast({
        title: "오류",
        description: "사용자 거부 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchPendingUsers();
    loadCategories();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">승인 대기 사용자 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (pendingUsers.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">승인 대기 중인 사용자가 없습니다</h3>
        <p className="text-muted-foreground">새로운 회원가입 신청이 있으면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingUsers.map((user) => (
        <Card key={user.user_id} className="border-l-4 border-l-yellow-400">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-yellow-100 text-yellow-700">
                    {user.full_name ? user.full_name[0].toUpperCase() : user.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{user.full_name || user.username}</h3>
                  <p className="text-sm text-muted-foreground">{user.username}</p>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(user.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  {user.interest_areas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="outline" className="text-xs">
                        관심 분야: {getCategoryNames(user.interest_areas)}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50">
                  <Clock className="h-3 w-3 mr-1" />
                  승인 대기
                </Badge>
                <div className="flex gap-2 ml-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50">
                        <UserCheck className="h-4 w-4 mr-1" />
                        승인
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>사용자 승인</AlertDialogTitle>
                        <AlertDialogDescription>
                          <strong>{user.full_name || user.username}</strong> 사용자를 승인하시겠습니까?
                          승인된 사용자는 즉시 시스템을 이용할 수 있습니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleApprove(user.user_id)} className="bg-green-600 hover:bg-green-700">
                          승인
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        <UserX className="h-4 w-4 mr-1" />
                        거부
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>사용자 거부</AlertDialogTitle>
                        <AlertDialogDescription>
                          <strong>{user.full_name || user.username}</strong> 사용자의 가입 신청을 거부하시겠습니까?
                          거부된 사용자는 시스템에 로그인할 수 없습니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleReject(user.user_id)} className="bg-red-600 hover:bg-red-700">
                          거부
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
