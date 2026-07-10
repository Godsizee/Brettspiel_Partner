<!-- src/lib/components/wiki/renderers/ScoringRenderer.svelte -->
<script>
  // @ts-check
  /** @type {{ data: { sections?: Array<{ title: string, timing?: string, items: Array<{ name: string, description?: string, max?: number }> }> } }} */
  let { data } = $props();

  const sections = $derived(data?.sections ?? []);

  const TIMING_LABEL = {
    round: '🔄 Rundenwertung',
    end: '🏁 Schlusswertung',
    income: '💰 Einkommen',
    instant: '⚡ Sofort'
  };
</script>

<div class="scoring">
  {#each sections as section}
    <div class="scoring-section">
      <div class="scoring-section-header">
        <h3 class="scoring-section-title">{section.title}</h3>
        {#if section.timing}
          <span class="scoring-timing-badge">
            {TIMING_LABEL[section.timing] ?? section.timing}
          </span>
        {/if}
      </div>
      <ul class="scoring-list">
        {#each section.items as item}
          <li class="scoring-item">
            <div class="scoring-item-name">{item.name}</div>
            {#if item.description}
              <div class="scoring-item-desc">{item.description}</div>
            {/if}
            {#if item.max != null}
              <div class="scoring-item-max">max. {item.max} Punkte</div>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</div>

<style>
  .scoring { display: flex; flex-direction: column; gap: 2rem; }

  .scoring-section-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .scoring-section-title {
    font-family: var(--font-heading);
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  .scoring-timing-badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: var(--wiki-accent-soft);
    color: var(--color-primary);
    font-weight: 600;
  }

  .scoring-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; padding: 0; margin: 0; }

  .scoring-item {
    padding: 0.75rem 1rem;
    border-radius: var(--wiki-radius-sm);
    background: var(--color-surface-solid);
    border: 1px solid var(--color-border-glass);
  }

  .scoring-item-name { font-size: 0.9rem; font-weight: 600; color: var(--color-text-primary); }
  .scoring-item-desc { font-size: 0.875rem; color: var(--color-text-secondary); margin-top: 0.25rem; line-height: 1.5; }
  .scoring-item-max {
    font-size: 0.75rem;
    color: var(--color-primary);
    margin-top: 0.35rem;
    font-weight: 600;
  }

  /* Stufe 2 */
  @media (max-width: 479px) {
    .scoring-item {
      padding: 10px 12px !important;
    }
  }

  /* Stufe 1 */
  @media (max-width: 359px) {
    .scoring-item {
      padding: 8px !important;
    }
  }
</style>