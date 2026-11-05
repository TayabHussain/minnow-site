// Receives the survey, saves it in Supabase (with the hashed IP) and emails it via Resend.
const { clip, clientIp, hashIp, cleanSrc, sbInsert } = require('../lib/util');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (v) => (Array.isArray(v) && v.length ? v.join(', ') : '–');
const arr = (v) => (Array.isArray(v) ? v.slice(0, 12).map((x) => clip(x, 80)) : []);

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

  const source = cleanSrc(b.source);
  const annoy = parseInt(b.annoyance, 10);

  const rows = [
    ['Came from', source],
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

  const saveToDb = async () => {
    await sbInsert('survey_responses', {
      ip_hash: hashIp(clientIp(req)),
      src: source,
      name,
      email,
      would_use: wouldUse,
      usage: arr(b.usage),
      annoyance: annoy >= 1 && annoy <= 5 ? annoy : null,
      pay_how: clip(b.payHow, 60) || null,
      worries: arr(b.worries),
      age: clip(b.age, 20) || null,
      country: clip(b.country, 40) || null,
      wish: clip(b.wish, 500) || null,
      open_to_chat: !!b.openToChat,
    });
  };

  const sendEmail = async () => {
    const html =
      '<h2>New Minnow sign-up</h2><table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif">' +
      rows.map(([k, v]) => `<tr><td style="border-bottom:1px solid #ddd"><b>${esc(k)}</b></td><td style="border-bottom:1px solid #ddd">${esc(v)}</td></tr>`).join('') +
      '</table>';
    const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'Minnow <onboarding@resend.dev>',
        to: [process.env.TO_EMAIL || 'tayabhussain@live.nl'],
        reply_to: email,
        subject: `New Minnow sign-up (${source}): ${name}`,
        html,
        text,
      }),
    });
    if (!r.ok) throw new Error(`Resend error ${r.status}: ${await r.text()}`);
  };

  const [db, mail] = await Promise.allSettled([saveToDb(), sendEmail()]);
  if (db.status === 'rejected') console.error('Database save failed:', db.reason && db.reason.message);
  if (mail.status === 'rejected') console.error('Email failed:', mail.reason && mail.reason.message);

  if (db.status === 'rejected' && mail.status === 'rejected') {
    return res.status(502).json({ error: 'Could not save your answers' });
  }
  return res.status(200).json({ ok: true });
};
