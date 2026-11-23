import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust — Answers you can trace" },
      {
        name: "description",
        content:
          "NOMORE cites every source, flags conflicting or outdated information, and respects who is allowed to see what.",
      },
      { property: "og:title", content: "NOMORE Trust — Answers you can trace" },
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
  ["Citations", "Open a decision to inspect the records that support the answer."],
  ["Conflicts", "When sources disagree, both accounts stay visible."],
  ["Currency", "A replaced decision keeps its date and its link to the newer record."],
  ["Permissions", "People only see the information they already have permission to access."],
];

function Trust() {
  return (
    <div className="trust page">
      <div className="page-intro">
        <div>
          <p className="caption">Trust</p>
          <h1 className="page-title">
            When records
            <br />
            disagree.
          </h1>
        </div>
        <p>
          A contract and a later email give different dates for Northwind’s single sign-on rollout.
        </p>
      </div>
      <section className="comparison glass-strong" aria-label="Northwind source comparison">
        <div className="date-pair">
          <div>
            <p className="caption">Contract</p>
            <h2>June</h2>
          </div>
          <div>
            <p className="caption">Later email</p>
            <h2>August</h2>
          </div>
        </div>
        <div className="conflict-note">
          <strong>Unresolved</strong>
          <p>Confirm the promised date with the account owner.</p>
        </div>
      </section>
      <section className="section-layout principles">
        <div>
          <h2 className="aside-heading">Reading an answer</h2>
          <img
            className="permission-diagram"
            src="/illustrations/permissions.svg"
            alt="A boundary separates accessible records from restricted ones."
            loading="lazy"
          />
        </div>
        <dl className="category-list">
          {principles.map(([name, body]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{body}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
