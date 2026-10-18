/**
 * Minimal XMLTV parse — keep only programmes for channels present in library.
 */
const fs = require('fs');
const path = require('path');
const { safeFetch } = require('../net/safe-fetch');

function parseXmltv(xml, channelIds) {
  const want = new Set((channelIds || []).map(String));
  const programmes = [];
  // naive but dependency-free scan
  const re = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const ch = (attrs.match(/channel="([^"]+)"/) || [])[1];
    const start = (attrs.match(/start="([^"]+)"/) || [])[1];
    const stop = (attrs.match(/stop="([^"]+)"/) || [])[1];
    if (want.size && ch && !want.has(ch) && ![...want].some(id => ch.includes(id) || id.includes(ch))) {
      // allow soft match on tvg id prefix
      const soft = [...want].some(id => id.split('@')[0] && ch.includes(id.split('@')[0]));
      if (!soft) continue;
    }
    const title = ((body.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '').trim();
    programmes.push({ channel: ch, start, stop, title });
    if (programmes.length > 5000) break;
  }
  return programmes;
}

function xmltvTimeToDate(s) {
  // 20260101120000 +0000
  if (!s || s.length < 14) return null;
  const y = +s.slice(0, 4), mo = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
  const h = +s.slice(8, 10), mi = +s.slice(10, 12), se = +s.slice(12, 14);
  return new Date(Date.UTC(y, mo, d, h, mi, se));
}

function createEpgStore(dataDir) {
  const file = path.join(dataDir, 'epg-cache.json');
  let data = { programmes: [], updatedAt: null, url: null };

  function load() {
    try {
      if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (_) {}
  }
  load();

  function save() {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data));
    } catch (_) {}
  }

  async function loadFromUrl(url, channelIds) {
    const { buffer, response } = await safeFetch(url, { maxBytes: 15 * 1024 * 1024, timeoutMs: 45000 });
    if (!response.ok) throw new Error('epg_fetch_' + response.status);
    const programmes = parseXmltv(buffer.toString('utf8'), channelIds);
    data = { programmes, updatedAt: new Date().toISOString(), url };
    save();
    return { count: programmes.length };
  }

  function nowNext(channelKey) {
    const now = Date.now();
    const list = (data.programmes || []).filter(p => {
      if (!channelKey) return false;
      return p.channel === channelKey || (p.channel && p.channel.includes(channelKey)) || (channelKey && channelKey.includes(p.channel));
    });
    const parsed = list.map(p => ({
      ...p,
      startMs: xmltvTimeToDate(p.start)?.getTime() || 0,
      stopMs: xmltvTimeToDate(p.stop)?.getTime() || 0
    })).filter(p => p.stopMs > now - 3600000).sort((a, b) => a.startMs - b.startMs);
    const current = parsed.find(p => p.startMs <= now && p.stopMs > now) || null;
    const next = parsed.find(p => p.startMs > now) || null;
    return { current, next };
  }

  return { loadFromUrl, nowNext, getMeta: () => ({ updatedAt: data.updatedAt, url: data.url, count: (data.programmes || []).length }) };
}

module.exports = { createEpgStore, parseXmltv, xmltvTimeToDate };
