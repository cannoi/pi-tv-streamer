const { safeFetch } = require('../net/safe-fetch');

function parseRssItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null && items.length < 50) {
    const b = m[1];
    const title = ((b.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>/i) || b.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '').trim();
    const encl = (b.match(/url="(https?:\/\/[^"]+)"/i) || [])[1]
      || ((b.match(/<enclosure[^>]+url=["']([^"']+)["']/i) || [])[1]);
    if (title && encl) items.push({ title, url: encl });
  }
  return items;
}

function mountPodcastRoutes(app) {
  app.get('/api/podcast/feed', async (req, res) => {
    try {
      const url = String(req.query.url || '').trim();
      if (!/^https?:\/\//i.test(url)) return res.status(400).json({ ok: false, error: 'bad_url' });
      const { buffer, response } = await safeFetch(url, { maxBytes: 5 * 1024 * 1024, timeoutMs: 20000 });
      if (!response.ok) return res.status(502).json({ ok: false });
      const items = parseRssItems(buffer.toString('utf8'));
      res.json({ ok: true, items });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { mountPodcastRoutes, parseRssItems };
