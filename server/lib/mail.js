// Invio email opzionale (Resend). Senza RESEND_API_KEY non invia nulla e lo dice.
export const mailEnabled = () => !!process.env.RESEND_API_KEY;
export async function sendMail({ to, subject, text, html }) {
  if (!mailEnabled()) return { sent: false, reason: 'email non configurata' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM || 'EdilMen <noreply@edilmen.it>', to: [to], subject, text, html }),
    });
    if (!r.ok) return { sent: false, reason: `Resend ${r.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}
