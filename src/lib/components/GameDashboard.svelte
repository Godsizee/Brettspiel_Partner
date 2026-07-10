<script>
  // @ts-check
  import {
    currentGame, gamesCatalog, navigateTo, showToast,
    openWiki as openWikiRoute, historyFilter, timerState,
    themeMode, currentUser
  } from '$lib/stores/app.js';
  import { db, pullFromRemote } from '$lib/services/DbService.js';
  import { validateGameImageUrl } from '$lib/utils/urlValidator.js';
  import { onMount } from 'svelte';

  /** @type {{ onopenStartPlayer?: () => void }} */
  let { onopenStartPlayer = () => {} } = $props();

  let game = $derived($currentGame ? $gamesCatalog[$currentGame] : null);
  let accentColor = $derived(
    game?.accentColor || game?.theme?.gradientColor || '#6366f1'
  );

  // ── Stats aus IndexedDB ────────────────────────────────────────
  /** @type {{ count: number, avgDuration: number, lastWinner: string|null, topPlayer: string|null }} */
  let stats = $state({ count: 0, avgDuration: 0, lastWinner: null, topPlayer: null });
  let statsLoaded = $state(false);

  onMount(async () => {
    if (!$currentGame) return;
    try {
      let allMatches = [];
      const user = $currentUser;
      if (navigator.onLine && user?.id) {
        try {
          allMatches = await pullFromRemote(user.id);
          if (Array.isArray(allMatches) && allMatches.length > 0) {
            await db.set('bg_matches', allMatches);
          }
        } catch (e) {
          console.warn('Dashboard stats remote fetch failed:', e);
          allMatches = /** @type {any[]} */ (await db.get('bg_matches') ?? []);
        }
      } else {
        allMatches = /** @type {any[]} */ (await db.get('bg_matches') ?? []);
      }

      const gameName = game?.name ?? $currentGame;
      const filtered = allMatches.filter(m =>
        (m.game_name === gameName || m.game_id === $currentGame) && m.player_scores?.length
      );

      if (filtered.length === 0) { statsLoaded = true; return; }

      const totalDuration = filtered.reduce((s, m) => s + (m.duration ?? 0), 0);
      const avgDuration = Math.round(totalDuration / filtered.length);

      const lastMatch = filtered[filtered.length - 1];
      const lastScores = lastMatch?.player_scores ?? [];
      const maxScore = Math.max(...lastScores.map((/** @type {any} */ p) => p.total_score ?? 0));
      const lastWinner = lastScores.find((/** @type {any} */ p) => p.total_score === maxScore)?.player_name ?? null;

      /** @type {Record<string, number>} */
      const winCounts = {};
      for (const m of filtered) {
        const scores = m.player_scores ?? [];
        const top = Math.max(...scores.map((/** @type {any} */ p) => p.total_score ?? 0));
        scores
          .filter((/** @type {any} */ p) => p.total_score === top)
          .forEach((/** @type {any} */ p) => {
            const n = p.player_name;
            winCounts[n] = (winCounts[n] ?? 0) + 1;
          });
      }
      const topPlayer = Object.entries(winCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      stats = { count: filtered.length, avgDuration, lastWinner, topPlayer };
    } catch (_) {}
    statsLoaded = true;
  });

  /**
   * @param {number} secs
   * @returns {string}
   */
  function formatDuration(secs) {
    if (!secs) return '—';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} Min`;
  }

  let hasWiki = $derived(!!game?.wiki?.categories?.length || (game?.wiki?.enabled && game?.wiki?.manifest));
  let hasExpansion = $derived(!!game?.expansion);

  function startGame() {
    if (!$currentGame) return;
    navigateTo('game-timer');
  }

  function openWiki() {
    openWikiRoute($currentGame);
  }

  function goBack() {
    navigateTo('game-selection');
  }

  function viewHistory() {
    historyFilter.set($currentGame ?? 'all');
    navigateTo('match-history');
  }

  // Timer läuft bereits → Hinweis
  let timerRunning = $derived($timerState !== 'stopped');
</script>

{#if game}
<div class="dashboard-root">

  <!-- ── HERO ───────────────────────────────────────────── -->
  <div class="hero-section glass-panel" style="--accent: {accentColor};">
    {#if game.cover}
      <img
        src={validateGameImageUrl(game.cover)}
        alt={game.name}
        class="hero-cover"
        loading="eager"
        decoding="async"
        fetchpriority="high"
      />
    {/if}
    <div class="hero-overlay" style="background: {$themeMode === 'light'
      ? `linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.88) 55%, rgba(255,255,255,0.97) 100%), linear-gradient(135deg, rgba(255,255,255,0.4) 0%, ${accentColor}22 100%)`
      : `linear-gradient(to bottom, rgba(8,12,22,0.15) 0%, rgba(8,12,22,0.82) 55%, rgba(8,12,22,0.97) 100%), linear-gradient(135deg, rgba(8,12,22,0.5) 0%, ${accentColor}30 100%)`}">
    </div>
    <div class="hero-content">
      <div class="hero-meta">
        <span class="hero-badge">{game.badge ?? 'Spiel'}</span>
        {#if hasExpansion}
          <span class="expansion-badge">+ Erweiterung</span>
        {/if}
      </div>
      <h1 class="hero-title">{game.name}</h1>
      {#if game.description}
        <p class="hero-description">{game.description}</p>
      {/if}
      <div class="hero-footer-meta">
        <span class="hero-players">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {game.players ?? '2+ Spieler'}
        </span>
        {#if timerRunning}
          <span class="timer-running-badge">
            <span class="pulse-dot"></span>
            Timer läuft
          </span>
        {/if}
      </div>
    </div>
  </div>

  <!-- ── STATS GRID ─────────────────────────────────────── -->
  <div class="stats-grid">
    <div class="stat-card glass-panel">
      <span class="stat-icon">🎲</span>
      <span class="stat-value">{statsLoaded ? stats.count : '…'}</span>
      <span class="stat-label">Partien gespielt</span>
    </div>
    <div class="stat-card glass-panel">
      <span class="stat-icon">⏱</span>
      <span class="stat-value">{statsLoaded ? formatDuration(stats.avgDuration) : '…'}</span>
      <span class="stat-label">Ø Spieldauer</span>
    </div>
    <div class="stat-card glass-panel">
      <span class="stat-icon">🏆</span>
      <span class="stat-value stat-value--name">{statsLoaded ? (stats.lastWinner ?? '—') : '…'}</span>
      <span class="stat-label">Letzter Sieger</span>
    </div>
    <div class="stat-card glass-panel">
      <span class="stat-icon">👑</span>
      <span class="stat-value stat-value--name">{statsLoaded ? (stats.topPlayer ?? '—') : '…'}</span>
      <span class="stat-label">Meiste Siege</span>
    </div>
  </div>

  <!-- ── QUICK ACTIONS ──────────────────────────────────── -->
  <div class="quick-actions-section">
    <h3 class="section-label">Aktionen</h3>
    <div class="quick-actions-row">
      <button id="btn-dashboard-startplayer" class="quick-action-tile glass-panel" type="button" onclick={() => onopenStartPlayer()}>
        <span class="qa-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="4" ry="4"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
            <circle cx="17" cy="17" r="1.2" fill="currentColor"/>
            <circle cx="7" cy="17" r="1.2" fill="currentColor"/>
            <circle cx="17" cy="7" r="1.2" fill="currentColor"/>
          </svg>
        </span>
        <span class="qa-label">Startspieler<br>auslosen</span>
      </button>

      {#if hasWiki}
        <button id="btn-dashboard-wiki" class="quick-action-tile glass-panel" type="button" onclick={openWiki}>
          <span class="qa-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </span>
          <span class="qa-label">Spiele-Wiki</span>
        </button>
      {/if}

      <button id="btn-dashboard-history" class="quick-action-tile glass-panel" type="button" onclick={viewHistory}>
        <span class="qa-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </span>
        <span class="qa-label">Letzte<br>Ergebnisse</span>
      </button>
    </div>
  </div>



  <!-- ── ACTION BAR ─────────────────────────────────────── -->
  <div class="action-bar">
    <button id="btn-dashboard-back" class="btn btn-secondary btn-icon" type="button" onclick={goBack}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-top:-2px;margin-right:4px;">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Zurück
    </button>
    <button id="btn-dashboard-start" class="btn btn-start-cta" type="button" onclick={startGame}>
      {timerRunning ? 'Zum Timer' : 'Spiel starten'}
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none" style="display:inline-block;vertical-align:middle;margin-top:-2px;margin-left:8px;">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    </button>
  </div>

</div>
{:else}
<div class="empty-state-card" id="dashboard-empty-state">
  <div class="empty-state-icon float-icon">🎲</div>
  <h3 class="empty-state-title">Kein Spiel ausgewählt</h3>
  <button class="btn btn-primary" onclick={() => navigateTo('game-selection')}>
    Spiel auswählen →
  </button>
</div>
{/if}

<style>
  .dashboard-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 16px;
    animation: dashIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes dashIn {
    from { opacity: 0; transform: translateY(18px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ── HERO ── */
  .hero-section {
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    min-height: 240px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .hero-cover {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    filter: saturate(1.1);
    transition: transform 8s ease;
    transform: scale(1.04);
  }

  .hero-section:hover .hero-cover {
    transform: scale(1.0);
  }

  .hero-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .hero-content {
    position: relative;
    z-index: 1;
    padding: 24px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hero-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .hero-badge {
    display: inline-block;
    padding: 3px 12px;
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.2);
    color: var(--color-secondary);
    backdrop-filter: blur(6px);
  }

  .expansion-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    background: color-mix(in srgb, var(--accent, #6366f1) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent, #6366f1) 40%, transparent);
    color: var(--color-text-primary);
  }

  .hero-title {
    font-family: var(--font-heading);
    font-size: clamp(1.6rem, 6vw, 2.4rem);
    font-weight: 900;
    color: var(--color-text-primary);
    line-height: 1.1;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 16px rgba(0,0,0,0.4);
    margin: 0;
  }

  .hero-description {
    font-size: 0.88rem;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.5;
    max-width: 480px;
  }

  .hero-footer-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .hero-players {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    font-weight: 600;
  }

  .timer-running-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-primary);
    padding: 2px 10px;
    border-radius: 20px;
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
  }

  .pulse-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-primary);
    animation: pulseDot 1.4s ease-in-out infinite;
  }

  @keyframes pulseDot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.7); }
  }

  /* ── STATS ── */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 16px 12px;
    border-radius: 16px;
    text-align: center;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  }

  .stat-icon {
    font-size: 1.4rem;
    line-height: 1;
  }

  .stat-value {
    font-family: var(--font-heading);
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-text-primary);
    letter-spacing: -0.02em;
  }

  .stat-value--name {
    font-size: 1rem;
    letter-spacing: 0;
  }

  .stat-label {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* ── QUICK ACTIONS ── */
  .quick-actions-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-label {
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .quick-actions-row {
    display: flex;
    gap: 10px;
  }

  .quick-action-tile {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 8px;
    border-radius: 14px;
    border: none;
    cursor: pointer;
    font-family: var(--font-heading);
    color: var(--color-text-primary);
    background: var(--color-surface-glass);
    transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .quick-action-tile:hover {
    transform: translateY(-2px);
    background: rgba(255,255,255,0.08);
    box-shadow: 0 6px 20px rgba(0,0,0,0.2);
  }

  .quick-action-tile:active {
    transform: scale(0.96);
  }

  .qa-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    color: var(--color-primary);
    border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
  }

  .qa-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-align: center;
    line-height: 1.3;
    color: var(--color-text-secondary);
  }



  /* ── ACTION BAR ── */
  .action-bar {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: 4px;
  }

  .btn-start-cta {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 14px 24px;
    border-radius: 14px;
    border: none;
    cursor: pointer;
    font-family: var(--font-heading);
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #fff;
    background: linear-gradient(
      135deg,
      var(--color-primary) 0%,
      color-mix(in srgb, var(--color-primary) 70%, var(--color-secondary)) 100%
    );
    box-shadow:
      0 4px 20px color-mix(in srgb, var(--color-primary) 40%, transparent),
      0 1px 0 rgba(255,255,255,0.15) inset;
    transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    position: relative;
    overflow: hidden;
  }

  .btn-start-cta::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
    pointer-events: none;
  }

  .btn-start-cta:hover {
    transform: translateY(-2px);
    box-shadow:
      0 8px 28px color-mix(in srgb, var(--color-primary) 55%, transparent),
      0 1px 0 rgba(255,255,255,0.2) inset;
    filter: brightness(1.08);
  }

  .btn-start-cta:active {
    transform: scale(0.97);
    box-shadow:
      0 3px 12px color-mix(in srgb, var(--color-primary) 35%, transparent);
  }

  /* ── EMPTY STATE ── */
  .empty-state-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 60px 24px;
    text-align: center;
    min-height: 300px;
  }

  .empty-state-icon {
    font-size: 3rem;
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .empty-state-title {
    font-family: var(--font-heading);
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    margin: 0;
  }

  /* ── Responsive ── */
  @media (min-width: 480px) {
    .hero-section { min-height: 280px; }
    .stats-grid { grid-template-columns: repeat(4, 1fr); }
  }

  @media (max-width: 360px) {
    .hero-content { padding: 16px 14px 16px; }
    .hero-title { font-size: 1.4rem; }
    .stat-value { font-size: 1.2rem; }
    .btn-start-cta { padding: 12px 16px; font-size: 0.92rem; }
  }
</style>
