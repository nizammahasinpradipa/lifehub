import React, { useEffect, useState } from 'react';
import { LifeHubProvider, useLifeHub } from './store/LifeHubContext';
import { Layout } from './components/Layout';
import { QuickAddModal, type QuickAddTab } from './components/QuickAddModal';
import { SearchModal } from './components/SearchModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { ReceiptScanModal } from './components/ReceiptScanModal';
import { ToastContainer } from './components/Toast';
import { HomeView } from './views/HomeView';
import { TasksView } from './views/TasksView';
import { SpendingView } from './views/SpendingView';
import { NotesView } from './views/NotesView';
import { SettingsView } from './views/SettingsView';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const LifeHubShell: React.FC = () => {
  const { activeTab } = useLifeHub();

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

  // Global keyboard shortcuts (Ctrl/Cmd+K for Search, Escape to close)
  useEffect(() => {
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
  }, []);

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

  return (
    <Layout
      onQuickAdd={() => openQuickAdd()}
      onOpenSearch={() => setSearchOpen(true)}
      onOpenAI={() => setAiOpen(true)}
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
