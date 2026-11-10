# bp-front

A new frontend for Helio. React 19 + Vite 7 + Tailwind 4, written against the
existing Helio API (`/api/*`, `/ask`).

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # typecheck + production bundle
npm run preview
```

The dev server proxies `/api` and `/ask` to the backend so cookies stay
first-party. Point it somewhere else with `VITE_DEV_API`:

```bash
VITE_DEV_API=https://helio.runs-on.dev npm run dev
```

## What is in here

| Piece | Library | Where |
| --- | --- | --- |
| Shader wash behind the hero | `@shadergradient/react` | `src/components/viz/HeroBackdrop.tsx` |
| Ownership graph that reacts to the pointer | `@react-three/fiber` + `three` | `src/components/viz/GraphOrb.tsx` |
| Draggable lens that magnifies the provenance trail | `liquid-glass-js` | `src/components/viz/LensCard.tsx` |
| Logo drops that merge on hover | `liquid-gooey` | `src/components/Mark.tsx` |
| Type + colour system | Tailwind 4 `@theme` | `src/styles.css` |

## Rules this frontend keeps

- **One currency.** Prices come from `GET /api/plans` (`prices_inr`) and render
  as rupees. The catalog in Python is the only source of truth; the fallback in
  `src/lib/api.ts` mirrors the live Razorpay plan prices and is only used when
  the API is unreachable.
- **No fake trust signals.** The hero graph is labelled "sample graph". If the
  backend answers from the fixture instead of the live graph, the agent page
  says so instead of passing it off as a real answer.
- **The browser never activates a plan.** Checkout hands off to Razorpay; the
  webhook on the server activates the subscription.
- **Body copy never goes below 12px** and every focusable element gets the
  global `:focus-visible` ring.
- **Reduced motion is respected.** The shader and the 3D graph stop; the lens is
  not created.

## Routes

`/` landing · `/pricing` plans · `/auth` sign in and up · `/account` plan,
usage, keys, cancellation · `/agent` ask the graph · `/terms`, `/privacy`,
`/refunds` legal.

The legal copy is a starting point, not lawyer-approved text. Review it before
you take a live payment.
