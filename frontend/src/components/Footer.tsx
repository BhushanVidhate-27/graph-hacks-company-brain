import React, { useState } from 'react';
import { ArrowUpRight, CheckCircle2, Mail } from 'lucide-react';
import { ViewMode } from '../types';

interface FooterProps {
  onSelectMode: (mode: ViewMode) => void;
}

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Pay for a pack', href: '/pay' },
      { label: 'Integrations', href: '/integrations' },
      { label: 'Security', href: '/security' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    title: 'Explore',
    links: [
      { label: 'Ask the graph', href: '/agent' },
      { label: 'Graph console', href: '/console' },
      { label: 'Device preview', href: '/preview' },
      { label: 'Sign in', href: '/auth' },
      { label: 'Your account', href: '/account' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Who owns this service?', href: '/learn/who-owns-this-service' },
      { label: 'Blast radius analysis', href: '/learn/blast-radius-analysis' },
      { label: 'Knowledge graph vs RAG', href: '/learn/knowledge-graph-vs-rag' },
      { label: 'Service ownership & on-call', href: '/learn/service-ownership-on-call' },
      { label: 'Detecting stale docs', href: '/learn/stale-documentation' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Helio', href: '/how-it-works' },
      { label: 'Enterprise', href: 'mailto:contact.helio.brain@gmail.com?subject=Helio%20Enterprise' },
      { label: 'GitHub repository', href: 'https://github.com/BhushanVidhate-27/graph-hacks-company-brain' },
      { label: 'Open source', href: 'https://github.com/BhushanVidhate-27/graph-hacks-company-brain' },
      { label: 'Contact sales', href: 'mailto:contact.helio.brain@gmail.com?subject=Helio%20Sales%20enquiry' },
    ],
  },
  {
    title: 'Trust & support',
    links: [
      { label: 'Trust Center', href: '/security' },
      { label: 'System status', href: '/faq' },
      { label: 'Support', href: 'mailto:contact.helio.brain@gmail.com' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Learn', href: '/learn' },
    ],
  },
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const Footer: React.FC<FooterProps> = ({ onSelectMode }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'error' | 'done'>('idle');
  const [touched, setTouched] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!EMAIL_RE.test(email.trim())) {
      setStatus('error');
      return;
    }
    setStatus('done');
    // No newsletter backend yet — keep the UX honest and hand off to mail.
    window.location.href = `mailto:contact.helio.brain@gmail.com?subject=${encodeURIComponent('Helio newsletter')}&body=${encodeURIComponent(email.trim())}`;
  };

  return (
    <footer className="footer-luxe relative w-full overflow-hidden bg-[#09090b] text-white select-none">
      {/* luminous top hairline */}
      <div className="footer-luxe-glow" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-5 pt-16 pb-10 md:px-8 md:pt-20">
        {/* Link grid */}
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="footer-luxe-h">{col.title}</h2>
              <ul className="space-y-3">
                {col.links.map((link) => {
                  const external = link.href.startsWith('http') || link.href.startsWith('mailto:');
                  return (
                    <li key={`${col.title}-${link.label}`}>
                      <a
                        href={link.href}
                        target={external ? '_blank' : undefined}
                        rel={external ? 'noreferrer' : undefined}
                        className="footer-luxe-link group inline-flex items-center gap-1"
                      >
                        {link.label}
                        {external && <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Giant wordmark */}
        <div className="footer-luxe-wordmark-wrap mt-16 md:mt-20" aria-hidden="true">
          <span className="footer-luxe-wordmark">helio</span>
        </div>

        {/* Newsletter band */}
        <section aria-label="Newsletter" className="mt-10 border border-white/10 bg-white/[0.02] p-5 md:p-7">
          {status === 'done' ? (
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[#f08a75]">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                You’re in — we’ve opened your mail app to confirm.
              </span>
              <span className="text-xs text-white/50">Occasional product updates. Unsubscribe anytime.</span>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="grid items-center gap-4 lg:grid-cols-[auto_1fr_auto_auto]">
              <label htmlFor="footer-newsletter" className="text-sm font-bold text-[#f08a75]">
                Sign up for our newsletter
              </label>
              <input
                id="footer-newsletter"
                type="email"
                autoComplete="email"
                placeholder="youremail@domain.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
                onBlur={() => setTouched(true)}
                aria-invalid={status === 'error'}
                aria-describedby="footer-newsletter-note footer-newsletter-error"
                className="w-full border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-[#e15c46] focus:bg-white/[0.06]"
              />
              <button
                type="submit"
                className="border border-white/20 bg-[#1a1a1e] px-6 py-3 text-sm font-bold text-white transition-colors hover:border-[#e15c46] hover:bg-[#e15c46]"
              >
                Subscribe
              </button>
              <p id="footer-newsletter-note" className="text-[11px] leading-relaxed text-white/45 lg:max-w-xs">
                Occasional updates. Unsubscribe anytime.{' '}
                <a href="/security" className="underline underline-offset-2 hover:text-white">Terms</a>
              </p>
              <p id="footer-newsletter-error" role="alert" className="sr-only">
                {status === 'error' || (touched && email && !EMAIL_RE.test(email)) ? 'Enter a valid email address.' : ''}
              </p>
              {(status === 'error' || (touched && email && !EMAIL_RE.test(email))) && (
                <p role="alert" className="text-xs text-[#f08a75] lg:col-span-full">Enter a valid email address.</p>
              )}
            </form>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-white/45 md:hidden">
            <Mail className="size-3.5" aria-hidden="true" />
            <a href="mailto:contact.helio.brain@gmail.com" className="hover:text-white">contact.helio.brain@gmail.com</a>
          </div>
        </section>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-7 text-xs text-white/55 sm:flex-row sm:items-center">
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-7 gap-y-2">
            <a href="/security" className="transition-colors hover:text-white">Legal</a>
            <a href="/security" className="transition-colors hover:text-white">Privacy Policy</a>
            <a href="/security" className="transition-colors hover:text-white">DPA</a>
            <a href="/faq" className="transition-colors hover:text-white">Accessibility</a>
          </nav>
          <div className="flex items-center gap-6">
            <a href="mailto:contact.helio.brain@gmail.com" className="hidden transition-colors hover:text-white sm:inline">contact.helio.brain@gmail.com</a>
            <span>Helio © 2026</span>
          </div>
        </div>
      </div>

      {/* Actions kept for app chrome (unused by footer links, harmless) */}
      <span hidden data-onselectmode="present" />
    </footer>
  );
};
