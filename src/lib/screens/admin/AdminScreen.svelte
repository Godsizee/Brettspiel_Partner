<script>
  // @ts-check
  import { get } from 'svelte/store';
  import Inbox from '@lucide/svelte/icons/inbox';
  import Dices from '@lucide/svelte/icons/dices';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import X from '@lucide/svelte/icons/x';
  import { pocketbaseHost, authService, currentUser, showToast, isAdmin, confirmDialog } from '$lib/stores/app.js';
  import { navigate } from '$lib/router/router.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import { fetchPendingCount, approveGame, rejectGame, editAndApproveGame, adminDeletePendingGame } from '$lib/services/AdminService.js';
  import Screen from '$lib/ui/Screen.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Button from '$lib/ui/Button.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import Field from '$lib/ui/Field.svelte';
  import Stepper from '$lib/ui/Stepper.svelte';
  import Segmented from '$lib/ui/Segmented.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import Skeleton from '$lib/ui/Skeleton.svelte';
  import Sheet from '$lib/ui/Sheet.svelte';

  /** @type {'pending'|'approved'|'rejected'} */
  let activeTab = $state('pending');
  /** @type {any[]} */
  let games = $state([]);
  let isLoading = $state(false);
  let pendingCount = $state(0);

  // Reject sheet
  let rejectGameRef = $state(/** @type {any|null} */ (null));
  let rejectNote = $state('');
  let isActing = $state(false);

  // Edit sheet
  let editingGame = $state(/** @type {any|null} */ (null));
  let editForm = $state({ name: '', description: '', emoji: '', accent_color: '', min_players: 2, max_players: 4, categories: /** @type {any[]} */ ([]) });
  let editCatInput = $state('');

  function getCtx() {
    const host = get(pocketbaseHost);
    const token = authService.getToken();
    const user = get(currentUser);
    if (!host || !token || !user) throw new Error('Nicht authentifiziert.');
    return { host, token, userId: user.id };
  }

  async function load() {
    if (!get(isAdmin)) { navigate(appHash.home(), { replace: true }); return; }
    if (!authService.getToken()) {
      showToast('Bitte melde dich erneut an, um den Admin-Bereich zu nutzen.', 'warning');
      navigate(appHash.profile(), { replace: true });
      return;
    }
    isLoading = true;
    try {
      const { host, token } = getCtx();
      const url = `${host}/api/collections/pending_games/records?filter=status%3D'${activeTab}'&sort=-created&perPage=50`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();
      games = data.items ?? [];
      pendingCount = activeTab === 'pending' ? (data.totalItems ?? games.length) : pendingCount;
    } catch (e) {
      console.error('AdminScreen load error:', e);
      showToast(e instanceof Error && e.message ? e.message : 'Fehler beim Laden.', 'error');
    } finally {
      isLoading = false;
    }
  }

  async function refreshCount() {
    try {
      const { host, token } = getCtx();
      pendingCount = await fetchPendingCount(host, token);
    } catch (_) {}
  }

  // Beim Einhängen und bei jedem Reiterwechsel laden
  $effect(() => {
    activeTab;
    load();
    refreshCount();
  });

  /** @param {any} game */
  async function handleApprove(game) {
    if (isActing) return;
    isActing = true;
    try {
      const { host, token, userId } = getCtx();
      await approveGame(host, token, game.id, userId);
      showToast(`„${game.name}“ freigeschaltet`, 'success');
      await load(); await refreshCount();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Fehler', 'error'); }
    finally { isActing = false; }
  }

  /** @param {any} game */
  function openRejectModal(game) { rejectGameRef = game; rejectNote = ''; }
  function closeRejectModal() { rejectGameRef = null; rejectNote = ''; }

  async function handleReject() {
    if (!rejectGameRef || isActing) return;
    isActing = true;
    try {
      const { host, token, userId } = getCtx();
      await rejectGame(host, token, rejectGameRef.id, userId, rejectNote);
      showToast(`„${rejectGameRef.name}“ abgelehnt.`, 'info');
      closeRejectModal();
      await load(); await refreshCount();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Fehler', 'error'); }
    finally { isActing = false; }
  }

  /** @param {any} game */
  function openEdit(game) {
    editingGame = game;
    editForm = {
      name: game.name,
      description: game.description ?? '',
      emoji: game.emoji ?? '🎲',
      accent_color: game.accent_color ?? '#6366f1',
      min_players: game.min_players ?? 2,
      max_players: game.max_players ?? 4,
      categories: Array.isArray(game.categories) ? [...game.categories] : [],
    };
    editCatInput = '';
  }
  function closeEdit() { editingGame = null; }

  function addEditCat() {
    const label = editCatInput.trim();
    if (!label || editForm.categories.length >= 20) return;
    editForm.categories = [...editForm.categories, { id: 'cat_' + Date.now(), label }];
    editCatInput = '';
  }
  /** @param {string} id */
  function removeEditCat(id) { editForm.categories = editForm.categories.filter((c) => c.id !== id); }

  async function handleEditApprove() {
    if (!editingGame || isActing) return;
    isActing = true;
    try {
      const { host, token, userId } = getCtx();
      await editAndApproveGame(host, token, editingGame.id, userId, editForm);
      showToast(`„${editForm.name}“ bearbeitet und freigeschaltet`, 'success');
      closeEdit();
      await load(); await refreshCount();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Fehler', 'error'); }
    finally { isActing = false; }
  }

  /** @param {any} game */
  async function handleAdminDelete(game) {
    if (!(await confirmDialog(`„${game.name}“ endgültig löschen?`))) return;
    if (isActing) return;
    isActing = true;
    try {
      const { host, token } = getCtx();
      await adminDeletePendingGame(host, token, game.id);
      showToast('Eintrag gelöscht.', 'success');
      await load(); await refreshCount();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Fehler', 'error'); }
    finally { isActing = false; }
  }

  const TAB_LABELS = { pending: 'Offen', approved: 'Freigegeben', rejected: 'Abgelehnt' };
  let tabOptions = $derived(/** @type {const} */ (['pending', 'approved', 'rejected']).map((t) => ({
    value: t, label: TAB_LABELS[t], count: t === 'pending' && pendingCount > 0 ? pendingCount : undefined,
  })));

  let rejectOpen = $state(false);
  $effect(() => { rejectOpen = rejectGameRef !== null; });
  let editOpen = $state(false);
  $effect(() => { editOpen = editingGame !== null; });
</script>

<Screen title="Spielanträge" back={appHash.profile()}>
  <div class="flex flex-col gap-3">
    <Segmented label="Status der Anträge" options={tabOptions} bind:value={activeTab} />

    {#if isLoading}
      <Skeleton class="h-28" /><Skeleton class="h-28" />
    {:else if games.length === 0}
      <EmptyState title="Keine Anträge" icon={Inbox} text="Hier ist nichts {TAB_LABELS[activeTab].toLowerCase()}." />
    {:else}
      {#each games as game (game.id)}
        <Card padded class="flex flex-col gap-3">
          <div class="flex gap-3">
            {#if game.cover}
              <img src="{get(pocketbaseHost)}/api/files/pending_games/{game.id}/{game.cover}?thumb=120x80" alt="" loading="lazy" decoding="async" width="96" height="64"
                class="h-16 w-24 shrink-0 rounded-md object-cover" />
            {:else}
              <span class="grid h-16 w-24 shrink-0 place-items-center rounded-md bg-surface-2 text-3xl" aria-hidden="true">{game.emoji || '🎲'}</span>
            {/if}
            <div class="min-w-0 flex-1 leading-tight">
              <h2 class="truncate font-display text-[17px] font-semibold">{game.name}</h2>
              <p class="mt-0.5 text-[0.8rem] text-fg-2">{game.min_players}–{game.max_players} Spieler · {(game.categories ?? []).length} Kategorien</p>
              {#if game.description}<p class="mt-1 text-sm text-fg-2">{game.description}</p>{/if}
            </div>
          </div>
          {#if game.admin_note}
            <p class="flex items-start gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm"><MessageSquare class="mt-0.5 size-4 shrink-0 text-fg-2" aria-hidden="true" />{game.admin_note}</p>
          {/if}
          {#if activeTab === 'pending'}
            <div class="flex flex-wrap gap-2">
              <Button variant="primary" disabled={isActing} onclick={() => handleApprove(game)}>Freischalten</Button>
              <Button variant="secondary" disabled={isActing} onclick={() => openEdit(game)}>Bearbeiten</Button>
              <Button variant="danger-ghost" disabled={isActing} onclick={() => openRejectModal(game)}>Ablehnen</Button>
            </div>
          {:else}
            <div class="flex"><Button variant="danger-ghost" disabled={isActing} onclick={() => handleAdminDelete(game)}>Löschen</Button></div>
          {/if}
        </Card>
      {/each}
    {/if}
  </div>
</Screen>

<Sheet bind:open={rejectOpen} title="Antrag ablehnen" description={rejectGameRef ? `„${rejectGameRef.name}“` : ''} size="sm" onclose={closeRejectModal}>
  <div class="flex flex-col gap-1.5">
    <label for="rej-note" class="text-sm font-semibold">Ablehnungsgrund (optional)</label>
    <textarea id="rej-note" bind:value={rejectNote} rows="3" placeholder="z. B. Name zu generisch, Kategorien fehlen …"
      class="w-full rounded-md border border-field-line bg-surface-2 px-3 py-2.5 placeholder:text-fg-2 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/30"></textarea>
  </div>
  {#snippet footer()}
    <Button variant="ghost" disabled={isActing} onclick={closeRejectModal}>Abbrechen</Button>
    <Button variant="danger" loading={isActing} onclick={handleReject}>Ablehnen bestätigen</Button>
  {/snippet}
</Sheet>

<Sheet bind:open={editOpen} title="Bearbeiten und freischalten" description={editingGame ? `„${editingGame.name}“` : ''} size="md" onclose={closeEdit}>
  <div class="flex flex-col gap-3">
    <Field label="Spielname" bind:value={editForm.name} maxlength="60" />
    <div class="flex flex-col gap-1.5">
      <label for="edit-desc" class="text-sm font-semibold">Beschreibung</label>
      <textarea id="edit-desc" bind:value={editForm.description} rows="2" maxlength="500"
        class="w-full rounded-md border border-field-line bg-surface-2 px-3 py-2.5 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/30"></textarea>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <Field label="Emoji" bind:value={editForm.emoji} maxlength="4" />
      <div class="flex flex-col gap-1.5">
        <label for="edit-color" class="text-sm font-semibold">Akzentfarbe</label>
        <input id="edit-color" type="color" bind:value={editForm.accent_color} class="h-11 w-full cursor-pointer rounded-md border border-field-line bg-surface-2 p-1" />
      </div>
      <div class="flex flex-col gap-1.5"><span class="text-sm font-semibold">Min. Spieler</span><Stepper label="Mindestspielerzahl" min={1} max={12} bind:value={editForm.min_players} /></div>
      <div class="flex flex-col gap-1.5"><span class="text-sm font-semibold">Max. Spieler</span><Stepper label="Höchstspielerzahl" min={1} max={12} bind:value={editForm.max_players} /></div>
    </div>
    <div class="flex flex-col gap-2">
      <form class="flex items-end gap-2" onsubmit={(e) => { e.preventDefault(); addEditCat(); }}>
        <div class="min-w-0 flex-1"><Field label="Kategorien ({editForm.categories.length}/20)" bind:value={editCatInput} placeholder="Kategorie …" maxlength="40" /></div>
        <Button type="submit" variant="secondary">Hinzufügen</Button>
      </form>
      <ul class="flex flex-wrap gap-1.5">
        {#each editForm.categories as cat (cat.id)}
          <li class="inline-flex min-h-9 items-center gap-1 rounded-full bg-surface-2 pl-3 pr-1 text-sm">
            {cat.label}<IconButton label="{cat.label} entfernen" class="size-9" onclick={() => removeEditCat(cat.id)}><X class="size-4" aria-hidden="true" /></IconButton>
          </li>
        {/each}
      </ul>
    </div>
  </div>
  {#snippet footer()}
    <Button variant="ghost" disabled={isActing} onclick={closeEdit}>Abbrechen</Button>
    <Button variant="primary" loading={isActing} onclick={handleEditApprove}>Speichern und freischalten</Button>
  {/snippet}
</Sheet>
