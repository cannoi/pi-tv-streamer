const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSafeUrl, isBlockedIp } = require('../lib/net/safe-fetch');

test('blocks loopback and private', async () => {
  await assert.rejects(() => assertSafeUrl('http://127.0.0.1/'));
  await assert.rejects(() => assertSafeUrl('http://10.1.2.3/'));
  await assert.rejects(() => assertSafeUrl('http://192.168.0.1/'));
  await assert.rejects(() => assertSafeUrl('http://172.16.0.5/'));
});

test('blocks ipv6 localhost', async () => {
  await assert.rejects(() => assertSafeUrl('http://[::1]/'));
});

test('isBlockedIp covers mapped', () => {
  assert.equal(isBlockedIp('::ffff:127.0.0.1'), true);
  assert.equal(isBlockedIp('8.8.8.8'), false);
});
