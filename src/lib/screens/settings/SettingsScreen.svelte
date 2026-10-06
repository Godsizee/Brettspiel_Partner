<script>
  // @ts-check
  import { onMount } from 'svelte';
  import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
  import Printer from '@lucide/svelte/icons/printer';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Smartphone from '@lucide/svelte/icons/smartphone';
  import { settings, themeMode, setThemePreference, showToast, confirmDialog, pwaInstallEvent } from '$lib/stores/app.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import { HapticService } from '$lib/services/HapticService.js';
  import { exportMatchesToCsv } from '$lib/services/DataExportService.js';
  import { triggerPwaInstall } from '$lib/shell/pwaInstall.svelte.js';
  import Screen from '$lib/ui/Screen.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Switch from '$lib/ui/Switch.svelte';
  import Segmented from '$lib/ui/Segmented.svelte';
  import SelectField from '$lib/ui/SelectField.svelte';
  import ListRow from '$lib/ui/ListRow.svelte';

  /**
   * Schalter mit haptischem Feedback (Logik aus Settings.svelte)
   * @param {string} key
   */
  function toggleSetting(key) {
    HapticService.lightTap();
    settings.update((s) => ({ ...s, [key]: !(/** @type {any} */ (s)[key]) }));
  }

  /**
   * Dropdown-Wert setzen
   * @param {string} key
   * @param {number} value
   */
  function setSettingValue(key, value) {
    HapticService.lightTap();
    settings.update((s) => ({ ...s, [key]: value }));
  }

  // ─── Darstellung ──────────────────────────────────────────────────────────────
  let themePref = $derived($settings.followSystemTheme ? 'system' : $themeMode);
  const THEME_OPTIONS = [{ value: 'system', label: 'System' }, { value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }];

  let isFullscreen = $state(false);
  let fullscreenSupported = $state(false);
  onMount(() => {
    fullscreenSupported = !!document.fullscreenEnabled;
    const onFsChange = () => { isFullscreen = !!document.fullscreenElement; };
    document.addEventListener('fullscreenchange', onFsChange);
    onFsChange();
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => { isFullscreen = true; }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => { isFullscreen = false; }).catch(() => {});
    }
  }

  // ─── Daten ────────────────────────────────────────────────────────────────────
  async function exportCSV() {
    HapticService.lightTap();
    try {
      await exportMatchesToCsv();
      showToast('CSV-Export abgeschlossen', 'success');
    } catch (err) {
      console.error(err);
      showToast('CSV-Export fehlgeschlagen.', 'error');
    }
  }

  // F7 PDF-Export (Drucker-Layout triggern)
  function exportPDF() {
    HapticService.lightTap();
    showToast('Drucker-Layout geöffnet. Wähle „Als PDF speichern“.', 'info');
    setTimeout(() => window.print(), 500);
  }

  // F9 Cache leeren (localStorage + Service Worker + Cache Storage)
  async function clearAppCache() {
    HapticService.timerStop();
    if (!(await confirmDialog('Bist du sicher? Alle lokalen Daten werden gelöscht. Ungesicherte Spiele gehen verloren.'))) return;
    try {
      localStorage.clear();

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) await registration.unregister();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) await caches.delete(key);
      }

      showToast('Cache gelöscht, die App startet neu …', 'success');
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      showToast('Fehler beim Löschen des Caches.', 'error');
    }
  }

  const ALARM_OPTIONS = [30, 60, 120, 180, 240].map((m) => ({ value: m, label: m < 60 ? `${m} Minuten` : `${m / 60} ${m === 60 ? 'Stunde' : 'Stunden'}` }));
  const LOGOUT_OPTIONS = [
    { value: 15, label: '15 Minuten' }, { value: 30, label: '30 Minuten' }, { value: 60, label: '60 Minuten' },
    { value: 240, label: '4 Stunden' }, { value: 0, label: 'Nie' },
  ];
</script>

<Screen title="Einstellungen" back={appHash.profile()}>
  <div class="flex flex-col gap-5">
    <section class="flex flex-col gap-1.5" aria-label="Darstellung">
      <h2 class="px-1 text-sm font-semibold text-fg-2">Darstellung</h2>
      <Card padded class="flex flex-col gap-3">
        <Segmented label="Farbschema" options={THEME_OPTIONS} value={themePref} onchange={(v) => { HapticService.lightTap(); setThemePreference(/** @type {any} */ (v)); }} />
        {#if fullscreenSupported}
          <Switch label="Vollbild" description="Browser-Leisten ausblenden" checked={isFullscreen} onchange={toggleFullscreen} />
        {/if}
      </Card>
    </section>

    <section class="flex flex-col gap-1.5" aria-label="Allgemein">
      <h2 class="px-1 text-sm font-semibold text-fg-2">Allgemein</h2>
      <Card class="px-4">
        <Switch label="Haptisches Feedback" description="Vibrationen bei Klicks und Aktionen" checked={$settings.hapticsEnabled} onchange={() => toggleSetting('hapticsEnabled')} />
        <Switch label="Spielabend-Modus" description="Session-Modus für fortlaufende Runden" checked={$settings.gameSessionMode} onchange={() => toggleSetting('gameSessionMode')} />
      </Card>
    </section>

    <section class="flex flex-col gap-1.5" aria-label="Timer und Hinweise">
      <h2 class="px-1 text-sm font-semibold text-fg-2">Timer & Hinweise</h2>
      <Card padded class="flex flex-col gap-3">
        <Switch label="Benachrichtigungen" description="Timer-Alarme und Statusupdates" checked={$settings.notificationsEnabled} onchange={() => toggleSetting('notificationsEnabled')} />
        <SelectField label="Timer-Alarm nach" value={$settings.timerAlarmDurationMinutes} options={ALARM_OPTIONS} onchange={(v) => setSettingValue('timerAlarmDurationMinutes', parseInt(v))} />
        <SelectField label="Auto-Logout bei Inaktivität" value={$settings.inactivityLogoutMinutes} options={LOGOUT_OPTIONS} onchange={(v) => setSettingValue('inactivityLogoutMinutes', parseInt(v))} />
      </Card>
    </section>

    <section class="flex flex-col gap-1.5" aria-label="Daten">
      <h2 class="px-1 text-sm font-semibold text-fg-2">Daten</h2>
      <Card>
        <ListRow title="Ergebnisse exportieren (CSV)" onclick={exportCSV}>{#snippet leading()}<FileSpreadsheet class="size-5" aria-hidden="true" />{/snippet}</ListRow>
        <ListRow title="Drucken / als PDF sichern" onclick={exportPDF}>{#snippet leading()}<Printer class="size-5" aria-hidden="true" />{/snippet}</ListRow>
        <ListRow title="Cache & lokale Daten löschen" subtitle="Ungesicherte Partien gehen verloren" tone="danger" onclick={clearAppCache}>{#snippet leading()}<Trash2 class="size-5" aria-hidden="true" />{/snippet}</ListRow>
      </Card>
    </section>

    {#if $pwaInstallEvent}
      <section class="flex flex-col gap-1.5" aria-label="App installieren">
        <h2 class="px-1 text-sm font-semibold text-fg-2">App installieren</h2>
        <Card>
          <ListRow title="Zum Startbildschirm hinzufügen" subtitle="Läuft danach wie eine App, auch offline" onclick={triggerPwaInstall}>{#snippet leading()}<Smartphone class="size-5" aria-hidden="true" />{/snippet}</ListRow>
        </Card>
      </section>
    {/if}
  </div>
</Screen>
