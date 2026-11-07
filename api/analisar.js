// Free SEO check: GET /api/analisar?url=https://example.pt[&lang=en|de|es] -> JSON with a 0-100 score and per-check results.
const dns = require('node:dns').promises;
const net = require('node:net');

const TIMEOUT_MS = 8000;
const MAX_BYTES = 3 * 1024 * 1024;
const UA = 'Mozilla/5.0 (compatible; DestacaBot/1.0; +https://destaca.site)';

// Errors shown to the visitor: pt, en, de, es
const ERR = {
  scheme: ['Só analisamos endereços http ou https.', 'We only analyse http or https addresses.', "Wir analysieren nur http- oder https-Adressen.", "Solo analizamos direcciones http o https."],
  port: ['Porta não permitida.', 'Port not allowed.', "Port nicht erlaubt.", "Puerto no permitido."],
  invalid: ['Este endereço não parece válido.', 'This address does not look valid.', "Diese Adresse scheint ungültig zu sein.", "Esta dirección no parece válida."],
  domain: ['Não encontrámos este domínio.', 'We could not find this domain.', "Wir konnten diese Domain nicht finden.", "No encontramos este dominio."],
  blocked: ['Endereço não permitido.', 'Address not allowed.', "Adresse nicht erlaubt.", "Dirección no permitida."],
  redirects: ['Demasiados redirecionamentos.', 'Too many redirects.', "Zu viele Weiterleitungen.", "Demasiadas redirecciones."],
  empty: ['Escreve o endereço do site, por exemplo o-teu-site.pt.', 'Type the website address, for example your-site.com.', "Gib die Adresse der Website ein, zum Beispiel deine-seite.de.", "Escribe la dirección del sitio, por ejemplo tu-sitio.es."],
  html: ['Este endereço não devolve uma página HTML.', 'This address does not return an HTML page.', "Diese Adresse liefert keine HTML-Seite.", "Esta dirección no devuelve una página HTML."],
  timeout: ['O site demorou demasiado a responder.', 'The site took too long to respond.', "Die Website hat zu lange gebraucht, um zu antworten.", "El sitio tardó demasiado en responder."],
  open: ['Não conseguimos abrir este site.', 'We could not open this site.', "Wir konnten diese Website nicht öffnen.", "No pudimos abrir este sitio."],
  shield: ['Este site tem uma proteção anti-robôs que bloqueia análises automáticas. Pede-nos uma análise manual grátis em contacto@destaca.site.', 'This site has bot protection that blocks automatic checks. Ask us for a free manual review at contacto@destaca.site.', "Diese Website hat einen Bot-Schutz, der automatische Prüfungen blockiert. Frag uns nach einer manuellen Prüfung unter contacto@destaca.site.", "Este sitio tiene una protección anti-bots que bloquea los análisis automáticos. Pídenos un análisis manual en contacto@destaca.site."],
  status: ['O site respondeu com um erro ({code}), por isso não há página para analisar.', 'The site answered with an error ({code}), so there is no page to analyse.', "Die Website hat mit einem Fehler ({code}) geantwortet, daher gibt es keine Seite zu analysieren.", "El sitio respondió con un error ({code}), así que no hay página que analizar."],
};
const LANGS = ['pt', 'en', 'de', 'es'];

// German and Spanish come from the English text: [English text or pattern, de, es]
const TR = [
  ['Secure connection (HTTPS)', 'Sichere Verbindung (HTTPS)', 'Conexión segura (HTTPS)'],
  ['The site loads over HTTPS.', 'Die Website lädt über HTTPS.', 'El sitio carga con HTTPS.'],
  ['The site loads without HTTPS.', 'Die Website lädt ohne HTTPS.', 'El sitio carga sin HTTPS.'],
  ['Install an SSL certificate and redirect all traffic to https://.', 'Ein SSL-Zertifikat installieren und den gesamten Verkehr auf https:// umleiten.', 'Instalar un certificado SSL y redirigir todo el tráfico a https://.'],
  ['The page responds', 'Die Seite antwortet', 'La página responde'],
  [/^Response code (\d+)\.$/, 'Antwortcode $1.', 'Código de respuesta $1.'],
  ['The home page should return 200. Check for server errors.', 'Die Startseite sollte 200 zurückgeben. Serverfehler prüfen.', 'La página principal debe responder con 200. Revisar errores del servidor.'],
  ['Can appear on Google', 'Kann bei Google erscheinen', 'Puede aparecer en Google'],
  ['The page has "noindex": Google will not show it.', 'Die Seite hat „noindex“: Google zeigt sie nicht an.', 'La página tiene «noindex»: Google no la muestra.'],
  ['Nothing stops Google from indexing the page.', 'Nichts hindert Google daran, die Seite zu indexieren.', 'Nada impide que Google indexe la página.'],
  ['Remove "noindex" from the robots meta tag.', '„noindex“ aus dem Robots-Meta-Tag entfernen.', 'Quitar «noindex» de la meta robots.'],
  ['Page title', 'Seitentitel', 'Título de la página'],
  [/^"([\s\S]*)" \((\d+) characters\)$/, '„$1“ ($2 Zeichen)', '«$1» ($2 caracteres)'],
  ['No title.', 'Kein Titel.', 'No tiene título.'],
  ['Write a unique title of 30 to 60 characters with your service and location.', 'Einen eindeutigen Titel mit 30 bis 60 Zeichen schreiben, mit Leistung und Ort.', 'Escribir un título único de 30 a 60 caracteres con el servicio y la localidad.'],
  ['Meta description', 'Meta-Beschreibung', 'Meta descripción'],
  [/^(\d+) characters\.$/, '$1 Zeichen.', '$1 caracteres.'],
  ['No meta description.', 'Keine Meta-Beschreibung.', 'No tiene meta descripción.'],
  ['Write a 70 to 160 character description that invites the click.', 'Eine Beschreibung mit 70 bis 160 Zeichen schreiben, die zum Klicken einlädt.', 'Escribir una descripción de 70 a 160 caracteres que invite al clic.'],
  ['One main heading (H1)', 'Eine Hauptüberschrift (H1)', 'Un título principal (H1)'],
  ['Has one H1.', 'Hat eine H1.', 'Tiene un H1.'],
  [/^Has (\d+) H1 tags\.$/, 'Hat $1 H1-Überschriften.', 'Tiene $1 H1.'],
  ['Use exactly one H1 that says what the business does.', 'Genau eine H1 verwenden, die sagt, was das Unternehmen macht.', 'Usar exactamente un H1 que diga a qué se dedica el negocio.'],
  ['Subheadings (H2)', 'Zwischenüberschriften (H2)', 'Subtítulos (H2)'],
  [/^(\d+) H2 subheadings\.$/, '$1 H2-Zwischenüberschriften.', '$1 subtítulos H2.'],
  ['Organise the content into sections with H2 subheadings.', 'Den Inhalt in Abschnitte mit H2-Zwischenüberschriften gliedern.', 'Organizar el contenido en secciones con subtítulos H2.'],
  ['Language declared', 'Sprache angegeben', 'Idioma declarado'],
  ['The lang attribute is missing.', 'Das lang-Attribut fehlt.', 'Falta el atributo lang.'],
  ['Declare the language on <html>, for example lang="en".', 'Die Sprache im <html> angeben, zum Beispiel lang="de".', 'Indicar el idioma en <html>, por ejemplo lang="es".'],
  ['Mobile ready', 'Für Smartphones optimiert', 'Preparado para móvil'],
  ['Has a viewport meta tag.', 'Hat ein Viewport-Meta-Tag.', 'Tiene meta viewport.'],
  ['The viewport meta tag is missing.', 'Das Viewport-Meta-Tag fehlt.', 'Falta la meta viewport.'],
  [/^Add (<meta name="viewport"[^>]*>) and a responsive layout\.$/, '$1 und ein responsives Layout hinzufügen.', 'Añadir $1 y un diseño adaptable.'],
  ['Canonical URL', 'Kanonische URL', 'URL canónica'],
  ['Has a canonical link.', 'Hat einen Canonical-Link.', 'Tiene enlace canonical.'],
  ['No canonical link.', 'Kein Canonical-Link.', 'No tiene enlace canonical.'],
  ['Declare the canonical URL to avoid duplicate content.', 'Die kanonische URL angeben, um doppelte Inhalte zu vermeiden.', 'Indicar la URL canónica para evitar contenido duplicado.'],
  ['Social sharing (Open Graph)', 'Teilen in sozialen Netzwerken (Open Graph)', 'Compartir en redes (Open Graph)'],
  ['Has a share image.', 'Hat ein Vorschaubild.', 'Tiene imagen para compartir.'],
  ['No share image.', 'Kein Vorschaubild.', 'Sin imagen para compartir.'],
  ['Add og:title, og:description and og:image.', 'og:title, og:description und og:image hinzufügen.', 'Añadir og:title, og:description y og:image.'],
  ['Structured data', 'Strukturierte Daten', 'Datos estructurados'],
  ['Has JSON-LD.', 'Hat JSON-LD.', 'Tiene JSON-LD.'],
  ['No structured data.', 'Keine strukturierten Daten.', 'Sin datos estructurados.'],
  ['Add Schema.org (LocalBusiness, opening hours, address) as JSON-LD.', 'Schema.org (LocalBusiness, Öffnungszeiten, Adresse) als JSON-LD hinzufügen.', 'Añadir Schema.org (LocalBusiness, horario, dirección) en JSON-LD.'],
  ['Images with alt text', 'Bilder mit Alt-Text', 'Imágenes con texto alternativo'],
  [/^(\d+) of (\d+) images without alt\.$/, '$1 von $2 Bildern ohne Alt-Text.', '$1 de $2 imágenes sin alt.'],
  ['No images on the page.', 'Keine Bilder auf der Seite.', 'No hay imágenes en la página.'],
  ['Describe every image in its alt attribute.', 'Jedes Bild im alt-Attribut beschreiben.', 'Describir cada imagen en el atributo alt.'],
  ['Enough content', 'Genug Inhalt', 'Contenido suficiente'],
  [/^About (\d+) words\.$/, 'Etwa $1 Wörter.', 'Unas $1 palabras.'],
  ['Explain your services better: at least 300 useful words on the home page.', 'Die Leistungen besser erklären: mindestens 300 hilfreiche Wörter auf der Startseite.', 'Explicar mejor los servicios: al menos 300 palabras útiles en la página principal.'],
  ['Server response time', 'Server-Antwortzeit', 'Tiempo de respuesta del servidor'],
  [/^(\d+) ms to first response\.$/, '$1 ms bis zur ersten Antwort.', '$1 ms hasta la primera respuesta.'],
  ['Improve hosting, enable caching and use a CDN.', 'Hosting verbessern, Caching aktivieren und ein CDN nutzen.', 'Mejorar el alojamiento, activar la caché y usar una CDN.'],
  ['HTML size', 'HTML-Größe', 'Tamaño del HTML'],
  ['Cut inline code and unnecessary scripts.', 'Inline-Code und unnötige Skripte reduzieren.', 'Reducir el código inline y los scripts innecesarios.'],
  ['robots.txt file', 'robots.txt-Datei', 'Archivo robots.txt'],
  ['Found.', 'Gefunden.', 'Encontrado.'],
  ['Not found.', 'Nicht gefunden.', 'No encontrado.'],
  ['Create /robots.txt with the sitemap location.', '/robots.txt mit dem Speicherort der Sitemap anlegen.', 'Crear /robots.txt con la ubicación del sitemap.'],
  ['Sitemap (sitemap.xml)', 'Sitemap (sitemap.xml)', 'Mapa del sitio (sitemap.xml)'],
  ['Create /sitemap.xml and submit it in Google Search Console.', '/sitemap.xml anlegen und in der Google Search Console einreichen.', 'Crear /sitemap.xml y enviarlo en Google Search Console.'],
  ['Site icon', 'Website-Symbol', 'Icono del sitio'],
  ['Has a favicon.', 'Hat ein Favicon.', 'Tiene favicon.'],
  ['No favicon declared.', 'Kein Favicon angegeben.', 'Sin favicon declarado.'],
  ['Add a favicon; Google shows it in mobile results.', 'Ein Favicon hinzufügen; Google zeigt es in den mobilen Ergebnissen.', 'Añadir un favicon; Google lo muestra en los resultados en móvil.'],
];
const tr = (text, lang) => {
  const col = lang === 'de' ? 1 : 2;
  for (const row of TR) {
    if (typeof row[0] === 'string') { if (row[0] === text) return row[col]; }
    else if (row[0].test(text)) return text.replace(row[0], row[col]);
  }
  return text;                                                  // anything not in the table stays in English
};

class Known extends Error { constructor(key) { super(key); this.key = key; } }

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
  if (!/^https?:$/.test(u.protocol)) throw new Known('scheme');
  if (u.port && !['80', '443'].includes(u.port)) throw new Known('port');
  if (u.username || u.password) throw new Known('invalid');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => { throw new Known('domain'); })).map((r) => r.address);
  // ponytail: checked at lookup time only; DNS rebinding between check and fetch is not covered. Pin the IP with a custom agent if this becomes a target.
  if (!ips.length || ips.some(isPrivateIp)) throw new Known('blocked');
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
    throw new Known('redirects');
  } finally { clearTimeout(timer); }
}

const pick = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')); return m ? (m[1] ?? m[2] ?? m[3]) : undefined; };
const decode = (s = '') => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

// ponytail: regex HTML parsing, good enough for a quick public check; swap for a real parser if reports need to be exact.
function analyse(page, robots, sitemap, ui = 'pt') {
  if (ui === true) ui = 'en';
  const L = (pt, eng) => (ui === 'pt' ? pt : ui === 'en' ? eng : tr(eng, ui));
  const html = page.text;
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0];
  const metas = head.match(/<meta\b[^>]*>/gi) || [];
  const links = head.match(/<link\b[^>]*>/gi) || [];
  const meta = (key, val) => metas.find((m) => (pick(m, key) || '').toLowerCase() === val);
  const linkRel = (rel) => links.find((l) => (pick(l, 'rel') || '').toLowerCase().split(/\s+/).includes(rel));

  const title = decode((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  const desc = decode(pick(meta('name', 'description') || '', 'content'));
  const noindex = /noindex/.test((pick(meta('name', 'robots') || '', 'content') || '').toLowerCase());
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const h1s = body.match(/<h1\b[\s\S]*?<\/h1>/gi) || [];
  const h2s = body.match(/<h2\b/gi) || [];
  const imgs = body.match(/<img\b[^>]*>/gi) || [];
  const noAlt = imgs.filter((i) => pick(i, 'alt') === undefined).length;
  const lang = pick((html.match(/<html\b[^>]*>/i) || [''])[0], 'lang');
  const words = decode(body.replace(/<[^>]+>/g, ' ')).split(' ').filter((w) => w.length > 1).length;
  const https = page.url.protocol === 'https:';
  const viewport = !!meta('name', 'viewport');
  const canonical = !!linkRel('canonical');
  const ogTitle = !!meta('property', 'og:title'), ogImage = !!meta('property', 'og:image');
  const schema = /application\/ld\+json/i.test(html);
  const favicon = !!(linkRel('icon') || linkRel('shortcut'));

  const c = (id, label, ok, detail, fix, weight = 1) => ({ id, label, status: ok === true ? 'ok' : ok === 'warn' ? 'aviso' : 'erro', detail, fix: ok === true ? '' : fix, weight });
  const checks = [
    c('https', L('Ligação segura (HTTPS)', 'Secure connection (HTTPS)'), https, https ? L('O site abre em HTTPS.', 'The site loads over HTTPS.') : L('O site abre sem HTTPS.', 'The site loads without HTTPS.'), L('Instalar um certificado SSL e redirecionar todo o tráfego para https://.', 'Install an SSL certificate and redirect all traffic to https://.'), 2),
    c('status', L('A página responde', 'The page responds'), page.status === 200, L(`Código de resposta ${page.status}.`, `Response code ${page.status}.`), L('A página principal deve responder com 200. Verificar erros do servidor.', 'The home page should return 200. Check for server errors.'), 2),
    c('index', L('Pode aparecer no Google', 'Can appear on Google'), !noindex, noindex ? L('A página tem «noindex»: o Google não a mostra.', 'The page has "noindex": Google will not show it.') : L('Nada impede o Google de indexar a página.', 'Nothing stops Google from indexing the page.'), L('Remover «noindex» da meta robots.', 'Remove "noindex" from the robots meta tag.'), 3),
    c('title', L('Título da página', 'Page title'), !title ? false : title.length >= 30 && title.length <= 60 ? true : 'warn', title ? L(`«${title.slice(0, 80)}» (${title.length} caracteres)`, `"${title.slice(0, 80)}" (${title.length} characters)`) : L('Não tem título.', 'No title.'), L('Escrever um título único entre 30 e 60 caracteres, com o serviço e a localidade.', 'Write a unique title of 30 to 60 characters with your service and location.'), 2),
    c('desc', L('Meta descrição', 'Meta description'), !desc ? false : desc.length >= 70 && desc.length <= 160 ? true : 'warn', desc ? L(`${desc.length} caracteres.`, `${desc.length} characters.`) : L('Não tem meta descrição.', 'No meta description.'), L('Escrever uma descrição entre 70 e 160 caracteres que convide ao clique.', 'Write a 70 to 160 character description that invites the click.'), 2),
    c('h1', L('Um título principal (H1)', 'One main heading (H1)'), h1s.length === 1 ? true : h1s.length === 0 ? false : 'warn', h1s.length === 1 ? L('Tem um H1.', 'Has one H1.') : L(`Tem ${h1s.length} H1.`, `Has ${h1s.length} H1 tags.`), L('Usar exatamente um H1 que diga o que o negócio faz.', 'Use exactly one H1 that says what the business does.'), 1.5),
    c('h2', L('Subtítulos (H2)', 'Subheadings (H2)'), h2s.length > 0, L(`${h2s.length} subtítulos H2.`, `${h2s.length} H2 subheadings.`), L('Organizar o conteúdo em secções com subtítulos H2.', 'Organise the content into sections with H2 subheadings.')),
    c('lang', L('Língua declarada', 'Language declared'), !!lang, lang ? `lang="${lang}"` : L('Falta o atributo lang.', 'The lang attribute is missing.'), L('Indicar a língua no <html>, por exemplo lang="pt-PT".', 'Declare the language on <html>, for example lang="en".')),
    c('viewport', L('Preparado para telemóvel', 'Mobile ready'), viewport, viewport ? L('Tem meta viewport.', 'Has a viewport meta tag.') : L('Falta a meta viewport.', 'The viewport meta tag is missing.'), L('Adicionar <meta name="viewport" content="width=device-width, initial-scale=1"> e um layout responsivo.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> and a responsive layout.'), 2),
    c('canonical', L('URL canónico', 'Canonical URL'), canonical, canonical ? L('Tem link canonical.', 'Has a canonical link.') : L('Não tem link canonical.', 'No canonical link.'), L('Indicar o URL canónico para evitar conteúdo duplicado.', 'Declare the canonical URL to avoid duplicate content.')),
    c('og', L('Partilha nas redes (Open Graph)', 'Social sharing (Open Graph)'), ogTitle && ogImage ? true : ogTitle || ogImage ? 'warn' : false, ogImage ? L('Tem imagem de partilha.', 'Has a share image.') : L('Sem imagem de partilha.', 'No share image.'), L('Adicionar og:title, og:description e og:image.', 'Add og:title, og:description and og:image.')),
    c('schema', L('Dados estruturados', 'Structured data'), schema, schema ? L('Tem JSON-LD.', 'Has JSON-LD.') : L('Sem dados estruturados.', 'No structured data.'), L('Adicionar Schema.org (LocalBusiness, horários, morada) em JSON-LD.', 'Add Schema.org (LocalBusiness, opening hours, address) as JSON-LD.'), 1.5),
    c('alt', L('Imagens com texto alternativo', 'Images with alt text'), imgs.length === 0 || noAlt === 0 ? true : noAlt / imgs.length < 0.2 ? 'warn' : false, imgs.length ? L(`${noAlt} de ${imgs.length} imagens sem alt.`, `${noAlt} of ${imgs.length} images without alt.`) : L('Sem imagens na página.', 'No images on the page.'), L('Descrever cada imagem no atributo alt.', 'Describe every image in its alt attribute.')),
    c('words', L('Conteúdo suficiente', 'Enough content'), words >= 300 ? true : words >= 150 ? 'warn' : false, L(`Cerca de ${words} palavras.`, `About ${words} words.`), L('Explicar melhor os serviços: pelo menos 300 palavras úteis na página principal.', 'Explain your services better: at least 300 useful words on the home page.')),
    c('speed', L('Tempo de resposta do servidor', 'Server response time'), page.ms < 800 ? true : page.ms < 1800 ? 'warn' : false, L(`${page.ms} ms até à primeira resposta.`, `${page.ms} ms to first response.`), L('Melhorar o alojamento, ativar cache e usar uma CDN.', 'Improve hosting, enable caching and use a CDN.'), 1.5),
    c('weight', L('Peso do HTML', 'HTML size'), page.size < 300 * 1024 ? true : page.size < 1024 * 1024 ? 'warn' : false, `${Math.round(page.size / 1024)} KB.`, L('Reduzir código inline e scripts desnecessários.', 'Cut inline code and unnecessary scripts.')),
    c('robots', L('Ficheiro robots.txt', 'robots.txt file'), robots, robots ? L('Encontrado.', 'Found.') : L('Não encontrado.', 'Not found.'), L('Criar /robots.txt com a localização do sitemap.', 'Create /robots.txt with the sitemap location.'), 0.5),
    c('sitemap', L('Mapa do site (sitemap.xml)', 'Sitemap (sitemap.xml)'), sitemap, sitemap ? L('Encontrado.', 'Found.') : L('Não encontrado.', 'Not found.'), L('Criar /sitemap.xml e submetê-lo no Google Search Console.', 'Create /sitemap.xml and submit it in Google Search Console.'), 1),
    c('favicon', L('Ícone do site', 'Site icon'), favicon, favicon ? L('Tem favicon.', 'Has a favicon.') : L('Sem favicon declarado.', 'No favicon declared.'), L('Adicionar um favicon, que o Google mostra nos resultados em telemóvel.', 'Add a favicon; Google shows it in mobile results.'), 0.5),
  ];
  const total = checks.reduce((s, x) => s + x.weight, 0);
  const got = checks.reduce((s, x) => s + (x.status === 'ok' ? x.weight : x.status === 'aviso' ? x.weight / 2 : 0), 0);
  // title/desc in raw form let the page draw the site's own Google snippet
  return { score: Math.round((got / total) * 100), title: title.slice(0, 120), desc: desc.slice(0, 320), checks: checks.map(({ weight, ...x }) => x) };
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
  const q = new URL(req.url, 'http://x').searchParams;
  const lang = LANGS.includes(q.get('lang')) ? q.get('lang') : 'pt', li = LANGS.indexOf(lang);
  const send = (code, body) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', code === 200 ? 'public, s-maxage=600' : 'no-store');
    res.end(JSON.stringify(body));
  };
  const fail = (code, key) => send(code, { error: ERR[key][li] });
  let input = (q.get('url') || '').trim();
  if (!input || input.length > 300) return fail(400, 'empty');
  // always try https first (falls back to http below), so an old http:// link isn't scored as "no HTTPS"
  input = 'https://' + input.replace(/^https?:\/\//i, '');
  let target;
  try { target = new URL(input); } catch { return fail(400, 'invalid'); }
  if (!target.hostname.includes('.')) return fail(400, 'invalid');

  try {
    let page;
    try { page = await get(target.href); } catch (e) {
      if (target.protocol === 'https:' && !['blocked', 'domain'].includes(e.key)) { target.protocol = 'http:'; page = await get(target.href); } else throw e;
    }
    // a bot wall or an error page is not the site: say so instead of scoring it
    if (page.status >= 400) {
      const wall = page.headers.get('cf-mitigated') || /just a moment|attention required|checking your browser|security checkpoint|captcha/i.test(page.text.slice(0, 5000));
      if (wall || page.status === 403 || page.status === 429) return fail(422, 'shield');
      return send(422, { error: ERR.status[li].replace('{code}', page.status) });
    }
    if (!/html/i.test(page.headers.get('content-type') || '')) return fail(422, 'html');
    const [robots, sitemap] = await robotsAndSitemap(page.url.origin);
    send(200, { url: page.url.href, ...analyse(page, robots, sitemap, lang) });
  } catch (e) {
    fail(502, e.name === 'AbortError' ? 'timeout' : e.key && ERR[e.key] ? e.key : 'open');
  }
};

module.exports.isPrivateIp = isPrivateIp;
module.exports.analyse = analyse;
