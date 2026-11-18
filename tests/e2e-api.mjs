// Prova end-to-end dell'API contro un server in esecuzione (BASE=http://localhost:3077).
// Percorre: admin → impresa in rete con listino → richiesta dal sito → offerte reali → contratto → SAL → recensione → rating.
const BASE = process.env.BASE || 'http://localhost:3077';
const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@test.local', password: process.env.ADMIN_PASSWORD || 'admin12345' };
const stamp = Date.now().toString().slice(-6);

function client() {
  let cookie = '';
  const call = async (method, path, body, isForm = false) => {
    const r = await fetch(BASE + path, {
      method, headers: { ...(cookie ? { cookie } : {}), ...(body && !isForm ? { 'content-type': 'application/json' } : {}) },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { j = t; }
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t}`);
    return j;
  };
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b), put: (p, b) => call('PUT', p, b), patch: (p, b) => call('PATCH', p, b), form: (p, f) => call('POST', p, f, true) };
}
const ok = (c, m) => { if (!c) throw new Error('FALLITO: ' + m); console.log('✓', m); };

const admin = client();
await admin.post('/api/auth/login', ADMIN);
ok((await admin.get('/api/auth/me')).user.role === 'admin', 'login admin');

// Due imprese in rete a Trento e Rovereto
const vat1 = '9' + stamp + '1111', vat2 = '9' + stamp + '2222';
const c1 = await admin.post('/api/admin/companies', { name: `Impresa Prova Uno ${stamp}`, vat: vat1, comune: 'Trento', status: 'attiva', network: true, receive_requests: true, categories: ['Ristrutturazioni'], website: `https://uno${stamp}.it` });
const c2 = await admin.post('/api/admin/companies', { name: `Impresa Prova Due ${stamp}`, vat: vat2, comune: 'Rovereto', status: 'attiva', network: true, receive_requests: true, categories: ['Ristrutturazioni'] });
ok(c1.id && c2.id, 'imprese create');
await admin.post(`/api/admin/companies/${c1.id}/user`, { email: `uno${stamp}@test.local`, password: 'impresa123' });
const imp1 = client();
await imp1.post('/api/auth/login', { email: `uno${stamp}@test.local`, password: 'impresa123' });
const pr = await imp1.put('/api/impresa/prices', { prices: [{ pkg: 'R03', level: 1, price: 8200 }, { pkg: 'R03', level: 0, price: 6000 }, { pkg: 'R04', level: 1, price: 2500 }] });
ok(pr.saved === 3 && pr.toCheck === 1, 'listino impresa: R04 a −41% resta da controllare');

// Richiesta dal sito: bagno a Rovereto
const pub = client();
const sent = await pub.post('/api/public/requests', {
  answers: { lavori: ['bagno'], comune: 'Rovereto', provincia: 'TN', immobile: 'appartamento', mq: 70, level: 1, dett: { bagno: { n: 1, dim: 'medio', doccia: 'doccia' } } },
  contact: { name: 'TEST EMI', email: `cliente${stamp}@test.local`, channel: 'email' }, consents: { privacy: true, condivisione: true },
});
ok(sent.code && sent.match.auto === 1 && sent.match.invited === 1, `richiesta ${sent.code}: 1 offerta da listino, 1 invito`);
let view = await pub.get(`/api/public/requests/${sent.token}`);
ok(view.offers.length === 1 && Math.round(view.offers[0].amount) === Math.round(8200 * 1.1 * 1.025), 'offerta reale = listino impresa × accantonamento × sicurezza');
ok(!view.offers[0].company.name, 'impresa anonima prima dell\'appuntamento');

// La seconda impresa risponde all'invito
await admin.post(`/api/admin/companies/${c2.id}/user`, { email: `due${stamp}@test.local`, password: 'impresa123' });
const imp2 = client();
await imp2.post('/api/auth/login', { email: `due${stamp}@test.local`, password: 'impresa123' });
const opp = (await imp2.get('/api/impresa/opportunities')).find((o) => o.code === sent.code);
ok(opp && opp.status === 'invitata' && !opp.contact_email, 'invito ricevuto, senza contatti del cliente');
await imp2.post(`/api/impresa/opportunities/${opp.id}/respond`, { amount: 9900, start_days: 15, note: 'Disponibili da gennaio' });
view = await pub.get(`/api/public/requests/${sent.token}`);
ok(view.offers.length === 2 && view.offers[0].amount < view.offers[1].amount, 'due offerte reali ordinate per prezzo');

// Il cliente si registra e prenota il sopralluogo
const cli = client();
await cli.post('/api/auth/register', { role: 'cliente', email: `cliente${stamp}@test.local`, password: 'cliente123', name: 'TEST EMI', privacy: true, requestToken: sent.token });
const mine = await cli.get('/api/me/requests');
ok(mine.length === 1, 'richiesta collegata al nuovo account');
await cli.post(`/api/me/requests/${mine[0].id}/choose`, { offerId: view.offers[0].id, mode: 'sopralluogo', slot: 'lunedì mattina' });

// Aggiudicazione e contratto con fee 8% (sotto 50.000 €)
const det = await admin.get(`/api/admin/requests/${mine[0].id}`);
const best = det.offers.find((o) => o.status === 'inviata' && o.company_id === c1.id);
const k = await admin.post(`/api/admin/requests/${mine[0].id}/contract`, { offerId: best.id, value: 9000 });
ok(k.fee === 720, 'contratto 9.000 € → fee 8% = 720 €');

// SAL: l'impresa chiede con foto, il cliente approva
const ct = (await imp1.get('/api/impresa/contracts'))[0];
ok(ct.sal.length === 5, 'piano SAL in 5 tappe');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
for (const s of ct.sal) {
  const fd = new FormData();
  fd.append('photos', new Blob([png], { type: 'image/png' }), 'foto.png');
  fd.append('note', 'fatto');
  await imp1.form(`/api/impresa/sal/${s.id}/request`, fd);
  await cli.post(`/api/me/contracts/${ct.id}/sal/${s.id}`, { action: 'approva' });
}
const cdet = await cli.get(`/api/me/requests/${mine[0].id}`);
ok(cdet.sal.every((s) => s.status === 'approvato'), 'tutti i SAL approvati dal cliente');
ok(cdet.offers.some((o) => o.company.name), 'dopo il contratto il cliente vede il nome dell\'impresa');
await cli.post(`/api/me/contracts/${ct.id}/review`, { scores: { qualita: 5, puntualita: 4, preventivo: 5, pulizia: 5, comunicazione: 4 }, text: 'Lavoro fatto bene' });
const fees = await imp1.get('/api/impresa/fees');
ok(Math.round(fees.rows.reduce((s, r) => s + r.fee, 0)) === 720, 'estratto fee impresa = 720 €');

// Dashboard admin
const d = await admin.get('/api/admin/dashboard');
ok(d.k.gmv >= 9000 && d.k.recensioni >= 1, 'dashboard con dati veri (GMV, recensioni da verificare)');

// Rating: non pubblicato con una sola recensione
const rv = (await admin.get('/api/admin/reviews')).find((x) => x.company_id === c1.id);
await admin.patch(`/api/admin/reviews/${rv.id}`, { status: 'pubblicata' });
const comp = await admin.get(`/api/admin/companies/${c1.id}`);
ok(comp.rating.published === false && comp.rating.missing.length === 2, 'rating in costruzione: servono altre 2 recensioni e la visura');

// Agenzia: immobile, stima e report condivisibile
const ag = client();
await ag.post('/api/auth/register', { role: 'agenzia', email: `agenzia${stamp}@test.local`, password: 'agenzia123', name: 'Agente Test', orgName: `Agenzia Test ${stamp}`, comune: 'Trento', privacy: true });
const prop = await ag.post('/api/me/properties', { title: 'Trilocale via Test', comune: 'Trento', mq: 85, piani: 1, tipo: 'appartamento', price_ask: 250000 });
const est = await ag.post('/api/me/estimates', { propertyId: prop.id, answers: { lavori: ['completa'], comune: 'Trento', mq: 85, level: 1, dett: { completa: { bagni: 2 } } } });
const rep = await pub.get(`/api/public/report/${est.token}`);
ok(rep.quote.prudent.imponibile > 40000 && rep.agency.name.includes('Agenzia Test'), 'report agenzia pubblico con stima');
const adminList = await admin.get('/api/admin/requests');
ok(!adminList.rows.some((r) => r.code === est.code), 'le stime delle agenzie non intasano le richieste admin');

// Grande operazione su computo
const gc = await ag.post('/api/me/computo', { title: 'Condominio test: rifacimento facciata', comune: 'Trento', items: [{ desc: 'Ponteggio', unit: 'm²', qty: 800 }, { desc: 'Rasatura e pittura facciata', unit: 'm²', qty: 750 }] });
await admin.post(`/api/admin/requests/${gc.id}/invite`, { companyIds: [c1.id, c2.id] });
const o1 = (await imp1.get('/api/impresa/opportunities')).find((o) => o.code === gc.code);
await imp1.post(`/api/impresa/opportunities/${o1.id}/respond`, { items: [{ n: 1, price: 12 }, { n: 2, price: 40 }] });
const o2 = (await imp2.get('/api/impresa/opportunities')).find((o) => o.code === gc.code);
await imp2.post(`/api/impresa/opportunities/${o2.id}/respond`, { items: [{ n: 1, price: 8 }, { n: 2, price: 52 }] });
const cmp = (await ag.get(`/api/me/requests/${gc.id}`)).comparison;
ok(cmp.offers.length === 2 && cmp.items[0].prices.length === 2, 'confronto voce per voce del computo');

console.log('\nTUTTO OK');
