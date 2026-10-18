const fs = require('fs');
const path = require('path');

/** Optional user-curated source bookmarks only (data/sources.json). No shipped stream packs. */
const DEFAULT_SOURCES = [];

function loadSources(dataDir) {
  const fp = path.join(dataDir, 'sources.json');
  try {
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (Array.isArray(j.sources)) return j.sources;
  } catch (_) {}
  return DEFAULT_SOURCES.slice();
}

function normalizeQuery(q) {
  return String(q || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

/** Map free text → search keywords for dynamic discovery (not fixed repo URLs). */
function searchKeywords(query) {
  const ql = normalizeQuery(query);
  const tags = [];
  if (/\b(viet|vietnam|vn)\b/.test(ql)) tags.push('vietnam', 'vn', 'iptv vn');
  if (/\b(an do|india|hindi)\b/.test(ql)) tags.push('india', 'iptv india');
  if (/\b(us|usa|america|english)\b/.test(ql)) tags.push('usa', 'iptv us');
  if (/\b(japan|jp|nhat)\b/.test(ql)) tags.push('japan', 'iptv jp');
  if (/\b(korea|kr|han)\b/.test(ql)) tags.push('korea', 'iptv kr');
  if (/\b(news|tin tuc)\b/.test(ql)) tags.push('news iptv');
  if (/\b(sport|the thao)\b/.test(ql)) tags.push('sports iptv');
  if (!tags.length) tags.push(ql || 'iptv m3u');
  return [...new Set(tags)];
}

function findSources(dataDir, query) {
  const all = loadSources(dataDir);
  const ql = normalizeQuery(query);
  if (!ql) return all.slice(0, 10);
  return all.filter(s => {
    const hay = normalizeQuery([s.id, s.label, ...(s.tags || [])].join(' '));
    return ql.split(/\s+/).some(p => p.length > 1 && hay.includes(p));
  }).slice(0, 10);
}

function isAllowlistedUrl(url) {
  try {
    const u = new URL(url);
    // User-driven: allow common raw hosts only after explicit confirm in import UI
    return false;
  } catch { return false; }
}

module.exports = { loadSources, findSources, isAllowlistedUrl, DEFAULT_SOURCES, searchKeywords, normalizeQuery };
