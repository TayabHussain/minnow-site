// Vercel serverless function: receives the survey and emails it via Resend.
// The API key lives in an environment variable on the server, never in the page.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (v) => (Array.isArray(v) && v.length ? v.join(', ') : '–');
const clip = (v, n) => String(v ?? '').slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};


  const name = clip(b.name, 100).trim();
  const email = clip(b.email, 200).trim();
  const wouldUse = clip(b.wouldUse, 40).trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !wouldUse) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  const rows = [
    ['Name', name],
    ['Email', email],
    ['Would use a mini-program instead of an app', wouldUse],
    ['Does monthly on phone', list(b.usage)],
    ['Annoyance of one-off app downloads (1–5)', clip(b.annoyance, 2) || '–'],
    ['Usual online payment method', clip(b.payHow, 60) || '–'],
    ['Worries', list(b.worries)],
    ['Age group', clip(b.age, 20) || '–'],
    ['Country', clip(b.country, 40) || '–'],
    ['Most wanted service and why', clip(b.wish, 500) || '–'],
    ['Open to a short chat', b.openToChat ? 'Yes' : 'No'],
  ];

  const html =
    '<h2>New Minnow sign-up</h2><table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif">' +
    rows.map(([k, v]) => `<tr><td style="border-bottom:1px solid #ddd"><b>${esc(k)}</b></td><td style="border-bottom:1px solid #ddd">${esc(v)}</td></tr>`).join('') +
    '</table>';
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'Minnow <onboarding@resend.dev>',
        to: [process.env.TO_EMAIL || 'tayabhussain@live.nl'],
        reply_to: email,
        subject: `New Minnow sign-up: ${name}`,
        html,
        text,
      }),
    });
    if (!r.ok) {
      console.error('Resend error', r.status, await r.text());
      return res.status(502).json({ error: 'Email could not be sent' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend request failed', err);
    return res.status(502).json({ error: 'Email could not be sent' });
  }
};
