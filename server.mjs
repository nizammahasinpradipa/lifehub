import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'lifehub-db.json');

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

const sseClients = new Set();

function ensureDbFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ version: 1, updatedAt: null, auth: null, data: null }, null, 2),
      'utf-8'
    );
  }
}

function readDbRecord() {
  ensureDbFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    return {
      version: 1,
      updatedAt: parsed?.updatedAt || null,
      auth: parsed?.auth || parsed?.data?.security || null,
      data: parsed?.data || null,
    };
  } catch {
    return { version: 1, updatedAt: null, auth: null, data: null };
  }
}

function writeDbRecord(record) {
  ensureDbFile();
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(record, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

function hashServerToken(token) {
  return crypto.createHash('sha256').update(`server-token:${token}`).digest('hex');
}

function isAuthorized(req, reqUrl, record) {
  const auth = record.auth;
  if (!auth || !auth.enabled || !auth.api_token_hash) return true;
  const headerToken = req.headers['x-lifehub-auth'];
  const queryToken = reqUrl.searchParams.get('token');
  const provided = typeof headerToken === 'string' ? headerToken : queryToken || '';
  if (!provided) return false;
  const providedHash = hashServerToken(provided);
  const a = Buffer.from(providedHash, 'utf-8');
  const b = Buffer.from(String(auth.api_token_hash), 'utf-8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function broadcastUpdate(updatedAt, clientId) {
  const payload = `data: ${JSON.stringify({ type: 'sync', updatedAt, clientId })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
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

ensureDbFile();

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-LifeHub-Auth');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (pathname === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        mode: 'lifehub-server',
        lanUrls: getLanUrls(PORT),
        time: new Date().toISOString(),
      })
    );
    return;
  }

  // Public auth status: returns ONLY lock metadata — NEVER returns tasks, expenses, or notes
  if (pathname === '/api/auth/status' && req.method === 'GET') {
    const record = readDbRecord();
    const auth = record.auth;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        locked: Boolean(auth && auth.enabled),
        hasData: Boolean(record.data),
        salt: auth?.enabled ? auth.salt : '',
        verify_hash: auth?.enabled ? auth.verify_hash : '',
        recovery_hash: auth?.enabled ? auth.recovery_hash : '',
        hint: auth?.enabled ? auth.hint || '' : '',
      })
    );
    return;
  }

  // Recovery key reset endpoint for LAN devices
  if (pathname === '/api/auth/recover' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf-8');
    });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      try {
        const { recoveryHash, newAuth } = JSON.parse(body);
        const record = readDbRecord();
        if (!record.auth || !record.auth.recovery_hash) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'No recovery lock configured' }));
          return;
        }
        const a = Buffer.from(String(recoveryHash || ''), 'utf-8');
        const b = Buffer.from(String(record.auth.recovery_hash), 'utf-8');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Invalid recovery key' }));
          return;
        }
        const nextRecord = {
          ...record,
          auth: newAuth,
          data: record.data ? { ...record.data, security: newAuth } : record.data,
          updatedAt: new Date().toISOString(),
        };
        writeDbRecord(nextRecord);
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  if (pathname === '/api/events') {
    const record = readDbRecord();
    if (!isAuthorized(req, reqUrl, record)) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Verification required' }));
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  if (pathname === '/api/sync') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const existing = readDbRecord();

    if (!isAuthorized(req, reqUrl, existing)) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'Verification required' }));
      return;
    }

    if (req.method === 'GET') {
      res.statusCode = 200;
      res.end(JSON.stringify({ version: 1, updatedAt: existing.updatedAt, data: existing.data }));
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString('utf-8');
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const nextAuth = payload.data?.security || existing.auth || null;
          const record = {
            version: 1,
            updatedAt: payload.updatedAt || new Date().toISOString(),
            auth: nextAuth,
            data: payload.data,
          };
          writeDbRecord(record);
          broadcastUpdate(record.updatedAt, payload.clientId || null);
          res.statusCode = 200;
          res.end(JSON.stringify({ ok: true, updatedAt: record.updatedAt }));
        } catch (err) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: err?.message || 'Invalid JSON' }));
        }
      });
      return;
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
  console.log('\n  LifeHub is running!');
  console.log(`  PC:      http://localhost:${PORT}`);
  if (lanUrls.length > 0) {
    lanUrls.forEach((url) => console.log(`  Android: ${url}  (open on phone over same Wi-Fi)`));
  }
  console.log(`  Data:    ${DB_FILE}\n`);
});
