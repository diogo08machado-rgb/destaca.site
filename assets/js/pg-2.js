// Service pages: entrances, footer wordmark and the cookie choice (same behaviour as the home page, without the drop or forms)
(() => {
  const d = document, root = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s), $$ = (s, c = d) => [...c.querySelectorAll(s)];
  root.classList.add('js');

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const sib = [...e.target.parentElement.children].filter(x => x.classList.contains('rv'));
    e.target.style.transitionDelay = Math.min(sib.indexOf(e.target), 5) * 80 + 'ms';
    e.target.classList.add('in'); io.unobserve(e.target);
  }), { rootMargin: '0px 0px -10% 0px' });
  $$('.rv').forEach(x => io.observe(x));

  const fit = () => $$('[data-fit]').forEach(x => {
    const inner = x.firstElementChild;
    x.style.fontSize = '100px';
    const w = inner.offsetWidth;
    if (w) x.style.fontSize = (100 * x.clientWidth / w * 0.995) + 'px';
  });
  const fitIO = new IntersectionObserver(es => { if (!es.some(e => e.isIntersecting)) return; fitIO.disconnect(); (d.fonts?.ready || Promise.resolve()).then(fit); addEventListener('resize', fit); }, { rootMargin: '100% 0px' });
  $$('[data-fit]').forEach(x => fitIO.observe(x));

  const cta = $('.cta');
  if (cta) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { cta.classList.add('in'); o.disconnect(); } }, { threshold: .35 }).observe(cta);

  // Analytics only after the visitor accepts (RGPD); shares the stored choice with the home page
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
    if (window.dataLayer?.gtmLoaded) {
      d.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^_g/.test(n))
        .forEach(n => { d.cookie = `${n}=; Max-Age=0; path=/; domain=.${location.hostname}`; d.cookie = `${n}=; Max-Age=0; path=/`; });
      location.reload();
    }
  });
  $$('[data-cookie-prefs]').forEach(b => b.addEventListener('click', () => { showBar(true); $('button', bar).focus(); }));
})();
