const crypto = require('crypto');

const clip = (v, n) => String(v ?? '').slice(0, n);

// Vercel sets x-forwarded-for to the visitor's IP.
function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return String(req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'unknown');
}

// One-way hash: lets us count unique visitors without storing the raw IP address.
// If IP_SALT is missing we fall back to a salt derived from the Supabase secret key, so tracking never silently breaks.
function hashIp(ip) {
  let salt = process.env.IP_SALT;
  if (!salt) {
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!k) throw new Error('IP_SALT is not set');
    salt = 'fallback|' + k;
  }
  return crypto.createHash('sha256').update(salt + '|' + ip).digest('hex');
}

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless/i;
const isBot = (ua) => BOT.test(String(ua || ''));

function cleanSrc(v) {
  return clip(v, 30).toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'direct';
}

function sbConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_')) headers.Authorization = 'Bearer ' + key; // legacy JWT keys need this; new sb_secret keys must not
  return { url, headers };
}

async function sbInsert(table, row) {
  const { url, headers } = sbConfig();
  const r = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`Supabase insert into ${table} failed: ${r.status} ${await r.text()}`);
}

async function sbRpc(fn, args = {}) {
  const { url, headers } = sbConfig();
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`Supabase rpc ${fn} failed: ${r.status} ${await r.text()}`);
  return r.json();
}

module.exports = { clip, clientIp, hashIp, isBot, cleanSrc, sbInsert, sbRpc };
