// Free SEO check: GET /api/analisar?url=https://example.pt -> JSON with a 0-100 score and per-check results.
const dns = require('node:dns').promises;
const net = require('node:net');

const TIMEOUT_MS = 8000;
const MAX_BYTES = 3 * 1024 * 1024;
const UA = 'Mozilla/5.0 (compatible; DestacaBot/1.0; +https://destaca.site)';

// Block anything that is not a public internet address (SSRF guard).
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateIp(v6.slice(7));
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb');
}

async function assertPublic(u) {
  if (!/^https?:$/.test(u.protocol)) throw new Error('Só analisamos endereços http ou https.');
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('Porta não permitida.');
  if (u.username || u.password) throw new Error('Endereço inválido.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => { throw new Error('Não encontrámos este domínio.'); })).map((r) => r.address);
  // ponytail: checked at lookup time only; DNS rebinding between check and fetch is not covered. Pin the IP with a custom agent if this becomes a target.
  if (!ips.length || ips.some(isPrivateIp)) throw new Error('Endereço não permitido.');
}

// fetch with manual, re-validated redirects, a timeout and a size cap
async function get(url, maxBytes = MAX_BYTES) {
  let u = new URL(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop < 6; hop++) {
      await assertPublic(u);
      const t0 = Date.now();
      const res = await fetch(u, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.8' } });
      const ms = Date.now() - t0;
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { u = new URL(res.headers.get('location'), u); continue; }
      const reader = res.body?.getReader();
      const chunks = []; let size = 0;
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) { await reader.cancel(); break; }
        chunks.push(value);
      }
      return { url: u, status: res.status, ms, size, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') };
    }
    throw new Error('Demasiados redirecionamentos.');
  } finally { clearTimeout(timer); }
}

const pick = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')); return m ? (m[1] ?? m[2] ?? m[3]) : undefined; };
const decode = (s = '') => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

// ponytail: regex HTML parsing, good enough for a quick public check; swap for a real parser if reports need to be exact.
function analyse(page, robots, sitemap) {
  const html = page.text;
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0];
  const metas = head.match(/<meta\b[^>]*>/gi) || [];
  const links = head.match(/<link\b[^>]*>/gi) || [];
  const meta = (key, val) => metas.find((m) => (pick(m, key) || '').toLowerCase() === val);
  const linkRel = (rel) => links.find((l) => (pick(l, 'rel') || '').toLowerCase().split(/\s+/).includes(rel));

  const title = decode((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  const desc = decode(pick(meta('name', 'description') || '', 'content'));
  const robotsMeta = (pick(meta('name', 'robots') || '', 'content') || '').toLowerCase();
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const h1s = body.match(/<h1\b[\s\S]*?<\/h1>/gi) || [];
  const h2s = body.match(/<h2\b/gi) || [];
  const imgs = body.match(/<img\b[^>]*>/gi) || [];
  const noAlt = imgs.filter((i) => pick(i, 'alt') === undefined).length;
  const lang = pick((html.match(/<html\b[^>]*>/i) || [''])[0], 'lang');
  const words = decode(body.replace(/<[^>]+>/g, ' ')).split(' ').filter((w) => w.length > 1).length;

  const c = (id, label, ok, detail, fix, weight = 1) => ({ id, label, status: ok === true ? 'ok' : ok === 'warn' ? 'aviso' : 'erro', detail, fix: ok === true ? '' : fix, weight });
  const checks = [
    c('https', 'Ligação segura (HTTPS)', page.url.protocol === 'https:', page.url.protocol === 'https:' ? 'O site abre em HTTPS.' : 'O site abre sem HTTPS.', 'Instalar um certificado SSL e redirecionar todo o tráfego para https://.', 2),
    c('status', 'A página responde', page.status === 200, `Código de resposta ${page.status}.`, 'A página principal deve responder com 200. Verificar erros do servidor.', 2),
    c('index', 'Pode aparecer no Google', !/noindex/.test(robotsMeta), /noindex/.test(robotsMeta) ? 'A página tem «noindex»: o Google não a mostra.' : 'Nada impede o Google de indexar a página.', 'Remover «noindex» da meta robots.', 3),
    c('title', 'Título da página', !title ? false : title.length >= 30 && title.length <= 60 ? true : 'warn', title ? `«${title.slice(0, 80)}» (${title.length} caracteres)` : 'Não tem título.', 'Escrever um título único entre 30 e 60 caracteres, com o serviço e a localidade.', 2),
    c('desc', 'Meta descrição', !desc ? false : desc.length >= 70 && desc.length <= 160 ? true : 'warn', desc ? `${desc.length} caracteres.` : 'Não tem meta descrição.', 'Escrever uma descrição entre 70 e 160 caracteres que convide ao clique.', 2),
    c('h1', 'Um título principal (H1)', h1s.length === 1 ? true : h1s.length === 0 ? false : 'warn', h1s.length === 1 ? 'Tem um H1.' : `Tem ${h1s.length} H1.`, 'Usar exatamente um H1 que diga o que o negócio faz.', 1.5),
    c('h2', 'Subtítulos (H2)', h2s.length > 0, `${h2s.length} subtítulos H2.`, 'Organizar o conteúdo em secções com subtítulos H2.'),
    c('lang', 'Língua declarada', !!lang, lang ? `lang="${lang}"` : 'Falta o atributo lang.', 'Indicar a língua no <html>, por exemplo lang="pt-PT".'),
    c('viewport', 'Preparado para telemóvel', !!meta('name', 'viewport'), meta('name', 'viewport') ? 'Tem meta viewport.' : 'Falta a meta viewport.', 'Adicionar <meta name="viewport" content="width=device-width, initial-scale=1"> e um layout responsivo.', 2),
    c('canonical', 'URL canónico', !!linkRel('canonical'), linkRel('canonical') ? 'Tem link canonical.' : 'Não tem link canonical.', 'Indicar o URL canónico para evitar conteúdo duplicado.'),
    c('og', 'Partilha nas redes (Open Graph)', meta('property', 'og:title') && meta('property', 'og:image') ? true : meta('property', 'og:title') || meta('property', 'og:image') ? 'warn' : false, meta('property', 'og:image') ? 'Tem imagem de partilha.' : 'Sem imagem de partilha.', 'Adicionar og:title, og:description e og:image.'),
    c('schema', 'Dados estruturados', /application\/ld\+json/i.test(html), /application\/ld\+json/i.test(html) ? 'Tem JSON-LD.' : 'Sem dados estruturados.', 'Adicionar Schema.org (LocalBusiness, horários, morada) em JSON-LD.', 1.5),
    c('alt', 'Imagens com texto alternativo', imgs.length === 0 || noAlt === 0 ? true : noAlt / imgs.length < 0.2 ? 'warn' : false, imgs.length ? `${noAlt} de ${imgs.length} imagens sem alt.` : 'Sem imagens na página.', 'Descrever cada imagem no atributo alt.'),
    c('words', 'Conteúdo suficiente', words >= 300 ? true : words >= 150 ? 'warn' : false, `Cerca de ${words} palavras.`, 'Explicar melhor os serviços: pelo menos 300 palavras úteis na página principal.'),
    c('speed', 'Tempo de resposta do servidor', page.ms < 800 ? true : page.ms < 1800 ? 'warn' : false, `${page.ms} ms até à primeira resposta.`, 'Melhorar o alojamento, ativar cache e usar uma CDN.', 1.5),
    c('weight', 'Peso do HTML', page.size < 300 * 1024 ? true : page.size < 1024 * 1024 ? 'warn' : false, `${Math.round(page.size / 1024)} KB.`, 'Reduzir código inline e scripts desnecessários.'),
    c('robots', 'Ficheiro robots.txt', robots, robots ? 'Encontrado.' : 'Não encontrado.', 'Criar /robots.txt com a localização do sitemap.', 0.5),
    c('sitemap', 'Mapa do site (sitemap.xml)', sitemap, sitemap ? 'Encontrado.' : 'Não encontrado.', 'Criar /sitemap.xml e submetê-lo no Google Search Console.', 1),
    c('favicon', 'Ícone do site', !!(linkRel('icon') || linkRel('shortcut')), linkRel('icon') ? 'Tem favicon.' : 'Sem favicon declarado.', 'Adicionar um favicon, que o Google mostra nos resultados em telemóvel.', 0.5),
  ];
  const total = checks.reduce((s, x) => s + x.weight, 0);
  const got = checks.reduce((s, x) => s + (x.status === 'ok' ? x.weight : x.status === 'aviso' ? x.weight / 2 : 0), 0);
  return { score: Math.round((got / total) * 100), checks: checks.map(({ weight, ...x }) => x) };
}

// a 200 that is really an HTML "not found" page does not count
async function fetchFile(url) {
  try { const r = await get(url, 512 * 1024); return r.status === 200 && r.text && !/<html/i.test(r.text.slice(0, 500)) ? r.text : null; } catch { return null; }
}

async function robotsAndSitemap(origin) {
  const robots = await fetchFile(new URL('/robots.txt', origin).href);
  const declared = robots && (robots.match(/^\s*sitemap:\s*(\S+)/im) || [])[1];
  for (const s of [declared, '/sitemap.xml', '/sitemap_index.xml'].filter(Boolean)) {
    if (await fetchFile(new URL(s, origin).href)) return [!!robots, true];
  }
  return [!!robots, false];
}

module.exports = async function handler(req, res) {
  const send = (code, body) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', code === 200 ? 'public, s-maxage=600' : 'no-store');
    res.end(JSON.stringify(body));
  };
  let input = (new URL(req.url, 'http://x').searchParams.get('url') || '').trim();
  if (!input || input.length > 300) return send(400, { error: 'Escreve o endereço do site, por exemplo o-teu-site.pt.' });
  if (!/^https?:\/\//i.test(input)) input = 'https://' + input;
  let target;
  try { target = new URL(input); } catch { return send(400, { error: 'Este endereço não parece válido.' }); }
  if (!target.hostname.includes('.')) return send(400, { error: 'Este endereço não parece válido.' });

  try {
    let page;
    try { page = await get(target.href); } catch (e) {
      if (target.protocol === 'https:' && !/permitid|domínio/.test(e.message)) { target.protocol = 'http:'; page = await get(target.href); } else throw e;
    }
    if (!/html/i.test(page.headers.get('content-type') || '')) return send(422, { error: 'Este endereço não devolve uma página HTML.' });
    const [robots, sitemap] = await robotsAndSitemap(page.url.origin);
    send(200, { url: page.url.href, ...analyse(page, robots, sitemap) });
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'O site demorou demasiado a responder.' : /permitid|domínio|redirecionamentos|Porta|inválido|http ou https/.test(e.message) ? e.message : 'Não conseguimos abrir este site.';
    send(502, { error: msg });
  }
};

module.exports.isPrivateIp = isPrivateIp;
module.exports.analyse = analyse;
