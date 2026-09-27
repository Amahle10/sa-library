import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, send, session } from '@/services/api';
import type { User } from '@/types/api';
interface Auth {
  user: User | null;
  loading: boolean;
  signIn: (mode: 'login' | 'register', data: unknown) => Promise<User>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const clear = useCallback(() => {
    session.clear();
    setUser(null);
  }, []);
  useEffect(() => {
    let active = true;
    if (session.get())
      api<User>('/auth/me')
        .then((u) => {
          if (active) setUser(u);
        })
        .catch(() => {
          if (active) clear();
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    else setLoading(false);
    window.addEventListener('session-expired', clear);
    return () => {
      active = false;
      window.removeEventListener('session-expired', clear);
    };
  }, [clear]);
  async function signIn(mode: 'login' | 'register', data: unknown) {
    const result = await send<{ user: User; token: string }>(`/auth/${mode}`, 'POST', data);
    session.set(result.token);
    setUser(result.user);
    return result.user;
  }
  async function logout() {
    try {
      await send('/auth/logout', 'POST');
    } finally {
      clear();
    }
  }
  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is required');
  return auth;
}
