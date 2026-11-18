import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrate, one, pool } from './lib/db.js';
import { loadUser, ensureAdmin, isStaff } from './lib/auth.js';
import { getCatalog } from './lib/data.js';
import publicRoutes from './routes/public.js';
import { auth, me } from './routes/account.js';
import impresa from './routes/impresa.js';
import admin from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(loadUser);

app.get('/api/health', async (_req, res) => {
  try { await one('SELECT 1'); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
app.use('/api/public', publicRoutes);
app.use('/api/auth', auth);
app.use('/api/me', me);
app.use('/api/impresa', impresa);
app.use('/api/admin', admin);

// File (foto SAL, documenti, vocali): visibili allo staff, a chi li ha caricati e alle parti del contratto.
app.get('/api/files/:id', async (req, res) => {
  if (!req.user) return res.status(401).end();
  const f = await one('SELECT id, owner_user, mime, name, data FROM files WHERE id=$1', [req.params.id]);
  if (!f) return res.status(404).end();
  let ok = isStaff(req.user) || f.owner_user === req.user.id;
  if (!ok) {
    const rel = await one(`SELECT 1 FROM sal s JOIN contracts k ON k.id=s.contract_id JOIN requests r ON r.id=k.request_id
       WHERE $1 = ANY(s.photos) AND (k.client_user=$2 OR r.user_id=$2 OR k.company_id=$3) LIMIT 1`, [f.id, req.user.id, req.user.company_id || -1]);
    ok = !!rel;
  }
  if (!ok) return res.status(403).end();
  res.setHeader('Content-Type', f.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(f.name || 'file')}"`);
  res.send(f.data);
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Risorsa non trovata' }));

// SPA
const dist = path.join(__dirname, '..', 'web', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File troppo grande' : 'Errore interno: riprova' });
});

const port = Number(process.env.PORT) || 3000;
(async () => {
  await migrate();
  await ensureAdmin();
  await getCatalog();
  app.listen(port, () => console.log(`EdilMen 2027 in ascolto su :${port}`));
})().catch((e) => {
  console.error('Avvio fallito', e);
  pool.end();
  process.exit(1);
});
