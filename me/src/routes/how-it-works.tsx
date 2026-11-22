import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Mail, MessageSquare, Database, Table2, Quote } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Helio works — Connect, understand, remember, answer" },
      {
        name: "description",
        content:
          "Helio connects your tools, understands how information relates, remembers how it changes, and answers with sources.",
      },
      { property: "og:title", content: "How Helio works" },
      {
        property: "og:description",
        content: "Connect. Understand. Remember. Answer. Four steps to a company brain.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorks,
});

function ConnectVisual() {
  const icons = [FileText, Mail, MessageSquare, Database, Table2];
  return (
    <div className="relative flex h-64 items-center justify-center">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 256" aria-hidden="true">
        {icons.map((_, i) => {
          const y = 28 + i * 50;
          return (
            <path
              key={i}
              d={`M 60 ${y} C 180 ${y}, 220 128, 330 128`}
              stroke="var(--solar)"
              strokeOpacity="0.35"
              strokeWidth="1"
              fill="none"
              strokeDasharray="3 5"
            />
          );
        })}
      </svg>
      <div className="absolute left-4 flex flex-col gap-2.5">
        {icons.map((I, i) => (
          <span key={i} className="glass flex size-10 items-center justify-center rounded-xl">
            <I className="size-4 text-muted-foreground" />
          </span>
        ))}
      </div>
      <span className="glass-strong glow-solar absolute right-6 flex size-20 items-center justify-center rounded-full">
        <span className="bg-solar-gradient size-6 rounded-full" />
      </span>
    </div>
  );
}

function UnderstandVisual() {
  const nodes = [
    { l: "Northwind", x: 50, y: 50, hot: true },
    { l: "Contract", x: 18, y: 22 },
    { l: "Priya", x: 82, y: 20 },
    { l: "Atlas project", x: 20, y: 80 },
    { l: "SSO request", x: 80, y: 80 },
  ];
  return (
    <div className="relative h-64">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {nodes.slice(1).map((n) => (
          <line
            key={n.l}
            x1="50"
            y1="50"
            x2={n.x}
            y2={n.y}
            stroke="var(--solar)"
            strokeOpacity="0.4"
            strokeWidth="0.3"
          />
        ))}
        <line
          x1="82"
          y1="20"
          x2="80"
          y2="80"
          stroke="var(--foreground)"
          strokeOpacity="0.15"
          strokeWidth="0.3"
        />
      </svg>
      {nodes.map((n) => (
        <span
          key={n.l}
          className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] ${n.hot ? "glass-strong glow-solar text-foreground" : "glass text-muted-foreground"}`}
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
        >
          {n.l}
        </span>
      ))}
    </div>
  );
}

function RememberVisual() {
  const events = ["Jan", "Mar", "Jun", "Sep", "Now"];
  return (
    <div className="flex h-64 flex-col justify-center px-2">
      <div className="relative">
        <div className="absolute inset-x-0 top-1/2 h-px bg-glass-border" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-solar-gradient opacity-60" />
        <div className="relative flex justify-between">
          {events.map((e, i) => (
            <div key={e} className="flex flex-col items-center gap-3">
              <span
                className={`text-[11px] ${i === events.length - 1 ? "text-solar" : "text-muted-foreground"}`}
              >
                {e}
              </span>
              <span
                className={`size-3 rounded-full ${i === events.length - 1 ? "bg-solar glow-solar" : "bg-foreground/40"}`}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="glass mx-auto mt-8 rounded-2xl px-4 py-3 text-[13px] text-muted-foreground">
        Strategy v3 → v4 · <span className="text-foreground">3 changes</span>
      </div>
    </div>
  );
}

function AnswerVisual() {
  return (
    <div className="flex h-64 items-center">
      <div className="glass-strong w-full rounded-2xl p-5">
        <p className="text-[15px] text-foreground">
          Atlas is two sprints behind, blocked by the data migration.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Tracker", "Stand-up notes", "Eng sync"].map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass px-3 py-1 text-[11px] text-muted-foreground"
            >
              <Quote className="size-3 text-solar" />
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const steps = [
  {
    n: "01",
    title: "Connect.",
    body: "Plug into the tools you already use.",
    Visual: ConnectVisual,
  },
  {
    n: "02",
    title: "Understand.",
    body: "People, projects, clients, decisions — linked.",
    Visual: UnderstandVisual,
  },
  {
    n: "03",
    title: "Remember.",
    body: "Every change, kept in context over time.",
    Visual: RememberVisual,
  },
  {
    n: "04",
    title: "Answer.",
    body: "Ask anything. Get it back with sources.",
    Visual: AnswerVisual,
  },
];

function HowItWorks() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title={
          <>
            From scattered
            <br />
            to <span className="text-solar-gradient">connected.</span>
          </>
        }
        sub="Four quiet steps. One brain that keeps learning."
      />

      <section className="px-4 py-12">
        <div className="mx-auto grid max-w-6xl gap-5">
          {steps.map((s, i) => (
            <Reveal
              key={s.n}
              className="glass grid items-center gap-8 overflow-hidden rounded-[32px] p-8 sm:p-12 md:grid-cols-2"
            >
              <div className={i % 2 ? "md:order-2" : ""}>
                <span className="text-[13px] font-medium text-solar">{s.n}</span>
                <h2 className="display mt-3 text-5xl text-silver-gradient sm:text-6xl">
                  {s.title}
                </h2>
                <p className="mt-4 max-w-sm text-lg text-muted-foreground">{s.body}</p>
              </div>
              <div className="rounded-[24px] bg-glass p-4">
                <s.Visual />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 py-24 text-center">
        <Reveal>
          <h2 className="display text-4xl text-silver-gradient sm:text-6xl">
            The more it knows, the more it helps.
          </h2>
          <Button asChild size="lg" className="mt-10">
            <Link to="/access">Get early access</Link>
          </Button>
        </Reveal>
      </section>
    </>
  );
}
