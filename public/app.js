/* Pi Vintage TV — cinema mode + country free channels */
/* ---- Free channels by country (public HLS / official pages) ---- */
const CHANNELS_BY_COUNTRY = {
  vn: [
    { id: 'vtv1', name: 'CH-01 VTV1', category: 'VTV', url: 'OFFICIAL:https://vtv.vn/truyen-hinh-truc-tuyen/vtv1.htm', officialName: 'VTV1' },
    { id: 'vtv2', name: 'CH-02 VTV2', category: 'VTV', url: 'OFFICIAL:https://vtvgo.vn/channel/2', officialName: 'VTV2' },
    { id: 'vtv3', name: 'CH-03 VTV3', category: 'VTV', url: 'OFFICIAL:https://vtv.vn/truyen-hinh-truc-tuyen/vtv3.html', officialName: 'VTV3' },
    { id: 'vtv4', name: 'CH-04 VTV4', category: 'VTV', url: 'OFFICIAL:https://vtvgo.vn/channel/4', officialName: 'VTV4' },
    { id: 'vtv5', name: 'CH-05 VTV5', category: 'VTV', url: 'OFFICIAL:https://vtvgo.vn/channel/5', officialName: 'VTV5' },
    { id: 'vtv5-tn', name: 'CH-06 VTV5 Tây Nguyên', category: 'VTV', url: 'OFFICIAL:https://vtvgo.vn/channel/6', officialName: 'VTV5 Tây Nguyên' },
    { id: 'vtv5-tnb', name: 'CH-07 VTV5 Tây Nam Bộ', category: 'VTV', url: 'OFFICIAL:https://vtvgo.vn/channel/7', officialName: 'VTV5 Tây Nam Bộ' },
    { id: 'vtv7', name: 'CH-08 VTV7', category: 'VTV', url: 'OFFICIAL:https://vtvgo.vn/channel/35', officialName: 'VTV7' },
    { id: 'vtv8', name: 'CH-09 VTV8', category: 'VTV', url: 'OFFICIAL:https://vtvgo.vn/channel/36', officialName: 'VTV8' },
    { id: 'vtv9', name: 'CH-10 VTV9', category: 'VTV', url: 'OFFICIAL:https://vtvgo.vn/channel/9', officialName: 'VTV9' },
    { id: 'vtv-ct', name: 'CH-11 VTV Cần Thơ', category: 'VTV', url: 'OFFICIAL:https://vtvgo.vn/channel/37', officialName: 'VTV Cần Thơ' },
    { id: 'htv7', name: 'CH-12 HTV7', category: 'HTV', url: 'OFFICIAL:https://www.htv.com.vn/truc-tuyen?channel=1', officialName: 'HTV7' },
    { id: 'htv9', name: 'CH-13 HTV9', category: 'HTV', url: 'OFFICIAL:https://www.htv.com.vn/truc-tuyen?channel=2', officialName: 'HTV9' },
    { id: 'static-vn', name: 'CH-14 Static', category: 'Special', url: 'STATIC' }
  ],
  us: [
    { id: 'nasa', name: 'CH-01 NASA TV Public', category: 'USA', url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-Public/master.m3u8' },
    { id: 'nasa-media', name: 'CH-02 NASA Media', category: 'USA', url: 'https://ntv2.akamaized.net/hls/live/2013923/NASA-NTV2-Media/master.m3u8' },
    { id: 'nasa-iss', name: 'CH-03 NASA ISS Cam', category: 'USA', url: 'https://astro-web.nasa.gov/external/iss/iss.m3u8' },
    { id: 'static-us', name: 'CH-04 Static', category: 'Special', url: 'STATIC' }
  ],
  jp: [
    { id: 'nhk-world', name: 'CH-01 NHK World', category: 'Japan', url: 'OFFICIAL:https://www3.nhk.or.jp/nhkworld/', officialName: 'NHK World' },
    { id: 'static-jp', name: 'CH-02 Static', category: 'Special', url: 'STATIC' }
  ],
  kr: [
    { id: 'arirang', name: 'CH-01 Arirang TV', category: 'Korea', url: 'OFFICIAL:https://www.arirang.com/live', officialName: 'Arirang' },
    { id: 'static-kr', name: 'CH-02 Static', category: 'Special', url: 'STATIC' }
  ],
  eu: [
    { id: 'dw', name: 'CH-01 DW English', category: 'Europe', url: 'OFFICIAL:https://www.dw.com/en/live-tv/s-9967', officialName: 'DW' },
    { id: 'france24', name: 'CH-02 France 24 EN', category: 'Europe', url: 'OFFICIAL:https://www.france24.com/en/live', officialName: 'France 24' },
    { id: 'euronews', name: 'CH-03 Euronews', category: 'Europe', url: 'OFFICIAL:https://www.euronews.com/live', officialName: 'Euronews' },
    { id: 'static-eu', name: 'CH-04 Static', category: 'Special', url: 'STATIC' }
  ],
  intl: [
    { id: 'nasa-intl', name: 'CH-01 NASA TV', category: 'International', url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-Public/master.m3u8' },
    { id: 'nasa-media-intl', name: 'CH-02 NASA Media', category: 'International', url: 'https://ntv2.akamaized.net/hls/live/2013923/NASA-NTV2-Media/master.m3u8' },
    { id: 'dw-intl', name: 'CH-03 DW English', category: 'International', url: 'OFFICIAL:https://www.dw.com/en/live-tv/s-9967', officialName: 'DW' },
    { id: 'france24-intl', name: 'CH-04 France 24', category: 'International', url: 'OFFICIAL:https://www.france24.com/en/live', officialName: 'France 24' },
    { id: 'aljazeera', name: 'CH-05 Al Jazeera EN', category: 'International', url: 'OFFICIAL:https://www.aljazeera.com/live', officialName: 'Al Jazeera' },
    { id: 'nhk-intl', name: 'CH-06 NHK World', category: 'International', url: 'OFFICIAL:https://www3.nhk.or.jp/nhkworld/', officialName: 'NHK World' },
    { id: 'arirang-intl', name: 'CH-07 Arirang TV', category: 'International', url: 'OFFICIAL:https://www.arirang.com/live', officialName: 'Arirang' },
    { id: 'static-intl', name: 'CH-08 Static', category: 'Special', url: 'STATIC' }
  ]
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
    tunedIn: 'Đã khớp tín hiệu'
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
    tunedIn: 'Signal locked'
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
function loadCountry(code) {
  currentCountry = CHANNELS_BY_COUNTRY[code] ? code : 'vn';
  localStorage.setItem('pi_vintage_country', currentCountry);
  if (countrySelect) countrySelect.value = currentCountry;
  const base = [...(CHANNELS_BY_COUNTRY[currentCountry] || [])];
  // Append custom channels from localStorage
  const saved = localStorage.getItem('pi_vintage_channels');
  if (saved) {
    try {
      const custom = JSON.parse(saved);
      custom.forEach(c => base.push(c));
    } catch (e) {}
  }
  channels = base;
  currentChannelIndex = 0;
  renderChannelSelect();
  if (isPoweredOn) playChannel(0);
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


function clearWatchTimers() {
  if (fitTimer) { clearTimeout(fitTimer); fitTimer = null; }
  if (staticWatchTimer) { clearTimeout(staticWatchTimer); staticWatchTimer = null; }
  if (frameContainer) frameContainer.classList.remove('tuned-in');
  if (video) video.classList.remove('video-fitted');
}

/** After 5s of playback, fit video aspect into CRT for natural TV look */
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
  }, 5000);
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
  listEl.innerHTML = '';
  channels.forEach((ch, idx) => {
    const row = document.createElement('div');
    row.className = 'ch-row' + (ch.id && String(ch.id).startsWith('custom-') ? ' ch-custom' : '');
    row.innerHTML = '<span class="ch-row-name"></span><span class="ch-row-actions"></span>';
    row.querySelector('.ch-row-name').textContent = ch.name;
    const actions = row.querySelector('.ch-row-actions');
    if (ch.id && String(ch.id).startsWith('custom-')) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'ch-mini-btn';
      editBtn.textContent = '✎';
      editBtn.title = t('editChannel');
      editBtn.addEventListener('click', () => {
        editingChannelId = ch.id;
        if (customName) customName.value = ch.name.replace(/^CH-\d+\s*/, '');
        if (customUrl) customUrl.value = ch.url || '';
      });
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'ch-mini-btn danger';
      delBtn.textContent = '✕';
      delBtn.title = t('deleteChannel');
      delBtn.addEventListener('click', () => {
        deleteCustomChannel(ch.id);
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
    } else {
      actions.textContent = '•';
      actions.style.opacity = '0.4';
    }
    row.addEventListener('dblclick', () => playChannel(idx));
    listEl.appendChild(row);
  });
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
    if (video) video.src = '';
    playStaticSound(false);
    const pageUrl = ch.url.slice(9);
    if (officialWrap && officialBody) {
      officialWrap.style.display = 'flex';
      if (officialTitle) officialTitle.textContent = ch.officialName || ch.name;
      officialBody.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.src = pageUrl;
      iframe.allow = 'autoplay; fullscreen';
      iframe.setAttribute('allowfullscreen', '');
      iframe.style.cssText = 'width:100%;height:100%;border:0;background:#000;';
      officialBody.appendChild(iframe);
    }
    return;
  }
  playStaticSound(false);
  if (typeof Hls !== 'undefined' && Hls.isSupported() && ch.url.includes('.m3u8')) {
    hls = new Hls({ enableWorker: true, lowLatencyMode: false });
    hls.loadSource(ch.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (e, data) => { if (data.fatal) playStaticSound(true); });
  } else if (video) {
    video.src = ch.url;
  }
  if (video) {
    video.play().then(() => { scheduleVideoFit(); scheduleStaticAutoOff(); }).catch(() => playStaticSound(true));
  } else {
    scheduleVideoFit();
    scheduleStaticAutoOff();
  }
}

/* Events */
if (channelSelect) channelSelect.addEventListener('change', e => playChannel(parseInt(e.target.value, 10)));
if (countrySelect) {
  countrySelect.value = currentCountry;
  countrySelect.addEventListener('change', e => loadCountry(e.target.value));
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
if (modelSelect) modelSelect.addEventListener('change', e => applyModel(e.target.value));
if (video) video.addEventListener('error', () => playStaticSound(true));

const btnCloseOfficial = document.getElementById('btnCloseOfficial');
if (btnCloseOfficial) {
  btnCloseOfficial.addEventListener('click', () => {
    const wrap = document.getElementById('officialFrameWrap');
    const body = document.getElementById('officialFrameBody');
    if (wrap) wrap.style.display = 'none';
    if (body) body.innerHTML = '';
    const first = channels.findIndex(c => c.url && !c.url.startsWith('OFFICIAL:') && c.url !== 'STATIC');
    if (first >= 0) playChannel(first);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  loadCountry(currentCountry);
  initCanvas();
  applyLanguage();
  setBwMode(isBwMode);
  const saved = localStorage.getItem('pi_vintage_model') || 'tv-international-red';
  applyModel(MODEL_BADGES[saved] ? saved : 'tv-international-red');
  setPower(true);
  setTimeout(() => playChannel(0), 400);
});

window.__piVintageTv = {
  video, channelOsd,
  isStaticPlaying: () => !!noiseNode,
  pauseCustomPlayer: () => { playStaticSound(false); if (video) video.pause(); },
  resumeCustomPlayer: () => { if (!isPoweredOn) return; playChannel(currentChannelIndex); },
  setCinemaMode
};
