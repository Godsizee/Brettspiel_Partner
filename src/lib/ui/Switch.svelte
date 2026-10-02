<script>
  /** @type {{ checked?: boolean, label: string, description?: string, disabled?: boolean, onchange?: (v: boolean) => void }} */
  let { checked = $bindable(false), label, description = '', disabled = false, onchange } = $props();
  const uid = $props.id();
  function toggle() { checked = !checked; onchange?.(checked); }
</script>

<div class="flex min-h-14 items-center gap-4 py-2">
  <div class="min-w-0 flex-1">
    <span id="{uid}-l" class="font-medium">{label}</span>
    {#if description}<p id="{uid}-d" class="text-sm text-fg-2">{description}</p>{/if}
  </div>
  <button type="button" role="switch" aria-checked={checked} aria-labelledby="{uid}-l"
    aria-describedby={description ? `${uid}-d` : undefined} {disabled} onclick={toggle}
    class={['relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50', checked ? 'bg-accent' : 'bg-line-strong']}>
    <!-- Knopf bewusst in beiden Themes weiß (wie Style-Tile) — einzige feste Farbe der Bausteine -->
    <span class={['absolute top-[3px] size-[22px] rounded-full bg-white shadow-1 transition-[left] duration-150', checked ? 'left-[23px]' : 'left-[3px]']}></span>
  </button>
</div>
