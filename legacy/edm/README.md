# Ridisegno "calce e notte alpina" + moto (23/11/2026)

- `site/css/edm-2027.css`: strato di stile sopra la home e la quotazione (palette, tipografia, firma del metro da cantiere). Pulizia secondo **unslop** di Damir Sokolovsky (@heydamir), CC BY 4.0.
- `site/js/edm-motion.js`: bundle minificato di `edm/edm-motion.src.js` con **Motion** (motion.dev, MIT) e **anime.js** v4 (MIT). Idee riprese da **Kokonut UI** (split-flap, smooth tab, action search bar; MIT) e **Bklit UI** (barre come grafico: griglia muta, un accento).
- `site/img/edm-topo.svg`: curve di livello generate da `edm/topo.mjs` (d3-contour).

Ricostruire il bundle:
```
npm i motion animejs esbuild
npx esbuild legacy/edm/edm-motion.src.js --bundle --minify --format=iife --target=es2019 --outfile=legacy/site/js/edm-motion.js
```
Testi, ID e logica del sito non cambiano; con "riduci movimento" attivo il moto si spegne.

In produzione (23/11/2026) è attivo solo per testata, hero e "Lavori più frequenti": `css/edm-top.css` e `<script src="/js/edm-motion.js" data-parti="lavori">`. L'anteprima completa di tutta la home è nel ramo `redesign-motion` (`data-parti` assente = tutto).
