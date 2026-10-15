const express = require('express');
const path = require('path');
const app = express();
const PORT = Number(process.env.PORT || 8080);

let OFFICIAL_TV_CHANNELS = [];
try {
  OFFICIAL_TV_CHANNELS = require('./public/tv-channels.js');
} catch (e) {
  OFFICIAL_TV_CHANNELS = [];
}

app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Universal AI + Feedback (SoloHost) ---
const adapter = require('./lib/app-adapter');
const { createAIService } = require('./lib/ai-module/ai-service');
const { mountAIRoutes } = require('./lib/ai-module/routes');
const { createFeedbackService, mountFeedbackRoutes } = require('./lib/feedback-module/feedback-service');

const ai = createAIService({
  dataDir: path.join(__dirname, 'data'),
  appName: 'Pi Vintage TV',
  adapter
});
mountAIRoutes(app, ai);

const pkg = (() => {
  try { return require('./package.json'); } catch (e) { return { version: '1.7.0' }; }
})();

const fb = createFeedbackService({
  appId: 'pi-vintage-tv',
  appName: 'Pi Vintage TV',
  version: pkg.version || '1.7.0',
  // SoloHost Feedback Hub (baked-in; not exposed to browser as ingest token)
  hubId: process.env.SHFH_HUB_ID || 'SHFH-CANNOI-0905428801',
  baseUrl: process.env.SHFH_HUB_URL || 'http://14.176.78.46:8090',
  ingestToken: process.env.SHFH_INGEST_TOKEN || 'cannoi_7Kp9xV2mQ8rN4tY6cL3wA5zD1eF0uH9'
});
mountFeedbackRoutes(app, fb);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/tv/channels', (req, res) => {
  res.status(200).json(OFFICIAL_TV_CHANNELS);
});

app.get('/api/tv/status/:id', async (req, res) => {
  const channel = Array.isArray(OFFICIAL_TV_CHANNELS)
    ? OFFICIAL_TV_CHANNELS.find(c => c.id === req.params.id)
    : null;
  if (!channel) return res.status(404).json({ id: req.params.id, state: 'NOT_FOUND' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    let resp = await fetch(channel.sourceUrl, {
      method: 'HEAD', redirect: 'follow', signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 PiVintageTV/1.7' }
    });
    if (!resp.ok && resp.status !== 405) {
      resp = await fetch(channel.sourceUrl, {
        method: 'GET', redirect: 'follow', signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 PiVintageTV/1.7' }
      });
    }
    clearTimeout(timeout);
    return res.status(200).json({ id: channel.id, state: resp.ok ? 'AVAILABLE' : 'SOURCE_UNAVAILABLE' });
  } catch (err) {
    clearTimeout(timeout);
    return res.status(200).json({ id: channel.id, state: 'NETWORK_ERROR' });
  }
});

app.get('/api/resolve-stream', async (req, res) => {
  const target = (req.query.url || '').trim();
  if (!target || !/^https?:\/\//i.test(target)) {
    return res.status(400).json({ ok: false, error: 'invalid_url' });
  }
  try {
    const u = new URL(target);
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') ||
        host.startsWith('10.') || host.startsWith('192.168.') || host === '0.0.0.0' ||
        host === '169.254.169.254') {
      return res.status(400).json({ ok: false, error: 'blocked_host' });
    }
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'invalid_url' });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(target, {
      method: 'GET', redirect: 'follow', signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json,*/*'
      }
    });
    clearTimeout(timeout);
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    const text = await resp.text();
    if (target.includes('.m3u8') || ct.includes('mpegurl') || ct.includes('x-mpegURL')) {
      return res.status(200).json({ ok: true, streams: [target], source: 'direct' });
    }
    const found = new Set();
    const reAbs = /https?:\/\/[^\s"'<>]+?\.m3u8[^\s"'<>]*/gi;
    let m;
    while ((m = reAbs.exec(text)) !== null) found.add(m[0].replace(/[),;]+$/, ''));
    const reJson = /["'](?:file|url|src|source|playbackUrl|stream)["']\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi;
    while ((m = reJson.exec(text)) !== null) found.add(m[1]);
    return res.status(200).json({ ok: found.size > 0, streams: Array.from(found).slice(0, 8), source: 'page_scan', status: resp.status });
  } catch (err) {
    clearTimeout(timeout);
    return res.status(200).json({ ok: false, error: err.name === 'AbortError' ? 'timeout' : 'fetch_failed', streams: [] });
  }
});

app.get('/api/probe-stream', async (req, res) => {
  const target = (req.query.url || '').trim();
  if (!target || !/^https?:\/\//i.test(target)) {
    return res.status(400).json({ ok: false, error: 'invalid_url' });
  }
  if (target === 'STATIC') return res.json({ ok: true, kind: 'static' });
  if (target.startsWith('OFFICIAL:')) return res.json({ ok: true, kind: 'official', note: 'page_link' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    let resp = await fetch(target, {
      method: 'HEAD', redirect: 'follow', signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 PiVintageTV/1.7' }
    });
    if (resp.status === 405 || resp.status === 501 || resp.status === 403) {
      resp = await fetch(target, {
        method: 'GET', redirect: 'follow', signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 PiVintageTV/1.7', 'Range': 'bytes=0-512' }
      });
    }
    clearTimeout(timeout);
    const ok = resp.ok || resp.status === 206;
    return res.status(200).json({ ok, status: resp.status, kind: target.includes('.m3u8') ? 'hls' : 'media' });
  } catch (err) {
    clearTimeout(timeout);
    return res.status(200).json({ ok: false, error: err.name === 'AbortError' ? 'timeout' : 'fetch_failed' });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pi Vintage TV running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use.`);
  else console.error(err);
});

module.exports = server;
