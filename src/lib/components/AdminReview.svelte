<script>
  // @ts-check
  import { pocketbaseHost, authService, currentUser, showToast, navigateTo, isAdmin, activeScreen, confirmDialog } from '$lib/stores/app.js';
  import { fetchPendingGames, fetchPendingCount, approveGame, rejectGame, editAndApproveGame, adminDeletePendingGame } from '$lib/services/AdminService.js';
  import { get } from 'svelte/store';

  /** @type {'pending'|'approved'|'rejected'} */
  let activeTab = $state('pending');
  /** @type {any[]} */
  let games = $state([]);
  let isLoading = $state(false);
  let pendingCount = $state(0);

  // Reject modal
  let rejectModalGame = $state(/** @type {any|null} */ (null));
  let rejectNote = $state('');
  let isActing = $state(false);

  // Inline-Edit
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
    if (!get(isAdmin)) { navigateTo('game-selection'); return; }
    if (!authService.getToken()) {
      showToast('Bitte melde dich erneut an, um den Admin-Bereich zu nutzen. 🔒', 'warning');
      navigateTo('profile');
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
      console.error('❌ AdminReview load error:', e);
      showToast(e.message || 'Fehler beim Laden.', 'error');
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

  $effect(() => {
    if ($activeScreen === 'admin-review') {
      activeTab;
      load();
      refreshCount();
    }
  });

  /** @param {any} game */
  async function handleApprove(game) {
    if (isActing) return;
    isActing = true;
    try {
      const { host, token, userId } = getCtx();
      await approveGame(host, token, game.id, userId);
      showToast(`"${game.name}" freigeschaltet ✅`, 'success');
      await load(); await refreshCount();
    } catch (e) { showToast(e.message, 'error'); }
    finally { isActing = false; }
  }

  /** @param {any} game */
  function openRejectModal(game) { rejectModalGame = game; rejectNote = ''; }
  function closeRejectModal() { rejectModalGame = null; rejectNote = ''; }

  async function handleReject() {
    if (!rejectModalGame || isActing) return;
    isActing = true;
    try {
      const { host, token, userId } = getCtx();
      await rejectGame(host, token, rejectModalGame.id, userId, rejectNote);
      showToast(`"${rejectModalGame.name}" abgelehnt.`, 'info');
      closeRejectModal();
      await load(); await refreshCount();
    } catch (e) { showToast(e.message, 'error'); }
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
      categories: Array.isArray(game.categories) ? [...game.categories] : []
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
  function removeEditCat(id) { editForm.categories = editForm.categories.filter(c => c.id !== id); }

  async function handleEditApprove() {
    if (!editingGame || isActing) return;
    isActing = true;
    try {
      const { host, token, userId } = getCtx();
      await editAndApproveGame(host, token, editingGame.id, userId, editForm);
      showToast(`"${editForm.name}" bearbeitet & freigeschaltet ✅`, 'success');
      closeEdit();
      await load(); await refreshCount();
    } catch (e) { showToast(e.message, 'error'); }
    finally { isActing = false; }
  }

  /** @param {any} game */
  async function handleAdminDelete(game) {
    if (!(await confirmDialog(`"${game.name}" endgültig löschen?`))) return;
    if (isActing) return;
    isActing = true;
    try {
      const { host, token } = getCtx();
      await adminDeletePendingGame(host, token, game.id);
      showToast('Eintrag gelöscht.', 'success');
      await load(); await refreshCount();
    } catch (e) { showToast(e.message, 'error'); }
    finally { isActing = false; }
  }

  const TABS = /** @type {const} */ (['pending', 'approved', 'rejected']);
  const TAB_LABELS = { pending: 'Offen', approved: 'Genehmigt', rejected: 'Abgelehnt' };

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      if (rejectModalGame) closeRejectModal();
      if (editingGame) closeEdit();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="ar-header">
  <button class="ar-back-btn" onclick={() => navigateTo('game-selection')} type="button" aria-label="Zurück">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  </button>
  <div class="ar-header-text">
    <span class="ar-subtitle">ADMIN</span>
    <h1 class="ar-title">🛡️ Spielanträge</h1>
  </div>
  {#if pendingCount > 0}
    <span class="ar-badge">{pendingCount}</span>
  {/if}
</div>

<div class="ar-tabs">
  {#each TABS as tab}
    <button
      class="ar-tab"
      class:active={activeTab === tab}
      onclick={() => activeTab = tab}
      type="button"
    >{TAB_LABELS[tab]}{#if tab === 'pending' && pendingCount > 0} <span class="ar-tab-badge">{pendingCount}</span>{/if}</button>
  {/each}
</div>

{#if isLoading}
  <div class="ar-loading">
    <div class="ar-spinner"></div>
    <span>Lade Anträge…</span>
  </div>
{:else if games.length === 0}
  <div class="ar-empty glass-panel animate-scale-up">
    <span class="ar-empty-icon">📭</span>
    <p>Keine {TAB_LABELS[activeTab]} Anträge</p>
  </div>
{:else}
  <div class="ar-list">
    {#each games as game (game.id)}
      <div class="ar-card glass-panel animate-scale-up">
        <div class="ar-card-top">
          {#if game.cover}
            <img
              src="{get(pocketbaseHost)}/api/files/pending_games/{game.id}/{game.cover}?thumb=120x80"
              alt="Cover"
              loading="lazy"
              decoding="async"
              class="ar-cover"
            />
          {:else}
            <div class="ar-emoji-cover">{game.emoji || '🎲'}</div>
          {/if}
          <div class="ar-card-info">
            <h3 class="ar-game-name">{game.name}</h3>
            <span class="ar-meta">{game.min_players}–{game.max_players} Spieler · {(game.categories ?? []).length} Kategorien</span>
            {#if game.description}
              <p class="ar-description">{game.description}</p>
            {/if}
            {#if game.admin_note}
              <div class="ar-admin-note">💬 {game.admin_note}</div>
            {/if}
          </div>
        </div>

        {#if activeTab === 'pending'}
          <div class="ar-actions">
            <button class="btn btn-primary btn-sm ar-btn" onclick={() => handleApprove(game)} disabled={isActing} type="button">
              ✅ Freischalten
            </button>
            <button class="btn btn-secondary btn-sm ar-btn" onclick={() => openEdit(game)} disabled={isActing} type="button">
              ✏️ Bearbeiten & freischalten
            </button>
            <button class="btn btn-danger btn-sm ar-btn" onclick={() => openRejectModal(game)} disabled={isActing} type="button">
              ❌ Ablehnen
            </button>
          </div>
        {:else}
          <div class="ar-actions">
            <button class="btn btn-secondary btn-sm ar-btn" onclick={() => handleAdminDelete(game)} disabled={isActing} type="button">
              🗑 Löschen
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<!-- Reject Modal -->
{#if rejectModalGame}
  <div class="ar-modal-backdrop" role="dialog" aria-modal="true" tabindex="-1" aria-label="Ablehnen">
    <button class="overlay-backdrop-close" aria-label="Schließen" tabindex="-1" onclick={closeRejectModal}></button>
    <div class="ar-modal glass-panel animate-scale-up" style="position: relative; z-index: 2;">
      <h3 class="ar-modal-title">❌ Ablehnen: „{rejectModalGame.name}"</h3>
      <label class="ar-modal-label">
        Ablehnungsgrund (optional)
        <textarea class="ar-modal-textarea" bind:value={rejectNote} placeholder="z. B. Name zu generisch, Kategorien fehlen…" rows="3"></textarea>
      </label>
      <div class="ar-modal-actions">
        <button class="btn btn-secondary" onclick={closeRejectModal} disabled={isActing} type="button">Abbrechen</button>
        <button class="btn btn-danger" onclick={handleReject} disabled={isActing} type="button">
          {isActing ? 'Wird abgelehnt…' : 'Ablehnen bestätigen'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit & Approve Modal -->
{#if editingGame}
  <div class="ar-modal-backdrop" role="dialog" aria-modal="true" tabindex="-1" aria-label="Bearbeiten">
    <button class="overlay-backdrop-close" aria-label="Schließen" tabindex="-1" onclick={closeEdit}></button>
    <div class="ar-modal ar-modal-wide glass-panel animate-scale-up" style="position: relative; z-index: 2;">
      <h3 class="ar-modal-title">✏️ Bearbeiten: „{editingGame.name}"</h3>
      <div class="ar-edit-form">
        <label class="ar-modal-label">Spielname
          <input class="ar-modal-input" type="text" bind:value={editForm.name} maxlength="60" />
        </label>
        <label class="ar-modal-label">Beschreibung
          <textarea class="ar-modal-textarea" bind:value={editForm.description} rows="2" maxlength="500"></textarea>
        </label>
        <div class="ar-edit-row">
          <label class="ar-modal-label">Emoji <input class="ar-modal-input" type="text" bind:value={editForm.emoji} maxlength="4" style="width:56px;text-align:center;" /></label>
          <label class="ar-modal-label">Akzent <input class="ar-modal-input" type="color" bind:value={editForm.accent_color} style="width:48px;height:36px;padding:2px;" /></label>
          <label class="ar-modal-label">Min <input class="ar-modal-input" type="number" bind:value={editForm.min_players} min="1" max="12" style="width:70px;" /></label>
          <label class="ar-modal-label">Max <input class="ar-modal-input" type="number" bind:value={editForm.max_players} min="1" max="12" style="width:70px;" /></label>
        </div>
        <div class="ar-modal-label">
          Kategorien ({editForm.categories.length}/20)
          <div class="ar-cat-row">
            <input class="ar-modal-input" type="text" bind:value={editCatInput} placeholder="Kategorie…" maxlength="40"
              onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addEditCat())} />
            <button class="btn btn-secondary btn-sm" type="button" onclick={addEditCat}>+</button>
          </div>
          {#each editForm.categories as cat (cat.id)}
            <div class="ar-edit-cat">
              <span>{cat.label}</span>
              <button type="button" onclick={() => removeEditCat(cat.id)} class="ar-cat-rm">×</button>
            </div>
          {/each}
        </div>
      </div>
      <div class="ar-modal-actions">
        <button class="btn btn-secondary" onclick={closeEdit} disabled={isActing} type="button">Abbrechen</button>
        <button class="btn btn-primary" onclick={handleEditApprove} disabled={isActing} type="button">
          {isActing ? 'Wird gespeichert…' : '✅ Speichern & freischalten'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .ar-header {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 20px; padding-bottom: 16px;
    border-bottom: 1px solid var(--color-border-glass);
  }
  .ar-back-btn {
    background: var(--color-surface-glass); border: 1px solid var(--color-border-glass);
    border-radius: 10px; padding: 8px; cursor: pointer; color: var(--color-text-secondary);
    display: flex; align-items: center; transition: all .2s; flex-shrink: 0;
  }
  .ar-back-btn:hover { background: var(--color-primary-glow); color: var(--color-primary); }
  .ar-header-text { flex: 1; }
  .ar-subtitle { font-size: .7rem; font-weight: 800; letter-spacing: .1em; color: var(--color-secondary); text-transform: uppercase; display: block; }
  .ar-title { font-family: var(--font-heading); font-size: 1.3rem; font-weight: 800; color: var(--color-text-primary); margin: 0; }
  .ar-badge {
    background: #f43f5e; color: white; font-size: .75rem; font-weight: 800;
    border-radius: 12px; padding: 2px 8px; min-width: 24px; text-align: center;
  }

  .ar-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
  .ar-tab {
    background: var(--color-surface-glass); border: 1px solid var(--color-border-glass);
    border-radius: 10px; padding: 7px 16px; cursor: pointer; font-size: .82rem;
    font-weight: 700; color: var(--color-text-muted); transition: all .2s;
    display: flex; align-items: center; gap: 6px;
  }
  .ar-tab.active { background: var(--color-primary-glow); border-color: var(--color-primary); color: var(--color-primary); }
  .ar-tab-badge {
    background: #f43f5e; color: white; font-size: .68rem; font-weight: 800;
    border-radius: 8px; padding: 1px 6px;
  }

  .ar-loading { display: flex; align-items: center; gap: 12px; padding: 40px; justify-content: center; color: var(--color-text-muted); }
  .ar-spinner {
    width: 20px; height: 20px; border: 2px solid var(--color-border-glass);
    border-top-color: var(--color-primary); border-radius: 50%;
    animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .ar-empty { padding: 40px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .ar-empty-icon { font-size: 2.5rem; }
  .ar-empty p { color: var(--color-text-muted); margin: 0; }

  .ar-list { display: flex; flex-direction: column; gap: 12px; }
  .ar-card { padding: 16px; border-radius: 16px; }
  .ar-card-top { display: flex; gap: 12px; margin-bottom: 12px; }
  .ar-cover { width: 80px; height: 60px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }
  .ar-emoji-cover {
    width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;
    font-size: 2rem; background: rgba(255,255,255,.05); border-radius: 8px; flex-shrink: 0;
  }
  .ar-card-info { flex: 1; min-width: 0; }
  .ar-game-name { font-family: var(--font-heading); font-size: 1rem; font-weight: 800; margin: 0 0 4px; color: var(--color-text-primary); }
  .ar-meta { font-size: .75rem; color: var(--color-text-muted); font-weight: 600; }
  .ar-description { font-size: .8rem; color: var(--color-text-secondary); margin: 6px 0 0; line-height: 1.4; }
  .ar-admin-note { font-size: .78rem; color: #f59e0b; background: rgba(245,158,11,.1); border-radius: 6px; padding: 6px 10px; margin-top: 6px; }

  .ar-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .ar-btn { flex: 1; min-width: 120px; justify-content: center; }

  .ar-modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(8px);
    z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .ar-modal {
    width: 100%; max-width: 420px; padding: 24px; border-radius: 20px;
    display: flex; flex-direction: column; gap: 16px; max-height: 90vh; overflow-y: auto;
  }
  .ar-modal-wide { max-width: 560px; }
  .ar-modal-title { font-family: var(--font-heading); font-size: 1.1rem; font-weight: 800; margin: 0; color: var(--color-text-primary); }
  .ar-modal-label { display: flex; flex-direction: column; gap: 6px; font-size: .85rem; font-weight: 600; color: var(--color-text-secondary); }
  .ar-modal-input, .ar-modal-textarea {
    background: rgba(255,255,255,.05); border: 1px solid var(--color-border-glass);
    border-radius: 10px; padding: 9px 12px; color: var(--color-text-primary);
    font-size: .88rem; font-family: inherit; transition: border-color .2s;
  }
  .ar-modal-input:focus, .ar-modal-textarea:focus { outline: none; border-color: var(--color-primary); }
  .ar-modal-textarea { resize: vertical; min-height: 72px; }
  .ar-modal-actions { display: flex; gap: 10px; }
  .ar-modal-actions .btn { flex: 1; justify-content: center; }

  .ar-edit-form { display: flex; flex-direction: column; gap: 12px; }
  .ar-edit-row { display: flex; flex-wrap: wrap; gap: 12px; }
  .ar-cat-row { display: flex; gap: 8px; margin-top: 6px; }
  .ar-edit-cat {
    display: flex; align-items: center; justify-content: space-between;
    padding: 5px 10px; background: rgba(255,255,255,.04); border-radius: 6px;
    margin-top: 4px; font-size: .82rem; color: var(--color-text-primary);
  }
  .ar-cat-rm { background: none; border: none; cursor: pointer; color: #f43f5e; font-size: 1rem; padding: 0 4px; }
</style>
