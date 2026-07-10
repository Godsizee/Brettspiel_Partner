<script>
  // @ts-check
  import { collectFilterOptions } from '$lib/components/wiki/utils/wikiFilters.js';

  /**
   * Kontrollierte Filterleiste (P4.2): Der Filterzustand lebt in der URL —
   * die Leiste rendert ihn nur und meldet Änderungen nach oben.
   *
   * @type {{
   *   entries: any[],
   *   filters: { category?: string|null, timing?: string|null, edition?: string|null, expansion?: string|null },
   *   onChange: (key: string, value: string|null) => void,
   *   onReset: () => void
   * }}
   */
  const { entries, filters, onChange, onReset } = $props();

  const options = $derived(collectFilterOptions(entries));

  /** @param {string} key @param {string} value */
  function set(key, value) {
    onChange(key, value === 'all' ? null : value);
  }

  const hasActiveFilter = $derived(
    !!(filters.category || filters.timing || filters.edition || filters.expansion)
  );
</script>

{#snippet selectField(id, label, key, list)}
  <div class="flex flex-col gap-1.5 min-w-32.5">
    <label class="wiki-eyebrow" for={id}>{label}</label>
    <div class="relative">
      <select
        {id}
        class="wiki-input wiki-filter-select pl-3.5 pr-8 text-sm cursor-pointer appearance-none"
        value={filters[/** @type {keyof typeof filters} */ (key)] ?? 'all'}
        onchange={(e) => set(key, /** @type {HTMLSelectElement} */ (e.target).value)}
      >
        {#each list as opt}
          <option value={opt} style="background: var(--color-surface-solid); color: var(--color-text-primary)">{opt === 'all' ? 'Alle' : opt}</option>
        {/each}
      </select>
      <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted flex items-center">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </div>
  </div>
{/snippet}

<div class="flex flex-wrap items-end gap-3 w-full">
  {#if options.categories.length > 1}
    {@render selectField('wiki-filter-category', 'Kategorie', 'category', options.categories)}
  {/if}
  {#if options.timings.length > 1}
    {@render selectField('wiki-filter-timing', 'Zeitpunkt', 'timing', options.timings)}
  {/if}
  {#if options.editions && options.editions.length > 1}
    {@render selectField('wiki-filter-edition', 'Edition', 'edition', options.editions)}
  {/if}
  {#if options.expansions && options.expansions.length > 1}
    {@render selectField('wiki-filter-expansion', 'Erweiterung', 'expansion', options.expansions)}
  {/if}

  {#if hasActiveFilter}
    <button
      class="wiki-nav-item is-active wiki-filter-reset w-auto px-4 self-end shrink-0"
      type="button"
      onclick={onReset}
      aria-label="Filter zurücksetzen"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
      Zurücksetzen
    </button>
  {/if}
</div>

<style>
  /* Touch-Ziele ≥ 44 px auf Touch-Geräten, kompakter mit Maus (P4.2/P3.3) */
  .wiki-filter-select,
  .wiki-filter-reset {
    height: 2.5rem;
  }
  @media (pointer: coarse) {
    .wiki-filter-select,
    .wiki-filter-reset {
      height: 2.75rem;
    }
  }
</style>
