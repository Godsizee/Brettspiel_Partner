<script>
  // @ts-check
  import { get } from 'svelte/store';
  import { currentUser, showToast, authService } from '$lib/stores/app.js';
  import { db } from '$lib/services/DbService.js';
  import { formatUserError } from '$lib/utils/errorFormatter.js';
  import Sheet from '$lib/ui/Sheet.svelte';
  import Field from '$lib/ui/Field.svelte';
  import Button from '$lib/ui/Button.svelte';

  /**
   * Alle Konto-Formulare als Sheets. view: null | 'name' | 'password' | 'email' | 'color' | 'delete'
   * (Logik wörtlich aus UserProfile.svelte.)
   * @type {{ view?: string|null, color?: string, ondeleted?: () => void }}
   */
  let { view = $bindable(null), color = $bindable('#6366f1'), ondeleted } = $props();

  let open = $state(false);
  $effect(() => { open = view !== null; });
  function onclose() { view = null; }

  const TITLES = /** @type {Record<string, string>} */ ({
    name: 'Anzeigename ändern', password: 'Passwort ändern', email: 'E-Mail-Adresse ändern',
    color: 'Standard-Spielerfarbe', delete: 'Konto löschen',
  });

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

  // Formulare beim Öffnen zurücksetzen
  $effect(() => {
    if (view === 'name') { editNameValue = get(currentUser)?.name ?? ''; editNameError = ''; }
    if (view === 'password') { oldPassword = newPassword = newPasswordConfirm = ''; editPasswordError = ''; }
    if (view === 'email') { newEmail = ''; editEmailError = ''; editEmailSuccess = ''; }
    if (view === 'delete') { deletePassword = ''; deleteError = ''; }
  });

  /** @param {SubmitEvent} e */
  async function submitEditName(e) {
    e.preventDefault();
    editNameError = '';
    editNameLoading = true;
    try {
      const updated = await authService.updateProfile(get(currentUser).id, { name: editNameValue });
      currentUser.set(updated);
      await db.set('bg_user', updated);
      showToast('Name geändert', 'success');
      view = null;
    } catch (err) {
      editNameError = formatUserError(err);
    } finally {
      editNameLoading = false;
    }
  }

  /** @param {SubmitEvent} e */
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
      showToast('Passwort geändert', 'success');
      oldPassword = '';
      newPassword = '';
      newPasswordConfirm = '';
      view = null;
    } catch (err) {
      editPasswordError = formatUserError(err);
    } finally {
      editPasswordLoading = false;
    }
  }

  /** @param {SubmitEvent} e */
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

  /** @param {SubmitEvent} e */
  function submitColor(e) {
    e.preventDefault();
    if (typeof localStorage !== 'undefined') localStorage.setItem('bg_default_color', color);
    showToast('Farbe gespeichert', 'success');
    view = null;
  }

  /** @param {SubmitEvent} e */
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

      showToast('Konto gelöscht. Auf Wiedersehen!', 'info');
      view = null;
      ondeleted?.();
    } catch (err) {
      console.error(err);
      deleteError = formatUserError(err);
    } finally {
      deleteLoading = false;
    }
  }
</script>

<Sheet bind:open title={view ? TITLES[view] : ''} size="sm" {onclose}>
  {#if view === 'name'}
    <form id="form-name" class="flex flex-col gap-4" onsubmit={submitEditName}>
      <Field label="Neuer Anzeigename" bind:value={editNameValue} autocomplete="name" required />
      {#if editNameError}<p class="text-sm text-danger" role="alert">{editNameError}</p>{/if}
    </form>
  {:else if view === 'password'}
    <form id="form-password" class="flex flex-col gap-4" onsubmit={submitEditPassword}>
      <Field label="Aktuelles Passwort" type="password" bind:value={oldPassword} autocomplete="current-password" required />
      <Field label="Neues Passwort" type="password" bind:value={newPassword} autocomplete="new-password" hint="Mindestens 8 Zeichen, eine Zahl, ein Sonderzeichen" required minlength="8" />
      <Field label="Neues Passwort bestätigen" type="password" bind:value={newPasswordConfirm} autocomplete="new-password" required minlength="8" />
      {#if editPasswordError}<p class="text-sm text-danger" role="alert">{editPasswordError}</p>{/if}
    </form>
  {:else if view === 'email'}
    <form id="form-email" class="flex flex-col gap-4" onsubmit={submitEditEmail}>
      <p class="text-fg-2">Du erhältst eine Bestätigungs-E-Mail an die neue Adresse.</p>
      <Field label="Neue E-Mail-Adresse" type="email" bind:value={newEmail} autocomplete="email" required />
      {#if editEmailError}<p class="text-sm text-danger" role="alert">{editEmailError}</p>{/if}
      {#if editEmailSuccess}<p class="rounded-md bg-success-soft px-3 py-2 text-sm font-medium text-success" role="status">{editEmailSuccess}</p>{/if}
    </form>
  {:else if view === 'color'}
    <form id="form-color" class="flex flex-col gap-4" onsubmit={submitColor}>
      <p class="text-fg-2">Lege deine Standard-Spielerfarbe für neue Partien fest.</p>
      <label class="flex items-center justify-between gap-4 font-semibold">
        Standard-Farbe
        <input type="color" bind:value={color} class="size-12 cursor-pointer rounded-md border border-field-line bg-surface-2 p-1" />
      </label>
    </form>
  {:else if view === 'delete'}
    <form id="form-delete" class="flex flex-col gap-4" onsubmit={submitDeleteAccount}>
      <p class="text-fg-2">Diese Aktion kann nicht rückgängig gemacht werden. Alle Cloud-Backups deiner Spielrunden werden gelöscht. Bitte gib zur Bestätigung dein aktuelles Passwort ein:</p>
      <Field label="Aktuelles Passwort" type="password" bind:value={deletePassword} autocomplete="current-password" required />
      {#if deleteError}<p class="text-sm text-danger" role="alert">{deleteError}</p>{/if}
    </form>
  {/if}

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (view = null)}>{view === 'email' && editEmailSuccess ? 'Schließen' : 'Abbrechen'}</Button>
    {#if view === 'name'}<Button type="submit" form="form-name" variant="primary" loading={editNameLoading}>Speichern</Button>
    {:else if view === 'password'}<Button type="submit" form="form-password" variant="primary" loading={editPasswordLoading}>Passwort ändern</Button>
    {:else if view === 'email'}<Button type="submit" form="form-email" variant="primary" loading={editEmailLoading}>Änderung anfragen</Button>
    {:else if view === 'color'}<Button type="submit" form="form-color" variant="primary">Speichern</Button>
    {:else if view === 'delete'}<Button type="submit" form="form-delete" variant="danger" loading={deleteLoading}>Konto unwiderruflich löschen</Button>{/if}
  {/snippet}
</Sheet>
