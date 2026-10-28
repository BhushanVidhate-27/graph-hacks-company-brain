import React, { useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, ChevronDown, Terminal } from 'lucide-react';
import { CadCrosshair } from './CadCrosshair';
import { Reveal } from './motion/Reveal';

/**
 * Same question, two answers.
 *
 * The old section hid half of the comparison behind a drag handle. This one
 * puts both answers on screen at once: the ranked chunks a flat index returns,
 * and the typed path Helio returns for the same question. Each case is one
 * click away, and every case carries its own dates, edges and Cypher.
 *
 * The layout borrows the parts competitors do well — a single framed product
 * surface (incident.io), dashed node paths (Port), evidence tiles (OpsLevel),
 * dense product data (Rootly) and a query-first composition (Glean) — while
 * keeping the cream/charcoal/coral CAD language.
 */

type TrailTone = 'root' | 'accent' | 'plain' | 'empty';

interface AnswerRow {
  name: string;
  note: string;
  score: number;
  date: string;
  flag: string;
}

interface TrailStep {
  label: string;
  via?: string;
  tone: TrailTone;
}

interface Fact {
  label: string;
  value: string;
  note: string;
  empty?: boolean;
}

interface DemoCase {
  id: string;
  index: string;
  tab: string;
  query: string;
  flatMode: string;
  hits: AnswerRow[];
  flatVerdict: string;
  flatDetail: string;
  graphMode: string;
  pathLabel: string;
  trail: TrailStep[];
  facts: Fact[];
  graphVerdict: string;
  graphDetail: string;
  cypher: string;
  evidence: string[];
}

const CASES: DemoCase[] = [
  {
    id: 'payments-gateway',
    index: '01',
    tab: 'Ownership',
    query: 'Who owns payments-gateway today, and who gets paged?',
    flatMode: 'Vector + keyword',
    hits: [
      {
        name: 'the former payments lead',
        note: '14 commits — the highest volume on the service',
        score: 94,
        date: 'Last touch 2026-04-15',
        flag: 'Stale',
      },
      {
        name: 'the current Platform on-call',
        note: '5 commits — recent work on the same service',
        score: 71,
        date: 'Last touch 2026-09-28',
        flag: 'Fresh',
      },
      {
        name: 'payments-provider-eval-v3',
        note: 'A document ranked on the word “owner”',
        score: 63,
        date: 'Verified 2026-03-18',
        flag: 'Superseded',
      },
    ],
    flatVerdict: 'Returns the person who left in April.',
    flatDetail:
      'Commit volume is a history of attention, not a statement of accountability. The index has no OWNED_BY edge and no rotation, so it cannot see the handover.',
    graphMode: 'Typed edges',
    pathLabel:
      'Traversal path: payments-gateway is owned by Platform, whose on-call rotation responds this week.',
    trail: [
      { label: 'payments-gateway', tone: 'root' },
      { label: 'Platform', via: 'OWNED_BY', tone: 'accent' },
      { label: 'Platform rotation', via: 'ON_CALL', tone: 'plain' },
    ],
    facts: [
      { label: 'Owner', value: 'Platform team', note: 'accountable today' },
      { label: 'On-call', value: 'Platform rotation', note: 'active this week' },
      { label: 'Blast radius', value: '8 services', note: '3 hops deep' },
      { label: 'Handover', value: 'D-21', note: '2026-04-15' },
    ],
    graphVerdict: 'Returns the team accountable today.',
    graphDetail:
      'D-21 moved ownership on 2026-04-15. The Platform rotation supplies the current responder, and the 2026-09-28 commit confirms the service is still active.',
    cypher:
      "MATCH (s:Service {name: 'payments-gateway'})-[:OWNED_BY]->(t:Team)\n" +
      'OPTIONAL MATCH (t)<-[:ON_CALL]-(m:Person)\n' +
      'OPTIONAL MATCH (s)-[:HAS_DEPENDENT*1..3]->(d:Service)\n' +
      'RETURN t.name, m.name, count(DISTINCT d) AS downstream',
    evidence: ['D-21 · 2026-04-15', 'Commit · 2026-09-28', 'Rotation · this week'],
  },
  {
    id: 'config-service',
    index: '02',
    tab: 'Honest absence',
    query: 'Who owns config-service?',
    flatMode: 'Vector + LLM',
    hits: [
      {
        name: 'Platform team',
        note: 'Inferred from the service name and team docs',
        score: 71,
        date: 'No source date',
        flag: 'Inferred',
      },
      {
        name: 'Payments team',
        note: 'Three documents mention the service',
        score: 64,
        date: 'No source date',
        flag: 'Inferred',
      },
      {
        name: 'Infrastructure team',
        note: 'Plausible answer, no supporting record',
        score: 58,
        date: 'No source date',
        flag: 'Inferred',
      },
    ],
    flatVerdict: 'Every result is a guess.',
    flatDetail:
      'A similarity model has no way to return “no owner”. It fills the gap with the most plausible team, and the answer looks just as confident as a correct one.',
    graphMode: 'Verified absence',
    pathLabel:
      'Traversal path: config-service has no OWNED_BY edge and no on-call rotation. The absence is the answer.',
    trail: [
      { label: 'config-service', tone: 'root' },
      { label: '∅  no team', via: 'OWNED_BY', tone: 'empty' },
      { label: '∅  no rotation', via: 'ON_CALL', tone: 'empty' },
    ],
    facts: [
      { label: 'Owner', value: 'None', note: 'no OWNED_BY edge', empty: true },
      { label: 'On-call', value: 'None', note: 'no rotation assigned', empty: true },
      { label: 'Blast radius', value: '0 services', note: 'no dependents' },
      { label: 'Verified', value: '2026-10-28', note: 'absence checked' },
    ],
    graphVerdict: 'Returns the absence, not a guess.',
    graphDetail:
      'The query uses OPTIONAL MATCH. When OWNED_BY is missing, the answer says so and stops. That is a fact about the graph, not a gap in the data.',
    cypher:
      "MATCH (s:Service {name: 'config-service'})\n" +
      'OPTIONAL MATCH (s)-[:OWNED_BY]->(t:Team)\n' +
      'OPTIONAL MATCH (t)<-[:ON_CALL]-(m:Person)\n' +
      'RETURN s.name, t.name, m.name  // NULL is the answer',
    evidence: ['Edge scan · OWNED_BY', 'Absence check · 2026-10-28', '0 dependents'],
  },
  {
    id: 'provider-decision',
    index: '03',
    tab: 'Supersession',
    query: 'Are we still on a single payment provider?',
    flatMode: 'Vector + keyword',
    hits: [
      {
        name: 'payments-provider-eval-v3.md',
        note: '“Single provider, Stripe.”',
        score: 81,
        date: 'Written 2026-03-18',
        flag: 'Stale',
      },
      {
        name: 'stripe-cutover-notes.md',
        note: '“Stripe is the only provider.”',
        score: 74,
        date: 'Written 2026-02-02',
        flag: 'Stale',
      },
      {
        name: 'payments-gateway README',
        note: 'Lists one provider integration',
        score: 69,
        date: 'Written 2026-01-19',
        flag: 'Stale',
      },
    ],
    flatVerdict: 'Returns the document that was overturned.',
    flatDetail:
      'All three chunks are real and well written. None of them knows that Decision D-19 replaced the March plan, because the index has no SUPERSEDES edge.',
    graphMode: 'Typed edges',
    pathLabel:
      'Traversal path: D-14 is superseded by D-19, whose evidence is the v4 provider evaluation.',
    trail: [
      { label: 'D-14 · March plan', tone: 'root' },
      { label: 'D-19 · May plan', via: 'SUPERSEDED_BY', tone: 'accent' },
      { label: 'provider-eval-v4', via: 'EVIDENCED_BY', tone: 'plain' },
    ],
    facts: [
      { label: 'Current', value: 'Dual provider', note: 'Adyen primary · Stripe fallback' },
      { label: 'Decision', value: 'D-19', note: 'dated 2026-05-06' },
      { label: 'Author', value: 'VP of Engineering', note: 'accountable sign-off' },
      { label: 'Status', value: 'Active', note: 'D-14 superseded' },
    ],
    graphVerdict: 'Returns the decision that replaced the docs.',
    graphDetail:
      'The SUPERSEDES edge is the missing fact in flat search. D-19 is active, D-14 is superseded, and the current state is Adyen primary with Stripe fallback.',
    cypher:
      "MATCH (current:Decision {id: 'D-19'})-[:SUPERSEDES]->(old:Decision {id: 'D-14'})\n" +
      'OPTIONAL MATCH (current)-[:EVIDENCED_BY]->(doc:Document)\n' +
      'RETURN current.summary, current.date, old.summary, doc.name',
    evidence: ['D-19 · 2026-05-06', 'D-14 · superseded', 'Doc · v4 2026-05-06'],
  },
];

const chipClass = (tone: TrailTone) => {
  switch (tone) {
    case 'root':
      return 'border-[#282828] bg-[#282828] text-white';
    case 'accent':
      return 'border-[#c2452d] bg-[#c2452d] text-white';
    case 'empty':
      return 'answer-empty border-dashed border-[#c2452d] text-[#b03d28]';
    case 'plain':
    default:
      return 'border-[#282828]/35 bg-white text-[#282828]';
  }
};

const Trail: React.FC<{ steps: TrailStep[] }> = ({ steps }) => (
  <div className="flex flex-wrap items-center gap-y-1.5" aria-hidden="true">
    {steps.map((step, index) => {
      const chip = (
        <span
          className={`inline-flex items-center border px-2 py-1 font-mono text-[9.5px] font-bold leading-none lg:px-1.5 ${chipClass(
            step.tone,
          )}`}
        >
          {step.label}
        </span>
      );

      if (index === 0) {
        return <React.Fragment key={step.label}>{chip}</React.Fragment>;
      }

      return (
        <span key={step.label} className="inline-flex items-center">
          <span className="inline-flex items-center gap-1 px-1 lg:gap-0.5 lg:px-0.5">
            <span className="h-px w-2.5 border-t border-dashed border-[#282828]/40 lg:w-2" />
            <span className="whitespace-nowrap font-mono text-[7.5px] font-bold uppercase tracking-[0.12em] text-[#b03d28]">
              {step.via}
            </span>
            <span className="h-px w-2.5 border-t border-dashed border-[#282828]/40 lg:w-2" />
          </span>
          {chip}
        </span>
      );
    })}
  </div>
);

const FlatPane: React.FC<{ data: DemoCase }> = ({ data }) => (
  <section
    aria-label="Flat search answer"
    className="flex flex-col p-4 md:p-6 lg:border-r lg:border-[#282828]/15"
  >
    <header className="flex items-center justify-between gap-3 border-b border-[#282828]/15 pb-2.5">
      <div className="flex items-center gap-2">
        <span className="grid h-4 w-4 place-items-center border border-[#282828]/25 bg-[#ecece4] font-mono text-[8px] font-bold">
          01
        </span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#282828]">
          Flat search
        </span>
      </div>
      <span className="border border-[#282828]/25 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[#5c5c56]">
        {data.flatMode}
      </span>
    </header>

    <ol className="mt-1 divide-y divide-[#282828]/10">
      {data.hits.map((hit, index) => (
        <li
          key={hit.name}
          className={`flex gap-3 border-l-2 py-3 pl-2.5 ${
            index === 0 ? 'answer-stale border-[#c2452d]' : 'border-transparent'
          }`}
        >
          <span className="w-4 shrink-0 pt-0.5 font-mono text-[9px] text-[#5c5c56]">
            #{index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <div
              className={`font-mono text-[12px] font-bold leading-tight ${
                index === 0 ? 'text-[#b03d28]' : 'text-[#282828]'
              }`}
            >
              {hit.name}
            </div>
            <div className="mt-1 font-mono text-[10px] leading-snug text-[#5c5c56]">
              {hit.note}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="h-1 w-16 bg-[#282828]/10" aria-hidden="true">
                <span
                  className={`block h-full ${
                    index === 0 ? 'bg-[#c2452d]' : 'bg-[#282828]/45'
                  }`}
                  style={{ width: `${hit.score}%` }}
                />
              </span>
              <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#5c5c56]">
                {(hit.score / 100).toFixed(2)} match
              </span>
              <span className="font-mono text-[9px] text-[#282828]/25" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-[#5c5c56]">
                {hit.date}
              </span>
            </div>
          </div>

          <span
            className={`h-fit shrink-0 border px-1.5 py-0.5 font-mono text-[7.5px] font-bold uppercase tracking-[0.1em] ${
              index === 0
                ? 'border-[#c2452d] bg-[#c2452d] text-white'
                : 'border-[#282828]/25 text-[#5c5c56]'
            }`}
          >
            {hit.flag}
          </span>
        </li>
      ))}
    </ol>

    <div className="mt-auto pt-4">
      <div className="border-l-2 border-[#c2452d] bg-[#c2452d]/[0.07] px-3 py-2.5">
        <div className="flex items-start gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#b03d28]">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{data.flatVerdict}</span>
        </div>
        <p className="mt-1.5 font-mono text-[10.5px] leading-relaxed text-[#5c5c56]">
          {data.flatDetail}
        </p>
      </div>
    </div>
  </section>
);

const GraphPane: React.FC<{ data: DemoCase }> = ({ data }) => (
  <section
    aria-label="Helio graph answer"
    className="flex flex-col border-t border-[#282828]/15 p-4 md:p-6 lg:border-t-0"
  >
    <header className="flex items-center justify-between gap-3 border-b border-[#282828]/15 pb-2.5">
      <div className="flex items-center gap-2">
        <span className="grid h-4 w-4 place-items-center bg-[#282828] font-mono text-[8px] font-bold text-white">
          02
        </span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#282828]">
          Helio graph
        </span>
      </div>
      <span className="border border-[#282828] bg-[#282828] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white">
        {data.graphMode}
      </span>
    </header>

    <div className="mt-4">
      <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#5c5c56]">
        Traversal path
      </div>
      <p className="sr-only">{data.pathLabel}</p>
      <div className="mt-2">
        <Trail steps={data.trail} />
      </div>
    </div>

    <dl className="mt-5 grid grid-cols-2 border border-[#282828]/15">
      {data.facts.map((fact, index) => (
        <div
          key={fact.label}
          className={`border-[#282828]/15 p-2.5 ${index % 2 === 0 ? 'border-r' : ''} ${
            index < 2 ? 'border-b' : ''
          }`}
        >
          <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#5c5c56]">
            {fact.label}
          </dt>
          <dd
            className={`mt-1 font-mono text-[12px] font-bold leading-tight ${
              fact.empty ? 'text-[#b03d28]' : 'text-[#282828]'
            }`}
          >
            {fact.value}
          </dd>
          <dd className="mt-0.5 font-mono text-[9.5px] leading-snug text-[#5c5c56]">
            {fact.note}
          </dd>
        </div>
      ))}
    </dl>

    <div className="mt-auto pt-4">
      <div className="border-l-2 border-[#c2452d] bg-[#282828] px-3 py-2.5">
        <div className="flex items-start gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white">
          <span className="mt-px grid h-3 w-3 shrink-0 place-items-center bg-[#c2452d]">
            <Check className="h-2.5 w-2.5 text-white" aria-hidden="true" />
          </span>
          <span>{data.graphVerdict}</span>
        </div>
        <p className="mt-1.5 font-mono text-[10.5px] leading-relaxed text-white/70">
          {data.graphDetail}
        </p>
      </div>
    </div>
  </section>
);

const CaseFile: React.FC<{ data: DemoCase }> = ({ data }) => (
  <>
    {/* Product chrome: one framed surface, not a loose pair of cards. */}
    <div className="flex items-center justify-between gap-3 border-b border-[#282828]/15 bg-[#ecece4] px-4 py-2.5 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex shrink-0 gap-1" aria-hidden="true">
          <span className="h-2 w-2 border border-[#282828]/50 bg-[#c2452d]" />
          <span className="h-2 w-2 border border-[#282828]/50 bg-[#282828]/20" />
          <span className="h-2 w-2 border border-[#282828]/50 bg-[#282828]/20" />
        </div>
        <span className="truncate font-mono text-[9.5px] text-[#5c5c56]">
          helio / answers / {data.id}
        </span>
      </div>
      <div className="hidden shrink-0 items-center gap-2 font-mono text-[8px] uppercase tracking-[0.14em] text-[#5c5c56] sm:flex">
        <span>Read-only</span>
        <span className="text-[#282828]/25">·</span>
        <span>Sample data</span>
      </div>
    </div>

    {/* The question is the same for both panes below. */}
    <div className="flex flex-col gap-3 border-b border-[#282828]/15 px-4 py-4 md:flex-row md:items-center md:px-6 md:py-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center bg-[#c2452d] font-mono text-[11px] font-bold text-white">
          Q
        </span>
        <p className="font-mono text-[13px] font-bold leading-snug text-[#282828] md:text-[15px]">
          {data.query}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 font-mono text-[8px] uppercase tracking-[0.14em] text-[#5c5c56] md:text-right">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 bg-[#c2452d]" aria-hidden="true" />
          Case {data.index} / 03
        </span>
        <span className="hidden sm:inline">Sample run · 41 ms</span>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2">
      <FlatPane data={data} />
      <GraphPane data={data} />
    </div>

    {/* Evidence strip + the query itself, one click away. */}
    <div className="border-t border-[#282828]/15 px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[8px] uppercase tracking-[0.12em]">
        <span className="flex items-center gap-1.5 font-bold text-[#b03d28]">
          <span className="h-1.5 w-1.5 bg-[#c2452d]" aria-hidden="true" />
          Evidence
        </span>
        {data.evidence.map((item) => (
          <span key={item} className="text-[#5c5c56]">
            {item}
          </span>
        ))}
      </div>

      <details className="group mt-1.5">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-[#5c5c56] transition-colors hover:text-[#282828] [&::-webkit-details-marker]:hidden">
          <Terminal className="h-3 w-3" aria-hidden="true" />
          Cypher executed
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <pre className="mt-2 max-w-full overflow-x-auto border border-[#282828]/20 bg-[#282828] p-3 font-mono text-[9.5px] leading-relaxed text-white/80">
          {data.cypher}
        </pre>
      </details>
    </div>
  </>
);

export const ViolationInspector: React.FC = () => {
  const [activeId, setActiveId] = useState(CASES[0].id);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeCase = CASES.find((item) => item.id === activeId) ?? CASES[0];

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;

    if (event.key === 'ArrowRight') next = (index + 1) % CASES.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + CASES.length) % CASES.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = CASES.length - 1;
    else return;

    event.preventDefault();
    setActiveId(CASES[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section
      id="inspector-section"
      aria-labelledby="answer-compare-title"
      className="relative w-full max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24"
    >
      {/* Warm top wash, the one soft surface on an otherwise plotted page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            'radial-gradient(58% 100% at 50% 0%, rgba(225, 92, 70, 0.13) 0%, rgba(225, 92, 70, 0) 72%)',
        }}
      />

      <div className="relative">
        <Reveal>
          <div className="grid gap-6 border-b border-[#282828]/25 pb-6 xl:grid-cols-12 xl:items-start">
            <div className="xl:col-span-8">
              <div className="flex items-center gap-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#b03d28]">
                <span className="h-px w-6 bg-current" aria-hidden="true" />
                Same question · two answers
              </div>
              <h2
                id="answer-compare-title"
                className="mt-4 font-mono text-3xl font-bold uppercase leading-[1.02] tracking-[-0.03em] text-[#282828] md:text-[38px] lg:text-[40px]"
              >
                A search returns an answer.
                <br />
                <span className="text-[#c2452d]">A traversal returns the proof.</span>
              </h2>
            </div>

            <div className="xl:col-span-4">
              <p className="max-w-md font-mono text-xs leading-relaxed text-[#5c5c56] md:text-sm">
                Both panes answer the same question about the same service. The left ranks text
                similarity. The right walks typed edges and returns the dates, rotations and
                decisions behind the answer.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="border border-[#282828]/20 px-2.5 py-2">
                  <div className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-[#282828]">
                    <span className="h-2 w-2 border border-[#c2452d] bg-[#c2452d]/15" aria-hidden="true" />
                    Flat search
                  </div>
                  <div className="mt-1 font-mono text-[9px] leading-snug text-[#5c5c56]">
                    Ranks text. No edges.
                  </div>
                </div>
                <div className="border border-[#282828]/20 px-2.5 py-2">
                  <div className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-[#282828]">
                    <span className="h-2 w-2 bg-[#282828]" aria-hidden="true" />
                    Helio graph
                  </div>
                  <div className="mt-1 font-mono text-[9px] leading-snug text-[#5c5c56]">
                    Walks edges. Shows dates.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Case tabs: all three answers ship in the HTML, one is visible. */}
        <Reveal delay={0.06}>
          <div
            role="tablist"
            aria-label="Comparison cases"
            className="mt-8 flex border border-[#282828]/25 bg-[#f4f4ec]"
          >
            <div className="flex flex-1">
              {CASES.map((item, index) => {
                const selected = item.id === activeCase.id;

                return (
                  <button
                    key={item.id}
                    ref={(node) => {
                      tabRefs.current[index] = node;
                    }}
                    type="button"
                    role="tab"
                    id={`case-tab-${item.id}`}
                    aria-selected={selected}
                    aria-controls={`case-panel-${item.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveId(item.id)}
                    onKeyDown={(event) => onTabKeyDown(event, index)}
                    className={`relative flex flex-1 items-center gap-2 border-r border-[#282828]/20 px-2.5 py-3 text-left transition-colors last:border-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#c2452d] md:gap-2.5 md:px-4 ${
                      selected
                        ? 'bg-[#282828] text-white'
                        : 'text-[#282828] hover:bg-[#282828]/5'
                    }`}
                  >
                    <span
                      className={`font-mono text-[8.5px] font-bold ${
                        selected ? 'text-[#f08a75]' : 'text-[#b03d28]'
                      }`}
                    >
                      {item.index}
                    </span>
                    <span className="font-mono text-[9px] font-bold uppercase leading-tight tracking-[0.1em] md:text-[10px]">
                      {item.tab}
                    </span>
                    {selected ? (
                      <span
                        className="absolute inset-x-0 bottom-0 h-[2px] bg-[#c2452d]"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="hidden shrink-0 items-center border-l border-[#282828]/20 px-4 font-mono text-[8px] uppercase tracking-[0.14em] text-[#5c5c56] lg:flex">
              Sample graph · 20 services
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative border border-t-0 border-[#282828]/25 bg-[#f4f4ec]">
            <CadCrosshair position="tl" />
            <CadCrosshair position="tr" />
            <CadCrosshair position="bl" />
            <CadCrosshair position="br" />

            {CASES.map((item) => (
              <div
                key={item.id}
                id={`case-panel-${item.id}`}
                role="tabpanel"
                aria-labelledby={`case-tab-${item.id}`}
                tabIndex={0}
                hidden={item.id !== activeCase.id}
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#c2452d]"
              >
                <CaseFile data={item} />
              </div>
            ))}
          </div>
        </Reveal>

        <div className="mt-6 flex flex-col gap-3 border-t border-[#282828]/20 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl font-mono text-[10.5px] leading-relaxed text-[#5c5c56]">
            Every answer above comes from the same traversal: ownership, rotation, blast radius and
            the decision that changed it.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/agent"
              className="group inline-flex items-center gap-2 bg-[#282828] px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#c2452d]"
            >
              Ask your own question
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
            <a
              href="/learn/who-owns-this-service"
              className="inline-flex items-center gap-2 border border-[#282828]/40 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#282828] transition-colors hover:bg-[#282828] hover:text-white"
            >
              How ownership is resolved
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
