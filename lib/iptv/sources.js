const fs = require('fs');
const path = require('path');

const DEFAULT_SOURCES = [];

/** Country / topic → public index URLs (iptv-org pages — discovery, not a locked private pack) */
const DISCOVERY = [
  { match: /\b(viet|vietnam|vn)\b/, urls: [
    'https://iptv-org.github.io/iptv/countries/vn.m3u',
    'https://iptv-org.github.io/iptv/languages/vie.m3u'
  ], label: 'iptv-org Vietnam' },
  { match: /\b(an do|india|hindi|in)\b/, urls: [
    'https://iptv-org.github.io/iptv/countries/in.m3u',
    'https://iptv-org.github.io/iptv/languages/hin.m3u'
  ], label: 'iptv-org India' },
  { match: /\b(us|usa|america)\b/, urls: ['https://iptv-org.github.io/iptv/countries/us.m3u'], label: 'iptv-org USA' },
  { match: /\b(japan|jp|nhat)\b/, urls: ['https://iptv-org.github.io/iptv/countries/jp.m3u'], label: 'iptv-org Japan' },
  { match: /\b(korea|kr|han)\b/, urls: ['https://iptv-org.github.io/iptv/countries/kr.m3u'], label: 'iptv-org Korea' },
  { match: /\b(uk|britain|gb)\b/, urls: ['https://iptv-org.github.io/iptv/countries/uk.m3u'], label: 'iptv-org UK' },
  { match: /\b(news|tin tuc)\b/, urls: ['https://iptv-org.github.io/iptv/categories/news.m3u'], label: 'iptv-org News' },
  { match: /\b(sport|the thao)\b/, urls: ['https://iptv-org.github.io/iptv/categories/sports.m3u'], label: 'iptv-org Sports' },
  { match: /\b(music|nhac)\b/, urls: ['https://iptv-org.github.io/iptv/categories/music.m3u'], label: 'iptv-org Music' }
];

function loadSources(dataDir) {
  const fp = path.join(dataDir, 'sources.json');
  try {
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (Array.isArray(j.sources)) return j.sources;
  } catch (_) {}
  return DEFAULT_SOURCES.slice();
}

function normalizeQuery(q) {
  return String(q || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim();
}

function discoveryCandidates(query) {
  const ql = normalizeQuery(query);
  const out = [];
  for (const d of DISCOVERY) {
    if (d.match.test(ql)) {
      d.urls.forEach((url, i) => out.push({ id: 'disc-' + out.length, label: d.label, url, tags: [] }));
    }
  }
  // Generic fallback: world news + sports so search rarely returns empty
  if (!out.length && ql) {
    out.push(
      { id: 'disc-news', label: 'iptv-org News', url: 'https://iptv-org.github.io/iptv/categories/news.m3u', tags: [] },
      { id: 'disc-us', label: 'iptv-org USA', url: 'https://iptv-org.github.io/iptv/countries/us.m3u', tags: [] }
    );
  }
  return out;
}

function searchKeywords(query) {
  const ql = normalizeQuery(query);
  const tags = [];
  if (/\b(viet|vietnam|vn)\b/.test(ql)) tags.push('vietnam iptv m3u');
  if (/\b(an do|india)\b/.test(ql)) tags.push('india iptv m3u');
  if (!tags.length) tags.push((ql || 'iptv') + ' m3u playlist');
  return tags;
}

function findSources(dataDir, query) {
  const book = loadSources(dataDir);
  const disc = discoveryCandidates(query);
  const ql = normalizeQuery(query);
  const fromBook = book.filter(s => {
    const hay = normalizeQuery([s.id, s.label, ...(s.tags || [])].join(' '));
    return !ql || ql.split(/\s+/).some(p => p.length > 1 && hay.includes(p));
  });
  return [...fromBook, ...disc].slice(0, 12);
}

function isAllowlistedUrl() { return false; }

module.exports = {
  loadSources, findSources, isAllowlistedUrl, DEFAULT_SOURCES,
  searchKeywords, normalizeQuery, discoveryCandidates
};
