import React from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow, Reveal, Section } from '../components/ui';

const FAQS = [
  {
    q: 'How is this different from RAG?',
    a: 'RAG retrieves chunks and hopes the answer is in them. Helio walks a graph of owners, services and decisions, so it returns the path — and says "no owner recorded" when there is none instead of inventing one.',
  },
  {
    q: 'What does Helio connect to?',
    a: 'GitHub and Slack ship as managed connectors; Linear, Notion and CSV are imports; a webhook covers everything else. Jira is not native yet.',
  },
  {
    q: 'Is my data isolated from other customers?',
    a: 'Yes. Every account gets its own graph. There is no shared multi-tenant graph, so one workspace can never read another workspace’s records.',
  },
  {
    q: 'What happens when I cancel?',
    a: 'Your subscription keeps access until the end of the paid period, then the account drops to Free: 50 questions a month, one graph, one seat. Your data stays readable.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'If you cancel within 7 days of your first charge, email support@helio.runs-on.dev and we refund in full. Later cancellations stop the next renewal.',
  },
  {
    q: 'Can I self-host?',
    a: 'Enterprise plans run a dedicated graph instance with SSO/RBAC and an SLA. Talk to us from the pricing page.',
  },
];

export const Faq: React.FC = () => (
  <Section id="faq" className="border-t border-line/50">
    <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
      <Reveal>
        <Eyebrow>FAQ</Eyebrow>
        <h2 className="mt-4 text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.02em]">
          The questions before you hand over a card.
        </h2>
        <p className="mt-5 text-fog">
          Something else?{' '}
          <a
            href="mailto:support@helio.runs-on.dev"
            className="text-paper underline decoration-accent decoration-2 underline-offset-4 hover:text-accent"
          >
            support@helio.runs-on.dev
          </a>
        </p>
      </Reveal>

      <Reveal delay={100}>
        <div className="divide-y divide-line/70 border-y border-line/70">
          {FAQS.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-medium tracking-tight outline-none transition-colors hover:text-accent group-open:text-accent [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="shrink-0 font-mono text-xl text-fog transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fog">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-sm text-fog">
          Ready when you are.{' '}
          <Link to="/pricing" className="text-paper underline decoration-accent underline-offset-4 hover:text-accent">
            See the plans
          </Link>
          .
        </p>
      </Reveal>
    </div>
  </Section>
);
