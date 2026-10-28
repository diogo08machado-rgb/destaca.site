(() => {
  const d = document, root = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s), $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const en = root.lang.startsWith('en');
  const T = en ? {
    steps: ['Opening the site…', 'Reading the title and description…', 'Checking the mobile version…', 'Looking for the sitemap and robots.txt…', 'Measuring speed…'],
    empty: 'Type your website address, for example your-site.com.',
    fail: 'We could not analyse this site. Please try again.',
    offline: 'No internet connection. Please try again.',
    busy: 'Analysing… ', idle: 'Free analysis ',
    done: s => `Analysis complete: ${s} out of 100.`,
    verdict: s => s >= 85 ? 'A good starting point. A few tweaks could put you ahead of the competition.' : s >= 60 ? 'There is work to do: these issues are costing you visits.' : 'Your site is losing customers on Google. It can be fixed.',
    fix: 'To fix', improve: 'To improve', passed: n => `${n} checks passed`,
    fixTopics: ['Improve my website', 'Show up on Google (SEO)'], fixPlan: 'Site upgrade (290 €)',
    fixSummary: (u, s, bad) => `I ran the free analysis on ${u} and scored ${s}/100. I'd like help fixing:\n${bad || '- (no issues listed)'}`,
    sending: 'Sending…', subject: n => `Quote request: ${n}`,
    sendFail: 'We could not send your request. Please try again or ',
    mailLink: 'email us directly', opened: 'We opened your email app with everything filled in. Just press send.'
  } : {
    steps: ['A abrir o site…', 'A ler o título e a descrição…', 'A verificar a versão para telemóvel…', 'A procurar o sitemap e o robots.txt…', 'A medir a velocidade…'],
    empty: 'Escreve o endereço do teu site, por exemplo o-teu-site.pt.',
    fail: 'Não conseguimos analisar este site. Tenta outra vez.',
    offline: 'Sem ligação à internet. Tenta outra vez.',
    busy: 'A analisar… ', idle: 'Analisar grátis ',
    done: s => `Análise concluída: ${s} em 100.`,
    verdict: s => s >= 85 ? 'Bom ponto de partida. Há afinações que te podem pôr à frente da concorrência.' : s >= 60 ? 'Há trabalho a fazer: estes pontos estão a custar-te visitas.' : 'O teu site está a perder clientes no Google. Dá para resolver.',
    fix: 'A corrigir', improve: 'A melhorar', passed: n => `${n} verificações passaram`,
    fixTopics: ['Melhorar o meu site', 'Aparecer no Google (SEO)'], fixPlan: 'Melhoramento (290 €)',
    fixSummary: (u, s, bad) => `Fiz a análise grátis a ${u} e tive ${s}/100. Gostava de ajuda para corrigir:\n${bad || '- (sem pontos listados)'}`,
    sending: 'A enviar…', subject: n => `Pedido de orçamento: ${n}`,
    sendFail: 'Não conseguimos enviar o pedido. Tenta outra vez ou ',
    mailLink: 'envia-nos um email', opened: 'Abrimos o teu email com tudo preenchido. Só tens de carregar em enviar.'
  };
  root.classList.add('js');

  // Smooth scrolling (off when the visitor asks for less motion)
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1 });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const header = $('.site-header');
  const go = el => {
    if (lenis) lenis.scrollTo(el, { duration: 1.2, offset: el.id === 'inicio' ? -9999 : -header.offsetHeight + 8 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };

  // Menu dialog doubles as the full section index
  const menu = $('#menu'), sections = $$('main > section[data-title]');
  $('#menu-list').innerHTML = sections.map(s => `<li><a href="#${s.id}">${s.dataset.title}</a></li>`).join('');
  $$('[data-open-menu]').forEach(b => b.addEventListener('click', () => { menu.showModal(); lenis?.stop(); }));
  menu.addEventListener('close', () => lenis?.start());

  d.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const t = $(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault();
    if (menu.open) menu.close();
    go(t);
    if (t.id === 'inicio') { $('#url').focus({ preventScroll: true }); return; }
    t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
    history.replaceState(null, '', a.getAttribute('href'));
  });

  // Fit the big words to the measure
  const fit = () => $$('[data-fit]').forEach(el => {
    const inner = el.firstElementChild;
    el.style.fontSize = '100px';
    const w = inner.getBoundingClientRect().width;
    if (w) el.style.fontSize = (100 * el.clientWidth / w * 0.995) + 'px';
  });
  fit();
  d.fonts?.ready.then(fit);
  addEventListener('resize', fit);

  // Entrances: the parts of each section arrive in turn
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('section, article, footer').forEach(s => $$(':scope [data-reveal]', s).forEach((el, i) => el.style.setProperty('--d', Math.min(i, 6) * 80 + 'ms')));
  $$('[data-reveal]').forEach(el => io.observe(el));

  // Header glass, pagination rail, footer name; only recomputed when something moved
  const foot = $('.footer'), rail = $('.rail'), menuLinks = $$('#menu-list a');
  rail.innerHTML = sections.map(s => `<button type="button" aria-label="${s.dataset.title}"><span>${s.dataset.title}</span></button>`).join('');
  const railBtns = $$('button', rail);
  railBtns.forEach((b, i) => b.addEventListener('click', () => go(sections[i])));
  let current = -1, dirty = true;
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  addEventListener('resize', () => { dirty = true; });
  const frame = () => {
    requestAnimationFrame(frame);
    if (!dirty) return;
    dirty = false;
    const vh = innerHeight, y = scrollY;
    header.classList.toggle('scrolled', y > 24);
    if (!reduce) foot.style.setProperty('--fp', clamp((vh - foot.getBoundingClientRect().top) / (vh * 0.8)).toFixed(4));
    let c = 0;
    sections.forEach((s, i) => { if (!s.hidden && s.getBoundingClientRect().top <= vh * 0.45) c = i; });
    if (c !== current) {
      current = c;
      menuLinks.forEach((a, i) => a.setAttribute('aria-current', i === c ? 'true' : 'false'));
      railBtns.forEach((b, i) => b.setAttribute('aria-current', i === c ? 'true' : 'false'));
    }
    rail.classList.toggle('show', y > vh * 0.6 && foot.getBoundingClientRect().top > vh * 0.5);
  };
  requestAnimationFrame(frame);

  // Case studies: one screenshot, swapped by hover, focus or tap
  const cases = $$('.case'), shots = $$('.case-frame .shots img'), caption = $('.case-frame figcaption a');
  cases.forEach((c, i) => {
    const on = () => {
      cases.forEach((x, j) => x.classList.toggle('on', i === j));
      shots.forEach((s, j) => s.classList.toggle('on', i === j));
      if (caption) { caption.href = c.dataset.url; caption.textContent = c.dataset.url.replace(/^https?:\/\/(www\.)?|\/$/g, ''); }
    };
    c.addEventListener('mouseenter', on);
    c.addEventListener('focusin', on);
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
    btn.setAttribute('aria-busy', 'true');
    btn.firstChild.textContent = T.busy;
    let si = 0; status.textContent = T.steps[0];
    const tick = setInterval(() => { si = Math.min(si + 1, T.steps.length - 1); status.textContent = T.steps[si]; }, 1200);
    try {
      const r = await fetch(`/api/analisar?lang=${en ? 'en' : 'pt'}&url=` + encodeURIComponent(url));
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || T.fail);
      result.hidden = false;
      $('#r-url').textContent = data.url;
      $('#resultado-h').textContent = T.verdict(data.score);
      renderChecks(data.checks);
      const num = $('#r-score'), fg = $('.ring .fg');
      fg.style.strokeDashoffset = 326.7;
      requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = 326.7 * (1 - data.score / 100); }));
      const t0 = performance.now();
      const count = t => { const k = clamp((t - t0) / 1200); num.textContent = Math.round(data.score * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(count); };
      requestAnimationFrame(count);
      const bad = data.checks.filter(c => c.status !== 'ok').map(c => `- ${c.label}: ${c.detail}`).join('\n');
      lastCheck = { url: data.url, score: data.score, bad };
      status.textContent = T.done(data.score);
      $$('[data-reveal]', result).forEach(x => x.classList.add('in'));
      go(result);
    } catch (err) {
      status.textContent = err.message === 'Failed to fetch' ? T.offline : err.message;
      status.classList.add('err');
    } finally {
      clearInterval(tick);
      btn.removeAttribute('aria-busy');
      btn.firstChild.textContent = T.idle;
    }
  });
  // links like destaca.site/?analisar=example.pt run the check straight away
  const pre = new URLSearchParams(location.search).get('analisar');
  if (pre) { checker.url.value = pre.slice(0, 200); checker.requestSubmit(); }

  // "Ver mais" opens the whole row, so the three plans stay side by side for comparison
  document.querySelectorAll('.plans').forEach((row) => {
    const all = row.querySelectorAll('.plan-more');
    const sideBySide = () => getComputedStyle(row).gridTemplateColumns.split(' ').length > 1; // stacked on phones: open one at a time
    all.forEach((d) => d.addEventListener('toggle', () => sideBySide() && all.forEach((o) => { if (o.open !== d.open) o.open = d.open; })));
  });

  // Quote request: plan buttons and "fix this" prefill the form; it sends straight to our inbox
  const form = $('#pedido-form'), done = $('#pedido-done'), fstatus = $('#pedido-status'), fbtn = $('button[type="submit"]', form);
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
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form.botcheck.checked) return;
    const f = new FormData(form);
    const topics = f.getAll('topicos').join(', ') || '-';
    const fields = { Nome: f.get('nome'), Empresa: f.get('empresa') || '-', Email: f.get('email'), Telefone: f.get('telefone') || '-', Site: f.get('site') || '-', 'Tópicos': topics, Plano: f.get('plano'), Resumo: f.get('resumo'), 'Língua': en ? 'EN' : 'PT' };
    const subject = T.subject(fields.Empresa !== '-' ? `${fields.Nome} (${fields.Empresa})` : fields.Nome);
    const mailto = `mailto:contacto@destaca.site?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n'))}`;
    fstatus.classList.remove('err');
    // ponytail: no access key yet -> hand off to the visitor's mail app, already filled in
    if (!form.dataset.key) { location.href = mailto; fstatus.textContent = T.opened; return; }
    fbtn.setAttribute('aria-busy', 'true'); fstatus.textContent = T.sending;
    try {
      const r = await fetch('https://api.web3forms.com/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: form.dataset.key, subject, from_name: 'destaca.site', replyto: fields.Email, ...fields })
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok || !out.success) throw new Error();
      form.hidden = true; done.hidden = false; done.focus();
      go(done.closest('section'));
    } catch {
      fstatus.textContent = T.sendFail;
      const a = el('a', null, T.mailLink); a.href = mailto;
      fstatus.append(a, '.'); fstatus.classList.add('err');
    } finally { fbtn.removeAttribute('aria-busy'); }
  });
  $('#pedido-again').addEventListener('click', () => { form.reset(); fstatus.textContent = ''; done.hidden = true; form.hidden = false; form.resumo.focus(); });
})();
