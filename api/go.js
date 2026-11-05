// The CTA button points here. Logs the click (hashed IP), then sends the visitor on to the survey.
const { clip, clientIp, hashIp, isBot, cleanSrc, sbInsert } = require('../lib/util');

module.exports = async (req, res) => {
  const src = cleanSrc(req.query && req.query.src);
  const ua = clip(req.headers['user-agent'], 300);
  let status = 'skipped';

  if (req.method === 'GET' && !isBot(ua)) {
    try {
      await sbInsert('cta_clicks', { ip_hash: hashIp(clientIp(req)), src, user_agent: ua });
      status = 'ok';
    } catch (err) {
      const m = err.message || '';
      console.error('Click not logged:', m);
      // Short code in a response header: open DevTools -> Network -> api/go -> Response Headers.
      status = /not set/.test(m) ? 'missing-env-vars'
        : /PGRST205|42P01|does not exist|schema cache/.test(m) ? 'tables-missing-run-schema'
        : /401|403|Invalid API key|JWT/.test(m) ? 'bad-supabase-key'
        : 'database-error';
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('x-minnow-log', status);
  res.statusCode = 302;
  res.setHeader('Location', '/survey?src=' + encodeURIComponent(src));
  res.end();
};
