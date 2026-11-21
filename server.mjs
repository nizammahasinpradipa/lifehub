import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const LEGACY_DB_FILE = path.join(DATA_DIR, 'lifehub-db.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// Map<userId, Set<http.ServerResponse>>
const sseClientsByUser = new Map();

function ensureStorageDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
  if (!fs.existsSync(ACCOUNTS_FILE)) fs.writeFileSync(ACCOUNTS_FILE, '[]', 'utf-8');
  if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, '{}', 'utf-8');
}

function atomicWriteJson(filePath, obj) {
  ensureStorageDirs();
  const tmp = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

function readAccounts() {
  ensureStorageDirs();
  try {
    const parsed = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readSessions() {
  ensureStorageDirs();
  try {
    const parsed = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 60000, 32, 'sha256').toString('hex');
}

function verifyPassword(password, salt, expectedHex) {
  const actual = hashPassword(password, salt);
  const a = Buffer.from(actual, 'utf-8');
  const b = Buffer.from(String(expectedHex || ''), 'utf-8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSessionToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const sessions = readSessions();
  sessions[token] = {
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days max server TTL
  };
  atomicWriteJson(SESSIONS_FILE, sessions);
  return token;
}

function getAuthenticatedUser(req, reqUrl) {
  const authHeader = req.headers['authorization'] || '';
  const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const customHeader = typeof req.headers['x-lifehub-session'] === 'string' ? req.headers['x-lifehub-session'].trim() : '';
  const queryToken = reqUrl.searchParams.get('token') || '';
  const token = bearer || customHeader || queryToken;
  if (!token) return null;

  const sessions = readSessions();
  const sess = sessions[token];
  if (!sess) return null;
  if (sess.expiresAt && sess.expiresAt < Date.now()) {
    delete sessions[token];
    atomicWriteJson(SESSIONS_FILE, sessions);
    return null;
  }
  const accounts = readAccounts();
  const account = accounts.find((a) => a.id === sess.userId);
  if (!account) return null;
  return { account, token };
}

function getUserDbFile(userId) {
  const safe = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(USERS_DIR, `${safe}.json`);
}

function readUserRecord(userId) {
  ensureStorageDirs();
  const file = getUserDbFile(userId);
  if (!fs.existsSync(file)) {
    // Migrate legacy single-user file for first registered account if present
    if (fs.existsSync(LEGACY_DB_FILE)) {
      try {
        const legacy = JSON.parse(fs.readFileSync(LEGACY_DB_FILE, 'utf-8'));
        if (legacy?.data) {
          atomicWriteJson(file, { version: 1, updatedAt: legacy.updatedAt || new Date().toISOString(), data: legacy.data });
          return { version: 1, updatedAt: legacy.updatedAt || null, data: legacy.data };
        }
      } catch {
        // ignore
      }
    }
    return { version: 1, updatedAt: null, data: null };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return { version: 1, updatedAt: parsed?.updatedAt || null, data: parsed?.data || null };
  } catch {
    return { version: 1, updatedAt: null, data: null };
  }
}

function broadcastUserSync(userId, updatedAt, clientId) {
  const set = sseClientsByUser.get(userId);
  if (!set) return;
  const payload = `data: ${JSON.stringify({ type: 'sync', updatedAt, clientId })}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      set.delete(res);
    }
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf-8');
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

function getLanUrls(port) {
  const nets = os.networkInterfaces();
  const urls = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`http://${net.address}:${port}`);
      }
    }
  }
  return urls;
}

ensureStorageDirs();

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-LifeHub-Session');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Health & LAN discovery
  if (pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      mode: 'lifehub-account-server',
      hasAccounts: readAccounts().length > 0,
      lanUrls: getLanUrls(PORT),
      time: new Date().toISOString(),
    });
    return;
  }

  // Account: Register
  if (pathname === '/api/account/register' && req.method === 'POST') {
    try {
      const { email, password, displayName } = await readJsonBody(req);
      const cleanEmail = String(email || '').trim().toLowerCase();
      const pass = String(password || '');
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return sendJson(res, 400, { error: 'Please enter a valid email address.' });
      }
      if (pass.length < 6) {
        return sendJson(res, 400, { error: 'Password must be at least 6 characters.' });
      }
      const accounts = readAccounts();
      if (accounts.some((a) => a.email === cleanEmail)) {
        return sendJson(res, 409, { error: 'An account with this email already exists. Please sign in.' });
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
      atomicWriteJson(ACCOUNTS_FILE, accounts);
      const token = createSessionToken(account.id);
      return sendJson(res, 200, {
        ok: true,
        token,
        user: { id: account.id, email: account.email, displayName: account.displayName },
      });
    } catch {
      return sendJson(res, 400, { error: 'Invalid registration payload.' });
    }
  }

  // Account: Sign In
  if (pathname === '/api/account/login' && req.method === 'POST') {
    try {
      const { email, password } = await readJsonBody(req);
      const cleanEmail = String(email || '').trim().toLowerCase();
      const pass = String(password || '');
      const accounts = readAccounts();
      const account = accounts.find((a) => a.email === cleanEmail);
      if (!account || !verifyPassword(pass, account.salt, account.passwordHash)) {
        return sendJson(res, 401, { error: 'Incorrect email or password.' });
      }
      const token = createSessionToken(account.id);
      return sendJson(res, 200, {
        ok: true,
        token,
        user: { id: account.id, email: account.email, displayName: account.displayName },
      });
    } catch {
      return sendJson(res, 400, { error: 'Invalid sign-in payload.' });
    }
  }

  // Account: Current session check
  if (pathname === '/api/account/me' && req.method === 'GET') {
    const auth = getAuthenticatedUser(req, reqUrl);
    if (!auth) return sendJson(res, 401, { error: 'Not signed in' });
    return sendJson(res, 200, {
      ok: true,
      user: { id: auth.account.id, email: auth.account.email, displayName: auth.account.displayName },
    });
  }

  // Account: Sign Out
  if (pathname === '/api/account/logout' && req.method === 'POST') {
    const auth = getAuthenticatedUser(req, reqUrl);
    if (auth) {
      const sessions = readSessions();
      delete sessions[auth.token];
      atomicWriteJson(SESSIONS_FILE, sessions);
    }
    return sendJson(res, 200, { ok: true });
  }

  // Account: Change Password
  if (pathname === '/api/account/password' && req.method === 'POST') {
    const auth = getAuthenticatedUser(req, reqUrl);
    if (!auth) return sendJson(res, 401, { error: 'Not signed in' });
    try {
      const { currentPassword, newPassword } = await readJsonBody(req);
      if (!verifyPassword(String(currentPassword || ''), auth.account.salt, auth.account.passwordHash)) {
        return sendJson(res, 403, { error: 'Current password is incorrect.' });
      }
      if (String(newPassword || '').length < 6) {
        return sendJson(res, 400, { error: 'New password must be at least 6 characters.' });
      }
      const newSalt = crypto.randomBytes(16).toString('hex');
      const accounts = readAccounts().map((a) =>
        a.id === auth.account.id ? { ...a, salt: newSalt, passwordHash: hashPassword(String(newPassword), newSalt) } : a
      );
      atomicWriteJson(ACCOUNTS_FILE, accounts);
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 400, { error: 'Invalid request' });
    }
  }

  // Realtime SSE stream scoped to signed-in account
  if (pathname === '/api/events') {
    const auth = getAuthenticatedUser(req, reqUrl);
    if (!auth) return sendJson(res, 401, { error: 'Sign in required' });
    const userId = auth.account.id;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    if (!sseClientsByUser.has(userId)) sseClientsByUser.set(userId, new Set());
    sseClientsByUser.get(userId).add(res);
    req.on('close', () => {
      sseClientsByUser.get(userId)?.delete(res);
    });
    return;
  }

  // Per-account Data Sync
  if (pathname === '/api/sync') {
    const auth = getAuthenticatedUser(req, reqUrl);
    if (!auth) return sendJson(res, 401, { error: 'Sign in required' });
    const userId = auth.account.id;

    if (req.method === 'GET') {
      const record = readUserRecord(userId);
      return sendJson(res, 200, record);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const payload = await readJsonBody(req);
        const record = {
          version: 1,
          updatedAt: payload.updatedAt || new Date().toISOString(),
          data: payload.data,
        };
        atomicWriteJson(getUserDbFile(userId), record);
        broadcastUserSync(userId, record.updatedAt, payload.clientId || null);
        return sendJson(res, 200, { ok: true, updatedAt: record.updatedAt });
      } catch (err) {
        return sendJson(res, 400, { error: err?.message || 'Invalid JSON' });
      }
    }
  }

  // Static files from dist/
  if (!fs.existsSync(DIST_DIR)) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('LifeHub is not built yet. Run "npm run build" first, then "npm start".');
    return;
  }

  let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  if (ext === '.html' || path.basename(filePath) === 'sw.js') {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  const lanUrls = getLanUrls(PORT);
  console.log('\n  LifeHub Account & Sync Server is running!');
  console.log(`  PC:      http://localhost:${PORT}`);
  if (lanUrls.length > 0) {
    lanUrls.forEach((url) => console.log(`  Android: ${url}  (sign in with same account over Wi-Fi)`));
  }
  console.log(`  Data:    ${DATA_DIR}\n`);
});
