(() => {
  const d = document, root = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s), $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lang = ['en', 'de', 'es'].find(l => root.lang.startsWith(l)) || 'pt';
  const T = {
  en: {
    steps: ['Opening the site…', 'Reading the title and description…', 'Checking the mobile version…', 'Looking for the sitemap and robots.txt…', 'Measuring speed…'],
    empty: 'Type your website address, for example your-site.com.',
    fail: 'We could not analyse this site. Please try again.',
    offline: 'No internet connection. Please try again.',
    busy: 'Analysing…', idle: 'Analyse now',
    done: s => `Analysis complete: ${s} out of 100.`,
    verdict: s => s >= 85 ? 'A good starting point. A few tweaks could put you ahead of the competition.' : s >= 60 ? 'There is work to do: these issues are costing you visits.' : 'Your site is losing customers on Google. It can be fixed.',
    noTitle: 'No title: Google makes one up',
    fix: 'To fix', improve: 'To improve', passed: n => `${n} checks passed`,
    fixTopics: ['Improve my website', 'Show up on Google (SEO)'], fixPlan: 'Site upgrade (290 €)',
    fixSummary: (u, s, bad) => `I ran the free analysis on ${u} and scored ${s}/100. I'd like help fixing:\n${bad || '- (no issues listed)'}`,
    newsEmail: 'Please type a valid email.', newsConsent: 'Tick the box to confirm you want the newsletter.', newsFail: 'We could not sign you up. Please try again.', newsDone: 'You are on the list. Thank you!',
    sending: 'Sending…', subject: n => `Quote request: ${n}`,
    sendFail: 'We could not send your request. Please try again or ', mailLink: 'email us directly',
    consultKind: 'Free consultation', consultSubject: b => `Free consultation: ${b}`
  },
  pt: {
    steps: ['A abrir o site…', 'A ler o título e a descrição…', 'A verificar a versão para telemóvel…', 'A procurar o sitemap e o robots.txt…', 'A medir a velocidade…'],
    empty: 'Escreve o endereço do teu site, por exemplo o-teu-site.pt.',
    fail: 'Não conseguimos analisar este site. Tenta outra vez.',
    offline: 'Sem ligação à internet. Tenta outra vez.',
    busy: 'A analisar…', idle: 'Analisa agora',
    done: s => `Análise concluída: ${s} em 100.`,
    verdict: s => s >= 85 ? 'Bom ponto de partida. Há afinações que te podem pôr à frente da concorrência.' : s >= 60 ? 'Há trabalho a fazer: estes pontos estão a custar-te visitas.' : 'O teu site está a perder clientes no Google. Dá para resolver.',
    noTitle: 'Sem título: o Google inventa um',
    fix: 'A corrigir', improve: 'A melhorar', passed: n => `${n} verificações passaram`,
    fixTopics: ['Melhorar o meu site', 'Aparecer no Google (SEO)'], fixPlan: 'Melhoramento (290 €)',
    fixSummary: (u, s, bad) => `Fiz a análise grátis a ${u} e tive ${s}/100. Gostava de ajuda para corrigir:\n${bad || '- (sem pontos listados)'}`,
    newsEmail: 'Escreve um email válido.', newsConsent: 'Marca a caixa para confirmar que queres receber a newsletter.', newsFail: 'Não conseguimos inscrever-te. Tenta outra vez.', newsDone: 'Estás na lista. Obrigado!',
    sending: 'A enviar…', subject: n => `Pedido de orçamento: ${n}`,
    sendFail: 'Não conseguimos enviar o pedido. Tenta outra vez ou ', mailLink: 'envia-nos um email',
    consultKind: 'Consultoria gratuita', consultSubject: n => `Consultoria gratuita: ${n}`
  },
  de: {
    steps: ['Website wird geöffnet…', 'Titel und Beschreibung werden gelesen…', 'Mobile Version wird geprüft…', 'Sitemap und robots.txt werden gesucht…', 'Geschwindigkeit wird gemessen…'],
    empty: 'Gib die Adresse deiner Website ein, zum Beispiel deine-seite.de.',
    fail: 'Wir konnten diese Website nicht analysieren. Bitte versuche es erneut.',
    offline: 'Keine Internetverbindung. Bitte versuche es erneut.',
    busy: 'Wird analysiert…', idle: 'Jetzt analysieren',
    done: s => `Analyse abgeschlossen: ${s} von 100.`,
    verdict: s => s >= 85 ? 'Ein guter Ausgangspunkt. Ein paar Anpassungen können dich vor die Konkurrenz bringen.' : s >= 60 ? 'Es gibt einiges zu tun: Diese Punkte kosten dich Besucher.' : 'Deine Website verliert Kunden bei Google. Das lässt sich beheben.',
    noTitle: 'Kein Titel: Google erfindet einen',
    fix: 'Zu beheben', improve: 'Zu verbessern', passed: n => `${n} Prüfungen bestanden`,
    fixTopics: ['Improve my website', 'Show up on Google (SEO)'], fixPlan: 'Site upgrade (290 €)',
    fixSummary: (u, s, bad) => `Ich habe ${u} analysiert und ${s}/100 erreicht. Ich möchte Hilfe bei:
${bad || '- (keine Punkte aufgeführt)'}`,
    newsEmail: 'Bitte gib eine gültige E-Mail-Adresse ein.', newsConsent: 'Bitte bestätige mit dem Häkchen, dass du den Newsletter erhalten möchtest.', newsFail: 'Die Anmeldung hat nicht funktioniert. Bitte versuche es erneut.', newsDone: 'Du bist angemeldet. Danke!',
    sending: 'Wird gesendet…', subject: n => `Angebotsanfrage: ${n}`,
    sendFail: 'Die Anfrage konnte nicht gesendet werden. Bitte versuche es erneut oder ', mailLink: 'schreib uns direkt',
    consultKind: 'Beratung', consultSubject: b => `Beratung: ${b}`
  },
  es: {
    steps: ['Abriendo el sitio…', 'Leyendo el título y la descripción…', 'Comprobando la versión móvil…', 'Buscando el sitemap y el robots.txt…', 'Midiendo la velocidad…'],
    empty: 'Escribe la dirección de tu sitio, por ejemplo tu-sitio.es.',
    fail: 'No hemos podido analizar este sitio. Inténtalo de nuevo.',
    offline: 'Sin conexión a internet. Inténtalo de nuevo.',
    busy: 'Analizando…', idle: 'Analizar ahora',
    done: s => `Análisis completado: ${s} de 100.`,
    verdict: s => s >= 85 ? 'Un buen punto de partida. Unos ajustes pueden ponerte por delante de la competencia.' : s >= 60 ? 'Hay trabajo que hacer: estos puntos te están costando visitas.' : 'Tu sitio está perdiendo clientes en Google. Tiene solución.',
    noTitle: 'Sin título: Google se inventa uno',
    fix: 'Por corregir', improve: 'Por mejorar', passed: n => `${n} comprobaciones superadas`,
    fixTopics: ['Improve my website', 'Show up on Google (SEO)'], fixPlan: 'Site upgrade (290 €)',
    fixSummary: (u, s, bad) => `He analizado ${u} y he sacado ${s}/100. Me gustaría ayuda para corregir:
${bad || '- (sin puntos)'}`,
    newsEmail: 'Escribe un email válido.', newsConsent: 'Marca la casilla para confirmar que quieres recibir la newsletter.', newsFail: 'No hemos podido suscribirte. Inténtalo de nuevo.', newsDone: 'Ya estás en la lista. ¡Gracias!',
    sending: 'Enviando…', subject: n => `Solicitud de presupuesto: ${n}`,
    sendFail: 'No hemos podido enviar la solicitud. Inténtalo de nuevo o ', mailLink: 'escríbenos directamente',
    consultKind: 'Consultoría', consultSubject: b => `Consultoría: ${b}`
  }
  }[lang];
  root.classList.add('js');
  const go = el => el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  const el = (tag, cls, text) => { const n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  // Entrances: the parts of each block arrive in turn, once
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const sib = [...e.target.parentElement.children].filter(x => x.classList.contains('rv'));
    e.target.style.transitionDelay = Math.min(sib.indexOf(e.target), 5) * 80 + 'ms';
    e.target.classList.add('in'); io.unobserve(e.target);
  }), { rootMargin: '0px 0px -10% 0px' });
  $$('.rv').forEach(x => io.observe(x));

  // Footer wordmark fills the width exactly
  const fit = () => $$('[data-fit]').forEach(x => {
    const inner = x.firstElementChild;
    x.style.fontSize = '100px';
    const w = inner.offsetWidth;                                   // layout width: ignores the settle-in scale
    if (w) x.style.fontSize = (100 * x.clientWidth / w * 0.995) + 'px';
  });
  // measured only when the footer gets close, so opening the page never forces a layout
  const fitIO = new IntersectionObserver(es => { if (!es.some(e => e.isIntersecting)) return; fitIO.disconnect(); (d.fonts?.ready || Promise.resolve()).then(() => { fit(); curtain(); }); addEventListener('resize', fit); }, { rootMargin: '100% 0px' });
  $$('[data-fit]').forEach(x => fitIO.observe(x));

  // The example results page: "your business" climbs to first place and gets highlighted
  const serp = $('#serp'), me = $('#serp-me');
  if (serp && me) {
    const climb = () => {
      const rows = $$('li', serp), first = rows.map(r => r.getBoundingClientRect().top);
      serp.prepend(me);
      const last = rows.map(r => r.getBoundingClientRect().top);
      if (!reduce) rows.forEach((r, i) => r.animate([{ transform: `translateY(${first[i] - last[i]}px)` }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.77,0,.175,1)' }));
      setTimeout(() => serp.classList.add('up'), reduce ? 0 : 750);
    };
    const so = new IntersectionObserver(es => { if (es[0].isIntersecting) { so.disconnect(); setTimeout(climb, reduce ? 0 : 500); } }, { threshold: .6 });
    so.observe(serp);
  }

  // Cases: the hovered or focused name shows its site in the frame
  const cases = $('.cases'), frame = $('.case-frame', cases), links = $$('.case', cases);
  if (frame && matchMedia('(min-width: 1025px)').matches) {                // the frame only exists on big screens; phones never download it
    links.forEach(a => { const im = $('img', a).cloneNode(); im.loading = 'eager'; im.alt = ''; im.sizes = '50vw'; frame.append(im); });
    cases.classList.add('has-frame');
    const shots = $$('img', frame);
    const show = i => { links.forEach((a, j) => a.classList.toggle('on', i === j)); shots.forEach((s, j) => s.classList.toggle('on', i === j)); };
    links.forEach((a, i) => { a.addEventListener('pointerenter', () => show(i)); a.addEventListener('focus', () => show(i)); });
    show(0);
  }

  // Free SEO check, drawn as the visitor's own Google result
  const checker = $('#checker'), status = $('#checker-status'), result = $('#resultado'), btn = $('button', checker);
  const idleStatus = status.textContent;
  const renderChecks = checks => {
    const box = $('#r-checks'); box.replaceChildren();
    const group = (title, list, open = true) => {
      if (!list.length) return;
      const wrap = el(open ? 'div' : 'details'), ul = el('ul');
      list.forEach(c => {
        const li = el('li', 'check ' + c.status);
        const ic = el('i'); ic.innerHTML = ICON[c.status] || ICON.erro; li.append(ic);
        const body = el('div');
        body.append(el('b', null, c.label), el('p', null, c.detail));
        if (c.fix) body.append(el('p', 'fix', c.fix));
        li.append(body); ul.append(li);
      });
      wrap.append(el(open ? 'h3' : 'summary', null, title), ul); box.append(wrap);
    };
    group(T.fix, checks.filter(c => c.status === 'erro'));
    group(T.improve, checks.filter(c => c.status === 'aviso'));
    const ok = checks.filter(c => c.status === 'ok');
    group(T.passed(ok.length), ok, false);
  };
  const svg = p => `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="${p}" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;
  const ICON = { ok: svg('M2 7.5l3.2 3.2L12 3.5'), aviso: svg('M7 2v6.5M7 11v1.5'), erro: svg('M2.5 2.5l9 9M11.5 2.5l-9 9') };
  let lastCheck = null, consultTimer = 0;
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
      const u = new URL(data.url), host = u.hostname.replace(/^www\./, '');
      result.hidden = false;
      $('#r-host').textContent = host;
      $('#r-url').textContent = u.href.replace(/\/$/, '');
      $('#r-fav').textContent = host[0] || '';
      $('#r-title').textContent = data.title || T.noTitle;
      $('#r-desc').textContent = data.desc || '';
      $('#resultado-h').textContent = T.verdict(data.score);
      renderChecks(data.checks);
      const snip = $('.snippet', result); snip.classList.remove('in');
      setTimeout(() => snip.classList.add('in'), reduce ? 0 : 700);
      const num = $('#r-score'), t0 = performance.now();
      const countUp = t => { const k = Math.min(1, (t - t0) / 900); num.textContent = Math.round(data.score * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(countUp); };
      reduce ? (num.textContent = data.score) : requestAnimationFrame(countUp);
      setTimeout(() => { num.textContent = data.score; }, 1000); // background tabs pause rAF
      const bad = data.checks.filter(c => c.status !== 'ok').map(c => `- ${c.label}: ${c.detail}`).join('\n');
      lastCheck = { url: data.url, score: data.score, bad };
      status.textContent = T.done(data.score);
      go(result);
      // offer the free consultation once the visitor has read the result for a while
      clearTimeout(consultTimer); consultTimer = setTimeout(offerConsult, 25000);
    } catch (err) {
      status.textContent = err.message === 'Failed to fetch' ? T.offline : err.message;
      status.classList.add('err');
    } finally {
      clearInterval(tick);
      btn.removeAttribute('aria-busy'); btn.textContent = T.idle;
    }
  });
  checker.url.addEventListener('input', () => { if (status.classList.contains('err')) { status.classList.remove('err'); status.textContent = idleStatus; } });
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
    if (plan) { form.plano.value = plan; $('.more', form).open = true; }
    if (site) { form.site.value = site; $('.more', form).open = true; }
    if (summary && !form.resumo.value.trim()) form.resumo.value = summary;
  };
  d.addEventListener('click', e => {
    const a = e.target.closest('[data-plan]');
    if (a) prefill({ topics: [a.dataset.topic], plan: a.dataset.plan });
    if (e.target.closest('#r-mail') && lastCheck) { clearTimeout(consultTimer); prefill({ topics: T.fixTopics, plan: T.fixPlan, site: lastCheck.url, summary: T.fixSummary(lastCheck.url, lastCheck.score, lastCheck.bad) }); }
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

  // Free consultation: only after an analysis (or from a newsletter link), once a week at most
  const consult = $('#consult'), cform = $('#consult-form'), KEY = 'destaca-consult';
  function remember(v) { try { localStorage.setItem(KEY, JSON.stringify({ v, t: Date.now() })); } catch {} }
  const seen = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && (s.v === 'sent' || Date.now() - s.t < 7 * 864e5); } catch { return false; } };
  const step = name => {
    $$('[data-step]', consult).forEach(s => { s.hidden = s.dataset.step !== name; });
    const f = $(`[data-step="${name}"]`, consult); f.tabIndex = -1;
    // On phones, focusing a field would throw the keyboard over the sheet before the visitor has read it
    ((matchMedia('(pointer: fine)').matches && $('input, textarea', f)) || f).focus({ preventScroll: true }); consult.scrollTop = 0;
  };
  function offerConsult() {
    const busy = d.querySelector('dialog[open]') || form.contains(d.activeElement) || form.resumo.value || d.hidden;
    if (seen() || busy) return;
    consult.showModal(); remember('shown');
  }
  if (location.hash === '#consultoria') { consult.showModal(); step('form'); remember('shown'); }
  consult.addEventListener('click', e => {
    if (e.target === consult || e.target.closest('[data-close]')) consult.close();
    const to = e.target.closest('[data-step-to]');
    if (to) step(to.dataset.stepTo);
  });
  wire(cform, f => {
    const fields = { Pedido: T.consultKind, Empresa: f.get('empresa'), Cidade: f.get('cidade') || '-', Site: f.get('site') || '-', Nome: f.get('nome'), Email: f.get('email'), Telefone: f.get('telefone') || '-', Resumo: f.get('resumo'), 'Língua': lang.toUpperCase() };
    return { fields, subject: T.consultSubject(fields.Empresa) };
  }, () => { step('done'); remember('sent'); trackEvent('consultoria_gratuita'); });

  // Newsletter in the footer; sign-ups go to E-goi via /api/newsletter
  const nform = $('#news-form'), nstatus = $('#news-status');
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
      nform.reset(); nstatus.textContent = T.newsDone; trackEvent('newsletter');
    } catch { nstatus.classList.add('err'); nstatus.textContent = T.newsFail; }
    finally { sb.removeAttribute('aria-busy'); }
  });

  // Analytics: Google Tag Manager loads only after the visitor accepts (RGPD); the choice can be changed in the footer
  const bar = $('#cookie-bar'), CK = 'destaca-cookies';
  const choice = () => { try { return localStorage.getItem(CK); } catch { return null; } };
  const loadGTM = () => {
    if (window.dataLayer?.gtmLoaded) return;
    window.dataLayer = window.dataLayer || [];
    dataLayer.gtmLoaded = true;
    dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = d.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-TCTL7RHK';
    d.head.append(s);
  };
  const showBar = on => { bar.hidden = !on; root.classList.toggle('ck', on); };
  if (choice() === 'yes') loadGTM(); else if (!choice()) showBar(true);
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-cookies]');
    if (!b) return;
    try { localStorage.setItem(CK, b.dataset.cookies); } catch {}
    showBar(false);
    if (b.dataset.cookies === 'yes') return loadGTM();
    // declined after accepting: drop the Analytics cookies and reload without the tag
    if (window.dataLayer?.gtmLoaded) {
      d.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^_g/.test(n))
        .forEach(n => { d.cookie = `${n}=; Max-Age=0; path=/; domain=.${location.hostname}`; d.cookie = `${n}=; Max-Age=0; path=/`; });
      location.reload();
    }
  });
  $$('[data-cookie-prefs]').forEach(b => b.addEventListener('click', () => { showBar(true); $('button', bar).focus(); }));
  // The closing band: the word rises from its mask once, the arrow leans towards the pointer
  const ctaSec = $('.cta'), band = $('.cta-band'), arr = $('.cta-arr', band);
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { ctaSec.classList.add('in'); o.disconnect(); } }, { threshold: .35 }).observe(ctaSec);
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    band.addEventListener('pointermove', e => {
      const r = arr.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      arr.style.transform = `translate(${Math.max(-28, Math.min(28, dx * .06))}px,${Math.max(-28, Math.min(28, dy * .06))}px) rotate(${Math.max(-12, Math.min(12, dx * .02))}deg)`;
    });
    band.addEventListener('pointerleave', () => { arr.style.transform = ''; });
  }

  // One liquid-metal drop, raymarched in a shader. It rises from the bottom into the hero, then flows down the page
  // with the reader: it glides to a free spot in each section, stretching like a drop while it travels.
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const cv = $('#gl'), foot = $('.footer');
  const narrow = () => innerWidth < 761;
  // [section, desktop spot, phone spot]: x and y as a share of the screen (rel: y as a share of the section),
  // s = size, sh = shape (0 pebble, 1 ring, 2 drop). Phones keep the drop to the hero and the closing band.
  const PATH = [
    ['.hero', { x: .72, y: .42, s: .8, sh: 0 }, { x: .6, y: .23, s: .44, sh: 0 }],
    ['.result', { x: .9, y: .5, s: .26, sh: 2 }],
    ['.why', { x: .24, y: .76, s: .36, sh: 2 }],
    ['.cases', { x: .8, y: .87, s: .26, sh: 1 }],
    ['.services', { x: .53, y: .55, s: .3, sh: 0 }],
    ['.how', { x: .14, y: .72, s: .36, sh: 2, rel: 1 }],
    ['.pricing', { x: .2, y: .3, s: .32, sh: 1, rel: 1 }],
    ['.about', { x: .12, y: .8, s: .26, sh: 0, rel: 1 }],
    ['.quote', { x: .2, y: .72, s: .36, sh: 2, rel: 1 }],
    ['.faq', { x: .535, y: .5, s: .2, sh: 2 }],
    ['.cta', { x: .7, y: .33, s: .52, sh: 0, rel: 1 }, { x: .78, y: .42, s: .3, sh: 0, rel: 1 }],
    ['.footer', { x: .7, y: 1.3, s: .2, sh: 2 }, { x: .78, y: 1.3, s: .1, sh: 2 }]
  ].map(([sel, d, m]) => ({ el: $(sel), d, m }));
  const FS = `
precision highp float;
uniform vec4 V; uniform float T, SH, SP; uniform vec3 O, ST; uniform vec2 MN;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float wave(vec3 p){return sin(1.7*p.x+T*.55)*sin(1.5*p.y-T*.45)*sin(1.6*p.z+T*.35);}
float map(vec3 w){
  vec3 p=(w-vec3(O.xy,0.))/O.z;
  // a moving drop stretches along its path and thins across it
  vec3 dir=vec3(ST.xy,0.); float k=ST.z, a=dot(p,dir);
  p=(p-dir*a)*sqrt(1.+k)+dir*a/(1.+k);
  p.yz*=rot(.3+MN.y*.3);
  p.xz*=rot(T*.12+MN.x*.5+SP);
  // mercury: a body and three lobes orbiting inside it, so the outline keeps changing like a liquid
  float peb=length(p*vec3(1.,1.12,1.))-.82;
  peb=smin(peb,length(p-.62*vec3(sin(T*.31),cos(T*.23)*.7,cos(T*.27)))-.5,.5);
  peb=smin(peb,length(p-.66*vec3(cos(T*.19+2.),sin(T*.29)*.8,sin(T*.21+1.)))-.44,.5);
  peb=smin(peb,length(p-.6*vec3(sin(T*.25+4.),sin(T*.17+3.),cos(T*.33)*.6))-.4,.45);
  vec3 q=p; q.yz*=rot(1.15);
  float ring=length(vec2(length(q.xz)-.92,q.y))-.34;
  float drop=smin(length(p+vec3(0.,.22,0.))-.8,length(p-vec3(0.,.78,0.))-.16,.75);
  float d=mix(peb,ring,clamp(SH,0.,1.)); d=mix(d,drop,clamp(SH-1.,0.,1.));
  d+=.07*wave(p);
  return d*O.z*.62/sqrt(1.+k);
}
vec3 nrm(vec3 p){vec2 e=vec2(.0012,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
const vec3 HOT=vec3(1.,.353,.078);
float box(vec2 a,vec2 c,vec2 s,float soft){vec2 d=abs(a-c)-s;return 1.-smoothstep(0.,soft,max(d.x,d.y));}
// a dark photo studio. The middle of the drop reflects what is behind the viewer (dark, one soft strip);
// white strip lights sit above and to the sides, the warm brand light comes from low behind, so orange runs along the edges.
vec3 env(vec3 r){
  float y=r.y, ph=atan(r.x,-r.z);
  vec2 a=vec2(ph,y);
  vec3 c=mix(vec3(.02),vec3(.1),smoothstep(-.4,.7,y));
  c+=vec3(3.2)*box(a,vec2(0.,.92),vec2(3.2,.07),.08);
  c+=vec3(2.2)*box(a,vec2(1.05,.25),vec2(.07,.55),.03);
  c+=vec3(1.3)*box(a,vec2(-1.2,.2),vec2(.05,.6),.03);
  c+=vec3(.55)*box(a,vec2(2.55,.15),vec2(.09,.45),.12);
  c+=HOT*4.*box(a,vec2(-.55,-.25),vec2(.75,.3),.35);
  c+=HOT*1.2*smoothstep(-.35,-.9,y);
  return c;
}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
  vec2 uv=(gl_FragCoord.xy+V.zw-.5*V.xy)/V.y;
  vec3 ro=vec3(0,0,5.), rd=normalize(vec3(uv,-1.6));
  // skip every pixel outside a sphere around the drop
  vec3 oc=ro-vec3(O.xy,0.); float R=O.z*1.5*(1.+ST.z), b=dot(oc,rd), h=b*b-dot(oc,oc)+R*R;
  if(h<0.){gl_FragColor=vec4(0.);return;}
  h=sqrt(h);
  float t=max(0.,-b-h),tf=-b+h,d,md=1e3,mt=t;
  for(int i=0;i<80;i++){d=map(ro+rd*t);if(d<md){md=d;mt=t;}if(d<.0008||t>tf)break;t+=d;}
  float al=1.-smoothstep(.0,.0025+mt*.0012,md);
  if(al<.01){gl_FragColor=vec4(0.);return;}
  vec3 p=ro+rd*mt, n=nrm(p), r=reflect(rd,n);
  float cs=max(dot(-rd,n),0.), fr=pow(1.-cs,5.);
  vec3 lp=(p-vec3(O.xy,0.))/O.z;
  vec3 E=env(r);
  // black chrome with a slow band of orange metal flowing through it
  vec3 g=lp; g.xz*=rot(g.y*.8+T*.1);
  float m=smoothstep(-.12,.12,sin(g.x*1.5+T*.25)+.55*sin(g.y*1.2-T*.2)-.55);
  vec3 F0=mix(vec3(.07,.07,.075),HOT*.95,m);
  vec3 col=aces(E*(F0+(1.-F0)*fr)*1.15);
  col+=aces(E*(.03+.25*fr))*.6*(1.-col);
  col+=pow(max(dot(r,normalize(vec3(.5,.8,.45))),0.),300.)*1.2;
  col*=1.-.55*smoothstep(.2,.95,pow(1.-cs,1.4));
  col=clamp(col,0.,1.);
  gl_FragColor=vec4(col*al,al);
}`;
  let gl = null, live = false, t0 = 0, kk = 1;
  const U = {};
  // Starts after load and a first gesture (or under a second), so it never delays the page; software renderers skip it.
  const init3d = () => {
    if (gl || !cv) return;
    gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: true, alpha: true });
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const ren = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    if (!gl || /swiftshader|llvmpipe|softpipe|software|basic render/i.test(ren)) { cv.remove(); return; }
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
    const vsh = sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'), fsh = sh(gl.FRAGMENT_SHADER, FS);
    if (!vsh || !fsh) { cv.remove(); return; }
    const pr = gl.createProgram();
    gl.attachShader(pr, vsh); gl.attachShader(pr, fsh); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['V', 'T', 'SH', 'SP', 'O', 'ST', 'MN']) U[n] = gl.getUniformLocation(pr, n);
    live = true; t0 = performance.now(); size();
  };
  const startEvents = ['pointermove', 'scroll', 'keydown', 'touchstart', 'wheel'];
  const kickoff = () => { startEvents.forEach(ev => removeEventListener(ev, kickoff)); init3d(); };
  addEventListener('load', () => {
    startEvents.forEach(ev => addEventListener(ev, kickoff, { passive: true, once: true }));
    setTimeout(kickoff, 3500);                                         // without a gesture, wait until the page has settled
  });
  // Phones draw only a band around the drop; big screens get a pixel budget.
  // ponytail: fixed budget; add frame-time based scaling if weak laptops drop frames
  const size = () => {
    if (!live) return;
    const n = narrow(), h = n ? Math.round(innerHeight * .5) : innerHeight;
    kk = n ? Math.min(devicePixelRatio, 2) : Math.min(devicePixelRatio, Math.sqrt(2.6e6 / (innerWidth * innerHeight)));
    cv.style.height = n ? h + 'px' : '';
    if (!n) cv.style.transform = '';
    cv.width = Math.round(innerWidth * kk); cv.height = Math.round(h * kk); gl.viewport(0, 0, cv.width, cv.height);
  };
  addEventListener('resize', size);
  // the curtain (page lifting off the footer) only when the whole footer fits on screen, otherwise its foot would be cut off
  // measured only on big screens and after load, so phones and the first paint never pay for it
  const curtain = () => {
    if (innerWidth <= 1024) return foot.classList.remove('curtain');
    foot.classList.remove('curtain'); foot.classList.toggle('curtain', foot.offsetHeight <= innerHeight);
  };
  addEventListener('resize', curtain); addEventListener('load', () => requestAnimationFrame(curtain));

  // Where the drop belongs right now: the spot of the section under the middle of the screen,
  // blended with the next one while their border crosses the middle of the screen.
  const target = () => {
    const H = innerHeight, W = innerWidth, n = narrow(), c = H / 2, band = H * .3;
    const L = [];
    let prev = null;
    for (const o of PATH) {
      if (!o.el || o.el.hidden) continue;
      // the footer is pinned under the page (a curtain), so its turn starts where the page above it ends
      const r = o.el === foot && L.length ? { top: L[L.length - 1].r.bottom, bottom: 1e9, height: 1e9 } : o.el.getBoundingClientRect(), a = n ? o.m : o.d;
      const at = a ? { x: a.x * W, y: a.rel ? r.top + a.y * r.height : a.y * H, s: a.s, sh: a.sh }
        : { x: prev ? prev.x : W / 2, y: prev ? prev.y : H / 2, s: 0, sh: prev ? prev.sh : 0 };
      L.push({ r, at }); prev = at;
    }
    let i = 0;
    while (i + 1 < L.length && L[i + 1].r.top <= c) i++;
    const f = y => { const v = clamp((c + band - y) / (2 * band)); return v * v * (3 - 2 * v); };
    const mix = (A, B, t) => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, s: A.s + (B.s - A.s) * t, sh: A.sh + (B.sh - A.sh) * t });
    if (i + 1 < L.length && L[i].r.bottom < c + band) return mix(L[i].at, L[i + 1].at, f(L[i].r.bottom));
    if (i > 0 && L[i].r.top > c - band) return mix(L[i - 1].at, L[i].at, f(L[i].r.top));
    return L[i].at;
  };

  let px = innerWidth / 2, py = innerHeight / 2;
  addEventListener('pointermove', e => { if (Number.isFinite(e.clientX + e.clientY)) { px = e.clientX; py = e.clientY; } }, { passive: true });
  let sx = 0, sy = 0, vx = 0, vy = 0, sS = 0, sSh = 0, mnx = 0, mny = 0, spin = 0, lastY = scrollY, last = 0, lastDraw = 0, fresh = true, fpLast = '';
  (function frame(now) {
    requestAnimationFrame(frame);
    // footer curtain: the wordmark settles as the footer is uncovered
    if (!reduce) { const v = clamp((innerHeight - foot.getBoundingClientRect().top) / (innerHeight * .9)).toFixed(4); if (v !== fpLast) foot.style.setProperty('--fp', fpLast = v); }
    if (!live || d.hidden) return;
    const n = narrow();
    if (n && now - lastDraw < 15) return;                                         // phones: 60 fps is plenty
    const dt = Math.min((now - (last || now)) / 1000, 1 / 15); last = now; lastDraw = now;
    const H = innerHeight, W = innerWidth, tg = target();
    if (fresh) { sx = tg.x; sy = H * 1.35; sS = tg.s * .7; sSh = tg.sh; fresh = false; }   // it rises from below the screen
    if (reduce) { sx = tg.x; sy = tg.y; sS = tg.s; sSh = tg.sh; vx = vy = 0; }
    else {
      // a spring with a little give: it trails the scroll, overshoots a hair and settles
      const K = 70, C = 14;
      vx += (K * (tg.x - sx) - C * vx) * dt; vy += (K * (tg.y - sy) - C * vy) * dt;
      sx += vx * dt; sy += vy * dt;
      const e = 1 - Math.exp(-dt * 4);
      sS += (tg.s - sS) * e; sSh += (tg.sh - sSh) * e;
    }
    const rad = sS / 3.125 * H * 1.6;
    const vis = sS > .01 && sy - rad < H && sy + rad > 0;
    cv.style.visibility = vis ? 'visible' : 'hidden';
    if (!vis) return;
    spin += (scrollY - lastY) * .0012; lastY = scrollY;
    const lx = n ? Math.sin(now / 2600) * .8 : px / W * 2 - 1, ly = n ? Math.cos(now / 3400) * .6 : -(py / H * 2 - 1);
    mnx += (lx - mnx) * .04; mny += (ly - mny) * .04;
    const sp = Math.hypot(vx, vy) / H * 3.125, k = Math.min(sp * .14, .45);
    let oy = 0;
    if (n) { const top = sy - cv.height / kk / 2; cv.style.transform = `translateY(${top}px)`; oy = (H - top) * kk - cv.height; }
    gl.uniform4f(U.V, cv.width, n ? H * kk : cv.height, 0, oy);
    gl.uniform1f(U.T, reduce ? 3 : (now - t0) / 1000);
    gl.uniform1f(U.SH, sSh); gl.uniform1f(U.SP, spin);
    gl.uniform3f(U.O, (sx - W / 2) / H * 3.125, -(sy - H / 2) / H * 3.125, sS);
    gl.uniform3f(U.ST, sp ? vx / H * 3.125 / sp : 0, sp ? -vy / H * 3.125 / sp : 0, k);
    gl.uniform2f(U.MN, mnx, mny);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  })(performance.now());
})();
