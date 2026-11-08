/**
 * Typed client for the Helio SaaS API.
 *
 * The marketing site and the account console both use this module. Every
 * request includes the session cookie (`credentials: "include"`) so the same
 * code works on the Vite dev server (localhost:5173 -> localhost:8080) and in
 * production where the site and API share an origin.
 */

const envUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;

function defaultApiUrl(): string {
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (typeof window === "undefined") return "";
  const { protocol, hostname, port } = window.location;
  // Vite dev server. The API runs on 8080; guessing same-origin here produces
  // the classic "Failed to fetch" that looks like a dead backend.
  if (port === "5173") return `${protocol}//${hostname}:8080`;
  return "";
}

export const API_URL = defaultApiUrl();

export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: any;

  constructor(message: string, status: number, code?: string, payload?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "Could not reach the Helio API. Check that the backend is running and this origin is allowed.",
      0,
      "network_error",
    );
  }

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.message ||
      payload?.error ||
      `The API returned HTTP ${response.status}.`;
    throw new ApiError(String(message), response.status, payload?.error, payload);
  }

  return payload as T;
}

// --------------------------------------------------------------------------- //
// Types
// --------------------------------------------------------------------------- //

export type PlanId = "free" | "starter" | "professional" | "enterprise";

export interface PlanLimits {
  questions_per_month: number | null;
  seats: number | null;
  graphs: number | null;
  api_access: boolean;
  github_sync: boolean;
  analytics: boolean;
  priority_inference: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  price_monthly: number | null;
  price_yearly: number | null;
  currency: string;
  credits: string;
  cta: string;
  highlighted: boolean;
  limits: PlanLimits;
  features: string[];
  trial_days?: number;
}

export interface User {
  id: string;
  account_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  last_login_at?: string | null;
}

export interface Account {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  stripe_customer_id?: string | null;
}

export interface Subscription {
  account_id: string;
  plan: string;
  status: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: number | boolean;
  effective_plan?: string;
  updated_at?: string | null;
}

export interface Usage {
  questions_used: number;
  questions_limit: number | null;
  questions_remaining: number | null;
  percent_used: number | null;
  period_start: string;
  period_end: string;
}

export interface BillingSetup {
  configured: boolean;
  mode: string;
  local_billing: boolean;
  trial_days?: number;
  trial_enabled?: boolean;
  required_env: string[];
  missing: string[];
}

export interface MeResponse {
  authenticated: boolean;
  user?: User;
  account?: Account;
  subscription?: Subscription;
  plan?: Plan;
  usage?: Usage;
  plans: Plan[];
  billing: BillingSetup;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
}

export interface CheckoutResponse {
  ok: boolean;
  mode?: string;
  upgraded?: boolean;
  plan?: string;
  status?: string;
  trial?: boolean;
  trial_days?: number;
  url?: string;
  session_id?: string;
  message?: string;
  error?: string;
}

export interface IntegrationProvider {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: { key: string; label: string; secret: boolean; required: boolean }[];
  modes: string[];
}

export interface Integration {
  id: string;
  account_id: string;
  provider: string;
  name: string;
  status: string;
  config: Record<string, any>;
  last_sync_at?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportRun {
  id: string;
  account_id: string;
  integration_id?: string | null;
  provider: string;
  kind: string;
  status: string;
  summary: Record<string, any>;
  error?: string | null;
  created_at: string;
  finished_at?: string | null;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
}

export interface Onboarding {
  account_id: string;
  steps: OnboardingStep[];
  done_count: number;
  total_count: number;
  completed: boolean;
  dismissed: boolean;
  completed_at?: string | null;
  updated_at?: string;
}

// --------------------------------------------------------------------------- //
// Endpoints
// --------------------------------------------------------------------------- //

export const api = {
  auth: {
    me: () => request<MeResponse>("/api/auth/me"),
    signup: (data: {
      name: string;
      email: string;
      password: string;
      account_name?: string;
    }) =>
      request<MeResponse>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      request<MeResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  },

  plans: {
    list: () =>
      request<{ plans: Plan[]; billing: BillingSetup }>("/api/plans"),
  },

  billing: {
    me: () => request<MeResponse>("/api/billing/me"),
    checkout: (plan: PlanId, trial = false) =>
      request<CheckoutResponse>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan, trial }),
      }),
    portal: () =>
      request<{ ok: boolean; url?: string; message?: string }>("/api/billing/portal", {
        method: "POST",
      }),
  },

  keys: {
    list: () => request<{ keys: ApiKeyRecord[] }>("/api/keys"),
    create: (name: string) =>
      request<{ ok: boolean; key: string; record: ApiKeyRecord; message: string }>(
        "/api/keys",
        { method: "POST", body: JSON.stringify({ name }) },
      ),
    revoke: (id: string) =>
      request<{ ok: boolean }>(`/api/keys/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  },

  usage: () =>
    request<{ plan: string; usage: Usage }>("/api/usage"),

  integrations: {
    providers: () => request<{ providers: IntegrationProvider[] }>("/api/integrations/providers"),
    list: () => request<{ integrations: Integration[]; runs: ImportRun[] }>("/api/integrations"),
    create: (data: { provider: string; name?: string; config?: Record<string, any> }) =>
      request<{ ok: boolean; integration: Integration }>("/api/integrations", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { provider: string; name?: string; config?: Record<string, any>; status?: string }) =>
      request<{ ok: boolean; integration: Integration }>(`/api/integrations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/api/integrations/${encodeURIComponent(id)}`, { method: "DELETE" }),
    test: (id: string) =>
      request<{ ok: boolean; result: any; integration: Integration }>(`/api/integrations/${encodeURIComponent(id)}/test`, { method: "POST" }),
    runImport: (id: string, payload?: Record<string, any>) =>
      request<{ ok: boolean; run: ImportRun; integration: Integration }>(`/api/integrations/${encodeURIComponent(id)}/import`, {
        method: "POST",
        body: JSON.stringify({ payload: payload || {} }),
      }),
    runs: (limit = 20) => request<{ runs: ImportRun[] }>(`/api/integrations/runs?limit=${limit}`),
  },

  onboarding: {
    get: () => request<{ ok: boolean; onboarding: Onboarding }>("/api/onboarding"),
    update: (data: { steps?: Record<string, boolean>; dismissed?: boolean; mark_complete?: boolean }) =>
      request<{ ok: boolean; onboarding: Onboarding }>("/api/onboarding", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};

export function formatPrice(plan: Plan): string {
  if (plan.price_monthly === null) return "Custom";
  if (plan.price_monthly === 0) return "$0";
  return `$${plan.price_monthly}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
