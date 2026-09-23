const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;
const OFFICIAL_TV_CHANNELS = require('./public/tv-channels.js');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// --- TV module: official-source registry + lightweight reachability check ---
// This never fetches, proxies, or caches video. It only checks whether the
// OFFICIAL broadcaster page itself is reachable, for UI status display.
app.get('/api/tv/channels', (req, res) => {
  res.status(200).json(OFFICIAL_TV_CHANNELS);
});

app.get('/api/tv/status/:id', async (req, res) => {
  const channel = OFFICIAL_TV_CHANNELS.find(c => c.id === req.params.id);
  if (!channel) {
    return res.status(404).json({ id: req.params.id, state: 'NOT_FOUND' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    let resp = await fetch(channel.sourceUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });
    // Some sites reject HEAD; fall back to a bounded GET without reading the body.
    if (!resp.ok && resp.status !== 405) {
      resp = await fetch(channel.sourceUrl, { method: 'GET', redirect: 'follow', signal: controller.signal });
    }
    clearTimeout(timeout);

    if (resp.ok) {
      return res.status(200).json({ id: channel.id, state: 'AVAILABLE' });
    }
    return res.status(200).json({ id: channel.id, state: 'SOURCE_UNAVAILABLE' });
  } catch (err) {
    clearTimeout(timeout);
    return res.status(200).json({ id: channel.id, state: 'NETWORK_ERROR' });
  }
});

// Handle graceful shutdown or address in use by checking if server is already listening
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
