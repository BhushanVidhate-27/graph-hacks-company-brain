/**
 * Component discovery for GraphOrb.
 *
 * Two sources of truth, in this order:
 *
 * 1. Explicit metadata — data-graphorb-title / -description / -action. A section
 *    author writes these when the default wording would be wrong.
 * 2. Automatic detection — links, buttons, form fields, disclosure summaries,
 *    cards and diagrams. The description is derived only from attributes that
 *    are actually on the element (href, aria-expanded, placeholder…). Nothing
 *    is inferred about intent, because a confident wrong explanation is worse
 *    than a short honest one.
 */

export type OrbKind = 'link' | 'button' | 'field' | 'card' | 'component';

export interface OrbTarget {
  element: HTMLElement;
  kind: OrbKind;
  title: string;
  description: string;
  /** Label for the popup's action button. Omitted when nothing safe can be run. */
  action?: string;
  /** Shown as a small monospace chip: where a link goes, or the field type. */
  meta?: string;
}

const INTERACTIVE = [
  'a[href]',
  'button',
  '[role="button"]',
  'summary',
  'input',
  'select',
  'textarea',
].join(',');

const CONTAINER = 'article, figure, [data-graphorb-card]';

const SELECTOR = `${INTERACTIVE}, [data-graphorb], [data-graphorb-title], ${CONTAINER}`;

const clip = (value: string, max: number): string => {
  const flat = value.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
};

const isOrbNode = (el: Element): boolean =>
  Boolean(el.closest('.graphorb-root, .graphorb-popup'));

const isVisible = (el: HTMLElement): boolean => {
  if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
  if ((el as HTMLInputElement).disabled) return false;
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
  const rects = el.getClientRects();
  if (!rects.length) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  return true;
};

/** Nearest element that GraphOrb can explain, or null. */
export const findCandidate = (start: Element | null): HTMLElement | null => {
  let node: Element | null = start;
  while (node && node !== document.body) {
    if (node instanceof HTMLElement && !isOrbNode(node) && node.matches(SELECTOR)) {
      if (isVisible(node) && accepts(node)) return node;
    }
    node = node.parentElement;
  }
  return null;
};

const accepts = (el: HTMLElement): boolean => {
  if (el.hasAttribute('data-graphorb-title') || el.hasAttribute('data-graphorb')) return true;
  if (el.matches(INTERACTIVE)) return true;
  // Cards and figures are only interesting when they carry their own heading,
  // and only when they are not so large that hovering the page counts as
  // hovering the card.
  const heading = el.querySelector('h1, h2, h3, h4');
  if (!heading) return false;
  const rect = el.getBoundingClientRect();
  const viewport = Math.max(1, window.innerWidth * window.innerHeight);
  return (rect.width * rect.height) / viewport < 0.7;
};

const kindOf = (el: HTMLElement): OrbKind => {
  if (el.hasAttribute('data-graphorb-title') || el.hasAttribute('data-graphorb')) return 'component';
  if (el.matches('a[href]')) return 'link';
  if (el.matches('input, select, textarea')) return 'field';
  if (el.matches('button, [role="button"], summary')) return 'button';
  return 'card';
};

const linkMeta = (el: HTMLAnchorElement): string | undefined => {
  try {
    const url = new URL(el.href, window.location.href);
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}` || '/'
      : url.hostname;
  } catch {
    return undefined;
  }
};

const fieldMeta = (el: HTMLElement): string | undefined => {
  if (el instanceof HTMLInputElement) return el.type === 'text' ? 'text field' : `${el.type} field`;
  if (el instanceof HTMLSelectElement) return 'select';
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  return undefined;
};

const fallbackTitle = (el: HTMLElement): string => {
  const heading = el.querySelector('h1, h2, h3, h4');
  if (heading?.textContent?.trim()) return clip(heading.textContent, 64);
  const text = el.textContent ?? '';
  if (text.trim()) return clip(text, 64);
  return el.tagName.toLowerCase();
};

const deriveDescription = (el: HTMLElement, kind: OrbKind): string => {
  const explicit = el.getAttribute('data-graphorb-description');
  if (explicit) return clip(explicit, 220);

  if (el.getAttribute('aria-describedby')) {
    const id = el.getAttribute('aria-describedby')!.split(/\s+/)[0];
    const node = document.getElementById(id);
    if (node?.textContent?.trim()) return clip(node.textContent, 220);
  }

  if (kind === 'link') {
    const meta = linkMeta(el as HTMLAnchorElement);
    return meta ? `Opens ${meta}.` : 'Opens a link.';
  }

  if (kind === 'button') {
    if (el.hasAttribute('aria-expanded')) {
      const open = el.getAttribute('aria-expanded') === 'true';
      return `Disclosure control. The section is currently ${open ? 'open' : 'closed'}.`;
    }
    if (el.tagName === 'SUMMARY') return 'Opens the details section below it.';
    const type = el.getAttribute('type');
    if (type === 'submit') return 'Submits the form it sits in.';
    return '';
  }

  if (kind === 'field') {
    const label =
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : '') ||
      '';
    return label.trim() ? `Form field: ${clip(label, 48)}.` : 'Form field.';
  }

  const paragraph = el.querySelector('p');
  if (paragraph?.textContent?.trim()) return clip(paragraph.textContent, 200);
  return '';
};

const deriveAction = (el: HTMLElement, kind: OrbKind): string | undefined => {
  const explicit = el.getAttribute('data-graphorb-action');
  if (explicit) return explicit;
  if (kind === 'link') return 'Open link';
  if (kind === 'button') return 'Press';
  if (kind === 'field') return 'Focus';
  return undefined;
};

export const describeTarget = (el: HTMLElement): OrbTarget | null => {
  if (!el || isOrbNode(el)) return null;

  const kind = kindOf(el);
  const explicitTitle = el.getAttribute('data-graphorb-title');
  const title = explicitTitle
    ? clip(explicitTitle, 64)
    : el.getAttribute('aria-label') || fallbackTitle(el);

  const meta =
    kind === 'link' ? linkMeta(el as HTMLAnchorElement) : kind === 'field' ? fieldMeta(el) : undefined;

  return {
    element: el,
    kind,
    title: title || el.tagName.toLowerCase(),
    description: deriveDescription(el, kind),
    action: deriveAction(el, kind),
    meta,
  };
};

/** Run the popup's action against the real element, then report whether it ran. */
export const runTargetAction = (target: OrbTarget): boolean => {
  const el = target.element;
  if (!el.isConnected) return false;

  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    el.focus({ preventScroll: false });
    return true;
  }

  if (el instanceof HTMLAnchorElement || el instanceof HTMLButtonElement) {
    el.click();
    return true;
  }

  if (typeof (el as HTMLElement).click === 'function' && el.getAttribute('role') === 'button') {
    el.click();
    return true;
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.setAttribute('data-graphorb-flash', 'true');
  window.setTimeout(() => el.removeAttribute('data-graphorb-flash'), 900);
  return true;
};
