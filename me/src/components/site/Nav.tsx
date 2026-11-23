import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";

const pages = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/sources", label: "Sources" },
  { to: "/trust", label: "Trust" },
] as const;

function PageLinks() {
  return pages.map(({ to, label }) => (
    <Link key={to} to={to}>
      {label}
    </Link>
  ));
}

export function Nav() {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const location = useRouterState({ select: (s) => s.location.href });
  useEffect(() => {
    if (disclosure.current) disclosure.current.open = false;
  }, [location]);
  return (
    <header className="masthead">
      <Link className="wordmark" to="/" aria-label="NOMORE home">
        NOMORE
      </Link>
      <nav className="desktop-links" aria-label="Main navigation">
        <PageLinks />
      </nav>
      <Link className="access-link" to="/access">
        Get early access <ArrowUpRight aria-hidden="true" />
      </Link>
      <details
        className="mobile-menu"
        ref={disclosure}
        onKeyDown={(event) => {
          if (event.key === "Escape" && disclosure.current?.open) {
            disclosure.current.open = false;
            disclosure.current.querySelector("summary")?.focus();
          }
        }}
      >
        <summary>
          Menu <span className="menu-lines" aria-hidden="true" />
        </summary>
        <nav
          aria-label="Mobile navigation"
          onClick={() => {
            if (disclosure.current) disclosure.current.open = false;
          }}
        >
          <PageLinks />
          <Link to="/access">
            Get early access <ArrowUpRight aria-hidden="true" />
          </Link>
        </nav>
      </details>
    </header>
  );
}
