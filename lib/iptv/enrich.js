/**
 * Enrich library channels using iptv-org static API (cached).
 * https://iptv-org.github.io/api/{channels,logos,categories,blocklist}.json
 */
const fs = require('fs');
const path = require('path');
const { safeFetch } = require('../net/safe-fetch');

const API = {
  channels: 'https://iptv-org.github.io/api/channels.json',
  logos: 'https://iptv-org.github.io/api/logos.json',
  categories: 'https://iptv-org.github.io/api/categories.json',
  blocklist: 'https://iptv-org.github.io/api/blocklist.json'
};

function createEnricher(dataDir, { ttlMs = 24 * 3600 * 1000 } = {}) {
  const cacheDir = path.join(dataDir, 'iptv-org-cache');
  let maps = null;
  let loadedAt = 0;

  async function loadJson(name, url) {
    fs.mkdirSync(cacheDir, { recursive: true });
    const fp = path.join(cacheDir, name + '.json');
    try {
      if (fs.existsSync(fp)) {
        const st = fs.statSync(fp);
        if (Date.now() - st.mtimeMs < ttlMs) {
          return JSON.parse(fs.readFileSync(fp, 'utf8'));
        }
      }
    } catch (_) {}
    const { buffer, response } = await safeFetch(url, { maxBytes: 40 * 1024 * 1024, timeoutMs: 60000 });
    if (!response.ok) throw new Error('iptv_org_fetch_' + name);
    const data = JSON.parse(buffer.toString('utf8'));
    fs.writeFileSync(fp, JSON.stringify(data));
    return data;
  }

  async function ensureMaps() {
    if (maps && Date.now() - loadedAt < ttlMs) return maps;
    const [channels, logos, blocklist] = await Promise.all([
      loadJson('channels', API.channels),
      loadJson('logos', API.logos),
      loadJson('blocklist', API.blocklist).catch(() => [])
    ]);
    const byId = new Map();
    for (const c of channels) byId.set(c.id, c);
    const logoByChannel = new Map();
    for (const l of logos) {
      if (!l.in_use) continue;
      if (!logoByChannel.has(l.channel)) logoByChannel.set(l.channel, l.url);
    }
    const blocked = new Set();
    for (const b of blocklist || []) {
      if (b.channel) blocked.add(b.channel);
      if (b.id) blocked.add(b.id);
    }
    maps = { byId, logoByChannel, blocked };
    loadedAt = Date.now();
    return maps;
  }

  /**
   * channelKey is part before @ in tvg-id (e.g. AnNinhTV.vn)
   */
  async function enrichChannel(ch) {
    const m = await ensureMaps();
    const key = ch.channelKey || (ch.tvgId ? String(ch.tvgId).split('@')[0] : null);
    if (!key) return { channel: ch, blocked: false };
    if (m.blocked.has(key)) return { channel: ch, blocked: true };
    const meta = m.byId.get(key);
    if (meta) {
      if (!ch.logo && m.logoByChannel.get(key)) ch.logo = m.logoByChannel.get(key);
      else if (!ch.logo && m.logoByChannel.get(meta.id)) ch.logo = m.logoByChannel.get(meta.id);
      if ((!ch.categories || !ch.categories.length) && meta.categories) ch.categories = meta.categories.slice();
      if (!ch.country && meta.country) ch.country = String(meta.country).toLowerCase();
      ch.isNsfw = !!meta.is_nsfw;
      if (meta.website) ch.website = meta.website;
      if (meta.closed) ch.closed = true;
    } else if (!ch.logo && m.logoByChannel.get(key)) {
      ch.logo = m.logoByChannel.get(key);
    }
    return { channel: ch, blocked: false };
  }

  async function enrichList(list, { hideNsfw = true } = {}) {
    const out = [];
    let blocked = 0, nsfw = 0, enriched = 0;
    for (const ch of list) {
      const r = await enrichChannel(ch);
      if (r.blocked) { blocked++; continue; }
      if (hideNsfw && r.channel.isNsfw) { nsfw++; continue; }
      if (r.channel.logo || (r.channel.categories && r.channel.categories.length)) enriched++;
      out.push(r.channel);
    }
    return { channels: out, blocked, nsfw, enriched };
  }

  return { enrichChannel, enrichList, ensureMaps };
}

module.exports = { createEnricher, API };
