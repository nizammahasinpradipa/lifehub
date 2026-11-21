import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BaseEntity, LifeHubData, RemoteAuthMeta, SecurityConfig, SupabaseConfig } from '../types/models';
import { createInitialData } from './defaults';

const IDB_NAME = 'LifeHubDB';
const IDB_STORE = 'state';
const IDB_KEY = 'lifehub_main';
const LS_KEY = 'lifehub_data_v1';
const LS_UPDATED_KEY = 'lifehub_updated_at_v1';
const LS_SUPABASE_KEY = 'lifehub_supabase_config_v1';
const LS_CLIENT_ID_KEY = 'lifehub_client_id_v1';

export function getClientId(): string {
  try {
    let id = localStorage.getItem(LS_CLIENT_ID_KEY);
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(LS_CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_local';
  }
}

// ============================================================
// Tier 1: IndexedDB + localStorage Dual-Layer Local Persistence
// Ensures closing & reopening the app on PC or Android NEVER loses data.
// ============================================================

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<{ data: LifeHubData; updatedAt: string } | null> {
  try {
    const db = await openIDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(record: { data: LifeHubData; updatedAt: string }): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(record, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback handled by localStorage
  }
}

export function loadLocalSyncSnapshot(): { data: LifeHubData; updatedAt: string | null } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const updatedAt = localStorage.getItem(LS_UPDATED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LifeHubData;
      if (parsed && parsed.version && Array.isArray(parsed.tasks)) {
        return { data: normalizeData(parsed), updatedAt };
      }
    }
  } catch {
    // ignore corrupt localStorage
  }
  return { data: createInitialData(), updatedAt: null };
}

export async function loadBestLocalData(): Promise<{ data: LifeHubData; updatedAt: string | null }> {
  const lsSnap = loadLocalSyncSnapshot();
  const idbSnap = await idbGet();

  if (idbSnap && idbSnap.data && Array.isArray(idbSnap.data.tasks)) {
    const idbTime = idbSnap.updatedAt ? new Date(idbSnap.updatedAt).getTime() : 0;
    const lsTime = lsSnap.updatedAt ? new Date(lsSnap.updatedAt).getTime() : 0;
    if (idbTime >= lsTime) {
      const normalized = normalizeData(idbSnap.data);
      // Keep localStorage in sync
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(normalized));
        if (idbSnap.updatedAt) localStorage.setItem(LS_UPDATED_KEY, idbSnap.updatedAt);
      } catch {
        // quota exceeded is fine; IDB holds full copy
      }
      return { data: normalized, updatedAt: idbSnap.updatedAt };
    }
  }

  return lsSnap;
}

export async function saveLocalData(data: LifeHubData, updatedAt: string): Promise<void> {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    localStorage.setItem(LS_UPDATED_KEY, updatedAt);
  } catch {
    // localStorage might be full for huge datasets; IndexedDB handles gigabytes
  }
  await idbSet({ data, updatedAt });
}

export function normalizeData(input: Partial<LifeHubData>): LifeHubData {
  const base = createInitialData();
  return {
    version: 1,
    user: { ...base.user, ...(input.user || {}) },
    projects: Array.isArray(input.projects) ? input.projects : base.projects,
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    wallets: Array.isArray(input.wallets) && input.wallets.length > 0 ? input.wallets : base.wallets,
    categories: Array.isArray(input.categories) && input.categories.length > 0 ? input.categories : base.categories,
    transactions: Array.isArray(input.transactions) ? input.transactions : [],
    budgets: Array.isArray(input.budgets) ? input.budgets : [],
    notes: Array.isArray(input.notes) ? input.notes : [],
    tags: Array.isArray(input.tags) ? input.tags : [],
    tagAssignments: Array.isArray(input.tagAssignments) ? input.tagAssignments : [],
    links: Array.isArray(input.links) ? input.links : [],
    socialLinks: Array.isArray(input.socialLinks) ? input.socialLinks : [],
    preferences: { ...base.preferences, ...(input.preferences || {}) },
    security: input.security ?? null,
  };
}

// ============================================================
// Last-Write-Wins (LWW) Merge on `updated_at` with soft deletes
// Matches PRD sync strategy for phone <-> web conflict safety
// ============================================================

function mergeEntityList<T extends BaseEntity>(localList: T[], remoteList: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of localList) {
    map.set(item.id, item);
  }
  for (const remote of remoteList) {
    const existing = map.get(remote.id);
    if (!existing) {
      map.set(remote.id, remote);
    } else {
      const localTs = new Date(existing.updated_at || 0).getTime();
      const remoteTs = new Date(remote.updated_at || 0).getTime();
      if (remoteTs >= localTs) {
        map.set(remote.id, remote);
      }
    }
  }
  return Array.from(map.values());
}

export function mergeLifeHubData(local: LifeHubData, remote: LifeHubData): LifeHubData {
  const localUserTs = new Date(local.user?.updated_at || 0).getTime();
  const remoteUserTs = new Date(remote.user?.updated_at || 0).getTime();

  let mergedSecurity: SecurityConfig | null = local.security || remote.security || null;
  if (local.security && remote.security) {
    const lTs = new Date(local.security.updated_at || 0).getTime();
    const rTs = new Date(remote.security.updated_at || 0).getTime();
    mergedSecurity = rTs >= lTs ? remote.security : local.security;
  }

  return {
    version: 1,
    user: remoteUserTs >= localUserTs ? remote.user : local.user,
    projects: mergeEntityList(local.projects, remote.projects),
    tasks: mergeEntityList(local.tasks, remote.tasks),
    wallets: mergeEntityList(local.wallets, remote.wallets),
    categories: mergeEntityList(local.categories, remote.categories),
    transactions: mergeEntityList(local.transactions, remote.transactions),
    budgets: mergeEntityList(local.budgets, remote.budgets),
    notes: mergeEntityList(local.notes, remote.notes),
    tags: mergeEntityList(local.tags, remote.tags),
    tagAssignments: mergeEntityList(local.tagAssignments, remote.tagAssignments),
    links: mergeEntityList(local.links, remote.links),
    socialLinks: mergeEntityList(local.socialLinks || [], remote.socialLinks || []),
    preferences: { ...remote.preferences, ...local.preferences },
    security: mergedSecurity,
  };
}

// ============================================================
// Tier 2: Built-in LAN / Disk Sync API (/api/sync & /api/events)
// Works automatically when running via `npm run dev` or `npm start`
// ============================================================

export async function fetchLanAuthStatus(): Promise<RemoteAuthMeta | null> {
  try {
    const res = await fetch('/api/auth/status', { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as RemoteAuthMeta;
  } catch {
    return null;
  }
}

export async function recoverLanAuth(recoveryHash: string, newAuth: SecurityConfig): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryHash, newAuth }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchLanData(sessionToken?: string | null): Promise<{
  ok: boolean;
  unauthorized?: boolean;
  data: LifeHubData | null;
  updatedAt: string | null;
}> {
  try {
    const headers: Record<string, string> = {};
    if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
    const res = await fetch('/api/sync', { method: 'GET', cache: 'no-store', headers });
    if (res.status === 401) return { ok: false, unauthorized: true, data: null, updatedAt: null };
    if (!res.ok) return { ok: false, data: null, updatedAt: null };
    const json = await res.json();
    return {
      ok: true,
      data: json?.data ? normalizeData(json.data) : null,
      updatedAt: json?.updatedAt || null,
    };
  } catch {
    return { ok: false, data: null, updatedAt: null };
  }
}

export async function pushLanData(
  data: LifeHubData,
  updatedAt: string,
  sessionToken?: string | null
): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({ data, updatedAt, clientId: getClientId() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchServerInfo(): Promise<{ ok: boolean; hasAccounts: boolean; lanUrls: string[] }> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) return { ok: false, hasAccounts: false, lanUrls: [] };
    const json = await res.json();
    return {
      ok: true,
      hasAccounts: Boolean(json.hasAccounts),
      lanUrls: Array.isArray(json.lanUrls) ? json.lanUrls : [],
    };
  } catch {
    return { ok: false, hasAccounts: false, lanUrls: [] };
  }
}

// ============================================================
// Tier 3: Optional Supabase Cloud Sync (PC <-> Android anywhere)
// ============================================================

export function getSavedSupabaseConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(LS_SUPABASE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SupabaseConfig;
      if (parsed.url && parsed.anonKey) return parsed;
    }
  } catch {
    // ignore
  }
  const envUrl = import.meta.env?.VITE_SUPABASE_URL;
  const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey };
  }
  return null;
}

export function saveSupabaseConfig(config: SupabaseConfig | null): void {
  try {
    if (!config) {
      localStorage.removeItem(LS_SUPABASE_KEY);
    } else {
      localStorage.setItem(LS_SUPABASE_KEY, JSON.stringify(config));
    }
  } catch {
    // ignore
  }
}

let cachedSupabase: { url: string; anonKey: string; client: SupabaseClient } | null = null;

export function getSupabaseClient(config?: SupabaseConfig | null): SupabaseClient | null {
  const cfg = config ?? getSavedSupabaseConfig();
  if (!cfg || !cfg.url || !cfg.anonKey) return null;
  if (cachedSupabase && cachedSupabase.url === cfg.url && cachedSupabase.anonKey === cfg.anonKey) {
    return cachedSupabase.client;
  }
  const client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  cachedSupabase = { url: cfg.url, anonKey: cfg.anonKey, client };
  return client;
}

export async function pullCloudSnapshot(client: SupabaseClient, userId: string): Promise<{ data: LifeHubData | null; updatedAt: string | null }> {
  const { data, error } = await client
    .from('lifehub_snapshots')
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return { data: null, updatedAt: null };
  return {
    data: data.payload ? normalizeData(data.payload as LifeHubData) : null,
    updatedAt: data.updated_at || null,
  };
}

export async function pushCloudSnapshot(
  client: SupabaseClient,
  userId: string,
  payload: LifeHubData,
  updatedAt: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from('lifehub_snapshots').upsert(
    {
      user_id: userId,
      payload,
      updated_at: updatedAt,
    },
    { onConflict: 'user_id' }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
