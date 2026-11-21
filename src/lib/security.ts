/**
 * Pure-JS SHA-256 + iterated salted KDF so verification works identically on:
 * - PC (http://localhost)
 * - Deployed HTTPS (Vercel/Netlify/etc.)
 * - Android over local Wi-Fi (http://192.168.x.x where crypto.subtle is unavailable)
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const withOne = bytes.length + 1;
  const padZero = (64 - ((withOne + 8) % 64)) % 64;
  const totalLen = withOne + padZero + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;

  const view = new DataView(buf.buffer);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => x.toString(16).padStart(8, '0'))
    .join('');
}

export function generateSalt(bytesLen = 16): string {
  const bytes = new Uint8Array(bytesLen);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytesLen; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateRecoveryKey(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(rand);
  } else {
    for (let i = 0; i < 12; i++) rand[i] = Math.floor(Math.random() * 256);
  }
  const chars = Array.from(rand).map((b) => alphabet[b % alphabet.length]).join('');
  return `LH-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/**
 * Stretched salted hash (2,500 rounds of SHA-256) — fast (~8ms on Android) yet strong against offline brute force.
 */
function stretchedHash(secret: string, salt: string, domain: string): string {
  let acc = sha256Hex(`${domain}:${salt}:${secret}`);
  for (let i = 0; i < 2500; i++) {
    acc = sha256Hex(`${acc}:${salt}:${i}`);
  }
  return acc;
}

export function deriveAuthBundle(passcode: string, salt: string): {
  verifyHash: string;
  apiToken: string;
  apiTokenHash: string;
} {
  const verifyHash = stretchedHash(passcode, salt, 'lifehub-verify-v1');
  const apiToken = stretchedHash(passcode, salt, 'lifehub-api-token-v1');
  const apiTokenHash = sha256Hex(`server-token:${apiToken}`);
  return { verifyHash, apiToken, apiTokenHash };
}

export function hashRecoveryKey(recoveryKey: string, salt: string): string {
  const normalized = recoveryKey.trim().toUpperCase().replace(/\s+/g, '');
  return stretchedHash(normalized, salt, 'lifehub-recovery-v1');
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ============================================================
// Session Unlock & Brute-Force Cooldown Helpers
// ============================================================

const SESSION_UNLOCK_KEY = 'lifehub_session_auth_v1';
const LOCKOUT_KEY = 'lifehub_lockout_v1';
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

export function saveSessionAuthToken(apiToken: string, verifyHash: string): void {
  try {
    sessionStorage.setItem(
      SESSION_UNLOCK_KEY,
      JSON.stringify({ apiToken, verifyHash, unlockedAt: Date.now() })
    );
  } catch {
    // ignore
  }
}

export function getSessionAuthToken(): { apiToken: string; verifyHash: string; unlockedAt: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_UNLOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.apiToken && parsed?.verifyHash) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearSessionAuthToken(): void {
  try {
    sessionStorage.removeItem(SESSION_UNLOCK_KEY);
  } catch {
    // ignore
  }
}

interface LockoutState {
  attempts: number;
  lockedUntil: number;
}

function readLockout(): LockoutState {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (!raw) return { attempts: 0, lockedUntil: 0 };
    return JSON.parse(raw) as LockoutState;
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

export function getLockoutStatus(): { attempts: number; remainingAttempts: number; cooldownMs: number } {
  const state = readLockout();
  const now = Date.now();
  if (state.lockedUntil > now) {
    return { attempts: state.attempts, remainingAttempts: 0, cooldownMs: state.lockedUntil - now };
  }
  if (state.lockedUntil > 0 && state.lockedUntil <= now) {
    clearFailedAttempts();
    return { attempts: 0, remainingAttempts: MAX_ATTEMPTS, cooldownMs: 0 };
  }
  return {
    attempts: state.attempts,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - state.attempts),
    cooldownMs: 0,
  };
}

export function recordFailedAttempt(): { remainingAttempts: number; cooldownMs: number } {
  const current = readLockout();
  const nextAttempts = current.attempts + 1;
  const lockedUntil = nextAttempts >= MAX_ATTEMPTS ? Date.now() + COOLDOWN_MS : 0;
  try {
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ attempts: nextAttempts, lockedUntil }));
  } catch {
    // ignore
  }
  return {
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - nextAttempts),
    cooldownMs: lockedUntil > 0 ? COOLDOWN_MS : 0,
  };
}

export function clearFailedAttempts(): void {
  try {
    localStorage.removeItem(LOCKOUT_KEY);
  } catch {
    // ignore
  }
}
