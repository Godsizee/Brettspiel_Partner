<script>
  import { playerCount, activeScreen, currentGame, currentSessionDuration, prefilledPlayerNames, showToast, navigateTo, playerProfiles, loadPlayerProfiles, playerColors, DEFAULT_PLAYER_COLORS, confirmDialog } from '$lib/stores/app.js';
  import { untrack, onMount } from 'svelte';
  import { storeProfile, lookupUser, inviteUser } from '$lib/services/DbService.js';

  /** @type {string[]} */
  let playerNames = $state(
    Array.from({ length: $playerCount }, (_, i) =>
      ($prefilledPlayerNames && $prefilledPlayerNames[i]) ? $prefilledPlayerNames[i] : ''
    )
  );

  let lastPlayers = $state([]);
  let activeSuggestionIndex = $state(-1);
  let searchTimeout = null;
  let onlineSuggestions = $state([]);
  let linkedUsers = $state({}); // Mapping index -> user_id

  onMount(async () => {
    try {
      const { pullProfilesFromRemote } = await import('$lib/services/DbService.js');
      await pullProfilesFromRemote();
    } catch (_) {}
    await loadPlayerProfiles();
    try {
      const saved = localStorage.getItem('bg_last_players');
      if (saved) {
        lastPlayers = JSON.parse(saved);
      }
    } catch (_) {}
  });

  // Sync playerNames length when playerCount changes (ohne Tracking von playerNames selbst)
  $effect(() => {
    const count = $playerCount; // tracked
    playerNames = untrack(() =>
      Array.from({ length: count }, (_, i) => playerNames[i] ?? '')
    );
  });

  function decrement() {
    if (navigator.vibrate) navigator.vibrate(10);
    if ($playerCount > 1) playerCount.update(n => n - 1);
  }

  function increment() {
    if (navigator.vibrate) navigator.vibrate(10);
    if ($playerCount < 8) playerCount.update(n => n + 1);
  }

  function useLastPlayers() {
    if (navigator.vibrate) navigator.vibrate(10);
    if (lastPlayers.length > 0) {
      playerCount.set(lastPlayers.length);
      playerNames = [...lastPlayers];
    }
  }

  async function handleInput(e, index) {
    const val = e.target.value;
    activeSuggestionIndex = index;
    linkedUsers[index] = null; // Reset if changed
    
    if (searchTimeout) clearTimeout(searchTimeout);
    if (val.trim().length >= 3) {
      searchTimeout = setTimeout(async () => {
        const res = await lookupUser(val.trim());
        onlineSuggestions = res || [];
      }, 400);
    } else {
      onlineSuggestions = [];
    }
  }

  function getSuggestions(val, index) {
    if (!val || val.trim() === '') return [];
    const lowerVal = val.toLowerCase().trim();
    const activeNames = playerNames.map((n, idx) => idx !== index ? n.toLowerCase().trim() : '');
    const localMatches = $playerProfiles.filter(p => 
      p.name.toLowerCase().includes(lowerVal) && 
      !activeNames.includes(p.name.toLowerCase().trim())
    );
    
    // Merge local and online, avoiding duplicates by name
    const combined = [...localMatches];
    onlineSuggestions.forEach(os => {
       if (!combined.some(c => c.name.toLowerCase() === os.name.toLowerCase() || c.name.toLowerCase() === os.username?.toLowerCase())) {
           combined.push({ name: os.name || os.username, avatar: os.avatar || '🌍', color: '#6366f1', user_id: os.id });
       }
    });
    return combined;
  }

  function selectProfile(index, profile) {
    playerNames[index] = profile.name;
    if (profile.user_id) linkedUsers[index] = profile.user_id;
    activeSuggestionIndex = -1;
    onlineSuggestions = [];
  }

  async function invite(index) {
    const email = playerNames[index].trim();
    if (!email.includes('@')) {
       showToast('Bitte eine gültige E-Mail eingeben.', 'error');
       return;
    }
    try {
       await inviteUser(email);
       showToast(`Einladung an ${email} versendet!`, 'success');
       activeSuggestionIndex = -1;
    } catch(err) {
       showToast('Fehler beim Einladen.', 'error');
    }
  }

  function isNewName(name) {
    if (!name || name.trim() === '') return false;
    const lower = name.toLowerCase().trim();
    return !$playerProfiles.some(p => p.name.toLowerCase().trim() === lower);
  }

  async function createProfileForPlayer(index) {
    const name = playerNames[index].trim();
    if (!name) return;
    
    const colors = DEFAULT_PLAYER_COLORS;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const emojis = ['🎲', '🎯', '🃏', '🧩', '👾', '🦁', '🦊', '🦉', '🦖'];
    const avatar = emojis[Math.floor(Math.random() * emojis.length)];
    
    const newProfile = {
      name,
      color,
      avatar
    };
    
    try {
      await storeProfile(newProfile);
      await loadPlayerProfiles();
      showToast(`Profil für ${name} erfolgreich erstellt! 🎉`, 'success');
    } catch (err) {
      showToast('Fehler beim Erstellen des Profils.', 'error');
    }
  }

  function getPlayerColor(name, i) {
    if (name) {
      const profile = $playerProfiles.find(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
      if (profile && profile.color) return profile.color;
    }
    return DEFAULT_PLAYER_COLORS[i % DEFAULT_PLAYER_COLORS.length];
  }

  async function abort() {
    navigateTo('game-selection');
    currentGame.set(null);
    currentSessionDuration.set(0);
    prefilledPlayerNames.set(null);
  }

  async function confirm_setup() {
    let names = playerNames.map((n, i) => n.trim() !== '' ? n.trim() : `Spieler ${i + 1}`);

    // Auto-Lookup für noch nicht verknüpfte Namen (E-Mail oder Username)
    for (let i = 0; i < names.length; i++) {
        if (!linkedUsers[i] && names[i].length >= 3) {
            try {
                const res = await lookupUser(names[i]);
                if (res && res.length > 0) {
                    const queryLower = names[i].toLowerCase();
                    const exact = res.find(r => 
                        (r.username && r.username.toLowerCase() === queryLower) || 
                        (r.name && r.name.toLowerCase() === queryLower)
                    );
                    if (exact) {
                        linkedUsers[i] = exact.id;
                        names[i] = exact.name || exact.username;
                    } else if (names[i].includes('@') && res.length === 1) {
                        linkedUsers[i] = res[0].id;
                        names[i] = res[0].name || res[0].username;
                    }
                }
            } catch (err) {}
        }
    }

    prefilledPlayerNames.set(names);

    // Speichere verknüpfte User-IDs temporär, damit ScoreSheet diese übernehmen kann
    localStorage.setItem('bg_linked_users', JSON.stringify(linkedUsers));

    // Zuweisung der Farben
    const colors = names.map((name, i) => {
      const profile = $playerProfiles.find(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
      if (profile && profile.color) {
        return profile.color;
      }
      return DEFAULT_PLAYER_COLORS[i % DEFAULT_PLAYER_COLORS.length];
    });
    playerColors.set(colors);

    navigateTo('score-sheet');
    showToast('Spieler geladen! Bitte Punkte eintragen.', 'success');
  }
  // U5: Drag & Drop via Pointer Events
  let dragIndex = $state(-1);
  let dragOverIndex = $state(-1);

  /** @param {PointerEvent} e @param {number} i */
  function onDragHandlePointerDown(e, i) {
    e.preventDefault();
    dragIndex = i;
    const handle = /** @type {HTMLElement} */ (e.currentTarget);
    handle.setPointerCapture(e.pointerId);
  }

  /** @param {PointerEvent} e */
  function onDragPointerMove(e) {
    if (dragIndex < 0) return;
    const list = document.getElementById('player-names-list');
    if (!list) return;
    const rows = Array.from(list.querySelectorAll('.player-input-wrapper'));
    let found = -1;
    rows.forEach((row, idx) => {
      const rect = row.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) found = idx;
    });
    if (found !== -1) dragOverIndex = found;
  }

  function onDragPointerUp() {
    if (dragIndex >= 0 && dragOverIndex >= 0 && dragIndex !== dragOverIndex) {
      const updated = [...playerNames];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(dragOverIndex, 0, moved);
      playerNames = updated;
      if (navigator.vibrate) navigator.vibrate(20);
    }
    dragIndex = -1;
    dragOverIndex = -1;
  }
</script>

<div class="player-setup-container glass-panel flex flex-col gap-6 p-7 mt-4 max-[360px]:p-4 max-[360px]:gap-4 max-[360px]:mt-2">
  <h1 class="sr-only">Spieler-Setup</h1>
  <div class="flex flex-col gap-1.5">
    <span class="game-session-badge">Spieler festlegen</span>
    <h2 class="setup-title">Wer spielt mit?</h2>
    <p class="setup-subtitle">Wähle die Anzahl und trage die Namen der Spieler ein.</p>
  </div>

  <!-- Stepper -->
  <div class="flex items-center justify-between gap-4">
    <span class="selector-label">Anzahl Spieler:</span>
    <div class="stepper">
      <button type="button" class="btn-stepper" id="btn-player-decrement" onclick={decrement}>−</button>
      <span class="stepper-value" id="player-count-value">{$playerCount}</span>
      <button type="button" class="btn-stepper" id="btn-player-increment" onclick={increment}>+</button>
    </div>
  </div>

  <!-- Zuletzt gespielte Spieler -->
  {#if lastPlayers.length > 0}
    <div class="last-players-row">
      <button type="button" class="btn-last-players" onclick={useLastPlayers}>
        🔄 Gleiche Spieler wie zuletzt: {lastPlayers.join(', ')}
      </button>
    </div>
  {/if}

  <!-- Spieler-Eingaben -->
  <div class="flex flex-col gap-4" id="player-names-list">
    {#each playerNames as name, i}
      <div class="relative w-full" class:drag-over={dragOverIndex === i && dragIndex !== i}>
        <div class="flex items-center gap-3">
          <!-- U5: Drag Handle -->
          <button type="button"
            class="drag-handle"
            title="Reihenfolge ändern"
            aria-label="Reihenfolge ändern"
            onpointerdown={(e) => onDragHandlePointerDown(e, i)}
            onpointermove={onDragPointerMove}
            onpointerup={onDragPointerUp}
          >⠿</button>
          <span class="player-num" style="color: {getPlayerColor(playerNames[i], i)}">{i + 1}</span>
          <input
            type="text"
            class="player-input"
            placeholder="Spieler {i + 1} oder E-Mail"
            bind:value={playerNames[i]}
            oninput={(e) => handleInput(e, i)}
            onfocus={() => activeSuggestionIndex = i}
            onblur={() => setTimeout(() => { if (activeSuggestionIndex === i) activeSuggestionIndex = -1; }, 250)}
            maxlength="50"
          />
          {#if isNewName(playerNames[i])}
            <button type="button" class="btn-save-profile" onclick={() => createProfileForPlayer(i)} title="Als Profil speichern">
              💾+
            </button>
          {/if}
        </div>

        <!-- Autocomplete Suggestions -->
        {#if activeSuggestionIndex === i}
          {@const sug = getSuggestions(playerNames[i], i)}
          {#if sug.length > 0 || (playerNames[i] && playerNames[i].includes('@'))}
            <div class="suggestions-dropdown glass-panel">
              {#each sug as p}
                <button type="button" class="suggestion-item" onmousedown={() => selectProfile(i, p)}>
                  <span class="sug-avatar">{p.avatar}</span>
                  <span class="sug-name">{p.name} {p.user_id ? '(PB)' : ''}</span>
                  <span class="sug-color-dot" style="background: {p.color}"></span>
                </button>
              {/each}
              {#if playerNames[i] && playerNames[i].includes('@') && !sug.some(p => p.name === playerNames[i])}
                <button type="button" class="suggestion-item invite-item" onmousedown={() => invite(i)}>
                  <span class="sug-avatar">✉️</span>
                  <span class="sug-name">Spieler einladen ({playerNames[i]})</span>
                </button>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <div class="flex flex-wrap gap-3 max-[360px]:gap-2 setup-actions-container">
    <button class="btn btn-secondary" id="btn-abort-setup" onclick={abort}>Abbrechen</button>
    <button class="btn btn-primary btn-icon" id="btn-confirm-setup" onclick={confirm_setup}>
      Wertung starten 
      <span class="icon">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-left:4px; margin-top:-2px;">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </span>
    </button>
  </div>
</div>

<style>
  .game-session-badge {
    display: inline-block;
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: rgba(255,255,255,0.07);
    border: 1px solid var(--color-border-glow);
    color: var(--color-secondary);
    width: fit-content;
  }

  .setup-title {
    font-family: var(--font-heading);
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-text-primary);
  }

  .setup-subtitle {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .selector-label {
    font-family: var(--font-heading);
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .last-players-row {
    width: 100%;
  }

  .btn-last-players {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-secondary);
    padding: 10px 16px;
    border-radius: 12px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    width: 100%;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-last-players:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--color-primary-glow);
    color: var(--color-text-primary);
  }

  .drag-handle {
    background: none;
    border: none;
    font-size: 1.1rem;
    color: var(--color-text-muted, rgba(255,255,255,0.3));
    cursor: grab;
    user-select: none;
    touch-action: none;
    flex-shrink: 0;
    padding: 4px 2px;
    transition: color 0.2s;
  }

  .drag-handle:active { cursor: grabbing; color: var(--color-primary); }

  .drag-over {
    outline: 2px dashed var(--color-primary);
    border-radius: 12px;
    background: var(--color-primary-glow, rgba(99,102,241,0.07));
  }

  .player-num {
    font-family: var(--font-heading);
    font-size: 1.1rem;
    font-weight: 800;
    width: 20px;
    text-align: center;
    flex-shrink: 0;
    transition: color 0.3s ease;
  }

  .player-input {
    flex: 1;
    width: 100%;
    min-width: 0;
    background-color: rgba(0,0,0,0.25);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-primary);
    font-family: var(--font-body);
    font-size: 0.95rem;
    padding: 11px 14px;
    border-radius: 12px;
    transition: var(--transition-normal);
  }

  .player-input:focus {
    border-color: var(--color-primary);
    background-color: rgba(0,0,0,0.35);
    outline: none;
    box-shadow: 0 0 10px var(--color-primary-glow);
  }

  :global([data-theme="light"]) .player-input {
    background-color: rgba(0, 0, 0, 0.04);
    border-color: hsla(215, 20%, 70%, 0.5);
    color: var(--color-text-primary);
  }
  :global([data-theme="light"]) .player-input:focus {
    background-color: rgba(0, 0, 0, 0.07);
    border-color: var(--color-primary);
  }

  .btn-save-profile {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-secondary);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: var(--transition-fast);
    flex-shrink: 0;
  }

  .btn-save-profile:hover {
    background: var(--color-primary-glow);
    color: var(--color-text-primary);
    border-color: var(--color-primary);
  }

  .suggestions-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 32px;
    right: 0;
    z-index: 100;
    max-height: 180px;
    overflow-y: auto;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--color-border-glass);
    border-radius: 12px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    font-size: 0.88rem;
    font-family: var(--font-body);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: var(--transition-fast);
  }

  .suggestion-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .sug-avatar {
    font-size: 1.1rem;
  }

  .sug-name {
    flex: 1;
    font-weight: 600;
  }

  .sug-color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .icon { font-size: 0.9rem; }

  @media (max-width: 360px) {
    .setup-title {
      font-size: 1.25rem !important;
    }
    .player-input {
      padding: 8px 12px !important;
      font-size: 0.88rem !important;
    }
    .setup-actions-container .btn {
      padding: 10px 14px !important;
      font-size: 0.85rem !important;
    }
  }
</style>
