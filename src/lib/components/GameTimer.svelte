<script>
  import {
    currentGame, currentSessionDuration, playerCount, showToast,
    gamesCatalog, openWiki as openWikiRoute, navigateTo,
    timerState, timerText, timerElapsedSeconds, settings, confirmDialog
  } from '$lib/stores/app.js';
  import { GameTimer } from '$lib/services/GameTimer.js';
  import { HapticService } from '$lib/services/HapticService.js';
  import { onMount } from 'svelte';

  let { onopenStartPlayer = () => {} } = $props();
  const timer = new GameTimer();

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      const storedState = localStorage.getItem('bg_timer_state');
      if (storedState && storedState !== 'stopped') {
        const recovered = timer.recoverActiveTimer((fmt, secs) => {
          timerText.set(fmt);
          timerElapsedSeconds.set(secs);
        });
        if (recovered) {
          timerState.set(timer.state);
        }
      }
    }
  });

  let gameName = $derived($currentGame ? ($gamesCatalog[$currentGame]?.name ?? $currentGame) : 'Spiel');

  // F5: Track notified thresholds to prevent duplicate alerts
  let notifiedMinutes = new Set();

  $effect(() => {
    const elapsedSecs = $timerElapsedSeconds;
    const alertMinutes = $settings.timerAlarmDurationMinutes || 120;
    const elapsedMins = Math.floor(elapsedSecs / 60);

    if ($settings.notificationsEnabled && elapsedMins > 0 && elapsedMins % alertMinutes === 0) {
      if (!notifiedMinutes.has(elapsedMins)) {
        notifiedMinutes.add(elapsedMins);
        triggerTimerNotification(elapsedMins);
      }
    }
  });

  async function triggerTimerNotification(minutes) {
    const hours = Math.floor(minutes / 60);
    const timeStr = hours > 0 ? `${hours} Stunde(n)` : `${minutes} Minuten`;
    const message = `Eure Partie ${gameName} dauert bereits ${timeStr}!`;

    showToast(`⏰ Alarm: ${message}`, 'warning');

    // Beep sound
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      console.warn('Audio Context beep failed', e);
    }

    // Local notification
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Boardgame Companion', {
          body: message,
          icon: '/favicon.png'
        });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification('Boardgame Companion', {
            body: message,
            icon: '/favicon.png'
          });
        }
      }
    }
  }

  // ── 4a: SVG Ring ────────────────────────────────────────
  const RING_R_OUTER = 90;
  const RING_R_INNER = 70;
  const CIRC_OUTER = 2 * Math.PI * RING_R_OUTER;
  const CIRC_INNER = 2 * Math.PI * RING_R_INNER;

  let minuteDash = $derived(Math.min(($timerElapsedSeconds % 3600) / 3600, 1) * CIRC_INNER);
  let hourDash   = $derived(Math.min(($timerElapsedSeconds / 3600) % 1, 1) * CIRC_OUTER);

  // ── 4b: Ambient bg ──────────────────────────────────────
  let ambientBg = $derived(() => {
    const m = $timerElapsedSeconds / 60;
    if (m < 30)  return `hsl(${Math.round(220 - 40  * (m / 30))},70%,18%)`;
    if (m < 60)  return `hsl(${Math.round(180 - 142 * ((m - 30) / 30))},70%,15%)`;
    return `hsl(${Math.round(38 - 28 * Math.min((m - 60) / 30, 1))},80%,12%)`;
  });

  // ── Controls ─────────────────────────────────────────────
  function toggleTimer() {
    if ($timerState === 'stopped') {
      HapticService.timerStart();
      if (typeof localStorage !== 'undefined' && $currentGame) {
        localStorage.setItem('bg_timer_current_game', $currentGame);
      }
      timer.start((fmt, secs) => { timerText.set(fmt); timerElapsedSeconds.set(secs); });
      timerState.set('running');
      showToast('Spiel gestartet!', 'success');
    } else if ($timerState === 'running') {
      HapticService.timerPause();
      timer.pause();
      timerState.set('paused');
      showToast('Spiel pausiert', 'warning');
    } else {
      HapticService.timerStart();
      timer.start((fmt, secs) => { timerText.set(fmt); timerElapsedSeconds.set(secs); });
      timerState.set('running');
      showToast('Spiel fortgesetzt', 'success');
    }
  }

  async function abortTimer() {
    HapticService.lightTap();
    if (await confirmDialog('Möchtest du das laufende Spiel wirklich abbrechen? Die erfasste Zeit geht verloren.')) {
      HapticService.timerStop();
      timer.stop();
      timerText.set('00:00:00');
      timerElapsedSeconds.set(0);
      timerState.set('stopped');
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('bg_timer_current_game');
      }
      currentGame.set(null);
      currentSessionDuration.set(0);
      navigateTo('game-selection');
      showToast('Spiel abgebrochen', 'error');
    }
  }

  function stopTimer() {
    HapticService.timerStop();
    const duration = timer.stop();
    timerState.set('stopped');
    timerElapsedSeconds.set(0);
    currentSessionDuration.set(duration);
    playerCount.set(2);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('bg_timer_current_game');
    }
    navigateTo('player-setup');
    showToast('Spieldauer erfasst! Bitte Mitspieler eintragen.', 'success');
  }

  let hasWiki = $derived(
    $currentGame
      ? !!($gamesCatalog[$currentGame]?.wiki?.categories?.length || ($gamesCatalog[$currentGame]?.wiki?.enabled && $gamesCatalog[$currentGame]?.wiki?.manifest))
      : false
  );

  function openWiki() {
    openWikiRoute($currentGame);
  }
</script>

{#if $currentGame}
<div class="timer-container glass-panel" style="--ambient-bg: {ambientBg()};"
  class:timer-running={$timerState === 'running'}>
  <div class="ambient-layer"></div>

  <div class="timer-header">
    <span class="game-session-badge" id="active-game-badge">{gameName}</span>
    <h2 class="session-title">Spiel läuft...</h2>
  </div>

  <!-- 4a: Dual SVG Ring -->
  <div class="timer-display-wrapper">
    <svg class="timer-ring-svg" viewBox="0 0 220 220" width="220" height="220" aria-hidden="true">
      <!-- Hour ring track -->
      <circle cx="110" cy="110" r={RING_R_OUTER} fill="none"
        stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
      <!-- Hour ring progress -->
      <circle cx="110" cy="110" r={RING_R_OUTER} fill="none"
        class="ring-hour" stroke-width="8" stroke-linecap="round"
        stroke-dasharray="{hourDash} {CIRC_OUTER}"
        transform="rotate(-90 110 110)"/>
      <!-- Minute ring track -->
      <circle cx="110" cy="110" r={RING_R_INNER} fill="none"
        stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
      <!-- Minute ring progress -->
      <circle cx="110" cy="110" r={RING_R_INNER} fill="none"
        class="ring-minute" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="{minuteDash} {CIRC_INNER}"
        transform="rotate(-90 110 110)"/>
    </svg>
    <div class="timer-display" id="timer-text">{$timerText}</div>
  </div>

  <!-- Startspieler -->
  <div class="startplayer-bar">
    <button class="btn btn-secondary btn-icon" id="btn-open-startplayer-modal"
      onclick={() => onopenStartPlayer()}>
      <span class="icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
          stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
          style="display:inline-block;vertical-align:middle;margin-top:-2px;">
          <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
          <circle cx="12" cy="12" r="1.5" fill="currentColor"></circle>
          <circle cx="7" cy="7" r="1.2" fill="currentColor"></circle>
          <circle cx="17" cy="17" r="1.2" fill="currentColor"></circle>
          <circle cx="7" cy="17" r="1.2" fill="currentColor"></circle>
          <circle cx="17" cy="7" r="1.2" fill="currentColor"></circle>
        </svg>
      </span> Startspieler auslosen
    </button>

    {#if hasWiki}
      <button class="btn btn-secondary btn-icon btn-wiki-timer" onclick={openWiki}
        aria-label="Spiele-Wiki öffnen">
        <span class="icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
            stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
            style="display:inline-block;vertical-align:middle;margin-top:-2px;">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </span> Wiki
      </button>
    {/if}
  </div>

  <div class="timer-controls">
    <button class="btn btn-secondary btn-icon" id="btn-timer-abort"
      aria-label="Spiel abbrechen" onclick={abortTimer}>
      <span class="icon">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
          stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          style="display:inline-block;vertical-align:middle;margin-top:-2px;">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </span> Abbrechen
    </button>

    <button class="btn btn-secondary btn-icon" id="btn-timer-pause"
      aria-label="Pause/Start" onclick={toggleTimer}>
      {#if $timerState === 'running'}
        <span class="icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none"
            style="display:inline-block;vertical-align:middle;margin-top:-2px;">
            <rect x="6" y="4" width="4" height="16" rx="1"></rect>
            <rect x="14" y="4" width="4" height="16" rx="1"></rect>
          </svg>
        </span> Pause
      {:else if $timerState === 'paused'}
        <span class="icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none"
            style="display:inline-block;vertical-align:middle;margin-top:-2px;">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </span> Fortsetzen
      {:else}
        <span class="icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none"
            style="display:inline-block;vertical-align:middle;margin-top:-2px;">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </span> Start
      {/if}
    </button>

    <button class="btn btn-danger btn-icon" id="btn-timer-stop"
      aria-label="Wertung starten" onclick={stopTimer}>
      <span class="icon">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none"
          style="display:inline-block;vertical-align:middle;margin-top:-2px;">
          <rect x="4" y="4" width="16" height="16" rx="2"></rect>
        </svg>
      </span> Wertung starten
    </button>
  </div>
</div>
{:else}
<div class="empty-state-card" id="timer-empty-state">
  <div class="empty-state-icon float-icon">🎲</div>
  <h3 class="empty-state-title">Kein Spiel aktiv</h3>
  <p class="empty-state-text">
    Wähle ein Spiel aus dem Katalog aus, um eine Partie mit Rundenzeit und Startspieler-Auslosung zu begleiten.
  </p>
  <button class="btn btn-primary" onclick={() => navigateTo('game-selection')}>
    Spiel auswählen →
  </button>
</div>
{/if}

<style>
  .timer-container {
    padding: 32px 24px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    margin-top: 16px;
    position: relative;
    overflow: hidden;
  }

  /* 4b: Ambient tinted overlay */
  .ambient-layer {
    position: absolute;
    inset: 0;
    background: var(--ambient-bg, transparent);
    opacity: 0.55;
    pointer-events: none;
    transition: background 8s ease;
    border-radius: inherit;
    z-index: 0;
  }

  .timer-header,
  .timer-display-wrapper,
  .startplayer-bar,
  .timer-controls {
    position: relative;
    z-index: 1;
  }

  .timer-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }

  .game-session-badge {
    display: inline-block;
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: rgba(255,255,255,0.07);
    border: 1px solid var(--color-border-glow);
    color: var(--color-secondary);
  }

  .session-title {
    font-family: var(--font-heading);
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--color-text-secondary);
  }

  /* ── 4a: SVG Ring ─────────────────── */
  .timer-display-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    height: 220px;
  }

  .timer-ring-svg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    filter: drop-shadow(0 0 10px var(--color-primary-glow));
  }

  .ring-minute {
    stroke: var(--color-primary);
    transition: stroke-dasharray 0.9s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ring-hour {
    stroke: var(--color-secondary);
    opacity: 0.75;
    transition: stroke-dasharray 0.9s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .timer-running .ring-minute {
    animation: ringPulse 2s ease-in-out infinite alternate;
  }

  @keyframes ringPulse {
    from { opacity: 0.85; }
    to   { opacity: 1; }
  }

  .timer-display {
    font-family: var(--font-heading);
    font-size: clamp(2rem, 8vw, 4.5rem);
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--color-text-primary);
    text-shadow: 0 0 30px var(--color-primary-glow);
    position: relative;
    z-index: 1;
  }

  .startplayer-bar {
    display: flex;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .startplayer-bar .btn {
    flex: unset;
    font-family: var(--font-heading);
    font-weight: 500;
    font-size: 0.95rem;
    padding: 10px 20px;
    border-radius: 12px;
  }

  .timer-controls {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .btn-icon { font-family: var(--font-heading); font-weight: 600; }
  .icon { font-size: 1rem; }

  @media (min-width: 768px) {
    .timer-container { padding: 48px; }
  }

  @media (max-width: 360px) {
    .timer-container {
      padding: 18px 12px !important;
      gap: 16px !important;
      margin-top: 8px !important;
    }
    .timer-display-wrapper { height: 180px !important; }
    .timer-controls { gap: 6px !important; }
    .timer-controls .btn {
      padding: 8px 12px !important;
      font-size: 0.82rem !important;
    }
  }
</style>
