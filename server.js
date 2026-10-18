'use strict';
/**
 * Pi Vintage TV — entrypoint
 * - Static UI + /health available immediately (Docker smoke + browser UI)
 * - API modules mount right after listen
 */
const path = require('path');
const express = require('express');
const { adminAuth, securityHeaders, rateLimit } = require('./lib/net/admin-auth');

const PORT = (() => {
  const n = parseInt(process.env.PORT || '8080', 10);
  return Number.isFinite(n) && n > 0 ? n : 8080;
})();
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const MEDIA_ROOT = process.env.MEDIA_ROOT || path.join(__dirname, 'media');
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();
app.disable('x-powered-by');

let bootError = null;
let ready = false;
const startedAt = Date.now();

function tryPkg() {
  try { return require('./package.json'); } catch { return { version: '1.9.9' }; }
}

// ---- Always-on middleware (must call next) ----
app.use(securityHeaders);
// Rate-limit API only — never block CSS/JS/HTML
app.use('/api', rateLimit({ windowMs: 60000, max: 180 }));
app.use(express.json({ limit: '2mb' }));

// ---- Static UI first (fixes blank UI when API mount is slow/fails) ----
app.use(express.static(PUBLIC_DIR, { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0, index: 'index.html' }));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    ok: true,
    ready,
    version: tryPkg().version || '1.9.9',
    uptimeMs: Date.now() - startedAt,
    error: bootError
  });
});
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', ok: true }));
app.get('/ready', (req, res) => {
  if (!ready) return res.status(503).json({ ok: false, ready: false });
  res.json({ ok: true, ready: true });
});

// Explicit home page
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), (err) => {
    if (err) {
      console.error('index.html missing', err.message);
      res.status(500).type('text').send('UI missing: public/index.html not found');
    }
  });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[boot] UI+health on http://${HOST}:${PORT}`);
  setImmediate(mountApi);
});

server.on('error', (err) => {
  console.error('[boot] listen error', err);
  process.exit(1);
});

function mountApi() {
  try {
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
    const healthChk = createHealthChecker(library, { concurrency: 6 });
    const enricher = createEnricher(DATA_DIR);
    const epg = createEpgStore(DATA_DIR);
    const hlsProxy = createHlsProxy({ library });
    const pkg = tryPkg();

    const ai = createAIService({ dataDir: DATA_DIR, appName: 'Pi Vintage TV', adapter });
    mountAIRoutes(app, ai, { adminAuth });

    mountFeedbackRoutes(app, createFeedbackService({
      appId: process.env.SHFH_APP_ID || 'pi-vintage-tv',
      appName: process.env.SHFH_APP_NAME || 'Pi Vintage TV',
      version: pkg.version || '1.9.9',
      hubId: process.env.SHFH_HUB_ID || 'SHFH-CANNOI-0905428801',
      baseUrl: process.env.SHFH_HUB_URL || 'http://14.176.78.46:8090',
      ingestToken: process.env.SHFH_INGEST_TOKEN || 'cannoi_7Kp9xV2mQ8rN4tY6cL3wA5zD1eF0uH9'
    }));

    mountLibraryRoutes(app, { library, health: healthChk, enricher, adminAuth });
    mountToolRoutes(app, { library, health: healthChk, enricher, dataDir: DATA_DIR });
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

    ready = true;
    console.log(`[boot] API ready · library=${library.stats().total} · v${pkg.version}`);
  } catch (e) {
    bootError = String(e && e.stack || e);
    console.error('[boot] API mount failed (UI static still served):', e);
  }
}

module.exports = server;
