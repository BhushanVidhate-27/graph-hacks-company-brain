import { createFileRoute, Link } from "@tanstack/react-router";
import { Quote, AlertTriangle, Lock, Clock3 } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust — Answers you can trace" },
      {
        name: "description",
        content:
          "Helio cites every source, flags conflicting or outdated information, and respects who is allowed to see what.",
      },
      { property: "og:title", content: "Helio Trust — Answers you can trace" },
      {
        property: "og:description",
        content: "Cited sources, surfaced conflicts, preserved permissions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Trust,
});

const principles = [
  { icon: Quote, title: "Every answer, cited.", body: "Tap any claim to see where it came from." },
  {
    icon: AlertTriangle,
    title: "Conflicts, surfaced.",
    body: "When sources disagree, you'll know.",
  },
  { icon: Clock3, title: "Stale, flagged.", body: "Old information is marked as old." },
  { icon: Lock, title: "Permissions, kept.", body: "People only see what they already could." },
];

function Trust() {
  return (
    <>
      <PageHero
        eyebrow="Trust"
        title={
          <>
            Grounded.
            <br />
            <span className="text-solar-gradient">Never guessed.</span>
          </>
        }
        sub="A brain is only useful if you can believe it."
      />

      <section className="px-4 py-12">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
          {principles.map((p, i) => (
            <Reveal
              key={p.title}
              delay={(i % 2) * 100}
              className="glass rounded-[28px] p-8 sm:p-10"
            >
              <p.icon className="size-6 text-solar" strokeWidth={1.6} />
              <h2 className="display mt-12 text-3xl text-foreground sm:text-4xl">{p.title}</h2>
              <p className="mt-3 text-[17px] text-muted-foreground">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 py-24">
        <Reveal className="mx-auto max-w-2xl">
          <div className="glass-strong rounded-[28px] p-6 sm:p-8">
            <p className="text-[13px] text-muted-foreground">When was SSO promised to Northwind?</p>
            <p className="mt-4 text-[17px] text-foreground">
              Sources disagree. The contract says <span className="text-solar">June</span>; a later
              email says <span className="text-solar">August</span>.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-caution/30 bg-caution/10 px-3 py-2 text-[12px] text-caution">
              <AlertTriangle className="size-3.5" /> Conflict found · confirm with account owner
            </div>
          </div>
          <p className="mt-6 text-center text-[13px] text-muted-foreground">
            An honest answer beats a confident one.
          </p>
        </Reveal>
        <div className="mt-16 text-center">
          <Button asChild size="lg">
            <Link to="/access">Get early access</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
