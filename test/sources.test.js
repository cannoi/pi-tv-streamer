const test = require('node:test');
const assert = require('node:assert/strict');
const { findSources, isAllowlistedUrl } = require('../lib/iptv/sources');

test('findSources matches vietnam', () => {
  const r = findSources(__dirname + '/../data', 'vietnam');
  assert.ok(r.some(s => s.id.includes('vn')));
});

test('allowlist iptv-org', () => {
  assert.equal(isAllowlistedUrl('https://iptv-org.github.io/iptv/countries/vn.m3u'), true);
  assert.equal(isAllowlistedUrl('http://evil.local/x.m3u'), false);
});
