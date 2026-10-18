const crypto = require('crypto');
const { URL } = require('url');
const { safeFetch, assertSafeUrl } = require('./safe-fetch');

function createHlsProxy({ library, secret }) {
  const SECRET = secret || process.env.PROXY_HMAC_SECRET || crypto.randomBytes(16).toString('hex');

  function sign(url, exp) {
    const payload = `${exp}.${url}`;
    const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 32);
    return sig;
  }

  function verify(url, exp, sig) {
    if (!exp || !sig) return false;
    if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
    const expect = sign(url, exp);
    try {
      return crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(String(sig)));
    } catch { return false; }
  }

  function proxyUrl(absUrl, ttlSec = 300) {
    const exp = Math.floor(Date.now() / 1000) + ttlSec;
    const sig = sign(absUrl, exp);
    return `/api/proxy/hls?u=${encodeURIComponent(absUrl)}&exp=${exp}&sig=${sig}`;
  }

  function rewritePlaylist(body, baseUrl) {
    const lines = String(body).split(/\r?\n/);
    const out = [];
    for (const line of lines) {
      if (!line) { out.push(line); continue; }
      if (line.startsWith('#')) {
        // Rewrite URI="..." in EXT-X-KEY / MAP / MEDIA / SESSION-KEY
        const rewritten = line.replace(/URI="([^"]+)"/gi, (_, uri) => {
          try {
            const abs = new URL(uri, baseUrl).href;
            return `URI="${proxyUrl(abs)}"`;
          } catch { return `URI="${uri}"`; }
        });
        out.push(rewritten);
        continue;
      }
      try {
        const abs = new URL(line.trim(), baseUrl).href;
        out.push(proxyUrl(abs));
      } catch {
        out.push(line);
      }
    }
    return out.join('\n');
  }

  function mount(app) {
    app.get('/api/proxy/hls', async (req, res) => {
      try {
        const u = String(req.query.u || '').trim();
        const cid = String(req.query.c || '').trim();
        const exp = req.query.exp;
        const sig = req.query.sig;
        if (!u) return res.status(400).json({ ok: false, error: 'missing_url' });

        // Entry: channel source must be in library OR valid signed token
        let allowed = verify(u, exp, sig);
        if (!allowed && cid) {
          const ch = library.get(cid);
          if (ch && (ch.sources || []).some(s => s.url === u)) allowed = true;
        }
        if (!allowed) return res.status(403).json({ ok: false, error: 'forbidden' });

        await assertSafeUrl(u);
        const { response, buffer } = await safeFetch(u, { maxBytes: 12 * 1024 * 1024, timeoutMs: 20000 });
        if (!response.ok && response.status !== 206) return res.status(502).send('upstream');

        const text = buffer.toString('utf8');
        if (text.startsWith('#EXTM3U')) {
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.setHeader('Cache-Control', 'no-store');
          return res.send(rewritePlaylist(text, u));
        }
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        res.send(buffer);
      } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
      }
    });
  }

  return { mount, proxyUrl, verify };
}

module.exports = { createHlsProxy };
