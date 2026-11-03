(() => {
  const d = document, root = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s), $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => innerWidth < 860;
  const en = root.lang.startsWith('en'), lang = en ? 'en' : 'pt';
  const T = en ? {
    steps: ['Opening the site…', 'Reading the title and description…', 'Checking the mobile version…', 'Looking for the sitemap and robots.txt…', 'Measuring speed…'],
    empty: 'Type your website address, for example your-site.com.',
    fail: 'We could not analyse this site. Please try again.',
    offline: 'No internet connection. Please try again.',
    busy: 'Analysing…', idle: 'Free analysis',
    done: s => `Analysis complete: ${s} out of 100.`,
    verdict: s => s >= 85 ? 'A good starting point. A few tweaks could put you ahead of the competition.' : s >= 60 ? 'There is work to do: these issues are costing you visits.' : 'Your site is losing customers on Google. It can be fixed.',
    fix: 'To fix', improve: 'To improve', passed: n => `${n} checks passed`,
    fixTopics: ['Improve my website', 'Show up on Google (SEO)'], fixPlan: 'Site upgrade (290 €)',
    fixSummary: (u, s, bad) => `I ran the free analysis on ${u} and scored ${s}/100. I'd like help fixing:\n${bad || '- (no issues listed)'}`,
    newsEmail: 'Please type a valid email.', newsConsent: 'Tick the box to confirm you want the newsletter.', newsFail: 'We could not sign you up. Please try again.',
    sending: 'Sending…', subject: n => `Quote request: ${n}`,
    sendFail: 'We could not send your request. Please try again or ',
    mailLink: 'email us directly',
    consultKind: 'Free consultation', consultSubject: b => `Free consultation: ${b}`
  } : {
    steps: ['A abrir o site…', 'A ler o título e a descrição…', 'A verificar a versão para telemóvel…', 'A procurar o sitemap e o robots.txt…', 'A medir a velocidade…'],
    empty: 'Escreve o endereço do teu site, por exemplo o-teu-site.pt.',
    fail: 'Não conseguimos analisar este site. Tenta outra vez.',
    offline: 'Sem ligação à internet. Tenta outra vez.',
    busy: 'A analisar…', idle: 'Analisar grátis',
    done: s => `Análise concluída: ${s} em 100.`,
    verdict: s => s >= 85 ? 'Bom ponto de partida. Há afinações que te podem pôr à frente da concorrência.' : s >= 60 ? 'Há trabalho a fazer: estes pontos estão a custar-te visitas.' : 'O teu site está a perder clientes no Google. Dá para resolver.',
    fix: 'A corrigir', improve: 'A melhorar', passed: n => `${n} verificações passaram`,
    fixTopics: ['Melhorar o meu site', 'Aparecer no Google (SEO)'], fixPlan: 'Melhoramento (290 €)',
    fixSummary: (u, s, bad) => `Fiz a análise grátis a ${u} e tive ${s}/100. Gostava de ajuda para corrigir:\n${bad || '- (sem pontos listados)'}`,
    newsEmail: 'Escreve um email válido.', newsConsent: 'Marca a caixa para confirmar que queres receber a newsletter.', newsFail: 'Não conseguimos inscrever-te. Tenta outra vez.',
    sending: 'A enviar…', subject: n => `Pedido de orçamento: ${n}`,
    sendFail: 'Não conseguimos enviar o pedido. Tenta outra vez ou ', mailLink: 'envia-nos um email',
    consultKind: 'Consultoria gratuita', consultSubject: n => `Consultoria gratuita: ${n}`
  };
  root.classList.add('js');
  setTimeout(() => d.body.classList.add('ready'), 60);
  const go = el => el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });

  // Entrances: the parts of each block arrive in turn
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const sib = [...e.target.parentElement.children].filter(x => x.classList.contains('rv'));
    e.target.style.transitionDelay = Math.min(sib.indexOf(e.target), 6) * 80 + 'ms';
    e.target.classList.add('in'); io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach(el => io.observe(el));

  // Footer wordmark fills the width exactly, and grows a touch as the footer scrolls in
  const fit = () => $$('[data-fit]').forEach(el => {
    const inner = el.firstElementChild;
    el.style.fontSize = '100px';
    const w = inner.getBoundingClientRect().width;
    if (w) el.style.fontSize = (100 * el.clientWidth / w * 0.995) + 'px';
  });
  fit(); d.fonts?.ready.then(fit); addEventListener('resize', fit);
  const foot = $('.footer');

  // Manifesto: the words light up as the visitor reads down
  const words = $('#words');
  words.innerHTML = words.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
  const ws = $$('.w', words);

  // Services: hovering a row opens it and reshapes the liquid
  let hoverShape = null;
  $$('.svc').forEach(s => s.addEventListener('pointerenter', () => {
    $$('.svc').forEach(x => x.classList.toggle('open', x === s));
    hoverShape = +s.dataset.shape;
  }));
  $('.svc-list').addEventListener('pointerleave', () => hoverShape = null);

  // Pricing: sites or monthly SEO
  $$('.switch button').forEach(b => b.addEventListener('click', () => {
    $$('.switch button').forEach(x => x.setAttribute('aria-pressed', x === b));
    $$('.prices').forEach(p => p.hidden = p.id !== b.dataset.p);
  }));

  // Cases: on desktop the vertical scroll slides the screenshots sideways
  const casesSec = $('#casos'), track = $('#track'), count = $('#count'), nCases = $$('.case', track).length;
  const sizeCases = () => { casesSec.style.height = narrow() ? '' : (track.scrollWidth - innerWidth + innerHeight * 1.3) + 'px'; };
  addEventListener('load', sizeCases); addEventListener('resize', sizeCases); sizeCases();

  // Cursor dot, bigger over the case studies
  const cur = $('#cur');
  let px = innerWidth / 2, py = innerHeight / 2, cx = px, cy = py, lastMove = -1e9, speed = 0;
  addEventListener('pointermove', e => {
    if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    speed = Math.min(1, speed + Math.hypot(e.movementX || 0, e.movementY || 0) / 300);
    px = e.clientX; py = e.clientY; lastMove = performance.now();
  }, { passive: true });
  $$('.case').forEach(a => {
    a.addEventListener('pointerenter', () => cur.classList.add('big'));
    a.addEventListener('pointerleave', () => cur.classList.remove('big'));
  });

  // Free SEO check
  const checker = $('#checker'), status = $('#checker-status'), result = $('#resultado'), btn = $('button', checker);
  const el = (tag, cls, text) => { const n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const renderChecks = checks => {
    const box = $('#r-checks'); box.replaceChildren();
    const group = (title, list, open = true) => {
      if (!list.length) return;
      const ul = el('ul');
      list.forEach(c => {
        const li = el('li', 'check ' + c.status);
        li.append(el('i', null, c.status === 'ok' ? '✓' : c.status === 'aviso' ? '!' : '✕'));
        const body = el('div');
        body.append(el('b', null, c.label), el('p', null, c.detail));
        if (c.fix) body.append(el('p', 'fix', c.fix));
        li.append(body); ul.append(li);
      });
      if (open) box.append(el('h3', null, title), ul);
      else { const det = el('details'); det.append(el('summary', null, title), ul); box.append(det); }
    };
    group(T.fix, checks.filter(c => c.status === 'erro'));
    group(T.improve, checks.filter(c => c.status === 'aviso'));
    const ok = checks.filter(c => c.status === 'ok');
    group(T.passed(ok.length), ok, false);
  };
  let lastCheck = null;
  checker.addEventListener('submit', async e => {
    e.preventDefault();
    const url = checker.url.value.trim();
    status.classList.remove('err');
    if (!url) { status.textContent = T.empty; status.classList.add('err'); checker.url.focus(); return; }
    btn.setAttribute('aria-busy', 'true'); btn.textContent = T.busy;
    let si = 0; status.textContent = T.steps[0];
    const tick = setInterval(() => { si = Math.min(si + 1, T.steps.length - 1); status.textContent = T.steps[si]; }, 1200);
    try {
      const r = await fetch(`/api/analisar?lang=${lang}&url=` + encodeURIComponent(url));
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || T.fail);
      result.hidden = false;
      $('#r-url').textContent = data.url;
      $('#resultado-h').textContent = T.verdict(data.score);
      renderChecks(data.checks);
      const num = $('#r-score'), fg = $('.ring .fg', result);
      fg.style.strokeDashoffset = 326.7;
      requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = 326.7 * (1 - data.score / 100); }));
      const t0 = performance.now();
      const countUp = t => { const k = clamp((t - t0) / 1200); num.textContent = Math.round(data.score * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(countUp); };
      requestAnimationFrame(countUp);
      const bad = data.checks.filter(c => c.status !== 'ok').map(c => `- ${c.label}: ${c.detail}`).join('\n');
      lastCheck = { url: data.url, score: data.score, bad };
      status.textContent = T.done(data.score);
      $$('.rv', result).forEach(x => x.classList.add('in'));
      go(result);
    } catch (err) {
      status.textContent = err.message === 'Failed to fetch' ? T.offline : err.message;
      status.classList.add('err');
    } finally {
      clearInterval(tick);
      btn.removeAttribute('aria-busy'); btn.textContent = T.idle;
    }
  });
  // links like destaca.site/?analisar=example.pt run the check straight away
  const pre = new URLSearchParams(location.search).get('analisar');
  if (pre) { checker.url.value = pre.slice(0, 200); checker.requestSubmit(); }
  // Someone opened the analysis link from one of our emails: tell contacto@ once per company and browser.
  // Only the company's site address is sent, nothing about the visitor.
  if (pre && !/destaca\.site/.test(d.referrer)) {
    const seenKey = 'destaca-opened-' + pre;
    let seen = false;
    try { seen = !!localStorage.getItem(seenKey); localStorage.setItem(seenKey, '1'); } catch {}
    if (!seen) fetch('https://api.web3forms.com/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ access_key: $('#pedido-form').dataset.key, subject: `Abriram a análise: ${pre.slice(0, 100)}`, from_name: 'destaca.site',
        Site: pre.slice(0, 200), Origem: new URLSearchParams(location.search).get('utm_source') || 'link direto', Hora: new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' }) })
    }).catch(() => {});
  }

  // Quote request: price rows and "fix this" prefill the form; it sends straight to our inbox
  const form = $('#pedido-form'), done = $('#pedido-done'), fstatus = $('#pedido-status');
  const prefill = ({ topics = [], plan, site, summary }) => {
    $$('[name="topicos"]', form).forEach(c => { if (topics.includes(c.value)) c.checked = true; });
    if (plan) form.plano.value = plan;
    if (site) form.site.value = site;
    if (summary && !form.resumo.value.trim()) form.resumo.value = summary;
  };
  d.addEventListener('click', e => {
    const a = e.target.closest('[data-plan]');
    if (a) prefill({ topics: [a.dataset.topic], plan: a.dataset.plan });
    if (e.target.closest('#r-mail') && lastCheck) prefill({ topics: T.fixTopics, plan: T.fixPlan, site: lastCheck.url, summary: T.fixSummary(lastCheck.url, lastCheck.score, lastCheck.bad) });
  });
  const trackEvent = event => { if (window.dataLayer?.gtmLoaded) dataLayer.push({ event }); }; // conversions, only with consent
  // Both forms post to Web3Forms, which emails contacto@destaca.site; on failure we offer a filled-in mailto
  const wire = (fm, build, onDone) => fm.addEventListener('submit', async e => {
    e.preventDefault();
    if (fm.botcheck.checked) return;
    const { subject, fields } = build(new FormData(fm));
    const st = $('.lead-status', fm), sb = $('button[type="submit"]', fm);
    const mailto = `mailto:contacto@destaca.site?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n'))}`;
    st.classList.remove('err'); st.textContent = T.sending; sb.setAttribute('aria-busy', 'true');
    try {
      const r = await fetch('https://api.web3forms.com/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: fm.dataset.key, subject, from_name: 'destaca.site', replyto: fields.Email, ...fields })
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok || !out.success) throw new Error();
      st.textContent = '';
      onDone();
    } catch {
      st.textContent = T.sendFail;
      const a = el('a', null, T.mailLink); a.href = mailto;
      st.append(a, '.'); st.classList.add('err');
    } finally { sb.removeAttribute('aria-busy'); }
  });
  wire(form, f => {
    const fields = { Nome: f.get('nome'), Empresa: f.get('empresa') || '-', Email: f.get('email'), Telefone: f.get('telefone') || '-', Site: f.get('site') || '-', 'Tópicos': f.getAll('topicos').join(', ') || '-', Plano: f.get('plano'), Resumo: f.get('resumo'), 'Língua': lang.toUpperCase() };
    return { fields, subject: T.subject(fields.Empresa !== '-' ? `${fields.Nome} (${fields.Empresa})` : fields.Nome) };
  }, () => { form.hidden = true; done.hidden = false; done.focus(); remember('sent'); trackEvent('pedido_orcamento'); });
  $('#pedido-again').addEventListener('click', () => { form.reset(); fstatus.textContent = ''; done.hidden = true; form.hidden = false; form.resumo.focus(); });

  // Free consultation pop-up: once, after 20 seconds on the page, never over another dialog or a half-filled form
  const consult = $('#consult'), cform = $('#consult-form'), KEY = 'destaca-consult';
  const remember = v => { try { localStorage.setItem(KEY, JSON.stringify({ v, t: Date.now() })); } catch {} };
  const seen = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && (s.v === 'sent' || Date.now() - s.t < 7 * 864e5); } catch { return false; } };
  const step = name => {
    $$('[data-step]', consult).forEach(s => { s.hidden = s.dataset.step !== name; });
    const f = $(`[data-step="${name}"]`, consult); f.tabIndex = -1;
    // On phones, focusing a field would throw the keyboard over the sheet before the visitor has read it
    ((matchMedia('(pointer: fine)').matches && $('input, textarea', f)) || f).focus({ preventScroll: true }); consult.scrollTop = 0;
  };
  setTimeout(() => {
    const busy = d.querySelector('dialog[open]') || form.contains(d.activeElement) || !form.hidden && form.resumo.value;
    if (seen() || busy || d.hidden) return;
    consult.showModal(); remember('shown');
  }, 20000);
  // Links from the newsletter (destaca.site/#consultoria) open the form straight away
  if (location.hash === '#consultoria') { consult.showModal(); step('form'); remember('shown'); }
  consult.addEventListener('click', e => {
    // A tap on the dimmed area outside the box closes it too
    if (e.target === consult || e.target.closest('[data-close]')) consult.close();
    const to = e.target.closest('[data-step-to]');
    if (to) step(to.dataset.stepTo);
  });
  wire(cform, f => {
    const fields = { Pedido: T.consultKind, Empresa: f.get('empresa'), Cidade: f.get('cidade') || '-', Site: f.get('site') || '-', Nome: f.get('nome'), Email: f.get('email'), Telefone: f.get('telefone') || '-', Resumo: f.get('resumo'), 'Língua': lang.toUpperCase() };
    return { fields, subject: T.consultSubject(fields.Empresa) };
  }, () => { step('done'); remember('sent'); trackEvent('consultoria_gratuita'); });

  // Newsletter: a corner card (not a modal), after 35 s once the visitor has read half the page (or after 60 s),
  // never over a dialog or the cookie bar, and at most once every 14 days. Sign-ups go to E-goi via /api/newsletter.
  const news = $('#news'), nform = $('#news-form'), nstatus = $('#news-status'), NK = 'destaca-news';
  const bar = $('#cookie-bar'), CK = 'destaca-cookies';
  const nseen = () => { try { const s = JSON.parse(localStorage.getItem(NK)); return s && (s.v === 'sub' || Date.now() - s.t < 14 * 864e5); } catch { return false; } };
  const nmark = v => { try { localStorage.setItem(NK, JSON.stringify({ v, t: Date.now() })); } catch {} };
  if (!nseen()) {
    const t0 = Date.now();
    const tick = setInterval(() => {
      const secs = (Date.now() - t0) / 1000, depth = (scrollY + innerHeight) / root.scrollHeight;
      if (secs < 35 || (depth < .5 && secs < 60)) return;
      if (d.querySelector('dialog[open]') || !bar.hidden || d.hidden) return;
      clearInterval(tick); news.hidden = false; nmark('shown');
    }, 3000);
  }
  news.addEventListener('click', e => { if (e.target.closest('[data-news-close]')) news.hidden = true; });
  nform.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(nform), sb = $('button[type="submit"]', nform);
    nstatus.classList.remove('err');
    if (!nform.email.checkValidity() || !f.get('email')) { nstatus.classList.add('err'); nstatus.textContent = T.newsEmail; nform.email.focus(); return; }
    if (!nform.consent.checked) { nstatus.classList.add('err'); nstatus.textContent = T.newsConsent; return; }
    sb.setAttribute('aria-busy', 'true'); nstatus.textContent = T.sending;
    try {
      const r = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.get('email'), nome: f.get('nome'), website: f.get('website'), consent: true, lang }) });
      if (!r.ok) throw new Error();
      nform.hidden = true; $('#news-done').hidden = false; $('#news-done').focus(); nmark('sub'); trackEvent('newsletter');
    } catch { nstatus.classList.add('err'); nstatus.textContent = T.newsFail; }
    finally { sb.removeAttribute('aria-busy'); }
  });

  // Analytics: Google Tag Manager loads only after the visitor accepts (RGPD); the choice can be changed in the footer
  const choice = () => { try { return localStorage.getItem(CK); } catch { return null; } };
  const loadGTM = () => {
    if (window.dataLayer?.gtmLoaded) return;
    window.dataLayer = window.dataLayer || [];
    dataLayer.gtmLoaded = true;
    dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = d.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-TCTL7RHK';
    d.head.append(s);
  };
  if (choice() === 'yes') loadGTM(); else if (!choice()) bar.hidden = false;
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-cookies]');
    if (!b) return;
    try { localStorage.setItem(CK, b.dataset.cookies); } catch {}
    bar.hidden = true;
    if (b.dataset.cookies === 'yes') return loadGTM();
    // declined after accepting: drop the Analytics cookies and reload without the tag
    if (window.dataLayer?.gtmLoaded) {
      d.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^_g/.test(n))
        .forEach(n => { d.cookie = `${n}=; Max-Age=0; path=/; domain=.${location.hostname}`; d.cookie = `${n}=; Max-Age=0; path=/`; });
      location.reload();
    }
  });
  $$('[data-cookie-prefs]').forEach(b => b.addEventListener('click', () => { bar.hidden = false; $('button', bar).focus(); }));

  // Everything that follows the scroll, once per frame
  const secs = $$('[data-3d]').map(el => ({ el, v: el.dataset['3d'].split(',').map(Number), m: el.dataset['3dM'] && el.dataset['3dM'].split(',').map(Number) }));
  const target = secs[0].v.slice(), st = target.slice();
  const cv = $('#gl');
  let off3d = false;
  const onScroll = () => {
    const vh = innerHeight;
    // the 3D belongs to the section that covers the middle of the screen
    let best = secs[0], hit = false;
    for (const s of secs) { if (s.el.hidden) continue; const r = s.el.getBoundingClientRect(); if (r.top < vh * .55 && r.bottom > vh * .45) { best = s; hit = true; } }
    // on phones the 3D only lives in sections with a phone position (data-3d-m); elsewhere it is not drawn, so it costs no battery
    off3d = narrow() && (!hit || !best.m);
    if (!off3d) (narrow() ? best.m : best.v).forEach((x, i) => target[i] = x);
    if (hoverShape !== null && best.el.id === 'servicos') target[3] = hoverShape;
    cv.style.opacity = off3d ? 0 : 1;
    if (!reduce) foot.style.setProperty('--fp', clamp((vh - foot.getBoundingClientRect().top) / (vh * .8)).toFixed(4));

    const r = words.getBoundingClientRect(), p = clamp((vh * .85 - r.top) / (r.height + vh * .3));
    ws.forEach((w, i) => w.classList.toggle('on', i / ws.length < p));

    if (!narrow()) {
      const cr = casesSec.getBoundingClientRect(), cp = clamp(-cr.top / (cr.height - vh));
      track.style.transform = `translateX(${-cp * (track.scrollWidth - innerWidth)}px)`;
      count.textContent = `0${Math.min(nCases, 1 + Math.floor(cp * nCases))} / 0${nCases}`;
    } else track.style.transform = '';
  };

  // One liquid-chrome object, raymarched in a fragment shader, that travels through the page
  let gl = null, live = false, t0 = 0;
  const fs = `
precision highp float;
uniform vec4 V; uniform float T, K, SH, G, MR, SP; uniform vec3 O; uniform vec2 M, MN;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float wave(vec3 p){return sin(2.6*p.x+T*.9)*sin(2.1*p.y-T*.7)*sin(2.3*p.z+T*.5);}
float map(vec3 w){
  vec3 p=(w-vec3(O.xy,0.))/O.z;
  p.yz*=rot(.45+MN.y*.35+T*.05);
  p.xz*=rot(T*.2+MN.x*.6+SP);
  vec3 q=p; q.xy*=rot(q.z*.7+T*.25);
  float ring=length(vec2(length(q.xz)-1.1,q.y*1.9))-.3;
  float ball=length(p)-.95;
  vec3 c=p; c.xz*=rot(c.y*1.2+T*.4);
  float drop=length(vec3(c.x,max(abs(c.y)-1.05,0.),c.z*1.7))-.36;
  float d=mix(ring,ball,clamp(SH,0.,1.)); d=mix(d,drop,clamp(SH-1.,0.,1.));
  d=smin(d,length(p-vec3(sin(T*.7)*.85,cos(T*.5)*.5,cos(T*.6)*.5))-.3,.5);
  d+=(.07+K*.16)*wave(p);
  d*=O.z;
  d=smin(d,length(w-vec3(M,.35))-MR,.8);   // liquid reaches for the cursor
  return d*.6;
}
vec3 nrm(vec3 p){vec2 e=vec2(.0015,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
const vec3 hot=vec3(1.,.35,.07);
const vec3 logo=vec3(1.,.353,.078);
// photo studio as seen in the chrome: floor, grey walls, softboxes with crisp edges
float box(vec2 a,vec2 c,vec2 s,float soft){vec2 d=abs(a-c)-s;return 1.-smoothstep(0.,soft,max(d.x,d.y));}
vec3 env(vec3 r,vec3 L){
  float y=r.y, ph=atan(r.x,-r.z);
  vec3 c=mix(vec3(.16,.16,.17),vec3(.42,.42,.43),smoothstep(-.6,.02,y));
  c=mix(c,vec3(.62,.63,.65),smoothstep(.02,.7,y));
  c*=1.-.55*smoothstep(.06,.0,abs(y-.01));
  vec2 a=vec2(ph,y);
  c+=vec3(3.2)*box(a,vec2(0.,1.),vec2(3.2,.16),.06);
  c+=vec3(2.6)*box(a,vec2(1.25,.18),vec2(.16,.42),.04);
  c+=vec3(1.8)*box(a,vec2(-1.45,.12),vec2(.11,.48),.04);
  c+=vec3(1.4)*box(a,vec2(3.,.2),vec2(.35,.07),.05);
  c+=hot*pow(max(dot(r,L),0.),40.)*6.*G+hot*pow(max(dot(r,L),0.),6.)*.5*G;
  return c;
}
void main(){
  vec2 uv=(gl_FragCoord.xy+V.zw-.5*V.xy)/V.y;
  vec3 ro=vec3(0,0,5.), rd=normalize(vec3(uv,-1.6));
  vec3 L=normalize(vec3(MN.x*1.5,MN.y+.3,1.));
  float t=0.,d,md=1e3,mt=0.;
  for(int i=0;i<84;i++){d=map(ro+rd*t);if(d<md){md=d;mt=t;}if(d<.001||t>9.)break;t+=d;}
  float a=1.-smoothstep(.0,.012*mt*.2+.004,md);
  if(a<.01){gl_FragColor=vec4(0.);return;}
  vec3 p=ro+rd*mt, n=nrm(p), r=reflect(rd,n);
  float cs=max(dot(-rd,n),0.);
  float ao=clamp(.35+.65*map(p+n*.22)/(.22*.6),0.,1.);
  vec3 lp=(p-vec3(O.xy,0.))/O.z;
  float w=wave(lp);
  // brand duotone: logo-orange metal on top melting into black metal. Colour goes on after the lighting,
  // so the orange is exactly the logo orange (#ff5a14); the lighting only decides light and dark.
  float e=dot(env(r,L),vec3(1./3.))*(.85+.15*pow(1.-cs,5.))*mix(.3,1.,ao);
  vec3 orange=mix(vec3(.3,.07,.01),logo,smoothstep(.0,.38,e));
  orange=mix(orange,vec3(1.,.8,.68),smoothstep(1.4,2.8,e));
  vec3 black=vec3(.035)+e*.26*vec3(.9,.92,1.);
  black=mix(black,vec3(.85),smoothstep(1.5,2.8,e)*.8);
  float m=smoothstep(-.35,.35,lp.y+.35*w+.15*sin(T*.6));
  vec3 col=mix(black,orange,m);
  col=mix(col,logo,smoothstep(.05,.0,abs(m-.5)-.01));
  col+=vec3(1.)*pow(max(dot(r,normalize(vec3(.55,.75,.5))),0.),220.)*7.*.9;
  col+=logo*smoothstep(.85,.98,w)*.35*K*G;                                  // a tap or click flashes the waves orange
  col=clamp(col,0.,1.);
  gl_FragColor=vec4(col*a,a);
}`;
  const U = {};
  // The 3D starts only once the page is ready and the visitor moves, scrolls or waits a moment, so it never delays loading.
  // Machines without a graphics card (software rendering) skip it: there it would make the whole page slow.
  const init3d = () => {
    if (gl || !cv.isConnected) return;
    gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: true, alpha: true });
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const ren = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    if (!gl || /swiftshader|llvmpipe|softpipe|software|basic render/i.test(ren)) { cv.remove(); return; }
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
    const vsh = sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'), fsh = sh(gl.FRAGMENT_SHADER, fs);
    if (!vsh || !fsh) { cv.remove(); return; }
    const pr = gl.createProgram();
    gl.attachShader(pr, vsh); gl.attachShader(pr, fsh); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['V', 'T', 'K', 'SH', 'G', 'MR', 'SP', 'O', 'M', 'MN']) U[n] = gl.getUniformLocation(pr, n);
    live = true; t0 = performance.now(); size();
  };
  const startEvents = ['pointermove', 'scroll', 'keydown', 'touchstart', 'wheel'];
  const kickoff = () => { startEvents.forEach(ev => removeEventListener(ev, kickoff)); init3d(); };
  startEvents.forEach(ev => addEventListener(ev, kickoff, { passive: true, once: true }));
  addEventListener('load', () => setTimeout(kickoff, 3500));

  // Sharp on retina screens, with a pixel budget so big or dense screens stay smooth.
  // ponytail: fixed budget; add frame-time based scaling if weak laptops drop frames
  // Phones draw only a band around the object, so they can afford full screen sharpness.
  let kk = 1;
  const size = () => {
    if (!live) return;
    const n = narrow(), h = n ? Math.round(innerHeight * .42) : innerHeight;
    kk = n ? Math.min(devicePixelRatio, 2.5) : Math.min(devicePixelRatio, Math.sqrt(2.6e6 / (innerWidth * innerHeight)));
    cv.style.height = n ? h + 'px' : '';
    if (!n) cv.style.transform = '';
    cv.width = Math.round(innerWidth * kk); cv.height = Math.round(h * kk); gl.viewport(0, 0, cv.width, cv.height);
  };
  size(); addEventListener('resize', size);

  let kick = 1.2, mr = -.5, mnx = 0, mny = 0, spin = 0, lastY = scrollY, first = true, lastDraw = 0;
  d.addEventListener('pointerdown', e => { if (!e.target.closest('a,button,input,select,textarea,summary,label,dialog')) kick = 1; });
  (function frame(now) {
    requestAnimationFrame(frame);
    onScroll();
    if (first) { st.splice(0, 5, ...target); first = false; }                  // start in place, no glide on load
    for (let i = 0; i < 5; i++) st[i] += (target[i] - st[i]) * (i === 3 ? .045 : .06);
    cx += (px - cx) * .22; cy += (py - cy) * .22;
    cur.style.transform = `translate(${cx}px,${cy}px)`;
    if (!live || d.hidden || off3d) return;
    const n = narrow();
    if (n && now - lastDraw < 15) return;                                       // phones: 60 fps is plenty, 120 Hz screens would double the work
    lastDraw = now;
    speed *= .92;
    spin += (scrollY - lastY) * .0015; lastY = scrollY;
    const active = now - lastMove < 1800 && !narrow();
    mr += ((active ? .14 + speed * .22 : -.5) - mr) * .08;
    // no mouse on phones: the light circles slowly on its own
    const lx = n ? Math.sin(now / 2600) * .8 : px / innerWidth * 2 - 1, ly = n ? Math.cos(now / 3400) * .6 : -(py / innerHeight * 2 - 1);
    mnx += (lx - mnx) * .05; mny += (ly - mny) * .05;
    if (!Number.isFinite(mnx + mny)) mnx = mny = 0;
    kick *= .95;
    const intro = reduce ? 1 : 1 - Math.pow(1 - Math.min(1, (now - t0) / 1600), 3);
    let oy = 0;
    if (n) { const top = innerHeight / 2 - st[1] / 3.125 * innerHeight - cv.height / kk / 2; cv.style.transform = `translateY(${top}px)`; oy = (innerHeight - top) * kk - cv.height; }
    gl.uniform4f(U.V, cv.width, n ? innerHeight * kk : cv.height, 0, oy);
    gl.uniform1f(U.T, reduce ? 3 : (now - t0) / 1000);
    gl.uniform1f(U.K, kick); gl.uniform1f(U.SH, st[3]); gl.uniform1f(U.G, st[4]);
    gl.uniform1f(U.MR, mr); gl.uniform1f(U.SP, spin);
    gl.uniform3f(U.O, st[0], st[1], st[2] * intro);
    gl.uniform2f(U.M, (px - innerWidth / 2) / innerHeight * 3.125, -(py - innerHeight / 2) / innerHeight * 3.125);
    gl.uniform2f(U.MN, mnx, mny);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  })(performance.now());
})();
