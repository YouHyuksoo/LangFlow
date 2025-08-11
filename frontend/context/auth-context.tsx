"use client";

import React, { createContext, useContext } from 'react';
import { useAuth, User } from '@/lib/auth';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdminUser: boolean;
  login: (username: string, password: string) => Promise<any>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await auth.logout();
    router.push('/');
    // 강제 새로고침으로 모든 상태를 초기화하고 싶다면 아래 주석을 해제하세요.
    // window.location.href = '/';
  };

  const value = {
    ...auth,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
