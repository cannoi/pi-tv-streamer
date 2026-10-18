/**
 * One-shot: user query → pick allowlisted source or github → dryRun → import
 */
const { findSources, loadSources, isAllowlistedUrl } = require('./sources');
const { parseM3U } = require('./m3u-parser');
const { safeFetch, assertSafeUrl } = require('../net/safe-fetch');

function pickSourceId(ql) {
  if (/việt|vietnam|\bvn\b|vie/.test(ql)) return 'iptv-org-vn';
  if (/thể thao|sport/.test(ql)) return 'iptv-org-sports';
  if (/nhạc|music/.test(ql)) return 'iptv-org-music';
  if (/english|eng|anh/.test(ql) && /news|tin/.test(ql)) return 'iptv-org-news';
  if (/english|eng|tiếng anh/.test(ql)) return 'iptv-org-eng';
  if (/news|tin tức|tin tuc/.test(ql)) return 'iptv-org-news';
  if (/us|mỹ|america/.test(ql)) return 'iptv-org-us';
  return 'iptv-org-vn';
}

async function fetchAndParse(url) {
  await assertSafeUrl(url);
  const { buffer, response } = await safeFetch(url, { maxBytes: 20 * 1024 * 1024, timeoutMs: 30000 });
  if (!response.ok) throw new Error('fetch_failed_' + response.status);
  return parseM3U(buffer.toString('utf8'));
}

async function smartImport({ query, library, enricher, health, dryRunOnly = false }) {
  const ql = String(query || '').toLowerCase();
  const sourceId = pickSourceId(ql);
  const sources = loadSources(require('path').join(process.cwd(), 'data'));
  let src = sources.find(s => s.id === sourceId) || findSources(require('path').join(process.cwd(), 'data'), query)[0];
  if (!src || !src.url) throw new Error('no_source');

  const parsed = await fetchAndParse(src.url);
  if (parsed.kind !== 'channel-list' || !parsed.channels.length) throw new Error('empty_playlist');

  let list = parsed.channels;
  let enrich = {};
  if (enricher) {
    try {
      const er = await enricher.enrichList(list, { hideNsfw: true });
      list = er.channels;
      enrich = { enriched: er.enriched, blocked: er.blocked, nsfw: er.nsfw };
    } catch (_) {}
  }

  if (dryRunOnly) {
    return {
      ok: true,
      dryRun: true,
      sourceId: src.id,
      sourceLabel: src.label,
      url: src.url,
      channelCount: list.length,
      rawCount: parsed.rawCount,
      enrich,
      sample: list.slice(0, 6).map(c => c.name)
    };
  }

  const result = library.importChannels(list, { mode: 'merge', importId: 'smart-' + Date.now() });
  if (health) {
    for (const c of list.slice(0, 60)) {
      const id = require('./library').stableId(c.tvgId, c.sources[0] && c.sources[0].url);
      if (c.sources[0]) health.enqueue(id, c.sources[0].url);
    }
  }
  return {
    ok: true,
    dryRun: false,
    sourceId: src.id,
    sourceLabel: src.label,
    channelCount: list.length,
    enrich,
    ...result
  };
}

module.exports = { smartImport, pickSourceId };
