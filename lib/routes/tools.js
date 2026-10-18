const { findSources, loadSources, isAllowlistedUrl } = require('../iptv/sources');
const { parseM3U } = require('../iptv/m3u-parser');
const { safeFetch, assertSafeUrl } = require('../net/safe-fetch');
const { applyAutoCategories } = require('../iptv/categorize');
const { smartImport } = require('../iptv/smart-import');
const { searchGithubPlaylists } = require('../iptv/github-search');
const { getAccessInfo } = require('../net/access-info');

function mountToolRoutes(app, { library, health, enricher, dataDir }) {
  app.get('/api/app/access', (req, res) => {
    res.json({ ok: true, ...getAccessInfo(req) });
  });

  app.get('/api/tools/find_sources', (req, res) => {
    const list = findSources(dataDir, req.query.q || req.query.query || '');
    res.json({ ok: true, sources: list.map(s => ({ id: s.id, label: s.label, url: s.url, tags: s.tags || [] })) });
  });

  app.get('/api/tools/search_channels', (req, res) => {
    const r = library.search({ q: req.query.q, country: req.query.country, category: req.query.category, limit: req.query.limit || 30 });
    res.json({
      ok: true, total: r.total,
      channels: r.channels.map(c => ({
        id: c.id, name: c.name, logo: c.logo, country: c.country,
        categories: c.categories, group: c.group, favorite: c.favorite,
        sources: (c.sources || []).length
      }))
    });
  });

  app.get('/api/tools/github_search', async (req, res) => {
    if (process.env.ENABLE_GITHUB_SEARCH !== '1') {
      return res.json({ ok: false, error: 'github_search_disabled', items: [], hint: 'Set ENABLE_GITHUB_SEARCH=1' });
    }
    const result = await searchGithubPlaylists(req.query.q || '', { token: process.env.GITHUB_TOKEN, limit: 8 });
    res.json(result);
  });

  app.post('/api/tools/smart_import', async (req, res) => {
    try {
      const query = (req.body && (req.body.query || req.body.q || req.body.message)) || '';
      const confirm = !!(req.body && (req.body.confirm === true || req.body.dryRun === false));
      const result = await smartImport({
        query, library, enricher, health, dataDir,
        includeGithub: !!(req.body && req.body.includeGithub) && process.env.ENABLE_GITHUB_SEARCH === '1',
        confirm
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/tools/import_source', async (req, res) => {
    try {
      const body = req.body || {};
      const force = body.dryRun === false || body.confirm === true;
      let url = body.url || '';
      if (body.sourceId) {
        const src = loadSources(dataDir).find(s => s.id === body.sourceId);
        if (!src) return res.status(404).json({ ok: false, error: 'source_not_found' });
        url = src.url;
      }
      if (!url) return res.status(400).json({ ok: false, error: 'url_or_sourceId_required' });
      if (!isAllowlistedUrl(url) && !body.userConfirmedExternal) {
        return res.status(400).json({ ok: false, error: 'url_not_allowlisted' });
      }
      await assertSafeUrl(url);
      const { buffer, response } = await safeFetch(url, { maxBytes: 20 * 1024 * 1024, timeoutMs: 30000 });
      if (!response.ok) return res.status(502).json({ ok: false, error: 'fetch_failed' });
      const parsed = parseM3U(buffer.toString('utf8'));
      if (parsed.kind !== 'channel-list' || !parsed.channels.length) {
        return res.status(400).json({ ok: false, error: 'not_channel_list' });
      }
      let list = applyAutoCategories(parsed.channels);
      if (enricher) {
        try {
          const er = await enricher.enrichList(list, { hideNsfw: true });
          list = applyAutoCategories(er.channels);
        } catch (_) {}
      }
      if (!force) {
        return res.json({
          ok: true, dryRun: true, needsConfirmation: list.length > 50,
          rawCount: parsed.rawCount, channelCount: list.length,
          sample: list.slice(0, 8).map(c => ({ name: c.name, group: c.group }))
        });
      }
      const result = library.importChannels(list, { mode: body.mode || 'merge', importId: 'ai-' + Date.now() });
      for (const c of list.slice(0, 60)) {
        const id = require('../iptv/library').stableId(c.tvgId, c.sources[0] && c.sources[0].url);
        if (c.sources[0]) health.enqueue(id, c.sources[0].url);
      }
      res.json({ ok: true, dryRun: false, ...result, channelCount: list.length });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { mountToolRoutes };
