/** Pricing page for Helio.
 * Clear starting price, what's included, and the explicit reasoning
 * for the low price (bootstrapped, open-source core, no SaaS markup).
 */

import { cn } from "@/lib/utils";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-4">
            Simple, transparent pricing for early adopters
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Helio Pricing
          </h1>
        </div>

        <div className="grid max-w-2xl mx-auto mb-12 gap-6">

          {/* starter tier */}
          <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-3">Starter</p>
            <p className="text-5xl font-bold">$15/mo</p>
            <p className="text-text/60 mt-1">$150/year (save 20%)</p>

            <ul className="list-disc list-inside space-y-3 text-text/80 mb-6">
              <li>Unlimited queries</li>
              <li>1 knowledge graph</li>
              <li>FalkorDB embedded</li>
              <li>Groq inference included</li>
              <li>GitHub integration</li>
              <li>Email support</li>
            </ul>

            <a
              href="#"
              className={cn(
                "inline-flex items-center rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-primary/60 dark:hover:bg-primary/50",
                "mt-4",
              )}
            >
              Get Started
            </a>
          </div>

          {/* professional tier */}
          <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-3">Professional</p>
            <p className="text-5xl font-bold">$49/mo</p>
            <p className="text-text/60 mt-1">$490/year (save 17%)</p>

            <ul className="list-disc list-inside space-y-3 text-text/80 mb-6">
              <li>Everything in Starter</li>
              <li>Unlimited knowledge graphs</li>
              <li>Priority Groq inference</li>
              <li>Advanced analytics</li>
              <li>API access</li>
              <li>Phone & email support</li>
            </ul>

            <a
              href="#"
              className={cn(
                "inline-flex items-center rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-primary/60 dark:hover:bg-primary/50",
                "mt-4",
              )}
            >
              Get Professional
            </a>
          </div>

        </div>

        {/* pricing rationale */}
        <section className="mt-12 pt-8 border-t border-border">
          <h2 className="text-2xl font-bold mb-4">Why so affordable?</h2>
          <p className="text-text/70 mb-6">
            We're bootstrapped, not VC-backed. Helio runs on an open-source core with
            FalkorDB for the knowledge graph and Groq for inference — there's no
            multi-billion SaaS markup layered on top. We're GitHub-native, founder-led,
            and keeping prices low to welcome early adopters who believe in the vision.
          </p>
          <blockquote className="mt-6 pl-8 border-l-4 text-sm text-muted-foreground">
            "The most expensive part of Helio is our curiosity — everything else is
            kept lean."
            — Founder, bootstrapped, GitHub-native
          </blockquote>
        </section>

      </div>
    </main>
  )
}