<script>
  // @ts-check
  import { gamesCatalog, navigateTo, showToast, themeMode, isAuthenticated, pocketbaseHost, authService, confirmDialog } from '$lib/stores/app.js';
  import { storeCustomGame } from '$lib/services/DbService.js';
  import { loadGamesCatalog } from '$lib/services/GamesCatalogService.js';
  import { submitPendingGame } from '$lib/services/AdminService.js';
  import { get } from 'svelte/store';

  // ── State ──────────────────────────────────────────────────────────────────
  let step = $state(1);
  let isSaving = $state(false);
  let coverPreviewUrl = $state('');
  /** @type {File|null} */
  let coverFile = $state(null);

  let form = $state({
    name: '',
    description: '',
    emoji: '🎲',
    minPlayers: 2,
    maxPlayers: 4,
    accentColor: '#6366f1',
    /** @type {{id: string, label: string}[]} */
    categories: []
  });

  let catInput = $state('');

  // ── Derived ────────────────────────────────────────────────────────────────
  let nameError = $derived(step === 1 && form.name.trim().length === 0 && isSaving ? 'Pflichtfeld' : '');
  let catError = $derived(step === 2 && form.categories.length === 0 && isSaving ? 'Mindestens eine Kategorie erforderlich.' : '');
  let isDirty = $derived(form.name.trim().length > 0 || form.categories.length > 0);
  let playersLabel = $derived(
    form.minPlayers === form.maxPlayers
      ? `${form.minPlayers} Spieler`
      : `${form.minPlayers}–${form.maxPlayers} Spieler`
  );

  // ── Cover ──────────────────────────────────────────────────────────────────
  /** @param {Event} e */
  function handleCoverFile(e) {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Bild zu groß (max. 5 MB)', 'warning');
      return;
    }
    coverFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => { coverPreviewUrl = /** @type {string} */ (ev.target?.result ?? ''); };
    reader.readAsDataURL(file);
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  function addCategory() {
    const label = catInput.trim();
    if (!label) return;
    if (form.categories.length >= 20) { showToast('Max. 20 Kategorien', 'warning'); return; }
    form.categories = [...form.categories, { id: 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), label }];
    catInput = '';
  }

  /** @param {string} id */
  function removeCategory(id) {
    form.categories = form.categories.filter(c => c.id !== id);
  }

  // Drag-Reorder
  let dragIdx = $state(-1);
  /** @param {number} idx */
  function onDragStart(idx) { dragIdx = idx; }
  /** @param {number} idx */
  function onDragOver(idx) {
    if (dragIdx === -1 || dragIdx === idx) return;
    const cats = [...form.categories];
    const [moved] = cats.splice(dragIdx, 1);
    cats.splice(idx, 0, moved);
    form.categories = cats;
    dragIdx = idx;
  }
  function onDragEnd() { dragIdx = -1; }

  // ── Navigation ─────────────────────────────────────────────────────────────
  async function goBack() {
    if (step === 2) { step = 1; return; }
    if (isDirty && !(await confirmDialog('Änderungen verwerfen?'))) return;
    navigateTo('game-selection');
  }

  function goNext() {
    if (!form.name.trim()) { showToast('Spielname erforderlich', 'warning'); return; }
    step = 2;
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function save() {
    if (form.categories.length === 0) { showToast('Mindestens eine Kategorie erforderlich', 'warning'); return; }
    isSaving = true;
    try {
      const host = get(pocketbaseHost);
      const token = authService.getToken();
      const minP = form.minPlayers;
      const maxP = form.maxPlayers;
      const key = 'custom_' + form.name.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();

      if (token && host) {
        // Online: PocketBase einreichen
        const record = await submitPendingGame(host, token, {
          name: form.name.trim(),
          description: form.description.trim(),
          emoji: form.emoji || '🎲',
          accentColor: form.accentColor,
          minPlayers: minP,
          maxPlayers: maxP,
          categories: form.categories,
          coverFile: coverFile ?? null
        });
        const coverUrl = record.cover
          ? `${host}/api/files/pending_games/${record.id}/${record.cover}`
          : '';
        await storeCustomGame({
          key,
          name: form.name.trim(),
          description: form.description.trim(),
          emoji: form.emoji || '🎲',
          accentColor: form.accentColor,
          players: minP === maxP ? `${minP} Spieler` : `${minP}–${maxP} Spieler`,
          categories: form.categories,
          custom: true,
          order: 999,
          status: 'pending_review',
          pb_id: record.id,
          cover_url: coverUrl,
          cover: coverUrl
        });
        showToast(`"${form.name.trim()}" eingereicht! Wird geprüft ⏳`, 'success');
      } else {
        // Offline-Fallback: nur lokal
        await storeCustomGame({
          key,
          name: form.name.trim(),
          description: form.description.trim(),
          emoji: form.emoji || '🎲',
          accentColor: form.accentColor,
          players: minP === maxP ? `${minP} Spieler` : `${minP}–${maxP} Spieler`,
          categories: form.categories,
          custom: true,
          order: 999,
          status: 'local'
        });
        showToast(`"${form.name.trim()}" lokal gespeichert 💾`, 'success');
      }
      await loadGamesCatalog();
      navigateTo('game-selection');
    } catch (err) {
      showToast(err.message || 'Fehler beim Speichern.', 'error');
    } finally {
      isSaving = false;
    }
  }

  const EMOJI_PRESETS = ['🎲', '🃏', '🧩', '🏰', '🌲', '🪐', '🦖', '⛵', '🗡️', '🧙', '🐉', '🏹'];
  const COLOR_PRESETS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#0ea5e9', '#d946ef', '#e11d48', '#7c3aed'];
</script>

<div class="cge-header">
  <button class="cge-back-btn" onclick={goBack} type="button" aria-label="Zurück">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  </button>
  <div class="cge-header-text">
    <span class="cge-subtitle">NEUES SPIEL</span>
    <h1 class="cge-title">Eigenes Spiel</h1>
  </div>
  <div class="cge-step-indicator" aria-label="Schritt {step} von 2">
    <div class="cge-step-bar">
      <div class="cge-step-fill" style="width:{step === 1 ? '50%' : '100%'}"></div>
    </div>
    <span class="cge-step-label">Schritt {step} / 2</span>
  </div>
</div>

<!-- Live-Preview Card -->
<div class="cge-preview-wrap">
  <div class="game-card preview-card glass-panel" style="--accent:{form.accentColor}">
    <div class="game-card-bg">
      {#if coverPreviewUrl}
        <img src={coverPreviewUrl} alt="Cover-Vorschau" class="game-card-img" style="transform:scale(1.05);" />
      {:else}
        <div class="game-card-emoji-bg" style="font-size:4rem;display:flex;align-items:center;justify-content:center;height:100%;opacity:.25;">{form.emoji||'🎲'}</div>
      {/if}
      <div class="game-card-overlay" style="background-image:{$themeMode==='light'
        ? `linear-gradient(to bottom,rgba(255,255,255,0)0%,rgba(255,255,255,.4)100%),linear-gradient(135deg,rgba(255,255,255,.4)0%,${form.accentColor}18 100%)`
        : `linear-gradient(to bottom,rgba(11,15,25,0)0%,rgba(11,15,25,.85)100%),linear-gradient(135deg,rgba(11,15,25,.6)0%,${form.accentColor}24 100%)`};border-radius:20px;"></div>
    </div>
    <div class="game-card-content">
      <span class="game-badge">Vorschau</span>
      <h3 class="game-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{form.name||'Spielname'}</h3>
      <p class="game-description" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">{form.description||'Beschreibung...'}</p>
      <div class="game-footer">
        <span class="game-players">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" style="display:inline-block;vertical-align:middle;margin-right:4px;margin-top:-2px;">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {playersLabel}
        </span>
        <span class="game-action">Starten →</span>
      </div>
    </div>
  </div>
</div>

<!-- SCHRITT 1: Grunddaten -->
{#if step === 1}
<div class="cge-form animate-scale-up">
  <div class="cge-section-title">① Grunddaten</div>

  <label class="cge-label">
    <div class="cge-label-row">
      <span>Spielname <span class="req">*</span></span>
      <span class="cge-char" class:warn={form.name.length > 50}>{form.name.length}/60</span>
    </div>
    <input class="cge-input" class:error={!!nameError} type="text" bind:value={form.name}
      placeholder="z. B. Mein Kartenspiel" maxlength="60" />
    {#if nameError}<span class="cge-error">{nameError}</span>{/if}
  </label>

  <label class="cge-label">
    <div class="cge-label-row">
      <span>Beschreibung</span>
      <span class="cge-char" class:warn={form.description.length > 140}>{form.description.length}/160</span>
    </div>
    <textarea class="cge-input cge-textarea" bind:value={form.description}
      placeholder="Kurze Erklärung oder Zusatzregeln" maxlength="160" rows="2"></textarea>
  </label>

  <div class="cge-row">
    <label class="cge-label">
      <span>Min. Spieler</span>
      <input class="cge-input" type="number" bind:value={form.minPlayers} min="1" max="12" />
    </label>
    <label class="cge-label">
      <span>Max. Spieler</span>
      <input class="cge-input" type="number" bind:value={form.maxPlayers} min="1" max="12" />
    </label>
  </div>

  <div class="cge-label">
    <span>Emoji & Symbol</span>
    <div class="cge-emoji-row">
      <input class="cge-input cge-emoji-input" type="text" bind:value={form.emoji} placeholder="🎲" maxlength="4" />
      <div class="cge-presets">
        {#each EMOJI_PRESETS as em}
          <button type="button" class="cge-preset-btn" class:active={form.emoji === em}
            onclick={() => form.emoji = em}>{em}</button>
        {/each}
      </div>
    </div>
  </div>

  <div class="cge-label">
    <span>Akzentfarbe</span>
    <div class="cge-color-row">
      <div class="cge-color-wrap">
        <input type="color" bind:value={form.accentColor} class="cge-color-native" />
        <div class="cge-color-swatch" style="background:{form.accentColor}"></div>
      </div>
      <div class="cge-presets">
        {#each COLOR_PRESETS as color}
          <button type="button" class="cge-color-preset" class:active={form.accentColor === color}
            style="background:{color};" onclick={() => form.accentColor = color}
            aria-label="Farbe {color}"></button>
        {/each}
      </div>
    </div>
  </div>

  <div class="cge-label">
    <span>Cover-Bild (optional)</span>
    <label class="cge-cover-upload" class:has-cover={!!coverPreviewUrl}>
      {#if coverPreviewUrl}
        <img src={coverPreviewUrl} alt="Cover" class="cge-cover-thumb" />
        <span class="cge-cover-change">Ändern</span>
      {:else}
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 15l5-5 4 4 3-3 6 6"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
        </svg>
        <span>Bild hochladen</span>
        <span class="cge-cover-hint">JPG, PNG, WebP · max. 5 MB</span>
      {/if}
      <input type="file" accept="image/jpeg,image/png,image/webp" onchange={handleCoverFile} style="display:none;" />
    </label>
  </div>

  <button class="btn btn-primary cge-next-btn" type="button" onclick={goNext}>
    Weiter — Wertungskategorien
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-left:6px;">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  </button>
</div>
{/if}

<!-- SCHRITT 2: Kategorien -->
{#if step === 2}
<div class="cge-form animate-scale-up">
  <div class="cge-section-title">② Wertungskategorien</div>

  <div class="cge-label">
    <div class="cge-label-row">
      <span>Kategorien ({form.categories.length}/20) <span class="req">*</span></span>
    </div>
    <div class="cge-cat-row">
      <input class="cge-input" type="text" bind:value={catInput}
        placeholder="z. B. Siegpunkte, Rohstoffe…" maxlength="40"
        onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())} />
      <button class="btn btn-secondary btn-sm" type="button" onclick={addCategory}
        style="min-height:unset;padding:8px 16px;white-space:nowrap;">+ Hinzufügen</button>
    </div>
    {#if catError}<span class="cge-error">{catError}</span>{/if}

    {#if form.categories.length > 0}
      <div class="cge-cat-list">
        {#each form.categories as cat, idx (cat.id)}
          <div
            role="listitem"
            class="cge-cat-item animate-scale-up"
            class:dragging={dragIdx === idx}
            draggable="true"
            ondragstart={() => onDragStart(idx)}
            ondragover={(e) => { e.preventDefault(); onDragOver(idx); }}
            ondragend={onDragEnd}
          >
            <svg class="cge-drag-handle" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/>
            </svg>
            <span class="cge-cat-label">{cat.label}</span>
            <button type="button" class="cge-cat-remove" onclick={() => removeCategory(cat.id)} aria-label="Entfernen">×</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="cge-form-actions">
    <button class="btn btn-secondary" type="button" onclick={goBack} disabled={isSaving}>← Zurück</button>
    <button class="btn btn-primary" type="button" onclick={save} disabled={isSaving} id="btn-save-custom-game">
      {#if isSaving}
        <span>Einreichen… 🕒</span>
      {:else}
        <span>Spiel einreichen ⏳</span>
      {/if}
    </button>
  </div>
</div>
{/if}

<style>
  .cge-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--color-border-glass);
  }
  .cge-back-btn {
    background: var(--color-surface-glass);
    border: 1px solid var(--color-border-glass);
    border-radius: 10px;
    padding: 8px;
    cursor: pointer;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    transition: all .2s;
    flex-shrink: 0;
  }
  .cge-back-btn:hover { background: var(--color-primary-glow); color: var(--color-primary); }
  .cge-header-text { flex: 1; }
  .cge-subtitle {
    font-size: .7rem; font-weight: 800; letter-spacing: .1em;
    color: var(--color-secondary); text-transform: uppercase; display: block;
  }
  .cge-title {
    font-family: var(--font-heading); font-size: 1.3rem; font-weight: 800;
    color: var(--color-text-primary); margin: 0;
  }
  .cge-step-indicator { text-align: right; min-width: 80px; }
  .cge-step-bar {
    height: 4px; background: rgba(255,255,255,.08); border-radius: 2px; overflow: hidden; margin-bottom: 4px;
  }
  .cge-step-fill {
    height: 100%; background: var(--color-primary);
    border-radius: 2px; transition: width .4s cubic-bezier(.16,1,.3,1);
  }
  .cge-step-label { font-size: .7rem; color: var(--color-text-muted); font-weight: 600; }

  .cge-preview-wrap {
    display: flex; justify-content: center; margin-bottom: 20px;
  }
  .preview-card {
    width: 100%; max-width: 280px; pointer-events: none;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
  }

  .cge-form { display: flex; flex-direction: column; gap: 16px; }
  .cge-section-title {
    font-size: .75rem; font-weight: 800; letter-spacing: .08em;
    color: var(--color-secondary); text-transform: uppercase;
  }
  .cge-label { display: flex; flex-direction: column; gap: 6px; font-size: .85rem; font-weight: 600; color: var(--color-text-secondary); }
  .cge-label-row { display: flex; justify-content: space-between; align-items: center; }
  .req { color: var(--color-primary); }
  .cge-char { font-size: .75rem; font-weight: 500; color: var(--color-text-muted); }
  .cge-char.warn { color: #f59e0b; }
  .cge-input {
    width: 100%; padding: 10px 12px; border-radius: 10px;
    background: rgba(255,255,255,.05); border: 1px solid var(--color-border-glass);
    color: var(--color-text-primary); font-size: .9rem; font-family: inherit;
    transition: border-color .2s, box-shadow .2s; box-sizing: border-box;
  }
  .cge-input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-glow); }
  .cge-input.error { border-color: #f43f5e; }
  .cge-textarea { resize: vertical; min-height: 60px; }
  .cge-error { font-size: .75rem; color: #f43f5e; font-weight: 600; }
  .cge-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  .cge-emoji-row { display: flex; align-items: center; gap: 10px; }
  .cge-emoji-input { width: 56px; text-align: center; font-size: 1.2rem; padding: 6px; flex-shrink: 0; }
  .cge-presets { display: flex; flex-wrap: wrap; gap: 6px; }
  .cge-preset-btn {
    background: rgba(255,255,255,.05); border: 1px solid var(--color-border-glass);
    border-radius: 8px; padding: 6px 8px; cursor: pointer; font-size: 1.1rem;
    transition: all .15s;
  }
  .cge-preset-btn.active, .cge-preset-btn:hover { background: var(--color-primary-glow); border-color: var(--color-primary); }

  .cge-color-row { display: flex; align-items: center; gap: 12px; }
  .cge-color-wrap { position: relative; width: 40px; height: 40px; border-radius: 10px; overflow: hidden; flex-shrink: 0; border: 1px solid var(--color-border-glass); cursor: pointer; }
  .cge-color-native { position: absolute; inset: -4px; width: calc(100% + 8px); height: calc(100% + 8px); opacity: 0; cursor: pointer; }
  .cge-color-swatch { width: 100%; height: 100%; border-radius: 10px; }
  .cge-color-preset {
    width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent;
    cursor: pointer; transition: all .15s; flex-shrink: 0;
  }
  .cge-color-preset.active, .cge-color-preset:hover { border-color: white; transform: scale(1.15); }

  .cge-cover-upload {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; padding: 20px; border-radius: 12px;
    border: 2px dashed var(--color-border-glass); cursor: pointer;
    color: var(--color-text-muted); font-size: .85rem; font-weight: 600;
    transition: all .2s; min-height: 100px; position: relative; overflow: hidden;
    text-align: center;
  }
  .cge-cover-upload:hover { border-color: var(--color-primary); color: var(--color-primary); }
  .cge-cover-upload.has-cover { border-style: solid; padding: 0; min-height: 120px; }
  .cge-cover-thumb { width: 100%; height: 120px; object-fit: cover; border-radius: 10px; display: block; }
  .cge-cover-change {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,.5); color: white; font-weight: 700; font-size: .85rem;
    opacity: 0; transition: opacity .2s; border-radius: 10px;
  }
  .cge-cover-upload.has-cover:hover .cge-cover-change { opacity: 1; }
  .cge-cover-hint { font-size: .7rem; color: var(--color-text-muted); font-weight: 400; }

  .cge-next-btn { width: 100%; justify-content: center; margin-top: 8px; }

  .cge-cat-row { display: flex; gap: 8px; }
  .cge-cat-list { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; padding: 4px; }
  .cge-cat-item {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    background: rgba(255,255,255,.04); border-radius: 8px;
    border: 1px solid var(--color-border-glass); cursor: grab;
    transition: background .15s, opacity .15s;
  }
  .cge-cat-item.dragging { opacity: .5; background: var(--color-primary-glow); }
  .cge-drag-handle { color: var(--color-text-muted); flex-shrink: 0; }
  .cge-cat-label { flex: 1; font-size: .85rem; font-weight: 600; color: var(--color-text-primary); }
  .cge-cat-remove {
    background: none; border: none; cursor: pointer; color: var(--color-text-muted);
    font-size: 1.1rem; line-height: 1; padding: 2px 4px; border-radius: 4px;
    transition: color .15s, background .15s;
  }
  .cge-cat-remove:hover { color: #f43f5e; background: rgba(244,63,94,.1); }

  .cge-form-actions { display: flex; gap: 10px; margin-top: 8px; }
  .cge-form-actions .btn { flex: 1; justify-content: center; }

  :global([data-theme="light"]) .cge-input {
    background: rgba(0,0,0,.04);
    color: var(--color-text-primary);
  }
</style>
