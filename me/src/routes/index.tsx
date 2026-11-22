import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
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
    answer: "Adyen handles payments first. Stripe takes over if Adyen is unavailable.",
    records: [
      ["06 May 2026", "Decision D-19", "Elena Vasquez approved the dual-provider setup."],
      ["18 Mar 2026", "Decision D-14", "The earlier Stripe-only decision was superseded."],
    ],
  },
  {
    topic: "Ownership",
    question: "Who should I ask about payments?",
    answer: "Ask Ravi Menon on the Platform team. He has the most recent hands-on experience.",
    records: [
      ["28 Sep 2026", "Ravi Menon", "Most recent contribution to the payments project."],
      ["15 Apr 2026", "Priya Sharma", "Fourteen commits, with her last contribution in April."],
    ],
  },
];

function Home() {
  const [selected, setSelected] = useState(0);
  const example = examples[selected];
  return (
    <div className="helio-home">
      <section className="memory-hero" aria-labelledby="memory-title">
        <div className="memory-layout">
          <div className="memory-copy">
            <h1 id="memory-title">Your company,<br /><em>remembered.</em></h1>
            <p className="memory-intro">Find who owns a service, what depends on it, and where the decision was made.</p>
            <Link className="memory-link" to="/access">Get early access <ArrowUpRight /></Link>
          </div>
          <div className="memory-stage" role="img" aria-label="A slowly turning brain drawn in fine white dots">
            <div className="brain-surface"><GlassBrain /></div>
          </div>
        </div>
        <a className="memory-scroll" href="#example">Inside Helio <ArrowDown /></a>
      </section>
      <section className="memory-example" id="example" aria-labelledby="example-title">
        <div className="example-inner">
          <div className="example-menu">
            <h2 id="example-title">Example queries</h2>
            <div className="query-options" role="group" aria-label="Choose an example">
              {examples.map((item, index) => (
                <button key={item.topic} type="button" aria-pressed={selected === index}
                  onClick={() => setSelected(index)}>{item.topic}<ArrowRight /></button>
              ))}
            </div>
          </div>
          <article aria-live="polite" aria-atomic="true" className="query-record">
            <h3>{example.question}</h3><p>{example.answer}</p>
            <dl>{example.records.map(([date, source, detail]) => (
              <div key={source}><dt>{source}<small>{date}</small></dt><dd>{detail}</dd></div>
            ))}</dl>
            <Link to="/how-it-works">How Helio traces an answer <ArrowRight /></Link>
          </article>
        </div>
      </section>
      <section className="memory-end">
        <h2>Put your records<br />to work.</h2>
        <div><Link className="memory-link" to="/access">Get early access <ArrowUpRight /></Link>
        <Link to="/sources">Explore data sources <ArrowRight /></Link></div>
      </section>
    </div>
  );
}
