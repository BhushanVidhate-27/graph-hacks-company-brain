/**
 * GraphOrb — a floating companion that follows the pointer, reacts to the
 * component under it, and explains that component when clicked.
 *
 * Why plain DOM and not React: the orb is mounted on every page, including the
 * prerendered marketing pages that deliberately ship no application bundle. It
 * also moves on every animation frame, and a state update per frame would be
 * the one thing this widget must not do. All motion is written straight to CSS
 * custom properties inside a single requestAnimationFrame loop; React never
 * enters the picture.
 *
 * Lifecycle: `mountGraphOrb()` builds the DOM once, returns a controller, and
 * installs `window.GraphOrb`. `destroy()` removes every listener, timer and
 * frame request it created.
 */

import { describeTarget, findCandidate, runTargetAction, type OrbTarget } from './metadata';
import { ORB_CSS } from './styles';

export type GraphOrbState =
  | 'idle'
  | 'following'
  | 'hover'
  | 'click'
  | 'thinking'
  | 'searching'
  | 'explaining'
  | 'success'
  | 'error'
  | 'listening'
  | 'sleep';

export interface GraphOrbController {
  setState: (state: GraphOrbState, ttlMs?: number) => void;
  open: () => void;
  close: () => void;
  refresh: () => void;
  destroy: () => void;
  state: () => GraphOrbState;
}

const ORB_SIZE = 60;
const MARGIN = 12;
const CURSOR_OFFSET_X = 26;
const CURSOR_OFFSET_Y = 22;
const MOVE_IDLE_MS = 1400;
const SLEEP_MS = 26000;
const LERP_TAU_MS = 120;
const HIT_TEST_MS = 150;
// Within this radius, a pointer that is moving *towards* the orb makes it hold
// still and be caught, instead of retreating by the follow offset forever. A
// pointer moving across the page is unaffected, so following still feels alive.
const REACH_RADIUS = 140;
const REACH_COS = 0.6;

const ORB_SURFACE = '.graphorb-root, .graphorb-popup';

const TRANSIENT_TTL: Partial<Record<GraphOrbState, number>> = {
  click: 320,
  success: 950,
  error: 820,
  thinking: 1300,
  searching: 1050,
  listening: 1200,
};

const make = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  parent?.appendChild(node);
  return node;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const intersects = (a: DOMRect, b: DOMRect) => {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
};

export class GraphOrb implements GraphOrbController {
  private root: HTMLElement;
  private orb: HTMLButtonElement;
  private art: HTMLElement;
  private orbit: HTMLElement;
  private focusRing: HTMLElement;
  private popup: HTMLElement;
  private popupKicker: HTMLElement;
  private popupTitle: HTMLElement;
  private popupDesc: HTMLElement;
  private popupMeta: HTMLElement;
  private popupAction: HTMLButtonElement;
  private popupClose: HTMLButtonElement;
  private styleTag: HTMLStyleElement | null = null;

  private raf = 0;
  private last = 0;
  private now = 0;
  private lastActivity = 0;
  private movingUntil = 0;
  private lastHitTest = 0;
  private pointerX = Number.NEGATIVE_INFINITY;
  private pointerY = Number.NEGATIVE_INFINITY;
  private pointerOnOrbUntil = 0;

  private x = 0;
  private y = 0;
  private targetX = 0;
  private targetY = 0;

  private hoverTarget: HTMLElement | null = null;
  private focusTarget: HTMLElement | null = null;
  private currentTarget: OrbTarget | null = null;

  private popupOpen = false;
  private frozen = false;
  private forced: GraphOrbState | null = null;
  private transient: { state: GraphOrbState; until: number } | null = null;
  private painted: GraphOrbState | null = null;

  private reducedMotion = false;
  private coarse = false;
  private timers = new Set<number>();
  private destroyed = false;

  constructor() {
    this.installStyles();
    this.root = make('div', 'graphorb-root');
    this.root.setAttribute('data-state', 'idle');

    this.orb = make('button', 'graphorb-orb', this.root);
    this.orb.type = 'button';
    this.orb.setAttribute('aria-label', 'GraphOrb guide. Explains the element you are looking at.');
    this.orb.setAttribute('aria-haspopup', 'dialog');
    this.orb.setAttribute('aria-expanded', 'false');

    const squash = make('span', 'graphorb-squash', this.orb);
    this.art = make('span', 'graphorb-art', squash);
    const spider = make('span', 'graphorb-spider', this.art);
    spider.setAttribute('aria-hidden', 'true');

    this.orbit = make('span', 'graphorb-orbit', squash);
    this.orbit.setAttribute('aria-hidden', 'true');
    [0, 120, 240].forEach((angle, index) => {
      const node = make('span', `graphorb-node${index === 0 ? ' is-brand' : ''}`, this.orbit);
      node.style.setProperty('--a', String(angle));
    });

    make('span', 'graphorb-ripple', squash).setAttribute('aria-hidden', 'true');
    make('span', 'graphorb-halo', squash).setAttribute('aria-hidden', 'true');

    this.focusRing = make('div', 'graphorb-focus');
    this.focusRing.setAttribute('aria-hidden', 'true');
    this.focusRing.setAttribute('data-visible', 'false');

    this.popup = make('div', 'graphorb-popup');
    this.popup.setAttribute('role', 'dialog');
    this.popup.setAttribute('aria-modal', 'false');
    this.popup.setAttribute('aria-labelledby', 'graphorb-popup-title');
    this.popup.setAttribute('data-open', 'false');

    const head = make('div', 'graphorb-head', this.popup);
    this.popupKicker = make('span', 'graphorb-kicker', head);
    this.popupClose = make('button', 'graphorb-close', head);
    this.popupClose.type = 'button';
    this.popupClose.setAttribute('aria-label', 'Close GraphOrb');
    this.popupClose.textContent = '×';

    const body = make('div', 'graphorb-body', this.popup);
    this.popupTitle = make('h2', 'graphorb-title', body);
    this.popupTitle.id = 'graphorb-popup-title';
    this.popupDesc = make('p', 'graphorb-desc', body);
    this.popupMeta = make('span', 'graphorb-meta', body);
    const actions = make('div', 'graphorb-actions', body);
    this.popupAction = make('button', 'graphorb-action', actions);
    this.popupAction.type = 'button';

    document.body.appendChild(this.popup);
    document.body.appendChild(this.root);
    document.body.appendChild(this.focusRing);

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;

    const homeX = window.innerWidth - ORB_SIZE / 2 - MARGIN * 2;
    const homeY = window.innerHeight - ORB_SIZE / 2 - MARGIN * 4;
    this.x = homeX;
    this.y = homeY;
    this.targetX = homeX;
    this.targetY = homeY;
    this.lastActivity = performance.now();
    this.writeTransform();

    this.bind();
    this.paint();
    this.schedule(() => this.scan(), 450);
    if (this.reducedMotion) this.schedule(() => this.maybeHitTest(), 600);

    if (!this.reducedMotion) this.raf = requestAnimationFrame(this.tick);
  }

  // ---------------------------------------------------------------- lifecycle

  private installStyles() {
    if (document.getElementById('graphorb-styles')) return;
    const style = document.createElement('style');
    style.id = 'graphorb-styles';
    style.textContent = ORB_CSS;
    document.head.appendChild(style);
    this.styleTag = style;
  }

  private bind() {
    document.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.addEventListener('pointerover', this.onPointerOver, true);
    document.addEventListener('pointerdown', this.onPointerDown, true);
    document.addEventListener('focusin', this.onFocusIn, true);
    document.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('scroll', this.onViewportChange, { passive: true });
    window.addEventListener('resize', this.onViewportChange);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.orb.addEventListener('click', this.onOrbClick);
    this.popupClose.addEventListener('click', this.onCloseClick);
    this.popupAction.addEventListener('click', this.onActionClick);
    this.orb.addEventListener('focus', this.onOrbFocus);
    this.orb.addEventListener('blur', this.onOrbBlur);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerover', this.onPointerOver, true);
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    document.removeEventListener('focusin', this.onFocusIn, true);
    document.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('scroll', this.onViewportChange);
    window.removeEventListener('resize', this.onViewportChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.orb.removeEventListener('click', this.onOrbClick);
    this.popupClose.removeEventListener('click', this.onCloseClick);
    this.popupAction.removeEventListener('click', this.onActionClick);
    this.orb.removeEventListener('focus', this.onOrbFocus);
    this.orb.removeEventListener('blur', this.onOrbBlur);

    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers.clear();
    cancelAnimationFrame(this.raf);
    this.root.remove();
    this.popup.remove();
    this.focusRing.remove();
    this.styleTag?.remove();
  }

  private schedule(fn: () => void, delay: number) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (!this.destroyed) fn();
    }, delay);
    this.timers.add(id);
    return id;
  }

  // ------------------------------------------------------------------- states

  state(): GraphOrbState {
    return this.painted ?? 'idle';
  }

  setState(state: GraphOrbState, ttlMs?: number) {
    const ttl = ttlMs ?? TRANSIENT_TTL[state];
    if (ttl === 0) {
      this.forced = state;
      this.paint();
      return;
    }
    this.transient = { state, until: performance.now() + (ttl ?? 1200) };
    this.paint();
  }

  private baseState(): GraphOrbState {
    if (this.forced) return this.forced;
    if (this.popupOpen) return 'explaining';
    if (this.now - this.lastActivity > SLEEP_MS) return 'sleep';
    if (this.hoverTarget) return 'hover';
    if (this.now < this.movingUntil) return 'following';
    return 'idle';
  }

  private paint() {
    const next = this.transient?.state ?? this.baseState();
    if (next !== this.painted) {
      this.painted = next;
      this.root.setAttribute('data-state', next);
    }
    this.syncFocusRing();
  }

  // -------------------------------------------------------------------- motion

  private tick = (time: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.tick);
    this.now = time;
    const dt = Math.min(64, time - (this.last || time));
    this.last = time;

    if (this.transient && time >= this.transient.until) {
      this.transient = null;
      this.paint();
    }
    if (this.forced && time - this.lastActivity < MOVE_IDLE_MS) {
      this.forced = null;
      this.paint();
    }

    if (time - this.lastHitTest > HIT_TEST_MS) {
      this.lastHitTest = time;
      this.hitTest();
    }

    this.advance(dt);
  };

  private advance(dt: number) {
    if (this.frozen || this.popupOpen) {
      this.writeTransform();
      return;
    }

    const bob = this.painted === 'sleep' ? 1.2 : 2.6;
    let desiredX = this.targetX;
    let desiredY = this.targetY + Math.sin(this.now * 0.0011) * bob;

    // Lean towards whatever the visitor is hovering: the orb reads as paying
    // attention instead of merely chasing the pointer.
    if (this.hoverTarget?.isConnected) {
      const rect = this.hoverTarget.getBoundingClientRect();
      const towardX = rect.left + rect.width / 2;
      const towardY = rect.top + rect.height / 2;
      desiredX += (towardX - desiredX) * 0.18;
      desiredY += (towardY - desiredY) * 0.18;
    }

    const half = ORB_SIZE / 2;
    desiredX = clamp(desiredX, half + MARGIN, window.innerWidth - half - MARGIN);
    desiredY = clamp(desiredY, half + MARGIN, window.innerHeight - half - MARGIN);

    const k = 1 - Math.exp(-dt / LERP_TAU_MS);
    this.x += (desiredX - this.x) * k;
    this.y += (desiredY - this.y) * k;
    this.writeTransform();
  }

  private writeTransform() {
    this.root.style.setProperty('--gx', `${this.x.toFixed(1)}px`);
    this.root.style.setProperty('--gy', `${this.y.toFixed(1)}px`);
  }

  private moveTo(x: number, y: number) {
    this.targetX = x;
    this.targetY = y;
  }

  private hitTest() {
    if (this.popupOpen) {
      this.root.classList.remove('is-pass-through');
      return;
    }
    // On touch there is no hovering pointer to move away, and the orb is the
    // only way to open an explanation, so it has to stay tappable.
    if (this.coarse) {
      this.root.classList.remove('is-pass-through');
      return;
    }
    // Never swallow a click that is aimed at the orb itself. The orb trails the
    // pointer, so while the visitor hovers a control the pointer is still a
    // comfortable distance away and the control keeps its clicks; the moment
    // the pointer is actually on the orb (about to press it), the orb becomes
    // clickable again.
    const pointerOnOrb =
      performance.now() < this.pointerOnOrbUntil ||
      Math.hypot(this.pointerX - this.x, this.pointerY - this.y) <= ORB_SIZE / 2;
    if (pointerOnOrb) {
      this.root.classList.remove('is-pass-through');
      return;
    }
    const stack = document.elementsFromPoint(this.x, this.y);
    const under = stack.find((node) => !node.closest('.graphorb-root'));
    const control = under?.closest(
      'a[href], button, input, select, textarea, summary, [role="button"], label',
    );
    this.root.classList.toggle('is-pass-through', Boolean(control));
  }

  // ------------------------------------------------------------------ pointers

  private onPointerMove = (event: PointerEvent) => {
    if (this.coarse) return;
    const previousX = this.pointerX;
    const previousY = this.pointerY;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.lastActivity = performance.now();
    this.movingUntil = this.lastActivity + MOVE_IDLE_MS;

    // Re-enable the orb immediately rather than waiting for the next hit test,
    // so a click that lands right after the pointer reaches it is not dropped.
    const toOrbX = this.x - event.clientX;
    const toOrbY = this.y - event.clientY;
    const distance = Math.hypot(toOrbX, toOrbY);
    if (distance <= ORB_SIZE / 2) {
      this.pointerOnOrbUntil = this.lastActivity + 700;
      this.root.classList.remove('is-pass-through');
    }

    if (this.frozen || this.popupOpen) {
      this.paint();
      return;
    }

    // Moving straight at the orb means the visitor is reaching for it: stop so
    // it can be pressed. Any other direction keeps the offset follow.
    let reaching = false;
    if (Number.isFinite(previousX) && distance < REACH_RADIUS) {
      const moveX = event.clientX - previousX;
      const moveY = event.clientY - previousY;
      const moveLength = Math.hypot(moveX, moveY);
      if (moveLength > 2) {
        reaching = (moveX * toOrbX + moveY * toOrbY) / (moveLength * Math.max(distance, 1)) > REACH_COS;
      }
    }
    if (!reaching) {
      this.moveTo(
        event.clientX + CURSOR_OFFSET_X,
        event.clientY + CURSOR_OFFSET_Y,
      );
    }
    this.paint();
  };

  private onPointerOver = (event: Event) => {
    if (this.coarse || this.popupOpen) return;
    const node = event.target instanceof Element ? event.target : null;
    // Moving onto the orb itself must not forget what was just being looked at:
    // the whole point of the click is to explain that element. The candidate is
    // only dropped when the pointer reaches something else that is not a
    // component, such as page background.
    if (node?.closest(ORB_SURFACE)) return;
    const candidate = findCandidate(node);
    if (candidate !== this.hoverTarget) {
      this.hoverTarget = candidate;
      if (candidate) this.focusTarget = candidate;
      this.lastActivity = performance.now();
      this.paint();
      this.syncFocusRing();
    }
  };

  private onPointerDown = (event: PointerEvent) => {
    const node = event.target instanceof Element ? event.target : null;
    if (!node || node.closest(ORB_SURFACE)) return;
    if (!this.popupOpen) {
      // Remember what was tapped so the next orb tap has something to explain
      // on touch screens, where hover does not exist.
      const candidate = findCandidate(node);
      if (candidate) this.focusTarget = candidate;
    } else {
      this.close();
    }
  };

  private onFocusIn = (event: Event) => {
    const node = event.target instanceof Element ? event.target : null;
    if (!node || node.closest(ORB_SURFACE)) return;
    const candidate = findCandidate(node);
    if (candidate) this.focusTarget = candidate;
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.popupOpen) {
      event.stopPropagation();
      this.close();
    }
  };

  private onViewportChange = () => {
    if (this.popupOpen) {
      this.positionPopup();
      this.syncFocusRing();
    }
    // With reduced motion the orb never moves, so the frame loop is not running
    // and nothing else would notice that a control now sits underneath it.
    if (this.reducedMotion && !this.popupOpen) this.maybeHitTest();
  };

  private maybeHitTest() {
    const now = performance.now();
    if (now - this.lastHitTest < HIT_TEST_MS) return;
    this.lastHitTest = now;
    this.hitTest();
  }

  private onVisibilityChange = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      return;
    }
    if (!this.reducedMotion && !this.destroyed) {
      this.last = 0;
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  private onOrbFocus = () => {
    this.transient = { state: 'listening', until: performance.now() + TRANSIENT_TTL.listening! };
    this.paint();
  };

  private onOrbBlur = () => {
    if (!this.popupOpen) {
      this.transient = null;
      this.paint();
    }
  };

  // -------------------------------------------------------------------- popup

  private onOrbClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (this.popupOpen) {
      this.close();
      return;
    }
    this.setState('click', 240);
    this.open();
  };

  private onCloseClick = (event: MouseEvent) => {
    event.preventDefault();
    this.close();
  };

  private onActionClick = (event: MouseEvent) => {
    event.preventDefault();
    if (!this.currentTarget) return;
    const ran = runTargetAction(this.currentTarget);
    if (ran) {
      this.setState('success', 950);
      this.schedule(() => this.close(), 320);
    } else {
      this.setState('error', 820);
    }
  };

  private selfTarget(): OrbTarget {
    return {
      element: this.orb,
      kind: 'component',
      title: 'GraphOrb',
      description:
        'I follow your pointer and lean towards buttons, links and cards. Click one, then click me, and I will explain what it does.',
      action: undefined,
      meta: undefined,
    };
  }

  open() {
    const resolved =
      (this.hoverTarget ? describeTarget(this.hoverTarget) : null) ??
      (this.focusTarget ? describeTarget(this.focusTarget) : null) ??
      this.selfTarget();

    // A leftover "searching" pulse must not outrank "explaining" once the popup
    // is on screen. The click squash is allowed to finish first.
    if (this.transient?.state !== 'click') this.transient = null;
    this.forced = null;

    this.currentTarget = resolved;
    this.popupOpen = true;
    this.frozen = true;

    this.popupKicker.textContent = `${resolved.kind} · focused`;
    this.popupTitle.textContent = resolved.title;
    this.popupDesc.textContent = resolved.description;
    this.popupDesc.hidden = resolved.description.length === 0;
    this.popupMeta.textContent = resolved.meta ?? '';
    this.popupMeta.hidden = !resolved.meta;
    if (resolved.action) {
      this.popupAction.hidden = false;
      this.popupAction.textContent = resolved.action;
    } else {
      this.popupAction.hidden = true;
    }

    this.popup.setAttribute('data-open', 'true');
    this.orb.setAttribute('aria-expanded', 'true');
    this.paint();
    this.positionPopup();
    this.syncFocusRing();

    if (document.activeElement === this.orb) {
      this.popupClose.focus({ preventScroll: true });
    }
    document.dispatchEvent(
      new CustomEvent('graphorb:open', { detail: { title: resolved.title, kind: resolved.kind } }),
    );
  }

  close() {
    if (!this.popupOpen) return;
    this.popupOpen = false;
    this.frozen = false;
    this.currentTarget = null;
    this.popup.setAttribute('data-open', 'false');
    this.orb.setAttribute('aria-expanded', 'false');
    if (this.popup.contains(document.activeElement)) {
      this.orb.focus({ preventScroll: true });
    }
    this.paint();
    this.syncFocusRing();
    document.dispatchEvent(new CustomEvent('graphorb:close'));
  }

  refresh() {
    this.scan();
  }

  private scan() {
    this.setState('searching', 1050);
    // Pick up anything that appeared after the first mount (SPA navigation,
    // lazily opened panels) so the outline is never stale.
    this.syncFocusRing();
  }

  private positionPopup() {
    const orb = this.orb.getBoundingClientRect();
    const width = this.popup.offsetWidth;
    const height = this.popup.offsetHeight;
    const gap = 14;

    const spots = [
      { x: orb.right + gap, y: orb.top + orb.height / 2 - height / 2 },
      { x: orb.left - gap - width, y: orb.top + orb.height / 2 - height / 2 },
      { x: orb.left + orb.width / 2 - width / 2, y: orb.top - gap - height },
      { x: orb.left + orb.width / 2 - width / 2, y: orb.bottom + gap },
    ];

    const targetRect = this.currentTarget?.element.getBoundingClientRect();

    let best = spots[0];
    let bestScore = Number.POSITIVE_INFINITY;

    for (const spot of spots) {
      const candidate = new DOMRect(spot.x, spot.y, width, height);
      const overflowX =
        Math.max(0, MARGIN - candidate.left) + Math.max(0, candidate.right - (window.innerWidth - MARGIN));
      const overflowY =
        Math.max(0, MARGIN - candidate.top) + Math.max(0, candidate.bottom - (window.innerHeight - MARGIN));
      const overlap = targetRect ? intersects(candidate, targetRect) : 0;
      const score = overflowX * 3 + overflowY * 3 + overlap;
      if (score < bestScore) {
        best = spot;
        bestScore = score;
      }
    }

    const x = clamp(best.x, MARGIN, window.innerWidth - width - MARGIN);
    const y = clamp(best.y, MARGIN, window.innerHeight - height - MARGIN);
    this.popup.style.left = `${Math.round(x)}px`;
    this.popup.style.top = `${Math.round(y)}px`;
  }

  private syncFocusRing() {
    const element = this.popupOpen ? this.currentTarget?.element : this.hoverTarget;
    if (!element || !element.isConnected || element === this.orb) {
      this.focusRing.setAttribute('data-visible', 'false');
      return;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) {
      this.focusRing.setAttribute('data-visible', 'false');
      return;
    }
    this.focusRing.style.left = `${Math.round(rect.left - 3)}px`;
    this.focusRing.style.top = `${Math.round(rect.top - 3)}px`;
    this.focusRing.style.width = `${Math.round(rect.width + 6)}px`;
    this.focusRing.style.height = `${Math.round(rect.height + 6)}px`;
    this.focusRing.setAttribute('data-visible', 'true');
  }
}

let controller: GraphOrb | null = null;

export const mountGraphOrb = (): GraphOrbController => {
  if (controller) return controller;
  controller = new GraphOrb();
  return controller;
};

export const unmountGraphOrb = () => {
  controller?.destroy();
  controller = null;
};
