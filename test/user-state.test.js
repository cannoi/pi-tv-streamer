'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createUserState } = require('../lib/iptv/user-state');

function tempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'pi-tv-state-')); }

test('channel history, last channel, favorites and custom channels survive reload', (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let state = createUserState(dir);
  state.patch({ lastCountry: 'vn', customChannels: [{ id: 'custom-1', name: 'Test Channel', url: 'https://example.com/live.m3u8' }] });
  state.pushHistory({ id: 'custom-1', name: 'Test Channel', url: 'https://example.com/live.m3u8', country: 'vn' });
  state.setFavorite('custom-1', true);
  state = createUserState(dir);
  const saved = state.get();
  assert.equal(saved.lastChannelId, 'custom-1');
  assert.equal(saved.lastCountry, 'vn');
  assert.equal(saved.history[0].id, 'custom-1');
  assert.equal(saved.customChannels[0].name, 'Test Channel');
  assert.deepEqual(saved.favorites, ['custom-1']);
});

test('history keeps only the latest visit for a channel and caps at 50', (t) => {
  const dir = tempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const state = createUserState(dir);
  state.pushHistory({ id: 'one', name: 'One' });
  state.pushHistory({ id: 'two', name: 'Two' });
  state.pushHistory({ id: 'one', name: 'One again' });
  assert.equal(state.get().history.length, 2);
  assert.equal(state.get().history[0].name, 'One again');
  for (let i = 0; i < 60; i++) state.pushHistory({ id: `channel-${i}`, name: `Channel ${i}` });
  assert.equal(state.get().history.length, 50);
});
