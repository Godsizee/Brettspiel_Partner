<script>
  // @ts-check
  /**
   * Vollwertige Eintragsseite (P1.1) — ersetzt das frühere WikiDetailSheet.
   * Kein Overlay: eigene Route, eigener Titel, Vor/Zurück-Blättern im Modul.
   */
  import WikiEntryDetail from '$lib/components/wiki/WikiEntryDetail.svelte';

  /**
   * @type {{
   *   entry: any,
   *   moduleTitle?: string,
   *   position?: number,
   *   total?: number,
   *   prevHref?: string | null,
   *   prevName?: string,
   *   nextHref?: string | null,
   *   nextName?: string
   * }}
   */
  let {
    entry,
    moduleTitle = '',
    position = 0,
    total = 0,
    prevHref = null,
    prevName = '',
    nextHref = null,
    nextName = ''
  } = $props();

  const meta = $derived(
    [entry?.category, ...(entry?.timing || [])].filter(Boolean).join(' · ')
  );
</script>

<article class="wiki-entry-page">
  <header class="mb-6">
    {#if meta || (total > 1)}
      <div class="flex items-baseline justify-between gap-3 flex-wrap mb-1.5">
        {#if meta}
          <span class="wiki-eyebrow">{meta}</span>
        {/if}
        {#if total > 1}
          <span class="wiki-eyebrow" aria-label="Eintrag {position} von {total} in {moduleTitle}">
            {position} / {total}
          </span>
        {/if}
      </div>
    {/if}
    <h1 tabindex="-1" class="wiki-page-title">{entry.name}</h1>
  </header>

  <WikiEntryDetail {entry} />

  {#if prevHref || nextHref}
    <nav class="wiki-pager" aria-label="Blättern in {moduleTitle}">
      {#if prevHref}
        <a class="wiki-pager-link" href={prevHref} rel="prev">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span class="wiki-pager-text">
            <span class="wiki-pager-label">Vorheriger</span>
            <span class="wiki-pager-name">{prevName}</span>
          </span>
        </a>
      {:else}
        <span></span>
      {/if}
      {#if nextHref}
        <a class="wiki-pager-link wiki-pager-link--next" href={nextHref} rel="next">
          <span class="wiki-pager-text">
            <span class="wiki-pager-label">Nächster</span>
            <span class="wiki-pager-name">{nextName}</span>
          </span>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </a>
      {/if}
    </nav>
  {/if}
</article>

<style>
  .wiki-entry-page {
    max-width: var(--wiki-measure);
  }

  .wiki-pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-top: 2.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--color-border-glass);
  }

  .wiki-pager-link {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    min-height: 44px;
    padding: 0.6rem 0.9rem;
    border: 1px solid var(--color-border-glass);
    border-radius: var(--wiki-radius-sm);
    color: var(--color-text-secondary);
    text-decoration: none;
    min-width: 0;
    transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;
  }
  .wiki-pager-link:hover {
    background: var(--wiki-hover);
    border-color: var(--wiki-accent-line);
    color: var(--color-text-primary);
  }
  .wiki-pager-link--next {
    justify-content: flex-end;
    text-align: right;
  }

  .wiki-pager-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .wiki-pager-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }
  .wiki-pager-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Kleinstgeräte: untereinander statt gequetscht (P3.3) */
  @media (max-width: 359px) {
    .wiki-pager {
      grid-template-columns: 1fr;
    }
    .wiki-pager-link--next { justify-content: space-between; }
  }
</style>
