/**
 * Pi Vintage TV — AI app adapter
 * localReply can return { reply, actions } so offline / timeout still adds channels.
 */

const FREE_VN_STREAMS = [
  { name: 'HTV7', url: 'https://dethich.pw/htv7/index.m3u8' },
  { name: 'HTV9', url: 'https://dethich.pw/htv9/index.m3u8' },
  { name: 'HTV1', url: 'https://dethich.pw/htv1/index.m3u8' },
  { name: 'HTV2', url: 'https://dethich.pw/htv2/index.m3u8' },
  { name: 'HTV3', url: 'https://dethich.pw/htv3/index.m3u8' },
  { name: 'QPVN', url: 'https://qpvn.vn/live/qpvn/master.m3u8' },
  { name: 'ANTV', url: 'https://liveh12.vtvprime.vn/hls/ANNINHTV/index.m3u8' },
  { name: 'Cần Thơ TV', url: 'https://live.canthotv.vn/live/tv/chunklist.m3u8' },
  { name: 'Đà Nẵng 1', url: 'https://live.mediatech.vn/live/285b59a111d76974225a8e3004bfc31a509/chunklist.m3u8' },
  { name: 'VTV1', url: 'https://vips-livecdn.fptplay.net/hda1/vtv1hd_vhls.smil/chunklist_b5000000.m3u8' },
  { name: 'VTV3', url: 'https://vips-livecdn.fptplay.net/hda1/vtv3hd_vhls.smil/chunklist_b5000000.m3u8' },
  { name: 'NASA TV', url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-Public/master.m3u8' }
];

const knowledge = `
APP NAME: Pi Vintage TV (pi-tv-streamer)
VERSION: 1.7.1
TYPE: International retro TV streaming web app (English + Vietnamese)

WHEN USER ASKS FOR FREE VIETNAMESE CHANNELS / MORE CHANNELS / LINKS:
- You MUST emit add_channel actions (not only text).
- Use the FREE STREAM CATALOG below (public HLS). Emit one add_channel per stream, max 8 per reply.
- Example JSON:
  {"reply":"Đã thêm các kênh miễn phí phổ biến.","actions":[
    {"name":"add_channel","args":{"name":"HTV7","url":"https://dethich.pw/htv7/index.m3u8"}},
    {"name":"add_channel","args":{"name":"QPVN","url":"https://qpvn.vn/live/qpvn/master.m3u8"}}
  ]}
- Never claim success without actions.
- If user says "thêm tất cả" / "add all", emit add_channel for every catalog entry not already implied.

FREE STREAM CATALOG (public HLS — may be geo-limited):
${FREE_VN_STREAMS.map(s => `- ${s.name}: ${s.url}`).join('\n')}

OTHER FEATURES:
- Themes: International Red, SAMPO Cream, Samsung Deluxe (set_theme)
- Countries: vn, us, jp, kr, eu, intl (set_country)
- switch_channel / next_channel / prev_channel / list_channels
- toggle_fullscreen, toggle_power, toggle_bw
- Fullscreen control is a small icon on the CRT (hover to see)

LANGUAGE: Always reply in the user's language (Vietnamese or English).
Return ONLY JSON: {"reply":"...","actions":[...]}
`;

const actions = [
  { name: 'list_channels', description: 'List current available channels', requiresConfirmation: false },
  { name: 'switch_channel', description: 'Switch channel by index or name. Args: index or name', requiresConfirmation: false },
  { name: 'next_channel', description: 'Next channel', requiresConfirmation: false },
  { name: 'prev_channel', description: 'Previous channel', requiresConfirmation: false },
  { name: 'add_channel', description: 'Add custom channel. Args: name, url (.m3u8)', requiresConfirmation: false },
  { name: 'remove_channel', description: 'Remove channel by id or name', requiresConfirmation: false },
  { name: 'set_theme', description: 'Theme: international | sampo | samsung', requiresConfirmation: false },
  { name: 'set_country', description: 'Country: vn | us | jp | kr | eu | intl', requiresConfirmation: false },
  { name: 'toggle_power', description: 'Toggle power', requiresConfirmation: false },
  { name: 'toggle_bw', description: 'Toggle B&W', requiresConfirmation: false },
  { name: 'toggle_fullscreen', description: 'Toggle fullscreen', requiresConfirmation: false },
  { name: 'help', description: 'Short help', requiresConfirmation: false }
];

const ALLOWED = new Set(actions.map(a => a.name));

function wantsChannelList(q) {
  return /kênh|channel|m3u8|miễn phí|free\s*tv|danh sách|thêm tất cả|add all|nhiều kênh|more channel|link.*kênh|kênh.*link/i.test(q);
}

function wantsAddAll(q) {
  return /thêm tất cả|add all|thêm hết|add them all|thêm các kênh|add these|add the list/i.test(q);
}

async function getContext() {
  return {
    app: 'Pi Vintage TV',
    version: '1.7.1',
    freeCatalogCount: FREE_VN_STREAMS.length
  };
}

async function executeAction({ name, args }) {
  if (!ALLOWED.has(name)) return { ok: false, error: 'Action not allowed', action: name };
  return { ok: true, action: name, args: args || {}, clientExecute: true };
}

async function localReply(message, live) {
  const q = String(message || '');
  const ql = q.toLowerCase();
  const vi = /[àáạảãâăđèéêìíòóôơùúý]/.test(ql) ||
    /\b(kênh|tìm|thêm|xóa|chuyển|giúp|danh sách|miễn phí)\b/.test(ql);

  if (wantsChannelList(ql) || wantsAddAll(ql)) {
    const acts = FREE_VN_STREAMS.map(s => ({
      name: 'add_channel',
      args: { name: s.name, url: s.url }
    }));
    const names = FREE_VN_STREAMS.map(s => s.name).join(', ');
    return {
      reply: vi
        ? `Mình sẽ thêm các kênh miễn phí công khai: ${names}. (Một số kênh có thể bị chặn theo vùng mạng.)`
        : `Adding public free channels: ${names}. (Some may be geo-restricted.)`,
      actions: acts
    };
  }

  if (/help|hướng dẫn|giúp|how to|cách dùng/.test(ql)) {
    return {
      reply: vi
        ? 'Pi Vintage TV: ⏮/⏭ đổi kênh; ✎ quản lý kênh; nhờ AI “cho danh sách kênh miễn phí Việt Nam” để tự thêm; nút full màn hình nhỏ góc TV.'
        : 'Pi Vintage TV: ⏮/⏭ change channel; ✎ manage channels; ask AI for “free Vietnam channels” to auto-add; small fullscreen icon on the CRT.',
      actions: []
    };
  }

  if (/theme|khung|samsung|sampo|international/.test(ql)) {
    return {
      reply: vi
        ? 'Có 3 khung: International, SAMPO, Samsung. Nói “đặt theme samsung”.'
        : 'Three frames: International, SAMPO, Samsung. Say “set theme samsung”.',
      actions: []
    };
  }

  return {
    reply: vi
      ? 'Mình có thể tự thêm kênh miễn phí VN, chuyển/xóa kênh, đổi theme. Thử: “Cho tôi danh sách kênh miễn phí Việt Nam”.'
      : 'I can auto-add free VN channels, switch/remove channels, change theme. Try: “Give me free Vietnam TV channels”.',
    actions: []
  };
}

module.exports = {
  knowledge,
  actions,
  getContext,
  executeAction,
  localReply,
  FREE_VN_STREAMS
};
