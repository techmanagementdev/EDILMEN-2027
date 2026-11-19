# Correzioni del quotatore (copia identica di edilmen.it) · 19/11/2026

Verifica automatica: `node legacy/test/scenari.cjs` percorre 2.083 percorsi (ogni lavoro, ogni combinazione di ambienti, ogni immobile, ogni partenza dalla home, risposte "prima", "ultima" e "Non lo so ancora") e controlla testi, numeri, prezzi e blocchi, più 6 controlli di senso.

## Problemi trovati e corretti

| # | Dove | Problema | Correzione |
|---|---|---|---|
| 1 | Copia | I file della quotazione (`preventivo.js`, `flusso.js`, `testi.js`, `vocale.js`, `preventivo.css`, video) non erano stati copiati: sulla copia la quotazione non partiva | Script di copia esteso ai file caricati al clic |
| 2 | Home → Efficientamento tetto o cappotto → Appartamento | Il lavoro spariva e la quotazione usciva a 0 € senza voci | Se il lavoro scelto non si fa su quell'immobile, si chiede quali interventi |
| 3 | Ristrutturazione completa | Finestre (≈ 8.000 € su 90 m²) e pompa di calore (≈ 11.000 €; 143.000 € su un condominio) entravano sempre nel prezzo senza chiederlo | Due domande: "Cambi anche le finestre?" e "Sostituisci la caldaia con una pompa di calore?"; materiale finestre solo se le cambia |
| 4 | Completa, condominio | "Quante stanze da allestire?" in realtà contava gli alloggi per la pompa di calore | "Quanti appartamenti o unità ci sono?" |
| 5 | Parziale, impianto idraulico | "Quanti bagni e cucine vanno collegati?" ma il prezzo è per alloggio (bagno + cucina): con 2 risposte il prezzo raddoppiava | "In quanti appartamenti rifai l'impianto idraulico?" |
| 6 | Fotovoltaico | Bolletta "ogni due mesi" trattata come mensile: 150 € davano un impianto da 6 kWp con batteria (16.000 €) invece di 3 kWp | Taglia = bolletta bimestrale / 50 (150 € → 3 kWp) |
| 7 | Nuova costruzione | Il livello di finiture non veniva mai chiesto, ma il prezzo lo usava | Domanda sul livello e fasce Standard/Medio/Premium anche alla fine |
| 8 | Particolarità | "Piano alto senza ascensore" proposto per casa indipendente e nuova costruzione | Solo per appartamenti, negozi e condomini |
| 9 | Particolarità | Il coefficiente "casa abitata durante i lavori" (+8%) era nel listino ma mai chiesto | Nuova opzione "Ci abito durante i lavori" (non per la nuova costruzione) |
| 10 | Tecnico | Mancava la risposta "Sì, ho già un tecnico" (il testo esisteva ma non era tra le opzioni) | Tre risposte: ho già un tecnico, ho anche i permessi, trovatemelo |
| 11 | Superficie | Per un negozio chiedeva "Quanto è grande la casa?" | "Quanto è grande il locale?" |
| 12 | Livello | "Il prezzo lo vedi alla fine" mentre la stima è in alto a ogni passo | "La stima in alto si aggiorna subito" |
| 13 | Efficientamento | Ordine confuso: materiale delle finestre prima di quante finestre, dettagli del tetto mescolati alla superficie | Prima le quantità, poi i dettagli di ogni lavoro |
| 14 | Riepilogo ipotesi | "kit completo" e immobili negozio/condominio senza testo | Testi completati |
| 15 | Fasce di finitura alla fine | Mostrate solo per la ristrutturazione completa | Mostrate ovunque il livello è stato chiesto |

## Da decidere (non cambiato)

- **Offerte delle imprese**: le 5 offerte "Impresa verificata A–E" con "Miglior scelta" sono calcolate dal listino con scarti fissi (−7%, 0, +4%, +8%, +11%), non sono offerte di imprese reali. Anche la schermata di attesa dice "Cerchiamo le imprese verificate della zona". Proposta: chiamarle "fasce di prezzo della zona" finché non arrivano offerte vere.
- Le richieste inviate dalla copia arrivano al sito attuale (le funzioni `/api/*` sono girate a edilmen.it): con i nuovi campi (finestre, pompa di calore, "ci abito") nello stato salvato.
- Il workflow "Copia edilmen.it" ora chiede di scrivere SOVRASCRIVI, perché ricopiare il sito cancellerebbe queste correzioni.
