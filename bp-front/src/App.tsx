import React from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import { PrivacyPage, RefundsPage, TermsPage } from './pages/legal';
import NotFound from './pages/NotFound';

// Splitting the app screens keeps the marketing bundle small: a visitor who
// only reads the site does not download the account, auth or agent code.
const lazy = (loader: () => Promise<{ default: React.ComponentType }>) => React.lazy(loader);

const LazyPricing = lazy(() => import('./pages/PricingPage'));
const LazyAuth = lazy(() => import('./pages/AuthPage'));
const LazyAccount = lazy(() => import('./pages/AccountPage'));
const LazyAgent = lazy(() => import('./pages/AgentPage'));

const ScrollManager: React.FC = () => {
  const { pathname, hash } = useLocation();

  React.useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      // Wait a frame so the target section exists in the DOM.
      const frame = requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);

  return null;
};

export const App: React.FC = () => (
  <BrowserRouter>
    <ScrollManager />
    <div className="grain" aria-hidden="true" />
    <React.Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center">
          <p className="font-mono text-sm text-fog">Loading…</p>
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<LazyPricing />} />
        <Route path="/auth" element={<LazyAuth />} />
        <Route path="/account" element={<LazyAccount />} />
        <Route path="/agent" element={<LazyAgent />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/refunds" element={<RefundsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </React.Suspense>
  </BrowserRouter>
);
