<script>
  // @ts-check
  /**
   * Horizontale Balken als Liste (Text bleibt für Screenreader lesbar, der Balken ist Beiwerk).
   * Breite relativ zu `max`; Farbe je Zeile (Spielerfarbe/Token).
   * @type {{ rows: Array<{ label: string, value: number, text: string, color?: string, bold?: boolean }>, max?: number, labelWidth?: string }}
   */
  let { rows, max = undefined, labelWidth = '6rem' } = $props();
  let top = $derived(max ?? Math.max(...rows.map((r) => r.value), 1));
</script>

<ul class="flex flex-col gap-2.5">
  {#each rows as r}
    <li class="flex items-center gap-2.5 text-sm">
      <span class={['shrink-0 truncate', r.bold && 'font-semibold']} style:width={labelWidth}>{r.label}</span>
      <span class="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <span class="block h-full rounded-full" style:width="{Math.max(0, Math.min(100, (r.value / top) * 100))}%" style:background={r.color ?? 'var(--accent)'}></span>
      </span>
      <span class="tabular w-20 shrink-0 text-right font-semibold">{r.text}</span>
    </li>
  {/each}
</ul>
