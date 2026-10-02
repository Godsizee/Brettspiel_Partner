<script>
  /**
   * @type {{ label: string, variant?: 'plain'|'outline'|'overlay', href?: string, pressed?: boolean,
   *   class?: any, children: import('svelte').Snippet, [key: string]: any }}
   */
  let { label, variant = 'plain', href = undefined, pressed = undefined, class: extra = '', children, ...rest } = $props();
  const VARIANTS = {
    plain: 'text-fg hover:bg-surface-2',
    outline: 'text-fg border border-line-strong hover:bg-surface-2',
    overlay: 'text-fg bg-surface/90 shadow-1 hover:bg-surface',
  };
  let classes = $derived(['inline-grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-150 disabled:opacity-40', VARIANTS[variant], extra]);
</script>

{#if href}
  <a {href} class={classes} aria-label={label} title={label} {...rest}>{@render children()}</a>
{:else}
  <button type="button" class={classes} aria-label={label} title={label} aria-pressed={pressed} {...rest}>{@render children()}</button>
{/if}
