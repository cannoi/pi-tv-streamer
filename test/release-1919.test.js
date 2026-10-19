'use strict';
/* Wiring checks for v1.9.19: files, versions, and that old defects cannot come back. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pkg = require('../package.json');
const appJs = read('public/app.js');
const html = read('public/index.html');

test('zap.js is served, loaded before app.js and precached', () => {
  assert.ok(fs.existsSync(path.join(root, 'public/zap.js')));
  assert.ok(html.indexOf('zap.js') > -1 && html.indexOf('zap.js') < html.indexOf('app.js'));
  assert.match(read('public/sw.js'), /'\/zap\.js'/);
});

test('one version everywhere', () => {
  assert.equal(pkg.version, '1.9.19');
  assert.match(read('public/sw.js'), new RegExp('pi-vintage-tv-v' + pkg.version.replace(/\./g, '\\.')));
  assert.match(read('CHANGELOG.md'), new RegExp('## ' + pkg.version.replace(/\./g, '\\.')));
  assert.match(appJs, new RegExp("version: '" + pkg.version.replace(/\./g, '\\.') + "'"));
  assert.ok(fs.existsSync(path.join(root, 'docs/V1.9.19_REPORT.md')));
});

test('gestures: one delegated handler, no per-element binding (the cause of 1 tap = fullscreen)', () => {
  const g = appJs.slice(appJs.indexOf('setupShortsGestures'));
  assert.doesNotMatch(g, /__shortsBound/);
  assert.doesNotMatch(g, /rebind/);
  assert.doesNotMatch(g, /\]\.forEach\(bind\)/);
  assert.match(g, /document\.addEventListener\('touchend'/);
  assert.match(g, /PiZap\.createDoubleTap/);
  assert.match(g, /PiZap\.createCooldown/);
});

test('dead channels are skipped, not deleted', () => {
  const hlsFn = appJs.slice(appJs.indexOf('function playHlsStream'), appJs.indexOf('function scheduleOfficialResolve'));
  assert.doesNotMatch(hlsFn, /channels = channels\.filter/, 'playback errors no longer delete channels');
  assert.doesNotMatch(hlsFn, /setProbeCache/, 'no permanent probe-cache poisoning');
  assert.match(appJs, /PiZap\.findNextAlive/);
  assert.match(appJs, /PiZap\.classifyStep/);
  assert.match(appJs, /handleNoSignal\('hls-/);
});

test('HLS starts sharp and is not capped to the small CRT window', () => {
  assert.match(appJs, /capLevelToPlayerSize: false/);
  assert.match(appJs, /autoStartLoad: false/);
  assert.match(appJs, /PiZap\.pickStartLevel/);
  assert.match(appJs, /hls\.startLoad\(-1\)/);
  assert.match(read('public/vendor/hls.min.js'), /startLevel/);
});

test('clear-picture CSS exists and removes the video filter', () => {
  const css = read('public/style.css');
  assert.match(css, /\.tv-frame-container\.clear-picture video \{ filter: none/);
  assert.match(css, /clear-picture #staticCanvas \{ opacity: 0/);
});

test('every id app.js looks up exists in index.html (or is created by app.js)', () => {
  const ids = new Set([...appJs.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]));
  const have = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const dynamic = new Set([...appJs.matchAll(/\.id = '([^']+)'/g)].map(m => m[1]));
  // legacy optional hooks, null-checked in app.js and absent from index.html since before v1.9.18
  const optional = new Set(['epgOsd', 'officialFrameBody']);
  const missing = [...ids].filter(i => !have.has(i) && !dynamic.has(i) && !optional.has(i));
  assert.deepEqual(missing, [], 'ids missing from index.html: ' + missing.join(', '));
});

test('all JavaScript files parse', () => {
  const vm = require('node:vm');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.name === 'node_modules' || e.name === 'vendor' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of walk(root).filter(f => f.endsWith('.js'))) {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(f, 'utf8').replace(/^#!.*/, ''), { filename: f }), f);
  }
});

test('files kept from v1.9.18 are still there', () => {
  for (const f of ['server.js', 'Dockerfile', 'docker-compose.yml', 'config_options.yml', 'public/ai-panel.js', 'public/tv-hub.js',
    'public/tv-channels.js', 'lib/ai-module/provider-engine.js', 'lib/iptv/library.js', 'lib/iptv/user-state.js', 'lib/net/safe-fetch.js']) {
    assert.ok(fs.existsSync(path.join(root, f)), f);
  }
});
