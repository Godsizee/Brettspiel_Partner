<script>
  import Download from '@lucide/svelte/icons/download';
  import Card from '$lib/ui/Card.svelte';
  import Button from '$lib/ui/Button.svelte';
  import { triggerPwaInstall, dismissPwaInstall } from '$lib/shell/pwaInstall.svelte.js';
</script>

<Card padded class="flex flex-col gap-3 sm:flex-row sm:items-center">
  <div class="flex items-center gap-3">
    <span class="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-soft-fg">
      <Download class="size-5" aria-hidden="true" />
    </span>
    <div class="min-w-0 flex-1">
      <p class="font-display text-h2 font-semibold">Als App installieren</p>
      <p class="text-sm text-fg-2">Nutze den Begleiter schneller und offline direkt vom Homescreen.</p>
    </div>
  </div>
  <div class="flex shrink-0 gap-2 sm:ml-auto">
    <Button variant="ghost" class="flex-1 sm:flex-none" onclick={dismissPwaInstall}>Später</Button>
    <Button variant="primary" class="flex-1 sm:flex-none" onclick={triggerPwaInstall}>Installieren</Button>
  </div>
</Card>
