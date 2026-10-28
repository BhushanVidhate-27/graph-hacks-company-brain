import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ViolationInspector } from './components/ViolationInspector';
import { ProblemsSection } from './components/ProblemsSection';
import { ProductShowcaseSection } from './components/ProductShowcaseSection';
import { WorkflowSection } from './components/WorkflowSection';
import { RolesSection } from './components/RolesSection';
import { PricingSection } from './components/PricingSection';
import { FAQSection } from './components/FAQSection';
import { Footer } from './components/Footer';
import { ChatWidgetSimulator } from './components/ChatWidgetSimulator';
import { DashboardSimulator } from './components/DashboardSimulator';
import { DeviceViewportFrame } from './components/DeviceViewportFrame';
import { AuthView } from './components/AuthView';
import { AccountView } from './components/AccountView';
import { AuthProvider, useAuth } from './lib/auth';
import { ViewMode } from './types';

interface AppShellProps {
  currentMode: ViewMode;
  setCurrentMode: (mode: ViewMode) => void;
}

const AppShell: React.FC<AppShellProps> = ({ currentMode, setCurrentMode }) => {
  const { openAuth, refresh } = useAuth();
  const [viewportDevice, setViewportDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const navigate = (mode: ViewMode) => {
    setCurrentMode(mode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (sectionId: string) => {
    // If not in website mode, switch first
    if (currentMode !== 'website' && currentMode !== 'viewport') {
      setCurrentMode('website');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // AccountView can ask for the marketing pricing section, which is not a
  // separate route. "pricing" means: go back to the site, then scroll.
  const accountNavigate = (mode: 'website' | 'chat-widget' | 'pricing') => {
    if (mode === 'pricing') {
      setCurrentMode('website');
      setTimeout(() => scrollToSection('pricing-section'), 100);
      return;
    }
    navigate(mode);
  };

  // Deep links: /?auth=login, /?auth=signup, /?checkout=success and
  // /?billing=portal all land somewhere useful instead of the hero.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get('auth');
    const checkout = params.get('checkout');
    const billing = params.get('billing');

    if (checkout || billing) {
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

  // The full website content
  const renderWebsiteContent = () => (
    <div className="relative w-full">
      <HeroSection
        onSelectMode={setCurrentMode}
        onNavigateSection={scrollToSection}
      />

      <div className="cad-border-t border-[#282828]/15" />
      <ViolationInspector />

      <div className="cad-border-t border-[#282828]/15" />
      <ProblemsSection />

      <div className="cad-border-t border-[#282828]/15" />
      <ProductShowcaseSection onSelectMode={setCurrentMode} />

      <div className="cad-border-t border-[#282828]/15" />
      <WorkflowSection />

      <div className="cad-border-t border-[#282828]/15" />
      <RolesSection />

      <div className="cad-border-t border-[#282828]/15" />
      <PricingSection onSelectMode={navigate} />

      <div className="cad-border-t border-[#282828]/15" />
      <FAQSection />

      <Footer onSelectMode={setCurrentMode} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#ecece4] text-[#282828] font-mono relative selection:bg-[#e15c46] selection:text-white pb-20">

      {/* Main Navbar */}
      <Navbar
        currentMode={currentMode}
        onSelectMode={setCurrentMode}
        onNavigateSection={scrollToSection}
      />

      {/* Mode View Content */}
      <main className="w-full">
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
            onSuccess={() => navigate('account')}
            onBack={() => navigate('website')}
          />
        )}

        {currentMode === 'account' && (
          <AccountView
            onBack={() => navigate('website')}
            onSelectMode={accountNavigate}
          />
        )}
      </main>

    </div>
  );
};

export const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<ViewMode>('website');

  return (
    <AuthProvider onOpenAuth={() => setCurrentMode('auth')}>
      <AppShell currentMode={currentMode} setCurrentMode={setCurrentMode} />
    </AuthProvider>
  );
};

export default App;
