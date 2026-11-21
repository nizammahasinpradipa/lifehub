import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AutoLockMode,
  Budget,
  Category,
  CategoryKind,
  ItemLink,
  ItemType,
  LifeHubData,
  MoodRating,
  NavTab,
  Note,
  Priority,
  Project,
  Recurrence,
  RemoteAuthMeta,
  SecurityConfig,
  SocialCategory,
  SocialLink,
  SocialPlatform,
  SupabaseConfig,
  SyncStatus,
  Tag,
  Task,
  TaskStatus,
  ThemePreference,
  Transaction,
  TransactionType,
  Wallet,
  WalletType,
} from '../types/models';
import { createInitialData, createSampleData, DEFAULT_USER_ID, uid } from '../lib/defaults';
import {
  fetchLanData,
  fetchServerInfo,
  getClientId,
  getSavedSupabaseConfig,
  getSupabaseClient,
  loadBestLocalData,
  loadLocalSyncSnapshot,
  mergeLifeHubData,
  normalizeData,
  pullCloudSnapshot,
  pushCloudSnapshot,
  pushLanData,
  saveLocalData,
  saveSupabaseConfig,
} from '../lib/storage';
import {
  clearFailedAttempts,
  getLockoutStatus,
  recordFailedAttempt,
} from '../lib/security';
import {
  clearLanToken,
  clearLocalSessionUser,
  getSavedLanToken,
  getSavedLocalSessionUser,
  hasLocalAccounts,
  lanChangePassword,
  lanLogin,
  lanLogout,
  lanMe,
  lanRegister,
  localChangePassword,
  localLogin,
  localRecoverPassword,
  localRegister,
  subscribeToCloudSnapshot,
  type AccountProvider,
  type AccountUser,
} from '../lib/account';
import { clearSessionGmailToken } from '../lib/gmail';
import { addDaysToDateString, getLocalDateString, getLocalMonthString, isoToLocalDate, isoToLocalTimeInput, localDateTimeToUtcIso } from '../lib/dates';
import { findDueReminders, fireTaskReminder, requestNotificationPermission } from '../lib/reminders';

export interface ToastItem {
  id: string;
  message: string;
  tone?: 'neutral' | 'success' | 'warning';
}

export interface NavigationTarget {
  tab: NavTab;
  itemId?: string;
  itemType?: ItemType;
}

interface LifeHubContextValue {
  data: LifeHubData;
  hydrated: boolean;
  authReady: boolean;
  isUnlocked: boolean;
  account: AccountUser | null;
  availableProvider: AccountProvider;
  hasExistingAccount: boolean;
  syncStatus: SyncStatus;
  lanUrls: string[];
  toasts: ToastItem[];
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  focusTarget: NavigationTarget | null;
  navigateToItem: (type: ItemType, id: string) => void;
  clearFocusTarget: () => void;
  notify: (message: string, tone?: ToastItem['tone']) => void;
  dismissToast: (id: string) => void;

  // Unified Account System (Syncs PC + Android)
  signUpAccount: (input: {
    email: string;
    password: string;
    displayName: string;
    remember: boolean;
  }) => Promise<{ ok: boolean; error?: string; recoveryKey?: string; needsEmailConfirm?: boolean }>;
  signInAccount: (input: {
    email: string;
    password: string;
    remember: boolean;
  }) => Promise<{ ok: boolean; error?: string; cooldownMs?: number }>;
  recoverLocalAccount: (input: {
    email: string;
    recoveryKey: string;
    newPassword: string;
    remember: boolean;
  }) => Promise<{ ok: boolean; error?: string; newRecoveryKey?: string }>;
  changeAccountPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string; newRecoveryKey?: string }>;
  setAutoLockMode: (mode: AutoLockMode) => void;
  lockNow: () => void;
  signOutAccount: () => Promise<void>;

  // Derived active lists (filtered out deleted_at)
  activeProjects: Project[];
  activeTasks: Task[];
  activeWallets: Wallet[];
  activeCategories: Category[];
  activeTransactions: Transaction[];
  activeBudgets: Budget[];
  activeNotes: Note[];
  activeTags: Tag[];
  activeTagAssignments: LifeHubData['tagAssignments'];
  activeLinks: ItemLink[];
  activeSocialLinks: SocialLink[];

  // Helpers
  getWalletBalance: (walletId: string) => number;
  getTagsForItem: (type: ItemType, id: string) => Tag[];
  getLinksForItem: (type: ItemType, id: string) => Array<{ link: ItemLink; targetType: ItemType; targetId: string; label: string; subtitle: string }>;

  // Tasks CRUD
  addTask: (input: {
    title: string;
    notes?: string;
    due_at?: string | null;
    reminder_minutes_before?: number | null;
    priority?: Priority;
    project_id?: string | null;
    parent_task_id?: string | null;
    recurrence?: Recurrence;
    tagIds?: string[];
  }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTaskStatus: (id: string) => { allSubtasksDoneParentId?: string };
  deleteTask: (id: string) => void;

  // Projects CRUD
  addProject: (name: string, color: string) => Project;
  deleteProject: (id: string) => void;

  // Wallets CRUD
  addWallet: (name: string, type: WalletType, starting_balance: number) => Wallet;
  updateWallet: (id: string, patch: Partial<Wallet>) => void;
  deleteWallet: (id: string) => void;

  // Categories CRUD
  addCategory: (name: string, kind: CategoryKind, color?: string) => Category;
  deleteCategory: (id: string, reassignToCategoryId?: string) => void;

  // Transactions CRUD
  addTransaction: (input: {
    amount: number;
    type: TransactionType;
    date: string;
    wallet_id: string;
    destination_wallet_id?: string | null;
    category_id?: string | null;
    note?: string;
    merchant?: string;
    tagIds?: string[];
  }) => Transaction;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Budgets CRUD
  setBudget: (category_id: string, month: string, amount: number) => void;
  deleteBudget: (id: string) => void;

  // Notes & Journal CRUD
  addNote: (input: { title: string; body: string; tagIds?: string[] }) => Note;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  upsertJournalEntry: (dateStr: string, patch: { body?: string; mood?: MoodRating | null; mood_reason?: string }) => Note;

  // Tags & Links
  ensureTag: (name: string) => Tag;
  setItemTags: (itemType: ItemType, itemId: string, tagIds: string[]) => void;
  addLink: (fromType: ItemType, fromId: string, toType: ItemType, toId: string) => void;
  removeLink: (linkId: string) => void;

  // Social Media Links
  addSocialLink: (input: {
    platform: SocialPlatform;
    label: string;
    handle?: string;
    url: string;
    category?: SocialCategory;
    notes?: string;
    pinned?: boolean;
  }) => SocialLink;
  updateSocialLink: (id: string, patch: Partial<SocialLink>) => void;
  deleteSocialLink: (id: string) => void;
  togglePinSocialLink: (id: string) => void;

  // Preferences, Sync, Backup, Cloud
  setTheme: (theme: ThemePreference) => void;
  updateUserProfile: (patch: { display_name?: string; email?: string; timezone?: string }) => void;
  enableNotifications: () => Promise<string>;
  triggerManualSync: () => Promise<void>;
  exportFullJsonBackup: () => void;
  importFullJsonBackup: (jsonText: string) => boolean;
  loadSampleDataset: () => void;
  resetAllData: () => void;

  // Supabase cloud auth
  supabaseConfig: SupabaseConfig | null;
  saveCloudConfig: (cfg: SupabaseConfig | null) => void;
  signInCloud: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUpCloud: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOutCloud: () => Promise<void>;
}

const LifeHubContext = createContext<LifeHubContextValue | null>(null);

export const LifeHubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSnap = useMemo(() => loadLocalSyncSnapshot(), []);
  const [data, setData] = useState<LifeHubData>(initialSnap.data);
  const [hydrated, setHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [account, setAccount] = useState<AccountUser | null>(null);
  const [lanServerAvailable, setLanServerAvailable] = useState(false);
  const [lanHasAccounts, setLanHasAccounts] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [focusTarget, setFocusTarget] = useState<NavigationTarget | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | null>(() => getSavedSupabaseConfig());

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'saved',
    lastSavedAt: initialSnap.updatedAt,
    lastSyncedAt: null,
    lanConnected: false,
    cloudUserEmail: null,
    error: null,
  });

  const dataRef = useRef<LifeHubData>(data);
  dataRef.current = data;
  const lastUpdatedRef = useRef<string>(initialSnap.updatedAt || new Date().toISOString());
  const pushTimerRef = useRef<number | null>(null);
  const lanConnectedRef = useRef<boolean>(false);
  const lanTokenRef = useRef<string | null>(null);
  const accountRef = useRef<AccountUser | null>(null);
  accountRef.current = account;

  const isUnlocked = Boolean(account);
  const availableProvider: AccountProvider = supabaseConfig
    ? 'cloud'
    : lanServerAvailable
    ? 'lan'
    : 'local';
  const hasExistingAccount =
    availableProvider === 'cloud'
      ? true
      : availableProvider === 'lan'
      ? lanHasAccounts
      : hasLocalAccounts();

  const notify = useCallback((message: string, tone: ToastItem['tone'] = 'neutral') => {
    const id = uid('tst');
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Apply theme to document
  useEffect(() => {
    const pref = data.preferences.theme;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [data.preferences.theme]);

  // Persist locally + schedule LAN/Cloud push
  const persistAndSync = useCallback((nextData: LifeHubData) => {
    const now = new Date().toISOString();
    lastUpdatedRef.current = now;
    void saveLocalData(nextData, now);
    const activeAcct = accountRef.current;
    setSyncStatus((prev) => ({
      ...prev,
      state: activeAcct && (activeAcct.provider === 'cloud' || activeAcct.provider === 'lan') ? 'syncing' : 'saved',
      lastSavedAt: now,
    }));

    if (pushTimerRef.current) {
      window.clearTimeout(pushTimerRef.current);
    }

    pushTimerRef.current = window.setTimeout(async () => {
      let syncedAny = false;
      let syncMode: SyncStatus['state'] = 'saved';
      let syncError: string | null = null;
      const acct = accountRef.current;

      if (acct?.provider === 'lan' && lanTokenRef.current) {
        const ok = await pushLanData(dataRef.current, lastUpdatedRef.current, lanTokenRef.current);
        if (ok) {
          syncedAny = true;
          syncMode = 'synced-lan';
        }
      }

      if (acct?.provider === 'cloud') {
        const client = getSupabaseClient();
        if (client) {
          const res = await pushCloudSnapshot(client, acct.id, dataRef.current, lastUpdatedRef.current);
          if (res.ok) {
            syncedAny = true;
            syncMode = 'synced-cloud';
          } else {
            syncError = res.error || 'Cloud sync failed';
          }
        }
      }

      setSyncStatus((prev) => ({
        ...prev,
        state: syncedAny ? syncMode : navigator.onLine ? 'saved' : 'offline',
        lastSyncedAt: syncedAny ? new Date().toISOString() : prev.lastSyncedAt,
        error: syncError,
      }));
    }, 350);
  }, []);

  const commit = useCallback(
    (updater: (prev: LifeHubData) => LifeHubData) => {
      setData((prev) => {
        const next = updater(prev);
        dataRef.current = next;
        persistAndSync(next);
        return next;
      });
    },
    [persistAndSync]
  );

  // Pull & merge from LAN and Cloud for the currently signed-in account
  const pullRemoteAndMerge = useCallback(async (overrideAccount?: AccountUser | null) => {
    const acct = overrideAccount ?? accountRef.current;
    if (!acct) return;

    let merged = dataRef.current;
    let changed = false;
    let mode: SyncStatus['state'] = 'saved';

    // 1. LAN Account Server Sync
    if (acct.provider === 'lan' && lanTokenRef.current) {
      const lan = await fetchLanData(lanTokenRef.current);
      if (lan.ok) {
        lanConnectedRef.current = true;
        mode = 'synced-lan';
        if (lan.data) {
          merged = mergeLifeHubData(merged, lan.data);
          changed = true;
        } else {
          await pushLanData(merged, lastUpdatedRef.current, lanTokenRef.current);
        }
      }
    }

    // 2. Supabase Cloud Account Sync
    if (acct.provider === 'cloud') {
      const client = getSupabaseClient();
      if (client) {
        const cloud = await pullCloudSnapshot(client, acct.id);
        mode = 'synced-cloud';
        if (cloud.data) {
          merged = mergeLifeHubData(merged, cloud.data);
          changed = true;
        } else {
          await pushCloudSnapshot(client, acct.id, merged, lastUpdatedRef.current);
        }
      }
    }

    if (changed) {
      const now = new Date().toISOString();
      dataRef.current = merged;
      setData(merged);
      await saveLocalData(merged, now);
      if (acct.provider === 'lan' && lanTokenRef.current) {
        await pushLanData(merged, now, lanTokenRef.current);
      } else if (acct.provider === 'cloud') {
        const client = getSupabaseClient();
        if (client) await pushCloudSnapshot(client, acct.id, merged, now);
      }
    }

    setSyncStatus((prev) => ({
      ...prev,
      lanConnected: acct.provider === 'lan' && lanConnectedRef.current,
      cloudUserEmail: acct.provider === 'cloud' ? acct.email : null,
      state: acct.provider === 'cloud' || acct.provider === 'lan' ? mode : 'saved',
      lastSyncedAt: acct.provider === 'cloud' || acct.provider === 'lan' ? new Date().toISOString() : prev.lastSyncedAt,
    }));
  }, []);

  // Initial hydration: IndexedDB -> Check Active Account Session -> Sync
  useEffect(() => {
    let active = true;
    (async () => {
      const best = await loadBestLocalData();
      if (!active) return;
      dataRef.current = best.data;
      setData(best.data);
      if (best.updatedAt) lastUpdatedRef.current = best.updatedAt;

      const info = await fetchServerInfo();
      if (!active) return;
      if (info.ok) {
        lanConnectedRef.current = true;
        setLanServerAvailable(true);
        setLanHasAccounts(info.hasAccounts);
        setLanUrls(info.lanUrls);
      }

      let restoredAccount: AccountUser | null = null;

      // 1. Check Supabase Cloud Account session first if configured
      const client = getSupabaseClient();
      if (client) {
        const ephemeral = localStorage.getItem('lifehub_cloud_ephemeral') === '1';
        const hasSessionMarker = sessionStorage.getItem('lifehub_cloud_session_active') === '1';
        if (ephemeral && !hasSessionMarker) {
          // User chose NOT to stay signed in across browser closes
          await client.auth.signOut().catch(() => {});
        } else {
          const { data: sessionData } = await client.auth.getSession();
          const u = sessionData?.session?.user;
          if (u) {
            restoredAccount = {
              id: u.id,
              email: u.email || '',
              displayName: (u.user_metadata?.display_name as string) || best.data.user.display_name || (u.email || 'Owner').split('@')[0],
              provider: 'cloud',
            };
          }
        }
      }

      // 2. Check LAN Account Server session
      if (!restoredAccount && info.ok) {
        const token = getSavedLanToken();
        if (token) {
          const lanUser = await lanMe(token);
          if (lanUser) {
            lanTokenRef.current = token;
            restoredAccount = lanUser;
          } else {
            clearLanToken();
          }
        }
      }

      // 3. Check Local Device Account session
      if (!restoredAccount && !client && !info.ok) {
        restoredAccount = getSavedLocalSessionUser();
      }

      if (active && restoredAccount) {
        accountRef.current = restoredAccount;
        setAccount(restoredAccount);
        await pullRemoteAndMerge(restoredAccount);
      }

      if (active) {
        setAuthReady(true);
        setHydrated(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [pullRemoteAndMerge]);

  // Real-time sync listeners: Supabase Realtime (cloud) OR SSE (LAN) + visibility/online refresh
  useEffect(() => {
    if (!hydrated || !account) return;

    let cleanupRealtime: (() => void) | null = null;
    let es: EventSource | null = null;

    if (account.provider === 'cloud') {
      const client = getSupabaseClient();
      if (client) {
        cleanupRealtime = subscribeToCloudSnapshot(client, account.id, () => {
          void pullRemoteAndMerge(account);
        });
      }
    } else if (account.provider === 'lan' && lanTokenRef.current) {
      try {
        es = new EventSource(`/api/events?token=${encodeURIComponent(lanTokenRef.current)}`);
        es.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === 'sync' && msg.clientId !== getClientId()) {
              void pullRemoteAndMerge(account);
            }
          } catch {
            // ignore
          }
        };
      } catch {
        // SSE optional
      }
    }

    const onVisibleOrOnline = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void pullRemoteAndMerge(account);
      }
    };
    document.addEventListener('visibilitychange', onVisibleOrOnline);
    window.addEventListener('online', onVisibleOrOnline);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && (account.provider === 'lan' || account.provider === 'cloud')) {
        void pullRemoteAndMerge(account);
      }
    }, 10_000);

    return () => {
      if (cleanupRealtime) cleanupRealtime();
      if (es) es.close();
      document.removeEventListener('visibilitychange', onVisibleOrOnline);
      window.removeEventListener('online', onVisibleOrOnline);
      window.clearInterval(interval);
    };
  }, [hydrated, account, pullRemoteAndMerge]);

  // Sign Out / Lock Account
  const signOutAccount = useCallback(async () => {
    const current = accountRef.current;
    clearSessionGmailToken();
    if (current?.provider === 'lan') {
      await lanLogout(lanTokenRef.current);
      lanTokenRef.current = null;
    } else if (current?.provider === 'cloud') {
      const client = getSupabaseClient();
      if (client) await client.auth.signOut().catch(() => {});
      sessionStorage.removeItem('lifehub_cloud_session_active');
      localStorage.removeItem('lifehub_cloud_ephemeral');
    } else {
      clearLocalSessionUser();
    }
    accountRef.current = null;
    setAccount(null);
    setSyncStatus((prev) => ({ ...prev, cloudUserEmail: null, state: 'saved' }));
  }, []);

  const lockNow = useCallback(() => {
    void signOutAccount();
  }, [signOutAccount]);

  useEffect(() => {
    if (!isUnlocked) return;
    const mode = data.security?.auto_lock || 'on-close';
    if (mode === 'on-close') return;
    const minutes = mode === '5m' ? 5 : mode === '15m' ? 15 : 30;
    const ms = minutes * 60_000;

    let timer = window.setTimeout(() => {
      lockNow();
    }, ms);

    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        lockNow();
      }, ms);
    };

    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [isUnlocked, data.security?.auto_lock, lockNow]);

  // Flush save before page hide / close so edits are never lost
  useEffect(() => {
    const flush = () => {
      if (!isUnlocked) return;
      void saveLocalData(dataRef.current, lastUpdatedRef.current);
      if (accountRef.current?.provider === 'lan' && lanTokenRef.current) {
        void fetch('/api/sync', {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lanTokenRef.current}`,
          },
          body: JSON.stringify({
            data: dataRef.current,
            updatedAt: lastUpdatedRef.current,
            clientId: getClientId(),
          }),
        }).catch(() => {});
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isUnlocked]);

  // Reminder polling every 30s (PRD: fire within 1 minute of set time)
  useEffect(() => {
    const check = () => {
      const due = findDueReminders(dataRef.current.tasks);
      if (due.length === 0) return;
      const now = new Date().toISOString();
      due.forEach((task) => {
        fireTaskReminder(task);
        notify(`Reminder: ${task.title}`, 'warning');
      });
      const dueIds = new Set(due.map((d) => d.id));
      commit((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          dueIds.has(t.id) ? { ...t, reminder_fired_at: now, updated_at: now } : t
        ),
      }));
    };
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, [commit, notify]);

  // Derived active lists
  const activeProjects = useMemo(() => data.projects.filter((p) => !p.deleted_at), [data.projects]);
  const activeTasks = useMemo(() => data.tasks.filter((t) => !t.deleted_at), [data.tasks]);
  const activeWallets = useMemo(() => data.wallets.filter((w) => !w.deleted_at), [data.wallets]);
  const activeCategories = useMemo(() => data.categories.filter((c) => !c.deleted_at), [data.categories]);
  const activeTransactions = useMemo(() => data.transactions.filter((t) => !t.deleted_at), [data.transactions]);
  const activeBudgets = useMemo(() => data.budgets.filter((b) => !b.deleted_at), [data.budgets]);
  const activeNotes = useMemo(() => data.notes.filter((n) => !n.deleted_at), [data.notes]);
  const activeTags = useMemo(() => data.tags.filter((t) => !t.deleted_at), [data.tags]);
  const activeTagAssignments = useMemo(() => data.tagAssignments.filter((ta) => !ta.deleted_at), [data.tagAssignments]);
  const activeLinks = useMemo(() => data.links.filter((l) => !l.deleted_at), [data.links]);
  const activeSocialLinks = useMemo(
    () =>
      (data.socialLinks || [])
        .filter((s) => !s.deleted_at)
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.label.localeCompare(b.label)),
    [data.socialLinks]
  );

  const getWalletBalance = useCallback(
    (walletId: string): number => {
      const wallet = activeWallets.find((w) => w.id === walletId);
      if (!wallet) return 0;
      let balance = wallet.starting_balance;
      for (const tx of activeTransactions) {
        if (tx.type === 'income' && tx.wallet_id === walletId) {
          balance += tx.amount;
        } else if (tx.type === 'expense' && tx.wallet_id === walletId) {
          balance -= tx.amount;
        } else if (tx.type === 'transfer') {
          if (tx.wallet_id === walletId) balance -= tx.amount;
          if (tx.destination_wallet_id === walletId) balance += tx.amount;
        }
      }
      return balance;
    },
    [activeWallets, activeTransactions]
  );

  const getTagsForItem = useCallback(
    (type: ItemType, id: string): Tag[] => {
      const ids = new Set(
        activeTagAssignments
          .filter((ta) => ta.item_type === type && ta.item_id === id)
          .map((ta) => ta.tag_id)
      );
      return activeTags.filter((t) => ids.has(t.id));
    },
    [activeTagAssignments, activeTags]
  );

  const getLinksForItem = useCallback(
    (type: ItemType, id: string) => {
      const result: Array<{ link: ItemLink; targetType: ItemType; targetId: string; label: string; subtitle: string }> = [];
      for (const link of activeLinks) {
        let targetType: ItemType | null = null;
        let targetId: string | null = null;
        if (link.from_type === type && link.from_id === id) {
          targetType = link.to_type;
          targetId = link.to_id;
        } else if (link.to_type === type && link.to_id === id) {
          targetType = link.from_type;
          targetId = link.from_id;
        }
        if (!targetType || !targetId) continue;

        if (targetType === 'task') {
          const t = activeTasks.find((x) => x.id === targetId);
          if (t) result.push({ link, targetType, targetId, label: t.title, subtitle: t.status === 'done' ? 'Completed task' : 'Task' });
        } else if (targetType === 'transaction') {
          const tx = activeTransactions.find((x) => x.id === targetId);
          if (tx) result.push({ link, targetType, targetId, label: tx.merchant || tx.note || 'Transaction', subtitle: `${tx.date} · Rp ${tx.amount.toLocaleString('id-ID')}` });
        } else if (targetType === 'note') {
          const n = activeNotes.find((x) => x.id === targetId);
          if (n) result.push({ link, targetType, targetId, label: n.type === 'journal' ? `Journal · ${n.journal_date}` : n.title || 'Untitled note', subtitle: n.type === 'journal' ? 'Journal' : 'Note' });
        }
      }
      return result;
    },
    [activeLinks, activeTasks, activeTransactions, activeNotes]
  );

  const navigateToItem = useCallback((type: ItemType, id: string) => {
    const tab: NavTab = type === 'task' ? 'tasks' : type === 'transaction' ? 'spending' : 'notes';
    setActiveTab(tab);
    setFocusTarget({ tab, itemId: id, itemType: type });
  }, []);

  const clearFocusTarget = useCallback(() => setFocusTarget(null), []);

  // ======================== TASKS ========================
  const addTask: LifeHubContextValue['addTask'] = useCallback(
    (input) => {
      const now = new Date().toISOString();
      const task: Task = {
        id: uid('tsk'),
        user_id: dataRef.current.user.id || DEFAULT_USER_ID,
        title: input.title.trim(),
        notes: input.notes?.trim() || '',
        due_at: input.due_at ?? null,
        reminder_minutes_before: input.reminder_minutes_before ?? null,
        reminder_fired_at: null,
        priority: input.priority || 'medium',
        status: 'todo',
        completed_at: null,
        parent_task_id: input.parent_task_id ?? null,
        project_id: input.project_id ?? null,
        recurrence: input.recurrence || 'none',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };

      const newAssignments = (input.tagIds || []).map((tagId) => ({
        id: uid('ta'),
        user_id: task.user_id,
        tag_id: tagId,
        item_type: 'task' as const,
        item_id: task.id,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }));

      commit((prev) => ({
        ...prev,
        tasks: [task, ...prev.tasks],
        tagAssignments: [...prev.tagAssignments, ...newAssignments],
      }));
      return task;
    },
    [commit]
  );

  const updateTask: LifeHubContextValue['updateTask'] = useCallback(
    (id, patch) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch, updated_at: now } : t)),
      }));
    },
    [commit]
  );

  const toggleTaskStatus: LifeHubContextValue['toggleTaskStatus'] = useCallback(
    (id) => {
      const now = new Date().toISOString();
      const target = dataRef.current.tasks.find((t) => t.id === id && !t.deleted_at);
      if (!target) return {};

      const nextStatus: TaskStatus = target.status === 'done' ? 'todo' : 'done';
      let allSubtasksDoneParentId: string | undefined;

      // Check PRD rule: completing last subtask does NOT auto-complete parent; ask first!
      if (nextStatus === 'done' && target.parent_task_id) {
        const parent = dataRef.current.tasks.find((t) => t.id === target.parent_task_id && !t.deleted_at);
        if (parent && parent.status === 'todo') {
          const siblings = dataRef.current.tasks.filter(
            (t) => !t.deleted_at && t.parent_task_id === target.parent_task_id
          );
          const allWillBeDone = siblings.every((s) => (s.id === id ? true : s.status === 'done'));
          if (allWillBeDone) {
            allSubtasksDoneParentId = parent.id;
          }
        }
      }

      // Check recurrence: create next instance when completing a recurring parent task
      let nextRecurringTask: Task | null = null;
      if (nextStatus === 'done' && !target.parent_task_id && target.recurrence !== 'none') {
        const baseDate = isoToLocalDate(target.due_at) || getLocalDateString();
        const timeStr = isoToLocalTimeInput(target.due_at);
        let nextDate = baseDate;
        if (target.recurrence === 'daily') nextDate = addDaysToDateString(baseDate, 1);
        if (target.recurrence === 'weekly') nextDate = addDaysToDateString(baseDate, 7);
        if (target.recurrence === 'monthly') {
          const [y, m, d] = baseDate.split('-').map(Number);
          const dt = new Date(Date.UTC(y, m, Math.min(d, 28)));
          nextDate = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
        }
        nextRecurringTask = {
          ...target,
          id: uid('tsk'),
          status: 'todo',
          completed_at: null,
          reminder_fired_at: null,
          due_at: localDateTimeToUtcIso(nextDate, timeStr || undefined),
          created_at: now,
          updated_at: now,
        };
      }

      commit((prev) => ({
        ...prev,
        tasks: [
          ...(nextRecurringTask ? [nextRecurringTask] : []),
          ...prev.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: nextStatus,
                  completed_at: nextStatus === 'done' ? now : null,
                  updated_at: now,
                }
              : t
          ),
        ],
      }));

      if (nextRecurringTask) {
        notify(`Scheduled next ${target.recurrence} task`, 'success');
      }

      return { allSubtasksDoneParentId };
    },
    [commit, notify]
  );

  const deleteTask: LifeHubContextValue['deleteTask'] = useCallback(
    (id) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === id || t.parent_task_id === id ? { ...t, deleted_at: now, updated_at: now } : t
        ),
        // PRD: Deleting an item removes its links, never the other item
        links: prev.links.map((l) =>
          (l.from_type === 'task' && l.from_id === id) || (l.to_type === 'task' && l.to_id === id)
            ? { ...l, deleted_at: now, updated_at: now }
            : l
        ),
        tagAssignments: prev.tagAssignments.map((ta) =>
          ta.item_type === 'task' && ta.item_id === id ? { ...ta, deleted_at: now, updated_at: now } : ta
        ),
      }));
    },
    [commit]
  );

  // ======================== PROJECTS ========================
  const addProject: LifeHubContextValue['addProject'] = useCallback(
    (name, color) => {
      const now = new Date().toISOString();
      const project: Project = {
        id: uid('prj'),
        user_id: dataRef.current.user.id || DEFAULT_USER_ID,
        name: name.trim(),
        color,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      commit((prev) => ({ ...prev, projects: [...prev.projects, project] }));
      return project;
    },
    [commit]
  );

  const deleteProject: LifeHubContextValue['deleteProject'] = useCallback(
    (id) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === id ? { ...p, deleted_at: now, updated_at: now } : p)),
        tasks: prev.tasks.map((t) => (t.project_id === id ? { ...t, project_id: null, updated_at: now } : t)),
      }));
    },
    [commit]
  );

  // ======================== WALLETS ========================
  const addWallet: LifeHubContextValue['addWallet'] = useCallback(
    (name, type, starting_balance) => {
      const now = new Date().toISOString();
      const wallet: Wallet = {
        id: uid('wal'),
        user_id: dataRef.current.user.id || DEFAULT_USER_ID,
        name: name.trim(),
        type,
        starting_balance: Math.round(starting_balance || 0),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      commit((prev) => ({ ...prev, wallets: [...prev.wallets, wallet] }));
      return wallet;
    },
    [commit]
  );

  const updateWallet: LifeHubContextValue['updateWallet'] = useCallback(
    (id, patch) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        wallets: prev.wallets.map((w) => (w.id === id ? { ...w, ...patch, updated_at: now } : w)),
      }));
    },
    [commit]
  );

  const deleteWallet: LifeHubContextValue['deleteWallet'] = useCallback(
    (id) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        wallets: prev.wallets.map((w) => (w.id === id ? { ...w, deleted_at: now, updated_at: now } : w)),
      }));
    },
    [commit]
  );

  // ======================== CATEGORIES ========================
  const addCategory: LifeHubContextValue['addCategory'] = useCallback(
    (name, kind, color = '#0F766E') => {
      const now = new Date().toISOString();
      const category: Category = {
        id: uid('cat'),
        user_id: dataRef.current.user.id || DEFAULT_USER_ID,
        name: name.trim(),
        kind,
        icon: 'tag',
        color,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      commit((prev) => ({ ...prev, categories: [...prev.categories, category] }));
      return category;
    },
    [commit]
  );

  const deleteCategory: LifeHubContextValue['deleteCategory'] = useCallback(
    (id, reassignToCategoryId) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        categories: prev.categories.map((c) => (c.id === id ? { ...c, deleted_at: now, updated_at: now } : c)),
        transactions: reassignToCategoryId
          ? prev.transactions.map((tx) =>
              tx.category_id === id && !tx.deleted_at
                ? { ...tx, category_id: reassignToCategoryId, updated_at: now }
                : tx
            )
          : prev.transactions,
        budgets: prev.budgets.map((b) => (b.category_id === id ? { ...b, deleted_at: now, updated_at: now } : b)),
      }));
    },
    [commit]
  );

  // ======================== TRANSACTIONS ========================
  const addTransaction: LifeHubContextValue['addTransaction'] = useCallback(
    (input) => {
      const now = new Date().toISOString();
      const tx: Transaction = {
        id: uid('tx'),
        user_id: dataRef.current.user.id || DEFAULT_USER_ID,
        amount: Math.max(0, Math.round(input.amount)),
        type: input.type,
        date: input.date || getLocalDateString(),
        wallet_id: input.wallet_id,
        destination_wallet_id: input.type === 'transfer' ? input.destination_wallet_id || null : null,
        category_id: input.type === 'transfer' ? null : input.category_id || null,
        note: input.note?.trim() || '',
        merchant: input.merchant?.trim() || '',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };

      const newAssignments = (input.tagIds || []).map((tagId) => ({
        id: uid('ta'),
        user_id: tx.user_id,
        tag_id: tagId,
        item_type: 'transaction' as const,
        item_id: tx.id,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }));

      // Check budget threshold alerts (80% & 100%)
      if (tx.type === 'expense' && tx.category_id) {
        const month = tx.date.slice(0, 7);
        const budget = dataRef.current.budgets.find(
          (b) => !b.deleted_at && b.category_id === tx.category_id && b.month === month
        );
        if (budget && budget.amount > 0) {
          const prevSpent = dataRef.current.transactions
            .filter((t) => !t.deleted_at && t.type === 'expense' && t.category_id === tx.category_id && t.date.startsWith(month))
            .reduce((s, t) => s + t.amount, 0);
          const nextSpent = prevSpent + tx.amount;
          const catName = dataRef.current.categories.find((c) => c.id === tx.category_id)?.name || 'Category';
          if (prevSpent < budget.amount && nextSpent >= budget.amount) {
            notify(`${catName} budget reached 100% for ${month}`, 'warning');
          } else if (prevSpent < budget.amount * 0.8 && nextSpent >= budget.amount * 0.8) {
            notify(`${catName} budget passed 80% for ${month}`, 'warning');
          }
        }
      }

      commit((prev) => ({
        ...prev,
        transactions: [tx, ...prev.transactions],
        tagAssignments: [...prev.tagAssignments, ...newAssignments],
        preferences: {
          ...prev.preferences,
          default_wallet_id: tx.wallet_id,
          default_category_id: tx.type === 'expense' && tx.category_id ? tx.category_id : prev.preferences.default_category_id,
        },
      }));
      return tx;
    },
    [commit, notify]
  );

  const updateTransaction: LifeHubContextValue['updateTransaction'] = useCallback(
    (id, patch) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                amount: patch.amount !== undefined ? Math.max(0, Math.round(patch.amount)) : t.amount,
                updated_at: now,
              }
            : t
        ),
      }));
    },
    [commit]
  );

  const deleteTransaction: LifeHubContextValue['deleteTransaction'] = useCallback(
    (id) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => (t.id === id ? { ...t, deleted_at: now, updated_at: now } : t)),
        links: prev.links.map((l) =>
          (l.from_type === 'transaction' && l.from_id === id) || (l.to_type === 'transaction' && l.to_id === id)
            ? { ...l, deleted_at: now, updated_at: now }
            : l
        ),
        tagAssignments: prev.tagAssignments.map((ta) =>
          ta.item_type === 'transaction' && ta.item_id === id ? { ...ta, deleted_at: now, updated_at: now } : ta
        ),
      }));
    },
    [commit]
  );

  // ======================== BUDGETS ========================
  const setBudget: LifeHubContextValue['setBudget'] = useCallback(
    (category_id, month, amount) => {
      const now = new Date().toISOString();
      const cleanAmount = Math.max(0, Math.round(amount));
      commit((prev) => {
        const existing = prev.budgets.find(
          (b) => !b.deleted_at && b.category_id === category_id && b.month === month
        );
        if (existing) {
          return {
            ...prev,
            budgets: prev.budgets.map((b) =>
              b.id === existing.id ? { ...b, amount: cleanAmount, updated_at: now } : b
            ),
          };
        }
        const created: Budget = {
          id: uid('bdg'),
          user_id: prev.user.id || DEFAULT_USER_ID,
          category_id,
          month: month || getLocalMonthString(),
          amount: cleanAmount,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        };
        return { ...prev, budgets: [...prev.budgets, created] };
      });
    },
    [commit]
  );

  const deleteBudget: LifeHubContextValue['deleteBudget'] = useCallback(
    (id) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        budgets: prev.budgets.map((b) => (b.id === id ? { ...b, deleted_at: now, updated_at: now } : b)),
      }));
    },
    [commit]
  );

  // ======================== NOTES & JOURNAL ========================
  const addNote: LifeHubContextValue['addNote'] = useCallback(
    (input) => {
      const now = new Date().toISOString();
      const note: Note = {
        id: uid('nte'),
        user_id: dataRef.current.user.id || DEFAULT_USER_ID,
        type: 'note',
        title: input.title.trim(),
        body: input.body,
        journal_date: null,
        mood: null,
        mood_reason: '',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      const newAssignments = (input.tagIds || []).map((tagId) => ({
        id: uid('ta'),
        user_id: note.user_id,
        tag_id: tagId,
        item_type: 'note' as const,
        item_id: note.id,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }));
      commit((prev) => ({
        ...prev,
        notes: [note, ...prev.notes],
        tagAssignments: [...prev.tagAssignments, ...newAssignments],
      }));
      return note;
    },
    [commit]
  );

  const updateNote: LifeHubContextValue['updateNote'] = useCallback(
    (id, patch) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === id ? { ...n, ...patch, updated_at: now } : n)),
      }));
    },
    [commit]
  );

  const deleteNote: LifeHubContextValue['deleteNote'] = useCallback(
    (id) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === id ? { ...n, deleted_at: now, updated_at: now } : n)),
        links: prev.links.map((l) =>
          (l.from_type === 'note' && l.from_id === id) || (l.to_type === 'note' && l.to_id === id)
            ? { ...l, deleted_at: now, updated_at: now }
            : l
        ),
        tagAssignments: prev.tagAssignments.map((ta) =>
          ta.item_type === 'note' && ta.item_id === id ? { ...ta, deleted_at: now, updated_at: now } : ta
        ),
      }));
    },
    [commit]
  );

  const upsertJournalEntry: LifeHubContextValue['upsertJournalEntry'] = useCallback(
    (dateStr, patch) => {
      const now = new Date().toISOString();
      const existing = dataRef.current.notes.find(
        (n) => !n.deleted_at && n.type === 'journal' && n.journal_date === dateStr
      );

      if (existing) {
        const updated: Note = {
          ...existing,
          body: patch.body !== undefined ? patch.body : existing.body,
          mood: patch.mood !== undefined ? patch.mood : existing.mood,
          mood_reason: patch.mood_reason !== undefined ? patch.mood_reason : existing.mood_reason,
          updated_at: now,
        };
        commit((prev) => ({
          ...prev,
          notes: prev.notes.map((n) => (n.id === existing.id ? updated : n)),
        }));
        return updated;
      }

      const created: Note = {
        id: uid('jrn'),
        user_id: dataRef.current.user.id || DEFAULT_USER_ID,
        type: 'journal',
        title: '',
        body: patch.body ?? '',
        journal_date: dateStr,
        mood: patch.mood ?? null,
        mood_reason: patch.mood_reason ?? '',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      commit((prev) => ({ ...prev, notes: [created, ...prev.notes] }));
      return created;
    },
    [commit]
  );

  // ======================== TAGS & LINKS ========================
  const ensureTag: LifeHubContextValue['ensureTag'] = useCallback(
    (rawName) => {
      const clean = rawName.trim().toLowerCase().replace(/^#/, '');
      const existing = dataRef.current.tags.find((t) => !t.deleted_at && t.name.toLowerCase() === clean);
      if (existing) return existing;

      const now = new Date().toISOString();
      const tag: Tag = {
        id: uid('tag'),
        user_id: dataRef.current.user.id || DEFAULT_USER_ID,
        name: clean,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      commit((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
      return tag;
    },
    [commit]
  );

  const setItemTags: LifeHubContextValue['setItemTags'] = useCallback(
    (itemType, itemId, tagIds) => {
      const now = new Date().toISOString();
      const targetSet = new Set(tagIds);
      commit((prev) => {
        const updatedExisting = prev.tagAssignments.map((ta) => {
          if (ta.item_type === itemType && ta.item_id === itemId && !ta.deleted_at) {
            if (!targetSet.has(ta.tag_id)) {
              return { ...ta, deleted_at: now, updated_at: now };
            }
          }
          return ta;
        });

        const existingActiveIds = new Set(
          updatedExisting
            .filter((ta) => ta.item_type === itemType && ta.item_id === itemId && !ta.deleted_at)
            .map((ta) => ta.tag_id)
        );

        const additions = tagIds
          .filter((tid) => !existingActiveIds.has(tid))
          .map((tid) => ({
            id: uid('ta'),
            user_id: prev.user.id || DEFAULT_USER_ID,
            tag_id: tid,
            item_type: itemType,
            item_id: itemId,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          }));

        return { ...prev, tagAssignments: [...updatedExisting, ...additions] };
      });
    },
    [commit]
  );

  const addLink: LifeHubContextValue['addLink'] = useCallback(
    (fromType, fromId, toType, toId) => {
      if (fromType === toType && fromId === toId) return;
      const already = dataRef.current.links.some(
        (l) =>
          !l.deleted_at &&
          ((l.from_type === fromType && l.from_id === fromId && l.to_type === toType && l.to_id === toId) ||
            (l.from_type === toType && l.from_id === toId && l.to_type === fromType && l.to_id === fromId))
      );
      if (already) return;
      const now = new Date().toISOString();
      const link: ItemLink = {
        id: uid('lnk'),
        user_id: dataRef.current.user.id || DEFAULT_USER_ID,
        from_type: fromType,
        from_id: fromId,
        to_type: toType,
        to_id: toId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      commit((prev) => ({ ...prev, links: [...prev.links, link] }));
      notify('Linked items', 'success');
    },
    [commit, notify]
  );

  const removeLink: LifeHubContextValue['removeLink'] = useCallback(
    (linkId) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        links: prev.links.map((l) => (l.id === linkId ? { ...l, deleted_at: now, updated_at: now } : l)),
      }));
    },
    [commit]
  );

  // ======================== SOCIAL MEDIA LINKS ========================
  const addSocialLink: LifeHubContextValue['addSocialLink'] = useCallback(
    (input) => {
      const now = new Date().toISOString();
      let cleanUrl = input.url.trim();
      if (cleanUrl && input.platform === 'email' && !cleanUrl.startsWith('mailto:') && cleanUrl.includes('@')) {
        cleanUrl = `mailto:${cleanUrl}`;
      } else if (cleanUrl && !/^(https?:\/\/|mailto:|tel:)/i.test(cleanUrl)) {
        cleanUrl = `https://${cleanUrl}`;
      }

      const item: SocialLink = {
        id: uid('soc'),
        user_id: dataRef.current.user.id || DEFAULT_USER_ID,
        platform: input.platform,
        label: input.label.trim(),
        handle: input.handle?.trim() || '',
        url: cleanUrl,
        category: input.category || 'social',
        notes: input.notes?.trim() || '',
        pinned: Boolean(input.pinned),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      commit((prev) => ({
        ...prev,
        socialLinks: [item, ...(prev.socialLinks || [])],
      }));
      return item;
    },
    [commit]
  );

  const updateSocialLink: LifeHubContextValue['updateSocialLink'] = useCallback(
    (id, patch) => {
      const now = new Date().toISOString();
      const nextPatch = { ...patch };
      if (typeof nextPatch.url === 'string') {
        let cleanUrl = nextPatch.url.trim();
        if (cleanUrl && nextPatch.platform === 'email' && !cleanUrl.startsWith('mailto:') && cleanUrl.includes('@')) {
          cleanUrl = `mailto:${cleanUrl}`;
        } else if (cleanUrl && !/^(https?:\/\/|mailto:|tel:)/i.test(cleanUrl)) {
          cleanUrl = `https://${cleanUrl}`;
        }
        nextPatch.url = cleanUrl;
      }
      commit((prev) => ({
        ...prev,
        socialLinks: (prev.socialLinks || []).map((s) =>
          s.id === id ? { ...s, ...nextPatch, updated_at: now } : s
        ),
      }));
    },
    [commit]
  );

  const deleteSocialLink: LifeHubContextValue['deleteSocialLink'] = useCallback(
    (id) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        socialLinks: (prev.socialLinks || []).map((s) =>
          s.id === id ? { ...s, deleted_at: now, updated_at: now } : s
        ),
      }));
    },
    [commit]
  );

  const togglePinSocialLink: LifeHubContextValue['togglePinSocialLink'] = useCallback(
    (id) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        socialLinks: (prev.socialLinks || []).map((s) =>
          s.id === id ? { ...s, pinned: !s.pinned, updated_at: now } : s
        ),
      }));
    },
    [commit]
  );

  // ======================== PREFERENCES & BACKUP ========================
  const setTheme = useCallback(
    (theme: ThemePreference) => {
      commit((prev) => ({ ...prev, preferences: { ...prev.preferences, theme } }));
    },
    [commit]
  );

  const updateUserProfile = useCallback(
    (patch: { display_name?: string; email?: string; timezone?: string }) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        user: { ...prev.user, ...patch, updated_at: now },
      }));
    },
    [commit]
  );

  const enableNotifications = useCallback(async () => {
    const res = await requestNotificationPermission();
    commit((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, notifications_enabled: res === 'granted' },
    }));
    return res;
  }, [commit]);

  const triggerManualSync = useCallback(async () => {
    setSyncStatus((prev) => ({ ...prev, state: 'syncing' }));
    await saveLocalData(dataRef.current, lastUpdatedRef.current);
    await pullRemoteAndMerge();
    notify('Saved & synced', 'success');
  }, [pullRemoteAndMerge, notify]);

  const exportFullJsonBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify(dataRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifehub-backup-${getLocalDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify('Backup exported', 'success');
  }, [notify]);

  const importFullJsonBackup = useCallback(
    (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) {
          notify('Invalid LifeHub backup file', 'warning');
          return false;
        }
        const normalized = normalizeData(parsed);
        commit(() => normalized);
        notify('Backup restored', 'success');
        return true;
      } catch {
        notify('Could not read backup JSON', 'warning');
        return false;
      }
    },
    [commit, notify]
  );

  const loadSampleDataset = useCallback(() => {
    const sample = createSampleData();
    commit((prev) => ({ ...sample, security: prev.security }));
    notify('Loaded sample data', 'success');
  }, [commit, notify]);

  const resetAllData = useCallback(() => {
    const fresh = createInitialData();
    commit((prev) => ({ ...fresh, security: prev.security }));
    notify('Workspace reset to clean state', 'neutral');
  }, [commit, notify]);

  // ======================== UNIFIED ACCOUNT SYSTEM ========================
  const signUpAccount: LifeHubContextValue['signUpAccount'] = useCallback(
    async ({ email, password, displayName, remember }) => {
      const cleanEmail = email.trim().toLowerCase();
      const name = displayName.trim() || cleanEmail.split('@')[0] || 'Owner';

      // 1. Supabase Cloud Account (syncs PC & Android anywhere)
      const client = getSupabaseClient();
      if (client) {
        const { data: authData, error } = await client.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { display_name: name } },
        });
        if (error) return { ok: false, error: error.message };
        if (authData.session && authData.user) {
          sessionStorage.setItem('lifehub_cloud_session_active', '1');
          localStorage.setItem('lifehub_cloud_ephemeral', remember ? '0' : '1');
          const acct: AccountUser = {
            id: authData.user.id,
            email: authData.user.email || cleanEmail,
            displayName: name,
            provider: 'cloud',
          };
          accountRef.current = acct;
          setAccount(acct);
          commit((prev) => ({
            ...prev,
            user: { ...prev.user, id: acct.id, email: acct.email, display_name: name, updated_at: new Date().toISOString() },
          }));
          await pullRemoteAndMerge(acct);
          notify('Account created & synced to cloud', 'success');
          return { ok: true };
        }
        return { ok: true, needsEmailConfirm: true };
      }

      // 2. Built-in LAN Account Server (syncs PC & Android on Wi-Fi)
      if (lanConnectedRef.current) {
        const res = await lanRegister(cleanEmail, password, name, remember);
        if (!res.ok || !res.user || !res.token) {
          return { ok: false, error: res.error || 'Could not create account.' };
        }
        lanTokenRef.current = res.token;
        setLanHasAccounts(true);
        accountRef.current = res.user;
        setAccount(res.user);
        commit((prev) => ({
          ...prev,
          user: { ...prev.user, id: res.user!.id, email: res.user!.email, display_name: name, updated_at: new Date().toISOString() },
        }));
        await pullRemoteAndMerge(res.user);
        notify('Account created & synced on Wi-Fi', 'success');
        return { ok: true };
      }

      // 3. Offline / Static Device Account
      const res = localRegister(cleanEmail, password, name, remember);
      if (!res.ok || !res.user) return { ok: false, error: res.error };
      accountRef.current = res.user;
      setAccount(res.user);
      commit((prev) => ({
        ...prev,
        user: { ...prev.user, id: res.user!.id, email: res.user!.email, display_name: name, updated_at: new Date().toISOString() },
      }));
      notify('Account created on this device', 'success');
      return { ok: true, recoveryKey: res.recoveryKey };
    },
    [commit, pullRemoteAndMerge, notify]
  );

  const signInAccount: LifeHubContextValue['signInAccount'] = useCallback(
    async ({ email, password, remember }) => {
      const lockout = getLockoutStatus();
      if (lockout.cooldownMs > 0) {
        return {
          ok: false,
          error: `Too many failed attempts. Try again in ${Math.ceil(lockout.cooldownMs / 1000)}s.`,
          cooldownMs: lockout.cooldownMs,
        };
      }

      const cleanEmail = email.trim().toLowerCase();

      // 1. Supabase Cloud Account
      const client = getSupabaseClient();
      if (client) {
        const { data: authData, error } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error || !authData.user) {
          const fail = recordFailedAttempt();
          return {
            ok: false,
            error: error?.message || `Incorrect email or password (${fail.remainingAttempts} left).`,
            cooldownMs: fail.cooldownMs || undefined,
          };
        }
        clearFailedAttempts();
        sessionStorage.setItem('lifehub_cloud_session_active', '1');
        localStorage.setItem('lifehub_cloud_ephemeral', remember ? '0' : '1');
        const acct: AccountUser = {
          id: authData.user.id,
          email: authData.user.email || cleanEmail,
          displayName: (authData.user.user_metadata?.display_name as string) || cleanEmail.split('@')[0],
          provider: 'cloud',
        };
        accountRef.current = acct;
        setAccount(acct);
        await pullRemoteAndMerge(acct);
        notify('Signed in & synced with cloud', 'success');
        return { ok: true };
      }

      // 2. LAN Account Server
      if (lanConnectedRef.current) {
        const res = await lanLogin(cleanEmail, password, remember);
        if (!res.ok || !res.user || !res.token) {
          const fail = recordFailedAttempt();
          return {
            ok: false,
            error: res.error || `Incorrect email or password (${fail.remainingAttempts} left).`,
            cooldownMs: fail.cooldownMs || undefined,
          };
        }
        clearFailedAttempts();
        lanTokenRef.current = res.token;
        accountRef.current = res.user;
        setAccount(res.user);
        await pullRemoteAndMerge(res.user);
        notify('Signed in & synced on Wi-Fi', 'success');
        return { ok: true };
      }

      // 3. Local Device Account
      const res = localLogin(cleanEmail, password, remember);
      if (!res.ok || !res.user) {
        const fail = recordFailedAttempt();
        return {
          ok: false,
          error: res.error || `Incorrect email or password (${fail.remainingAttempts} left).`,
          cooldownMs: fail.cooldownMs || undefined,
        };
      }
      clearFailedAttempts();
      accountRef.current = res.user;
      setAccount(res.user);
      return { ok: true };
    },
    [pullRemoteAndMerge, notify]
  );

  const recoverLocalAccount: LifeHubContextValue['recoverLocalAccount'] = useCallback(
    async ({ email, recoveryKey, newPassword, remember }) => {
      const res = localRecoverPassword(email, recoveryKey, newPassword, remember);
      if (!res.ok || !res.user) return { ok: false, error: res.error };
      clearFailedAttempts();
      accountRef.current = res.user;
      setAccount(res.user);
      notify('Password reset', 'success');
      return { ok: true, newRecoveryKey: res.newRecoveryKey };
    },
    [notify]
  );

  const changeAccountPassword: LifeHubContextValue['changeAccountPassword'] = useCallback(
    async (currentPassword, newPassword) => {
      const acct = accountRef.current;
      if (!acct) return { ok: false, error: 'Not signed in.' };

      if (acct.provider === 'cloud') {
        const client = getSupabaseClient();
        if (!client) return { ok: false, error: 'Cloud client unavailable.' };
        // Re-verify current password first
        const check = await client.auth.signInWithPassword({ email: acct.email, password: currentPassword });
        if (check.error) return { ok: false, error: 'Current password is incorrect.' };
        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) return { ok: false, error: error.message };
        notify('Cloud account password updated', 'success');
        return { ok: true };
      }

      if (acct.provider === 'lan' && lanTokenRef.current) {
        const res = await lanChangePassword(lanTokenRef.current, currentPassword, newPassword);
        if (res.ok) notify('Account password updated', 'success');
        return res;
      }

      const res = localChangePassword(acct.email, currentPassword, newPassword);
      if (res.ok) notify('Account password updated', 'success');
      return res;
    },
    [notify]
  );

  const setAutoLockMode: LifeHubContextValue['setAutoLockMode'] = useCallback(
    (mode) => {
      const now = new Date().toISOString();
      commit((prev) => ({
        ...prev,
        security: {
          enabled: true,
          salt: prev.security?.salt || '',
          verify_hash: prev.security?.verify_hash || '',
          recovery_hash: prev.security?.recovery_hash || '',
          api_token_hash: prev.security?.api_token_hash || '',
          hint: prev.security?.hint || '',
          auto_lock: mode,
          updated_at: now,
        },
      }));
      notify('Auto-lock preference updated', 'success');
    },
    [commit, notify]
  );

  // ======================== SUPABASE CLOUD AUTH ========================
  const saveCloudConfig = useCallback((cfg: SupabaseConfig | null) => {
    saveSupabaseConfig(cfg);
    setSupabaseConfig(cfg);
    if (!cfg) {
      setSyncStatus((prev) => ({ ...prev, cloudUserEmail: null }));
    }
  }, []);

  const signInCloud = useCallback(
    async (email: string, password: string) => {
      return signInAccount({ email, password, remember: true });
    },
    [signInAccount]
  );

  const signUpCloud = useCallback(
    async (email: string, password: string) => {
      return signUpAccount({ email, password, displayName: email.split('@')[0], remember: true });
    },
    [signUpAccount]
  );

  const signOutCloud = useCallback(async () => {
    await signOutAccount();
    notify('Signed out', 'neutral');
  }, [signOutAccount, notify]);

  const value: LifeHubContextValue = {
    data,
    hydrated,
    authReady,
    isUnlocked,
    account,
    availableProvider,
    hasExistingAccount,
    syncStatus,
    lanUrls,
    toasts,
    activeTab,
    setActiveTab,
    focusTarget,
    navigateToItem,
    clearFocusTarget,
    notify,
    dismissToast,
    signUpAccount,
    signInAccount,
    recoverLocalAccount,
    changeAccountPassword,
    setAutoLockMode,
    lockNow,
    signOutAccount,
    activeProjects,
    activeTasks,
    activeWallets,
    activeCategories,
    activeTransactions,
    activeBudgets,
    activeNotes,
    activeTags,
    activeTagAssignments,
    activeLinks,
    activeSocialLinks,
    getWalletBalance,
    getTagsForItem,
    getLinksForItem,
    addTask,
    updateTask,
    toggleTaskStatus,
    deleteTask,
    addProject,
    deleteProject,
    addWallet,
    updateWallet,
    deleteWallet,
    addCategory,
    deleteCategory,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    setBudget,
    deleteBudget,
    addNote,
    updateNote,
    deleteNote,
    upsertJournalEntry,
    ensureTag,
    setItemTags,
    addLink,
    removeLink,
    addSocialLink,
    updateSocialLink,
    deleteSocialLink,
    togglePinSocialLink,
    setTheme,
    updateUserProfile,
    enableNotifications,
    triggerManualSync,
    exportFullJsonBackup,
    importFullJsonBackup,
    loadSampleDataset,
    resetAllData,
    supabaseConfig,
    saveCloudConfig,
    signInCloud,
    signUpCloud,
    signOutCloud,
  };

  return <LifeHubContext.Provider value={value}>{children}</LifeHubContext.Provider>;
};

export function useLifeHub(): LifeHubContextValue {
  const ctx = useContext(LifeHubContext);
  if (!ctx) throw new Error('useLifeHub must be used within LifeHubProvider');
  return ctx;
}
