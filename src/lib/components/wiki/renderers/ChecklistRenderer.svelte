<!-- src/lib/components/wiki/renderers/ChecklistRenderer.svelte -->
<script>
  // @ts-check
  /** @type {{ data: { sections?: Array<{ title: string, items: Array<{ text: string, note?: string }> }>, items?: Array<{ text: string, note?: string }> } }} */
  let { data } = $props();

  const sections = $derived(
    data?.sections
      ? data.sections
      : [{ title: '', items: data?.items ?? [] }]
  );

  /** @type {Set<string>} */
  let checked = $state(new Set());

  /** @param {string} key */
  function toggle(key) {
    const next = new Set(checked);
    next.has(key) ? next.delete(key) : next.add(key);
    checked = next;
  }

  function reset() {
    checked = new Set();
  }
</script>

<div class="checklist">
  {#each sections as section, si}
    {#if section.title}
      <h3 class="checklist-section-title">{section.title}</h3>
    {/if}
    <ul class="checklist-list">
      {#each section.items as item, ii}
        {@const key = `${si}-${ii}`}
        <li class="checklist-item" class:is-checked={checked.has(key)}>
          <button
            type="button"
            class="checklist-check"
            aria-pressed={checked.has(key)}
            onclick={() => toggle(key)}
          >
            <span class="check-box" aria-hidden="true">
              {#if checked.has(key)}✓{/if}
            </span>
            <span class="check-text">{item.text}</span>
          </button>
          {#if item.note}
            <p class="check-note">{item.note}</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/each}

  <button type="button" class="checklist-reset" onclick={reset}>
    Zurücksetzen
  </button>
</div>

<style>
  .checklist { display: flex; flex-direction: column; gap: 1.5rem; }

  .checklist-section-title {
    font-family: var(--font-heading);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }

  .checklist-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; padding: 0; margin: 0; }

  .checklist-item { border-radius: var(--wiki-radius-sm); transition: opacity 140ms ease; }
  .checklist-item.is-checked { opacity: 0.5; }

  .checklist-check {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem;
    text-align: left;
    border-radius: var(--wiki-radius-sm);
    background: var(--color-surface-solid);
    border: 1px solid var(--color-border-glass);
    transition: background-color 140ms ease;
    cursor: pointer;
  }
  .checklist-check:hover { background: var(--wiki-hover); }

  .check-box {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 2px solid var(--color-border-glass);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--color-primary);
    background: var(--color-bg-base);
    margin-top: 2px;
  }

  .check-text { font-size: 0.9rem; color: var(--color-text-primary); line-height: 1.5; }
  .check-note { font-size: 0.75rem; color: var(--color-text-muted); padding: 0.25rem 0.75rem 0.5rem calc(0.75rem + 20px + 0.75rem); }

  .checklist-reset {
    align-self: flex-start;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    padding: 0.5rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--color-border-glass);
    background: transparent;
    cursor: pointer;
  }
  .checklist-reset:hover { color: var(--color-text-primary); border-color: var(--color-text-muted); }

  /* Stufe 2 */
  @media (max-width: 479px) {
    .checklist-check {
      padding: 10px 12px !important;
    }
  }

  /* Stufe 1 */
  @media (max-width: 359px) {
    .checklist-check {
      padding: 8px !important;
    }
  }
</style>