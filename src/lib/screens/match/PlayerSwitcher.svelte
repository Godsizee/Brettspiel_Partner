<script>
  // @ts-check
  import PlayerDot from '$lib/ui/PlayerDot.svelte';

  /**
   * @type {{ players: Array<{ name: string, color: string|null }>, totals: number[], active: number, onselect: (i: number) => void }}
   */
  let { players, totals, active, onselect } = $props();
  /** @type {HTMLDivElement | undefined} */
  let list = $state();

  function onKey(/** @type {KeyboardEvent} */ e, /** @type {number} */ i) {
    const d = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + players.length) % players.length;
    onselect(n);
    /** @type {HTMLElement | undefined} */ (list?.children[n])?.focus();
  }
</script>

<div bind:this={list} role="tablist" aria-label="Spieler" class="flex gap-2 overflow-x-auto py-2">
  {#each players as p, i}
    {@const on = i === active}
    <button type="button" role="tab" aria-selected={on} tabindex={on ? 0 : -1} onclick={() => onselect(i)} onkeydown={(e) => onKey(e, i)}
      class={['inline-flex h-11 shrink-0 items-center gap-2 rounded-full border bg-surface pl-2 pr-3.5 text-sm font-semibold', on ? 'border-fg' : 'border-line text-fg-2']}>
      <PlayerDot size="md" name={p.name} color={p.color} />
      <span class="max-w-28 truncate">{p.name}</span>
      <span class="tabular rounded-full bg-surface-2 px-2 py-0.5 text-xs text-fg">{totals[i] ?? 0}</span>
    </button>
  {/each}
</div>
