<script>
  // @ts-check
  import { untrack, onMount } from 'svelte';
  import GripVertical from '@lucide/svelte/icons/grip-vertical';
  import UserPlus from '@lucide/svelte/icons/user-plus';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Mail from '@lucide/svelte/icons/mail';
  import {
    playerCount, currentGame, currentSessionDuration, prefilledPlayerNames, showToast, playerProfiles,
    loadPlayerProfiles, playerColors, DEFAULT_PLAYER_COLORS,
  } from '$lib/stores/app.js';
  import { navigate, currentRoute } from '$lib/router/router.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import { toSlug } from '$lib/components/wiki/utils/wikiKeys.js';
  import { storeProfile, lookupUser, inviteUser } from '$lib/services/DbService.js';
  import Screen from '$lib/ui/Screen.svelte';
  import Stepper from '$lib/ui/Stepper.svelte';
  import Field from '$lib/ui/Field.svelte';
  import Button from '$lib/ui/Button.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import PlayerDot from '$lib/ui/PlayerDot.svelte';

  let next = $derived($currentRoute?.query.next === 'score' ? 'score' : 'live');

  /** @type {string[]} */
  let playerNames = $state(
    Array.from({ length: $playerCount }, (_, i) =>
      ($prefilledPlayerNames && $prefilledPlayerNames[i]) ? $prefilledPlayerNames[i] : ''
    )
  );

  /** @type {string[]} */
  let lastPlayers = $state([]);
  let activeSuggestionIndex = $state(-1);
  /** @type {ReturnType<typeof setTimeout> | null} */
  let searchTimeout = null;
  /** @type {any[]} */
  let onlineSuggestions = $state([]);
  /** @type {Record<number, string | null>} */
  let linkedUsers = $state({}); // Mapping index -> user_id
  let busy = $state(false);

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

  /** @param {number} n */
  function setCount(n) {
    if (navigator.vibrate) navigator.vibrate(10);
    playerCount.set(n);
  }

  function useLastPlayers() {
    if (navigator.vibrate) navigator.vibrate(10);
    if (lastPlayers.length > 0) {
      playerCount.set(lastPlayers.length);
      playerNames = [...lastPlayers];
    }
  }

  /** @param {Event} e @param {number} index */
  async function handleInput(e, index) {
    const val = /** @type {HTMLInputElement} */ (e.target).value;
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

  /** @param {string} val @param {number} index */
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

  /** @param {number} index @param {any} profile */
  function selectProfile(index, profile) {
    playerNames[index] = profile.name;
    if (profile.user_id) linkedUsers[index] = profile.user_id;
    activeSuggestionIndex = -1;
    onlineSuggestions = [];
  }

  /** @param {number} index */
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
    } catch (err) {
      showToast('Fehler beim Einladen.', 'error');
    }
  }

  /** @param {string} name */
  function isNewName(name) {
    if (!name || name.trim() === '') return false;
    const lower = name.toLowerCase().trim();
    return !$playerProfiles.some(p => p.name.toLowerCase().trim() === lower);
  }

  /** @param {number} index */
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
      showToast(`Profil für ${name} erstellt`, 'success');
    } catch (err) {
      showToast('Fehler beim Erstellen des Profils.', 'error');
    }
  }

  /** @param {string} name @param {number} i */
  function getPlayerColor(name, i) {
    if (name) {
      const profile = $playerProfiles.find(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
      if (profile && profile.color) return profile.color;
    }
    return DEFAULT_PLAYER_COLORS[i % DEFAULT_PLAYER_COLORS.length];
  }

  function abort() {
    navigate(appHash.home());
    currentGame.set(null);
    currentSessionDuration.set(0);
    prefilledPlayerNames.set(null);
  }

  async function confirm_setup() {
    busy = true;
    let names = playerNames.map((n, i) => n.trim() !== '' ? n.trim() : `Spieler ${i + 1}`);

    // Auto-Lookup für noch nicht verknüpfte Namen (E-Mail oder Username)
    for (let i = 0; i < names.length; i++) {
      if (!linkedUsers[i] && names[i].length >= 3) {
        try {
          const res = await lookupUser(names[i]);
          if (res && res.length > 0) {
            const queryLower = names[i].toLowerCase();
            const exact = res.find((/** @type {any} */ r) =>
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

    // Ab hier ist es eine frische Partie: „Nur werten“ hat keine Spielzeit.
    if (next === 'live') navigate(appHash.matchLive(true), { replace: true });
    else {
      currentSessionDuration.set(0);
      navigate(appHash.matchScore(), { replace: true });
    }
    busy = false;
  }

  // U5: Drag & Drop via Pointer Events
  let dragIndex = $state(-1);
  let dragOverIndex = $state(-1);
  /** @type {HTMLElement | undefined} */
  let listEl = $state();

  /** @param {PointerEvent} e @param {number} i */
  function onDragHandlePointerDown(e, i) {
    e.preventDefault();
    dragIndex = i;
    const handle = /** @type {HTMLElement} */ (e.currentTarget);
    handle.setPointerCapture(e.pointerId);
  }

  /** @param {PointerEvent} e */
  function onDragPointerMove(e) {
    if (dragIndex < 0 || !listEl) return;
    const rows = Array.from(listEl.querySelectorAll('[data-player-row]'));
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

<Screen title="Wer spielt mit?" back={$currentGame ? appHash.game(toSlug($currentGame)) : appHash.home()}>
  <div class="flex flex-col gap-4 pt-2">
    <div class="flex items-center justify-between gap-4">
      <span class="font-semibold">Anzahl</span>
      <Stepper label="Spielerzahl" min={1} max={8} value={$playerCount} onchange={setCount} />
    </div>

    {#if lastPlayers.length > 0}
      <button type="button" onclick={useLastPlayers}
        class="flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface-2 px-3 text-left text-sm font-semibold text-fg-2 hover:text-fg">
        <RotateCcw class="size-4 shrink-0" aria-hidden="true" />
        <span class="min-w-0 truncate">Wie letztes Mal: {lastPlayers.join(', ')}</span>
      </button>
    {/if}

    <div class="flex flex-col gap-3" bind:this={listEl}>
      {#each playerNames as name, i}
        <div data-player-row class={['relative rounded-md', dragOverIndex === i && dragIndex !== i && 'outline outline-2 outline-accent']}>
          <div class="flex items-center gap-2">
            <button type="button" title="Reihenfolge ändern" aria-label="Reihenfolge von Spieler {i + 1} ändern"
              class="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-full text-fg-3 hover:bg-surface-2 active:cursor-grabbing"
              onpointerdown={(e) => onDragHandlePointerDown(e, i)}
              onpointermove={onDragPointerMove}
              onpointerup={onDragPointerUp}
              onpointercancel={onDragPointerUp}>
              <GripVertical class="size-5" aria-hidden="true" />
            </button>
            <PlayerDot size="md" name={name.trim() || String(i + 1)} color={getPlayerColor(name, i)} />
            <div class="min-w-0 flex-1">
              <Field label="Name Spieler {i + 1}" hideLabel placeholder="Spieler {i + 1} oder E-Mail" maxlength="50"
                autocomplete="off" bind:value={playerNames[i]}
                oninput={(/** @type {Event} */ e) => handleInput(e, i)}
                onfocus={() => (activeSuggestionIndex = i)}
                onblur={() => setTimeout(() => { if (activeSuggestionIndex === i) activeSuggestionIndex = -1; }, 250)} />
            </div>
            {#if isNewName(name)}
              <IconButton label="Als Profil speichern" variant="outline" onclick={() => createProfileForPlayer(i)}>
                <UserPlus class="size-5" aria-hidden="true" />
              </IconButton>
            {/if}
          </div>

          <!-- Autocomplete -->
          {#if activeSuggestionIndex === i}
            {@const sug = getSuggestions(name, i)}
            {#if sug.length > 0 || (name && name.includes('@'))}
              <div role="listbox" aria-label="Vorschläge für Spieler {i + 1}"
                class="mt-1.5 overflow-hidden rounded-md border border-line bg-surface shadow-1">
                {#each sug as p}
                  <button type="button" role="option" aria-selected="false" onmousedown={() => selectProfile(i, p)}
                    class="flex min-h-12 w-full items-center gap-3 border-t border-line px-3 text-left first:border-t-0 hover:bg-surface-2">
                    <span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2" aria-hidden="true">{p.avatar}</span>
                    <span class="min-w-0 flex-1 truncate font-medium">{p.name}{p.user_id ? ' · Konto' : ''}</span>
                    <PlayerDot color={p.color} />
                  </button>
                {/each}
                {#if name && name.includes('@') && !sug.some(p => p.name === name)}
                  <button type="button" role="option" aria-selected="false" onmousedown={() => invite(i)}
                    class="flex min-h-12 w-full items-center gap-3 border-t border-line px-3 text-left first:border-t-0 hover:bg-surface-2">
                    <span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2" aria-hidden="true"><Mail class="size-4" /></span>
                    <span class="min-w-0 flex-1 truncate font-medium">Spieler einladen ({name})</span>
                  </button>
                {/if}
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  </div>

  {#snippet dock()}
    <Button variant="ghost" size="lg" class="flex-1" onclick={abort}>Abbrechen</Button>
    <Button variant="primary" size="lg" class="flex-[1.6]" loading={busy} onclick={confirm_setup}>
      {next === 'live' ? 'Los geht’s' : 'Zur Wertung'}
    </Button>
  {/snippet}
</Screen>
