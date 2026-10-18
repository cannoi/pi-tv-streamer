const path = require('path');
const { findSources, loadSources, resolveIntent } = require('./sources');
const { parseM3U } = require('./m3u-parser');
const { safeFetch, assertSafeUrl } = require('../net/safe-fetch');
const { applyAutoCategories } = require('./categorize');
const { searchGithubPlaylists } = require('./github-search');

async function fetchParse(url) {
  await assertSafeUrl(url);
  const { buffer, response } = await safeFetch(url, { maxBytes: 20 * 1024 * 1024, timeoutMs: 30000 });
  if (!response.ok) throw new Error('fetch_failed_' + response.status);
  return parseM3U(buffer.toString('utf8'));
}

/**
 * @param {object} opts
 * @param {boolean} [opts.confirm=false] - when false, only preview (dryRun)
 */
async function smartImport({ query, library, enricher, health, dataDir, includeGithub = false, confirm = false }) {
  const dir = dataDir || path.join(process.cwd(), 'data');
  const intent = resolveIntent(query);
  let candidates = findSources(dir, query);

  if (!candidates.length) {
    return {
      ok: false,
      error: 'no_matching_source',
      message: 'No catalog matched your query. Try a country (India, Vietnam, Japan…) or category (news, sports).',
      intent,
      candidates: []
    };
  }

  const tried = [];
  let best = null;
  for (const src of candidates.slice(0, 5)) {
    try {
      const parsed = await fetchParse(src.url);
      if (parsed.kind !== 'channel-list' || !parsed.channels.length) {
        tried.push({ id: src.id, error: 'empty' });
        continue;
      }
      let list = parsed.channels;
      let enrich = {};
      if (enricher) {
        try {
          const er = await enricher.enrichList(list, { hideNsfw: true });
          list = er.channels;
          enrich = { enriched: er.enriched, blocked: er.blocked, nsfw: er.nsfw };
        } catch (_) {}
      }
      // Prefer iptv-org categories over regex when present
      list = list.map(ch => {
        if (ch.categories && ch.categories.length) {
          const g = ch.categories.map(c => String(c)).join(';');
          return { ...ch, group: ch.group || g };
        }
        return ch;
      });
      list = applyAutoCategories(list);
      best = { src, list, parsed, enrich };
      break;
    } catch (e) {
      tried.push({ id: src.id, error: e.message });
    }
  }

  let github = null;
  if (includeGithub) {
    try {
      github = await searchGithubPlaylists(query, { token: process.env.GITHUB_TOKEN, limit: 5 });
    } catch (_) {}
  }

  if (!best) {
    return { ok: false, error: 'fetch_failed', tried, intent, candidates: candidates.map(c => ({ id: c.id, label: c.label })), github };
  }

  const groups = {};
  for (const c of best.list) {
    const g = c.group || 'General';
    groups[g] = (groups[g] || 0) + 1;
  }

  const preview = {
    ok: true,
    dryRun: !confirm,
    needsConfirmation: true,
    sourceId: best.src.id,
    sourceLabel: best.src.label,
    url: best.src.url,
    channelCount: best.list.length,
    rawCount: best.parsed.rawCount,
    enrich: best.enrich,
    groups,
    sample: best.list.slice(0, 12).map(c => c.name),
    intent,
    candidates: candidates.slice(0, 8).map(c => ({ id: c.id, label: c.label })),
    github: github && github.items ? github.items.slice(0, 5) : null,
    message: confirm
      ? null
      : `Preview: ${best.list.length} channels from ${best.src.label}. Confirm to import.`
  };

  if (!confirm) return preview;

  const result = library.importChannels(best.list, { mode: 'merge', importId: 'smart-' + Date.now() });
  if (health) {
    for (const c of best.list.slice(0, 80)) {
      const id = require('./library').stableId(c.tvgId, c.sources[0] && c.sources[0].url);
      if (c.sources[0]) health.enqueue(id, c.sources[0].url);
    }
  }
  return { ...preview, dryRun: false, needsConfirmation: false, ...result };
}

module.exports = { smartImport };
