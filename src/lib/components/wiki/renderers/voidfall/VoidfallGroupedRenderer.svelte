<script>
  // @ts-check
  import WikiEntryBrowser from '$lib/components/wiki/WikiEntryBrowser.svelte';
  import { formatWikiMarkdown } from '$lib/utils/formatWikiMarkdown.js';
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

  /** @type {Array<{id: string, title: string, description?: string, order?: number}>} */
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
    const byGroup = new Map(groupDefs.map((g) => [g.id, []]));
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

  let hasGroups = $derived(groupDefs.length > 0);
</script>

<div class="flex flex-col gap-6 w-full">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    {#if hasGroups}
      <nav class="wiki-chipnav border-t-0 -mx-(--wiki-pad-x) sm:mx-0 order-2 sm:order-1" aria-label="Gruppen">
        <div class="wiki-chipnav-track sm:px-0">
          {#each sections as section (section.id)}
            <a class="wiki-chipnav-item" href="#group-{section.id}">{section.title}</a>
          {/each}
        </div>
      </nav>
    {/if}
    <div class="relative order-1 sm:order-2 sm:w-64 shrink-0">
      <input
        type="search"
        class="wiki-input pl-3.5!"
        placeholder="In dieser Liste filtern …"
        value={filterQuery}
        oninput={(e) => { filterQuery = /** @type {HTMLInputElement} */ (e.target).value; }}
        aria-label="Einträge in dieser Liste filtern"
      />
    </div>
  </div>

  {#if hasGroups}
    {#each sections as section (section.id)}
      <section id="group-{section.id}" class="flex flex-col gap-3" style="scroll-margin-top: 5rem">
        <div class="flex flex-col gap-1">
          <h2 class="text-lg font-bold text-text-primary m-0">{section.title}</h2>
          {#if section.description}
            <div class="wiki-prose text-sm">
              {@html formatWikiMarkdown(section.description)}
            </div>
          {/if}
        </div>
        <WikiEntryBrowser entries={section.entries} {entryHref} highlight={filterQuery} />
      </section>
    {/each}
    {#if sections.length === 0}
      <div class="flex flex-col items-center gap-3 py-14 px-6 w-full text-center">
        <span class="text-4xl opacity-20">🔍</span>
        <p class="text-text-muted text-sm m-0">Keine passenden Einträge gefunden.</p>
      </div>
    {/if}
  {:else}
    <WikiEntryBrowser entries={filteredEntries} {entryHref} highlight={filterQuery} />
  {/if}
</div>
