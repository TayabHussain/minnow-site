// The survey page calls this when it loads: logs who arrived and from which source.
const { clip, clientIp, hashIp, isBot, cleanSrc, sbInsert } = require('../lib/util');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (isBot(clip(req.headers['user-agent'], 300))) return res.status(200).json({ ok: true });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  try {
    await sbInsert('survey_views', { ip_hash: hashIp(clientIp(req)), src: cleanSrc(b.src) });
  } catch (err) {
    console.error('View not logged:', err.message);
  }
  return res.status(200).json({ ok: true });
};
