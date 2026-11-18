import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { one, q } from './db.js';

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) console.warn('[auth] SESSION_SECRET non impostata: le sessioni scadono a ogni riavvio');
const COOKIE = 'em27';
const isProd = process.env.NODE_ENV === 'production';

export const hash = (pw) => bcrypt.hash(pw, 11);
export const check = (pw, h) => bcrypt.compare(pw, h);

export function setSession(res, user) {
  const token = jwt.sign({ uid: user.id, role: user.role }, SECRET, { expiresIn: '30d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 30 * 86400 * 1000, path: '/' });
}
export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export async function loadUser(req, _res, next) {
  const t = req.cookies?.[COOKIE];
  if (t) {
    try {
      const p = jwt.verify(t, SECRET);
      const u = await one('SELECT id, email, name, phone, role, company_id, agency_id, active FROM users WHERE id=$1', [p.uid]);
      if (u && u.active) req.user = u;
    } catch { /* sessione non valida */ }
  }
  next();
}

export const requireAuth = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Accedi per continuare' });
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Non hai i permessi per questa sezione' });
  next();
};
export const isStaff = (u) => u && (u.role === 'admin' || u.role === 'operatore');

export async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const pw = process.env.ADMIN_PASSWORD;
  if (!email || !pw) {
    console.warn('[auth] ADMIN_EMAIL / ADMIN_PASSWORD non impostate: nessun admin creato');
    return;
  }
  const u = await one('SELECT id FROM users WHERE email=$1', [email]);
  if (!u) {
    await q("INSERT INTO users(email, password_hash, name, role) VALUES ($1,$2,'Amministrazione EdilMen','admin')", [email, await hash(pw)]);
    console.log('[auth] admin creato:', email);
  }
}
