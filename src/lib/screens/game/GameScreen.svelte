<script>
  // @ts-check
  import { onMount } from 'svelte';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import Dices from '@lucide/svelte/icons/dices';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import History from '@lucide/svelte/icons/history';
  import Play from '@lucide/svelte/icons/play';
  import {
    currentGame, gamesCatalog, historyFilter, openWiki, timerState, currentUser,
  } from '$lib/stores/app.js';
  import { navigate } from '$lib/router/router.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import { toSlug } from '$lib/components/wiki/utils/wikiKeys.js';
  import { db, pullFromRemote } from '$lib/services/DbService.js';
  import { validateGameImageUrl } from '$lib/utils/urlValidator.js';
  import { safeCssColor } from '$lib/ui/color.js';
  import Screen from '$lib/ui/Screen.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Button from '$lib/ui/Button.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import ListRow from '$lib/ui/ListRow.svelte';
  import Skeleton from '$lib/ui/Skeleton.svelte';
  import GameActionsSheet from '$lib/screens/home/GameActionsSheet.svelte';
  import {
    collection, loadCollection, toggleFavorite, toggleOwned, toggleWishlist, deleteCustomGameEntry,
  } from '$lib/screens/gameActions.svelte.js';
  import { computeGameStats, formatDuration } from './gameStats.js';

  /** @type {{ onopenStartPlayer?: () => void }} */
  let { onopenStartPlayer = () => {} } = $props();

  let game = $derived($currentGame ? $gamesCatalog[$currentGame] : null);
  let cover = $derived(game?.cover ? validateGameImageUrl(game.cover) : null);
  let accent = $derived(safeCssColor(game?.theme?.primary, 'var(--accent)'));
  let hasWiki = $derived(!!game?.wiki?.categories?.length || (game?.wiki?.enabled && game?.wiki?.manifest));
  let hasExpansion = $derived(!!game?.expansion);
  let slug = $derived(game ? toSlug(game.key) : '');

  // ─── Kennzahlen aus den gespeicherten Partien ───────────────────────────────
  let stats = $state({ count: 0, avgDuration: 0, lastWinner: /** @type {string|null} */ (null), topPlayer: /** @type {string|null} */ (null) });
  let statsLoaded = $state(false);
  let statsFor = '';

  /** @param {string} key @param {string} name */
  async function loadStats(key, name) {
    try {
      /** @type {any[]} */
      let allMatches = [];
      const user = $currentUser;
      if (navigator.onLine && user?.id) {
        try {
          allMatches = await pullFromRemote(user.id);
          if (Array.isArray(allMatches) && allMatches.length > 0) await db.set('bg_matches', allMatches);
        } catch (e) {
          console.warn('Spiel-Seite: Remote-Abruf der Partien fehlgeschlagen:', e);
          allMatches = /** @type {any[]} */ ((await db.get('bg_matches')) ?? []);
        }
      } else {
        allMatches = /** @type {any[]} */ ((await db.get('bg_matches')) ?? []);
      }
      stats = computeGameStats(allMatches, name, key);
    } catch (_) {}
    statsLoaded = true;
  }

  // Der Katalog kann nach dem Einhängen nachladen → erst laden, wenn das Spiel bekannt ist.
  $effect(() => {
    const key = game?.key;
    if (key && key !== statsFor) {
      statsFor = key;
      loadStats(key, game.name);
    }
  });

  onMount(loadCollection);

  // ─── Timer-Zustand (welches Spiel läuft?) ───────────────────────────────────
  let timerGameKey = $derived(
    $timerState !== 'stopped' ? (localStorage.getItem('bg_timer_current_game') ?? $currentGame) : null
  );
  let dockMode = $derived(!timerGameKey ? 'idle' : timerGameKey === game?.key ? 'this' : 'other');
  let otherGameName = $derived(timerGameKey ? ($gamesCatalog[timerGameKey]?.name ?? timerGameKey) : '');

  function goToRunningMatch() {
    if (timerGameKey) currentGame.set(timerGameKey);
    navigate(appHash.matchLive());
  }

  // ─── Aktionen ───────────────────────────────────────────────────────────────
  let actionsOpen = $state(false);

  /** @param {string} key */
  function showHistory(key) {
    historyFilter.set(key);
    navigate(appHash.history());
  }

  /** @param {string} key */
  async function removeCustomGame(key) {
    if (await deleteCustomGameEntry(key)) navigate(appHash.home(), { replace: true });
  }
</script>

<Screen title={game?.name ?? 'Spiel'}>
  {#snippet hero()}
    <div class="relative h-[270px] sm:h-[320px]" style:view-transition-name={slug ? 'cover-' + slug.replace(/[^a-z0-9-]/gi, '_') : undefined}>
      {#if cover}
        <img src={cover} alt="" width="800" height="600" fetchpriority="high" decoding="async" class="size-full object-cover" />
      {:else}
        <div class="grid size-full place-items-center bg-surface-2 text-fg-2"><Dices class="size-14" aria-hidden="true" /></div>
      {/if}
      <div class="hero-fade absolute inset-0" aria-hidden="true"></div>
      <div class="absolute inset-x-0 bottom-0 h-1" style:background={accent} aria-hidden="true"></div>
      <IconButton variant="overlay" label="Zurück" href={appHash.home()} class="absolute left-3 top-3 z-10">
        <ChevronLeft class="size-6" aria-hidden="true" />
      </IconButton>
      {#if game}
        <IconButton variant="overlay" label="Weitere Aktionen" class="absolute right-3 top-3 z-10" onclick={() => (actionsOpen = true)}>
          <Ellipsis class="size-6" aria-hidden="true" />
        </IconButton>
      {/if}
    </div>
    <div class="relative -mt-10 px-4 sm:px-6">
      {#if game}
        <h1 tabindex="-1" data-screen-title class="font-display text-h1 font-semibold">{game.name}</h1>
        <div class="mt-2.5 flex flex-wrap items-center gap-2">
          {#if game.badge}<Badge>{game.badge}</Badge>{/if}
          <Badge tone="neutral">{game.players ?? '2+ Spieler'}</Badge>
          {#if hasExpansion}<Badge tone="gold">Erweiterung</Badge>{/if}
          {#if dockMode === 'this'}<Badge tone="success">Partie läuft</Badge>{/if}
        </div>
      {:else}
        <h1 tabindex="-1" data-screen-title class="sr-only">Spiel</h1>
        <Skeleton class="h-9 w-2/3" />
      {/if}
    </div>
  {/snippet}

  {#if game}
    <div class="flex flex-col gap-4 pt-4">
      {#if game.description}<p class="text-fg-2">{game.description}</p>{/if}

      <div class="grid grid-cols-2 gap-2.5">
        <Card class="p-3">
          <div class="tabular text-[22px] font-bold leading-tight">{statsLoaded ? stats.count : '…'}</div>
          <div class="mt-0.5 text-[0.8rem] text-fg-2">Partien</div>
        </Card>
        <Card class="p-3">
          <div class="tabular text-[22px] font-bold leading-tight">{statsLoaded ? formatDuration(stats.avgDuration) : '…'}</div>
          <div class="mt-0.5 text-[0.8rem] text-fg-2">Ø Spieldauer</div>
        </Card>
        <Card class="p-3">
          <div class="truncate text-[22px] font-bold leading-tight">{statsLoaded ? (stats.lastWinner ?? '—') : '…'}</div>
          <div class="mt-0.5 text-[0.8rem] text-fg-2">Letzter Sieger</div>
        </Card>
        <Card class="p-3">
          <div class="truncate text-[22px] font-bold leading-tight">{statsLoaded ? (stats.topPlayer ?? '—') : '…'}</div>
          <div class="mt-0.5 text-[0.8rem] text-fg-2">Meiste Siege</div>
        </Card>
      </div>

      <Card>
        <ListRow title="Startspieler auslosen" onclick={onopenStartPlayer}>
          {#snippet leading()}<Dices class="size-5" aria-hidden="true" />{/snippet}
        </ListRow>
        {#if hasWiki}
          <ListRow title="Regeln & Wiki" onclick={() => openWiki(game.key)}>
            {#snippet leading()}<BookOpen class="size-5" aria-hidden="true" />{/snippet}
          </ListRow>
        {/if}
        <ListRow title="Letzte Ergebnisse" onclick={() => showHistory(game.key)}>
          {#snippet leading()}<History class="size-5" aria-hidden="true" />{/snippet}
        </ListRow>
      </Card>
    </div>
  {/if}

  {#snippet dock()}
    {#if !game}
      <Button variant="secondary" size="lg" block href={appHash.home()}>Zur Spieleliste</Button>
    {:else if dockMode === 'idle'}
      <Button variant="secondary" size="lg" class="flex-1" href={appHash.matchPlayers('score')}>Nur werten</Button>
      <Button variant="primary" size="lg" class="flex-[1.6]" href={appHash.matchPlayers('live')}>
        <Play class="size-5" fill="currentColor" aria-hidden="true" />Partie starten
      </Button>
    {:else if dockMode === 'this'}
      <Button variant="primary" size="lg" block href={appHash.matchLive()}>Zur Partie</Button>
    {:else}
      <div class="flex w-full flex-col gap-2">
        <p class="text-center text-sm text-fg-2">Es läuft bereits eine Partie: {otherGameName}</p>
        <Button variant="secondary" size="lg" block onclick={goToRunningMatch}>Zur laufenden Partie</Button>
      </div>
    {/if}
  {/snippet}
</Screen>

{#if game}
  <GameActionsSheet bind:open={actionsOpen} {game}
    isFavorite={collection.favorites.includes(game.key)}
    isOwned={collection.owned.includes(game.key)}
    isWishlisted={collection.wishlist.includes(game.key)}
    ontogglefavorite={toggleFavorite} ontoggleowned={toggleOwned} ontogglewishlist={toggleWishlist}
    onopenwiki={openWiki} onshowhistory={showHistory} ondelete={removeCustomGame} />
{/if}

<style>
  .hero-fade { background: linear-gradient(to bottom, transparent 30%, var(--bg) 92%); }
</style>
