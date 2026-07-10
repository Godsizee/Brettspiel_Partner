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

<div class="flex flex-col gap-4 w-full">
  {#each entries as entry (entry.id)}
    <section class="wiki-card p-5 sm:p-6 flex flex-col gap-5">
      <a href={entryHref(entry)} class="flex items-center gap-5 no-underline group">
        {#if entry.image}
          <img src={entry.image} alt="" loading="lazy" class="w-20 h-20 object-contain shrink-0" />
        {/if}
        <h2 class="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] m-0 group-hover:text-primary transition-colors">
          {entry.name}
        </h2>
      </a>
    </section>
  {/each}
</div>

