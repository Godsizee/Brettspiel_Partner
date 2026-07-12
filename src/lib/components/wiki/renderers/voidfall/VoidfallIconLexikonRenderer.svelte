<script>
  // @ts-check
  import { searchEntries } from '$lib/components/wiki/utils/wikiSearch.js';

  /** @type {{ module: any, entryHref?: (e: any) => string }} */
  let { module, entryHref = () => '#/wiki' } = $props();

  let entries = $derived(
    Array.isArray(module?.data)
      ? module.data
      : Array.isArray(module?.data?.entries)
        ? module.data.entries
        : []
  );

  /** @type {Array<{id: string, title: string, order?: number}>} */
  let groupDefs = $derived(
    Array.isArray(module?.data?.groups)
      ? [...module.data.groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : []
  );

  let filterQuery = $state('');
  let filteredEntries = $derived(
    filterQuery.trim() ? searchEntries(entries, filterQuery) : entries
  );

  let sections = $derived.by(() => {
    if (groupDefs.length === 0) return [];
    const byGroup = new Map(groupDefs.map((g) => [g.id, /** @type {any[]} */ ([])]));
    const rest = [];
    for (const entry of filteredEntries) {
      const bucket = entry.group && byGroup.has(entry.group) ? byGroup.get(entry.group) : rest;
      bucket.push(entry);
    }
    const named = groupDefs
      .map((g) => ({ ...g, entries: byGroup.get(g.id) ?? [] }))
      .filter((s) => s.entries.length > 0);
    return rest.length > 0 ? [...named, { id: '__rest', title: 'Weitere', entries: rest }] : named;
  });
</script>

{#snippet tile(entry)}
  <a href={entryHref(entry)} class="wiki-card wiki-card-hover flex flex-col items-center p-3 text-center gap-2">
    {#if entry.image}
      <img src={entry.image} alt={entry.name} loading="lazy" class="w-12 h-12 object-contain" />
    {/if}
    <span class="text-sm font-medium text-text-primary">{entry.name}</span>
  </a>
{/snippet}

<div class="flex flex-col gap-6 w-full">
  <input
    type="search"
    class="wiki-input pl-3.5! sm:w-64"
    placeholder="Icon suchen …"
    value={filterQuery}
    oninput={(e) => { filterQuery = /** @type {HTMLInputElement} */ (e.target).value; }}
    aria-label="Icons filtern"
  />

  {#if groupDefs.length > 0}
    {#each sections as section (section.id)}
      <section class="flex flex-col gap-3">
        <h2 class="text-lg font-bold text-text-primary m-0">{section.title}</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full">
          {#each section.entries as entry}
            {@render tile(entry)}
          {/each}
        </div>
      </section>
    {/each}
    {#if sections.length === 0}
      <div class="flex flex-col items-center gap-3 py-14 px-6 w-full text-center">
        <span class="text-4xl opacity-20">🔍</span>
        <p class="text-text-muted text-sm m-0">Keine passenden Icons gefunden.</p>
      </div>
    {/if}
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full">
      {#each filteredEntries as entry}
        {@render tile(entry)}
      {/each}
    </div>
  {/if}
</div>
