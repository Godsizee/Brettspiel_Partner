<script>
  let { source } = $props();
</script>

{#if source}
  <span class="inline-flex items-center gap-1.5 text-[0.7rem] text-[var(--color-text-muted)] italic leading-none m-0">
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" class="inline-block shrink-0 opacity-70">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </svg>
    <span>Quelle: {source.document}{#if source.page} · S. {source.page}{/if}</span>
  </span>
{/if}

<style>
  /* Base styles */
</style>