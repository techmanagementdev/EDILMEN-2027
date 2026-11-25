/* Territorio italiano: regioni e province (sigla, nome, regione). Condiviso tra sito (window.EM_TERRITORIO) e server (require/import). */
(function (root, crea) {
  if (typeof module === 'object' && module.exports) module.exports = crea();
  else root.EM_TERRITORIO = crea();
})(typeof self !== 'undefined' ? self : this, function () {
  const REGIONI = {
    pie: 'Piemonte', vda: "Valle d'Aosta", lom: 'Lombardia', taa: 'Trentino-Alto Adige', ven: 'Veneto', fvg: 'Friuli-Venezia Giulia',
    lig: 'Liguria', emr: 'Emilia-Romagna', tos: 'Toscana', umb: 'Umbria', mar: 'Marche', laz: 'Lazio', abr: 'Abruzzo', mol: 'Molise',
    cam: 'Campania', pug: 'Puglia', bas: 'Basilicata', cal: 'Calabria', sic: 'Sicilia', sar: 'Sardegna',
  };
  const ELENCO = {
    pie: 'TO Torino|VC Vercelli|NO Novara|CN Cuneo|AT Asti|AL Alessandria|BI Biella|VB Verbano-Cusio-Ossola',
    vda: 'AO Aosta',
    lom: 'VA Varese|CO Como|SO Sondrio|MI Milano|BG Bergamo|BS Brescia|PV Pavia|CR Cremona|MN Mantova|LC Lecco|LO Lodi|MB Monza e Brianza',
    taa: 'BZ Bolzano|TN Trento',
    ven: 'VR Verona|VI Vicenza|BL Belluno|TV Treviso|VE Venezia|PD Padova|RO Rovigo',
    fvg: 'UD Udine|GO Gorizia|TS Trieste|PN Pordenone',
    lig: 'IM Imperia|SV Savona|GE Genova|SP La Spezia',
    emr: 'PC Piacenza|PR Parma|RE Reggio Emilia|MO Modena|BO Bologna|FE Ferrara|RA Ravenna|FC Forlì-Cesena|RN Rimini',
    tos: 'MS Massa-Carrara|LU Lucca|PT Pistoia|FI Firenze|LI Livorno|PI Pisa|AR Arezzo|SI Siena|GR Grosseto|PO Prato',
    umb: 'PG Perugia|TR Terni',
    mar: 'PU Pesaro e Urbino|AN Ancona|MC Macerata|AP Ascoli Piceno|FM Fermo',
    laz: 'VT Viterbo|RI Rieti|RM Roma|LT Latina|FR Frosinone',
    abr: "AQ L'Aquila|TE Teramo|PE Pescara|CH Chieti",
    mol: 'CB Campobasso|IS Isernia',
    cam: 'CE Caserta|BN Benevento|NA Napoli|AV Avellino|SA Salerno',
    pug: 'FG Foggia|BA Bari|TA Taranto|BR Brindisi|LE Lecce|BT Barletta-Andria-Trani',
    bas: 'PZ Potenza|MT Matera',
    cal: 'CS Cosenza|CZ Catanzaro|RC Reggio Calabria|KR Crotone|VV Vibo Valentia',
    sic: 'TP Trapani|PA Palermo|ME Messina|AG Agrigento|CL Caltanissetta|EN Enna|CT Catania|RG Ragusa|SR Siracusa',
    sar: 'SS Sassari|NU Nuoro|CA Cagliari|OR Oristano|SU Sud Sardegna',
  };
  const PROVINCE = {};
  for (const [reg, s] of Object.entries(ELENCO)) for (const p of s.split('|')) PROVINCE[p.slice(0, 2)] = { nome: p.slice(3), regione: reg };

  // Comuni frequenti del Triveneto (dove oggi si fanno i lavori) oltre ai capoluoghi
  const COMUNI = { rovereto: 'TN', pergine: 'TN', 'riva del garda': 'TN', arco: 'TN', mezzolombardo: 'TN', cles: 'TN', levico: 'TN',
    merano: 'BZ', bressanone: 'BZ', brunico: 'BZ', mestre: 'VE', chioggia: 'VE', jesolo: 'VE', bassano: 'VI', cortina: 'BL',
    monfalcone: 'GO', lignano: 'UD', cividale: 'UD', tolmezzo: 'UD' };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  // Provincia dal comune o dal CAP scritti dal cliente (null se non si capisce)
  function provinciaDa(testo) {
    const t = norm(testo);
    if (!t) return null;
    const cap = t.match(/\b(\d{5})\b/);
    if (cap) {
      const c = +cap[1], p3 = cap[1].slice(0, 3);
      if (c >= 38000 && c < 39000) return 'TN';
      if (c >= 39000 && c < 40000) return 'BZ';
      if (c >= 37000 && c < 38000) return 'VR';
      if (c >= 36000 && c < 37000) return 'VI';
      if (c >= 35000 && c < 36000) return 'PD';
      if (c >= 31000 && c < 32000) return 'TV';
      if (c >= 32000 && c < 33000) return 'BL';
      if (c >= 30000 && c < 31000) return 'VE';
      if (c >= 45000 && c < 46000) return 'RO';
      if ((c >= 33070 && c < 33100) || p3 === '331' && c >= 33170 && c < 33180) return 'PN';
      if (c >= 33000 && c < 34000) return 'UD';
      if ((c >= 34070 && c < 34080) || (c >= 34170 && c < 34180)) return 'GO';
      if (c >= 34000 && c < 35000) return 'TS';
    }
    for (const [sigla, p] of Object.entries(PROVINCE)) if (t.includes(norm(p.nome))) return sigla;
    for (const [nome, sigla] of Object.entries(COMUNI)) if (t.includes(nome)) return sigla;
    return null;
  }

  return { REGIONI, PROVINCE, provinciaDa, norm };
});
