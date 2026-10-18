const path = require('path');
const { findSources, searchKeywords } = require('./sources');
const { parseM3U } = require('./m3u-parser');
const { safeFetch, assertSafeUrl } = require('../net/safe-fetch');
const { applyAutoCategories } = require('./categorize');
const { searchGithubPlaylists } = require('./github-search');

async function fetchParse(url) {
  await assertSafeUrl(url);
  const { buffer, response } = await safeFetch(url, { maxBytes: 20 * 1024 * 1024, timeoutMs: 25000 });
  if (!response.ok) throw new Error('fetch_failed_' + response.status);
  return parseM3U(buffer.toString('utf8'));
}

async function tryImportList(list, { enricher }) {
  let channels = applyAutoCategories(list);
  if (enricher) {
    try {
      const er = await enricher.enrichList(channels, { hideNsfw: true });
      channels = applyAutoCategories(er.channels);
    } catch (_) {}
  }
  return channels;
}

async function smartImport({ query, library, enricher, health, dataDir, confirm = false, url: directUrl }) {
  const dir = dataDir || path.join(process.cwd(), 'data');
  const ql = String(query || '').trim();
  const tried = [];

  if (directUrl) {
    try {
      const parsed = await fetchParse(directUrl);
      if (parsed.kind !== 'channel-list' || !parsed.channels.length) {
        return { ok: false, error: 'not_channel_list' };
      }
      const list = await tryImportList(parsed.channels, { enricher });
      if (!confirm) {
        return {
          ok: true, dryRun: true, needsConfirmation: true,
          sourceLabel: directUrl, url: directUrl,
          channelCount: list.length, sample: list.slice(0, 15).map(c => c.name)
        };
      }
      const result = library.importChannels(list, { mode: 'merge', importId: 'url-' + Date.now() });
      return { ok: true, dryRun: false, sourceLabel: directUrl, ...result, channelCount: list.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // Ordered candidates: discovery indexes first (stable), then github
  const candidates = findSources(dir, ql);
  let best = null;

  for (const src of candidates) {
    try {
      const parsed = await fetchParse(src.url);
      if (parsed.kind === 'channel-list' && parsed.channels.length) {
        const list = await tryImportList(parsed.channels, { enricher });
        best = { label: src.label || src.id, url: src.url, list };
        break;
      }
      tried.push({ url: src.url, error: 'empty' });
    } catch (e) {
      tried.push({ url: src.url, error: e.message });
    }
  }

  let githubItems = [];
  if (!best) {
    try {
      const keys = searchKeywords(ql);
      const gh = await searchGithubPlaylists(keys[0] || ql, { token: process.env.GITHUB_TOKEN, limit: 8 });
      githubItems = gh.items || [];
      for (const it of githubItems) {
        const url = it.rawUrl || it.url;
        if (!url || !/raw\.githubusercontent\.com|gist\.githubusercontent\.com/i.test(url)) continue;
        try {
          const parsed = await fetchParse(url);
          if (parsed.kind === 'channel-list' && parsed.channels.length) {
            const list = await tryImportList(parsed.channels, { enricher });
            best = { label: it.name || it.repo || url, url, list };
            break;
          }
        } catch (e) {
          tried.push({ url, error: e.message });
        }
      }
    } catch (e) {
      tried.push({ url: 'github', error: e.message });
    }
  }

  // Last resort: news catalog so AI rarely returns empty-handed
  if (!best) {
    try {
      const url = 'https://iptv-org.github.io/iptv/categories/news.m3u';
      const parsed = await fetchParse(url);
      if (parsed.channels && parsed.channels.length) {
        const list = await tryImportList(parsed.channels, { enricher });
        best = { label: 'iptv-org News (fallback)', url, list };
      }
    } catch (e) {
      tried.push({ url: 'fallback-news', error: e.message });
    }
  }

  if (!best) {
    return {
      ok: false,
      error: 'no_playlist_reachable',
      message: 'Could not reach any public playlist. Paste an M3U URL or try again later.',
      tried,
      github: githubItems.slice(0, 5)
    };
  }

  const groups = {};
  for (const c of best.list) {
    const g = c.group || 'General';
    groups[g] = (groups[g] || 0) + 1;
  }

  if (!confirm) {
    return {
      ok: true, dryRun: true, needsConfirmation: true,
      sourceLabel: best.label, url: best.url,
      channelCount: best.list.length, groups,
      sample: best.list.slice(0, 15).map(c => c.name),
      tried,
      message: 'Preview ready — say “confirm import” / “xác nhận nhập” to save'
    };
  }

  const result = library.importChannels(best.list, { mode: 'merge', importId: 'smart-' + Date.now() });
  if (health) {
    for (const c of best.list.slice(0, 80)) {
      try {
        const id = require('./library').stableId(c.tvgId, c.sources[0] && c.sources[0].url);
        if (c.sources[0]) health.enqueue(id, c.sources[0].url);
      } catch (_) {}
    }
  }
  return {
    ok: true, dryRun: false, needsConfirmation: false,
    sourceLabel: best.label, url: best.url,
    ...result, channelCount: best.list.length, groups
  };
}

module.exports = { smartImport };
