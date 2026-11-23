/* EdilMen · moto con GSAP + Lenis + componenti React Bits riscritti in JavaScript semplice (23/11/2026)
   - Lenis: scorrimento morbido di tutta la pagina (solo mouse e trackpad; sul telefono resta quello nativo).
   - GSAP + ScrollTrigger + SplitText: entrate della parte alta e dei "Lavori più frequenti".
   - React Bits (MIT, David Haz): SplitText (titolo), BlurText (riga sopra e sottotitolo),
     Magnet (pulsante della testata), SpotlightCard (schede dei lavori e del "Che lavoro devi fare?").
   Testi e logica del sito non cambiano. Con "riduci movimento" tutto resta fermo. */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);

const ridotto = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const EASE = 'expo.out';
const via = () => document.documentElement.classList.remove('edm-pre');
document.documentElement.classList.add('edm-moto');

/* ---------- Lenis: scorrimento morbido, legato a ScrollTrigger ---------- */
let lenis = null;
function scorrimento() {
  if (ridotto) return;
  lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, syncTouch: false, anchors: { offset: -72 } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.EM_LENIS = lenis;
  // i link interni del sito usano scrollIntoView: li faccio passare da Lenis
  const nativo = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (o) {
    if (lenis && o && typeof o === 'object' && o.behavior === 'smooth') {
      lenis.scrollTo(this, { offset: -72 });
      return;
    }
    return nativo.apply(this, arguments);
  };
  // le finestre con scorrimento proprio non vengono toccate
  $$('dialog, #em-ck, .wz').forEach((el) => el.setAttribute('data-lenis-prevent', ''));
}

/* ---------- testata: bordo allo scroll, si nasconde scendendo ---------- */
function testata() {
  const h = $('.hdr'); if (!h) return;
  let nascosta = false;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (st) => {
      const y = st.scroll();
      h.classList.toggle('edm-scrolled', y > 8);
      if (ridotto || document.body.classList.contains('wz-open')) return;
      if (st.direction === 1 && y > 520 && !nascosta) { nascosta = true; gsap.to(h, { yPercent: -100, duration: 0.32, ease: 'power3.out' }); }
      else if (st.direction === -1 && nascosta) { nascosta = false; gsap.to(h, { yPercent: 0, duration: 0.36, ease: 'power3.out' }); }
    },
  });
}

/* ---------- React Bits · SplitText: il titolo sale parola per parola, mascherato ---------- */
function titolo() {
  const h1 = $('.hero h1'); if (!h1) return null;
  const blu = $('.h-blu', h1);
  let tratto = null;
  if (blu) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'edm-tratto'); s.setAttribute('viewBox', '0 0 300 20'); s.setAttribute('preserveAspectRatio', 'none'); s.setAttribute('aria-hidden', 'true');
    tratto = document.createElementNS(NS, 'path');
    tratto.setAttribute('d', 'M3 14 C 60 6, 130 4, 200 8 S 280 12, 297 7');
    s.appendChild(tratto); blu.appendChild(s);
  }
  if (ridotto) return null;
  const tl = gsap.timeline({ defaults: { ease: EASE } });
  const split = SplitText.create(h1, { type: 'words', mask: 'words', wordsClass: 'edm-wi', aria: 'auto' });
  tl.from(split.words, { yPercent: 110, duration: 1.1, stagger: 0.06 }, 0.1);
  if (tratto) tl.from(tratto, { drawSVG: '0%', duration: 0.9, ease: 'power2.inOut' }, 0.75);
  return tl;
}

/* ---------- React Bits · BlurText: riga sopra e sottotitolo escono dalla sfocatura ---------- */
function sfocati(tl) {
  const els = ['.hero .kick', '.hero .lead'].map((s) => $(s)).filter(Boolean);
  if (!els.length || !tl) return;
  els.forEach((el) => {
    // la riga sopra è un flex con la tacca del metro: si sfoca tutta insieme
    const bersagli = el.matches('.kick') ? [el] : SplitText.create(el, { type: 'words', aria: 'auto' }).words;
    tl.from(bersagli, { opacity: 0, filter: 'blur(8px)', y: 6, duration: 0.8, stagger: 0.025, ease: 'power2.out' }, el.matches('.kick') ? 0 : 0.45);
  });
}

/* ---------- hero: scheda, punti, mappa ---------- */
function hero() {
  const tl = titolo();
  sfocati(tl);
  if (!tl) return via();
  const pick = $('.hero .pick');
  if (pick) tl.from(pick, { opacity: 0, y: 18, duration: 0.8 }, 0.35);
  const carte = $$('.pick-cat > button');
  if (carte.length) tl.from(carte, { opacity: 0, y: 10, duration: 0.6, stagger: 0.06 }, 0.55);
  const resto = ['.hero .punti', '.hero .net'].map((s) => $(s)).filter(Boolean);
  if (resto.length) tl.from(resto, { opacity: 0, y: 10, duration: 0.6, stagger: 0.08 }, 0.75);

  const card = $('#mapcard');
  if (card) {
    tl.from(card, { opacity: 0, y: 22, scale: 0.985, duration: 1 }, 0.2);
    const regs = $$('#heromap .reg');
    if (regs.length) {
      tl.from(regs, { drawSVG: '0%', duration: 1.4, stagger: 0.18, ease: 'power2.inOut' }, 0.45);
      tl.from(regs, { fillOpacity: 0, duration: 0.7, stagger: 0.18, ease: 'power1.out' }, 1.1);
    }
    const altri = $$('#heromap .lbl, #heromap .citta, #heromap .m-pin');
    if (altri.length) tl.from(altri, { opacity: 0, duration: 0.5, stagger: 0.025 }, 1.25);
    const badge = $$('.badge-r', card);
    if (badge.length) tl.from(badge, { opacity: 0, y: 12, duration: 0.6, stagger: 0.15, ease: 'back.out(1.6)' }, 1.5);
    // la mappa sale un po' più lenta del testo mentre si scende
    gsap.to(card, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  }
  requestAnimationFrame(via);
}

/* ---------- lavori più frequenti: metro da cantiere + schede a cascata ---------- */
function lavori() {
  const sez = $('#lavori'); if (!sez) return;
  const head = $('.list-head', sez);
  if (head) {
    const m = document.createElement('div'); m.className = 'edm-metro'; m.setAttribute('aria-hidden', 'true');
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 132 12');
    for (let k = 0; k <= 22; k++) {
      const l = document.createElementNS(NS, 'line'); const x = k * 6 + 0.5; const lg = k % 5 === 0;
      l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', lg ? 0 : 6); l.setAttribute('y2', 12);
      if (lg) l.setAttribute('class', 'lg'); s.appendChild(l);
    }
    m.innerHTML = '<span class="n">01</span>'; m.appendChild(s); head.parentNode.insertBefore(m, head);
    if (!ridotto) {
      const st = { trigger: m, start: 'top 88%', once: true };
      gsap.from($$('line', s), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.5, stagger: 0.018, ease: 'power3.out', scrollTrigger: st });
      gsap.from($('.n', m), { opacity: 0, x: -6, duration: 0.4, scrollTrigger: st });
    }
  }
  if (ridotto) return;
  const h2 = $('h2', sez);
  if (h2) {
    const sp = SplitText.create(h2, { type: 'words', mask: 'words', aria: 'auto' });
    gsap.from(sp.words, { yPercent: 110, duration: 0.9, stagger: 0.05, ease: EASE, scrollTrigger: { trigger: h2, start: 'top 88%', once: true } });
  }
  const link = $$('.list-head a, .tiles-p', sez);
  if (link.length) gsap.from(link, { opacity: 0, y: 10, duration: 0.6, stagger: 0.1, ease: 'power2.out', scrollTrigger: { trigger: sez, start: 'top 80%', once: true } });
  const tiles = $$('#tiles > *');
  if (tiles.length) {
    gsap.set(tiles, { opacity: 0, y: 28 });
    ScrollTrigger.batch(tiles, { start: 'top 90%', once: true, onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: EASE }) });
    // la foto dentro la scheda scorre appena (parallasse contenuta nel riquadro)
    tiles.forEach((t) => { const img = $('img', t); if (img) gsap.fromTo(img, { yPercent: -4, scale: 1.08 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: t, start: 'top bottom', end: 'bottom top', scrub: true } }); });
  }
}

/* ---------- React Bits · SpotlightCard: una luce calda segue il puntatore ---------- */
function luci() {
  if (!fine || ridotto) return;
  const carte = [...$$('#tiles > *'), ...$$('.pick-cat > button')];
  carte.forEach((c) => {
    c.classList.add('edm-spot');
    const luce = document.createElement('span'); luce.className = 'edm-spot-l'; luce.setAttribute('aria-hidden', 'true');
    const bordo = document.createElement('span'); bordo.className = 'edm-spot-b'; bordo.setAttribute('aria-hidden', 'true');
    c.append(luce, bordo);
    const setX = gsap.quickSetter(c, '--sx', 'px'), setY = gsap.quickSetter(c, '--sy', 'px');
    c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); setX(e.clientX - r.left); setY(e.clientY - r.top); });
    c.addEventListener('pointerenter', () => gsap.to([luce, bordo], { opacity: 1, duration: 0.3 }));
    c.addEventListener('pointerleave', () => gsap.to([luce, bordo], { opacity: 0, duration: 0.5 }));
  });
}

/* ---------- React Bits · Magnet: il pulsante della testata si avvicina al puntatore ---------- */
function magnete() {
  if (!fine || ridotto) return;
  $$('.hdr .btn').forEach((b) => {
    const pad = 60, forza = 4;
    const xTo = gsap.quickTo(b, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    const yTo = gsap.quickTo(b, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dentro = Math.abs(e.clientX - cx) < r.width / 2 + pad && Math.abs(e.clientY - cy) < r.height / 2 + pad;
      xTo(dentro ? (e.clientX - cx) / forza : 0); yTo(dentro ? (e.clientY - cy) / forza : 0);
    }, { passive: true });
  });
}

/* ---------- regione: indicatore che scorre ---------- */
function linguetta() {
  const g = $('.pick-reg'); if (!g) return;
  const ind = document.createElement('span'); ind.className = 'edm-tab-ind'; g.prepend(ind);
  const metti = (subito) => {
    const on = $('[aria-checked="true"]', g); if (!on || !on.offsetWidth) { gsap.set(ind, { opacity: 0 }); return; }
    gsap.set(ind, { width: on.offsetWidth, height: on.offsetHeight });
    gsap.to(ind, { x: on.offsetLeft, y: on.offsetTop, opacity: 1, duration: subito || ridotto ? 0 : 0.45, ease: 'elastic.out(1, 0.75)' });
  };
  new MutationObserver(() => metti(false)).observe(g, { attributes: true, subtree: true, attributeFilter: ['aria-checked'] });
  const p2 = $('#pick-2'); if (p2) new MutationObserver(() => requestAnimationFrame(() => metti(true))).observe(p2, { attributes: true, attributeFilter: ['hidden'] });
  addEventListener('resize', () => metti(true));
}

/* ---------- avvio ---------- */
function parti() {
  scorrimento(); testata(); hero(); lavori(); luci(); magnete(); linguetta();
  // immagini e font cambiano le altezze: ricalcolo dei punti di scroll
  addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', parti); else parti();
