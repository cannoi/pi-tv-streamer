'use strict';
/* The AI Panel must always know the app as it is now (v1.9.19): keep knowledge, actions and code in step. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../lib/app-adapter');
const { FAQ, buildKnowledge } = require('../lib/app-knowledge');
const { detectLang } = require('../lib/i18n/lang');
const pkg = require('../package.json');
const appJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

test('knowledge carries the current version and every v1.9.19 feature', () => {
  assert.ok(adapter.knowledge.includes('v' + pkg.version));
  for (const must of ['DOUBLE-tap', 'a single tap does nothing', 'no signal', '10 s', '10 minutes', 'retry_channels',
    'set_picture', 'clear picture', 'swipe', 'Fullscreen', 'localStorage', 'ALWAYS reply in the language']) {
    assert.ok(adapter.knowledge.toLowerCase().includes(must.toLowerCase()), 'knowledge mentions: ' + must);
  }
});

test('every action named in the knowledge is a real, allowed action', () => {
  const allowed = new Set(adapter.actions.map(a => a.name));
  const named = new Set(buildKnowledge('x').match(/\b[a-z]+_[a-z_]+\b/g) || []);
  for (const n of named) if (!/^data_|^user_/.test(n)) assert.ok(allowed.has(n), 'documented action exists: ' + n);
});

test('every action offered to the AI is implemented by the browser', () => {
  const handled = new Set([...appJs.matchAll(/case '([a-z_]+)'/g)].map(m => m[1]));
  for (const m of appJs.matchAll(/name === '([a-z_]+)'/g)) handled.add(m[1]);
  for (const a of adapter.actions) assert.ok(handled.has(a.name), 'app.js handles action: ' + a.name);
});

test('actions are executable only when allowed', async () => {
  assert.equal((await adapter.executeAction({ name: 'set_picture', args: { mode: 'retro' } })).ok, true);
  assert.equal((await adapter.executeAction({ name: 'rm_rf', args: {} })).ok, false);
});

test('live context from the browser reaches the AI (picture, fullscreen, no-signal list, language)', async () => {
  const c = await adapter.getContext({ lang: 'vi', picture: 'retro', fullscreen: true, noSignal: ['VTV3'], channelName: 'VTV1', channelCount: 8 });
  assert.equal(c.version, pkg.version);
  assert.equal(c.lang, 'vi'); assert.equal(c.picture, 'retro'); assert.equal(c.fullscreen, true);
  assert.deepEqual(c.noSignal, ['VTV3']); assert.equal(c.channelName, 'VTV1');
  assert.equal((await adapter.getContext(null)).picture, 'clear');
});

test('language detection follows the message, not only the UI language', () => {
  assert.equal(detectLang('Làm sao để bật toàn màn hình?', 'en'), 'vi');
  assert.equal(detectLang('lam sao bat toan man hinh', 'en'), 'vi', 'Vietnamese without accents');
  assert.equal(detectLang('How do I turn on fullscreen?', 'vi'), 'en');
  assert.equal(detectLang('ok', 'vi'), 'vi', 'ambiguous → UI language');
  assert.equal(detectLang('ok', 'en'), 'en');
  assert.equal(detectLang('как включить полный экран', 'en'), 'ru');
  assert.equal(detectLang('全画面にするには', 'en'), 'ja');
});

test('offline guide answers how-to questions in the language of the question', async () => {
  const cases = [
    ['fullscreen', 'Làm sao để bật toàn màn hình?', 'How do I use fullscreen?', /nhấn đúp/i, /double-tap/i],
    ['nosignal', 'Kênh không có tín hiệu thì sao?', 'What happens on a channel with no signal?', /bỏ qua/i, /skip/i],
    ['picture', 'Làm sao để hình ảnh rõ nét hơn?', 'How can I get a sharper picture?', /rõ nét/i, /clear/i],
    ['swipe', 'Vuốt để làm gì?', 'What does swipe do?', /vuốt/i, /swipe/i],
    ['keys', 'Có phím tắt nào không?', 'Are there keyboard shortcuts?', /phím tắt/i, /keyboard/i],
    ['memory', 'App có nhớ lịch sử xem không?', 'Does the app remember my history?', /lưu|nhớ/i, /remember/i]
  ];
  for (const [id, vi, en, reVi, reEn] of cases) {
    const rv = await adapter.localReply(vi, { lang: 'en' });     // UI is English but the user writes Vietnamese
    const re = await adapter.localReply(en, { lang: 'vi' });     // UI is Vietnamese but the user writes English
    assert.match(rv.reply, reVi, id + ' (vi)');
    assert.match(re.reply, reEn, id + ' (en)');
    assert.deepEqual(rv.actions, [], id + ' question has no side effect');
    assert.deepEqual(re.actions, [], id + ' question has no side effect');
  }
});

test('imperative requests run the matching action, in the user language', async () => {
  const fs1 = await adapter.localReply('bật toàn màn hình', { lang: 'en' });
  assert.deepEqual(fs1.actions.map(a => a.name), ['toggle_fullscreen']);
  assert.match(fs1.reply, /toàn màn hình/);
  const fs2 = await adapter.localReply('go fullscreen', { lang: 'vi' });
  assert.deepEqual(fs2.actions.map(a => a.name), ['toggle_fullscreen']);
  assert.match(fs2.reply, /fullscreen/i);
  const retry = await adapter.localReply('retry channels', { lang: 'en' });
  assert.deepEqual(retry.actions.map(a => a.name), ['retry_channels']);
  const retroVi = await adapter.localReply('chuyển hình ảnh kiểu TV cũ', { lang: 'en' });
  assert.deepEqual(retroVi.actions, [{ name: 'set_picture', args: { mode: 'retro' } }]);
  const clearEn = await adapter.localReply('switch to clear picture', { lang: 'vi' });
  assert.deepEqual(clearEn.actions, [{ name: 'set_picture', args: { mode: 'clear' } }]);
});

test('existing offline intents still work and answer in the right language', async () => {
  assert.deepEqual((await adapter.localReply('qr', { lang: 'en' })).actions.map(a => a.name), ['show_remote_access']);
  const s = await adapter.localReply('tìm kênh Việt Nam', { lang: 'en' });
  assert.deepEqual(s.actions.map(a => a.name), ['smart_import']);
  assert.match(s.reply, /Đang tìm/);
  const c = await adapter.localReply('confirm import', { lang: 'vi' });
  assert.equal(c.actions[0].args.confirm, true);
  assert.match(c.reply, /Saving/);
  const u = await adapter.localReply('https://example.invalid/list.m3u8', { lang: 'en' });
  assert.equal(u.actions[0].args.url, 'https://example.invalid/list.m3u8');
});

test('every FAQ entry has both languages and they differ', () => {
  for (const f of FAQ) { assert.ok(f.en && f.vi && f.en !== f.vi, f.id); }
});

test('the cloud-model prompt gets the language rule and the knowledge', () => {
  const svc = fs.readFileSync(path.join(__dirname, '../lib/ai-module/ai-service.js'), 'utf8');
  assert.match(svc, /USER LANGUAGE/);
  assert.match(svc, /detectLang\(message/);
  assert.match(svc, /APP KNOWLEDGE|appKnowledge/);
});
