// Dashboard data: every survey submission. Protected by the DASHBOARD_KEY environment variable.
const crypto = require('crypto');
const { sbRpc } = require('../lib/util');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.DASHBOARD_KEY || '';
  const given = String(req.headers['x-dashboard-key'] || '');
  const ok = key.length > 0 && given.length === key.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key));
  if (!ok) return res.status(401).json({ error: 'Unauthorized' });

  try {
    return res.status(200).json(await sbRpc('get_responses'));
  } catch (err) {
    console.error('Responses failed:', err.message);
    return res.status(500).json({ error: 'Could not load responses' });
  }
};
