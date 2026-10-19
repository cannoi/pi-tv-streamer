/* Pi Vintage TV — pure helpers for zapping, gestures and picture quality (v1.9.19).
 * No DOM access here, so every function can be unit-tested in Node (test/zap.test.js).
 *   PiZap.createDeadRegistry  — channels without signal (temporary, persisted, auto-retry)
 *   PiZap.findNextAlive       — next channel in a direction that is not marked dead
 *   PiZap.classifyStep        — is a jump "next", "previous" or an explicit pick?
 *   PiZap.createDoubleTap     — double-tap detector (one tap never counts as two)
 *   PiZap.createCooldown      — blocks repeated fullscreen toggles from duplicate events
 *   PiZap.pickStartLevel      — first HLS quality level (sharp, but bandwidth-aware)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PiZap = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Channels that showed no signal are skipped for `ttlMs`, then tried again. */
  function createDeadRegistry(opts) {
    opts = opts || {};
    var storage = opts.storage || null;
    var key = opts.key || 'pi_vintage_dead_v1';
    var ttl = opts.ttlMs || 10 * 60 * 1000;
    var now = opts.now || Date.now;
    var map = {};
    try {
      var raw = storage && storage.getItem(key);
      if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') map = o; }
    } catch (e) { map = {}; }

    function prune() {
      var t = now(), changed = false;
      Object.keys(map).forEach(function (k) {
        if (!map[k] || !(map[k].until > t)) { delete map[k]; changed = true; }
      });
      return changed;
    }
    function save() {
      try { if (storage) storage.setItem(key, JSON.stringify(map)); } catch (e) {}
    }
    prune();

    return {
      isDead: function (id) {
        if (!id) return false;
        var e = map[id];
        return !!(e && e.until > now());
      },
      markDead: function (id, reason) {
        if (!id) return;
        map[id] = { until: now() + ttl, reason: String(reason || ''), at: now() };
        if (Object.keys(map).length > 400) prune();
        save();
      },
      markAlive: function (id) {
        if (id && map[id]) { delete map[id]; save(); return true; }
        return false;
      },
      clear: function () { map = {}; save(); },
      list: function () { prune(); return Object.keys(map); },
      size: function () { prune(); return Object.keys(map).length; }
    };
  }

  /** Index of the next channel in `dir` (+1/-1) for which isDeadAt(i) is false; -1 if none. */
  function findNextAlive(len, from, dir, isDeadAt) {
    if (!len) return -1;
    dir = dir < 0 ? -1 : 1;
    for (var i = 1; i <= len; i++) {
      var idx = (((from + dir * i) % len) + len) % len;
      if (!isDeadAt(idx)) return idx;
    }
    return -1;
  }

  /** +1 when target is the following channel, -1 when it is the previous one, 0 for an explicit pick. */
  function classifyStep(len, cur, target) {
    if (!len || len < 2) return 0;
    var t = ((target % len) + len) % len;
    if (t === (cur + 1) % len) return 1;
    if (t === (cur - 1 + len) % len) return -1;
    return 0;
  }

  /** hit(x,y,t) is true only for the SECOND tap of a close pair; the pair is then consumed. */
  function createDoubleTap(opts) {
    opts = opts || {};
    var windowMs = opts.windowMs || 320, slop = opts.slopPx || 40;
    var last = null;
    return {
      hit: function (x, y, t) {
        if (last && (t - last.t) <= windowMs && (t - last.t) >= 0 &&
            Math.abs(x - last.x) <= slop && Math.abs(y - last.y) <= slop) {
          last = null;
          return true;
        }
        last = { x: x, y: y, t: t };
        return false;
      },
      reset: function () { last = null; }
    };
  }

  /** ready(t) is true at most once per `ms` — stops one gesture toggling fullscreen twice. */
  function createCooldown(ms) {
    var at = -Infinity;
    return {
      ready: function (t) {
        if (t - at < ms) return false;
        at = t;
        return true;
      }
    };
  }

  /**
   * Choose the first HLS level: the smallest one that is at least as tall as the picture on screen
   * (device pixels), but never one the connection can't carry. Adaptive switching continues afterwards.
   * levels: [{height, bitrate}]  → index into the same array, or -1 to let hls.js decide.
   */
  function pickStartLevel(levels, o) {
    o = o || {};
    if (!Array.isArray(levels) || levels.length < 2) return -1;
    var dpr = o.dpr || 1;
    var viewH = o.viewH || 480;
    var wantH = Math.min(2160, Math.max(480, Math.round(viewH * dpr * (o.fullscreen ? 1.15 : 1.05))));
    var maxBps = o.downlinkMbps > 0 ? o.downlinkMbps * 1e6 * 0.75 : 6e6;

    var order = levels.map(function (l, i) { return { i: i, h: l.height || 0, b: l.bitrate || 0 }; })
      .sort(function (a, b) { return (a.h - b.h) || (a.b - b.b); });
    var fit = order.filter(function (l) { return l.h >= wantH; })[0] || order[order.length - 1];
    if (fit.b > maxBps) {
      var ok = order.filter(function (l) { return l.b <= maxBps; });
      fit = ok.length ? ok[ok.length - 1] : order[0];
    }
    return fit.i;
  }

  return {
    createDeadRegistry: createDeadRegistry, findNextAlive: findNextAlive, classifyStep: classifyStep,
    createDoubleTap: createDoubleTap, createCooldown: createCooldown, pickStartLevel: pickStartLevel
  };
});
