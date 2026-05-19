import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { clearToken, getMe, getToken, login, setToken, signup } from '../lib/api';
import { PublicUser } from '../types';

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function boot() {
      try {
        if (getToken()) {
          const data = await getMe();
          setUser(data.user);
        }
      } catch (_error) {
        clearToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    boot();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async signIn(email: string, password: string) {
      const data = await login(email, password);
      setToken(data.token);
      setUser(data.user);
    },
    async signUp(name: string, email: string, password: string) {
      const data = await signup(name, email, password);
      setToken(data.token);
      setUser(data.user);
    },
    signOut() {
      clearToken();
      setUser(null);
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
