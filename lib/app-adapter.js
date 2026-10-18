const knowledge = `
Pi Vintage TV v1.9.13
- Default channel zap list restored (user can still import more).
- AI can DYNAMICALLY search GitHub for public M3U playlists (no hardcoded repo list).
- Flow: user asks "Vietnam channels" → smart_import preview → user "confirm import" → save data/library.json.
- History/favorites on server disk. Default UI language English; reply in user language.
- Never invent stream URLs; only use search results or user-pasted links.
`;

const actions = [
  { name: 'smart_import', description: 'Search/preview/import playlists dynamically', requiresConfirmation: true },
  { name: 'github_search', description: 'Search GitHub for m3u playlists', requiresConfirmation: false },
  { name: 'show_remote_access', description: 'QR remote access', requiresConfirmation: false },
  { name: 'search_channels', description: 'Search library', requiresConfirmation: false },
  { name: 'switch_channel', description: 'Switch', requiresConfirmation: false },
  { name: 'next_channel', description: 'Next', requiresConfirmation: false },
  { name: 'prev_channel', description: 'Prev', requiresConfirmation: false },
  { name: 'help', description: 'Help', requiresConfirmation: false }
];
const ALLOWED = new Set(actions.map(a => a.name));
function isVi(q) {
  return /[àáạảãâăđèéêìíòóôơùúý]/.test(q) || /\b(kênh|xác nhận|truy cập|github|tìm)\b/.test(q);
}
async function getContext() { return { app: 'Pi Vintage TV', version: '1.9.13' }; }
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
      reply: vi ? 'Importing previewed playlist…' : 'Importing previewed playlist…',
      actions: [{ name: 'smart_import', args: { query: q, confirm: true, usePending: true } }]
    };
  }
  // Detect pasted m3u URL
  const urlMatch = q.match(/https?:\/\/\S+\.m3u8?\S*/i) || q.match(/https?:\/\/\S+/i);
  if (urlMatch && /m3u/i.test(urlMatch[0])) {
    return {
      reply: vi ? 'Previewing your M3U link…' : 'Previewing your M3U link…',
      actions: [{ name: 'smart_import', args: { query: q, url: urlMatch[0], confirm: false } }]
    };
  }
  if (/github|repo|playlist|m3u|iptv|kênh|channel|vietnam|việt|india|ấn độ|news|tin tức|tìm/.test(ql)) {
    return {
      reply: vi
        ? 'Đang tìm playlist công khai (GitHub search động, không khóa repo) — xem trước, chưa lưu. Nói “xác nhận nhập” để lưu.'
        : 'Searching public playlists dynamically (no fixed repo) — preview only. Say “confirm import” to save.',
      actions: [
        { name: 'smart_import', args: { query: q, confirm: false } },
        { name: 'github_search', args: { query: q } }
      ]
    };
  }
  if (/help|hướng dẫn/.test(ql)) {
    return {
      reply: vi
        ? '• Kênh mặc định đã có · “tìm kênh Việt Nam” để search thêm · “xác nhận nhập” · ✎ Import M3U · QR truy cập'
        : '• Defaults onboard · “find Vietnam channels” to search more · “confirm import” · ✎ Import M3U · access QR',
      actions: []
    };
  }
  return {
    reply: vi ? 'Bạn muốn tìm kênh, nhập M3U, hay QR?' : 'Search channels, import M3U, or need a QR?',
    actions: []
  };
}
module.exports = { knowledge, actions, getContext, executeAction, localReply };
