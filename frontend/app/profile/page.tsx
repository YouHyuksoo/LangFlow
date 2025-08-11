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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { userAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getAvatarUrl } from "@/lib/config";
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Upload, 
  Lock, 
  Save,
  ArrowLeft,
  Eye,
  EyeOff
} from "lucide-react";

interface UserProfile {
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  persona: string;
  interest_areas: string[];
  created_at: string;
  avatar_url?: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // 프로필 수정 폼 상태
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    email: ""
  });
  
  // 비밀번호 변경 폼 상태
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  
  // 아바타 업로드 상태
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");

  const router = useRouter();
  const { toast } = useToast();

  // 사용자 정보 로드
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        // 세션 체크
        const sessionCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('session_id='));
        
        if (!sessionCookie) {
          router.push('/login?redirect=/profile');
          return;
        }

        const userInfo = await userAPI.getCurrentUser();
        setUser(userInfo);
        setProfileForm({
          full_name: userInfo.full_name,
          email: userInfo.email
        });
        setAvatarPreview(""); // 서버에서 온 avatar_url은 미리보기가 아님
      } catch (error) {
        console.error('프로필 로드 실패:', error);
        toast({
          title: "오류",
          description: "프로필 정보를 불러올 수 없습니다.",
          variant: "destructive",
        });
        router.push('/login?redirect=/profile');
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [router, toast]);

  // 아바타 파일 선택 처리
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 파일 크기 체크 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "파일 크기 초과",
          description: "이미지 파일은 5MB 이하여야 합니다.",
          variant: "destructive",
        });
        return;
      }

      // 파일 타입 체크
      if (!file.type.startsWith('image/')) {
        toast({
          title: "잘못된 파일 형식",
          description: "이미지 파일만 업로드 가능합니다.",
          variant: "destructive",
        });
        return;
      }

      setAvatarFile(file);
      
      // 미리보기 설정
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 프로필 정보 업데이트
  const handleProfileUpdate = async () => {
    if (!user) return;
    
    setUpdating(true);
    try {
      await userAPI.updateProfile({
        full_name: profileForm.full_name,
        email: profileForm.email
      });

      // 아바타 업로드가 있는 경우
      if (avatarFile) {
        await userAPI.uploadAvatar(avatarFile);
      }

      // 사용자 정보 다시 로드
      const updatedUser = await userAPI.getCurrentUser();
      setUser(updatedUser);
      setAvatarFile(null);
      setAvatarPreview(""); // 미리보기 초기화

      toast({
        title: "성공",
        description: "프로필이 성공적으로 업데이트되었습니다.",
      });
    } catch (error) {
      console.error('프로필 업데이트 실패:', error);
      toast({
        title: "오류",
        description: "프로필 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  // 비밀번호 변경
  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "비밀번호 불일치",
        description: "새 비밀번호와 확인 비밀번호가 일치하지 않습니다.",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "비밀번호 길이",
        description: "새 비밀번호는 최소 6자 이상이어야 합니다.",
        variant: "destructive",
      });
      return;
    }

    setUpdating(true);
    try {
      await userAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });

      toast({
        title: "성공",
        description: "비밀번호가 성공적으로 변경되었습니다.",
      });
    } catch (error) {
      console.error('비밀번호 변경 실패:', error);
      toast({
        title: "오류",
        description: "비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인해주세요.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">프로필을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">사용자 정보를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <h1 className="text-3xl font-bold">프로필 설정</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 왼쪽: 사용자 정보 카드 */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage 
                        src={avatarPreview || getAvatarUrl(user.avatar_url)} 
                        alt={user.full_name} 
                      />
                      <AvatarFallback className="text-2xl">
                        {user.full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 -right-2">
                      <Label htmlFor="avatar-upload" className="cursor-pointer">
                        <div className="bg-primary text-primary-foreground rounded-full p-2 hover:bg-primary/80 transition-colors">
                          <Upload className="h-4 w-4" />
                        </div>
                      </Label>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                    </div>
                  </div>
                  <CardTitle>{user.full_name}</CardTitle>
                  <CardDescription>@{user.username}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{user.email}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm capitalize">{user.role}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{user.persona}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 오른쪽: 설정 폼들 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 프로필 정보 수정 */}
            <Card>
              <CardHeader>
                <CardTitle>프로필 정보</CardTitle>
                <CardDescription>
                  기본 프로필 정보를 수정할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">이름</Label>
                  <Input
                    id="full_name"
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm(prev => ({
                      ...prev,
                      full_name: e.target.value
                    }))}
                    placeholder="이름을 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm(prev => ({
                      ...prev,
                      email: e.target.value
                    }))}
                    placeholder="이메일을 입력하세요"
                  />
                </div>
                <Button 
                  onClick={handleProfileUpdate} 
                  disabled={updating}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updating ? "저장 중..." : "프로필 저장"}
                </Button>
              </CardContent>
            </Card>

            {/* 비밀번호 변경 */}
            <Card>
              <CardHeader>
                <CardTitle>비밀번호 변경</CardTitle>
                <CardDescription>
                  보안을 위해 정기적으로 비밀번호를 변경하세요.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">현재 비밀번호</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({
                        ...prev,
                        currentPassword: e.target.value
                      }))}
                      placeholder="현재 비밀번호"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label htmlFor="new-password">새 비밀번호</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({
                        ...prev,
                        newPassword: e.target.value
                      }))}
                      placeholder="새 비밀번호 (최소 6자)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({
                        ...prev,
                        confirmPassword: e.target.value
                      }))}
                      placeholder="새 비밀번호 확인"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <Button 
                  onClick={handlePasswordChange} 
                  disabled={updating || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                  variant="destructive"
                  className="w-full"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {updating ? "변경 중..." : "비밀번호 변경"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}