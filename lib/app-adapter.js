const knowledge = `
Pi Vintage TV v1.9.4 — Retro player + server channel library.
NO hard-coded country stream packs. NO auto-import without user confirmation.
AI flow: match query → preview catalog (India, Vietnam, News…) → user says "confirm import" → save data/library.json.
Tier-1 AI fetch hosts: iptv-org.github.io only by default.
User may import any M3U via ✎ (file/URL/paste) with awareness of source host.
Remote QR: show_remote_access. Hub: radio/media/podcast/EPG.
Reply in user language.
`;

const actions = [
  { name: 'smart_import', description: 'Preview or import catalog. Args: query, confirm?:boolean', requiresConfirmation: true },
  { name: 'github_search', description: 'Optional GitHub suggestions (off unless asked)', requiresConfirmation: false },
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
  return /[àáạảãâăđèéêìíòóôơùúý]/.test(q) || /\b(kênh|ấn độ|xác nhận|truy cập)\b/.test(q);
}

async function getContext() {
  return { app: 'Pi Vintage TV', version: '1.9.4' };
}
async function executeAction({ name, args }) {
  if (!ALLOWED.has(name)) return { ok: false, error: 'not_allowed' };
  return { ok: true, action: name, args: args || {}, clientExecute: true };
}

async function localReply(message) {
  const q = String(message || '').trim();
  const ql = q.toLowerCase();
  const vi = isVi(ql);

  if (/qr|từ xa|remote|truy cập|access link/.test(ql)) {
    return {
      reply: vi ? 'Tạo link + QR truy cập từ xa…' : 'Creating remote link + QR…',
      actions: [{ name: 'show_remote_access', args: {} }]
    };
  }

  if (/xác nhận|confirm import|nhập thật|đồng ý nhập/.test(ql)) {
    // Client will use pending query if any
    return {
      reply: vi ? 'Đang nhập nguồn đã xem trước vào kho server…' : 'Importing the previewed catalog into the server library…',
      actions: [{ name: 'smart_import', args: { query: q, confirm: true, usePending: true } }]
    };
  }

  if (/kênh|channel|iptv|m3u|playlist|tin tức|news|ấn độ|india|vietnam|việt|japan|korea|sport|thể thao|phim|movie/.test(ql)) {
    return {
      reply: vi
        ? 'Đang tìm catalog công khai khớp yêu cầu và xem trước (chưa nhập kho). Bạn trả lời “xác nhận nhập” nếu muốn lưu.'
        : 'Matching a public catalog and previewing (not saved yet). Reply “confirm import” to save.',
      actions: [{ name: 'smart_import', args: { query: q, confirm: false } }]
    };
  }

  if (/help|hướng dẫn/.test(ql)) {
    return {
      reply: vi
        ? 'Ví dụ: “kênh Ấn Độ” → xem trước iptv-org India → “xác nhận nhập”. ✎ để sửa/xóa/★. “QR truy cập” để lấy QR.'
        : 'Example: “India channels” → preview iptv-org India → “confirm import”. ✎ to edit. “Access QR” for QR.',
      actions: []
    };
  }

  return {
    reply: vi
      ? 'Bạn muốn xem trước catalog nào (Ấn Độ, Việt Nam, tin tức…) hoặc QR truy cập?'
      : 'Preview which catalog (India, Vietnam, news…) or need an access QR?',
    actions: []
  };
}

module.exports = { knowledge, actions, getContext, executeAction, localReply };
