import React from 'react';
import { ARTICLES } from '../content/articles';
import { PricingPage } from './PricingPage';
import { HowItWorksPage } from './HowItWorksPage';
import { SecurityPage } from './SecurityPage';
import { FaqPage } from './FaqPage';
import { IntegrationsPage } from './IntegrationsPage';
import { LearnPage, ArticlePage } from './LearnPage';
import { MarketingShell, CtaBand, PageHero } from './MarketingChrome';

export const NotFoundPage: React.FC = () => (
  <MarketingShell>
    <PageHero
      eyebrow="404"
      title="This node is not in the graph."
      lede="The page you asked for does not exist, or it moved. The links below lead back to the parts of the site that do."
    >
      <a
        href="/"
        className="inline-flex items-center gap-2 border border-[#e15c46] bg-[#e15c46] text-white font-mono font-bold uppercase tracking-wider text-[12px] py-2.5 px-4 hover:bg-[#282828] hover:border-[#282828]"
      >
        Back to home
      </a>
    </PageHero>
    <section className="w-full max-w-7xl mx-auto px-4 md:px-8 pb-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: '/pricing', label: 'Pricing' },
          { href: '/how-it-works', label: 'How it works' },
          { href: '/security', label: 'Security' },
          { href: '/faq', label: 'FAQ' },
          { href: '/integrations', label: 'Integrations' },
          { href: '/learn', label: 'Learn' },
          { href: '/agent', label: 'Ask Helio' },
          { href: '/console', label: 'Graph console' },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="cad-border bg-[#f4f4ec] p-4 font-mono text-xs font-bold uppercase tracking-wider text-[#282828] hover:bg-[#282828] hover:text-white"
          >
            {link.label} →
          </a>
        ))}
      </div>
    </section>
    <CtaBand
      title="Looking for the product?"
      body="Start with the demo company. It needs no account and every answer shows its trail."
    />
  </MarketingShell>
);

export const MARKETING_PAGES: Record<string, React.FC> = {
  '/pricing': PricingPage,
  '/how-it-works': HowItWorksPage,
  '/security': SecurityPage,
  '/faq': FaqPage,
  '/integrations': IntegrationsPage,
  '/learn': LearnPage,
};

for (const article of ARTICLES) {
  MARKETING_PAGES[article.path] = () => <ArticlePage article={article} />;
}

export const MARKETING_PATHS = Object.keys(MARKETING_PAGES);
