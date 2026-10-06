<script>
  /** @type {{ title: string, text?: string, icon?: any, action?: import('svelte').Snippet }} */
  let { title, text = '', icon: Icon = undefined, action } = $props();
</script>
<div class="flex flex-col items-center gap-3 rounded-md border border-dashed border-line-strong px-6 py-10 text-center">
  {#if Icon}<span class="grid size-12 place-items-center rounded-full bg-surface-2 text-fg-2"><Icon class="size-6" aria-hidden="true" /></span>{/if}
  <p class="font-display text-h2 font-semibold">{title}</p>
  {#if text}<p class="max-w-[40ch] text-fg-2">{text}</p>{/if}
  {@render action?.()}
</div>
