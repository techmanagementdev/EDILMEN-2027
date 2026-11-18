// Genera server/seed/catalogo.json dal file Excel del listino EdilMen.
// Uso: node scripts/build-seed-catalog.js percorso/del/listino.xlsx
import fs from 'node:fs';
import { importListino } from '../server/lib/import-listino.js';
const file = process.argv[2];
if (!file) { console.error('Indica il file .xlsx'); process.exit(1); }
const cat = await importListino(fs.readFileSync(file));
fs.writeFileSync(new URL('../server/seed/catalogo.json', import.meta.url), JSON.stringify(cat));
console.log(`${cat.packages.length} pacchetti, ${cat.variants.length} varianti, SAL ${cat.params.sal.length}`);
