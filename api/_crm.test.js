// Self-check: node api/_crm.test.js
const assert = require('node:assert');
const { nextStage, keyOf } = require('./crm.js');

assert.strictEqual(nextStage('lead', 'email_out', ''), 'contactado');
assert.strictEqual(nextStage('lead', 'rascunho', ''), 'lead');
assert.strictEqual(nextStage('contactado', 'email_in', 'Obrigado, enviem proposta'), 'respondeu');
assert.strictEqual(nextStage('contactado', 'email_in', '  REMOVER por favor'), 'nao_contactar');
assert.strictEqual(nextStage('nao_contactar', 'email_in', 'olá'), 'nao_contactar');
assert.strictEqual(nextStage('respondeu', 'proposta', ''), 'proposta');
assert.strictEqual(nextStage('cliente', 'email_in', 'REMOVER'), 'cliente');
assert.strictEqual(keyOf({ domain: 'www.Exemplo.pt' }), 'exemplo.pt');
assert.strictEqual(keyOf({ phone: '351 965 337 578' }), 'tel:965337578');
assert.strictEqual(keyOf({ phone: '965337578' }), 'tel:965337578');
assert.strictEqual(keyOf({ name: ' Casa X ' }), 'nome:casa x');
console.log('crm ok');

// TOTP against the RFC 6238 test vector (SHA-1, secret "12345678901234567890", T=59 s -> 94287082, last 6 digits)
const { totp, checkTotp, hashPassword, checkPassword } = require('./crm.js');
const rfc = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
assert.strictEqual(totp(rfc, 1), '287082');
assert.strictEqual(checkTotp(rfc, '287082', 0, 59000), 1);
assert.strictEqual(checkTotp(rfc, '287082', 1, 59000), 0, 'a code works only once');
assert.strictEqual(checkTotp(rfc, '000000', 0, 59000), 0);
const h = hashPassword('uma-palavra-passe-longa');
assert.ok(checkPassword('uma-palavra-passe-longa', h));
assert.ok(!checkPassword('errada', h));
assert.ok(!checkPassword('x', undefined));
console.log('auth ok');

const mail = require('./_mail.js');
assert.strictEqual(mail.trimQuoted('Obrigado, enviem proposta.\n\nEm qua., 5/11/2026 às 09:54, Destaca escreveu:\n> Olá'), 'Obrigado, enviem proposta.');
assert.strictEqual(mail.trimQuoted('REMOVER\n\nDe: contacto primario <contacto@destaca.site>\nEnviada: 30 de outubro'), 'REMOVER');
assert.deepStrictEqual(mail.formLead('Nome: Joana Silva\nEmail: joana@empresa.pt\nMensagem: quero site'), { email: 'joana@empresa.pt', name: 'Joana Silva' });
assert.ok(mail.AUTO.test('Resposta automática: Re: Sobre o site'));
console.log('mail ok');
