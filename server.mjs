import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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
      JSON.stringify({ version: 1, updatedAt: null, data: null }, null, 2),
      'utf-8'
    );
  }
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

  // CORS for LAN/Capacitor access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

  if (pathname === '/api/events') {
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

    if (req.method === 'GET') {
      try {
        ensureDbFile();
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        res.statusCode = 200;
        res.end(raw);
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err?.message || 'Read failed' }));
      }
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
          ensureDbFile();
          const record = {
            version: 1,
            updatedAt: payload.updatedAt || new Date().toISOString(),
            data: payload.data,
          };
          const tmpFile = `${DB_FILE}.tmp`;
          fs.writeFileSync(tmpFile, JSON.stringify(record, null, 2), 'utf-8');
          fs.renameSync(tmpFile, DB_FILE);
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
