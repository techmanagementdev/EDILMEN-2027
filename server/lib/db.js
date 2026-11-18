import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
pg.types.setTypeParser(1700, (v) => (v == null ? null : Number(v))); // numeric → number

const url = process.env.DATABASE_URL;
if (!url) console.warn('[db] DATABASE_URL non impostata');
const ssl = url && !/localhost|127\.0\.0\.1|\.railway\.internal/.test(url) && process.env.PGSSL !== 'off' ? { rejectUnauthorized: false } : false;
export const pool = new pg.Pool({ connectionString: url, ssl, max: 10 });

export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
export const many = async (text, params) => (await pool.query(text, params)).rows;

export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

export async function migrate() {
  await q('CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())');
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const done = await one('SELECT 1 FROM _migrations WHERE name=$1', [f]);
    if (done) continue;
    await tx(async (c) => {
      await c.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await c.query('INSERT INTO _migrations(name) VALUES ($1)', [f]);
    });
    console.log('[db] migrazione applicata', f);
  }
}

export async function audit(userId, action, entity, entityId, data) {
  try {
    await q('INSERT INTO audit(user_id, action, entity, entity_id, data) VALUES ($1,$2,$3,$4,$5)', [userId || null, action, entity || null, entityId != null ? String(entityId) : null, data ? JSON.stringify(data) : null]);
  } catch (e) {
    console.error('[audit]', e.message);
  }
}
