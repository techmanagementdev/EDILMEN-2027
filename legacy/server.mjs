// Server della copia identica di edilmen.it: serve i file copiati così come sono.
// Le chiamate /api/* (funzioni del sito attuale) vengono girate al sito originale finché non le riscriviamo qui.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(here, 'site');
const ORIGIN = process.env.LEGACY_ORIGIN || 'https://www.edilmen.it';
const app = express();
app.disable('x-powered-by');

// Redirect registrati durante la copia
const redirects = new Map();
try {
  const m = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
  for (const f of m.files) if (f.location) redirects.set(f.path, f.location.replace(/^https?:\/\/(www\.)?edilmen\.it/, ''));
} catch {}

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use('/api', express.raw({ type: '*/*', limit: '25mb' }), async (req, res) => {
  try {
    const headers = { ...req.headers };
    delete headers.host; delete headers['content-length']; delete headers['accept-encoding'];
    const r = await fetch(ORIGIN + req.originalUrl, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body, redirect: 'manual' });
    res.status(r.status);
    r.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) res.setHeader(k, v); });
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.status(502).json({ error: 'Servizio non raggiungibile' });
  }
});

app.use((req, res, next) => {
  const to = redirects.get(req.path);
  if (to && to !== req.path) return res.redirect(301, to + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));
  next();
});

app.use(express.static(SITE, { extensions: ['html'], index: 'index.html', redirect: false }));

// /percorso -> /percorso/index.html
app.use((req, res, next) => {
  const p = path.join(SITE, decodeURIComponent(req.path), 'index.html');
  if (p.startsWith(SITE) && fs.existsSync(p)) return res.sendFile(p);
  next();
});

app.use((req, res) => {
  const nf = [path.join(SITE, '404.html'), path.join(SITE, '404', 'index.html')].find((f) => fs.existsSync(f));
  res.status(404);
  if (nf) return res.sendFile(nf);
  res.send('Pagina non trovata');
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Copia edilmen.it in ascolto su', port));
