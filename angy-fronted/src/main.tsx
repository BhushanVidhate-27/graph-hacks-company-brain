import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MARKETING_PAGES, NotFoundPage } from './pages/registry';
import { MODE_FOR_PATH } from './lib/appRoutes';
import './index.css';

const normalizePath = (pathname: string) => {
  if (pathname === '/') return '/';
  const withoutIndex = pathname.replace(/\/index\.html$/, '');
  return withoutIndex.replace(/\/+$/, '') || '/';
};

const path = normalizePath(window.location.pathname);
const root = document.getElementById('root')!;
const Page = MARKETING_PAGES[path];

if (path === '/') {
  // The home page is prerendered with the same component tree, so hydrate it
  // instead of throwing the HTML away and re-rendering from scratch.
  ReactDOM.hydrateRoot(
    root,
    <React.StrictMode>
      <App initialMode="website" />
    </React.StrictMode>,
  );
} else if (Page) {
  ReactDOM.hydrateRoot(
    root,
    <React.StrictMode>
      <Page />
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
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <NotFoundPage />
    </React.StrictMode>,
  );
}
