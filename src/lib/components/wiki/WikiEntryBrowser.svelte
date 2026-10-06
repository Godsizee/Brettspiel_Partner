<script>
  // @ts-check
  import Search from '@lucide/svelte/icons/search';
  import WikiEntryCard from '$lib/components/wiki/WikiEntryCard.svelte';

  /** @type {{ entries?: any[], entryHref: (e: any) => string, highlight?: string }} */
  let { entries = [], entryHref, highlight = '' } = $props();

  let visibleCount = $state(50);

  $effect(() => {
    visibleCount = 50;
    entries;
  });

  let visibleEntries = $derived(entries.slice(0, visibleCount));
  let hasMore = $derived(visibleCount < entries.length);

  function loadMore() {
    visibleCount += 50;
  }
</script>

{#if entries.length === 0}
  <div class="flex flex-col items-center gap-3 py-14 px-6 w-full text-center">
    <Search class="size-10 text-fg-3" aria-hidden="true" />
    <p class="text-fg-2 text-sm m-0">Keine passenden Einträge gefunden.</p>
  </div>
{:else}
  <div class="wiki-content grid grid-cols-1 md:grid-cols-2 gap-2.5">
    {#each visibleEntries as entry (entry.id)}
      <WikiEntryCard {entry} href={entryHref(entry)} {highlight} />
    {/each}
  </div>
  {#if hasMore}
    <button class="wiki-nav-item justify-center mt-3 border border-line" type="button" onclick={loadMore}>
      Weitere {Math.min(50, entries.length - visibleCount)} Einträge laden
    </button>
  {/if}
{/if}
