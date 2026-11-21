import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'lifehub-db.json');

function ensureDbFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ version: 1, updatedAt: null, data: null }, null, 2), 'utf-8');
  }
}

function localSyncApiPlugin() {
  return {
    name: 'lifehub-local-sync-api',
    configureServer(server: any) {
      ensureDbFile();

      server.middlewares.use('/api/sync', (req: any, res: any, next: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');

        if (req.method === 'GET') {
          try {
            ensureDbFile();
            const raw = fs.readFileSync(DB_FILE, 'utf-8');
            res.statusCode = 200;
            res.end(raw);
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err?.message || 'Failed to read database' }));
          }
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
