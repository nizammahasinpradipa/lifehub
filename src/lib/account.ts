import type { SupabaseClient } from '@supabase/supabase-js';
import {
  constantTimeEqual,
  deriveAuthBundle,
  generateRecoveryKey,
  generateSalt,
  hashRecoveryKey,
} from './security';

export type AccountProvider = 'cloud' | 'lan' | 'local';

export interface AccountUser {
  id: string;
  email: string;
  displayName: string;
  provider: AccountProvider;
}

const SS_LAN_SESSION = 'lifehub_lan_session_v2';
const LS_LAN_SESSION = 'lifehub_lan_session_persist_v2';
const LS_LOCAL_ACCOUNTS = 'lifehub_local_accounts_v2';
const SS_LOCAL_SESSION = 'lifehub_local_session_v2';
const LS_LOCAL_SESSION = 'lifehub_local_session_persist_v2';

interface LocalAccountRecord {
  id: string;
  email: string;
  displayName: string;
  salt: string;
  verifyHash: string;
  recoveryHash: string;
  createdAt: string;
}

// ============================================================
// LAN Account Server Helpers (/api/account/*)
// ============================================================

export function getSavedLanToken(): string | null {
  try {
    return sessionStorage.getItem(SS_LAN_SESSION) || localStorage.getItem(LS_LAN_SESSION) || null;
  } catch {
    return null;
  }
}

export function saveLanToken(token: string, remember: boolean): void {
  try {
    sessionStorage.setItem(SS_LAN_SESSION, token);
    if (remember) {
      localStorage.setItem(LS_LAN_SESSION, token);
    } else {
      localStorage.removeItem(LS_LAN_SESSION);
    }
  } catch {
    // ignore
  }
}

export function clearLanToken(): void {
  try {
    sessionStorage.removeItem(SS_LAN_SESSION);
    localStorage.removeItem(LS_LAN_SESSION);
  } catch {
    // ignore
  }
}

export async function lanRegister(
  email: string,
  password: string,
  displayName: string,
  remember: boolean
): Promise<{ ok: boolean; user?: AccountUser; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/account/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    const json = await res.json();
    if (!res.ok || !json.token) {
      return { ok: false, error: json.error || 'Registration failed.' };
    }
    saveLanToken(json.token, remember);
    return {
      ok: true,
      token: json.token,
      user: {
        id: json.user.id,
        email: json.user.email,
        displayName: json.user.displayName,
        provider: 'lan',
      },
    };
  } catch {
    return { ok: false, error: 'Could not reach LifeHub account server.' };
  }
}

export async function lanLogin(
  email: string,
  password: string,
  remember: boolean
): Promise<{ ok: boolean; user?: AccountUser; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/account/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.token) {
      return { ok: false, error: json.error || 'Incorrect email or password.' };
    }
    saveLanToken(json.token, remember);
    return {
      ok: true,
      token: json.token,
      user: {
        id: json.user.id,
        email: json.user.email,
        displayName: json.user.displayName,
        provider: 'lan',
      },
    };
  } catch {
    return { ok: false, error: 'Could not reach LifeHub account server.' };
  }
}

export async function lanMe(token: string): Promise<AccountUser | null> {
  try {
    const res = await fetch('/api/account/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.user) return null;
    return {
      id: json.user.id,
      email: json.user.email,
      displayName: json.user.displayName,
      provider: 'lan',
    };
  } catch {
    return null;
  }
}

export async function lanLogout(token: string | null): Promise<void> {
  clearLanToken();
  if (!token) return;
  try {
    await fetch('/api/account/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // ignore
  }
}

export async function lanChangePassword(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/account/password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || 'Password update failed.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach server.' };
  }
}

// ============================================================
// Local Device Account Helpers (Offline / Static Fallback)
// ============================================================

function readLocalAccounts(): LocalAccountRecord[] {
  try {
    const raw = localStorage.getItem(LS_LOCAL_ACCOUNTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAccounts(list: LocalAccountRecord[]): void {
  try {
    localStorage.setItem(LS_LOCAL_ACCOUNTS, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function hasLocalAccounts(): boolean {
  return readLocalAccounts().length > 0;
}

export function getSavedLocalSessionUser(): AccountUser | null {
  try {
    const raw = sessionStorage.getItem(SS_LOCAL_SESSION) || localStorage.getItem(LS_LOCAL_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccountUser;
    if (parsed?.id && parsed?.email) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveLocalSessionUser(user: AccountUser, remember: boolean): void {
  try {
    const json = JSON.stringify(user);
    sessionStorage.setItem(SS_LOCAL_SESSION, json);
    if (remember) localStorage.setItem(LS_LOCAL_SESSION, json);
    else localStorage.removeItem(LS_LOCAL_SESSION);
  } catch {
    // ignore
  }
}

export function clearLocalSessionUser(): void {
  try {
    sessionStorage.removeItem(SS_LOCAL_SESSION);
    localStorage.removeItem(LS_LOCAL_SESSION);
  } catch {
    // ignore
  }
}

export function localRegister(
  email: string,
  password: string,
  displayName: string,
  remember: boolean
): { ok: boolean; user?: AccountUser; recoveryKey?: string; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }
  const accounts = readLocalAccounts();
  if (accounts.some((a) => a.email === cleanEmail)) {
    return { ok: false, error: 'An account with this email already exists on this device.' };
  }

  const salt = generateSalt();
  const recoveryKey = generateRecoveryKey();
  const { verifyHash } = deriveAuthBundle(password, salt);
  const recoveryHash = hashRecoveryKey(recoveryKey, salt);

  const record: LocalAccountRecord = {
    id: `loc_${Date.now().toString(36)}`,
    email: cleanEmail,
    displayName: displayName.trim() || cleanEmail.split('@')[0],
    salt,
    verifyHash,
    recoveryHash,
    createdAt: new Date().toISOString(),
  };

  writeLocalAccounts([...accounts, record]);
  const user: AccountUser = {
    id: record.id,
    email: record.email,
    displayName: record.displayName,
    provider: 'local',
  };
  saveLocalSessionUser(user, remember);
  return { ok: true, user, recoveryKey };
}

export function localLogin(
  email: string,
  password: string,
  remember: boolean
): { ok: boolean; user?: AccountUser; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const accounts = readLocalAccounts();
  const found = accounts.find((a) => a.email === cleanEmail);
  if (!found) {
    return { ok: false, error: 'No account found with that email on this device.' };
  }
  const { verifyHash } = deriveAuthBundle(password, found.salt);
  if (!constantTimeEqual(verifyHash, found.verifyHash)) {
    return { ok: false, error: 'Incorrect email or password.' };
  }
  const user: AccountUser = {
    id: found.id,
    email: found.email,
    displayName: found.displayName,
    provider: 'local',
  };
  saveLocalSessionUser(user, remember);
  return { ok: true, user };
}

export function localRecoverPassword(
  email: string,
  recoveryKey: string,
  newPassword: string,
  remember: boolean
): { ok: boolean; user?: AccountUser; newRecoveryKey?: string; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const accounts = readLocalAccounts();
  const found = accounts.find((a) => a.email === cleanEmail);
  if (!found) return { ok: false, error: 'Account not found.' };
  const providedHash = hashRecoveryKey(recoveryKey, found.salt);
  if (!constantTimeEqual(providedHash, found.recoveryHash)) {
    return { ok: false, error: 'Invalid recovery key.' };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: 'New password must be at least 6 characters.' };
  }
  const newSalt = generateSalt();
  const newRecoveryKey = generateRecoveryKey();
  const { verifyHash } = deriveAuthBundle(newPassword, newSalt);
  const recoveryHash = hashRecoveryKey(newRecoveryKey, newSalt);

  const updated = accounts.map((a) =>
    a.id === found.id ? { ...a, salt: newSalt, verifyHash, recoveryHash } : a
  );
  writeLocalAccounts(updated);
  const user: AccountUser = {
    id: found.id,
    email: found.email,
    displayName: found.displayName,
    provider: 'local',
  };
  saveLocalSessionUser(user, remember);
  return { ok: true, user, newRecoveryKey };
}

export function localChangePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): { ok: boolean; newRecoveryKey?: string; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const accounts = readLocalAccounts();
  const found = accounts.find((a) => a.email === cleanEmail);
  if (!found) return { ok: false, error: 'Account not found.' };
  const cur = deriveAuthBundle(currentPassword, found.salt);
  if (!constantTimeEqual(cur.verifyHash, found.verifyHash)) {
    return { ok: false, error: 'Current password is incorrect.' };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: 'New password must be at least 6 characters.' };
  }
  const newSalt = generateSalt();
  const newRecoveryKey = generateRecoveryKey();
  const { verifyHash } = deriveAuthBundle(newPassword, newSalt);
  const recoveryHash = hashRecoveryKey(newRecoveryKey, newSalt);
  writeLocalAccounts(
    accounts.map((a) => (a.id === found.id ? { ...a, salt: newSalt, verifyHash, recoveryHash } : a))
  );
  return { ok: true, newRecoveryKey };
}

// ============================================================
// Supabase Realtime Subscription Helper
// ============================================================

export function subscribeToCloudSnapshot(
  client: SupabaseClient,
  userId: string,
  onUpdate: () => void
): () => void {
  const channel = client
    .channel(`lifehub-sync-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'lifehub_snapshots',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
