import { isOnline, timerState, currentUser, settings, authService, showToast, navigateTo, currentGame, timerText, timerElapsedSeconds } from '$lib/stores/app.js';
import { getSyncService } from '$lib/services/SyncService.js';
import { db } from '$lib/services/DbService.js';
import { HapticService } from '$lib/services/HapticService.js';
import { currentRoute } from '$lib/router/router.js';
import { get } from 'svelte/store';

class LifecycleManager {
  constructor() {
    this.inactivityTimer = null;
    this.activityEvents = ['pointerdown', 'keydown', 'scroll', 'click'];
  }

  init() {
    this.setupNetworkDetection();
    this.setupGlobalClick();
    this.setupSyncAutomations();
    this.setupInactivityLogout();
    this.setupBeforeUnload();
    this.recoverTimerOnStart();
  }

  destroy() {
    window.removeEventListener('online', this.updateOnline);
    window.removeEventListener('offline', this.updateOnline);
    window.removeEventListener('click', this.handleGlobalClick);
    window.removeEventListener('sync-queue-updated', this.updateAppBadge);
    window.removeEventListener('online', this.handleOnlineSync);
    window.removeEventListener('offline', this.handleOfflineAlert);
    if (this.handleBeforeUnload) {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    this.activityEvents.forEach(evt => window.removeEventListener(evt, this.resetInactivityTimer));
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
  }

  recoverTimerOnStart() {
    if (typeof localStorage !== 'undefined') {
      const storedState = localStorage.getItem('bg_timer_state');
      const storedGame = localStorage.getItem('bg_timer_current_game');
      if (storedState && storedState !== 'stopped' && storedGame) {
        console.log(`🔌 AppLifecycleService: Re-activating timer for game "${storedGame}"`);
        currentGame.set(storedGame);
        timerState.set(/** @type {'running'|'paused'} */ (storedState));
        // R06: Deep Links (z. B. #/wiki/…) nicht überschreiben — nur von der Startseite zur Partie springen.
        const routeName = get(currentRoute)?.name ?? 'home';
        if (routeName === 'home') navigateTo('game-timer', { replace: true });
      }
    }
  }

  setupBeforeUnload() {
    if (typeof window !== 'undefined') {
      this.handleBeforeUnload = (e) => {
        let state = 'stopped';
        timerState.subscribe(s => { state = s; })();
        if (state === 'running' || state === 'paused') {
          e.preventDefault();
          e.returnValue = 'Ein Spiel läuft aktuell. Möchtest du die Seite wirklich verlassen?';
          return e.returnValue;
        }
      };
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }
  }

  setupNetworkDetection() {
    this.updateOnline = () => isOnline.set(navigator.onLine);
    window.addEventListener('online', this.updateOnline);
    window.addEventListener('offline', this.updateOnline);
  }

  setupGlobalClick() {
    this.handleGlobalClick = (e) => {
      let target = e.target;
      while (target && target !== document.body) {
        if (
          target.tagName === 'BUTTON' ||
          target.tagName === 'A' ||
          target.getAttribute('role') === 'button'
        ) {
          HapticService.lightTap();
          break;
        }
        target = target.parentElement;
      }
    };
    window.addEventListener('click', this.handleGlobalClick);
  }

  setupSyncAutomations() {
    this.updateAppBadge = (e) => {
      const size = e.detail?.size || 0;
      if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
        try {
          if (size > 0) navigator.setAppBadge(size);
          else navigator.clearAppBadge();
        } catch (_) {}
      }
    };
    window.addEventListener('sync-queue-updated', this.updateAppBadge);

    this.handleOnlineSync = async () => {
      if (navigator.onLine) {
        const syncService = getSyncService();
        const size = await syncService.getQueueSize();
        if (size > 0) {
          showToast('Internetverbindung wiederhergestellt! Synchronisiere Matches... ☁️', 'info');
          const success = await syncService.triggerSync();
          if (success) {
            showToast('Alle Runden erfolgreich hochgeladen! 🎉', 'success');
            window.dispatchEvent(new CustomEvent('bg-refresh-data'));
          }
        }
      }
    };
    window.addEventListener('online', this.handleOnlineSync);

    this.handleOfflineAlert = async () => {
      if (!navigator.onLine) {
        const syncService = getSyncService();
        const size = await syncService.getQueueSize();
        if (size > 0) {
          showToast(`Offline! Du hast ${size} un-synchronisierte Matches. 💾`, 'warning', 5000);
        }
      }
    };
    window.addEventListener('offline', this.handleOfflineAlert);

    // Initial badge
    const initBadge = async () => {
      const syncService = getSyncService();
      const size = await syncService.getQueueSize();
      if (size > 0 && typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
        try { navigator.setAppBadge(size); } catch (_) {}
      }
    };
    initBadge();
  }

  setupInactivityLogout() {
    this.resetInactivityTimer = () => {
      if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
      if (!get(currentUser)) return;
      
      // Default 0 = nie ausloggen (konsistent zum Store-Default in stores/app.js).
      // Auto-Logout greift nur, wenn der Nutzer in den Einstellungen aktiv eine
      // Dauer (15/30/60/240 Min) gewählt hat.
      let minutes = 0;
      settings.subscribe(s => { minutes = s.inactivityLogoutMinutes ?? 0; })();
      if (minutes === 0) return;
      
      this.inactivityTimer = setTimeout(async () => {
        if (get(timerState) !== 'stopped') {
          this.resetInactivityTimer();
          return;
        }
        currentUser.set(null);
        authService.clearToken();
        await db.set('bg_user', null);
        showToast('Wegen Inaktivität abgemeldet. 🔒', 'info');
      }, minutes * 60 * 1000);
    };

    this.activityEvents.forEach(evt => window.addEventListener(evt, this.resetInactivityTimer, { passive: true }));
    this.resetInactivityTimer();
  }
}

export const AppLifecycleService = new LifecycleManager();
