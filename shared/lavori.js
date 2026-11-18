// I lavori che il cliente può scegliere nel quotatore, tradotti in pacchetti del listino.
// Ogni lavoro fa solo le domande che servono davvero (regola "un quindicenne deve saper rispondere").
// casa = { mq, piani, tipo }  ·  a = risposte specifiche del lavoro

export const GROUPS = [
  { id: 'casa', label: 'Ristrutturare casa', icon: '🏠' },
  { id: 'ambienti', label: 'Singoli ambienti e finiture', icon: '🛁' },
  { id: 'impianti', label: 'Impianti', icon: '💡' },
  { id: 'energia', label: 'Risparmio energetico', icon: '🌱' },
  { id: 'esterni', label: 'Tetto, facciate, esterni', icon: '🏚️' },
  { id: 'nuova', label: 'Costruire o ampliare', icon: '🏗️' },
];

const facciata = (c) => Math.round(Math.sqrt((c.mq || 90) / (c.piani || 1)) * 4 * 2.9 * (c.piani || 1) * 0.85);
const falda = (c) => Math.round(((c.mq || 90) / (c.piani || 1)) * 1.15);

export const LAVORI = [
  // --- Casa
  {
    id: 'completa', group: 'casa', icon: '🏠', label: 'Ristrutturazione completa', sub: 'Tutta la casa, impianti compresi, chiavi in mano',
    ask: [
      { id: 'bagni', label: 'Quanti bagni avrà la casa?', type: 'count', min: 1, max: 6, def: 1 },
      { id: 'pavimento', label: 'Che pavimento preferisci?', type: 'choice', def: 'gres', options: [['gres', 'Gres / piastrelle'], ['parquet', 'Parquet'], ['boh', 'Non lo so ancora']] },
    ],
    lines: (a, c) => {
      const out = [{ pkg: 'R01', qty: c.mq || 85, variants: a.pavimento === 'parquet' ? ['VA03'] : [] }];
      const inclusi = Math.max(1, Math.round(((c.mq || 85) / 85) * 1.5));
      if ((a.bagni || 1) > inclusi) out.push({ pkg: 'R03', qty: a.bagni - inclusi, label: 'Bagno in più rispetto al pacchetto' });
      return out;
    },
  },
  {
    id: 'rinnovo', group: 'casa', icon: '✨', label: 'Rinnovo senza toccare gli impianti', sub: 'Pitture, pavimenti, porte: la casa come nuova',
    ask: [{ id: 'demolizione', label: 'Il pavimento vecchio va tolto?', type: 'choice', def: 'no', options: [['no', 'No, posa sopra il vecchio'], ['si', 'Sì, va demolito'], ['boh', 'Non lo so']] }],
    lines: (a, c) => [{ pkg: 'R02', qty: c.mq || 85, variants: a.demolizione === 'si' ? ['VA04'] : [] }],
  },
  {
    id: 'distribuzione', group: 'casa', icon: '🧱', label: 'Spostare o abbattere muri', sub: 'Nuova distribuzione degli spazi',
    ask: [{ id: 'mqParete', label: 'Quanti metri quadri di parete, circa?', type: 'number', unit: 'm²', def: 20, hint: 'Una parete di 4 m × 2,7 m ≈ 11 m².' }],
    lines: (a) => [{ pkg: 'R12', qty: a.mqParete || 20 }],
  },
  {
    id: 'sgombero', group: 'casa', icon: '📦', label: 'Sgombero e strip-out', sub: 'Svuotare e smontare prima dei lavori',
    ask: [], lines: (a, c) => [{ pkg: 'R24', qty: c.mq || 85 }],
  },
  // --- Ambienti e finiture
  {
    id: 'bagno', group: 'ambienti', icon: '🛁', label: 'Rifare il bagno', sub: 'Chiavi in mano: impianti, rivestimenti, sanitari',
    ask: [
      { id: 'n', label: 'Quanti bagni rifai?', type: 'count', min: 1, max: 5, def: 1 },
      { id: 'dim', label: 'Quanto è grande?', type: 'choice', def: 'medio', options: [['piccolo', 'Piccolo, fino a 4 m²'], ['medio', 'Medio, 4–7 m²'], ['grande', 'Grande, oltre 7 m²']] },
      { id: 'doccia', label: 'Doccia o vasca?', type: 'choice', def: 'doccia', options: [['doccia', 'Doccia'], ['vasca', 'Vasca'], ['boh', 'Non lo so']] },
    ],
    lines: (a) => {
      const v = [];
      if (a.dim === 'piccolo') v.push('VA06');
      if (a.doccia === 'vasca') v.push('VA05');
      const out = [{ pkg: 'R03', qty: a.n || 1, variants: v }];
      return out;
    },
  },
  {
    id: 'cucina', group: 'ambienti', icon: '🍳', label: 'Rifare la cucina', sub: 'Impianti e finiture (mobili esclusi)',
    ask: [], lines: () => [{ pkg: 'R04', qty: 1 }],
  },
  {
    id: 'pavimenti', group: 'ambienti', icon: '🪵', label: 'Pavimenti nuovi', sub: 'Fornitura e posa',
    ask: [
      { id: 'mq', label: 'Quanti m² di pavimento?', type: 'number', unit: 'm²', defFrom: 'mq' },
      { id: 'tipo', label: 'Che materiale?', type: 'choice', def: 'gres', options: [['gres', 'Gres / piastrelle'], ['parquet', 'Parquet']] },
    ],
    lines: (a, c) => [{ pkg: 'R05', qty: a.mq || c.mq || 60, variants: a.tipo === 'parquet' ? ['VA07'] : [] }],
  },
  {
    id: 'pitture', group: 'ambienti', icon: '🎨', label: 'Pitture pareti e soffitti', sub: '2 mani, protezioni comprese',
    ask: [], lines: (a, c) => [{ pkg: 'R06', qty: c.mq || 85 }],
  },
  {
    id: 'cartongesso', group: 'ambienti', icon: '📐', label: 'Cartongesso e controsoffitti', sub: 'Pareti e controsoffitti',
    ask: [{ id: 'mq', label: 'Quanti m²?', type: 'number', unit: 'm²', def: 30 }],
    lines: (a) => [{ pkg: 'R11', qty: a.mq || 30 }],
  },
  {
    id: 'porte', group: 'ambienti', icon: '🚪', label: 'Porte interne', sub: 'Porte e telai',
    ask: [{ id: 'n', label: 'Quante porte?', type: 'count', min: 1, max: 20, def: 5 }],
    lines: (a) => [{ pkg: 'R09', qty: a.n || 5 }],
  },
  {
    id: 'finestre', group: 'ambienti', icon: '🪟', label: 'Finestre e serramenti', sub: 'Sostituzione con posa certificata',
    ask: [
      { id: 'n', label: 'Quante finestre o portefinestre?', type: 'count', min: 1, max: 40, def: 8 },
      { id: 'mat', label: 'Che materiale?', type: 'choice', def: 'pvc', options: [['pvc', 'PVC'], ['alluminio', 'Alluminio'], ['legnoalluminio', 'Legno-alluminio']] },
    ],
    // il pacchetto R10 è a m² di serramento: 1,9 m² medi a finestra
    lines: (a) => [{ pkg: 'R10', qty: (a.n || 8) * 1.9, variants: a.mat === 'alluminio' ? ['VA08'] : a.mat === 'legnoalluminio' ? ['VA09'] : [] }],
  },
  {
    id: 'blindato', group: 'ambienti', icon: '🔐', label: 'Portoncino blindato', sub: 'Sostituzione della porta d\'ingresso',
    ask: [], lines: () => [{ pkg: 'R25', qty: 1 }],
  },
  // --- Impianti
  {
    id: 'elettrico', group: 'impianti', icon: '💡', label: 'Impianto elettrico', sub: 'Nuovo completo o messa a norma',
    ask: [{ id: 'tipo', label: 'Cosa serve?', type: 'choice', def: 'nuovo', options: [['nuovo', 'Rifarlo tutto'], ['norma', 'Solo messa a norma']] }],
    lines: (a, c) => (a.tipo === 'norma' ? [{ pkg: 'R26', qty: 1 }] : [{ pkg: 'R07', qty: c.mq || 85 }]),
  },
  {
    id: 'idraulico', group: 'impianti', icon: '🚰', label: 'Impianto idraulico', sub: 'Acqua e scarichi di bagno e cucina',
    ask: [], lines: () => [{ pkg: 'R08', qty: 1 }],
  },
  {
    id: 'clima', group: 'impianti', icon: '❄️', label: 'Climatizzazione', sub: 'Split caldo/freddo',
    ask: [{ id: 'n', label: 'Quanti split (ambienti)?', type: 'count', min: 1, max: 10, def: 3 }],
    lines: (a) => [{ pkg: 'R14', qty: a.n || 3 }],
  },
  {
    id: 'caldaia', group: 'impianti', icon: '🔥', label: 'Caldaia a condensazione', sub: 'Sostituzione della caldaia',
    ask: [], lines: () => [{ pkg: 'R36', qty: 1 }],
  },
  {
    id: 'wallbox', group: 'impianti', icon: '🔌', label: 'Ricarica auto (wallbox)', sub: 'Punto di ricarica a casa',
    ask: [], lines: () => [{ pkg: 'R27', qty: 1 }],
  },
  {
    id: 'domotica', group: 'impianti', icon: '📱', label: 'Domotica e casa smart', sub: 'Luci, tapparelle, clima da app',
    ask: [{ id: 'tipo', label: 'Per chi?', type: 'choice', def: 'casa', options: [['casa', 'Casa smart'], ['anziani', 'Sicurezza per anziani']] }],
    lines: (a, c) => (a.tipo === 'anziani' ? [{ pkg: 'R35', qty: 1 }] : [{ pkg: 'R23', qty: c.mq || 85 }]),
  },
  // --- Energia
  {
    id: 'pdc', group: 'energia', icon: '🌡️', label: 'Pompa di calore', sub: 'Al posto della caldaia',
    ask: [{ id: 'tipo', label: 'Che sistema?', type: 'choice', def: 'pdc', options: [['pdc', 'Solo pompa di calore'], ['ibrido', 'Ibrido caldaia + pompa di calore'], ['boh', 'Non lo so']] }],
    lines: (a) => [{ pkg: 'R13', qty: 1, variants: a.tipo === 'ibrido' ? ['VA10'] : [] }],
  },
  {
    id: 'fv', group: 'energia', icon: '☀️', label: 'Fotovoltaico', sub: 'Pannelli, con o senza batteria',
    ask: [
      { id: 'bolletta', label: 'Quanto spendi di luce ogni 2 mesi?', type: 'number', unit: '€', def: 150, hint: 'Lo trovi in grande sulla prima pagina della bolletta.' },
      { id: 'batteria', label: 'Vuoi la batteria di accumulo?', type: 'choice', def: 'si', options: [['si', 'Sì'], ['no', 'No']] },
    ],
    lines: (a) => {
      const kw = Math.min(10, Math.max(3, Math.round((a.bolletta || 150) / 25)));
      if (a.batteria === 'no') return kw <= 4 ? [{ pkg: 'R19', qty: 1 }] : [{ pkg: 'R31', qty: 1, unitFactor: Math.max(1, kw / 6), label: `Fotovoltaico ${kw} kWp` }];
      if (kw <= 4) return [{ pkg: 'R19', qty: 1 }, { pkg: 'R20', qty: 5 }];
      if (kw <= 7) return [{ pkg: 'R32', qty: 1 }];
      return [{ pkg: 'R33', qty: 1 }];
    },
  },
  {
    id: 'cappotto', group: 'energia', icon: '🧥', label: 'Cappotto termico', sub: 'Isolamento delle facciate',
    ask: [
      { id: 'mq', label: 'Quanti m² di facciata? (se non lo sai, lo stimiamo noi)', type: 'number', unit: 'm²', defFn: 'facciata' },
      { id: 'iso', label: 'Che isolante?', type: 'choice', def: 'eps', options: [['eps', 'Standard (EPS)'], ['roccia', 'Lana di roccia'], ['legno', 'Fibra di legno'], ['interno', 'Interno (facciata vincolata)']] },
    ],
    lines: (a, c) => [{ pkg: 'R16', qty: a.mq || facciata(c), variants: { roccia: ['VA11'], legno: ['VA12'], interno: ['VA13'] }[a.iso] || [] }],
  },
  {
    id: 'sottotetto', group: 'energia', icon: '🏠', label: 'Isolare il sottotetto', sub: 'Meno dispersione dal tetto',
    ask: [], lines: (a, c) => [{ pkg: 'R18', qty: Math.round((c.mq || 90) / (c.piani || 1)) }],
  },
  {
    id: 'vmc', group: 'energia', icon: '🌬️', label: 'Ventilazione con recupero di calore', sub: 'Aria pulita senza aprire le finestre',
    ask: [{ id: 'n', label: 'Quanti apparecchi (stanze)?', type: 'count', min: 1, max: 10, def: 4 }],
    lines: (a) => [{ pkg: 'R15', qty: a.n || 4 }],
  },
  {
    id: 'boiler', group: 'energia', icon: '♨️', label: 'Scaldacqua a pompa di calore', sub: 'Acqua calda con meno energia',
    ask: [], lines: () => [{ pkg: 'R29', qty: 1 }],
  },
  // --- Esterni
  {
    id: 'tetto', group: 'esterni', icon: '🏚️', label: 'Rifare il tetto', sub: 'Con isolamento',
    ask: [
      { id: 'mq', label: 'Quanti m² di tetto? (se non lo sai, lo stimiamo noi)', type: 'number', unit: 'm²', defFn: 'falda' },
      { id: 'tipo', label: 'Com\'è il tetto?', type: 'choice', def: 'tegole', options: [['tegole', 'Tegole o coppi'], ['lamiera', 'Lamiera'], ['piano', 'Piano / terrazza']] },
    ],
    lines: (a, c) => [{ pkg: 'R17', qty: a.mq || falda(c), variants: a.tipo === 'lamiera' ? ['VA14'] : a.tipo === 'piano' ? ['VA15'] : [] }],
  },
  {
    id: 'facciata', group: 'esterni', icon: '🏢', label: 'Rifare la facciata', sub: 'Ripristino e tinteggiatura',
    ask: [{ id: 'mq', label: 'Quanti m² di facciata?', type: 'number', unit: 'm²', defFn: 'facciata' }],
    lines: (a, c) => [{ pkg: 'R21', qty: a.mq || facciata(c) }],
  },
  {
    id: 'terrazzo', group: 'esterni', icon: '☔', label: 'Impermeabilizzare terrazzo o balcone', sub: 'Stop infiltrazioni',
    ask: [{ id: 'mq', label: 'Quanti m²?', type: 'number', unit: 'm²', def: 20 }],
    lines: (a) => [{ pkg: 'R22', qty: a.mq || 20 }],
  },
  {
    id: 'giardino', group: 'esterni', icon: '🌳', label: 'Sistemazioni esterne', sub: 'Vialetti, cortile, giardino',
    ask: [{ id: 'mq', label: 'Quanti m² di area esterna?', type: 'number', unit: 'm²', def: 150 }],
    lines: (a) => [{ pkg: 'N12', qty: a.mq || 150 }],
  },
  // --- Nuova costruzione
  {
    id: 'casanuova', group: 'nuova', icon: '🏡', label: 'Casa nuova chiavi in mano', sub: 'Classe A, dal progetto alla consegna',
    ask: [
      { id: 'struttura', label: 'Che struttura?', type: 'choice', def: 'tradizionale', options: [['tradizionale', 'Muratura / cemento'], ['telaio', 'Legno a telaio'], ['xlam', 'Legno X-Lam']] },
      { id: 'classe', label: 'Che classe energetica?', type: 'choice', def: 'a', options: [['a', 'Classe A'], ['a4', 'A4 / CasaClima Gold']] },
    ],
    lines: (a, c) => {
      const v = [];
      if (a.struttura === 'telaio') v.push('VA16');
      if (a.struttura === 'xlam') v.push('VA17');
      if (a.classe === 'a4') v.push('VA18');
      if ((c.piani || 1) === 1) v.push('VA19');
      return [{ pkg: 'N01', qty: c.mq || 150, variants: v }];
    },
  },
  {
    id: 'rustico', group: 'nuova', icon: '🧱', label: 'Rustico / grezzo avanzato', sub: 'Struttura e involucro, finiture a parte',
    ask: [], lines: (a, c) => [{ pkg: 'N14', qty: c.mq || 150 }],
  },
  {
    id: 'ampliamento', group: 'nuova', icon: '➕', label: 'Ampliamento o sopraelevazione', sub: 'In legno, su casa esistente',
    ask: [{ id: 'mq', label: 'Quanti m² vuoi aggiungere?', type: 'number', unit: 'm²', def: 40 }],
    lines: (a) => [{ pkg: 'N15', qty: a.mq || 40 }],
  },
  {
    id: 'garage', group: 'nuova', icon: '🚗', label: 'Interrato o garage', sub: 'Piano interrato',
    ask: [{ id: 'mq', label: 'Quanti m²?', type: 'number', unit: 'm²', def: 60 }],
    lines: (a) => [{ pkg: 'N13', qty: a.mq || 60 }],
  },
  {
    id: 'demolizione', group: 'nuova', icon: '🏚️', label: 'Demolire il fabbricato esistente', sub: 'Per demolire e ricostruire',
    ask: [{ id: 'mc', label: 'Volume da demolire, circa (m³ vuoto per pieno)', type: 'number', unit: 'm³', def: 450, hint: 'Superficie × altezza: 150 m² × 3 m = 450 m³.' }],
    lines: (a) => [{ pkg: 'N16', qty: a.mc || 450 }],
  },
];

export const IMMOBILI = [
  ['appartamento', 'Appartamento', 'In condominio', '🏢'],
  ['casa', 'Casa indipendente', 'Villa, schiera, rustico', '🏡'],
  ['negozio', 'Negozio o ufficio', 'Locale commerciale', '🏪'],
  ['edificio', 'Intero edificio', 'Condominio, palazzina, hotel', '🏨'],
  ['terreno', 'Terreno', 'Per costruire da zero', '🌄'],
];

export function defaultFor(q, casa) {
  if (q.def != null) return q.def;
  if (q.defFrom === 'mq') return casa.mq || 60;
  if (q.defFn === 'facciata') return facciata(casa);
  if (q.defFn === 'falda') return falda(casa);
  return null;
}

// Traduce le risposte del quotatore nelle righe di pacchetto per il motore prezzi.
export function linesFromAnswers(answers) {
  const casa = { mq: Number(answers.mq) || 90, piani: Number(answers.piani) || 1, tipo: answers.immobile };
  const out = [];
  for (const id of answers.lavori || []) {
    const L = LAVORI.find((x) => x.id === id);
    if (!L) continue;
    const a = {};
    for (const q of L.ask) a[q.id] = (answers.dett?.[id] ?? {})[q.id] ?? defaultFor(q, casa);
    for (const line of L.lines(a, casa)) out.push({ ...line, from: id });
  }
  return out;
}
