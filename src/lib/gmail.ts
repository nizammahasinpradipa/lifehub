/**
 * Official Gmail REST API + Google Identity Services (OAuth 2.0) client.
 * Works on PC (localhost), deployed HTTPS web apps, and Android PWA.
 */

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  snippet: string;
  bodyText: string;
  date: string; // ISO string
  unread: boolean;
  starred: boolean;
  labelIds: string[];
}

export type GmailFolder = 'INBOX' | 'UNREAD' | 'STARRED' | 'SENT' | 'ALL';

const LS_CLIENT_ID_KEY = 'lifehub_gmail_client_id_v1';
const LS_CACHE_KEY = 'lifehub_gmail_cache_v1';
const LS_ACCOUNT_KEY = 'lifehub_gmail_account_v1';
const SS_TOKEN_KEY = 'lifehub_gmail_token_v1';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

export function getSavedGmailClientId(): string {
  try {
    const saved = localStorage.getItem(LS_CLIENT_ID_KEY);
    if (saved) return saved;
  } catch {
    // ignore
  }
  return import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';
}

export function saveGmailClientId(clientId: string): void {
  try {
    const clean = clientId.trim();
    if (!clean) {
      localStorage.removeItem(LS_CLIENT_ID_KEY);
    } else {
      localStorage.setItem(LS_CLIENT_ID_KEY, clean);
    }
  } catch {
    // ignore
  }
}

export function getSavedGmailAccount(): string | null {
  try {
    return localStorage.getItem(LS_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function saveGmailAccount(email: string | null): void {
  try {
    if (!email) localStorage.removeItem(LS_ACCOUNT_KEY);
    else localStorage.setItem(LS_ACCOUNT_KEY, email);
  } catch {
    // ignore
  }
}

export function getSessionGmailToken(): string | null {
  try {
    const raw = sessionStorage.getItem(SS_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (parsed.accessToken && parsed.expiresAt > Date.now() + 30_000) {
      return parsed.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSessionGmailToken(accessToken: string, expiresInSec: number): void {
  try {
    const record: StoredToken = {
      accessToken,
      expiresAt: Date.now() + Math.max(60, expiresInSec - 60) * 1000,
    };
    sessionStorage.setItem(SS_TOKEN_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }
}

export function clearSessionGmailToken(): void {
  try {
    sessionStorage.removeItem(SS_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function loadCachedGmailMessages(): GmailMessage[] {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCachedGmailMessages(messages: GmailMessage[]): void {
  try {
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify(messages.slice(0, 60)));
  } catch {
    // ignore quota
  }
}

export function clearGmailCache(): void {
  try {
    localStorage.removeItem(LS_CACHE_KEY);
    localStorage.removeItem(LS_ACCOUNT_KEY);
    sessionStorage.removeItem(SS_TOKEN_KEY);
  } catch {
    // ignore
  }
}

// ============================================================
// Load Google Identity Services (GIS) script lazily
// ============================================================

let gisLoadPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('Could not load Google Sign-In script. Check your internet connection.'));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

export async function requestGmailAccessToken(
  clientId: string,
  promptMode: '' | 'consent' | 'select_account' = 'select_account'
): Promise<{ accessToken: string; expiresIn: number }> {
  if (!clientId.trim()) {
    throw new Error('Please enter your Google OAuth Client ID first.');
  }
  await loadGoogleIdentityScript();
  const oauth2 = (window as any).google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google Identity Services failed to initialize.');
  }

  return await new Promise((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: GMAIL_SCOPES,
      callback: (resp: any) => {
        if (resp?.error) {
          reject(new Error(resp.error_description || resp.error || 'Google sign-in cancelled'));
          return;
        }
        if (!resp?.access_token) {
          reject(new Error('No access token returned by Google.'));
          return;
        }
        const expiresIn = Number(resp.expires_in || 3600);
        saveSessionGmailToken(resp.access_token, expiresIn);
        resolve({ accessToken: resp.access_token, expiresIn });
      },
      error_callback: (err: any) => {
        reject(new Error(err?.message || 'Google sign-in popup was blocked or closed.'));
      },
    });
    tokenClient.requestAccessToken({ prompt: promptMode });
  });
}

// ============================================================
// Base64URL & MIME Parsing Helpers
// ============================================================

function decodeBase64Url(input: string): string {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stripHtmlToPlainText(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
    return (doc.body.textContent || '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

function extractBodyFromPayload(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data).trim();
  }

  let plainFound = '';
  let htmlFound = '';

  const walk = (part: any) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data && !plainFound) {
      plainFound = decodeBase64Url(part.body.data).trim();
    } else if (part.mimeType === 'text/html' && part.body?.data && !htmlFound) {
      htmlFound = decodeBase64Url(part.body.data);
    }
    if (Array.isArray(part.parts)) {
      for (const child of part.parts) walk(child);
    }
  };

  walk(payload);
  if (plainFound) return plainFound;
  if (htmlFound) return stripHtmlToPlainText(htmlFound);
  if (payload.body?.data) return stripHtmlToPlainText(decodeBase64Url(payload.body.data));
  return '';
}

function parseSender(rawFrom: string): { name: string; email: string } {
  const match = rawFrom.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].replace(/^["']|["']$/g, '').trim();
    const email = match[2].trim();
    return { name: name || email, email };
  }
  const clean = rawFrom.trim();
  return { name: clean || 'Unknown sender', email: clean };
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// ============================================================
// Gmail API Calls
// ============================================================

async function gmailFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) {
    clearSessionGmailToken();
    throw new Error('Gmail session expired. Tap "Reconnect Gmail" to refresh.');
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Gmail API error (${res.status}): ${txt.slice(0, 140)}`);
  }
  return res.json();
}

export async function fetchGmailProfile(accessToken: string): Promise<string> {
  const data = await gmailFetch(accessToken, '/profile');
  const email = data?.emailAddress || '';
  if (email) saveGmailAccount(email);
  return email;
}

export async function fetchGmailMessages(
  accessToken: string,
  opts: { folder?: GmailFolder; query?: string; maxResults?: number } = {}
): Promise<GmailMessage[]> {
  const params = new URLSearchParams();
  params.set('maxResults', String(opts.maxResults || 25));

  const qParts: string[] = [];
  if (opts.folder === 'INBOX') params.append('labelIds', 'INBOX');
  if (opts.folder === 'UNREAD') {
    params.append('labelIds', 'INBOX');
    params.append('labelIds', 'UNREAD');
  }
  if (opts.folder === 'STARRED') params.append('labelIds', 'STARRED');
  if (opts.folder === 'SENT') params.append('labelIds', 'SENT');
  if (opts.query?.trim()) qParts.push(opts.query.trim());
  if (qParts.length > 0) params.set('q', qParts.join(' '));

  const list = await gmailFetch(accessToken, `/messages?${params.toString()}`);
  const ids: Array<{ id: string }> = Array.isArray(list?.messages) ? list.messages : [];
  if (ids.length === 0) return [];

  const details = await Promise.all(
    ids.slice(0, 25).map((item) =>
      gmailFetch(accessToken, `/messages/${encodeURIComponent(item.id)}?format=full`).catch(() => null)
    )
  );

  const parsed: GmailMessage[] = [];
  for (const msg of details) {
    if (!msg || !msg.id) continue;
    const headers: Array<{ name: string; value: string }> = msg.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const rawFrom = getHeader('From');
    const { name: fromName, email: fromEmail } = parseSender(rawFrom);
    const labelIds: string[] = Array.isArray(msg.labelIds) ? msg.labelIds : [];
    const internalMs = Number(msg.internalDate || Date.now());

    parsed.push({
      id: msg.id,
      threadId: msg.threadId || msg.id,
      from: rawFrom,
      fromName,
      fromEmail,
      to: getHeader('To'),
      subject: getHeader('Subject') || '(No subject)',
      snippet: decodeHtmlEntities(msg.snippet || ''),
      bodyText: extractBodyFromPayload(msg.payload) || decodeHtmlEntities(msg.snippet || ''),
      date: new Date(internalMs).toISOString(),
      unread: labelIds.includes('UNREAD'),
      starred: labelIds.includes('STARRED'),
      labelIds,
    });
  }

  return parsed;
}

export async function modifyGmailLabels(
  accessToken: string,
  messageId: string,
  addLabelIds: string[],
  removeLabelIds: string[]
): Promise<void> {
  await gmailFetch(accessToken, `/messages/${encodeURIComponent(messageId)}/modify`, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
}

export async function sendGmailMessage(
  accessToken: string,
  input: { to: string; subject: string; body: string; threadId?: string }
): Promise<void> {
  const lines = [
    `To: ${input.to.trim()}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(input.subject.trim())))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    input.body,
  ];
  const raw = encodeBase64Url(lines.join('\r\n'));
  await gmailFetch(accessToken, '/messages/send', {
    method: 'POST',
    body: JSON.stringify({
      raw,
      ...(input.threadId ? { threadId: input.threadId } : {}),
    }),
  });
}
