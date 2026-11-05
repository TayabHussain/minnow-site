// Receives the survey, validates it against survey-questions.json, saves it in Supabase
// (with the hashed IP) and emails it via Resend.
const { clip, clientIp, hashIp, cleanSrc, sbInsert } = require('../lib/util');
const DEF = require('../survey-questions.json');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Checks every answer against the question list, so only real options are ever saved.
function validate(raw) {
  const given = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const q of DEF.questions) {
    const v = given[q.id];
    if (q.type === 'text') {
      out[q.id] = clip(v, 1000).trim();
      if (q.required && !out[q.id]) return { error: `Missing answer: ${q.id}` };
    } else if (q.type === 'single') {
      if (typeof v !== 'string' || !q.options.includes(v)) {
        if (q.required) return { error: `Missing or invalid answer: ${q.id}` };
        out[q.id] = null;
      } else out[q.id] = v;
    } else {
      const picked = Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && q.options.includes(x)))] : [];
      if (q.required && !picked.length) return { error: `Missing answer: ${q.id}` };
      if (picked.length > 1 && picked.some((x) => (q.exclusive || []).includes(x))) return { error: `Invalid combination: ${q.id}` };
      out[q.id] = picked;
    }
  }
  const screen = DEF.questions.find((q) => q.screenOut);
  if (screen && out[screen.id] === screen.screenOut) return { error: 'Not eligible' };
  return { answers: out };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  const name = clip(b.name, 100).trim();
  const email = clip(b.email, 200).trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });

  const v = validate(b.answers);
  if (v.error) return res.status(400).json({ error: v.error });
  const answers = v.answers;
  const source = cleanSrc(b.source);

  const rows = [
    ['Came from', source],
    ['Name', name],
    ['Email', email],
    ...DEF.questions.map((q, i) => {
      const a = answers[q.id];
      return [`Q${i + 1}. ${q.text}`, Array.isArray(a) ? a.join('; ') || '–' : a || '–'];
    }),
  ];

  const saveToDb = async () => {
    await sbInsert('survey_responses', {
      ip_hash: hashIp(clientIp(req)),
      src: source,
      name,
      email,
      answers,
    });
  };

  const sendEmail = async () => {
    const html =
      '<h2>New Minnow survey response</h2><table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif">' +
      rows.map(([k, val]) => `<tr><td style="border-bottom:1px solid #ddd;vertical-align:top"><b>${esc(k)}</b></td><td style="border-bottom:1px solid #ddd;vertical-align:top">${esc(val)}</td></tr>`).join('') +
      '</table>';
    const text = rows.map(([k, val]) => `${k}: ${val}`).join('\n');
    const payload = {
      from: process.env.FROM_EMAIL || 'Minnow <onboarding@resend.dev>',
      to: [process.env.TO_EMAIL || 'tayabhussain@live.nl'],
      subject: `New Minnow response (${source}): ${name}`,
      reply_to: email,
      html,
      text,
    };
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`Resend error ${r.status}: ${await r.text()}`);
  };

  let dbError = '';
  try {
    await saveToDb();
  } catch (err) {
    dbError = (err && err.message) || 'unknown error';
    console.error('Database save failed:', dbError);
  }
  rows.splice(1, 0, ['Saved to dashboard', dbError ? 'NO - ' + dbError.slice(0, 200) : 'Yes']);

  let mailOk = true;
  try {
    await sendEmail();
  } catch (err) {
    mailOk = false;
    console.error('Email failed:', err && err.message);
  }

  if (dbError && !mailOk) {
    return res.status(502).json({ error: 'Could not save your answers' });
  }
  return res.status(200).json({ ok: true });
};
