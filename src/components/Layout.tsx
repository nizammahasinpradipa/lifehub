import React from 'react';
import {
  CheckSquare,
  Cloud,
  FileText,
  Home,
  Lock,
  LogOut,
  Mail,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  Wallet,
  Wifi,
  WifiOff,
  HardDrive,
} from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import type { NavTab } from '../types/models';

interface LayoutProps {
  children: React.ReactNode;
  onQuickAdd: () => void;
  onOpenSearch: () => void;
  onOpenAI: () => void;
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; mobileLabel: string; Icon: React.FC<{ className?: string }> }> = [
  { id: 'home', label: 'Home', mobileLabel: 'Home', Icon: Home },
  { id: 'tasks', label: 'Tasks', mobileLabel: 'Tasks', Icon: CheckSquare },
  { id: 'spending', label: 'Spending', mobileLabel: 'Spend', Icon: Wallet },
  { id: 'notes', label: 'Notes', mobileLabel: 'Notes', Icon: FileText },
  { id: 'email', label: 'Email', mobileLabel: 'Email', Icon: Mail },
  { id: 'socials', label: 'Socials', mobileLabel: 'Socials', Icon: Share2 },
];

export const Layout: React.FC<LayoutProps> = ({ children, onQuickAdd, onOpenSearch, onOpenAI }) => {
  const { activeTab, setActiveTab, syncStatus, activeTasks, account, lockNow } = useLifeHub();

  const openTasksCount = activeTasks.filter((t) => !t.parent_task_id && t.status === 'todo').length;

  const renderSyncBadge = () => {
    if (syncStatus.state === 'synced-cloud') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300">
          <Cloud className="w-3.5 h-3.5" />
          Cloud synced
        </span>
      );
    }
    if (syncStatus.state === 'synced-lan') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300">
          <Wifi className="w-3.5 h-3.5" />
          PC & Phone synced
        </span>
      );
    }
    if (syncStatus.state === 'offline') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <WifiOff className="w-3.5 h-3.5" />
          Saved offline
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
        <HardDrive className="w-3.5 h-3.5" />
        Saved locally
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop Left Sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 border-r px-4 py-5 select-none"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between px-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <img src="/favicon.svg" alt="LifeHub" className="w-8 h-8 rounded-lg" />
            <div className="text-left">
              <p className="text-base font-bold tracking-tight leading-none">LifeHub</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Personal workspace</p>
            </div>
          </button>
        </div>

        <button type="button" onClick={onQuickAdd} className="btn-primary w-full mb-3 shadow-sm">
          <Plus className="w-4 h-4" />
          Quick Add
        </button>

        <div className="grid grid-cols-2 gap-1.5 mb-6">
          <button
            type="button"
            onClick={onOpenSearch}
            className="btn-secondary !min-h-[38px] !text-xs !px-2.5 justify-between"
            title="Search (Ctrl+K)"
          >
            <span className="inline-flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-zinc-400" />
              Search
            </span>
            <kbd className="text-[10px] text-zinc-400 font-sans">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={onOpenAI}
            className="btn-secondary !min-h-[38px] !text-xs !px-2.5"
            title="AI Natural Language Input"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            Ask AI
          </button>
        </div>

        <nav className="space-y-1 flex-1" aria-label="Primary">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-teal-600/10 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  {label}
                </span>
                {id === 'tasks' && openTasksCount > 0 && (
                  <span className="text-xs tabular-nums px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                    {openTasksCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-4 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
          {account && (
            <div
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl"
              style={{ backgroundColor: 'var(--bg-subtle)' }}
            >
              <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0 uppercase">
                {(account.displayName || account.email)[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate leading-tight">{account.displayName}</p>
                <p className="text-[11px] text-zinc-500 truncate">{account.email}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-teal-600/10 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings & Sync
          </button>
          <button
            type="button"
            onClick={lockNow}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out / Lock
          </button>
          <div className="px-3 py-0.5">{renderSyncBadge()}</div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header
        className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 90%, transparent)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <button type="button" onClick={() => setActiveTab('home')} className="flex items-center gap-2">
          <img src="/favicon.svg" alt="LifeHub" className="w-7 h-7 rounded-lg" />
          <span className="font-bold text-base tracking-tight">LifeHub</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenAI}
            className="p-2.5 rounded-xl text-teal-700 dark:text-teal-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Open Quick AI Assistant"
          >
            <Sparkles className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onOpenSearch}
            className="p-2.5 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`p-2.5 rounded-xl ${
              activeTab === 'settings' ? 'text-teal-600 dark:text-teal-400' : 'text-zinc-600 dark:text-zinc-300'
            }`}
            aria-label="Settings and Sync"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={lockNow}
            className="p-2.5 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Lock LifeHub"
            title="Lock app"
          >
            <Lock className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64 pb-28 md:pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-8">{children}</div>
      </main>

      {/* Persistent Mobile Floating Quick-Add Button */}
      <button
        type="button"
        onClick={onQuickAdd}
        className="md:hidden fixed right-4 bottom-20 z-40 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-transform active:scale-95"
        style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
        aria-label="Quick Add"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Mobile Bottom Navigation Tabs */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t pb-safe"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        aria-label="Bottom Navigation"
      >
        <div className="grid grid-cols-6 px-1 pt-1.5">
          {NAV_ITEMS.map(({ id, mobileLabel, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 min-h-[48px] rounded-xl transition-colors ${
                  active ? 'text-teal-700 dark:text-teal-300 font-semibold' : 'text-zinc-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] leading-none">{mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
