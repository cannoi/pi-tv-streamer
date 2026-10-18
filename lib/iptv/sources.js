const fs = require('fs');
const path = require('path');

const DEFAULT_SOURCES = [
  { id: 'iptv-org-vn', type: 'm3u', label: 'iptv-org Vietnam', url: 'https://iptv-org.github.io/iptv/countries/vn.m3u', tags: ['vn', 'vietnam'] },
  { id: 'iptv-org-us', type: 'm3u', label: 'iptv-org USA', url: 'https://iptv-org.github.io/iptv/countries/us.m3u', tags: ['us', 'usa', 'english'] },
  { id: 'iptv-org-news', type: 'm3u', label: 'iptv-org News', url: 'https://iptv-org.github.io/iptv/categories/news.m3u', tags: ['news', 'tin tức', 'english'] },
  { id: 'iptv-org-music', type: 'm3u', label: 'iptv-org Music', url: 'https://iptv-org.github.io/iptv/categories/music.m3u', tags: ['music', 'nhạc'] },
  { id: 'iptv-org-sports', type: 'm3u', label: 'iptv-org Sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', tags: ['sports', 'thể thao'] },
  { id: 'iptv-org-eng', type: 'm3u', label: 'iptv-org English', url: 'https://iptv-org.github.io/iptv/languages/eng.m3u', tags: ['english', 'eng', 'tiếng anh'] },
  { id: 'iptv-org-vie', type: 'm3u', label: 'iptv-org Vietnamese', url: 'https://iptv-org.github.io/iptv/languages/vie.m3u', tags: ['vietnamese', 'vie', 'tiếng việt'] },
  { id: 'iptv-org-index', type: 'm3u', label: 'iptv-org All (large)', url: 'https://iptv-org.github.io/iptv/index.m3u', tags: ['all', 'world'] }
];

function loadSources(dataDir) {
  const fp = path.join(dataDir, 'sources.json');
  try {
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (Array.isArray(j.sources) && j.sources.length) return j.sources;
  } catch (_) {}
  return DEFAULT_SOURCES.slice();
}

function findSources(dataDir, query) {
  const q = String(query || '').toLowerCase();
  const all = loadSources(dataDir);
  if (!q) return all.slice(0, 8);
  const scored = all.map(s => {
    const hay = [s.id, s.label, s.url, ...(s.tags || [])].join(' ').toLowerCase();
    let score = 0;
    for (const part of q.split(/\s+/)) {
      if (hay.includes(part)) score += 2;
      if ((s.tags || []).some(t => t.includes(part))) score += 3;
    }
    return { s, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return (scored.length ? scored.map(x => x.s) : all.slice(0, 5)).slice(0, 10);
}

const ALLOW_HOSTS = new Set([
  'iptv-org.github.io',
  'raw.githubusercontent.com',
  'gist.githubusercontent.com'
]);

function isAllowlistedUrl(url) {
  try {
    const u = new URL(url);
    if (ALLOW_HOSTS.has(u.hostname)) return true;
    if (u.hostname === 'github.com' && /\/releases\/|\/raw\//.test(u.pathname)) return true;
    return false;
  } catch { return false; }
}

module.exports = { loadSources, findSources, isAllowlistedUrl, DEFAULT_SOURCES, ALLOW_HOSTS };
