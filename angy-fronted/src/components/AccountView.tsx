import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Gauge,
  GitBranch,
  KeyRound,
  LogOut,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { CadCrosshair } from "./CadCrosshair";
import { HeronButton } from "./HeronButton";
import { useAuth } from "../lib/auth";
import {
  API_URL,
  ApiError,
  api,
  formatDate,
  formatPrice,
  type ApiKeyRecord,
  type Plan,
} from "../lib/api";

interface AccountViewProps {
  onBack: () => void;
  onSelectMode: (mode: "website" | "chat-widget" | "pricing") => void;
}

interface GithubStatus {
  configured: boolean;
  owner: string;
  repo: string;
  missing: string[] | null;
}

export const AccountView: React.FC<AccountViewProps> = ({ onBack, onSelectMode }) => {
  const {
    me,
    loading,
    refresh,
    logout,
    checkout,
    portal,
    createKey,
    revokeKey,
  } = useAuth();

  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [billingBusy, setBillingBusy] = useState<string | null>(null);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [github, setGithub] = useState<GithubStatus | null>(null);

  const authenticated = Boolean(me?.authenticated);
  const plan = me?.plan;
  const usage = me?.usage;
  const subscription = me?.subscription;
  const billing = me?.billing;
  const canUseApi = Boolean(plan?.limits.api_access);

  const loadKeys = useCallback(async () => {
    if (!authenticated) return;
    setKeysLoading(true);
    try {
      const result = await api.keys.list();
      setKeys(result.keys);
    } catch {
      /* the section stays empty; the error is not worth blocking the page */
    } finally {
      setKeysLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/repo/settings`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setGithub(data as GithubStatus);
      })
      .catch(() => {
        /* integration status is informational */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpgrade = async (target: Plan) => {
    setBillingBusy(target.id);
    setBillingError(null);
    setBillingMessage(null);
    try {
      const result = await checkout(target.id);
      if (result.upgraded) {
        setBillingMessage(result.message || `You are now on the ${target.name} plan.`);
        await refresh();
      } else if (!result.url) {
        setBillingMessage(result.message || "Checkout session created.");
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not start checkout.";
      setBillingError(message);
    } finally {
      setBillingBusy(null);
    }
  };

  const handlePortal = async () => {
    setBillingBusy("portal");
    setBillingError(null);
    try {
      await portal();
    } catch (err) {
      setBillingError(
        err instanceof ApiError ? err.message : "Could not open the billing portal.",
      );
    } finally {
      setBillingBusy(null);
    }
  };

  const handleCreateKey = async (event: React.FormEvent) => {
    event.preventDefault();
    setKeyError(null);
    setNewKey(null);
    try {
      const result = await createKey(keyName.trim() || "Default key");
      setNewKey(result.key);
      setKeyName("");
      setKeys((current) => [result.record, ...current]);
    } catch (err) {
      setKeyError(err instanceof ApiError ? err.message : "Could not create the key.");
    }
  };

  const handleRevoke = async (record: ApiKeyRecord) => {
    if (!window.confirm(`Revoke "${record.name}"? Applications using it will stop working.`)) {
      return;
    }
    try {
      await revokeKey(record.id);
      setKeys((current) =>
        current.map((key) =>
          key.id === record.id ? { ...key, revoked_at: new Date().toISOString() } : key,
        ),
      );
    } catch (err) {
      setKeyError(err instanceof ApiError ? err.message : "Could not revoke the key.");
    }
  };

  const copyKey = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard permission denied; the key is still visible */
    }
  };

  if (loading && !me) {
    return (
      <section className="w-full px-4 md:px-8 py-20 max-w-7xl mx-auto">
        <div className="font-mono text-xs text-[#5c5c56]">LOADING ACCOUNT…</div>
      </section>
    );
  }

  if (!authenticated) {
    return (
      <section className="w-full px-4 md:px-8 py-20 max-w-3xl mx-auto text-center">
        <div className="bg-[#f4f4ec] cad-border p-10 relative">
          <CadCrosshair position="tl" />
          <CadCrosshair position="tr" />
          <CadCrosshair position="bl" />
          <CadCrosshair position="br" />
          <h1 className="font-mono text-2xl font-bold uppercase text-[#282828] mb-3">
            Sign in required
          </h1>
          <p className="font-mono text-xs text-[#5c5c56] mb-6">
            The account console shows plan, usage and API keys. Sign in or create a free workspace.
          </p>
          <HeronButton variant="brand" onClick={onBack} className="mx-auto">
            Back to site
          </HeronButton>
        </div>
      </section>
    );
  }

  const used = usage?.questions_used ?? 0;
  const limit = usage?.questions_limit ?? null;
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isPaid = Boolean(plan && plan.id !== "free");
  const renewal = formatDate(subscription?.current_period_end);
  const options = (me?.plans ?? []).filter((candidate) => candidate.id !== plan?.id);

  return (
    <section className="relative w-full px-4 md:px-8 py-10 md:py-16 max-w-7xl mx-auto select-none">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#5c5c56] hover:text-[#e15c46] mb-8"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to site
      </button>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 cad-border-b pb-8 mb-8">
        <div>
          <div className="font-mono text-[11px] text-[#e15c46] font-bold uppercase tracking-widest mb-2">
            ACCOUNT // CONTROL PLANE
          </div>
          <h1 className="text-3xl md:text-5xl font-mono font-bold tracking-tight uppercase text-[#282828]">
            {me?.account?.name}
          </h1>
          <p className="font-mono text-xs text-[#5c5c56] mt-2">
            Signed in as <span className="text-[#282828] font-bold">{me?.user?.email}</span> ·{" "}
            {me?.user?.role}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HeronButton
            variant="outline"
            size="sm"
            onClick={() => onSelectMode("chat-widget")}
          >
            Query agent
          </HeronButton>
          <HeronButton variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </HeronButton>
        </div>
      </div>

      {billingMessage && (
        <div className="mb-6 cad-border border-emerald-700/40 bg-emerald-50 p-3 font-mono text-xs text-emerald-800">
          {billingMessage}
        </div>
      )}
      {billingError && (
        <div className="mb-6 cad-border border-[#e15c46] bg-[#e15c46]/10 p-3 font-mono text-xs text-[#a33b2b]">
          {billingError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Plan + usage */}
        <div className="lg:col-span-8 bg-[#282828] text-white cad-border p-6 md:p-8 relative">
          <CadCrosshair position="tl" />
          <CadCrosshair position="tr" />
          <CadCrosshair position="bl" />
          <CadCrosshair position="br" />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#e15c46] font-bold mb-2">
                CURRENT PLAN
              </div>
              <div className="font-mono text-3xl md:text-4xl font-bold uppercase">
                {plan?.name ?? "Free"}
              </div>
              <div className="font-mono text-[11px] text-white/60 mt-1">
                {plan?.price_monthly === null
                  ? "Custom pricing"
                  : plan?.price_monthly === 0
                    ? "No card required"
                    : `${formatPrice(plan!)} / month`}
              </div>
            </div>
            <div className="text-right font-mono text-[10px] text-white/60">
              <div className="uppercase tracking-wider mb-1">Status</div>
              <div className="text-[#e15c46] font-bold uppercase">
                {subscription?.status ?? "active"}
              </div>
              {subscription?.current_period_end && (
                <div className="mt-2">
                  {subscription?.cancel_at_period_end ? "Ends" : "Renews"} {renewal}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-white/60 mb-2">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#e15c46]" />
                Questions this month
              </span>
              <span>
                {used} / {limit === null ? "∞" : limit}
              </span>
            </div>
            <div className="h-2.5 w-full bg-white/15">
              <div
                className={`h-full transition-all duration-500 ${
                  percent >= 90 ? "bg-[#e15c46]" : "bg-[#e15c46]/70"
                }`}
                style={{ width: `${limit === null ? 4 : Math.max(2, percent)}%` }}
              />
            </div>
            <div className="mt-2 font-mono text-[10px] text-white/50">
              {limit === null
                ? "Unlimited questions on this plan."
                : `${usage?.questions_remaining ?? 0} remaining · resets ${usage?.period_end ?? "next month"}`}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {isPaid && subscription?.stripe_customer_id && (
              <HeronButton
                variant="outline"
                size="sm"
                onClick={() => void handlePortal()}
                className="border-white/40 text-white hover:bg-white hover:text-[#282828]"
              >
                {billingBusy === "portal" ? "Opening…" : "Manage billing"}
              </HeronButton>
            )}
            <HeronButton
              variant="brand"
              size="sm"
              onClick={() => {
                document.getElementById("upgrade-options")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {isPaid ? "Change plan" : "Upgrade"}
            </HeronButton>
            <button
              onClick={() => onSelectMode("pricing")}
              className="font-mono text-[10px] uppercase tracking-wider text-white/60 hover:text-white px-2"
            >
              Compare plans
            </button>
          </div>
        </div>

        {/* Right column: billing + github */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#f4f4ec] cad-border p-5 relative">
            <CadCrosshair position="tl" />
            <CadCrosshair position="tr" />
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#5c5c56] mb-3">
              <CreditCard className="w-3.5 h-3.5 text-[#e15c46]" />
              Billing
            </div>
            {billing?.configured ? (
              <>
                <div className="font-mono text-xs text-[#282828] font-bold">
                  Stripe connected
                </div>
                <div className="font-mono text-[10px] text-[#5c5c56] mt-1 uppercase">
                  Mode: {billing.mode}
                </div>
              </>
            ) : billing?.local_billing ? (
              <>
                <div className="font-mono text-xs text-[#282828] font-bold">Local billing mode</div>
                <div className="font-mono text-[10px] text-[#5c5c56] mt-1 leading-relaxed">
                  Upgrades apply immediately for development. Set real Stripe keys before launch.
                </div>
              </>
            ) : (
              <>
                <div className="font-mono text-xs text-[#282828] font-bold">Checkout not configured</div>
                <div className="font-mono text-[10px] text-[#5c5c56] mt-1 leading-relaxed">
                  This deployment has no Stripe keys. You can still use the free plan; contact us
                  for a paid invoice.
                </div>
              </>
            )}
          </div>

          <div className="bg-[#f4f4ec] cad-border p-5 relative">
            <CadCrosshair position="tl" />
            <CadCrosshair position="tr" />
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#5c5c56] mb-3">
              <GitBranch className="w-3.5 h-3.5 text-[#e15c46]" />
              Repository sync
            </div>
            {github?.configured ? (
              <>
                <div className="font-mono text-xs text-[#282828] font-bold break-all">
                  {github.owner}/{github.repo}
                </div>
                <a
                  href={`https://github.com/${github.owner}/${github.repo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-[#e15c46] hover:underline"
                >
                  Open repository <ExternalLink className="w-3 h-3" />
                </a>
              </>
            ) : (
              <>
                <div className="font-mono text-xs text-[#282828] font-bold">Not connected</div>
                <div className="font-mono text-[10px] text-[#5c5c56] mt-1 leading-relaxed">
                  Set GITHUB_OWNER, GITHUB_REPO and GITHUB_TOKEN on the deployment to sync issues
                  and pull requests.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade options */}
      <div id="upgrade-options" className="mt-10">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#e15c46] font-bold">
              PLAN OPTIONS
            </div>
            <h2 className="font-mono text-xl font-bold uppercase text-[#282828] mt-1">
              Move up when the team does
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {options.map((candidate) => (
            <div
              key={candidate.id}
              className={`cad-border p-5 flex flex-col justify-between ${
                candidate.highlighted ? "bg-[#f4f4ec] border-[#e15c46]" : "bg-[#f4f4ec]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="font-mono text-sm font-bold uppercase text-[#282828]">
                    {candidate.name}
                  </div>
                  {candidate.highlighted && (
                    <span className="font-mono text-[9px] text-[#e15c46] font-bold uppercase">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="font-mono text-2xl font-bold text-[#282828] mt-3">
                  {formatPrice(candidate)}
                  {candidate.price_monthly !== null && (
                    <span className="text-[10px] text-[#5c5c56] font-normal">/mo</span>
                  )}
                </div>
                <div className="font-mono text-[10px] text-[#5c5c56] mt-1">{candidate.credits}</div>
              </div>
              <div className="mt-5">
                {candidate.id === "enterprise" ? (
                  <a
                    href="mailto:contact.helio.brain@gmail.com?subject=Helio%20Enterprise"
                    className="inline-flex w-full items-center justify-center border border-[#282828] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider hover:bg-[#282828] hover:text-white"
                  >
                    Talk to us
                  </a>
                ) : (
                  <HeronButton
                    variant={candidate.highlighted ? "brand" : "outline"}
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => void handleUpgrade(candidate)}
                  >
                    {billingBusy === candidate.id
                      ? "Starting…"
                      : candidate.id === "free"
                        ? "Downgrade"
                        : `Choose ${candidate.name}`}
                  </HeronButton>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API keys */}
      <div className="mt-10 bg-[#f4f4ec] cad-border p-6 md:p-8 relative">
        <CadCrosshair position="tl" />
        <CadCrosshair position="tr" />
        <CadCrosshair position="bl" />
        <CadCrosshair position="br" />

        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#e15c46] font-bold flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              API ACCESS
            </div>
            <h2 className="font-mono text-xl font-bold uppercase text-[#282828] mt-1">
              Keys for the graph API
            </h2>
          </div>
          {!canUseApi && (
            <div className="font-mono text-[10px] text-[#5c5c56] cad-border px-3 py-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#e15c46]" />
              Professional plan and above
            </div>
          )}
        </div>

        {!canUseApi ? (
          <div className="cad-border-dashed cad-border p-6 text-center">
            <p className="font-mono text-xs text-[#5c5c56] mb-4">
              API keys let your own services ask the graph without a browser session. Upgrade to
              Professional to unlock them.
            </p>
            <HeronButton
              variant="brand"
              size="sm"
              onClick={() => {
                const professional = me?.plans.find((p) => p.id === "professional");
                if (professional) void handleUpgrade(professional);
              }}
            >
              Unlock API access
            </HeronButton>
          </div>
        ) : (
          <>
            <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="Key name (e.g. CI, Grafana, local script)"
                className="flex-1 bg-[#ecece4] cad-border px-3 py-2.5 font-mono text-sm text-[#282828] outline-none focus:border-[#e15c46]"
              />
              <HeronButton variant="dark" size="sm" type="submit" className="justify-center">
                Create key
              </HeronButton>
            </form>

            {keyError && (
              <div className="mb-4 cad-border border-[#e15c46] bg-[#e15c46]/10 p-3 font-mono text-xs text-[#a33b2b]">
                {keyError}
              </div>
            )}

            {newKey && (
              <div className="mb-4 cad-border border-[#e15c46] bg-[#282828] p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[#e15c46] font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Copy this key now — it is shown once
                  </div>
                  <button
                    onClick={() => void copyKey()}
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-white/70 hover:text-white uppercase"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <code className="block break-all font-mono text-xs text-white bg-black/30 p-3">
                  {newKey}
                </code>
                <div className="mt-2 font-mono text-[10px] text-white/50">
                  Use it as <code>Authorization: Bearer &lt;key&gt;</code> against <code>POST /ask</code>.
                </div>
              </div>
            )}

            <div className="space-y-2">
              {keysLoading && (
                <div className="font-mono text-[10px] text-[#5c5c56]">Loading keys…</div>
              )}
              {!keysLoading && keys.length === 0 && (
                <div className="font-mono text-[10px] text-[#5c5c56]">
                  No keys yet. Create one for each service that needs access.
                </div>
              )}
              {keys.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-3 cad-border bg-[#ecece4] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-[#282828] font-bold truncate">
                      {record.name}
                      {record.revoked_at && (
                        <span className="ml-2 text-[9px] uppercase text-[#e15c46]">revoked</span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-[#5c5c56]">
                      {record.prefix}… · created {formatDate(record.created_at)}
                      {record.last_used_at ? ` · last used ${formatDate(record.last_used_at)}` : " · never used"}
                    </div>
                  </div>
                  {!record.revoked_at && (
                    <button
                      onClick={() => void handleRevoke(record)}
                      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-[#5c5c56] hover:text-[#e15c46]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 font-mono text-[10px] text-[#5c5c56]">
              Example:{" "}
              <code className="bg-[#ecece4] px-1.5 py-0.5">
                {`curl -X POST ${API_URL || 'https://helio-brain.onrender.com'}/ask -H "Authorization: Bearer helio_…" -H "Content-Type: application/json" -d '{"question":"Who owns ledger-core?"}'`}
              </code>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] text-[#5c5c56]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#e15c46]" />
          Need more seats or a dedicated graph?{" "}
          <a
            href="mailto:contact.helio.brain@gmail.com?subject=Helio%20Enterprise"
            className="text-[#e15c46] hover:underline"
          >
            Talk to us
          </a>
        </div>
        <button
          onClick={() => onSelectMode("pricing")}
          className="inline-flex items-center gap-1 text-[#e15c46] hover:underline uppercase tracking-wider"
        >
          View pricing
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </section>
  );
};
