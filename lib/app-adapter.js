const knowledge = `
Pi Vintage TV v1.9.8 — Retro CRT TV + server channel library (EN/VI).

FEEDBACK HUB (built-in, no user setup)
- Connected automatically for Feedback tab / notices.
- Users do not need to enter Hub ID, URL, or token.

CHANNELS
- Nothing pirated is shipped. Empty library by default.
- AI: preview public iptv-org catalogs by intent (India, Vietnam, news…) then user says "confirm import" / "xác nhận nhập".
- ✎ manage: groups, favorite, delete — saved on server (data/library.json), shared on this instance.
- Import M3U via ✎ (file / URL / paste).

CONTROLS
- Swipe or ←/→ change channel (works in fullscreen)
- Digits · F fullscreen · H hub · ✎ channels
- Hub: Radio, Media, Podcast, VOD (Archive.org links), EPG, Discover
- "QR truy cập" / remote access → link + QR in AI chat (SOLOHOST_PUBLIC_URL recommended)

DOCKER
- Port 8080, GET /health → ok

Reply in the user's language. Be a practical helper for everyday viewers.
`;

const actions = [
  { name: 'smart_import', description: 'Preview/import catalog; confirm:true only after user confirms', requiresConfirmation: true },
  { name: 'show_remote_access', description: 'QR + public URL in chat', requiresConfirmation: false },
  { name: 'search_channels', description: 'Search library', requiresConfirmation: false },
  { name: 'switch_channel', description: 'Switch channel', requiresConfirmation: false },
  { name: 'next_channel', description: 'Next', requiresConfirmation: false },
  { name: 'prev_channel', description: 'Prev', requiresConfirmation: false },
  { name: 'open_hub', description: 'Open hub', requiresConfirmation: false },
  { name: 'help', description: 'Help', requiresConfirmation: false }
];
const ALLOWED = new Set(actions.map(a => a.name));
function isVi(q) {
  return /[àáạảãâăđèéêìíòóôơùúý]/.test(q) || /\b(kênh|ấn độ|xác nhận|truy cập|hướng dẫn|góp ý|feedback)\b/.test(q);
}
async function getContext() {
  return { app: 'Pi Vintage TV', version: '1.9.8', feedback: 'built-in', health: '/health' };
}
async function executeAction({ name, args }) {
  if (!ALLOWED.has(name)) return { ok: false, error: 'not_allowed' };
  return { ok: true, action: name, args: args || {}, clientExecute: true };
}
async function localReply(message) {
  const q = String(message || '').trim();
  const ql = q.toLowerCase();
  const vi = isVi(ql);
  if (/feedback|góp ý|báo lỗi|liên hệ/.test(ql)) {
    return {
      reply: vi
        ? 'Mở tab Feedback trên nút robot AI để gửi góp ý. Hub đã cấu hình sẵn, không cần nhập token.'
        : 'Open the Feedback tab on the AI robot button. The hub is preconfigured — no token entry needed.',
      actions: []
    };
  }
  if (/qr|từ xa|remote|truy cập|access link/.test(ql)) {
    return { reply: vi ? 'Tạo link + QR…' : 'Creating link + QR…', actions: [{ name: 'show_remote_access', args: {} }] };
  }
  if (/xác nhận|confirm import|nhập thật/.test(ql)) {
    return {
      reply: vi ? 'Đang nhập catalog đã xem trước…' : 'Importing previewed catalog…',
      actions: [{ name: 'smart_import', args: { query: q, confirm: true, usePending: true } }]
    };
  }
  if (/kênh|channel|iptv|m3u|playlist|tin tức|news|ấn độ|india|vietnam|việt|japan|korea|sport|thể thao|phim|movie/.test(ql)) {
    return {
      reply: vi
        ? 'Xem trước catalog công khai (chưa lưu). Nói “xác nhận nhập” để lưu kho server.'
        : 'Previewing a public catalog (not saved yet). Say “confirm import” to save.',
      actions: [{ name: 'smart_import', args: { query: q, confirm: false } }]
    };
  }
  if (/help|hướng dẫn/.test(ql)) {
    return {
      reply: vi
        ? '• Kênh: xem trước → xác nhận nhập · ✎ sửa danh sách\n• Vuốt/←→ đổi kênh · H Hub · QR truy cập\n• Góp ý: tab Feedback (đã sẵn Hub)'
        : '• Channels: preview → confirm import · ✎ edit list\n• Swipe/arrows · H Hub · access QR\n• Feedback tab (hub preconfigured)',
      actions: []
    };
  }
  return {
    reply: vi
      ? 'Bạn cần catalog kênh, QR từ xa, hay gửi Feedback?'
      : 'Need a channel catalog, remote QR, or Feedback?',
    actions: []
  };
}
module.exports = { knowledge, actions, getContext, executeAction, localReply };
