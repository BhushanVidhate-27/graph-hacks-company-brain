import { useEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";
import { Citation } from "@/components/Citation";
import { records } from "@/lib/evidence";

const chapters = [
  {
    art: "continuum",
    label: records["D-14"].dateLabel,
    title: "One provider.",
    linkLabel: "Original decision",
    body: records["D-14"].summary,
    record: "D-14",
  },
  {
    art: "memory-field",
    label: records["D-19"].dateLabel,
    title: "The decision changes.",
    linkLabel: "Revised decision",
    body: "Elena Vasquez approves Adyen as primary, with Stripe in reserve. The new decision links back to the one it replaces.",
    record: "D-19",
  },
  {
    art: "the-record",
    label: "Supporting evidence",
    title: "Follow the paper trail.",
    linkLabel: "Evidence for",
    body: "The provider evaluation and the payments team’s discussion support the May decision. Both references travel with the answer.",
    record: "D-19",
  },
] as const;

export function PaymentHistory() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = section.current;
    const frame = stage.current;
    const strip = track.current;
    if (!root || !frame || !strip) return;
    const motion = matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 460px)");
    let visible = false;
    let raf = 0;

    function paint() {
      raf = 0;
      if (!root || !frame || !strip || !motion.matches) return;
      const bounds = root.getBoundingClientRect();
      // The opaque history can take over the GPU while it covers the entire brain.
      root.toggleAttribute(
        "data-covers-viewport",
        bounds.top <= 0 && bounds.bottom >= window.innerHeight,
      );
      const distance = bounds.height - frame.offsetHeight;
      const progress = Math.max(0, Math.min(1, -bounds.top / Math.max(1, distance)));
      strip.style.transform =
        "translate3d(" + -progress * (strip.scrollWidth - frame.clientWidth) + "px,0,0)";
    }
    function schedule() {
      if (visible && motion.matches && !raf) raf = requestAnimationFrame(paint);
    }
    function configure() {
      if (!root || !strip) return;
      root.toggleAttribute("data-travel", motion.matches);
      root.removeAttribute("data-covers-viewport");
      strip.style.removeProperty("transform");
      schedule();
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (!visible) root?.removeAttribute("data-covers-viewport");
        schedule();
      },
      { rootMargin: "50% 0px" },
    );
    const resize = new ResizeObserver(schedule);
    observer.observe(root);
    resize.observe(frame);
    resize.observe(root);
    window.addEventListener("scroll", schedule, { passive: true });
    motion.addEventListener("change", configure);
    configure();
    return () => {
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      motion.removeEventListener("change", configure);
      cancelAnimationFrame(raf);
      root.removeAttribute("data-travel");
      root.removeAttribute("data-covers-viewport");
      strip.style.removeProperty("transform");
    };
  }, []);

  return (
    <section ref={section} className="payment-history" aria-labelledby="history-title">
      <div className="history-heading">
        <h2 id="history-title">Payment decision history</h2>
        <a href="#index-title">
          Skip history <ArrowDown size={14} aria-hidden="true" />
        </a>
      </div>
      <div className="history-stage" ref={stage} aria-hidden="true">
        <div className="history-track" ref={track}>
          <img className="history-curve" alt="" src="/illustrations/connection-curve.svg" />
          {chapters.map(({ art }) => (
            <div className="history-scene" key={art}>
              <img
                className={"scene-art scene-" + art}
                src={"/illustrations/" + art + ".svg"}
                alt=""
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
      <ol className="history-chapters">
        {chapters.map(({ art, label, title, body, record, linkLabel }) => (
          <li key={art}>
            <img
              className="chapter-still"
              src={"/illustrations/" + art + ".svg"}
              alt=""
              loading="lazy"
            />
            <div className="chapter-copy">
              <p className="caption">{label}</p>
              <h3>{title}</h3>
              <p>{body}</p>
              <Citation id={record} label={linkLabel} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
