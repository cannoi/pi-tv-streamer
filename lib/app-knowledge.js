'use strict';
/**
 * What the AI Panel knows about the app. Keep this file in step with the code:
 * test/ai-knowledge.test.js fails when a documented action is missing or unknown.
 *  - buildKnowledge(version): system-prompt knowledge for the cloud model
 *  - FAQ: offline "local guide" answers (EN + VI) used when no AI key is set or the provider is down
 */

function buildKnowledge(version) {
  return `
Pi Vintage TV v${version} — retro CRT TV player + IPTV channel library + entertainment hub.
UI languages: English and Vietnamese (language button in the header). ALWAYS reply in the language of the user's latest message.

WATCHING
- Power button: 1st press mutes the static noise; a 2nd press within 5 s enters TV-only (cinema) mode; otherwise it powers off. In TV-only mode the Exit button or Esc leaves it. Tapping the screen while the TV is off switches it on.
- Change channel: previous/next buttons, the channel knob, the channel list, swipe on the screen (up or left = next, down or right = previous), arrow keys / PageUp / PageDown, or type the channel number on the keyboard.
- Fullscreen: DOUBLE-tap (or double-click) the TV screen — a single tap does nothing. Also the button on the screen or the F key. On phones it switches to landscape.
- Keyboard: Left/Right (or PageUp/PageDown) = channel, Up/Down = volume, F = fullscreen, M = mute, Space or K = pause/play, H = Hub, digits = channel number, Esc = leave TV-only mode.

NO-SIGNAL SKIPPING (v1.9.19)
- A channel that shows no picture within 10 s, or fails with a fatal stream error, is marked "no signal" (shown with ✕ in the channel list).
- Next / previous / swipe / arrow keys skip channels marked no signal. If the channel you land on turns out to be dead, the app skips to the next working one by itself (on-screen text "No signal: <name> → skipping").
- A library channel with backup sources tries those first; only then it is marked.
- Nothing is deleted: marked channels are tried again after 10 minutes, or right away with the action retry_channels. Picking a channel from the list always tries it, even if marked.
- If every channel is marked, the screen says "No channel has a signal" — usually an internet problem, not the channels.

PICTURE QUALITY (v1.9.19)
- Default "clear picture": while a real stream plays, the video has no CSS filter, the scanlines/vignette/glare are light and the noise overlay is off. HLS starts at a quality level that fits the screen size and the connection, then keeps adapting. The retro CRT look returns on static / no signal / power off.
- Switch with the action set_picture {mode:"clear"} or {mode:"retro"} (saved in this browser). The black-and-white button and the 3 TV themes (International, SAMPO, Samsung) are separate.
- Sharpness is also limited by the source: a low-resolution stream cannot become sharper, and fullscreen enlarges it.

MEMORY
- Last channel, history, favorites, custom channels, volume/mute, language, theme and country are saved in this browser first (localStorage) and synced to the server (data/user-state.json), so a reload — or another device on the same server — keeps them. The last channel is restored automatically at start.

CHANNELS AND LIBRARY
- The "Channels / Library" panel imports an M3U (URL, pasted text or file), adds a single channel, lists channels and shows recent history.
- AI channel search (action smart_import): looks in public iptv-org lists, then GitHub, shows a PREVIEW; the user must say "confirm import" / "xác nhận nhập" to save to the server library.
- The app only plays public streams. Expired, restricted or geo-blocked links cannot be made to work by the app.

HUB: Discover (GitHub playlists), Radio, Media (./media folder), Podcast (RSS), VOD (public-domain films from Archive.org), EPG (XMLTV guide).
AI PANEL: Chat, Feedback, Settings (provider, API key, model) and Logs. Opening the panel shows a QR code for remote access. The API key is stored on the server and never shown again.
`;
}

const Q = /\?|\b(how|why|where|what|which)\b|làm sao|lam sao|thế nào|the nao|cách|cach|tại sao|tai sao|ở đâu|o dau|là gì|la gi/i;
const isQuestion = (t) => Q.test(t);

/** Each entry: re = trigger, en/vi = answer, action(t) = optional client action for imperative requests. */
const FAQ = [
  {
    id: 'fullscreen',
    re: /full ?screen|toàn màn hình|toan man hinh|double.?tap|nhấn đúp|nhan dup|bấm đúp|bam dup|nhấp đúp|nhap dup/i,
    en: 'Double-tap (or double-click) the TV screen to switch fullscreen on and off — a single tap does nothing. You can also use the button on the screen or press F. On a phone it turns to landscape.',
    vi: 'Nhấn đúp (2 lần liên tiếp) lên màn hình TV để bật/tắt toàn màn hình — nhấn một lần sẽ không làm gì. Bạn cũng có thể dùng nút trên màn hình hoặc phím F. Trên điện thoại màn hình sẽ xoay ngang.',
    action: (t) => (isQuestion(t) ? null : { name: 'toggle_fullscreen', args: {}, say: 'fsDone' })
  },
  {
    id: 'nosignal',
    re: /no signal|skip(ping)?|dead channel|không có tín hiệu|khong co tin hieu|mất tín hiệu|mat tin hieu|bỏ qua|bo qua|kênh (chết|hỏng|lỗi)|kenh (chet|hong|loi)|retry|thử lại|thu lai/i,
    en: 'Next/previous, swipe and the arrow keys skip channels that have no signal. A channel is marked (✕ in the list) after 10 s without a picture or a fatal stream error, and if you land on a dead one the app hops to the next working channel by itself. Nothing is deleted: marked channels are tried again after 10 minutes. Say “retry channels” to try them all again now.',
    vi: 'Nút kênh trước/sau, vuốt và phím mũi tên tự bỏ qua kênh không có tín hiệu. Kênh bị đánh dấu (✕ trong danh sách) sau 10 giây không có hình hoặc lỗi luồng nghiêm trọng; nếu bạn rơi vào kênh chết, app tự nhảy sang kênh có tín hiệu kế tiếp. Không kênh nào bị xóa: kênh bị đánh dấu sẽ được thử lại sau 10 phút. Nói “thử lại các kênh” để thử lại tất cả ngay.',
    action: (t) => (/retry|thử lại|thu lai|reset/i.test(t) ? { name: 'retry_channels', args: {}, say: 'retryDone' } : null)
  },
  {
    id: 'picture',
    re: /sharp|clear|blur|quality|\bhd\b|crisp|retro look|sắc nét|sac net|rõ nét|ro net|\bmờ\b|\bmo\b|chất lượng|chat luong|hình ảnh|hinh anh|độ nét|do net/i,
    en: 'By default the picture is “clear”: while a real stream plays there is no video filter, the CRT effects are light and the stream starts at a quality that fits your screen and connection. The retro CRT look returns on static or when there is no signal. Say “retro picture” or “clear picture” to switch. A low-resolution source cannot become sharper, and fullscreen enlarges it.',
    vi: 'Mặc định hình ảnh ở chế độ “rõ nét”: khi đang phát luồng thật sẽ không có bộ lọc video, hiệu ứng TV cũ nhẹ đi và luồng bắt đầu ở chất lượng phù hợp với màn hình và đường truyền. Hiệu ứng TV cũ quay lại khi có nhiễu hoặc mất tín hiệu. Nói “hình ảnh TV cũ” hoặc “hình ảnh rõ nét” để chuyển. Nguồn phát độ phân giải thấp không thể nét hơn, và toàn màn hình sẽ phóng to nó.',
    action: (t) => {
      if (isQuestion(t) && !/(switch|set|turn|đổi|doi|chuyển|chuyen)/i.test(t)) return null;
      if (/retro|cũ|cu\b|crt/i.test(t)) return { name: 'set_picture', args: { mode: 'retro' }, say: 'picRetro' };
      if (/clear|sharp|rõ|ro net|nét|net\b|hd/i.test(t)) return { name: 'set_picture', args: { mode: 'clear' }, say: 'picClear' };
      return null;
    }
  },
  {
    id: 'swipe',
    re: /swipe|vuốt|vuot/i,
    en: 'Swipe up or left on the TV screen for the next channel, down or right for the previous one. Channels without signal are skipped automatically.',
    vi: 'Vuốt lên hoặc sang trái trên màn hình TV để sang kênh kế, vuốt xuống hoặc sang phải để về kênh trước. Kênh không có tín hiệu sẽ tự được bỏ qua.'
  },
  {
    id: 'keys',
    re: /shortcut|keyboard|hotkey|phím tắt|phim tat|bàn phím|ban phim|phím nào|phim nao/i,
    en: 'Keyboard: Left/Right (or PageUp/PageDown) = channel · Up/Down = volume · F = fullscreen · M = mute · Space or K = pause/play · H = Hub · digits = channel number · Esc = leave TV-only mode.',
    vi: 'Phím tắt: Trái/Phải (hoặc PageUp/PageDown) = đổi kênh · Lên/Xuống = âm lượng · F = toàn màn hình · M = tắt tiếng · Space hoặc K = tạm dừng/phát · H = Hub · phím số = số kênh · Esc = thoát chế độ chỉ khung TV.'
  },
  {
    id: 'memory',
    re: /history|remember|memory|favou?rite|last channel|lịch sử|lich su|nhớ|nho kenh|yêu thích|yeu thich|kênh cuối|kenh cuoi|reload|tải lại|tai lai/i,
    en: 'The app remembers your last channel, history, favorites, custom channels, volume, language and theme — saved in this browser first and synced to the server, so a reload or another device keeps them. The last channel is restored automatically when the page opens.',
    vi: 'App nhớ kênh xem gần nhất, lịch sử, kênh yêu thích, kênh tự thêm, âm lượng, ngôn ngữ và giao diện — lưu trong trình duyệt trước rồi đồng bộ lên máy chủ, nên tải lại trang hoặc dùng thiết bị khác vẫn còn. Kênh gần nhất được tự mở lại khi vào trang.'
  }
];

module.exports = { buildKnowledge, FAQ, isQuestion };
