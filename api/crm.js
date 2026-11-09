// Internal CRM for the Destaca team (page: /crm). One function, actions picked with ?a=.
// Env (Vercel): DATABASE_URL (Neon). Nothing else.
// Auth: username + password (scrypt) + 6-digit code from an authenticator app (TOTP), then a random session token
// kept in the database (cookie __Host-crm, HttpOnly, SameSite=Strict, 7 days). 5 wrong tries lock the user for 15 min.
// Scripts and agents use "Authorization: Bearer <api key>"; the key is derived from DATABASE_URL.
// Users are created with prospeccao/crm-user.mjs.
// ponytail: rotating the Neon password rotates the api key too; give it its own env var if that ever hurts.
const { createHmac, createHash, createECDH, randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const { neon } = require('@neondatabase/serverless');
const mail = require('./_mail.js');
const webpush = require('web-push');

const STAGES = ['lead', 'contactado', 'respondeu', 'proposta', 'cliente', 'perdido', 'nao_contactar'];
const KINDS = ['email_out', 'email_in', 'rascunho', 'chamada', 'proposta', 'reuniao', 'trabalho', 'nota', 'estado'];
const FIELDS = ['name', 'category', 'city', 'website', 'domain', 'email', 'phone', 'instagram', 'score', 'notes', 'source', 'follow_up_at', 'follow_up_note'];
const SESSION_DAYS = 7, MAX_TRIES = 5, LOCK_MIN = 15;
const FREE_MAIL = /^(gmail|googlemail|hotmail|outlook|live|sapo|yahoo|icloud|msn|clix|netcabo|iol|mail)\./i;

let sql, ready;
const db = () => (sql ||= neon(process.env.DATABASE_URL));
const q = (text, params = []) => db().query(text, params);
// Schema: created/updated only when SCHEMA changes (bump it after editing DDL), so a cold start costs one query, not twenty.
const SCHEMA = '2026-11-10b';
const ensure = () => (ready ||= (async () => {
  const [v] = await q(`select value from settings where key='schema'`).catch(() => []);
  if (v?.value === SCHEMA) return;
  for (const s of DDL.split(';').filter((x) => x.trim())) await q(s);
  await q(`insert into settings (key,value) values ('schema',$1) on conflict (key) do update set value=$1`, [SCHEMA]);
})().catch((e) => { ready = null; throw e; }));
const DDL = `
  create table if not exists companies (
    id serial primary key, key text unique not null, name text not null, category text, city text,
    website text, domain text, email text, phone text, instagram text, score int, issues jsonb,
    stage text not null default 'lead', notes text, source text,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create table if not exists events (
    id serial primary key, company_id int not null references companies(id) on delete cascade,
    at timestamptz not null default now(), kind text not null, subject text, body text,
    by_user text, link text, ext_id text unique, created_at timestamptz not null default now());
  create index if not exists events_company on events(company_id, at desc);
  create table if not exists users (
    username text primary key, name text, pass_hash text not null, totp_secret text, totp_pending text,
    totp_last_step bigint not null default 0, failed int not null default 0, locked_until timestamptz,
    created_at timestamptz not null default now());
  create table if not exists sessions (
    token_hash text primary key, username text not null references users(username) on delete cascade,
    expires_at timestamptz not null, created_at timestamptz not null default now());
  alter table events add column if not exists message_id text;
  alter table events add column if not exists thread_id text;
  alter table events add column if not exists from_addr text;
  alter table events add column if not exists to_addr text;
  alter table events add column if not exists unread boolean not null default false;
  alter table companies add column if not exists follow_up_at date;
  alter table companies add column if not exists follow_up_note text;
  create table if not exists templates (id serial primary key, name text unique not null, subject text, body text not null, updated_at timestamptz not null default now());
  create table if not exists settings (key text primary key, value text);
  create table if not exists outbox (id serial primary key, company_id int not null references companies(id) on delete cascade,
    to_addr text not null, subject text not null, body text not null, send_at timestamptz not null, status text not null default 'agendado',
    sent_at timestamptz, error text, message_id text, created_by text, created_at timestamptz not null default now());
  create index if not exists outbox_due on outbox(status, send_at);
  create index if not exists events_unread on events(company_id) where unread;
  create index if not exists sessions_exp on sessions(expires_at);
  create table if not exists push_subs (endpoint text primary key, sub jsonb not null, username text, created_at timestamptz not null default now());
  alter table companies add column if not exists call_brief text;
  alter table companies add column if not exists call_result text;
  alter table companies add column if not exists call_feedback text;
  alter table companies add column if not exists call_attempts int not null default 0;
  alter table companies add column if not exists call_at timestamptz;
  alter table companies add column if not exists call_by text
`;

const apiKey = () => createHmac('sha256', process.env.DATABASE_URL || '').update('crm-api').digest('base64url');
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const sha = (s) => createHash('sha256').update(s).digest('hex');
const fail = (msg, code) => Object.assign(new Error(msg), { code });

// Passwords: scrypt with a random salt per user, stored as "salt:hash".
const hashPassword = (pw) => { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`; };
const checkPassword = (pw, stored) => {
  const [salt, h] = String(stored || 'x:').split(':');
  const got = scryptSync(String(pw || ''), salt || 'x', 64).toString('hex');
  return !!h && same(got, h);
};

// TOTP (RFC 6238): 30 s steps, 6 digits, accepts one step either side for clock drift. Returns the matched step (0 = no match).
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32encode = (buf) => { let bits = '', out = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; };
const b32decode = (s) => { let bits = ''; for (const c of s.toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, '0'); return Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2))); };
function totp(secret, step) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', b32decode(secret)).update(msg).digest(), o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
function checkTotp(secret, code, lastStep = 0, now = Date.now()) {
  const c = String(code || '').replace(/\s/g, ''), step = Math.floor(now / 30000);
  if (!/^\d{6}$/.test(c)) return 0;
  for (const s of [step - 1, step, step + 1]) if (s > lastStep && same(totp(secret, s), c)) return s; // a code works once
  return 0;
}

async function who(req) {
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) return same(auth.slice(7), apiKey()) ? 'agente' : null;
  const m = /(?:^|;\s*)__Host-crm=([A-Za-z0-9_-]{20,})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const [s] = await q('select username from sessions where token_hash=$1 and expires_at>now()', [sha(m[1])]);
  return s?.username || null;
}
// Cookie-authenticated writes must come from our own page (stops other sites from posting with the cookie).
const sameOrigin = (req) => { try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; } };
const cookie = (token, maxAge) => `__Host-crm=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;

async function login({ username, password, code }) {
  const u = String(username || '').toLowerCase().trim().slice(0, 40);
  const [user] = await q('select * from users where username=$1', [u]);
  const pwOk = checkPassword(password, user?.pass_hash); // scrypt runs even for unknown users, so timing gives nothing away
  if (user?.locked_until && new Date(user.locked_until) > new Date()) throw fail(`Demasiadas tentativas. Tente daqui a ${LOCK_MIN} minutos.`, 429);
  const wrong = async (msg) => {
    if (user) await q(`update users set failed=failed+1, locked_until=case when failed+1>=$2 then now()+interval '${LOCK_MIN} minutes' end where username=$1`, [u, MAX_TRIES]);
    throw fail(msg, 401);
  };
  if (!user || !pwOk) return wrong('Utilizador ou palavra-passe errados.');
  // First login: hand out a new authenticator key; it only becomes active once a code from it is confirmed.
  if (!user.totp_secret) {
    if (!code || !user.totp_pending) {
      const secret = b32encode(randomBytes(20));
      await q('update users set totp_pending=$2 where username=$1', [u, secret]);
      return { setup: { secret, uri: `otpauth://totp/Destaca%20CRM:${encodeURIComponent(u)}?secret=${secret}&issuer=Destaca%20CRM` } };
    }
    const step = checkTotp(user.totp_pending, code);
    if (!step) return wrong('Código errado. Confirme que a hora do telemóvel está certa e tente de novo.');
    await q('update users set totp_secret=totp_pending, totp_pending=null, totp_last_step=$2 where username=$1', [u, step]);
  } else {
    if (!code) return { need_code: true };
    const step = checkTotp(user.totp_secret, code, Number(user.totp_last_step));
    if (!step) return wrong('Código errado ou já usado.');
    await q('update users set totp_last_step=$2 where username=$1', [u, step]);
  }
  await q('update users set failed=0, locked_until=null where username=$1', [u]);
  await q('delete from sessions where expires_at<now()');
  const token = randomBytes(32).toString('base64url');
  await q(`insert into sessions (token_hash,username,expires_at) values ($1,$2,now()+interval '${SESSION_DAYS} days')`, [sha(token), u]);
  return { ok: true, username: u, token };
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let raw = '';
  for await (const c of req) { raw += c; if (raw.length > 4e6) throw new Error('too big'); }
  return JSON.parse(raw || '{}');
}

// One key per company so imports and agents never create duplicates: domain, else phone, else name.
const keyOf = (c) => {
  const d = String(c.domain || '').toLowerCase().replace(/^www\./, '').trim();
  if (d) return d;
  const p = String(c.phone || '').replace(/\D/g, '').replace(/^351(?=\d{9}$)/, '');
  if (p) return `tel:${p}`;
  return `nome:${String(c.name || '').toLowerCase().trim()}`;
};
const clean = (c) => Object.fromEntries(FIELDS.filter((f) => c[f] !== undefined).map((f) => [f,
  f === 'score' ? (c[f] === '' || c[f] == null ? null : Number(c[f])) : f === 'follow_up_at' ? (/^\d{4}-\d{2}-\d{2}$/.test(c[f]) ? c[f] : null) : String(c[f] ?? '').slice(0, 5000)]));

// Messages move the funnel forward on their own; nothing ever moves a company out of "não contactar".
function nextStage(stage, kind, body) {
  if (stage === 'nao_contactar' || stage === 'cliente') return stage;
  const inbound = kind.endsWith('_in');
  if (inbound && /^\W*remover\b/i.test(body || '')) return 'nao_contactar';
  if (inbound && ['lead', 'contactado'].includes(stage)) return 'respondeu';
  if (kind === 'proposta' && ['lead', 'contactado', 'respondeu'].includes(stage)) return 'proposta';
  if (/_out$/.test(kind) && stage === 'lead') return 'contactado';
  return stage;
}

// Finds the company for an event by id, email, email domain or phone; creates it when "create" is set.
async function findCompany(e, by) {
  if (e.company_id) return (await q('select * from companies where id=$1', [e.company_id]))[0];
  const email = String(e.email || '').toLowerCase().trim(), phone = String(e.phone || '').replace(/\D/g, '').slice(-9);
  const dom = email.split('@')[1] || '';
  const rows = await q(`select * from companies where ($1<>'' and lower(email)=$1) or ($2<>'' and key=$2)
    or ($3<>'' and right(regexp_replace(coalesce(phone,''),'\\D','','g'),9)=$3)
    order by (lower(email)=$1) desc limit 1`, [email, FREE_MAIL.test(dom) ? '' : dom, phone]);
  if (rows[0] || !e.create) return rows[0];
  const c = { name: e.name || email || e.phone, email, phone: e.phone, domain: e.domain, source: by === 'agente' ? 'agente' : 'manual' };
  return (await q(`insert into companies (key,name,email,phone,domain,source) values ($1,$2,$3,$4,$5,$6)
    on conflict (key) do update set updated_at=now() returning *`, [keyOf(c), c.name, c.email, c.phone, c.domain, c.source]))[0];
}

async function addEvent(e, by) {
  if (!KINDS.includes(e.kind) || e.kind === 'estado') throw fail('tipo de registo inválido', 400);
  const c = await findCompany(e, by);
  if (!c) throw fail('empresa não encontrada', 404);
  // REMOVER is final: no new outgoing messages. "already_sent" lets a sync record something that already happened.
  if (c.stage === 'nao_contactar' && /_out$|^rascunho$|^proposta$/.test(e.kind) && !e.already_sent) throw fail('Esta empresa pediu para não ser contactada (REMOVER).', 409);
  const ins = await q(`insert into events (company_id,at,kind,subject,body,by_user,link,ext_id,message_id,thread_id,from_addr,to_addr,unread)
    values ($1,coalesce($2::timestamptz,now()),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict (ext_id) do nothing returning *`,
    [c.id, e.at || null, e.kind, e.subject || null, e.body || null, by === 'agente' && e.by ? e.by : by, e.link || null, e.ext_id || null,
      e.message_id || null, e.thread_id || null, e.from_addr || null, e.to_addr || null, !!e.unread]);
  if (!ins[0]) return { duplicate: true, company_id: c.id };
  // "REMOVER" counts in the subject too; automatic replies (holidays, out of office) never move the funnel.
  const auto = e.kind.endsWith('_in') && mail.AUTO.test(e.subject || '');
  const stage = auto ? c.stage : nextStage(c.stage, e.kind, /^\W*(re:\s*)?remover\b/i.test(e.subject || '') ? 'REMOVER' : e.body);
  if (stage !== c.stage) await setStage(c.id, c.stage, stage, by, `automático: ${e.kind}`);
  else await q('update companies set updated_at=now() where id=$1', [c.id]);
  return { event: ins[0], company_id: c.id, stage };
}

async function setStage(id, from, to, by, why) {
  await q('update companies set stage=$2, updated_at=now() where id=$1', [id, to]);
  await q(`insert into events (company_id,kind,subject,by_user) values ($1,'estado',$2,$3)`, [id, `${from} → ${to}${why ? ` (${why})` : ''}`, by]);
}

// Bulk import from prospeccao/ (idempotent): companies upsert by key; the stage is only set while it is still "lead".
async function importAll({ companies = [], events = [] }) {
  // One row per key (Postgres refuses to upsert the same row twice in one statement); the first one wins.
  const byKey = new Map();
  for (const c of companies) { const k = keyOf(c); if (!byKey.has(k)) byKey.set(k, { ...clean(c), key: k, issues: c.issues || null, stage: STAGES.includes(c.stage) ? c.stage : 'lead' }); }
  const cs = [...byKey.values()];
  const r1 = await q(`insert into companies (key,name,category,city,website,domain,email,phone,instagram,score,issues,stage,notes,source)
    select key,name,category,city,website,domain,email,phone,instagram,score,issues,stage,notes,source
    from jsonb_to_recordset($1::jsonb) as x(key text,name text,category text,city text,website text,domain text,email text,phone text,instagram text,score int,issues jsonb,stage text,notes text,source text)
    on conflict (key) do update set name=excluded.name, category=excluded.category, city=excluded.city, website=excluded.website,
      domain=excluded.domain, email=coalesce(nullif(excluded.email,''),companies.email), phone=coalesce(nullif(excluded.phone,''),companies.phone),
      score=excluded.score, issues=excluded.issues, notes=coalesce(companies.notes, excluded.notes),
      stage=case when companies.stage='lead' then excluded.stage else companies.stage end, updated_at=now()
    returning id`, [JSON.stringify(cs)]);
  const es = events.filter((e) => KINDS.includes(e.kind)).map((e) => ({ ...e, key: keyOf(e) }));
  const r2 = await q(`insert into events (company_id,at,kind,subject,body,by_user,link,ext_id)
    select c.id, x.at, x.kind, x.subject, x.body, coalesce(x.by,'importação'), x.link, x.ext_id
    from jsonb_to_recordset($1::jsonb) as x(key text,at timestamptz,kind text,subject text,body text,by text,link text,ext_id text)
    join companies c on c.key=x.key on conflict (ext_id) do nothing returning id`, [JSON.stringify(es)]);
  return { companies: r1.length, events: r2.length, events_sent: es.length };
}

// ---- Email: sync from Gmail, send/reply, templates, follow-ups

const gmailLink = (messageId) => `https://mail.google.com/mail/?authuser=${mail.USER}#search/rfc822msgid:${encodeURIComponent(String(messageId).replace(/[<>]/g, ''))}`;

// Reads Gmail since the last sync and files every message with a client/lead into its company's timeline.
// Imported placeholders (from prospeccao/) of the same day are replaced by the real message instead of duplicated.
async function syncMail({ force } = {}) {
  if (!mail.ready()) throw fail('Falta a palavra-passe de app do Gmail (GMAIL_APP_PASSWORD).', 503);
  const [last] = await q(`select value from settings where key='mail_synced_at'`);
  // at most once a minute (the clocks call every 2-5 min; opening the CRM also triggers a read)
  if (!force && last && Date.now() - new Date(last.value) < 60000) return { skipped: true, synced_at: last.value };
  const started = new Date().toISOString();
  const since = last ? new Date(new Date(last.value) - 2 * 86400000) : new Date('2026-10-27');
  const msgs = await mail.fetchSince(since);
  let added = 0, merged = 0;
  const fresh = [];
  for (const m of msgs) {
    const out = m.from === mail.USER;
    const ext = `gmail:${m.messageId}`;
    let other = out ? m.to.find((a) => a !== mail.USER) : m.from, create = !out, name = m.fromName;
    if (/mailer-daemon|postmaster/.test(m.from)) { // bounce: note it on the company whose address failed
      const rows = await q(`select id from companies where email<>'' and position(lower(email) in lower($1))>0 limit 1`, [m.text || '']);
      if (rows[0]) {
        const r = await addEvent({ company_id: rows[0].id, kind: 'nota', at: m.date, subject: 'Email devolvido (não foi entregue)', body: (m.text || '').slice(0, 600), ext_id: ext, link: gmailLink(m.messageId) }, 'gmail');
        if (!r.duplicate) added++;
      }
      continue;
    }
    if (m.from === 'notify@web3forms.com') { const f = mail.formLead(m.text); if (!f) continue; other = f.email; name = f.name || f.email; create = true; }
    if (!other) continue;
    const c = await findCompany({ email: other, create, name: name || other }, 'gmail');
    if (!c) continue; // outgoing mail to someone who is not in the CRM (reports, suppliers…)
    const kind = out ? 'email_out' : 'email_in';
    const subject = m.from === 'notify@web3forms.com' ? `Pedido pelo site: ${m.subject}` : m.subject;
    const vals = [ext, m.date, subject, m.text, m.messageId, m.threadId ? String(m.threadId) : null, gmailLink(m.messageId), m.from, m.to.join(', ')];
    const upd = await q(`update events set ext_id=$1, at=$2, subject=$3, body=$4, message_id=$5, thread_id=$6, link=$7, from_addr=$8, to_addr=$9, by_user='gmail'
      where id=(select id from events where company_id=$10 and kind=$11 and ext_id like 'imp:%'
        and (at at time zone 'Europe/Lisbon')::date=($2::timestamptz at time zone 'Europe/Lisbon')::date order by at limit 1)
      and not exists (select 1 from events where ext_id=$1) returning id`, [...vals, c.id, kind]);
    if (upd[0]) { merged++; continue; }
    const r = await addEvent({ company_id: c.id, kind, at: m.date, subject, body: m.text, ext_id: ext, link: vals[6], message_id: m.messageId,
      thread_id: vals[5], from_addr: m.from, to_addr: vals[8], unread: !out, already_sent: true }, 'gmail');
    if (r.duplicate) continue;
    added++;
    // New message from a company in the last day (not old mail, not holiday auto-replies): tell the team's phones.
    if (!out && Date.now() - new Date(m.date) < 86400000 && !mail.AUTO.test(subject || '')) {
      const [co] = await q('select name, stage from companies where id=$1', [c.id]);
      fresh.push({ id: c.id, name: co.name, subject, snippet: String(m.text || '').replace(/\s+/g, ' ').slice(0, 140), remover: co.stage === 'nao_contactar' });
    }
  }
  await q(`insert into settings (key,value) values ('mail_synced_at',$1) on conflict (key) do update set value=$1`, [started]);
  for (const f of fresh.slice(0, 5)) {
    await notify(f.remover ? `${f.name} pediu REMOVER` : `📩 ${f.name} respondeu`,
      f.remover ? 'Já ficou em «Não contactar». Não é preciso responder.' : `${f.subject}\n${f.snippet}\n\nResponde o mais rápido possível.`,
      `https://destaca.site/crm/#e=${f.id}`, f.remover ? 3 : 5);
  }
  if (fresh.length > 5) await notify(`📩 Mais ${fresh.length - 5} emails de empresas`, 'Vê a lista «A seguir → Responder» no CRM.', 'https://destaca.site/crm/', 4);
  return { added, merged, read: msgs.length, notified: fresh.length, synced_at: started };
}

// Phone notifications: Web Push from the CRM itself (shows as "Destaca CRM" with the Destaca logo; on iPhone the CRM
// must be added to the home screen). VAPID keys are derived from DATABASE_URL. Failing to notify never breaks the sync.
let vapidPub;
function vapid() {
  if (vapidPub) return vapidPub;
  const priv = createHmac('sha256', process.env.DATABASE_URL || '').update('crm-vapid').digest();
  const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(priv);
  vapidPub = ecdh.getPublicKey().toString('base64url');
  webpush.setVapidDetails('mailto:contacto@destaca.site', vapidPub, priv.toString('base64url'));
  return vapidPub;
}
async function pushTo(sub, payload, urgency = 'normal') {
  vapid();
  try { await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 86400, urgency }); return true; }
  catch (e) {
    if ([404, 410].includes(e.statusCode)) await q('delete from push_subs where endpoint=$1', [sub.endpoint]); // phone unsubscribed
    else console.error('push', e.statusCode || e.message);
    return false;
  }
}
async function notify(title, message, click, priority = 4) {
  const subs = await q('select sub from push_subs').catch(() => []);
  const sent = await Promise.all(subs.map((s) => pushTo(s.sub, { title, body: message, url: click }, priority >= 5 ? 'high' : 'normal')));
  return sent.some(Boolean);
}

// Sends an email (or a reply) to a company and records it. Refuses "não contactar" and the spam words.
async function sendMail(b, by) {
  if (!mail.ready()) throw fail('Falta a palavra-passe de app do Gmail (GMAIL_APP_PASSWORD).', 503);
  const [c] = await q('select * from companies where id=$1', [b.company_id]);
  if (!c) throw fail('empresa não encontrada', 404);
  if (c.stage === 'nao_contactar') throw fail('Esta empresa pediu para não ser contactada (REMOVER).', 409);
  const to = String(b.to || c.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to)) throw fail('Email do destinatário inválido.', 400);
  const subject = String(b.subject || '').trim().slice(0, 300), text = String(b.body || '').trim().slice(0, 20000);
  if (!subject || !text) throw fail('Falta o assunto ou o texto.', 400);
  if (mail.FORBIDDEN.test(subject + text)) throw fail('Tire «grátis/gratuito/sem custo» do texto (risco de spam).', 400);
  let inReplyTo, references;
  if (b.reply_to) {
    const [orig] = await q('select message_id from events where id=$1 and company_id=$2', [b.reply_to, c.id]);
    if (orig?.message_id) { inReplyTo = orig.message_id; references = [orig.message_id]; }
  }
  const messageId = await mail.send({ to, subject, text, inReplyTo, references });
  await q('update events set unread=false where company_id=$1 and unread', [c.id]);
  return addEvent({ company_id: c.id, kind: 'email_out', subject, body: text, ext_id: `gmail:${messageId}`, message_id: messageId,
    from_addr: mail.USER, to_addr: to, link: gmailLink(messageId) }, by);
}

const OPTOUT = '—\nEnviámos esta mensagem porque o endereço {email} está publicado no site da vossa empresa. Se não quiserem receber mais contactos nossos, respondam com «REMOVER» e não voltaremos a escrever.';
const SEED_TEMPLATES = [
  ['Primeiro contacto', 'Sobre o site {dominio}', `Olá, equipa {empresa},

Somos a Destaca, uma agência portuguesa de sites e SEO, e estivemos a ver o site {dominio}.

Encontrámos alguns pontos em que vos podemos ajudar, para que o Google vos mostre melhor a quem procura os vossos serviços em {cidade}.

Se tiverem interesse, oferecemos uma consultoria ao vosso site, sem compromisso: vemos convosco o que está a funcionar, o que pode melhorar e por onde começar.

Basta responder a este email ou preencher o pedido de consultoria em https://destaca.site/#consultoria

Com os melhores cumprimentos,
${OPTOUT}`],
  ['Seguimento (sem resposta)', 'Re: Sobre o site {dominio}', `Olá, equipa {empresa},

Escrevemos há uns dias sobre o site {dominio}. Sabemos que o dia a dia é corrido, por isso deixamos só esta nota: se quiserem, marcamos 15 minutos para vos mostrar o que pode ser melhorado e por onde começar, sem compromisso.

Basta responder a este email.

Com os melhores cumprimentos,
${OPTOUT}`],
  ['Resposta a pedido de preços', 'Re: Preços', `Olá,

Obrigado pelo contacto. Os nossos serviços principais:

• Site de apresentação personalizado: 490 €
• Melhoramento do site atual: 290 €
• SEO mensal (aparecer mais no Google): de 90 a 290 €/mês, conforme o que for preciso

Se nos disserem um pouco mais sobre o negócio e o que procuram, preparamos uma proposta à medida.

Com os melhores cumprimentos,`],
  ['Envio de proposta', 'Proposta para {empresa}', `Olá,

Conforme combinado, segue a nossa proposta para {empresa}.

[resumo do que encontrámos e do que propomos]

Valor: [valor] €
Prazo: [prazo]

Ficamos ao dispor para qualquer dúvida ou para marcar uma conversa.

Com os melhores cumprimentos,`],
];
async function seedTemplates() {
  const [{ n }] = await q('select count(*)::int as n from templates');
  if (!n) for (const [name, subject, body] of SEED_TEMPLATES) await q('insert into templates (name,subject,body) values ($1,$2,$3) on conflict do nothing', [name, subject, body]);
}

// What needs attention: replies to answer, reminders due, leads with no reply after N days, proposals waiting.
async function followUps(days = 7) {
  // automatic replies (holidays, out of office) don't need an answer
  const last = `(select e.kind from events e where e.company_id=c.id and e.kind in ('email_in','email_out','proposta')
    and not (e.kind='email_in' and coalesce(e.subject,'') ~* '${mail.AUTO.source}') order by e.at desc limit 1)`;
  return {
    responder: await q(`select c.id,c.name,c.email,c.stage,(select max(at) from events e where e.company_id=c.id and e.kind='email_in') as at,
      (select count(*)::int from events e where e.company_id=c.id and e.unread) as unread
      from companies c where c.stage<>'nao_contactar' and ${last}='email_in' order by at desc`),
    lembretes: await q(`select id,name,email,stage,follow_up_at as at,follow_up_note as note from companies
      where follow_up_at is not null and follow_up_at<=current_date and stage<>'nao_contactar' order by follow_up_at`),
    sem_resposta: await q(`select c.id,c.name,c.email,c.stage,x.at,x.n from companies c
      join lateral (select max(at) as at, count(*)::int as n from events e where e.company_id=c.id and e.kind='email_out') x on true
      where c.stage='contactado' and x.at < now()-make_interval(days=>$1::int)
      and not exists (select 1 from events e where e.company_id=c.id and e.kind='email_in') order by x.at limit 100`, [days]),
    propostas: await q(`select c.id,c.name,c.email,c.stage,(select max(at) from events e where e.company_id=c.id and e.kind<>'estado') as at
      from companies c where c.stage='proposta' order by at`),
  };
}

// ---- Scheduled sending (outbox): pick leads, schedule by time slots, a clock (GitHub Actions / open CRM page) sends what is due.

// ponytail: fixed daily cap to protect the domain's reputation; make it a setting if it ever needs changing often.
const MAX_PER_DAY = 40;
const cronKey = () => createHmac('sha256', process.env.DATABASE_URL || '').update('crm-cron').digest('base64url');
const lisbonNow = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).replace(',', ''); // "2026-11-09 14:05"

// Leads never e-mailed and not already queued, generic company addresses only, worst site score first.
async function candidates({ n = 10, source = '', city = '', category = '' }) {
  return q(`select c.id,c.name,c.email,c.domain,c.website,c.city,c.category,c.score,c.source from companies c
    where c.stage='lead' and coalesce(c.email,'')<>'' and c.email !~* '@(gmail|googlemail|hotmail|outlook|live|sapo|yahoo|icloud|msn)\\.'
    and not exists (select 1 from events e where e.company_id=c.id and e.kind in ('email_out','email_in','rascunho'))
    and not exists (select 1 from outbox o where o.company_id=c.id and o.status in ('agendado','a enviar','enviado'))
    and ($1='' or c.source=$1) and ($2='' or c.city ilike '%'||$2||'%') and ($3='' or c.category ilike '%'||$3||'%')
    order by c.score asc nulls last, c.id limit $4`, [source, city, category, Math.min(Number(n) || 10, 100)]);
}

// Turns slots like [{time:'09:00',count:5},{time:'14:00',count:5}] into Lisbon date/time + seconds offset for each e-mail.
function plan(n, { start_date, slots, weekdays_only = true, gap = [2, 5] }) {
  const out = [], now = lisbonNow(), clean = (slots || []).filter((s) => /^\d{2}:\d{2}$/.test(s.time) && s.count > 0).sort((a, b) => a.time.localeCompare(b.time));
  if (!clean.length || !/^\d{4}-\d{2}-\d{2}$/.test(start_date || '')) throw fail('Escolha a data e pelo menos um horário.', 400);
  const day = new Date(`${start_date}T12:00:00Z`);
  for (let guard = 0; out.length < n && guard < 366; guard++, day.setUTCDate(day.getUTCDate() + 1)) {
    const wd = day.getUTCDay(), date = day.toISOString().slice(0, 10);
    if (weekdays_only && (wd === 0 || wd === 6)) continue;
    for (const s of clean) {
      if (`${date} ${s.time}` <= now) continue; // slot already passed
      let secs = 0;
      for (let i = 0; i < s.count && out.length < n; i++) {
        out.push({ date, time: s.time, secs });
        secs += Math.round((gap[0] + Math.random() * (gap[1] - gap[0])) * 60); // a few minutes apart, like a person
      }
    }
  }
  return out;
}

async function schedule(b, by) {
  const items = (b.items || []).slice(0, 200);
  if (!items.length) throw fail('Não há emails para agendar.', 400);
  const times = plan(items.length, b);
  if (times.length < items.length) throw fail('Os horários escolhidos não chegam para todos os emails.', 400);
  const rows = [];
  for (const [i, it] of items.entries()) {
    const [c] = await q('select * from companies where id=$1', [it.company_id]);
    const subject = String(it.subject || '').trim().slice(0, 300), body = String(it.body || '').trim().slice(0, 20000);
    const to = String(it.to || c?.email || '').trim().toLowerCase();
    if (!c || c.stage === 'nao_contactar') throw fail(`${c?.name || 'Empresa'}: não pode ser contactada.`, 409);
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to)) throw fail(`${c.name}: email inválido.`, 400);
    if (!subject || !body) throw fail(`${c.name}: falta o assunto ou o texto.`, 400);
    if (mail.FORBIDDEN.test(subject + body)) throw fail(`${c.name}: tire «grátis/gratuito/sem custo» (risco de spam).`, 400);
    if (/\{\w+\}|\[[^\]]*\]/.test(subject + body)) throw fail(`${c.name}: o texto ainda tem partes por preencher ({…} ou […]).`, 400);
    rows.push([c.id, to, subject, body, times[i].date, times[i].time, times[i].secs, by]);
  }
  for (const r of rows) {
    await q(`insert into outbox (company_id,to_addr,subject,body,send_at,created_by)
      values ($1,$2,$3,$4,(($5::date + $6::time) at time zone 'Europe/Lisbon') + make_interval(secs=>$7::int),$8)`, r);
  }
  return { scheduled: rows.length, first: `${times[0].date} ${times[0].time}`, last: `${times.at(-1).date} ${times.at(-1).time}` };
}

// Sends what is due. Safe to call often and from several places at once (rows are claimed with SKIP LOCKED).
async function tick() {
  if (!mail.ready()) return { sent: 0, waiting: 'gmail' };
  const [{ today }] = await q(`select count(*)::int as today from outbox where status='enviado' and sent_at >= date_trunc('day', now() at time zone 'Europe/Lisbon') at time zone 'Europe/Lisbon'`);
  const room = Math.max(0, Math.min(8, MAX_PER_DAY - today));
  if (!room) return { sent: 0, waiting: 'limite diário' };
  const due = await q(`update outbox set status='a enviar' where id in (select id from outbox where status='agendado' and send_at<=now()
    order by send_at limit $1 for update skip locked) returning *`, [room]);
  let sent = 0;
  for (const o of due) {
    try {
      const [c] = await q('select stage from companies where id=$1', [o.company_id]);
      const [replied] = await q(`select 1 from events where company_id=$1 and kind='email_in' and at>$2 limit 1`, [o.company_id, o.created_at]);
      const why = !c ? 'empresa apagada' : c.stage === 'nao_contactar' ? 'pediu REMOVER' : replied ? 'respondeu entretanto' : null;
      if (why) { await q(`update outbox set status='cancelado', error=$2 where id=$1`, [o.id, why]); continue; }
      const r = await sendMail({ company_id: o.company_id, to: o.to_addr, subject: o.subject, body: o.body }, `${o.created_by || 'equipa'} (agendado)`);
      await q(`update outbox set status='enviado', sent_at=now(), message_id=$2, error=null where id=$1`, [o.id, r.event?.message_id || null]);
      sent++;
    } catch (e) {
      await q(`update outbox set status='erro', error=$2 where id=$1`, [o.id, String(e.message).slice(0, 300)]);
    }
  }
  await q(`update outbox set status='erro', error='envio interrompido' where status='a enviar' and send_at < now()-interval '30 minutes'`);
  return { sent };
}

// ---- Call center: companies with a phone that were never contacted, a short brief for the caller, and the call outcome.

const CALL_RESULTS = {
  interessado: 'Interessado', ligar_depois: 'Pediu para ligar mais tarde', sem_interesse: 'Sem interesse',
  nao_atendeu: 'Não atendeu', numero_errado: 'Número errado', nao_contactar: 'Não quer ser contactado',
};
const MAX_TRIES_CALL = 3; // after 3 unanswered calls the company leaves the list as «não atende»
const CALL_COLS = 'c.id,c.name,c.category,c.city,c.phone,c.website,c.domain,c.score,c.stage,c.call_brief,c.call_attempts,c.call_result,c.call_feedback,c.call_at,c.call_by';

async function callLists() {
  const todo = await q(`select ${CALL_COLS} from companies c
    where coalesce(c.phone,'')<>'' and c.stage='lead'
      and (c.call_result is null or (c.call_result='nao_atendeu' and c.call_attempts<$1))
      and not exists (select 1 from events e where e.company_id=c.id and e.kind in ('email_out','email_in'))
      and not exists (select 1 from outbox o where o.company_id=c.id and o.status in ('agendado','a enviar'))
    order by c.call_attempts, (c.source = 'manual') desc, (c.call_brief is null), c.id`, [MAX_TRIES_CALL]); // companies added by hand first
  const done = await q(`select ${CALL_COLS} from companies c
    where c.call_result is not null and not (c.call_result='nao_atendeu' and c.call_attempts<$1)
    order by c.call_at desc nulls last limit 400`, [MAX_TRIES_CALL]);
  return { todo, done };
}

// Records one call: timeline event, funnel stage, reminder for the team, and whether the company stays in the list.
async function registerCall(b, by) {
  const [c] = await q('select * from companies where id=$1', [b.company_id]);
  if (!c) throw fail('empresa não encontrada', 404);
  if (b.action === 'reset') { // put it back in the list
    await q('update companies set call_result=null, call_feedback=null where id=$1', [c.id]);
    return { ok: true };
  }
  const r = b.result;
  if (!CALL_RESULTS[r]) throw fail('Escolha o resultado da chamada.', 400);
  const feedback = String(b.feedback || '').trim().slice(0, 4000);
  const attempts = (c.call_attempts || 0) + 1;
  const final = r === 'nao_atendeu' && attempts >= MAX_TRIES_CALL ? 'nao_atende' : r;
  const label = final === 'nao_atende' ? `Não atende (${attempts} tentativas)` : r === 'nao_atendeu' ? `Não atendeu (${attempts}.ª tentativa)` : CALL_RESULTS[r];
  await addEvent({ company_id: c.id, kind: 'chamada', subject: `📞 ${label}`, body: feedback || null }, by);
  const to = { interessado: ['lead', 'contactado'].includes(c.stage) ? 'respondeu' : c.stage, ligar_depois: c.stage === 'lead' ? 'contactado' : c.stage,
    sem_interesse: 'perdido', nao_contactar: 'nao_contactar' }[r];
  if (to && to !== c.stage && c.stage !== 'cliente') await setStage(c.id, c.stage, to, by, 'chamada');
  // reminders land in «A seguir → Lembretes»
  const callback = /^\d{4}-\d{2}-\d{2}$/.test(b.callback_at || '') ? b.callback_at : null;
  if (r === 'ligar_depois') await q('update companies set follow_up_at=coalesce($2::date, current_date + 2), follow_up_note=$3 where id=$1', [c.id, callback, `Ligar outra vez${feedback ? `: ${feedback.slice(0, 80)}` : ''}`]);
  if (r === 'interessado') await q(`update companies set follow_up_at=current_date, follow_up_note=$2 where id=$1`, [c.id, `Interessado ao telefone${feedback ? `: ${feedback.slice(0, 80)}` : ''}`]);
  await q('update companies set call_result=$2, call_attempts=$3, call_feedback=$4, call_at=now(), call_by=$5, updated_at=now() where id=$1', [c.id, final, attempts, feedback || null, by]);
  if (r === 'interessado') await notify(`📞 ${c.name} está interessado`, `${by} falou com eles${feedback ? `: ${feedback.slice(0, 140)}` : ''}.\nPreparem a proposta.`, `https://destaca.site/crm/#e=${c.id}`, 5);
  return { ok: true, result: final, attempts };
}

// Bulk update from prospeccao/crm-chamadas.mjs: brief for the caller, plus site, score, problems and a PT-PT sector name.
async function setBriefs(list = []) {
  let n = 0;
  for (const x of list.slice(0, 2000)) {
    const r = await q(`update companies set call_brief=$2, website=coalesce(nullif($3,''),website), domain=coalesce(nullif($4,''),domain),
      score=coalesce($5::int,score), issues=coalesce($6::jsonb,issues), category=coalesce(nullif($7,''),category) where key=$1 returning id`,
    [x.key, x.brief || null, x.website || '', x.domain || '', x.score ?? null, x.issues ? JSON.stringify(x.issues) : null, x.category || '']);
    n += r.length;
  }
  return { updated: n };
}

module.exports = async function handler(req, res) {
  const send = (code, body, headers = {}) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end(JSON.stringify(body));
  };
  const url = new URL(req.url, 'http://x'), a = url.searchParams.get('a');
  if (!process.env.DATABASE_URL) return send(500, { error: 'DATABASE_URL em falta' });

  try {
    await ensure();
    if (a === 'login' && req.method === 'POST') {
      if (!sameOrigin(req)) return send(403, { error: 'origem inválida' });
      const r = await login(await readBody(req));
      if (!r.ok) return send(200, r);
      return send(200, { username: r.username }, { 'Set-Cookie': cookie(r.token, SESSION_DAYS * 86400) });
    }
    if (a === 'logout' && req.method === 'POST') {
      const m = /(?:^|;\s*)__Host-crm=([A-Za-z0-9_-]{20,})/.exec(req.headers.cookie || '');
      if (m) await q('delete from sessions where token_hash=$1', [sha(m[1])]);
      return send(200, { ok: true }, { 'Set-Cookie': cookie('', 0) });
    }

    // The clock (GitHub Actions) only gets to send what is due, with its own key.
    // Every 5 min: read Gmail (and notify phones of new client mail), then send what is due.
    if (a === 'tick' && same(String(req.headers.authorization || ''), `Bearer ${cronKey()}`)) {
      const read = mail.ready() ? await syncMail().catch((e) => ({ error: e.message })) : { waiting: 'gmail' };
      return send(200, { read, ...(await tick()) });
    }

    const by = await who(req);
    if (!by) return send(401, { error: 'login' });
    if (req.method !== 'GET' && by !== 'agente' && !sameOrigin(req)) return send(403, { error: 'origem inválida' });

    if (a === 'me') return send(200, { username: by });
    if (a === 'companies') {
      // one pass over events instead of three sub-queries per company
      return send(200, await q(`select c.id,c.name,c.category,c.city,c.domain,c.website,c.email,c.phone,c.stage,c.source,c.score,c.follow_up_at,
        e.last_at, coalesce(e.n,0) as n, coalesce(e.unread,0) as unread
        from companies c left join (select company_id, max(at) filter (where kind<>'estado') as last_at,
          (count(*) filter (where kind<>'estado'))::int as n, (count(*) filter (where unread))::int as unread
          from events group by company_id) e on e.company_id=c.id
        order by e.last_at desc nulls last, c.name`));
    }
    if (a === 'company' && req.method === 'GET') {
      const id = Number(url.searchParams.get('id'));
      const [c] = await q('select * from companies where id=$1', [id]);
      if (!c) return send(404, { error: 'não existe' });
      if (by !== 'agente') await q('update events set unread=false where company_id=$1 and unread', [id]); // opened = read
      return send(200, { ...c, events: await q('select * from events where company_id=$1 order by at desc, id desc', [id]) });
    }
    if (a === 'company' && req.method === 'POST') {
      const b = await readBody(req), f = clean(b);
      if (b.id) {
        const [c] = await q('select * from companies where id=$1', [b.id]);
        if (!c) return send(404, { error: 'não existe' });
        const keys = Object.keys(f);
        if (keys.length) await q(`update companies set ${keys.map((k, i) => `${k}=$${i + 2}`).join(',')}, updated_at=now() where id=$1`, [c.id, ...keys.map((k) => f[k])]);
        if (b.stage && b.stage !== c.stage && STAGES.includes(b.stage)) await setStage(c.id, c.stage, b.stage, by);
        return send(200, { id: c.id });
      }
      if (!f.name) return send(400, { error: 'nome' });
      const keys = ['key', ...Object.keys(f)], vals = [keyOf(f), ...Object.values(f)];
      const [c] = await q(`insert into companies (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) on conflict (key) do nothing returning id`, vals);
      if (!c) return send(409, { error: 'Já existe uma empresa com este domínio, telefone ou nome.' });
      return send(200, { id: c.id });
    }
    if (a === 'event' && req.method === 'POST') return send(200, await addEvent(await readBody(req), by));
    if (a === 'event' && req.method === 'DELETE') {
      await q(`delete from events where id=$1 and kind<>'estado'`, [Number(url.searchParams.get('id'))]);
      return send(200, { ok: true });
    }
    if (a === 'sync') return send(200, await syncMail({ force: url.searchParams.get('force') === '1' }));
    if (a === 'send' && req.method === 'POST') return send(200, await sendMail(await readBody(req), by));
    if (a === 'followups') return send(200, await followUps(Number(url.searchParams.get('days')) || 7));
    if (a === 'templates' && req.method === 'GET') { await seedTemplates(); return send(200, await q('select * from templates order by name')); }
    if (a === 'templates' && req.method === 'POST') {
      const b = await readBody(req), name = String(b.name || '').trim().slice(0, 80), body = String(b.body || '').trim().slice(0, 20000), subject = String(b.subject || '').trim().slice(0, 300);
      if (!name || !body) return send(400, { error: 'Falta o nome ou o texto do modelo.' });
      if (mail.FORBIDDEN.test(subject + body)) return send(400, { error: 'Tire «grátis/gratuito/sem custo» do modelo (risco de spam).' });
      const [t] = b.id
        ? await q('update templates set name=$2, subject=$3, body=$4, updated_at=now() where id=$1 returning id', [b.id, name, subject, body])
        : await q('insert into templates (name,subject,body) values ($1,$2,$3) on conflict (name) do nothing returning id', [name, subject, body]);
      if (!t) return send(409, { error: 'Já existe um modelo com esse nome.' });
      return send(200, t);
    }
    if (a === 'templates' && req.method === 'DELETE') { await q('delete from templates where id=$1', [Number(url.searchParams.get('id'))]); return send(200, { ok: true }); }
    if (a === 'tick') return send(200, await tick());
    if (a === 'calls') return send(200, await callLists());
    if (a === 'call' && req.method === 'POST') return send(200, await registerCall(await readBody(req), by));
    if (a === 'briefs' && req.method === 'POST' && by === 'agente') return send(200, await setBriefs((await readBody(req)).list));
    // Web Push: the page asks for the public key, subscribes the phone, and the CRM keeps the subscription.
    if (a === 'push_key') return send(200, { key: vapid() });
    if (a === 'push_sub' && req.method === 'POST') {
      const { sub } = await readBody(req);
      if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return send(400, { error: 'subscrição inválida' });
      const [old] = await q('select 1 from push_subs where endpoint=$1', [sub.endpoint]);
      await q(`insert into push_subs (endpoint,sub,username) values ($1,$2,$3) on conflict (endpoint) do update set sub=$2, username=$3`, [sub.endpoint, JSON.stringify(sub), by]);
      if (!old) await pushTo(sub, { title: '✅ Notificações do CRM ligadas', body: 'A partir de agora recebes aqui um aviso quando uma empresa escrever.', url: 'https://destaca.site/crm/' });
      return send(200, { ok: true, new: !old });
    }
    if (a === 'push_unsub' && req.method === 'POST') { const { endpoint } = await readBody(req); await q('delete from push_subs where endpoint=$1', [String(endpoint || '')]); return send(200, { ok: true }); }
    if (a === 'candidates') return send(200, await candidates(Object.fromEntries(url.searchParams)));
    if (a === 'schedule' && req.method === 'POST') return send(200, await schedule(await readBody(req), by));
    if (a === 'outbox' && req.method === 'GET') {
      return send(200, await q(`select o.id,o.company_id,c.name,c.website,c.domain,c.score,o.to_addr,o.subject,o.body,o.send_at,o.status,o.sent_at,o.error,o.created_by
        from outbox o join companies c on c.id=o.company_id
        where o.status in ('agendado','a enviar','erro') or o.created_at > now()-interval '30 days'
        order by (o.status in ('agendado','a enviar')) desc, o.send_at limit 400`));
    }
    if (a === 'outbox' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.action === 'cancel') await q(`update outbox set status='cancelado', error='cancelado por '||$2 where id=$1 and status in ('agendado','erro')`, [b.id, by]);
      else if (b.action === 'retry') await q(`update outbox set status='agendado', send_at=now(), error=null where id=$1 and status in ('erro','cancelado')`, [b.id]);
      else if (b.action === 'cancel_all') await q(`update outbox set status='cancelado', error='cancelado por '||$1 where status='agendado'`, [by]);
      // Reserve button: everything scheduled goes out now, 30-60 s apart (still under the daily cap).
      else if (b.action === 'send_now') {
        const r = await q(`with x as (select id, row_number() over (order by send_at) - 1 as n from outbox where status='agendado')
          update outbox o set send_at = now() + make_interval(secs => (x.n * 45 + floor(random() * 15))::int) from x where o.id = x.id returning o.id`);
        return send(200, { ok: true, moved: r.length });
      }
      else {
        const subject = String(b.subject || '').trim(), body = String(b.body || '').trim();
        if (!subject || !body) return send(400, { error: 'Falta o assunto ou o texto.' });
        if (mail.FORBIDDEN.test(subject + body)) return send(400, { error: 'Tire «grátis/gratuito/sem custo» (risco de spam).' });
        await q(`update outbox set subject=$2, body=$3 where id=$1 and status='agendado'`, [b.id, subject, body]);
      }
      return send(200, { ok: true });
    }
    if (a === 'preview' && req.method === 'POST') { const b = await readBody(req); return send(200, mail.build(String(b.body || '').slice(0, 20000))); }
    if (a === 'status') { const [s] = await q("select value from settings where key='mail_synced_at'"); return send(200, { gmail: mail.ready(), synced_at: s?.value || null }); }
    // Admin actions: only with the api key (scripts in prospeccao/).
    if (a === 'import' && req.method === 'POST' && by === 'agente') return send(200, await importAll(await readBody(req)));
    if (a === 'user' && req.method === 'POST' && by === 'agente') {
      const { username, name, password, reset_code } = await readBody(req);
      const u = String(username || '').toLowerCase().trim();
      if (!/^[a-z0-9._-]{2,40}$/.test(u)) return send(400, { error: 'utilizador: só letras minúsculas, números, ponto, hífen' });
      if (password != null && String(password).length < 12) return send(400, { error: 'a palavra-passe precisa de pelo menos 12 caracteres' });
      const [old] = await q('select username from users where username=$1', [u]);
      if (!old && !password) return send(400, { error: 'falta a palavra-passe' });
      if (!old) await q('insert into users (username,name,pass_hash) values ($1,$2,$3)', [u, name || u, hashPassword(String(password))]);
      else {
        if (password) await q('update users set pass_hash=$2, failed=0, locked_until=null where username=$1', [u, hashPassword(String(password))]);
        if (reset_code) await q('update users set totp_secret=null, totp_pending=null, totp_last_step=0 where username=$1', [u]);
        if (password || reset_code) await q('delete from sessions where username=$1', [u]); // log out everywhere
      }
      return send(200, { ok: true, username: u, created: !old });
    }
    return send(404, { error: 'ação desconhecida' });
  } catch (e) {
    console.error('crm', a, e.message);
    const code = Number.isInteger(e.code) ? e.code : 500;
    return send(code, { error: code < 500 || code === 503 ? e.message : 'erro no servidor' });
  }
};

module.exports.nextStage = nextStage;
module.exports.keyOf = keyOf;
module.exports.totp = totp;
module.exports.checkTotp = checkTotp;
module.exports.checkPassword = checkPassword;
module.exports.hashPassword = hashPassword;
module.exports.plan = plan;
module.exports.vapid = vapid;
