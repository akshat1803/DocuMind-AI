import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput } from '@documind/shared';
import { authService } from '@/services/auth.service';
import { AUTH_EXPIRED_EVENT, setAccessToken } from '@/services/api';
import type { User } from '@/types/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): Promise<void>;
}

interface RestoredSession { user: User; accessToken: string }
const AuthContext = createContext<AuthContextValue | null>(null);
let restoreSessionPromise: Promise<RestoredSession | null> | null = null;

function restoreSession(): Promise<RestoredSession | null> {
  restoreSessionPromise ??= (async () => {
    try {
      const session = await authService.refresh();
      setAccessToken(session.accessToken);
      const profile = await authService.me();
      return { user: profile.user, accessToken: session.accessToken };
    } catch {
      setAccessToken(null);
      return null;
    }
  })();
  return restoreSessionPromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    void restoreSession().then((session) => {
      if (!active) return;
      if (session) {
        setAccessToken(session.accessToken);
        setUser(session.user);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      queryClient.clear();
      setUser(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async login(input) {
      const response = await authService.login(input);
      queryClient.clear();
      setAccessToken(response.accessToken);
      setUser(response.user);
    },
    async register(input) {
      const response = await authService.register(input);
      queryClient.clear();
      setAccessToken(response.accessToken);
      setUser(response.user);
    },
    async logout() {
      try { await authService.logout(); } finally {
        queryClient.clear();
        setAccessToken(null);
        setUser(null);
      }
    },
  }), [loading, queryClient, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
