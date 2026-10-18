const { safeFetch } = require('../net/safe-fetch');

function mountVodRoutes(app) {
  app.get('/api/vod/search', async (req, res) => {
    try {
      const q = String(req.query.q || 'feature films').slice(0, 80);
      // Internet Archive advanced search — public metadata API
      const url = 'https://archive.org/advancedsearch.php?q=' +
        encodeURIComponent(`(${q}) AND mediatype:(movies)`) +
        '&fl[]=identifier&fl[]=title&fl[]=description&fl[]=year&sort[]=downloads+desc&rows=15&page=1&output=json';
      const { buffer, response } = await safeFetch(url, { maxBytes: 2 * 1024 * 1024, timeoutMs: 15000 });
      if (!response.ok) return res.status(502).json({ ok: false });
      const data = JSON.parse(buffer.toString('utf8'));
      const docs = (((data || {}).response) || {}).docs || [];
      res.json({
        ok: true,
        items: docs.map(d => ({
          id: d.identifier,
          title: d.title,
          year: d.year,
          description: (d.description || '').toString().slice(0, 200),
          page: 'https://archive.org/details/' + d.identifier
        }))
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { mountVodRoutes };
