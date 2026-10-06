<script>
  import { onColor, safeCssColor } from './color.js';
  /** @type {{ color?: string|null, name?: string, size?: 'sm'|'md' }} */
  let { color = null, name = '', size = 'sm' } = $props();
  let bg = $derived(safeCssColor(color, 'var(--text-3)'));
</script>
{#if size === 'sm'}
  <span class="inline-block size-2.5 shrink-0 rounded-full" style:background={bg} aria-hidden="true"></span>
{:else}
  <span class="grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold" style:background={bg} style:color={onColor(bg)} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
{/if}
