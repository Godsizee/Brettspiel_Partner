<script>
  // @ts-check
  import { fade } from 'svelte/transition';
  import WikiShell from '$lib/components/wiki/WikiShell.svelte';
  import WikiSideNav from '$lib/components/wiki/WikiSideNav.svelte';
  import WikiModuleChips from '$lib/components/wiki/WikiModuleChips.svelte';
  import WikiLightbox from '$lib/components/wiki/WikiLightbox.svelte';
  import { wikiHash } from '$lib/components/wiki/utils/wikiRoutes.js';

  /**
   * @type {{
   *   view: string,
   *   slug: string | null,
   *   moduleId: string | null,
   *   gameName: string,
   *   overview: any,
   *   visibleModules: any[],
   *   crumbs: any[],
   *   backHref: string | null,
   *   searchInput: string,
   *   searchPlaceholder: string,
   *   onSearchInput: (v: string) => void,
   *   onSearchSubmit: (v: string) => void,
   *   prefetchModule: (m: any) => void,
   *   isLoading: boolean,
   *   catalogError: string,
   *   gameError: string,
   *   contentKey: string,
   *   children: import('svelte').Snippet
   * }}
   */
  let {
    view, slug, moduleId, gameName, overview, visibleModules, crumbs, backHref,
    searchInput, searchPlaceholder, onSearchInput, onSearchSubmit, prefetchModule,
    isLoading, catalogError, gameError, contentKey, children
  } = $props();

  const gameOpen = $derived(!!slug && !!overview && overview.slug === slug);
  const moduleHref = $derived((/** @type {any} */ m) => slug ? wikiHash.module(slug, m.id) : '#/wiki');

  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const fadeDur = reduceMotion ? 0 : 170;
</script>

<WikiLightbox />

<div class="wiki-shell-grid flex-1 min-h-0 w-full {gameOpen ? 'has-rail' : ''}">

  {#if gameOpen}
    <WikiSideNav
      gameName={gameName}
      cover={overview?.catalogEntry?.cover ?? ''}
      publisher={overview?.catalogEntry?.publisher ?? ''}
      modules={visibleModules}
      activeModuleId={view === 'wiki-search' ? null : moduleId}
      {moduleHref}
      homeHref={slug ? wikiHash.game(slug) : '#/wiki'}
      overviewHref={wikiHash.overview()}
      onPrefetch={prefetchModule}
    />
  {/if}

  <div class="wiki-main">
    <WikiShell
      {crumbs}
      {backHref}
      searchEnabled={gameOpen}
      query={searchInput}
      placeholder={searchPlaceholder}
      onSearch={onSearchInput}
      onSearchSubmit={onSearchSubmit}
    >
      {#snippet subnav()}
        {#if gameOpen && visibleModules.length > 0}
          <WikiModuleChips
            modules={visibleModules}
            activeModuleId={view === 'wiki-search' ? null : moduleId}
            homeHref={slug ? wikiHash.game(slug) : '#/wiki'}
            homeActive={view === 'wiki-game'}
            {moduleHref}
            onPrefetch={prefetchModule}
          />
        {/if}
      {/snippet}

      {#if isLoading}
        <!-- Skeleton je Seitentyp -->
        {#if view === 'wiki-overview'}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {#each Array(6) as _}
              <div class="wiki-skeleton h-48 w-full"></div>
            {/each}
          </div>
        {:else if view === 'wiki-entry'}
          <div class="flex flex-col gap-4 max-w-[var(--wiki-measure)]">
            <div class="wiki-skeleton h-3.5 w-1/4"></div>
            <div class="wiki-skeleton h-8 w-3/5"></div>
            <div class="wiki-skeleton h-52 w-full"></div>
            <div class="wiki-skeleton h-4 w-full"></div>
            <div class="wiki-skeleton h-4 w-4/5"></div>
          </div>
        {:else if view === 'wiki-module' || view === 'wiki-search'}
          <div class="flex flex-col gap-3">
            <div class="wiki-skeleton h-8 w-2/5 mb-2"></div>
            {#each Array(6) as _}
              <div class="wiki-skeleton h-16 w-full"></div>
            {/each}
          </div>
        {:else}
          <div class="flex flex-col gap-3 max-w-[600px]">
            <div class="wiki-skeleton h-40 w-full"></div>
            <div class="wiki-skeleton h-7 w-2/5"></div>
            <div class="wiki-skeleton h-4 w-full"></div>
            <div class="wiki-skeleton h-4 w-4/5"></div>
          </div>
        {/if}
      {:else if catalogError || (gameError && view !== 'wiki-overview')}
        <div class="wiki-card p-6 flex flex-col gap-4 items-start max-w-[480px]">
          <p class="m-0 text-[var(--color-text-primary)] font-medium">⚠ {catalogError || gameError}</p>
          <div class="flex gap-2 flex-wrap">
            <button
              class="wiki-nav-item is-active justify-center w-auto px-4"
              type="button"
              onclick={() => location.reload()}
            >Neu laden</button>
            <a class="wiki-nav-item justify-center w-auto px-4 border border-border-glass" href={wikiHash.overview()}>Zur Übersicht</a>
          </div>
        </div>
      {:else}
        {#key contentKey}
          <div in:fade={{ duration: fadeDur }}>
            {@render children()}
          </div>
        {/key}
      {/if}
    </WikiShell>
  </div>
</div>

<style>
  .wiki-shell-grid {
    display: flex;
    flex-direction: column;
  }
  @media (min-width: 1024px) {
    .wiki-shell-grid.has-rail {
      display: grid;
      grid-template-columns: var(--wiki-rail-w) minmax(0, 1fr);
    }
  }
  .wiki-main { background: var(--color-bg-base); }
</style>
