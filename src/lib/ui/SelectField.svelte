<script>
  // @ts-check
  /**
   * Natives <select> im Field-Stil (Plattform-Auswahl statt eigenem Dropdown: Tastatur, Screenreader, mobile Picker gratis).
   * @type {{ label: string, value?: string|number, options: Array<{ value: string|number, label: string, disabled?: boolean }>,
   *   hideLabel?: boolean, onchange?: (v: string) => void, [key: string]: any }}
   */
  let { label, value = $bindable(''), options, hideLabel = false, onchange, ...rest } = $props();
  const uid = $props.id();
</script>

<div class="flex min-w-0 flex-col gap-1.5">
  <label for="{uid}-s" class={['text-sm font-semibold', hideLabel && 'sr-only']}>{label}</label>
  <select id="{uid}-s" bind:value onchange={(e) => onchange?.(e.currentTarget.value)}
    class="h-11 w-full min-w-0 rounded-md border border-field-line bg-surface-2 px-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/30" {...rest}>
    {#each options as o (o.value)}<option value={o.value} disabled={o.disabled}>{o.label}</option>{/each}
  </select>
</div>
