import React from 'react';
import { Nav } from '../../components/Nav';
import { Footer } from '../../components/Footer';
import { Eyebrow } from '../../components/ui';
import { Head } from '../../components/Head';

interface LegalSection {
  title: string;
  body: string[];
}

const LegalLayout: React.FC<{
  eyebrow: string;
  title: string;
  path: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}> = ({ eyebrow, title, path, updated, intro, sections }) => (
  <>
    <Head title={`${title} — Helio`} description={intro} path={path} />
    <Nav />
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-32 md:px-8 md:pt-40">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-5xl">
        {title}
      </h1>
      <p className="mt-3 font-mono text-xs text-fog">Last updated {updated}</p>
      <p className="mt-6 text-lg leading-relaxed text-fog">{intro}</p>

      <div className="mt-12 space-y-10">
        {sections.map((section, index) => (
          <section key={section.title}>
            <h2 className="flex items-baseline gap-3 text-xl font-semibold tracking-tight">
              <span className="font-mono text-sm text-accent">{String(index + 1).padStart(2, '0')}</span>
              {section.title}
            </h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-fog">
              {section.body.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-14 border-t border-line/70 pt-6 text-sm text-fog">
        Questions about this page? Email{' '}
        <a
          href="mailto:support@helio.runs-on.dev"
          className="text-paper underline decoration-accent underline-offset-4 hover:text-accent"
        >
          support@helio.runs-on.dev
        </a>
        .
      </p>
    </main>
    <Footer />
  </>
);

const TERMS: LegalSection[] = [
  {
    title: 'The service',
    body: [
      'Helio builds a knowledge graph from the engineering systems you connect — repositories, on-call rotations, decision records and documents — and answers questions about ownership, dependencies and history with the path behind each answer.',
      'Each account gets its own graph. Your records are never shared with, or readable by, any other account.',
    ],
  },
  {
    title: 'Accounts',
    body: [
      'You need an account to connect sources or ask questions beyond the anonymous daily allowance. You are responsible for keeping your password confidential and for activity under your account.',
      'Provide a valid email address. We use it for receipts, security notices and account recovery.',
    ],
  },
  {
    title: 'Plans, billing and cancellation',
    body: [
      'Paid plans are billed monthly in Indian rupees through Razorpay. Every paid plan starts with a 14-day trial; we do not take card details until you start a subscription.',
      'You can cancel from Account → Manage billing at any time. Cancelling stops the next renewal and your paid access runs to the end of the current paid period, after which the account moves to the Free plan.',
      'We do not raise prices during a paid period. If prices change later, we email you before the next renewal.',
    ],
  },
  {
    title: 'Acceptable use',
    body: [
      'Use Helio for your own organisation’s data. Do not attempt to read another account’s graph, probe the service beyond normal use, or connect data you have no right to process.',
    ],
  },
  {
    title: 'Availability and support',
    body: [
      'We aim for high availability but do not guarantee it on Free and Starter plans. Enterprise plans carry an SLA, which is documented separately.',
      'Email support is answered on business days. Professional plans get priority; Slack support is available on request.',
    ],
  },
  {
    title: 'Liability',
    body: [
      'Helio is a decision-support tool. Answers come from the records you connect and the staleness of those records; verify critical changes before acting on them.',
      'To the extent allowed by law, our aggregate liability is limited to the fees you paid in the 12 months before the claim.',
    ],
  },
  {
    title: 'Governing law',
    body: [
      'These terms are governed by the laws of India, and the courts of Mumbai have exclusive jurisdiction.',
    ],
  },
];

const PRIVACY: LegalSection[] = [
  {
    title: 'What we collect',
    body: [
      'Account data: your name, email address, workspace name and authentication details.',
      'Source data: the records we ingest from the systems you connect, such as repositories, issues, on-call entries and documents, along with the graph derived from them.',
      'Usage data: questions asked, features used and aggregate performance metrics.',
      'Payment data: handled by Razorpay. We never see or store your full card number.',
    ],
  },
  {
    title: 'What we do with it',
    body: [
      'We use this data to run the service, keep it secure, issue receipts and improve accuracy. We do not sell your data, and we do not use your workspace content to train models for other customers.',
    ],
  },
  {
    title: 'Isolation',
    body: [
      'Each account has its own graph. Records from one account are never merged into another account’s graph, and access is limited to people you invite to the workspace.',
    ],
  },
  {
    title: 'Retention and deletion',
    body: [
      'We keep source data while your account is active. When you delete a connection or cancel your account, the derived graph is removed within 30 days, except for records we must retain for accounting.',
      'Email support@helio.runs-on.dev to request a copy or deletion of your personal data.',
    ],
  },
  {
    title: 'Subprocessors',
    body: [
      'We use a small set of providers to run Helio: Razorpay for payments, Render for hosting, Cloudflare for edge delivery, and FalkorDB Cloud for graph storage. Each is bound by a data processing agreement.',
    ],
  },
  {
    title: 'Security',
    body: [
      'Sessions use HTTP-only, SameSite cookies and scrypt-hashed passwords. Traffic is TLS-only and the API enforces per-account graph isolation. We do not claim a certification we have not earned.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'Depending on where you live, you may have rights to access, correct, export or delete your personal data, and to object to processing. Email support@helio.runs-on.dev and we will respond within 30 days.',
    ],
  },
];

const REFUNDS: LegalSection[] = [
  {
    title: '7-day refund window',
    body: [
      'If you cancel within 7 days of your first subscription charge, we refund that charge in full — no questions, no forms. Email support@helio.runs-on.dev from your account address.',
      'The refund is issued to the original payment method through Razorpay and typically reaches you within 5–10 business days.',
    ],
  },
  {
    title: 'Cancelling after 7 days',
    body: [
      'Cancel any time from Account → Manage billing. Cancelling stops the next renewal; paid access continues to the end of the period you have already paid for, and the account then moves to Free.',
      'We do not prorate or refund partial months, because the graph you built stays available to the end of the paid period.',
    ],
  },
  {
    title: 'Trials',
    body: [
      'A 14-day trial needs no card. If you do not start a subscription, the account simply becomes Free when the trial ends.',
    ],
  },
  {
    title: 'Enterprise',
    body: [
      'Dedicated instances and annual agreements carry their own refund and termination terms, documented in your order form.',
    ],
  },
  {
    title: 'How to request a refund',
    body: [
      'Email support@helio.runs-on.dev with the workspace email address and the date of the charge. We reply within one business day.',
    ],
  },
];

export const TermsPage: React.FC = () => (
  <LegalLayout
    eyebrow="Legal"
    title="Terms of service"
    path="/terms"
    updated="10 November 2026"
    intro="These terms govern your use of Helio. By creating an account you agree to them."
    sections={TERMS}
  />
);

export const PrivacyPage: React.FC = () => (
  <LegalLayout
    eyebrow="Legal"
    title="Privacy policy"
    path="/privacy"
    updated="10 November 2026"
    intro="What we collect, why we collect it, and the choices you have."
    sections={PRIVACY}
  />
);

export const RefundsPage: React.FC = () => (
  <LegalLayout
    eyebrow="Legal"
    title="Refunds & cancellation"
    path="/refunds"
    updated="10 November 2026"
    intro="Cancel anytime. A full refund inside 7 days of your first charge."
    sections={REFUNDS}
  />
);
