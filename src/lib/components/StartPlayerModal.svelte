<script>
  import { untrack, onMount } from 'svelte';
  import { trapFocus } from '$lib/utils/a11y.js';
  let { open = $bindable(false) } = $props();

  let playerCount = $state(2);
  /** @type {string[]} */
  let names = $state(['', '']);
  let step = $state('setup'); // 'setup' | 'result'
  let spinning = $state(false);
  let spinningName = $state('');
  let winner = $state('');

  // Mobile device & touch detection
  let isMobileTouch = $state(false);
  let activeTab = $state('list'); // 'list' | 'picker'
  let fullscreenActive = $state(false);

  onMount(() => {
    const checkDevice = () => {
      isMobileTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  });

  // Multi-touch color palette & states
  const NEON_COLORS = [
    'hsl(12, 100%, 60%)',  // Warm Red/Orange
    'hsl(38, 100%, 55%)',  // Gold/Orange
    'hsl(145, 100%, 50%)', // Emerald Green
    'hsl(172, 100%, 50%)', // Turquoise
    'hsl(195, 100%, 55%)', // Cyan
    'hsl(250, 100%, 65%)', // Indigo/Purple
    'hsl(285, 100%, 60%)', // Amethyst/Magenta
    'hsl(325, 100%, 60%)'  // Pink
  ];

  /**
   * @typedef {Object} ActiveTouch
   * @property {number} id - Touch-Identifikator
   * @property {number} x - X-Koordinate
   * @property {number} y - Y-Koordinate
   * @property {string} color - Zugeordnete Neon-Farbe
   */
  /** @type {ActiveTouch[]} */
  let activeTouches = $state([]);
  let touchState = $state('waiting'); // 'waiting' | 'stabilizing' | 'countdown' | 'selecting' | 'finished'
  let countdownValue = $state(null);
  let winnerTouchId = $state(null);
  let pickerWinnerName = $state('');
  
  /** @type {any[]} */
  let particles = $state([]);
  let particleAnimationActive = false;

  let stabilityTimer = null;
  let countdownTimer = null;

  $effect(() => {
    const count = playerCount; // tracked
    names = untrack(() => Array.from({ length: count }, (_, i) => names[i] ?? ''));
  });

  function vibrate(ms) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        console.warn('Vibration failed', e);
      }
    }
  }

  function resetFingerPicker() {
    clearTimeout(stabilityTimer);
    clearInterval(countdownTimer);
    activeTouches = [];
    touchState = 'waiting';
    countdownValue = null;
    winnerTouchId = null;
    pickerWinnerName = '';
    particles = [];
  }

  function handleClose() {
    resetFingerPicker();
    close();
  }

  function close() {
    open = false;
    step = 'setup';
    spinning = false;
    winner = '';
    fullscreenActive = false;
    resetFingerPicker();
  }

  function draw() {
    const validNames = names.map((n, i) => n.trim() || `Spieler ${i + 1}`);
    step = 'result';
    spinning = true;

    let cycles = 0;
    const maxCycles = 20 + Math.floor(Math.random() * 15);
    const interval = setInterval(() => {
      spinningName = validNames[Math.floor(Math.random() * validNames.length)];
      cycles++;
      if (cycles >= maxCycles) {
        clearInterval(interval);
        winner = validNames[Math.floor(Math.random() * validNames.length)];
        spinningName = winner;
        spinning = false;
      }
    }, 80);
  }

  // Touch handlers
  function handleTouchStart(e) {
    e.preventDefault();
    if (touchState === 'finished' || touchState === 'selecting') return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (activeTouches.some(t => t.id === touch.identifier)) continue;
      
      const unusedColors = NEON_COLORS.filter(c => !activeTouches.some(t => t.color === c));
      const color = unusedColors.length > 0 
        ? unusedColors[Math.floor(Math.random() * unusedColors.length)] 
        : NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];

      activeTouches.push({
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        color
      });
    }
    activeTouches = [...activeTouches];
    vibrate(15);
    checkCountdownTrigger();
  }

  function handleTouchMove(e) {
    e.preventDefault();
    if (touchState === 'finished' || touchState === 'selecting') return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const match = activeTouches.find(t => t.id === touch.identifier);
      if (match) {
        match.x = touch.clientX;
        match.y = touch.clientY;
      }
    }
    activeTouches = [...activeTouches];
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    if (touchState === 'finished' || touchState === 'selecting') return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      activeTouches = activeTouches.filter(t => t.id !== touch.identifier);
    }
    activeTouches = [...activeTouches];
    checkCountdownTrigger();
  }

  function checkCountdownTrigger() {
    clearTimeout(stabilityTimer);
    clearInterval(countdownTimer);

    if (touchState === 'finished' || touchState === 'selecting') return;

    if (activeTouches.length < 2) {
      touchState = 'waiting';
      countdownValue = null;
      return;
    }

    touchState = 'stabilizing';
    countdownValue = null;

    stabilityTimer = setTimeout(() => {
      startCountdown();
    }, 1500);
  }

  function startCountdown() {
    touchState = 'countdown';
    countdownValue = 3;
    vibrate(30);

    countdownTimer = setInterval(() => {
      if (countdownValue > 1) {
        countdownValue--;
        vibrate(30);
      } else {
        clearInterval(countdownTimer);
        countdownValue = 0;
        selectWinner();
      }
    }, 1000);
  }

  // Draw selection
  function selectWinner() {
    touchState = 'selecting';
    vibrate(100);

    let flashInterval = setInterval(() => {
      vibrate(15);
    }, 100);

    setTimeout(() => {
      clearInterval(flashInterval);
      
      if (activeTouches.length > 0) {
        const winnerIdx = Math.floor(Math.random() * activeTouches.length);
        const winnerTouch = activeTouches[winnerIdx];
        winnerTouchId = winnerTouch.id;
        
        const validNames = names.map((n, i) => n.trim() || `Spieler ${i + 1}`);
        pickerWinnerName = validNames[winnerIdx] || `Spieler ${winnerIdx + 1}`;
        
        touchState = 'finished';
        vibrate([150, 50, 150]);

        // Spawn particles
        activeTouches.forEach((t) => {
          if (t.id !== winnerTouchId) {
            spawnParticles(t.x, t.y, t.color, 25);
          } else {
            spawnParticles(t.x, t.y, 'hsl(45, 100%, 60%)', 40);
          }
        });
      } else {
        resetFingerPicker();
      }
    }, 1200);
  }

  function spawnParticles(x, y, color, count = 25) {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      const size = 3 + Math.random() * 5;
      temp.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size,
        opacity: 1
      });
    }
    particles = [...particles, ...temp];
  }

  function updateParticles() {
    if (particles.length === 0) {
      particleAnimationActive = false;
      return;
    }

    particles = particles.map(p => {
      return {
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy + 0.15,
        opacity: p.opacity - 0.025,
        size: p.size * 0.96
      };
    }).filter(p => p.opacity > 0);

    if (particles.length > 0) {
      requestAnimationFrame(updateParticles);
    } else {
      particleAnimationActive = false;
    }
  }

  $effect(() => {
    if (particles.length > 0 && !particleAnimationActive) {
      particleAnimationActive = true;
      requestAnimationFrame(updateParticles);
    }
  });
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && open) handleClose(); }} />

<div class="overlay-backdrop" class:active={open} id="startplayer-modal" role="dialog" aria-modal="true" aria-label="Startspieler">
  <button class="overlay-backdrop-close" aria-label="Schließen" tabindex="-1" onclick={handleClose}></button>
  <!-- Hidden global SVG gradients definition accessible everywhere in the DOM -->
  <svg style="position: absolute; width: 0; height: 0; overflow: hidden;" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="crownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(45, 100%, 65%)" />
        <stop offset="100%" stop-color="hsl(35, 100%, 50%)" />
      </linearGradient>
    </defs>
  </svg>

  <div class="overlay-card glass-panel raffle-card" use:trapFocus>
    <button class="btn-close-overlay" id="btn-close-startplayer" onclick={handleClose} aria-label="Schließen">
      <svg class="icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <div class="raffle-header">
      <span class="raffle-subtitle">Zufallsauswahl</span>
      <h2 class="raffle-title">
        Startspieler auslosen 
        <svg class="inline-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-left:4px; color:var(--color-primary); filter:drop-shadow(0 0 6px var(--color-primary-glow));">
          <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
          <circle cx="12" cy="12" r="1.5" fill="currentColor"></circle>
          <circle cx="7" cy="7" r="1.2" fill="currentColor"></circle>
          <circle cx="17" cy="17" r="1.2" fill="currentColor"></circle>
          <circle cx="7" cy="17" r="1.2" fill="currentColor"></circle>
          <circle cx="17" cy="7" r="1.2" fill="currentColor"></circle>
        </svg>
      </h2>
    </div>

    {#if isMobileTouch}
      <div class="modal-tabs">
        <button 
          type="button" 
          class="modal-tab-btn" 
          class:active={activeTab === 'list'} 
          onclick={() => { activeTab = 'list'; resetFingerPicker(); }}
        >
          <svg class="icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; display:inline-block; vertical-align:middle;">
            <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
            <circle cx="12" cy="12" r="1.5" fill="currentColor"></circle>
            <circle cx="7" cy="7" r="1.2" fill="currentColor"></circle>
            <circle cx="17" cy="17" r="1.2" fill="currentColor"></circle>
            <circle cx="7" cy="17" r="1.2" fill="currentColor"></circle>
            <circle cx="17" cy="7" r="1.2" fill="currentColor"></circle>
          </svg>
          Liste
        </button>
        <button 
          type="button" 
          class="modal-tab-btn" 
          class:active={activeTab === 'picker'} 
          onclick={() => { activeTab = 'picker'; resetFingerPicker(); }}
        >
          <svg class="icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px; display:inline-block; vertical-align:middle;">
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5"></path>
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path>
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path>
            <path d="M18 8a2 2 0 0 1 2 2v4a6 6 0 0 1-12 0v-4"></path>
          </svg>
          Finger-Picker
        </button>
      </div>
    {/if}

    {#if activeTab === 'list' || !isMobileTouch}
      {#if step === 'setup'}
        <div id="startplayer-setup-view">
          <div class="player-count-selector">
            <span class="selector-label">Anzahl Spieler:</span>
            <div class="stepper">
              <button type="button" class="btn-stepper" id="btn-startplayer-decrement"
                onclick={() => { if (playerCount > 2) playerCount--; }}>−</button>
              <span class="stepper-value" id="startplayer-count-value">{playerCount}</span>
              <button type="button" class="btn-stepper" id="btn-startplayer-increment"
                onclick={() => { if (playerCount < 8) playerCount++; }}>+</button>
            </div>
          </div>

          <div class="raffle-names-list" id="startplayer-names-list">
            {#each names as name, i}
              <input
                type="text"
                class="player-input"
                placeholder="Spieler {i + 1}"
                bind:value={names[i]}
                maxlength="30"
              />
            {/each}
          </div>

          <button type="button" class="btn btn-primary draw-btn" id="btn-startplayer-draw" onclick={draw}>
            Startspieler ermitteln ➔
          </button>
        </div>

      {:else}
        <div id="startplayer-result-view" class="result-view">
          {#if spinning || !winner}
            <div class="raffle-wheel-container">
              <div class="raffle-active-name" id="raffle-spinning-name" class:spinning>{spinningName}</div>
            </div>
          {/if}

          {#if !spinning && winner}
            <div class="winner-box" style="animation: scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards">
              <div class="winner-trophy">
                <svg class="winner-crown-svg" viewBox="0 0 24 24" width="56" height="56" fill="url(#crownGrad)" stroke="none" style="filter:drop-shadow(0 0 12px hsl(45, 100%, 60%)); margin: 0 auto 12px;">
                  <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
                  <path d="M5 20h14v2H5v-2z" />
                </svg>
              </div>
              <h3 class="winner-label">Der Startspieler ist:</h3>
              <div class="winner-name" id="raffle-winner-name">{winner}</div>
              <button type="button" class="btn btn-primary" id="btn-startplayer-finish" onclick={handleClose}>
                Fertig & Schließen
              </button>
            </div>
          {/if}
        </div>
      {/if}
    {:else}
      <!-- Finger-Picker Setup View -->
      <div class="picker-setup-info">
        <div class="picker-setup-icon">
          <svg class="picker-setup-svg" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-primary); filter:drop-shadow(0 0 15px var(--color-primary-glow));">
            <circle cx="12" cy="6" r="3" stroke="var(--color-secondary)" stroke-width="1" opacity="0.4" style="animation: setupWave 2s infinite;" />
            <circle cx="12" cy="6" r="5" stroke="var(--color-secondary)" stroke-width="0.8" opacity="0.2" style="animation: setupWave 2s infinite 0.5s;" />
            <path d="M18 13V9a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"></path>
            <path d="M14 12V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v7"></path>
            <path d="M10 12.5V8a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v7"></path>
            <path d="M18 10a2 2 0 0 1 2 2v4a6 6 0 0 1-12 0v-4"></path>
          </svg>
        </div>
        <p class="picker-setup-text">
          Jeder Spieler legt einen Finger auf das Display. Die App erkennt die Berührungen und bestimmt nach einem Countdown zufällig den Startspieler!
        </p>
        <button type="button" class="btn btn-primary draw-btn" onclick={() => { fullscreenActive = true; resetFingerPicker(); }}>
          Finger-Picker starten 
          <svg class="icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px; display:inline-block; vertical-align:middle;">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>
    {/if}
  </div>
</div>

{#if fullscreenActive && isMobileTouch}
  <!-- Fullscreen Touch Interaction Space -->
  <div 
    class="touch-canvas-overlay"
    role="presentation"
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
    ontouchcancel={handleTouchEnd}
  >
    <button 
      type="button" 
      class="fixed-close" 
      onclick={() => { fullscreenActive = false; resetFingerPicker(); }}
      ontouchstart={e => e.stopPropagation()}
      ontouchend={e => e.stopPropagation()}
      ontouchmove={e => e.stopPropagation()}
      aria-label="Schließen"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <div class="picker-status-container">
      {#if touchState === 'waiting'}
        <div class="picker-instructions pulsing">
          Legt eure Finger auf den Bildschirm... 
          <svg class="inline-icon-svg animate-bounce" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-left:4px; color:var(--color-primary);">
            <path d="M18 13V9a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"></path>
            <path d="M14 12V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v7"></path>
            <path d="M10 12.5V8a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v7"></path>
            <path d="M18 10a2 2 0 0 1 2 2v4a6 6 0 0 1-12 0v-4"></path>
          </svg>
        </div>
      {:else if touchState === 'stabilizing'}
        <div class="picker-instructions stabilizing">
          Finger stillhalten... 
          <svg class="inline-icon-svg rotating-hourglass" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-left:4px; color:var(--color-secondary);">
            <path d="M5 2h14M5 22h14M19 2v3a7 7 0 0 1-14 0V2M5 22v-3a7 7 0 0 1 14 0v3"></path>
            <path d="M12 12v4"></path>
          </svg>
        </div>
      {:else if touchState === 'countdown'}
        <div class="center-countdown pulse">
          {countdownValue > 0 ? countdownValue : 'START!'}
        </div>
      {:else if touchState === 'selecting'}
        <div class="picker-instructions stabilizing">
          Ziehung läuft... 
          <svg class="inline-icon-svg glowing-lightning" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-left:4px; color:var(--color-warning);">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
      {/if}
    </div>

    <!-- SVG Krone Definition für Canvas -->
    <svg style="position: absolute; width: 0; height: 0; overflow: hidden;" version="1.1" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="crownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="hsl(45, 100%, 65%)" />
          <stop offset="100%" stop-color="hsl(35, 100%, 50%)" />
        </linearGradient>
      </defs>
    </svg>

    <!-- Render active touches -->
    {#each activeTouches as finger (finger.id)}
      <div 
        class="finger-aura" 
        style="left: {finger.x}px; top: {finger.y}px; --neon-color: {finger.color}"
        class:is-winner={winnerTouchId === finger.id}
        class:is-loser={winnerTouchId !== null && winnerTouchId !== finger.id}
      >
        <span class="finger-glow"></span>
        {#if winnerTouchId === finger.id}
          <span class="winner-crown-popup">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="url(#crownGrad)" stroke="none" style="filter:drop-shadow(0 0 8px hsl(45, 100%, 60%));">
              <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
              <path d="M5 20h14v2H5v-2z" />
            </svg>
          </span>
        {/if}
      </div>
    {/each}

    <!-- Render particles -->
    {#each particles as p (p.id)}
      <div 
        class="particle" 
        style="left: {p.x}px; top: {p.y}px; width: {p.size}px; height: {p.size}px; background-color: {p.color}; opacity: {p.opacity};"
      ></div>
    {/each}

    <!-- Winner Popup Panel -->
    {#if touchState === 'finished'}
      <div 
        class="winner-popup-panel glass-panel"
        role="presentation"
        ontouchstart={e => e.stopPropagation()}
        ontouchend={e => e.stopPropagation()}
        ontouchmove={e => e.stopPropagation()}
      >
        <div class="winner-trophy">
          <svg viewBox="0 0 24 24" width="56" height="56" fill="url(#crownGrad)" stroke="none" style="filter:drop-shadow(0 0 12px hsl(45, 100%, 60%));">
            <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
            <path d="M5 20h14v2H5v-2z" />
          </svg>
        </div>
        <span class="winner-subtitle">Der Startspieler ist:</span>
        <div class="winner-name-highlight">{pickerWinnerName}</div>
        
        <div class="winner-actions">
          <button type="button" class="btn btn-primary" onclick={() => { open = false; fullscreenActive = false; resetFingerPicker(); }}>
            Auswählen & Schließen
          </button>
          <button type="button" class="btn btn-secondary" onclick={resetFingerPicker}>
            Nochmal auslosen 
            <svg class="inline-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px; display:inline-block; vertical-align:middle;">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
            </svg>
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}


<style>
  .raffle-card { max-width: 450px; }

  .raffle-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .raffle-subtitle {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-secondary);
  }

  .raffle-title {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--color-text-primary);
  }

  .player-count-selector {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  .selector-label {
    font-family: var(--font-heading);
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .raffle-names-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
    max-height: 220px;
    overflow-y: auto;
    padding: 2px;
  }

  .player-input {
    width: 100%;
    background-color: rgba(0,0,0,0.25);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    padding: 10px 14px;
    border-radius: 12px;
    transition: var(--transition-normal);
  }

  .player-input:focus {
    border-color: var(--color-secondary);
    outline: none;
    box-shadow: 0 0 10px var(--color-secondary-glow);
  }

  .draw-btn { width: 100%; flex: unset; }

  /* Result */
  .result-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    text-align: center;
    padding: 12px 0;
  }

  .raffle-wheel-container {
    position: relative;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    width: 100%;
  }

  .raffle-active-name {
    font-family: var(--font-heading);
    font-size: 2.2rem;
    font-weight: 700;
    color: var(--color-secondary);
    text-shadow: 0 0 15px var(--color-secondary-glow);
    transition: all 0.05s ease;
  }

  .raffle-active-name.spinning {
    animation: spinBlur 0.08s ease infinite alternate;
  }

  @keyframes spinBlur {
    from { opacity: 0.7; transform: scale(0.97); }
    to   { opacity: 1;   transform: scale(1); }
  }

  .winner-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .winner-trophy {
    font-size: 4rem;
    animation: bounce 1s infinite alternate;
  }

  .winner-label {
    font-family: var(--font-heading);
    font-size: 1rem;
    color: var(--color-text-secondary);
  }

  .winner-name {
    font-family: var(--font-heading);
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--color-secondary);
    text-shadow: 0 0 20px var(--color-secondary-glow);
  }

  .winner-box .btn { flex: unset; width: 100%; margin-top: 6px; }

  /* Tabs Switch Styling */
  .modal-tabs {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    margin-bottom: 12px;
    background: rgba(0, 0, 0, 0.2);
    padding: 4px;
    border-radius: 12px;
    border: 1px solid var(--color-border-glass);
  }

  .modal-tab-btn {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
    padding: 8px 12px;
    border-radius: 8px;
    font-family: var(--font-heading);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-tab-btn:hover {
    color: var(--color-text-primary);
  }

  .modal-tab-btn.active {
    background: var(--color-primary);
    color: #fff;
    box-shadow: 0 2px 8px var(--color-primary-glow);
  }

  /* Fullscreen Touch Canvas Overlay */
  .touch-canvas-overlay {
    position: fixed;
    inset: 0;
    background: radial-gradient(circle at center, rgba(15, 23, 42, 0.98) 0%, rgba(5, 10, 20, 1) 100%);
    backdrop-filter: blur(20px);
    overflow: hidden;
    z-index: 10010;
    user-select: none;
    touch-action: none;
  }

  .fixed-close {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 10020;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .fixed-close:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: scale(1.05);
  }

  .picker-status-container {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .picker-instructions {
    font-family: var(--font-heading);
    font-size: 1.25rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.8);
    text-align: center;
    padding: 0 32px;
    text-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
  }

  .picker-instructions.pulsing {
    animation: textPulse 2s infinite alternate ease-in-out;
  }

  @keyframes textPulse {
    from { opacity: 0.5; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1.03); }
  }

  .picker-instructions.stabilizing {
    color: var(--color-secondary);
    text-shadow: 0 0 15px var(--color-secondary-glow);
  }

  .center-countdown {
    font-family: var(--font-heading);
    font-size: 6rem;
    font-weight: 900;
    color: #fff;
    text-shadow: 0 0 40px var(--color-primary-glow), 0 0 80px var(--color-primary);
  }

  .center-countdown.pulse {
    animation: countdownPulse 1s infinite cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes countdownPulse {
    0% { transform: scale(0.6); opacity: 0; }
    50% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }

  /* Finger Aura & Glow */
  .finger-aura {
    position: absolute;
    width: 96px;
    height: 96px;
    margin-left: -48px;
    margin-top: -48px;
    pointer-events: none;
    transition: transform 0.15s ease-out, opacity 0.5s ease;
  }

  .finger-glow {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 3px solid var(--neon-color);
    background: radial-gradient(circle, transparent 20%, var(--neon-color) 120%);
    box-shadow: 0 0 30px var(--neon-color), inset 0 0 20px var(--neon-color);
    animation: pulseAura 1.2s infinite alternate ease-in-out;
  }

  @keyframes pulseAura {
    from { transform: scale(0.9); opacity: 0.8; }
    to { transform: scale(1.1); opacity: 1; box-shadow: 0 0 50px var(--neon-color), inset 0 0 30px var(--neon-color); }
  }

  .finger-aura.is-loser {
    opacity: 0;
    transform: scale(0.2);
    transition: all 0.5s cubic-bezier(0.6, -0.28, 0.735, 0.045);
  }

  .finger-aura.is-winner {
    transform: scale(1.4);
    z-index: 10015;
  }

  .finger-aura.is-winner .finger-glow {
    border-color: hsl(45, 100%, 60%);
    background: radial-gradient(circle, transparent 20%, hsl(45, 100%, 60%) 120%);
    box-shadow: 0 0 60px hsl(45, 100%, 60%), inset 0 0 30px hsl(45, 100%, 60%);
    animation: winnerFlash 0.3s infinite alternate;
  }

  @keyframes winnerFlash {
    from { filter: brightness(1); }
    to { filter: brightness(1.3); }
  }

  .winner-crown-popup {
    position: absolute;
    top: -45px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 2.5rem;
    animation: crownBounce 0.6s infinite alternate ease-in-out;
  }

  @keyframes crownBounce {
    from { transform: translateX(-50%) translateY(0); }
    to { transform: translateX(-50%) translateY(-10px); }
  }

  /* Particles */
  .particle {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }

  /* Winner popup inside overlay */
  .winner-popup-panel {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 380px;
    padding: 32px 24px;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 24px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px var(--color-primary-glow);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    animation: popupSlideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    z-index: 10018;
  }

  @keyframes popupSlideIn {
    from { transform: translate(-50%, -40%); opacity: 0; }
    to { transform: translate(-50%, -50%); opacity: 1; }
  }

  .winner-name-highlight {
    font-family: var(--font-heading);
    font-size: 2.2rem;
    font-weight: 800;
    color: hsl(45, 100%, 65%);
    text-shadow: 0 0 25px rgba(253, 224, 71, 0.4);
    margin: 8px 0;
  }

  .winner-subtitle {
    font-family: var(--font-heading);
    font-size: 0.95rem;
    color: var(--color-text-secondary);
  }

  .winner-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin-top: 12px;
  }

  .winner-actions .btn {
    width: 100%;
    flex: unset;
    padding: 12px;
    font-size: 0.95rem;
  }

  /* Setup-View Tab Content */
  .picker-setup-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px 12px;
    text-align: center;
  }

  .picker-setup-icon {
    font-size: 3.5rem;
    animation: fingerHover 1.5s infinite alternate ease-in-out;
  }

  @keyframes fingerHover {
    from { transform: translateY(0); }
    to { transform: translateY(-8px); }
  }

  .picker-setup-text {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  /* SVG Animations & Glows */
  .rotating-hourglass {
    animation: rotateHG 2s infinite ease-in-out;
  }
  @keyframes rotateHG {
    0% { transform: rotate(0deg); }
    40%, 100% { transform: rotate(180deg); }
  }

  .glowing-lightning {
    animation: lightFlash 1.5s infinite alternate ease-in-out;
  }
  @keyframes lightFlash {
    from { opacity: 0.7; filter: drop-shadow(0 0 4px var(--color-warning)); }
    to { opacity: 1; filter: drop-shadow(0 0 12px var(--color-warning)); }
  }

  @keyframes setupWave {
    0% { transform: scale(0.6); opacity: 0.8; }
    100% { transform: scale(1.4); opacity: 0; }
  }

  /* Anpassungen für extrem schmale Bildschirme (z.B. Galaxy Z Fold Frontdisplay) */
  @media (max-width: 360px) {
    .overlay-card.raffle-card {
      padding: 16px 12px !important;
      gap: 12px !important;
      border-radius: 16px !important;
    }
    .modal-tabs {
      gap: 4px !important;
      padding: 2px !important;
      margin-top: 8px !important;
      margin-bottom: 8px !important;
    }
    .modal-tab-btn {
      padding: 6px 8px !important;
      font-size: 0.78rem !important;
    }
    .picker-setup-info {
      padding: 12px 4px !important;
      gap: 12px !important;
    }
    .picker-setup-icon {
      font-size: 2.2rem !important;
    }
    .picker-setup-text {
      font-size: 0.82rem !important;
    }
    .draw-btn {
      padding: 10px 16px !important;
      font-size: 0.88rem !important;
    }
  }
</style>
