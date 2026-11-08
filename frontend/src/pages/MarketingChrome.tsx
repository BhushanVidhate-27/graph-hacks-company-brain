import React from 'react';
import { ArrowRight, ArrowUpRight, GitBranch, Mail } from 'lucide-react';
import { HelioLogo } from '../components/HelioLogo';
import { CadCrosshair } from '../components/CadCrosshair';
import { AuthProvider } from '../lib/auth';
import { CONTACT_EMAIL, GITHUB_URL } from '../seo/site';

const NAV_LINKS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/security', label: 'Security' },
  { href: '/learn', label: 'Learn' },
  { href: '/faq', label: 'FAQ' },
];

const LEARN_LINKS = [
  { href: '/learn/who-owns-this-service', label: 'Who owns this service?' },
  { href: '/learn/blast-radius-analysis', label: 'Blast radius analysis' },
  { href: '/learn/knowledge-graph-vs-rag', label: 'Knowledge graph vs RAG' },
  { href: '/learn/service-ownership-on-call', label: 'Ownership and on-call' },
  { href: '/learn/stale-documentation', label: 'Detecting stale docs' },
];

export const CtaLink: React.FC<{
  href: string;
  children: React.ReactNode;
  variant?: 'brand' | 'outline' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ href, children, variant = 'brand', size = 'md', className = '' }) => {
  const base =
    'inline-flex items-center justify-center gap-2 border font-mono font-bold uppercase tracking-wider transition-colors';
  const sizes = {
    sm: 'text-[11px] py-2 px-3',
    md: 'text-[12px] py-2.5 px-4',
    lg: 'text-[14px] py-3.5 px-6',
  };
  const variants = {
    brand: 'bg-[#e15c46] text-white border-[#e15c46] hover:bg-[#282828] hover:border-[#282828]',
    outline:
      'bg-transparent text-[#282828] border-[#282828] hover:bg-[#282828] hover:text-white',
    dark: 'bg-[#282828] text-white border-[#282828] hover:bg-[#e15c46] hover:border-[#e15c46]',
  };
  return (
    <a href={href} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
    </a>
  );
};

export const SiteHeader: React.FC = () => (
  <header className="relative w-full cad-border-b bg-[#ecece4]/95 backdrop-blur-md sticky top-0 z-50">
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-[#282828] focus:px-3 focus:py-2 focus:text-white"
    >
      Skip to content
    </a>
    <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between gap-4">
      <a href="/" aria-label="Helio home" className="shrink-0">
        <HelioLogo showText />
      </a>

      <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-5 xl:gap-7 font-mono text-[11px] xl:text-[12px] tracking-wider">
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} className="hover:text-[#e15c46] transition-colors whitespace-nowrap">
            {link.label.toUpperCase()}
          </a>
        ))}
      </nav>

      <div className="hidden sm:flex items-center gap-2.5 shrink-0">
        <a
          href="/auth"
          className="font-mono text-[11px] uppercase tracking-wider px-3 py-2 border border-[#282828] hover:bg-[#282828] hover:text-white transition-colors"
        >
          Sign in
        </a>
        <CtaLink href="/agent" size="sm">
          Ask Helio
        </CtaLink>
      </div>

      <details className="sm:hidden relative">
        <summary className="list-none cursor-pointer border border-[#282828] px-3 py-2 font-mono text-[11px] uppercase tracking-wider">
          Menu
        </summary>
        <nav
          aria-label="Mobile navigation"
          className="absolute right-0 top-full mt-2 w-64 bg-[#f4f4ec] cad-border p-2 font-mono text-[12px] shadow-xl"
        >
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="block px-3 py-2 hover:bg-[#282828] hover:text-white">
              {link.label}
            </a>
          ))}
          <a href="/auth" className="block px-3 py-2 hover:bg-[#282828] hover:text-white border-t border-[#282828]/20">
            Sign in
          </a>
          <a href="/agent" className="block px-3 py-2 text-[#e15c46] font-bold border-t border-[#282828]/20">
            Ask Helio
          </a>
        </nav>
      </details>
    </div>
  </header>
);

export const SiteFooter: React.FC = () => (
  <footer className="relative w-full cad-border-t bg-[#f4f4ec] pt-14 pb-10 px-4 md:px-8">
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 cad-border-b">
        <div className="lg:col-span-4 space-y-5">
          <HelioLogo showText />
          <p className="font-mono text-xs text-[#5c5c56] max-w-sm leading-relaxed">
            Helio is a company brain for engineering teams. It answers who owns what, what breaks
            when a service fails, and where a decision was made — with the path behind every answer.
          </p>
          <div className="bg-[#ecece4] cad-border p-4 text-[11px] font-mono text-[#5c5c56] space-y-2">
            <div className="text-[#282828] font-bold">CONTACT</div>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[#e15c46] font-bold hover:underline inline-flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" aria-hidden="true" />
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        <nav aria-label="Product" className="lg:col-span-2 space-y-3 font-mono text-xs">
          <h2 className="text-[#282828] font-bold uppercase tracking-wider text-[11px]">Product</h2>
          <a href="/how-it-works" className="block hover:text-[#e15c46]">How it works</a>
          <a href="/pricing" className="block hover:text-[#e15c46]">Pricing</a>
          <a href="/integrations" className="block hover:text-[#e15c46]">Integrations</a>
          <a href="/security" className="block hover:text-[#e15c46]">Security</a>
          <a href="/faq" className="block hover:text-[#e15c46]">FAQ</a>
        </nav>

        <nav aria-label="Learn" className="lg:col-span-3 space-y-3 font-mono text-xs">
          <h2 className="text-[#282828] font-bold uppercase tracking-wider text-[11px]">Learn</h2>
          {LEARN_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="block hover:text-[#e15c46]">
              {link.label}
            </a>
          ))}
        </nav>

        <nav aria-label="Get started" className="lg:col-span-3 space-y-3 font-mono text-xs">
          <h2 className="text-[#282828] font-bold uppercase tracking-wider text-[11px]">Get started</h2>
          <a href="/agent" className="block hover:text-[#e15c46]">Ask Helio</a>
          <a href="/console" className="block hover:text-[#e15c46]">Graph console</a>
          <a href="/auth" className="block hover:text-[#e15c46]">Create an account</a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[#282828] hover:text-[#e15c46] pt-1"
          >
            <GitBranch className="w-3.5 h-3.5" aria-hidden="true" />
            GitHub repository
            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
          </a>
        </nav>
      </div>

      <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-[11px] text-[#5c5c56]">
        <div>© 2026 Helio. All rights reserved.</div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href="/pricing" className="hover:text-[#282828]">Pricing</a>
          <a href="/security" className="hover:text-[#282828]">Security</a>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-[#282828]">{CONTACT_EMAIL}</a>
        </div>
      </div>
    </div>
  </footer>
);

export const MarketingShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <div className="min-h-screen bg-[#ecece4] text-[#282828] font-mono relative selection:bg-[#e15c46] selection:text-white overflow-x-hidden">
      <SiteHeader />
      <main id="main-content" className="w-full">
        {children}
      </main>
      <SiteFooter />
    </div>
  </AuthProvider>
);

export const PageHero: React.FC<{
  eyebrow: string;
  title: string;
  lede: string;
  children?: React.ReactNode;
}> = ({ eyebrow, title, lede, children }) => (
  <section className="w-full max-w-7xl mx-auto px-4 md:px-8 pt-14 md:pt-20 pb-10 md:pb-14">
    <div className="font-mono text-[10px] uppercase tracking-widest text-[#e15c46] font-bold">
      {eyebrow}
    </div>
    <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-mono font-bold tracking-tighter uppercase leading-[0.95] max-w-5xl">
      {title}
    </h1>
    <p className="mt-6 max-w-3xl font-mono text-sm md:text-base text-[#5c5c56] leading-relaxed">
      {lede}
    </p>
    {children ? <div className="mt-8 flex flex-wrap items-center gap-4">{children}</div> : null}
  </section>
);

export const Section: React.FC<{
  id?: string;
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ id, eyebrow, title, children, className = '' }) => (
  <section id={id} className={`w-full max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16 ${className}`}>
    {eyebrow ? (
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#e15c46] font-bold">
        {eyebrow}
      </div>
    ) : null}
    {title ? (
      <h2 className="mt-3 text-2xl md:text-4xl font-mono font-bold tracking-tight uppercase leading-tight max-w-3xl">
        {title}
      </h2>
    ) : null}
    <div className={title || eyebrow ? 'mt-6' : ''}>{children}</div>
  </section>
);

export const Prose: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`max-w-3xl font-mono text-sm md:text-[15px] text-[#5c5c56] leading-relaxed space-y-4 ${className}`}>
    {children}
  </div>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`relative bg-[#f4f4ec] cad-border p-6 ${className}`}>
    <CadCrosshair position="tl" />
    <CadCrosshair position="tr" />
    {children}
  </div>
);

export const FaqBlock: React.FC<{
  items: { question: string; answer: string }[];
  title?: string;
  id?: string;
}> = ({ items, title = 'Frequently asked questions', id = 'faq' }) => (
  <Section id={id} eyebrow="FAQ" title={title}>
    <dl className="max-w-3xl space-y-6">
      {items.map((item) => (
        <div key={item.question} className="cad-border bg-[#f4f4ec] p-5">
          <dt className="font-mono font-bold text-sm md:text-base text-[#282828]">{item.question}</dt>
          <dd className="mt-2 font-mono text-xs md:text-sm text-[#5c5c56] leading-relaxed">{item.answer}</dd>
        </div>
      ))}
    </dl>
  </Section>
);

export const CtaBand: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <section className="w-full max-w-7xl mx-auto px-4 md:px-8 pb-16">
    <div className="relative bg-[#282828] text-white cad-border p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h2 className="font-mono text-2xl md:text-3xl font-bold uppercase tracking-tight">{title}</h2>
        <p className="mt-3 max-w-xl font-mono text-xs md:text-sm text-white/70 leading-relaxed">{body}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <CtaLink href="/agent" variant="brand" size="lg">Ask Helio</CtaLink>
        <CtaLink href="/pricing" variant="outline" size="lg" className="!border-white/40 !text-white hover:!bg-white hover:!text-[#282828]">
          See pricing
        </CtaLink>
      </div>
    </div>
  </section>
);

export { NAV_LINKS, LEARN_LINKS };
