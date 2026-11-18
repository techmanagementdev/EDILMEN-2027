# EdilMen — Analisi completa del sistema attuale (edilmen.it)

Rilievo del 18 novembre 2026 sul sito in produzione e sull'area di amministrazione, fatto navigando ogni menu e completando una quotazione reale di prova (richiesta **EM-000009**, email `tech+TEST-EMI@…`, bagno medio a Rovereto).
In questo documento non ci sono dati personali: numeri di telefono, nomi e contatti visti nell'admin sono stati omessi.

---

## 1. Architettura tecnica rilevata

| Componente | Come è fatto oggi |
|---|---|
| Hosting | Netlify (sito statico) |
| Database e login | Supabase (`jizaatieotmgrzdnjydh.supabase.co`), chiave pubblica nel browser, RLS dichiarata |
| Sito pubblico | `index.html` di 104 KB con JS inline + file `js/*.js` (calcolo, listino, territorio, mappa, menu, consenso, passeggiata) |
| Area riservata | `app.html` con **147 KB di JavaScript inline** + `gestionale.js`, `artigiani.js`, `chiamate-admin.js`, `listino.js` (129 KB, il listino v1.1 trascritto), `listino-admin.js`, `dati-reali.js` |
| Router | hash router (`#/admin/...`, `#/cliente/...`, `#/login`) |
| Tabelle Supabase usate | `aziende`, `profili`, `lead`, `vocali_oggi`, `segnalazioni`, `verifiche_azienda`, `rivendicazioni`, `abbinamenti`, `recensioni`, `artigiani`, `impostazioni`, `chiamate_imprese`, `listini_azienda`, `quotazioni`, `quotazioni_utenti`; RPC `centralino_aggiungi` |
| Chiavi segrete | in variabili Netlify (Supabase secret, Anthropic, Meta CAPI) |

**Giudizio tecnico.** È un prototipo cresciuto per aggiunte: logica di business sparsa tra HTML inline e file JS, nessun backend applicativo (solo Supabase dal browser), parte dell'admin lavora su **dati di esempio salvati nel browser** (localStorage), parte su dati veri. Non è una base su cui scalare né da mostrare in una due diligence.

---

## 2. Sito pubblico — pagina per pagina

### 2.1 Home (`/`)
Menu: Il rating · Imprese · Come funziona · Prezzi · Guide e risorse · Per le imprese · Accedi · **Calcola il prezzo**.

Sezioni in ordine:
1. **Hero** "Troviamo il miglior prezzo per la tua ristrutturazione" con mini‑form: *Ristrutturazione* / *Nuova costruzione* → *Inizia la quotazione*; link "Mandaci un vocale"; scelta regione (TAA, Veneto, FVG); mappa del Nordest con province.
2. Badge "**4,8 ★ rating medio della rete**" e "42 imprese verificate".
3. Lavori più frequenti (Ristrutturazione, Nuova costruzione, Impianti, Finiture, Spazi esterni) → wizard o pagine prezzi.
4. "Controlliamo l'impresa prima del cantiere" (documenti, solidità, lavori precedenti) + confronto Senza/Con EdilMen.
5. Vetrina imprese per regione (TAA 951, Veneto 1.866, FVG 476 schede) — tutte "Rating in costruzione".
6. Come funziona in 4 passi.
7. Il rating: **4,8 medio, "100% recensioni verificate", Puntualità 4,7, Qualità 4,9, Trasparenza 4,8, Solidità 4,6**.
8. "Prima vedi il prezzo, poi decidi" (sopralluogo o chiamata).
9. "Il cantiere al contrario" (storytelling a scroll, 7 fotogrammi, "Luigino").
10. "Il prezzo arriva da chi farà il lavoro".
11. Spot radio (Radio Veneto 24 / Radio Trentino 24) — *"Lo spot sarà disponibile a breve"*.
12. Per imprese e artigiani → aziende.html.
13. Guide (3 articoli), FAQ (4), form finale Comune + Tipo lavoro (17 opzioni), footer con EMI S.r.l.

### 2.2 Wizard di quotazione (`/#preventivo`) — percorso provato
| Passo | Domanda | Note |
|---|---|---|
| 1 | Che lavoro? (Ristrutturazione / Nuova costruzione) | dalla hero |
| 1b | Che tipo di ristrutturazione? Tutta la casa / Solo alcuni ambienti / Risparmio energetico | |
| 1c | Regione | chiesta qui… |
| 2 | Quali lavori? (bagno, cucina, pavimenti, infissi, elettrico, idraulico, tinteggiatura; multipla) | il contatore passa da "di 9" a "di 15" |
| 3 | Tipo immobile (appartamento, casa indipendente, negozio/ufficio, condominio/hotel) | compare la **stima in alto** (9.000–10.700 €) |
| 4 | Dove si trova: comune + **di nuovo la regione** | domanda ripetuta |
| 5 | Livello finiture (Standard / Medio / Premium) | |
| 6 | Quanti bagni | |
| 7 | Dimensione bagno (piccolo/medio/grande) | variante VA06 |
| 8 | Doccia o vasca | variante VA05 |
| 9 | Sanitari restano dove sono? | |
| 10 | Particolarità (centro storico, piano alto senza ascensore, accesso difficile) | coefficienti logistici |
| 11 | Hai già un tecnico? | spese tecniche 8% |
| 12 | Vuoi sapere gli incentivi? | |
| — | Animazione "Stiamo preparando il tuo preventivo" (6 s) | |
| 13 | Riepilogo + **"Confronta le offerte indicative"**: più basso / media / più alto + 5 card "**Impresa verificata A…E — Documenti e lavori verificati da EdilMen**" | vedi criticità |
| 14 | Sopralluogo gratuito o chiamata | |
| 15 | Canale di contatto (chiamata, WhatsApp, email) + privacy + marketing facoltativo → Invia | **nessun campo nome** |
| ✓ | "Grazie per la fiducia! Richiesta EM-000009" | |

Esempio ottenuto: bagno medio, livello Medio, Rovereto → offerte 8.961 € / 9.636 € / 10.021 € / 10.406 € / 10.696 €.

**Motore di calcolo (`js/calcolo.js`).** Funzioni pure ben fatte: prezzo prudente = parte fissa del livello × (1 + accantonamento variabili), varianti del listino (VA03–VA17), coefficiente territoriale per provincia, coefficienti logistici (casa abitata 1,08; senza ascensore 1,05; ZTL/accesso 1,05; soffitti alti 1,08), oneri sicurezza 2,5%, spese tecniche 8%, forchetta −7%/+11%. Il listino è la trascrizione del file *Pacchetti Edili Standardizzati v1.1* (52 pacchetti R/N, 3 livelli).

### 2.3 Altre pagine pubbliche
- **/imprese** — directory per regione, ricerca, filtro lavori (9 categorie), ordinamento rating/nome. Schede "Rating in costruzione", etichette "Impresa della rete EdilMen" / "Dati da registri pubblici" / "Profilo da verificare".
- **/imprese/{slug}** — scheda SEO: dati, prezzi del listino per la provincia ("non sono i prezzi dell'impresa"), FAQ, altre imprese vicine, "Completa il profilo", **form "Segnala un errore"**.
- **/imprese-edili/{città}** — landing locali.
- **/prezzi/** e **/prezzi/{lavoro}/{città}/** — 52 lavori con forchetta Standard–Premium per 13 province; "Prezzi reali dalla community" (upload quotazioni, pubblicate solo da 3 in su).
- **/rating.html** — metodologia pubblica: recensioni 60%, documenti 25% (visura, DURC, RC, patente a crediti), comportamento 15%; pubblicazione da 3 recensioni + visura; il piano a pagamento non cambia il rating. *Ben fatta.*
- **/rivendica.html** — claim in 3 passi: P.IVA + email → codice OTP 6 cifre (immediato se l'email è sul dominio del sito) → profilo: descrizione, province, per chi lavora, importi min/max, disponibilità, anni, addetti, certificazioni "dichiarate", **prezzi sui pacchetti EdilMen**, logo, 20 foto, video, voci extra con visibilità (tutti/registrati/nessuno), upload listino PDF/Excel/CSV, contatti, visibilità, abbonamento.
- **/aziende.html** — pagina imprese: piani **Start gratis (5 richieste/mese) · Pro 240 €/mese · Premium 400 €/mese**, "fee 4–6% sui lavori aggiudicati", form iscrizione; mock "Richieste ricevute 23 +18%".
- **blog** — 8 articoli, tutti marcati in admin "testo di esempio: verifica i dati prima di andare online".
- **Vocale** — registra/carica un messaggio vocale al posto del wizard.
- **/centralino** — postazione per operatori del call center.

---

## 3. Area di amministrazione — menu per menu

| Menu | Cosa fa | Dati |
|---|---|---|
| **Dashboard** | KPI "dal sito, dati veri" (vocali oggi, da richiamare, richieste nuove, aziende da verificare) + KPI di esempio (aziende attive, pacchetti, fee) + pipeline (Nuova→Videocall→Impresa scelta→Aggiudicata→In cantiere→Conclusa/Persa) + ultime richieste | **misto vero/esempio** ("il resto di questa pagina mostra ancora dati di esempio") |
| **Richieste dal sito** | Tab Tutte/Vocali/Quotazioni, stati Nuova/Contattata/Appuntamento/Preventivo inviato/Aggiudicata/Persa/Chiusa, Aziende (386 da verificare), Segnalazioni. Pannello dettaglio: contatto, zona, lavoro, superficie, quotazione vista, offerta scelta, appuntamento, fonte, imprese proposte (matching automatico), **consensi registrati con versione e timestamp**, stato, note | vero (Supabase) |
| **Artigiani da contattare** | Rubrica privata: import Excel, stati (Da chiamare, Da richiamare, Interessato, Convenzionato, Non interessato, Numero errato, Escluso), filtro mestiere, ricerca | vero (39 contatti) |
| **Centralino** | Code di chiamata per regione, esiti (Start/Pro/Premium, non interessata, 5 tentativi, numero sbagliato, non chiamare più), statistiche operatori, **previsione economica** della campagna | vero + previsione |
| **Listino EdilMen** | 52 pacchetti v1.1 per famiglia, prezzi 3 livelli, prudente, durata | da `listino.js` (statico) |
| **Prezzi delle imprese** | Prezzi dei pacchetti inseriti dalle imprese nel claim; soglie +15% "alto", −25% "anomalo, non si pubblica" | vero, 0 imprese |
| **Abbonamenti** | Pro 240 € / Premium 400 €, carta o bonifico | vero, 0 |
| **Prezzi dalla community** | Moderazione quotazioni caricate dagli utenti | vero, 0 |
| **Mappa aziende** | Copertura per città e raggio | **bug**: tutte le aziende a "0 km" da Trento (manca geocodifica) |
| **Aziende e professionisti** | 3.293 schede, stati Attive / Nel catalogo / Da verificare / Sospese, piano, **fee 5,0%** | vero |
| **Richieste e preventivi** | Lista richieste per stato + "Prova una richiesta dal sito" | vero |
| **Contratti, SAL ed escrow** | Escrow per SAL (cliente versa → impresa completa → cliente approva → rilascio) | vuoto, solo interfaccia |
| **Blog e contenuti** | 8 articoli, punteggio SEO, piano editoriale | prototipo |
| **Fee e report** | "fee dal 4 al 6%" | vuoto |
| **Impostazioni** | Fee predefinita 4–6%, assistente Nuvo, **"Tutti i dati sono di esempio e restano in questo browser"**, 23 categorie standard | prototipo |
| Rotte nascoste | `#/admin/approvazioni` (pacchetti da approvare), `#/admin/pacchetti` (pacchetti per azienda), `#/admin/confronto` (confronto offerte con filtri raggio/rating), `#/admin/blog/nuovo`, `#/cliente`, `#/cliente/cantiere`, `#/cliente/profilo`, `#/cliente/richiesta/:id` | prototipo |

---

## 4. Cosa funziona bene (da tenere)

1. **Il listino a pacchetti v1.1**: stesse voci per tutte le imprese, 3 livelli, prezzo prudente che al sopralluogo può solo scendere, varianti in %, componenti variabili a misura con ribasso. È il vero asset.
2. **Motore di calcolo puro e testabile** (`calcolo.js`).
3. **Metodologia del rating pubblica e corretta** (il voto non si compra, soglia di 3 recensioni, documenti con scadenza).
4. **Claim della scheda con OTP e regola del dominio**, listino con visibilità a 3 livelli: esattamente il modello "scheda base → claim → dati first-party → matching" del documento di compliance.
5. **Consensi registrati con versione e timestamp**; ai clienti non vengono passati i contatti.
6. Una domanda per schermata, "Non lo so ancora" sempre presente, salvataggio "continua più tardi".

## 5. Criticità (in ordine di gravità)

| # | Problema | Perché è grave | Correzione in EdilMen 2027 |
|---|---|---|---|
| 1 | **Offerte finte**: le 5 "Imprese verificate A–E — Documenti e lavori verificati da EdilMen" sono scarti fissi (−7%, 0, +4%, +8%, +11%) dalla media, con rating fissi 4,9–4,5 (nel codice: *"per ora dimostrativi"*) | Pratica commerciale ingannevole (Codice del Consumo art. 21–23), distrugge l'asset fiducia, contraddice i principi EdilMen | Si mostrano **solo offerte reali** di imprese con listino approvato; altrimenti il **prezzo di riferimento EdilMen** dichiarato come tale e "le offerte arrivano entro 48 h" |
| 2 | **Rating 4,8, "100% recensioni verificate", sotto‑punteggi** in home e pagina imprese, mentre **tutte** le schede sono "Rating in costruzione" | Social proof falsa | Contatori calcolati dal database; se zero, si mostra il metodo, non un numero |
| 3 | "42 imprese verificate" fisso | idem | contatore reale |
| 4 | Modello economico incoerente in 4 posti: fee 4–6% (aziende.html, impostazioni), 5% (admin aziende), 8/6/4% (strategia), piani 240/400 € vs 30/50 € (EdilRate) | Contratti e fatture non riconducibili a una regola | **Un'unica tabella di regole** versionata in admin (scaglioni fee, piani), letta da sito, contratti e report |
| 5 | Admin per metà su dati di esempio nel browser | Numeri non affidabili, rischio decisioni sbagliate | Tutto su Postgres, nessun dato demo in produzione |
| 6 | Wizard: regione chiesta due volte, contatore che salta da 9 a 15, nessun nome, nessun account | Attrito e lead poco qualificati | Comune con autocompletamento (regione dedotta), contatore stabile, account opzionale al termine |
| 7 | Mappa a 0 km | Il matching per raggio non funziona | Coordinate per comune (tabella ISTAT) e distanza reale |
| 8 | Nessun percorso per **agenzie immobiliari, immobiliaristi, grandi operazioni**; nessun account cliente reale | Il target dichiarato non è servito | Aree dedicate (sotto) |
| 9 | Escrow/SAL solo interfaccia; contratto non generato | Il modello di incasso non è eseguibile | Contratti, piano SAL 10/30/30/20/10, fee calcolata per SAL, stato incasso |
| 10 | Blog con testi "di esempio" pubblicati | SEO e credibilità | Stato bozza/pubblicato reale, flag "verificato" obbligatorio |
| 11 | "Fino a 200 ore a settimana risparmiate", mock "23 richieste +18%" in aziende.html | Promesse non vere | Rimosse |
| 12 | 147 KB di JS inline, nessun test, nessun backend | Non manutenibile | Monorepo con API, test sul motore prezzi |

---

## 6. Matrice funzioni: oggi → 2027

| Funzione | Oggi | 2027 |
|---|---|---|
| Quotazione privati | sì (wizard 15 passi) | sì, più corto, comune intelligente, salva in account |
| Offerte imprese | finte | reali da listini approvati + inviti a 3 imprese (gara) |
| Quotatore agenzie immobiliari | no | sì: portafoglio immobili, stima lavori per immobile, report PDF brandizzato per l'acquirente, link condivisibile |
| Immobiliaristi / operazioni | no | sì: operazione multi‑unità, costo €/m², margine operazione, richiesta d'offerta su computo |
| Grandi operazioni / PA | no | gara su computo metrico voce per voce (confronto come foglio CONFRONTO_AZIENDE) |
| Account utenti | solo admin | cliente, agenzia, impresa, operatore, admin |
| Area impresa | claim su pagina pubblica | dashboard: profilo, listino pacchetti, opportunità con accetta/rifiuta e prezzo, cantieri, SAL, fee |
| Rating | metodo pubblico, mai calcolato | calcolato da recensioni verificate + documenti + comportamento |
| Contratti e SAL | interfaccia vuota | generati da offerta accettata, SAL con foto, fee per SAL, stato incasso |
| Listino | file JS statico | in database, import da Excel v1.1, versioni |
| Directory imprese | 3.293 schede | import CSV con fonte e data, claim, stati, consensi separati |
| Call center | sì | rubrica artigiani + esiti (import Excel) |
