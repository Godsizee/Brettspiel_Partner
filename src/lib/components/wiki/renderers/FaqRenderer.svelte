<script>
  let { module } = $props();
  let items = $derived(module?.data?.items || []);
</script>

{#if items.length === 0}
  <div class="flex flex-col items-center gap-3 py-12 px-6 w-full text-center">
    <span class="text-4xl opacity-20">❓</span>
    <p class="text-text-muted text-sm m-0">Keine FAQ-Einträge vorhanden.</p>
  </div>
{:else}
  <div class="flex flex-col">
    {#each items as item, index (index)}
      {@const isLast = index === items.length - 1}
      <div class="faq-entry py-5 {!isLast ? 'border-b border-border-glass' : ''}">
        <h3 class="font-heading font-semibold text-text-primary text-sm sm:text-base leading-snug m-0 mb-2">
          {item.question}
        </h3>
        <p class="wiki-prose text-sm m-0">{item.answer}</p>
      </div>
    {/each}
  </div>
{/if}
