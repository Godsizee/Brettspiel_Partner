<script>
  // @ts-check
  import { onMount, tick } from 'svelte';
  import NotebookPen from '@lucide/svelte/icons/notebook-pen';
  import Trophy from '@lucide/svelte/icons/trophy';
  import UserRound from '@lucide/svelte/icons/user-round';
  import { HapticService } from '$lib/services/HapticService.js';
  import { storeProfile } from '$lib/services/DbService.js';
  import { DEFAULT_PLAYER_COLORS, loadPlayerProfiles } from '$lib/stores/app.js';
  import Field from '$lib/ui/Field.svelte';
  import Button from '$lib/ui/Button.svelte';

  /** @type {{ onComplete?: (opts?: { wantsAuth: boolean }) => void }} */
  const { onComplete = () => {} } = $props();

  // 0–2 = slides, 3 = setup step
  let step = $state(0);
  const SLIDE_COUNT = 3;
  const STEP_COUNT = SLIDE_COUNT + 1;

  // Setup step state
  let playerName = $state('');
  let selectedColor = $state(DEFAULT_PLAYER_COLORS[0]);
  let saving = $state(false);
  let nameError = $state('');

  /** @type {HTMLDialogElement | undefined} */
  let dialog = $state();
  onMount(() => { dialog?.showModal(); });

  const BASE = import.meta.env.BASE_URL;
  const COVERS = ['on_mars_cover.webp', 'arche_nova_cover.webp', 'scythe_cover.webp', 'revive_cover.webp'];
  const COLLAGE_TILT = ['-rotate-6', 'rotate-3', '-rotate-2', 'rotate-6'];

  const SLIDES = [
    { title: 'Schluss mit Zettelchaos', text: 'Nie wieder Stift und Kopfrechnen. Punkte eingeben, der Rest passiert automatisch.' },
    { title: 'Bögen für jedes Spiel', text: 'Maßgeschneidert für über 20 Spiele — komplexe Boni und Set-Wertungen inklusive.', icon: NotebookPen },
    { title: 'Wer ist Champion?', text: 'Verfolge Highscores, Siegquoten und Rivalitäten — über alle Abende hinweg.', icon: Trophy },
  ];

  function nextSlide() {
    HapticService.lightTap();
    step = Math.min(step + 1, SLIDE_COUNT);
    if (step === SLIDE_COUNT) tick().then(() => dialog?.querySelector('input')?.focus());
  }

  function skipToSetup() {
    HapticService.lightTap();
    step = SLIDE_COUNT;
    tick().then(() => dialog?.querySelector('input')?.focus());
  }

  /** @param {boolean} wantsAuth */
  async function finish(wantsAuth) {
    HapticService.lightTap();
    const name = playerName.trim();
    if (name.length < 2) {
      nameError = 'Mindestens 2 Zeichen.';
      return;
    }
    saving = true;
    try {
      await storeProfile({ name, color: selectedColor, avatar: '🎲' });
      await loadPlayerProfiles();
    } catch (_) {}
    saving = false;
    localStorage.setItem('bg_onboarding_completed', 'true');
    onComplete({ wantsAuth });
  }

  function skipSetup() {
    HapticService.lightTap();
    localStorage.setItem('bg_onboarding_completed', 'true');
    onComplete({ wantsAuth: false });
  }
</script>

<!-- Esc schließt nicht: das Onboarding wird bewusst abgeschlossen oder übersprungen -->
<dialog bind:this={dialog} class="onb" aria-labelledby="onb-title" oncancel={(e) => e.preventDefault()}>
  <div class="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
    <div class="flex h-11 items-center justify-between">
      <ol class="flex items-center gap-2" aria-label="Fortschritt">
        {#each Array(STEP_COUNT) as _, i}
          <li class={['h-2 rounded-full transition-all duration-200', i === step ? 'w-6 bg-accent' : 'w-2 bg-line-strong']}
            aria-current={i === step ? 'step' : undefined}><span class="sr-only">Schritt {i + 1} von {STEP_COUNT}</span></li>
        {/each}
      </ol>
      {#if step < SLIDE_COUNT - 1}
        <button type="button" class="min-h-11 px-2 text-sm font-semibold text-fg-2" onclick={skipToSetup}>Überspringen</button>
      {/if}
    </div>

    {#if step < SLIDE_COUNT}
      {@const slide = SLIDES[step]}
      <div class="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        {#if step === 0}
          <div class="relative h-48 w-full" aria-hidden="true">
            {#each COVERS as cover, i}
              <img src="{BASE}{cover}" alt="" width="120" height="160" decoding="async"
                class={['absolute top-1/2 aspect-[3/4] w-28 -translate-y-1/2 rounded-md object-cover shadow-2', COLLAGE_TILT[i]]}
                style:left="{4 + i * 24}%" style:z-index={i} />
            {/each}
          </div>
        {:else}
          {@const Icon = slide.icon}
          <span class="grid size-32 place-items-center rounded-full bg-accent-soft text-accent-soft-fg" aria-hidden="true">
            {#if Icon}<Icon class="size-14" />{/if}
          </span>
        {/if}
        <div class="flex flex-col gap-3">
          <h1 id="onb-title" class="font-display text-h1 font-semibold">{slide.title}</h1>
          <p class="text-fg-2">{slide.text}</p>
        </div>
      </div>
      <Button variant="primary" size="lg" block onclick={nextSlide}>{step === SLIDE_COUNT - 1 ? 'Los geht’s' : 'Weiter'}</Button>

    {:else}
      <form class="flex flex-1 flex-col justify-center gap-6" onsubmit={(e) => { e.preventDefault(); finish(false); }}>
        <div class="flex flex-col items-center gap-4 text-center">
          <span class="grid size-24 place-items-center rounded-full bg-accent-soft text-accent-soft-fg" aria-hidden="true"><UserRound class="size-11" /></span>
          <h1 id="onb-title" class="font-display text-h1 font-semibold">Wie heißt du?</h1>
          <p class="text-fg-2">Leg dein Spielerprofil an — für Statistiken und Bestenlisten.</p>
        </div>

        <Field label="Dein Name" placeholder="Dein Name" maxlength="24" autocomplete="nickname" bind:value={playerName}
          error={nameError} oninput={() => (nameError = '')} />

        <div role="radiogroup" aria-label="Spielerfarbe" class="flex justify-center gap-3">
          {#each DEFAULT_PLAYER_COLORS.slice(0, 6) as color, i}
            {@const on = selectedColor === color}
            <button type="button" role="radio" aria-checked={on} aria-label="Farbe {i + 1}"
              class={['size-11 rounded-full border-2 transition-transform', on ? 'scale-110 border-fg' : 'border-transparent']}
              style:background={color} onclick={() => { HapticService.lightTap(); selectedColor = color; }}></button>
          {/each}
        </div>

        <div class="flex flex-col gap-2">
          <Button type="submit" variant="primary" size="lg" block loading={saving}>Profil speichern</Button>
          <Button variant="secondary" size="lg" block disabled={saving} onclick={() => finish(true)}>Konto erstellen</Button>
          <Button variant="ghost" block onclick={skipSetup}>Ohne Profil fortfahren</Button>
        </div>
      </form>
    {/if}
  </div>
</dialog>

<style>
  .onb { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0;
    border: 0; background: var(--bg); color: var(--text); overflow-y: auto; }
  .onb::backdrop { background: var(--bg); }
</style>
