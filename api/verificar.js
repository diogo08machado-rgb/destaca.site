// Cloudflare Turnstile for the quote and consultation forms.
// GET  /api/verificar          -> { sitekey } (empty when Turnstile is not configured, so the forms keep working)
// POST /api/verificar {token}  -> { ok } after Cloudflare confirms the challenge
// Keys live in Vercel env vars TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY.
// ponytail: Web3Forms free only accepts browser submissions, so this gates the form, not Web3Forms itself.
module.exports = async function handler(req, res) {
  const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
  const site = process.env.TURNSTILE_SITE_KEY || '', secret = process.env.TURNSTILE_SECRET_KEY;
  if (req.method === 'GET') return send(200, { sitekey: secret ? site : '' });
  if (req.method !== 'POST') return send(405, { ok: false });
  if (!site || !secret) return send(200, { ok: true });

  let token = '';
  try {
    const b = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    token = String(b.token || '').slice(0, 2048);
  } catch { return send(400, { ok: false }); }
  if (!token) return send(400, { ok: false });

  try {
    const form = new URLSearchParams({ secret, response: token });
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (ip) form.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(8000) });
    const out = await r.json();
    if (!out.success) console.error('turnstile', out['error-codes']);
    return send(out.success ? 200 : 403, { ok: !!out.success });
  } catch (e) {
    console.error('turnstile', e.message);
    return send(502, { ok: false });
  }
};
