import React, { Suspense, lazy, useEffect, useState } from 'react';
import { LifeHubProvider, useLifeHub } from './store/LifeHubContext';
import { Layout } from './components/Layout';
import { QuickAddModal, type QuickAddTab } from './components/QuickAddModal';
import { ToastContainer } from './components/Toast';
import { AuthGate } from './components/AuthGate';
import { AppLogo } from './components/AppLogo';
import { HomeView } from './views/HomeView';

// Route-level & modal-level code splitting for faster Android cold start
const TasksView = lazy(() => import('./views/TasksView').then((m) => ({ default: m.TasksView })));
const SpendingView = lazy(() => import('./views/SpendingView').then((m) => ({ default: m.SpendingView })));
const NotesView = lazy(() => import('./views/NotesView').then((m) => ({ default: m.NotesView })));
const EmailView = lazy(() => import('./views/EmailView').then((m) => ({ default: m.EmailView })));
const SocialsView = lazy(() => import('./views/SocialsView').then((m) => ({ default: m.SocialsView })));
const SettingsView = lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })));
const SearchModal = lazy(() => import('./components/SearchModal').then((m) => ({ default: m.SearchModal })));
const AIAssistantModal = lazy(() => import('./components/AIAssistantModal').then((m) => ({ default: m.AIAssistantModal })));
const ReceiptScanModal = lazy(() => import('./components/ReceiptScanModal').then((m) => ({ default: m.ReceiptScanModal })));

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ViewSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading section">
    <div className="h-8 w-40 rounded-full" style={{ backgroundColor: 'var(--bg-subtle)' }} />
    <div className="card p-6 h-36" />
    <div className="card p-6 h-52" />
  </div>
);

const LifeHubShell: React.FC = () => {
  const { activeTab, authReady, isUnlocked } = useLifeHub();

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddTab, setQuickAddTab] = useState<QuickAddTab>('task');
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const openQuickAdd = (tab?: QuickAddTab) => {
    setQuickAddTab(tab || (activeTab === 'spending' ? 'expense' : activeTab === 'notes' ? 'note' : 'task'));
    setQuickAddOpen(true);
  };

  // Global keyboard shortcuts (disabled while locked so nothing opens behind the gate)
  useEffect(() => {
    if (!isUnlocked) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setQuickAddOpen(false);
        setSearchOpen(false);
        setAiOpen(false);
        setReceiptOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isUnlocked]);

  // Capture PWA install prompt (PC Chrome/Edge & Android Chrome)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  // Never mount the real dashboard or private data until verification passes
  if (!authReady) {
    return (
      <div
        className="min-h-dvh flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-canvas)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <AppLogo className="w-12 h-12 opacity-95" />
          <p className="text-xs font-medium text-[var(--text-muted)]">Checking account...</p>
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <>
        <AuthGate />
        <ToastContainer />
      </>
    );
  }

  return (
    <Layout
      onQuickAdd={() => openQuickAdd()}
      onOpenSearch={() => setSearchOpen(true)}
      onOpenAI={() => setAiOpen(true)}
      onOpenReceipt={() => setReceiptOpen(true)}
    >
      <Suspense fallback={<ViewSkeleton />}>
        {activeTab === 'home' && (
          <HomeView
            onQuickAdd={openQuickAdd}
            onOpenAI={() => setAiOpen(true)}
            onOpenReceipt={() => setReceiptOpen(true)}
          />
        )}
        {activeTab === 'tasks' && <TasksView />}
        {activeTab === 'spending' && (
          <SpendingView
            onQuickAddExpense={() => openQuickAdd('expense')}
            onOpenReceipt={() => setReceiptOpen(true)}
          />
        )}
        {activeTab === 'notes' && <NotesView />}
        {activeTab === 'email' && <EmailView />}
        {activeTab === 'socials' && <SocialsView />}
        {activeTab === 'settings' && (
          <SettingsView canInstallPwa={Boolean(installPrompt)} onInstallPwa={handleInstallPwa} />
        )}
      </Suspense>

      <QuickAddModal
        open={quickAddOpen}
        initialTab={quickAddTab}
        onClose={() => setQuickAddOpen(false)}
        onOpenAI={() => setAiOpen(true)}
        onOpenReceipt={() => setReceiptOpen(true)}
      />

      <Suspense fallback={null}>
        {searchOpen && <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}
        {aiOpen && <AIAssistantModal open={aiOpen} onClose={() => setAiOpen(false)} />}
        {receiptOpen && <ReceiptScanModal open={receiptOpen} onClose={() => setReceiptOpen(false)} />}
      </Suspense>

      <ToastContainer />
    </Layout>
  );
};

export function App() {
  return (
    <LifeHubProvider>
      <LifeHubShell />
    </LifeHubProvider>
  );
}

export default App;
