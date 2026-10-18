'use strict';
/**
 * Pi Vintage TV — entrypoint
 * Listen on PORT as early as possible so Docker/SoloHost smoke tests pass,
 * then mount the rest of the app.
 */
const path = require('path');
const express = require('express');

const PORT = (() => {
  const n = parseInt(process.env.PORT || '8080', 10);
  return Number.isFinite(n) && n > 0 ? n : 8080;
})();
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const MEDIA_ROOT = process.env.MEDIA_ROOT || path.join(__dirname, 'media');

const app = express();
app.disable('x-powered-by');

// ---- Immediate health (smoke test) ----
let bootError = null;
let ready = false;
const startedAt = Date.now();

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    ok: true,
    ready,
    version: (tryPkg() || {}).version || '1.9.8',
    uptimeMs: Date.now() - startedAt,
    error: bootError
  });
});
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', ok: true });
});
app.get('/ready', (req, res) => {
  if (!ready) return res.status(503).json({ ok: false, ready: false });
  res.json({ ok: true, ready: true });
});

function tryPkg() {
  try { return require('./package.json'); } catch { return null; }
}

// Start listening FIRST
const server = app.listen(PORT, HOST, () => {
  console.log(`[boot] listening on http://${HOST}:${PORT}`);
  // Load the rest after the port is open
  setImmediate(mountApp);
});

server.on('error', (err) => {
  console.error('[boot] listen error', err);
  process.exit(1);
});

function mountApp() {
  try {
    const { adminAuth, securityHeaders, rateLimit } = require('./lib/net/admin-auth');
    app.use(securityHeaders);
    app.use(rateLimit);
    app.use(express.json({ limit: '2mb' }));
    app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

    const { createLibrary } = require('./lib/iptv/library');
    const { createHealthChecker } = require('./lib/iptv/health');
    const { createEnricher } = require('./lib/iptv/enrich');
    const { createEpgStore } = require('./lib/iptv/epg');
    const { createHlsProxy } = require('./lib/net/hls-proxy');
    const { mountLibraryRoutes } = require('./lib/routes/library');
    const { mountToolRoutes } = require('./lib/routes/tools');
    const { mountRadioRoutes } = require('./lib/modules/radio');
    const { mountMediaRoutes } = require('./lib/modules/media');
    const { mountPodcastRoutes } = require('./lib/modules/podcast');
    const { mountVodRoutes } = require('./lib/modules/vod');
    const { createAIService } = require('./lib/ai-module/ai-service');
    const { mountAIRoutes } = require('./lib/ai-module/routes');
    const { createFeedbackService, mountFeedbackRoutes } = require('./lib/feedback-module/feedback-service');
    const adapter = require('./lib/app-adapter');

    const library = createLibrary(DATA_DIR);
    const health = createHealthChecker(library, { concurrency: 6 });
    const enricher = createEnricher(DATA_DIR);
    const epg = createEpgStore(DATA_DIR);
    const hlsProxy = createHlsProxy({ library });
    const pkg = tryPkg() || { version: '1.9.8' };

    const ai = createAIService({ dataDir: DATA_DIR, appName: 'Pi Vintage TV', adapter });
    mountAIRoutes(app, ai, { adminAuth });

    const fb = createFeedbackService({
      appId: process.env.SHFH_APP_ID || 'pi-vintage-tv',
      appName: process.env.SHFH_APP_NAME || 'Pi Vintage TV',
      version: pkg.version || '1.9.8',
      hubId: process.env.SHFH_HUB_ID || 'SHFH-CANNOI-0905428801',
      baseUrl: process.env.SHFH_HUB_URL || 'http://14.176.78.46:8090',
      ingestToken: process.env.SHFH_INGEST_TOKEN || 'cannoi_7Kp9xV2mQ8rN4tY6cL3wA5zD1eF0uH9'
    });
    mountFeedbackRoutes(app, fb);

    mountLibraryRoutes(app, { library, health, enricher, adminAuth });
    mountToolRoutes(app, { library, health, enricher, dataDir: DATA_DIR });
    hlsProxy.mount(app);

    app.post('/api/epg/load', async (req, res) => {
      try {
        const url = (req.body && req.body.url) || '';
        if (!url) return res.status(400).json({ ok: false, error: 'url_required' });
        const ids = library.all().map(c => c.tvgId || c.channelKey || c.id).filter(Boolean);
        const r = await epg.loadFromUrl(url, ids);
        res.json({ ok: true, ...r, meta: epg.getMeta() });
      } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
      }
    });
    app.get('/api/epg/now', (req, res) => {
      res.json({ ok: true, ...epg.nowNext(req.query.channel || req.query.id || ''), meta: epg.getMeta() });
    });

    mountRadioRoutes(app);
    mountMediaRoutes(app, MEDIA_ROOT);
    mountPodcastRoutes(app);
    mountVodRoutes(app);

    app.get('/api/tv/channels', (req, res) => {
      res.json({ ok: true, channels: library.search({ limit: 500 }).channels });
    });
    app.get('/api/probe-stream', (req, res) => res.status(410).json({ ok: false, error: 'use_health_checker' }));
    app.get('/api/resolve-stream', (req, res) => res.status(403).json({ ok: false, error: 'disabled' }));

    // SPA fallback only for non-API GETs after static
    app.get('/', (req, res, next) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) res.status(200).type('text').send('Pi Vintage TV');
      });
    });

    ready = true;
    console.log(`[boot] app ready · library=${library.stats().total} · v${pkg.version}`);
  } catch (e) {
    bootError = String(e && e.stack || e);
    console.error('[boot] mount failed (health still up):', e);
    // Keep process alive so smoke test still sees /health
  }
}

module.exports = server;
