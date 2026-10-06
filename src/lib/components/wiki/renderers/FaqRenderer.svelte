<script>
  import CircleHelp from '@lucide/svelte/icons/circle-help';
  let { module } = $props();
  let items = $derived(module?.data?.items || []);
</script>

{#if items.length === 0}
  <div class="flex flex-col items-center gap-3 py-12 px-6 w-full text-center">
    <CircleHelp class="size-10 text-fg-3" aria-hidden="true" />
    <p class="text-fg-2 text-sm m-0">Keine FAQ-Einträge vorhanden.</p>
  </div>
{:else}
  <div class="flex flex-col">
    {#each items as item, index (index)}
      {@const isLast = index === items.length - 1}
      <div class="faq-entry py-5 {!isLast ? 'border-b border-line' : ''}">
        <h3 class="font-display font-semibold text-fg text-sm sm:text-base leading-snug m-0 mb-2">
          {item.question}
        </h3>
        <p class="wiki-prose text-sm m-0">{item.answer}</p>
      </div>
    {/each}
  </div>
{/if}
