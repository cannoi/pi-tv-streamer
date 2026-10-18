const knowledge = `
Pi Vintage TV v1.9.14
- Saving AI API key: allowed from any client when ADMIN_TOKEN is not set (SoloHost OK).
- Channel search: tries iptv-org country/category indexes, then GitHub search, then news fallback.
- Preview first; user says confirm import / xác nhận nhập to save.
- Default UI language English. Reply in user language.
`;

const actions = [
  { name: 'smart_import', description: 'Find and preview/import channels', requiresConfirmation: true },
  { name: 'github_search', description: 'List GitHub playlist hits', requiresConfirmation: false },
  { name: 'show_remote_access', description: 'QR', requiresConfirmation: false },
  { name: 'search_channels', description: 'Search library', requiresConfirmation: false },
  { name: 'switch_channel', description: 'Switch', requiresConfirmation: false },
  { name: 'next_channel', description: 'Next', requiresConfirmation: false },
  { name: 'prev_channel', description: 'Prev', requiresConfirmation: false },
  { name: 'help', description: 'Help', requiresConfirmation: false }
];
const ALLOWED = new Set(actions.map(a => a.name));
function isVi(q) {
  return /[àáạảãâăđèéêìíòóôơùúý]/.test(q) || /\b(kênh|xác nhận|truy cập|tìm)\b/.test(q);
}
async function getContext() { return { app: 'Pi Vintage TV', version: '1.9.14' }; }
async function executeAction({ name, args }) {
  if (!ALLOWED.has(name)) return { ok: false, error: 'not_allowed' };
  return { ok: true, action: name, args: args || {}, clientExecute: true };
}
async function localReply(message) {
  const q = String(message || '').trim();
  const ql = q.toLowerCase();
  const vi = isVi(ql);
  if (/qr|remote|truy cập|từ xa/.test(ql)) {
    return { reply: vi ? 'Creating QR…' : 'Creating QR…', actions: [{ name: 'show_remote_access', args: {} }] };
  }
  if (/xác nhận|confirm import|nhập thật|đồng ý nhập/.test(ql)) {
    return {
      reply: vi ? 'Saving playlist to server library…' : 'Saving playlist to server library…',
      actions: [{ name: 'smart_import', args: { query: q, confirm: true, usePending: true } }]
    };
  }
  const urlMatch = q.match(/https?:\/\/\S+\.m3u8?\S*/i);
  if (urlMatch) {
    return {
      reply: vi ? 'Previewing your link…' : 'Previewing your link…',
      actions: [{ name: 'smart_import', args: { url: urlMatch[0], confirm: false } }]
    };
  }
  if (/kênh|channel|iptv|m3u|playlist|github|vietnam|việt|india|ấn độ|tìm|news|tin tức/.test(ql)) {
    return {
      reply: vi
        ? 'Searching public catalogs… (preview only — say “xác nhận nhập” to save)'
        : 'Searching public catalogs… (preview only — say “confirm import” to save)',
      actions: [{ name: 'smart_import', args: { query: q, confirm: false } }]
    };
  }
  if (/help|hướng dẫn/.test(ql)) {
    return {
      reply: vi
        ? 'Set AI key in Settings · “tìm kênh Việt Nam” · “xác nhận nhập” · ✎ Import M3U'
        : 'Set AI key in Settings · “find Vietnam channels” · “confirm import” · ✎ Import M3U',
      actions: []
    };
  }
  return {
    reply: vi ? 'Search channels, import M3U, or QR?' : 'Search channels, import M3U, or need a QR?',
    actions: []
  };
}
module.exports = { knowledge, actions, getContext, executeAction, localReply };
