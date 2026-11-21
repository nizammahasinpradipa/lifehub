import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
  if (!fs.existsSync(ACCOUNTS_FILE)) fs.writeFileSync(ACCOUNTS_FILE, '[]', 'utf-8');
  if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, '{}', 'utf-8');
}

function readJson(file: string, fallback: any) {
  ensureDirs();
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(file: string, obj: any) {
  ensureDirs();
  const tmp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

function hashPassword(password: string, salt: string) {
  return crypto.pbkdf2Sync(password, salt, 60000, 32, 'sha256').toString('hex');
}

function getAuth(req: any) {
  const h = req.headers['authorization'] || '';
  const bearer = typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  const custom = typeof req.headers['x-lifehub-session'] === 'string' ? req.headers['x-lifehub-session'].trim() : '';
  const token = bearer || custom;
  if (!token) return null;
  const sessions = readJson(SESSIONS_FILE, {});
  const sess = sessions[token];
  if (!sess || (sess.expiresAt && sess.expiresAt < Date.now())) return null;
  const accounts = readJson(ACCOUNTS_FILE, []);
  const account = accounts.find((a: any) => a.id === sess.userId);
  return account ? { account, token } : null;
}

function readBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c: Buffer) => (body += c.toString('utf-8')));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function sendJson(res: any, status: number, obj: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

function localSyncApiPlugin() {
  return {
    name: 'lifehub-local-account-api',
    configureServer(server: any) {
      ensureDirs();

      server.middlewares.use('/api/health', (_req: any, res: any) => {
        const accounts = readJson(ACCOUNTS_FILE, []);
        sendJson(res, 200, {
          ok: true,
          mode: 'dev-account-server',
          hasAccounts: accounts.length > 0,
          lanUrls: [],
          time: new Date().toISOString(),
        });
      });

      server.middlewares.use('/api/account/register', async (req: any, res: any) => {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
        try {
          const { email, password, displayName } = await readBody(req);
          const cleanEmail = String(email || '').trim().toLowerCase();
          const pass = String(password || '');
          if (!cleanEmail || !cleanEmail.includes('@')) return sendJson(res, 400, { error: 'Valid email required.' });
          if (pass.length < 6) return sendJson(res, 400, { error: 'Password must be at least 6 characters.' });
          const accounts = readJson(ACCOUNTS_FILE, []);
          if (accounts.some((a: any) => a.email === cleanEmail)) {
            return sendJson(res, 409, { error: 'Account already exists. Sign in instead.' });
          }
          const salt = crypto.randomBytes(16).toString('hex');
          const account = {
            id: `usr_${crypto.randomUUID()}`,
            email: cleanEmail,
            displayName: String(displayName || '').trim() || cleanEmail.split('@')[0],
            salt,
            passwordHash: hashPassword(pass, salt),
            createdAt: new Date().toISOString(),
          };
          accounts.push(account);
          writeJson(ACCOUNTS_FILE, accounts);
          const token = crypto.randomBytes(32).toString('hex');
          const sessions = readJson(SESSIONS_FILE, {});
          sessions[token] = { userId: account.id, createdAt: new Date().toISOString(), expiresAt: Date.now() + 30 * 86400_000 };
          writeJson(SESSIONS_FILE, sessions);
          sendJson(res, 200, { ok: true, token, user: { id: account.id, email: account.email, displayName: account.displayName } });
        } catch {
          sendJson(res, 400, { error: 'Invalid request' });
        }
      });

      server.middlewares.use('/api/account/login', async (req: any, res: any) => {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
        try {
          const { email, password } = await readBody(req);
          const cleanEmail = String(email || '').trim().toLowerCase();
          const accounts = readJson(ACCOUNTS_FILE, []);
          const account = accounts.find((a: any) => a.email === cleanEmail);
          if (!account || hashPassword(String(password || ''), account.salt) !== account.passwordHash) {
            return sendJson(res, 401, { error: 'Incorrect email or password.' });
          }
          const token = crypto.randomBytes(32).toString('hex');
          const sessions = readJson(SESSIONS_FILE, {});
          sessions[token] = { userId: account.id, createdAt: new Date().toISOString(), expiresAt: Date.now() + 30 * 86400_000 };
          writeJson(SESSIONS_FILE, sessions);
          sendJson(res, 200, { ok: true, token, user: { id: account.id, email: account.email, displayName: account.displayName } });
        } catch {
          sendJson(res, 400, { error: 'Invalid request' });
        }
      });

      server.middlewares.use('/api/account/me', (req: any, res: any) => {
        const auth = getAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Not signed in' });
        sendJson(res, 200, { ok: true, user: { id: auth.account.id, email: auth.account.email, displayName: auth.account.displayName } });
      });

      server.middlewares.use('/api/account/logout', (req: any, res: any) => {
        const auth = getAuth(req);
        if (auth) {
          const sessions = readJson(SESSIONS_FILE, {});
          delete sessions[auth.token];
          writeJson(SESSIONS_FILE, sessions);
        }
        sendJson(res, 200, { ok: true });
      });

      server.middlewares.use('/api/account/password', async (req: any, res: any) => {
        const auth = getAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Not signed in' });
        const { currentPassword, newPassword } = await readBody(req);
        if (hashPassword(String(currentPassword || ''), auth.account.salt) !== auth.account.passwordHash) {
          return sendJson(res, 403, { error: 'Current password is incorrect.' });
        }
        if (String(newPassword || '').length < 6) {
          return sendJson(res, 400, { error: 'New password must be at least 6 characters.' });
        }
        const newSalt = crypto.randomBytes(16).toString('hex');
        const accounts = readJson(ACCOUNTS_FILE, []).map((a: any) =>
          a.id === auth.account.id ? { ...a, salt: newSalt, passwordHash: hashPassword(String(newPassword), newSalt) } : a
        );
        writeJson(ACCOUNTS_FILE, accounts);
        sendJson(res, 200, { ok: true });
      });

      server.middlewares.use('/api/sync', async (req: any, res: any, next: any) => {
        const auth = getAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Sign in required' });
        const userFile = path.join(USERS_DIR, `${auth.account.id.replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
        if (req.method === 'GET') {
          const rec = readJson(userFile, { version: 1, updatedAt: null, data: null });
          return sendJson(res, 200, rec);
        }
        if (req.method === 'POST' || req.method === 'PUT') {
          try {
            const payload = await readBody(req);
            const rec = { version: 1, updatedAt: payload.updatedAt || new Date().toISOString(), data: payload.data };
            writeJson(userFile, rec);
            return sendJson(res, 200, { ok: true, updatedAt: rec.updatedAt });
          } catch (err: any) {
            return sendJson(res, 400, { error: err?.message || 'Invalid JSON' });
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localSyncApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
