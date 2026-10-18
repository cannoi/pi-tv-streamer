/**
 * Pi Vintage TV AI adapter v1.8.2 — tool-calling for sources/import
 */
const knowledge = `
APP NAME: Pi Vintage TV
VERSION: 1.8.2
UI: Retro CRT only (International / SAMPO / Samsung). Channel manager ✎ imports M3U.

TOOLS (prefer these over inventing URLs):
1. find_sources(query) — list curated iptv-org playlists matching query (news, vietnam, english…)
2. import_source({ sourceId|url, dryRun, confirm, filter }) — ALWAYS dryRun first.
   If channelCount > 50, ask user to confirm, then call again with confirm:true or dryRun:false.
3. search_channels(query) — search library already imported
4. play / switch via switch_channel, next_channel, prev_channel
5. set_theme, toggle_fullscreen, help

RULES:
- Never invent stream URLs.
- Never claim import success without server result.
- Reply in the user's language (VI or EN).
- Return JSON: {"reply":"...","actions":[{"name":"...","args":{}}]}
`;

const actions = [
  { name: 'find_sources', description: 'Find playlist sources by query (news, vn, english…)', requiresConfirmation: false },
  { name: 'import_source', description: 'Import allowlisted M3U. Args: sourceId or url, dryRun (default true), confirm, filter', requiresConfirmation: false },
  { name: 'search_channels', description: 'Search channels in library. Args: q', requiresConfirmation: false },
  { name: 'list_channels', description: 'List current TV zap channels', requiresConfirmation: false },
  { name: 'switch_channel', description: 'Switch by index or name', requiresConfirmation: false },
  { name: 'next_channel', description: 'Next', requiresConfirmation: false },
  { name: 'prev_channel', description: 'Previous', requiresConfirmation: false },
  { name: 'add_channel', description: 'Add one custom channel name+url', requiresConfirmation: false },
  { name: 'remove_channel', description: 'Remove by id/name', requiresConfirmation: false },
  { name: 'set_theme', description: 'international|sampo|samsung', requiresConfirmation: false },
  { name: 'set_country', description: 'vn|us|jp|kr|eu|intl', requiresConfirmation: false },
  { name: 'toggle_power', description: 'Power', requiresConfirmation: false },
  { name: 'toggle_bw', description: 'B&W', requiresConfirmation: false },
  { name: 'toggle_fullscreen', description: 'Fullscreen', requiresConfirmation: false },
  { name: 'help', description: 'Help', requiresConfirmation: false }
];

const ALLOWED = new Set(actions.map(a => a.name));

async function getContext() {
  return { app: 'Pi Vintage TV', version: '1.8.2', ui: 'retro' };
}

async function executeAction({ name, args }) {
  if (!ALLOWED.has(name)) return { ok: false, error: 'Action not allowed', action: name };
  // Server-side tools executed in client via fetch bridge
  return { ok: true, action: name, args: args || {}, clientExecute: true };
}

function isVi(q) {
  return /[àáạảãâăđèéêìíòóôơùúý]/.test(q) || /\b(kênh|tìm|thêm|nhập|tin tức|miễn phí)\b/.test(q);
}

async function localReply(message) {
  const q = String(message || '');
  const ql = q.toLowerCase();
  const vi = isVi(ql);

  // Free / news / catalog requests → find_sources + import dryRun
  if (/tin tức|news|english|tiếng anh|miễn phí|free|iptv|kho|playlist|việt nam|vietnam/.test(ql)) {
    let query = 'news';
    if (/việt|vietnam|vn|vie/.test(ql)) query = 'vietnam';
    else if (/nhạc|music/.test(ql)) query = 'music';
    else if (/thể thao|sport/.test(ql)) query = 'sports';
    else if (/english|eng|anh/.test(ql)) query = 'english';
    else if (/news|tin/.test(ql)) query = 'news';
    return {
      reply: vi
        ? `Mình sẽ tìm nguồn playlist phù hợp (“${query}”), xem trước (dryRun), rồi bạn xác nhận để nhập.`
        : `I'll find matching playlist sources (“${query}”), preview (dryRun), then wait for your confirmation to import.`,
      actions: [
        { name: 'find_sources', args: { query } },
        { name: 'import_source', args: { sourceId: query === 'vietnam' ? 'iptv-org-vn' : query === 'english' ? 'iptv-org-eng' : query === 'music' ? 'iptv-org-music' : query === 'sports' ? 'iptv-org-sports' : 'iptv-org-news', dryRun: true } }
      ]
    };
  }

  if (/help|hướng dẫn|giúp/.test(ql)) {
    return {
      reply: vi
        ? 'Retro TV: ✎ nhập M3U; AI: “cho kênh tin tức tiếng Anh” → tìm nguồn + xem trước; “xác nhận nhập” để nạp thật.'
        : 'Retro TV: ✎ import M3U; AI: “English news channels” → find source + preview; “confirm import” to apply.',
      actions: []
    };
  }

  if (/xác nhận|confirm|nhập thật|import now|dryRun:\s*false/.test(ql)) {
    return {
      reply: vi
        ? 'Đang nhập nguồn đã xem trước (iptv-org).'
        : 'Importing the previously previewed allowlisted source.',
      actions: [{ name: 'import_source', args: { sourceId: 'iptv-org-vn', dryRun: false, confirm: true } }]
    };
  }

  return {
    reply: vi
      ? 'Bạn có thể nói: “cho tôi kênh Việt Nam”, “kênh tin tức tiếng Anh”, hoặc dùng ✎ → Nhập M3U.'
      : 'Try: “Vietnam channels”, “English news channels”, or ✎ → Import M3U.',
    actions: []
  };
}

module.exports = { knowledge, actions, getContext, executeAction, localReply };
