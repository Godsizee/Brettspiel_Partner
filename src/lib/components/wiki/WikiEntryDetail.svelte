<script>
  import WikiSourceNotice from '$lib/components/wiki/WikiSourceNotice.svelte';
  import { openLightbox } from '$lib/components/wiki/wikiLightboxStore.svelte.js';
  import { formatWikiMarkdown, sanitizeWikiHtml } from '$lib/utils/formatWikiMarkdown.js';

  // Reiner Inhalt – die Kopfzeile (Meta + Titel) liefert die umgebende WikiEntryPage.
  let { entry = null } = $props();
</script>

{#if entry}
  <div class="flex flex-col gap-5">
    {#if entry.image}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="wiki-card flex items-center justify-center p-3 cursor-zoom-in"
        onclick={() => openLightbox(entry.image, entry.name)}
      >
        <img src={entry.image} alt={entry.name} loading="lazy" decoding="async" class="max-w-full max-h-72 w-auto h-auto object-contain select-none" />
      </div>
    {/if}

    {#if entry.summary}
      <div class="flex flex-col gap-1.5">
        <span class="wiki-eyebrow">Kurz erklärt</span>
        <div class="wiki-prose text-sm text-text-primary leading-relaxed">
          {#if entry.isHtml}
            {@html sanitizeWikiHtml(entry.summary)}
          {:else}
            {@html formatWikiMarkdown(entry.summary)}
          {/if}
        </div>
      </div>
    {/if}

    {#if entry.description || entry.details}
      <div class="flex flex-col gap-1.5 border-t border-border-glass pt-4">
        <span class="wiki-eyebrow">Regeln &amp; Details</span>
        <p class="text-sm text-text-secondary leading-relaxed m-0 whitespace-pre-line">{entry.description || entry.details}</p>
      </div>
    {/if}

    {#if entry.warnings && entry.warnings.length}
      <div class="flex flex-col gap-2 border-t border-border-glass pt-4">
        <span class="wiki-eyebrow" style="color: var(--color-danger)">Wichtige Hinweise</span>
        <ul class="text-sm text-text-secondary leading-relaxed m-0 pl-4 list-disc flex flex-col gap-1">
          {#each entry.warnings as w}
            <li>{w}</li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if entry.source}
      <div class="border-t border-border-glass pt-4">
        <WikiSourceNotice source={entry.source} />
      </div>
    {/if}
  </div>
{/if}
