# Quotatore v2, SEO e casa 3D · 20/11/2026

## Due modalità
- **Quotazione digitale** (prezzo subito) solo per: ristrutturazione completa, rifacimento bagno, nuova costruzione.
- **Vecchia scuola** per tutti gli altri lavori e per chi preferisce: tipo di lavoro, testo **o** vocale, foto, comune, contatto. Sempre raggiungibile da ogni domanda e dalla home; si torna alla quotazione digitale con un tocco.
- Invio vecchia scuola: con il vocale come prima (`/api/vocale`); solo testo con `/api/lead` (descrizione e tipo di lavoro); testo + foto prova `/api/vocale` e, se il servizio vuole per forza un vocale, parte con il testo e la nota "foto da chiedere su WhatsApp".

## Domande e listino (ogni risposta cambia il prezzo o serve all'impresa)
| Lavoro | Domanda | Voce del listino |
|---|---|---|
| Completa | Rifai anche gli impianti? | Sì: R01 (con impianti) · No: R02 (rinnovo senza impianti) |
| Completa senza impianti | Pavimenti vecchi da togliere? | VA04 demolizione |
| Completa | Bagni (con impianti) / bagni da rifare (senza) | R03 per ogni bagno oltre 1,5 ogni 85 m² / per ogni bagno da rifare |
| Completa | Pavimento camere e soggiorno | VA03 parquet |
| Completa | Finestre sì/no e materiale | R10, VA08, VA09 |
| Completa | Riscaldamento: tengo, caldaia, pompa di calore, ibrido | R36, R13, R13+VA10 |
| Completa | Aggiunte: blindato, aria condizionata, VMC, casa smart | R25, R14, R15, R23 |
| Bagno | Quanti, grandezza, doccia/vasca, sanitari spostati | R03, VA06 piccolo, +20% grande (stima da confermare), VA05 vasca, X02 colonna di scarico |
| Nuova | Tipo, piani, interrato/garage, classe, giardino | N01, VA16/17, VA19 un piano, N13, VA18, N12 |
| Tutti | Ci abito, centro storico, piano alto senza ascensore, accesso | coefficienti di logistica del listino |

"Cosa comprende il prezzo" mostra il capitolato del pacchetto dal listino: compreso, a misura (solo se serve), non compreso.

Verifica: `node legacy/test/scenari.cjs` (1.809 percorsi, 19 controlli di senso).

## SEO e prestazioni (Lighthouse mobile, copia locale)
| | Prima | Dopo |
|---|---|---|
| Performance | 69 | 93 |
| Accessibilità | 92 | 97+ |
| Best practices | 100 | 100 |
| SEO | 100 | 100 |
| Spostamento della pagina (CLS) | 0,361 | 0,005 |
| Contenuto principale (LCP) | 3,8 s | 3,1 s |

Interventi: scelte del lavoro già nell'HTML, spazio riservato alla mappa, immagine principale caricata per prima, font in pagina, compressione e cache sul server, arancione dei pulsanti più profondo (#E4500F) con testo grande per il contrasto, etichetta sul pulsante dello spot. Dati strutturati: attività con indirizzo, catalogo dei tre pacchetti con prezzi di partenza, FAQ sulle due modalità (anche visibili in pagina). `llms.txt` per gli assistenti AI, `/app` escluso dall'indicizzazione, sitemap aggiornata.

## Casa 3D
Sezione "Ogni lavoro, strato per strato" sotto i lavori più frequenti: casa esplosa in strati (struttura, impianti, finiture, bagno, serramenti, tetto) con three.js (licenza MIT, `site/js/vendor`). Scegliendo un pacchetto si accendono gli strati compresi; il pulsante apre la quotazione di quel pacchetto. Si carica solo quando la sezione è vicina, resta ferma con "movimenti ridotti", sparisce se il browser non ha WebGL. I testi della sezione sono nell'HTML.
