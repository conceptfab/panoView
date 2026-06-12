'use client';

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  use,
} from 'react';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  login: (email: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthState() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  const login = useCallback(async (email: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    return {
      success: res.ok,
      message: data.message || (res.ok ? 'Email wysłany' : 'Błąd logowania'),
    };
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const isLoading = user === undefined;
  const resolvedUser = user ?? null;

  return {
    user: resolvedUser,
    isLoading,
    isAuthenticated: resolvedUser !== null,
    isAdmin: resolvedUser?.role === 'admin',
    isEditor: resolvedUser?.role === 'editor',
    login,
    logout,
    refreshSession,
  };
}

export { AuthContext };
