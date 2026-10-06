<script>
  // @ts-check
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import UserRound from '@lucide/svelte/icons/user-round';
  import Lock from '@lucide/svelte/icons/lock';
  import Mail from '@lucide/svelte/icons/mail';
  import Palette from '@lucide/svelte/icons/palette';
  import Download from '@lucide/svelte/icons/download';
  import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
  import Settings from '@lucide/svelte/icons/settings';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import FileText from '@lucide/svelte/icons/file-text';
  import Pencil from '@lucide/svelte/icons/pencil';
  import {
    currentUser, isAuthenticated, isAdmin, pocketbaseHost, showToast, authService, activeSession, currentGame,
    currentSessionDuration, timerState, cachedMatches,
  } from '$lib/stores/app.js';
  import { navigate } from '$lib/router/router.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import { db } from '$lib/services/DbService.js';
  import { formatUserError } from '$lib/utils/errorFormatter.js';
  import { getSyncService } from '$lib/services/SyncService.js';
  import { exportMatchesToCsv } from '$lib/services/DataExportService.js';
  import { fetchPendingCount } from '$lib/services/AdminService.js';
  import { abortMatchTimer } from '$lib/stores/matchTimer.js';
  import { loadAllMatches } from '$lib/screens/history/loadMatches.js';
  import { ui } from '$lib/shell/ui.svelte.js';
  import { safeCssColor } from '$lib/ui/color.js';
  import Screen from '$lib/ui/Screen.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Button from '$lib/ui/Button.svelte';
  import ListRow from '$lib/ui/ListRow.svelte';
  import PlayerDot from '$lib/ui/PlayerDot.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import SyncChip from '$lib/shell/SyncChip.svelte';
  import SignInPanel from './SignInPanel.svelte';
  import AccountSheets from './AccountSheets.svelte';

  let hasActiveToken = $state(false);
  let queuedMatchesCount = $state(0);
  let failedMatchesCount = $state(0);
  let retrySyncLoading = $state(false);
  let matchesCount = $state(0);
  let favoriteGame = $state('–');
  let pendingGames = $state(0);
  let defaultColor = $state('#6366f1');
  let view = $state(/** @type {string|null} */ (null));

  async function refreshSync() {
    hasActiveToken = !!authService.getToken();
    const sync = getSyncService();
    queuedMatchesCount = await sync.getQueueSize();
    failedMatchesCount = await sync.getFailedCount();
  }

  onMount(() => {
    const savedColor = localStorage.getItem('bg_default_color');
    if (savedColor) defaultColor = savedColor;
    refreshSync();
    loadStats();
    loadPendingGames();

    window.addEventListener('bg-refresh-data', refreshSync);
    window.addEventListener('sync-queue-updated', refreshSync);
    return () => {
      window.removeEventListener('bg-refresh-data', refreshSync);
      window.removeEventListener('sync-queue-updated', refreshSync);
    };
  });

  // Kennzahlen aus den echten Partien (lokal + Cloud) statt aus Rohschlüsseln
  async function loadStats() {
    try {
      const { matches } = await loadAllMatches();
      matchesCount = matches.length;
      /** @type {Record<string, number>} */
      const counts = {};
      matches.forEach((m) => { counts[m.game_name] = (counts[m.game_name] || 0) + 1; });
      favoriteGame = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] ?? '–';
    } catch (_) {}
  }

  async function loadPendingGames() {
    const token = authService.getToken();
    if (!get(isAdmin) || !token) return;
    try { pendingGames = await fetchPendingCount(get(pocketbaseHost), token); } catch (_) {}
  }

  async function handleRetrySync() {
    retrySyncLoading = true;
    try {
      const ok = await getSyncService().retryPending();
      if (ok) showToast('Alle Runden erfolgreich synchronisiert!', 'success');
      else showToast('Synchronisation weiterhin nicht möglich. Bitte später erneut versuchen.', 'error');
    } catch (err) {
      showToast(formatUserError(err), 'error');
    } finally {
      retrySyncLoading = false;
    }
  }

  async function handleLogout() {
    // 1. & 2. Token aus RAM & Cookie entfernen (Client-Side "Invalidierung")
    authService.clearToken();

    // 3. Reaktive State-Variablen leeren
    currentUser.set(null);
    activeSession.set(null);
    currentGame.set(null);
    currentSessionDuration.set(0);
    abortMatchTimer();
    timerState.set('stopped');
    cachedMatches.set([]);

    // 4. Caches und lokale Daten bereinigen (IndexedDB & LocalStorage)
    await db.set('bg_user', null);
    await db.set('bg_matches', []); // Entferne sensible Match-Daten lokal
    localStorage.removeItem('bg_active_session');
    localStorage.removeItem('bg_default_color');

    // 5. Redirect & UI Feedback
    showToast('Erfolgreich abgemeldet.', 'info');
    navigate(appHash.home(), { replace: true });
  }

  async function handleExport() {
    const token = authService.getToken();
    const host = get(pocketbaseHost);
    if (!token) {
      showToast('Bitte melde dich erneut an, um zu exportieren.', 'error');
      return;
    }
    try {
      const user = get(currentUser);
      const matchesResp = await fetch(`${host}/api/collections/matches/records?perPage=500&filter=user='${user?.id}'`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const matchesData = await matchesResp.json();

      const gdprExportData = {
        exportDate: new Date().toISOString(),
        userProfile: { id: user?.id, name: user?.name, email: user?.email, created: user?.created },
        matches: matchesData.items || [],
      };

      const blob = new Blob([JSON.stringify(gdprExportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr-data-export-${user?.name || 'spieler'}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Daten-Export abgeschlossen', 'success');
    } catch (e) {
      console.error(e);
      showToast('Export fehlgeschlagen.', 'error');
    }
  }

  async function handleCsvExport() {
    try {
      showToast('Export wird vorbereitet …', 'info');
      await exportMatchesToCsv();
      showToast('CSV-Export abgeschlossen', 'success');
    } catch (e) {
      console.error(e);
      showToast('CSV-Export fehlgeschlagen: ' + (e instanceof Error ? e.message : ''), 'error');
    }
  }
</script>

<Screen title="Profil">
  {#snippet actions()}<SyncChip class="lg:hidden" />{/snippet}

  <div class="flex flex-col gap-5">
    {#if $isAuthenticated && $currentUser}
      <Card padded class="flex items-center gap-4">
        <span class="shrink-0"><PlayerDot size="md" name={$currentUser.name || 'S'} color={safeCssColor(defaultColor, 'var(--accent)')} /></span>
        <div class="min-w-0 flex-1 leading-tight">
          <h2 class="truncate font-display text-h2 font-semibold">{$currentUser.name || 'Spieler'}</h2>
          <p class="truncate text-sm text-fg-2">{$currentUser.email || ''}</p>
          {#if $currentUser.created}<p class="mt-0.5 text-[0.8rem] text-fg-3">Dabei seit {new Date($currentUser.created).toLocaleDateString('de-DE')}</p>{/if}
        </div>
        <IconButton label="Anzeigename ändern" variant="outline" onclick={() => (view = 'name')}><Pencil class="size-5" aria-hidden="true" /></IconButton>
      </Card>

      <div class="grid grid-cols-2 gap-2.5">
        <Card class="p-3">
          <div class="tabular text-[22px] font-bold leading-tight">{matchesCount}</div>
          <div class="mt-0.5 text-[0.8rem] text-fg-2">Gespeicherte Runden</div>
        </Card>
        <Card class="p-3">
          <div class="truncate text-[22px] font-bold leading-tight" title={favoriteGame}>{favoriteGame}</div>
          <div class="mt-0.5 text-[0.8rem] text-fg-2">Lieblingsspiel</div>
        </Card>
      </div>

      {#if hasActiveToken}
        <Card padded class="flex flex-col gap-2">
          <p class="flex items-center gap-2 font-semibold"><span class="size-2 rounded-full bg-success" aria-hidden="true"></span>Cloud-Backup aktiv</p>
          <p class="text-sm text-fg-2">Deine Spielrunden werden automatisch in der Cloud gesichert.</p>
          {#if queuedMatchesCount - failedMatchesCount > 0}
            <div><Badge tone="warning">{queuedMatchesCount - failedMatchesCount} Runde(n) warten auf Synchronisation</Badge></div>
          {/if}
          {#if failedMatchesCount > 0}
            <div><Badge tone="danger">{failedMatchesCount} Runde(n) konnten nicht synchronisiert werden</Badge></div>
            <Button variant="primary" loading={retrySyncLoading} onclick={handleRetrySync}>Erneut versuchen</Button>
          {/if}
        </Card>
      {:else}
        <Card padded class="flex flex-col gap-2">
          <p class="flex items-center gap-2 font-semibold"><span class="size-2 rounded-full bg-warning" aria-hidden="true"></span>Sitzung abgelaufen</p>
          <p class="text-sm text-fg-2">Deine Cloud-Verbindung ist inaktiv. Melde dich erneut an, um deine Runden zu sichern. Lokale Partien bleiben erhalten.</p>
          <Button variant="primary" onclick={() => (ui.authOpen = true)}>Jetzt neu anmelden</Button>
        </Card>
      {/if}

      <section class="flex flex-col gap-1.5" aria-label="Konto">
        <h2 class="px-1 text-sm font-semibold text-fg-2">Konto</h2>
        <Card>
          <ListRow title="Anzeigename" subtitle={$currentUser.name} onclick={() => (view = 'name')}>{#snippet leading()}<UserRound class="size-5" aria-hidden="true" />{/snippet}</ListRow>
          <ListRow title="Passwort ändern" onclick={() => (view = 'password')}>{#snippet leading()}<Lock class="size-5" aria-hidden="true" />{/snippet}</ListRow>
          <ListRow title="E-Mail ändern" subtitle={$currentUser.email} onclick={() => (view = 'email')}>{#snippet leading()}<Mail class="size-5" aria-hidden="true" />{/snippet}</ListRow>
        </Card>
      </section>

      <section class="flex flex-col gap-1.5" aria-label="Spielerprofil">
        <h2 class="px-1 text-sm font-semibold text-fg-2">Spielerprofil</h2>
        <Card>
          <ListRow title="Standard-Farbe festlegen" onclick={() => (view = 'color')}>
            {#snippet leading()}<Palette class="size-5" aria-hidden="true" />{/snippet}
            {#snippet trailing()}<PlayerDot color={safeCssColor(defaultColor, 'var(--accent)')} />{/snippet}
          </ListRow>
        </Card>
      </section>

      <section class="flex flex-col gap-1.5" aria-label="Daten">
        <h2 class="px-1 text-sm font-semibold text-fg-2">Daten</h2>
        <Card>
          <ListRow title="Daten-Export (JSON)" subtitle="Alle Daten deines Kontos nach DSGVO" onclick={handleExport}>{#snippet leading()}<Download class="size-5" aria-hidden="true" />{/snippet}</ListRow>
          <ListRow title="CSV-Export" subtitle="Deine Partien als Tabelle" onclick={handleCsvExport}>{#snippet leading()}<FileSpreadsheet class="size-5" aria-hidden="true" />{/snippet}</ListRow>
        </Card>
      </section>
    {:else}
      <Card padded>
        <h2 class="mb-3 font-display text-h2 font-semibold">Anmelden</h2>
        <SignInPanel />
      </Card>
    {/if}

    <section class="flex flex-col gap-1.5" aria-label="App">
      <h2 class="px-1 text-sm font-semibold text-fg-2">App</h2>
      <Card>
        <ListRow title="Einstellungen" href={appHash.settings()}>{#snippet leading()}<Settings class="size-5" aria-hidden="true" />{/snippet}</ListRow>
        {#if $isAdmin}
          <ListRow title="Spielanträge" subtitle="Eingereichte Spiele prüfen" href={appHash.admin()}>
            {#snippet leading()}<ShieldCheck class="size-5" aria-hidden="true" />{/snippet}
            {#snippet trailing()}{#if pendingGames > 0}<Badge tone="warning">{pendingGames}</Badge>{/if}{/snippet}
          </ListRow>
        {/if}
        <ListRow title="Impressum & Datenschutz" href={appHash.legal()}>{#snippet leading()}<FileText class="size-5" aria-hidden="true" />{/snippet}</ListRow>
      </Card>
    </section>

    {#if $isAuthenticated && $currentUser}
      <div class="flex flex-col items-center gap-1 pt-2">
        <Button variant="danger-ghost" block onclick={handleLogout}>Abmelden</Button>
        <button type="button" class="min-h-11 px-3 text-sm text-fg-3 underline" onclick={() => (view = 'delete')}>Konto löschen</button>
      </div>
    {/if}
  </div>
</Screen>

<AccountSheets bind:view bind:color={defaultColor} ondeleted={() => navigate(appHash.home(), { replace: true })} />
