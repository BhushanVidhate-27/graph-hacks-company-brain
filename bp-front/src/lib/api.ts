/**
 * Typed client for the Helio API.
 *
 * The browser never holds payment credentials: the backend creates the order,
 * Razorpay renders its own checkout, and activation happens on the webhook.
 */

const envUrl = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env
  ?.VITE_API_URL;

export const API_URL = envUrl ? envUrl.replace(/\/$/, '') : '';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Could not reach the Helio API.', 0, 'network_error');
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const record = payload as { detail?: string; message?: string; error?: string } | null;
    throw new ApiError(
      record?.detail || record?.message || record?.error || `HTTP ${response.status}`,
      response.status,
      record?.error,
    );
  }
  return payload as T;
}

// --------------------------------------------------------------------------- //
// Types
// --------------------------------------------------------------------------- //

export type PlanId = 'free' | 'starter' | 'professional' | 'enterprise';

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
  trial_days?: number;
  limits: {
    questions_per_month: number | null;
    seats: number | null;
    graphs: number | null;
    api_access: boolean;
    github_sync: boolean;
  };
  features: string[];
}

export interface Subscription {
  plan: string;
  status: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  effective_plan?: string;
}

export interface Usage {
  questions_used: number;
  questions_limit: number | null;
  questions_remaining: number | null;
  percent_used: number | null;
  period_start?: string;
  period_end?: string;
}

export interface MeResponse {
  authenticated: boolean;
  user?: { id: string; name: string; email: string };
  account?: { id: string; name: string };
  subscription?: Subscription;
  plan?: Plan;
  usage?: Usage;
  plans: Plan[];
  billing: BillingSetup;
}

export interface BillingSetup {
  configured: boolean;
  mode: string;
  provider?: string;
  currency?: string;
  local_billing: boolean;
  subscriptions?: boolean;
  checkout_mode?: string;
  prices_inr?: Record<string, number>;
  trial_days?: number;
  missing: string[];
}

export interface RazorpayOrderResponse {
  ok: boolean;
  mode?: string;
  order_id?: string;
  key_id?: string;
  amount?: number;
  currency?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string };
  notes?: Record<string, string>;
  url?: string;
  upgraded?: boolean;
  message?: string;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at?: string | null;
}

export interface TrailItem {
  type: string;
  name: string;
  detail?: string;
  date?: string;
  via_edge?: string;
}

export interface AskResult {
  answer: string;
  trail: TrailItem[];
  stale: TrailItem[];
  latencyMs: number;
}

// --------------------------------------------------------------------------- //
// Pricing — one currency, derived from the live billing provider.
// --------------------------------------------------------------------------- //

/**
 * Razorpay plan prices in whole rupees. Used only when the API is unreachable
 * (offline preview / static deploy); production always returns prices_inr.
 */
export const FALLBACK_INR: Record<string, number> = {
  starter: 1299,
  professional: 4299,
};

export function isRazorpay(billing?: BillingSetup | null): boolean {
  return billing?.provider === 'razorpay' || billing?.mode === 'razorpay';
}

/** Whole-number price in rupees, or null for Custom. */
export function priceInr(plan: Plan, billing?: BillingSetup | null): number | null {
  if (plan.price_monthly === null) return null;
  if (plan.price_monthly === 0) return 0;
  return billing?.prices_inr?.[plan.id] ?? FALLBACK_INR[plan.id] ?? null;
}

export function formatInr(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

/** "Free", "₹1,299" or "Custom". Never mixes currencies. */
export function displayPrice(plan: Plan, billing?: BillingSetup | null): string {
  const inr = priceInr(plan, billing);
  if (inr === null) return 'Custom';
  if (inr === 0) return 'Free';
  return formatInr(inr);
}

/** Price for a plan id when the catalog has not loaded. */
export function fallbackPrice(planId: string): string {
  if (planId === 'free') return 'Free';
  if (planId === 'enterprise') return 'Custom';
  const inr = FALLBACK_INR[planId];
  return inr ? formatInr(inr) : 'Custom';
}

export function billingCurrency(billing?: BillingSetup | null): string {
  if (billing && billing.provider && billing.provider !== 'razorpay') {
    return billing.currency?.toUpperCase() || billing.provider.toUpperCase();
  }
  return 'INR';
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// --------------------------------------------------------------------------- //
// Endpoints
// --------------------------------------------------------------------------- //

export const api = {
  auth: {
    me: () => request<MeResponse>('/api/auth/me'),
    signup: (data: { name: string; email: string; password: string; account_name?: string }) =>
      request<MeResponse>('/api/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<MeResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  },
  plans: {
    list: () => request<{ plans: Plan[]; billing: BillingSetup }>('/api/plans'),
  },
  usage: () => request<{ plan: string; usage: Usage }>('/api/usage'),
  keys: {
    list: () => request<{ keys: ApiKeyRecord[] }>('/api/keys'),
    create: (name: string) =>
      request<{ ok: boolean; key: string; message: string }>('/api/keys', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    revoke: (id: string) =>
      request<{ ok: boolean }>(`/api/keys/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  razorpay: {
    order: (plan: PlanId, trial = false) =>
      request<RazorpayOrderResponse>('/api/razorpay/order', {
        method: 'POST',
        body: JSON.stringify({ plan, trial }),
      }),
    verify: (payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) =>
      request<{ ok: boolean; plan_name?: string; message?: string }>('/api/razorpay/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    cancel: (subscriptionId?: string, atCycleEnd = true) =>
      request<{ ok: boolean; message?: string; current_period_end?: string | null }>(
        '/api/razorpay/cancel',
        { method: 'POST', body: JSON.stringify({ subscription_id: subscriptionId, at_cycle_end: atCycleEnd }) },
      ),
  },
};

/** Stream one question to the graph. Throws on network/HTTP failure. */
export async function askQuestion(
  question: string,
  onUpdate: (partial: AskResult) => void,
  signal?: AbortSignal,
): Promise<AskResult> {
  const started = performance.now();
  const response = await fetch(`${API_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ question }),
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new ApiError(
      payload?.detail || (response.status === 401 ? 'Sign in to ask the graph.' : `HTTP ${response.status}`),
      response.status,
    );
  }
  if (!response.body) throw new ApiError('No response stream.', 0);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let trail: TrailItem[] = [];
  let stale: TrailItem[] = [];

  const emit = () => onUpdate({ answer, trail, stale, latencyMs: Math.round(performance.now() - started) });

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload) as Partial<AskResult>;
        if (Array.isArray(parsed.trail)) trail = parsed.trail;
        if (Array.isArray(parsed.stale)) stale = parsed.stale;
        if (typeof parsed.answer === 'string') answer = parsed.answer;
        emit();
      } catch {
        // Partial JSON line; keep reading.
      }
    }
  }

  return { answer, trail, stale, latencyMs: Math.round(performance.now() - started) };
}

/** True when the backend is serving fixture answers instead of the live graph. */
export function isMockAnswer(answer: string): boolean {
  return /mock API|mock\/trail\.json/i.test(answer);
}
