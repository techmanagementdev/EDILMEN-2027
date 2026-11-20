/* Calcolo delle quotazioni EdilMen.
   Funzioni pure: ricevono lo stato della procedura (S) e restituiscono voci e prezzi.
   Usato dal sito (window.EdilCalcolo) e dai test in Node (require). */
(function(root){
'use strict';
const INTERVENTI=[["completa","Ristrutturazione completa","Tutta la casa, chiavi in mano","home"],["parziale","Ristrutturazione parziale","Solo alcuni ambienti","bath"],["nuova","Nuova costruzione","Dal progetto alla consegna","crane"],["eff","Efficientamento","Tetto, finestre, cappotto, fotovoltaico, pompa di calore","leaf"]];
const AMBIENTI=[["bagno","Bagno"],["cucina","Cucina"],["pavimenti","Pavimenti"],["infissi","Infissi"],["elettrico","Impianto elettrico"],["idraulico","Impianto idraulico"],["tinteggiatura","Tinteggiatura"]];
const EFF=[["tetto","Tetto"],["finestre","Finestre"],["cappotto","Cappotto"],["fv","Fotovoltaico"],["pdc","Pompa di calore"]];
const IMMOBILI=[["app","Appartamento","In condominio"],["casa","Casa indipendente","Villa, schiera, rustico"],["neg","Negozio o ufficio","Locale commerciale"],["condo","Condominio o hotel","Intero edificio, più unità"]];
const NUOVA=[["singola","Villetta singola","Uno o due piani, giardino privato","villa"],["condo","Condominio","Più unità, scale e parti comuni","tower"],["legno","Prefabbricato in legno","X-Lam o telaio, tempi rapidi","tree"],["luxury","Villa di lusso","Finiture su misura, alta gamma","gem"]];
const LUX_LIVELLI=["Alto","Altissimo","Extra lusso"];
const PART=[["abitata","Ci abito durante i lavori"],["ztl","Centro storico o vincoli"],["noasc","Piano alto senza ascensore"],["accesso","Accesso difficile per i mezzi"],["soffittialti","Soffitti più alti della media"]];
const LIVELLI=["Standard","Medio","Premium"];
const COMP_COMPLETA=[["progettazione","Progettazione e pratiche",0.04,"pratiche edilizie e direzione lavori"],["preparazione","Preparazione cantiere",0.03,"protezioni e allestimento"],["demolizioni","Demolizioni e rimozioni",0.08,"smaltimento macerie incluso"],["murature","Opere murarie",0.09,"tramezzi e modifiche layout"],["cartongesso","Cartongesso",0.04,"controsoffitti e pareti divisorie"],["elettrico","Impianto elettrico",0.13,"fili, prese, quadro elettrico"],["idraulico","Impianto idraulico",0.12,"tubazioni e allacci"],["riscaldamento","Riscaldamento e climatizzazione",0.06,"termosifoni o pompa di calore"],["massetti","Massetti e sottofondi",0.06,"sottofondi per i pavimenti"],["pavimenti","Pavimenti",0.09,"fornitura e posa"],["rivestimenti","Rivestimenti",0.05,"piastrelle bagno e cucina"],["porte","Porte interne",0.04,"porte e telai"],["infissi","Infissi esterni",0.05,"finestre e portefinestre"],["tinteggiatura","Tinteggiatura e finiture",0.05,"pitture pareti e soffitti"],["isolamento","Isolamento ed efficientamento",0.03,"cappotto o coibentazioni interne"],["legno_metallo","Opere in legno e metallo",0.02,"ringhiere, scale, dettagli su misura"],["esterni","Esterni e pertinenze",0.01,"balconi e terrazzi"],["arredo","Arredo e finiture finali",0.01,"montaggio mobili su misura"]];
const COMP_NUOVA=[["progettazione","Progettazione e permessi",0.06,"permesso di costruire e direzione lavori"],["scavo","Scavo e fondazioni",0.10,"sbancamento e platea"],["struttura","Struttura portante",0.22,"muri portanti e solai"],["muri","Muri e tramezzi",0.08,"divisori interni"],["elettrico","Impianto elettrico",0.09,"impianto completo a norma"],["idraulico","Impianto idraulico",0.08,"tubazioni e allacci"],["riscaldamento","Riscaldamento e climatizzazione",0.06,"termosifoni o pompa di calore"],["isolamento","Isolamento e cappotto",0.08,"cappotto esterno"],["serramenti","Serramenti",0.07,"finestre e portoncino"],["pavimenti","Pavimenti e rivestimenti",0.08,"fornitura, posa, rivestimenti bagni"],["tinteggiatura","Tinteggiatura",0.03,"pareti e soffitti"],["porte","Porte interne",0.02,"porte e telai"],["esterni","Esterni e pertinenze",0.03,"vialetti e sistemazione area"]];
const MPARZ={
  bagno:{incluso:["Demolizione e smaltimento del bagno","Impianto idrico ed elettrico del locale","Impermeabilizzazione e massetto zona doccia","Sanitari, rubinetteria e rivestimenti da capitolato"],escluso:["Spostamento colonne di scarico condominiali","Vasca idromassaggio","Creazione o modifica finestra"]},
  cucina:{incluso:["Nuovo impianto idrico ed elettrico zona cucina","Rivestimento paraschizzi","Predisposizione attacchi lavello e lavastoviglie"],escluso:["Mobili cucina ed elettrodomestici","Piano cottura e cappa"]},
  pavimenti:{incluso:["Rimozione o posa in sovrapposizione","Rasatura del sottofondo","Fornitura e posa, battiscopa e soglie"],escluso:["Massetto nuovo completo se il sottofondo è inservibile","Riscaldamento a pavimento"]},
  infissi:{incluso:["Fornitura e posa dei nuovi serramenti","Sigillatura e smaltimento dei vecchi infissi"],escluso:["Opere murarie di allargamento vano","Persiane o tapparelle motorizzate"]},
  elettrico:{incluso:["Impianto elettrico a norma nei locali interessati","Certificazione di conformità"],escluso:["Quadro generale condominiale","Impianto citofonico o videocitofonico"]},
  idraulico:{incluso:["Nuove tubazioni e allacci nei locali interessati"],escluso:["Colonne di scarico condominiali comuni"]},
  tinteggiatura:{incluso:["Protezione pavimenti e arredi","Stuccatura fessurazioni superficiali","2 mani di idropittura"],escluso:["Rasatura completa a gesso se i muri sono molto irregolari","Trattamenti antimuffa strutturali"]}};
const MEFF={
  tetto:{incluso:["Rimozione manto esistente e smaltimento","Nuova impermeabilizzazione e posa manto"],escluso:["Rifacimento della struttura portante","Grondaie e pluviali se non ammalorati"]},
  finestre:{incluso:["Infissi nuovi con posa e sigillatura","Smaltimento dei vecchi serramenti"],escluso:["Opere murarie di allargamento vano","Persiane o tapparelle motorizzate"]},
  cappotto:{incluso:["Pannello isolante, rasatura e tinteggiatura finale","Ponteggio e opere provvisionali"],escluso:["Rifacimento di balconi e terrazzi","Sostituzione dei davanzali"]},
  fv:{incluso:["Pannelli, inverter, staffe e collegamento elettrico","Pratica di connessione alla rete"],escluso:["Ripristino della copertura","Autorizzazione condominiale (assistenza documenti inclusa)"]},
  pdc:{incluso:["Unità esterna e interna, collegamento elettrico"],escluso:["Adeguamento del contatore se sottodimensionato","Opere murarie per il posizionamento"]}};
const IMPRESE=[["A",-7,30,4.9,"Trento"],["B",0,35,4.8,"Rovereto"],["C",4,35,4.7,"Pergine"],["D",8,45,4.6,"Trento"],["E",11,45,4.5,"Bolzano"]];

/* Prezzi dal listino EdilMen (js/listino.js, pacchetti standardizzati v1.1): prezzo PRUDENTE per unità =
   parte fissa del livello + accantonamento per le componenti variabili, così al sopralluogo il prezzo può solo scendere.
   Base Trento, IVA esclusa, posa inclusa; fuori Trento si applica il coefficiente territoriale del listino. */
const listino=()=>root.EM_LISTINO||(typeof require==="function"?require("./listino.js"):null);
const territorio=()=>root.EM_TERRITORIO||(typeof require==="function"?require("./territorio.js"):null);
function prezzo(codice,liv,varianti){const L=listino(),p=L.pacchetti.find(x=>x.c===codice);let u=p.p[liv];
  (varianti||[]).forEach(c=>{const v=L.varianti.find(x=>x.c===c);if(v&&v.livelli.includes(liv))u*=1+v.delta});
  return Math.round(u*(1+p.acc)*100)/100}
/* Varianti del listino scelte con le domande specifiche del lavoro (S.dett): vasca, bagno piccolo, parquet, serramenti, isolante, sistema ibrido */
function varianti(S,codice){const d=S.dett||{},v=[];
  if(codice==="R03"){if(d.bagnoDim==="piccolo")v.push("VA06");if(d.bagnoDoccia==="vasca"||d.bagnoDoccia==="entrambe")v.push("VA05")}
  if(codice==="R05"&&d.pavMateriale==="parquet")v.push("VA07");
  if(codice==="R01"&&d.pavMateriale==="parquet")v.push("VA03");
  if(codice==="R10"){if(d.infMateriale==="alluminio")v.push("VA08");if(d.infMateriale==="legnoalluminio")v.push("VA09")}
  if(codice==="R16"){if(d.isolante==="roccia")v.push("VA11");if(d.isolante==="legno")v.push("VA12");if(d.isolante==="interno")v.push("VA13")}
  if(codice==="R13"&&d.pdcTipo==="ibrido")v.push("VA10");
  return v}
/* Nome della voce con le varianti scelte, es. "Bagno chiavi in mano, vasca al posto della doccia" */
function conVarianti(n,S,codice,liv){const L=listino(),vs=varianti(S,codice).map(c=>L.varianti.find(x=>x.c===c)).filter(x=>x&&x.livelli.includes(liv));
  return vs.length?n+", "+vs.map(x=>x.nome.charAt(0).toLowerCase()+x.nome.slice(1)).join(", "):n}
/* Prezzo di una voce variabile del listino (es. X02 spostamento colonna di scarico), per livello */
function variabile(codice,liv){const L=listino();for(const g of Object.values(L.variabili||{}))for(const v of (Array.isArray(g)?g:[g]))if(v&&v.v===codice)return v.p[liv];return 0}
const MQ_FINESTRA=1.9;   // m² medi di una finestra o portafinestra: il pacchetto R10 è a m² di serramento
const R01_COPRE=["preparazione","demolizioni","murature","cartongesso","elettrico","idraulico","massetti","pavimenti","rivestimenti","porte","tinteggiatura"];
function coefTerritorio(S){const T=territorio(),C=listino().parametri.territorio,sigla=T&&S.comune?T.provinciaDa(S.comune):null;
  if(sigla&&C[sigla]!=null)return C[sigla];if(["UD","GO","TS","PN"].includes(sigla))return C.fvg;
  return {ven:0.96,fvg:C.fvg}[S.regione]||1}

function voci(S){
  const compChecked=k=>S.comp[k]!==false,L=S.livello;
  const v=[];const add=(n,udm,qta,pu,pk)=>v.push({n,udm,qta,pu,tot:qta*pu,pk});
  const facciata=()=>S.cappottoMq||Math.round(Math.sqrt(S.mq/S.piani)*4*3*S.piani);
  const copertura=()=>S.tettoMq||Math.round(S.mq/S.piani*1.15);
  const pesoOk=(list,prefix)=>{const tot=list.reduce((s,c)=>s+c[2],0)||1;const sel=list.reduce((s,c)=>s+(compChecked(prefix+c[0])?c[2]:0),0);return sel/tot};
  if(S.intervento==="completa"){const alloggi=S.immobile==="condo"?Math.max(2,S.cucine||2):1;
    if(S.impianti===false){   // rinnovo completo senza rifare gli impianti (pacchetto R02)
      const vr=(S.dett||{}).pavVecchi==="sovrapponi"?[]:["VA04"];
      add("Rinnovo completo chiavi in mano senza impianti"+(vr.length?", demolizione dei pavimenti vecchi":", posa sopra i pavimenti esistenti"),"m²",S.mq,prezzo("R02",L,vr),"R02");
      if(S.bagniRifare>0)add("Bagno rifatto da zero","bagno",S.bagniRifare,prezzo("R03",L),"R03");}
    else{const w=pesoOk(COMP_COMPLETA.filter(c=>R01_COPRE.includes(c[0])),"cpl_");
      add(conVarianti("Ristrutturazione completa con impianti, livello "+LIVELLI[L].toLowerCase(),S,"R01",L),"m²",S.mq,prezzo("R01",L,varianti(S,"R01"))*w,"R01");
      const inclusi=Math.max(1,Math.round(S.mq/85*1.5));   // il pacchetto comprende 1,5 bagni ogni 85 m²
      if(S.bagni>inclusi)add("Bagno in più","bagno",S.bagni-inclusi,prezzo("R03",L),"R03");}
    if(compChecked("cpl_infissi"))add(conVarianti("Serramenti esterni",S,"R10",L),"finestra",Math.max(1,Math.round(S.mq*0.18/MQ_FINESTRA)),prezzo("R10",L,varianti(S,"R10"))*MQ_FINESTRA,"R10");
    const risc=S.risc||(compChecked("cpl_riscaldamento")?"pdc":"tengo");
    if(risc==="caldaia")add("Caldaia a condensazione nuova","alloggio",alloggi,prezzo("R36",L),"R36");
    if(risc==="pdc")add("Pompa di calore al posto della caldaia","alloggio",alloggi,prezzo("R13",L),"R13");
    if(risc==="ibrido")add("Sistema ibrido caldaia + pompa di calore","alloggio",alloggi,prezzo("R13",L,["VA10"]),"R13");
    const ex=S.extra||[];
    if(ex.includes("blindato"))add("Portoncino blindato","porta",alloggi,prezzo("R25",L),"R25");
    if(ex.includes("clima"))add("Climatizzazione","split",Math.max(2,Math.round(S.mq/30)),prezzo("R14",L),"R14");
    if(ex.includes("vmc"))add("Ventilazione con recupero di calore","apparecchio",Math.max(1,Math.round(S.mq/35)),prezzo("R15",L),"R15");
    if(ex.includes("domotica"))add("Domotica e casa smart","m²",S.mq,prezzo("R23",L),"R23");}
  if(S.intervento==="bagno"){const n=Math.max(1,S.q.bagno||1),d=S.dett||{};
    // bagno grande (oltre 7 m²): +20% sul pacchetto di riferimento da 5 m² (stima EdilMen, il listino ha solo la variante "piccolo")
    add(conVarianti("Rifacimento bagno chiavi in mano",S,"R03",L)+(d.bagnoDim==="grande"?", bagno grande":""),"bagno",n,prezzo("R03",L,varianti(S,"R03"))*(d.bagnoDim==="grande"?1.2:1),"R03");
    if(d.bagnoSanitari==="spostati")add("Spostamento della colonna di scarico","bagno",n,variabile("X02",L)*(1+listino().pacchetti.find(x=>x.c==="R03").acc),"X02");}
  if(S.intervento==="parziale"){
    const P={bagno:["Bagno chiavi in mano","bagno","R03",1],cucina:["Cucina, impianti e finiture","cucina","R04",1],pavimenti:["Pavimenti, fornitura e posa","m²","R05",1],infissi:["Serramenti esterni, sostituzione","finestra","R10",MQ_FINESTRA],elettrico:["Impianto elettrico nuovo","m²","R07",1],idraulico:["Impianto idrico e scarichi di bagno e cucina","alloggio","R08",1],tinteggiatura:["Pitture pareti e soffitti","m² di pareti","R06",1/3.2]};
    S.ambienti.forEach(a=>{const p=P[a];const items=(MPARZ[a]&&MPARZ[a].incluso)||[];const n=items.length;const checked=items.filter((_,i)=>compChecked(`parz_${a}_${i}`)).length;const w=n?checked/n:1;add(conVarianti(p[0],S,p[2],L),p[1],S.q[a]||0,prezzo(p[2],L,varianti(S,p[2]))*p[3]*w,p[2])});
    if(S.ambienti.includes("tinteggiatura")&&S.soffittiAlti)add("Maggiorazione soffitti oltre 3 m","corpo",1,(S.q.tinteggiatura||0)*prezzo("R06",L)/3.2*0.15);}
  if(S.intervento==="nuova"){const lux=S.nuovaTipo==="luxury",liv=lux?2:L;
    let u=prezzo("N01",liv,[...(S.nuovaTipo==="legno"?[S.struttura==="xlam"?"VA17":"VA16"]:[]),...(S.pianiNuova===1&&S.nuovaTipo!=="condo"?["VA19"]:[])]);
    if(S.nuovaTipo==="condo")u*=S.nUnita>=8?0.78:0.84;   // nessun pacchetto condominio nel listino: stima sul prezzo della casa singola
    const w=lux?1:pesoOk(COMP_NUOVA,"nuo_");
    add("Nuova costruzione, "+NUOVA.find(t=>t[0]===S.nuovaTipo)[1].toLowerCase(),"m²",S.mq,u*w,"N01");
    if(lux){add("Finiture "+LUX_LIVELLI[S.finLuxury].toLowerCase(),"m²",S.mq,{0:250,1:450,2:700}[S.finLuxury]);if(S.piscina)add("Piscina interrata con impianti","corpo",1,45000)}
    else if(S.classe==="a4"&&liv<2)add("Classe A4 / CasaClima Gold","m²",S.mq,u*0.08);
    if(S.interrato==="garage")add("Garage interrato","m²",30,prezzo("N13",liv),"N13");
    if(S.interrato==="interrato")add("Piano interrato","m²",Math.round(S.mq/Math.max(1,S.nuovaTipo==="condo"?3:S.pianiNuova||2)),prezzo("N13",liv),"N13");
    if(S.esterni)add("Sistemazioni esterne: giardino, vialetti e recinzione","m²",Math.round(S.mq*(S.nuovaTipo==="condo"?0.5:1)),prezzo("N12",liv),"N12");
    if(S.tecnico==="aiuto"){const lavori=v.reduce((s,x)=>s+x.tot,0);add("Progettazione, direzione lavori, pratiche","corpo",1,Math.round(lavori*listino().parametri.tecniche))}}
  if(S.intervento==="eff"){
    const wEff=a=>{const items=(MEFF[a]&&MEFF[a].incluso)||[];const n=items.length;const checked=items.filter((_,i)=>compChecked(`eff_${a}_${i}`)).length;return n?checked/n:1};
    if(S.eff.includes("tetto"))add("Rifacimento tetto con isolamento","m²",copertura(),prezzo("R17",L,{lamiera:["VA14"],piano:["VA15"]}[S.tettoTipo])*wEff("tetto"),"R17");
    if(S.eff.includes("finestre"))add(conVarianti("Serramenti esterni, sostituzione",S,"R10",L),"finestra",S.finestre,prezzo("R10",L,varianti(S,"R10"))*MQ_FINESTRA*wEff("finestre"),"R10");
    if(S.eff.includes("cappotto"))add(conVarianti("Cappotto termico di facciata",S,"R16",L),"m²",facciata(),prezzo("R16",L,varianti(S,"R16"))*wEff("cappotto"),"R16");
    if(S.eff.includes("fv")){const kw=Math.min(10,Math.max(3,Math.round(S.bolletta/50))),w=wEff("fv");   // bolletta ogni due mesi: 50 € ≈ 1 kWp
      if(!S.accumulo)add("Fotovoltaico "+kw+" kWp","impianto",1,(kw<=3?prezzo("R19",L):prezzo("R31",L)*Math.max(1,kw/6))*w,kw<=3?"R19":"R31");
      else if(kw<=3){add("Fotovoltaico 3 kWp","impianto",1,prezzo("R19",L)*w,"R19");add("Batteria di accumulo","kWh",5,prezzo("R20",L),"R20")}
      else if(kw<=6)add("Fotovoltaico 6 kWp con batteria 10 kWh","impianto",1,prezzo("R32",L)*w,"R32");
      else add("Fotovoltaico 10 kWp con batteria 15 kWh","impianto",1,prezzo("R33",L)*w,"R33")}
    if(S.eff.includes("pdc"))add(conVarianti("Pompa di calore al posto della caldaia",S,"R13",L),"alloggio",1,prezzo("R13",L,varianti(S,"R13"))*(1+Math.max(0,S.mq-120)*0.004)*wEff("pdc"),"R13");}
  return v;
}
/* Totale: lavori a prezzo prudente, coefficienti di zona e di cantiere del listino, oneri della sicurezza,
   spese tecniche se il cliente chiede aiuto (per la nuova costruzione sono già una voce). IVA esclusa. */
function stima(S){const P=listino().parametri,g=P.logistica,has=p=>S.part.includes(p);
  let t=voci(S).reduce((s,x)=>s+x.tot,0);if(S.immobile==="neg")t*=0.9;
  t*=coefTerritorio(S);if(has("abitata"))t*=g.abitata;if(has("noasc"))t*=g.noasc;if(has("ztl")||has("accesso"))t*=g.ztl;if(has("soffittialti"))t*=1.08;
  t*=1+P.sicurezza;if(S.tecnico==="aiuto"&&S.intervento!=="nuova")t*=1+P.tecniche;return t}
function pacchetto(S){return{completa:S.impianti===false?"Rinnovo completo chiavi in mano, impianti esistenti":"Ristrutturazione completa chiavi in mano",bagno:"Rifacimento bagno chiavi in mano"+((S.q.bagno||1)>1?" ("+S.q.bagno+" bagni)":""),parziale:"Ristrutturazione "+(S.ambienti.length?S.ambienti.slice(0,2).map(a=>AMBIENTI.find(x=>x[0]===a)[1].toLowerCase()).join(" e "):"parziale"),nuova:NUOVA.find(t=>t[0]===S.nuovaTipo)[1],eff:"Efficientamento: "+S.eff.map(e=>EFF.find(x=>x[0]===e)[1].toLowerCase()).join(", ")}[S.intervento]||""}
/* Stato iniziale della procedura: i valori predefiniti entrano nel calcolo. */
const statoIniziale=()=>({step:1,dett:{},intervento:null,ambienti:[],eff:["tetto","finestre","cappotto","fv","pdc"],immobile:null,regione:null,comune:"",tecnico:null,incentivi:null,comp:{},
  mq:120,bagni:2,cucine:1,piani:1,part:[],livello:1,soffittiAlti:false,q:{bagno:1,cucina:1,pavimenti:60,infissi:6,elettrico:0,idraulico:1,tinteggiatura:0},
  nuovaTipo:"singola",terreno:null,classe:"a",nUnita:4,struttura:"telaio",piscina:false,finLuxury:0,tettoMq:0,tettoTipo:"tegole",finestre:8,cappottoMq:0,bolletta:150,accumulo:false,
  foto:0,piano:0,scelta:null,mod:"sopralluogo",giorno:null,slot:null,canale:null,nome:"",cognome:"",tel:"",mail:"",indirizzo:"",done:false,t0:Date.now()});
/* Forchetta di prezzo della zona e offerte delle imprese: scarti fissi dalla media, per ora dimostrativi. */
function forchetta(S){const b=stima(S);return {min:b*0.93,media:b,max:b*1.11}}
function offerte(S){const b=stima(S);return IMPRESE.map(im=>({lettera:im[0],scarto:im[1],giorni:im[2],rating:im[3],prezzo:b*(1+im[1]/100)}))}

const api={prezzo,variabile,varianti,coefTerritorio,INTERVENTI,AMBIENTI,EFF,IMMOBILI,NUOVA,LUX_LIVELLI,PART,LIVELLI,COMP_COMPLETA,COMP_NUOVA,MPARZ,MEFF,IMPRESE,statoIniziale,voci,stima,pacchetto,forchetta,offerte};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EdilCalcolo=api;
})(this);
