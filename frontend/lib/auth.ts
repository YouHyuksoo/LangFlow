import { useState, useEffect } from 'react';
import { userAPI } from './api';

export interface User {
  user_id: string;
  username: string;
  email: string;
  full_name?: string;
  persona: string;
  interest_areas: string[];
  role: string;
  is_active: boolean;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  session_id?: string;
  user?: User;
}

// 세션 쿠키 관리 함수들
export const getSessionId = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/session_id=([^;]+)/);
  return match ? match[1] : null;
};

export const setSessionId = (sessionId: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `session_id=${sessionId}; path=/; max-age=${24 * 60 * 60}`; // 24시간
};

export const removeSessionId = () => {
  if (typeof document === 'undefined') return;
  document.cookie = 'session_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
};

// 현재 사용자 정보 가져오기
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const sessionId = getSessionId();
    if (!sessionId) {
      console.log('세션 ID가 없어 사용자 정보를 가져오지 않습니다.');
      return null;
    }

    return await userAPI.getCurrentUser();
  } catch (error) {
    // 401 오류는 정상적인 로그아웃 상황일 수 있으므로 로그 레벨을 낮춤
    if (error instanceof Error && error.message.includes('401')) {
      console.log('인증되지 않은 상태입니다.');
    } else {
      console.error('사용자 정보 가져오기 실패:', error);
    }
    // 401 오류 시 세션 쿠키 정리
    removeSessionId();
    return null;
  }
};

// 관리자 권한 확인
export const isAdmin = (user: User | null): boolean => {
  return user?.role === 'admin';
};

// 전역 인증 상태 (싱글톤 패턴으로 중복 호출 방지)
let authCheckPromise: Promise<User | null> | null = null;
let authCheckResult: { user: User | null; timestamp: number } | null = null;
const AUTH_CACHE_DURATION = 5000; // 5초

// 인증 상태 훅
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      
      // 세션 ID가 없으면 API 호출 없이 바로 인증 실패 처리
      const sessionId = getSessionId();
      if (!sessionId) {
        setUser(null);
        setIsAuthenticated(false);
        setIsAdminUser(false);
        return;
      }
      
      // 캐시된 결과 확인
      if (authCheckResult && Date.now() - authCheckResult.timestamp < AUTH_CACHE_DURATION) {
        const cachedUser = authCheckResult.user;
        setUser(cachedUser);
        setIsAuthenticated(!!cachedUser);
        setIsAdminUser(cachedUser ? isAdmin(cachedUser) : false);
        return;
      }

      // 진행 중인 인증 체크가 있으면 대기
      if (authCheckPromise) {
        const currentUser = await authCheckPromise;
        setUser(currentUser);
        setIsAuthenticated(!!currentUser);
        setIsAdminUser(currentUser ? isAdmin(currentUser) : false);
        return;
      }

      // 새로운 인증 체크 시작
      authCheckPromise = getCurrentUser();
      const currentUser = await authCheckPromise;
      
      // 결과 캐싱
      authCheckResult = { user: currentUser, timestamp: Date.now() };
      authCheckPromise = null;
      
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
        setIsAdminUser(isAdmin(currentUser));
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsAdminUser(false);
      }
    } catch (error) {
      console.error('인증 확인 실패:', error);
      authCheckPromise = null;
      authCheckResult = null;
      setUser(null);
      setIsAuthenticated(false);
      setIsAdminUser(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<LoginResponse> => {
    try {
      const data = await userAPI.login(username, password);

      if (data.success && data.session_id && data.user) {
        setSessionId(data.session_id);
        
        // 인증 캐시 업데이트
        authCheckResult = { user: data.user, timestamp: Date.now() };
        authCheckPromise = null;
        
        setUser(data.user);
        setIsAuthenticated(true);
        setIsAdminUser(isAdmin(data.user));
      }

      return data;
    } catch (error) {
      console.error('로그인 실패:', error);
      return {
        success: false,
        message: '로그인 중 오류가 발생했습니다.',
      };
    }
  };

  const logout = async (): Promise<void> => {
    // 먼저 클라이언트 상태를 정리
    removeSessionId();
    authCheckPromise = null;
    authCheckResult = null;
    setUser(null);
    setIsAuthenticated(false);
    setIsAdminUser(false);
    
    try {
      // 백엔드에 로그아웃 요청 (세션이 이미 정리된 상태에서)
      await userAPI.logout();
    } catch (error) {
      console.error('로그아웃 API 호출 실패:', error);
      // 클라이언트 상태는 이미 정리되었으므로 오류가 발생해도 무시
    }
  };

  return {
    user,
    loading,
    isAuthenticated,
    isAdminUser,
    login,
    logout,
    checkAuth,
  };
};