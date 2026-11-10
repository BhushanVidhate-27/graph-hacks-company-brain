import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type MeResponse } from './api';

interface AuthContextValue {
  me: MeResponse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<MeResponse>;
  signup: (data: { name: string; email: string; password: string; account_name?: string }) => Promise<MeResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<MeResponse>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await api.auth.me();
    setMe(next);
    return next;
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .auth
      .me()
      .then((next) => {
        if (alive) setMe(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      me,
      loading,
      refresh,
      login: async (email, password) => {
        const next = await api.auth.login({ email, password });
        setMe(next);
        return next;
      },
      signup: async (data) => {
        const next = await api.auth.signup(data);
        setMe(next);
        return next;
      },
      logout: async () => {
        await api.auth.logout().catch(() => undefined);
        setMe(null);
      },
    }),
    [me, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
