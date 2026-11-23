import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";

export function Footer() {
  const film = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = film.current;
    if (!video) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    function sync() {
      if (!video) return;
      if (preference.matches) {
        video.pause();
        if (video.hasAttribute("src")) {
          video.removeAttribute("src");
          video.load();
        }
      } else if (visible && !document.hidden) {
        if (!video.hasAttribute("src")) video.src = "/footer-ring.mp4";
        void video.play().catch(() => {});
      } else video.pause();
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) video.dataset["seen"] = "true";
      sync();
    });
    observer.observe(video);
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      video.pause();
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return (
    <footer className="site-footer">
      <div className="footer-spread">
        <div className="footer-copy">
          <h2>
            Put your records
            <br />
            to work.
          </h2>
          <Link className="action action-light" to="/access">
            Get early access <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
        <video
          className="ring-film"
          ref={film}
          width={576}
          height={720}
          poster="/footer-ring.webp"
          preload="none"
          loop
          muted
          playsInline
          aria-hidden="true"
        />
      </div>
      <div className="footer-nav">
        <Link className="wordmark" to="/">
          NOMORE
        </Link>
        <nav aria-label="Footer navigation">
          <Link to="/how-it-works">How it works</Link>
          <Link to="/sources">Sources</Link>
          <Link to="/trust">Trust</Link>
        </nav>
      </div>
    </footer>
  );
}
