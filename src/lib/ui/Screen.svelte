<script>
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import IconButton from './IconButton.svelte';
  /**
   * @type {{ title: string, subtitle?: string, back?: string, wide?: boolean, hideTitle?: boolean,
   *   hero?: import('svelte').Snippet, actions?: import('svelte').Snippet, dock?: import('svelte').Snippet,
   *   children: import('svelte').Snippet }}
   * `hero` ersetzt die Kopfzeile (randlos); es enthält dann selbst das h1 mit data-screen-title.
   */
  let { title, subtitle = '', back = undefined, wide = false, hideTitle = false, hero, actions, dock, children } = $props();
</script>

<div class={['screen', wide && 'screen--wide']}>
  {#if hero}
    <div class="-mx-4 sm:-mx-6">{@render hero()}</div>
  {:else if back}
    <header class="sticky top-0 z-20 -mx-4 flex h-14 items-center gap-1 bg-canvas/95 px-2 sm:-mx-6">
      <IconButton label="Zurück" href={back}><ChevronLeft class="size-6" aria-hidden="true" /></IconButton>
      <h1 tabindex="-1" data-screen-title class="flex-1 truncate text-center text-base font-semibold">{title}</h1>
      <div class="flex min-w-11 items-center justify-end gap-1">{@render actions?.()}</div>
    </header>
  {:else}
    <header class="flex items-end justify-between gap-3 pb-3 pt-5">
      <div class="min-w-0">
        <h1 tabindex="-1" data-screen-title class={['font-display text-h1 font-semibold', hideTitle && 'sr-only']}>{title}</h1>
        {#if subtitle}<p class="mt-1 text-sm text-fg-2">{subtitle}</p>{/if}
      </div>
      <div class="flex shrink-0 items-center gap-1">{@render actions?.()}</div>
    </header>
  {/if}
  <div class="pb-6">{@render children()}</div>
  {#if dock}<div class="screen__dock">{@render dock()}</div>{/if}
</div>

<style>
  .screen { width: 100%; max-width: 44rem; margin-inline: auto; padding-inline: 1rem; }
  .screen--wide { max-width: 72rem; }
  @media (min-width: 640px) { .screen { padding-inline: 1.5rem; } }
  .screen__dock { position: sticky; bottom: var(--nav-space); z-index: 15; display: flex; gap: 10px;
    margin-inline: -1rem; padding: 12px 1rem 16px; background: var(--bg); border-top: 1px solid var(--line); }
  @media (min-width: 640px) { .screen__dock { margin-inline: -1.5rem; padding-inline: 1.5rem; } }
</style>
