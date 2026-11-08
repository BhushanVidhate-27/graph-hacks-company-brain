import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';
import { MARKETING_PAGES, NotFoundPage } from './pages/registry';

export { MARKETING_ROUTES, ROUTES_BY_PATH } from './seo/routes';
export { APP_ROUTES } from './seo/appRoutes';
export { renderHead } from './seo/head';

/**
 * Build-time renderer used by scripts/prerender.mjs.
 *
 * Only marketing routes are rendered here. App routes are emitted as small
 * loading shells by the script and mounted by the client on first paint.
 */
export const renderMarketingPage = (path: string): string => {
  if (path === '/') {
    return renderToString(<App initialMode="website" />);
  }
  const Page = MARKETING_PAGES[path];
  if (Page) {
    return renderToString(<Page />);
  }
  return renderToString(<NotFoundPage />);
};
