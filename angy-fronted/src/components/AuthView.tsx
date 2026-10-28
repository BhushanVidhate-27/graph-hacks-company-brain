import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { CadCrosshair } from "./CadCrosshair";
import { HeronButton } from "./HeronButton";
import { useAuth } from "../lib/auth";
import { ApiError, formatPrice } from "../lib/api";

interface AuthViewProps {
  onSuccess: () => void;
  onBack: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess, onBack }) => {
  const { authMode, setAuthMode, pendingPlan, setPendingPlan, login, signup, checkout, me } =
    useAuth();

  const [name, setName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = authMode === "signup";
  const selectedPlan = me?.plans.find((plan) => plan.id === pendingPlan) ?? null;

  const switchMode = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      if (isSignup) {
        if (password.length < 8) {
          throw new Error("Use at least 8 characters for your password.");
        }
        await signup({
          name: name.trim(),
          email: email.trim(),
          password,
          account_name: accountName.trim() || undefined,
        });
      } else {
        await login(email.trim(), password);
      }

      // A plan chosen on the pricing page survives the signup detour. If
      // checkout is not configured this throws, but the account page is still
      // the right destination - it shows the billing state and next step.
      if (pendingPlan && pendingPlan !== "free" && pendingPlan !== "enterprise") {
        try {
          await checkout(pendingPlan);
        } catch {
          /* account view explains the billing state */
        }
      }
      setPendingPlan(null);
      onSuccess();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong. Try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="relative w-full px-4 md:px-8 py-12 md:py-20 max-w-7xl mx-auto select-none">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#5c5c56] hover:text-[#e15c46] mb-8"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to site
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Form */}
        <div className="lg:col-span-7 bg-[#f4f4ec] cad-border p-6 md:p-10 relative">
          <CadCrosshair position="tl" />
          <CadCrosshair position="tr" />
          <CadCrosshair position="bl" />
          <CadCrosshair position="br" />

          <div className="font-mono text-[11px] text-[#e15c46] font-bold uppercase tracking-widest mb-3">
            {isSignup ? "ACCOUNT // CREATE WORKSPACE" : "ACCOUNT // SIGN IN"}
          </div>
          <h1 className="text-3xl md:text-4xl font-mono font-bold tracking-tight uppercase text-[#282828] mb-3">
            {isSignup ? "Give your team a memory" : "Welcome back"}
          </h1>
          <p className="font-mono text-xs text-[#5c5c56] leading-relaxed mb-8 max-w-xl">
            {isSignup
              ? "Create a free workspace. Every answer comes with the graph path that produced it, so a claim can be checked instead of trusted."
              : "Sign in to see your plan, usage and API keys. Your graph answers are metered against the same account."}
          </p>

          {selectedPlan && (
            <div className="mb-6 cad-border border-[#e15c46]/50 bg-[#e15c46]/5 p-3 flex items-center justify-between gap-3">
              <div className="font-mono text-[11px] text-[#282828]">
                <span className="text-[#e15c46] font-bold uppercase">Selected plan:</span>{" "}
                {selectedPlan.name} · {formatPrice(selectedPlan)}/mo
              </div>
              <button
                type="button"
                onClick={() => setPendingPlan(null)}
                className="font-mono text-[10px] text-[#5c5c56] hover:text-[#e15c46] uppercase"
              >
                Clear
              </button>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {isSignup && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-[#5c5c56] mb-1.5">
                    Your name
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                    className="w-full bg-[#ecece4] cad-border px-3 py-2.5 font-mono text-sm text-[#282828] outline-none focus:border-[#e15c46]"
                  />
                </label>
                <label className="block">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-[#5c5c56] mb-1.5">
                    Company / workspace <span className="text-[#5c5c56]/60">(optional)</span>
                  </span>
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    autoComplete="organization"
                    placeholder="Analytical Engines"
                    className="w-full bg-[#ecece4] cad-border px-3 py-2.5 font-mono text-sm text-[#282828] outline-none focus:border-[#e15c46]"
                  />
                </label>
              </div>
            )}

            <label className="block">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-[#5c5c56] mb-1.5">
                Work email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full bg-[#ecece4] cad-border px-3 py-2.5 font-mono text-sm text-[#282828] outline-none focus:border-[#e15c46]"
              />
            </label>

            <label className="block">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-[#5c5c56] mb-1.5">
                Password {isSignup && <span className="text-[#5c5c56]/60">(8+ characters)</span>}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isSignup ? 8 : 1}
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder="••••••••"
                className="w-full bg-[#ecece4] cad-border px-3 py-2.5 font-mono text-sm text-[#282828] outline-none focus:border-[#e15c46]"
              />
            </label>

            {error && (
              <div className="cad-border border-[#e15c46] bg-[#e15c46]/10 p-3 font-mono text-xs text-[#a33b2b]">
                {error}
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <HeronButton variant="brand" size="md" type="submit" className="min-w-[190px] justify-center">
                {busy
                  ? isSignup
                    ? "Creating workspace…"
                    : "Signing in…"
                  : isSignup
                    ? "Create free account"
                    : "Sign in"}
              </HeronButton>
              <button
                type="button"
                onClick={() => switchMode(isSignup ? "login" : "signup")}
                className="font-mono text-[11px] text-[#5c5c56] hover:text-[#e15c46] underline underline-offset-4"
              >
                {isSignup ? "Already have an account? Sign in" : "New here? Create a free account"}
              </button>
            </div>
          </form>

          <p className="mt-6 font-mono text-[10px] text-[#5c5c56] flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            Passwords are hashed with scrypt. Sessions are HttpOnly cookies. No card is required for
            the free plan.
          </p>
        </div>

        {/* Value panel */}
        <aside className="lg:col-span-5 bg-[#282828] text-white p-6 md:p-8 relative cad-border">
          <CadCrosshair position="tl" />
          <CadCrosshair position="tr" />
          <CadCrosshair position="bl" />
          <CadCrosshair position="br" />

          <div className="flex items-center gap-2 font-mono text-[11px] text-[#e15c46] font-bold uppercase tracking-widest mb-5">
            <Sparkles className="w-4 h-4" />
            What you get
          </div>

          <div className="space-y-4">
            {[
              "Every answer carries its graph path — nodes, edges and dates.",
              "Staleness is first-class: departed people and superseded docs are flagged, not buried.",
              "Honest negatives: when the graph has no owner, Helio says so.",
              "Free plan includes 50 questions a month. Upgrade only when the team adopts it.",
            ].map((line) => (
              <div key={line} className="flex items-start gap-3 font-mono text-xs leading-relaxed text-white/85">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#e15c46]" />
                <span>{line}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-5 cad-border-t border-white/15">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-white/50 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-[#e15c46]" />
              No lock-in
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-white/60">
              The core is open source. Export your data, self-host the graph, or cancel from the
              billing portal at any time.
            </p>
          </div>

          <button
            onClick={() => switchMode("login")}
            className="mt-8 inline-flex items-center gap-2 font-mono text-[11px] text-[#e15c46] hover:text-white uppercase tracking-wider"
          >
            Sign in to an existing workspace
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </aside>
      </div>
    </section>
  );
};
