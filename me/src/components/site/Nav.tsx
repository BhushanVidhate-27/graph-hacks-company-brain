import { Link } from "@tanstack/react-router";
import { Aperture, ArrowUpRight } from "lucide-react";

export function Nav() {
  return (
    <header className="memory-header">
      <div className="memory-nav">
        <Link to="/" className="helio-wordmark"><Aperture aria-hidden="true" />Helio</Link>
        <nav aria-label="Main navigation">
          <Link to="/how-it-works">How it works</Link>
          <Link to="/sources">Sources</Link>
          <Link to="/trust">Trust</Link>
        </nav>
        <Link to="/access" className="nav-access">Get early access <ArrowUpRight size={15} /></Link>
      </div>
    </header>
  );
}
