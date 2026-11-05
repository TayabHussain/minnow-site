// The CTA button points here. Logs the click, then sends the visitor on to the survey.
const { clip, clientIp, hashIp, cleanSrc, sbInsert } = require('../lib/util');

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless/i;

module.exports = async (req, res) => {
  const src = cleanSrc(req.query && req.query.src);
  const ua = clip(req.headers['user-agent'], 300);

  if (req.method === 'GET' && !BOT.test(ua)) {
    try {
      await sbInsert('cta_clicks', { ip_hash: hashIp(clientIp(req)), src, user_agent: ua });
    } catch (err) {
      console.error('Click not logged:', err.message); // never block the visitor
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 302;
  res.setHeader('Location', '/survey?src=' + encodeURIComponent(src));
  res.end();
};
