/* Pi Vintage TV — cinema mode + country free channels */
/* ---- Free channels by country (public HLS / official pages) ---- */
const CHANNELS_BY_COUNTRY = {
  /* No third-party stream URLs ship in the app. Library comes from server / user import. */
  vn: [],
  us: [],
  jp: [],
  kr: [],
  eu: [],
  intl: [],
  in: []
};

// Merge official registry if present (extra VN pages)
function mergeOfficialIntoVn() {
  if (typeof OFFICIAL_TV_CHANNELS === 'undefined') return;
  const existing = new Set(CHANNELS_BY_COUNTRY.vn.map(c => c.id));
  let n = CHANNELS_BY_COUNTRY.vn.length;
  OFFICIAL_TV_CHANNELS.filter(c => c.enabled).forEach(c => {
    if (existing.has(c.id) || existing.has('official-' + c.id)) return;
    n += 1;
    CHANNELS_BY_COUNTRY.vn.push({
      id: 'official-' + c.id,
      name: 'CH-' + String(n).padStart(2, '0') + ' ' + c.name + ' ★',
      category: c.provider || 'Official',
      url: 'OFFICIAL:' + c.sourceUrl,
      officialName: c.name
    });
  });
}
mergeOfficialIntoVn();

let currentCountry = localStorage.getItem('pi_vintage_country') || 'vn';
let channels = [...(CHANNELS_BY_COUNTRY[currentCountry] || CHANNELS_BY_COUNTRY.vn)];
let currentChannelIndex = 0;
let isPoweredOn = true;
let isCinemaMode = false;
let isBwMode = localStorage.getItem('pi_vintage_bw') === '1';
let audioCtx = null;
let noiseNode = null;
let hls = null;
let fitTimer = null;
let staticWatchTimer = null;
let editingChannelId = null;
let userInteracted = false;
let resolveTimer = null;
let currentLang = localStorage.getItem('pi_vintage_lang') || 'vi';
let lastPowerPress = 0;
const POWER_DOUBLE_MS = 5000;

const video = document.getElementById('tvVideo');
const canvas = document.getElementById('staticCanvas');
const ctx = canvas.getContext('2d');
const channelSelect = document.getElementById('channelSelect');
const countrySelect = document.getElementById('countrySelect');
const channelOsd = document.getElementById('channelOsd');
const btnStatic = document.getElementById('btnStatic');
const btnAddModal = document.getElementById('btnAddModal');
const addBox = document.getElementById('addBox');
const btnSaveCustom = document.getElementById('btnSaveCustom');
const customName = document.getElementById('customName');
const customUrl = document.getElementById('customUrl');
const frameContainer = document.getElementById('tv-frame-container');
const btnPower = document.getElementById('btnPower');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const btnLang = document.getElementById('btnLang');
const btnBw = document.getElementById('btnBw');
const modelSelect = document.getElementById('tv-model-select');
const btnCinema = document.getElementById('btnCinema');
const btnExitCinema = document.getElementById('btnExitCinema');

const MODEL_BADGES = {
  'tv-international-red': 'INTERNATIONAL',
  'tv-sampo-cream': 'SAMPO',
  'tv-samsung-deluxe': 'SAMSUNG'
};

const i18n = {
  vi: {
    appTitle: 'Pi Vintage TV',
    saveChannel: 'Lưu kênh',
    backToChannels: '◀ Kênh thường',
    muteStatic: 'Tắt tiếng rè',
    cinemaOn: 'Chỉ khung TV',
    cinemaOff: 'Thoát',
    powerOff: 'Tắt máy',
    manageChannels: 'Quản lý kênh',
    deleteChannel: 'Xóa',
    cancel: 'Hủy',
    editChannel: 'Sửa',
    tunedIn: 'Đã khớp tín hiệu',
    officialHint: 'Stream tạm thời không khả dụng. Thử kênh khác hoặc mở trang đài.'
  },
  en: {
    appTitle: 'Pi Vintage TV',
    saveChannel: 'Save Channel',
    backToChannels: '◀ Channels',
    muteStatic: 'Static muted',
    cinemaOn: 'TV only',
    cinemaOff: 'Exit',
    powerOff: 'Power off',
    manageChannels: 'Manage channels',
    deleteChannel: 'Delete',
    cancel: 'Cancel',
    editChannel: 'Edit',
    tunedIn: 'Signal locked',
    officialHint: 'Stream temporarily unavailable. Try another channel or open the broadcaster.'
  }
};
function t(key) {
  return (i18n[currentLang] && i18n[currentLang][key]) || i18n.en[key] || key;
}
function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  if (btnLang) btnLang.textContent = currentLang === 'vi' ? '🌐 EN' : '🌐 VI';
  document.documentElement.lang = currentLang;
}

function applyModel(modelId) {
  if (!MODEL_BADGES[modelId]) modelId = 'tv-international-red';
  frameContainer.dataset.model = modelId;
  localStorage.setItem('pi_vintage_model', modelId);
  if (modelSelect) modelSelect.value = modelId;
  const spBadge = document.getElementById('speakerBadge');
  if (spBadge) spBadge.textContent = modelId === 'tv-international-red' ? '14' : '';
  const frontBrand = document.getElementById('frontBrand');
  if (frontBrand) frontBrand.textContent = modelId === 'tv-sampo-cream' ? 'SAMPO' : '';
  const panelBrand = document.getElementById('panelBrand');
  if (panelBrand) panelBrand.textContent = modelId === 'tv-samsung-deluxe' ? 'SAMSUNG' : '';
  const bezelBrand = document.getElementById('bezelBrand');
  if (bezelBrand) bezelBrand.textContent = modelId === 'tv-international-red' ? 'INTERNATIONAL' : '';
}

function setBwMode(on) {
  isBwMode = on;
  document.body.classList.toggle('mode-bw', on);
  if (btnBw) btnBw.classList.toggle('active', on);
  localStorage.setItem('pi_vintage_bw', on ? '1' : '0');
}

/* ---- Country / channels ---- */

const PROBE_CACHE_KEY = 'pi_vintage_probe_v1';
function getProbeCache() {
  try { return JSON.parse(sessionStorage.getItem(PROBE_CACHE_KEY) || '{}'); } catch (e) { return {}; }
}
function setProbeCache(map) {
  try { sessionStorage.setItem(PROBE_CACHE_KEY, JSON.stringify(map)); } catch (e) {}
}

async function probeStreamUrl(url) {
  if (!url || url === 'STATIC') return true;
  if (url.startsWith('OFFICIAL:')) return false; // hide pure official cards from zap list
  const cache = getProbeCache();
  if (Object.prototype.hasOwnProperty.call(cache, url)) return !!cache[url];
  try {
    const resp = await fetch('/api/probe-stream?url=' + encodeURIComponent(url));
    const data = await resp.json();
    cache[url] = !!(data && data.ok);
    setProbeCache(cache);
    return cache[url];
  } catch (e) {
    cache[url] = false;
    setProbeCache(cache);
    return false;
  }
}

async function filterLiveChannels(list) {
  const out = [];
  // Probe in parallel batches of 6
  const batch = 6;
  for (let i = 0; i < list.length; i += batch) {
    const slice = list.slice(i, i + batch);
    const results = await Promise.all(slice.map(async (ch) => {
      if (ch.url === 'STATIC') return { ch, ok: true };
      if (ch.url && ch.url.startsWith('OFFICIAL:')) return { ch, ok: false };
      const ok = await probeStreamUrl(ch.url);
      return { ch, ok };
    }));
    results.forEach(r => { if (r.ok) out.push(r.ch); });
  }
  // Always keep at least Static if everything dies
  if (!out.length) {
    const st = list.find(c => c.url === 'STATIC');
    if (st) out.push(st);
  }
  // Renumber CH-xx labels for clean list
  return out.map((ch, idx) => ({
    ...ch,
    name: ch.name.replace(/^CH-\d+\s*/, 'CH-' + String(idx + 1).padStart(2, '0') + ' ')
  }));
}


async function loadCountry(code) {
  currentCountry = CHANNELS_BY_COUNTRY[code] ? code : 'vn';
  localStorage.setItem('pi_vintage_country', currentCountry);
  if (countrySelect) countrySelect.value = currentCountry;
  const base = [...(CHANNELS_BY_COUNTRY[currentCountry] || [])];
  const saved = localStorage.getItem('pi_vintage_channels');
  if (saved) {
    try {
      const custom = JSON.parse(saved);
      custom.forEach(c => base.push(c));
    } catch (e) {}
  }
  showOsd(currentLang === 'vi' ? 'Đang lọc kênh…' : 'Filtering channels…');
  channels = await filterLiveChannels(base);
  currentChannelIndex = 0;
  renderChannelSelect();
  if (isPoweredOn) playChannel(0);
  else showOsd(channels[0] ? channels[0].name : '—');
}

function renderChannelSelect() {
  if (!channelSelect) return;
  channelSelect.innerHTML = '';
  channels.forEach((ch, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = ch.name;
    channelSelect.appendChild(opt);
  });
  channelSelect.value = currentChannelIndex;
}

function initCanvas() {
  if (!canvas || !ctx) return;
  canvas.width = 320;
  canvas.height = 240;
  function drawStatic() {
    if (!isPoweredOn || (channels[currentChannelIndex] && channels[currentChannelIndex].url === 'STATIC') || (video && (video.paused || video.error))) {
      const idata = ctx.createImageData(canvas.width, canvas.height);
      const buffer32 = new Uint32Array(idata.data.buffer);
      for (let i = 0; i < buffer32.length; i++) {
        buffer32[i] = Math.random() < 0.4 ? 0xffffffff : 0xff000000;
      }
      ctx.putImageData(idata, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(drawStatic);
  }
  drawStatic();
}
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playStaticSound(enable) {
  initAudio();
  if (enable) {
    if (noiseNode) return;
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;
    noiseNode.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.07;
    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noiseNode.start();
  } else if (noiseNode) {
    noiseNode.stop();
    noiseNode.disconnect();
    noiseNode = null;
  }
}
function showOsd(text) {
  if (!channelOsd) return;
  channelOsd.textContent = text;
  channelOsd.classList.add('show');
  setTimeout(() => channelOsd.classList.remove('show'), 2400);
}

/* ---- Cinema mode: hide all chrome, only screen ---- */
function setCinemaMode(on) {
  isCinemaMode = on;
  document.body.classList.toggle('cinema-mode', on);
  if (btnExitCinema) btnExitCinema.style.display = on ? 'block' : 'none';
  if (btnCinema) btnCinema.classList.toggle('active', on);
  if (on) {
    showOsd(t('cinemaOn'));
    // Ensure video is playing if we have a stream
    if (isPoweredOn && video && video.paused) video.play().catch(() => {});
  } else {
    showOsd(t('cinemaOff'));
  }
}

function setPower(on) {
  isPoweredOn = on;
  if (frameContainer) frameContainer.classList.toggle('powered-off', !on);
  if (btnPower) btnPower.classList.toggle('active', on);
  if (on) {
    if (video) video.style.display = 'block';
    playChannel(currentChannelIndex);
  } else {
    if (isCinemaMode) setCinemaMode(false);
    if (video) {
      video.pause();
      video.style.display = 'none';
    }
    playStaticSound(false);
  }
}

/**
 * Power button sequence:
 * - If cinema mode: exit cinema
 * - If powered on:
 *   - 1st press: mute static noise
 *   - 2nd press within 5s: enter cinema mode (clean screen only)
 *   - Press outside 5s window: full power off
 * - If powered off: power on
 */
function handlePowerPress() {
  const now = Date.now();
  // In TV-only mode: exit
  if (isCinemaMode) {
    setCinemaMode(false);
    lastPowerPress = 0;
    return;
  }
  // Off → On
  if (!isPoweredOn) {
    setPower(true);
    lastPowerPress = 0;
    return;
  }
  // Powered on: double-press within window → TV-only mode (keep frame + video)
  if (lastPowerPress && (now - lastPowerPress) < POWER_DOUBLE_MS) {
    playStaticSound(false);
    setCinemaMode(true);
    lastPowerPress = 0;
    return;
  }
  // First press of sequence: mute static, start double-press window
  playStaticSound(false);
  showOsd(t('muteStatic'));
  lastPowerPress = now;
  setTimeout(() => {
    if (lastPowerPress && Date.now() - lastPowerPress >= POWER_DOUBLE_MS) {
      lastPowerPress = 0;
    }
  }, POWER_DOUBLE_MS + 50);
}

// Dedicated long-path power off when user presses power again after window
function handlePowerOffOnly() {
  if (isCinemaMode) { setCinemaMode(false); return; }
  if (isPoweredOn && !lastPowerPress) {
    setPower(false);
    showOsd(t('powerOff'));
  } else {
    handlePowerPress();
  }
}



function markInteracted() {
  userInteracted = true;
  enableVideoAudio();
}

function showOfficialCard(title, pageUrl) {
  const officialWrap = document.getElementById('officialFrameWrap');
  const officialTitle = document.getElementById('officialFrameTitle');
  if (video) {
    try { video.pause(); } catch (e) {}
    video.removeAttribute('src');
    try { video.load(); } catch (e) {}
  }
  if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
  playStaticSound(false);
  if (officialWrap) {
    officialWrap.style.display = 'flex';
    if (officialTitle) officialTitle.textContent = title || 'Official';
    const openLink = document.getElementById('officialOpenLink');
    if (openLink && pageUrl) {
      openLink.href = pageUrl;
      openLink.textContent = currentLang === 'vi' ? 'Mở trang đài ▶' : 'Open Official ▶';
    }
  }
}

function enableVideoAudio() {
  if (!video) return;
  try {
    video.muted = false;
    video.defaultMuted = false;
    if (video.volume < 0.2) video.volume = 1;
    video.removeAttribute('muted');
  } catch (e) {}
}
async function playVideoWithAudio() {
  if (!video) return;
  enableVideoAudio();
  try {
    await video.play();
  } catch (e) {
    // Autoplay with sound blocked — keep muted then retry unmute on next gesture
    try {
      video.muted = true;
      await video.play();
      if (userInteracted) {
        enableVideoAudio();
        video.play().catch(() => {});
      }
    } catch (e2) {
      playStaticSound(true);
    }
  }
}
function playHlsStream(url) {
  if (!video || !url) return;
  if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
  enableVideoAudio();
  if (typeof Hls !== 'undefined' && Hls.isSupported() && url.includes('.m3u8')) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      xhrSetup: function (xhr) {
        try { xhr.withCredentials = false; } catch (e) {}
      }
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      playVideoWithAudio();
      scheduleVideoFit();
      scheduleStaticAutoOff();
    });
    hls.on(Hls.Events.ERROR, (e, data) => {
      if (data && data.fatal) {
        const ch = channels[currentChannelIndex];
        // Drop dead channel from zap list
        if (ch && ch.url && ch.url !== 'STATIC') {
          const cache = getProbeCache();
          cache[ch.url] = false;
          setProbeCache(cache);
          channels = channels.filter(c => c.id !== ch.id);
          if (!channels.length) {
            channels = [{ id: 'static', name: 'CH-01 Static', category: 'Special', url: 'STATIC' }];
          }
          renderChannelSelect();
        }
        if (ch && ch.fallbackOfficial) {
          showOfficialCard(ch.officialName || ch.name, ch.fallbackOfficial);
        } else {
          playStaticSound(true);
          // Auto skip to next live channel
          if (channels.length) {
            const next = Math.min(currentChannelIndex, channels.length - 1);
            setTimeout(() => playChannel(next), 400);
          }
        }
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl') || url.includes('.m3u8')) {
    video.src = url;
    playVideoWithAudio().then(() => {
      scheduleVideoFit();
      scheduleStaticAutoOff();
    });
  } else {
    video.src = url;
    playVideoWithAudio().then(() => {
      scheduleVideoFit();
      scheduleStaticAutoOff();
    });
  }
}

/** After 10s on OFFICIAL page channel, ask server to scan page for .m3u8 */
function scheduleOfficialResolve(pageUrl) {
  if (resolveTimer) clearTimeout(resolveTimer);
  resolveTimer = setTimeout(async () => {
    if (!isPoweredOn) return;
    const ch = channels[currentChannelIndex];
    if (!ch || !ch.url || !ch.url.startsWith('OFFICIAL:')) return;
    showOsd(currentLang === 'vi' ? 'Đang dò tín hiệu…' : 'Scanning signal…');
    try {
      const resp = await fetch('/api/resolve-stream?url=' + encodeURIComponent(pageUrl));
      const data = await resp.json();
      if (data && data.ok && data.streams && data.streams.length) {
        const streamUrl = data.streams[0];
        const wrap = document.getElementById('officialFrameWrap');
        if (wrap) wrap.style.display = 'none';
        playStaticSound(false);
        playHlsStream(streamUrl);
        showOsd(currentLang === 'vi' ? 'Đã khóa stream' : 'Stream locked');
      } else {
        showOsd(currentLang === 'vi' ? 'Không thấy m3u8 công khai' : 'No public m3u8 found');
      }
    } catch (e) {
      showOsd(currentLang === 'vi' ? 'Lỗi dò tín hiệu' : 'Scan failed');
    }
  }, 10000);
}

function clearWatchTimers() {
  if (fitTimer) { clearTimeout(fitTimer); fitTimer = null; }
  if (staticWatchTimer) { clearTimeout(staticWatchTimer); staticWatchTimer = null; }
  if (resolveTimer) { clearTimeout(resolveTimer); resolveTimer = null; }
  if (frameContainer) frameContainer.classList.remove('tuned-in');
  if (video) video.classList.remove('video-fitted');
}

/** After 10s of playback, fit video aspect into CRT for natural TV look */
function scheduleVideoFit() {
  if (fitTimer) clearTimeout(fitTimer);
  if (frameContainer) frameContainer.classList.remove('tuned-in');
  if (video) video.classList.remove('video-fitted');
  fitTimer = setTimeout(() => {
    if (!isPoweredOn || !video) return;
    const ch = channels[currentChannelIndex];
    if (!ch || ch.url === 'STATIC' || (ch.url && ch.url.startsWith('OFFICIAL:'))) return;
    // Prefer contain if video is wider/narrower than 4:3 CRT; else cover
    try {
      const vw = video.videoWidth || 16;
      const vh = video.videoHeight || 9;
      const videoAr = vw / vh;
      const crtAr = 4 / 3;
      if (Math.abs(videoAr - crtAr) > 0.12) {
        video.style.objectFit = 'contain';
      } else {
        video.style.objectFit = 'cover';
      }
    } catch (e) {
      video.style.objectFit = 'contain';
    }
    video.classList.add('video-fitted');
    if (frameContainer) frameContainer.classList.add('tuned-in');
    showOsd(t('tunedIn'));
  }, 10000);
}

/** Auto-mute static noise after 3 minutes of continuous viewing */
function scheduleStaticAutoOff() {
  if (staticWatchTimer) clearTimeout(staticWatchTimer);
  staticWatchTimer = setTimeout(() => {
    if (noiseNode) {
      playStaticSound(false);
      showOsd(currentLang === 'vi' ? 'Đã tắt nhiễu' : 'Noise off');
    }
  }, 3 * 60 * 1000);
}

function getCustomChannels() {
  try {
    return JSON.parse(localStorage.getItem('pi_vintage_channels') || '[]');
  } catch (e) { return []; }
}
function saveCustomChannels(list) {
  localStorage.setItem('pi_vintage_channels', JSON.stringify(list));
}

function renderChannelManager() {
  const listEl = document.getElementById('channelManagerList');
  if (!listEl) return;
  listEl.textContent = '';
  // Prefer server library view when available
  const filterSel = document.getElementById('chGroupFilter');
  const groupFilter = filterSel ? filterSel.value : '';

  const byGroup = {};
  (channels || []).forEach((ch, idx) => {
    const g = ch.category || ch.group || 'General';
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push({ ch, idx });
  });
  const groups = Object.keys(byGroup).sort();
  if (filterSel && filterSel.options.length <= 1) {
    filterSel.innerHTML = '<option value=\"\">' + (currentLang === 'vi' ? 'Tất cả nhóm' : 'All groups') + '</option>';
    groups.forEach(g => {
      const o = document.createElement('option');
      o.value = g; o.textContent = g + ' (' + byGroup[g].length + ')';
      filterSel.appendChild(o);
    });
  }

  const showGroups = groupFilter ? [groupFilter] : groups;
  showGroups.forEach(g => {
    if (!byGroup[g]) return;
    const head = document.createElement('div');
    head.className = 'ch-group-head';
    head.textContent = g + ' · ' + byGroup[g].length;
    listEl.appendChild(head);
    byGroup[g].forEach(({ ch, idx }) => {
      const row = document.createElement('div');
      row.className = 'ch-row';
      const title = document.createElement('button');
      title.type = 'button';
      title.className = 'ch-row-name';
      title.textContent = ch.name || ('CH ' + (idx + 1));
      title.addEventListener('click', () => {
        playChannel(idx);
        if (addBox) addBox.style.display = 'none';
      });
      const actions = document.createElement('div');
      actions.className = 'ch-row-actions';
      const fav = document.createElement('button');
      fav.type = 'button';
      fav.className = 'btn';
      fav.textContent = ch.favorite ? '★' : '☆';
      fav.title = 'Favorite';
      fav.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (ch.id && !String(ch.id).startsWith('custom-')) {
          await fetch('/api/library/channels/' + encodeURIComponent(ch.id), {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favorite: !ch.favorite })
          });
          ch.favorite = !ch.favorite;
        } else {
          ch.favorite = !ch.favorite;
        }
        renderChannelManager();
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn danger';
      del.textContent = '×';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(currentLang === 'vi' ? 'Xóa kênh này?' : 'Remove this channel?')) return;
        if (ch.id && !String(ch.id).startsWith('custom-')) {
          await fetch('/api/library/channels/' + encodeURIComponent(ch.id), { method: 'DELETE' });
          await loadLibraryIntoTv();
        } else if (ch.id) {
          deleteCustomChannel(ch.id);
        }
        renderChannelManager();
      });
      actions.appendChild(fav);
      actions.appendChild(del);
      row.appendChild(title);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  });
  if (!(channels || []).length) {
    listEl.textContent = currentLang === 'vi' ? 'Kho trống — dùng AI hoặc Nhập M3U' : 'Empty — use AI or Import M3U';
  }
}

function deleteCustomChannel(id) {
  let list = getCustomChannels().filter(c => c.id !== id);
  saveCustomChannels(list);
  // Reload current country list with customs
  loadCountry(currentCountry);
  editingChannelId = null;
  if (customName) customName.value = '';
  if (customUrl) customUrl.value = '';
  renderChannelManager();
}

function playChannel(index) {
  if (index < 0 || index >= channels.length) return;
  currentChannelIndex = index;
  if (channelSelect) channelSelect.value = index;
  if (frameContainer) frameContainer.style.setProperty('--ch-rot', (index * 30) + 'deg');
  const ch = channels[index];
  showOsd(ch.name);
  clearWatchTimers();
  if (!isPoweredOn) return;
  if (hls) { hls.destroy(); hls = null; }

  const officialWrap = document.getElementById('officialFrameWrap');
  const officialBody = document.getElementById('officialFrameBody');
  const officialTitle = document.getElementById('officialFrameTitle');
  if (officialWrap) officialWrap.style.display = 'none';
  if (officialBody) officialBody.innerHTML = '';

  if (ch.url === 'STATIC') {
    if (video) video.src = '';
    playStaticSound(true);
    return;
  }
  if (ch.url && ch.url.startsWith('OFFICIAL:')) {
    // No full-page iframe. Show card, then after 10s try to extract public m3u8 via server.
    if (video) {
      try { video.pause(); } catch (e) {}
      video.removeAttribute('src');
      try { video.load(); } catch (e) {}
    }
    playStaticSound(false);
    const pageUrl = ch.url.slice(9);
    if (officialWrap) {
      officialWrap.style.display = 'flex';
      if (officialTitle) officialTitle.textContent = ch.officialName || ch.name;
      const openLink = document.getElementById('officialOpenLink');
      if (openLink) {
        openLink.href = pageUrl;
        openLink.textContent = currentLang === 'vi' ? 'Mở trang đài ▶' : 'Open Official ▶';
      }
    }
    scheduleOfficialResolve(pageUrl);
    return;
  }
  playStaticSound(false);
  if (ch.url && (ch.url.includes('.m3u8') || ch.url.includes('.mpd') || ch.url.includes('.mp4'))) {
    playHlsStream(ch.url);
  } else if (video) {
    video.src = ch.url;
    playVideoWithAudio().then(() => { scheduleVideoFit(); scheduleStaticAutoOff(); });
  }
}

/* Events */
if (channelSelect) channelSelect.addEventListener('change', e => playChannel(parseInt(e.target.value, 10)));
if (countrySelect) {
  countrySelect.value = currentCountry;
  countrySelect.addEventListener('change', e => { loadCountry(e.target.value); });
}
if (btnPower) {
  btnPower.addEventListener('click', () => {
    // If powered on and no pending double-window → first press mutes; 
    // if user presses again after window cleared, power off
    if (isPoweredOn && !isCinemaMode && !lastPowerPress && noiseNode === null) {
      // Already muted, no pending double → power off
      setPower(false);
      showOsd(t('powerOff'));
      return;
    }
    handlePowerPress();
  });
}
function bindKnob(el, handler) {
  el.addEventListener('click', handler);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
  });
}
document.querySelectorAll('.act-power').forEach(el => bindKnob(el, () => {
  if (isPoweredOn && !isCinemaMode && !lastPowerPress && noiseNode === null) {
    setPower(false);
    showOsd(t('powerOff'));
    return;
  }
  handlePowerPress();
}));
document.querySelectorAll('.act-channel').forEach(el => bindKnob(el, () => {
  if (!isPoweredOn) return;
  playChannel((currentChannelIndex + 1) % channels.length);
}));
if (btnNext) btnNext.addEventListener('click', () => {
  if (!isPoweredOn) return;
  playChannel((currentChannelIndex + 1) % channels.length);
});
if (btnPrev) btnPrev.addEventListener('click', () => {
  if (!isPoweredOn) return;
  playChannel((currentChannelIndex - 1 + channels.length) % channels.length);
});
if (btnStatic) btnStatic.addEventListener('click', () => {
  if (!isPoweredOn) return;
  const idx = channels.findIndex(c => c.url === 'STATIC');
  if (idx >= 0) playChannel(idx);
});
if (btnCinema) btnCinema.addEventListener('click', () => {
  if (!isPoweredOn) return;
  setCinemaMode(!isCinemaMode);
});
if (btnExitCinema) btnExitCinema.addEventListener('click', () => setCinemaMode(false));
// ESC exits cinema
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && isCinemaMode) setCinemaMode(false);
});

if (btnAddModal) btnAddModal.addEventListener('click', () => {
  if (!addBox) return;
  const open = addBox.style.display === 'none' || !addBox.style.display;
  addBox.style.display = open ? 'flex' : 'none';
  if (open) renderChannelManager();
});
if (btnSaveCustom) btnSaveCustom.addEventListener('click', () => {
  const name = customName.value.trim();
  const url = customUrl.value.trim();
  if (!name || !url) {
    alert(currentLang === 'vi' ? 'Vui lòng nhập tên và URL!' : 'Please enter name and URL!');
    return;
  }
  let list = getCustomChannels();
  if (editingChannelId) {
    list = list.map(c => c.id === editingChannelId ? { ...c, name: name, url: url } : c);
    // also fix display name prefix if needed
    list = list.map(c => c.id === editingChannelId ? { ...c, name: c.name.match(/^CH-\d+/) ? c.name.replace(/^(CH-\d+\s*).*/, '$1' + name) : name } : c);
    saveCustomChannels(list);
    editingChannelId = null;
  } else {
    const ch = {
      id: 'custom-' + Date.now(),
      name: 'CH-' + String(channels.length + 1).padStart(2, '0') + ' ' + name,
      category: 'Custom', url
    };
    list.push(ch);
    saveCustomChannels(list);
  }
  loadCountry(currentCountry);
  customName.value = ''; customUrl.value = '';
  renderChannelManager();
  if (addBox) addBox.style.display = 'none';
});

const btnDeleteChannel = document.getElementById('btnDeleteChannel');
if (btnDeleteChannel) {
  btnDeleteChannel.addEventListener('click', () => {
    if (editingChannelId) {
      deleteCustomChannel(editingChannelId);
      return;
    }
    // delete currently selected if custom
    const ch = channels[currentChannelIndex];
    if (ch && ch.id && String(ch.id).startsWith('custom-')) {
      deleteCustomChannel(ch.id);
    } else {
      alert(currentLang === 'vi' ? 'Chỉ xóa được kênh tự thêm' : 'Only custom channels can be deleted');
    }
  });
}
const btnCancelEdit = document.getElementById('btnCancelEdit');
if (btnCancelEdit) {
  btnCancelEdit.addEventListener('click', () => {
    editingChannelId = null;
    if (customName) customName.value = '';
    if (customUrl) customUrl.value = '';
    if (addBox) addBox.style.display = 'none';
  });
}
if (btnLang) btnLang.addEventListener('click', () => {
  currentLang = currentLang === 'vi' ? 'en' : 'vi';
  localStorage.setItem('pi_vintage_lang', currentLang);
  applyLanguage();
});
if (btnBw) btnBw.addEventListener('click', () => setBwMode(!isBwMode));
if (modelSelect) modelSelect.addEventListener('change', e => { applyModel(e.target.value); fitTvToViewport(); });
if (video) video.addEventListener('error', () => playStaticSound(true));

const btnCloseOfficial = document.getElementById('btnCloseOfficial');
if (btnCloseOfficial) {
  btnCloseOfficial.addEventListener('click', () => {
    const wrap = document.getElementById('officialFrameWrap');
    if (wrap) wrap.style.display = 'none';
    const first = channels.findIndex(c => c.url && !c.url.startsWith('OFFICIAL:') && c.url !== 'STATIC');
    if (first >= 0) playChannel(first);
    else playChannel(0);
  });
}

['click', 'touchstart', 'keydown'].forEach(ev => {
  document.addEventListener(ev, markInteracted, { once: false, passive: true });
});


function fitTvToViewport() {
  const frame = document.getElementById('tv-frame-container');
  const shell = frame && frame.querySelector('.tv-shell');
  if (!frame || !shell) return;
  const header = document.querySelector('.app-header');
  const controls = document.getElementById('universalControls');
  const headerH = header ? header.getBoundingClientRect().height : 0;
  const controlsH = controls && controls.offsetParent !== null ? controls.getBoundingClientRect().height : 0;
  const pad = 12;
  const availW = Math.max(280, window.innerWidth - pad * 2);
  const availH = Math.max(220, window.innerHeight - headerH - controlsH - pad * 2);
  // International shell ~ aspect ~ 1.55 wide including side panel
  const targetW = Math.min(availW, availH * 1.55);
  frame.style.width = targetW + 'px';
  frame.style.maxWidth = '100%';
  shell.style.setProperty('--u', (targetW / 100) + 'px');
}
window.addEventListener('resize', fitTvToViewport);
window.addEventListener('orientationchange', () => setTimeout(fitTvToViewport, 120));

window.addEventListener('DOMContentLoaded', () => {
  fitTvToViewport();
  loadCountry(currentCountry);
  initCanvas();
  applyLanguage();
  setBwMode(isBwMode);
  const saved = localStorage.getItem('pi_vintage_model') || 'tv-international-red';
  applyModel(MODEL_BADGES[saved] ? saved : 'tv-international-red');
  setPower(true);
  fitTvToViewport();
  setTimeout(() => {
    const vidIdx = channels.findIndex(c => c.url && !c.url.startsWith('OFFICIAL:') && c.url !== 'STATIC');
    playChannel(vidIdx >= 0 ? vidIdx : 0);
  }, 400);
});

window.__piVintageTv = {
  video, channelOsd,
  isStaticPlaying: () => !!noiseNode,
  pauseCustomPlayer: () => { playStaticSound(false); if (video) video.pause(); },
  resumeCustomPlayer: () => { if (!isPoweredOn) return; playChannel(currentChannelIndex); },
  setCinemaMode
};

/* ---- Fullscreen (YouTube-style control on CRT) ---- */
function toggleVideoFullscreen() {
  const target = document.getElementById('screenInner') || document.getElementById('tv-frame-container');
  if (!target) return;
  if (!document.fullscreenElement) {
    (target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen || (() => {})).call(target);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen || (() => {})).call(document);
  }
}
const btnFullscreen = document.getElementById('btnFullscreen');
if (btnFullscreen) btnFullscreen.addEventListener('click', (e) => {
  e.stopPropagation();
  markInteracted();
  toggleVideoFullscreen();
});
document.addEventListener('fullscreenchange', () => {
  if (btnFullscreen) btnFullscreen.classList.toggle('is-fs', !!document.fullscreenElement);
});

/* ---- AI bridge: context + actions for universal AI panel ---- */
function getAiContext() {
  const ch = channels[currentChannelIndex] || null;
  return {
    app: 'Pi Vintage TV',
    version: '1.7.0',
    powered: !!isPoweredOn,
    country: currentCountry,
    theme: (frameContainer && frameContainer.getAttribute('data-model')) || 'tv-international-red',
    channelIndex: currentChannelIndex,
    channelName: ch ? ch.name : null,
    channelCount: channels.length,
    channels: channels.slice(0, 40).map((c, i) => ({ i, id: c.id, name: c.name, category: c.category })),
    bw: !!isBwMode,
    lang: currentLang
  };
}

function runAiAction(name, args) {
  args = args || {};
  switch (name) {
    case 'list_channels':
      showOsd((currentLang === 'vi' ? 'Có ' : '') + channels.length + (currentLang === 'vi' ? ' kênh' : ' channels'));
      return { ok: true, channels: getAiContext().channels };
    case 'switch_channel': {
      let idx = args.index;
      if (idx === undefined && args.value !== undefined && !isNaN(Number(args.value))) idx = Number(args.value);
      if (idx === undefined && (args.name || args.value)) {
        const q = String(args.name || args.value).toLowerCase();
        idx = channels.findIndex(c => (c.name || '').toLowerCase().includes(q) || (c.id || '').toLowerCase() === q);
      }
      if (idx >= 0 && idx < channels.length) {
        playChannel(idx);
        return { ok: true, channel: channels[idx].name };
      }
      return { ok: false, error: 'channel_not_found' };
    }
    case 'next_channel':
      playChannel((currentChannelIndex + 1) % channels.length);
      return { ok: true };
    case 'prev_channel':
      playChannel((currentChannelIndex - 1 + channels.length) % channels.length);
      return { ok: true };
    case 'add_channel': {
      const name = String(args.name || args.title || '').trim();
      const url = String(args.url || args.link || '').trim();
      if (!name || !url) return { ok: false, error: 'name_and_url_required' };
      // Skip duplicate URL already in list
      if (channels.some(c => c.url === url)) {
        return { ok: true, channel: name, skipped: true };
      }
      const ch = {
        id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        name: 'CH-' + String(channels.length + 1).padStart(2, '0') + ' ' + name,
        category: 'Custom',
        url
      };
      const list = getCustomChannels();
      list.push(ch);
      saveCustomChannels(list);
      channels.push(ch);
      renderChannelSelect();
      // Only switch to the first newly added channel in a batch
      if (!window.__piAiBatchAdded) {
        window.__piAiBatchAdded = true;
        playChannel(channels.length - 1);
        setTimeout(() => { window.__piAiBatchAdded = false; }, 800);
      }
      return { ok: true, channel: ch.name };
    }
    case 'remove_channel': {
      const key = String(args.id || args.name || args.value || '').toLowerCase();
      const ch = channels.find(c => (c.id || '').toLowerCase() === key || (c.name || '').toLowerCase().includes(key));
      if (!ch) return { ok: false, error: 'not_found' };
      if (ch.id && String(ch.id).startsWith('custom-')) {
        deleteCustomChannel(ch.id);
        return { ok: true, removed: ch.name };
      }
      // Allow removing non-custom from current session zap list only
      channels = channels.filter(c => c.id !== ch.id);
      renderChannelSelect();
      if (channels.length) playChannel(0);
      return { ok: true, removed: ch.name, sessionOnly: true };
    }
    case 'set_theme': {
      const v = String(args.theme || args.value || args.name || '').toLowerCase();
      const map = {
        international: 'tv-international-red',
        red: 'tv-international-red',
        sampo: 'tv-sampo-cream',
        cream: 'tv-sampo-cream',
        samsung: 'tv-samsung-deluxe',
        deluxe: 'tv-samsung-deluxe'
      };
      const model = map[v] || (MODEL_BADGES[v] ? v : null);
      if (!model) return { ok: false, error: 'unknown_theme' };
      applyModel(model);
      if (modelSelect) modelSelect.value = model;
      fitTvToViewport();
      return { ok: true, theme: model };
    }
    case 'set_country': {
      const code = String(args.country || args.value || args.code || '').toLowerCase();
      if (!CHANNELS_BY_COUNTRY[code]) return { ok: false, error: 'unknown_country' };
      loadCountry(code);
      return { ok: true, country: code };
    }
    case 'toggle_power':
      handlePowerPress();
      return { ok: true, powered: isPoweredOn };
    case 'toggle_bw':
      setBwMode(!isBwMode);
      return { ok: true, bw: isBwMode };
    case 'toggle_fullscreen':
      toggleVideoFullscreen();
      return { ok: true };
    case 'help':
      showOsd(currentLang === 'vi' ? 'AI: chuyển/thêm/xóa kênh, theme, fullscreen' : 'AI: channels, theme, fullscreen');
      return { ok: true };
    default:
      return { ok: false, error: 'unknown_action' };
  }
}

// Extend public API
window.__piVintageTv = Object.assign(window.__piVintageTv || {}, {
  getAiContext,
  runAiAction,
  toggleVideoFullscreen,
  channels: () => channels.slice()
});

/* ============================================================
   Channel Library (M3U import) — keeps Retro UI
   ============================================================ */
const i18nExtra = {
  vi: {
    tabList: 'Danh sách', tabImport: 'Nhập M3U', tabSingle: 'Thêm 1 kênh',
    importHint: 'Nhập playlist M3U (file vn.m3u, URL iptv-org, hoặc dán text).',
    importUrl: 'URL playlist', importPaste: 'Hoặc dán nội dung M3U',
    importFile: 'Hoặc chọn file .m3u / .txt',
    previewImport: 'Xem trước', doImport: 'Nhập vào kho',
    loadLibrary: 'Nạp thư viện vào TV', manageChannels: 'Kênh / Kho'
  },
  en: {
    tabList: 'List', tabImport: 'Import M3U', tabSingle: 'Add one',
    importHint: 'Import an M3U playlist (file, URL, or paste text).',
    importUrl: 'Playlist URL', importPaste: 'Or paste M3U text',
    importFile: 'Or choose .m3u / .txt file',
    previewImport: 'Preview', doImport: 'Import to library',
    loadLibrary: 'Load library into TV', manageChannels: 'Channels / Library'
  }
};

function applyExtraI18n() {
  const pack = i18nExtra[currentLang] || i18nExtra.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (pack[k]) el.textContent = pack[k];
  });
}

// Extend applyLanguage if exists
const _applyLanguageOrig = typeof applyLanguage === 'function' ? applyLanguage : null;
if (_applyLanguageOrig) {
  window.applyLanguage = function() {
    _applyLanguageOrig();
    applyExtraI18n();
  };
}

// Tabs
document.querySelectorAll('.ch-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.ch-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ch-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const pane = document.getElementById('pane-' + tab.dataset.tab);
    if (pane) pane.classList.add('active');
    if (tab.dataset.tab === 'list') refreshLibStats();
  });
});

const btnCloseManager = document.getElementById('btnCloseManager');
if (btnCloseManager) btnCloseManager.addEventListener('click', () => {
  if (addBox) addBox.style.display = 'none';
});

async function refreshLibStats() {
  const el = document.getElementById('libStats');
  if (!el) return;
  try {
    const r = await fetch('/api/library/stats');
    const j = await r.json();
    el.textContent = currentLang === 'vi'
      ? `Kho: ${j.total || 0} kênh · sống ${j.live || 0} · chết ${j.dead || 0} · ? ${j.unknown || 0}`
      : `Library: ${j.total || 0} · live ${j.live || 0} · dead ${j.dead || 0} · ? ${j.unknown || 0}`;
  } catch {
    el.textContent = currentLang === 'vi' ? 'Không đọc được kho kênh' : 'Library unavailable';
  }
}

async function loadLibraryIntoTv() {
  try {
    showOsd(currentLang === 'vi' ? 'Đang nạp kho…' : 'Loading library…');
    const r = await fetch('/api/library/channels?limit=500&offset=0');
    const j = await r.json();
    if (!j.ok || !j.channels || !j.channels.length) {
      showOsd(currentLang === 'vi' ? 'Kho trống — hãy Nhập M3U' : 'Library empty — Import M3U');
      return;
    }
    channels = j.channels.map((c, i) => ({
      id: c.id,
      name: 'CH-' + String(i + 1).padStart(2, '0') + ' ' + c.name,
      category: c.group || (c.categories && c.categories[0]) || c.country || 'Library',
      group: c.group || 'General',
      favorite: !!c.favorite,
      url: (c.sources && c.sources[0] && c.sources[0].url) || '',
      sources: c.sources || [],
      officialName: c.name
    })).filter(c => c.url);
    currentChannelIndex = 0;
    renderChannelSelect();
    if (isPoweredOn) playChannel(0);
    showOsd((currentLang === 'vi' ? 'Đã nạp ' : 'Loaded ') + channels.length + (currentLang === 'vi' ? ' kênh' : ' ch'));
  } catch (e) {
    showOsd('Library load failed');
  }
}

const btnLoadLibrary = document.getElementById('btnLoadLibrary');
if (btnLoadLibrary) btnLoadLibrary.addEventListener('click', loadLibraryIntoTv);

async function readImportPayload() {
  const url = (document.getElementById('importUrl')?.value || '').trim();
  const text = (document.getElementById('importText')?.value || '').trim();
  const fileInput = document.getElementById('importFile');
  if (url) return { url };
  if (text) return { text };
  if (fileInput && fileInput.files && fileInput.files[0]) {
    const t = await fileInput.files[0].text();
    return { text: t };
  }
  return null;
}

function showImportResult(obj) {
  const el = document.getElementById('importResult');
  if (!el) return;
  el.hidden = false;
  el.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
}

async function runImport(dryRun) {
  const payload = await readImportPayload();
  if (!payload) {
    showImportResult(currentLang === 'vi' ? 'Nhập URL, dán text hoặc chọn file.' : 'Provide URL, text, or file.');
    return;
  }
  payload.dryRun = !!dryRun;
  payload.mode = 'merge';
  showImportResult(currentLang === 'vi' ? 'Đang xử lý…' : 'Working…');
  try {
    const headers = { 'Content-Type': 'application/json' };
    // Optional admin token from localStorage for non-localhost deploys
    const tok = localStorage.getItem('pi_vintage_admin_token');
    if (tok) headers['X-Admin-Token'] = tok;
    const r = await fetch('/api/library/import', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (!r.ok || j.ok === false) {
      showImportResult(j);
      return;
    }
    if (dryRun) {
      showImportResult(
        (currentLang === 'vi'
          ? `Xem trước: ${j.channelCount} kênh (từ ${j.rawCount} mục)`
          : `Preview: ${j.channelCount} channels (from ${j.rawCount} entries)`) +
        '\n' + JSON.stringify(j.sample || j, null, 2)
      );
    } else {
      showImportResult(
        (currentLang === 'vi'
          ? `Đã nhập: +${j.added} · gộp ${j.merged} · tổng kho ${j.total}`
          : `Imported: +${j.added} · merged ${j.merged} · total ${j.total}`)
      );
      await refreshLibStats();
      await loadLibraryIntoTv();
    }
  } catch (e) {
    showImportResult(String(e.message || e));
  }
}

const btnImportDry = document.getElementById('btnImportDry');
const btnImportGo = document.getElementById('btnImportGo');
if (btnImportDry) btnImportDry.addEventListener('click', () => runImport(true));
if (btnImportGo) btnImportGo.addEventListener('click', () => runImport(false));

// Auto-load library on boot if it has channels
(async function bootLibrary() {
  try {
    const r = await fetch('/api/library/stats');
    const j = await r.json();
    if (j && j.total > 0) {
      await loadLibraryIntoTv();
    }
  } catch (_) {}
  applyExtraI18n();
})();

/* ---- AI tools: find_sources / import_source ---- */
async function toolFindSources(args) {
  const q = (args && (args.query || args.q || args.value)) || '';
  const r = await fetch('/api/tools/find_sources?q=' + encodeURIComponent(q));
  const j = await r.json();
  showOsd((currentLang === 'vi' ? 'Nguồn: ' : 'Sources: ') + (j.sources || []).length);
  return j;
}

async function toolImportSource(args) {
  args = args || {};
  const headers = { 'Content-Type': 'application/json' };
  const tok = localStorage.getItem('pi_vintage_admin_token');
  if (tok) headers['X-Admin-Token'] = tok;
  const isAllowlistedId = args.sourceId && String(args.sourceId).startsWith('iptv-org-');
  // auto: after dryRun, client may immediately confirm allowlisted sources
  let dryRun = args.dryRun !== false && !args.confirm;
  if (args.auto && args.confirm) dryRun = false;
  const body = {
    sourceId: args.sourceId,
    url: args.url,
    dryRun,
    confirm: !dryRun,
    filter: args.filter || {},
    mode: args.mode || 'merge',
    userConfirmedExternal: !!args.userConfirmedExternal || isAllowlistedId
  };
  showOsd(dryRun ? (currentLang === 'vi' ? 'Đang xem trước…' : 'Preview…') : (currentLang === 'vi' ? 'Đang nhập kho…' : 'Importing…'));
  const r = await fetch('/api/tools/import_source', { method: 'POST', headers, body: JSON.stringify(body) });
  const j = await r.json();
  const box = document.getElementById('importResult');
  if (box) { box.hidden = false; box.textContent = JSON.stringify(j, null, 2); }
  if (!j.ok) {
    showOsd(j.error || 'import failed');
    return j;
  }
  if (j.dryRun) {
    showOsd((currentLang === 'vi' ? 'Xem trước ' : 'Preview ') + (j.channelCount || 0) + ' ch');
    // Auto-confirm allowlisted if not too huge
    if (isAllowlistedId && (j.channelCount || 0) > 0 && (j.channelCount || 0) <= 400) {
      return toolImportSource({ ...args, dryRun: false, confirm: true, auto: true });
    }
    return j;
  }
  showOsd((currentLang === 'vi' ? 'Đã nhập +' : 'Imported +') + (j.added || 0) + ' / ' + (j.total || ''));
  if (typeof loadLibraryIntoTv === 'function') await loadLibraryIntoTv();
  return j;
}

async function toolSearchChannels(args) {
  const q = (args && (args.q || args.query || args.value)) || '';
  const r = await fetch('/api/tools/search_channels?q=' + encodeURIComponent(q) + '&limit=20');
  return r.json();
}

(function hookAiActions() {
  const prev = window.runAiAction || (window.__piVintageTv && window.__piVintageTv.runAiAction);
  const wrapped = async function(name, args) {
    if (name === 'find_sources') return toolFindSources(args || {});
    if (name === 'import_source') return toolImportSource(args || {});
    if (name === 'search_channels') return toolSearchChannels(args || {});
    if (typeof prev === 'function') return prev(name, args);
    return { ok: false, error: 'unknown' };
  };
  window.runAiAction = wrapped;
  window.__piVintageTv = Object.assign(window.__piVintageTv || {}, { runAiAction: wrapped });
})();

/* ============================================================
   Remote / keyboard control (10-foot friendly, Retro)
   ============================================================ */
document.addEventListener('keydown', (e) => {
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  const key = e.key;
  if (key === 'ArrowRight' || key === 'PageDown') {
    e.preventDefault();
    if (channels.length) playChannel((currentChannelIndex + 1) % channels.length);
  } else if (key === 'ArrowLeft' || key === 'PageUp') {
    e.preventDefault();
    if (channels.length) playChannel((currentChannelIndex - 1 + channels.length) % channels.length);
  } else if (key === 'ArrowUp') {
    e.preventDefault();
    if (video) video.volume = Math.min(1, (video.volume || 0.8) + 0.1);
  } else if (key === 'ArrowDown') {
    e.preventDefault();
    if (video) video.volume = Math.max(0, (video.volume || 0.8) - 0.1);
  } else if (key === 'f' || key === 'F') {
    e.preventDefault();
    if (typeof toggleVideoFullscreen === 'function') toggleVideoFullscreen();
  } else if (key === 'm' || key === 'M') {
    if (video) video.muted = !video.muted;
  } else if (key === ' ' || key === 'k' || key === 'K') {
    e.preventDefault();
    if (video) { if (video.paused) video.play().catch(()=>{}); else video.pause(); }
  } else if (key === 'h' || key === 'H') {
    document.getElementById('btnHub')?.click();
  } else if (/^[0-9]$/.test(key)) {
    window.__chDigitBuffer = (window.__chDigitBuffer || '') + key;
    showOsd('CH-' + window.__chDigitBuffer);
    clearTimeout(window.__chDigitTimer);
    window.__chDigitTimer = setTimeout(() => {
      const n = parseInt(window.__chDigitBuffer, 10);
      window.__chDigitBuffer = '';
      if (!n || !channels.length) return;
      const idx = Math.min(Math.max(n - 1, 0), channels.length - 1);
      playChannel(idx);
    }, 900);
  }
});

/* ============================================================
   Entertainment Hub (Discover / Radio / Media / Podcast / EPG)
   ============================================================ */
const hubPanel = document.getElementById('hubPanel');
const btnHub = document.getElementById('btnHub');
if (btnHub) btnHub.addEventListener('click', () => {
  if (!hubPanel) return;
  hubPanel.style.display = hubPanel.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('btnCloseHub')?.addEventListener('click', () => {
  if (hubPanel) hubPanel.style.display = 'none';
});
document.querySelectorAll('.hub-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.hub-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.hub-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('hub-' + tab.dataset.hub)?.classList.add('active');
  });
});

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

async function hubGithubSearch() {
  const q = document.getElementById('hubSearchQ')?.value?.trim() || '';
  const box = document.getElementById('hubSearchResults');
  if (!box) return;
  box.textContent = '';
  box.appendChild(el('div', '', currentLang === 'vi' ? 'Đang tìm…' : 'Searching…'));
  try {
    const r = await fetch('/api/tools/github_search?q=' + encodeURIComponent(q));
    const j = await r.json();
    box.textContent = '';
    if (!j.items || !j.items.length) {
      box.appendChild(el('div', '', j.error || 'No results'));
      return;
    }
    j.items.forEach(item => {
      const b = el('button', 'hub-item', item.repo || item.name || 'playlist');
      const sub = el('small', '', (item.description || item.path || '').slice(0, 120));
      b.appendChild(sub);
      b.addEventListener('click', async () => {
        showOsd('Preview import…');
        // dry-run import with userConfirmedExternal
        const headers = { 'Content-Type': 'application/json' };
        const tok = localStorage.getItem('pi_vintage_admin_token');
        if (tok) headers['X-Admin-Token'] = tok;
        const body = { url: item.url, dryRun: true, userConfirmedExternal: true };
        const ir = await fetch('/api/tools/import_source', { method: 'POST', headers, body: JSON.stringify(body) });
        const ij = await ir.json();
        const okImport = confirm(
          (currentLang === 'vi'
            ? `Xem trước: ${ij.channelCount || 0} kênh từ ${item.repo || item.url}. Nhập vào kho?`
            : `Preview: ${ij.channelCount || 0} channels from ${item.repo || item.url}. Import?`)
        );
        if (!okImport) return;
        body.dryRun = false;
        body.confirm = true;
        const ir2 = await fetch('/api/tools/import_source', { method: 'POST', headers, body: JSON.stringify(body) });
        const ij2 = await ir2.json();
        showOsd(ij2.ok ? ('+' + (ij2.added || 0)) : (ij2.error || 'fail'));
        if (ij2.ok && typeof loadLibraryIntoTv === 'function') await loadLibraryIntoTv();
      });
      box.appendChild(b);
    });
  } catch (e) {
    box.textContent = String(e.message || e);
  }
}
document.getElementById('btnHubSearch')?.addEventListener('click', hubGithubSearch);

document.getElementById('btnRadioSearch')?.addEventListener('click', async () => {
  const q = document.getElementById('radioQ')?.value || 'vietnam';
  const box = document.getElementById('radioResults');
  box.textContent = '';
  const r = await fetch('/api/radio/search?q=' + encodeURIComponent(q));
  const j = await r.json();
  (j.stations || []).forEach(s => {
    const b = el('button', 'hub-item', s.name || 'station');
    b.appendChild(el('small', '', s.country || ''));
    b.addEventListener('click', () => {
      const a = document.getElementById('radioPlayer');
      if (a) { a.src = s.url; a.play().catch(()=>{}); }
    });
    box.appendChild(b);
  });
});

document.getElementById('btnMediaRefresh')?.addEventListener('click', async () => {
  const box = document.getElementById('mediaResults');
  box.textContent = '';
  const r = await fetch('/api/media/list');
  const j = await r.json();
  (j.items || []).forEach(it => {
    const b = el('button', 'hub-item', it.name);
    b.appendChild(el('small', '', it.type + ' · ' + it.path));
    b.addEventListener('click', () => {
      const url = '/api/media/file?path=' + encodeURIComponent(it.path);
      if (it.type === 'video') {
        const v = document.getElementById('mediaPlayer');
        v.style.display = 'block';
        v.src = url;
        v.play().catch(()=>{});
      } else {
        const a = document.getElementById('radioPlayer');
        if (a) { a.src = url; a.play().catch(()=>{}); }
      }
    });
    box.appendChild(b);
  });
  if (!(j.items || []).length) box.appendChild(el('div', '', 'Empty ./media — mount files into media/'));
});

document.getElementById('btnPodcastLoad')?.addEventListener('click', async () => {
  const url = document.getElementById('podcastUrl')?.value?.trim();
  const box = document.getElementById('podcastResults');
  box.textContent = '';
  const r = await fetch('/api/podcast/feed?url=' + encodeURIComponent(url));
  const j = await r.json();
  (j.items || []).forEach(it => {
    const b = el('button', 'hub-item', it.title);
    b.addEventListener('click', () => {
      const a = document.getElementById('podcastPlayer');
      if (a) { a.src = it.url; a.play().catch(()=>{}); }
    });
    box.appendChild(b);
  });
});

document.getElementById('btnEpgLoad')?.addEventListener('click', async () => {
  const url = document.getElementById('epgUrl')?.value?.trim();
  const headers = { 'Content-Type': 'application/json' };
  const tok = localStorage.getItem('pi_vintage_admin_token');
  if (tok) headers['X-Admin-Token'] = tok;
  const r = await fetch('/api/epg/load', { method: 'POST', headers, body: JSON.stringify({ url }) });
  const j = await r.json();
  const pre = document.getElementById('epgMeta');
  if (pre) { pre.hidden = false; pre.textContent = JSON.stringify(j, null, 2); }
});

// EPG OSD on channel change
const _playChannelOrig = typeof playChannel === 'function' ? playChannel : null;
if (_playChannelOrig) {
  window.playChannel = async function(index) {
    const r = _playChannelOrig(index);
    try {
      const ch = channels[index];
      const key = (ch && (ch.tvgId || ch.id || ch.name)) || '';
      const er = await fetch('/api/epg/now?channel=' + encodeURIComponent(key));
      const ej = await er.json();
      let osd = document.getElementById('epgOsd');
      if (!osd) {
        osd = document.createElement('div');
        osd.id = 'epgOsd';
        osd.className = 'epg-osd';
        document.getElementById('screenInner')?.appendChild(osd);
      }
      const cur = ej.current && ej.current.title;
      const next = ej.next && ej.next.title;
      osd.textContent = cur ? (`NOW: ${cur}` + (next ? ` · NEXT: ${next}` : '')) : '';
    } catch (_) {}
    return r;
  };
}

// PWA register
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
(function extendAiTools() {
  const prev = window.runAiAction;
  window.runAiAction = async function(name, args) {
    if (name === 'github_search') {
      const q = (args && (args.query || args.q || args.value)) || '';
      const input = document.getElementById('hubSearchQ');
      if (input) input.value = q;
      const hub = document.getElementById('hubPanel');
      if (hub) hub.style.display = 'block';
      document.querySelector('.hub-tab[data-hub="discover"]')?.click();
      if (typeof hubGithubSearch === 'function') await hubGithubSearch();
      return { ok: true };
    }
    if (name === 'open_hub') {
      const hub = document.getElementById('hubPanel');
      if (hub) hub.style.display = 'block';
      return { ok: true };
    }
    if (typeof prev === 'function') return prev(name, args);
    return { ok: false };
  };
  if (window.__piVintageTv) window.__piVintageTv.runAiAction = window.runAiAction;
})();


/* Swipe channels on CRT / fullscreen */
(function setupSwipeChannels() {
  const targets = () => [document.getElementById('screenInner'), document.getElementById('tv-frame-container')].filter(Boolean);
  let x0 = 0, y0 = 0, t0 = 0;
  function bind(el) {
    if (!el || el.__swipeBound) return;
    el.__swipeBound = true;
    el.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
    }, { passive: true });
    el.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      const dt = Date.now() - t0;
      if (dt > 800) return;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
      if (!channels || !channels.length) return;
      if (dx < 0) playChannel((currentChannelIndex + 1) % channels.length);
      else playChannel((currentChannelIndex - 1 + channels.length) % channels.length);
    }, { passive: true });
  }
  targets().forEach(bind);
  document.addEventListener('fullscreenchange', () => setTimeout(() => targets().forEach(bind), 50));
})();

/* ---- smart_import + remote QR in AI chat ---- */
async function toolSmartImport(args) {
  args = args || {};
  let query = args.query || args.q || args.value || args.message || '';
  const confirm = !!(args.confirm || args.force);
  if (args.usePending && window.__pendingSmartImport && window.__pendingSmartImport.query) {
    query = window.__pendingSmartImport.query;
  }
  showOsd(currentLang === 'vi' ? 'AI đang tìm nguồn…' : 'AI searching catalogs…');
  try {
    const r = await fetch('/api/tools/smart_import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, includeGithub: /github/i.test(query), confirm })
    });
    const j = await r.json();
    const append = window.appendAiMsg || window.__appendAiMsg;
    if (!j.ok) {
      const msg = (currentLang === 'vi')
        ? ('Không khớp nguồn: ' + (j.message || j.error || '') + (j.intent && j.intent.length ? ' · intent: ' + j.intent.join(', ') : ''))
        : ('No source match: ' + (j.message || j.error || ''));
      if (append) append('ai', msg);
      showOsd(j.error || 'no match');
      return j;
    }
    if (j.dryRun || j.needsConfirmation) {
      const sample = (j.sample || []).slice(0, 8).map(escapeHtmlSafe).join('<br>• ');
      const cand = (j.candidates || []).map(c => c.label || c.id).join(', ');
      const msg = (currentLang === 'vi')
        ? `🔎 <b>Xem trước</b> — <b>${escapeHtmlSafe(j.sourceLabel || j.sourceId)}</b><br>` +
          `${j.channelCount || 0} kênh · Ứng viên: ${escapeHtmlSafe(cand)}<br>` +
          (sample ? '• ' + sample + '<br>' : '') +
          `<br>Trả lời <b>"xác nhận nhập"</b> để lưu vào kho server. Không tự nhập khi chưa xác nhận.`
        : `🔎 <b>Preview</b> — <b>${escapeHtmlSafe(j.sourceLabel || j.sourceId)}</b><br>` +
          `${j.channelCount || 0} channels · Candidates: ${escapeHtmlSafe(cand)}<br>` +
          (sample ? '• ' + sample + '<br>' : '') +
          `<br>Reply <b>"confirm import"</b> to save to the server library. Nothing is imported until you confirm.`;
      if (append) append('ai', msg);
      // stash last preview query for confirm
      window.__pendingSmartImport = { query, sourceId: j.sourceId };
      showOsd((currentLang === 'vi' ? 'Xem trước ' : 'Preview ') + (j.channelCount || 0));
      return j;
    }
    const groups = j.groups ? Object.entries(j.groups).slice(0, 12).map(([k,v]) => k + ': ' + v).join(' · ') : '';
    const msg = (currentLang === 'vi')
      ? `✅ Đã nhập <b>${escapeHtmlSafe(j.sourceLabel || j.sourceId)}</b>: +${j.added || 0} · tổng ${j.total || j.channelCount}<br>${escapeHtmlSafe(groups)}`
      : `✅ Imported <b>${escapeHtmlSafe(j.sourceLabel || j.sourceId)}</b>: +${j.added || 0} · total ${j.total || j.channelCount}<br>${escapeHtmlSafe(groups)}`;
    if (append) append('ai', msg);
    window.__pendingSmartImport = null;
    showOsd((currentLang === 'vi' ? 'Đã nhập +' : 'Imported +') + (j.added || 0));
    if (typeof loadLibraryIntoTv === 'function') await loadLibraryIntoTv();
    if (typeof renderChannelManager === 'function') renderChannelManager();
    return j;
  } catch (e) {
    showOsd(String(e.message || e));
    return { ok: false, error: String(e.message || e) };
  }
}

function escapeHtmlSafe(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function toolShowRemoteAccess() {
  try {
    const r = await fetch('/api/app/access');
    const j = await r.json();
    const url = j.publicUrl || j.localUrl || location.origin;
    let qrBlock = '';
    try {
      if (typeof qrcode === 'function') {
        const qr = qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        qrBlock = qr.createSvgTag({ cellSize: 4, margin: 2 });
      }
    } catch (_) {}
    if (!qrBlock) {
      // fallback image APIs
      const u = encodeURIComponent(url);
      qrBlock = '<img class="ai-qr" alt="QR" width="200" height="200" src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + u + '" onerror="this.onerror=null;this.src=\'https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=' + u + '\'" />';
    }
    const html =
      '<div class="ai-remote-card">' +
      '<div style="font-weight:600;margin-bottom:6px">' +
      (currentLang === 'vi' ? '📡 Truy cập TV từ xa' : '📡 Remote TV access') +
      '</div>' +
      '<div style="font-size:0.85rem;word-break:break-all;margin-bottom:8px"><a href="' + escapeHtmlSafe(url) + '" target="_blank" rel="noopener">' + escapeHtmlSafe(url) + '</a></div>' +
      '<div class="ai-qr-wrap" style="text-align:center;background:#fff;border-radius:12px;padding:8px;display:inline-block">' + qrBlock + '</div>' +
      '<div style="opacity:.75;font-size:0.75rem;margin-top:8px">' +
      (currentLang === 'vi'
        ? 'Quét QR bằng điện thoại. Cấu hình SOLOHOST_PUBLIC_URL=http://IP:PORT trên SoloHost nếu link chưa đúng.'
        : 'Scan with your phone. Set SOLOHOST_PUBLIC_URL=http://IP:PORT on SoloHost if the link is wrong.') +
      '</div>' +
      '<button type="button" class="btn primary" style="margin-top:8px" onclick="navigator.clipboard&&navigator.clipboard.writeText(\'' + url.replace(/'/g, '') + '\')">' +
      (currentLang === 'vi' ? 'Sao chép link' : 'Copy link') +
      '</button></div>';
    const append = window.appendAiMsg || window.__appendAiMsg;
    if (append) append('ai', html);
    else showOsd(url);
    return { ok: true, url };
  } catch (e) {
    const append = window.appendAiMsg || window.__appendAiMsg;
    if (append) append('ai', escapeHtmlSafe(String(e.message || e)));
    return { ok: false };
  }
}

(function wireSmartAndQr() {
  const prev = window.runAiAction;
  window.runAiAction = async function(name, args) {
    if (name === 'smart_import') return toolSmartImport(args || {});
    if (name === 'show_remote_access') return toolShowRemoteAccess(args || {});
    if (typeof prev === 'function') return prev(name, args);
    return { ok: false };
  };
  if (window.__piVintageTv) window.__piVintageTv.runAiAction = window.runAiAction;
})();
document.getElementById("chGroupFilter")?.addEventListener("change", () => renderChannelManager());

/* VOD Archive.org search */
document.getElementById('btnVodSearch')?.addEventListener('click', async () => {
  const q = document.getElementById('vodQ')?.value || 'charlie chaplin';
  const box = document.getElementById('vodResults');
  if (!box) return;
  box.textContent = '';
  try {
    const r = await fetch('/api/vod/search?q=' + encodeURIComponent(q));
    const j = await r.json();
    (j.items || []).forEach(it => {
      const b = document.createElement('a');
      b.className = 'hub-item';
      b.href = it.page;
      b.target = '_blank';
      b.rel = 'noopener';
      b.textContent = (it.title || it.id) + (it.year ? ' (' + it.year + ')' : '');
      const s = document.createElement('small');
      s.textContent = 'archive.org · public catalog';
      b.appendChild(s);
      box.appendChild(b);
    });
    if (!(j.items || []).length) box.textContent = currentLang === 'vi' ? 'Không có kết quả' : 'No results';
  } catch (e) {
    box.textContent = String(e.message || e);
  }
});

/* HLS via proxy when direct fails (CORS / mixed content) */
window.__playWithProxyFallback = async function(url, channelId) {
  if (!video || !window.Hls) return;
  const tryDirect = () => new Promise((resolve) => {
    if (window.__hls) { try { window.__hls.destroy(); } catch(_){} }
    const hls = new Hls({ enableWorker: true });
    window.__hls = hls;
    let done = false;
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data && data.fatal && !done) { done = true; resolve(false); }
    });
    hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!done) { done = true; resolve(true); } });
    hls.loadSource(url);
    hls.attachMedia(video);
    setTimeout(() => { if (!done) { done = true; resolve(false); } }, 8000);
  });
  const ok = await tryDirect();
  if (ok) return true;
  const proxy = '/api/proxy/hls?c=' + encodeURIComponent(channelId || '') + '&u=' + encodeURIComponent(url);
  if (window.__hls) { try { window.__hls.destroy(); } catch(_){} }
  const hls = new Hls({ enableWorker: true });
  window.__hls = hls;
  hls.loadSource(proxy);
  hls.attachMedia(video);
  showOsd(currentLang === 'vi' ? 'Đang dùng proxy HLS' : 'Using HLS proxy');
  return true;
};
