import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'lifehub-db.json');

function ensureDbFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ version: 1, updatedAt: null, auth: null, data: null }, null, 2), 'utf-8');
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

function isAuthorized(req: any, record: any) {
  const auth = record.auth;
  if (!auth || !auth.enabled || !auth.api_token_hash) return true;
  const provided = typeof req.headers['x-lifehub-auth'] === 'string' ? req.headers['x-lifehub-auth'] : '';
  if (!provided) return false;
  const hash = crypto.createHash('sha256').update(`server-token:${provided}`).digest('hex');
  const a = Buffer.from(hash, 'utf-8');
  const b = Buffer.from(String(auth.api_token_hash), 'utf-8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function localSyncApiPlugin() {
  return {
    name: 'lifehub-local-sync-api',
    configureServer(server: any) {
      ensureDbFile();

      server.middlewares.use('/api/auth/status', (_req: any, res: any) => {
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
      });

      server.middlewares.use('/api/auth/recover', (req: any, res: any) => {
        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf-8');
        });
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { recoveryHash, newAuth } = JSON.parse(body);
            const record = readDbRecord();
            if (!record.auth || record.auth.recovery_hash !== recoveryHash) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Invalid recovery key' }));
              return;
            }
            const next = {
              ...record,
              auth: newAuth,
              data: record.data ? { ...record.data, security: newAuth } : record.data,
              updatedAt: new Date().toISOString(),
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(next, null, 2), 'utf-8');
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid request' }));
          }
        });
      });

      server.middlewares.use('/api/sync', (req: any, res: any, next: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        const existing = readDbRecord();

        if (!isAuthorized(req, existing)) {
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
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString('utf-8');
          });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              ensureDbFile();
              const tmpFile = `${DB_FILE}.tmp`;
              const record = {
                version: 1,
                updatedAt: payload.updatedAt || new Date().toISOString(),
                auth: payload.data?.security || existing.auth || null,
                data: payload.data,
              };
              fs.writeFileSync(tmpFile, JSON.stringify(record, null, 2), 'utf-8');
              fs.renameSync(tmpFile, DB_FILE);
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, updatedAt: record.updatedAt }));
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err?.message || 'Invalid JSON payload' }));
            }
          });
          return;
        }

        next();
      });

      server.middlewares.use('/api/health', (_req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, mode: 'dev-local-sync', time: new Date().toISOString() }));
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
