const path = require('path');
const express = require('express');
const { adminAuth, securityHeaders, rateLimit } = require('./lib/net/admin-auth');
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

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const MEDIA_ROOT = process.env.MEDIA_ROOT || path.join(__dirname, 'media');
const PORT = Number(process.env.PORT || 8080);

const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(rateLimit);
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const library = createLibrary(DATA_DIR);
const health = createHealthChecker(library, { concurrency: 6 });
const enricher = createEnricher(DATA_DIR);
const epg = createEpgStore(DATA_DIR);
const hlsProxy = createHlsProxy({ library });

const pkg = (() => { try { return require('./package.json'); } catch { return { version: '1.9.5' }; } })();

const ai = createAIService({ dataDir: DATA_DIR, appName: 'Pi Vintage TV', adapter });
mountAIRoutes(app, ai, { adminAuth });

const fbOpts = {
  appId: process.env.SHFH_APP_ID || 'pi-vintage-tv',
  appName: process.env.SHFH_APP_NAME || 'Pi Vintage TV',
  version: pkg.version || '1.9.5'
};
if (process.env.SHFH_HUB_ID) fbOpts.hubId = process.env.SHFH_HUB_ID;
if (process.env.SHFH_HUB_URL) fbOpts.baseUrl = process.env.SHFH_HUB_URL;
if (process.env.SHFH_INGEST_TOKEN) fbOpts.ingestToken = process.env.SHFH_INGEST_TOKEN;
const fb = createFeedbackService(fbOpts);
if (process.env.ENABLE_FEEDBACK === '1') mountFeedbackRoutes(app, fb);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', version: pkg.version, channels: library.stats().total });
});

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

// legacy stubs
app.get('/api/tv/channels', (req, res) => res.json({ ok: true, channels: library.search({ limit: 500 }).channels }));
app.get('/api/probe-stream', (req, res) => res.status(410).json({ ok: false, error: 'use_health_checker' }));
app.get('/api/resolve-stream', (req, res) => res.status(403).json({ ok: false, error: 'disabled' }));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pi Vintage TV ${pkg.version} on :${PORT} · library=${library.stats().total}`);
});
module.exports = server;
