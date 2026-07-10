<script>
  import { isOnline, isAuthenticated, activeScreen, themeMode, toggleThemeMode, openWiki, gamesCatalog, currentGame, navigateTo, isAdmin, timerState, confirmDialog } from '$lib/stores/app.js';
  import { getSyncService } from '$lib/services/SyncService.js';
  import { onMount } from 'svelte';

  let { onopenAuth = () => {}, onopenHistory = () => {} } = $props();

  const syncService = getSyncService();
  let queuedMatches = $state([]);
  let isSyncing = $state(false);
  let syncError = $state(null);
  let showSyncModal = $state(false);

  /** @type {HTMLElement | null} */
  let headerEl = $state(null);
  /** @type {ResizeObserver | null} */
  let headerObserver = null;

  async function loadQueuedMatches() {
    queuedMatches = await syncService.getPendingEntries();
  }

  async function triggerSync() {
    if (!$isOnline) {
      syncError = "Verbindung fehlgeschlagen: Gerät ist offline.";
      return;
    }
    isSyncing = true;
    syncError = null;
    try {
      const success = await syncService.triggerSync();
      if (!success) {
        syncError = "pocketbase_sync_error: PocketBase-Instanz antwortet nicht (Timeout/Netzwerkfehler).";
      }
      await loadQueuedMatches();
    } catch (e) {
      syncError = `Verbindungsfehler: ${e.message || 'Server nicht erreichbar'}`;
    } finally {
      isSyncing = false;
    }
  }

  onMount(() => {
    loadQueuedMatches();
    const handleUpdate = () => loadQueuedMatches();
    window.addEventListener('sync-queue-updated', handleUpdate);

    if (headerEl) {
      headerObserver = new ResizeObserver((entries) => {
        const height = entries[0].borderBoxSize?.[0]?.blockSize ?? entries[0].contentRect.height;
        document.documentElement.style.setProperty('--app-header-height', `${height}px`);
      });
      headerObserver.observe(headerEl);
    }

    return () => {
      window.removeEventListener('sync-queue-updated', handleUpdate);
      if (headerObserver) headerObserver.disconnect();
    };
  });

  function handleWikiClick() {
    openWiki($activeScreen === 'game-selection' ? null : $currentGame);
  }
  let isFullscreen = $state(false);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => { isFullscreen = true; }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => { isFullscreen = false; }).catch(() => {});
    }
  }

  $effect(() => {
    const onFsChange = () => { isFullscreen = !!document.fullscreenElement; };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  });

  function handleKeydown(e) {
    if (showSyncModal && e.key === 'Escape') showSyncModal = false;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="app-header" bind:this={headerEl}>
  <div class="header-content">
    <!-- Brand Logo -->
    <div class="brand" role="button" tabindex="0"
      onclick={() => {
        if ($activeScreen === 'game-selection') return;
        if ($timerState === 'stopped') {
          currentGame.set(null);
        }
        navigateTo('game-selection');
      }}
      onkeydown={(e) => e.key === 'Enter' && navigateTo('game-selection')}
    >
      <span class="brand-logo">
        <svg class="brand-logo-svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 6c-2.5 0-4.5 1.5-5.5 3.5L5 18a1 1 0 0 0 1 1.2h2.5L9 22a1 1 0 0 0 1.8.6l1.2-2.1 1.2 2.1a1 1 0 0 0 1.8-.6l.5-2.8H18a1 1 0 0 0 1-1.2l-1.5-6.5C16.5 9.5 14.5 8 12 8z" fill="currentColor"/>
        </svg>
      </span>
      <h1 class="brand-title">Boardgame Companion</h1>
    </div>

    <!-- Status Indicators -->
    <div class="status-indicators">
      <!-- Account Button -->
      {#if $isAuthenticated}
        <button
          class="btn-account authenticated"
          id="btn-open-user-profile"
          title="Profil & Einstellungen"
          onclick={() => navigateTo('user-profile')}
        >
          <svg class="icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span class="btn-text-responsive">Profil</span>
        </button>
      {:else}
        <button
          class="btn-login-header"
          id="btn-open-auth"
          title="Anmelden oder Registrieren"
          onclick={() => onopenAuth()}
        >
          <svg class="icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
            <polyline points="10 17 15 12 10 7"></polyline>
            <line x1="15" y1="12" x2="3" y2="12"></line>
          </svg>
          <span class="btn-text-responsive">Login / Registrieren</span>
          <span class="btn-text-mobile">Login</span>
        </button>
      {/if}

      <!-- Wiki Button -->
      <button class="btn-wiki" id="btn-open-wiki" title="Spiele-Handbücher" onclick={() => handleWikiClick()}>
        <svg class="icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <span class="btn-text-responsive">Spiele-Wiki</span>
      </button>

      <!-- History Button -->
      <button class="btn-history" id="btn-open-history" title="Spielverlauf" onclick={() => onopenHistory()}>
        <svg class="icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
        </svg>
        <span class="btn-text-responsive">Verlauf</span>
      </button>

      <!-- Stats Button -->
      <button class="btn-history" id="btn-open-stats" title="Statistiken" onclick={() => navigateTo('stats')}>
        <svg class="icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        <span class="btn-text-responsive">Statistik</span>
      </button>

      <!-- Admin Button -->
      {#if $isAdmin}
        <button
          class="btn-admin"
          class:active={$activeScreen === 'admin-review'}
          id="btn-open-admin-review"
          title="Admin-Bereich"
          onclick={() => navigateTo('admin-review')}
        >
          <svg class="icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="btn-text-responsive">Admin</span>
        </button>
      {/if}

      <!-- U7: Vollbild-Toggle -->
      <button
        class="btn-theme-toggle"
        id="btn-toggle-fullscreen"
        title={isFullscreen ? 'Vollbild beenden' : 'Vollbild starten'}
        onclick={toggleFullscreen}
        aria-label="Vollbild umschalten"
      >
        {#if isFullscreen}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
        {/if}
      </button>

      <!-- Theme Toggle -->
      <button
        class="btn-theme-toggle"
        id="btn-toggle-theme"
        title={$themeMode === 'dark' ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln'}
        onclick={toggleThemeMode}
        aria-label="Theme wechseln"
      >
        {#if $themeMode === 'dark'}
          <!-- Sun icon -->
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        {:else}
          <!-- Moon icon -->
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        {/if}
      </button>

      <!-- Online/Offline Badge -->
      <button
        id="sync-status"
        class="status-badge"
        class:status-online={$isOnline}
        class:status-offline={!$isOnline}
        title="Synchronisations-Status anzeigen"
        onclick={() => { showSyncModal = true; loadQueuedMatches(); }}
        style="cursor: pointer; display: inline-flex; border: 1px solid var(--color-border-glass); outline: none;"
      >
        <span class="badge-dot"></span>
        <span class="badge-text">{$isOnline ? 'Online' : 'Offline'}</span>
      </button>
    </div>
  </div>
</header>

{#if showSyncModal}
  <div class="overlay-backdrop active" style="z-index: 1000;" role="dialog" aria-modal="true" aria-label="Backup-Status">
    <button class="overlay-backdrop-close" aria-label="Schließen" tabindex="-1" onclick={() => showSyncModal = false}></button>
    <div class="overlay-card glass-panel animate-scale-up" style="max-width: 480px; width: calc(100% - 24px); padding: 24px; position: relative;">
      <button class="btn-close-overlay" onclick={() => showSyncModal = false} aria-label="Schließen" style="position: absolute; right: 16px; top: 16px; background: none; border: none; color: var(--color-text-secondary); cursor: pointer;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <h3 class="auth-form-title" style="margin-top: 8px; display: flex; align-items: center; gap: 8px; font-family: var(--font-heading); font-weight: 700; font-size: 1.15rem; color: var(--color-text-primary);">
        🔄 Backup-Status
      </h3>
      <p class="auth-form-subtitle" style="font-size: 0.78rem; color: var(--color-text-secondary); margin-bottom: 16px;">Hier siehst du den Live-Status deiner Cloud-Backups und anstehende Uploads.</p>

      <div class="sync-status-box glass-panel" style="margin-top: 16px; padding: 12px 16px; text-align: left; background: rgba(0,0,0,0.15); border-radius: 12px; border: 1px solid var(--color-border-glass);">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-weight: 700; color: var(--color-text-primary); font-size: 0.85rem;">Verbindungsstatus:</span>
          <span class="status-badge" class:status-online={$isOnline} class:status-offline={!$isOnline} style="border:1px solid var(--color-border-glass);">
            <span class="badge-dot"></span>
            <span class="badge-text" style="font-size: 0.8rem; font-weight: 700;">{$isOnline ? 'Online' : 'Offline'}</span>
          </span>
        </div>
      </div>

      {#if syncError}
        <div class="auth-error" style="margin-top: 12px; text-align: left; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--color-danger); border-radius: 12px; padding: 10px 14px;">
          <strong style="color: var(--color-danger); display: block; font-size: 0.85rem; margin-bottom: 4px;">⚠️ Fehler aufgetreten:</strong>
          <span style="font-size: 0.78rem; line-height: 1.4; color: var(--color-text-secondary);">{syncError}</span>
        </div>
      {/if}

      <div style="margin-top: 16px; text-align: left;">
        <h4 style="font-family: var(--font-heading); font-size: 0.9rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 8px;">
          Warteschlange ({queuedMatches.length} Runden)
        </h4>

        {#if queuedMatches.length === 0}
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--color-border-glass); border-radius: 12px; padding: 20px; text-align: center; color: var(--color-text-secondary);">
            <p style="font-size: 0.8rem; margin: 0;">Alle deine Spielrunden sind vollständig mit der Cloud synchronisiert. ✓</p>
          </div>
        {:else}
          <div style="max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
            {#each queuedMatches as item}
              <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--color-border-glass); border-radius: 10px; padding: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span style="font-size: 0.82rem; font-weight: 700; color: var(--color-text-primary); display: block;">{item.game_name}</span>
                  <span style="font-size: 0.7rem; color: var(--color-text-secondary);">{new Date(item.date).toLocaleDateString('de-DE')}</span>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 0.72rem; color: var(--color-secondary); font-weight: 700; display: block;">{item.player_scores?.length} Spieler</span>
                  <span style="font-size: 0.7rem; color: var(--color-text-secondary);">Wartet auf Upload</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div style="margin-top: 24px; display: flex; gap: 8px;">
        <button class="btn btn-primary" style="flex: 1;" onclick={triggerSync} disabled={isSyncing || queuedMatches.length === 0}>
          {isSyncing ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
        </button>
        <button class="btn btn-secondary" onclick={() => showSyncModal = false}>
          Schließen
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .app-header {
    height: var(--header-height);
    border-bottom: 1px solid var(--color-border-glass);
    background-color: hsla(224, 25%, 8%, 0.82);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  @media (min-width: 1024px) {
    .app-header {
      border-top-left-radius: var(--radius-xl);
      border-top-right-radius: var(--radius-xl);
    }
    .header-content {
      padding: 0 32px;
    }
    .status-indicators {
      gap: 12px;
    }
    .btn-account,
    .btn-login-header,
    .btn-wiki,
    .btn-history,
    .btn-admin {
      padding: 9px 16px;
      font-size: 0.82rem;
      border-radius: 14px;
      gap: 8px;
    }
    .btn-theme-toggle {
      width: 38px;
      height: 38px;
      border-radius: 12px;
    }
  }



  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 720px;
    height: 100%;
    margin: 0 auto;
    padding: 0 16px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    transition: transform var(--transition-fast);
    min-width: 0;
  }

  .brand:hover { opacity: 0.9; }
  .brand:active { transform: scale(0.97); }

  .brand-logo-svg {
    display: block;
    color: var(--color-primary);
    filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.45));
    transition: var(--transition-normal);
  }

  .brand:hover .brand-logo-svg {
    transform: rotate(5deg) scale(1.05);
    filter: drop-shadow(0 0 14px rgba(99, 102, 241, 0.65));
  }

  .brand-title {
    font-family: var(--font-heading);
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, var(--color-text-primary) 30%, var(--color-text-secondary) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-indicators {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    transition: var(--transition-normal);
    border: 1px solid var(--color-border-glass);
    background-color: rgba(255,255,255,0.03);
  }

  .badge-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    transition: var(--transition-normal);
  }

  .status-online .badge-dot {
    background-color: var(--color-success);
    box-shadow: 0 0 8px var(--color-success);
  }

  .status-offline .badge-dot {
    background-color: var(--color-danger);
    box-shadow: 0 0 8px var(--color-danger);
  }

  .btn-account {
    background-color: rgba(255,255,255,0.05);
    border: 1px solid var(--color-border-glass);
    padding: 7px 14px;
    border-radius: 12px;
    font-family: var(--font-heading);
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .btn-account:active { transform: scale(0.95); background-color: rgba(255,255,255,0.12); }

  .btn-account.authenticated {
    border-color: hsla(172, 90%, 45%, 0.4);
    background-color: rgba(20, 184, 166, 0.1);
    color: var(--color-secondary);
  }

  .btn-wiki,
  .btn-history,
  .btn-admin {
    background-color: rgba(255,255,255,0.05);
    border: 1px solid var(--color-border-glass);
    padding: 7px 12px;
    border-radius: 12px;
    font-family: var(--font-heading);
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .btn-wiki:active,
  .btn-history:active,
  .btn-admin:active { transform: scale(0.95); }

  .btn-admin.active {
    border-color: var(--color-primary-glow);
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--color-primary);
  }

  .btn-theme-toggle {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background-color: rgba(255,255,255,0.05);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-secondary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-fast);
    flex-shrink: 0;
  }

  .btn-login-header {
    background-color: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.4);
    padding: 7px 14px;
    border-radius: 12px;
    font-family: var(--font-heading);
    font-size: 0.78rem;
    font-weight: 800;
    color: var(--color-primary);
    cursor: pointer;
    transition: var(--transition-fast);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .btn-login-header:active { transform: scale(0.95); background-color: rgba(99, 102, 241, 0.25); }
  .btn-login-header:hover { background-color: rgba(99, 102, 241, 0.2); box-shadow: 0 0 10px rgba(99, 102, 241, 0.3); }

  .btn-text-mobile { display: none; }

  .btn-theme-toggle:hover {
    background-color: rgba(255,255,255,0.10);
    color: var(--color-text-primary);
    transform: rotate(15deg) scale(1.05);
  }

  .btn-theme-toggle:active {
    transform: scale(0.92);
  }

  :global([data-theme="light"]) .app-header {
    background-color: hsla(210, 30%, 96%, 0.85);
    border-bottom-color: hsla(215, 20%, 80%, 0.5);
  }

  :global([data-theme="light"]) .btn-theme-toggle {
    background-color: rgba(0, 0, 0, 0.05);
    border-color: hsla(215, 20%, 70%, 0.5);
    color: var(--color-text-primary);
  }
  :global([data-theme="light"]) .btn-theme-toggle:hover {
    background-color: rgba(0, 0, 0, 0.08);
    color: var(--color-text-primary);
  }

  :global([data-theme="light"]) .btn-account,
  :global([data-theme="light"]) .btn-wiki,
  :global([data-theme="light"]) .btn-history,
  :global([data-theme="light"]) .btn-admin {
    background-color: rgba(0, 0, 0, 0.05);
    border-color: hsla(215, 20%, 70%, 0.5);
    color: var(--color-text-secondary);
  }
  :global([data-theme="light"]) .btn-account:hover,
  :global([data-theme="light"]) .btn-wiki:hover,
  :global([data-theme="light"]) .btn-history:hover,
  :global([data-theme="light"]) .btn-admin:hover {
    background-color: rgba(0, 0, 0, 0.08);
    color: var(--color-text-primary);
  }

  :global([data-theme="light"]) .btn-login-header {
    background-color: rgba(99, 102, 241, 0.1);
    color: hsl(239, 84%, 40%);
    border-color: hsla(239, 84%, 60%, 0.4);
  }
  :global([data-theme="light"]) .btn-login-header:hover {
    background-color: rgba(99, 102, 241, 0.15);
  }

  :global([data-theme="light"]) .status-badge {
    background-color: rgba(0, 0, 0, 0.03);
    border-color: hsla(215, 20%, 70%, 0.5);
    color: var(--color-text-secondary);
  }

  :global([data-theme="light"]) .btn-account.authenticated {
    background-color: rgba(20, 184, 166, 0.08);
    border-color: hsla(172, 90%, 45%, 0.3);
    color: hsl(172, 90%, 35%);
  }

  @media (max-width: 767px) {
    .btn-account.authenticated,
    .btn-wiki,
    .btn-history,
    .btn-admin {
      display: none !important;
    }
  }

  /* Anpassungen für Smartphones & Tablets (z.B. iPhones, Samsung Galaxy) */
  @media (max-width: 640px) {
    .header-content {
      padding: 0 10px;
      gap: 8px;
    }
    .brand-title {
      font-size: 1rem;
    }
    .btn-text-responsive {
      display: none !important;
    }
    .btn-text-mobile {
      display: inline !important;
    }
    .btn-account,
    .btn-login-header,
    .btn-wiki,
    .btn-history,
    .btn-admin {
      padding: 8px 10px;
      border-radius: 10px;
      gap: 6px;
    }
    .btn-theme-toggle {
      width: 32px;
      height: 32px;
      border-radius: 9px;
    }
    .status-badge {
      padding: 4px 6px;
    }
    .status-badge .badge-text {
      display: none;
    }
    .status-badge .badge-dot {
      margin: 0;
    }
  }

  /* Anpassungen für extra schmale Displays (z.B. Galaxy Z Fold Frontdisplay) */
  @media (max-width: 360px) {
    .header-content {
      padding: 0 6px !important;
      gap: 4px !important;
    }
    .brand {
      gap: 4px !important;
    }
    .brand-logo-svg {
      width: 20px !important;
      height: 20px !important;
    }
    .brand-title {
      font-size: 0.9rem !important;
    }
    .status-indicators {
      gap: 4px !important;
    }
    .btn-account,
    .btn-login-header,
    .btn-wiki,
    .btn-history,
    .btn-admin {
      padding: 6px 7px !important;
      border-radius: 8px !important;
      gap: 4px !important;
    }
    .btn-theme-toggle {
      width: 28px !important;
      height: 28px !important;
      border-radius: 8px !important;
    }
    .status-badge {
      padding: 4px !important;
      border-radius: 50% !important;
      width: 16px !important;
      height: 16px !important;
      min-width: 16px !important;
    }
    .status-badge .badge-dot {
      width: 5px !important;
      height: 5px !important;
    }
  }
</style>
