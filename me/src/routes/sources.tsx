import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Database, MessagesSquare, KanbanSquare, Building2, Plug } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Sources — Everything Helio connects to" },
      {
        name: "description",
        content:
          "Documents, databases, email, chat, project tools, CRM, ERP, HR, finance and internal APIs — Helio learns from wherever knowledge lives.",
      },
      { property: "og:title", content: "Helio Sources — If it holds knowledge, Helio learns it" },
      {
        property: "og:description",
        content: "Files, data, conversations and business systems — all in one company brain.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sources,
});

const groups = [
  { icon: FileText, title: "Files", items: ["Docs", "PDFs", "Spreadsheets", "Slides"] },
  { icon: Database, title: "Data", items: ["Databases", "Warehouses", "Reports"] },
  { icon: MessagesSquare, title: "Conversations", items: ["Email", "Chat", "Meetings"] },
  { icon: KanbanSquare, title: "Work", items: ["Projects", "Tickets", "Wikis"] },
  { icon: Building2, title: "Systems", items: ["CRM", "ERP", "HR", "Finance", "Marketing"] },
  { icon: Plug, title: "Everything else", items: ["Internal apps", "APIs", "Custom tools"] },
];

function Sources() {
  return (
    <>
      <PageHero
        eyebrow="Sources"
        title={
          <>
            If it holds knowledge,
            <br />
            <span className="text-solar-gradient">Helio learns it.</span>
          </>
        }
        sub="Any format. Any tool. Any team."
      />

      <section className="px-4 py-12">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, i) => (
            <Reveal
              key={g.title}
              delay={(i % 3) * 90}
              className="glass group rounded-[28px] p-8 transition-colors duration-500 hover:bg-glass-strong"
            >
              <span className="glass-strong flex size-12 items-center justify-center rounded-2xl">
                <g.icon className="size-5 text-solar" strokeWidth={1.6} />
              </span>
              <h2 className="display mt-10 text-3xl text-foreground">{g.title}</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {g.items.map((it) => (
                  <span
                    key={it}
                    className="rounded-full border border-glass-border bg-glass px-3 py-1 text-[12px] text-muted-foreground"
                  >
                    {it}
                  </span>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-4 py-24">
        <Reveal className="glass mx-auto max-w-4xl rounded-[36px] px-8 py-16 text-center">
          <h2 className="display text-4xl text-silver-gradient sm:text-6xl">
            Your tools stay.
            <br />
            Your knowledge connects.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg text-muted-foreground">
            No migration. Helio reads where your work already happens.
          </p>
          <Button asChild size="lg" className="mt-10">
            <Link to="/access">Get early access</Link>
          </Button>
        </Reveal>
      </section>
    </>
  );
}
