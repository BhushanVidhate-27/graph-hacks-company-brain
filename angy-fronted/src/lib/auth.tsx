import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  api,
  type ApiKeyRecord,
  type CheckoutResponse,
  type MeResponse,
  type PlanId,
} from "./api";

type AuthMode = "login" | "signup";

interface AuthContextValue {
  me: MeResponse | null;
  loading: boolean;
  authMode: AuthMode;
  pendingPlan: PlanId | null;
  setAuthMode: (mode: AuthMode) => void;
  setPendingPlan: (plan: PlanId | null) => void;
  openAuth: (mode: AuthMode, plan?: PlanId | null) => void;
  refresh: () => Promise<MeResponse | null>;
  login: (email: string, password: string) => Promise<MeResponse>;
  signup: (data: {
    name: string;
    email: string;
    password: string;
    account_name?: string;
  }) => Promise<MeResponse>;
  logout: () => Promise<void>;
  checkout: (plan: PlanId) => Promise<CheckoutResponse>;
  portal: () => Promise<void>;
  createKey: (name: string) => Promise<{ key: string; record: ApiKeyRecord }>;
  revokeKey: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
  onOpenAuth?: () => void;
}

const ANONYMOUS: MeResponse = {
  authenticated: false,
  plans: [],
  billing: {
    configured: false,
    mode: "local",
    local_billing: false,
    required_env: [],
    missing: [],
  },
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, onOpenAuth }) => {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await api.auth.me();
      setMe(next);
      return next;
    } catch {
      // A failed /me should not trap the landing page behind a spinner. The
      // anonymous shape keeps the pricing and auth buttons usable.
      setMe((current) => current ?? ANONYMOUS);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openAuth = useCallback(
    (mode: AuthMode, plan?: PlanId | null) => {
      setAuthMode(mode);
      setPendingPlan(plan ?? null);
      onOpenAuth?.();
    },
    [onOpenAuth],
  );

  const login = useCallback(async (email: string, password: string) => {
    const next = await api.auth.login({ email, password });
    setMe(next);
    return next;
  }, []);

  const signup = useCallback(
    async (data: {
      name: string;
      email: string;
      password: string;
      account_name?: string;
    }) => {
      const next = await api.auth.signup(data);
      setMe(next);
      return next;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setMe((current) => (current ? { ...current, authenticated: false } : ANONYMOUS));
      await refresh();
    }
  }, [refresh]);

  const checkout = useCallback(
    async (plan: PlanId) => {
      const result = await api.billing.checkout(plan);
      if (result.url) {
        window.location.assign(result.url);
      } else if (result.upgraded) {
        await refresh();
      }
      return result;
    },
    [refresh],
  );

  const portal = useCallback(async () => {
    const result = await api.billing.portal();
    if (result.url) window.location.assign(result.url);
  }, []);

  const createKey = useCallback(async (name: string) => {
    const result = await api.keys.create(name);
    return { key: result.key, record: result.record };
  }, []);

  const revokeKey = useCallback(async (id: string) => {
    await api.keys.revoke(id);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      me,
      loading,
      authMode,
      pendingPlan,
      setAuthMode,
      setPendingPlan,
      openAuth,
      refresh,
      login,
      signup,
      logout,
      checkout,
      portal,
      createKey,
      revokeKey,
    }),
    [
      me,
      loading,
      authMode,
      pendingPlan,
      openAuth,
      refresh,
      login,
      signup,
      logout,
      checkout,
      portal,
      createKey,
      revokeKey,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
