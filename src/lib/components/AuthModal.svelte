<script>
  import { currentUser, isAuthenticated, pocketbaseHost, showToast, authService, navigateTo } from '$lib/stores/app.js';
  import { db } from '$lib/services/DbService.js';
  import { get } from 'svelte/store';
  import { formatUserError } from '$lib/utils/errorFormatter.js';
  import { trapFocus } from '$lib/utils/a11y.js';
  import { getSyncService } from '$lib/services/SyncService.js';

  let { open = $bindable(false), inline = false } = $props();

  let activeTab = $state('login'); // 'login' | 'register' | 'forgot-password'
  let hasActiveToken = $state(false);

  $effect(() => {
    if (open) {
      hasActiveToken = !!authService.getToken();
    }
  });

  // Listen for refresh event to update token status in UI
  import { onMount } from 'svelte';
  onMount(() => {
    const handleRefresh = () => {
      hasActiveToken = !!authService.getToken();
    };
    window.addEventListener('bg-refresh-data', handleRefresh);
    return () => {
      window.removeEventListener('bg-refresh-data', handleRefresh);
    };
  });

  // Login form
  let loginEmail = $state('');
  let loginPassword = $state('');
  let loginError = $state('');
  let loginLoading = $state(false);

  // Register form
  let registerName = $state('');
  let registerEmail = $state('');
  let registerPassword = $state('');
  let registerPasswordConfirm = $state('');
  let registerConsent = $state(false);
  let registerError = $state('');
  let registerLoading = $state(false);

  // Forgot Password form
  let forgotEmail = $state('');
  let forgotError = $state('');
  let forgotSuccess = $state('');
  let forgotLoading = $state(false);

  // S3: Passwort-Stärke-Validator
  let passwordStrength = $derived.by(() => {
    const password = registerPassword;
    if (!password) return { score: 0, level: 'zu kurz', checks: { length: false, number: false, specialOrUpper: false } };
    const checks = {
      length: password.length >= 8,
      number: /\d/.test(password),
      special: /[^a-zA-Z0-9]/.test(password)
    };
    const score = Object.values(checks).filter(Boolean).length;
    let level = 'schwach';
    if (score === 2) level = 'mittel';
    if (score === 3) level = 'stark';
    return { checks, score, level };
  });

  let showPasswordRequirements = $state(false);
  let isPasswordStrongEnough = $derived(passwordStrength.score >= 3);

  function close() { open = false; }

  /**
   * Reicht lokal gespeicherte (Gast-/Offline-)Matches nach Login/Registrierung
   * zum Upload ein und zieht Remote-Matches herein.
   * @param {any} user
   */
  async function migrateLocalMatches(user) {
    if (!user?.id) return;
    try {
      await getSyncService().migrateLocalMatchesAfterLogin(user.id);
    } catch (err) {
      console.warn('⚠️ AuthModal: Match-Migration fehlgeschlagen:', err);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    loginError = '';
    loginLoading = true;
    try {
      const result = await authService.login(loginEmail, loginPassword);
      const user = result.record ?? result.user;
      currentUser.set(user);
      await db.set('bg_user', user);
      await migrateLocalMatches(user);
      window.dispatchEvent(new CustomEvent('bg-refresh-data'));
      showToast(`Willkommen zurück, ${(result.record ?? result.user)?.name ?? 'Spieler'}! ☁️`, 'success');
      close();
      if (inline) {
        navigateTo('user-profile');
      }
    } catch (err) {
      console.error(err);
      loginError = formatUserError(err);
    } finally {
      loginLoading = false;
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    registerError = '';
    if (registerPassword !== registerPasswordConfirm) {
      registerError = 'Passwörter stimmen nicht überein.';
      return;
    }
    if (!registerConsent) {
      registerError = 'Bitte stimme der Datenschutzerklärung zu.';
      return;
    }
    registerLoading = true;
    if (!isPasswordStrongEnough) {
      registerError = 'Das Passwort erfüllt nicht die Mindestanforderungen.';
      registerLoading = false;
      return;
    }
    try {
      const result = await authService.register(registerEmail, registerPassword, registerPasswordConfirm, registerName);
      const loginResult = await authService.login(registerEmail, registerPassword);
      const user = loginResult.record ?? loginResult.user;
      currentUser.set(user);
      await db.set('bg_user', user);
      await migrateLocalMatches(user);
      window.dispatchEvent(new CustomEvent('bg-refresh-data'));
      showToast('Account erstellt & automatisch eingeloggt! 🎉', 'success');
      close();
      if (inline) {
        navigateTo('user-profile');
      }
    } catch (err) {
      console.error(err);
      registerError = formatUserError(err);
    } finally {
      registerLoading = false;
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    forgotError = '';
    forgotSuccess = '';
    forgotLoading = true;
    try {
      await authService.requestPasswordReset(forgotEmail);
      forgotSuccess = 'Eine E-Mail mit dem Reset-Link wurde gesendet, falls das Konto existiert.';
      forgotEmail = '';
      setTimeout(() => {
         if (activeTab === 'forgot-password') activeTab = 'login';
         forgotSuccess = '';
      }, 3500);
    } catch (err) {
      console.error(err);
      forgotError = formatUserError(err);
    } finally {
      forgotLoading = false;
    }
  }

  function handleKeydown(e) {
    if (open && e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet innerContent()}
      <!-- Auth Tabs -->
      <div class="auth-tabs" id="auth-tabs">
        <button class="auth-tab" class:active={activeTab === 'login'} id="tab-login-btn" onclick={() => activeTab = 'login'}>Login</button>
        <button class="auth-tab" class:active={activeTab === 'register'} id="tab-register-btn" onclick={() => activeTab = 'register'}>Registrieren</button>
      </div>

      <!-- Login -->
      {#if activeTab === 'login'}
        <form id="form-login" class="auth-form" onsubmit={handleLogin}>
          <h3 class="auth-form-title">Willkommen zurück</h3>
          <p class="auth-form-subtitle">Logge dich ein, um deine Brettspielergebnisse automatisch in der Cloud zu sichern.</p>

          {#if loginError}
            <p class="auth-error">{loginError}</p>
          {/if}

          <div class="form-group">
            <label for="login-email">E-Mail / Benutzername</label>
            <input type="text" id="login-email" bind:value={loginEmail} required placeholder="name@email.com">
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <label for="login-password">Passwort</label>
              <button type="button" class="btn-link" onclick={() => { activeTab = 'forgot-password'; forgotEmail = loginEmail; forgotError = ''; forgotSuccess = ''; }}>Passwort vergessen?</button>
            </div>
            <input type="password" id="login-password" bind:value={loginPassword} required placeholder="••••••••">
          </div>

          <div class="flex flex-col gap-2.5">
            <button type="submit" class="btn btn-primary auth-submit" disabled={loginLoading}>
              {loginLoading ? 'Einloggen...' : 'Einloggen'}
            </button>
            {#if !inline}
              <button type="button" class="btn btn-secondary" id="btn-skip-auth-login" onclick={close}>Später sichern</button>
            {/if}
            <button type="button" class="btn-logout" style="margin-top:12px; width:100%; border:1px solid var(--color-border-glass); border-radius:12px; background:rgba(255,255,255,0.03);" onclick={() => { navigateTo('settings'); close(); }}>⚙️ App-Einstellungen</button>
          </div>
        </form>
      {/if}

      <!-- Register -->
      {#if activeTab === 'register'}
        <form id="form-register" class="auth-form" onsubmit={handleRegister}>
          <h3 class="auth-form-title">Account erstellen</h3>
          <p class="auth-form-subtitle">Sichere deine Ergebnisse dauerhaft und greife von jedem Gerät darauf zu.</p>

          {#if registerError}
            <p class="auth-error">{registerError}</p>
          {/if}

          <div class="form-group">
            <label for="register-name">Name</label>
            <input type="text" id="register-name" bind:value={registerName} placeholder="Dein Spielername">
          </div>

          <div class="form-group">
            <label for="register-email">E-Mail Adresse</label>
            <input type="email" id="register-email" bind:value={registerEmail} required placeholder="name@email.com">
          </div>

          <div class="form-group">
            <label for="register-password">Passwort (min. 8 Zeichen)</label>
            <input 
              type="password" 
              id="register-password" 
              bind:value={registerPassword} 
              required 
              minlength="8" 
              placeholder="••••••••"
              onfocus={() => showPasswordRequirements = true}
            >
            
            <!-- S3: Passwort-Stärke-Validator UI -->
            {#if registerPassword}
              <div class="password-strength-bar-container">
                <div class="password-strength-bar strength-{passwordStrength.score}"></div>
              </div>
              <div class="password-strength-text">
                Passwortstärke: <span class="strength-label strength-label-{passwordStrength.score}">{passwordStrength.level}</span>
              </div>
            {/if}

            {#if showPasswordRequirements}
              <ul class="password-requirements-checklist">
                <li class:requirement-met={passwordStrength.checks.length}>
                  <span class="req-check">{passwordStrength.checks.length ? '✓' : '✗'}</span> Mindestens 8 Zeichen
                </li>
                <li class:requirement-met={passwordStrength.checks.number}>
                  <span class="req-check">{passwordStrength.checks.number ? '✓' : '✗'}</span> Mindestens eine Zahl (0-9)
                </li>
                <li class:requirement-met={passwordStrength.checks.special}>
                  <span class="req-check">{passwordStrength.checks.special ? '✓' : '✗'}</span> Mindestens ein Sonderzeichen
                </li>
              </ul>
            {/if}
          </div>

          <div class="form-group">
            <label for="register-password-confirm">Passwort bestätigen</label>
            <input type="password" id="register-password-confirm" bind:value={registerPasswordConfirm} required minlength="8" placeholder="••••••••">
          </div>

          <div class="flex items-start gap-2 text-[0.8rem] text-[var(--color-text-secondary)] leading-[1.3]">
            <input type="checkbox" id="register-consent" bind:checked={registerConsent} required>
            <label for="register-consent">Ich stimme der Datenschutzerklärung zu.</label>
          </div>

          <div class="flex flex-col gap-2.5">
            <button type="submit" class="btn btn-primary auth-submit" disabled={registerLoading}>
              {registerLoading ? 'Erstelle...' : 'Account erstellen'}
            </button>
            {#if !inline}
              <button type="button" class="btn btn-secondary" id="btn-skip-auth-register" onclick={close}>Später sichern</button>
            {/if}
            <button type="button" class="btn-logout" style="margin-top:12px; width:100%; border:1px solid var(--color-border-glass); border-radius:12px; background:rgba(255,255,255,0.03);" onclick={() => { navigateTo('settings'); close(); }}>⚙️ App-Einstellungen</button>
          </div>
        </form>
      {/if}

      <!-- Forgot Password -->
      {#if activeTab === 'forgot-password'}
        <form id="form-forgot" class="auth-form" onsubmit={handleForgotPassword}>
          <h3 class="auth-form-title">Passwort zurücksetzen</h3>
          <p class="auth-form-subtitle">Gib deine E-Mail-Adresse ein, um einen Link zum Zurücksetzen deines Passworts zu erhalten.</p>

          {#if forgotError}
            <p class="auth-error">{forgotError}</p>
          {/if}
          {#if forgotSuccess}
            <p class="auth-error" style="background: rgba(16, 185, 129, 0.1); border-color: var(--color-success); color: var(--color-success);">{forgotSuccess}</p>
          {/if}

          <div class="form-group">
            <label for="forgot-email">E-Mail Adresse</label>
            <input type="email" id="forgot-email" bind:value={forgotEmail} required placeholder="name@email.com">
          </div>

          <div class="flex flex-col gap-2.5">
            <button type="submit" class="btn btn-primary auth-submit" disabled={forgotLoading}>
              {forgotLoading ? 'Sende Anfrage...' : 'Reset-Link anfordern'}
            </button>
            <button type="button" class="btn btn-secondary" onclick={() => activeTab = 'login'}>Zurück zum Login</button>
          </div>
        </form>
      {/if}
{/snippet}

{#if inline}
  <div class="profile-inline-card glass-panel animate-scale-up">
    {@render innerContent()}
  </div>
{:else}
  <div class="overlay-backdrop" class:active={open} id="auth-overlay" role="dialog" aria-modal="true" aria-label="Anmeldung">
    <button class="overlay-backdrop-close" aria-label="Schließen" tabindex="-1" onclick={close}></button>
    <div class="overlay-card glass-panel" use:trapFocus>
      <button class="btn-close-overlay" id="btn-close-auth" onclick={close} aria-label="Schließen">
        <svg class="icon-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      {@render innerContent()}
    </div>
  </div>
{/if}

<style>
  .auth-tabs {
    display: flex;
    background-color: rgba(0,0,0,0.2);
    border: 1px solid var(--color-border-glass);
    border-radius: 12px;
    padding: 4px;
  }

  .auth-tab {
    flex: 1;
    background: none;
    border: none;
    color: var(--color-text-muted);
    padding: 8px;
    font-family: var(--font-heading);
    font-size: 0.85rem;
    font-weight: 700;
    border-radius: 8px;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .auth-tab.active {
    background-color: rgba(255,255,255,0.06);
    color: var(--color-text-primary);
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .auth-form-title {
    font-family: var(--font-heading);
    font-size: 1.25rem;
    font-weight: 800;
  }

  .auth-form-subtitle {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .auth-error {
    font-size: 0.82rem;
    color: var(--color-danger);
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 8px;
    padding: 8px 12px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .form-group input {
    background-color: rgba(0,0,0,0.25);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    padding: 10px 14px;
    border-radius: 12px;
    transition: var(--transition-normal);
  }

  .form-group input:focus {
    border-color: var(--color-primary);
    background-color: rgba(0,0,0,0.35);
    outline: none;
    box-shadow: 0 0 10px var(--color-primary-glow);
  }

  .btn-link {
    background: none;
    border: none;
    padding: 0;
    color: var(--color-primary);
    font-size: 0.72rem;
    cursor: pointer;
    text-decoration: underline;
    opacity: 0.8;
  }
  .btn-link:hover { opacity: 1; }

  .auth-submit { font-size: 0.9rem; }
  .auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  @media (max-width: 360px) {
    .profile-avatar {
      width: 56px !important;
      height: 56px !important;
    }
    .profile-name {
      font-size: 1.15rem !important;
    }
    .sync-status-box {
      padding: 10px 12px !important;
    }
    .btn-logout {
      padding: 10px !important;
      font-size: 0.82rem !important;
    }
  }
  /* S3 Passwort Stärke CSS */
  .password-strength-bar-container {
    height: 4px;
    background: rgba(255,255,255,0.1);
    border-radius: 2px;
    margin-top: 6px;
    overflow: hidden;
  }
  .password-strength-bar {
    height: 100%;
    width: 0;
    transition: width 0.3s ease, background-color 0.3s ease;
  }
  .password-strength-bar.strength-1 { width: 33.3%; background-color: var(--color-danger); }
  .password-strength-bar.strength-2 { width: 66.6%; background-color: var(--color-warning); }
  .password-strength-bar.strength-3 { width: 100%; background-color: var(--color-success); }
  
  .password-strength-text {
    font-size: 0.72rem;
    color: var(--color-text-muted);
    margin-top: 4px;
  }
  .strength-label-1 { color: var(--color-danger); font-weight: 700; }
  .strength-label-2 { color: var(--color-warning); font-weight: 700; }
  .strength-label-3 { color: var(--color-success); font-weight: 700; }

  .password-requirements-checklist {
    list-style: none;
    padding: 8px 12px;
    margin: 8px 0 0 0;
    background: rgba(0,0,0,0.15);
    border: 1px solid var(--color-border-glass);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .password-requirements-checklist li {
    font-size: 0.72rem;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
    transition: color 0.2s ease;
  }
  .password-requirements-checklist li.requirement-met {
    color: var(--color-success);
  }
  .req-check {
    font-weight: 800;
  }
</style>
