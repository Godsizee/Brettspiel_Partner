<script>
  // @ts-check
  /** @type {{ module: any, entryHref?: (e: any) => string }} */
  let { module, entryHref = () => '#/wiki' } = $props();

  let entries = $derived(
    Array.isArray(module?.data)
      ? module.data
      : Array.isArray(module?.data?.entries)
        ? module.data.entries
        : []
  );
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full">
  {#each entries as entry}
    <a href={entryHref(entry)} class="wiki-card wiki-card-hover flex flex-col items-center p-3 text-center gap-2">
      {#if entry.image}
        <img src={entry.image} alt={entry.name} loading="lazy" class="w-12 h-12 object-contain" />
      {/if}
      <span class="text-sm font-medium text-[var(--color-text-primary)]">{entry.name}</span>
    </a>
  {/each}
</div>
