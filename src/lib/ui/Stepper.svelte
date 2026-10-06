<script>
  import Minus from '@lucide/svelte/icons/minus';
  import Plus from '@lucide/svelte/icons/plus';
  /** @type {{ value?: number, min?: number, max?: number, label: string, onchange?: (v: number) => void }} */
  let { value = $bindable(0), min = 0, max = 99, label, onchange } = $props();
  function set(v) { const n = Math.min(max, Math.max(min, v)); if (n !== value) { value = n; onchange?.(n); } }
</script>

<div class="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 p-1" role="group" aria-label={label}>
  <button type="button" class="grid size-10 place-items-center rounded-sm hover:bg-surface disabled:opacity-40"
    aria-label="{label} verringern" disabled={value <= min} onclick={() => set(value - 1)}><Minus class="size-5" aria-hidden="true" /></button>
  <output class="tabular min-w-10 text-center text-lg font-semibold" aria-live="polite">{value}</output>
  <button type="button" class="grid size-10 place-items-center rounded-sm hover:bg-surface disabled:opacity-40"
    aria-label="{label} erhöhen" disabled={value >= max} onclick={() => set(value + 1)}><Plus class="size-5" aria-hidden="true" /></button>
</div>
