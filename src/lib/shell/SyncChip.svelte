<script>
  import CloudOff from '@lucide/svelte/icons/cloud-off';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { isOnline } from '$lib/stores/app.js';
  import { getSyncService } from '$lib/services/SyncService.js';
  import { onMount } from 'svelte';
  import { ui } from './ui.svelte.js';

  /** @type {{ class?: string }} */
  let { class: extra = '' } = $props();

  const syncService = getSyncService();
  let pending = $state(0);

  async function refresh() {
    pending = (await syncService.getPendingEntries()).length;
  }

  onMount(() => {
    refresh();
    window.addEventListener('sync-queue-updated', refresh);
    return () => window.removeEventListener('sync-queue-updated', refresh);
  });

  let visible = $derived(!$isOnline || pending > 0);
  let text = $derived(!$isOnline ? (pending > 0 ? `Offline · ${pending} wartet` : 'Offline') : `${pending} wartet`);
</script>

{#if visible}
  <button type="button"
    class={['inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full bg-warning-soft px-2.5 text-xs font-semibold text-warning', extra]}
    aria-label="Synchronisierung: {text}" onclick={() => (ui.syncOpen = true)}>
    {#if !$isOnline}<CloudOff class="size-4" aria-hidden="true" />{:else}<RefreshCw class="size-4" aria-hidden="true" />{/if}
    <span>{text}</span>
  </button>
{/if}
