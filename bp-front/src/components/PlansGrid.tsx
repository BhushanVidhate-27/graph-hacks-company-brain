import React from 'react';
import { Link } from 'react-router-dom';
import { api, displayPrice, billingCurrency, type BillingSetup, type Plan } from '../lib/api';
import { Button, Card } from './ui';
import { cn } from '../lib/utils';

const FALLBACK_PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Evaluate the graph on a real company brain.',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'usd',
    credits: '50 questions / month',
    cta: 'Start free',
    highlighted: false,
    limits: { questions_per_month: 50, seats: 1, graphs: 1, api_access: false, github_sync: false },
    features: ['50 questions / month', '1 knowledge graph', '1 seat', 'Provenance on every answer'],
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For one engineering team that needs answers it can defend.',
    price_monthly: 15,
    price_yearly: 150,
    currency: 'usd',
    credits: '1,000 questions / month',
    cta: 'Start Starter',
    highlighted: false,
    trial_days: 14,
    limits: { questions_per_month: 1000, seats: 3, graphs: 1, api_access: false, github_sync: true },
    features: ['1,000 questions / month', '3 seats', 'GitHub issue & PR sync', '90-day staleness alerts', 'Email support'],
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'For platform teams running many services and decisions.',
    price_monthly: 49,
    price_yearly: 490,
    currency: 'usd',
    credits: '5,000 questions / month',
    cta: 'Start Professional',
    highlighted: true,
    trial_days: 14,
    limits: { questions_per_month: 5000, seats: 10, graphs: null, api_access: true, github_sync: true },
    features: [
      '5,000 questions / month',
      'Unlimited graphs',
      '10 seats',
      'API access & keys',
      'Priority inference',
      'Analytics & usage',
    ],
  },
];

const ENTERPRISE: Plan = {
  id: 'enterprise',
  name: 'Enterprise',
  tagline: 'A dedicated graph, SSO and an SLA.',
  price_monthly: null,
  price_yearly: null,
  currency: 'usd',
  credits: 'Custom volume',
  cta: 'Talk to us',
  highlighted: false,
  limits: { questions_per_month: null, seats: null, graphs: null, api_access: true, github_sync: true },
  features: ['Unlimited questions', 'Dedicated graph instance', 'SSO / RBAC', 'SLA-backed uptime'],
};

export const PlansGrid: React.FC<{
  showEnterprise?: boolean;
  compact?: boolean;
}> = ({ showEnterprise = true, compact = false }) => {
  const [plans, setPlans] = React.useState<Plan[]>(FALLBACK_PLANS);
  const [billing, setBilling] = React.useState<BillingSetup | null>(null);

  React.useEffect(() => {
    let alive = true;
    api.plans
      .list()
      .then((data) => {
        if (!alive) return;
        setPlans(data.plans);
        setBilling(data.billing);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const currency = billingCurrency(billing);
  const cards = [...plans];
  if (showEnterprise && !cards.some((plan) => plan.id === 'enterprise')) cards.push(ENTERPRISE);

  return (
    <div>
      <p className="mb-8 font-mono text-xs uppercase tracking-[0.2em] text-fog">
        {currency} · billed monthly · cancel anytime
      </p>
      <div
        className={cn(
          'grid gap-4',
          compact ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-4',
        )}
      >
        {cards.map((plan) => {
          const price = displayPrice(plan, billing);
          const trial = plan.trial_days ? `${plan.trial_days}-day trial` : null;
          return (
            <Card
              key={plan.id}
              className={cn(
                'flex flex-col p-6',
                plan.highlighted && 'border-accent/60 bg-accent/[0.06]',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
                {plan.highlighted && (
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
                    Most chosen
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-fog">{plan.tagline}</p>

              <div className="mt-6 flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-tight">{price}</span>
                {price !== 'Custom' && price !== 'Free' && (
                  <span className="pb-1.5 text-sm text-fog">/ month</span>
                )}
              </div>
              {trial && <p className="mt-1 text-xs text-mint">{trial} · no card required</p>}

              <Link
                to={plan.id === 'enterprise' ? '/auth?plan=enterprise' : `/auth?plan=${plan.id}`}
                className="mt-5"
              >
                <Button
                  variant={plan.highlighted ? 'primary' : 'outline'}
                  block
                  size="md"
                >
                  {plan.cta}
                </Button>
              </Link>

              <ul className="mt-6 space-y-2.5 border-t border-line/70 pt-5 text-sm text-paper/85">
                {(compact ? plan.features.slice(0, 4) : plan.features).map((feature) => (
                  <li key={feature} className="flex gap-2.5">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
