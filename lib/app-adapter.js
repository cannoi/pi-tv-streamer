'use strict';
const { detectLang, msg } = require('./i18n/lang');
const { buildKnowledge, FAQ } = require('./app-knowledge');
let VERSION = '1.9.19';
try { VERSION = require('../package.json').version || VERSION; } catch (_) {}

// Knowledge text lives in lib/app-knowledge.js (kept in sync by test/ai-knowledge.test.js)
const knowledge = buildKnowledge(VERSION);

const actions = [
  { name: 'smart_import', description: 'Find and preview/import channels', requiresConfirmation: true },
  { name: 'github_search', description: 'List GitHub playlist hits', requiresConfirmation: false },
  { name: 'show_remote_access', description: 'QR', requiresConfirmation: false },
  { name: 'search_channels', description: 'Search library', requiresConfirmation: false },
  { name: 'switch_channel', description: 'Switch', requiresConfirmation: false },
  { name: 'next_channel', description: 'Next channel (skips channels without signal)', requiresConfirmation: false },
  { name: 'prev_channel', description: 'Previous channel (skips channels without signal)', requiresConfirmation: false },
  { name: 'list_channels', description: 'Show how many channels are loaded', requiresConfirmation: false },
  { name: 'toggle_fullscreen', description: 'Turn fullscreen on/off', requiresConfirmation: false },
  { name: 'set_picture', description: 'Picture look; args {mode:"clear"|"retro"}', requiresConfirmation: false },
  { name: 'retry_channels', description: 'Clear the no-signal marks so every channel is tried again', requiresConfirmation: false },
  { name: 'set_theme', description: 'TV theme; args {theme:"international"|"sampo"|"samsung"}', requiresConfirmation: false },
  { name: 'set_country', description: 'Built-in channel list; args {country:"vn"|"us"|"jp"|"kr"|"eu"|"intl"}', requiresConfirmation: false },
  { name: 'toggle_bw', description: 'Black & white / color', requiresConfirmation: false },
  { name: 'help', description: 'Help', requiresConfirmation: false }
];
const ALLOWED = new Set(actions.map(a => a.name));

const names = (a, n) => (Array.isArray(a) ? a.slice(0, n).map(x => String(x == null ? '' : x).slice(0, 120)) : []);

/** Merge the browser's live context (current channel, picture mode, no-signal list…) into what the AI sees. */
async function getContext(ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  return {
    app: 'Pi Vintage TV',
    version: VERSION,
    lang: c.lang === 'vi' ? 'vi' : 'en',
    powered: c.powered,
    country: c.country,
    theme: c.theme,
    bw: c.bw,
    picture: c.picture === 'retro' ? 'retro' : 'clear',
    fullscreen: !!c.fullscreen,
    channelName: c.channelName || null,
    channelCount: c.channelCount,
    noSignal: names(c.noSignal, 20),
    channels: Array.isArray(c.channels) ? c.channels.slice(0, 40) : []
  };
}

async function executeAction({ name, args }) {
  if (!ALLOWED.has(name)) return { ok: false, error: 'not_allowed' };
  return { ok: true, action: name, args: args || {}, clientExecute: true };
}

/** Offline ("local guide") brain. Replies in the user's language (EN/VI). */
async function localReply(message, live) {
  const q = String(message || '').trim();
  const ql = q.toLowerCase();
  const lang = detectLang(q, live && live.lang) === 'vi' ? 'vi' : 'en';
  const M = (k) => msg(lang, k);

  if (/\bqr\b|remote access|truy cập|truy cap|từ xa|tu xa/.test(ql)) {
    return { reply: M('qr'), actions: [{ name: 'show_remote_access', args: {} }] };
  }
  if (/xác nhận|xac nhan|confirm import|nhập thật|nhap that|đồng ý nhập|dong y nhap/.test(ql)) {
    return { reply: M('saving'), actions: [{ name: 'smart_import', args: { query: q, confirm: true, usePending: true } }] };
  }
  const urlMatch = q.match(/https?:\/\/\S+\.m3u8?\S*/i);
  if (urlMatch) {
    return { reply: M('previewLink'), actions: [{ name: 'smart_import', args: { url: urlMatch[0], confirm: false } }] };
  }

  // How-to questions about the app itself (fullscreen, no-signal skipping, picture, shortcuts, memory…)
  for (const f of FAQ) {
    if (!f.re.test(q)) continue;
    const act = typeof f.action === 'function' ? f.action(q) : null;
    if (act) return { reply: M(act.say), actions: [{ name: act.name, args: act.args || {} }] };
    return { reply: f[lang] || f.en, actions: [] };
  }

  if (/kênh|kenh|channel|iptv|m3u|playlist|github|vietnam|việt|viet nam|india|ấn độ|tìm|tim |news|tin tức|tin tuc/.test(ql)) {
    return { reply: M('search'), actions: [{ name: 'smart_import', args: { query: q, confirm: false } }] };
  }
  if (/help|hướng dẫn|huong dan|trợ giúp|tro giup/.test(ql)) {
    return { reply: M('help'), actions: [] };
  }
  return { reply: M('fallback'), actions: [] };
}

module.exports = { knowledge, actions, getContext, executeAction, localReply };
