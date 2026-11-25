/* Configurazione pubblica del sito. Qui vanno SOLO valori pensati per stare nel browser:
   la chiave publishable di Supabase rispetta la Row Level Security (tutte le tabelle sono chiuse al pubblico).
   Le chiavi segrete (Supabase secret, Anthropic, Meta CAPI) stanno solo nelle variabili d'ambiente di Netlify. */
window.EM_CONFIG = {
  supabaseUrl: 'https://jizaatieotmgrzdnjydh.supabase.co',
  supabasePublishableKey: 'sb_publishable_xEuroDdRW2pPEd9G0vR6Qw_DNYXo7Fy'
};
