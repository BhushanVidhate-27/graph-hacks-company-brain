import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUpRight, Plus } from "lucide-react";
import { Citation } from "@/components/Citation";
import { PaymentHistory } from "@/components/PaymentHistory";
import { examples } from "@/lib/evidence";

export const Route = createFileRoute("/")({
  validateSearch: (search): { topic?: "ownership" } =>
    search["topic"] === "ownership" ? { topic: "ownership" } : {},
  head: () => ({
    meta: [
      { title: "NOMORE — Your company, remembered." },
      {
        name: "description",
        content:
          "NOMORE turns scattered documents, data and conversations into one living company brain you can simply ask.",
      },
      { property: "og:title", content: "NOMORE — Your company, remembered." },
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

const indexEntries = [
  [
    "People",
    "ownership",
    "Ravi Menon",
    "Ravi took over payments-gateway on 15 April 2026. He made the latest recorded contribution to the migration.",
  ],
  [
    "Services",
    "topology",
    "payments-gateway",
    "Platform owns this tier-0 service. Its recorded availability target is 99.95%.",
  ],
  [
    "Decisions",
    "evidence-trail",
    "Payments migration",
    "The May decision replaced the March plan to use Stripe alone.",
  ],
];

function Home() {
  const { topic } = Route.useSearch();
  const navigate = Route.useNavigate();
  const example = examples[topic ?? "decisions"];
  return (
    <div className="nomore-home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-heading">
          <h1 id="hero-title">
            <span>
              <b>Your company,</b>
            </span>{" "}
            <span>
              <b>remembered.</b>
            </span>
          </h1>
        </div>
        <div className="hero-foot">
          <p>Ask a question. Find the decision, the people, and the records behind it.</p>
          <a className="action action-light" href="#example">
            Explore an answer <ArrowDown aria-hidden="true" />
          </a>
        </div>
      </section>

      <section
        className="answer-spread section-layout"
        id="example"
        aria-labelledby="example-question"
      >
        <div className="spread-aside">
          <p className="caption">Example answer</p>
          <div className="topics" role="group" aria-label="Example topics">
            {(["decisions", "ownership"] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={(topic ?? "decisions") === key}
                onClick={() =>
                  void navigate({
                    search: key === "ownership" ? { topic: key } : {},
                    hash: "example",
                    replace: true,
                    resetScroll: false,
                    hashScrollIntoView: false,
                  })
                }
              >
                {key === "decisions" ? "Decisions" : "Ownership"}
              </button>
            ))}
          </div>
        </div>
        <article className="answer-text" aria-live="polite">
          <h2 className="story-heading" id="example-question">
            {example.question}
          </h2>
          <p>{example.answer}</p>
          <Citation id={example.record} />
        </article>
      </section>

      <PaymentHistory />

      <section className="index-spread section-layout" aria-labelledby="index-title">
        <div className="spread-aside">
          <h2 className="aside-heading" id="index-title" tabIndex={-1}>
            Inside the archive
          </h2>
          <Link className="text-link" to="/sources">
            All sources <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
        <div className="index-rows">
          {indexEntries.map(([category, art, title, summary]) => (
            <details key={category} name="archive-preview">
              <summary>
                {category}
                <Plus aria-hidden="true" size={20} />
              </summary>
              <div>
                <h3>{title}</h3>
                <p>{summary}</p>
                <img
                  className={"index-diagram diagram-" + art}
                  src={"/illustrations/" + art + ".svg"}
                  loading="lazy"
                  alt=""
                />
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
