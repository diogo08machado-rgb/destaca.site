// Newsletter sign-up from the site pop-up: POST /api/newsletter {email, nome?, lang?, consent: true} -> adds the contact to E-goi list 1.
// The E-goi keys live in Vercel env vars (EGOI_PUBLIC_KEY / EGOI_PRIVATE_KEY), never in the browser.
const { createHmac } = require('node:crypto');

const LIST = 1;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function token() {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'HS256', typ: 'JWT', kid: process.env.EGOI_PUBLIC_KEY })}.${b64({ iat: now, exp: now + 120 })}`;
  return `${body}.${createHmac('sha256', process.env.EGOI_PRIVATE_KEY).update(body).digest('base64url')}`;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 4096) throw new Error('too big'); }
  return JSON.parse(raw || '{}');
}

module.exports = async function handler(req, res) {
  const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
  if (req.method !== 'POST') return send(405, { ok: false });
  let data;
  try { data = await readBody(req); } catch { return send(400, { ok: false, error: 'bad_request' }); }

  const email = String(data.email || '').trim().toLowerCase();
  const name = String(data.nome || '').trim().slice(0, 60);
  if (data.website) return send(200, { ok: true }); // honeypot: bots fill the hidden field
  if (data.consent !== true) return send(400, { ok: false, error: 'consent' });
  if (!EMAIL.test(email)) return send(400, { ok: false, error: 'email' });
  if (!process.env.EGOI_PUBLIC_KEY || !process.env.EGOI_PRIVATE_KEY) return send(500, { ok: false, error: 'config' });

  const base = { status: 'active', email, language: data.lang === 'en' ? 'en' : 'pt' };
  if (name) base.first_name = name;
  try {
    const r = await fetch(`https://api.egoiapp.com/lists/${LIST}/contacts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ base }),
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok || r.status === 409) return send(200, { ok: true }); // 409: already subscribed, same outcome for the visitor
    console.error('egoi', r.status, (await r.text()).slice(0, 300));
    return send(502, { ok: false, error: 'egoi' });
  } catch (e) {
    console.error('egoi', e.message);
    return send(502, { ok: false, error: 'egoi' });
  }
};
