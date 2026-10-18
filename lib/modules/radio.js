/**
 * Optional radio helper — Radio Browser API (public).
 * Not mounted in Retro UI by default; enable via ENABLE_RADIO=1
 */
const { safeFetch } = require('../net/safe-fetch');

function mountRadioRoutes(app) {
  app.get('/api/radio/search', async (req, res) => {
    try {
      const q = encodeURIComponent(String(req.query.q || 'vietnam').slice(0, 80));
      const url = `https://de1.api.radio-browser.info/json/stations/search?name=${q}&limit=20&hidebroken=true`;
      const { buffer, response } = await safeFetch(url, { timeoutMs: 12000, maxBytes: 2 * 1024 * 1024 });
      if (!response.ok) return res.status(502).json({ ok: false });
      const data = JSON.parse(buffer.toString('utf8'));
      res.json({
        ok: true,
        stations: (data || []).map(s => ({
          name: s.name,
          url: s.url_resolved || s.url,
          country: s.country,
          favicon: s.favicon,
          tags: s.tags
        }))
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { mountRadioRoutes };
