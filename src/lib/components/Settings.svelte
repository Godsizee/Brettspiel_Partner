<script>
  import { settings, activeScreen, navigateTo, themeMode, showToast, confirmDialog, authService } from '$lib/stores/app.js';
  import { HapticService } from '$lib/services/HapticService.js';
  import { db } from '$lib/services/DbService.js';

  function goBack() {
    HapticService.lightTap();
    navigateTo('profile');
  }

  /**
   * Handle dynamic toggles with haptic feedback
   * @param {string} key
   */
  function toggleSetting(key) {
    HapticService.lightTap();
    settings.update(s => {
      const nextVal = !s[key];
      if (key === 'followSystemTheme' && nextVal) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        themeMode.set(prefersDark ? 'dark' : 'light');
      }
      return { ...s, [key]: nextVal };
    });
  }

  /**
   * Handle dropdown value changes
   * @param {string} key
   * @param {any} value
   */
  function setSettingValue(key, value) {
    HapticService.lightTap();
    settings.update(s => ({ ...s, [key]: value }));
  }

  // F9 Cache leeren (IndexedDB + SW)
  async function clearAppCache() {
    HapticService.timerStop();
    if (await confirmDialog('Bist du sicher? Alle lokalen Daten werden gelöscht. Ungesicherte Spiele gehen verloren.')) {
      try {
        localStorage.clear();
        
        // Unregister service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (let registration of registrations) {
            await registration.unregister();
          }
        }
        
        // Clear cache storage
        if ('caches' in window) {
          const keys = await caches.keys();
          for (let key of keys) {
            await caches.delete(key);
          }
        }
        
        showToast('Cache erfolgreich gelöscht! Starten neu... 🔄', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (e) {
        showToast('Fehler beim Löschen des Caches.', 'error');
      }
    }
  }

  // F7 CSV-Export
  async function exportCSV() {
    HapticService.lightTap();
    try {
      // Fetch all matches from local db
      const list = await db.getAll('matches') || [];
      if (list.length === 0) {
        showToast('Keine Spielrunden zum Exportieren vorhanden.', 'warning');
        return;
      }

      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += 'ID,Spiel,Datum,Dauer_Sek,Spieler,Punkte,Rang,Gewonnen\n';

      list.forEach(m => {
        const players = m.scores || {};
        const ranks = m.ranks || {};
        const playerNames = Object.keys(players);
        playerNames.forEach(p => {
          const isWinner = ranks[p] === 1 ? 'Ja' : 'Nein';
          csvContent += `"${m.id}","${m.gameKey}","${m.date || ''}",${m.duration || 0},"${p}",${players[p]},${ranks[p] || 0},"${isWinner}"\n`;
        });
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `boardgame_companion_matches_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('CSV-Export abgeschlossen! 📊', 'success');
    } catch (err) {
      console.error(err);
      showToast('CSV-Export fehlgeschlagen.', 'error');
    }
  }

  // F7 PDF-Export (Drucker-Layout triggern)
  function exportPDF() {
    HapticService.lightTap();
    showToast('Drucker-Layout geöffnet. Wähle "Als PDF speichern". 📄', 'info');
    setTimeout(() => {
      window.print();
    }, 500);
  }
</script>

<div class="settings-container animate-scale-up">
  <!-- Back Button & Header -->
  <div class="settings-header">
    <button class="btn-back" onclick={goBack} aria-label="Zurück">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      Zurück
    </button>
    <h2 class="settings-title">Einstellungen</h2>
  </div>

  <div class="settings-grid">
    <!-- Allgemein Section -->
    <div class="settings-section glass-panel">
      <h3 class="section-title">Allgemein</h3>
      
      <!-- Haptisches Feedback -->
      <div class="settings-row">
        <div class="row-info">
          <span class="row-label">Haptisches Feedback</span>
          <span class="row-desc">Vibrationen bei Klicks und Aktionen</span>
        </div>
        <button 
          class="toggle-switch" 
          class:active={$settings.hapticsEnabled} 
          onclick={() => toggleSetting('hapticsEnabled')}
          aria-label="Haptisches Feedback umschalten"
        ></button>
      </div>

      <!-- OS System-Thema folgen -->
      <div class="settings-row">
        <div class="row-info">
          <span class="row-label">Systemthema folgen</span>
          <span class="row-desc">Automatisch an Betriebssystem anpassen</span>
        </div>
        <button 
          class="toggle-switch" 
          class:active={$settings.followSystemTheme} 
          onclick={() => toggleSetting('followSystemTheme')}
          aria-label="Systemthema folgen umschalten"
        ></button>
      </div>

      <!-- Spielabend-Modus (F2) -->
      <div class="settings-row">
        <div class="row-info">
          <span class="row-label">Spielabend-Modus</span>
          <span class="row-desc">Session-Modus für fortlaufende Runden</span>
        </div>
        <button 
          class="toggle-switch" 
          class:active={$settings.gameSessionMode} 
          onclick={() => toggleSetting('gameSessionMode')}
          aria-label="Spielabend-Modus umschalten"
        ></button>
      </div>
    </div>

    <!-- Timer & Benachrichtigungen Section -->
    <div class="settings-section glass-panel">
      <h3 class="section-title">Timer & Benachrichtigungen</h3>

      <!-- Benachrichtigungen -->
      <div class="settings-row">
        <div class="row-info">
          <span class="row-label">Benachrichtigungen (F5)</span>
          <span class="row-desc">Timer-Alarme und Statusupdates</span>
        </div>
        <button 
          class="toggle-switch" 
          class:active={$settings.notificationsEnabled} 
          onclick={() => toggleSetting('notificationsEnabled')}
          aria-label="Benachrichtigungen umschalten"
        ></button>
      </div>

      <!-- Timer Alarm Schwellenwert -->
      <div class="settings-row dropdown-row">
        <div class="row-info">
          <span class="row-label">Timer-Alarm nach</span>
          <span class="row-desc">Erinnerung bei langen Partien</span>
        </div>
        <select 
          class="settings-select" 
          value={$settings.timerAlarmDurationMinutes}
          onchange={(e) => setSettingValue('timerAlarmDurationMinutes', parseInt(e.target.value))}
        >
          <option value={30}>30 Minuten</option>
          <option value={60}>1 Stunde</option>
          <option value={120}>2 Stunden</option>
          <option value={180}>3 Stunden</option>
          <option value={240}>4 Stunden</option>
        </select>
      </div>

      <!-- Auto-Logout Schwellenwert -->
      <div class="settings-row dropdown-row">
        <div class="row-info">
          <span class="row-label">Auto-Logout bei Inaktivität</span>
          <span class="row-desc">Sicherheitsabmeldung nach Inaktivität</span>
        </div>
        <select 
          class="settings-select" 
          value={$settings.inactivityLogoutMinutes}
          onchange={(e) => setSettingValue('inactivityLogoutMinutes', parseInt(e.target.value))}
        >
          <option value={15}>15 Minuten</option>
          <option value={30}>30 Minuten</option>
          <option value={60}>60 Minuten</option>
          <option value={240}>4 Stunden</option>
          <option value={0}>Nie</option>
        </select>
      </div>
    </div>

    <!-- Daten-Verwaltung Section -->
    <div class="settings-section glass-panel">
      <h3 class="section-title">Daten & Backups</h3>

      <div class="settings-buttons">
        <!-- CSV Export -->
        <button class="btn btn-secondary setting-btn" onclick={exportCSV}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px;">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Ergebnisse exportieren (CSV)
        </button>

        <!-- PDF Export -->
        <button class="btn btn-secondary setting-btn" onclick={exportPDF}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px;">
            <path d="M6 9V2h12v7"></path>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
          Drucken / Als PDF sichern
        </button>

        <!-- Clear Cache -->
        <button class="btn btn-danger setting-btn" onclick={clearAppCache}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:6px;">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Cache & lokale Daten löschen
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .settings-container {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .settings-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 8px;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border-glass);
    padding: 8px 14px;
    border-radius: 12px;
    color: var(--color-text-secondary);
    font-family: var(--font-heading);
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition-fast);
    text-transform: uppercase;
  }

  .btn-back:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
  }

  .settings-title {
    font-family: var(--font-heading);
    font-size: 1.5rem;
    font-weight: 800;
    margin: 0;
  }

  .settings-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .settings-section {
    padding: 16px 20px;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-title {
    font-family: var(--font-heading);
    font-size: 1rem;
    font-weight: 800;
    color: var(--color-secondary);
    margin: 0 0 4px 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .settings-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .settings-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .row-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
  }

  .row-label {
    font-family: var(--font-heading);
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .row-desc {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  /* Toggle Switch */
  .toggle-switch {
    appearance: none;
    -webkit-appearance: none;
    width: 44px;
    height: 24px;
    min-height: unset;
    border-radius: 9999px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--color-border-glass);
    position: relative;
    cursor: pointer;
    transition: background-color 0.3s ease;
    padding: 0;
    outline: none;
  }

  .toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-text-muted);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease;
  }

  .toggle-switch.active {
    background: var(--color-primary);
    border-color: rgba(99, 102, 241, 0.3);
  }

  .toggle-switch.active::after {
    transform: translateX(20px);
    background: #fff;
  }

  /* Select dropdown */
  .settings-select {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-primary);
    border-radius: 8px;
    padding: 6px 12px;
    font-family: var(--font-body);
    font-size: 0.82rem;
    outline: none;
    cursor: pointer;
  }

  .settings-select:focus {
    border-color: var(--color-primary);
  }

  .settings-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .setting-btn {
    width: 100%;
    justify-content: center;
    font-family: var(--font-heading);
    font-size: 0.85rem;
    border-radius: 12px;
  }

  @media (max-width: 480px) {
    .settings-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
    .toggle-switch, .settings-select {
      align-self: flex-end;
    }
  }
</style>
