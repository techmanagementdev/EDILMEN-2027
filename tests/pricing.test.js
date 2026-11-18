import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeQuote, feeFor, salPlan, territoryCoef, km } from '../shared/pricing.js';
import { linesFromAnswers } from '../shared/lavori.js';

const catalog = JSON.parse(fs.readFileSync(new URL('../server/seed/catalogo.json', import.meta.url)));

test('bagno medio, livello intermedio, Trento: coincide col sito attuale (9.636 €)', () => {
  const lines = linesFromAnswers({ lavori: ['bagno'], mq: 45, dett: { bagno: { n: 1, dim: 'medio', doccia: 'doccia' } } });
  const q = computeQuote(catalog, { level: 1, province: 'TN', lines, iva: 'nessuna' });
  assert.equal(Math.round(q.prudent.imponibile), 9636);
  assert.ok(q.range.min < q.range.max, 'la parte fissa è sotto il prudente');
});

test('varianti: vasca +4%, bagno piccolo −6%', () => {
  const a = computeQuote(catalog, { level: 1, province: 'TN', lines: [{ pkg: 'R03', qty: 1 }] });
  const b = computeQuote(catalog, { level: 1, province: 'TN', lines: [{ pkg: 'R03', qty: 1, variants: ['VA05', 'VA06'] }] });
  assert.equal(Math.round((b.prudent.lavori / a.prudent.lavori) * 10000) / 10000, Math.round(1.04 * 0.94 * 10000) / 10000);
});

test('variante non ammessa al livello Premium viene ignorata', () => {
  const a = computeQuote(catalog, { level: 2, province: 'TN', lines: [{ pkg: 'R05', qty: 10 }] });
  const b = computeQuote(catalog, { level: 2, province: 'TN', lines: [{ pkg: 'R05', qty: 10, variants: ['VA07'] }] });
  assert.equal(a.prudent.lavori, b.prudent.lavori);
});

test('coefficienti di zona e logistica', () => {
  assert.equal(territoryCoef(catalog.params, 'BZ').coef, 1.1);
  assert.equal(territoryCoef(catalog.params, 'UD').coef, 0.96);
  assert.equal(territoryCoef(catalog.params, 'MI').calibrated, false);
  const base = computeQuote(catalog, { level: 1, province: 'TN', lines: [{ pkg: 'R06', qty: 100 }] });
  const abit = computeQuote(catalog, { level: 1, province: 'TN', flags: ['abitata'], lines: [{ pkg: 'R06', qty: 100 }] });
  assert.equal(Math.round((abit.prudent.lavori / base.prudent.lavori) * 100) / 100, 1.08);
});

test('listino d\'impresa: usa i prezzi dell\'impresa e segnala i pacchetti mancanti', () => {
  const q = computeQuote(catalog, { level: 1, province: 'TN', lines: [{ pkg: 'R03', qty: 1 }, { pkg: 'R04', qty: 1 }] }, { R03: [null, 8000, null] });
  assert.deepEqual(q.missing, ['R04']);
  assert.equal(Math.round(q.fixed.lavori), 8000);
});

test('fee a scaglioni 8/6/4', () => {
  assert.equal(feeFor(30000).fee, 2400);
  assert.equal(feeFor(50000).fee, 4000);
  assert.equal(feeFor(100000).fee, 6000);
  assert.equal(feeFor(4000000).fee, 160000);
  const prog = feeFor(100000, { mode: 'progressive', brackets: [{ upTo: 50000, rate: 0.08 }, { upTo: 3000000, rate: 0.06 }, { upTo: null, rate: 0.04 }] });
  assert.equal(prog.fee, 4000 + 3000);
});

test('piano SAL somma al 100%', () => {
  const p = salPlan(100000, catalog.params.sal);
  assert.equal(p.reduce((s, x) => s + x.amount, 0), 100000);
  assert.equal(p.reduce((s, x) => s + x.fee, 0), 6000);
});

test('distanza Trento–Rovereto ~ 20 km', () => {
  const d = km({ lat: 46.0748, lon: 11.1217 }, { lat: 45.8906, lon: 11.0401 });
  assert.ok(d > 15 && d < 25);
});

test('ogni lavoro del quotatore produce righe valide', async () => {
  const { LAVORI } = await import('../shared/lavori.js');
  for (const L of LAVORI) {
    const lines = linesFromAnswers({ lavori: [L.id], mq: 100, piani: 2 });
    assert.ok(lines.length > 0, L.id);
    const q = computeQuote(catalog, { level: 1, province: 'TN', lines });
    assert.ok(q.prudent.totale > 0, L.id);
  }
});
