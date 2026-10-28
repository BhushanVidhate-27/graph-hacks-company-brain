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
  url?: string;
  session_id?: string;
  message?: string;
  error?: string;
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
    checkout: (plan: PlanId) =>
      request<CheckoutResponse>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
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
