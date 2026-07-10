<script>
  // @ts-check
  import WikiFilterBar from '$lib/components/wiki/WikiFilterBar.svelte';
  import WikiEntryBrowser from '$lib/components/wiki/WikiEntryBrowser.svelte';

  /**
   * @type {{
   *   gameName: string,
   *   routeQuery: string,
   *   searchedEntries: any[],
   *   filteredEntries: any[],
   *   searchFilters: any,
   *   setSearchFilter: (k: string, v: string|null) => void,
   *   resetSearchFilters: () => void,
   *   visibleModules: any[],
   *   moduleHref: (m: any) => string,
   *   entryHref: (e: any) => string
   * }}
   */
  let {
    gameName, routeQuery, searchedEntries, filteredEntries, searchFilters,
    setSearchFilter, resetSearchFilters, visibleModules, moduleHref, entryHref
  } = $props();
</script>

<div class="flex flex-col gap-5">
  <h1 tabindex="-1" class="sr-only">Suche in {gameName}</h1>
  <WikiFilterBar
    entries={searchedEntries}
    filters={searchFilters}
    onChange={setSearchFilter}
    onReset={resetSearchFilters}
  />
  <span class="wiki-eyebrow" role="status" aria-live="polite">
    {filteredEntries.length} {filteredEntries.length === 1 ? 'Ergebnis' : 'Ergebnisse'}
  </span>
  {#if filteredEntries.length === 0}
    <div class="flex flex-col items-center gap-4 py-10 px-6 w-full text-center">
      <span class="text-4xl opacity-20" aria-hidden="true">🔍</span>
      <p class="text-text-muted text-sm m-0 max-w-[42ch]">
        Keine Treffer{routeQuery ? ` für „${routeQuery}“` : ''}.
        Prüfe die Schreibweise oder stöbere direkt in den Bereichen:
      </p>
      <div class="flex flex-wrap justify-center gap-2 max-w-[560px]">
        {#each visibleModules as mod (mod.id)}
          <a class="wiki-chipnav-item" href={moduleHref(mod)}>{mod.title}</a>
        {/each}
      </div>
    </div>
  {:else}
    <WikiEntryBrowser entries={filteredEntries} {entryHref} highlight={routeQuery} />
  {/if}
</div>
