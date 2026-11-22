import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  FileText,
  Mail,
  MessageSquare,
  Table2,
  Database,
  Presentation,
  Users,
  Quote,
  Link2,
  ShieldQuestion,
  History,
} from "lucide-react";
import { GlassBrain } from "@/components/site/GlassBrain";
import { AskDemo } from "@/components/site/AskDemo";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/ui/button";
import orb from "@/assets/helio-orb.jpg";

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

const heroChips = [
  { label: "Q3 board review", cls: "left-[8%] top-[28%]", d: "0s" },
  { label: "Client · Northwind", cls: "right-[9%] top-[24%]", d: "-3s" },
  { label: "Pricing decision", cls: "left-[12%] bottom-[22%]", d: "-5s" },
  { label: "Onboarding wiki", cls: "right-[12%] bottom-[26%]", d: "-1.5s" },
];

const fragments = [
  { icon: FileText, label: "final_v7_REAL.pdf", cls: "left-[4%] top-[8%]", r: "-6deg" },
  { icon: Mail, label: "Re: Re: Fwd: decision?", cls: "left-[34%] top-[0%]", r: "3deg" },
  { icon: Table2, label: "Sheet3 (copy)", cls: "right-[6%] top-[12%]", r: "5deg" },
  { icon: MessageSquare, label: "#general · 2,481 unread", cls: "left-[12%] top-[52%]", r: "4deg" },
  { icon: Database, label: "erp_export_old.csv", cls: "right-[14%] top-[56%]", r: "-4deg" },
  { icon: Presentation, label: "Strategy deck (draft)", cls: "left-[40%] top-[78%]", r: "-2deg" },
  { icon: Users, label: "Ask Priya — she left", cls: "right-[2%] top-[84%]", r: "6deg" },
];

const pillars = [
  {
    icon: Link2,
    title: "Connected.",
    body: "Not documents. Relationships.",
    span: "md:col-span-2",
  },
  { icon: Quote, title: "Cited.", body: "Every answer shows its source.", span: "" },
  {
    icon: ShieldQuestion,
    title: "Honest.",
    body: "Conflicts and gaps, flagged — never guessed.",
    span: "",
  },
  {
    icon: History,
    title: "Lasting.",
    body: "People move on. What they knew stays.",
    span: "md:col-span-2",
  },
];

const industries = [
  "Startups",
  "Enterprises",
  "Agencies",
  "Universities",
  "Healthcare",
  "Manufacturing",
  "Finance",
  "Consulting",
  "Public sector",
  "Retail",
  "Legal",
  "Energy",
];

function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4">
        <GlassBrain className="absolute inset-0 h-full w-full" />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent"
          aria-hidden="true"
        />

        {heroChips.map((c) => (
          <div
            key={c.label}
            className={`glass animate-drift absolute hidden rounded-full px-4 py-2 text-[12px] text-muted-foreground lg:block ${c.cls}`}
            style={{ animationDelay: c.d }}
          >
            <span className="mr-2 inline-block size-1.5 rounded-full bg-solar align-middle" />
            {c.label}
          </div>
        ))}

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <p className="eyebrow animate-rise">Helio · The Company Brain</p>
          <h1 className="display mt-5 text-[56px] animate-rise [animation-delay:120ms] sm:text-8xl md:text-[120px]">
            <span className="text-silver-gradient">Your company,</span>
            <br />
            <span className="text-solar-gradient">remembered.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-md text-lg text-muted-foreground animate-rise [animation-delay:260ms] sm:text-xl">
            One living brain for everything your organization knows.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 animate-rise [animation-delay:380ms]">
            <Button asChild size="lg">
              <Link to="/access">Get early access</Link>
            </Button>
            <Button asChild size="lg" variant="glass">
              <Link to="/how-it-works">
                See how it thinks <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="relative px-4 py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="text-center">
            <h2 className="display text-5xl sm:text-7xl md:text-8xl">
              <span className="text-silver-gradient">Knowledge is everywhere.</span>
              <br />
              <span className="text-muted-foreground">And nowhere.</span>
            </h2>
          </Reveal>

          <Reveal delay={150} className="relative mx-auto mt-20 h-[420px] max-w-5xl">
            {fragments.map((f, i) => (
              <div
                key={f.label}
                className={`glass animate-drift absolute flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[13px] text-muted-foreground ${f.cls}`}
                style={
                  {
                    "--r": f.r,
                    "--dx": `${(i % 2 ? -1 : 1) * 12}px`,
                    "--dy": `${(i % 3) * 6 - 10}px`,
                    animationDelay: `${-i * 1.3}s`,
                  } as CSSProperties
                }
              >
                <f.icon className="size-4 text-foreground/70" />
                {f.label}
              </div>
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="glass-strong rounded-full px-5 py-2.5 text-[14px] text-foreground">
                Every goodbye takes a piece of it.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ASK */}
      <section className="relative px-4 py-32">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">Ask in plain words</p>
          <h2 className="display mt-4 text-5xl text-silver-gradient sm:text-7xl">Just ask.</h2>
          <p className="mx-auto mt-5 max-w-md text-lg text-muted-foreground">
            Answers drawn from your company's own knowledge. With receipts.
          </p>
        </Reveal>
        <Reveal delay={150} className="mt-16">
          <AskDemo />
        </Reveal>
      </section>

      {/* PILLARS */}
      <section className="px-4 py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal className="text-center">
            <h2 className="display text-5xl sm:text-7xl">
              <span className="text-silver-gradient">Not a chatbot.</span>
              <br />
              <span className="text-solar-gradient">A memory.</span>
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {pillars.map((p, i) => (
              <Reveal
                key={p.title}
                delay={i * 90}
                className={`glass group relative overflow-hidden rounded-[28px] p-8 sm:p-10 ${p.span}`}
              >
                <div
                  className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-solar/10 blur-3xl transition-opacity duration-700 group-hover:opacity-100 md:opacity-0"
                  aria-hidden="true"
                />
                <p.icon className="size-7 text-solar" strokeWidth={1.5} />
                <h3 className="display mt-14 text-4xl text-foreground sm:text-5xl">{p.title}</h3>
                <p className="mt-3 text-[17px] text-muted-foreground">{p.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ORB / FOR EVERYONE */}
      <section className="relative overflow-hidden px-4 py-32">
        <Reveal className="mx-auto max-w-6xl">
          <div className="glass relative overflow-hidden rounded-[40px] px-6 pb-14 pt-16 text-center sm:px-12">
            <img
              src={orb}
              alt="A glass sphere filled with glowing connected points of light"
              width={1600}
              height={1200}
              loading="lazy"
              className="animate-breathe mask-radial mx-auto -mb-6 w-full max-w-lg mix-blend-screen"
            />
            <h2 className="display relative text-4xl sm:text-6xl">
              <span className="text-silver-gradient">Every organization has a mind.</span>
              <br />
              <span className="text-solar-gradient">Give it a memory.</span>
            </h2>
            <div className="mask-fade-x relative mt-12 overflow-hidden">
              <div className="animate-marquee flex w-max gap-3">
                {[...industries, ...industries].map((name, i) => (
                  <span
                    key={i}
                    className="glass rounded-full px-5 py-2 text-[13px] text-muted-foreground"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="px-4 py-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="display text-5xl text-silver-gradient sm:text-7xl">
            Stop searching.
            <br />
            Start knowing.
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="solar">
              <Link to="/access">Get early access</Link>
            </Button>
            <Button asChild size="lg" variant="glass">
              <Link to="/sources">What it connects to</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
