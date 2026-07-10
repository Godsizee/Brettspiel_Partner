<script>
  // @ts-check
  import WikiEntryBrowser from '$lib/components/wiki/WikiEntryBrowser.svelte';

  /** @type {{ module: any, entryHref?: (e: any) => string }} */
  let { module, entryHref = () => '#/wiki' } = $props();

  let entries = $derived(
    Array.isArray(module?.data)
      ? module.data
      : Array.isArray(module?.data?.entries)
        ? module.data.entries
        : []
  );

  let groupedEntries = $derived.by(() => {
    const groups = {
      'Gewöhnliche Fokusse': [],
      'Hausfokusse': [],
      'Gemeinsame Fokusse': [],
      'Heroische Fokusse': []
    };

    for (const e of entries) {
      const id = String(e.id);
      if (id.includes('-gemeinsame-') || id.includes('-gemeinsamer-')) {
        groups['Gemeinsame Fokusse'].push(e);
      } else if (id.includes('-heroische-') || id.includes('-heroischer-')) {
        groups['Heroische Fokusse'].push(e);
      } else {
        const parts = id.split('-');
        if (parts.length > 2) {
          groups['Hausfokusse'].push(e);
        } else {
          groups['Gewöhnliche Fokusse'].push(e);
        }
      }
    }
    return groups;
  });
</script>

<div class="flex flex-col gap-8 w-full">
  {#each Object.entries(groupedEntries) as [groupName, groupEntries]}
    {#if groupEntries.length > 0}
      <section>
        <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-4">{groupName}</h2>
        <WikiEntryBrowser entries={groupEntries} {entryHref} />
      </section>
    {/if}
  {/each}
</div>
