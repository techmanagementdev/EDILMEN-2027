// Copia 1:1 di www.edilmen.it: scarica pagine, script, stili, immagini e font e li salva in legacy/site.
// Si esegue su GitHub Actions (workflow "Copia edilmen.it"), che ha accesso a internet.
import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://www.edilmen.it';
const OUT = path.resolve('legacy/site');
const MAX = Number(process.env.MAX_FILES || 8000);
const seeds = ['/', '/index.html', '/app.html', '/admin', '/admin.html', '/aziende.html', '/rivendica.html', '/blog.html', '/sitemap.xml', '/robots.txt', '/site.webmanifest', '/favicon.ico', '/favicon.svg', '/favicon-32x32.png', '/favicon-16x16.png', '/apple-touch-icon.png', '/imprese/vetrina.json', '/404.html', '/js/preventivo.js', '/js/flusso.js', '/js/testi.js', '/js/vocale.js', '/css/preventivo.css', '/css/imprese.css', '/audio/spot-edilmen.mp3', '/video/cantiere-al-contrario.mp4', '/video/cantiere-al-contrario-mobile.mp4', '/img/home-squadra.webp', '/img/mascotte.jpg', '/img/operaio.jpg'];
const TEXT = /html|css|javascript|json|xml|text\/|manifest|svg/;
const seen = new Set();
const queue = [...seeds];
const manifest = [];

const clean = (raw, base) => {
  if (!raw) return null;
  raw = raw.trim().split(/\s+/)[0];
  if (/^(data:|mailto:|tel:|javascript:|#|blob:)/i.test(raw) || raw.includes('${') || raw.includes('%7B')) return null;
  let u;
  try { u = new URL(raw, ORIGIN + base); } catch { return null; }
  if (!/^(www\.)?edilmen\.it$/.test(u.hostname)) return null;
  return decodeURI(u.pathname);
};

function fileFor(p, ct) {
  let f = p;
  if (f.endsWith('/')) f += 'index.html';
  else if (!path.extname(f) && /html/.test(ct)) f += '/index.html';
  else if (!path.extname(f) && /json/.test(ct)) f += '.json';
  return path.join(OUT, f);
}

function links(body, base) {
  const out = [];
  const re = /(?:href|src|data-src|poster|action|content)\s*=\s*["']([^"']+)["']|srcset\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)|["'`](\/[A-Za-z0-9_\-./%]+\.(?:html|js|mjs|css|webp|jpe?g|png|gif|svg|woff2?|ttf|otf|ico|json|mp4|webm|mp3|pdf|xml|txt|webmanifest))["'`]|["'`](\/(?:prezzi|imprese|blog|imprese-edili|rivendica|privacy|termini|rating|aziende|admin|app)[A-Za-z0-9_\-./]*)["'`]|<loc>([^<]+)<\/loc>|@import\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(body))) {
    if (m[2]) { m[2].split(',').forEach((s) => out.push(clean(s, base))); continue; }
    out.push(clean(m[1] || m[3] || m[4] || m[5] || m[6] || m[7], base));
  }
  // percorsi relativi caricati dagli script (es. 'js/preventivo.js'): sono relativi alla radice del sito
  const rel = /["'`]((?:js|css|img|audio|video|fonts|data|foto)\/[A-Za-z0-9_\-./]+\.(?:js|mjs|css|json|webp|jpe?g|png|gif|svg|mp4|webm|mp3|pdf|woff2?))["'`]/g;
  while ((m = rel.exec(body))) out.push(clean('/' + m[1], '/'));
  return out.filter(Boolean);
}

async function fetchOne(p) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(ORIGIN + encodeURI(p), { redirect: 'manual', headers: { 'user-agent': 'EdilMen-copia/1.0' } });
      return r;
    } catch (e) { await new Promise((s) => setTimeout(s, 800 * (i + 1))); }
  }
  return null;
}

async function work(p) {
  const r = await fetchOne(p);
  if (!r) { manifest.push({ path: p, status: 'ERR' }); return; }
  if (r.status >= 300 && r.status < 400) {
    const loc = r.headers.get('location');
    manifest.push({ path: p, status: r.status, location: loc });
    const n = clean(loc, p);
    if (n && !seen.has(n)) { seen.add(n); queue.push(n); }
    return;
  }
  const ct = (r.headers.get('content-type') || '').split(';')[0];
  manifest.push({ path: p, status: r.status, type: ct });
  if (r.status !== 200) return;
  const f = fileFor(p, ct);
  await fs.mkdir(path.dirname(f), { recursive: true });
  if (TEXT.test(ct) || /\.(html|js|css|json|xml|svg|txt)$/.test(p)) {
    const body = await r.text();
    await fs.writeFile(f, body);
    for (const l of links(body, p)) if (!seen.has(l)) { seen.add(l); queue.push(l); }
  } else {
    await fs.writeFile(f, Buffer.from(await r.arrayBuffer()));
  }
}

await fs.rm(OUT, { recursive: true, force: true });
seeds.forEach((s) => seen.add(s));
let done = 0;
while (queue.length && done < MAX) {
  const batch = queue.splice(0, 12);
  await Promise.all(batch.map(work));
  done += batch.length;
  if (done % 240 < 12) console.log(`${done} file, ${queue.length} in coda`);
}
manifest.sort((a, b) => a.path.localeCompare(b.path));
await fs.writeFile(path.resolve('legacy/manifest.json'), JSON.stringify({ origin: ORIGIN, copiedAt: new Date().toISOString(), files: manifest }, null, 1));
console.log(`Fatto: ${done} percorsi, ${queue.length} rimasti in coda`);
