const fs = require('fs');
const path = require('path');

const VIDEO = new Set(['.mp4', '.webm', '.mkv', '.ogg']);
const AUDIO = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac']);

function scanDir(root, rel = '', out = [], depth = 0) {
  if (depth > 6 || out.length > 500) return out;
  let entries = [];
  try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) scanDir(root, r, out, depth + 1);
    else {
      const ext = path.extname(e.name).toLowerCase();
      if (VIDEO.has(ext) || AUDIO.has(ext)) {
        out.push({
          name: e.name,
          path: r,
          type: VIDEO.has(ext) ? 'video' : 'audio',
          ext
        });
      }
    }
  }
  return out;
}

function mountMediaRoutes(app, mediaRoot) {
  app.get('/api/media/list', (req, res) => {
    if (!fs.existsSync(mediaRoot)) return res.json({ ok: true, items: [], root: mediaRoot, note: 'media folder missing' });
    const items = scanDir(mediaRoot);
    res.json({ ok: true, items, root: mediaRoot });
  });
  app.get('/api/media/file', (req, res) => {
    const rel = String(req.query.path || '').replace(/\.\./g, '');
    const fp = path.join(mediaRoot, rel);
    if (!fp.startsWith(mediaRoot) || !fs.existsSync(fp)) return res.status(404).end();
    res.sendFile(fp);
  });
}

module.exports = { mountMediaRoutes, scanDir };
