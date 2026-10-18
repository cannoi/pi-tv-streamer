const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = path.join(__dirname, 'data');

const { safeFetch, assertSafeUrl } = require('./lib/net/safe-fetch');
const { adminAuth, securityHeaders, rateLimit } = require('./lib/net/admin-auth');
const { parseM3U } = require('./lib/iptv/m3u-parser');
const { createLibrary } = require('./lib/iptv/library');
const { createHealthChecker } = require('./lib/iptv/health');
const { createEnricher } = require('./lib/iptv/enrich');
const { findSources, loadSources, isAllowlistedUrl } = require('./lib/iptv/sources');

fs.mkdirSync(DATA_DIR, { recursive: true });
const library = createLibrary(DATA_DIR);
const health = createHealthChecker(library, { concurrency: 6 });
const enricher = createEnricher(DATA_DIR);

app.use(securityHeaders);
app.use(rateLimit({ windowMs: 60000, max: 180 }));
app.use(express.json({ limit: '4mb' }));
app.use(express.text({ type: ['text/*', 'application/x-mpegURL', 'application/vnd.apple.mpegurl'], limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- AI + Feedback (secrets only from env) ---
const adapter = require('./lib/app-adapter');
const { createAIService } = require('./lib/ai-module/ai-service');
const { mountAIRoutes } = require('./lib/ai-module/routes');
const { createFeedbackService, mountFeedbackRoutes } = require('./lib/feedback-module/feedback-service');

const ai = createAIService({ dataDir: DATA_DIR, appName: 'Pi Vintage TV', adapter });
// Protect AI settings write
const origMount = mountAIRoutes;
function mountAIRoutesProtected(appRef, aiRef) {
  origMount(appRef, aiRef);
  // re-wrap settings POST with admin if possible — routes already mounted; add gate via app middleware pattern
}
mountAIRoutes(app, ai);

const pkg = (() => { try { return require('./package.json'); } catch { return { version: '1.8.0' }; } })();
const fbOpts = {
  appId: process.env.SHFH_APP_ID || 'pi-vintage-tv',
  appName: process.env.SHFH_APP_NAME || 'Pi Vintage TV',
  version: pkg.version || '1.8.0'
};
if (process.env.SHFH_HUB_ID) fbOpts.hubId = process.env.SHFH_HUB_ID;
if (process.env.SHFH_HUB_URL) fbOpts.baseUrl = process.env.SHFH_HUB_URL;
if (process.env.SHFH_INGEST_TOKEN) fbOpts.ingestToken = process.env.SHFH_INGEST_TOKEN;
const fb = createFeedbackService(fbOpts);
mountFeedbackRoutes(app, fb);

// Gate sensitive routes
app.post('/api/ai/settings', adminAuth);
app.get('/api/logs', adminAuth);
app.delete('/api/logs', adminAuth);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', version: pkg.version, channels: library.stats().total });
});

// ---- Library API ----
app.get('/api/library/stats', (req, res) => {
  res.json({ ok: true, ...library.stats(), queue: health.queueSize() });
});

app.get('/api/library/channels', (req, res) => {
  const r = library.search({
    q: req.query.q,
    country: req.query.country,
    group: req.query.group,
    category: req.query.category,
    health: req.query.health,
    favorite: req.query.favorite === '1' || req.query.favorite === 'true',
    limit: req.query.limit,
    offset: req.query.offset
  });
  res.json({ ok: true, ...r });
});

app.get('/api/library/channels/:id', (req, res) => {
  const ch = library.get(req.params.id);
  if (!ch) return res.status(404).json({ ok: false, error: 'not_found' });
  res.json({ ok: true, channel: ch });
});

app.patch('/api/library/channels/:id', adminAuth, (req, res) => {
  const ch = library.update(req.params.id, req.body || {});
  if (!ch) return res.status(404).json({ ok: false, error: 'not_found' });
  res.json({ ok: true, channel: ch });
});

app.delete('/api/library/channels/:id', adminAuth, (req, res) => {
  const r = library.remove({ id: req.params.id });
  res.json({ ok: true, ...r });
});

app.get('/api/library/export.m3u', (req, res) => {
  const body = library.exportM3U({
    q: req.query.q,
    country: req.query.country,
    favorite: req.query.favorite === '1'
  });
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="pi-vintage-tv.m3u"');
  res.send(body);
});

app.post('/api/library/import', adminAuth, async (req, res) => {
  try {
    let text = '';
    const dryRun = !!(req.body && req.body.dryRun);
    const mode = (req.body && req.body.mode) || 'merge';

    if (req.body && req.body.text) {
      text = String(req.body.text);
    } else if (req.body && req.body.url) {
      const url = String(req.body.url).trim();
      await assertSafeUrl(url);
      const { buffer, response } = await safeFetch(url, { maxBytes: 20 * 1024 * 1024, timeoutMs: 20000 });
      if (!response.ok) return res.status(502).json({ ok: false, error: 'fetch_failed', status: response.status });
      text = buffer.toString('utf8');
    } else if (typeof req.body === 'string') {
      text = req.body;
    } else {
      return res.status(400).json({ ok: false, error: 'provide_text_or_url' });
    }

    const parsed = parseM3U(text);
    if (parsed.kind !== 'channel-list' || !parsed.channels.length) {
      return res.status(400).json({
        ok: false,
        error: 'not_channel_list',
        kind: parsed.kind,
        warnings: parsed.warnings
      });
    }

    if (dryRun) {
      return res.json({
        ok: true,
        dryRun: true,
        rawCount: parsed.rawCount,
        channelCount: parsed.channels.length,
        warnings: parsed.warnings,
        sample: parsed.channels.slice(0, 5).map(c => ({ name: c.name, tvgId: c.tvgId, sources: c.sources.length }))
      });
    }

    let toImport = parsed.channels;
    let enrichInfo = { enriched: 0, blocked: 0, nsfw: 0 };
    try {
      const er = await enricher.enrichList(parsed.channels, { hideNsfw: true });
      toImport = er.channels;
      enrichInfo = { enriched: er.enriched, blocked: er.blocked, nsfw: er.nsfw };
    } catch (e) {
      console.warn('enrich skipped', e.message);
    }
    const result = library.importChannels(toImport, { mode, importId: 'imp-' + Date.now() });
    for (const c of toImport.slice(0, 80)) {
      const id = require('./lib/iptv/library').stableId(c.tvgId, c.sources[0] && c.sources[0].url);
      if (c.sources[0]) health.enqueue(id, c.sources[0].url);
    }
    res.json({ ok: true, ...result, rawCount: parsed.rawCount, warnings: parsed.warnings, enrich: enrichInfo });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || 'import_failed' });
  }
});

app.post('/api/library/check', adminAuth, (req, res) => {
  const ids = (req.body && req.body.ids) || [];
  if (ids.length) health.checkVisible(ids);
  else health.checkAllStale();
  res.json({ ok: true, queued: health.queueSize() });
});

// SSE progress
app.get('/api/library/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  const send = (evt) => {
    res.write('data: ' + JSON.stringify(evt) + '\n\n');
  };
  send({ type: 'hello', stats: library.stats() });
  const off = health.onProgress(send);
  const iv = setInterval(() => res.write(': keepalive\n\n'), 25000);
  req.on('close', () => { off(); clearInterval(iv); });
});

// Sources catalog
app.get('/api/sources', (req, res) => {
  try {
    const p = path.join(DATA_DIR, 'sources.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    res.json({ ok: true, sources: j.sources || [] });
  } catch {
    res.json({ ok: true, sources: [] });
  }
});

// Legacy compatibility
app.get('/api/tv/channels', (req, res) => {
  const r = library.search({ limit: 500, offset: 0 });
  res.json(r.channels.map(c => ({
    id: c.id,
    name: c.name,
    category: c.group || c.country || 'IPTV',
    url: (c.sources && c.sources[0] && c.sources[0].url) || '',
    officialName: c.name
  })));
});

// Probe with safe-fetch
app.get('/api/probe-stream', async (req, res) => {
  const target = (req.query.url || '').trim();
  if (!target) return res.status(400).json({ ok: false, error: 'invalid_url' });
  try {
    await assertSafeUrl(target);
    const { response, buffer } = await safeFetch(target, {
      method: 'GET', timeoutMs: 8000, maxBytes: 256 * 1024,
      headers: { Range: 'bytes=0-1024' }
    });
    const ok = response.ok || response.status === 206;
    res.json({ ok, status: response.status, kind: target.includes('.m3u8') ? 'hls' : 'media', bytes: buffer.length });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// resolve-stream disabled by default (Phase 0)
app.get('/api/resolve-stream', (req, res) => {
  if (process.env.ENABLE_RESOLVE_STREAM === '1') {
    return res.status(501).json({ ok: false, error: 'not_implemented_use_library' });
  }
  res.status(403).json({ ok: false, error: 'resolve_stream_disabled', hint: 'Import M3U into library instead' });
});

// Minimal HLS proxy for library channels only
app.get('/api/proxy/hls', async (req, res) => {
  try {
    const u = (req.query.u || '').trim();
    const cid = (req.query.c || '').trim();
    if (!u || !cid) return res.status(400).json({ ok: false, error: 'missing_params' });
    const ch = library.get(cid);
    if (!ch) return res.status(404).json({ ok: false, error: 'channel_not_in_library' });
    const src = (ch.sources || []).find(s => s.url === u);
    if (!src) return res.status(404).json({ ok: false, error: 'source_not_in_channel' });
    await assertSafeUrl(u);
    const headers = {};
    if (src.headers && src.headers.referrer) headers.Referer = src.headers.referrer;
    if (src.headers && src.headers.userAgent) headers['User-Agent'] = src.headers.userAgent;
    const { response, buffer } = await safeFetch(u, { headers, maxBytes: 8 * 1024 * 1024, timeoutMs: 15000 });
    if (!response.ok && response.status !== 206) return res.status(502).send('upstream error');
    let body = buffer.toString('utf8');
    // Rewrite relative URIs in playlist to go through proxy
    if (body.includes('#EXTM3U')) {
      const base = u;
      body = body.replace(/^(?!#)(\S+)/gm, (line) => {
        if (!line || line.startsWith('#')) return line;
        try {
          const abs = new URL(line.trim(), base).href;
          return `/api/proxy/hls?c=${encodeURIComponent(cid)}&u=${encodeURIComponent(abs)}`;
        } catch { return line; }
      });
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(body);
    }
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.send(buffer);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});


// ---- AI / automation tools (server-side) ----
app.get('/api/tools/find_sources', (req, res) => {
  const list = findSources(DATA_DIR, req.query.q || req.query.query || '');
  res.json({
    ok: true,
    sources: list.map(s => ({ id: s.id, label: s.label, url: s.url, type: s.type, tags: s.tags || [] }))
  });
});

app.post('/api/tools/import_source', adminAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const dryRun = body.dryRun !== false && body.dryRun !== 0; // default true for safety unless explicit false
    const force = body.dryRun === false || body.confirm === true;
    let url = body.url || '';
    if (body.sourceId) {
      const src = loadSources(DATA_DIR).find(s => s.id === body.sourceId);
      if (!src) return res.status(404).json({ ok: false, error: 'source_not_found' });
      url = src.url;
    }
    if (!url) return res.status(400).json({ ok: false, error: 'url_or_sourceId_required' });
    if (!isAllowlistedUrl(url) && !body.userConfirmedExternal) {
      return res.status(400).json({ ok: false, error: 'url_not_allowlisted', hint: 'Pass userConfirmedExternal:true after user confirms' });
    }
    await assertSafeUrl(url);
    const { buffer, response } = await safeFetch(url, { maxBytes: 20 * 1024 * 1024, timeoutMs: 30000 });
    if (!response.ok) return res.status(502).json({ ok: false, error: 'fetch_failed', status: response.status });
    const parsed = parseM3U(buffer.toString('utf8'));
    if (parsed.kind !== 'channel-list' || !parsed.channels.length) {
      return res.status(400).json({ ok: false, error: 'not_channel_list', kind: parsed.kind });
    }
    let list = parsed.channels;
    // optional filter
    const f = body.filter || {};
    if (f.country) list = list.filter(c => (c.country || '') === String(f.country).toLowerCase());
    if (f.q) {
      const qq = String(f.q).toLowerCase();
      list = list.filter(c => (c.name || '').toLowerCase().includes(qq) || (c.group || '').toLowerCase().includes(qq));
    }
    let enrichInfo = {};
    try {
      const er = await enricher.enrichList(list, { hideNsfw: true });
      list = er.channels;
      enrichInfo = { enriched: er.enriched, blocked: er.blocked, nsfw: er.nsfw };
    } catch (_) {}

    if (!force) {
      return res.json({
        ok: true,
        dryRun: true,
        needsConfirmation: list.length > 50,
        rawCount: parsed.rawCount,
        channelCount: list.length,
        enrich: enrichInfo,
        sample: list.slice(0, 8).map(c => ({ name: c.name, tvgId: c.tvgId, logo: c.logo, categories: c.categories })),
        message: list.length > 50
          ? `Preview: ${list.length} channels. Confirm with dryRun:false or confirm:true to import.`
          : `Preview: ${list.length} channels.`
      });
    }
    const result = library.importChannels(list, { mode: body.mode || 'merge', importId: 'ai-' + Date.now() });
    for (const c of list.slice(0, 60)) {
      const id = require('./lib/iptv/library').stableId(c.tvgId, c.sources[0] && c.sources[0].url);
      if (c.sources[0]) health.enqueue(id, c.sources[0].url);
    }
    res.json({ ok: true, dryRun: false, ...result, rawCount: parsed.rawCount, channelCount: list.length, enrich: enrichInfo });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get('/api/tools/search_channels', (req, res) => {
  const r = library.search({
    q: req.query.q,
    country: req.query.country,
    category: req.query.category,
    limit: req.query.limit || 30
  });
  res.json({ ok: true, total: r.total, channels: r.channels.map(c => ({
    id: c.id, name: c.name, logo: c.logo, country: c.country,
    categories: c.categories, group: c.group, favorite: c.favorite,
    sources: (c.sources || []).length
  })) });
});

if (process.env.ENABLE_RADIO === '1') {
  try {
    require('./lib/modules/radio').mountRadioRoutes(app);
    console.log('Radio module enabled');
  } catch (e) { console.warn(e.message); }
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pi Vintage TV ${pkg.version} on :${PORT} · library=${library.stats().total} channels`);
});
module.exports = server;
