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
    mailSubject: (h, s) => `SEO analysis of ${h}: ${s}/100`,
    mailBody: (u, s, bad) => `Hello Destaca,\n\nI ran the free analysis on my site (${u}) and scored ${s}/100.\n\nIssues to fix:\n${bad || '- None'}\n\nI would like help to improve it.\n`
  } : {
    steps: ['A abrir o site…', 'A ler o título e a descrição…', 'A verificar a versão para telemóvel…', 'A procurar o sitemap e o robots.txt…', 'A medir a velocidade…'],
    empty: 'Escreve o endereço do teu site, por exemplo o-teu-site.pt.',
    fail: 'Não conseguimos analisar este site. Tenta outra vez.',
    offline: 'Sem ligação à internet. Tenta outra vez.',
    busy: 'A analisar… ', idle: 'Analisar grátis ',
    done: s => `Análise concluída: ${s} em 100.`,
    verdict: s => s >= 85 ? 'Bom ponto de partida. Há afinações que te podem pôr à frente da concorrência.' : s >= 60 ? 'Há trabalho a fazer: estes pontos estão a custar-te visitas.' : 'O teu site está a perder clientes no Google. Dá para resolver.',
    fix: 'A corrigir', improve: 'A melhorar', passed: n => `${n} verificações passaram`,
    mailSubject: (h, s) => `Análise SEO de ${h}: ${s}/100`,
    mailBody: (u, s, bad) => `Olá Destaca,\n\nFiz a análise grátis ao meu site (${u}) e tive ${s}/100.\n\nPontos a corrigir:\n${bad || '- Nenhum'}\n\nGostava de ajuda para melhorar.\n`
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
      const host = new URL(data.url).hostname;
      $('#r-mail').href = `mailto:ola@destaca.site?subject=${encodeURIComponent(T.mailSubject(host, data.score))}&body=${encodeURIComponent(T.mailBody(data.url, data.score, bad))}`;
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
})();
