/**
 * Background health checker — non-blocking queue
 */
const { safeFetch } = require('../net/safe-fetch');

function createHealthChecker(library, { concurrency = 6, ttlMs = 6 * 3600 * 1000 } = {}) {
  const queue = [];
  let active = 0;
  const listeners = new Set();

  function emit(evt) {
    for (const fn of listeners) {
      try { fn(evt); } catch (_) {}
    }
  }

  function onProgress(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  async function checkUrl(url) {
    const t0 = Date.now();
    try {
      const { response, buffer } = await safeFetch(url, {
        method: 'GET',
        timeoutMs: 8000,
        maxBytes: 512 * 1024,
        headers: { Range: 'bytes=0-65535' }
      });
      const latencyMs = Date.now() - t0;
      if (!response.ok && response.status !== 206) {
        return { state: 'dead', latencyMs, fail: true };
      }
      const head = buffer.slice(0, 64).toString('utf8');
      if (head.includes('#EXTM3U') || head.includes('#EXTINF') || head.includes('#EXT-X-') || buffer.length > 0) {
        return { state: 'live', latencyMs, fail: false };
      }
      return { state: 'unknown', latencyMs, fail: false };
    } catch {
      return { state: 'dead', latencyMs: Date.now() - t0, fail: true };
    }
  }

  function applyResult(channelId, sourceUrl, result) {
    const ch = library.get(channelId);
    if (!ch) return;
    const src = (ch.sources || []).find(s => s.url === sourceUrl);
    if (!src) return;
    if (!src.health) src.health = { state: 'unknown', lastChecked: null, latencyMs: null, failCount: 0 };
    src.health.lastChecked = new Date().toISOString();
    src.health.latencyMs = result.latencyMs;
    if (result.fail) {
      src.health.failCount = (src.health.failCount || 0) + 1;
      if (src.health.failCount >= 3) src.health.state = 'dead';
      else src.health.state = src.health.state === 'live' ? 'live' : 'unknown';
    } else {
      src.health.failCount = 0;
      src.health.state = result.state;
    }
  }

  function pump() {
    while (active < concurrency && queue.length) {
      const job = queue.shift();
      active++;
      (async () => {
        try {
          const result = await checkUrl(job.url);
          applyResult(job.channelId, job.url, result);
          emit({ type: 'check', channelId: job.channelId, url: job.url, ...result });
        } finally {
          active--;
          if (queue.length) pump();
          else if (active === 0) emit({ type: 'idle' });
        }
      })();
    }
  }

  function enqueue(channelId, url) {
    if (!url) return;
    if (queue.some(j => j.channelId === channelId && j.url === url)) return;
    queue.push({ channelId, url });
    pump();
  }

  function checkChannel(id) {
    const ch = library.get(id);
    if (!ch) return;
    for (const s of (ch.sources || []).slice(0, 3)) enqueue(ch.id, s.url);
  }

  function checkVisible(ids = []) {
    for (const id of ids.slice(0, 40)) checkChannel(id);
  }

  function checkAllStale() {
    const now = Date.now();
    for (const ch of library.all()) {
      const s = ch.sources && ch.sources[0];
      if (!s) continue;
      const last = s.health && s.health.lastChecked ? Date.parse(s.health.lastChecked) : 0;
      if (!last || now - last > ttlMs) enqueue(ch.id, s.url);
    }
  }

  return { enqueue, checkChannel, checkVisible, checkAllStale, onProgress, queueSize: () => queue.length };
}

module.exports = { createHealthChecker };
