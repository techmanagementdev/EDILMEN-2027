/* EdilMen · moto della home e della quotazione (23/11/2026)
   Motion (motion.dev) per entrate, scroll e gesti; anime.js per tracciati SVG,
   tacche del metro, barre del rating e cifre a palette.
   Tutto si spegne con "riduci movimento". Non tocca testi né logica del sito. */
import { animate, inView, scroll, stagger } from 'motion';
import { animate as aAnimate } from 'animejs/animation';
import { stagger as aStagger } from 'animejs/utils';
import * as aSvg from 'animejs/svg';

const ridotto = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = [0.22, 1, 0.36, 1];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';

document.documentElement.classList.add('edm-moto');
if (ridotto) document.documentElement.classList.add('edm-fermo');

/* ---------- 1. testata che si fa da parte ---------- */
function testata() {
  const h = $('.hdr'); if (!h) return;
  let ultimo = scrollY, nascosta = false;
  const su = () => {
    const y = scrollY;
    h.classList.toggle('edm-scrolled', y > 8);
    if (ridotto || document.body.classList.contains('wz-open')) { ultimo = y; return; }
    const giu = y > ultimo + 4, sale = y < ultimo - 4;
    if (giu && y > 520 && !nascosta) { nascosta = true; animate(h, { y: '-100%' }, { duration: 0.28, ease: EASE }); }
    else if (sale && nascosta) { nascosta = false; animate(h, { y: 0 }, { duration: 0.32, ease: EASE }); }
    ultimo = y;
  };
  addEventListener('scroll', su, { passive: true }); su();
}

/* ---------- 2. hero ---------- */
function paroleIn(el) {
  // divide il titolo in parole mascherate, senza cambiare il testo
  const parole = [];
  const giro = (n) => {
    [...n.childNodes].forEach((c) => {
      if (c.nodeType === 3) {
        const pezzi = c.textContent.split(/(\s+)/);
        const fr = document.createDocumentFragment();
        pezzi.forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) { fr.appendChild(document.createTextNode(p)); return; }
          const w = document.createElement('span'); w.className = 'edm-w';
          const i = document.createElement('span'); i.className = 'edm-wi'; i.textContent = p;
          w.appendChild(i); fr.appendChild(w); parole.push(i);
        });
        c.replaceWith(fr);
      } else if (c.nodeType === 1) giro(c);
    });
  };
  giro(el);
  return parole;
}

function tratto(span) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('class', 'edm-tratto'); s.setAttribute('viewBox', '0 0 300 20'); s.setAttribute('preserveAspectRatio', 'none'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M3 14 C 60 6, 130 4, 200 8 S 280 12, 297 7');
  s.appendChild(p); span.appendChild(s);
  return p;
}

function hero() {
  const h1 = $('.hero h1'); if (!h1) return;
  const blu = $('.h-blu', h1);
  const parole = ridotto ? [] : paroleIn(h1);
  const linea = blu ? tratto(blu) : null;
  const via = () => document.documentElement.classList.remove('edm-pre');
  if (ridotto) return via();
  const pezzi = ['.hero .kick', '.hero .lead', '.hero .pick', '.hero .punti', '.hero .net'].map((s) => $(s)).filter(Boolean);
  pezzi.forEach((e) => (e.style.opacity = 0));
  animate(parole, { y: ['105%', '0%'], opacity: [0, 1] }, { duration: 0.7, delay: stagger(0.045, { startDelay: 0.12 }), ease: EASE });
  animate(pezzi, { opacity: [0, 1], y: [12, 0] }, { duration: 0.6, delay: stagger(0.08, { startDelay: 0.3 }), ease: EASE });
  requestAnimationFrame(via);
  if (linea) {
    const [d] = aSvg.createDrawable(linea);
    aAnimate(d, { draw: ['0 0', '0 1'], duration: 900, delay: 750, ease: 'outCubic' });
  }
  const carte = $$('.pick-cat > button');
  if (carte.length) animate(carte, { opacity: [0, 1], y: [8, 0] }, { duration: 0.45, delay: stagger(0.05, { startDelay: 0.55 }), ease: EASE });

  // mappa: la scheda sale, i confini si disegnano, le etichette arrivano
  const card = $('#mapcard');
  if (card) {
    animate(card, { opacity: [0, 1], y: [16, 0], scale: [0.985, 1] }, { duration: 0.8, delay: 0.2, ease: EASE });
    const regs = $$('#heromap .reg');
    if (regs.length) {
      const dr = aSvg.createDrawable(regs);
      aAnimate(dr, { draw: ['0 0', '0 1'], duration: 1400, delay: aStagger(180, { start: 350 }), ease: 'inOutQuad' });
      aAnimate(regs, { fillOpacity: [0, 1], duration: 700, delay: aStagger(180, { start: 1100 }), ease: 'outQuad' });
    }
    const altri = $$('#heromap .lbl, #heromap .citta, #heromap .m-pin');
    if (altri.length) animate(altri, { opacity: [0, 1] }, { duration: 0.5, delay: stagger(0.03, { startDelay: 1.2 }) });
    const badge = $$('.badge-r', card);
    if (badge.length) animate(badge, { opacity: [0, 1], y: [10, 0] }, { duration: 0.55, delay: stagger(0.15, { startDelay: 1.5 }), ease: EASE });
  }
}

/* ---------- 3. firma: il metro da cantiere ---------- */
const NUMERATE = [
  ['lavori', '.list-head'], ['pacchetti', '.c3d-kick'], ['vetrina', '.list-head'], ['come', 'h2'],
  ['rating', 'h2'], ['storia', 'h2'], ['guide', '.list-head'], ['domande', 'h2'],
];
function metro() {
  const voci = [];
  NUMERATE.forEach(([id, sel], i) => {
    const sez = document.getElementById(id); if (!sez) return;
    const dove = $(sel, sez); if (!dove) return;
    const n = String(i + 1).padStart(2, '0');
    const m = document.createElement('div'); m.className = 'edm-metro'; m.setAttribute('aria-hidden', 'true');
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 132 12');
    for (let k = 0; k <= 22; k++) {
      const l = document.createElementNS(NS, 'line'); const x = k * 6 + 0.5;
      const lg = k % 5 === 0; l.setAttribute('x1', x); l.setAttribute('x2', x);
      l.setAttribute('y1', lg ? 0 : 6); l.setAttribute('y2', 12); if (lg) l.setAttribute('class', 'lg');
      s.appendChild(l);
    }
    m.innerHTML = `<span class="n">${n}</span>`; m.appendChild(s);
    dove.parentNode.insertBefore(m, dove);
    const titolo = ($('h2', sez) || {}).textContent || '';
    voci.push({ id, n, titolo: titolo.trim().replace(/\.$/, ''), sez, m });
    if (!ridotto) {
      const linee = $$('line', s);
      linee.forEach((l) => (l.style.transform = 'scaleY(0)'));
      inView(m, () => {
        aAnimate(linee, { scaleY: [0, 1], duration: 520, delay: aStagger(18), ease: 'outCubic' });
        animate($('.n', m), { opacity: [0, 1], x: [-6, 0] }, { duration: 0.4, ease: EASE });
      }, { amount: 0.6 });
    }
  });
  indice(voci);
}

function indice(voci) {
  if (!voci.length) return;
  const nav = document.createElement('nav'); nav.className = 'edm-indice'; nav.setAttribute('aria-label', 'Sezioni della pagina');
  voci.forEach((v) => {
    const a = document.createElement('a'); a.href = '#' + v.id;
    a.innerHTML = `<span>${v.n} ${v.titolo}</span><i></i>`;
    a.addEventListener('click', (e) => { e.preventDefault(); v.sez.scrollIntoView({ behavior: ridotto ? 'auto' : 'smooth', block: 'start' }); });
    nav.appendChild(a); v.a = a;
  });
  document.body.appendChild(nav);
  voci.forEach((v) => inView(v.sez, () => { voci.forEach((w) => w.a.classList.toggle('on', w === v)); }, { amount: 0.35 }));
}

/* ---------- 4. entrate a cascata delle sezioni ---------- */
const GRUPPI = [
  '#tiles', '.c3d-pac', '.c3d-strati', '.checks3', '.conf', '.vt', '.trust', '.passi4', '.rating-grid', '.meet',
  '.ways', '.posts', '.faq', '.story-head', '.team', '.pro', '.spot-in',
];
const SINGOLI = ['.sec .list-head', '.sec .sub', '.tiles-p', '#come > .wrap > h2', '#rating > .wrap > h2', '#domande > .wrap > h2',
  '.final h2', '.final .sub', '.final .search', '.c3d-testo h2', '.c3d-kick', '.c3d-nota', '.c3d-cta', '.c3d-scena', '.passi4-btn', '.story-foot'];

function entrate() {
  if (ridotto) return;
  const fatti = new Set();
  SINGOLI.forEach((s) => $$(s, $('#v-home')).forEach((el) => {
    if (fatti.has(el)) return; fatti.add(el); el.setAttribute('data-edm-in', '');
    inView(el, () => { animate(el, { opacity: [0, 1], y: [14, 0] }, { duration: 0.6, ease: EASE }); }, { amount: 0.25 });
  }));
  GRUPPI.forEach((s) => $$(s, $('#v-home')).forEach((g) => {
    const figli = [...g.children].filter((c) => !c.matches('.edm-metro, .edm-filo, input[type=hidden]'));
    if (!figli.length) return;
    figli.forEach((c) => c.setAttribute('data-edm-in', ''));
    inView(g, () => {
      animate(figli, { opacity: [0, 1], y: [16, 0] }, { duration: 0.6, delay: stagger(0.06), ease: EASE });
    }, { amount: 0.15 });
  }));
}

/* ---------- 5. come funziona: il filo tra i passi segue lo scroll ---------- */
function filo() {
  const p = $('.passi4'); if (!p) return;
  const f = document.createElement('div'); f.className = 'edm-filo'; f.setAttribute('aria-hidden', 'true');
  const b = document.createElement('b'); f.appendChild(b); p.prepend(f);
  if (ridotto) { b.style.transform = 'scaleX(1)'; return; }
  scroll((v) => { b.style.transform = `scaleX(${v.toFixed(4)})`; }, { target: p, offset: ['start 85%', 'end 55%'] });
}

/* ---------- 6. rating: barre come un grafico che si disegna ---------- */
function rating() {
  const barre = $$('.r-bars i b'); if (!barre.length) return;
  if (ridotto) return;
  barre.forEach((b) => (b.style.transform = 'scaleX(0)'));
  inView('.r-bars', () => {
    aAnimate(barre, { scaleX: [0, 1], duration: 1100, delay: aStagger(110), ease: 'outExpo' });
    animate($$('.r-bars em'), { opacity: [0, 1] }, { duration: 0.4, delay: stagger(0.11, { startDelay: 0.35 }) });
  }, { amount: 0.5 });
}

/* ---------- 7. vetrina: i numeri contano quando arrivano ---------- */
function conta(el) {
  const m = el.textContent.match(/^([\d.]+)(.*)$/); if (!m) return;
  const fine = parseInt(m[1].replace(/\./g, ''), 10); const coda = m[2];
  if (!fine || ridotto) return;
  animate(0, fine, { duration: 1.1, ease: EASE, onUpdate: (v) => { el.textContent = Math.round(v).toLocaleString('it-IT') + coda; } });
}
function vetrina() {
  const vt = $('#vt'); if (!vt) return;
  let visto = false; const contati = new WeakSet();
  const prova = () => { if (!visto) return; $$('.vt-n', vt).forEach((n) => { if (n.textContent && !contati.has(n)) { contati.add(n); conta(n); } }); };
  inView(vt, () => { visto = true; prova(); }, { amount: 0.2 });
  new MutationObserver(() => { prova(); if (!ridotto) $$('.vt-carte > li:not([data-edm-ok])', vt).forEach((li, i) => { li.setAttribute('data-edm-ok', ''); if (visto) animate(li, { opacity: [0, 1], y: [8, 0] }, { duration: 0.45, delay: i * 0.05, ease: EASE }); }); })
    .observe(vt, { childList: true, subtree: true, characterData: true });
}

/* ---------- 8. pacchetti: i prezzi girano come un tabellone a palette (Kokonut split-flap) ---------- */
function palette() {
  const prezzi = $$('.c3d-pac small'); if (!prezzi.length) return;
  const tessere = [];
  prezzi.forEach((sm) => {
    const giro = (n) => {
      for (const c of [...n.childNodes]) {
        if (c.nodeType !== 3) continue;
        const m = c.textContent.match(/\d[\d.]*/); if (!m) continue;
        const prima = c.textContent.slice(0, m.index), dopo = c.textContent.slice(m.index + m[0].length);
        const box = document.createElement('span'); box.className = 'edm-flap'; box.setAttribute('aria-label', m[0]);
        [...m[0]].forEach((ch) => {
          const t = document.createElement('span'); t.className = 't'; t.setAttribute('aria-hidden', 'true');
          const b = document.createElement('b'); b.textContent = ch; t.appendChild(b); box.appendChild(t);
          if (/\d/.test(ch)) { t.classList.add('d'); tessere.push({ b, fine: +ch }); }
        });
        c.replaceWith(document.createTextNode(prima), box, document.createTextNode(dopo));
        return;
      }
    };
    giro(sm);
  });
  if (ridotto) return;
  const FLIP = 52;
  inView('.c3d-pac', () => {
    tessere.forEach(({ b, fine }, i) => {
      let cur = 0; b.textContent = '0';
      const passo = () => {
        if (cur === fine) return;
        b.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], { duration: FLIP / 2, easing: 'cubic-bezier(.5,0,.9,.6)' })
          .onfinish = () => {
            cur += 1; b.textContent = String(cur);
            b.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], { duration: FLIP / 2, easing: 'cubic-bezier(.2,.6,.3,1)' }).onfinish = passo;
          };
      };
      setTimeout(passo, 200 + i * 40);
    });
  }, { amount: 0.4 });
}

/* ---------- 9. topografia del Nordest dietro le sezioni scure ---------- */
async function topografia() {
  const dove = ['.c3d', '.story', '.pro', '.ftr'].map((s) => $(s)).filter(Boolean);
  if (!dove.length) return;
  let svgTxt = '';
  try { svgTxt = await (await fetch('/img/edm-topo.svg')).text(); } catch (e) { return; }
  dove.forEach((sez, k) => {
    const d = document.createElement('div'); d.className = 'edm-topo'; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = svgTxt; sez.prepend(d);
    const s = $('svg', d);
    if (k % 2) s.style.transform = 'scaleX(-1)';
    if (ridotto) return;
    const paths = $$('path', s);
    const dr = aSvg.createDrawable(paths);
    dr.forEach((p) => p.setAttribute('data-draw', '0 0'));
    inView(sez, () => { aAnimate(dr, { draw: ['0 0', '0 1'], duration: 2600, delay: aStagger(40), ease: 'inOutSine' }); }, { amount: 0.1 });
    scroll((v) => { s.style.translate = `0 ${(-12 + v * 40).toFixed(1)}px`; }, { target: sez, offset: ['start end', 'end start'] });
  });
}

/* ---------- 10. regione: indicatore che scorre (Kokonut smooth tab) ---------- */
function linguetta() {
  const g = $('.pick-reg'); if (!g) return;
  const ind = document.createElement('span'); ind.className = 'edm-tab-ind'; g.prepend(ind);
  const metti = (prima) => {
    const on = $('[aria-checked="true"]', g); if (!on || !on.offsetWidth) { ind.style.opacity = 0; return; }
    const x = on.offsetLeft, y = on.offsetTop;
    ind.style.width = on.offsetWidth + 'px'; ind.style.height = on.offsetHeight + 'px';
    if (prima || ridotto) { ind.style.transform = `translate(${x}px,${y}px)`; ind.style.opacity = 1; return; }
    animate(ind, { x, y, opacity: 1 }, { type: 'spring', stiffness: 520, damping: 40 });
  };
  new MutationObserver(() => metti(false)).observe(g, { attributes: true, subtree: true, attributeFilter: ['aria-checked'] });
  new MutationObserver(() => requestAnimationFrame(() => metti(true))).observe($('#pick-2'), { attributes: true, attributeFilter: ['hidden'] });
  addEventListener('resize', () => metti(true));
}

/* ---------- 11. domande: apertura morbida ---------- */
function domande() {
  if (ridotto) return;
  $$('.faq details').forEach((d) => {
    const s = $('summary', d), p = $('p', d); if (!s || !p) return;
    s.addEventListener('click', (e) => {
      e.preventDefault();
      if (d.open) {
        animate(p, { height: [p.offsetHeight, 0], opacity: [1, 0] }, { duration: 0.28, ease: EASE }).then(() => { d.open = false; p.style.height = ''; p.style.opacity = ''; });
      } else {
        d.open = true; const h = p.offsetHeight;
        animate(p, { height: [0, h], opacity: [0, 1] }, { duration: 0.38, ease: EASE }).then(() => { p.style.height = ''; });
      }
    });
  });
}

/* ---------- 12. quotazione: ogni domanda entra, le scelte a cascata ---------- */
function quotazione() {
  const app = $('#wz-app'); if (!app || ridotto) return;
  let quota = 0;
  new MutationObserver(() => {
    const bar = $('.wz-bar i', app);
    if (bar) {
      const fine = (parseFloat(bar.style.width) || 0) / 100;
      bar.style.width = '100%';
      animate(bar, { scaleX: [quota, fine] }, { duration: 0.6, ease: EASE });
      quota = fine;
    }
    const corpo = $('.pv-corpo', app) || app.firstElementChild; if (!corpo) return;
    const pezzi = [...corpo.children];
    animate(pezzi, { opacity: [0, 1], y: [12, 0] }, { duration: 0.45, delay: stagger(0.05), ease: EASE });
    const scelte = $$('.pv-opt, .pv-chip', app);
    if (scelte.length) animate(scelte, { opacity: [0, 1], y: [8, 0] }, { duration: 0.4, delay: stagger(0.035, { startDelay: 0.12 }), ease: EASE });
  }).observe(app, { childList: true });
  // cambio di vista home ↔ quotazione
  const viste = $$('.view');
  viste.forEach((v) => new MutationObserver(() => {
    if (v.classList.contains('on')) animate(v, { opacity: [0, 1], y: [10, 0] }, { duration: 0.42, ease: EASE });
  }).observe(v, { attributes: true, attributeFilter: ['class'] }));
}

/* ---------- avvio ---------- */
function via() {
  testata(); hero(); metro(); entrate(); filo(); rating(); vetrina(); palette(); topografia(); linguetta(); domande(); quotazione();
  document.documentElement.classList.add('edm-pronto');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', via); else via();
