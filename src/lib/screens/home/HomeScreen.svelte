<script>
  // @ts-check
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import Search from '@lucide/svelte/icons/search';
  import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
  import Plus from '@lucide/svelte/icons/plus';
  import Dices from '@lucide/svelte/icons/dices';
  import {
    gamesCatalog, currentGame, currentSessionDuration, showToast, settings, isAuthenticated,
    historyFilter, openWiki, pwaInstallEvent,
  } from '$lib/stores/app.js';
  import { navigate } from '$lib/router/router.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import { toSlug } from '$lib/components/wiki/utils/wikiKeys.js';
  import { db } from '$lib/services/DbService.js';
  import { pwaInstall } from '$lib/shell/pwaInstall.svelte.js';
  import {
    collection, loadCollection, toggleFavorite, toggleOwned, toggleWishlist, deleteCustomGameEntry,
  } from '$lib/screens/gameActions.svelte.js';
  import Screen from '$lib/ui/Screen.svelte';
  import Segmented from '$lib/ui/Segmented.svelte';
  import Field from '$lib/ui/Field.svelte';
  import Button from '$lib/ui/Button.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import Skeleton from '$lib/ui/Skeleton.svelte';
  import SyncChip from '$lib/shell/SyncChip.svelte';
  import InstallCard from './InstallCard.svelte';
  import DraftCard from './DraftCard.svelte';
  import SessionCard from './SessionCard.svelte';
  import GameCard from './GameCard.svelte';
  import GameActionsSheet from './GameActionsSheet.svelte';

  // ─── Sammlung / Favoriten (persistiert, bestehende Keys B4; Logik in gameActions.svelte.js) ──
  let favorites = $derived(collection.favorites);
  let ownedGames = $derived(collection.owned);
  let wishlistGames = $derived(collection.wishlist);

  onMount(() => {
    loadCollection();
    loadDrafts();
  });

  // ─── Entwürfe (offene Wertungen) ─────────────────────────────────────────────
  let activeDrafts = $state(/** @type {any[]} */ ([]));
  let showAllDrafts = $state(false);

  async function loadDrafts() {
    try {
      const drafts = (await db.get('bg_drafts')) ?? [];
      activeDrafts = drafts.filter((/** @type {any} */ d) => d.status === 'draft');
    } catch (_) {}
  }

  /** @param {any} draft */
  function resumeDraft(draft) {
    currentGame.set(draft.game_key);
    currentSessionDuration.set(draft.duration || 0);
    navigate(appHash.matchScore());
  }

  /** @param {string} draftId */
  async function discardDraft(draftId) {
    const drafts = (await db.get('bg_drafts')) ?? [];
    const removed = drafts.find((/** @type {any} */ d) => d.id === draftId);
    if (!removed) return;
    await db.set('bg_drafts', drafts.filter((/** @type {any} */ d) => d.id !== draftId));
    await loadDrafts();
    showToast('Entwurf gelöscht', 'info', 5000, {
      label: 'Rückgängig',
      onClick: async () => {
        const current = (await db.get('bg_drafts')) ?? [];
        await db.set('bg_drafts', [...current, removed]);
        await loadDrafts();
      },
    });
  }

  let visibleDrafts = $derived(showAllDrafts ? activeDrafts : activeDrafts.slice(0, 3));

  // ─── Katalog: Filter, Suche, Sortierung ──────────────────────────────────────
  let collectionFilter = $state('all');
  let sortOrder = $state('asc');
  let searchQuery = $state('');
  let query = $derived(searchQuery.trim().toLocaleLowerCase('de'));

  let totalCount = $derived(Object.keys($gamesCatalog).length);
  let ownedCount = $derived(ownedGames.filter((k) => $gamesCatalog[k]).length);

  let games = $derived(
    Object.values($gamesCatalog)
      .filter((/** @type {any} */ g) => {
        if (collectionFilter === 'owned') return ownedGames.includes(g.key);
        if (collectionFilter === 'wishlist') return wishlistGames.includes(g.key);
        return true;
      })
      .filter((/** @type {any} */ g) => !query || g.name.toLocaleLowerCase('de').includes(query))
      .sort((/** @type {any} */ a, /** @type {any} */ b) => {
        const aFav = favorites.includes(a.key), bFav = favorites.includes(b.key);
        if (aFav !== bFav) return aFav ? -1 : 1;
        const cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        return sortOrder === 'asc' ? cmp : -cmp;
      })
  );

  const FILTER_OPTIONS = [
    { value: 'all', label: 'Alle' },
    { value: 'owned', label: 'Sammlung' },
    { value: 'wishlist', label: 'Wunschliste' },
  ];

  /** @param {string} key */
  function selectGame(key) {
    if (!get(isAuthenticated)) {
      showToast('Spiel werten erfordert ein Konto. Bitte melde dich an oder registriere dich.', 'warning');
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }
    navigate(appHash.game(toSlug(key)));
  }

  // ─── Quick-Actions-Sheet ──────────────────────────────────────────────────
  let actionsGameKey = $state(/** @type {string|null} */ (null));
  let actionsOpen = $state(false);
  let actionsGame = $derived(actionsGameKey ? $gamesCatalog[actionsGameKey] : null);
  let actionsIsFavorite = $derived(!!actionsGameKey && favorites.includes(actionsGameKey));
  let actionsIsOwned = $derived(!!actionsGameKey && ownedGames.includes(actionsGameKey));
  let actionsIsWishlisted = $derived(!!actionsGameKey && wishlistGames.includes(actionsGameKey));

  /** @param {string} key */
  function openActions(key) {
    actionsGameKey = key;
    actionsOpen = true;
  }

  /** @param {string} key */
  function showHistory(key) {
    historyFilter.set(key);
    navigate(appHash.history());
  }

</script>

<Screen title="Spielen" subtitle="{totalCount} Spiele · {ownedCount} in deiner Sammlung" wide>
  {#snippet actions()}<SyncChip class="lg:hidden" />{/snippet}

  <div class="flex flex-col gap-3">
    {#if $pwaInstallEvent && !pwaInstall.dismissed}
      <InstallCard />
    {/if}

    {#each visibleDrafts as draft (draft.id)}
      <DraftCard {draft} game={$gamesCatalog[draft.game_key]} onresume={resumeDraft} ondiscard={discardDraft} />
    {/each}
    {#if activeDrafts.length > 3}
      <button type="button" class="self-start text-sm font-semibold text-accent" onclick={() => (showAllDrafts = !showAllDrafts)}>
        {showAllDrafts ? 'Weniger anzeigen' : `Alle anzeigen (${activeDrafts.length})`}
      </button>
    {/if}

    {#if $settings.gameSessionMode}
      <SessionCard />
    {/if}

    <Field label="Spiel suchen" hideLabel placeholder="Spiel suchen" bind:value={searchQuery}>
      {#snippet leading()}<Search class="size-4 text-fg-2" aria-hidden="true" />{/snippet}
    </Field>

    <div class="flex items-center gap-2">
      <Segmented variant="chips" label="Sammlung filtern" options={FILTER_OPTIONS} bind:value={collectionFilter} />
      <IconButton class="ml-auto" label={sortOrder === 'asc' ? 'Sortierung Z–A' : 'Sortierung A–Z'}
        onclick={() => (sortOrder = sortOrder === 'asc' ? 'desc' : 'asc')}>
        <ArrowUpDown class="size-5" aria-hidden="true" />
      </IconButton>
    </div>
  </div>

  <div class="mt-4">
    {#if totalCount === 0}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {#each Array(6) as _}
          <div class="overflow-hidden rounded-md border border-line">
            <Skeleton class="aspect-[4/3] rounded-none" />
            <div class="flex flex-col gap-2 p-3">
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="h-3 w-1/2" />
            </div>
          </div>
        {/each}
      </div>
    {:else if games.length === 0 && query}
      <EmptyState title={`Kein Spiel gefunden für „${searchQuery}“`} icon={Search} />
    {:else if games.length === 0}
      <EmptyState title={collectionFilter === 'owned' ? 'Deine Spielesammlung ist leer' : 'Deine Wunschliste ist leer'}
        text="Öffne bei einem Spiel die Aktionen über das ⋯-Symbol, um es hinzuzufügen." icon={Dices}>
        {#snippet action()}<Button variant="secondary" onclick={() => (collectionFilter = 'all')}>Alle Spiele zeigen</Button>{/snippet}
      </EmptyState>
    {:else}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {#each games as game (game.key)}
          <GameCard {game} isFavorite={favorites.includes(game.key)} onselect={selectGame}
            ontogglefavorite={toggleFavorite} onopenactions={openActions} />
        {/each}
        {#if collectionFilter === 'all' && !query}
          <a href={appHash.customGame()} class="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong text-fg-2 hover:text-fg">
            <Plus class="size-6" aria-hidden="true" />
            <span class="px-2 text-center text-sm font-semibold">Eigenes Spiel hinzufügen</span>
          </a>
        {/if}
      </div>
    {/if}
  </div>
</Screen>

<GameActionsSheet bind:open={actionsOpen} game={actionsGame} isFavorite={actionsIsFavorite}
  isOwned={actionsIsOwned} isWishlisted={actionsIsWishlisted}
  ontogglefavorite={toggleFavorite} ontoggleowned={toggleOwned} ontogglewishlist={toggleWishlist}
  onopenwiki={openWiki} onshowhistory={showHistory} ondelete={deleteCustomGameEntry} />
