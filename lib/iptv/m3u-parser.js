/**
 * Pure M3U / HLS playlist parser — no I/O.
 * Returns { kind: 'channel-list'|'hls-stream'|'unknown', channels, warnings }
 */

function stripBom(s) {
  return String(s || '').replace(/^\uFEFF/, '');
}

function parseAttrs(attrStr) {
  const out = {};
  const re = /([A-Za-z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,"]+))/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    out[m[1]] = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4]);
  }
  return out;
}

function normalizeName(display) {
  let name = String(display || '').trim();
  const flags = { geoBlocked: false, not247: false };
  if (/\[Geo-blocked\]/i.test(name)) { flags.geoBlocked = true; name = name.replace(/\s*\[Geo-blocked\]/ig, ''); }
  if (/\[Not 24\/7\]/i.test(name)) { flags.not247 = true; name = name.replace(/\s*\[Not 24\/7\]/ig, ''); }
  let quality = null;
  const qm = name.match(/\b(\d{3,4})p\b/i);
  if (qm) {
    quality = Number(qm[1]);
    name = name.replace(/\s*\(?\b\d{3,4}p\b\)?/ig, '');
  }
  name = name.replace(/\s{2,}/g, ' ').trim();
  return { name, quality, flags };
}

function parseTvgId(tvgId) {
  if (!tvgId) return { tvgId: null, channelKey: null, feed: null, country: null };
  const at = tvgId.indexOf('@');
  const channelKey = at >= 0 ? tvgId.slice(0, at) : tvgId;
  const feed = at >= 0 ? tvgId.slice(at + 1) : null;
  let country = null;
  const cm = channelKey.match(/\.([a-z]{2})$/i);
  if (cm) country = cm[1].toLowerCase();
  return { tvgId, channelKey, feed, country };
}

function looksExpiring(url) {
  return /[?&](token|expires|expire|requestTime|exp|sig)=/i.test(url);
}

function detectKind(text) {
  const t = text;
  if (/#EXT-X-STREAM-INF|#EXT-X-TARGETDURATION|#EXT-X-MEDIA-SEQUENCE/i.test(t)) return 'hls-stream';
  if (/#EXTINF/i.test(t) && /https?:\/\//i.test(t)) return 'channel-list';
  if (/#EXTM3U/i.test(t) && /https?:\/\//i.test(t)) return 'channel-list';
  return 'unknown';
}

/**
 * @param {string} input
 * @returns {{ kind: string, channels: Array, warnings: string[] }}
 */
function parseM3U(input) {
  const warnings = [];
  const text = stripBom(input).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const kind = detectKind(text);

  if (kind === 'hls-stream') {
    // Single HLS stream — treat whole input URL unknown; caller may pass URL separately
    return { kind, channels: [], warnings: ['Input looks like an HLS media/master playlist, not a channel list'] };
  }
  if (kind === 'unknown') {
    return { kind, channels: [], warnings: ['Unrecognized playlist format'] };
  }

  const lines = text.split('\n');
  const rawItems = [];
  let pending = null;
  let pendingHeaders = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '#EXTM3U') continue;

    if (line.startsWith('#EXTINF:')) {
      const colon = line.indexOf(':');
      const rest = line.slice(colon + 1);
      // duration + attrs , display-name  — display name is after last comma outside quotes
      let attrsPart = rest;
      let display = '';
      // Find comma that separates attrs from name: after duration number
      const m = rest.match(/^(-?\d+(?:\.\d+)?)[,\s]*(.*)$/);
      if (m) {
        let tail = m[2];
        // Last unquoted comma separates name
        let nameStart = -1;
        let inQ = false;
        for (let j = 0; j < tail.length; j++) {
          const ch = tail[j];
          if (ch === '"') inQ = !inQ;
          if (ch === ',' && !inQ) nameStart = j;
        }
        if (nameStart >= 0) {
          attrsPart = tail.slice(0, nameStart);
          display = tail.slice(nameStart + 1).trim();
        } else {
          attrsPart = '';
          display = tail.trim();
        }
      }
      const attrs = parseAttrs(attrsPart);
      pending = { attrs, display, headers: { ...pendingHeaders } };
      pendingHeaders = {};
      continue;
    }

    if (line.startsWith('#EXTGRP:')) {
      const g = line.slice(8).trim();
      if (pending) pending.group = g;
      else pendingHeaders.group = g;
      continue;
    }

    if (line.startsWith('#EXTVLCOPT:')) {
      const opt = line.slice(11).trim();
      const eq = opt.indexOf('=');
      if (eq > 0) {
        const k = opt.slice(0, eq).toLowerCase();
        const v = opt.slice(eq + 1);
        if (k.includes('referrer') || k.includes('referer')) pendingHeaders.referrer = v;
        if (k.includes('user-agent')) pendingHeaders.userAgent = v;
      }
      continue;
    }

    if (line.startsWith('#KODIPROP') || /license/i.test(line)) {
      warnings.push(`Skipped DRM line near ${i + 1}`);
      pending = null;
      continue;
    }

    if (line.startsWith('#')) continue;

    // URL line
    if (/^https?:\/\//i.test(line)) {
      if (!pending) {
        // URL without EXTINF — still accept as unnamed
        pending = { attrs: {}, display: line, headers: {} };
      }
      const { name, quality, flags } = normalizeName(pending.display || pending.attrs['tvg-name'] || '');
      const tvg = parseTvgId(pending.attrs['tvg-id'] || null);
      const url = line.trim();
      const flags2 = {
        ...flags,
        expiring: looksExpiring(url),
        insecureHttp: url.startsWith('http://')
      };
      rawItems.push({
        name: name || tvg.channelKey || 'Channel',
        quality,
        flags: flags2,
        tvgId: tvg.tvgId,
        channelKey: tvg.channelKey,
        feed: tvg.feed,
        country: tvg.country,
        logo: pending.attrs['tvg-logo'] || null,
        group: pending.attrs['group-title'] || pending.group || null,
        url,
        headers: {
          referrer: pending.headers.referrer || null,
          userAgent: pending.headers.userAgent || null
        }
      });
      pending = null;
    } else if (pending) {
      warnings.push(`Non-http URL skipped near line ${i + 1}`);
      pending = null;
    }
  }

  // Merge by tvgId (or exact URL if no tvgId)
  const map = new Map();
  for (const item of rawItems) {
    const key = item.tvgId || ('url:' + item.url);
    if (!map.has(key)) {
      map.set(key, {
        tvgId: item.tvgId,
        channelKey: item.channelKey,
        name: item.name,
        logo: item.logo,
        country: item.country,
        group: item.group,
        sources: []
      });
    }
    const ch = map.get(key);
    if (!ch.logo && item.logo) ch.logo = item.logo;
    if (!ch.group && item.group) ch.group = item.group;
    if (!ch.country && item.country) ch.country = item.country;
    // Prefer cleaner name without quality if current is empty-ish
    if (item.name && item.name.length < ch.name.length) ch.name = item.name;
    const exists = ch.sources.some(s => s.url === item.url);
    if (!exists) {
      ch.sources.push({
        url: item.url,
        feed: item.feed,
        quality: item.quality,
        flags: item.flags,
        headers: item.headers,
        health: { state: 'unknown', lastChecked: null, latencyMs: null, failCount: 0 }
      });
    }
  }

  // Sort sources by quality desc
  const channels = Array.from(map.values()).map(ch => {
    ch.sources.sort((a, b) => (b.quality || 0) - (a.quality || 0));
    return ch;
  });

  return { kind: 'channel-list', channels, warnings, rawCount: rawItems.length };
}

module.exports = { parseM3U, parseAttrs, normalizeName, parseTvgId, detectKind };
