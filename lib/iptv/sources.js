const fs = require('fs');
const path = require('path');

/** Tier-1 public catalogs only (iptv-org). Not a claim of per-stream legality. */
const DEFAULT_SOURCES = [
  { id: 'iptv-org-vn', type: 'm3u', label: 'iptv-org Vietnam', url: 'https://iptv-org.github.io/iptv/countries/vn.m3u', tags: ['vn', 'vietnam', 'việt', 'viet', 'vietnamese'] },
  { id: 'iptv-org-in', type: 'm3u', label: 'iptv-org India', url: 'https://iptv-org.github.io/iptv/countries/in.m3u', tags: ['in', 'india', 'ấn độ', 'an do', 'indo', 'hindi', 'indian'] },
  { id: 'iptv-org-us', type: 'm3u', label: 'iptv-org USA', url: 'https://iptv-org.github.io/iptv/countries/us.m3u', tags: ['us', 'usa', 'america', 'mỹ', 'english'] },
  { id: 'iptv-org-jp', type: 'm3u', label: 'iptv-org Japan', url: 'https://iptv-org.github.io/iptv/countries/jp.m3u', tags: ['jp', 'japan', 'nhật', 'japanese'] },
  { id: 'iptv-org-kr', type: 'm3u', label: 'iptv-org Korea', url: 'https://iptv-org.github.io/iptv/countries/kr.m3u', tags: ['kr', 'korea', 'hàn', 'korean'] },
  { id: 'iptv-org-cn', type: 'm3u', label: 'iptv-org China', url: 'https://iptv-org.github.io/iptv/countries/cn.m3u', tags: ['cn', 'china', 'trung', 'chinese'] },
  { id: 'iptv-org-th', type: 'm3u', label: 'iptv-org Thailand', url: 'https://iptv-org.github.io/iptv/countries/th.m3u', tags: ['th', 'thailand', 'thái', 'thai'] },
  { id: 'iptv-org-gb', type: 'm3u', label: 'iptv-org UK', url: 'https://iptv-org.github.io/iptv/countries/uk.m3u', tags: ['uk', 'gb', 'britain', 'anh'] },
  { id: 'iptv-org-news', type: 'm3u', label: 'iptv-org News', url: 'https://iptv-org.github.io/iptv/categories/news.m3u', tags: ['news', 'tin tức', 'tin tuc'] },
  { id: 'iptv-org-sports', type: 'm3u', label: 'iptv-org Sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u', tags: ['sports', 'thể thao', 'the thao'] },
  { id: 'iptv-org-music', type: 'm3u', label: 'iptv-org Music', url: 'https://iptv-org.github.io/iptv/categories/music.m3u', tags: ['music', 'nhạc', 'nhac'] },
  { id: 'iptv-org-movies', type: 'm3u', label: 'iptv-org Movies', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u', tags: ['movies', 'phim', 'movie', 'cinema'] },
  { id: 'iptv-org-eng', type: 'm3u', label: 'iptv-org English', url: 'https://iptv-org.github.io/iptv/languages/eng.m3u', tags: ['english', 'eng', 'tiếng anh', 'tieng anh'] },
  { id: 'iptv-org-vie', type: 'm3u', label: 'iptv-org Vietnamese lang', url: 'https://iptv-org.github.io/iptv/languages/vie.m3u', tags: ['vie', 'vietnamese language'] },
  { id: 'iptv-org-hin', type: 'm3u', label: 'iptv-org Hindi', url: 'https://iptv-org.github.io/iptv/languages/hin.m3u', tags: ['hin', 'hindi', 'ấn độ', 'india'] }
];

function loadSources(dataDir) {
  const fp = path.join(dataDir, 'sources.json');
  try {
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (Array.isArray(j.sources) && j.sources.length) {
      // merge defaults for missing ids
      const byId = new Map(j.sources.map(s => [s.id, s]));
      for (const d of DEFAULT_SOURCES) if (!byId.has(d.id)) byId.set(d.id, d);
      return [...byId.values()];
    }
  } catch (_) {}
  return DEFAULT_SOURCES.slice();
}

function normalizeQuery(q) {
  return String(q || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/đ/g, 'd')
    .trim();
}

/** Map free-text → preferred source ids (ordered) */
function resolveIntent(query) {
  const ql = normalizeQuery(query);
  const hits = [];
  const rules = [
    { re: /\b(an do|an do|india|indian|hindi|bollywood)\b|an\s*do/, ids: ['iptv-org-in', 'iptv-org-hin'] },
    { re: /\b(viet|vietnam|vn|vietnamese)\b/, ids: ['iptv-org-vn', 'iptv-org-vie'] },
    { re: /\b(my|usa|us|america|american)\b/, ids: ['iptv-org-us'] },
    { re: /\b(nhat|japan|japanese|jp)\b/, ids: ['iptv-org-jp'] },
    { re: /\b(han|korea|korean|kr)\b/, ids: ['iptv-org-kr'] },
    { re: /\b(trung|china|chinese|cn)\b/, ids: ['iptv-org-cn'] },
    { re: /\b(thai|thailand)\b/, ids: ['iptv-org-th'] },
    { re: /\b(uk|britain|england|anh quoc)\b/, ids: ['iptv-org-gb'] },
    { re: /\b(tin tuc|news)\b/, ids: ['iptv-org-news'] },
    { re: /\b(the thao|sport|sports)\b/, ids: ['iptv-org-sports'] },
    { re: /\b(nhac|music)\b/, ids: ['iptv-org-music'] },
    { re: /\b(phim|movie|movies|cinema)\b/, ids: ['iptv-org-movies'] },
    { re: /\b(tieng anh|english|eng)\b/, ids: ['iptv-org-eng', 'iptv-org-us'] }
  ];
  for (const r of rules) {
    if (r.re.test(ql)) hits.push(...r.ids);
  }
  // unique preserve order
  return [...new Set(hits)];
}

function findSources(dataDir, query) {
  const all = loadSources(dataDir);
  const intent = resolveIntent(query);
  if (intent.length) {
    const mapped = intent.map(id => all.find(s => s.id === id)).filter(Boolean);
    if (mapped.length) return mapped;
  }
  const ql = normalizeQuery(query);
  if (!ql) return all.slice(0, 8);
  const scored = all.map(s => {
    const hay = normalizeQuery([s.id, s.label, ...(s.tags || [])].join(' '));
    let score = 0;
    for (const part of ql.split(/\s+/)) {
      if (part.length < 2) continue;
      if (hay.includes(part)) score += 2;
      if ((s.tags || []).some(t => normalizeQuery(t).includes(part))) score += 4;
    }
    return { s, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.map(x => x.s).slice(0, 10);
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

module.exports = { loadSources, findSources, isAllowlistedUrl, DEFAULT_SOURCES, ALLOW_HOSTS, resolveIntent, normalizeQuery };
