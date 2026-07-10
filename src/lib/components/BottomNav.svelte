<script>
  import { activeScreen, navigateTo, openWiki, isAdmin, pocketbaseHost, authService, isAuthenticated, currentGame, wikiActive } from '$lib/stores/app.js';
  import { HapticService } from '$lib/services/HapticService.js';
  import { fetchPendingCount } from '$lib/services/AdminService.js';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';

  let pendingCount = $state(0);

  async function refreshPendingCount() {
    if (!get(isAdmin)) return;
    try {
      const host = get(pocketbaseHost);
      const token = authService.getToken();
      if (!host || !token) return;
      pendingCount = await fetchPendingCount(host, token);
    } catch (_) {}
  }

  onMount(() => {
    refreshPendingCount();
    const iv = setInterval(refreshPendingCount, 60000);
    return () => clearInterval(iv);
  });

  function handleWikiNav() {
    HapticService.lightTap();
    openWiki($activeScreen === 'game-selection' ? null : $currentGame);
  }

  /**
   * @param {'game-selection' | 'game-timer' | 'match-history' | 'stats' | 'profile' | 'admin-review'} screen
   */
  function handleNav(screen) {
    HapticService.lightTap();
    if (screen === 'profile' && get(isAuthenticated)) {
      navigateTo('user-profile');
    } else {
      navigateTo(screen);
    }
  }

  let activeIndex = $derived(
    $wikiActive ? 2 :
    ($activeScreen === 'game-selection' || $activeScreen === 'player-setup' || $activeScreen === 'score-sheet') ? 0 :
    ($activeScreen === 'game-timer') ? 1 :
    ($activeScreen === 'match-history') ? 3 :
    ($activeScreen === 'stats') ? 4 :
    ($activeScreen === 'profile' || $activeScreen === 'user-profile') ? 5 :
    ($isAdmin && $activeScreen === 'admin-review') ? 6 : -1
  );
  let totalItems = $derived($isAdmin ? 7 : 6);
</script>

<nav class="bottom-nav glass-panel">
  <button 
    class="nav-item" 
    class:active={!$wikiActive && ($activeScreen === 'game-selection' || $activeScreen === 'player-setup' || $activeScreen === 'score-sheet')}
    onclick={() => handleNav('game-selection')}
  >
    <div class="nav-icon-container">
      <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <span class="nav-label">Spiele</span>
  </button>

  <button 
    class="nav-item" 
    class:active={!$wikiActive && $activeScreen === 'game-timer'}
    onclick={() => handleNav('game-timer')}
  >
    <div class="nav-icon-container">
      <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <span class="nav-label">Timer</span>
  </button>

  <button
    class="nav-item"
    class:active={$wikiActive}
    onclick={handleWikiNav}
  >
    <div class="nav-icon-container">
      <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <span class="nav-label">Wiki</span>
  </button>

  <button
    class="nav-item"
    class:active={!$wikiActive && $activeScreen === 'match-history'}
    onclick={() => handleNav('match-history')}
  >
    <div class="nav-icon-container">
      <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    </div>
    <span class="nav-label">Verlauf</span>
  </button>

  <button
    class="nav-item"
    class:active={!$wikiActive && $activeScreen === 'stats'}
    onclick={() => handleNav('stats')}
  >
    <div class="nav-icon-container">
      <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20v-6M6 20V10M18 20V4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <span class="nav-label">Stats</span>
  </button>

  <button
    class="nav-item"
    class:active={!$wikiActive && ($activeScreen === 'profile' || $activeScreen === 'user-profile')}
    onclick={() => handleNav('profile')}
  >
    <div class="nav-icon-container">
      <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
    <span class="nav-label">Profil</span>
  </button>

  {#if $isAdmin}
    <button
      class="nav-item"
      class:active={!$wikiActive && $activeScreen === 'admin-review'}
      onclick={() => handleNav('admin-review')}
      style="position:relative;"
    >
      <div class="nav-icon-container">
        <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        {#if pendingCount > 0}
          <span class="admin-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
        {/if}
      </div>
      <span class="nav-label">Admin</span>
    </button>
  {/if}

  {#if activeIndex !== -1}
    <div class="nav-active-dot" style="--active-index: {activeIndex}; --total-items: {totalItems};"></div>
  {/if}
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(72px + env(safe-area-inset-bottom, 0px));
    background-color: var(--color-surface-glass);
    border-top: 1px solid var(--color-border-glass);
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 0 12px;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    z-index: 1000;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
    box-sizing: border-box;
  }

  .nav-item {
    background: none;
    border: none;
    outline: none;
    color: var(--color-text-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    flex: 1;
    padding: 8px 0;
    position: relative;
    min-height: 44px;
    min-width: 44px;
  }

  .nav-icon-container {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .nav-svg {
    width: 22px;
    height: 22px;
    transition: stroke 0.3s ease;
  }

  .nav-label {
    font-size: 0.72rem;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .nav-item.active {
    color: var(--color-primary);
  }

  .nav-item.active .nav-icon-container {
    animation: navBounce 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .nav-item.active .nav-svg {
    stroke: var(--color-primary);
    filter: drop-shadow(0 0 6px var(--color-primary-glow));
  }

  .nav-active-dot {
    position: absolute;
    bottom: 2px;
    left: 0;
    width: calc(100% / var(--total-items));
    height: 4px;
    display: flex;
    justify-content: center;
    pointer-events: none;
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform: translateX(calc(var(--active-index) * 100%));
  }

  .nav-active-dot::after {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--color-primary);
    box-shadow: 0 0 8px var(--color-primary);
  }

  @keyframes navBounce {
    0% { transform: translateY(0) scale(1); }
    30% { transform: translateY(-2px) scale(0.92); }
    60% { transform: translateY(-5px) scale(1.08); }
    100% { transform: translateY(-4px) scale(1.12); }
  }

  @media (min-width: 768px) {
    .bottom-nav {
      display: none;
    }
  }

  .admin-badge {
    position: absolute;
    top: -4px;
    right: -6px;
    background: #f43f5e;
    color: white;
    font-size: .6rem;
    font-weight: 800;
    border-radius: 8px;
    padding: 1px 5px;
    min-width: 16px;
    text-align: center;
    line-height: 1.4;
  }
</style>
