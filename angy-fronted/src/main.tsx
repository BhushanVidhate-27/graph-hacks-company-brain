import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MODE_FOR_PATH } from './lib/appRoutes';
import './index.css';

const normalizePath = (pathname: string) => {
  if (pathname === '/') return '/';
  const withoutIndex = pathname.replace(/\/index\.html$/, '');
  return withoutIndex.replace(/\/+$/, '') || '/';
};

const path = normalizePath(window.location.pathname);
const root = document.getElementById('root')!;

if (path === '/') {
  // The home page is prerendered with the same component tree, so hydrate it
  // instead of throwing the HTML away and re-rendering from scratch.
  ReactDOM.hydrateRoot(
    root,
    <React.StrictMode>
      <App initialMode="website" />
    </React.StrictMode>,
  );
} else if (MODE_FOR_PATH[path]) {
  // App screens are intentionally client-rendered and noindex.
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App initialMode={MODE_FOR_PATH[path]} />
    </React.StrictMode>,
  );
} else {
  // Only used by the Vite dev server. Production marketing pages are static
  // HTML and do not load this bundle, which keeps the article content out of
  // the home page's JavaScript.
  import('./pages/registry').then(({ MARKETING_PAGES, NotFoundPage }) => {
    const Page = MARKETING_PAGES[path] ?? NotFoundPage;
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <Page />
      </React.StrictMode>,
    );
  });
}
