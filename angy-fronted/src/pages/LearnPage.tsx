import React from 'react';
import { ARTICLES, type Article } from '../content/articles';
import {
  CtaBand,
  CtaLink,
  FaqBlock,
  MarketingShell,
  PageHero,
  Section,
} from './MarketingChrome';

const SUMMARIES: Record<string, string> = {
  '/learn/service-ownership':
    'What ownership means, the four questions an ownership system must answer, and how to keep the record current.',
  '/learn/find-service-owner':
    'A step-by-step way to find the accountable team, verify it against three signals, and handle the unowned case.',
  '/learn/service-ownership-checklist':
    'The four non-negotiables, the monthly review and the failure modes that make an ownership record go stale.',
  '/learn/service-ownership-tools':
    'The five capabilities that separate an ownership system from a spreadsheet, plus demo questions that expose weak tools.',
  '/learn/who-owns-this-service':
    'Why the top committer is often the wrong answer, and the four signals that produce an owner you can act on.',
  '/learn/blast-radius-analysis':
    'How to follow dependency direction, group by hop depth, and spot the unowned service that makes a cascade worse.',
  '/learn/knowledge-graph-vs-rag':
    'What text retrieval is good at, where similarity fails for ownership and impact, and how to combine both.',
  '/learn/service-ownership-on-call':
    'Why ownership and on-call are different facts, and how to keep rotations and escalation paths current.',
  '/learn/stale-documentation':
    'A practical stale-doc check using verification dates, supersession edges and code-touch signals.',
};

export const LearnPage: React.FC = () => (
  <MarketingShell>
    <PageHero
      eyebrow="Learn"
      title="Guides for the questions search cannot answer."
      lede="Practical notes on service ownership, blast radius, on-call tracking, stale documentation and the difference between a knowledge graph and RAG. Each guide uses the same synthetic company as the demo."
    >
      <CtaLink href="/agent">Try the demo graph</CtaLink>
      <CtaLink href="/how-it-works" variant="outline">How Helio works</CtaLink>
    </PageHero>

    <Section eyebrow="Guides" title="Start with the problem you have">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ARTICLES.map((article) => (
          <a
            key={article.path}
            href={article.path}
            className="group cad-border bg-[#f4f4ec] p-6 hover:bg-[#282828] transition-colors"
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#e15c46] font-bold">
              {article.eyebrow}
            </div>
            <h2 className="mt-2 font-mono text-lg md:text-xl font-bold uppercase text-[#282828] group-hover:text-white leading-tight">
              {article.h1}
            </h2>
            <p className="mt-3 font-mono text-xs text-[#5c5c56] group-hover:text-white/70 leading-relaxed">
              {SUMMARIES[article.path]}
            </p>
            <span className="mt-4 inline-block font-mono text-[10px] uppercase tracking-widest text-[#e15c46]">
              Read the guide →
            </span>
          </a>
        ))}
      </div>
    </Section>

    <CtaBand
      title="See the graph behind the guides"
      body="The demo uses the same payments-gateway company described in these articles: 185 nodes, eight downstream services and one deliberately unowned service."
    />
  </MarketingShell>
);

export const ArticlePage: React.FC<{ article: Article }> = ({ article }) => (
  <MarketingShell>
    <PageHero eyebrow={article.eyebrow} title={article.h1} lede={article.answer}>
      <CtaLink href="/agent">Ask the demo</CtaLink>
      <CtaLink href="/pricing" variant="outline">See pricing</CtaLink>
    </PageHero>

    <article className="w-full max-w-7xl mx-auto px-4 md:px-8 pb-8">
      <div className="max-w-3xl font-mono text-[10px] uppercase tracking-widest text-[#8a8a80] pb-4 cad-border-b">
        Updated 28 October 2026 · Helio Learn
      </div>

      {article.sections.map((section) => (
        <section key={section.heading} className="max-w-3xl pt-10">
          <h2 className="font-mono text-xl md:text-2xl font-bold uppercase tracking-tight text-[#282828]">
            {section.heading}
          </h2>
          <div className="mt-4 space-y-4 font-mono text-sm md:text-[15px] text-[#5c5c56] leading-relaxed">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets ? (
              <ul className="list-disc pl-5 space-y-2">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
            {section.links ? (
              <ul className="space-y-2 pt-1">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="text-[#e15c46] underline hover:no-underline">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ))}

      <section className="max-w-3xl pt-10">
        <h2 className="font-mono text-xl md:text-2xl font-bold uppercase tracking-tight text-[#282828]">
          {article.example.title}
        </h2>
        <div className="mt-4 cad-border bg-[#f4f4ec] p-5 space-y-4 font-mono text-sm text-[#5c5c56] leading-relaxed">
          {article.example.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="max-w-3xl pt-10">
        <h2 className="font-mono text-xl md:text-2xl font-bold uppercase tracking-tight text-[#282828]">
          Related
        </h2>
        <ul className="mt-4 space-y-2 font-mono text-sm">
          {article.related.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="text-[#e15c46] underline hover:no-underline">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>

    <FaqBlock items={article.faqs} title="Questions about this guide" id="article-faq" />

    <CtaBand
      title="Check the example yourself"
      body="Open the agent, ask about payments-gateway or config-service, and compare the trail with the worked example in this guide."
    />
  </MarketingShell>
);
