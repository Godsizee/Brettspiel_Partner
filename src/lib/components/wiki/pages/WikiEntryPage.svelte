<script>
  // @ts-check
  import WikiEntryPageInner from '$lib/components/wiki/WikiEntryPage.svelte';
  import { wikiHash } from '$lib/components/wiki/utils/wikiRoutes.js';

  /**
   * @type {{
   *   currentEntry: any,
   *   activeModule: any,
   *   currentEntryIndex: number,
   *   moduleEntries: any[],
   *   prevEntry: any,
   *   nextEntry: any,
   *   entryHref: (e: any) => string,
   *   slug: string | null,
   *   moduleId: string | null
   * }}
   */
  let {
    currentEntry, activeModule, currentEntryIndex, moduleEntries,
    prevEntry, nextEntry, entryHref, slug, moduleId
  } = $props();
</script>

{#if currentEntry}
  <WikiEntryPageInner
    entry={currentEntry}
    moduleTitle={activeModule?.title ?? ''}
    position={currentEntryIndex + 1}
    total={moduleEntries.length}
    prevHref={prevEntry ? entryHref(prevEntry) : null}
    prevName={prevEntry?.name ?? ''}
    nextHref={nextEntry ? entryHref(nextEntry) : null}
    nextName={nextEntry?.name ?? ''}
  />
{:else}
  <div class="wiki-card p-6 flex flex-col gap-4 items-start max-w-[480px]">
    <p class="m-0 text-[var(--color-text-primary)] font-medium">⚠ Eintrag nicht gefunden.</p>
    {#if slug && moduleId}
      <a class="wiki-nav-item is-active justify-center w-auto px-4" href={wikiHash.module(slug, moduleId)}>
        Zum Bereich „{activeModule?.title ?? moduleId}“
      </a>
    {/if}
  </div>
{/if}
