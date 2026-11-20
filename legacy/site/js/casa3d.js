/* Casa 3D "strato per strato" (20/11/2026): una casa esplosa nei suoi strati di lavoro.
   Scegliendo un pacchetto (nuova costruzione, ristrutturazione completa, bagno) si accendono gli strati compresi.
   Si carica solo quando la sezione arriva sullo schermo; con "movimenti ridotti" resta ferma. three.js (MIT) in js/vendor. */
import * as THREE from '/js/vendor/three.module.min.js';

const BLU = 0x1447e6, ARANCIO = 0xff6a2b, CIANO = 0x5eead4, BIANCO = 0xe8eefc;

export function avvia(sezione) {
  const tela = sezione.querySelector('.c3d-tela');
  if (!tela) return;
  const ridotto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch (e) { sezione.classList.add('c3d-no'); return; }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));

  const scena = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  cam.position.set(16.5, 13, 18.5); cam.lookAt(0, 5, 0);
  scena.add(new THREE.AmbientLight(0xbfd0ff, 1.1));
  const sole = new THREE.DirectionalLight(0xffffff, 1.6); sole.position.set(10, 20, 8); scena.add(sole);

  // pavimento a griglia, da tavolo di progetto
  const griglia = new THREE.GridHelper(40, 40, 0x3b5bdb, 0x22356b);
  griglia.material.transparent = true; griglia.material.opacity = 0.35; scena.add(griglia);

  const casa = new THREE.Group(); scena.add(casa);
  const strati = {};   // nome -> { gruppo, base, materiali }
  function strato(nome, base) { const g = new THREE.Group(); g.position.y = base; casa.add(g); strati[nome] = { gruppo: g, base, mat: [] }; return g; }
  function solido(g, nome, geo, colore, opac = 0.9, emissivo = 0) {
    const m = new THREE.MeshStandardMaterial({ color: colore, transparent: true, opacity: opac, roughness: 0.55, metalness: 0.05, emissive: colore, emissiveIntensity: emissivo });
    const mesh = new THREE.Mesh(geo, m);
    const lm = new THREE.LineBasicMaterial({ color: CIANO, transparent: true, opacity: 0.55 });
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lm));
    g.add(mesh); strati[nome].mat.push([m, opac], [lm, 0.55]);
    return mesh;
  }
  const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  const L = 10, P = 7, H = 2.8;

  // 1. Fondazioni e struttura
  const fond = strato('struttura', 0);
  solido(fond, 'struttura', box(L + 0.8, 0.5, P + 0.8), 0x8a94ad).position.y = 0.25;
  const muri = [[L, 0.3, 0, P / 2], [L, 0.3, 0, -P / 2], [0.3, P, L / 2, 0], [0.3, P, -L / 2, 0]];
  for (const piano of [0, 1]) for (const [w, d, x, z] of muri) solido(fond, 'struttura', box(w, H, d), 0xc9d3ea, 0.55).position.set(x, 0.5 + H / 2 + piano * (H + 0.3), z);
  solido(fond, 'struttura', box(L, 0.3, P), 0xb7c2dc, 0.7).position.y = 0.5 + H + 0.15;

  // 2. Impianti: tubi dell'acqua (blu) e linee elettriche (arancio), luminosi
  const imp = strato('impianti', 0);
  const tubo = (x1, y1, z1, x2, y2, z2, col) => {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2), len = a.distanceTo(b);
    const m = solido(imp, 'impianti', new THREE.CylinderGeometry(0.07, 0.07, len, 8), col, 0.95, 0.9);
    m.position.copy(a.clone().add(b).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  };
  tubo(-4.2, 0.8, -3, 4.2, 0.8, -3, BLU); tubo(-4.2, 0.8, -3, -4.2, 6.2, -3, BLU); tubo(-4.2, 3.9, -3, 2, 3.9, -3, BLU);
  tubo(4.6, 1.4, 3, -4.6, 1.4, 3, ARANCIO); tubo(4.6, 1.4, 3, 4.6, 6.6, 3, ARANCIO); tubo(4.6, 4.5, 3, -2, 4.5, 3, ARANCIO); tubo(0, 1.4, 3, 0, 2.6, 3, ARANCIO);

  // 3. Finiture: pavimenti, tramezzi e porte
  const fin = strato('finiture', 0);
  solido(fin, 'finiture', box(L - 0.4, 0.08, P - 0.4), 0xd9a066, 0.95).position.y = 0.56;
  solido(fin, 'finiture', box(L - 0.4, 0.08, P - 0.4), 0xd9a066, 0.95).position.y = 0.5 + H + 0.34;
  solido(fin, 'finiture', box(0.12, H - 0.2, P - 0.6), 0xf1f4fb, 0.8).position.set(1.2, 0.5 + H / 2, 0);
  solido(fin, 'finiture', box(0.12, H - 0.2, P - 0.6), 0xf1f4fb, 0.8).position.set(-1.5, 0.5 + H * 1.5 + 0.3, 0);

  // 4. Bagno: un ambiente con vasca e sanitari
  const bag = strato('bagno', 0);
  solido(bag, 'bagno', box(2.6, 0.1, 2.4), 0x7dd3fc, 0.95, 0.15).position.set(3.4, 0.6, -2);
  solido(bag, 'bagno', box(2.6, 2.2, 0.08), 0xbae6fd, 0.55).position.set(3.4, 1.7, -3.15);
  solido(bag, 'bagno', box(1.7, 0.55, 0.8), 0xffffff, 0.95).position.set(3.6, 0.95, -2.6);
  solido(bag, 'bagno', box(0.45, 0.45, 0.6), 0xffffff, 0.95).position.set(2.4, 0.9, -1.4);

  // 5. Serramenti: finestre in vetro sulle facciate
  const ser = strato('serramenti', 0);
  for (const piano of [0, 1]) for (const x of [-3, 0.2, 3]) {
    const y = 0.5 + 1.5 + piano * (H + 0.3);
    solido(ser, 'serramenti', box(1.3, 1.4, 0.12), 0x60a5fa, 0.6, 0.35).position.set(x, y, P / 2 + 0.12);
    solido(ser, 'serramenti', box(1.3, 1.4, 0.12), 0x60a5fa, 0.6, 0.35).position.set(x, y, -P / 2 - 0.12);
  }

  // 6. Tetto a due falde con isolamento
  const tet = strato('tetto', 0);
  const yT = 0.5 + 2 * H + 0.3, falda = Math.hypot(P / 2 + 0.6, 2.2);
  for (const s of [1, -1]) {
    const f = solido(tet, 'tetto', box(L + 1, 0.3, falda), 0x334155, 0.92);
    f.position.set(0, yT + 1.1, s * (P / 4 + 0.15)); f.rotation.x = s * Math.atan2(2.2, P / 2 + 0.6);
  }

  // strati in ordine dal basso: la distanza di "esplosione" cresce verso l'alto
  const ORDINE = ['struttura', 'impianti', 'finiture', 'bagno', 'serramenti', 'tetto'];
  const SALTO = { struttura: 0, impianti: 1.4, finiture: 2.6, bagno: 3.4, serramenti: 4.4, tetto: 6.2 };
  const PACCHETTI = { nuova: ORDINE, completa: ['impianti', 'finiture', 'bagno', 'serramenti'], bagno: ['bagno'] };
  let pacchetto = 'nuova', esploso = ridotto ? 1 : 0, obiettivo = 1, rot = 0, mx = 0, my = 0;
  const lum = {}; ORDINE.forEach(n => { lum[n] = 1; });

  function scegli(p) {
    pacchetto = PACCHETTI[p] ? p : 'nuova';
    sezione.querySelectorAll('[data-c3d]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c3d === pacchetto)));
    sezione.querySelectorAll('[data-strato]').forEach(li => li.classList.toggle('on', PACCHETTI[pacchetto].includes(li.dataset.strato)));
    if (ridotto) disegna();
  }
  sezione.addEventListener('click', e => { const b = e.target.closest('[data-c3d]'); if (b) scegli(b.dataset.c3d); });
  sezione.addEventListener('pointermove', e => { const r = tela.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5; });

  function misura() {
    const r = tela.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  new ResizeObserver(misura).observe(tela); misura();

  function disegna() {
    for (const n of ORDINE) {
      const s = strati[n], acceso = PACCHETTI[pacchetto].includes(n);
      lum[n] += ((acceso ? 1 : 0.12) - lum[n]) * (ridotto ? 1 : 0.08);
      s.gruppo.position.y = s.base + SALTO[n] * esploso * 0.9;
      for (const [m, o] of s.mat) m.opacity = o * lum[n];
    }
    renderer.render(scena, cam);
  }

  let visibile = false, ultimo = 0;
  new IntersectionObserver(es => { visibile = es[0].isIntersecting; if (visibile && !ridotto) requestAnimationFrame(giro); }, { threshold: 0.05 }).observe(sezione);
  function giro(t) {
    if (!visibile || document.hidden) return;
    const dt = Math.min(0.05, (t - (ultimo || t)) / 1000); ultimo = t;
    esploso += (obiettivo - esploso) * Math.min(1, dt * 1.6);
    rot += dt * 0.12;
    casa.rotation.y = Math.sin(rot) * 0.45 + mx * 0.5;
    casa.rotation.x = my * 0.08;
    disegna();
    requestAnimationFrame(giro);
  }
  // l'esplosione respira: si chiude e si riapre ogni tanto, così si capisce che sono strati della stessa casa
  if (!ridotto) setInterval(() => { if (visibile) obiettivo = obiettivo === 1 ? 0.25 : 1; }, 6000);
  scegli('nuova'); disegna();
  sezione.classList.add('c3d-pronta');
}
