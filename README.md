# EdilMen 2027 — il digital contractor

Piattaforma che abbatte l'asimmetria di fiducia tra chi deve costruire e chi costruisce: lavori a **pacchetti standard** (stesse voci per tutte le imprese), **prezzo prudente** che al sopralluogo può solo scendere, **offerte reali** di imprese con **rating calcolato dai fatti**, contratto e **pagamenti a SAL** con fee a scaglioni. Dal bagno alla grande operazione.

- Analisi del sito attuale: [`docs/01-ANALISI-SITO-ATTUALE.md`](docs/01-ANALISI-SITO-ATTUALE.md)
- Progetto del sistema: [`docs/02-ARCHITETTURA-EDILMEN-2027.md`](docs/02-ARCHITETTURA-EDILMEN-2027.md)

## Cosa c'è

| Area | Funzioni |
|---|---|
| Sito pubblico | Home, quotatore a pacchetti (anche da descrizione libera), stato richiesta con offerte reali e prenotazione, prezzi di 52 lavori per 13 province, elenco imprese e schede con documenti/rating, metodologia rating, pagine agenzie/investitori e grandi operazioni, vocale, rivendicazione scheda (OTP), iscrizione impresa |
| Cliente | Richieste, offerte anonime fino all'appuntamento, contratto, approvazione/contestazione SAL con foto, recensione verificata |
| Agenzia / investitore | Portafoglio immobili, stime lavori per immobile, report condivisibile e stampabile per l'acquirente, margine dell'operazione, richiesta d'offerta su computo con confronto voce per voce |
| Impresa | Panoramica e cose da fare, profilo pubblico, documenti, listino sui pacchetti (anomalie −25% in controllo), opportunità (listino automatico, importo a corpo, prezzi su computo), cantieri e richiesta SAL con foto, estratto fee |
| Admin / operatore | Cruscotto con soli dati veri, richieste (matching, inviti, offerte manuali, aggiudicazione → contratto + piano SAL + fee), contratti/SAL/fee, imprese (import CSV/Excel, verifiche documenti, rete, fee personalizzata, accessi), rivendicazioni, prezzi imprese vs listino, rubrica artigiani (import Excel, esiti, crea impresa), recensioni, segnalazioni, listino (import Excel v1.1, modifica pacchetti, coefficienti, versioni), fee/piani/matching, utenti, registro attività |

## Struttura
```
shared/   motore prezzi (pricing.js) e lavori del quotatore (lavori.js) — usati da browser e server
server/   Express 5 + PostgreSQL: API, migrazioni SQL, import Excel, rating e matching
web/      React + Vite + Tailwind
tests/    test del motore (node --test) e prova end-to-end dell'API
```

## Sviluppo locale
```bash
npm install
cp .env.example .env          # imposta DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET
npm run build && npm start    # oppure npm run dev (server + vite)
npm test                      # test del motore prezzi
BASE=http://localhost:3000 node tests/e2e-api.mjs   # percorso completo richiesta → contratto → SAL
```
All'avvio il server applica le migrazioni, crea l'admin dalle variabili d'ambiente e carica il listino EdilMen v1.1 (`server/seed/catalogo.json`, rigenerabile con `npm run seed:catalog -- file.xlsx`).

## Variabili d'ambiente
| Nome | Obbligatoria | Note |
|---|---|---|
| `DATABASE_URL` | sì | Postgres |
| `SESSION_SECRET` | sì | stringa lunga casuale |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | sì | primo amministratore |
| `ANTHROPIC_API_KEY` | no | descrizione libera → lavori con Claude (senza: parole chiave) |
| `RESEND_API_KEY`, `MAIL_FROM` | no | invio email del codice di rivendicazione (senza: il codice è visibile all'admin) |

## Dati
Il repository è pubblico: **niente dati personali e niente listini delle imprese nel codice**. Contatti, imprese e listini reali si caricano dall'admin (import Excel/CSV) e restano solo nel database. `server/seed/` contiene solo il listino di riferimento EdilMen a livello di pacchetto (già pubblicato su edilmen.it/prezzi) e l'elenco ISTAT dei comuni con coordinate.
