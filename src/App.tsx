import React, { useEffect, useState } from 'react';
import { LifeHubProvider, useLifeHub } from './store/LifeHubContext';
import { Layout } from './components/Layout';
import { QuickAddModal, type QuickAddTab } from './components/QuickAddModal';
import { SearchModal } from './components/SearchModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { ReceiptScanModal } from './components/ReceiptScanModal';
import { ToastContainer } from './components/Toast';
import { AuthGate } from './components/AuthGate';
import { HomeView } from './views/HomeView';
import { TasksView } from './views/TasksView';
import { SpendingView } from './views/SpendingView';
import { NotesView } from './views/NotesView';
import { EmailView } from './views/EmailView';
import { SocialsView } from './views/SocialsView';
import { SettingsView } from './views/SettingsView';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-canvas)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <img src="/favicon.svg" alt="LifeHub" className="w-11 h-11 rounded-xl opacity-90" />
          <p className="text-xs text-zinc-500">Checking verification...</p>
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

      <QuickAddModal
        open={quickAddOpen}
        initialTab={quickAddTab}
        onClose={() => setQuickAddOpen(false)}
        onOpenAI={() => setAiOpen(true)}
        onOpenReceipt={() => setReceiptOpen(true)}
      />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AIAssistantModal open={aiOpen} onClose={() => setAiOpen(false)} />
      <ReceiptScanModal open={receiptOpen} onClose={() => setReceiptOpen(false)} />
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
