import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Citation } from "@/components/Citation";
import { records, recordIds, recordSearch } from "@/lib/evidence";

export const Route = createFileRoute("/sources")({
  validateSearch: recordSearch,
  head: () => ({
    meta: [
      { title: "Sources — Everything NOMORE connects to" },
      {
        name: "description",
        content:
          "Documents, databases, email, chat, project tools, CRM, ERP, HR, finance and internal APIs — NOMORE learns from wherever knowledge lives.",
      },
      { property: "og:title", content: "NOMORE Sources — If it holds knowledge, NOMORE learns it" },
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

const categories = [
  ["Files", "Docs, PDFs, spreadsheets, slides"],
  ["Data", "Databases, warehouses, reports"],
  ["Conversations", "Email, chat, meetings"],
  ["Work", "Projects, tickets, wikis"],
  ["Systems", "CRM, ERP, HR, finance, marketing"],
  ["Other tools", "Internal apps, APIs, custom tools"],
];

function Sources() {
  const { record: selected } = Route.useSearch();
  const navigate = Route.useNavigate();
  useEffect(() => {
    if (!selected) return;
    const row = document.getElementById("row-" + selected);
    if (!row) return;
    const frame = requestAnimationFrame(() => {
      row.focus({ preventScroll: true });
      const bounds = row.getBoundingClientRect();
      if (bounds.top < 12 || bounds.top > window.innerHeight * 0.55)
        row.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  return (
    <div className="archive page">
      <div className="page-intro">
        <h1 className="page-title">Source archive.</h1>
        <p>The decisions behind an answer, with the people and records that support them.</p>
      </div>
      <section className="archive-sheet glass" aria-label="Decision records">
        <div className="archive-head caption">
          <span>Record</span>
          <span>Decision</span>
          <span>Date</span>
        </div>
        {recordIds.map((id) => {
          const entry = records[id];
          const expanded = selected === id;
          return (
            <article className="archive-row" key={id} data-expanded={expanded}>
              <h2>
                <button
                  type="button"
                  className="archive-toggle"
                  id={"row-" + id}
                  aria-expanded={expanded}
                  aria-controls={"detail-" + id}
                  onClick={() =>
                    void navigate({ search: expanded ? {} : { record: id }, resetScroll: false })
                  }
                >
                  <span className="record-id">{id}</span>
                  <span className="record-title">{entry.title}</span>
                  <time dateTime={entry.date}>{entry.dateLabel}</time>
                  <span aria-hidden="true" className="expand-sign">
                    {expanded ? "−" : "+"}
                  </span>
                </button>
              </h2>
              <div
                hidden={!expanded}
                id={"detail-" + id}
                className="record-inside"
                aria-labelledby={"row-" + id}
              >
                <p className="record-summary">{entry.summary}</p>
                <dl className="metadata">
                  <div>
                    <dt>Decision owner</dt>
                    <dd>{entry.owner}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{entry.status}</dd>
                  </div>
                </dl>
                <h3 className="caption">Evidence references</h3>
                <ul className="references">
                  {entry.evidence.map((ref) => (
                    <li key={ref}>{ref}</li>
                  ))}
                </ul>
                {entry.replaces && <Citation id={entry.replaces} label="Replaces" />}
                {id === "D-14" && <Citation id="D-19" label="Replaced by" />}
              </div>
            </article>
          );
        })}
      </section>
      <section className="category-spread section-layout">
        <div className="source-types-aside">
          <h2 className="aside-heading">Source types</h2>
          <Link
            className="archive-illustration"
            to="/sources"
            search={{ record: "D-19" }}
            aria-label="Open decision D-19"
          >
            <img src="/illustrations/archive-grid.svg" alt="" loading="lazy" />
          </Link>
        </div>
        <dl className="category-list">
          {categories.map(([name, items]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{items}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
