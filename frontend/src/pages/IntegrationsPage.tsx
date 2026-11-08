import React from 'react';
import {
  CtaBand,
  CtaLink,
  FaqBlock,
  MarketingShell,
  PageHero,
  Prose,
  Section,
} from './MarketingChrome';

const SOURCES = [
  {
    name: 'GitHub',
    status: 'Available',
    body: 'Reads issues, pull requests and commit metadata for one owner and repository. Used as a recency signal: who touched the code, and when. Read-only; Helio never writes back.',
  },
  {
    name: 'Services and dependencies',
    status: 'Available',
    body: 'Services, owning teams and HAS_DEPENDENT edges are loaded from structured records. The demo ships with a 20-service company so the graph can be evaluated before a real import.',
  },
  {
    name: 'On-call rotations',
    status: 'Available via import',
    body: 'Rotation membership and the active weekly on-call are separate facts. Helio stores both, so "on the rotation" is not confused with "paging now".',
  },
  {
    name: 'Decision records',
    status: 'Available via import',
    body: 'ADRs and architecture notes are stored with dates and SUPERSEDES edges. A newer decision can retire an older document without deleting it.',
  },
  {
    name: 'Helio API',
    status: 'Available on paid plans',
    body: 'Create an API key in the account and query the same graph from your own tooling. Keys are scoped to the workspace and can be revoked.',
  },
  {
    name: 'PagerDuty, Opsgenie, Jira, Confluence',
    status: 'Not native yet',
    body: 'There is no one-click connector for these today. Their records can be imported through the graph loader, and Enterprise onboarding can scope a connector if that is the blocker.',
  },
];

const FAQS = [
  {
    question: 'Does the GitHub connection need write access?',
    answer:
      'No. It reads issues, pull requests and commit metadata for the repository named in the deployment. It does not comment, merge, label or change issues.',
  },
  {
    question: 'Can we import our own services and dependencies?',
    answer:
      'Yes. Services, teams, people, dependencies, on-call rotations and decisions are loaded as structured records. The loader is the same one used to build the demo company, so the shape is documented in the repository.',
  },
  {
    question: 'Is there a real-time PagerDuty sync?',
    answer:
      'Not today. On-call data is imported into the graph. If you need a native connector, say so during an Enterprise conversation; we would rather scope it than claim it exists.',
  },
  {
    question: 'What does the API return?',
    answer:
      'The same answer and trail the agent shows, including the graph path, dates and any missing edge. API access is available on Professional and Enterprise plans.',
  },
];

export const IntegrationsPage: React.FC = () => (
  <MarketingShell>
    <PageHero
      eyebrow="Integrations"
      title="Connect the records that answer the question."
      lede="Helio is not another place to write documentation. It reads the systems that already hold ownership, dependencies, on-call rotations and decisions, then joins them in one graph."
    >
      <CtaLink href="/agent">See the demo graph</CtaLink>
      <CtaLink href="/how-it-works" variant="outline">How the graph works</CtaLink>
    </PageHero>

    <Section eyebrow="Sources" title="What can go into the graph">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SOURCES.map((source) => (
          <div key={source.name} className="cad-border bg-[#f4f4ec] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-mono text-base font-bold uppercase text-[#282828]">{source.name}</h3>
              <span
                className={`font-mono text-[9px] uppercase tracking-widest px-2 py-1 border ${
                  source.status === 'Not native yet'
                    ? 'border-[#282828]/30 text-[#5c5c56]'
                    : 'border-[#e15c46] text-[#e15c46]'
                }`}
              >
                {source.status}
              </span>
            </div>
            <p className="mt-3 font-mono text-xs text-[#5c5c56] leading-relaxed">{source.body}</p>
          </div>
        ))}
      </div>
    </Section>

    <Section eyebrow="Data flow" title="Source systems stay the source of truth">
      <Prose>
        <p>
          Helio stores relationships and dates, not copies of every document. A GitHub issue remains
          in GitHub; the graph records that it exists, who is involved and when it changed. A
          decision record remains in the repository; the graph records that D-19 supersedes the March
          document.
        </p>
        <p>
          That keeps the import small and makes staleness visible. If a source has not been synced,
          the date on the edge shows it. The answer can still use the edge, but it cannot pretend the
          edge is fresh.
        </p>
      </Prose>
    </Section>

    <FaqBlock items={FAQS} title="Integration questions" id="integrations-faq" />

    <CtaBand
      title="Have a source that is not listed?"
      body="Tell us what holds the record and how often it changes. We will say whether it can be imported today or whether it needs a connector."
    />
  </MarketingShell>
);
