import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Field, ErrorBox, ComuneInput } from '../../ui.jsx';
import { api } from '../../api.js';

export default function VoicePage() {
  const [rec, setRec] = useState(null);
  const [blob, setBlob] = useState(null);
  const [secs, setSecs] = useState(0);
  const [v, setV] = useState({ name: '', phone: '', email: '', comune: null, privacy: false });
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);
  const timer = useRef();
  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => { setBlob(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })); stream.getTracks().forEach((t) => t.stop()); clearInterval(timer.current); };
      mr.start(); setRec(mr); setSecs(0);
      timer.current = setInterval(() => setSecs((s) => (s >= 179 ? (mr.stop(), 180) : s + 1)), 1000);
    } catch { setErr('Il browser non dà accesso al microfono: puoi caricare un file audio qui sotto.'); }
  };
  const stop = () => { rec?.stop(); setRec(null); };
  const send = async () => {
    setErr(null);
    if (!blob) return setErr('Registra o carica un vocale');
    const fd = new FormData();
    fd.append('audio', blob, blob.name || 'vocale.webm');
    for (const k of ['name', 'phone', 'email']) fd.append(k, v[k]);
    fd.append('comune', v.comune?.nome || '');
    fd.append('privacy', v.privacy ? 'true' : 'false');
    try { const r = await api.form('/public/voice', fd); setDone(r.code); } catch (e) { setErr(e.message); }
  };
  if (done) return <div className="max-w-xl mx-auto px-4 py-16 text-center"><div className="text-5xl">✅</div><h1 className="text-2xl font-extrabold mt-3">Vocale ricevuto ({done})</h1><p className="text-ink-soft mt-2">Un referente EdilMen lo ascolta e ti richiama in giornata lavorativa.</p><Link to="/" className="btn-ghost mt-6">Torna alla home</Link></div>;
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold">Non hai voglia di compilare? Mandaci un vocale</h1>
      <p className="text-ink-soft mt-2">Racconta il lavoro come lo diresti a un amico: cosa, dove, più o meno quanto è grande. Massimo 3 minuti.</p>
      <div className="card p-6 mt-6 space-y-4">
        <div className="flex items-center gap-3">
          {!rec ? <button className="btn-primary btn-lg" onClick={start}>🎙️ {blob ? 'Registra di nuovo' : 'Registra'}</button> : <button className="btn-danger btn-lg" onClick={stop}>⏹ Ferma ({secs}s)</button>}
          {blob && !rec && <audio controls src={URL.createObjectURL(blob)} className="h-10" />}
        </div>
        <Field label="Oppure carica un file audio"><input type="file" accept="audio/*" onChange={(e) => setBlob(e.target.files[0] || null)} /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome"><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Telefono"><input className="input" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          <Field label="Email (facoltativa)"><input className="input" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
          <Field label="Comune"><ComuneInput value={v.comune} onChange={(c) => setV({ ...v, comune: c })} /></Field>
        </div>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={v.privacy} onChange={(e) => setV({ ...v, privacy: e.target.checked })} /> Ho letto l'<Link to="/privacy" className="text-brand underline">informativa privacy</Link>.</label>
        <ErrorBox>{err}</ErrorBox>
        <button className="btn-primary w-full btn-lg" onClick={send}>Invia il vocale</button>
      </div>
    </div>
  );
}
