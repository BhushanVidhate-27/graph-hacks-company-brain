import type { ReactNode } from "react";

interface PageHeroProps {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  sub?: ReactNode;
}

export function PageHero({ eyebrow, title, description, sub }: PageHeroProps) {
  return (
    <section className="mx-auto max-w-4xl px-6 py-32 text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display text-6xl">{title}</h1>
      <p>{description ?? sub}</p>
    </section>
  );
}
