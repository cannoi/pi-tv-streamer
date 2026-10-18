const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseM3U, normalizeName } = require('../lib/iptv/m3u-parser');
const { assertSafeUrl } = require('../lib/net/safe-fetch');
const { createLibrary } = require('../lib/iptv/library');
const { resolveIntent } = require('../lib/iptv/sources');

test('normalizeName extracts quality and flags', () => {
  const r = normalizeName('Foo (1080p) [Geo-blocked]');
  assert.equal(r.quality, 1080);
  assert.equal(r.flags.geoBlocked, true);
  assert.ok(!r.name.includes('1080'));
});

test('parse sample merges by tvg-id', () => {
  const text = fs.readFileSync(path.join(__dirname, 'fixtures/sample.m3u'), 'utf8');
  const r = parseM3U(text);
  assert.equal(r.kind, 'channel-list');
  assert.equal(r.rawCount, 3);
  assert.equal(r.channels.length, 2);
});

test('SSRF blocks private hosts', async () => {
  await assert.rejects(() => assertSafeUrl('http://127.0.0.1/x'));
  await assert.rejects(() => assertSafeUrl('http://10.0.0.1/x'));
});

test('intent India not Vietnam', () => {
  const ids = resolveIntent('Chỉ cho tôi danh sách kênh ấn độ');
  assert.ok(ids.includes('iptv-org-in'));
  assert.ok(!ids.includes('iptv-org-vn'));
});

test('library import merge', () => {
  const dir = path.join(__dirname, 'tmp-lib-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  const lib = createLibrary(dir);
  const text = fs.readFileSync(path.join(__dirname, 'fixtures/sample.m3u'), 'utf8');
  const r = parseM3U(text);
  const res = lib.importChannels(r.channels, { mode: 'merge', importId: 't' });
  assert.equal(res.added, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});
