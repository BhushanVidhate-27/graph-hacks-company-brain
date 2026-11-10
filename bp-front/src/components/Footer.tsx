import React from 'react';
import { Link } from 'react-router-dom';
import { Mark } from './Mark';

const COLUMNS: Array<{ title: string; links: Array<{ label: string; to: string }> }> = [
  {
    title: 'Product',
    links: [
      { label: 'Pricing', to: '/pricing' },
      { label: 'Ask the graph', to: '/agent' },
      { label: 'How it works', to: '/#how' },
      { label: 'FAQ', to: '/#faq' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', to: '/auth' },
      { label: 'Your account', to: '/account' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of service', to: '/terms' },
      { label: 'Privacy policy', to: '/privacy' },
      { label: 'Refunds & cancellation', to: '/refunds' },
    ],
  },
];

export const Footer: React.FC = () => (
  <footer className="border-t border-line/60 bg-ink-soft">
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
      <div>
        <Link to="/" className="flex items-center gap-2" aria-label="Helio home">
          <Mark className="relative h-9 w-12" />
          <span className="text-lg font-semibold tracking-tight">helio</span>
        </Link>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-fog">
          One graph over repos, rotations and decisions. Every answer shows the path behind it.
        </p>
        <a
          href="mailto:support@helio.runs-on.dev"
          className="mt-4 inline-block font-mono text-xs text-fog transition-colors hover:text-accent"
        >
          support@helio.runs-on.dev
        </a>
      </div>

      {COLUMNS.map((column) => (
        <div key={column.title}>
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-fog">
            {column.title}
          </h3>
          <ul className="mt-4 space-y-2.5">
            {column.links.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className="text-sm text-paper/85 transition-colors hover:text-accent">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    <div className="border-t border-line/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-fog md:flex-row md:items-center md:justify-between md:px-8">
        <p>© 2026 Helio. All rights reserved.</p>
        <p>Prices in INR, billed monthly. Cancel anytime from your account.</p>
      </div>
    </div>
  </footer>
);
