import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { GlassBrain } from "@/components/site/GlassBrain";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Helio — Your company, remembered." },
      {
        name: "description",
        content:
          "Helio turns scattered documents, data and conversations into one living company brain you can simply ask.",
      },
      { property: "og:title", content: "Helio — Your company, remembered." },
      {
        property: "og:description",
        content: "One living brain for everything your organization knows.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const examples = [
  {
    topic: "Decisions",
    question: "Why do we use two payment providers?",
    answer: "Adyen handles payments first. Stripe is the fallback.",
    records: [
      { date: "18 Mar 2026", name: "Decision D-14", detail: "Elena Vasquez selected Stripe as the sole provider.", status: "Superseded" },
      { date: "06 May 2026", name: "Decision D-19", detail: "Elena approved Adyen as primary, with Stripe in reserve.", status: "Current" },
    ],
  },
  {
    topic: "Ownership",
    question: "Who should I ask about payments?",
    answer: "Ask Ravi Menon on the Platform team. He owns payments-gateway.",
    records: [
      { date: "15 Apr 2026", name: "Priya Sharma", detail: "Decision D-21 transferred ownership from Priya to Ravi.", status: "Former owner" },
      { date: "28 Sep 2026", name: "Ravi Menon", detail: "Ravi made the latest recorded contribution to the payments migration.", status: "Current" },
    ],
  },
] as const;

const sources = [
  { label: "People", name: "Ravi Menon", detail: "Ravi took over payments-gateway from Priya Sharma on 15 April 2026. His six contributions to the migration include its most recent update." },
  { label: "Services", name: "payments-gateway", detail: "Platform owns this tier-0 service. Its recorded availability target is 99.95%." },
  { label: "Decisions", name: "D-19 · Payments migration", detail: "On 6 May 2026, Elena Vasquez replaced the Stripe-only decision with a dual-provider setup." },
];

function DecisionTimeline() {
  const [example, setExample] = useState<(typeof examples)[number]>(examples[0]);
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!section.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        entry.target.setAttribute("data-entered", "");
        observer.disconnect();
      }
    });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="decision-section" id="example" aria-labelledby="example-title" ref={section}>
      <div className="decision-menu">
        <h2 id="example-title">Follow the record</h2>
        <div className="topic-switch" role="group" aria-label="Example query">
          {examples.map((item) => (
            <button key={item.topic} type="button" aria-pressed={example === item}
              onClick={() => setExample(item)}>{item.topic}</button>
          ))}
        </div>
      </div>
      <article className="decision-body" aria-live="polite" aria-atomic="true">
        <h3>{example.question}</h3>
        <p className="decision-answer">{example.answer}</p>
        <ol key={example.topic} className="record-path">
          {example.records.map((record) => (
            <li key={record.name}>
              <small>{record.date} · <span>{record.status}</span></small>
              <strong>{record.name}</strong>
              <p>{record.detail}</p>
            </li>
          ))}
        </ol>
        <Link className="editorial-link" to="/how-it-works">How Helio traces an answer <ArrowRight /></Link>
      </article>
    </section>
  );
}

function SourceIndex() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="source-index" aria-labelledby="source-title">
      <h2 id="source-title">Explore the sources.</h2>
      <div className="source-rows">
        {sources.map(({ label, name, detail }) => {
          const expanded = open === label;
          return (
            <div className="source-row" key={label}>
              <h3><button type="button" aria-expanded={expanded} aria-controls={'record-' + label}
                onClick={() => setOpen(expanded ? null : label)}>{label}<Plus aria-hidden="true" /></button></h3>
              <div id={'record-' + label} className="source-detail" aria-hidden={!expanded}>
                <div><strong>{name}</strong><p>{detail}</p></div>
              </div>
            </div>
          );
        })}
        <Link className="editorial-link" to="/sources">All data sources <ArrowRight /></Link>
      </div>
    </section>
  );
}

function Home() {
  return (
    <div className="helio-home">
      <section className="portrait" aria-labelledby="portrait-title">
        <div className="portrait-art" role="img" aria-label="Side profile of a brain formed by white dots"><GlassBrain /></div>
        <div className="portrait-copy">
          <h1 id="portrait-title">Your company,<br /><em>remembered.</em></h1>
          <Link className="editorial-link" to="/access">Get early access <ArrowUpRight /></Link>
        </div>
      </section>
      <DecisionTimeline />
      <SourceIndex />
      <section className="access-close">
        <h2>Put your records<br /><em>to work.</em></h2>
        <Link className="editorial-link" to="/access">Get early access <ArrowUpRight /></Link>
      </section>
    </div>
  );
}
