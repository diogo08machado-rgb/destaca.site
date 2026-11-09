// Gmail of contacto@destaca.site over IMAP (read) and SMTP (send), with a Google "app password" (env GMAIL_APP_PASSWORD).
// No Google Cloud project needed. Used by api/crm.js (files starting with _ are not deployed as their own function).
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');

const USER = 'contacto@destaca.site';
// Senders that are never clients: services, reports, bounces (bounces are handled apart).
const NOISE = /(no-?reply|notifications?@|notify@(?!web3forms)|dmarc|@e-goi\.|@mcafee\.|@sophos\.|@kaspersky\.|@vercel\.|@google\.com|@.*google\.com|metamail|mailchimp|@web3forms\.com|dmarcchecker|@accounts\.|@facebookmail|@linkedin)/i;
const AUTO = /^(resposta autom|automatic reply|auto(matic)?[- ]?reply|out of office|ausente|ausência|f[eé]rias|abwesen)/i;
const FORBIDDEN = /gr[aá]tis|gratuit|sem custo/i;

const ready = () => !!process.env.GMAIL_APP_PASSWORD;
const addr = (a) => String(a?.address || '').toLowerCase();

// Keeps the new part of a reply: cuts the quoted previous message and long signatures' history.
function trimQuoted(text) {
  const t = String(text || '').replace(/\r/g, '');
  const cut = t.search(/^(>|Em .{5,120}escreveu:|On .{5,120}wrote:|-{2,} ?(Original Message|Mensagem original)|De: .+\n(Enviad[ao]|Sent|Data|Date):|From: .+\n(Sent|Date):|_{8,})/im);
  return (cut > 0 ? t.slice(0, cut) : t).trim().slice(0, 8000);
}
const htmlToText = (h) => String(h || '').replace(/<(style|script)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n');

// Site form (Web3Forms) e-mails: the lead's own address and name are in the body.
function formLead(text) {
  const email = /e-?mail\s*[:\n]\s*([^\s<>]+@[^\s<>]+\.[a-z]{2,})/i.exec(text)?.[1]?.toLowerCase();
  if (!email) return null;
  const name = /(?:nome|name|empresa)\s*[:\n]\s*([^\n]{2,80})/i.exec(text)?.[1]?.trim();
  return { email, name };
}

// Every message in "All Mail" since a date (sent and received, not drafts), parsed. Fetches bodies only for the ones kept.
async function fetchSince(since) {
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: USER, pass: process.env.GMAIL_APP_PASSWORD }, logger: false });
  await client.connect();
  try {
    const boxes = await client.list();
    const all = boxes.find((b) => b.specialUse === '\\All')?.path || '[Gmail]/All Mail';
    const lock = await client.getMailboxLock(all, { readOnly: true });
    try {
      const uids = await client.search({ since }, { uid: true });
      if (!uids?.length) return [];
      const heads = [];
      for await (const m of client.fetch(uids, { uid: true, envelope: true, threadId: true, labels: true, headers: ['list-unsubscribe', 'auto-submitted'] }, { uid: true })) {
        const labels = [...(m.labels || [])];
        if (labels.includes('\\Draft')) continue;
        const from = addr(m.envelope?.from?.[0]), to = [...(m.envelope?.to || []), ...(m.envelope?.cc || [])].map(addr).filter(Boolean);
        const h = String(m.headers || '');
        heads.push({ uid: m.uid, threadId: m.threadId, from, fromName: m.envelope?.from?.[0]?.name || '', to, subject: m.envelope?.subject || '',
          date: m.envelope?.date, messageId: m.envelope?.messageId, inReplyTo: m.envelope?.inReplyTo,
          bulk: /list-unsubscribe/i.test(h) || /auto-submitted:\s*auto-(generated|replied)/i.test(h) });
      }
      const keep = heads.filter((m) => m.messageId && (m.from === USER || m.from === 'notify@web3forms.com' || /mailer-daemon|postmaster/.test(m.from) || (!m.bulk && !NOISE.test(m.from))));
      for (const m of keep) {
        const msg = await client.fetchOne(m.uid, { source: { maxLength: 400000 } }, { uid: true });
        const p = await simpleParser(msg.source);
        m.text = m.from === 'notify@web3forms.com' || /mailer-daemon|postmaster/.test(m.from) ? (p.text || htmlToText(p.html)) : trimQuoted(p.text || htmlToText(p.html));
        m.references = [].concat(p.references || []);
      }
      return keep;
    } finally { lock.release(); }
  } finally { await client.logout().catch(() => {}); }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const P = 'font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#050f16;';
const SIGNATURE = `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;"><tr>
<td valign="middle" style="padding-right:18px;"><div style="font-size:30px;line-height:32px;font-weight:bold;color:#050f16;letter-spacing:-0.5px;">Destaca<span style="color:#ff5a14;">.</span></div>
<div style="font-size:10px;line-height:14px;font-weight:bold;color:#6b7680;letter-spacing:2px;padding-top:4px;">SEO &amp; SITES</div></td>
<td valign="top" style="border-left:3px solid #ff5a14;padding-left:18px;"><div style="font-size:16px;line-height:22px;font-weight:bold;color:#050f16;">Equipa Destaca</div>
<div style="font-size:13px;line-height:20px;color:#6b7680;padding-bottom:8px;">Sites de Apresentação Personalizados &amp; SEO</div>
<div style="font-size:13px;line-height:21px;color:#050f16;"><b style="color:#ff5a14;">e</b>&nbsp; <a href="mailto:contacto@destaca.site" style="color:#050f16;text-decoration:none;">contacto@destaca.site</a></div>
<div style="font-size:13px;line-height:21px;color:#050f16;"><b style="color:#ff5a14;">w</b>&nbsp; <a href="https://destaca.site" style="color:#050f16;text-decoration:none;">destaca.site</a></div>
<div style="font-size:13px;line-height:21px;color:#050f16;"><b style="color:#ff5a14;">ig</b>&nbsp;<a href="https://instagram.com/destacasite" style="color:#050f16;text-decoration:none;">@destacasite</a></div></td></tr></table>`;
const SIGNATURE_TEXT = '\n\nEquipa Destaca\nSites de Apresentação Personalizados & SEO\ncontacto@destaca.site · destaca.site · @destacasite';

// Sends from contacto@destaca.site (Gmail keeps a copy in "Enviados"). Replies carry In-Reply-To/References so Gmail threads them.
async function send({ to, subject, text, inReplyTo, references }) {
  if (FORBIDDEN.test(subject + text)) throw Object.assign(new Error('Tire «grátis/gratuito/sem custo» do texto (risco de spam).'), { code: 400 });
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: USER, pass: process.env.GMAIL_APP_PASSWORD } });
  // Lines starting with "—" or "--" begin a small-print footer (e.g. the REMOVER notice).
  const [main, foot] = String(text).split(/\n(?=—\n|--\n)/);
  const html = `<div style="${P}">${esc(main.trim()).replace(/\n/g, '<br>')}</div>${SIGNATURE}`
    + (foot ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7680;margin-top:18px;">${esc(foot.trim()).replace(/\n/g, '<br>')}</div>` : '');
  const info = await t.sendMail({ from: { name: 'Destaca', address: USER }, to, subject, text: main.trim() + SIGNATURE_TEXT + (foot ? `\n\n${foot.trim()}` : ''), html, inReplyTo, references });
  return info.messageId;
}

module.exports = { USER, AUTO, FORBIDDEN, ready, fetchSince, send, formLead, trimQuoted };
