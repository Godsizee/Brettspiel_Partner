<script>
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  /**
   * @type {{ title: string, subtitle?: string, href?: string, onclick?: () => void, tone?: 'default'|'danger',
   *   chevron?: boolean, leading?: import('svelte').Snippet, trailing?: import('svelte').Snippet, [key: string]: any }}
   */
  let { title, subtitle = '', href = undefined, onclick = undefined, tone = 'default', chevron = undefined, leading, trailing, ...rest } = $props();
  let showChevron = $derived(chevron ?? !!(href || onclick));
  const cls = 'flex w-full min-h-14 items-center gap-3 border-t border-line px-4 py-2 text-left first:border-t-0';
</script>

{#snippet body()}
  {#if leading}<span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-fg-2">{@render leading()}</span>{/if}
  <span class="min-w-0 flex-1">
    <span class={['block font-medium', tone === 'danger' && 'text-danger']}>{title}</span>
    {#if subtitle}<span class="block text-sm text-fg-2">{subtitle}</span>{/if}
  </span>
  {@render trailing?.()}
  {#if showChevron}<ChevronRight class="size-5 text-fg-3" aria-hidden="true" />{/if}
{/snippet}

{#if href}
  <a {href} class={[cls, 'hover:bg-surface-2']} {...rest}>{@render body()}</a>
{:else if onclick}
  <button type="button" {onclick} class={[cls, 'hover:bg-surface-2']} {...rest}>{@render body()}</button>
{:else}
  <div class={cls} {...rest}>{@render body()}</div>
{/if}
