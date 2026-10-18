const knowledge = `
Pi Vintage TV — player + playlist manager (Retro). No piracy packs.
Tools: smart_import(query) one-shot allowlisted import; github_search; import_source; show_remote_access (QR); switch/next/prev channel; open_hub.
When user wants channels, prefer smart_import. Reply in user language.
`;

const actions = [
  { name: 'smart_import', description: 'Search allowlisted public catalog and import channels for query', requiresConfirmation: false },
  { name: 'github_search', description: 'Search GitHub playlists', requiresConfirmation: false },
  { name: 'import_source', description: 'Import sourceId/url', requiresConfirmation: false },
  { name: 'find_sources', description: 'List sources', requiresConfirmation: false },
  { name: 'search_channels', description: 'Search library', requiresConfirmation: false },
  { name: 'switch_channel', description: 'Switch channel', requiresConfirmation: false },
  { name: 'next_channel', description: 'Next', requiresConfirmation: false },
  { name: 'prev_channel', description: 'Prev', requiresConfirmation: false },
  { name: 'show_remote_access', description: 'Show public URL + QR for remote access', requiresConfirmation: false },
  { name: 'open_hub', description: 'Open hub', requiresConfirmation: false },
  { name: 'help', description: 'Help', requiresConfirmation: false }
];
const ALLOWED = new Set(actions.map(a => a.name));

function isVi(q) {
  return /[àáạảãâăđèéêìíòóôơùúý]/.test(q) || /\b(kênh|tìm|nhập|cho tôi|qr|truy cập|từ xa)\b/.test(q);
}

async function getContext() { return { app: 'Pi Vintage TV', version: '1.9.2' }; }
async function executeAction({ name, args }) {
  if (!ALLOWED.has(name)) return { ok: false, error: 'not_allowed' };
  return { ok: true, action: name, args: args || {}, clientExecute: true };
}

async function localReply(message) {
  const q = String(message || '').trim();
  const ql = q.toLowerCase();
  const vi = isVi(ql);

  if (/qr|từ xa|tu xa|remote|truy cập|access link|public url|chia sẻ/.test(ql)) {
    return {
      reply: vi
        ? 'Đây là link + mã QR để mở TV từ thiết bị khác trên SoloHost / IP public.'
        : 'Here is the link + QR code to open this TV from another device (SoloHost / public IP).',
      actions: [{ name: 'show_remote_access', args: {} }]
    };
  }

  if (/xác nhận|confirm import/.test(ql)) {
    return {
      reply: vi ? 'Đang nhập playlist công khai theo yêu cầu trước đó.' : 'Importing the public playlist for your last request.',
      actions: [{ name: 'smart_import', args: { query: q, force: true } }]
    };
  }

  if (/kênh|channel|iptv|m3u|playlist|tin tức|news|miễn phí|vietnam|việt|english/.test(ql)) {
    return {
      reply: vi
        ? 'Đang tìm nguồn công khai phù hợp và nhập vào kho kênh (smart import)…'
        : 'Finding a matching public catalog and importing into the library…',
      actions: [{ name: 'smart_import', args: { query: q } }]
    };
  }

  if (/hub|radio|podcast|media/.test(ql)) {
    return { reply: vi ? 'Mở Hub ✦' : 'Opening Hub ✦', actions: [{ name: 'open_hub', args: {} }] };
  }

  if (/help|hướng dẫn/.test(ql)) {
    return {
      reply: vi
        ? '“Cho tôi kênh Việt Nam” → tự nhập playlist công khai. “QR truy cập” → link+QR. ✎ nhập file M3U. Vuốt/←→ đổi kênh.'
        : '“Vietnam channels” → import public playlist. “Access QR” → link+QR. ✎ M3U file. Swipe/arrows change channel.',
      actions: []
    };
  }

  return {
    reply: vi
      ? 'Bạn cần gì? Ví dụ: kênh Việt Nam, tin tức tiếng Anh, hoặc QR truy cập từ xa.'
      : 'What do you need? e.g. Vietnam channels, English news, or remote access QR.',
    actions: []
  };
}

module.exports = { knowledge, actions, getContext, executeAction, localReply };
