<script>
  // @ts-check
  import { gamesCatalog, activeScreen, currentGame, currentSessionDuration, showToast, themeMode, openWiki as openWikiRoute, navigateTo, historyFilter, activeSession, settings, isAuthenticated, pocketbaseHost, authService, confirmDialog } from '$lib/stores/app.js';
  import { createSafeBackgroundImage, validateGradientColor, validateGameImageUrl } from '$lib/utils/urlValidator.js';
  import { db, deleteCustomGame } from '$lib/services/DbService.js';
  import { loadGamesCatalog } from '$lib/services/GamesCatalogService.js';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  const pillBase = "relative px-5 py-2 rounded-[20px] font-heading text-[0.88rem] font-bold outline-none select-none flex items-center justify-center gap-1.5 border whitespace-nowrap shrink-0";

  let { onopenStartPlayer = () => {} } = $props();

  let favorites = $state(/** @type {string[]} */ ([]));
  let ownedGames = $state(/** @type {string[]} */ ([]));
  let wishlistGames = $state(/** @type {string[]} */ ([]));
  let collectionFilter = $state('all'); // 'all' | 'owned' | 'wishlist'

  let activeIndex = $state(0);
  let carouselEl = $state(/** @type {HTMLElement|null} */ (null));
  let activeQuickActionGame = $state(/** @type {string|null} */ (null));
  let longPressTimer = /** @type {any} */ (null);

  let _pointerDownX = 0;
  let _isDragging = false;
  const DRAG_THRESHOLD_PX = 10;

  onMount(() => {
    try {
      const stored = localStorage.getItem('bg_favorites');
      if (stored) {
        favorites = JSON.parse(stored);
      }
      const storedOwned = localStorage.getItem('bg_owned_games');
      if (storedOwned) {
        ownedGames = JSON.parse(storedOwned);
      }
      const storedWishlist = localStorage.getItem('bg_wishlist_games');
      if (storedWishlist) {
        wishlistGames = JSON.parse(storedWishlist);
      }
    } catch (e) {
      console.error('Failed to load storage fields', e);
    }
    loadDrafts();
  });

  let activeDrafts = $state([]);

  async function loadDrafts() {
    try {
      const drafts = (await db.get('bg_drafts')) ?? [];
      activeDrafts = drafts.filter(d => d.status === 'draft');
    } catch(e) {}
  }

  function resumeDraft(draft) {
    currentGame.set(draft.game_key);
    currentSessionDuration.set(draft.duration || 0);
    navigateTo('score-sheet');
  }

  async function discardDraft(draftId) {
    try {
      const drafts = (await db.get('bg_drafts')) ?? [];
      const draftToDiscard = drafts.find(d => d.id === draftId);
      if (!draftToDiscard) return;
      
      await db.set('bg_drafts', drafts.filter(d => d.id !== draftId));
      await loadDrafts();
      
      showToast('Entwurf gelöscht', 'info', 5000, {
        label: 'Rückgängig',
        onClick: async () => {
          const currentDrafts = (await db.get('bg_drafts')) ?? [];
          await db.set('bg_drafts', [...currentDrafts, draftToDiscard]);
          await loadDrafts();
        }
      });
    } catch(e) {}
  }

  /**
   * @param {string} gameKey
   * @returns {void}
   */
  function toggleFavorite(gameKey) {
    if (favorites.includes(gameKey)) {
      favorites = favorites.filter(k => k !== gameKey);
    } else {
      favorites = [...favorites, gameKey];
    }
    localStorage.setItem('bg_favorites', JSON.stringify(favorites));
    showToast(favorites.includes(gameKey) ? 'Als Favorit markiert ⭐' : 'Favorit entfernt', 'success');
  }

  /**
   * @param {string} gameKey
   * @returns {void}
   */
  function toggleOwned(gameKey) {
    if (ownedGames.includes(gameKey)) {
      ownedGames = ownedGames.filter(k => k !== gameKey);
    } else {
      ownedGames = [...ownedGames, gameKey];
      wishlistGames = wishlistGames.filter(k => k !== gameKey);
      localStorage.setItem('bg_wishlist_games', JSON.stringify(wishlistGames));
    }
    localStorage.setItem('bg_owned_games', JSON.stringify(ownedGames));
    showToast(ownedGames.includes(gameKey) ? 'Zur Spielesammlung hinzugefügt 📦' : 'Aus Spielesammlung entfernt', 'success');
  }

  /**
   * @param {string} gameKey
   * @returns {void}
   */
  function toggleWishlist(gameKey) {
    if (wishlistGames.includes(gameKey)) {
      wishlistGames = wishlistGames.filter(k => k !== gameKey);
    } else {
      wishlistGames = [...wishlistGames, gameKey];
      ownedGames = ownedGames.filter(k => k !== gameKey);
      localStorage.setItem('bg_owned_games', JSON.stringify(ownedGames));
    }
    localStorage.setItem('bg_wishlist_games', JSON.stringify(wishlistGames));
    showToast(wishlistGames.includes(gameKey) ? 'Zur Wunschliste hinzugefügt ✨' : 'Von Wunschliste entfernt', 'success');
  }

  let sortOrder = $state('asc');

  // F2: Spielabend Multi-Game-Session States & Helpers
  let showSessionPodium = $state(false);
  let sessionStandings = $derived(
    $activeSession && $activeSession.matches && $activeSession.matches.length > 0
      ? getSessionStandings($activeSession.matches)
      : []
  );

  function startSession() {
    activeSession.set({
      id: 'session_' + Date.now(),
      date: new Date().toISOString(),
      matches: []
    });
    showToast('Spielabend-Session gestartet! 🎲 Viel Erfolg!', 'success');
  }

  async function confirmEndSession() {
    const previousSession = $activeSession;
    activeSession.set(null);
    showSessionPodium = false;
    showToast('Spielabend beendet! 👋', 'success', 5000, {
      label: 'Rückgängig',
      onClick: () => {
        activeSession.set(previousSession);
        showSessionPodium = true;
      }
    });
  }

  /**
   * @param {any[]} matches
   */
  function getSessionStandings(matches) {
    /** @type {Record<string, {name: string, wins: number, totalPoints: number, matchesPlayed: number}>} */
    const stats = {};
    matches.forEach(m => {
      const scores = m.player_scores || [];
      let maxScore = -Infinity;
      scores.forEach((/** @type {any} */ ps) => {
        if (ps.total_score > maxScore) maxScore = ps.total_score;
      });

      scores.forEach((/** @type {any} */ ps) => {
        const name = ps.player_name;
        if (!stats[name]) {
          stats[name] = { name, wins: 0, totalPoints: 0, matchesPlayed: 0 };
        }
        stats[name].totalPoints += ps.total_score;
        stats[name].matchesPlayed += 1;
        if (ps.total_score === maxScore) {
          stats[name].wins += 1;
        }
      });
    });

    return Object.values(stats).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.totalPoints - a.totalPoints;
    });
  }


  /**
   * @param {PointerEvent} e
   * @returns {void}
   */
  function handleCardPointerDown(e) {
    _pointerDownX = e.clientX;
    _isDragging = false;
  }

  /**
   * @param {string} gameKey
   * @param {number} idx
   * @returns {void}
   */
  function selectGame(gameKey, idx) {
    if (_isDragging) return;
    if (activeQuickActionGame) {
      activeQuickActionGame = null;
      return;
    }



    if (!$isAuthenticated) {
      showToast('Spiel werten erfordert ein Konto. Bitte melde dich an oder registriere dich! 🔒', 'warning');
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }

    const game = $gamesCatalog[gameKey];
    if (!game) return;

    if (navigator.vibrate) {
      navigator.vibrate(15);
    }

    currentGame.set(gameKey);
    navigateTo('game-dashboard');
    showToast(`${game.name} ausgewählt!`, 'info');
  }

  /**
   * @param {string} gameKey
   * @returns {void}
   */
  function openWiki(gameKey) {
    openWikiRoute(gameKey);
  }

  /**
   * @returns {void}
   */
  function handleScroll() {
    if (!carouselEl) return;
    const containerRect = carouselEl.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    const cards = carouselEl.querySelectorAll('.game-card');
    let minDistance = Infinity;
    let activeIdx = 0;

    cards.forEach((card, idx) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const distance = Math.abs(containerCenter - cardCenter);

      if (distance < minDistance) {
        minDistance = distance;
        activeIdx = idx;
      }

      const offset = cardCenter - containerCenter;
      const translateVal = Math.max(-40, Math.min(40, -offset * 0.08));
      /** @type {HTMLElement} */(card).style.setProperty('--parallax-offset', `${translateVal}px`);
    });

    activeIndex = activeIdx;
  }

  /**
   * @param {number} idx
   * @returns {void}
   */
  function scrollToCard(idx) {
    if (!carouselEl) return;
    const cards = carouselEl.querySelectorAll('.game-card');
    if (cards[idx]) {
      cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      activeIndex = idx;
    }
  }

  /**
   * @param {MouseEvent} e
   * @returns {void}
   */
  function handleMouseMove(e) {
    if (window.matchMedia('(max-width: 767px)').matches) return;

    const card = /** @type {HTMLElement} */(e.currentTarget);
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    card.style.setProperty('--mx', `${(x / rect.width) * 100}%`);
    card.style.setProperty('--my', `${(y / rect.height) * 100}%`);
  }

  /**
   * @param {string} gameKey
   * @returns {void}
   */
  /**
   * @param {TouchEvent} e
   * @param {string} gameKey
   * @returns {void}
   */
  function handleTouchStart(e, gameKey) {
    const touch = e.touches[0];
    if (touch) {
      _pointerDownX = touch.clientX;
      _isDragging = false;
    }
    longPressTimer = setTimeout(() => {
      activeQuickActionGame = gameKey;
      if (navigator.vibrate) {
        navigator.vibrate([30, 20]);
      }
    }, 600);
  }

  /**
   * @returns {void}
   */
  function handleTouchEnd() {
    clearTimeout(longPressTimer);
  }

  /**
   * @param {PointerEvent} e
   * @returns {void}
   */
  function handleCardPointerMove(e) {
    if (Math.abs(e.clientX - _pointerDownX) > DRAG_THRESHOLD_PX) {
      _isDragging = true;
    }
  }

  /**
   * Called when browser takes over scroll (touch) – suppress the upcoming click.
   * @returns {void}
   */
  function handleCardPointerCancel() {
    _isDragging = true;
  }

  /**
   * @param {TouchEvent} e
   * @returns {void}
   */
  function handleTouchMove(e) {
    clearTimeout(longPressTimer);
    const touch = e.touches[0];
    if (touch && Math.abs(touch.clientX - _pointerDownX) > DRAG_THRESHOLD_PX) {
      _isDragging = true;
    }
  }

  // Spiele als geordnete Liste aus dem Katalog, Favoriten zuerst
  let games = $derived(
    Object.values($gamesCatalog)
      .filter(game => {
        if (collectionFilter === 'owned') return ownedGames.includes(game.key);
        if (collectionFilter === 'wishlist') return wishlistGames.includes(game.key);
        return true;
      })
      .sort((a, b) => {
        const aFav = favorites.includes(a.key);
        const bFav = favorites.includes(b.key);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        
        // Sortieren nach Name A-Z oder Z-A
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (sortOrder === 'asc') {
          return nameA.localeCompare(nameB);
        } else {
          return nameB.localeCompare(nameA);
        }
      })
  );

  $effect(() => {
    if (carouselEl && games.length) {
      setTimeout(() => {
        handleScroll();
      }, 50);
    }
  });
  /** @param {string} gameKey */
  async function deleteCustomGameEntry(gameKey) {
    if (!(await confirmDialog('Dieses benutzerdefinierte Spiel wirklich löschen?'))) return;
    try {
      await deleteCustomGame(gameKey, {
        host: get(pocketbaseHost),
        token: authService.getToken() ?? undefined
      });
      await loadGamesCatalog();
      showToast('Spiel gelöscht.', 'success');
    } catch (err) {
      showToast('Fehler beim Löschen.', 'error');
    }
  }
</script>

<div class="screen-header">
  <h1 class="sr-only">Spielauswahl</h1>
  <div class="screen-header-left">
    <h2 class="screen-title">
      {#if collectionFilter === 'all'}
        Neues Spiel starten
      {:else}
        {collectionFilter === 'owned' ? 'Meine Spielesammlung 📦' : 'Wunschliste ✨'}
      {/if}
    </h2>
    <p class="screen-subtitle">
      {#if collectionFilter === 'all'}
        Wähle ein Brettspiel aus dem Katalog
      {:else}
        {collectionFilter === 'owned' 
          ? 'Diese Spiele besitzt du bereits und sind direkt spielbereit' 
          : 'Brettspiele, die du dir gerne kaufen möchtest oder planst anzuschaffen'}
      {/if}
    </p>
  </div>
</div>

{#if activeDrafts.length > 0}
  <div class="drafts-container mb-5 flex flex-col gap-3">
    {#each activeDrafts as draft}
      <div class="draft-card glass-panel animate-scale-up flex justify-between items-center px-5 py-4 rounded-xl bg-white/5 border border-[var(--color-border-glass)] flex-wrap gap-4">
        <div class="draft-info">
          <div class="font-heading font-bold text-[1.05rem] text-[var(--color-text-primary)]">Wertung fortsetzen</div>
          <div class="text-[0.85rem] text-[var(--color-text-secondary)] mt-0.5">{draft.game_name} · {draft.player_scores?.length || 0} Spieler</div>
          <div class="text-[0.7rem] text-[var(--color-text-muted)] mt-1.5">Zuletzt bearbeitet: {new Date(draft.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</div>
        </div>
        <div class="draft-actions flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick={() => resumeDraft(draft)}>Fortsetzen</button>
          <button class="btn btn-danger btn-sm" onclick={() => discardDraft(draft.id)}>Verwerfen</button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<!-- F2: Spielabend Modus Banners -->
{#if $settings.gameSessionMode}
  {#if !$activeSession}
    <div class="session-banner glass-panel inactive-session animate-scale-up flex justify-between items-center px-5 py-4 rounded-xl bg-white/5 border border-[var(--color-border-glass)] gap-4 flex-wrap mb-5">
      <div class="banner-content flex items-center gap-3.5">
        <span class="banner-emoji text-[2rem]">🎲</span>
        <div class="banner-text">
          <div class="banner-title font-heading font-bold text-[1.05rem] text-[var(--color-text-primary)]">Spielabend-Modus aktiv</div>
          <div class="banner-desc text-[0.8rem] text-[var(--color-text-secondary)] mt-0.5">Bündele mehrere Partien nacheinander zu einer Session mit Gesamtsieger!</div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm btn-start-session" onclick={startSession}>
        Spielabend starten
      </button>
    </div>
  {:else}
    <div class="session-banner glass-panel active-session animate-scale-up flex justify-between items-center px-5 py-4 rounded-xl bg-white/5 border border-[var(--color-border-glass)] gap-4 flex-wrap mb-5">
      <div class="banner-content flex items-center gap-3.5">
        <span class="banner-emoji glow-emoji text-[2rem]">🏆</span>
        <div class="banner-text">
          <div class="banner-title font-heading font-bold text-[1.05rem] text-[var(--color-text-primary)]">Spielabend läuft...</div>
          <div class="banner-desc text-[0.8rem] text-[var(--color-text-secondary)] mt-0.5">Bisher gespielt: {$activeSession.matches.length} Runden</div>
        </div>
      </div>
      <div class="banner-actions flex gap-2">
        {#if $activeSession.matches.length > 0}
          <button class="btn btn-secondary btn-sm" onclick={() => showSessionPodium = true}>
            Gesamtwertung
          </button>
        {/if}
        <button class="btn btn-danger btn-sm" onclick={confirmEndSession}>
          Beenden
        </button>
      </div>
    </div>
  {/if}
{/if}

<div class="filter-pills-bar overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
  <button 
    class="{pillBase}" 
    class:active={collectionFilter === 'all'}
    onclick={() => collectionFilter = 'all'}
  >
    Alle
  </button>
  <button 
    class="{pillBase}" 
    class:active={collectionFilter === 'owned'}
    onclick={() => collectionFilter = 'owned'}
  >
    Meine Spiele
  </button>
  <button 
    class="{pillBase}" 
    class:active={collectionFilter === 'wishlist'}
    onclick={() => collectionFilter = 'wishlist'}
  >
    Wunschliste
  </button>
  <button 
    class="{pillBase}" 
    onclick={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
  >
    {sortOrder === 'asc' ? 'A-Z ▼' : 'Z-A ▲'}
  </button>
</div>

<div 
  class="game-grid" 
  bind:this={carouselEl} 
  onscroll={handleScroll}
>
  {#if Object.keys($gamesCatalog).length === 0}
    {#each Array(4) as _}
      <div class="game-card skeleton-card glass-panel" style="min-height: 160px;">
        <div class="skeleton-shimmer"></div>
        <div class="game-card-content" style="padding: 20px; display: flex; flex-direction: column; gap: 10px; height: 100%;">
          <div style="width: 50px; height: 16px; background: rgba(255,255,255,0.06); border-radius: 6px;"></div>
          <div style="width: 130px; height: 22px; background: rgba(255,255,255,0.08); border-radius: 6px;"></div>
          <div style="width: 80%; height: 14px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 4px;"></div>
          <div style="width: 60%; height: 14px; background: rgba(255,255,255,0.05); border-radius: 4px;"></div>
          <div style="height: 24px; background: rgba(255,255,255,0.04); border-radius: 6px; margin-top: auto; border-top: 1px solid rgba(255,255,255,0.02); padding-top: 10px;"></div>
        </div>
      </div>
    {/each}
  {:else}
    {#if games.length === 0}
      <div class="empty-collection-state glass-panel animate-scale-up">
        <span class="empty-emoji">
          {#if collectionFilter === 'owned'}📦{:else}✨{/if}
        </span>
        <h3 class="empty-title">
          {#if collectionFilter === 'owned'}Deine Spielesammlung ist leer{:else}Deine Wunschliste ist leer{/if}
        </h3>
        <p class="empty-description">
          {#if collectionFilter === 'owned'}
            Hier werden die Spiele angezeigt, die sich bereits in deinem Besitz befinden. Markiere ein Spiel im Hauptkatalog als „In meine Sammlung“, um es hier zu hinterlegen.
          {:else}
            Hier kannst du Spiele vormerken, die du dir gerne kaufen möchtest oder planst anzuschaffen.
          {/if}
        </p>
        <div class="empty-tip">
          <strong>Tipp:</strong> Klicke in der Übersicht „Alle“ bei einem Spiel auf die drei Punkte <strong>···</strong>, um es zu deiner Sammlung oder Wunschliste hinzuzufügen.
        </div>
        <button class="btn btn-secondary empty-back-btn" onclick={() => collectionFilter = 'all'}>
          Zurück zu allen Spielen
        </button>
      </div>
    {:else}
    {#each games as game, idx (game.key)}
      {@const safeColor = game.accentColor || validateGradientColor(game.theme?.gradientColor) || '#6366f1'}
      <div
        class="game-card"
        role="presentation"
        id="btn-select-{game.key}"
        data-game={game.key}
        onpointerdown={handleCardPointerDown}
        onpointermove={handleCardPointerMove}
        onpointercancel={handleCardPointerCancel}
        onmousemove={handleMouseMove}
        ontouchstart={(e) => handleTouchStart(e, game.key)}
        ontouchend={handleTouchEnd}
        ontouchmove={handleTouchMove}
      >
        <button
          type="button"
          class="card-expand-overlay"
          aria-label="{game.name} auswählen"
          onclick={() => selectGame(game.key, idx)}
        ></button>
        <div class="card-spotlight"></div>
        <div class="card-top-actions">
          <button 
            class="card-action-circle btn-favorite-toggle {favorites.includes(game.key) ? 'is-fav' : ''}" 
            onclick={(e) => { e.stopPropagation(); toggleFavorite(game.key); }}
            aria-label="Zu Favoriten hinzufügen"
            type="button"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill={favorites.includes(game.key) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          
          <button 
            class="card-action-circle btn-menu-toggle" 
            onclick={(e) => { e.stopPropagation(); activeQuickActionGame = game.key; }}
            aria-label="Quick Actions öffnen"
            type="button"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </div>

        {#if activeQuickActionGame === game.key}
          <div 
            class="quick-actions-overlay" 
          >
            <button 
              class="quick-actions-close" 
              onclick={(e) => { e.stopPropagation(); activeQuickActionGame = null; }}
              aria-label="Schließen"
              type="button"
            >
              ✕
            </button>
            <div class="quick-actions-title">{game.name}</div>
            <div class="quick-actions-grid">
              <button 
                class="quick-action-btn btn-fav {favorites.includes(game.key) ? 'active' : ''}" 
                onclick={(e) => { e.stopPropagation(); toggleFavorite(game.key); activeQuickActionGame = null; }}
                type="button"
              >
                <svg class="action-icon" viewBox="0 0 24 24" width="14" height="14" fill={favorites.includes(game.key) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>{favorites.includes(game.key) ? 'Entfavorisieren' : 'Favorisieren'}</span>
              </button>

              <button 
                class="quick-action-btn btn-owned {ownedGames.includes(game.key) ? 'active' : ''}" 
                onclick={(e) => { e.stopPropagation(); toggleOwned(game.key); activeQuickActionGame = null; }}
                type="button"
              >
                📦 <span>{ownedGames.includes(game.key) ? 'Aus Sammlung' : 'In meine Sammlung'}</span>
              </button>

              <button 
                class="quick-action-btn btn-wish {wishlistGames.includes(game.key) ? 'active' : ''}" 
                onclick={(e) => { e.stopPropagation(); toggleWishlist(game.key); activeQuickActionGame = null; }}
                type="button"
              >
                ✨ <span>{wishlistGames.includes(game.key) ? 'Aus Wunschliste' : 'Auf Wunschliste'}</span>
              </button>
              
              {#if game.wiki?.categories?.length}
                <button 
                  class="quick-action-btn btn-wiki" 
                  onclick={(e) => { e.stopPropagation(); activeQuickActionGame = null; openWiki(game.key); }}
                  type="button"
                >
                  <svg class="action-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  <span>Spiele-Wiki</span>
                </button>
              {/if}
              
              <button 
                class="quick-action-btn btn-history" 
                onclick={(e) => { e.stopPropagation(); activeQuickActionGame = null; historyFilter.set(game.key); navigateTo('match-history'); }}
                type="button"
              >
                <svg class="action-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>Letzte Ergebnisse</span>
              </button>
              {#if game.custom}
                <button
                  class="quick-action-btn btn-danger"
                  onclick={(e) => { e.stopPropagation(); activeQuickActionGame = null; deleteCustomGameEntry(game.key); }}
                  type="button"
                >
                  🗑 <span>{game.status === 'pending_review' ? 'Einreichung zurückziehen' : 'Spiel löschen'}</span>
                </button>
              {/if}
            </div>
          </div>
        {/if}

        <div class="game-card-bg">
          {#if game.cover}
            <img
              src={validateGameImageUrl(game.cover)}
              alt={game.name}
              loading="lazy"
              decoding="async"
              class="game-card-img"
              style="transform: scale(1.2) translateX(var(--parallax-offset, 0px));"
            />
          {:else if game.emoji}
            <div class="game-card-emoji-bg" style="font-size: 5rem; display: flex; align-items: center; justify-content: center; height: 100%; width: 100%; opacity: 0.25; transform: scale(1.1) translateX(var(--parallax-offset, 0px)); transition: transform 0.2s;">
              {game.emoji}
            </div>
          {/if}
          <div
            class="game-card-overlay"
            style="background-image: {$themeMode === 'light'
              ? `linear-gradient(to bottom, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.4) 100%), linear-gradient(135deg, rgba(255,255,255,0.4) 0%, ${safeColor}18 100%)`
              : `linear-gradient(to bottom, rgba(11,15,25,0.0) 0%, rgba(11,15,25,0.85) 100%), linear-gradient(135deg, rgba(11,15,25,0.6) 0%, ${safeColor}24 100%)`};"
          ></div>
        </div>
        <div class="game-card-content">
          <span class="game-badge" class:badge-pending={game.status === 'pending_review'} class:badge-rejected={game.status === 'rejected'}>
            {#if game.status === 'pending_review'}⏳ In Prüfung{:else if game.status === 'rejected'}❌ Abgelehnt{:else}{game.badge ?? 'Spiel'}{/if}
          </span>
          <h3 class="game-title">{game.name}</h3>
          <p class="game-description">{game.description ?? ''}</p>
          <div class="game-footer">
            <span class="game-players">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; margin-top:-2px;">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              {game.players ?? '1–5 Spieler'}
            </span>
            <div class="game-footer-actions">
              <button
                type="button"
                class="game-action"
                onclick={(e) => { e.stopPropagation(); selectGame(game.key, idx); }}
              >
                Starten 
                <svg class="icon-svg game-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-left:2px; transition: transform 0.2s;">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    {/each}
  {/if}
{/if}

  {#if collectionFilter === 'all'}
    <div 
      class="game-card card-locked"
      role="presentation"
      onmousemove={handleMouseMove}
    >
      <div class="card-spotlight"></div>
      <div class="game-card-bg" style="background-image: {$themeMode === 'light'
        ? 'linear-gradient(135deg, rgba(210,220,240,0.9) 40%, rgba(200,210,235,0.7) 100%)'
        : 'linear-gradient(135deg, rgba(11,15,25,0.9) 40%, rgba(0,0,0,0.4) 100%)'};"></div>
      <div class="game-card-content">
        <span class="game-badge">Demnächst</span>
        <h3 class="game-title">Weitere Spiele...</h3>
        <div class="game-footer">
          <span class="game-action-locked">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; margin-top:-2px;">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Gesperrt
          </span>
        </div>
      </div>
    </div>
  {/if}
</div>


{#if showSessionPodium && $activeSession}
  <div class="foto-finish-backdrop">
    <div class="foto-finish-card glass-panel animate-scale-up">
      <div class="results-capture-card" id="session-results-card">
        <div class="capture-header" style="text-align: center; margin-bottom: 16px;">
          <span class="capture-subtitle" style="font-size: 0.75rem; font-weight: 800; letter-spacing: 0.1em; color: var(--color-secondary);">SPIELABEND-SIEGEREHRUNG</span>
          <h3 class="capture-game-title" style="font-size: 1.4rem; font-weight: 800; margin: 4px 0;">Gesamtwertung</h3>
          <span class="capture-date" style="font-size: 0.75rem; color: var(--color-text-secondary);">{$activeSession.matches.length} Runden gespielt</span>
        </div>

        <!-- 3D Animated Pedestal Podium -->
        <div class="podium-container active-pedestal" style="display: flex; align-items: flex-end; justify-content: center; gap: 12px; margin: 24px 0 16px 0; height: 160px;">
          <!-- 2nd Place (Silver) -->
          {#if sessionStandings[1]}
            <div class="podium-col silver-col" style="flex: 1; display: flex; flex-direction: column; align-items: center; position: relative;">
              <div class="podium-avatar silver-avatar" style="width: 44px; height: 44px; border-radius: 50%; background: #94a3b8; color: #0c0f19; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; box-shadow: 0 4px 10px rgba(148, 163, 184, 0.4);">
                {sessionStandings[1].name.slice(0, 2).toUpperCase()}
              </div>
              <span class="podium-name" style="font-size: 0.8rem; font-weight: 700; white-space: nowrap; max-width: 80px; overflow: hidden; text-overflow: ellipsis; color: var(--color-text-primary);">{sessionStandings[1].name}</span>
              <span class="podium-score" style="font-size: 0.75rem; font-weight: 800; color: var(--color-secondary);">{sessionStandings[1].wins}🏆</span>
              <span style="font-size: 0.65rem; color: var(--color-text-secondary);">{sessionStandings[1].totalPoints} SP</span>
              <div class="podium-step step-2" style="width: 100%; height: 50px; background: linear-gradient(180deg, #64748b 0%, #334155 100%); border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; margin-top: 6px; color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">2</div>
            </div>
          {/if}

          <!-- 1st Place (Gold) -->
          {#if sessionStandings[0]}
            <div class="podium-col gold-col" style="flex: 1.1; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 2;">
              <div class="podium-avatar gold-avatar" style="width: 52px; height: 52px; border-radius: 50%; background: #fbbf24; color: #0c0f19; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; position: relative; box-shadow: 0 6px 15px rgba(251, 191, 36, 0.4);">
                <span class="crown-icon" style="position: absolute; top: -14px; font-size: 1.2rem;">👑</span>
                {sessionStandings[0].name.slice(0, 2).toUpperCase()}
              </div>
              <span class="podium-name" style="font-size: 0.85rem; font-weight: 800; white-space: nowrap; max-width: 90px; overflow: hidden; text-overflow: ellipsis; color: var(--color-text-primary);">{sessionStandings[0].name}</span>
              <span class="podium-score" style="font-size: 0.8rem; font-weight: 800; color: #fbbf24;">{sessionStandings[0].wins}🏆</span>
              <span style="font-size: 0.65rem; color: var(--color-text-secondary);">{sessionStandings[0].totalPoints} SP</span>
              <div class="podium-step step-1" style="width: 100%; height: 75px; background: linear-gradient(180deg, #d97706 0%, #78350f 100%); border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-top: 6px; color: white; box-shadow: 0 6px 16px rgba(0,0,0,0.4);">1</div>
            </div>
          {/if}

          <!-- 3rd Place (Bronze) -->
          {#if sessionStandings[2]}
            <div class="podium-col bronze-col" style="flex: 0.95; display: flex; flex-direction: column; align-items: center; position: relative;">
              <div class="podium-avatar bronze-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: #b45309; color: #0c0f19; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; box-shadow: 0 4px 8px rgba(180, 83, 9, 0.4);">
                {sessionStandings[2].name.slice(0, 2).toUpperCase()}
              </div>
              <span class="podium-name" style="font-size: 0.75rem; font-weight: 700; white-space: nowrap; max-width: 75px; overflow: hidden; text-overflow: ellipsis; color: var(--color-text-primary);">{sessionStandings[2].name}</span>
              <span class="podium-score" style="font-size: 0.7rem; font-weight: 800; color: var(--color-secondary);">{sessionStandings[2].wins}🏆</span>
              <span style="font-size: 0.65rem; color: var(--color-text-secondary);">{sessionStandings[2].totalPoints} SP</span>
              <div class="podium-step step-3" style="width: 100%; height: 35px; background: linear-gradient(180deg, #b45309 0%, #78350f 100%); border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center; font-size: 1rem; margin-top: 6px; color: white; box-shadow: 0 4px 10px rgba(0,0,0,0.25);">3</div>
            </div>
          {/if}
        </div>

        <!-- Detailed Standings List -->
        <div class="capture-standings-list" style="display: flex; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 12px; border: 1px solid var(--color-border-glass);">
          {#each sessionStandings as player, index}
            <div class="capture-standing-item" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.85rem;" class:is-winner={index === 0}>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="standing-rank-badge" style="width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,0.06); font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; justify-content: center; color: var(--color-text-secondary);">{index + 1}</span>
                <span class="standing-player-name" style="font-weight: 700; color: var(--color-text-primary);">{player.name} <span style="font-size: 0.7rem; font-weight: 500; color: var(--color-text-muted);">({player.matchesPlayed} Rnd.)</span></span>
              </div>
              <span class="standing-player-score" style="font-weight: 800; color: var(--color-secondary);">{player.wins} Siege / {player.totalPoints} SP</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="foto-finish-actions" style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
        <button class="btn btn-secondary" style="width: 100%; justify-content: center;" onclick={() => showSessionPodium = false}>
          Fenster schließen
        </button>
        <button class="btn btn-danger" style="width: 100%; justify-content: center;" onclick={confirmEndSession}>
          Spielabend beenden
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .filter-pills-bar {
    display: flex;
    gap: 12px;
    background: rgba(15, 23, 42, 0.45);
    border: 1px solid var(--color-border-glass);
    border-radius: 26px;
    padding: 5px 6px;
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.4), 0 4px 15px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    width: fit-content;
    max-width: 100%;
    margin-bottom: 24px;
  }

  @media (min-width: 768px) {
    .filter-pills-bar {
      margin-bottom: 42px;
    }
  }

  .filter-pills-bar button {
    min-width: 95px;
    background: transparent;
    border-color: transparent;
    color: var(--color-text-secondary);
    transition: background-color 0.15s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.15s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    touch-action: manipulation;
  }

  .filter-pills-bar button:active {
    transform: scale(0.97);
    transition-duration: 0.07s;
  }

  .filter-pills-bar button:hover {
    background: rgba(0, 0, 0, 0.05);
    color: var(--color-text-primary);
  }

  :global([data-theme="dark"]) .filter-pills-bar button:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .filter-pills-bar button.active {
    background: color-mix(in srgb, var(--color-primary) 12%, rgba(255, 255, 255, 0.01));
    border-color: var(--color-primary);
    color: var(--color-primary);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  :global([data-theme="light"]) .filter-pills-bar {
    background: rgba(255, 255, 255, 0.55);
    border-color: rgba(0, 0, 0, 0.08);
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.06);
  }

  :global([data-theme="light"]) .filter-pills-bar button.active {
    background: color-mix(in srgb, var(--color-primary) 8%, rgba(255, 255, 255, 0.9));
    border-color: var(--color-primary);
    color: var(--color-primary);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.4), 0 2px 6px rgba(0, 0, 0, 0.04);
  }


  .screen-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .screen-header-left {
    flex: 1;
    min-width: 200px;
  }

  .btn-global-wiki {
    font-family: var(--font-heading);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--color-primary);
    background: var(--color-primary-glow);
    border: 1px solid var(--color-primary);
    padding: 8px 16px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
  }

  .btn-global-wiki:hover {
    background: var(--color-primary);
    color: var(--color-text-primary);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.25);
  }

  .btn-global-wiki:active {
    transform: translateY(0);
  }

  @media (max-width: 640px) {
    .btn-global-wiki {
      display: none;
    }
  }

  :global([data-theme="light"]) .btn-global-wiki {
    box-shadow: 0 4px 10px rgba(99, 102, 241, 0.1);
  }

  .screen-title {
    font-family: var(--font-heading);
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--color-text-primary);
    letter-spacing: -0.02em;
  }

  .screen-subtitle {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    margin-top: 4px;
  }

  .game-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  @media (min-width: 768px) {
    .game-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
  }

  .game-card {
    position: relative;
    min-height: 160px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid var(--color-border-glass);
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s, border-color 0.2s;
    text-align: left;
    background: transparent;
    outline: none;
    will-change: transform;
    touch-action: manipulation;
  }

  .game-card:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .game-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px var(--color-border-glow);
    border-color: var(--color-primary);
  }

  .game-card:active {
    transform: translateY(-1px) scale(0.97) !important;
    transition-duration: 0.07s !important;
  }

  .card-locked {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .card-locked:hover {
    transform: none !important;
    box-shadow: none;
    border-color: var(--color-border-glass);
  }

  .game-card-bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .card-expand-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    z-index: 10;
    cursor: pointer;
    background: transparent;
    border: none;
  }

  .card-expand-overlay:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
    opacity: 1;
    background: rgba(99, 102, 241, 0.1);
  }

  .game-card-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    transition: transform 0.15s cubic-bezier(0.25, 1, 0.5, 1);
  }

  .game-card-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    transition: background-image 0.3s;
  }

  .game-card-content {
    position: relative;
    z-index: 3;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    pointer-events: none;
  }

  .game-card-content * {
    pointer-events: auto;
  }

  .game-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    color: var(--color-text-secondary);
    width: fit-content;
  }

  .game-badge.badge-pending {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.4);
    color: #f59e0b;
  }

  .game-badge.badge-rejected {
    background: rgba(244, 63, 94, 0.15);
    border-color: rgba(244, 63, 94, 0.4);
    color: #f43f5e;
  }

  .game-title {
    font-family: var(--font-heading);
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  }

  .game-description {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.88);
    line-height: 1.4;
    flex: 1;
    text-shadow: 0 1px 3px rgba(0,0,0,0.9);
  }

  .game-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.08);
  }

  .game-footer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-wiki-card {
    font-family: var(--font-heading);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid var(--color-border-glass);
    padding: 4px 9px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }

  .btn-wiki-card:hover {
    background: var(--color-primary-glow);
    border-color: var(--color-primary);
    color: var(--color-text-primary);
  }

  .game-players {
    font-size: 0.78rem;
    color: var(--color-text-muted);
  }

  .game-action {
    font-family: var(--font-heading);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--color-primary);
    letter-spacing: 0.02em;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    outline: none;
  }

  .game-card:hover .game-arrow {
    transform: translateX(4px);
  }

  .game-action-locked {
    font-size: 0.82rem;
    color: var(--color-text-muted);
  }

  /* 3D Spotlight reflection effect */
  .card-spotlight {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255, 255, 255, 0.12) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.3s;
  }
  .game-card:hover .card-spotlight {
    opacity: 1;
  }

  /* Card Top Actions */
  .card-top-actions {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    gap: 8px;
    z-index: 5;
  }

  .card-action-circle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(15, 20, 32, 0.7);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
    transform: translateY(-4px);
  }

  .card-action-circle:hover {
    background: rgba(25, 30, 47, 0.9);
    color: var(--color-text-primary);
    transform: translateY(0) scale(1.08);
  }

  .card-action-circle.is-fav {
    color: var(--color-secondary);
    border-color: var(--color-secondary-glow);
    opacity: 1 !important;
    transform: translateY(0) !important;
  }

  .game-card:hover .card-action-circle {
    opacity: 1;
    transform: translateY(0);
  }

  /* Quick Actions Overlay */
  .quick-actions-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 20, 32, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 10;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 16px;
    animation: fadeIn var(--transition-fast) forwards;
  }

  :global([data-theme="light"]) .quick-actions-overlay {
    background: rgba(255, 255, 255, 0.92);
  }

  .quick-actions-close {
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .quick-actions-close:hover {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.1);
  }

  .quick-actions-title {
    font-family: var(--font-heading);
    font-size: 1rem;
    font-weight: 800;
    color: var(--color-text-primary);
    margin-bottom: 12px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }

  .quick-actions-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .quick-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-primary);
    font-family: var(--font-heading);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .quick-action-btn:hover {
    background: var(--color-primary-glow);
    border-color: var(--color-primary);
  }

  .quick-action-btn.active {
    background: var(--color-secondary-glow);
    border-color: var(--color-secondary);
    color: var(--color-secondary);
  }

  .action-icon {
    flex-shrink: 0;
  }

  /* Carousel Dots */
  .carousel-dots {
    display: none;
    justify-content: center;
    gap: 8px;
    margin-top: 16px;
    margin-bottom: 24px;
  }

  .carousel-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-border-glass);
    border: none;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
  }

  .carousel-dot.active {
    width: 24px;
    border-radius: 4px;
    background: var(--color-primary);
    box-shadow: 0 0 8px var(--color-primary-glow);
  }

  /* Mobile Layout Styles (No Carousel) */
  @media (max-width: 767px) {
    .card-action-circle {
      opacity: 1;
      transform: translateY(0);
      width: 36px;
      height: 36px;
    }
  }

  /* Light mode adjustments */
  :global([data-theme="light"]) .game-title {
    color: hsl(220, 30%, 10%);
    text-shadow: 0 1px 2px rgba(255,255,255,0.7);
  }
  :global([data-theme="light"]) .game-description {
    color: hsl(220, 15%, 25%);
    text-shadow: 0 1px 1px rgba(255,255,255,0.5);
  }
  :global([data-theme="light"]) .game-players {
    color: hsl(220, 10%, 35%);
  }
  :global([data-theme="light"]) .game-badge {
    background: rgba(255,255,255,0.75);
    border-color: rgba(0,0,0,0.12);
    color: hsl(220, 15%, 30%);
  }
  :global([data-theme="light"]) .card-action-circle {
    background: rgba(255, 255, 255, 0.85);
    color: hsl(220, 15%, 30%);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  :global([data-theme="light"]) .card-action-circle:hover {
    background: rgba(255, 255, 255, 0.95);
    color: var(--color-primary);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @media (max-width: 360px) {
    .game-card-content {
      padding: 12px 14px !important;
      gap: 4px !important;
    }
    .game-card {
      min-height: 135px !important;
    }
    .game-title {
      font-size: 1.1rem !important;
    }
    .game-description {
      font-size: 0.75rem !important;
      line-height: 1.3 !important;
    }
    .game-badge {
      padding: 2px 6px !important;
      font-size: 0.65rem !important;
      border-radius: 6px !important;
    }
    .game-footer {
      margin-top: 4px !important;
      padding-top: 6px !important;
    }
  }



  .btn-sm {
    padding: 6px 12px !important;
    font-size: 0.8rem !important;
    border-radius: 8px !important;
  }

  .empty-collection-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 24px;
    border-radius: var(--radius-lg);
    background: var(--color-surface-glass);
    border: 1px solid var(--color-border-glass);
    gap: 12px;
    max-width: 480px;
    margin: 20px auto;
  }

  .empty-emoji {
    font-size: 3rem;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
    animation: float 3s ease-in-out infinite;
  }

  .empty-title {
    font-family: var(--font-heading);
    font-size: 1.3rem;
    font-weight: 800;
    color: var(--color-text-primary);
  }

  .empty-description {
    font-size: 0.88rem;
    color: var(--color-text-secondary);
    max-width: 320px;
    line-height: 1.4;
  }

  .empty-tip {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    background: rgba(0, 0, 0, 0.15);
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.03);
    max-width: 380px;
    line-height: 1.4;
    margin-top: 8px;
  }

  :global([data-theme="light"]) .empty-tip {
    background: rgba(0, 0, 0, 0.03);
    border-color: rgba(0, 0, 0, 0.05);
  }

  .empty-back-btn {
    margin-top: 12px;
    min-height: unset !important;
    padding: 10px 20px !important;
    font-size: 0.85rem !important;
    border-radius: 12px !important;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  .btn-add-custom {
    border-color: var(--color-secondary) !important;
    color: var(--color-secondary) !important;
  }

  .quick-action-btn.btn-danger {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .quick-action-btn.btn-danger:hover {
    background: rgba(239, 68, 68, 0.18);
    border-color: #ef4444;
  }

  .btn-add-custom.locked {
    opacity: 0.6;
    cursor: not-allowed;
    border-color: var(--color-text-muted) !important;
    color: var(--color-text-muted) !important;
  }

  .custom-game-modal {
    max-height: 90vh;
    overflow-y: auto;
    width: 95%;
    max-width: 520px;
    padding: 24px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }

  .custom-game-modal::-webkit-scrollbar {
    width: 6px;
  }
  .custom-game-modal::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
  }

  .live-preview-container {
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 16px;
  }

  .custom-game-error-banner {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .custom-game-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 16px 0;
  }

  .custom-form-label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .label-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .char-counter {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-weight: 500;
    text-transform: none;
  }

  .char-counter.warning {
    color: var(--color-secondary);
  }

  .custom-form-input {
    background: rgba(0,0,0,0.25);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    padding: 10px 12px;
    border-radius: 10px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    width: 100%;
    box-sizing: border-box;
  }

  .custom-form-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-glow);
  }

  .custom-form-textarea {
    resize: vertical;
    min-height: 60px;
  }

  .form-row-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .emoji-selector-row {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .emoji-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .emoji-preset-btn {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    font-size: 1.1rem;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s, border-color 0.15s;
  }

  .emoji-preset-btn:hover {
    background: rgba(255,255,255,0.1);
    transform: translateY(-1px);
  }

  .emoji-preset-btn.active {
    background: var(--color-primary-glow);
    border-color: var(--color-primary);
  }

  .color-picker-row {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .color-picker-wrapper {
    position: relative;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    cursor: pointer;
    overflow: hidden;
    border: 2px solid rgba(255,255,255,0.2);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }

  .native-color-picker {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .color-picker-preview {
    width: 100%;
    height: 100%;
    transition: transform 0.15s;
  }

  .color-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .color-preset-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    transition: transform 0.15s, border-color 0.15s;
  }

  .color-preset-btn:hover {
    transform: scale(1.1);
  }

  .color-preset-btn.active {
    border-color: #ffffff;
    transform: scale(1.15);
  }

  .cat-input-row {
    display: flex;
    gap: 8px;
  }

  .cat-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .cat-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--color-primary-glow);
    border: 1px solid var(--color-primary);
    color: var(--color-text-primary);
    font-size: 0.78rem;
    font-weight: 600;
    border-radius: 20px;
    padding: 3px 10px;
  }
</style>

