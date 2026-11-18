// Piccolo client per le API EdilMen.
async function call(method, path, body, isForm) {
  const r = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { j = { error: t }; }
  if (!r.ok) {
    const e = new Error((j && j.error) || `Errore ${r.status}`);
    e.status = r.status; e.data = j;
    throw e;
  }
  return j;
}
export const api = {
  get: (p) => call('GET', p),
  post: (p, b) => call('POST', p, b || {}),
  put: (p, b) => call('PUT', p, b || {}),
  patch: (p, b) => call('PATCH', p, b || {}),
  del: (p) => call('DELETE', p),
  form: (p, fd) => call('POST', p, fd, true),
};
