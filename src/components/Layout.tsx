import React, { useEffect, useState } from 'react';
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
import { haptic } from '../lib/haptics';

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

  // Mobile native feel: hide fixed bottom tab bar & FAB smoothly while virtual keyboard is open
  useEffect(() => {
    const isTextInput = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'TEXTAREA') return true;
      if (tag === 'INPUT') {
        const t = (el as HTMLInputElement).type;
        return !['checkbox', 'radio', 'file', 'button', 'submit', 'range', 'color'].includes(t);
      }
      return false;
    };

    const onFocusIn = (e: FocusEvent) => {
      if (window.innerWidth < 768 && isTextInput(e.target)) {
        document.body.classList.add('keyboard-open');
      }
    };

    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!isTextInput(document.activeElement)) {
          document.body.classList.remove('keyboard-open');
        }
      }, 120);
    };

    const vv = window.visualViewport;
    const onResize = () => {
      if (window.innerWidth >= 768 || !vv) {
        document.body.classList.remove('keyboard-open');
        return;
      }
      if (vv.height < window.innerHeight * 0.78) {
        document.body.classList.add('keyboard-open');
      } else if (!isTextInput(document.activeElement)) {
        document.body.classList.remove('keyboard-open');
      }
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    vv?.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      vv?.removeEventListener('resize', onResize);
      document.body.classList.remove('keyboard-open');
    };
  }, []);

  const renderSyncBadge = () => {
    if (syncStatus.state === 'error' || syncStatus.error) {
      return (
        <button
          type="button"
          onClick={() => {
            setMoreOpen(false);
            setActiveTab('settings');
          }}
          className="inline-flex items-center gap-1.5 text-xs text-state-danger font-medium hover:underline cursor-pointer"
          title={syncStatus.error || 'Sync failed'}
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          Sync issue
        </button>
      );
    }
    if (syncStatus.state === 'synced-cloud') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-state-success font-medium">
          <Cloud className="w-3.5 h-3.5" />
          Cloud synced
        </span>
      );
    }
    if (syncStatus.state === 'synced-lan') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-state-success font-medium">
          <Wifi className="w-3.5 h-3.5" />
          Wi-Fi synced
        </span>
      );
    }
    if (syncStatus.state === 'offline') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-state-warning font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          Offline
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
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:underline cursor-pointer"
        title="Local only — connect Cloud Sync in Settings to sync PC and Android"
      >
        <HardDrive className="w-3.5 h-3.5" />
        Local device
      </button>
    );
  };

  const navigateFromMore = (tab: NavTab) => {
    setMoreOpen(false);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:text-sm focus:font-semibold"
        style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-fg)' }}
      >
        Skip to main content
      </a>

      {/* Quiet, Slim Desktop Sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:w-60 md:fixed md:inset-y-0 border-r px-4 py-6 select-none"
        style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2.5 px-2 mb-6 cursor-pointer"
        >
          <AppLogo className="w-8 h-8 rounded-[10px] shrink-0" />
          <span className="text-base font-bold tracking-tight">LifeHub</span>
        </button>

        <button type="button" onClick={onQuickAdd} className="btn-primary w-full mb-5 !min-h-[42px]">
          <Plus className="w-4 h-4" />
          New
        </button>

        <nav className="space-y-1 flex-1" aria-label="Primary">
          {DESKTOP_NAV.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={active ? 'page' : undefined}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 500,
                }}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-[18px] h-[18px]" />
                  {label}
                </span>
                {id === 'tasks' && openTasksCount > 0 && (
                  <span
                    className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: active ? 'var(--sw-wisteria)' : 'var(--bg-subtle)',
                      color: active ? '#1D1F2A' : 'var(--text-secondary)',
                    }}
                  >
                    {openTasksCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-4 border-t space-y-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <Search className="w-4 h-4" />
              Search
            </span>
            <kbd className="text-[10px] opacity-75 font-sans">⌘K</kbd>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            aria-current={activeTab === 'settings' ? 'page' : undefined}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
            style={{
              backgroundColor: activeTab === 'settings' ? 'var(--accent-soft)' : 'transparent',
              color: activeTab === 'settings' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'settings' ? 600 : 500,
            }}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>

          {account && (
            <div className="flex items-center justify-between gap-2 px-3 pt-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{account.displayName}</p>
                <div className="mt-0.5">{renderSyncBadge()}</div>
              </div>
              <button
                type="button"
                onClick={lockNow}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
                title="Sign Out / Lock"
                aria-label="Sign Out / Lock"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Ultra-Simple Mobile Top Bar */}
      <header className="app-chrome md:hidden sticky top-0 z-30 flex items-center justify-between px-4 min-h-[54px] pt-safe border-b">
        <div className="flex items-center gap-2.5">
          {activeTab === 'home' && <AppLogo className="w-7 h-7 rounded-[9px] shrink-0" />}
          <span className="font-semibold text-[17px] tracking-tight">{TAB_TITLES[activeTab]}</span>
        </div>

        <button
          type="button"
          onClick={onOpenSearch}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] cursor-pointer transition-colors"
          style={{ backgroundColor: 'var(--bg-surface)' }}
          aria-label="Search everything"
        >
          <Search className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 md:pl-60 pb-28 md:pb-12">
        <div key={activeTab} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-9 animate-page">
          {children}
        </div>
      </main>

      {/* Calm Floating Quick-Add Button on Mobile */}
      {activeTab !== 'settings' && (
        <button
          type="button"
          onClick={() => {
            haptic('tap');
            onQuickAdd();
          }}
          className="mobile-bottom-chrome md:hidden fixed right-4 bottom-[78px] z-30 w-13 h-13 rounded-2xl flex items-center justify-center transition-transform active:scale-92"
          style={{
            backgroundColor: 'var(--sw-wisteria)',
            color: '#1D1F2A',
            boxShadow: 'var(--shadow-popover)',
          }}
          aria-label="Quick Add"
        >
          <Plus className="w-6 h-6" strokeWidth={2.25} />
        </button>
      )}

      {/* Calm Matte 5-Tab Mobile Bottom Bar */}
      <nav
        className="app-chrome mobile-bottom-chrome md:hidden fixed bottom-0 inset-x-0 z-30 border-t pb-safe"
        aria-label="Bottom Navigation"
      >
        <div className="grid grid-cols-5 px-1.5 pt-1.5">
          {MOBILE_PRIMARY_TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id && !moreOpen;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  haptic('tap');
                  setMoreOpen(false);
                  setActiveTab(id);
                }}
                className="flex flex-col items-center justify-center gap-1 py-1 min-h-[50px] transition-colors cursor-pointer"
                style={{
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 500,
                }}
              >
                <span
                  className="px-3.5 py-1 rounded-full transition-colors"
                  style={{ backgroundColor: active ? 'var(--accent-soft)' : 'transparent' }}
                >
                  <Icon className="w-[19px] h-[19px]" />
                </span>
                <span className="text-[10.5px] leading-none">{label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              haptic('tap');
              setMoreOpen((o) => !o);
            }}
            className="flex flex-col items-center justify-center gap-1 py-1 min-h-[50px] transition-colors relative cursor-pointer"
            style={{
              color: moreOpen || isMoreTabActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: moreOpen || isMoreTabActive ? 600 : 500,
            }}
          >
            <span
              className="px-3.5 py-1 rounded-full transition-colors"
              style={{ backgroundColor: moreOpen || isMoreTabActive ? 'var(--accent-soft)' : 'transparent' }}
            >
              <Menu className="w-[19px] h-[19px]" />
            </span>
            <span className="text-[10.5px] leading-none">More</span>
            {(syncStatus.state === 'error' || syncStatus.error) && (
              <span
                className="w-2 h-2 rounded-full absolute top-1.5 right-4"
                style={{ backgroundColor: 'var(--state-danger)' }}
              />
            )}
          </button>
        </div>
      </nav>

      {/* Clean Mobile "More" Bottom Sheet */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-[3px]"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full rounded-t-[26px] border-t p-5 pb-safe space-y-4 animate-sheet max-h-[85dvh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--shadow-modal)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="More options"
          >
            <div className="w-9 h-1 rounded-full bg-[var(--border-strong)] mx-auto" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-full text-sm font-bold flex items-center justify-center shrink-0 uppercase"
                  style={{ backgroundColor: 'var(--sw-wisteria)', color: '#1D1F2A' }}
                >
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
                className="p-2 rounded-full text-[var(--text-muted)]"
                style={{ backgroundColor: 'var(--bg-subtle)' }}
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => navigateFromMore('email')}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl"
                style={{ backgroundColor: 'var(--bg-subtle)' }}
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <Mail className="w-4 h-4 text-state-info" />
                  Email (Gmail)
                </span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </button>

              <button
                type="button"
                onClick={() => navigateFromMore('socials')}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl"
                style={{ backgroundColor: 'var(--bg-subtle)' }}
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <Share2 className="w-4 h-4 text-state-info" />
                  Socials &amp; Links
                </span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onOpenAI();
                }}
                className="btn-tinted !justify-start !px-4"
              >
                <Sparkles className="w-4 h-4" />
                Ask AI
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onOpenReceipt();
                }}
                className="btn-secondary !justify-start !px-4"
              >
                <Camera className="w-4 h-4" />
                Scan Receipt
              </button>
            </div>

            <div className="pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => navigateFromMore('settings')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium"
              >
                <span className="flex items-center gap-3">
                  <Settings className="w-4 h-4 text-[var(--text-muted)]" />
                  Settings &amp; Sync
                </span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  lockNow();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-state-danger"
              >
                <LogOut className="w-4 h-4" />
                Sign Out / Lock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
