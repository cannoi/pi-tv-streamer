'use strict';
/* Real behaviour of public/app.js, run in a fake browser (test/harness.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTv } = require('./harness');

const chans = (n, extra = {}) => Array.from({ length: n }, (_, i) => Object.assign({
  id: 'c' + i, name: 'CH-0' + (i + 1) + ' Chan' + i, url: 'https://example.invalid/c' + i + '.m3u8'
}, extra));
const free = (tv) => tv.run('endChannelBusy()');

test('next / previous skip channels that have no signal', () => {
  const tv = createTv();
  tv.setChannels(chans(6));
  tv.run("deadReg.markDead('c2'); deadReg.markDead('c3');");
  tv.run('requestChannelChange(currentChannelIndex + 1, "ui")');        // c0 → c1
  assert.equal(tv.run('currentChannelIndex'), 1);
  free(tv);
  tv.run('requestChannelChange(currentChannelIndex + 1, "ui")');        // c1 → (c2,c3 dead) → c4
  assert.equal(tv.run('currentChannelIndex'), 4);
  free(tv);
  tv.run('requestChannelChange(currentChannelIndex - 1, "ui")');        // c4 → (c3,c2 dead) → c1
  assert.equal(tv.run('currentChannelIndex'), 1);
});

test('swipe and keyboard use the same skipping', () => {
  const tv = createTv();
  tv.setChannels(chans(5));
  tv.run("deadReg.markDead('c1');");
  const screen = tv.wireScreen();
  tv.swipe(screen, 200, 100, 60, 100);                                   // swipe left = next
  assert.equal(tv.run('currentChannelIndex'), 2, 'c1 skipped');
});

test('a channel that fails is marked, kept in the list, and the app hops to the next live one', () => {
  const tv = createTv();
  tv.setChannels(chans(4));
  tv.run('requestChannelChange(1, "ui")');                               // c0 → c1
  assert.equal(tv.run('currentChannelIndex'), 1);
  tv.run("handleNoSignal('test')");
  assert.equal(tv.run("deadReg.isDead('c1')"), true);
  assert.equal(tv.run('channels.length'), 4, 'channel is NOT deleted any more');
  assert.match(tv.els.channelOsd.textContent, /No signal/);
  assert.equal(tv.fire(450), 1, 'automatic hop is scheduled');
  assert.equal(tv.run('currentChannelIndex'), 2, 'hopped forward to the next channel');
});

test('hopping continues in the direction of travel and never loops forever', () => {
  const tv = createTv();
  tv.setChannels(chans(5));
  tv.run("deadReg.markDead('c1'); deadReg.markDead('c2'); deadReg.markDead('c3'); deadReg.markDead('c4'); deadReg.markDead('c0');");
  tv.run('currentChannelIndex = 0; handleNoSignal("all")');
  assert.equal(tv.fire(450), 0, 'nothing alive → no hop scheduled');
  assert.match(tv.els.channelOsd.textContent, /No channel has a signal/);
});

test('going backwards hops backwards', () => {
  const tv = createTv();
  tv.setChannels(chans(5));
  tv.run('currentChannelIndex = 3; requestChannelChange(2, "ui")');      // previous → navDir = -1, lands on c2
  assert.equal(tv.run('currentChannelIndex'), 2);
  tv.run("handleNoSignal('x')");
  tv.fire(450);
  assert.equal(tv.run('currentChannelIndex'), 1);
});

test('backup sources are tried before a channel is marked dead', () => {
  const tv = createTv();
  const list = chans(3);
  list[1].sources = [{ url: 'https://example.invalid/main.m3u8' }, { url: 'https://example.invalid/backup.m3u8' }];
  list[1].url = list[1].sources[0].url;
  tv.setChannels(list);
  tv.run('currentChannelIndex = 1; playToken += 1;');
  tv.run("handleNoSignal('first')");
  assert.equal(tv.run('channels[1].url'), 'https://example.invalid/backup.m3u8');
  assert.equal(tv.run("deadReg.isDead('c1')"), false, 'not dead yet');
  tv.fire(300);
  tv.run("handleNoSignal('second')");
  assert.equal(tv.run("deadReg.isDead('c1')"), true, 'all sources failed → dead');
  assert.equal(tv.run('channels[1].url'), 'https://example.invalid/main.m3u8', 'reset to the main source');
});

test('10 s without a picture = no signal; picture data present (autoplay blocked) is NOT', () => {
  const tv = createTv();
  tv.setChannels(chans(3));
  tv.run('requestChannelChange(1, "ui")');
  assert.equal(tv.fire(10000), 1);
  assert.equal(tv.run("deadReg.isDead('c1')"), true);

  const tv2 = createTv();
  tv2.setChannels(chans(3));
  tv2.run('requestChannelChange(1, "ui"); video.readyState = 4;');       // data loaded, just paused
  tv2.fire(10000);
  assert.equal(tv2.run("deadReg.isDead('c1')"), false);
});

test('a working picture clears the mark and turns on the clear picture mode', () => {
  const tv = createTv();
  tv.setChannels(chans(3));
  tv.run("deadReg.markDead('c1'); currentChannelIndex = 1; playToken += 1; onSignalOk();");
  assert.equal(tv.run("deadReg.isDead('c1')"), false);
  assert.equal(tv.els['tv-frame-container']._classes.has('clear-picture'), true);
  tv.run('playChannel(2)');
  assert.equal(tv.els['tv-frame-container']._classes.has('clear-picture'), false, 'retro look while tuning');
});

test('retro picture preference disables the clear mode; AI action saves it', async () => {
  const tv = createTv();
  tv.setChannels(chans(2));
  assert.deepEqual(JSON.parse(JSON.stringify(await tv.run("runAiAction('set_picture', {mode:'retro'})"))), { ok: true, picture: 'retro' });
  assert.equal(tv.store.pi_vintage_picture, 'retro');
  tv.run('onSignalOk()');
  assert.equal(tv.els['tv-frame-container']._classes.has('clear-picture'), false);
  assert.equal((await tv.run("runAiAction('set_picture', {mode:'bogus'})")).ok, false);
});

test('retry_channels clears every mark', async () => {
  const tv = createTv();
  tv.setChannels(chans(3));
  tv.run("deadReg.markDead('c1'); deadReg.markDead('c2');");
  assert.equal((await tv.run("runAiAction('retry_channels', {})")).ok, true);
  assert.equal(tv.run('deadReg.size()'), 0);
});

test('a dead channel is shown with a cross in the channel list', () => {
  const tv = createTv();
  tv.setChannels(chans(3));
  tv.run("deadReg.markDead('c1'); renderChannelSelect();");
  const labels = tv.els.channelSelect.children.map(o => o.textContent);
  assert.match(labels[1], /✕$/);
  assert.doesNotMatch(labels[0], /✕/);
});

/* ---------------- gestures ---------------- */

function gestureTv() {
  const tv = createTv();
  tv.setChannels(chans(4));
  tv.run('globalThis.__fs = 0; toggleVideoFullscreen = function () { globalThis.__fs++; };');
  const screen = tv.wireScreen();
  tv.clock.t += 5000;
  return { tv, screen, fs: () => tv.run('globalThis.__fs') };
}

test('ONE tap on the screen never toggles fullscreen', () => {
  const { tv, screen, fs } = gestureTv();
  tv.tap(screen);
  assert.equal(fs(), 0);
  tv.clock.t += 2000;
  tv.tap(screen);
  assert.equal(fs(), 0, 'two slow taps are two single taps');
});

test('two quick taps toggle fullscreen exactly once; a third tap starts a new pair', () => {
  const { tv, screen, fs } = gestureTv();
  tv.tap(screen); tv.clock.t += 120; tv.tap(screen);
  assert.equal(fs(), 1);
  tv.clock.t += 120; tv.tap(screen);
  assert.equal(fs(), 1, 'third tap is only the start of a new pair');
});

test('double-click with a mouse toggles once; the synthesized dblclick after a touch is ignored', () => {
  const { tv, screen, fs } = gestureTv();
  tv.doc.dispatch('dblclick', { target: screen });
  assert.equal(fs(), 1);
  tv.clock.t += 3000;
  tv.tap(screen); tv.clock.t += 120; tv.tap(screen);              // touch double tap → 1 more
  assert.equal(fs(), 2);
  tv.doc.dispatch('dblclick', { target: screen });                  // browser also fires dblclick right after
  assert.equal(fs(), 2, 'no second toggle for the same gesture');
});

test('taps on buttons / controls are ignored by the gesture layer', () => {
  const { tv, screen, fs } = gestureTv();
  const btn = Object.assign({ __parent: screen }, { closest: () => ({}) });   // inside a <button>
  tv.tap(btn); tv.clock.t += 100; tv.tap(btn);
  assert.equal(fs(), 0);
});

test('the gesture handlers live on document only (the old nested bindings caused 1 tap = fullscreen)', () => {
  const { tv } = gestureTv();
  for (const id of ['screenInner', 'tv-frame-container', 'tvVideo', 'staticCanvas']) {
    const l = tv.els[id]._listeners;
    assert.equal((l.touchstart || []).length + (l.touchend || []).length + (l.dblclick || []).length, 0, id + ' has no gesture listeners');
  }
  assert.equal((tv.doc._listeners.touchend || []).length, 1, 'exactly one touchend handler');
  assert.equal((tv.doc._listeners.dblclick || []).length, 1, 'exactly one dblclick handler');
});

test('tap on a powered-off TV switches it on (and does not toggle fullscreen)', () => {
  const { tv, screen, fs } = gestureTv();
  tv.run('isPoweredOn = false;');
  tv.tap(screen);
  assert.equal(tv.run('isPoweredOn'), true);
  assert.equal(fs(), 0);
});

test('double-click on the screen of an OFF TV only powers it on', () => {
  const { tv, screen, fs } = gestureTv();
  tv.run('isPoweredOn = false;');
  tv.doc.dispatch('click', { target: screen });
  tv.doc.dispatch('click', { target: screen });
  tv.doc.dispatch('dblclick', { target: screen });
  assert.equal(tv.run('isPoweredOn'), true);
  assert.equal(fs(), 0);
});

test('AI context reports picture mode, fullscreen and the no-signal list', () => {
  const tv = createTv();
  tv.setChannels(chans(3));
  tv.run("deadReg.markDead('c2');");
  const c = JSON.parse(JSON.stringify(tv.run('getAiContext()')));
  assert.equal(c.version, '1.9.19');
  assert.equal(c.picture, 'clear');
  assert.equal(c.fullscreen, false);
  assert.deepEqual(c.noSignal, ['Chan2']);
});
