import { isOnline, activeScreen, timerState, currentUser, settings, authService, showToast, navigateTo, currentGame, timerText, timerElapsedSeconds } from '$lib/stores/app.js';
import { getSyncService } from '$lib/services/SyncService.js';
import { db } from '$lib/services/DbService.js';
import { HapticService } from '$lib/services/HapticService.js';
import { get } from 'svelte/store';

class LifecycleManager {
  constructor() {
    this.inactivityTimer = null;
    this.activityEvents = ['pointerdown', 'keydown', 'scroll', 'click'];
  }

  init() {
    this.setupNetworkDetection();
    this.setupGlobalClick();
    this.setupSwipeGestures();
    this.setupSyncAutomations();
    this.setupInactivityLogout();
    this.setupBeforeUnload();
    this.recoverTimerOnStart();
  }

  destroy() {
    window.removeEventListener('online', this.updateOnline);
    window.removeEventListener('offline', this.updateOnline);
    window.removeEventListener('click', this.handleGlobalClick);
    window.removeEventListener('touchstart', this.handleSwipeStart);
    window.removeEventListener('touchend', this.handleSwipeEnd);
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
        navigateTo('game-timer');
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

  setupSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    
    this.handleSwipeStart = (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    };
    
    this.handleSwipeEnd = (e) => {
      const diffX = e.changedTouches[0].screenX - touchStartX;
      const diffY = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 80) {
        const tabs = ['game-selection', 'game-timer', 'match-history', 'profile'];
        const screen = get(activeScreen);
        // 'user-profile' ist die eingeloggte Variante des 'profile'-Tabs und teilt
        // sich dessen Navigationsposition — sonst wäre von dort kein Zurückwischen möglich.
        const currentIdx = screen === 'user-profile' ? tabs.indexOf('profile') : tabs.indexOf(screen);
        // Eingeloggte Nutzer auf den echten Profil-Screen leiten statt auf das Login-Formular.
        const resolveTab = (tab) => (tab === 'profile' && get(currentUser)) ? 'user-profile' : tab;
        if (currentIdx !== -1) {
          if (diffX > 0 && currentIdx > 0) {
            HapticService.lightTap();
            navigateTo(resolveTab(tabs[currentIdx - 1]));
          } else if (diffX < 0 && currentIdx < tabs.length - 1) {
            HapticService.lightTap();
            navigateTo(resolveTab(tabs[currentIdx + 1]));
          }
        }
      }
    };
    
    window.addEventListener('touchstart', this.handleSwipeStart, { passive: true });
    window.addEventListener('touchend', this.handleSwipeEnd, { passive: true });
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
