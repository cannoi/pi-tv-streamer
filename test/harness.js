'use strict';
/**
 * Runs public/app.js inside a tiny fake browser (no jsdom needed) so the zapping and gesture logic
 * is exercised for real. Every DOM element is a permissive stub; events are captured so tests can fire them.
 */
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function makeEl(id) {
  const listeners = {};
  const classes = new Set();
  const el = {
    id, tagName: 'DIV', style: { setProperty() {}, removeProperty() {} }, dataset: {}, children: [], value: '', textContent: '', innerHTML: '', hidden: false,
    readyState: 0, videoWidth: 0, videoHeight: 0, clientHeight: 300, clientWidth: 400, paused: true, muted: false, volume: 1, error: null,
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, on) => { const v = on === undefined ? !classes.has(c) : !!on; v ? classes.add(c) : classes.delete(c); return v; },
      contains: (c) => classes.has(c)
    },
    _classes: classes,
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: () => {},
    dispatch: (t, ev) => (listeners[t] || []).slice().forEach(fn => fn(Object.assign({ target: el, preventDefault() {}, stopPropagation() {} }, ev))),
    _listeners: listeners,
    setAttribute(k, v) { this[k] = v; }, getAttribute(k) { return this[k] === undefined ? null : this[k]; },
    removeAttribute(k) { delete this[k]; },
    appendChild(c) { this.children.push(c); return c; }, remove() {}, focus() {}, blur() {}, click() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    contains(o) { return o === el || (el.children || []).includes(o) || !!(o && o.__parent === el); },
    getContext: () => ({ createImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {}, clearRect() {} }),
    play: () => Promise.resolve(), pause() {}, load() {}, canPlayType: () => '',
    getBoundingClientRect: () => ({ width: 400, height: 300, left: 0, top: 0 }),
    insertAdjacentHTML() {}, scrollTo() {}
  };
  return el;
}

function createTv(opts = {}) {
  const els = {};
  const timers = [];
  const doc = makeEl('document');
  const store = Object.assign({}, opts.localStorage || {});
  const win = {};
  doc.getElementById = (id) => (els[id] = els[id] || makeEl(id));
  doc.createElement = () => makeEl('new');
  doc.querySelector = () => null;
  doc.querySelectorAll = () => [];
  doc.body = makeEl('body');
  doc.documentElement = makeEl('html');
  doc.fullscreenElement = null;
  doc.visibilityState = 'visible';
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }, _store: store
  };
  const clock = { t: 1000000 };
  const FakeDate = Object.assign(function (...a) { return a.length ? new Date(...a) : new Date(clock.t); },
    { now: () => clock.t, parse: Date.parse, UTC: Date.UTC });
  const calls = { fetch: [], osd: [], fullscreen: 0 };
  Object.assign(win, {
    document: doc, localStorage, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: { userAgent: 'test', connection: { downlink: 20 } },
    screen: {}, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    fetch: (url, init) => { calls.fetch.push([String(url), init]); return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) }); },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, location: { origin: 'http://localhost', href: 'http://localhost/' },
    alert() {}, confirm: () => true, console: { log() {}, warn() {}, error() {} },
    Date: FakeDate, Math, JSON, Promise, URL, Uint32Array, Uint8ClampedArray, parseInt, parseFloat, isNaN, Array, Object, String, Number, Set, Map, RegExp, Error,
    AudioContext: class {
      constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = {}; }
      createBuffer() { return { getChannelData: () => new Float32Array(8) }; }
      createBufferSource() { return { connect() {}, start() {}, stop() {}, disconnect() {}, buffer: null, loop: false }; }
      createGain() { return { connect() {}, disconnect() {}, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
      createBiquadFilter() { return { connect() {}, disconnect() {}, frequency: { value: 0 }, Q: { value: 0 }, type: '' }; }
      resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
    },
    Float32Array,
    PiZap: require('../public/zap.js')
  });
  win.window = win;
  win.self = win;
  win.top = win;
  const ctx = vm.createContext(win);
  const src = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  vm.runInContext(src, ctx, { filename: 'app.js' });
  const run = (code) => vm.runInContext(code, ctx);
  // helpers shared by the tests
  const helpers = {
    clock,
    /** run (and drop) pending timers whose delay equals ms */
    fire(ms) { const due = timers.filter(t => t.ms === ms); due.forEach(t => { timers.splice(timers.indexOf(t), 1); t.fn(); }); return due.length; },
    /** channel list with ids a,b,c,… ; TV on, boot lock released */
    setChannels(list) {
      run('channels = ' + JSON.stringify(list) + '; currentChannelIndex = 0; isPoweredOn = true; booting = false;');
    },
    /** touch tap on an element (start + end 60 ms apart) */
    tap(el, x = 100, y = 100) {
      doc.dispatch('touchstart', { target: el, touches: [{}], changedTouches: [{ clientX: x, clientY: y }] });
      clock.t += 60;
      doc.dispatch('touchend', { target: el, touches: [], changedTouches: [{ clientX: x, clientY: y }] });
    },
    swipe(el, x0, y0, x1, y1) {
      doc.dispatch('touchstart', { target: el, touches: [{}], changedTouches: [{ clientX: x0, clientY: y0 }] });
      doc.dispatch('touchmove', { target: el, touches: [{}], changedTouches: [{ clientX: x1, clientY: y1 }] });
      clock.t += 120;
      doc.dispatch('touchend', { target: el, touches: [], changedTouches: [{ clientX: x1, clientY: y1 }] });
    },
    /** the SCREEN element is inside the TV frame */
    wireScreen() { els.screenInner = els.screenInner || makeEl('screenInner'); const tvf = doc.getElementById('tv-frame-container'); doc.getElementById('screenInner').__parent = tvf; return doc.getElementById('screenInner'); }
  };
  return Object.assign({ ctx, win, doc, els, timers, store, localStorage, calls, run }, helpers);
}

module.exports = { createTv, makeEl };
