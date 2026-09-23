const defaultChannels = [
  {
    id: 'vtv1',
    name: 'CH 01 - VTV1 HD',
    category: 'Việt Nam',
    url: 'https://live.vnpt-media.vn/vtv1_1080p/index.m3u8'
  },
  {
    id: 'vtv3',
    name: 'CH 02 - VTV3 HD',
    category: 'Việt Nam',
    url: 'https://live.vnpt-media.vn/vtv3_1080p/index.m3u8'
  },
  {
    id: 'vtv9',
    name: 'CH 03 - VTV9',
    category: 'Việt Nam',
    url: 'https://live.vnpt-media.vn/vtv9_1080p/index.m3u8'
  },
  {
    id: 'nasa',
    name: 'CH 04 - NASA TV (Quốc tế)',
    category: 'Quốc tế',
    url: 'https://nasa-i.akamaihd.net/hls/live/509460/NASA-TV-HD/master.m3u8'
  },
  {
    id: 'static-test',
    name: 'CH 05 - Test Màn Hình Nhiễu (Static)',
    category: 'Đặc biệt',
    url: 'STATIC'
  }
];

let channels = [...defaultChannels];
let currentChannelIndex = 0;
let isPoweredOn = true;
let audioCtx = null;
let noiseNode = null;
let hls = null;

const video = document.getElementById('tvVideo');
const canvas = document.getElementById('staticCanvas');
const ctx = canvas.getContext('2d');
const channelSelect = document.getElementById('channelSelect');
const channelOsd = document.getElementById('channelOsd');
const powerKnob = document.getElementById('powerKnob');
const dialKnob = document.getElementById('dialKnob');
const btnStatic = document.getElementById('btnStatic');
const btnAddModal = document.getElementById('btnAddModal');
const addBox = document.getElementById('addBox');
const btnSaveCustom = document.getElementById('btnSaveCustom');
const customName = document.getElementById('customName');
const customUrl = document.getElementById('customUrl');

function loadStoredChannels() {
  const saved = localStorage.getItem('pi_vintage_channels');
  if (saved) {
    try {
      const custom = JSON.parse(saved);
      channels = [...defaultChannels, ...custom];
    } catch(e) {}
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
    if (!isPoweredOn || channels[currentChannelIndex].url === 'STATIC' || video.paused || video.error) {
      const idata = ctx.createImageData(canvas.width, canvas.height);
      const buffer32 = new Uint32Array(idata.data.buffer);
      for (let i = 0; i < buffer32.length; i++) {
        if (Math.random() < 0.4) {
          buffer32[i] = 0xffffffff;
        } else {
          buffer32[i] = 0xff000000;
        }
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
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playStaticSound(enable) {
  initAudio();
  if (enable) {
    if (noiseNode) return;
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;
    noiseNode.loop = true;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    
    const gain = audioCtx.createGain();
    gain.gain.value = 0.08;
    
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
  channelOsd.textContent = text;
  channelOsd.classList.add('show');
  setTimeout(() => {
    channelOsd.classList.remove('show');
  }, 2500);
}

function playChannel(index) {
  currentChannelIndex = index;
  channelSelect.value = index;
  const ch = channels[index];
  showOsd(ch.name);

  if (!isPoweredOn) return;

  if (hls) {
    hls.destroy();
    hls = null;
  }

  if (ch.url === 'STATIC') {
    video.src = '';
    playStaticSound(true);
    return;
  }

  playStaticSound(false);

  if (Hls.isSupported() && ch.url.includes('.m3u8')) {
    hls = new Hls();
    hls.loadSource(ch.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        playStaticSound(true);
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = ch.url;
  } else {
    video.src = ch.url;
  }
  
  video.play().catch(() => {
    playStaticSound(true);
  });
}

video.addEventListener('error', () => {
  playStaticSound(true);
});

channelSelect.addEventListener('change', (e) => {
  playChannel(parseInt(e.target.value));
});

powerKnob.addEventListener('click', () => {
  isPoweredOn = !isPoweredOn;
  if (isPoweredOn) {
    powerKnob.style.transform = 'rotate(0deg)';
    video.style.display = 'block';
    playChannel(currentChannelIndex);
  } else {
    powerKnob.style.transform = 'rotate(90deg)';
    video.pause();
    video.style.display = 'none';
    playStaticSound(false);
  }
});

dialKnob.addEventListener('click', () => {
  if (!isPoweredOn) return;
  let next = (currentChannelIndex + 1) % channels.length;
  playChannel(next);
});

btnStatic.addEventListener('click', () => {
  if (!isPoweredOn) return;
  playChannel(channels.findIndex(c => c.url === 'STATIC'));
});

btnAddModal.addEventListener('click', () => {
  addBox.style.display = addBox.style.display === 'none' ? 'flex' : 'none';
});

btnSaveCustom.addEventListener('click', () => {
  const name = customName.value.trim();
  const url = customUrl.value.trim();
  if (!name || !url) {
    alert('Vui lòng nhập đầy đủ tên và URL kênh!');
    return;
  }
  const newCh = { id: 'custom-' + Date.now(), name: 'CH ' + (channels.length + 1) + ' - ' + name, category: 'Cá nhân', url: url };
  channels.push(newCh);
  
  const customOnly = channels.filter(c => !defaultChannels.some(d => d.id === c.id));
  localStorage.setItem('pi_vintage_channels', JSON.stringify(customOnly));
  
  renderChannelSelect();
  customName.value = '';
  customUrl.value = '';
  addBox.style.display = 'none';
  playChannel(channels.length - 1);
});

window.addEventListener('DOMContentLoaded', () => {
  loadStoredChannels();
  renderChannelSelect();
  initCanvas();
  setTimeout(() => {
    playChannel(0);
  }, 500);
});
