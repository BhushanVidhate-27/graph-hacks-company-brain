import React, { useCallback, useEffect, useRef, useState } from 'react';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset?: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('Helio UI error', error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
          <div className="cad-border bg-[#f4f4ec] p-6 max-w-lg text-center font-mono">
            <div className="text-[10px] uppercase tracking-widest text-[#e15c46] font-bold mb-2">Something went wrong</div>
            <p className="text-xs text-[#5c5c56] mb-4">The page hit an error. Your account is fine — try reloading.</p>
            <button
              onClick={() => {
                this.setState({ error: null });
                this.props.onReset?.();
                window.location.reload();
              }}
              className="bg-[#e15c46] px-4 py-2 text-xs font-bold uppercase text-white"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ViolationInspector } from './components/ViolationInspector';
import { ProductShowcaseSection } from './components/ProductShowcaseSection';
import { WorkflowSection } from './components/WorkflowSection';
import { RolesSection } from './components/RolesSection';
import { PricingSection } from './components/PricingSection';
import { FAQSection } from './components/FAQSection';
import { Footer } from './components/Footer';
import { ArchitectureStrip } from './components/ArchitectureStrip';
import { CodeSnippet, DemoQuestion, DeploymentStrip, IntegrationMarquee, ProofStrip } from './components/LandingExtras';
import { MysteryHero } from './components/MysteryHero';
import { DeviceViewportFrame } from './components/DeviceViewportFrame';
import { PaymentPage } from './components/PaymentPage';
import { TraversalBand } from './components/TraversalBand';
import { LearnStrip } from './components/LearnStrip';
import { AnnouncementTicker } from './components/TickerBar';
import {
  GRAPH_PAGES,
  PageTransitionFrame,
  pageIndex,
  transitionIndex,
  type TransitionPhase,
} from './components/GraphPageTransition';
import { AuthProvider, useAuth } from './lib/auth';
import { useSwipeNavigation } from './lib/useSwipeNavigation';
import { MODE_FOR_PATH, PATH_FOR_MODE, TITLE_FOR_MODE } from './lib/appRoutes';
import { ViewMode } from './types';

// Flip to true to bring back the wordless particle-descent first screen.
const SHOW_MYSTERY_HERO = false;

// App screens are split out of the marketing bundle. The home page never
// renders them, and a visitor who only reads the site should not download the
// agent, console, auth and account code.
const ChatWidgetSimulator = React.lazy(() =>
  import('./components/ChatWidgetSimulator').then((module) => ({
    default: module.ChatWidgetSimulator,
  })),
);
const DashboardSimulator = React.lazy(() =>
  import('./components/DashboardSimulator').then((module) => ({
    default: module.DashboardSimulator,
  })),
);
const AuthView = React.lazy(() =>
  import('./components/AuthView').then((module) => ({ default: module.AuthView })),
);
const AccountView = React.lazy(() =>
  import('./components/AccountView').then((module) => ({ default: module.AccountView })),
);

interface AppShellProps {
  currentMode: ViewMode;
  setCurrentMode: (mode: ViewMode) => void;
  transitionTo: (mode: ViewMode, after?: () => void) => void;
  phase: TransitionPhase;
  fromIndex: number;
  toIndex: number;
}

const AppShell: React.FC<AppShellProps> = ({
  currentMode,
  setCurrentMode,
  transitionTo,
  phase,
  fromIndex,
  toIndex,
}) => {
  const { openAuth, refresh } = useAuth();
  const [viewportDevice, setViewportDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const currentIndex = pageIndex(currentMode);

  const scrollToSectionNow = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToSection = useCallback(
    (sectionId: string) => {
      if (currentMode !== 'website' && currentMode !== 'viewport') {
        transitionTo('website', () => {
          window.setTimeout(() => scrollToSectionNow(sectionId), 60);
        });
      } else {
        scrollToSectionNow(sectionId);
      }
    },
    [currentMode, transitionTo, scrollToSectionNow],
  );

  // AccountView can ask for the marketing pricing section, which is not a
  // separate route. "pricing" means: go back to the site, then scroll.
  const accountNavigate = (mode: 'website' | 'chat-widget' | 'pricing') => {
    if (mode === 'pricing') {
      transitionTo('website', () => {
        window.setTimeout(() => scrollToSectionNow('pricing-section'), 60);
      });
      return;
    }
    transitionTo(mode);
  };

  // Deep links: /?auth=login, /?auth=signup, /?checkout=success and
  // /?billing=portal all land somewhere useful instead of the hero.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get('auth');
    const checkout = params.get('checkout');
    const billing = params.get('billing');

    if (checkout) {
      try {
        sessionStorage.setItem('helio_checkout', checkout);
      } catch {
        /* ignore */
      }
      void refresh();
      setCurrentMode('dashboard');
    } else if (billing) {
      void refresh();
      setCurrentMode('account');
    } else if (authParam) {
      openAuth(authParam === 'login' ? 'login' : 'signup');
    }

    if (authParam || checkout || billing) {
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', clean);
    }
    // Run once on mount; the URL is consumed, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swipe = useSwipeNavigation(phase === 'idle' && currentIndex >= 0, (direction) => {
    const next = GRAPH_PAGES[currentIndex + direction];
    if (next) transitionTo(next.mode);
  });

  // Arrow keys are the desktop equivalent of a swipe, and keep the graph
  // traversal usable without a touch screen.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (phase !== 'idle' || currentIndex < 0) return;

      const next = GRAPH_PAGES[currentIndex + (event.key === 'ArrowRight' ? 1 : -1)];
      if (next) {
        event.preventDefault();
        transitionTo(next.mode);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, currentIndex, transitionTo]);

  // The full website content
  const renderWebsiteContent = () => (
    <div className="relative w-full">
      {SHOW_MYSTERY_HERO ? (
        <MysteryHero />
      ) : (
        <HeroSection onSelectMode={transitionTo} onNavigateSection={scrollToSection} />
      )}

      <DemoQuestion />
      <IntegrationMarquee />
      <div className="hidden md:block">
        <CodeSnippet />
      </div>

      <div className="cad-border-t border-[#282828]/15 hidden md:block" />
      <div className="hidden md:block">
        <TraversalBand />
      </div>

      <div className="cad-border-t border-[#282828]/15" />
      <ViolationInspector />

      <div className="cad-border-t border-[#282828]/15" />
      <ProductShowcaseSection onSelectMode={transitionTo} />

      <div className="cad-border-t border-[#282828]/15" />
      <WorkflowSection />

      <div className="cad-border-t border-[#282828]/15" />
      <RolesSection />

      <div className="cad-border-t border-[#282828]/15" />
      <PricingSection onSelectMode={transitionTo} />

      <div className="cad-border-t border-[#282828]/15" />
      <FAQSection />

      <div className="cad-border-t border-[#282828]/15" />
      <LearnStrip />

      <DeploymentStrip />
      <ArchitectureStrip />
      <ProofStrip />

      <Footer onSelectMode={transitionTo} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#ecece4] text-[#282828] font-mono relative selection:bg-[#e15c46] selection:text-white">

      {/* Promo ticker — scrolls away above the sticky navbar, like the reference */}
      {(currentMode === 'website' || currentMode === 'viewport') && <AnnouncementTicker />}

      {/* Main Navbar */}
      <Navbar
        currentMode={currentMode}
        onSelectMode={transitionTo}
        onNavigateSection={scrollToSection}
      />

      {/* Mode View Content */}
      <main
        className="w-full"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={swipe.onTouchStart}
        onTouchEnd={swipe.onTouchEnd}
      >
        <PageTransitionFrame phase={phase} fromIndex={fromIndex} toIndex={toIndex}>
          <AppErrorBoundary onReset={() => setCurrentMode('website')}>
          <React.Suspense fallback={<div className="min-h-[60vh]" aria-hidden="true" />}>
            {currentMode === 'website' && renderWebsiteContent()}

          {currentMode === 'chat-widget' && (
            <div className="py-8">
              <ChatWidgetSimulator />
            </div>
          )}

          {currentMode === 'dashboard' && (
            <div className="py-8">
              <DashboardSimulator />
            </div>
          )}

          {currentMode === 'viewport' && (
            <DeviceViewportFrame
              device={viewportDevice}
              onChangeDevice={setViewportDevice}
            >
              {renderWebsiteContent()}
            </DeviceViewportFrame>
          )}

          {currentMode === 'auth' && (
            <AuthView
              onSuccess={() => transitionTo('account')}
              onBack={() => transitionTo('website')}
            />
          )}

          {currentMode === 'account' && (
            <AccountView
              onBack={() => transitionTo('website')}
              onSelectMode={accountNavigate}
            />
          )}

          {currentMode === 'pay' && (
            <PaymentPage
              onSelectMode={(mode) => transitionTo(mode)}
            />
          )}
          </React.Suspense>
          </AppErrorBoundary>
        </PageTransitionFrame>
      </main>

    </div>
  );
};

export const App: React.FC<{ initialMode?: ViewMode }> = ({ initialMode = 'website' }) => {
  const [currentMode, setCurrentMode] = useState<ViewMode>(initialMode);
  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [transition, setTransition] = useState({ fromIndex: -1, toIndex: -1 });
  const pending = useRef<{ mode: ViewMode; after?: () => void } | null>(null);

  // Keep the URL and the document title in step with the active view. The app
  // screens are real routes now, so a reload or a shared link lands on the same
  // screen instead of resetting to the marketing home page.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = PATH_FOR_MODE[currentMode];
    if (window.location.pathname !== path) {
      window.history.pushState({ mode: currentMode }, '', path);
    }
    document.title = TITLE_FOR_MODE[currentMode];
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) {
      robots.setAttribute(
        'content',
        currentMode === 'website'
          ? 'index, follow, max-image-preview:large, max-snippet:-1'
          : 'noindex, nofollow',
      );
    }
  }, [currentMode]);

  // Browser back/forward between / and /agent, /console and the account views.
  useEffect(() => {
    const onPopState = () => {
      const mode = MODE_FOR_PATH[window.location.pathname];
      if (mode) setCurrentMode(mode);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const transitionTo = useCallback(
    (mode: ViewMode, after?: () => void) => {
      if (mode === currentMode) {
        after?.();
        return;
      }
      if (phase !== 'idle') return;

      pending.current = { mode, after };
      setTransition({ fromIndex: transitionIndex(currentMode), toIndex: transitionIndex(mode) });
      window.scrollTo({ top: 0, behavior: 'auto' });
      setPhase('out');
    },
    [currentMode, phase],
  );

  useEffect(() => {
    if (phase === 'out') {
      const timer = window.setTimeout(() => {
        const next = pending.current;
        if (next) setCurrentMode(next.mode);
        setPhase('in');
      }, 360);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'in') {
      const timer = window.setTimeout(() => {
        setPhase('idle');
        const after = pending.current?.after;
        pending.current = null;
        after?.();
      }, 600);
      return () => window.clearTimeout(timer);
    }
  }, [phase]);

  return (
    <AuthProvider onOpenAuth={() => transitionTo('auth')}>
      <AppShell
        currentMode={currentMode}
        setCurrentMode={setCurrentMode}
        transitionTo={transitionTo}
        phase={phase}
        fromIndex={transition.fromIndex}
        toIndex={transition.toIndex}
      />
    </AuthProvider>
  );
};

export default App;
