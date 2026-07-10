<script>
  // @ts-check
  import { onMount, onDestroy, tick, untrack } from 'svelte';
  import { currentRoute, navigate } from '$lib/router/router.js';
  import { wikiHash, parentHash } from '$lib/components/wiki/utils/wikiRoutes.js';
  import {
    getWikiCatalog,
    getGameOverview,
    getGameModule,
    getSearchableEntries
  } from '$lib/services/WikiService.js';
  import { searchEntries } from '$lib/components/wiki/utils/wikiSearch.js';
  import { filterEntries } from '$lib/components/wiki/utils/wikiFilters.js';
  import { rememberScroll, targetScroll } from '$lib/components/wiki/utils/wikiScroll.js';
  import { addRecentEntry } from '$lib/components/wiki/utils/wikiRecents.js';
  import { get } from 'svelte/store';
  import './wiki.css';

  import WikiLayout from '$lib/components/wiki/layouts/WikiLayout.svelte';
  import WikiOverviewPage from '$lib/components/wiki/pages/WikiOverviewPage.svelte';
  import WikiSearchPage from '$lib/components/wiki/pages/WikiSearchPage.svelte';
  import WikiGamePage from '$lib/components/wiki/pages/WikiGamePage.svelte';
  import WikiModulePage from '$lib/components/wiki/pages/WikiModulePage.svelte';
  import WikiEntryPage from '$lib/components/wiki/pages/WikiEntryPage.svelte';
  import WikiNotFoundPage from '$lib/components/wiki/pages/WikiNotFoundPage.svelte';

  // Sicherheitsnetz
  onMount(() => {
    history.scrollRestoration = 'manual';
    if (!get(currentRoute)) {
      navigate(wikiHash.overview(), { replace: true });
    }
  });

  onDestroy(() => {
    if (typeof history !== 'undefined') {
      history.scrollRestoration = 'auto';
    }
  });

  const route = $derived($currentRoute);
  const view = $derived(route?.name ?? 'wiki-overview');
  const slug = $derived(route?.params?.game ?? null);
  const moduleId = $derived(
    view === 'wiki-module' || view === 'wiki-entry' ? route?.params?.module ?? null : null
  );
  const entryId = $derived(view === 'wiki-entry' ? route?.params?.entry ?? null : null);
  const routeQuery = $derived(view === 'wiki-search' ? route?.query?.q ?? '' : '');

  let games = $state(/** @type {any[]} */ ([]));
  let catalogLoading = $state(true);
  let catalogError = $state('');

  /** @type {any} */ let overview = $state(null);
  let overviewLoading = $state(false);
  let gameError = $state('');

  /** @type {any} */ let activeModule = $state(null);
  let moduleLoading = $state(false);

  /** @type {{slug: string, entries: any[]} | null} */ let searchPool = $state(null);
  let searchLoading = $state(false);

  onMount(async () => {
    try {
      games = await getWikiCatalog();
    } catch (err) {
      catalogError = err.message || 'Wiki konnte nicht geladen werden.';
    } finally {
      catalogLoading = false;
    }
  });

  $effect(() => {
    const s = slug;
    if (!s) {
      overview = null;
      gameError = '';
      return;
    }
    if (untrack(() => overview)?.slug === s) return;
    let cancelled = false;
    overviewLoading = true;
    gameError = '';
    getGameOverview(s)
      .then((o) => { if (!cancelled) overview = o; })
      .catch((err) => { if (!cancelled) gameError = err.message || 'Spiel-Wiki konnte nicht geladen werden.'; })
      .finally(() => { if (!cancelled) overviewLoading = false; });
    return () => { cancelled = true; };
  });

  $effect(() => {
    const s = slug;
    const m = moduleId;
    if (!s || !m) {
      activeModule = null;
      return;
    }
    const key = `${s}/${m}`;
    if (untrack(() => activeModule)?.__key === key) return;
    let cancelled = false;
    moduleLoading = true;
    getGameModule(s, m)
      .then((mod) => { if (!cancelled) activeModule = { ...mod, __key: key }; })
      .catch((err) => {
        if (!cancelled) activeModule = { id: m, title: m, __key: key, error: err.message || 'Bereich nicht gefunden.', data: { entries: [] } };
      })
      .finally(() => { if (!cancelled) moduleLoading = false; });
    return () => { cancelled = true; };
  });

  $effect(() => {
    if (view !== 'wiki-search' || !slug) return;
    const s = slug;
    if (untrack(() => searchPool)?.slug === s) return;
    let cancelled = false;
    searchLoading = true;
    getSearchableEntries(s)
      .then((entries) => { if (!cancelled) searchPool = { slug: s, entries }; })
      .catch(() => { if (!cancelled) searchPool = { slug: s, entries: [] }; })
      .finally(() => { if (!cancelled) searchLoading = false; });
    return () => { cancelled = true; };
  });

  $effect(() => {
    if (view === 'wiki-entry' && slug && moduleId && currentEntry) {
      addRecentEntry(slug, moduleId, String(currentEntry.id), currentEntry.name);
    }
  });

  const gameOpen = $derived(!!slug && !!overview && overview.slug === slug);
  const gameName = $derived(overview?.catalogEntry?.name ?? '');

  const visibleModules = $derived(
    (overview?.modules || []).filter(
      (/** @type {any} */ m) => m.id !== 'quellen' && m.title !== 'Quellen & Rechte' && m.title !== 'Quellen und Rechte'
    )
  );

  const moduleEntries = $derived.by(() => {
    const data = activeModule?.data;
    if (Array.isArray(data)) return data;
    return data?.entries || [];
  });

  const currentEntryIndex = $derived(
    entryId != null ? moduleEntries.findIndex((/** @type {any} */ e) => String(e.id) === entryId) : -1
  );
  const currentEntry = $derived(currentEntryIndex >= 0 ? moduleEntries[currentEntryIndex] : null);
  const prevEntry = $derived(currentEntryIndex > 0 ? moduleEntries[currentEntryIndex - 1] : null);
  const nextEntry = $derived(
    currentEntryIndex >= 0 && currentEntryIndex < moduleEntries.length - 1
      ? moduleEntries[currentEntryIndex + 1]
      : null
  );

  const searchedEntries = $derived(
    searchPool && searchPool.slug === slug ? searchEntries(searchPool.entries, routeQuery) : []
  );

  const searchFilters = $derived({
    category: (view === 'wiki-search' && route?.query?.category) || null,
    timing: (view === 'wiki-search' && route?.query?.timing) || null,
    edition: (view === 'wiki-search' && route?.query?.edition) || null,
    expansion: (view === 'wiki-search' && route?.query?.expansion) || null
  });
  const filteredEntries = $derived(filterEntries(searchedEntries, searchFilters));

  /** @param {Record<string, string|null>} [overrides] */
  function searchHash(overrides = {}) {
    return wikiHash.search(/** @type {string} */ (slug), {
      q: routeQuery,
      ...searchFilters,
      ...overrides
    });
  }

  /** @param {string} key @param {string|null} value */
  function setSearchFilter(key, value) {
    navigate(searchHash({ [key]: value }), { replace: true });
  }

  function resetSearchFilters() {
    navigate(wikiHash.search(/** @type {string} */ (slug), { q: routeQuery }), { replace: true });
  }

  const gameHref = $derived((/** @type {any} */ g) => wikiHash.game(g.key));
  const moduleHref = $derived((/** @type {any} */ m) => slug ? wikiHash.module(slug, m.id) : '#/wiki');
  const entryHref = $derived((/** @type {any} */ e) => {
    if (!slug) return '#/wiki';
    const kind = e.kind || activeModule?.type || 'reference';
    if (kind === 'reference' || kind === 'tips' || kind === 'glossary') {
      return wikiHash.entry(slug, e.moduleId ?? moduleId ?? '', String(e.id));
    }
    return wikiHash.module(slug, e.moduleId ?? moduleId ?? '');
  });
  const backHref = $derived(parentHash(route));

  const crumbs = $derived.by(() => {
    /** @type {Array<{label: string, href?: string}>} */
    const list = [{ label: 'Spiele-Wiki', href: view !== 'wiki-overview' ? wikiHash.overview() : undefined }];
    if (slug && view !== 'wiki-overview') {
      list.push({
        label: gameName || slug,
        href: view !== 'wiki-game' ? wikiHash.game(slug) : undefined
      });
    }
    if (view === 'wiki-search') {
      list.push({ label: routeQuery ? `Suche: „${routeQuery}“` : 'Suche' });
    } else if ((view === 'wiki-module' || view === 'wiki-entry') && slug && moduleId) {
      list.push({
        label: activeModule?.title ?? moduleId,
        href: view === 'wiki-entry' ? wikiHash.module(slug, moduleId) : undefined
      });
    }
    if (view === 'wiki-entry') {
      list.push({ label: currentEntry?.name ?? '…' });
    }
    return list;
  });

  let searchInput = $state('');
  $effect(() => { searchInput = routeQuery; });

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let searchDebounce;
  /** @param {string} value */
  function onSearchInput(value) {
    searchInput = value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      if (!slug) return;
      const q = value.trim();
      if (q) {
        navigate(searchHash({ q }), { replace: view === 'wiki-search' });
      } else if (view === 'wiki-search') {
        navigate(wikiHash.game(slug), { replace: true });
      }
    }, 200);
  }

  /** @param {string} value */
  function onSearchSubmit(value) {
    clearTimeout(searchDebounce);
    if (!slug) return;
    const q = value.trim();
    if (q) navigate(searchHash({ q }));
  }
  onDestroy(() => clearTimeout(searchDebounce));

  const searchPlaceholder = $derived(gameName ? `In „${gameName}“ suchen …` : 'Suchen …');

  /** @param {any} mod */
  function prefetchModule(mod) {
    const s = slug;
    if (!s || !mod?.id) return;
    const run = () => { getGameModule(s, mod.id).catch(() => {}); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 1500 });
    else setTimeout(run, 0);
  }

  $effect(() => {
    const parts = [];
    if (view === 'wiki-entry' && currentEntry) parts.push(currentEntry.name);
    if ((view === 'wiki-module' || view === 'wiki-entry') && activeModule?.title) parts.push(activeModule.title);
    if (view === 'wiki-search') parts.push(routeQuery ? `Suche: ${routeQuery}` : 'Suche');
    if (gameName && view !== 'wiki-overview') parts.push(gameName);
    document.title = parts.length
      ? `${parts.join(' – ')} · Spiele-Wiki`
      : 'Spiele-Wiki · Boardgame Companion';
  });
  onDestroy(() => { document.title = 'Boardgame Companion'; });

  let prevHash = /** @type {string | null} */ (null);
  let routeSeen = false;

  $effect(() => {
    const h = route?.hash ?? null;
    if (!routeSeen) {
      routeSeen = true;
      prevHash = h;
      return;
    }
    if (h === prevHash) return;
    
    rememberScroll(prevHash);
    prevHash = h;
    const target = targetScroll(h);
    
    tick().then(() => {
      window.scrollTo({ top: target });
      const heading = document.querySelector('.wiki-main h1[tabindex="-1"]');
      if (heading instanceof HTMLElement) heading.focus({ preventScroll: true });
    });
  });

  /** @param {KeyboardEvent} e */
  function onKeydown(e) {
    const target = /** @type {HTMLElement} */ (e.target);
    const tag = target?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
    if (e.key === '/' && !typing && gameOpen) {
      e.preventDefault();
      document.getElementById('wiki-search-input')?.focus();
      return;
    }
    if (view !== 'wiki-entry' || typing) return;
    if (e.key === 'ArrowLeft' && prevEntry) navigate(entryHref(prevEntry));
    if (e.key === 'ArrowRight' && nextEntry) navigate(entryHref(nextEntry));
  }

  const contentKey = $derived(route?.hash ?? 'wiki-overview');

  const isLoading = $derived(
    catalogLoading
    || (view === 'wiki-game' && overviewLoading)
    || ((view === 'wiki-module' || view === 'wiki-entry') && (overviewLoading || moduleLoading))
    || (view === 'wiki-search' && (overviewLoading || searchLoading))
  );
</script>

<svelte:window onkeydown={onKeydown} />

<div class="wiki-root">
  <WikiLayout
    {view}
    {slug}
    {moduleId}
    {gameName}
    {overview}
    {visibleModules}
    {crumbs}
    {backHref}
    {searchInput}
    {searchPlaceholder}
    {onSearchInput}
    {onSearchSubmit}
    {prefetchModule}
    {isLoading}
    {catalogError}
    {gameError}
    {contentKey}
  >
    {#if view === 'wiki-overview'}
      <WikiOverviewPage {games} {gameHref} />
    {:else if view === 'wiki-search'}
      <WikiSearchPage
        {gameName}
        {routeQuery}
        {searchedEntries}
        {filteredEntries}
        {searchFilters}
        {setSearchFilter}
        {resetSearchFilters}
        {visibleModules}
        {moduleHref}
        {entryHref}
      />
    {:else if view === 'wiki-game' && overview}
      <WikiGamePage
        {overview}
        {visibleModules}
        {moduleHref}
        {prefetchModule}
      />
    {:else if view === 'wiki-module' && activeModule}
      <WikiModulePage
        {activeModule}
        {gameName}
        {entryHref}
      />
    {:else if view === 'wiki-entry'}
      <WikiEntryPage
        {currentEntry}
        {activeModule}
        {currentEntryIndex}
        {moduleEntries}
        {prevEntry}
        {nextEntry}
        {entryHref}
        {slug}
        {moduleId}
      />
    {:else}
      <WikiNotFoundPage />
    {/if}
  </WikiLayout>
</div>
