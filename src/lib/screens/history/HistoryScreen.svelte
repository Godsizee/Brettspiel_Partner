<script>
  // @ts-check
  import { onMount, untrack } from 'svelte';
  import { get } from 'svelte/store';
  import Lock from '@lucide/svelte/icons/lock';
  import Trophy from '@lucide/svelte/icons/trophy';
  import Search from '@lucide/svelte/icons/search';
  import {
    historyFilter, isOnline, pocketbaseHost, authService, showToast, gamesCatalog, currentUser,
  } from '$lib/stores/app.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import { pullFromRemote } from '$lib/services/DbService.js';
  import { getMatchRepository } from '$lib/services/MatchRepository.js';
  import { mergeMatches } from '$lib/services/StatsService.js';
  import { shareMatchAsImage } from '$lib/services/MatchShareService.js';
  import { validateGameImageUrl } from '$lib/utils/urlValidator.js';
  import { ui } from '$lib/shell/ui.svelte.js';
  import SyncChip from '$lib/shell/SyncChip.svelte';
  import Screen from '$lib/ui/Screen.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Segmented from '$lib/ui/Segmented.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import Skeleton from '$lib/ui/Skeleton.svelte';
  import ChronikTabs from './ChronikTabs.svelte';
  import MatchCard from './MatchCard.svelte';

  const matchRepo = getMatchRepository();

  /** @type {any[]} */
  let matches = $state([]);
  let loading = $state(true);
  let needsReauth = $state(false);
  let expandedKey = $state(/** @type {string|null} */ (null));
  /** Schlüssel der Partie, deren Löschung gerade zurückgenommen werden kann. */
  let pendingKey = $state(/** @type {string|null} */ (null));
  let undoTimer = /** @type {any} */ (null);

  /** @param {any} m */
  const keyOf = (m) => m.local_id || m.id;
  /** @param {string} name */
  const gameByName = (name) => Object.values($gamesCatalog).find((g) => g.name === name);

  // historyFilter kann einen Spiel-KEY (von der Spiel-Seite) oder einen Namen enthalten → auf den Namen normalisieren.
  let filterName = $derived($historyFilter === 'all' ? 'all' : ($gamesCatalog[$historyFilter]?.name ?? $historyFilter));

  let visible = $derived(matches.filter((m) => keyOf(m) !== pendingKey));
  let filtered = $derived(filterName === 'all' ? visible : visible.filter((m) => m.game_name === filterName));

  // Gespielte Spiele mit Anzahl für die Filter-Chips
  let filterOptions = $derived.by(() => {
    /** @type {Record<string, number>} */
    const counts = {};
    visible.forEach((m) => { counts[m.game_name] = (counts[m.game_name] || 0) + 1; });
    return [
      { value: 'all', label: 'Alle', count: visible.length },
      ...Object.values($gamesCatalog).filter((g) => counts[g.name] > 0).map((g) => ({ value: g.name, label: g.name, count: counts[g.name] })),
    ];
  });

  // Nach Monat gruppieren (Liste ist bereits absteigend nach Datum sortiert)
  let groups = $derived.by(() => {
    /** @type {Array<{ label: string, items: any[] }>} */
    const out = [];
    for (const m of filtered) {
      const label = new Date(m.date).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(m);
      else out.push({ label, items: [m] });
    }
    return out;
  });

  async function loadHistory() {
    loading = true;
    needsReauth = false;
    const token = authService.getToken();
    const user = get(currentUser);

    // Offline-first: lokal gespeicherte Matches IMMER laden – unabhängig von
    // Login oder Netzverbindung. So gehen Partien in der Ansicht nie verloren.
    let localMatches = [];
    try {
      localMatches = await matchRepo.getLocalMatches();
    } catch (e) {
      console.warn('History: Lokale Matches konnten nicht geladen werden', e);
    }

    let remoteMatches = [];
    if (token && user?.id) {
      try {
        remoteMatches = await pullFromRemote(user.id);
      } catch (e) {
        // Kein harter Fehler: lokale Matches werden weiterhin angezeigt.
        console.warn('History: PocketBase fetch failed', e);
      }
    } else if (localMatches.length === 0) {
      // Weder angemeldet noch lokale Daten → Hinweis zum Anmelden.
      needsReauth = true;
    }

    matches = mergeMatches(localMatches, remoteMatches);
    loading = false;
  }

  // Beim Einhängen und bei jedem Wechsel des angemeldeten Nutzers (Login/Logout) neu laden
  $effect(() => {
    $currentUser;
    untrack(loadHistory);
  });

  onMount(() => {
    const handleRefresh = () => loadHistory();
    window.addEventListener('bg-refresh-data', handleRefresh);
    return () => window.removeEventListener('bg-refresh-data', handleRefresh);
  });

  // ─── Löschen mit Rückgängig (5 s), Logik wörtlich aus MatchHistory ───────────────────────
  /** @param {any} match */
  function deleteMatch(match) {
    // Läuft schon eine ausstehende Löschung, wird sie jetzt ausgeführt.
    if (pendingKey !== null) { clearTimeout(undoTimer); executeDelete(pendingMatch); }
    pendingKey = keyOf(match);
    pendingMatch = match;
    expandedKey = null;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => executeDelete(match), 5000);
    showToast('Eintrag wird gelöscht', 'info', 5000, { label: 'Rückgängig', onClick: undoDelete });
  }
  let pendingMatch = /** @type {any} */ (null);

  function undoDelete() {
    clearTimeout(undoTimer);
    pendingKey = null;
    pendingMatch = null;
  }

  /** @param {any} match */
  async function executeDelete(match) {
    pendingKey = null;
    pendingMatch = null;
    if (!match) return;

    // Remote-Record-ID bestimmen: pb_id ist der PocketBase-Record. Fallback auf
    // match.id nur, wenn das Match als synced gilt (dann ist id == PB-ID, weil der
    // Eintrag direkt aus pullFromRemote stammt). Bei rein lokalen Matches → null.
    const remoteId = match.pb_id || (!match.sync_status || match.sync_status === 'synced' ? match.id : null);

    // Remote ZUERST löschen, damit lokal und Server konsistent bleiben. Würde nur
    // lokal gelöscht und der Server-Record bliebe bestehen, käme das Match beim
    // nächsten Pull als „Geist-Eintrag" zurück.
    if (remoteId) {
      if (!get(isOnline)) {
        showToast('Offline — synchronisierte Einträge lassen sich nur mit Internetverbindung löschen.', 'error');
        return;
      }
      const token = authService.getToken();
      if (!token) {
        showToast('Bitte neu anmelden, um diesen Eintrag zu löschen.', 'error');
        return;
      }

      const host = get(pocketbaseHost);
      let resp;
      try {
        resp = await fetch(`${host}/api/collections/matches/records/${remoteId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        console.warn('History: Remote-Delete Netzwerkfehler', e);
        showToast('Verbindungsfehler — Eintrag wurde nicht gelöscht.', 'error');
        return;
      }

      // 204/200 = gelöscht. PocketBase liefert 404, wenn der Record nicht (mehr)
      // über die deleteRule (user = auth.id) erreichbar ist — entweder bereits
      // gelöscht ODER fremder Eintrag (Gast-Match). Ein fremdes Match darf nicht
      // als „gelöscht" gemeldet werden, sonst kommt es beim nächsten Pull wieder.
      if (resp.status === 404) {
        const ownerId = get(currentUser)?.id;
        if (match.user && ownerId && match.user !== ownerId) {
          showToast('Dieser Eintrag gehört einem anderen Konto und kann nicht gelöscht werden.', 'error');
          return;
        }
        // sonst: serverseitig bereits weg → als Erfolg behandeln (lokal aufräumen).
      } else if (!resp.ok) {
        console.warn('History: Remote-Delete fehlgeschlagen', resp.status);
        showToast('Löschen auf dem Server fehlgeschlagen.', 'error');
        return;
      }
    }

    // Lokales Löschen (entfernt auch aus SyncService falls vorhanden)
    await matchRepo.deleteMatch(match.local_id || match.id);

    await loadHistory();
    showToast('Eintrag gelöscht.', 'success');
  }

  /** @param {any} match */
  async function shareMatch(match) {
    try {
      showToast('Bild wird erstellt …', 'info');
      await shareMatchAsImage(match, validateGameImageUrl(gameByName(match.game_name)?.cover) ?? '');
    } catch (e) {
      console.error(e);
      showToast('Teilen fehlgeschlagen.', 'error');
    }
  }
</script>

<Screen title="Chronik">
  {#snippet actions()}<SyncChip class="lg:hidden" />{/snippet}

  <div class="flex flex-col gap-3">
    <ChronikTabs active="history" />

    {#if !loading && matches.length > 0}
      <Segmented variant="chips" label="Nach Spiel filtern" options={filterOptions} value={filterName}
        onchange={(v) => historyFilter.set(v)} />
    {/if}

    {#if needsReauth && matches.length > 0}
      <Card padded class="flex items-center gap-3">
        <Lock class="size-5 shrink-0 text-warning" aria-hidden="true" />
        <p class="min-w-0 flex-1 text-sm"><strong>Anmeldung erforderlich.</strong> Melde dich an, um dein Archiv zu laden.</p>
        <Button variant="primary" onclick={() => (ui.authOpen = true)}>Anmelden</Button>
      </Card>
    {/if}
  </div>

  <div class="mt-4 flex flex-col gap-3">
    {#if loading}
      {#each Array(4) as _}<Skeleton class="h-24" />{/each}
    {:else if matches.length === 0 && needsReauth}
      <EmptyState title="Sitzung abgelaufen" icon={Lock}
        text="Deine Cloud-Runden sind nicht sichtbar, weil nach dem Seitenneustart keine aktive Sitzung mehr vorliegt. Melde dich kurz neu an — deine Daten gehen nicht verloren.">
        {#snippet action()}<Button variant="primary" onclick={() => (ui.authOpen = true)}>Neu anmelden</Button>{/snippet}
      </EmptyState>
    {:else if matches.length === 0}
      <EmptyState title="Deine erste Partie wartet" icon={Trophy}
        text="Hier findest du später alle gespielten Partien, Statistiken und Duelle.">
        {#snippet action()}<Button variant="primary" href={appHash.home()}>Spiel wählen</Button>{/snippet}
      </EmptyState>
    {:else if filtered.length === 0}
      <EmptyState title="Keine Treffer" icon={Search} text="Für dieses Spiel wurden noch keine Partien aufgezeichnet.">
        {#snippet action()}<Button variant="secondary" onclick={() => historyFilter.set('all')}>Alle Partien zeigen</Button>{/snippet}
      </EmptyState>
    {:else}
      {#each groups as group (group.label)}
        <section class="flex flex-col gap-3" aria-label={group.label}>
          <h2 class="mt-1 text-sm font-semibold text-fg-2">{group.label}</h2>
          {#each group.items as match (keyOf(match))}
            <MatchCard {match} game={gameByName(match.game_name)} expanded={expandedKey === keyOf(match)}
              isHost={!!match.user && match.user === $currentUser?.id} isGuest={!!match.user && match.user !== $currentUser?.id}
              ontoggle={() => (expandedKey = expandedKey === keyOf(match) ? null : keyOf(match))}
              onshare={() => shareMatch(match)} ondelete={() => deleteMatch(match)} />
          {/each}
        </section>
      {/each}
    {/if}
  </div>
</Screen>
