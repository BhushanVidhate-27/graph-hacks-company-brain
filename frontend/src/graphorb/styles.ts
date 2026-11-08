/**
 * GraphOrb styles.
 *
 * Injected from JavaScript rather than added to index.css so the same file can
 * ship in the tiny standalone bundle that the prerendered marketing pages load.
 * Colours come from the site tokens (--cl-brand, --cl-border, --cl-primary) and
 * fall back to the literal values when a page has not declared them yet.
 */

export const ORB_ART_SIZE = 54;

export const ORB_CSS = `
.graphorb-root {
  position: fixed;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  z-index: 50;
  pointer-events: none;
  --gx: -200px;
  --gy: -200px;
  --orb-art: ${ORB_ART_SIZE}px;
  --spin: 9s;
  --brand: var(--cl-brand, #e15c46);
  --ink: var(--cl-primary, #282828);
  --paper: #f4f4ec;
  font-family: 'Space Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  -webkit-font-smoothing: antialiased;
}

.graphorb-orb {
  position: absolute;
  left: 0;
  top: 0;
  width: 60px;
  height: 60px;
  margin: -30px 0 0 -30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  pointer-events: auto;
  cursor: pointer;
  transform: translate3d(var(--gx), var(--gy), 0) translateZ(0);
  will-change: transform;
  -webkit-tap-highlight-color: transparent;
}

.graphorb-orb:focus { outline: none; }
.graphorb-orb:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 5px;
}

/* Hit-test fallback: while GraphOrb floats over a control, it stops taking
   clicks so the control underneath still receives them. */
.graphorb-root.is-pass-through .graphorb-orb { pointer-events: none; }

.graphorb-squash {
  position: absolute;
  inset: 0;
  display: block;
  transform: scale(1);
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.graphorb-art {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--orb-art);
  height: var(--orb-art);
  margin: calc(var(--orb-art) / -2) 0 0 calc(var(--orb-art) / -2);
  overflow: visible;
}

.graphorb-spider {
  position: absolute;
  inset: -2px;
  background: url('/images/graphorb/spider-lineart.svg') center 44% / contain no-repeat;
}

.graphorb-orbit {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  animation: graphorb-spin var(--spin) linear infinite;
}

.graphorb-node {
  position: absolute;
  width: 5px;
  height: 5px;
  margin: -2.5px 0 0 -2.5px;
  border-radius: 50%;
  background: var(--ink);
  box-shadow: 0 0 0 1px rgba(236, 236, 228, 0.85);
  transform: rotate(calc(var(--a) * 1deg)) translateY(-33px);
}

.graphorb-node.is-brand { background: var(--brand); }

@keyframes graphorb-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.graphorb-ripple {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid var(--brand);
  opacity: 0;
}

.graphorb-halo {
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  border: 1px solid rgba(40, 40, 40, 0.16);
  opacity: 0;
  transition: opacity 200ms ease;
}

.graphorb-root[data-state="hover"] .graphorb-squash { transform: scale(1.07); }
.graphorb-root[data-state="hover"] .graphorb-halo { opacity: 1; }
.graphorb-root[data-state="click"] .graphorb-squash { transform: scale(0.86); }
.graphorb-root[data-state="click"] .graphorb-ripple { animation: graphorb-ripple 520ms ease-out; }
.graphorb-root[data-state="thinking"] { --spin: 2.4s; }
.graphorb-root[data-state="searching"] { --spin: 2.8s; }
.graphorb-root[data-state="listening"] .graphorb-squash { animation: graphorb-pulse 1.9s ease-in-out infinite; }
.graphorb-root[data-state="success"] .graphorb-halo { opacity: 1; border-color: rgba(16, 185, 129, 0.85); box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12); }
.graphorb-root[data-state="error"] .graphorb-squash { animation: graphorb-shake 420ms cubic-bezier(0.36, 0.07, 0.19, 0.97); }
.graphorb-root[data-state="sleep"] { --spin: 32s; }
.graphorb-root[data-state="sleep"] .graphorb-art { opacity: 0.62; }
.graphorb-root[data-state="sleep"] .graphorb-node { opacity: 0.55; }

@keyframes graphorb-ripple {
  from { transform: scale(0.72); opacity: 0.85; }
  to { transform: scale(1.9); opacity: 0; }
}

@keyframes graphorb-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes graphorb-shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-3px); }
  40%, 60% { transform: translateX(3px); }
}

/* 1px dashed outline over the thing GraphOrb is looking at. */
.graphorb-focus {
  position: fixed;
  z-index: 45;
  pointer-events: none;
  border: 1px dashed rgba(194, 69, 45, 0.85);
  border-radius: 2px;
  opacity: 0;
  transition: opacity 160ms ease;
}
.graphorb-focus[data-visible="true"] { opacity: 1; }

.graphorb-popup {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 55;
  --brand: var(--cl-brand, #e15c46);
  --ink: var(--cl-primary, #282828);
  --paper: #f4f4ec;
  font-family: 'Space Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  -webkit-font-smoothing: antialiased;
  width: min(300px, calc(100vw - 24px));
  background: var(--paper);
  border: 1px solid var(--cl-border, rgba(40, 40, 40, 0.25));
  box-shadow: 0 12px 32px rgba(40, 40, 40, 0.18);
  color: var(--ink);
  pointer-events: auto;
  visibility: hidden;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 180ms ease, transform 180ms ease, visibility 0s linear 180ms;
  user-select: text;
}

.graphorb-popup[data-open="true"] {
  visibility: visible;
  opacity: 1;
  transform: none;
  transition: opacity 180ms ease, transform 180ms ease, visibility 0s;
}

.graphorb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--cl-border, rgba(40, 40, 40, 0.25));
}

.graphorb-kicker {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #5c5c56;
}

.graphorb-close {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: #5c5c56;
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.graphorb-close:hover,
.graphorb-close:focus-visible {
  border-color: var(--cl-border, rgba(40, 40, 40, 0.25));
  color: var(--ink);
  outline: none;
}

.graphorb-body { padding: 10px 12px 12px; }

.graphorb-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.graphorb-desc {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.55;
  color: #5c5c56;
}

.graphorb-meta {
  display: inline-block;
  margin-top: 8px;
  padding: 2px 5px;
  border: 1px solid var(--cl-border, rgba(40, 40, 40, 0.25));
  font-size: 10px;
  color: #5c5c56;
  word-break: break-all;
}

.graphorb-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

.graphorb-action {
  padding: 6px 10px;
  border: 1px solid var(--brand);
  background: var(--brand);
  color: #fff;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}

.graphorb-action:hover { background: var(--ink); border-color: var(--ink); }

@media (hover: none) {
  .graphorb-orb { cursor: default; }
}

@media (prefers-reduced-motion: reduce) {
  .graphorb-spider,
  .graphorb-orbit,
  .graphorb-ripple,
  .graphorb-root[data-state="listening"] .graphorb-squash,
  .graphorb-root[data-state="error"] .graphorb-squash {
    animation: none !important;
  }
  .graphorb-squash,
  .graphorb-popup,
  .graphorb-focus {
    transition: none !important;
  }
}

@media print {
  .graphorb-root,
  .graphorb-popup,
  .graphorb-focus { display: none !important; }
}
`;
