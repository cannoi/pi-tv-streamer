const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

let OFFICIAL_TV_CHANNELS = [];
try {
  OFFICIAL_TV_CHANNELS = require('./public/tv-channels.js');
} catch (e) {
  OFFICIAL_TV_CHANNELS = [];
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '32kb' }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/tv/channels', (req, res) => {
  res.status(200).json(OFFICIAL_TV_CHANNELS);
});

app.get('/api/tv/status/:id', async (req, res) => {
  const channel = Array.isArray(OFFICIAL_TV_CHANNELS)
    ? OFFICIAL_TV_CHANNELS.find(c => c.id === req.params.id)
    : null;
  if (!channel) {
    return res.status(404).json({ id: req.params.id, state: 'NOT_FOUND' });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    let resp = await fetch(channel.sourceUrl, {
      method: 'HEAD', redirect: 'follow', signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 PiVintageTV/1.6' }
    });
    if (!resp.ok && resp.status !== 405) {
      resp = await fetch(channel.sourceUrl, {
        method: 'GET', redirect: 'follow', signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 PiVintageTV/1.6' }
      });
    }
    clearTimeout(timeout);
    return res.status(200).json({
      id: channel.id,
      state: resp.ok ? 'AVAILABLE' : 'SOURCE_UNAVAILABLE'
    });
  } catch (err) {
    clearTimeout(timeout);
    return res.status(200).json({ id: channel.id, state: 'NETWORK_ERROR' });
  }
});

/**
 * Try to find .m3u8 (and similar stream) URLs in a public page.
 * Does not proxy video bytes — only returns discovered stream URLs.
 */
app.get('/api/resolve-stream', async (req, res) => {
  const target = (req.query.url || '').trim();
  if (!target || !/^https?:\/\//i.test(target)) {
    return res.status(400).json({ ok: false, error: 'invalid_url' });
  }
  // Block obvious SSRF to local/metadata
  try {
    const u = new URL(target);
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') ||
        host.startsWith('10.') || host.startsWith('192.168.') || host === '0.0.0.0' ||
        host === '169.254.169.254' || host.startsWith('172.')) {
      return res.status(400).json({ ok: false, error: 'blocked_host' });
    }
  } catch (e) {
    return res.status(400).json({ ok: false, error: 'invalid_url' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json,*/*'
      }
    });
    clearTimeout(timeout);
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    const text = await resp.text();

    // If the URL itself is already a playlist
    if (target.includes('.m3u8') || ct.includes('mpegurl') || ct.includes('x-mpegURL')) {
      return res.status(200).json({ ok: true, streams: [target], source: 'direct' });
    }

    const found = new Set();
    // Quoted absolute/relative m3u8
    const reAbs = /https?:\/\/[^\s"'<>]+?\.m3u8[^\s"'<>]*/gi;
    let m;
    while ((m = reAbs.exec(text)) !== null) {
      found.add(m[0].replace(/[),;]+$/, ''));
    }
    // JSON-ish file/url fields
    const reJson = /["'](?:file|url|src|source|playbackUrl|stream)["']\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi;
    while ((m = reJson.exec(text)) !== null) {
      found.add(m[1]);
    }
    // Relative .m3u8
    const reRel = /["']([^"']+\.m3u8[^"']*)["']/gi;
    while ((m = reRel.exec(text)) !== null) {
      try {
        const abs = new URL(m[1], target).href;
        if (abs.includes('.m3u8')) found.add(abs);
      } catch (e) {}
    }

    const streams = Array.from(found).slice(0, 8);
    return res.status(200).json({
      ok: streams.length > 0,
      streams,
      source: 'page_scan',
      status: resp.status
    });
  } catch (err) {
    clearTimeout(timeout);
    return res.status(200).json({
      ok: false,
      error: err.name === 'AbortError' ? 'timeout' : 'fetch_failed',
      streams: []
    });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pi TV Streamer running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error(err);
  }
});

module.exports = server;
