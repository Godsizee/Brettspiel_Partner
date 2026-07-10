<!-- src/lib/components/wiki/WikiBreadcrumbs.svelte -->
<script>
  // @ts-check
  /**
   * Semantische Brotkrumen (P1.3): echte Links, aria-current auf der aktuellen
   * Seite. Auf Kleinstgeräten (< 360 px) wird nur die aktuelle Seite gezeigt —
   * die "Hoch"-Navigation übernimmt dort der Zurück-Pfeil im Header.
   *
   * @type {{
   *   crumbs: Array<{ label: string, href?: string }>
   * }}
   */
  let { crumbs } = $props();
</script>

<nav class="wiki-crumbs py-1 min-w-0" aria-label="Brotkrumen">
  <ol class="flex flex-wrap items-center list-none p-0 m-0 min-w-0">
    {#each crumbs as crumb, i}
      {@const isLast = i === crumbs.length - 1}
      <li class="flex items-center min-w-0 {isLast ? 'crumb-current' : 'crumb-ancestor'}">
        {#if crumb.href && !isLast}
          <a
            class="text-xs text-primary hover:text-primary-hover font-semibold transition-colors hover:underline underline-offset-2 truncate"
            href={crumb.href}
          >
            {crumb.label}
          </a>
        {:else}
          <span
            class="text-xs font-semibold truncate max-w-[48vw] sm:max-w-none {isLast ? 'text-text-primary' : 'text-text-muted'}"
            aria-current={isLast ? 'page' : undefined}
          >
            {crumb.label}
          </span>
        {/if}
        {#if !isLast}
          <span class="crumb-sep text-xs text-text-muted/40 mx-2 select-none" aria-hidden="true">/</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  /* < 360 px: nur die aktuelle Ebene zeigen (P1.3/P3.3) */
  @media (max-width: 359px) {
    .wiki-crumbs .crumb-ancestor { display: none; }
    .wiki-crumbs .crumb-current { max-width: 100%; }
  }
</style>
