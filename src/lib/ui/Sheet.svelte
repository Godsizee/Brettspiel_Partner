<script>
  import X from '@lucide/svelte/icons/x';
  import IconButton from './IconButton.svelte';

  /**
   * @type {{ open?: boolean, title: string, description?: string, size?: 'sm'|'md'|'lg'|'full',
   *   onclose?: () => void, children: import('svelte').Snippet, footer?: import('svelte').Snippet }}
   */
  let { open = $bindable(false), title, description = '', size = 'md', onclose, children, footer } = $props();
  const uid = $props.id();
  /** @type {HTMLDialogElement | undefined} */
  let dialog = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function handleClose() {
    if (open) open = false;
    onclose?.();
  }
  /** Klick auf den Backdrop (Ziel ist das dialog-Element selbst) schließt. */
  function handleClick(/** @type {MouseEvent} */ e) {
    if (e.target === dialog) dialog?.close();
  }
</script>

<dialog bind:this={dialog} class="sheet sheet--{size}" aria-labelledby="{uid}-t" aria-describedby={description ? `${uid}-d` : undefined}
  onclose={handleClose} onclick={handleClick}>
  <div class="sheet__panel">
    <div class="sheet__grab" aria-hidden="true"></div>
    <header class="flex items-start gap-2">
      <h2 id="{uid}-t" class="font-display text-h2 font-semibold flex-1 pt-1.5">{title}</h2>
      <IconButton label="Schließen" onclick={() => dialog?.close()}><X class="size-5" aria-hidden="true" /></IconButton>
    </header>
    {#if description}<p id="{uid}-d" class="text-sm text-fg-2">{description}</p>{/if}
    <div class="sheet__body">{@render children()}</div>
    {#if footer}<footer class="sheet__foot">{@render footer()}</footer>{/if}
  </div>
</dialog>

<style>
  .sheet { margin: auto 0 0; width: 100%; max-width: 100%; max-height: 92dvh; padding: 0; border: 0; background: transparent; color: var(--text); }
  .sheet::backdrop { background: var(--scrim); }
  .sheet__panel { display: flex; flex-direction: column; gap: 12px; max-height: 92dvh; overflow: auto; background: var(--surface);
    border-radius: var(--r-lg) var(--r-lg) 0 0; padding: 8px 16px calc(16px + env(safe-area-inset-bottom)); box-shadow: var(--sh-2); }
  .sheet__grab { width: 36px; height: 4px; border-radius: 2px; background: var(--line-strong); margin: 0 auto 4px; }
  .sheet__foot { display: flex; gap: 10px; justify-content: flex-end; padding-top: 4px; }
  .sheet--full .sheet__panel { min-height: 92dvh; }
  .sheet[open] .sheet__panel { animation: sheet-in var(--dur-3) var(--ease-standard); }
  @keyframes sheet-in { from { transform: translateY(24px); opacity: 0; } }
  @media (min-width: 640px) {
    .sheet { margin: auto; width: min(32rem, calc(100% - 32px)); }
    .sheet--sm { width: min(26rem, calc(100% - 32px)); }
    .sheet--lg, .sheet--full { width: min(48rem, calc(100% - 32px)); }
    .sheet__panel { border-radius: var(--r-lg); padding: 20px 24px 24px; }
    .sheet__grab { display: none; }
  }
</style>
