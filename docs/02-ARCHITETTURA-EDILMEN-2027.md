# EdilMen 2027 — Il digital contractor: progetto del sistema

## 1. Cosa è EdilMen 2027 in una frase
Una piattaforma che **abbatte l'asimmetria di fiducia** tra chi deve costruire e chi costruisce: oggetto d'acquisto standard (pacchetti a voci fisse), prezzo prudente che al sopralluogo può solo scendere, offerte **reali** di imprese convenzionate con rating calcolato da fatti, pagamenti a SAL con fee trattenuta, dal bagno alla grande operazione.

**Digital contractor**: EdilMen non si interpone come un general contractor (che margina ~30% sul cliente), **collega**: definisce il lavoro, mette in gara le imprese della rete, presidia contratto e SAL, e pesa sulla sola impresa con la fee a scaglioni.

## 2. Utenti e accessi

| Ruolo | Come entra | Cosa fa |
|---|---|---|
| **Visitatore** | nessun login | quotazione istantanea, directory imprese, prezzi, rating, vocale |
| **Cliente privato** | registrazione email+password (anche a fine quotazione) | le sue richieste, offerte reali, appuntamento, contratto, SAL da approvare, recensione verificata |
| **Agenzia immobiliare** | registrazione come agenzia (ragione sociale, P.IVA) | portafoglio immobili, quotazione rapida per immobile, report "stima lavori" brandizzato per l'acquirente con link condivisibile, segnalazione del cliente a EdilMen |
| **Immobiliarista / investitore** | registrazione come investitore | operazioni multi‑unità, costo lavori €/m², margine dell'operazione, richiesta d'offerta su computo |
| **Impresa / artigiano** | claim della scheda (P.IVA + email) o iscrizione | profilo, documenti, listino sui pacchetti EdilMen, opportunità (accetta/rifiuta con prezzo), cantieri e SAL, estratto fee |
| **Operatore EdilMen** | creato da admin | richieste, centralino/rubrica artigiani, matching |
| **Admin** | creato all'avvio da variabili d'ambiente | tutto, comprese regole economiche, listino, utenti, audit |

## 3. I tre percorsi di domanda
1. **Casa (8–60 k€)** — wizard di quotazione a pacchetti, offerte delle imprese della zona, sopralluogo.
2. **Agenzie e investitori (immobili da comprare/vendere)** — stessa macchina prezzi, ma legata a un immobile; il report serve a negoziare il prezzo d'acquisto.
3. **Grandi operazioni (condomini, palazzine, PA via ATI, 100 k€–3 M€+)** — richiesta d'offerta su computo metrico (voce, U.M., quantità), gara tra imprese invitate, confronto voce per voce con anomalie (+15% alto, −25% anomalo).

## 4. Regole di fiducia (non negoziabili, implementate nel codice)
1. **Nessuna offerta finta**: un'offerta esiste solo se un'impresa reale ha un listino approvato sui pacchetti della richiesta o ha risposto a un invito. Altrimenti si mostra il *prezzo di riferimento EdilMen* dichiarato come tale.
2. **Nessun numero di social proof inventato**: contatori e rating letti dal database.
3. **Rating calcolato** con la metodologia pubblica (recensioni 60%, documenti 25%, comportamento 15%; pubblicato da 3 recensioni verificate + visura). Il piano a pagamento non lo tocca.
4. **Prezzo prudente**: parte fissa + accantonamento per le variabili; il range mostrato va dalla parte fissa (minimo) al prudente (massimo).
5. **Anonimato** delle imprese fino all'appuntamento; i contatti del cliente non vanno alle imprese senza consenso.
6. **Consensi separati e registrati** (privacy, condivisione con imprese, marketing) con versione e data.
7. **Una sola fonte delle regole economiche** (scaglioni fee, piani, IVA, coefficienti), versionata in admin.

## 5. Modello economico implementato (configurabile)
- Fee sull'impresa a scaglioni sul valore del contratto: **8% fino a 50.000 €, 6% fino a 3.000.000 €, 4% oltre** (ultima regola registrata, ottobre 2026), maturata e incassata **a ogni SAL**.
- Piano SAL predefinito: 10% firma · 30% avvio · 30% metà opere · 20% fine opere · 10% collaudo.
- Abbonamenti imprese: Base / Plus (prezzi in impostazioni).
- Incasso: modalità "fattura diretta + fee a SAL" o "escrow" selezionabile per contratto (decisione D‑C aperta).

## 6. Architettura tecnica
```
Railway project "edilmen-2027"
 ├─ servizio web  (Node 22, Express)  ← build da GitHub techmanagementdev/EDILMEN-2027
 │    ├─ /api/*            API REST JSON, sessione con cookie httpOnly firmato (JWT)
 │    └─ /*                SPA React (Vite + Tailwind) servita come statico
 └─ Postgres            migrazioni SQL all'avvio, file (foto SAL, vocali) in tabella blob
```
- `shared/pricing.js` — **motore prezzi puro**, identico in browser e server, con test.
- `server/` — API, migrazioni, import Excel del listino v1.1, import CSV imprese e rubrica.
- `web/` — sito pubblico + aree riservate per ruolo.
- Integrazioni opzionali via variabili d'ambiente: `ANTHROPIC_API_KEY` (classificazione della descrizione libera e lettura listini), `RESEND_API_KEY` (email OTP e notifiche). Senza chiavi il sistema funziona comunque (OTP mostrato all'admin, classificazione per parole chiave).

## 7. Dati e compliance
- Tabelle imprese a strati: dati societari / contatti (corporate vs personali) / dati operativi / consensi, con **fonte e data di controllo** per riga.
- Il repository GitHub è pubblico: **nessun dato personale né listino reale nel codice**. I dati reali si caricano dall'admin (import Excel/CSV) e vivono solo nel database Railway.
- Audit log di ogni modifica rilevante.
