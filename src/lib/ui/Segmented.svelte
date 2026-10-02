<script>
  /**
   * @type {{ value: string, options: Array<{ value: string, label: string, count?: number }>, label: string,
   *   variant?: 'segmented'|'chips', onchange?: (v: string) => void }}
   */
  let { value = $bindable(), options, label, variant = 'segmented', onchange } = $props();
  /** @type {HTMLDivElement | undefined} */
  let group = $state();
  function select(v) { if (v !== value) { value = v; onchange?.(v); } }
  function onKey(/** @type {KeyboardEvent} */ e, i) {
    const d = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    select(options[n].value);
    /** @type {HTMLElement | undefined} */ (group?.children[n])?.focus();
  }
</script>

<div bind:this={group} role="radiogroup" aria-label={label}
  class={variant === 'chips' ? 'flex gap-2 overflow-x-auto' : 'flex gap-0.5 rounded-md border border-line bg-surface-2 p-[3px]'}>
  {#each options as o, i (o.value)}
    {@const on = value === o.value}
    <button type="button" role="radio" aria-checked={on} tabindex={on ? 0 : -1}
      onclick={() => select(o.value)} onkeydown={(e) => onKey(e, i)}
      class={variant === 'chips'
        ? ['inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap', on ? 'border-fg bg-fg text-canvas' : 'border-line bg-surface-2 text-fg-2']
        : ['h-9 flex-1 rounded-[9px] px-3 text-sm font-semibold', on ? 'bg-surface text-fg shadow-1' : 'text-fg-2']}>
      {o.label}{#if o.count != null}<span class="tabular opacity-70">{o.count}</span>{/if}
    </button>
  {/each}
</div>
