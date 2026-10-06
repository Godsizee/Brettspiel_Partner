<script>
  // @ts-check
  import { onDestroy } from 'svelte';
  import Check from '@lucide/svelte/icons/check';
  import Circle from '@lucide/svelte/icons/circle';
  import { currentUser, showToast, authService } from '$lib/stores/app.js';
  import { db } from '$lib/services/DbService.js';
  import { formatUserError } from '$lib/utils/errorFormatter.js';
  import { getSyncService } from '$lib/services/SyncService.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import Segmented from '$lib/ui/Segmented.svelte';
  import Field from '$lib/ui/Field.svelte';
  import Button from '$lib/ui/Button.svelte';

  /** @type {{ oncomplete?: () => void, oncancel?: () => void }} */
  let { oncomplete, oncancel } = $props();

  let activeTab = $state('login'); // 'login' | 'register' | 'forgot-password'

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
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let forgotTimer;
  onDestroy(() => clearTimeout(forgotTimer));

  // S3: Passwort-Stärke-Validator
  let checks = $derived({
    length: registerPassword.length >= 8,
    number: /\d/.test(registerPassword),
    special: /[^a-zA-Z0-9]/.test(registerPassword),
  });
  let isPasswordStrongEnough = $derived(Object.values(checks).filter(Boolean).length >= 3);

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
      console.warn('SignInPanel: Match-Migration fehlgeschlagen:', err);
    }
  }

  /** @param {SubmitEvent} e */
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
      showToast(`Willkommen zurück, ${user?.name ?? 'Spieler'}!`, 'success');
      oncomplete?.();
    } catch (err) {
      console.error(err);
      loginError = formatUserError(err);
    } finally {
      loginLoading = false;
    }
  }

  /** @param {SubmitEvent} e */
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
      await authService.register(registerEmail, registerPassword, registerPasswordConfirm, registerName);
      const loginResult = await authService.login(registerEmail, registerPassword);
      const user = loginResult.record ?? loginResult.user;
      currentUser.set(user);
      await db.set('bg_user', user);
      await migrateLocalMatches(user);
      window.dispatchEvent(new CustomEvent('bg-refresh-data'));
      showToast('Konto erstellt und eingeloggt', 'success');
      oncomplete?.();
    } catch (err) {
      console.error(err);
      registerError = formatUserError(err);
    } finally {
      registerLoading = false;
    }
  }

  /** @param {SubmitEvent} e */
  async function handleForgotPassword(e) {
    e.preventDefault();
    forgotError = '';
    forgotSuccess = '';
    forgotLoading = true;
    try {
      await authService.requestPasswordReset(forgotEmail);
      forgotSuccess = 'Eine E-Mail mit dem Reset-Link wurde gesendet, falls das Konto existiert.';
      forgotEmail = '';
      forgotTimer = setTimeout(() => {
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

  const MODES = [{ value: 'login', label: 'Anmelden' }, { value: 'register', label: 'Registrieren' }];
  const REQS = /** @type {const} */ ([
    ['length', 'Mindestens 8 Zeichen'], ['number', 'Mindestens eine Zahl (0–9)'], ['special', 'Mindestens ein Sonderzeichen'],
  ]);
</script>

<div class="flex flex-col gap-4">
  {#if activeTab !== 'forgot-password'}
    <Segmented label="Anmelden oder registrieren" options={MODES} bind:value={activeTab} />
  {/if}

  {#if activeTab === 'login'}
    <form class="flex flex-col gap-4" onsubmit={handleLogin}>
      <p class="text-fg-2">Melde dich an, um deine Ergebnisse automatisch in der Cloud zu sichern.</p>
      <Field label="E-Mail oder Benutzername" bind:value={loginEmail} autocomplete="username" placeholder="name@email.com" required />
      <div class="flex flex-col gap-1.5">
        <Field label="Passwort" type="password" bind:value={loginPassword} autocomplete="current-password" placeholder="Passwort" required />
        <button type="button" class="self-end text-sm font-semibold text-accent"
          onclick={() => { activeTab = 'forgot-password'; forgotEmail = loginEmail; forgotError = ''; forgotSuccess = ''; }}>Passwort vergessen?</button>
      </div>
      {#if loginError}<p class="text-sm text-danger" role="alert">{loginError}</p>{/if}
      <div class="flex flex-col gap-2">
        <Button type="submit" variant="primary" size="lg" block loading={loginLoading}>Einloggen</Button>
        {#if oncancel}<Button variant="ghost" block onclick={oncancel}>Später sichern</Button>{/if}
      </div>
    </form>

  {:else if activeTab === 'register'}
    <form class="flex flex-col gap-4" onsubmit={handleRegister}>
      <p class="text-fg-2">Sichere deine Ergebnisse dauerhaft und greife von jedem Gerät darauf zu.</p>
      <Field label="Name" bind:value={registerName} autocomplete="name" placeholder="Dein Spielername" />
      <Field label="E-Mail-Adresse" type="email" bind:value={registerEmail} autocomplete="email" placeholder="name@email.com" required />
      <div class="flex flex-col gap-2">
        <Field label="Passwort" type="password" bind:value={registerPassword} autocomplete="new-password" placeholder="Passwort" required minlength="8" />
        <ul class="flex flex-col gap-1 text-sm" aria-label="Passwort-Anforderungen">
          {#each REQS as [key, text]}
            <li class={['flex items-center gap-2', checks[key] ? 'text-success' : 'text-fg-2']}>
              {#if checks[key]}<Check class="size-4" aria-hidden="true" /><span class="sr-only">Erfüllt:</span>{:else}<Circle class="size-4" aria-hidden="true" /><span class="sr-only">Offen:</span>{/if}{text}
            </li>
          {/each}
        </ul>
      </div>
      <Field label="Passwort bestätigen" type="password" bind:value={registerPasswordConfirm} autocomplete="new-password" placeholder="Passwort wiederholen" required minlength="8" />
      <label class="flex min-h-11 items-start gap-3 text-sm text-fg-2">
        <input type="checkbox" bind:checked={registerConsent} required class="mt-0.5 size-5 shrink-0 accent-accent" />
        <span>Ich stimme der <a href={appHash.legal()} class="font-semibold text-accent underline" onclick={() => oncancel?.()}>Datenschutzerklärung</a> zu.</span>
      </label>
      {#if registerError}<p class="text-sm text-danger" role="alert">{registerError}</p>{/if}
      <div class="flex flex-col gap-2">
        <Button type="submit" variant="primary" size="lg" block loading={registerLoading}>Konto erstellen</Button>
        {#if oncancel}<Button variant="ghost" block onclick={oncancel}>Später sichern</Button>{/if}
      </div>
    </form>

  {:else}
    <form class="flex flex-col gap-4" onsubmit={handleForgotPassword}>
      <h3 class="font-display text-h2 font-semibold">Passwort zurücksetzen</h3>
      <p class="text-fg-2">Gib deine E-Mail-Adresse ein, um einen Link zum Zurücksetzen deines Passworts zu erhalten.</p>
      <Field label="E-Mail-Adresse" type="email" bind:value={forgotEmail} autocomplete="email" placeholder="name@email.com" required />
      {#if forgotError}<p class="text-sm text-danger" role="alert">{forgotError}</p>{/if}
      {#if forgotSuccess}<p class="rounded-md bg-success-soft px-3 py-2 text-sm font-medium text-success" role="status">{forgotSuccess}</p>{/if}
      <div class="flex flex-col gap-2">
        <Button type="submit" variant="primary" size="lg" block loading={forgotLoading}>Reset-Link anfordern</Button>
        <Button variant="ghost" block onclick={() => (activeTab = 'login')}>Zurück zum Login</Button>
      </div>
    </form>
  {/if}
</div>
