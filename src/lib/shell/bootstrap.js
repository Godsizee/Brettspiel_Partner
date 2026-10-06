// @ts-check
/**
 * Wörtlich aus App.svelte (vor R07) übernommener App-Start: Onboarding-Check,
 * Session-Wiederherstellung, E-Mail-/Token-Aktionen, Lifecycle-Init, Katalog-Laden.
 * Dazu die Timer-Wiederherstellung (R11).
 */
import { db, pullProfilesFromRemote } from '$lib/services/DbService.js';
import { getSyncService } from '$lib/services/SyncService.js';
import { AppLifecycleService } from '$lib/services/AppLifecycleService.js';
import { loadGamesCatalog } from '$lib/services/GamesCatalogService.js';
import { loadWikiCatalog } from '$lib/services/WikiService.js';
import { currentUser, authService, showToast, navigateTo, promptDialog, loadPlayerProfiles } from '$lib/stores/app.js';
import { recoverMatchTimer } from '$lib/stores/matchTimer.js';
import { ui } from './ui.svelte.js';

export async function bootstrapApp() {
  // Check onboarding status
  const onboardingCompleted = localStorage.getItem('bg_onboarding_completed');
  if (!onboardingCompleted) {
    ui.onboardingOpen = true;
  }

  // Restore cached user from db
  try {
    const cachedUser = await db.get('bg_user');
    if (cachedUser) {
      currentUser.set(cachedUser);
      if (authService.getToken()) {
        authService.refresh().then(async () => {
          await pullProfilesFromRemote();
          await loadPlayerProfiles();
          // Beim App-Start (bereits online) feuert kein 'online'-Event, daher
          // die Offline-Queue hier aktiv leeren — sonst blieben Spielstände aus
          // einer früheren Offline-Sitzung bis zur nächsten Aktion liegen.
          try {
            await getSyncService().triggerSync();
          } catch (_) {}
        }).catch((err) => {
          const isNetworkError = err.name === 'AbortError' ||
                                 err.message.includes('Failed to fetch') ||
                                 err.message.includes('Timeout') ||
                                 err.message.includes('network') ||
                                 (typeof navigator !== 'undefined' && !navigator.onLine);
          if (!isNetworkError) {
            window.dispatchEvent(new CustomEvent('auth-session-expired'));
          } else {
            console.log('📡 Silent refresh failed due to network, keeping cached user offline.');
          }
        });
      } else if (navigator.onLine) {
        // Gecachte Identität, aber kein (Cookie-)Token mehr und online: Die Sitzung
        // ist real abgelaufen (ein PocketBase-Refresh braucht ein gültiges Token).
        // Konsistent über denselben Pfad wie ein fehlgeschlagener Refresh beenden,
        // statt einen "Geist-Login" ohne funktionierende Synchronisierung anzuzeigen.
        window.dispatchEvent(new CustomEvent('auth-session-expired'));
      }
      // Offline ohne Token: gecachte Identität für die Offline-Anzeige behalten.
    }
  } catch (_) {}

  // Handle incoming email/token-actions from email templates
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const passwordResetToken = urlParams.get('passwordResetToken');
  const emailChangeToken = urlParams.get('emailChangeToken');

  if (token) {
    showToast('Verifiziere E-Mail-Adresse... 📡', 'info', 3000);
    try {
      await authService.confirmVerification(token);
      showToast('E-Mail-Adresse erfolgreich verifiziert! 🎉 Du kannst dich jetzt anmelden.', 'success', 6000);
      navigateTo('profile');
    } catch (err) {
      showToast(`Verifizierung fehlgeschlagen: ${err.message}`, 'error', 6000);
    }
    // Query-Parameter (Token) entfernen, aber den Routen-Hash (#/wiki/…) erhalten
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }

  if (passwordResetToken) {
    const newPassword = await promptDialog('Bitte gib dein neues Passwort ein (min. 8 Zeichen, min. 1 Zahl, min. 1 Sonderzeichen):', 'Neues Passwort', true);
    if (newPassword) {
      const hasNumber = /\d/.test(newPassword);
      const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
      if (newPassword.length < 8 || !hasNumber || !hasSpecial) {
        showToast('Das Passwort muss min. 8 Zeichen, eine Zahl und ein Sonderzeichen enthalten.', 'error', 5000);
      } else {
        const newPasswordConfirm = await promptDialog('Bitte bestätige dein neues Passwort:', 'Passwort bestätigen', true);
        if (newPassword === newPasswordConfirm) {
          showToast('Setze Passwort zurück... 📡', 'info', 3000);
          try {
            await authService.confirmPasswordReset(passwordResetToken, newPassword, newPasswordConfirm);
            showToast('Passwort erfolgreich geändert! 🎉 Du kannst dich jetzt anmelden.', 'success', 6000);
            navigateTo('profile');
          } catch (err) {
            showToast(`Passwort-Reset fehlgeschlagen: ${err.message}`, 'error', 6000);
          }
        } else {
          showToast('Die Passwörter stimmen nicht überein.', 'error', 5000);
        }
      }
    }
    // Query-Parameter (Token) entfernen, aber den Routen-Hash (#/wiki/…) erhalten
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }

  if (emailChangeToken) {
    const password = await promptDialog('Bitte gib dein aktuelles Passwort ein, um die Änderung deiner E-Mail-Adresse zu bestätigen:', 'E-Mail bestätigen', true);
    if (password) {
      showToast('Bestätige E-Mail-Änderung... 📡', 'info', 3000);
      try {
        await authService.confirmEmailChange(emailChangeToken, password);
        showToast('E-Mail-Adresse erfolgreich geändert! 🎉 Bitte melde dich neu an.', 'success', 6000);
        currentUser.set(null);
        authService.clearToken();
        await db.set('bg_user', null);
        navigateTo('profile');
      } catch (err) {
        showToast(`E-Mail-Änderung fehlgeschlagen: ${err.message}`, 'error', 6000);
      }
    }
    // Query-Parameter (Token) entfernen, aber den Routen-Hash (#/wiki/…) erhalten
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }

  // Laufende Partie wiederherstellen, bevor der Lifecycle-Service den Zustand liest (R11, S21).
  recoverMatchTimer();
  AppLifecycleService.init();

  // Spiele-Katalog laden (fire-and-forget, P2.2)
  loadGamesCatalog().catch(error => {
    console.error('❌ Spiele-Katalog konnte nicht geladen werden:', error);
    showToast('Spiele-Katalog konnte nicht geladen werden. Offline? 🌐', 'error', 5000);
  });

  // Wiki-Katalog laden (fire-and-forget, P2.2)
  loadWikiCatalog().catch(error => {
    console.warn('⚠️ Wiki-Katalog konnte nicht geladen werden:', error);
  });

  const handleOpenAuthModal = () => { ui.authOpen = true; };
  window.addEventListener('open-auth-modal', handleOpenAuthModal);

  document.body.classList.add('app-initialized');
  document.body.setAttribute('data-initialized', 'true');
  console.log('🚀 Boardgame Companion (Svelte) fully initialized!');

  return () => {
    AppLifecycleService.destroy();
    window.removeEventListener('open-auth-modal', handleOpenAuthModal);
  };
}
