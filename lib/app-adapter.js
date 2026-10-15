/**
 * Pi Vintage TV — AI app adapter
 * Whitelist actions for channel control + offline localReply.
 */

const knowledge = `
APP NAME: Pi Vintage TV (pi-tv-streamer)
VERSION: 1.7.0
TYPE: International retro TV streaming web app (English + Vietnamese)

MAIN FEATURES:
- Three pure-CSS vintage TV frames: International Red (default), SAMPO Cream, Samsung Deluxe
- HLS video playback inside CRT (hls.js), with audio unmute after user gesture
- Country-based free channels (VN default, US, JP, KR, EU, International)
- Auto-probe filters out dead streams so only working channels appear in the zap list
- Channel manager (✎): add / edit / delete custom channels (saved in localStorage)
- Power button: classic power icon; double-press enters TV-only focus mode
- B&W (black & white) phosphor toggle, language toggle VI/EN
- After ~10s of playback, video is fitted into the CRT (signal lock)
- Static noise auto-mutes after 3 minutes of viewing
- Fullscreen control on the video (browser Fullscreen API)
- AI panel (robot FAB): Chat, Feedback, Settings, Logs — can switch/add/remove channels via actions

USER WORKFLOWS:
1. Open app → TV fills browser → channels are probed → first live stream plays
2. Change channel with Prev/Next or the channel dropdown
3. Change theme (International / SAMPO / Samsung) from header select
4. Add custom .m3u8 via ✎ channel manager
5. Click fullscreen icon on the CRT to expand video
6. Ask AI e.g. "tìm kênh miễn phí Việt Nam" → AI may list suggestions and call add_channel / switch_channel

CHANNEL NOTES:
- Prefer public HLS (.m3u8). Official broadcaster pages alone do not play inside the frame.
- VN list includes VTV (FPT CDN when reachable), HTV public streams, QPVN, ANTV, local stations.
- Streams may be geo-restricted; dead ones are filtered automatically.

AI ACTIONS AVAILABLE:
- list_channels: list current zap list
- switch_channel: by index (0-based) or name substring
- next_channel / prev_channel
- add_channel: name + url (.m3u8 preferred)
- remove_channel: by id or name (custom channels only preferred)
- set_theme: international | sampo | samsung
- set_country: vn | us | jp | kr | eu | intl
- toggle_power / toggle_bw / toggle_fullscreen
- help: short usage guide

LANGUAGE: Reply in the user's language (Vietnamese or English).
`;

const actions = [
  { name: 'list_channels', description: 'List current available channels in the zap list', requiresConfirmation: false },
  { name: 'switch_channel', description: 'Switch to a channel by index (0-based) or name substring. Args: index or name', requiresConfirmation: false },
  { name: 'next_channel', description: 'Go to next channel', requiresConfirmation: false },
  { name: 'prev_channel', description: 'Go to previous channel', requiresConfirmation: false },
  { name: 'add_channel', description: 'Add a custom channel. Args: name (string), url (m3u8 or media URL)', requiresConfirmation: false },
  { name: 'remove_channel', description: 'Remove a channel by id or name (custom preferred). Args: id or name', requiresConfirmation: false },
  { name: 'set_theme', description: 'Set TV frame theme: international | sampo | samsung', requiresConfirmation: false },
  { name: 'set_country', description: 'Set country channel pack: vn | us | jp | kr | eu | intl', requiresConfirmation: false },
  { name: 'toggle_power', description: 'Toggle TV power on/off', requiresConfirmation: false },
  { name: 'toggle_bw', description: 'Toggle black & white mode', requiresConfirmation: false },
  { name: 'toggle_fullscreen', description: 'Toggle browser fullscreen on the TV screen', requiresConfirmation: false },
  { name: 'help', description: 'Show short help for using Pi Vintage TV', requiresConfirmation: false }
];

const ALLOWED = new Set(actions.map(a => a.name));

async function getContext() {
  // Server-side has no DOM; client injects live state via chat body when available.
  return {
    app: 'Pi Vintage TV',
    version: '1.7.0',
    features: ['hls', 'vintage-frames', 'channel-manager', 'ai-actions']
  };
}

async function executeAction({ name, args }) {
  if (!ALLOWED.has(name)) return { ok: false, error: 'Action not allowed', action: name };
  // Browser-side actions are executed by public/ai-panel.js via window.__piVintageTv
  // Server acknowledges and returns the action for the client to run.
  return { ok: true, action: name, args: args || {}, clientExecute: true };
}

async function localReply(message, live) {
  const q = String(message || '').toLowerCase();
  const vi = /[àáạảãâăđèéêìíòóôơùúýăạảấầẩẫậắằẳẵặếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/.test(q) ||
    /\b(kênh|tìm|thêm|xóa|chuyển|tiếng|hướng dẫn|giúp)\b/.test(q);

  if (/help|hướng dẫn|giúp|how to|cách dùng/.test(q)) {
    return vi
      ? 'Pi Vintage TV: chọn kênh bằng ⏮/⏭ hoặc danh sách; ✎ để thêm/xóa kênh .m3u8; đổi khung International/SAMPO/Samsung; nút ⛶ full màn hình trên TV. Bạn có thể nhờ AI: “chuyển sang HTV7”, “thêm kênh …”.'
      : 'Pi Vintage TV: use ⏮/⏭ or the channel list; ✎ to add/remove .m3u8 channels; switch International/SAMPO/Samsung frames; fullscreen button on the CRT. Ask AI e.g. “switch to HTV7” or “add channel …”.';
  }
  if (/kênh|channel|list|danh sách|miễn phí|free/.test(q)) {
    return vi
      ? 'Danh sách kênh hiện tại chỉ gồm stream đang hoạt động (đã lọc). Gói VN có VTV/HTV (khi CDN cho phép), QPVN, ANTV, đài địa phương. Nói “liệt kê kênh” để AI gọi list_channels, hoặc “chuyển kênh HTV7”.'
      : 'The zap list only keeps working streams. VN pack includes VTV/HTV (when CDN allows), QPVN, ANTV, local stations. Say “list channels” or “switch to HTV7”.';
  }
  if (/theme|khung|mẫu|samsung|sampo|international/.test(q)) {
    return vi
      ? 'Có 3 khung TV: International (đỏ), SAMPO (kem), Samsung Deluxe. Nói “đặt theme samsung” để AI đổi.'
      : 'Three frames: International (red), SAMPO (cream), Samsung Deluxe. Say “set theme samsung”.';
  }
  if (/full|toàn màn|fullscreen/.test(q)) {
    return vi
      ? 'Bấm biểu tượng full màn hình trên góc màn hình TV, hoặc nhờ AI “bật fullscreen”.'
      : 'Click the fullscreen icon on the CRT, or ask AI to “toggle fullscreen”.';
  }
  return vi
    ? 'Mình là trợ lý Pi Vintage TV. Có thể giúp tìm/thêm/xóa/chuyển kênh, đổi theme, bật fullscreen. Hỏi “hướng dẫn” để xem nhanh.'
    : 'I am the Pi Vintage TV assistant. I can help list/add/remove/switch channels, change theme, or fullscreen. Ask “help” for a quick guide.';
}

module.exports = {
  knowledge,
  actions,
  getContext,
  executeAction,
  localReply
};
