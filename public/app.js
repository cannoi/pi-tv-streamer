/* Pi Vintage TV — Authentic Vietnamese Retro Museum
   Streaming logic preserved; presentation = 5 historical brands */
const streamChannels = [
  { id: 'vtv1', name: 'CH-01 VTV1 HD', category: 'Stream', url: 'https://live.vnpt-media.vn/vtv1_1080p/index.m3u8' },
  { id: 'vtv3', name: 'CH-02 VTV3 HD', category: 'Stream', url: 'https://live.vnpt-media.vn/vtv3_1080p/index.m3u8' },
  { id: 'vtv9', name: 'CH-03 VTV9', category: 'Stream', url: 'https://live.vnpt-media.vn/vtv9_1080p/index.m3u8' },
  { id: 'nasa', name: 'CH-04 NASA TV', category: 'International', url: 'https://nasa-i.akamaihd.net/hls/live/509460/NASA-TV-HD/master.m3u8' },
  { id: 'static-test', name: 'CH-05 Static', category: 'Special', url: 'STATIC' }
];

function buildOfficialChannels() {
  const list = (typeof OFFICIAL_TV_CHANNELS !== 'undefined' ? OFFICIAL_TV_CHANNELS : []).filter(c => c.enabled);
  let n = streamChannels.length;
  return list.map(c => {
    n += 1;
    return {
      id: 'official-' + c.id,
      name: 'CH-' + String(n).padStart(2, '0') + ' ' + c.name + ' ★',
      category: c.provider || 'Official',
      url: 'OFFICIAL:' + c.sourceUrl,
      officialName: c.name
    };
  });
}

const defaultChannels = [...streamChannels, ...buildOfficialChannels()];
let channels = [...defaultChannels];
let currentChannelIndex = 0;
let isPoweredOn = true;
let isBwMode = localStorage.getItem('pi_vintage_bw') === '1';
let audioCtx = null;
let noiseNode = null;
let hls = null;
let currentLang = localStorage.getItem('pi_vintage_lang') || 'vi';

const video = document.getElementById('tvVideo');
const canvas = document.getElementById('staticCanvas');
const ctx = canvas.getContext('2d');
const channelSelect = document.getElementById('channelSelect');
const channelOsd = document.getElementById('channelOsd');
const powerKnob = document.getElementById('powerKnob');
const dialKnob = document.getElementById('dialKnob');
const powerKnobBottom = document.getElementById('powerKnobBottom');
const dialKnobBottom = document.getElementById('dialKnobBottom');
const btnStatic = document.getElementById('btnStatic');
const btnAddModal = document.getElementById('btnAddModal');
const addBox = document.getElementById('addBox');
const btnSaveCustom = document.getElementById('btnSaveCustom');
const customName = document.getElementById('customName');
const customUrl = document.getElementById('customUrl');
const tvCabinet = document.getElementById('tvCabinet');
const screenBezel = document.getElementById('screenBezel');
const btnPower = document.getElementById('btnPower');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const btnLang = document.getElementById('btnLang');
const btnTheme = document.getElementById('btnTheme');
const btnBw = document.getElementById('btnBw');
const brandStrip = document.getElementById('brandStrip');

/* ===== i18n ===== */
const i18n = {
  vi: {
    appTitle: 'Bảo Tàng TV Việt',
    saveChannel: 'Lưu kênh',
    backToChannels: '◀ Kênh thường',
    national: 'National', sharp: 'Sharp', sony: 'Sony Trinitron',
    rubin: 'Rubin', viettronics: 'Viettronics'
  },
  en: {
    appTitle: 'Vietnam TV Museum',
    saveChannel: 'Save Channel',
    backToChannels: '◀ Regular Channels',
    national: 'National', sharp: 'Sharp', sony: 'Sony Trinitron',
    rubin: 'Rubin', viettronics: 'Viettronics'
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
  btnLang.textContent = currentLang === 'vi' ? '🌐 EN' : '🌐 VI';
  document.documentElement.lang = currentLang;
}

/* ===== 5 Historical Brands ===== */
const THEMES = {
  national:    { brand: 'NATIONAL',     label: 'National' },
  sharp:       { brand: 'SHARP',        label: 'Sharp' },
  sony:        { brand: 'Sony Trinitron', label: 'Sony' },
  rubin:       { brand: 'РУБИН',        label: 'Rubin' },
  viettronics: { brand: 'VIETTRONICS',  label: 'Viettronics' }
};

function applyTheme(themeId) {
  if (!THEMES[themeId]) themeId = 'national';
  const theme = THEMES[themeId];
  tvCabinet.dataset.theme = themeId;
  localStorage.setItem('pi_vintage_theme', themeId);
  const brandEl = document.getElementById('tvBrand');
  if (brandEl) brandEl.textContent = theme.brand;
  // Brand strip active state
  document.querySelectorAll('.brand-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.theme === themeId);
  });
}

function cycleTheme() {
  const ids = Object.keys(THEMES);
  const current = tvCabinet.dataset.theme || 'national';
  const next = ids[(ids.indexOf(current) + 1) % ids.length];
  applyTheme(next);
}

/* ===== B&W / Color ===== */
function setBwMode(on) {
  isBwMode = on;
  document.body.classList.toggle('mode-bw', on);
  if (btnBw) btnBw.classList.toggle('active', on);
  localStorage.setItem('pi_vintage_bw', on ? '1' : '0');
}

/* ===== Channels & playback (preserved logic) ===== */
function loadStoredChannels() {
  const saved = localStorage.getItem('pi_vintage_channels');
  if (saved) {
    try {
      const custom = JSON.parse(saved);
      channels = [...defaultChannels, ...custom];
    } catch (e) {}
  }
}
function renderChannelSelect() {
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
  canvas.width = 320;
  canvas.height = 240;
  function drawStatic() {
    if (!isPoweredOn || (channels[currentChannelIndex] && channels[currentChannelIndex].url === 'STATIC') || video.paused || video.error) {
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
  } else {
    if (noiseNode) {
      noiseNode.stop();
      noiseNode.disconnect();
      noiseNode = null;
    }
  }
}
function showOsd(text) {
  // Format like retro OSD: CH-01
  channelOsd.textContent = text;
  channelOsd.classList.add('show');
  setTimeout(() => channelOsd.classList.remove('show'), 2400);
}
function setPower(on) {
  isPoweredOn = on;
  tvCabinet.classList.toggle('powered-off', !on);
  btnPower.classList.toggle('active', on);
  if (on) {
    if (powerKnob) powerKnob.style.transform = 'rotate(0deg)';
    if (powerKnobBottom) powerKnobBottom.style.transform = 'rotate(0deg)';
    video.style.display = 'block';
    playChannel(currentChannelIndex);
  } else {
    if (powerKnob) powerKnob.style.transform = 'rotate(90deg)';
    if (powerKnobBottom) powerKnobBottom.style.transform = 'rotate(90deg)';
    video.pause();
    video.style.display = 'none';
    playStaticSound(false);
  }
}

function playChannel(index) {
  if (index < 0 || index >= channels.length) return;
  currentChannelIndex = index;
  channelSelect.value = index;
  const ch = channels[index];
  showOsd(ch.name);

  if (!isPoweredOn) return;

  if (hls) { hls.destroy(); hls = null; }

  const officialWrap = document.getElementById('officialFrameWrap');
  const officialBody = document.getElementById('officialFrameBody');
  const officialTitle = document.getElementById('officialFrameTitle');
  if (officialWrap) officialWrap.style.display = 'none';
  if (officialBody) officialBody.innerHTML = '';

  if (ch.url === 'STATIC') {
    video.src = '';
    playStaticSound(true);
    return;
  }

  if (ch.url && ch.url.startsWith('OFFICIAL:')) {
    video.src = '';
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
      const fallback = document.createElement('div');
      fallback.style.cssText = 'text-align:center;padding:12px;';
      const a = document.createElement('a');
      a.href = pageUrl; a.target = '_blank'; a.rel = 'noopener';
      a.className = 'btn primary'; a.textContent = 'Open Official Site';
      fallback.appendChild(a);
      officialBody.appendChild(fallback);
    }
    return;
  }

  playStaticSound(false);

  if (Hls.isSupported() && ch.url.includes('.m3u8')) {
    hls = new Hls({ enableWorker: true, lowLatencyMode: false });
    hls.loadSource(ch.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) playStaticSound(true);
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = ch.url;
  } else {
    video.src = ch.url;
  }
  video.play().catch(() => playStaticSound(true));
}

/* ===== Event listeners ===== */
channelSelect.addEventListener('change', (e) => {
  playChannel(parseInt(e.target.value, 10));
});
if (powerKnob) powerKnob.addEventListener('click', () => setPower(!isPoweredOn));
if (powerKnobBottom) powerKnobBottom.addEventListener('click', () => setPower(!isPoweredOn));
btnPower.addEventListener('click', () => setPower(!isPoweredOn));

function nextChannel() {
  if (!isPoweredOn) return;
  playChannel((currentChannelIndex + 1) % channels.length);
}
function prevChannel() {
  if (!isPoweredOn) return;
  playChannel((currentChannelIndex - 1 + channels.length) % channels.length);
}
if (dialKnob) dialKnob.addEventListener('click', nextChannel);
if (dialKnobBottom) dialKnobBottom.addEventListener('click', nextChannel);
btnNext.addEventListener('click', nextChannel);
btnPrev.addEventListener('click', prevChannel);

btnStatic.addEventListener('click', () => {
  if (!isPoweredOn) return;
  const idx = channels.findIndex(c => c.url === 'STATIC');
  if (idx >= 0) playChannel(idx);
});
btnAddModal.addEventListener('click', () => {
  addBox.style.display = addBox.style.display === 'none' ? 'flex' : 'none';
});
btnSaveCustom.addEventListener('click', () => {
  const name = customName.value.trim();
  const url = customUrl.value.trim();
  if (!name || !url) {
    alert(currentLang === 'vi' ? 'Vui lòng nhập tên và URL!' : 'Please enter name and URL!');
    return;
  }
  channels.push({
    id: 'custom-' + Date.now(),
    name: 'CH-' + String(channels.length + 1).padStart(2, '0') + ' ' + name,
    category: 'Custom',
    url
  });
  const customOnly = channels.filter(c => !defaultChannels.some(d => d.id === c.id));
  localStorage.setItem('pi_vintage_channels', JSON.stringify(customOnly));
  renderChannelSelect();
  customName.value = '';
  customUrl.value = '';
  addBox.style.display = 'none';
  playChannel(channels.length - 1);
});

btnLang.addEventListener('click', () => {
  currentLang = currentLang === 'vi' ? 'en' : 'vi';
  localStorage.setItem('pi_vintage_lang', currentLang);
  applyLanguage();
});
if (btnTheme) btnTheme.addEventListener('click', () => cycleTheme());
if (btnBw) btnBw.addEventListener('click', () => setBwMode(!isBwMode));

// Brand strip chips
if (brandStrip) {
  brandStrip.querySelectorAll('.brand-chip').forEach(chip => {
    chip.addEventListener('click', () => applyTheme(chip.dataset.theme));
  });
}

video.addEventListener('error', () => playStaticSound(true));

const btnCloseOfficial = document.getElementById('btnCloseOfficial');
if (btnCloseOfficial) {
  btnCloseOfficial.addEventListener('click', () => {
    const wrap = document.getElementById('officialFrameWrap');
    const body = document.getElementById('officialFrameBody');
    if (wrap) wrap.style.display = 'none';
    if (body) body.innerHTML = '';
    const firstStream = channels.findIndex(c => c.url && !c.url.startsWith('OFFICIAL:') && c.url !== 'STATIC');
    if (firstStream >= 0) playChannel(firstStream);
  });
}

/* ===== Init ===== */
window.addEventListener('DOMContentLoaded', () => {
  loadStoredChannels();
  renderChannelSelect();
  initCanvas();
  applyLanguage();
  setBwMode(isBwMode);

  const savedTheme = localStorage.getItem('pi_vintage_theme') || 'national';
  applyTheme(THEMES[savedTheme] ? savedTheme : 'national');

  setPower(true);
  setTimeout(() => playChannel(0), 400);
});

/* Hook for tv-hub.js (kept intact) */
window.__piVintageTv = {
  video,
  channelOsd,
  isStaticPlaying: () => !!noiseNode,
  pauseCustomPlayer: () => { playStaticSound(false); video.pause(); },
  resumeCustomPlayer: () => { if (!isPoweredOn) return; playChannel(currentChannelIndex); }
};
