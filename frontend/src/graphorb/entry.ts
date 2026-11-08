/**
 * GraphOrb entry point.
 *
 * Loaded twice on purpose: the application bundle imports it for `/` and the
 * app screens, and the prerendered marketing pages load the standalone
 * `/graphorb.js` build. The window flag makes the second mount a no-op, so the
 * page only ever has one orb, one animation loop and one set of listeners.
 *
 * The public surface on `window.GraphOrb` lets a page drive the companion from
 * its own code:
 *
 *   window.GraphOrb?.setState('thinking');   // then back to idle on its own
 *   window.GraphOrb?.open();                 // explain the focused element
 *   window.GraphOrb?.refresh();              // rescan after adding content
 */

import { mountGraphOrb } from './GraphOrb';
import type { GraphOrbController, GraphOrbState } from './GraphOrb';

declare global {
  interface Window {
    GraphOrb?: {
      state: () => GraphOrbState;
      setState: (state: GraphOrbState, ttlMs?: number) => void;
      open: () => void;
      close: () => void;
      refresh: () => void;
      destroy: () => void;
    };
    __graphorbMounted?: boolean;
  }
}

// TEMPORARILY DISABLED: spider cursor removed at owner request to focus on
// onboarding + integrations. Re-enable with VITE_GRAPHORB=1 (or remove this guard).
const GRAPHORB_ENABLED = (import.meta as any).env?.VITE_GRAPHORB === '1';

if (GRAPHORB_ENABLED && !window.__graphorbMounted) {
  window.__graphorbMounted = true;
  const controller: GraphOrbController = mountGraphOrb();

  window.GraphOrb = {
    state: () => controller.state(),
    setState: (state, ttlMs) => controller.setState(state, ttlMs),
    open: () => controller.open(),
    close: () => controller.close(),
    refresh: () => controller.refresh(),
    destroy: () => {
      controller.destroy();
      window.__graphorbMounted = false;
      delete window.GraphOrb;
    },
  };

  window.dispatchEvent(new CustomEvent('graphorb:ready'));
}
