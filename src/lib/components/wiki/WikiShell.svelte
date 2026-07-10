<script>
  // @ts-check
  import WikiBreadcrumbs from '$lib/components/wiki/WikiBreadcrumbs.svelte';
  import WikiSearch from '$lib/components/wiki/WikiSearch.svelte';

  /**
   * Seitenrahmen des Wikis: sticky Header mit Zurück-Link ("hoch" zur
   * Elternroute), Breadcrumbs, optionaler Suche und optionaler Subnavigation
   * (Modul-Chips). Kein Schließen-Button mehr — das Wiki ist eine normale
   * Seite und wird über App-Navigation/Browser-Zurück verlassen (P0.3/E4).
   *
   * @type {{
   *   crumbs?: Array<{ label: string, href?: string }>,
   *   backHref?: string | null,
   *   searchEnabled?: boolean,
   *   query?: string,
   *   placeholder?: string,
   *   onSearch?: (value: string) => void,
   *   onSearchSubmit?: (value: string) => void,
   *   subnav?: import('svelte').Snippet,
   *   children: import('svelte').Snippet
   * }}
   */
  let {
    crumbs = [],
    backHref = null,
    searchEnabled = false,
    query = '',
    placeholder = 'Suchen …',
    onSearch = () => {},
    onSearchSubmit = () => {},
    subnav,
    children
  } = $props();
</script>

<section class="flex flex-col w-full min-h-full">
  <header class="wiki-header sticky z-20" style="top: var(--app-header-height, 0)">
    <div class="wiki-pad flex items-center gap-2 min-w-0 pt-3.5 pb-3">
      {#if backHref}
        <a class="wiki-icon-btn -ml-1.5" href={backHref} aria-label="Eine Ebene hoch">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </a>
      {/if}
      <WikiBreadcrumbs {crumbs} />
    </div>

    {#if searchEnabled}
      <div class="wiki-pad pb-3 pt-0.5">
        <WikiSearch value={query} {placeholder} onInput={onSearch} onSubmit={onSearchSubmit} />
      </div>
    {/if}

    {#if subnav}
      {@render subnav()}
    {/if}
  </header>

  <div class="wiki-body wiki-pad w-full">
    {@render children()}
  </div>
</section>

<style>
  .wiki-body {
    padding-top: 2rem;
    padding-bottom: 2.5rem;
  }
  @media (min-width: 768px) {
    .wiki-body { padding-top: 2.75rem; padding-bottom: 3rem; }
  }
  .wiki-header {
    background: color-mix(in srgb, var(--color-bg-base) 88%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--color-border-glass);
  }
</style>
