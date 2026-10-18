const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseM3U, normalizeName, parseTvgId } = require('../lib/iptv/m3u-parser');
const { assertSafeUrl, isBlockedIp } = require('../lib/net/safe-fetch');

const sample = fs.readFileSync(path.join(__dirname, 'fixtures/vn_m3u_sample.txt'), 'utf8');
const fullPath = path.join(__dirname, 'fixtures/vn_m3u.txt');
const full = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';

test('normalizeName extracts quality and flags', () => {
  const r = normalizeName('An Giang TV1 (1080p) [Geo-blocked]');
  assert.equal(r.quality, 1080);
  assert.equal(r.flags.geoBlocked, true);
  assert.equal(r.name, 'An Giang TV1');
});

test('parseTvgId splits key feed country', () => {
  const r = parseTvgId('AnNinhTV.vn@HD');
  assert.equal(r.channelKey, 'AnNinhTV.vn');
  assert.equal(r.feed, 'HD');
  assert.equal(r.country, 'vn');
});

test('sample fixture parses and merges', () => {
  const r = parseM3U(sample);
  assert.equal(r.kind, 'channel-list');
  assert.ok(r.rawCount >= 8);
  // AnNinhTV has 2 sources → merged
  const antv = r.channels.find(c => c.tvgId === 'AnNinhTV.vn@HD');
  assert.ok(antv);
  assert.equal(antv.sources.length, 2);
  const ag = r.channels.find(c => c.tvgId === 'AnGiangTV1.vn@SD');
  assert.ok(ag);
  assert.equal(ag.country, 'vn');
  assert.equal(ag.sources[0].flags.geoBlocked, true);
  assert.equal(ag.sources[0].quality, 1080);
  const httpCh = r.channels.find(c => c.tvgId === 'HttpOnly.vn@SD');
  assert.ok(httpCh.sources[0].flags.insecureHttp);
  const exp = r.channels.find(c => c.tvgId === 'OldToken.vn@SD');
  assert.ok(exp.sources[0].flags.expiring);
});

test('full vn.m3u from iptv-org if present', () => {
  if (!full) return;
  const r = parseM3U(full);
  assert.equal(r.kind, 'channel-list');
  assert.ok(r.rawCount > 50, 'expected many raw entries');
  assert.ok(r.channels.length > 30);
  assert.ok(r.channels.length <= r.rawCount);
  // no CR in names
  for (const c of r.channels) {
    assert.ok(!/\r/.test(c.name));
  }
});

test('SSRF blocks private hosts', async () => {
  await assert.rejects(() => assertSafeUrl('http://127.0.0.1/x'), /blocked/);
  await assert.rejects(() => assertSafeUrl('http://localhost/x'), /blocked/);
  await assert.rejects(() => assertSafeUrl('http://10.0.0.5/x'), /blocked/);
  await assert.rejects(() => assertSafeUrl('http://192.168.1.1/x'), /blocked/);
  await assert.rejects(() => assertSafeUrl('http://172.16.0.1/x'), /blocked/);
  assert.equal(isBlockedIp('127.0.0.1'), true);
  assert.equal(isBlockedIp('8.8.8.8'), false);
});

test('library import merge', () => {
  const os = require('os');
  const { createLibrary } = require('../lib/iptv/library');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-lib-'));
  const lib = createLibrary(dir);
  const parsed = parseM3U(sample);
  const res = lib.importChannels(parsed.channels, { mode: 'merge' });
  assert.ok(res.added >= 5);
  const res2 = lib.importChannels(parsed.channels, { mode: 'merge' });
  assert.equal(res2.added, 0);
  assert.ok(res2.merged >= 1);
  const search = lib.search({ q: 'antv' });
  assert.ok(search.total >= 1);
});
