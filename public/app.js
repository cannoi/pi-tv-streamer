/* Pi Vintage TV — 3 photo-matched retro frames + streaming */
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

const MODEL_BADGES = {
  'tv-international-red': 'INTERNATIONAL',
  'tv-sampo-cream': 'SAMPO',
  'tv-samsung-deluxe': 'SAMSUNG'
};

const i18n = {
  vi: { appTitle: 'Pi Vintage TV', saveChannel: 'Lưu kênh', backToChannels: '◀ Kênh thường' },
  en: { appTitle: 'Pi Vintage TV', saveChannel: 'Save Channel', backToChannels: '◀ Channels' }
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
  const badge = document.getElementById('tvBrand');
  if (badge) badge.textContent = MODEL_BADGES[modelId];
  const spBadge = document.getElementById('speakerBadge');
  if (spBadge) {
    if (modelId === 'tv-international-red') spBadge.textContent = '14';
    else spBadge.textContent = '';
  }
  const frontBrand = document.getElementById('frontBrand');
  if (frontBrand) {
    frontBrand.textContent = modelId === 'tv-sampo-cream' ? 'SAMPO' : '';
  }
  const panelBrand = document.getElementById('panelBrand');
  if (panelBrand) {
    panelBrand.textContent = modelId === 'tv-samsung-deluxe' ? 'SAMSUNG' : '';
  }
  const bezelBrand = document.getElementById('bezelBrand');
  if (bezelBrand) {
    bezelBrand.textContent = modelId === 'tv-international-red' ? 'INTERNATIONAL' : '';
  }
}

function setBwMode(on) {
  isBwMode = on;
  document.body.classList.toggle('mode-bw', on);
  if (btnBw) btnBw.classList.toggle('active', on);
  localStorage.setItem('pi_vintage_bw', on ? '1' : '0');
}

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
  } else if (noiseNode) {
    noiseNode.stop();
    noiseNode.disconnect();
    noiseNode = null;
  }
}
function showOsd(text) {
  channelOsd.textContent = text;
  channelOsd.classList.add('show');
  setTimeout(() => channelOsd.classList.remove('show'), 2400);
}
function setPower(on) {
  isPoweredOn = on;
  frameContainer.classList.toggle('powered-off', !on);
  btnPower.classList.toggle('active', on);
  if (on) {
    video.style.display = 'block';
    playChannel(currentChannelIndex);
  } else {
    video.pause();
    video.style.display = 'none';
    playStaticSound(false);
  }
}

function playChannel(index) {
  if (index < 0 || index >= channels.length) return;
  currentChannelIndex = index;
  channelSelect.value = index;
  frameContainer.style.setProperty('--ch-rot', (index * 30) + 'deg');
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
    }
    return;
  }
  playStaticSound(false);
  if (Hls.isSupported() && ch.url.includes('.m3u8')) {
    hls = new Hls({ enableWorker: true, lowLatencyMode: false });
    hls.loadSource(ch.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (e, data) => { if (data.fatal) playStaticSound(true); });
  } else {
    video.src = ch.url;
  }
  video.play().catch(() => playStaticSound(true));
}

/* Events */
channelSelect.addEventListener('change', e => playChannel(parseInt(e.target.value, 10)));
btnPower.addEventListener('click', () => setPower(!isPoweredOn));
/* Physical knobs on the TV frames: .act-channel = channel dial, .act-power = power / OFF-VOL knob */
function bindKnob(el, handler) {
  el.addEventListener('click', handler);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
  });
}
document.querySelectorAll('.act-power').forEach(el => bindKnob(el, () => setPower(!isPoweredOn)));
document.querySelectorAll('.act-channel').forEach(el => bindKnob(el, () => {
  if (!isPoweredOn) return;
  playChannel((currentChannelIndex + 1) % channels.length);
}));
btnNext.addEventListener('click', () => {
  if (!isPoweredOn) return;
  playChannel((currentChannelIndex + 1) % channels.length);
});
btnPrev.addEventListener('click', () => {
  if (!isPoweredOn) return;
  playChannel((currentChannelIndex - 1 + channels.length) % channels.length);
});
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
    category: 'Custom', url
  });
  const customOnly = channels.filter(c => !defaultChannels.some(d => d.id === c.id));
  localStorage.setItem('pi_vintage_channels', JSON.stringify(customOnly));
  renderChannelSelect();
  customName.value = ''; customUrl.value = '';
  addBox.style.display = 'none';
  playChannel(channels.length - 1);
});
btnLang.addEventListener('click', () => {
  currentLang = currentLang === 'vi' ? 'en' : 'vi';
  localStorage.setItem('pi_vintage_lang', currentLang);
  applyLanguage();
});
if (btnBw) btnBw.addEventListener('click', () => setBwMode(!isBwMode));
if (modelSelect) {
  modelSelect.addEventListener('change', e => applyModel(e.target.value));
}
video.addEventListener('error', () => playStaticSound(true));

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
  loadStoredChannels();
  renderChannelSelect();
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
  pauseCustomPlayer: () => { playStaticSound(false); video.pause(); },
  resumeCustomPlayer: () => { if (!isPoweredOn) return; playChannel(currentChannelIndex); }
};
