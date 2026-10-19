'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Z = require('../public/zap.js');

function memStorage() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; }

test('dead registry: marks, expires after the TTL and is retried', () => {
  let t = 1000;
  const r = Z.createDeadRegistry({ storage: memStorage(), ttlMs: 600000, now: () => t });
  assert.equal(r.isDead('a'), false);
  r.markDead('a', 'timeout');
  assert.equal(r.isDead('a'), true);
  t += 599000; assert.equal(r.isDead('a'), true);
  t += 2000;   assert.equal(r.isDead('a'), false, 'tried again after 10 minutes');
  assert.equal(r.size(), 0);
});

test('dead registry: survives a reload, markAlive and clear work', () => {
  const st = memStorage(); let t = 5;
  const r1 = Z.createDeadRegistry({ storage: st, now: () => t });
  r1.markDead('x'); r1.markDead('y');
  const r2 = Z.createDeadRegistry({ storage: st, now: () => t });          // "page reload"
  assert.deepEqual(r2.list().sort(), ['x', 'y']);
  assert.equal(r2.markAlive('x'), true);
  assert.equal(r2.markAlive('x'), false);
  assert.deepEqual(r2.list(), ['y']);
  r2.clear();
  assert.equal(Z.createDeadRegistry({ storage: st, now: () => t }).size(), 0);
});

test('dead registry: corrupt storage does not break the app', () => {
  const st = memStorage(); st.setItem('pi_vintage_dead_v1', '{not json');
  const r = Z.createDeadRegistry({ storage: st });
  assert.equal(r.size(), 0);
  r.markDead('a');
  assert.equal(r.isDead('a'), true);
});

test('findNextAlive skips dead channels in both directions and wraps around', () => {
  const dead = new Set([2, 3]);
  const f = (from, dir) => Z.findNextAlive(6, from, dir, i => dead.has(i));
  assert.equal(f(1, 1), 4);
  assert.equal(f(4, -1), 1);
  assert.equal(f(5, 1), 0);
  assert.equal(f(0, -1), 5);
  assert.equal(Z.findNextAlive(3, 0, 1, () => true), -1, 'all dead → -1 (no endless loop)');
  assert.equal(Z.findNextAlive(0, 0, 1, () => false), -1);
  assert.equal(Z.findNextAlive(1, 0, 1, () => false), 0, 'single channel returns itself');
});

test('classifyStep tells next / previous / explicit pick', () => {
  assert.equal(Z.classifyStep(8, 3, 4), 1);
  assert.equal(Z.classifyStep(8, 3, 2), -1);
  assert.equal(Z.classifyStep(8, 7, 8), 1, 'wraps forward');
  assert.equal(Z.classifyStep(8, 0, -1), -1, 'wraps backward');
  assert.equal(Z.classifyStep(8, 3, 6), 0, 'explicit pick');
  assert.equal(Z.classifyStep(1, 0, 1), 0);
});

test('double tap: a single tap is never a double tap', () => {
  const d = Z.createDoubleTap({ windowMs: 320, slopPx: 40 });
  assert.equal(d.hit(100, 100, 1000), false, 'first tap');
  assert.equal(d.hit(105, 98, 1150), true, 'second tap, close in time and place');
  assert.equal(d.hit(105, 98, 1200), false, 'pair consumed: next tap starts a new pair');
});

test('double tap: slow, far-apart or reset taps do not count', () => {
  const d = Z.createDoubleTap({ windowMs: 320, slopPx: 40 });
  d.hit(100, 100, 1000);
  assert.equal(d.hit(100, 100, 1400), false, 'too slow');
  d.hit(100, 100, 3000);
  assert.equal(d.hit(300, 300, 3100), false, 'too far apart');
  d.hit(10, 10, 5000); d.reset();
  assert.equal(d.hit(10, 10, 5100), false, 'reset after a swipe');
});

test('cooldown lets only one fullscreen toggle through per gesture', () => {
  const c = Z.createCooldown(700);
  assert.equal(c.ready(1000), true);
  assert.equal(c.ready(1100), false, 'duplicate event (touch + synthesized dblclick)');
  assert.equal(c.ready(1699), false);
  assert.equal(c.ready(1700), true);
});

test('pickStartLevel: sharp but bandwidth-aware', () => {
  const lv = [{ height: 360, bitrate: 800e3 }, { height: 720, bitrate: 2.5e6 }, { height: 1080, bitrate: 5e6 }];
  assert.equal(Z.pickStartLevel(lv, { viewH: 340, dpr: 2, downlinkMbps: 20 }), 1, '680 device px → 720p');
  assert.equal(Z.pickStartLevel(lv, { viewH: 340, dpr: 2, downlinkMbps: 20, fullscreen: true }), 2, 'fullscreen enlarges the picture → 1080p');
  assert.equal(Z.pickStartLevel(lv, { viewH: 900, dpr: 2, downlinkMbps: 20, fullscreen: true }), 2, 'big screen → 1080p');
  assert.equal(Z.pickStartLevel(lv, { viewH: 900, dpr: 2, downlinkMbps: 2 }), 0, 'slow link → 360p, no stalls');
  assert.equal(Z.pickStartLevel(lv, { viewH: 340, dpr: 1 }), 1, 'unknown link assumes ~6 Mbps');
  assert.equal(Z.pickStartLevel([{ height: 720, bitrate: 1e6 }], {}), -1, 'single level → let hls.js decide');
  assert.equal(Z.pickStartLevel(undefined, {}), -1);
});
