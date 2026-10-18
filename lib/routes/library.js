const { parseM3U } = require('../iptv/m3u-parser');
const { safeFetch, assertSafeUrl } = require('../net/safe-fetch');
const { applyAutoCategories } = require('../iptv/categorize');

function mountLibraryRoutes(app, { library, health, enricher, adminAuth }) {
  app.get('/api/library/stats', (req, res) => {
    res.json({ ok: true, ...library.stats(), queue: health.queueSize() });
  });
  app.get('/api/library/channels', (req, res) => {
    res.json({ ok: true, ...library.search(req.query) });
  });
  app.get('/api/library/channels/:id', (req, res) => {
    const ch = library.get(req.params.id);
    if (!ch) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, channel: ch });
  });
  app.patch('/api/library/channels/:id', (req, res) => {
    const ch = library.update(req.params.id, req.body || {});
    if (!ch) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, channel: ch });
  });
  app.delete('/api/library/channels/:id', (req, res) => {
    res.json({ ok: true, ...library.remove({ id: req.params.id }) });
  });
  app.get('/api/library/export.m3u', (req, res) => {
    const body = library.exportM3U(req.query);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pi-vintage-tv.m3u"');
    res.send(body);
  });

  app.post('/api/library/import', async (req, res) => {
    try {
      const body = req.body || {};
      const dryRun = !!body.dryRun;
      const mode = body.mode === 'replace' ? 'replace' : 'merge';
      let text = body.text || '';
      if (!text && body.url) {
        await assertSafeUrl(body.url);
        const { buffer, response } = await safeFetch(body.url, { maxBytes: 20 * 1024 * 1024, timeoutMs: 30000 });
        if (!response.ok) return res.status(502).json({ ok: false, error: 'fetch_failed' });
        text = buffer.toString('utf8');
      }
      if (!text) return res.status(400).json({ ok: false, error: 'text_or_url_required' });
      const parsed = parseM3U(text);
      if (parsed.kind !== 'channel-list') {
        return res.status(400).json({ ok: false, error: 'not_channel_list', kind: parsed.kind });
      }
      let list = parsed.channels;
      let enrichInfo = {};
      if (enricher) {
        try {
          const er = await enricher.enrichList(list, { hideNsfw: true });
          list = er.channels;
          enrichInfo = { enriched: er.enriched, blocked: er.blocked, nsfw: er.nsfw };
        } catch (_) {}
      }
      list = applyAutoCategories(list);
      if (dryRun) {
        return res.json({
          ok: true, dryRun: true, rawCount: parsed.rawCount, channelCount: list.length,
          warnings: parsed.warnings, enrich: enrichInfo,
          sample: list.slice(0, 10).map(c => ({ name: c.name, group: c.group, tvgId: c.tvgId }))
        });
      }
      const result = library.importChannels(list, { mode, importId: 'imp-' + Date.now() });
      for (const c of list.slice(0, 80)) {
        const id = require('../iptv/library').stableId(c.tvgId, c.sources[0] && c.sources[0].url);
        if (c.sources[0]) health.enqueue(id, c.sources[0].url);
      }
      res.json({ ok: true, ...result, rawCount: parsed.rawCount, warnings: parsed.warnings, enrich: enrichInfo });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message || 'import_failed' });
    }
  });
}

module.exports = { mountLibraryRoutes };
