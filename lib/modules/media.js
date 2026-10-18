const fs = require('fs');
const path = require('path');

const VIDEO = new Set(['.mp4', '.webm', '.mkv', '.ogg']);
const AUDIO = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac']);

function safeResolve(root, rel) {
  const rootReal = fs.realpathSync(root);
  const joined = path.join(rootReal, String(rel || '').replace(/\\/g, '/'));
  const real = fs.existsSync(joined) ? fs.realpathSync(joined) : path.normalize(joined);
  const prefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
  if (real !== rootReal && !real.startsWith(prefix)) throw new Error('path_escape');
  return real;
}

function scanDir(root, rel = '', out = [], depth = 0) {
  if (depth > 6 || out.length > 500) return out;
  let base;
  try { base = safeResolve(root, rel); } catch { return out; }
  let entries = [];
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) scanDir(root, r, out, depth + 1);
    else {
      const ext = path.extname(e.name).toLowerCase();
      if (VIDEO.has(ext) || AUDIO.has(ext)) {
        out.push({ name: e.name, path: r, type: VIDEO.has(ext) ? 'video' : 'audio', ext });
      }
    }
  }
  return out;
}

function mountMediaRoutes(app, mediaRoot) {
  fs.mkdirSync(mediaRoot, { recursive: true });
  app.get('/api/media/list', (req, res) => {
    try {
      const items = scanDir(mediaRoot);
      res.json({ ok: true, items, count: items.length });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });
  app.get('/api/media/file', (req, res) => {
    try {
      const fp = safeResolve(mediaRoot, req.query.path || '');
      if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) return res.status(404).end();
      res.sendFile(fp);
    } catch {
      res.status(404).end();
    }
  });
}

module.exports = { mountMediaRoutes, scanDir, safeResolve };
