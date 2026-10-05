<script>
  import { isOnline } from '$lib/stores/app.js';
  import { getSyncService } from '$lib/services/SyncService.js';
  import { onMount } from 'svelte';
  import Sheet from '$lib/ui/Sheet.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Badge from '$lib/ui/Badge.svelte';

  let { open = $bindable(false) } = $props();

  const syncService = getSyncService();
  let queuedMatches = $state([]);
  let isSyncing = $state(false);
  let syncError = $state(null);

  async function loadQueuedMatches() {
    queuedMatches = await syncService.getPendingEntries();
  }

  async function triggerSync() {
    if (!$isOnline) {
      syncError = "Verbindung fehlgeschlagen: Gerät ist offline.";
      return;
    }
    isSyncing = true;
    syncError = null;
    try {
      const success = await syncService.triggerSync();
      if (!success) {
        syncError = "pocketbase_sync_error: PocketBase-Instanz antwortet nicht (Timeout/Netzwerkfehler).";
      }
      await loadQueuedMatches();
    } catch (e) {
      syncError = `Verbindungsfehler: ${e.message || 'Server nicht erreichbar'}`;
    } finally {
      isSyncing = false;
    }
  }

  onMount(() => {
    loadQueuedMatches();
    const handleUpdate = () => loadQueuedMatches();
    window.addEventListener('sync-queue-updated', handleUpdate);
    return () => window.removeEventListener('sync-queue-updated', handleUpdate);
  });
</script>

<Sheet bind:open title="Synchronisierung">
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold text-fg-2">Verbindungsstatus</span>
      <span class="inline-flex items-center gap-1.5 text-sm font-semibold" class:text-success={$isOnline} class:text-danger={!$isOnline}>
        <span class="size-2 rounded-full" class:bg-success={$isOnline} class:bg-danger={!$isOnline}></span>
        {$isOnline ? 'Online' : 'Offline'}
      </span>
    </div>

    {#if syncError}
      <div class="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">{syncError}</div>
    {/if}

    <div>
      <h3 class="font-display text-h2 font-semibold mb-2">Warteschlange ({queuedMatches.length} Runden)</h3>
      {#if queuedMatches.length === 0}
        <p class="rounded-md bg-surface-2 px-3 py-4 text-center text-sm text-fg-2">Alle deine Spielrunden sind vollständig mit der Cloud synchronisiert.</p>
      {:else}
        <ul class="flex flex-col gap-2">
          {#each queuedMatches as item}
            <li class="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2">
              <div>
                <span class="block text-sm font-semibold">{item.game_name}</span>
                <span class="block text-xs text-fg-2">{new Date(item.date).toLocaleDateString('de-DE')}</span>
              </div>
              <Badge tone="neutral">Wartet</Badge>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (open = false)}>Schließen</Button>
    <Button variant="primary" loading={isSyncing} disabled={queuedMatches.length === 0} onclick={triggerSync}>Jetzt synchronisieren</Button>
  {/snippet}
</Sheet>
