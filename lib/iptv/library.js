/**
 * Channel library — atomic JSON store + in-memory indexes
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function stableId(tvgId, firstUrl) {
  const base = tvgId || firstUrl || Math.random().toString(36);
  return crypto.createHash('sha1').update(String(base)).digest('hex').slice(0, 16);
}

function stripVn(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();
}

function createLibrary(dataDir) {
  const file = path.join(dataDir, 'library.json');
  let channels = [];
  let byId = new Map();
  let saveTimer = null;

  function rebuildIndex() {
    byId = new Map();
    for (const ch of channels) byId.set(ch.id, ch);
  }

  function load() {
    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        channels = Array.isArray(raw.channels) ? raw.channels : [];
      }
    } catch {
      channels = [];
    }
    rebuildIndex();
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
        const tmp = file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), channels }, null, 0));
        fs.renameSync(tmp, file);
      } catch (e) {
        console.error('library save failed', e.message);
      }
    }, 200);
  }

  load();

  function importChannels(list, { importId, mode } = {}) {
    mode = mode || 'merge';
    importId = importId || ('imp-' + Date.now());
    let added = 0, merged = 0, skipped = 0;
    if (mode === 'replace') {
      channels = [];
      rebuildIndex();
    }
    for (const item of list) {
      const firstUrl = item.sources && item.sources[0] ? item.sources[0].url : null;
      const id = stableId(item.tvgId, firstUrl);
      const existing = byId.get(id);
      if (existing) {
        // merge sources
        const urls = new Set(existing.sources.map(s => s.url));
        for (const s of (item.sources || [])) {
          if (!urls.has(s.url)) {
            existing.sources.push(s);
            urls.add(s.url);
          }
        }
        existing.sources.sort((a, b) => (b.quality || 0) - (a.quality || 0));
        if (item.logo && !existing.logo) existing.logo = item.logo;
        if (item.group && !existing.group) existing.group = item.group;
        merged++;
      } else {
        const ch = {
          id,
          tvgId: item.tvgId || null,
          channelKey: item.channelKey || null,
          name: item.name,
          logo: item.logo || null,
          country: item.country || null,
          language: item.language || null,
          categories: item.categories || [],
          group: item.group || null,
          isNsfw: !!item.isNsfw,
          favorite: false,
          sources: item.sources || [],
          addedAt: new Date().toISOString(),
          importId
        };
        channels.push(ch);
        byId.set(id, ch);
        added++;
      }
    }
    scheduleSave();
    return { added, merged, skipped, total: channels.length, importId };
  }

  function search({ q, country, category, language, quality, health, favorite, group, limit, offset } = {}) {
    limit = Math.min(Number(limit) || 100, 500);
    offset = Number(offset) || 0;
    const qq = q ? stripVn(q) : '';
    let list = channels.slice();
    if (qq) list = list.filter(c => stripVn(c.name).includes(qq) || stripVn(c.group || '').includes(qq) || (c.tvgId || '').toLowerCase().includes(qq));
    if (country) list = list.filter(c => (c.country || '') === country);
    if (group) list = list.filter(c => (c.group || '') === group);
    if (favorite) list = list.filter(c => c.favorite);
    if (category) list = list.filter(c => (c.categories || []).includes(category));
    if (language) list = list.filter(c => (c.language || '') === language);
    if (quality) {
      const qn = Number(quality);
      list = list.filter(c => (c.sources || []).some(s => (s.quality || 0) >= qn));
    }
    if (health === 'live' || health === 'dead' || health === 'unknown') {
      list = list.filter(c => {
        const st = (c.sources && c.sources[0] && c.sources[0].health && c.sources[0].health.state) || 'unknown';
        return st === health;
      });
    }
    const total = list.length;
    list = list.slice(offset, offset + limit);
    return { total, offset, limit, channels: list };
  }

  function get(id) { return byId.get(id) || null; }

  function update(id, patch) {
    const ch = byId.get(id);
    if (!ch) return null;
    if (patch.favorite !== undefined) ch.favorite = !!patch.favorite;
    if (patch.name) ch.name = String(patch.name).slice(0, 200);
    if (patch.group !== undefined) ch.group = patch.group;
    scheduleSave();
    return ch;
  }

  function remove(filter = {}) {
    const before = channels.length;
    if (filter.id) {
      channels = channels.filter(c => c.id !== filter.id);
    } else if (filter.importId) {
      channels = channels.filter(c => c.importId !== filter.importId);
    } else if (filter.q) {
      const qq = stripVn(filter.q);
      channels = channels.filter(c => !stripVn(c.name).includes(qq));
    }
    rebuildIndex();
    scheduleSave();
    return { removed: before - channels.length, total: channels.length };
  }

  function stats() {
    let live = 0, dead = 0, unknown = 0, favorites = 0;
    for (const c of channels) {
      if (c.favorite) favorites++;
      const st = (c.sources && c.sources[0] && c.sources[0].health && c.sources[0].health.state) || 'unknown';
      if (st === 'live') live++;
      else if (st === 'dead') dead++;
      else unknown++;
    }
    return { total: channels.length, live, dead, unknown, favorites };
  }

  function exportM3U(filter = {}) {
    const { channels: list } = search({ ...filter, limit: 100000, offset: 0 });
    const lines = ['#EXTM3U'];
    for (const c of list) {
      for (const s of (c.sources || [])) {
        const attrs = [];
        if (c.tvgId) attrs.push(`tvg-id="${c.tvgId}"`);
        if (c.logo) attrs.push(`tvg-logo="${c.logo}"`);
        if (c.group) attrs.push(`group-title="${c.group}"`);
        let name = c.name;
        if (s.quality) name += ` (${s.quality}p)`;
        lines.push(`#EXTINF:-1 ${attrs.join(' ')},${name}`);
        lines.push(s.url);
      }
    }
    return lines.join('\n') + '\n';
  }

  function all() { return channels; }

  return { importChannels, search, get, update, remove, stats, exportM3U, all, load };
}

module.exports = { createLibrary, stableId };
