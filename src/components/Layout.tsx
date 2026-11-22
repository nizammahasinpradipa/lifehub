import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Pin,
  PinOff,
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

const DESKTOP_NAV: Array<{
  id: NavTab;
  label: string;
  Icon: React.FC<{ className?: string }>;
  swatch: string;
  tint: string;
}> = [
  { id: 'home', label: 'Home', Icon: Home, swatch: '#A5B2EB', tint: 'rgba(165, 178, 235, 0.18)' },
  { id: 'tasks', label: 'Tasks', Icon: CheckSquare, swatch: '#C6A8F5', tint: 'rgba(198, 168, 245, 0.18)' },
  { id: 'spending', label: 'Spending', Icon: Wallet, swatch: '#DA935D', tint: 'rgba(218, 147, 93, 0.20)' },
  { id: 'notes', label: 'Notes', Icon: FileText, swatch: '#DDDE68', tint: 'rgba(221, 222, 104, 0.20)' },
  { id: 'email', label: 'Email', Icon: Mail, swatch: '#9AD9F2', tint: 'rgba(154, 217, 242, 0.20)' },
  { id: 'socials', label: 'Socials', Icon: Share2, swatch: '#E89AA2', tint: 'rgba(232, 154, 162, 0.20)' },
];

const MOBILE_PRIMARY_TABS: Array<{
  id: NavTab;
  label: string;
  Icon: React.FC<{ className?: string }>;
  swatch: string;
}> = [
  { id: 'home', label: 'Home', Icon: Home, swatch: '#A5B2EB' },
  { id: 'tasks', label: 'Tasks', Icon: CheckSquare, swatch: '#C6A8F5' },
  { id: 'spending', label: 'Spending', Icon: Wallet, swatch: '#DA935D' },
  { id: 'notes', label: 'Notes', Icon: FileText, swatch: '#DDDE68' },
];

const SWIPE_TABS: NavTab[] = ['home', 'tasks', 'spending', 'notes'];

const TAB_TITLES: Record<NavTab, string> = {
  home: 'LifeHub',
  tasks: 'Tasks',
  spending: 'Spending',
  notes: 'Notes',
  email: 'Email',
  socials: 'Socials',
  settings: 'Settings',
};

function isInsideHorizontalScrollerOrControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('input, textarea, select, [role="dialog"], .recharts-wrapper, [data-no-swipe]')) {
    return true;
  }
  let el: HTMLElement | null = target;
  while (el && el.tagName !== 'MAIN' && el.tagName !== 'BODY') {
    const style = window.getComputedStyle(el);
    const canScrollX =
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      el.scrollWidth > el.clientWidth + 6;
    if (canScrollX) return true;
    el = el.parentElement;
  }
  return false;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  onQuickAdd,
  onOpenSearch,
  onOpenAI,
  onOpenReceipt,
}) => {
  const { activeTab, setActiveTab, syncStatus, activeTasks, account, lockNow } = useLifeHub();
  const [moreOpen, setMoreOpen] = useState(false);

  // Desktop hover-reveal sidebar state
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const sidebarOpen = sidebarHovered || sidebarPinned;

  // Mobile swipe navigation + dynamic floating dock state
  const [slideDir, setSlideDir] = useState<'none' | 'left' | 'right'>('none');
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [dockPressIndex, setDockPressIndex] = useState<number | null>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const dockRef = useRef<HTMLDivElement | null>(null);
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    axis: 'none' | 'x' | 'y';
    ignored: boolean;
  }>({ startX: 0, startY: 0, startTime: 0, axis: 'none', ignored: false });

  const openTasksCount = activeTasks.filter((t) => !t.parent_task_id && t.status === 'todo').length;
  const isMoreTabActive = activeTab === 'email' || activeTab === 'socials' || activeTab === 'settings';

  const activeNavMeta = DESKTOP_NAV.find((n) => n.id === activeTab);
  const activeSwatch = activeNavMeta?.swatch || '#9AD9F2';

  const openDesktopSidebar = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setSidebarHovered(true);
  }, []);

  const scheduleCloseDesktopSidebar = useCallback(() => {
    if (sidebarPinned) return;
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setSidebarHovered(false);
    }, 220);
  }, [sidebarPinned]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Mobile native feel: hide fixed bottom dock & FAB smoothly while virtual keyboard is open
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

  const switchTabWithDirection = useCallback(
    (nextTab: NavTab) => {
      const curIdx = SWIPE_TABS.indexOf(activeTab);
      const nextIdx = SWIPE_TABS.indexOf(nextTab);
      if (curIdx !== -1 && nextIdx !== -1 && curIdx !== nextIdx) {
        setSlideDir(nextIdx > curIdx ? 'right' : 'left');
      } else {
        setSlideDir('none');
      }
      setActiveTab(nextTab);
    },
    [activeTab, setActiveTab]
  );

  // Full-screen Android horizontal swipe gesture handlers
  const handleMainTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (window.innerWidth >= 768 || e.touches.length !== 1 || moreOpen) {
      touchStateRef.current.ignored = true;
      return;
    }
    const ignored = isInsideHorizontalScrollerOrControl(e.target);
    const t = e.touches[0];
    touchStateRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      startTime: performance.now(),
      axis: 'none',
      ignored,
    };
  };

  const handleMainTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    const st = touchStateRef.current;
    if (st.ignored || e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - st.startX;
    const dy = t.clientY - st.startY;

    if (st.axis === 'none') {
      if (Math.hypot(dx, dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.25) {
        st.axis = 'x';
        setIsSwiping(true);
      } else {
        st.axis = 'y';
        return;
      }
    }

    if (st.axis === 'x') {
      const curIdx = SWIPE_TABS.indexOf(activeTab);
      const atStart = curIdx === 0 && dx > 0;
      const atEnd = (curIdx === SWIPE_TABS.length - 1 || curIdx === -1) && dx < 0;
      const resisted = atStart || atEnd ? dx * 0.24 : dx * 0.58;
      setDragOffsetX(Math.max(-120, Math.min(120, resisted)));
    }
  };

  const handleMainTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const st = touchStateRef.current;
    if (st.ignored || st.axis !== 'x') {
      setIsSwiping(false);
      setDragOffsetX(0);
      return;
    }

    const touch = e.changedTouches[0];
    const dx = touch ? touch.clientX - st.startX : 0;
    const dt = Math.max(1, performance.now() - st.startTime);
    const velocity = Math.abs(dx) / dt;
    const triggered = Math.abs(dx) > 54 || (Math.abs(dx) > 26 && velocity > 0.36);

    setIsSwiping(false);
    setDragOffsetX(0);

    if (!triggered) return;

    const curIdx = SWIPE_TABS.indexOf(activeTab);
    if (curIdx === -1) {
      // If user is on Email/Socials/Settings, swiping right smoothly returns to Notes
      if (dx > 0) {
        haptic('tap');
        setSlideDir('left');
        setActiveTab('notes');
      }
      return;
    }

    if (dx < 0 && curIdx < SWIPE_TABS.length - 1) {
      haptic('tap');
      setSlideDir('right');
      setActiveTab(SWIPE_TABS[curIdx + 1]);
    } else if (dx > 0 && curIdx > 0) {
      haptic('tap');
      setSlideDir('left');
      setActiveTab(SWIPE_TABS[curIdx - 1]);
    }
  };

  // Interactive scrub/swipe directly on the floating mobile dock!
  const getDockSlotFromClientX = (clientX: number): number | null => {
    const rect = dockRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const rel = (clientX - rect.left) / rect.width;
    const idx = Math.floor(rel * 5);
    return Math.max(0, Math.min(4, idx));
  };

  const handleDockTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const idx = getDockSlotFromClientX(e.touches[0].clientX);
    if (idx !== null) {
      setDockPressIndex(idx);
    }
  };

  const handleDockTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const idx = getDockSlotFromClientX(e.touches[0].clientX);
    if (idx !== null && idx !== scrubIndex) {
      setScrubIndex(idx);
      setDockPressIndex(idx);
      haptic('tap');
    }
  };

  const handleDockTouchEnd = () => {
    if (scrubIndex !== null) {
      if (scrubIndex < 4) {
        const targetTab = MOBILE_PRIMARY_TABS[scrubIndex].id;
        setMoreOpen(false);
        switchTabWithDirection(targetTab);
      } else {
        setMoreOpen(true);
      }
    }
    setScrubIndex(null);
    setDockPressIndex(null);
  };

  // Compute active slot & fluid dock pill position/color
  const baseDockIndex =
    moreOpen || isMoreTabActive
      ? 4
      : Math.max(
          0,
          MOBILE_PRIMARY_TABS.findIndex((t) => t.id === activeTab)
        );

  const visualDockIndex = scrubIndex !== null ? scrubIndex : baseDockIndex;
  const swipeFraction = isSwiping ? Math.max(-0.85, Math.min(0.85, -dragOffsetX / 115)) : 0;
  const dockPillSlot = Math.max(0, Math.min(4, visualDockIndex + swipeFraction));
  const dockPillSwatch =
    visualDockIndex === 4 ? '#9AD9F2' : MOBILE_PRIMARY_TABS[visualDockIndex]?.swatch || '#A5B2EB';
  const dockStretched = isSwiping || scrubIndex !== null || dockPressIndex !== null;

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
    setSlideDir('none');
    setActiveTab(tab);
  };

  const pageAnimClass =
    slideDir === 'right'
      ? 'animate-page-right'
      : slideDir === 'left'
      ? 'animate-page-left'
      : 'animate-page';

  return (
    <div className="min-h-dvh flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:text-sm focus:font-semibold"
        style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-fg)' }}
      >
        Skip to main content
      </a>

      {/* PC Magnetic Left-Edge Hover Hotspot */}
      <div
        className="hidden md:block fixed inset-y-0 left-0 w-5 z-40"
        onMouseEnter={openDesktopSidebar}
        aria-hidden="true"
      />

      {/* PC Sleek Floating Edge Handle (visible when hover sidebar is tucked away) */}
      <button
        type="button"
        onMouseEnter={openDesktopSidebar}
        onFocus={openDesktopSidebar}
        onClick={openDesktopSidebar}
        aria-label="Open navigation menu"
        className={`hidden md:flex fixed left-3 top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-2.5 py-3 px-2 rounded-full border cursor-pointer transition-all duration-300 ${
          sidebarOpen
            ? 'opacity-0 -translate-x-4 pointer-events-none scale-90'
            : 'opacity-100 translate-x-0 scale-100 hover:scale-105'
        }`}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
          borderColor: 'var(--border-strong)',
          boxShadow: 'var(--shadow-popover)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <AppLogo className="w-6 h-6 rounded-[7px]" />
        <div className="flex flex-col items-center gap-1.5 py-0.5">
          {DESKTOP_NAV.map((item) => {
            const active = item.id === activeTab;
            return (
              <span
                key={item.id}
                className="rounded-full transition-all duration-300"
                style={{
                  width: active ? '6px' : '5px',
                  height: active ? '16px' : '5px',
                  backgroundColor: item.swatch,
                  opacity: active ? 1 : 0.45,
                }}
              />
            );
          })}
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </button>

      {/* PC Dynamic Hover-Reveal Floating Sidebar */}
      <aside
        onMouseEnter={openDesktopSidebar}
        onMouseLeave={scheduleCloseDesktopSidebar}
        onFocus={openDesktopSidebar}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            scheduleCloseDesktopSidebar();
          }
        }}
        className={`hover-sidebar hidden md:flex md:flex-col fixed left-3 top-3 bottom-3 w-[252px] z-50 rounded-[26px] border px-4 py-5 select-none ${
          sidebarOpen ? 'is-open' : ''
        }`}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 94%, transparent)',
          borderColor: 'var(--border-strong)',
          boxShadow: 'var(--shadow-modal)',
          backdropFilter: 'saturate(170%) blur(24px)',
          WebkitBackdropFilter: 'saturate(170%) blur(24px)',
        }}
        aria-label="Sidebar Navigation"
      >
        <div className="flex items-center justify-between px-1.5 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <AppLogo className="w-8 h-8 rounded-[10px] shrink-0 transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3" />
            <span className="text-base font-bold tracking-tight">LifeHub</span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarPinned((p) => !p)}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title={sidebarPinned ? 'Auto-hide sidebar on hover' : 'Pin sidebar open'}
            aria-label={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
          >
            {sidebarPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </button>
        </div>

        <button
          type="button"
          onClick={onQuickAdd}
          className="btn-primary w-full mb-4 !min-h-[42px] group"
        >
          <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" />
          New
        </button>

        <nav className="space-y-1 flex-1" aria-label="Primary">
          {DESKTOP_NAV.map(({ id, label, Icon, swatch, tint }, idx) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={active ? 'page' : undefined}
                className="hover-sidebar-item group w-full flex items-center justify-between px-2.5 py-2 rounded-2xl text-sm cursor-pointer hover:translate-x-1"
                style={{
                  transitionDelay: sidebarOpen ? `${idx * 26}ms` : '0ms',
                  backgroundColor: active ? tint : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 500,
                }}
              >
                <span className="flex items-center gap-3">
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3"
                    style={{
                      backgroundColor: active ? swatch : tint,
                      color: active ? '#1D1F2A' : 'var(--text-primary)',
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  {label}
                </span>
                {id === 'tasks' && openTasksCount > 0 && (
                  <span
                    className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: swatch,
                      color: '#1D1F2A',
                    }}
                  >
                    {openTasksCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-3.5 border-t space-y-1" style={{ borderColor: 'var(--border-subtle)' }}>
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
          {activeTab === 'home' ? (
            <AppLogo className="w-7 h-7 rounded-[9px] shrink-0" />
          ) : (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-300"
              style={{ backgroundColor: activeSwatch }}
            />
          )}
          <span className="font-semibold text-[17px] tracking-tight">{TAB_TITLES[activeTab]}</span>
        </div>

        <button
          type="button"
          onClick={onOpenSearch}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] cursor-pointer transition-transform active:scale-90"
          style={{ backgroundColor: 'var(--bg-surface)' }}
          aria-label="Search everything"
        >
          <Search className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>

      {/* Main Content Area (Swipeable Left / Right on Android/Mobile!) */}
      <main
        id="main-content"
        onTouchStart={handleMainTouchStart}
        onTouchMove={handleMainTouchMove}
        onTouchEnd={handleMainTouchEnd}
        onTouchCancel={() => {
          setIsSwiping(false);
          setDragOffsetX(0);
        }}
        className={`flex-1 overflow-x-hidden pb-32 md:pb-12 transition-[padding] duration-300 ${
          sidebarPinned ? 'md:pl-[272px]' : 'md:px-12'
        }`}
      >
        <div
          key={activeTab}
          className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-9 ${pageAnimClass}`}
          style={{
            transform: dragOffsetX !== 0 ? `translateX(${dragOffsetX}px)` : undefined,
            transition: isSwiping ? 'none' : 'transform 260ms var(--ease-calm)',
          }}
        >
          {children}
        </div>
      </main>

      {/* Dynamic Floating Quick-Add Button on Mobile */}
      {activeTab !== 'settings' && (
        <button
          type="button"
          onClick={() => {
            haptic('tap');
            onQuickAdd();
          }}
          className="mobile-bottom-chrome md:hidden fixed right-4 bottom-[92px] z-30 w-13 h-13 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90"
          style={{
            backgroundColor: activeSwatch,
            color: '#1D1F2A',
            boxShadow: 'var(--shadow-popover)',
          }}
          aria-label="Quick Add"
        >
          <Plus className="w-6 h-6" strokeWidth={2.3} />
        </button>
      )}

      {/* Dynamic Animated Floating Mobile Dock (Tap OR Swipe/Scrub!) */}
      <nav
        className="mobile-bottom-chrome md:hidden fixed bottom-0 inset-x-0 z-30 px-3 pb-safe pointer-events-none"
        aria-label="Bottom Navigation"
      >
        <div
          ref={dockRef}
          onTouchStart={handleDockTouchStart}
          onTouchMove={handleDockTouchMove}
          onTouchEnd={handleDockTouchEnd}
          onTouchCancel={() => {
            setScrubIndex(null);
            setDockPressIndex(null);
          }}
          className="floating-dock pointer-events-auto relative rounded-[26px] p-1.5 mb-2 select-none"
        >
          {/* Liquid Sliding & Color-Morphing Pastel Pill Indicator */}
          <div
            aria-hidden="true"
            className="absolute top-1.5 bottom-1.5 left-1.5 rounded-[20px] pointer-events-none"
            style={{
              width: 'calc((100% - 12px) / 5)',
              backgroundColor: dockPillSwatch,
              transform: `translateX(${dockPillSlot * 100}%) scaleX(${dockStretched ? 1.12 : 1}) scaleY(${dockStretched ? 0.92 : 1})`,
              transition: isSwiping
                ? 'background-color 220ms ease, transform 60ms linear'
                : 'transform 360ms var(--ease-dock), background-color 280ms ease',
              boxShadow: `0 6px 18px -6px ${dockPillSwatch}99`,
            }}
          />

          <div className="relative z-10 grid grid-cols-5">
            {MOBILE_PRIMARY_TABS.map(({ id, label, Icon }, idx) => {
              const active = visualDockIndex === idx;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={activeTab === id && !moreOpen ? 'page' : undefined}
                  onClick={() => {
                    haptic('tap');
                    setMoreOpen(false);
                    switchTabWithDirection(id);
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] rounded-[20px] transition-colors cursor-pointer"
                  style={{
                    color: active ? '#1D1F2A' : 'var(--text-muted)',
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  <span className={active ? 'animate-dock-pop' : 'transition-transform duration-200'}>
                    <Icon className="w-[19px] h-[19px]" />
                  </span>
                  <span className="text-[10px] leading-none tracking-tight">{label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                haptic('tap');
                setMoreOpen((o) => !o);
              }}
              className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] rounded-[20px] transition-colors relative cursor-pointer"
              style={{
                color: visualDockIndex === 4 ? '#1D1F2A' : 'var(--text-muted)',
                fontWeight: visualDockIndex === 4 ? 700 : 500,
              }}
            >
              <span className={visualDockIndex === 4 ? 'animate-dock-pop' : 'transition-transform duration-200'}>
                <Menu className="w-[19px] h-[19px]" />
              </span>
              <span className="text-[10px] leading-none tracking-tight">More</span>
              {(syncStatus.state === 'error' || syncStatus.error) && (
                <span
                  className="w-2 h-2 rounded-full absolute top-2 right-3.5"
                  style={{ backgroundColor: 'var(--state-danger)' }}
                />
              )}
            </button>
          </div>
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
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
                style={{ backgroundColor: 'var(--bg-subtle)' }}
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#9AD9F2] text-[#1D1F2A]">
                    <Mail className="w-4 h-4" />
                  </span>
                  Email (Gmail)
                </span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </button>

              <button
                type="button"
                onClick={() => navigateFromMore('socials')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
                style={{ backgroundColor: 'var(--bg-subtle)' }}
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#E89AA2] text-[#1D1F2A]">
                    <Share2 className="w-4 h-4" />
                  </span>
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
                className="bento-lavender rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-semibold"
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
                className="bento-lime rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-semibold"
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
