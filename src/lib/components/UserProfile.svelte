<script>
  import { currentUser, isAuthenticated, pocketbaseHost, showToast, authService, navigateTo, activeSession, currentGame, currentSessionDuration, timerState, cachedMatches } from '$lib/stores/app.js';
  import { db } from '$lib/services/DbService.js';
  import { get } from 'svelte/store';
  import { formatUserError } from '$lib/utils/errorFormatter.js';
  import { getSyncService } from '$lib/services/SyncService.js';
  import { exportMatchesToCsv } from '$lib/services/DataExportService.js';
  import { onMount } from 'svelte';

  let hasActiveToken = $state(false);
  let queuedMatchesCount = $state(0);
  let failedMatchesCount = $state(0);
  let retrySyncLoading = $state(false);
  
  let matchesCount = $state(0);
  let favoriteGame = $state('-');

  let view = $state('main'); // 'main' | 'edit-name' | 'edit-password' | 'edit-email' | 'delete-account'

  // Edit Name
  let editNameValue = $state('');
  let editNameLoading = $state(false);
  let editNameError = $state('');

  // Edit Password
  let oldPassword = $state('');
  let newPassword = $state('');
  let newPasswordConfirm = $state('');
  let editPasswordLoading = $state(false);
  let editPasswordError = $state('');

  // Edit Email
  let newEmail = $state('');
  let editEmailLoading = $state(false);
  let editEmailError = $state('');
  let editEmailSuccess = $state('');

  // Delete account
  let deletePassword = $state('');
  let deleteError = $state('');
  let deleteLoading = $state(false);

  $effect(() => {
    hasActiveToken = !!authService.getToken();
  });

  let defaultColor = $state('#6366f1');

  onMount(async () => {
    // Load default color from localStorage
    if (typeof localStorage !== 'undefined') {
      const savedColor = localStorage.getItem('bg_default_color');
      if (savedColor) {
        defaultColor = savedColor;
      }
    }
    const syncService = getSyncService();
    queuedMatchesCount = await syncService.getQueueSize();
    failedMatchesCount = await syncService.getFailedCount();

    const handleRefresh = async () => {
      hasActiveToken = !!authService.getToken();
      queuedMatchesCount = await syncService.getQueueSize();
      failedMatchesCount = await syncService.getFailedCount();
    };

    // Load Stats
    try {
      const user = get(currentUser);
      if (user) {
        const allMatches = await db.getAll('bg_matches');
        const userMatches = allMatches.filter(m => m.user === user.id);
        matchesCount = userMatches.length;
        
        if (matchesCount > 0) {
          const gameCounts = {};
          userMatches.forEach(m => {
            gameCounts[m.gameId] = (gameCounts[m.gameId] || 0) + 1;
          });
          const favGameId = Object.keys(gameCounts).reduce((a, b) => gameCounts[a] > gameCounts[b] ? a : b);
          const games = await db.getAll('bg_games_catalog') || [];
          const game = games.find(g => g.id === favGameId);
          favoriteGame = game ? game.name : favGameId;
        }
      }
    } catch (_) {}

    window.addEventListener('bg-refresh-data', handleRefresh);
    window.addEventListener('sync-queue-updated', handleRefresh);

    return () => {
      window.removeEventListener('bg-refresh-data', handleRefresh);
      window.removeEventListener('sync-queue-updated', handleRefresh);
    };
  });

  async function submitEditName(e) {
    e.preventDefault();
    editNameError = '';
    editNameLoading = true;
    try {
      const updated = await authService.updateProfile(get(currentUser).id, { name: editNameValue });
      currentUser.set(updated);
      await db.set('bg_user', updated);
      showToast('Name erfolgreich geändert!', 'success');
      view = 'main';
    } catch (err) {
      editNameError = formatUserError(err);
    } finally {
      editNameLoading = false;
    }
  }

  async function submitEditPassword(e) {
    e.preventDefault();
    editPasswordError = '';
    if (newPassword !== newPasswordConfirm) {
      editPasswordError = 'Neue Passwörter stimmen nicht überein.';
      return;
    }
    if (newPassword === oldPassword) {
      editPasswordError = 'Das neue Passwort darf nicht das alte Passwort sein.';
      return;
    }
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
    if (newPassword.length < 8 || !hasNumber || !hasSpecial) {
      editPasswordError = 'Das Passwort muss min. 8 Zeichen, eine Zahl und ein Sonderzeichen enthalten.';
      return;
    }
    editPasswordLoading = true;
    try {
      await authService.changePassword(get(currentUser).id, oldPassword, newPassword, newPasswordConfirm);
      showToast('Passwort erfolgreich geändert!', 'success');
      oldPassword = '';
      newPassword = '';
      newPasswordConfirm = '';
      view = 'main';
    } catch (err) {
      editPasswordError = formatUserError(err);
    } finally {
      editPasswordLoading = false;
    }
  }

  async function submitEditEmail(e) {
    e.preventDefault();
    editEmailError = '';
    editEmailSuccess = '';
    editEmailLoading = true;
    try {
      await authService.requestEmailChange(newEmail);
      editEmailSuccess = 'Bestätigungs-E-Mail wurde gesendet. Bitte überprüfe dein neues Postfach.';
      newEmail = '';
    } catch (err) {
      editEmailError = formatUserError(err);
    } finally {
      editEmailLoading = false;
    }
  }

  async function handleRetrySync() {
    retrySyncLoading = true;
    try {
      const ok = await getSyncService().retryPending();
      if (ok) {
        showToast('Alle Runden erfolgreich synchronisiert!', 'success');
      } else {
        showToast('Synchronisation weiterhin nicht möglich. Bitte später erneut versuchen.', 'error');
      }
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
    timerState.set('stopped');
    cachedMatches.set([]);

    // 4. Caches und lokale Daten bereinigen (IndexedDB & LocalStorage)
    await db.set('bg_user', null);
    await db.set('bg_matches', []); // Entferne sensible Match-Daten lokal
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('bg_active_session');
      localStorage.removeItem('bg_default_color');
    }

    // 5. Redirect & UI Feedback
    showToast('Erfolgreich abgemeldet.', 'info');
    navigateTo('game-selection');
  }

  async function handleExport() {
    const token = authService.getToken();
    const host = get(pocketbaseHost);
    if (!token) {
      showToast('Bitte melde dich erneut an, um zu exportieren. 🔒', 'error');
      return;
    }
    try {
      const user = get(currentUser);
      const matchesResp = await fetch(`${host}/api/collections/matches/records?perPage=500&filter=user='${user?.id}'`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const matchesData = await matchesResp.json();
      
      const gdprExportData = {
        exportDate: new Date().toISOString(),
        userProfile: {
          id: user?.id,
          name: user?.name,
          email: user?.email,
          created: user?.created
        },
        matches: matchesData.items || []
      };

      const blob = new Blob([JSON.stringify(gdprExportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr-data-export-${user?.name || 'spieler'}-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('GDPR Daten-Export erfolgreich abgeschlossen! 📥', 'success');
    } catch (e) {
      console.error(e);
      showToast('Export fehlgeschlagen.', 'error');
    }
  }

  async function handleCsvExport() {
    try {
      showToast('Export wird vorbereitet...', 'info');
      await exportMatchesToCsv();
      showToast('CSV Export erfolgreich! 📥', 'success');
    } catch (e) {
      console.error(e);
      showToast('CSV Export fehlgeschlagen: ' + e.message, 'error');
    }
  }

  function handleDeleteAccount() {
    view = 'delete-account';
    deletePassword = '';
    deleteError = '';
  }

  async function submitDeleteAccount(e) {
    e.preventDefault();
    deleteError = '';
    deleteLoading = true;
    const user = get(currentUser);
    if (!user?.id || !user?.email) {
      deleteError = 'Fehler: Benutzerdaten unvollständig.';
      deleteLoading = false;
      return;
    }
    try {
      const reAuth = await authService.login(user.email, deletePassword);
      await authService.deleteUser(user.id, reAuth.token);
      
      currentUser.set(null);
      authService.clearToken();
      await db.set('bg_user', null);
      
      showToast('Konto gelöscht. Auf Wiedersehen! 👋', 'info');
      navigateTo('game-selection');
    } catch (err) {
      console.error(err);
      deleteError = formatUserError(err);
    } finally {
      deleteLoading = false;
    }
  }
</script>

<div class="screen-container user-profile fade-in">
  <h1 class="sr-only">Nutzerprofil</h1>
  <div class="header-area">
    <button class="btn-back" onclick={() => navigateTo('game-selection')} aria-label="Zurück">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
    </button>
    <h2 class="screen-title">Nutzerprofil</h2>
  </div>

  {#if $isAuthenticated && $currentUser}
    <div class="profile-hero glass-panel">
      <div class="profile-avatar">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-primary);">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
      <div class="profile-info">
        <h3 class="profile-name">{$currentUser.name || 'Spieler'}</h3>
        <p class="profile-email">{$currentUser.email || ''}</p>
        {#if $currentUser.created}
          <span class="profile-joined">Mitglied seit {new Date($currentUser.created).toLocaleDateString('de-DE')}</span>
        {/if}
      </div>
      <button class="btn-edit-profile" onclick={() => { editNameValue = $currentUser.name; view = 'edit-name'; }} title="Profil bearbeiten">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
      </button>
    </div>

    <!-- Stats Section -->
    <div class="stats-grid">
      <div class="stat-card glass-panel">
        <span class="stat-value">{matchesCount}</span>
        <span class="stat-label">Gespeicherte Runden</span>
      </div>
      <div class="stat-card glass-panel">
        <span class="stat-value favorite-game-text" title={favoriteGame}>{favoriteGame}</span>
        <span class="stat-label">Lieblingsspiel</span>
      </div>
    </div>

    <!-- Sync Status Box -->
    <div class="status-section">
      {#if hasActiveToken}
        <div class="sync-status-box glass-panel active-sync">
          <div class="sync-box-header">
            <span class="sync-box-dot"></span>
            <span class="sync-box-title">Cloud-Backup aktiv</span>
          </div>
          <p class="sync-box-desc">Deine Spielrunden werden automatisch und verschlüsselt in der Cloud gesichert.</p>
          {#if queuedMatchesCount - failedMatchesCount > 0}
            <div class="queued-badge">
              {queuedMatchesCount - failedMatchesCount} Runde(n) warten auf Synchronisation
            </div>
          {/if}
          {#if failedMatchesCount > 0}
            <div class="queued-badge failed-badge">
              {failedMatchesCount} Runde(n) konnten nicht synchronisiert werden
            </div>
            <button type="button" class="btn btn-primary btn-retry-sync" onclick={handleRetrySync} disabled={retrySyncLoading}>
              {retrySyncLoading ? 'Synchronisiere…' : 'Erneut versuchen 🔄'}
            </button>
          {/if}
        </div>
      {:else}
        <div class="sync-status-box glass-panel inactive-sync">
          <div class="sync-box-header">
            <span class="sync-box-dot inactive"></span>
            <span class="sync-box-title">Sitzung abgelaufen</span>
          </div>
          <p class="sync-box-desc">
            Deine Cloud-Verbindung ist inaktiv. Bitte melde dich erneut an, um deine Runden zu sichern.
          </p>
          <button type="button" class="btn btn-primary btn-relogin" onclick={() => { handleLogout(); window.dispatchEvent(new CustomEvent('open-auth-modal')); }}>
            Jetzt neu anmelden 🔑
          </button>
        </div>
      {/if}
    </div>

    <!-- Actions Section -->
    <div class="actions-section glass-panel">
      {#if view === 'delete-account'}
        <form id="form-delete-confirm" class="auth-form" onsubmit={submitDeleteAccount}>
          <h3 class="danger-title">⚠️ Konto permanent löschen</h3>
          <p class="auth-form-subtitle">
            Diese Aktion kann nicht rückgängig gemacht werden. Alle Cloud-Backups deiner Spielrunden werden gelöscht. Bitte gib zur Bestätigung dein aktuelles Passwort ein:
          </p>

          {#if deleteError}
            <p class="auth-error">{deleteError}</p>
          {/if}

          <div class="form-group">
            <label for="delete-password">Aktuelles Passwort</label>
            <input type="password" id="delete-password" bind:value={deletePassword} required placeholder="••••••••">
          </div>

          <div class="auth-actions">
            <button type="submit" class="btn btn-danger" disabled={deleteLoading}>
              {deleteLoading ? 'Lösche Konto...' : 'Konto unwiderruflich löschen'}
            </button>
            <button type="button" class="btn btn-secondary" onclick={() => view = 'main'}>
              Abbrechen
            </button>
          </div>
        </form>
      {:else if view === 'edit-name'}
        <form id="form-edit-name" class="auth-form" onsubmit={submitEditName}>
          <h3 class="form-title">Anzeigename ändern</h3>
          {#if editNameError}
            <p class="auth-error">{editNameError}</p>
          {/if}
          <div class="form-group">
            <label for="edit-name">Neuer Anzeigename</label>
            <input type="text" id="edit-name" bind:value={editNameValue} required>
          </div>
          <div class="auth-actions">
            <button type="submit" class="btn btn-primary" disabled={editNameLoading}>
              {editNameLoading ? 'Speichere...' : 'Speichern'}
            </button>
            <button type="button" class="btn btn-secondary" onclick={() => view = 'main'}>Abbrechen</button>
          </div>
        </form>
      {:else if view === 'edit-password'}
        <form id="form-edit-password" class="auth-form" onsubmit={submitEditPassword}>
          <h3 class="form-title">Passwort ändern</h3>
          {#if editPasswordError}
            <p class="auth-error">{editPasswordError}</p>
          {/if}
          <div class="form-group">
            <label for="old-password">Aktuelles Passwort</label>
            <input type="password" id="old-password" bind:value={oldPassword} required>
          </div>
          <div class="form-group">
            <label for="new-password">Neues Passwort (min. 8 Zeichen)</label>
            <input type="password" id="new-password" bind:value={newPassword} required minlength="8">
          </div>
          <div class="form-group">
            <label for="new-password-confirm">Neues Passwort bestätigen</label>
            <input type="password" id="new-password-confirm" bind:value={newPasswordConfirm} required minlength="8">
          </div>
          <div class="auth-actions">
            <button type="submit" class="btn btn-primary" disabled={editPasswordLoading}>
              {editPasswordLoading ? 'Speichere...' : 'Passwort ändern'}
            </button>
            <button type="button" class="btn btn-secondary" onclick={() => view = 'main'}>Abbrechen</button>
          </div>
        </form>
      {:else if view === 'edit-email'}
        <form id="form-edit-email" class="auth-form" onsubmit={submitEditEmail}>
          <h3 class="form-title">E-Mail Adresse ändern</h3>
          <p class="auth-form-subtitle">Du erhältst eine Bestätigungs-E-Mail an die neue Adresse.</p>
          {#if editEmailError}
            <p class="auth-error">{editEmailError}</p>
          {/if}
          {#if editEmailSuccess}
            <p class="auth-error" style="background: rgba(16, 185, 129, 0.1); border-color: var(--color-success); color: var(--color-success);">{editEmailSuccess}</p>
          {/if}
          <div class="form-group">
            <label for="new-email">Neue E-Mail Adresse</label>
            <input type="email" id="new-email" bind:value={newEmail} required>
          </div>
          <div class="auth-actions">
            <button type="submit" class="btn btn-primary" disabled={editEmailLoading}>
              {editEmailLoading ? 'Sende Anfrage...' : 'Änderung anfragen'}
            </button>
            <button type="button" class="btn btn-secondary" onclick={() => view = 'main'}>Zurück</button>
          </div>
        </form>
      {:else if view === 'edit-preferences'}
        <form id="form-edit-preferences" class="auth-form" onsubmit={(e) => { e.preventDefault(); if(typeof localStorage !== 'undefined') localStorage.setItem('bg_default_color', defaultColor); showToast('Präferenzen gespeichert!', 'success'); view = 'main'; }}>
          <h3 class="form-title">App- & Spieler-Präferenzen</h3>
          <p class="auth-form-subtitle">Lege deine Standard-Spielerfarbe für neue Partien fest.</p>
          <div class="form-group" style="flex-direction: row; align-items: center; justify-content: space-between;">
            <label for="default-color">Standard-Farbe</label>
            <input type="color" id="default-color" bind:value={defaultColor} style="width: 50px; height: 40px; padding: 2px; cursor: pointer;">
          </div>
          <div class="auth-actions">
            <button type="submit" class="btn btn-primary">Speichern</button>
            <button type="button" class="btn btn-secondary" onclick={() => view = 'main'}>Zurück</button>
          </div>
        </form>
      {:else}
        <div class="action-grid">
          <button type="button" class="action-btn" onclick={() => view = 'edit-password'}>
            <span class="icon-wrapper bg-blue">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </span>
            <span class="btn-label">Passwort ändern</span>
          </button>
          
          <button type="button" class="action-btn" onclick={() => view = 'edit-email'}>
            <span class="icon-wrapper bg-blue">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            </span>
            <span class="btn-label">E-Mail ändern</span>
          </button>

          <button type="button" class="action-btn" onclick={() => view = 'edit-preferences'}>
            <span class="icon-wrapper bg-blue" style="background: linear-gradient(135deg, {defaultColor}, #222);">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
              </svg>
            </span>
            <span class="btn-label">Farbe festlegen</span>
          </button>

          <button type="button" class="action-btn" onclick={() => navigateTo('settings')}>
            <span class="icon-wrapper bg-blue">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </span>
            <span class="btn-label">App-Einstellungen</span>
          </button>
          
          <button type="button" class="action-btn" onclick={handleExport}>
            <span class="icon-wrapper bg-green">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </span>
            <span class="btn-label">GDPR Export</span>
          </button>

          <button type="button" class="action-btn" onclick={handleCsvExport}>
            <span class="icon-wrapper bg-green">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="8" y1="13" x2="16" y2="13"></line>
                <line x1="8" y1="17" x2="16" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </span>
            <span class="btn-label">CSV Export</span>
          </button>
          
          <button type="button" class="action-btn" onclick={handleDeleteAccount}>
            <span class="icon-wrapper bg-red">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </span>
            <span class="btn-label">Konto löschen</span>
          </button>
          
          <button type="button" class="action-btn" onclick={handleLogout}>
            <span class="icon-wrapper bg-gray">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </span>
            <span class="btn-label">Abmelden</span>
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="empty-state glass-panel">
      <p>Du bist nicht angemeldet.</p>
      <button type="button" class="btn btn-primary" onclick={() => navigateTo('profile')}>
        Anmelden oder Registrieren 🔑
      </button>
    </div>
  {/if}
</div>

<style>
  .user-profile {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 20px 16px;
    max-width: 680px;
    margin: 0 auto;
    width: 100%;
  }

  .header-area {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-back {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-primary);
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-back:hover { background: rgba(255, 255, 255, 0.1); }

  .screen-title {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 800;
    margin: 0;
  }

  .profile-hero {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 24px;
    border-radius: 20px;
  }

  .profile-avatar {
    width: 80px;
    height: 80px;
    background-color: rgba(99,102,241,0.15);
    border: 1px solid rgba(99,102,241,0.3);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
  }

  .profile-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
  }

  .profile-name {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 1.6rem;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .profile-email {
    margin: 0;
    font-size: 0.95rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .profile-joined {
    margin-top: 4px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    opacity: 0.8;
  }

  .btn-edit-profile {
    margin-left: auto;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-secondary);
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-edit-profile:hover {
    background: rgba(255,255,255,0.1);
    color: var(--color-primary);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    gap: 8px;
    border-radius: 16px;
  }

  .stat-value {
    font-family: var(--font-heading);
    font-size: 1.8rem;
    font-weight: 800;
    color: var(--color-primary);
    line-height: 1;
  }

  .favorite-game-text {
    font-size: 1.1rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    text-align: center;
  }

  .stat-label {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
  }

  .sync-status-box {
    padding: 16px 20px;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .active-sync {
    border-color: rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.05);
  }

  .inactive-sync {
    border-color: rgba(245, 158, 11, 0.35);
    background: rgba(245, 158, 11, 0.05);
    box-shadow: 0 8px 24px rgba(245, 158, 11, 0.08);
  }

  .sync-box-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sync-box-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    background-color: var(--color-success);
    box-shadow: 0 0 8px var(--color-success);
  }

  .sync-box-dot.inactive {
    background-color: #f59e0b;
    box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
  }

  .sync-box-title {
    font-family: var(--font-heading);
    font-size: 1rem;
    font-weight: 700;
  }

  .inactive-sync .sync-box-title { color: #f59e0b; }

  .sync-box-desc {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .queued-badge {
    margin-top: 4px;
    font-size: 0.8rem;
    color: var(--color-warning);
    font-weight: 700;
  }

  .failed-badge {
    color: #ef4444;
  }

  .btn-retry-sync {
    margin-top: 8px;
    width: 100%;
  }

  .btn-relogin {
    margin-top: 8px;
    width: 100%;
    background-color: #f59e0b;
    color: #fff;
  }

  .actions-section {
    padding: 20px;
    border-radius: 20px;
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--color-border-glass);
    padding: 20px 10px;
    border-radius: 16px;
    cursor: pointer;
    transition: var(--transition-normal);
  }

  .action-btn:hover {
    background: rgba(255,255,255,0.08);
    transform: translateY(-2px);
  }

  .action-btn:active {
    transform: scale(0.96);
  }

  .icon-wrapper {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
  }

  .bg-blue { background: linear-gradient(135deg, #6366f1, #4f46e5); }
  .bg-green { background: linear-gradient(135deg, #10b981, #059669); }
  .bg-red { background: linear-gradient(135deg, #ef4444, #dc2626); }
  .bg-gray { background: linear-gradient(135deg, #6b7280, #4b5563); }

  .btn-label {
    font-family: var(--font-heading);
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-title {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 1.2rem;
  }

  .danger-title {
    margin: 0;
    color: var(--color-danger);
    font-family: var(--font-heading);
    font-size: 1.2rem;
  }

  .auth-form-subtitle {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
    margin: 0;
  }

  .auth-error {
    font-size: 0.85rem;
    color: var(--color-danger);
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 8px;
    padding: 10px 14px;
    margin: 0;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
  }

  .form-group label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .form-group input {
    background-color: rgba(0,0,0,0.25);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-primary);
    font-size: 1rem;
    padding: 12px;
    border-radius: 12px;
    transition: var(--transition-normal);
  }

  .form-group input:focus {
    border-color: var(--color-primary);
    background-color: rgba(0,0,0,0.35);
    outline: none;
  }

  .auth-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 8px;
  }

  .empty-state {
    padding: 40px;
    text-align: center;
    color: var(--color-text-secondary);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  @media (max-width: 480px) {
    .profile-hero {
      padding: 16px;
      gap: 16px;
    }
    .profile-avatar {
      width: 64px; height: 64px;
    }
    .profile-name { font-size: 1.4rem; }
    .action-grid { gap: 12px; }
    .action-btn { padding: 16px 8px; }
  }
</style>
