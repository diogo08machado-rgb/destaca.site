// Self-check: node api/analisar.test.js
const assert = require('node:assert');
const { isPrivateIp, analyse } = require('./analisar.js');

for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', '::ffff:127.0.0.1']) assert.ok(isPrivateIp(ip), ip);
for (const ip of ['8.8.8.8', '76.76.21.21', '2606:4700::1111']) assert.ok(!isPrivateIp(ip), ip);

const good = `<!doctype html><html lang="pt-PT"><head><title>Padaria Aurora | Padaria artesanal em Coimbra</title>
<meta name="description" content="Pão de massa-mãe cozido todos os dias em Coimbra. Encomendas, horários e morada da Padaria Aurora.">
<meta name="viewport" content="width=device-width"><link rel="canonical" href="https://x.pt/"><link rel="icon" href="/f.svg">
<meta property="og:title" content="x"><meta property="og:image" content="x.png"><script type="application/ld+json">{}</script></head>
<body><h1>Padaria</h1><h2>Pão</h2><img src="a.jpg" alt="pão">${'palavra '.repeat(320)}</body></html>`;
const r = analyse({ url: new URL('https://x.pt/'), status: 200, ms: 200, size: 4000, text: good }, true, true);
assert.strictEqual(r.score, 100, JSON.stringify(r.checks.filter((c) => c.status !== 'ok')));

const bad = analyse({ url: new URL('http://x.pt/'), status: 200, ms: 2500, size: 2e6, text: '<html><head><meta name="robots" content="noindex"></head><body><h1>a</h1><h1>b</h1><img src=x></body></html>' }, false, false);
assert.ok(bad.score < 20, String(bad.score));
assert.strictEqual(bad.checks.find((c) => c.id === 'index').status, 'erro');
console.log('ok', r.score, bad.score);
