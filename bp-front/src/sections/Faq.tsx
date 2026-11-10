import React from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Eyebrow, Section } from '../components/ui';

gsap.registerPlugin(useGSAP);

const FAQS = [
  {
    q: 'How is this different from RAG?',
    a: 'RAG retrieves chunks and hopes the answer is in them. Helio walks a graph of owners, services and decisions, so it returns the path \u2014 and says "no owner recorded" when there is none instead of inventing one.',
  },
  {
    q: 'What does Helio connect to?',
    a: 'GitHub and Slack ship as managed connectors; Linear, Notion and CSV are imports; a webhook covers everything else. Jira is not native yet.',
  },
  {
    q: 'Is my data isolated from other customers?',
    a: "Yes. Every account gets its own graph. There is no shared multi-tenant graph, so one workspace can never read another workspace's records.",
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

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);

  useGSAP(
    () => {
      const el = contentRef.current;
      if (!el) return;
      gsap.to(el, {
        height: open ? el.scrollHeight : 0,
        opacity: open ? 1 : 0,
        duration: 0.35,
        ease: 'power2.inOut',
        overwrite: true,
      });
    },
    { dependencies: [open] },
  );

  return (
    <div className="border-b border-line/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left text-lg font-medium tracking-tight outline-none transition-colors hover:text-accent focus-visible:text-accent"
        aria-expanded={open}
      >
        <span>{q}</span>
        <span
          className="shrink-0 font-mono text-xl text-fog transition-transform duration-300"
          style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          +
        </span>
      </button>
      <div ref={contentRef} className="overflow-hidden" style={{ height: 0, opacity: 0 }}>
        <p className="pb-5 max-w-2xl text-[15px] leading-relaxed text-fog">{a}</p>
      </div>
    </div>
  );
};

export const Faq: React.FC = () => {
  const root = React.useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.from(el.querySelectorAll('[data-faq-item]'), {
        y: 24,
        autoAlpha: 0,
        duration: 0.6,
        stagger: 0.06,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 75%',
          once: true,
        },
      });
    },
    { scope: root },
  );

  return (
    <Section ref={root} id="faq" className="border-t border-line/50">
      <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
        <div>
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
        </div>

        <div>
          <div className="border-t border-line/70">
            {FAQS.map((item) => (
              <div key={item.q} data-faq-item>
                <FaqItem q={item.q} a={item.a} />
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-fog">
            Ready when you are.{' '}
            <Link
              to="/pricing"
              className="text-paper underline decoration-accent underline-offset-4 hover:text-accent"
            >
              See the plans
            </Link>
            .
          </p>
        </div>
      </div>
    </Section>
  );
};
