// Abbonamenti delle imprese: piano effettivo, prova gratuita, funzioni sbloccate.
import { one, q } from './db.js';
import { getSetting } from './data.js';

const today = () => new Date().toISOString().slice(0, 10);

export async function planOf(company) {
  const plans = await getSetting('plans');
  const byId = Object.fromEntries(plans.map((p) => [p.id, p]));
  const t = today();
  let id = 'free', source = 'gratuito';
  if (company.trial_until && String(company.trial_until).slice(0, 10) >= t) { id = 'plus'; source = 'prova'; }
  if (company.plan && company.plan !== 'free' && company.subscription_status === 'attivo' && (!company.plan_until || String(company.plan_until).slice(0, 10) >= t)) {
    // un abbonamento pagato vale più della prova solo se è Plus o se la prova è finita
    if (source !== 'prova' || company.plan === 'plus') { id = company.plan; source = 'abbonamento'; }
  }
  const plan = byId[id] || byId.free || { id: 'free', caps: {} };
  return { id, name: plan.name, source, caps: plan.caps || {}, trial_until: company.trial_until, plan_until: company.plan_until, subscribed: company.plan, status: company.subscription_status };
}

export async function can(company, cap) {
  const p = await planOf(company);
  return !!p.caps[cap];
}

export async function startTrial(companyId) {
  const days = (await getSetting('trial_days')) || 30;
  await q(`UPDATE companies SET trial_until = current_date + $2::int, subscription_status = CASE WHEN subscription_status='nessuno' THEN 'prova' ELSE subscription_status END
           WHERE id=$1 AND trial_until IS NULL`, [companyId, days]);
}

// Middleware: blocca le funzioni non incluse nel piano, con un messaggio chiaro.
export const requireCap = (cap) => async (req, res, next) => {
  const c = await one('SELECT * FROM companies WHERE id=$1', [req.user.company_id]);
  if (!c) return res.status(400).json({ error: 'Impresa non trovata' });
  if (!(await can(c, cap))) return res.status(402).json({ error: 'Questa funzione è inclusa nel piano Plus. Attivalo da «Abbonamento».', upgrade: true });
  req.company = c;
  next();
};

export async function trackView(companyId, field = 'views') {
  if (!['views', 'in_quotes'].includes(field)) return;
  await q(`INSERT INTO profile_stats(company_id, day, ${field}) VALUES ($1, current_date, 1)
           ON CONFLICT (company_id, day) DO UPDATE SET ${field} = profile_stats.${field} + 1`, [companyId]);
}
