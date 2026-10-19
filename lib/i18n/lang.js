'use strict';
/**
 * Language helpers for the AI chat (server side).
 * detectLang(text, uiLang) -> 'vi' | 'en' | script code (zh ja ko ru ar th hi el he)
 *  - Vietnamese: diacritics, or common words typed WITHOUT accents
 *  - other scripts: Unicode block
 *  - short / ambiguous text falls back to the UI language
 */
const VI_DIACRITICS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const VI_PLAIN = /\b(kenh|tim|phim|nhac|cho toi|toi muon|giup|xin chao|cam on|nhap|xoa|doi kenh|chuyen kenh|viet nam|xem|giao dien|yeu thich|lich su|truyen hinh|toan man hinh|nhan dup|tin hieu|ban co|khong|duoc|nhe|nao|dang|cua|sac net|ro net|chat luong|hinh anh)\b/i;
const EN_WORDS = /\b(the|and|what|how|why|show|find|play|channel|channels|please|open|switch|change|search|history|favorite|favorites|watch|news|movie|hello|hi|thanks|can|you|my|fullscreen|signal|skip|picture|quality|sharp|confirm|import|retry|enable|disable|turn|does|there|any|about|with|for|are|is|keyboard|shortcut|shortcuts|swipe|remember|memory|go|set|clear)\b/i;
const SCRIPTS = [
  ['ja', /[\u3040-\u30ff]/], ['zh', /[\u4e00-\u9fff]/], ['ko', /[\uac00-\ud7af]/], ['ru', /[\u0400-\u04ff]/],
  ['ar', /[\u0600-\u06ff]/], ['th', /[\u0e00-\u0e7f]/], ['hi', /[\u0900-\u097f]/], ['el', /[\u0370-\u03ff]/], ['he', /[\u0590-\u05ff]/]
];
const NAMES = { vi: 'Vietnamese', en: 'English', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', ru: 'Russian', ar: 'Arabic', th: 'Thai', hi: 'Hindi', el: 'Greek', he: 'Hebrew' };

function detectLang(text, uiLang) {
  const s = String(text || '').trim();
  const fallback = uiLang === 'vi' ? 'vi' : 'en';
  if (!s) return fallback;
  if (VI_DIACRITICS.test(s)) return 'vi';
  for (const [code, re] of SCRIPTS) if (re.test(s)) return code;
  const low = s.toLowerCase();
  const vi = VI_PLAIN.test(low), en = EN_WORDS.test(low);
  if (vi && !en) return 'vi';
  if (en && !vi) return 'en';
  return fallback;
}
function langName(code) { return NAMES[code] || 'English'; }

/** Offline ("local guide") strings. Only EN + VI exist; other languages get EN. */
const MSG = {
  en: {
    qr: 'Creating the access QR code…',
    saving: 'Saving the playlist to the server library…',
    previewLink: 'Previewing your link…',
    search: 'Searching public catalogs… (preview only — say “confirm import” to save)',
    help: 'Set an AI key in Settings · “find Vietnam channels” · “confirm import” · ask me about fullscreen, no-signal skipping, picture quality, shortcuts or memory',
    fallback: 'Search channels, import an M3U, ask how something works (fullscreen, shortcuts, picture quality…), or need a QR?',
    notConfigured: 'AI is not configured. Open Settings, choose a provider and paste an API key.',
    unavailable: 'The AI provider is unavailable right now, so I am using the built-in guide.',
    fsDone: 'Toggling fullscreen…',
    retryDone: 'Cleared the no-signal marks — all channels will be tried again.',
    picClear: 'Switching to the clear picture.',
    picRetro: 'Switching to the retro CRT picture.'
  },
  vi: {
    qr: 'Đang tạo mã QR truy cập…',
    saving: 'Đang lưu playlist vào kho kênh trên máy chủ…',
    previewLink: 'Đang xem trước link của bạn…',
    search: 'Đang tìm trong các danh mục công khai… (chỉ xem trước — nói “xác nhận nhập” để lưu)',
    help: 'Nhập key AI trong Cài đặt · “tìm kênh Việt Nam” · “xác nhận nhập” · hỏi mình về toàn màn hình, bỏ qua kênh mất tín hiệu, độ nét hình, phím tắt hoặc bộ nhớ',
    fallback: 'Bạn muốn tìm kênh, nhập M3U, hỏi cách dùng (toàn màn hình, phím tắt, độ nét…) hay lấy mã QR?',
    notConfigured: 'Chưa cấu hình AI. Mở Cài đặt, chọn nhà cung cấp và dán API key.',
    unavailable: 'Nhà cung cấp AI hiện không phản hồi nên mình dùng hướng dẫn tích hợp sẵn.',
    fsDone: 'Đang bật/tắt toàn màn hình…',
    retryDone: 'Đã bỏ đánh dấu mất tín hiệu — mọi kênh sẽ được thử lại.',
    picClear: 'Chuyển sang hình ảnh rõ nét.',
    picRetro: 'Chuyển sang hình ảnh kiểu TV cũ.'
  }
};
function msg(lang, key) { return (MSG[lang] || MSG.en)[key] || MSG.en[key] || ''; }

module.exports = { detectLang, langName, msg, MSG };
