// Pages call this when they load: logs who arrived (hashed IP) and from which source.
// page = 'landing' (main page) or 'survey' (survey page, the default).
const { clip, clientIp, hashIp, isBot, cleanSrc, sbInsert } = require('../lib/util');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (isBot(clip(req.headers['user-agent'], 300))) return res.status(200).json({ ok: true });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  const row = { ip_hash: hashIp(clientIp(req)), src: cleanSrc(b.src) };
  if (b.page === 'landing') row.page = 'landing'; // survey visits omit it, so they keep working before update-2.sql is run

  try {
    await sbInsert('survey_views', row);
  } catch (err) {
    console.error('View not logged:', err.message);
  }
  return res.status(200).json({ ok: true });
};
