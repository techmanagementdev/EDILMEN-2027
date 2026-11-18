# Copia identica di edilmen.it

- `site/` è la copia 1:1 del sito attuale (pagine, admin `/app`, script, stili, immagini, font), presa dal workflow **Copia edilmen.it** (`.github/workflows/mirror-edilmen.yml`). Si può rilanciare per aggiornarla.
- `manifest.json` elenca ogni percorso copiato con il suo stato e i redirect.
- `server.mjs` serve la copia: URL senza `.html` come su Netlify, redirect originali, pagina 404 originale.
- Dati: gli script usano lo **stesso database Supabase** del sito attuale (chiave pubblica in `js/config.js`), quindi login admin, richieste e modifiche sono quelli veri.
- Le funzioni `/api/*` (imprese, azienda, prezzi-reali) per ora vengono girate al sito originale.
