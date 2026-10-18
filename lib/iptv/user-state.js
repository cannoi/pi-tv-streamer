/**
 * Cross-device channel memory — persisted under data/ (Docker volume).
 */
const fs = require('fs');
const path = require('path');

function createUserState(dataDir) {
  const file = path.join(dataDir, 'user-state.json');
  let state = {
    version: 1,
    lastChannelId: null,
    lastCountry: 'intl',
    history: [], // [{id,name,url,ts}]
    favorites: [], // channel ids
    customChannels: [], // user-added channels, persisted across browsers
    updatedAt: null
  };

  function load() {
    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        state = { ...state, ...raw };
        if (!Array.isArray(state.history)) state.history = [];
        if (!Array.isArray(state.favorites)) state.favorites = [];
        if (!Array.isArray(state.customChannels)) state.customChannels = [];
      }
    } catch (e) {
      console.warn('user-state load', e.message);
    }
  }
  load();

  function save() {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      state.updatedAt = new Date().toISOString();
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state, null, 0));
      fs.renameSync(tmp, file);
    } catch (e) {
      console.error('user-state save', e.message);
    }
  }

  function get() {
    return {
      lastChannelId: state.lastChannelId,
      lastCountry: state.lastCountry,
      history: state.history.slice(0, 50),
      favorites: state.favorites.slice(),
      customChannels: state.customChannels.slice(0, 500),
      updatedAt: state.updatedAt
    };
  }

  function pushHistory(entry) {
    if (!entry || !entry.id) return get();
    state.history = [
      { id: entry.id, name: entry.name || entry.id, url: entry.url || '', ts: Date.now() },
      ...state.history.filter(h => h.id !== entry.id)
    ].slice(0, 50);
    state.lastChannelId = entry.id;
    if (entry.country) state.lastCountry = entry.country;
    save();
    return get();
  }

  function setFavorite(id, on) {
    if (!id) return get();
    const set = new Set(state.favorites);
    if (on) set.add(id); else set.delete(id);
    state.favorites = [...set];
    save();
    return get();
  }

  function patch(p = {}) {
    if (p.lastChannelId !== undefined) state.lastChannelId = p.lastChannelId;
    if (p.lastCountry !== undefined) state.lastCountry = p.lastCountry;
    if (Array.isArray(p.history)) state.history = p.history.slice(0, 50);
    if (Array.isArray(p.favorites)) state.favorites = p.favorites.slice(0, 200);
    if (Array.isArray(p.customChannels)) state.customChannels = p.customChannels.filter(c => c && c.id && c.name && c.url).slice(0, 500);
    save();
    return get();
  }

  return { get, pushHistory, setFavorite, patch, load, save };
}

module.exports = { createUserState };
