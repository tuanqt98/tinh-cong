import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, AUTH_EXPIRED_EVENT, clearAuthSession } from './api.js';

interface User { id: string; username: string; employeeId: string | null; roles: string[] }
interface AuthContextValue {
  user: User | null;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const value = sessionStorage.getItem('auth_user');
    const hasToken = sessionStorage.getItem('access_token') || sessionStorage.getItem('refresh_token');
    if (!value || !hasToken) {
      clearAuthSession();
      return null;
    }
    return JSON.parse(value) as User;
  });

  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    async login(username, password) {
      const result = await api<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST', body: JSON.stringify({ username, password }),
      });
      sessionStorage.setItem('access_token', result.accessToken);
      sessionStorage.setItem('refresh_token', result.refreshToken);
      sessionStorage.setItem('auth_user', JSON.stringify(result.user));
      setUser(result.user);
    },
    async logout() {
      await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
      clearAuthSession();
      setUser(null);
    },
  }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
