<script>
  // @ts-check
  import { get } from 'svelte/store';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import X from '@lucide/svelte/icons/x';
  import ImagePlus from '@lucide/svelte/icons/image-plus';
  import Plus from '@lucide/svelte/icons/plus';
  import { showToast, pocketbaseHost, authService, confirmDialog } from '$lib/stores/app.js';
  import { navigate } from '$lib/router/router.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import { storeCustomGame } from '$lib/services/DbService.js';
  import { loadGamesCatalog } from '$lib/services/GamesCatalogService.js';
  import { submitPendingGame } from '$lib/services/AdminService.js';
  import Screen from '$lib/ui/Screen.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Field from '$lib/ui/Field.svelte';
  import Stepper from '$lib/ui/Stepper.svelte';
  import Button from '$lib/ui/Button.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import GameCard from '$lib/screens/home/GameCard.svelte';

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
    categories: [],
  });

  let catInput = $state('');

  // ── Derived ────────────────────────────────────────────────────────────────
  let isDirty = $derived(form.name.trim().length > 0 || form.categories.length > 0);
  let playersLabel = $derived(
    form.minPlayers === form.maxPlayers ? `${form.minPlayers} Spieler` : `${form.minPlayers}–${form.maxPlayers} Spieler`
  );
  let nameError = $state('');
  let previewGame = $derived({ key: 'preview', name: form.name || 'Spielname', cover: coverPreviewUrl, players: playersLabel, badge: 'Vorschau' });

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
    form.categories = form.categories.filter((c) => c.id !== id);
  }

  /** Umsortieren per Pfeil-Tasten (Drag & Drop funktioniert am Handy nicht).
   *  @param {number} idx @param {number} dir */
  function move(idx, dir) {
    const to = idx + dir;
    if (to < 0 || to >= form.categories.length) return;
    const cats = [...form.categories];
    const [moved] = cats.splice(idx, 1);
    cats.splice(to, 0, moved);
    form.categories = cats;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  async function cancel() {
    if (isDirty && !(await confirmDialog('Änderungen verwerfen?'))) return;
    navigate(appHash.home());
  }

  function goNext() {
    if (!form.name.trim()) { nameError = 'Spielname erforderlich'; showToast('Spielname erforderlich', 'warning'); return; }
    step = 2;
    window.scrollTo(0, 0);
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
          coverFile: coverFile ?? null,
        });
        const coverUrl = record.cover ? `${host}/api/files/pending_games/${record.id}/${record.cover}` : '';
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
          cover: coverUrl,
        });
        showToast(`„${form.name.trim()}“ eingereicht, wird geprüft`, 'success');
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
          status: 'local',
        });
        showToast(`„${form.name.trim()}“ lokal gespeichert`, 'success');
      }
      await loadGamesCatalog();
      navigate(appHash.home(), { replace: true });
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : 'Fehler beim Speichern.', 'error');
    } finally {
      isSaving = false;
    }
  }

  const EMOJI_PRESETS = ['🎲', '🃏', '🧩', '🏰', '🌲', '🪐', '🦖', '⛵', '🗡️', '🧙', '🐉', '🏹'];
  // Akzentfarben für Spiele (Nutzerdaten, werden als Hex gespeichert)
  const COLOR_PRESETS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#0ea5e9', '#d946ef', '#e11d48', '#7c3aed'];
</script>

<Screen title="Eigenes Spiel" subtitle="Schritt {step} von 2">
  {#snippet actions()}<Button variant="ghost" onclick={cancel}>Abbrechen</Button>{/snippet}

  <div class="flex flex-col gap-5">
    <div class="mx-auto w-44" inert aria-hidden="true"><GameCard game={previewGame} /></div>

    {#if step === 1}
      <div class="flex flex-col gap-4">
        <Field label="Spielname" bind:value={form.name} placeholder="z. B. Mein Kartenspiel" maxlength="60" error={nameError}
          hint="{form.name.length}/60" oninput={() => (nameError = '')} required />

        <div class="flex flex-col gap-1.5">
          <label for="cg-desc" class="text-sm font-semibold">Beschreibung</label>
          <textarea id="cg-desc" bind:value={form.description} rows="2" maxlength="160" placeholder="Kurze Erklärung oder Zusatzregeln"
            class="w-full rounded-md border border-field-line bg-surface-2 px-3 py-2.5 placeholder:text-fg-2 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/30"></textarea>
          <p class="text-sm text-fg-2">{form.description.length}/160</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5"><span class="text-sm font-semibold">Min. Spieler</span><Stepper label="Mindestspielerzahl" min={1} max={12} bind:value={form.minPlayers} /></div>
          <div class="flex flex-col gap-1.5"><span class="text-sm font-semibold">Max. Spieler</span><Stepper label="Höchstspielerzahl" min={1} max={12} bind:value={form.maxPlayers} /></div>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-semibold" id="cg-emoji-l">Emoji</span>
          <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="cg-emoji-l">
            {#each EMOJI_PRESETS as em}
              <button type="button" role="radio" aria-checked={form.emoji === em} aria-label="Emoji {em}"
                class={['grid size-11 place-items-center rounded-md border text-xl', form.emoji === em ? 'border-fg bg-surface-2' : 'border-line bg-surface']}
                onclick={() => (form.emoji = em)}>{em}</button>
            {/each}
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-semibold" id="cg-color-l">Akzentfarbe</span>
          <div class="flex flex-wrap items-center gap-2" role="radiogroup" aria-labelledby="cg-color-l">
            {#each COLOR_PRESETS as color}
              <button type="button" role="radio" aria-checked={form.accentColor === color} aria-label="Farbe {color}"
                class={['size-11 rounded-full border-2', form.accentColor === color ? 'border-fg' : 'border-transparent']}
                style:background={color} onclick={() => (form.accentColor = color)}></button>
            {/each}
            <input type="color" bind:value={form.accentColor} aria-label="Eigene Farbe wählen"
              class="size-11 cursor-pointer rounded-full border border-field-line bg-surface-2 p-1" />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">Cover-Bild (optional)</span>
          <label class="relative flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-dashed border-line-strong bg-surface-2 p-3 text-center text-fg-2 focus-within:border-accent">
            {#if coverPreviewUrl}
              <img src={coverPreviewUrl} alt="Cover-Vorschau" class="max-h-40 rounded-md object-contain" />
              <span class="text-sm font-semibold text-accent">Ändern</span>
            {:else}
              <ImagePlus class="size-7" aria-hidden="true" />
              <span class="font-medium text-fg">Bild hochladen</span>
              <span class="text-sm">JPG, PNG, WebP · max. 5 MB</span>
            {/if}
            <input type="file" accept="image/jpeg,image/png,image/webp" onchange={handleCoverFile} class="absolute inset-0 cursor-pointer opacity-0" aria-label="Cover-Bild auswählen" />
          </label>
        </div>
      </div>
    {:else}
      <div class="flex flex-col gap-3">
        <h2 class="font-display text-h2 font-semibold">Wertungskategorien</h2>
        <p class="text-fg-2">Jede Kategorie ist ein Feld im Wertungsbogen. Die Punkte aller Kategorien werden addiert.</p>
        <form class="flex items-end gap-2" onsubmit={(e) => { e.preventDefault(); addCategory(); }}>
          <div class="min-w-0 flex-1"><Field label="Neue Kategorie ({form.categories.length}/20)" bind:value={catInput} placeholder="z. B. Siegpunkte, Rohstoffe …" maxlength="40" /></div>
          <Button type="submit" variant="secondary" class="shrink-0"><Plus class="size-5" aria-hidden="true" />Hinzufügen</Button>
        </form>

        {#if form.categories.length > 0}
          <Card>
            <ol>
              {#each form.categories as cat, idx (cat.id)}
                <li class="flex min-h-14 items-center gap-1 border-t border-line pl-4 pr-1 first:border-t-0">
                  <span class="min-w-0 flex-1 truncate font-medium">{cat.label}</span>
                  <IconButton label="{cat.label} nach oben" disabled={idx === 0} onclick={() => move(idx, -1)}><ArrowUp class="size-5" aria-hidden="true" /></IconButton>
                  <IconButton label="{cat.label} nach unten" disabled={idx === form.categories.length - 1} onclick={() => move(idx, 1)}><ArrowDown class="size-5" aria-hidden="true" /></IconButton>
                  <IconButton label="{cat.label} entfernen" onclick={() => removeCategory(cat.id)}><X class="size-5" aria-hidden="true" /></IconButton>
                </li>
              {/each}
            </ol>
          </Card>
        {:else}
          <p class="rounded-md border border-dashed border-line-strong p-4 text-center text-fg-2">Noch keine Kategorien. Mindestens eine ist nötig.</p>
        {/if}
      </div>
    {/if}
  </div>

  {#snippet dock()}
    {#if step === 1}
      <Button variant="primary" size="lg" block onclick={goNext}>Weiter: Wertungskategorien</Button>
    {:else}
      <Button variant="secondary" size="lg" class="flex-1" disabled={isSaving} onclick={() => (step = 1)}>Zurück</Button>
      <Button variant="primary" size="lg" class="flex-[1.6]" loading={isSaving} disabled={form.categories.length === 0} onclick={save}>Spiel einreichen</Button>
    {/if}
  {/snippet}
</Screen>
