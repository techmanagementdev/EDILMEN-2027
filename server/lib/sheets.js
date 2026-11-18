// Lettura di file Excel/CSV caricati dall'admin in righe {intestazione: valore}.
import ExcelJS from 'exceljs';

const cellVal = (c) => {
  if (c == null) return null;
  if (typeof c === 'object') {
    if (c instanceof Date) return c.toISOString().slice(0, 10);
    if ('result' in c) return c.result ?? null;
    if ('richText' in c) return c.richText.map((t) => t.text).join('');
    if ('text' in c) return c.text;
    if ('hyperlink' in c) return c.hyperlink;
  }
  return c;
};

function parseCsv(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const out = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') inQ = false; else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out.filter((r) => r.some((x) => String(x).trim()));
}

// Restituisce [{...}] usando come intestazione la prima riga che contiene almeno `minHeaders` celle di testo.
export async function readTable(file, { sheet = null, mustHave = [] } = {}) {
  let grid = [];
  if (/\.csv$/i.test(file.originalname) || /text\/csv/.test(file.mimetype)) {
    grid = parseCsv(file.buffer.toString('utf8').replace(/^﻿/, ''));
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer);
    const ws = (sheet && wb.getWorksheet(sheet)) || wb.worksheets[0];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const arr = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => { arr[col - 1] = cellVal(cell.value); });
      grid.push(arr);
    });
  }
  const low = (s) => String(s || '').trim().toLowerCase();
  let h = grid.findIndex((r) => mustHave.every((m) => r.some((c) => low(c).includes(m))));
  if (h < 0) h = 0;
  const head = grid[h].map((x) => low(x));
  return grid.slice(h + 1).map((r) => Object.fromEntries(head.map((k, i) => [k, r[i] == null ? null : String(r[i]).trim()]).filter(([k]) => k)));
}

export const pick = (row, ...names) => {
  for (const n of names) {
    const k = Object.keys(row).find((x) => x === n || x.startsWith(n));
    if (k && row[k]) return row[k];
  }
  return null;
};
