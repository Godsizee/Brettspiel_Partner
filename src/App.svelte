<script>
  import { onMount } from 'svelte';
  import { activeScreen, isOnline, applyTheme, currentGame, showToast, navigateTo, timerState, timerText, currentUser, settings, authService, pwaInstallEvent, isAdmin, loadPlayerProfiles, wikiActive } from '$lib/stores/app.js';
  import { loadGamesCatalog } from '$lib/services/GamesCatalogService.js';
  import { loadWikiCatalog } from '$lib/services/WikiService.js';
  import { get } from 'svelte/store';
  import { db, pullProfilesFromRemote } from '$lib/services/DbService.js';
  import { HapticService } from '$lib/services/HapticService.js';
  import { AppLifecycleService } from '$lib/services/AppLifecycleService.js';
  import { trapFocus } from '$lib/utils/a11y.js';
  import { getSyncService } from '$lib/services/SyncService.js';

  import Header from '$lib/components/Header.svelte';
  import GameSelection from '$lib/components/GameSelection.svelte';
  import GameDashboard from '$lib/components/GameDashboard.svelte';
  import GameTimer from '$lib/components/GameTimer.svelte';
  import PlayerSetup from '$lib/components/PlayerSetup.svelte';
  import ScoreSheet from '$lib/components/ScoreSheet.svelte';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import StartPlayerModal from '$lib/components/StartPlayerModal.svelte';
  import Onboarding from '$lib/components/Onboarding.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import GlobalDialog from '$lib/components/GlobalDialog.svelte';
  import { promptDialog } from '$lib/stores/app.js';

  let authModalOpen = $state(false);
  let startPlayerModalOpen = $state(false);
  let impressumOpen = $state(false);
  let privacyOpen = $state(false);







  let showOnboarding = $state(false);

  // Netzwerkerkennung
  onMount(async () => {
    // Check onboarding status
    const onboardingCompleted = localStorage.getItem('bg_onboarding_completed');
    if (!onboardingCompleted) {
      showOnboarding = true;
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

    const handleOpenAuthModal = () => { authModalOpen = true; };
    window.addEventListener('open-auth-modal', handleOpenAuthModal);

    document.body.classList.add('app-initialized');
    document.body.setAttribute('data-initialized', 'true');
    console.log('🚀 Boardgame Companion (Svelte) fully initialized!');

    return () => {
      AppLifecycleService.destroy();
      window.removeEventListener('open-auth-modal', handleOpenAuthModal);
    };
  });

  // PWA Install Prompt Banner (U9)
  let showPwaBanner = $state(true);

  async function triggerPwaInstall() {
    HapticService.lightTap();
    const e = get(pwaInstallEvent);
    if (!e) return;
    e.prompt();
    const choiceResult = await e.userChoice;
    console.log(`PWA choice outcome: ${choiceResult.outcome}`);
    pwaInstallEvent.set(null); // Clear
  }

  function dismissPwaBanner() {
    HapticService.lightTap();
    showPwaBanner = false;
  }
  import { cubicOut } from 'svelte/easing';

  function pageTransition(node, { type, duration = 280, easing = cubicOut }) {
    const isBack = typeof document !== 'undefined' && document.documentElement.dataset.transitionDir === 'backward';
    let startX = 0;
    if (type === 'in') {
      startX = isBack ? -36 : 36;
    } else {
      startX = isBack ? 28 : -28;
    }
    return {
      duration,
      easing,
      css: (t) => {
        const opacity = 0.6 + t * 0.4;
        const scale = 0.97 + t * 0.03;
        const x = (1 - t) * startX;
        return `opacity: ${opacity}; transform: translate3d(${x}px, 0, 0) scale(${scale});`;
      }
    };
  }
</script>
<!-- Ambient Backdrop Orbs -->
<div class="backdrop-glow">
  <div class="glow-orb orb-primary"></div>
  <div class="glow-orb orb-secondary"></div>
</div>

<div class="app-shell">


  <!-- PWA Install Prompt Banner (U9) -->
  {#if $pwaInstallEvent && showPwaBanner}
    <div class="pwa-install-banner glass-panel animate-scale-up" id="pwa-install-banner">
      <div class="pwa-banner-icon">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-primary);">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </div>
      <div class="pwa-banner-info">
        <h4 class="pwa-banner-title">Als App installieren</h4>
        <p class="pwa-banner-desc">Nutze den Begleiter schneller und offline direkt vom Homescreen!</p>
      </div>
      <div class="pwa-banner-actions">
        <button class="btn btn-primary btn-sm" onclick={triggerPwaInstall}>Installieren</button>
        <button class="btn btn-secondary btn-sm" onclick={dismissPwaBanner}>Später</button>
      </div>
    </div>
  {/if}

  <Header
    onopenAuth={() => authModalOpen = true}
    onopenHistory={() => { navigateTo('match-history'); }}
  />

  {#if $wikiActive}
    <main class="wiki-viewport">
      {#await import('$lib/components/wiki/WikiApp.svelte') then { default: WikiApp }}
        <WikiApp />
      {/await}
    </main>
  {:else}
    <main class="app-main">
      {#if $activeScreen === 'game-selection'}
      <section id="screen-game-selection" class="app-screen" in:pageTransition={{ type: 'in', duration: 280 }} out:pageTransition={{ type: 'out', duration: 240 }}>
        <GameSelection onopenStartPlayer={() => startPlayerModalOpen = true} />
      </section>
    {/if}

    {#if $activeScreen === 'game-dashboard'}
      <section id="screen-game-dashboard" class="app-screen" in:pageTransition={{ type: 'in', duration: 280 }} out:pageTransition={{ type: 'out', duration: 240 }}>
        <GameDashboard onopenStartPlayer={() => startPlayerModalOpen = true} />
      </section>
    {/if}

    {#if $activeScreen === 'game-timer'}
      <section id="screen-game-timer" class="app-screen" in:pageTransition={{ type: 'in', duration: 280 }} out:pageTransition={{ type: 'out', duration: 240 }}>
        <GameTimer onopenStartPlayer={() => startPlayerModalOpen = true} />
      </section>
    {/if}

    {#if $activeScreen === 'player-setup'}
      <section id="screen-player-setup" class="app-screen" in:pageTransition={{ type: 'in', duration: 280 }} out:pageTransition={{ type: 'out', duration: 240 }}>
        <PlayerSetup />
      </section>
    {/if}

    {#if $activeScreen === 'score-sheet'}
      <section id="screen-score-sheet" class="app-screen" in:pageTransition={{ type: 'in', duration: 280 }} out:pageTransition={{ type: 'out', duration: 240 }}>
        <ScoreSheet />
      </section>
    {/if}

    {#if $activeScreen === 'match-history'}
      <section id="screen-match-history" class="app-screen" in:pageTransition={{ type: 'in', duration: 280 }} out:pageTransition={{ type: 'out', duration: 240 }}>
        {#await import('$lib/components/MatchHistory.svelte') then { default: MatchHistory }}
          <MatchHistory onclose={() => navigateTo('game-selection')} />
        {/await}
      </section>
    {/if}

    {#if $activeScreen === 'stats'}
      <section id="screen-stats" class="app-screen" in:pageTransition={{ type: 'in', duration: 280 }} out:pageTransition={{ type: 'out', duration: 240 }}>
        {#await import('$lib/components/StatsDashboard.svelte') then { default: StatsDashboard }}
          <StatsDashboard />
        {/await}
      </section>
    {/if}

    {#if $activeScreen === 'profile'}
      <section id="screen-profile" class="app-screen" in:pageTransition={{ type: 'in', duration: 280 }} out:pageTransition={{ type: 'out', duration: 240 }}>
        <AuthModal inline={true} />
      </section>
    {/if}

    {#if $activeScreen === 'settings'}
      <section id="screen-settings" class="app-screen" in:pageTransition={{ type: 'in', duration: 280 }} out:pageTransition={{ type: 'out', duration: 240 }}>
        {#await import('$lib/components/Settings.svelte') then { default: Settings }}
          <Settings />
        {/await}
      </section>
    {/if}

    {#if $activeScreen === 'custom-game-editor'}
      <section id="screen-custom-game-editor" class="app-screen" in:pageTransition={{ type: 'in', duration: 280 }} out:pageTransition={{ type: 'out', duration: 240 }}>
        {#await import('$lib/components/CustomGameEditor.svelte') then { default: CustomGameEditor }}
          <CustomGameEditor />
        {/await}
      </section>
    {/if}

    {#if $isAdmin && $activeScreen === 'admin-review'}
      <section id="screen-admin-review" class="app-screen" in:pageTransition={{ type: 'in', duration: 280 }} out:pageTransition={{ type: 'out', duration: 240 }}>
        {#await import('$lib/components/AdminReview.svelte') then { default: AdminReview }}
          <AdminReview />
        {/await}
      </section>
    {/if}


    {#if $activeScreen === 'user-profile'}
      <section id="screen-user-profile" class="app-screen" in:pageTransition={{ type: 'in', duration: 280 }} out:pageTransition={{ type: 'out', duration: 240 }}>
        {#await import('$lib/components/UserProfile.svelte') then { default: UserProfile }}
          <UserProfile />
        {/await}
      </section>
    {/if}
  </main>
  {/if}

  <footer class="app-footer" class:app-footer--flow={$wikiActive}>
    <div class="footer-content">
      <div class="footer-links">
        <a href="#impressum" onclick={(e) => { e.preventDefault(); impressumOpen = true; }}>Impressum</a>
        <span class="sep">|</span>
        <a href="#datenschutz" onclick={(e) => { e.preventDefault(); privacyOpen = true; }}>Datenschutzerklärung</a>
      </div>
      <p>© 2026 Boardgame Companion. Local-First & DSGVO-konform.</p>
    </div>
  </footer>

  <BottomNav />
</div>

<svelte:window onkeydown={(e) => {
  if (e.key === 'Escape') {
    impressumOpen = false;
    privacyOpen = false;
  }
}} />

<!-- Modals & Overlays -->
{#if showOnboarding}
  <Onboarding onComplete={(opts) => { showOnboarding = false; if (opts?.wantsAuth) authModalOpen = true; }} />
{/if}

<AuthModal bind:open={authModalOpen} />
<StartPlayerModal bind:open={startPlayerModalOpen} />
<GlobalDialog />
<Toast />

<!-- 4d: Floating Timer Pill -->
{#if $activeScreen !== 'game-timer' && $timerState !== 'stopped' && $currentGame}
  <button class="timer-float-pill" id="timer-float-pill"
    aria-label="Laufender Timer – zurück zum Timer-Screen"
    onclick={() => navigateTo('game-timer')}>
    <span class="pill-dot" class:pill-dot--running={$timerState === 'running'}></span>
    <span class="pill-time">{$timerText}</span>
    <span class="pill-label">⏱</span>
  </button>
{/if}

<!-- Impressum Modal -->
<div class="overlay-backdrop" class:active={impressumOpen} id="impressum-modal"
  role="dialog" aria-modal="true" aria-label="Impressum">
  <button class="overlay-backdrop-close" aria-label="Schließen" tabindex="-1" onclick={() => impressumOpen = false}></button>
  <div class="overlay-card glass-panel"
    use:trapFocus>
    <button class="btn-close-overlay" onclick={() => impressumOpen = false}>✕</button>
    <div class="modal-header-section">
      <span class="modal-subtitle">Rechtliche Angaben</span>
      <h2 class="modal-title">Impressum</h2>
    </div>
    <div class="legal-content">
      <p><strong>Angaben gemäß § 5 TMG:</strong></p>
      <p>Sebastian Bade<br>Friedrich-Dürr-Str. 12<br>68307 Mannheim</p>
      <p><strong>Kontakt:</strong><br>E-Mail: badesebastian@outlook.com</p>
      <p><strong>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:</strong><br>Sebastian Bade</p>
    </div>
  </div>
</div>

<!-- Datenschutz Modal -->
<div class="overlay-backdrop" class:active={privacyOpen} id="privacy-modal"
  role="dialog" aria-modal="true" aria-label="Datenschutzerklärung">
  <button class="overlay-backdrop-close" aria-label="Schließen" tabindex="-1" onclick={() => privacyOpen = false}></button>
  <div class="overlay-card glass-panel" style="max-width:600px; max-height:80vh; overflow-y:auto;"
    use:trapFocus>
    <button class="btn-close-overlay" onclick={() => privacyOpen = false}>✕</button>
    <div class="modal-header-section">
      <span class="modal-subtitle">Datenschutz & DSGVO</span>
      <h2 class="modal-title">Datenschutzerklärung</h2>
    </div>
    <div class="legal-content" style="font-size: 0.85rem; line-height: 1.5; text-align: left;">
      <h3 style="margin-top:0; font-size: 1rem; color: var(--color-text-primary);">I. Informationen über die Verarbeitung Ihrer Daten gemäß Art. 13 der DS-GVO</h3>
      <h4 style="margin-bottom: 4px; font-size: 0.9rem; color: var(--color-text-primary);">1. Verantwortlicher</h4>
      <p style="margin-top:0;">Verantwortlich für diese Website ist:<br>
      Sebastian Bade<br>Friedrich-Dürr-Str. 12<br>68307 Mannheim<br>badesebastian@outlook.com</p>

      <h4 style="margin-bottom: 4px; font-size: 0.9rem; color: var(--color-text-primary);">2. Daten zur Bereitstellung der Website und Erstellung der Protokolldateien</h4>
      <p style="margin-top:0;"><strong>a. Welche Daten werden für welchen Zweck verarbeitet?</strong><br>
      Bei jedem Zugriff auf Inhalte der Website werden vorübergehend Daten gespeichert, die möglicherweise eine Identifizierung zulassen (Datum und Uhrzeit, IP-Adresse, Hostname, aufgerufene Website, übertragene Datenmenge, Informationen über den Browsertyp, das Betriebssystem). Die vorübergehende Speicherung der Daten ist für den Ablauf eines Websitebesuchs erforderlich. Eine weitere Speicherung in Protokolldateien erfolgt, um die Funktionsfähigkeit der Website und die Sicherheit der informationstechnischen Systeme sicherzustellen. In diesen Zwecken liegt auch unser berechtigtes Interesse an der Datenverarbeitung.</p>

      <p><strong>b. Auf welcher Rechtsgrundlage werden diese Daten verarbeitet?</strong><br>
      Die Daten werden auf der Grundlage des Art. 6 Abs. 1 Buchstabe f DS-GVO verarbeitet.</p>

      <p><strong>c. Wie lange werden die Daten gespeichert?</strong><br>
      Die Daten werden gelöscht, sobald sie für die Erreichung des Zwecks ihrer Erhebung nicht mehr erforderlich sind. Bei der Bereitstellung der Website ist dies der Fall, wenn die jeweilige Sitzung beendet ist. Die Protokolldateien werden maximal vier Wochen aufbewahrt und danach endgültig gelöscht.</p>

      <h4 style="margin-bottom: 4px; font-size: 0.9rem; color: var(--color-text-primary);">3. Betroffenenrechte</h4>
      <p style="margin-top:0;">
      <strong>a. Recht auf Auskunft:</strong> Sie können Auskunft nach Art. 15 DS-GVO über Ihre personenbezogenen Daten verlangen, die wir verarbeiten.<br>
      <strong>b. Recht auf Widerspruch:</strong> Sie haben ein Recht auf Widerspruch aus besonderen Gründen (siehe unter Punkt II).<br>
      <strong>c. Recht auf Berichtigung:</strong> Sollten die Sie betreffenden Angaben nicht zutreffend sein, können Sie nach Art. 16 DS-GVO Berichtigung verlangen.<br>
      <strong>d. Recht auf Löschung:</strong> Sie können nach Art. 17 DS-GVO die Löschung Ihrer personenbezogenen Daten verlangen.<br>
      <strong>e. Recht auf Einschränkung der Verarbeitung:</strong> Sie haben nach Art. 18 DS-GVO das Recht, eine Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen.<br>
      <strong>f. Recht auf Beschwerde:</strong> Sie haben nach Art. 77 Abs. 1 DS-GVO das Recht, sich bei einer Datenschutzaufsichtsbehörde eigener Wahl zu beschweren.<br>
      <strong>g. Recht auf Datenübertragbarkeit:</strong> Für den Fall, dass die Voraussetzungen des Art. 20 Abs. 1 DS-GVO vorliegen, steht Ihnen das Recht zu, sich Daten aushändigen zu lassen.
      </p>

      <h3 style="margin-top: 16px; font-size: 1rem; color: var(--color-text-primary);">II. Recht auf Widerspruch gemäß Art. 21 Abs. 1 DS-GVO</h3>
      <p style="margin-top:0;">Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit gegen die Verarbeitung Ihrer personenbezogenen Daten, die aufgrund von Artikel 6 Abs. 1 Buchstabe f DS-GVO erfolgt, Widerspruch einzulegen. Der Verantwortliche verarbeitet die personenbezogenen Daten dann nicht mehr, es sei denn, er kann zwingende schutzwürdige Gründe für die Verarbeitung nachweisen, die die Interessen, Rechte und Freiheiten der betroffenen Person überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen. Die Erfassung der Daten zur Bereitstellung der Website und die Speicherung der Protokolldateien sind für den Betrieb der Internetseite zwingend erforderlich.<br>
      <br><strong>Sebastian Bade</strong><br>Friedrich-Dürr-Str. 12, 68307 Mannheim<br>badesebastian@outlook.com</p>
    </div>
  </div>
</div>

<style>


  /* 6a. Global Shimmer styles */
  :global(.skeleton-card) {
    position: relative;
    overflow: hidden !important;
    background: var(--color-surface-glass);
    pointer-events: none;
  }
  :global(.skeleton-shimmer) {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
    animation: skeletonShimmer 1.6s infinite;
    transform: translateX(-100%);
    z-index: 5;
  }
  @keyframes skeletonShimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .app-main {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
    padding: 12px 16px;
    position: relative;
    overflow: hidden;
  }

  .app-footer {
    text-align: center;
    padding: 15px 0;
    margin-top: auto;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    border-top: 1px solid var(--color-border-glass);
    background: rgba(10, 15, 30, 0.75) !important;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    position: sticky;
    bottom: 0;
    z-index: 90;
    width: 100%;
  }

  .footer-content {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 16px;
    width: 100%;
  }

  @media (max-width: 767px) {
    .app-footer {
      position: relative;
      bottom: auto;
      padding-bottom: 92px; /* BottomNav height (72px) + extra spacing (20px) */
    }
  }

  .footer-links {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-bottom: 5px;
  }

  .footer-links a {
    color: var(--color-text-secondary);
    text-decoration: none;
    transition: color 0.2s;
  }

  .footer-links a:hover { color: var(--color-secondary); }
  .footer-links .sep { opacity: 0.3; }

  .app-footer p {
    margin: 0;
    opacity: 0.6;
  }

  .modal-header-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .modal-subtitle {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-secondary);
  }

  .modal-title {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--color-text-primary);
  }

  .legal-content {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    line-height: 1.6;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Tablet */
  @media (min-width: 768px) {
    .app-main {
      max-width: 860px;
      padding: 24px 24px;
    }
  }

  /* Desktop */
  @media (min-width: 1024px) {
    .app-main {
      max-width: 1080px;
      padding: 32px 32px;
    }
    .app-footer {
      background: rgba(10, 15, 30, 0.3);
    }
  }

  /* Anpassung der globalen Haupt-Padding-Breite auf extrem schmalen Viewports */
  @media (max-width: 360px) {
    .app-main {
      padding: 10px 8px !important;
    }
    .app-footer {
      margin-top: 15px !important;
      padding: 10px 0 !important;
    }
    .footer-links {
      gap: 12px !important;
    }
  }

  :global([data-theme="light"]) .app-footer {
    background: rgba(240, 244, 250, 0.9) !important;
    border-top-color: hsla(215, 20%, 80%, 0.6) !important;
    color: var(--color-text-secondary) !important;
  }

  /* PWA Banner Styles */
  .pwa-install-banner {
    margin: 12px auto 0;
    max-width: 600px;
    width: calc(100% - 24px);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 16px;
    box-shadow: var(--shadow-premium);
    z-index: 100;
  }
  .pwa-banner-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }
  .pwa-banner-info {
    flex: 1;
    text-align: left;
  }
  .pwa-banner-title {
    font-family: var(--font-heading);
    font-size: 0.88rem;
    font-weight: 700;
    margin: 0 0 2px 0;
    color: var(--color-text-primary);
  }
  .pwa-banner-desc {
    font-size: 0.72rem;
    color: var(--color-text-secondary);
    margin: 0;
  }
  .pwa-banner-actions {
    display: flex;
    gap: 8px;
  }
  .pwa-banner-actions .btn-sm {
    font-size: 0.75rem;
    padding: 6px 12px;
    border-radius: 8px;
  }
  @media (max-width: 480px) {
    .pwa-install-banner {
      flex-direction: column;
      align-items: stretch;
      text-align: center;
      gap: 10px;
    }
    .pwa-banner-info {
      text-align: center;
    }
    .pwa-banner-actions {
      justify-content: center;
    }
  }

  .app-footer.app-footer--flow {
    position: static;
  }
  
  .wiki-viewport {
    flex: 1;
    width: 100%;
    margin: 0;
    padding: 0;
  }
</style>