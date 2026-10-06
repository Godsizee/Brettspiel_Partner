<script>
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';

  /**
   * @type {{ variant?: 'primary'|'secondary'|'ghost'|'danger'|'danger-ghost', size?: 'md'|'lg', block?: boolean,
   *   loading?: boolean, href?: string, type?: 'button'|'submit', disabled?: boolean, class?: any,
   *   children?: import('svelte').Snippet, [key: string]: any }}
   */
  let { variant = 'secondary', size = 'md', block = false, loading = false, href = undefined, type = 'button',
    disabled = false, class: extra = '', children, ...rest } = $props();

  const VARIANTS = {
    primary: 'bg-accent text-on-accent hover:bg-accent-hover',
    secondary: 'bg-surface text-fg border border-line-strong hover:bg-surface-2',
    ghost: 'bg-transparent text-fg hover:bg-surface-2',
    danger: 'bg-danger text-on-danger hover:opacity-90',
    'danger-ghost': 'bg-transparent text-danger hover:bg-danger-soft',
  };
  const SIZES = { md: 'min-h-11 px-4 text-[0.9375rem]', lg: 'min-h-13 px-5 text-base' };

  let classes = $derived([
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold leading-none select-none',
    'transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant], SIZES[size], block && 'w-full', extra,
  ]);
</script>

{#if href}
  <a {href} class={classes} {...rest}>{@render children?.()}</a>
{:else}
  <button {type} class={classes} disabled={disabled || loading} aria-busy={loading ? 'true' : undefined} {...rest}>
    {#if loading}<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />{/if}
    {@render children?.()}
  </button>
{/if}
