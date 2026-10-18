const path = require('path');
const { findSources, searchKeywords, loadSources } = require('./sources');
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
 * Dynamic discovery: search GitHub for playlist candidates (no hardcoded repo).
 * Preview by default; import only when confirm=true.
 */
async function smartImport({ query, library, enricher, health, dataDir, includeGithub = true, confirm = false, url: directUrl }) {
  const dir = dataDir || path.join(process.cwd(), 'data');
  const ql = String(query || '').trim();

  // Direct URL path (user pasted)
  if (directUrl) {
    try {
      const parsed = await fetchParse(directUrl);
      if (parsed.kind !== 'channel-list' || !parsed.channels.length) {
        return { ok: false, error: 'not_channel_list' };
      }
      let list = applyAutoCategories(parsed.channels);
      if (enricher) {
        try {
          const er = await enricher.enrichList(list, { hideNsfw: true });
          list = applyAutoCategories(er.channels);
        } catch (_) {}
      }
      if (!confirm) {
        return {
          ok: true, dryRun: true, needsConfirmation: true,
          sourceLabel: directUrl, url: directUrl,
          channelCount: list.length, sample: list.slice(0, 12).map(c => c.name),
          message: 'Preview — confirm to import'
        };
      }
      const result = library.importChannels(list, { mode: 'merge', importId: 'url-' + Date.now() });
      return { ok: true, dryRun: false, sourceLabel: directUrl, ...result, channelCount: list.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // 1) User bookmarks
  let candidates = findSources(dir, ql);

  // 2) Dynamic GitHub search (no fixed repo list)
  let github = { items: [] };
  try {
    const keys = searchKeywords(ql);
    const q = keys.join(' ') + ' m3u playlist';
    github = await searchGithubPlaylists(q, { token: process.env.GITHUB_TOKEN, limit: 8 });
  } catch (e) {
    github = { items: [], error: e.message };
  }

  // Prefer first github raw-looking candidate for preview if no bookmarks
  const ghItems = (github && github.items) || [];
  const tried = [];
  let best = null;

  for (const src of candidates.slice(0, 3)) {
    try {
      const parsed = await fetchParse(src.url);
      if (parsed.kind === 'channel-list' && parsed.channels.length) {
        let list = applyAutoCategories(parsed.channels);
        if (enricher) {
          try {
            const er = await enricher.enrichList(list, { hideNsfw: true });
            list = applyAutoCategories(er.channels);
          } catch (_) {}
        }
        best = { label: src.label || src.id, url: src.url, list, parsed };
        break;
      }
    } catch (e) {
      tried.push({ id: src.id, error: e.message });
    }
  }

  // Try dynamic github raw URLs
  if (!best) {
    for (const it of ghItems.slice(0, 5)) {
      const url = it.rawUrl || it.url;
      if (!url || !/\.m3u8?($|\?)/i.test(url) && !/m3u/i.test(url)) continue;
      try {
        // only fetch raw.githubusercontent.com / gist
        if (!/raw\.githubusercontent\.com|gist\.githubusercontent\.com/i.test(url)) continue;
        const parsed = await fetchParse(url);
        if (parsed.kind === 'channel-list' && parsed.channels.length) {
          let list = applyAutoCategories(parsed.channels);
          best = { label: it.name || it.repo || url, url, list, parsed };
          break;
        }
      } catch (e) {
        tried.push({ id: url, error: e.message });
      }
    }
  }

  if (!best) {
    return {
      ok: true,
      dryRun: true,
      needsConfirmation: false,
      channelCount: 0,
      github: ghItems.slice(0, 8).map(it => ({
        name: it.name || it.repo,
        url: it.rawUrl || it.url,
        description: it.description || ''
      })),
      tried,
      message: ghItems.length
        ? 'Found GitHub candidates — pick a URL to import (confirm).'
        : 'No playlist found. Paste an M3U URL or use ✎ Import.',
      query: ql
    };
  }

  const groups = {};
  for (const c of best.list) {
    const g = c.group || 'General';
    groups[g] = (groups[g] || 0) + 1;
  }

  if (!confirm) {
    return {
      ok: true,
      dryRun: true,
      needsConfirmation: true,
      sourceLabel: best.label,
      url: best.url,
      channelCount: best.list.length,
      groups,
      sample: best.list.slice(0, 12).map(c => c.name),
      github: ghItems.slice(0, 5),
      message: 'Preview — reply confirm import to save'
    };
  }

  const result = library.importChannels(best.list, { mode: 'merge', importId: 'smart-' + Date.now() });
  if (health) {
    for (const c of best.list.slice(0, 60)) {
      const id = require('./library').stableId(c.tvgId, c.sources[0] && c.sources[0].url);
      if (c.sources[0]) health.enqueue(id, c.sources[0].url);
    }
  }
  return { ok: true, dryRun: false, sourceLabel: best.label, url: best.url, ...result, channelCount: best.list.length, groups };
}

module.exports = { smartImport };
