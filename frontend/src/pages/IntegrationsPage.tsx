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

const MATRIX = [
  { source: 'GitHub', status: 'Native connector', read: 'Issues, PRs, commit metadata', sync: 'API sync', write: 'Read-only', plan: 'Starter+' },
  { source: 'Slack', status: 'Native connector', read: 'Messages and channels', sync: 'API sync', write: 'Read-only', plan: 'Free' },
  { source: 'Linear', status: 'Import', read: 'Issues and projects', sync: 'API import', write: 'Read-only', plan: 'Free' },
  { source: 'Notion', status: 'Import', read: 'Pages and databases', sync: 'API import', write: 'Read-only', plan: 'Free' },
  { source: 'Webhook', status: 'Import', read: 'Events and payloads', sync: 'Push import', write: 'Read-only', plan: 'Free' },
  { source: 'CSV', status: 'Import', read: 'Structured records', sync: 'File import', write: 'Read-only', plan: 'Free' },
  { source: 'Jira', status: 'Not native yet', read: '—', sync: '—', write: '—', plan: '—' },
  { source: 'PagerDuty / Opsgenie / Confluence', status: 'Not native yet', read: '—', sync: '—', write: '—', plan: '—' },
];

const STRUCTURED_IMPORTS = [
  {
    name: 'Helio API',
    status: 'Available on paid plans',
    body: 'Create an API key in the account and query the same graph from your own tooling. Keys are scoped to the workspace and can be revoked.',
  },
  {
    name: 'Services and dependencies',
    status: 'Available via import',
    body: 'Import services, owning teams, and dependency relationships from structured records.',
  },
  {
    name: 'On-call rotations',
    status: 'Available via import',
    body: 'Rotation membership and the active weekly on-call are separate facts, so "on the rotation" is not confused with "paging now".',
  },
  {
    name: 'Decision records',
    status: 'Available via import',
    body: 'ADRs and architecture notes are stored with dates and supersession edges. A newer decision can retire an older document without deleting it.',
  },
];

const FAQS = [
  {
    question: 'Does the GitHub connection need write access?',
    answer:
      'No. It reads issues, pull requests and commit metadata for the repository named in the deployment. It does not comment, merge, label or change issues.',
  },
  {
    question: 'Can we import services and dependencies?',
    answer:
      'Yes. Services, teams, people, dependencies, on-call rotations, and decisions can be imported as structured records.',
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
      <CtaLink href="/agent">Open the console</CtaLink>
      <CtaLink href="/how-it-works" variant="outline">How the graph works</CtaLink>
    </PageHero>

    <Section eyebrow="Availability" title="Native, import, API and not-native sources">
      <p className="mb-6 font-mono text-xs text-[#5c5c56] leading-relaxed">
        Statuses match what Helio can do today. Import sources are structured data imports, not one-click
        connectors.
      </p>
      <div className="overflow-x-auto cad-border bg-[#f4f4ec]">
        <table className="w-full min-w-[760px] border-collapse text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-[#282828]/20 text-[10px] uppercase tracking-wider text-[#5c5c56]">
              <th className="px-4 py-3 font-bold">Source</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Data read</th>
              <th className="px-4 py-3 font-bold">Sync method</th>
              <th className="px-4 py-3 font-bold">Write access</th>
              <th className="px-4 py-3 font-bold">Plan</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row.source} className="border-b border-[#282828]/10 last:border-b-0 text-[#282828]">
                <td className="px-4 py-3 font-bold">{row.source}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block border px-2 py-1 text-[9px] uppercase tracking-wider ${
                      row.status === 'Not native yet'
                        ? 'border-[#282828]/30 text-[#5c5c56]'
                        : 'border-[#e15c46] text-[#e15c46]'
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#5c5c56]">{row.read}</td>
                <td className="px-4 py-3 text-[#5c5c56]">{row.sync}</td>
                <td className="px-4 py-3 text-[#5c5c56]">{row.write}</td>
                <td className="px-4 py-3 text-[#5c5c56]">{row.plan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
        {STRUCTURED_IMPORTS.map((source) => (
          <div key={source.name} className="cad-border bg-[#f4f4ec] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-mono text-base font-bold uppercase text-[#282828]">{source.name}</h3>
              <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 border border-[#e15c46] text-[#e15c46]">
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