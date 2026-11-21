import React, { useState } from 'react';
import {
  Camera,
  CheckSquare,
  ChevronRight,
  Cloud,
  FileText,
  HardDrive,
  Home,
  LogOut,
  Mail,
  Menu,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useLifeHub } from '../store/LifeHubContext';
import type { NavTab } from '../types/models';
import { AppLogo } from './AppLogo';

interface LayoutProps {
  children: React.ReactNode;
  onQuickAdd: () => void;
  onOpenSearch: () => void;
  onOpenAI: () => void;
  onOpenReceipt: () => void;
}

const DESKTOP_NAV: Array<{ id: NavTab; label: string; Icon: React.FC<{ className?: string }> }> = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'tasks', label: 'Tasks', Icon: CheckSquare },
  { id: 'spending', label: 'Spending', Icon: Wallet },
  { id: 'notes', label: 'Notes', Icon: FileText },
  { id: 'email', label: 'Email', Icon: Mail },
  { id: 'socials', label: 'Socials', Icon: Share2 },
];

const MOBILE_PRIMARY_TABS: Array<{ id: NavTab; label: string; Icon: React.FC<{ className?: string }> }> = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'tasks', label: 'Tasks', Icon: CheckSquare },
  { id: 'spending', label: 'Spending', Icon: Wallet },
  { id: 'notes', label: 'Notes', Icon: FileText },
];

const TAB_TITLES: Record<NavTab, string> = {
  home: 'LifeHub',
  tasks: 'Tasks',
  spending: 'Spending',
  notes: 'Notes',
  email: 'Email',
  socials: 'Socials',
  settings: 'Settings',
};

export const Layout: React.FC<LayoutProps> = ({
  children,
  onQuickAdd,
  onOpenSearch,
  onOpenAI,
  onOpenReceipt,
}) => {
  const { activeTab, setActiveTab, syncStatus, activeTasks, account, lockNow } = useLifeHub();
  const [moreOpen, setMoreOpen] = useState(false);

  const openTasksCount = activeTasks.filter((t) => !t.parent_task_id && t.status === 'todo').length;
  const isMoreTabActive = activeTab === 'email' || activeTab === 'socials' || activeTab === 'settings';

  const renderSyncBadge = () => {
    if (syncStatus.state === 'error' || syncStatus.error) {
      return (
        <button
          type="button"
          onClick={() => {
            setMoreOpen(false);
            setActiveTab('settings');
          }}
          className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium hover:underline cursor-pointer"
          title={syncStatus.error || 'Sync failed'}
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          Sync error — tap to fix
        </button>
      );
    }
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
          PC &amp; Phone synced
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
      <button
        type="button"
        onClick={() => {
          setMoreOpen(false);
          setActiveTab('settings');
        }}
        className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
        title="Local only — connect Cloud Sync in Settings to sync PC and Android"
      >
        <HardDrive className="w-3.5 h-3.5" />
        Local only (not synced)
      </button>
    );
  };

  const syncDotColor =
    syncStatus.state === 'error' || syncStatus.error
      ? '#e11d48'
      : syncStatus.state === 'synced-cloud' || syncStatus.state === 'synced-lan'
      ? '#14b8a6'
      : '#f59e0b';

  const navigateFromMore = (tab: NavTab) => {
    setMoreOpen(false);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop Left Sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 border-r px-4 py-5 select-none backdrop-blur-md"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between px-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <AppLogo className="w-9 h-9 rounded-xl shadow-sm shrink-0" />
            <div className="text-left">
              <p className="text-base font-extrabold tracking-tight leading-none">LifeHub</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Personal workspace</p>
            </div>
          </button>
        </div>

        <button type="button" onClick={onQuickAdd} className="btn-primary w-full mb-3">
          <Plus className="w-4 h-4" />
          Quick Add
        </button>

        <div className="grid grid-cols-2 gap-1.5 mb-6">
          <button
            type="button"
            onClick={onOpenSearch}
            className="btn-secondary !min-h-[38px] !text-xs !px-3 justify-between"
            title="Search (Ctrl+K)"
          >
            <span className="inline-flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              Search
            </span>
            <kbd className="text-[10px] text-[var(--text-muted)] font-sans">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={onOpenAI}
            className="btn-mustard !min-h-[38px] !text-xs !px-3"
            title="AI Natural Language Input"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ask AI
          </button>
        </div>

        <nav className="space-y-1 flex-1" aria-label="Primary">
          {DESKTOP_NAV.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#233E1E] text-[#FBFBF4] dark:bg-[#C3D48E] dark:text-[#162613] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  {label}
                </span>
                {id === 'tasks' && openTasksCount > 0 && (
                  <span
                    className={`text-xs tabular-nums px-2 py-0.5 rounded-full ${
                      active
                        ? 'bg-white/20 text-current'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                    }`}
                  >
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
              className="flex items-center gap-2.5 px-3 py-2 rounded-2xl"
              style={{ backgroundColor: 'var(--bg-subtle)' }}
            >
              <div className="w-8 h-8 rounded-full bg-[#233E1E] text-[#F4C95D] text-xs font-extrabold flex items-center justify-center shrink-0 uppercase">
                {(account.displayName || account.email)[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate leading-tight">{account.displayName}</p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">{account.email}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#233E1E] text-[#FBFBF4] dark:bg-[#C3D48E] dark:text-[#162613]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings &amp; Sync
          </button>
          <button
            type="button"
            onClick={lockNow}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-full text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out / Lock
          </button>
          <div className="px-3 py-0.5">{renderSyncBadge()}</div>
        </div>
      </aside>

      {/* Clean Minimal Mobile Top Bar */}
      <header
        className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-2.5">
          {activeTab === 'home' && <AppLogo className="w-7 h-7 rounded-lg shadow-xs shrink-0" />}
          <span className="font-bold text-lg tracking-tight">{TAB_TITLES[activeTab]}</span>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: syncDotColor }}
            aria-label="Sync status"
            title={syncStatus.error || syncStatus.state}
          />
        </div>

        <button
          type="button"
          onClick={onOpenSearch}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-zinc-500 border"
          style={{ backgroundColor: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}
          aria-label="Search everything"
        >
          <Search className="w-3.5 h-3.5" />
          Search
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64 pb-28 md:pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">{children}</div>
      </main>

      {/* Single Primary Floating Quick-Add Button on Android/Mobile */}
      {activeTab !== 'settings' && (
        <button
          type="button"
          onClick={onQuickAdd}
          className="md:hidden fixed right-4 bottom-20 z-30 w-13 h-13 rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-95 text-[#FBFBF4]"
          style={{
            background: 'linear-gradient(135deg, var(--accent-grad-from) 0%, var(--accent-grad-to) 100%)',
          }}
          aria-label="Quick Add"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Clean 5-Tab Mobile Bottom Bar (Home, Tasks, Spending, Notes, More) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t pb-safe backdrop-blur-lg"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        aria-label="Bottom Navigation"
      >
        <div className="grid grid-cols-5 px-1.5 pt-1.5">
          {MOBILE_PRIMARY_TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id && !moreOpen;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  setActiveTab(id);
                }}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 min-h-[48px] rounded-2xl transition-colors ${
                  active
                    ? 'text-[#233E1E] dark:text-[#C3D48E] font-bold'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] leading-none">{label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 min-h-[48px] rounded-2xl transition-colors relative ${
              moreOpen || isMoreTabActive
                ? 'text-[#233E1E] dark:text-[#C3D48E] font-bold'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[11px] leading-none">More</span>
            {(syncStatus.state === 'error' || syncStatus.error) && (
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-4" />
            )}
          </button>
        </div>
      </nav>

      {/* Clean Android "More" Bottom Sheet Menu */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end bg-black/45 backdrop-blur-[2px]"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl border-t p-5 pb-safe space-y-4 animate-modal max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto" />

            {/* Account & Sync Strip */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-teal-600 text-white text-sm font-bold flex items-center justify-center shrink-0 uppercase">
                  {(account?.displayName || account?.email || 'O')[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{account?.displayName || 'Owner'}</p>
                  <div className="mt-0.5">{renderSyncBadge()}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-2 rounded-xl text-zinc-400"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Extra Sections */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => navigateFromMore('email')}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-colors"
                style={{ backgroundColor: 'var(--bg-subtle)' }}
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <Mail className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  Email (Gmail)
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </button>

              <button
                type="button"
                onClick={() => navigateFromMore('socials')}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-colors"
                style={{ backgroundColor: 'var(--bg-subtle)' }}
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <Share2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  Socials &amp; Project Links
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Smart Tools */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onOpenAI();
                }}
                className="btn-secondary !justify-start !px-3.5"
              >
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Ask AI
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onOpenReceipt();
                }}
                className="btn-secondary !justify-start !px-3.5"
              >
                <Camera className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Scan Receipt
              </button>
            </div>

            {/* Settings & Sign Out */}
            <div className="pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => navigateFromMore('settings')}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-medium"
              >
                <span className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-zinc-500" />
                  Settings &amp; Sync
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  lockNow();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium text-rose-600 dark:text-rose-400"
              >
                <LogOut className="w-5 h-5" />
                Sign Out / Lock App
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
