import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { records } from "@/lib/evidence";
import { Citation } from "@/components/Citation";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How NOMORE works — Connect, understand, remember, answer" },
      {
        name: "description",
        content:
          "NOMORE connects your tools, understands how information relates, remembers how it changes, and answers with sources.",
      },
      { property: "og:title", content: "How NOMORE works" },
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

const steps = [
  {
    title: "Connect",
    art: "fragments",
    body: "Start with the provider evaluation and the payments team’s discussion.",
    detail: records["D-14"].evidence[0],
    record: "D-14",
  },
  {
    title: "Understand",
    art: "constellation",
    body: "Link those records to Elena Vasquez, the decision owner, and to the payments migration.",
    detail: records["D-14"].owner,
    record: "D-14",
  },
  {
    title: "Remember",
    art: "history",
    body: "Keep the March decision when the May evaluation replaces it. Both versions remain available.",
    detail: "18 March → 6 May 2026",
    record: "D-19",
  },
  {
    title: "Answer",
    art: "source-thread",
    body: records["D-19"].summary,
    detail: "Current payment policy",
    record: "D-19",
  },
] as const;

function HowItWorks() {
  const timeline = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const rows = Array.from(timeline.current?.children ?? []);
    const observer = new IntersectionObserver(
      (entries) => {
        const entering = entries.find((entry) => entry.isIntersecting);
        if (entering) setActive(rows.indexOf(entering.target));
      },
      { rootMargin: "-20% 0px -50% 0px" },
    );
    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, []);
  return (
    <div className="method page">
      <div className="method-layout">
        <header className="method-heading">
          <p className="caption">How it works</p>
          <h1 className="page-title">
            Anatomy of
            <br />
            an answer.
          </h1>
          <div className="method-figure" aria-hidden="true">
            <img key={active} src={"/illustrations/" + steps[active]!.art + ".svg"} alt="" />
          </div>
          <p className="method-question">Why do we use two payment providers?</p>
        </header>
        <ol className="timeline" ref={timeline}>
          {steps.map((step, i) => (
            <li key={step.title} data-active={active === i}>
              <p className="caption">{step.detail}</p>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
              <img
                className="method-inline"
                src={"/illustrations/" + step.art + ".svg"}
                alt=""
                loading="lazy"
              />
              <Citation id={step.record} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
