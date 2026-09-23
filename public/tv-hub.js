// TV Hub — access/discovery layer for OFFICIAL Vietnamese broadcaster sources.
// Integrated directly into the app's main screen (no popup): channel picking
// lives inline on the page, and playback happens inside the existing TV
// screen (.screen-inner), layered above the vintage video/canvas.
//
// This module NEVER downloads, mirrors, caches, proxies, restreams, or
// redistributes video, and NEVER extracts protected stream URLs or bypasses
// DRM / geo-restriction / CSP / X-Frame-Options / anti-embedding protection.
// It only opens the official broadcaster's own page, embedded if the official
// site allows it, otherwise as a link the user opens themselves.

(function () {
  const EMBED_TIMEOUT_MS = 4000;
  const STATE_LABELS = {
    LIVE: 'Live',
    AVAILABLE: 'Available',
    SOURCE_RESTRICTED: 'Official player cannot be embedded',
    SOURCE_UNAVAILABLE: 'Official source is currently unavailable',
    NETWORK_ERROR: 'Unable to reach official source',
    ACCESS_REQUIRED: 'Viewing access is required by the official service',
    CHECKING: 'Checking…',
  };
  const STATE_CLASS = {
    LIVE: 'state-live',
    AVAILABLE: '',
    SOURCE_RESTRICTED: 'state-restricted',
    SOURCE_UNAVAILABLE: 'state-unavailable',
    NETWORK_ERROR: 'state-network',
    ACCESS_REQUIRED: 'state-access',
    CHECKING: '',
  };

  const channels = (typeof OFFICIAL_TV_CHANNELS !== 'undefined' ? OFFICIAL_TV_CHANNELS : []).filter(c => c.enabled);
  const categories = ['VTV', 'HTV'];
  let activeCategory = 'VTV';
  let activeChannelId = null;
  let embedWatchdog = null;
  let wasStaticPlaying = false;

  // Optional hook exposed by app.js (public/app.js) so we can pause/resume
  // the existing vintage player when official playback takes over the same
  // screen. Falls back to no-ops if unavailable, so this module never throws
  // even if app.js changes in the future.
  const hook = window.__piVintageTv || {};
  const noop = () => {};
  const pauseCustomPlayer = hook.pauseCustomPlayer || noop;
  const resumeCustomPlayer = hook.resumeCustomPlayer || noop;
  const isStaticPlaying = hook.isStaticPlaying || (() => false);

  const tabsEl = document.getElementById('tvHubTabs');
  const gridEl = document.getElementById('tvHubGrid');
  const frameWrap = document.getElementById('officialFrameWrap');
  const frameTitleEl = document.getElementById('officialFrameTitle');
  const frameBodyEl = document.getElementById('officialFrameBody');
  const btnCloseOfficial = document.getElementById('btnCloseOfficial');

  if (!gridEl || !frameWrap) return; // TV Hub markup not present; nothing to do.

  function renderTabs() {
    tabsEl.innerHTML = '';
    categories.forEach(cat => {
      const tab = document.createElement('button');
      tab.className = 'tv-hub-tab' + (cat === activeCategory ? ' active' : '');
      tab.textContent = '🇻🇳 ' + cat;
      tab.addEventListener('click', () => {
        activeCategory = cat;
        renderTabs();
        renderGrid();
      });
      tabsEl.appendChild(tab);
    });
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    channels
      .filter(ch => ch.category === activeCategory)
      .forEach(ch => {
        const card = document.createElement('div');
        card.className = 'tv-hub-card' + (ch.id === activeChannelId ? ' active' : '');
        card.innerHTML = `
          <span class="tv-hub-card-name">${ch.name}</span>
          <span class="tv-hub-card-provider">${ch.provider}</span>
          <span class="tv-hub-card-badge">✓ Nguồn chính thức</span>
          <span class="tv-hub-card-status" data-status-for="${ch.id}">${STATE_LABELS.AVAILABLE}</span>
          <button class="btn primary tv-hub-watch-btn">Watch</button>
        `;
        card.querySelector('.tv-hub-watch-btn').addEventListener('click', () => openChannel(ch));
        gridEl.appendChild(card);
      });
  }

  function setCardStatus(channelId, state) {
    const el = gridEl.querySelector(`[data-status-for="${channelId}"]`);
    if (el) {
      el.textContent = STATE_LABELS[state] || state;
      el.className = 'tv-hub-card-status ' + (STATE_CLASS[state] || '');
    }
  }

  function clearEmbedWatchdog() {
    if (embedWatchdog) {
      clearTimeout(embedWatchdog);
      embedWatchdog = null;
    }
  }

  function showFallback(channel, state) {
    frameBodyEl.innerHTML = `
      <div class="official-fallback">
        <div>${STATE_LABELS[state] || state}</div>
        <button class="btn primary" id="btnOpenOfficial">Open Official Player</button>
      </div>
    `;
    document.getElementById('btnOpenOfficial').addEventListener('click', () => {
      window.open(channel.sourceUrl, '_blank', 'noopener,noreferrer');
    });
  }

  // STEP 1/2/3/4 of player behavior: try the official page embedded, right on
  // the main TV screen; if the official site blocks embedding (or never
  // confirms it loaded within a short timeout) fall back to a link that opens
  // the official page directly. No stream URL is ever extracted — only the
  // official page itself is used.
  function attemptEmbed(channel) {
    frameBodyEl.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = channel.sourceUrl;
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');

    let settled = false;

    iframe.addEventListener('load', () => {
      if (settled) return;
      settled = true;
      clearEmbedWatchdog();
      setCardStatus(channel.id, 'AVAILABLE');
    });

    // Many official Vietnamese broadcaster pages send X-Frame-Options / CSP
    // frame-ancestors that silently prevent the frame from rendering, with no
    // JS error event. A bounded watchdog is the only reliable client-side
    // signal; if nothing confirms embedding within the timeout, treat it as
    // blocked and switch to the official-page fallback.
    embedWatchdog = setTimeout(() => {
      if (settled) return;
      settled = true;
      setCardStatus(channel.id, 'SOURCE_RESTRICTED');
      showFallback(channel, 'SOURCE_RESTRICTED');
    }, EMBED_TIMEOUT_MS);

    frameBodyEl.appendChild(iframe);
  }

  async function openChannel(channel) {
    clearEmbedWatchdog();
    activeChannelId = channel.id;
    renderGrid();

    wasStaticPlaying = isStaticPlaying();
    pauseCustomPlayer();

    frameTitleEl.textContent = `${channel.name} — ${channel.provider}`;
    frameBodyEl.innerHTML = `<div class="official-fallback">${STATE_LABELS.CHECKING}</div>`;
    frameWrap.style.display = 'flex';
    setCardStatus(channel.id, 'CHECKING');

    // Only the selected channel's official source is inspected, and only for
    // reachability of the official page itself — never for a video/stream URL.
    let state = 'AVAILABLE';
    try {
      const resp = await fetch(`/api/tv/status/${encodeURIComponent(channel.id)}`, { cache: 'no-store' });
      if (resp.ok) {
        const data = await resp.json();
        state = data.state || 'AVAILABLE';
      } else {
        state = 'NETWORK_ERROR';
      }
    } catch (e) {
      state = 'NETWORK_ERROR';
    }

    // If the user already switched away while the check was in flight, drop it.
    if (activeChannelId !== channel.id) return;

    if (state === 'NETWORK_ERROR' || state === 'SOURCE_UNAVAILABLE') {
      setCardStatus(channel.id, state);
      showFallback(channel, state);
      return;
    }

    attemptEmbed(channel);
  }

  function closeOfficial() {
    clearEmbedWatchdog();
    frameWrap.style.display = 'none';
    frameBodyEl.innerHTML = '';
    activeChannelId = null;
    renderGrid();
    resumeCustomPlayer();
    if (wasStaticPlaying) {
      // resumeCustomPlayer() already re-tunes to the last selected channel;
      // nothing further needed for the static-noise special channel.
    }
  }

  if (btnCloseOfficial) btnCloseOfficial.addEventListener('click', closeOfficial);

  renderTabs();
  renderGrid();
})();
