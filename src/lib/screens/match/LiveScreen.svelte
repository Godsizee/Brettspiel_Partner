<script>
  // @ts-check
  import { onMount } from 'svelte';
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import Dices from '@lucide/svelte/icons/dices';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Trophy from '@lucide/svelte/icons/trophy';
  import {
    currentGame, gamesCatalog, timerState, timerText, timerElapsedSeconds, prefilledPlayerNames, playerColors,
    openWiki, confirmDialog,
  } from '$lib/stores/app.js';
  import {
    startOrResumeMatchTimer, pauseMatchTimer, finishMatchTimer, abortMatchTimer, runningGameKey,
  } from '$lib/stores/matchTimer.js';
  import { navigate, currentRoute } from '$lib/router/router.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import { toSlug } from '$lib/components/wiki/utils/wikiKeys.js';
  import { safeCssColor } from '$lib/ui/color.js';
  import { ui } from '$lib/shell/ui.svelte.js';
  import Screen from '$lib/ui/Screen.svelte';
  import Button from '$lib/ui/Button.svelte';
  import PlayerDot from '$lib/ui/PlayerDot.svelte';

  let game = $derived($currentGame ? $gamesCatalog[$currentGame] : null);
  let gameName = $derived(game?.name ?? $currentGame ?? 'Partie');
  let accent = $derived(safeCssColor(game?.theme?.primary, 'var(--accent)'));
  let hasWiki = $derived(!!game?.wiki?.categories?.length || (game?.wiki?.enabled && game?.wiki?.manifest));
  let players = $derived($prefilledPlayerNames ?? []);

  let running = $derived($timerState === 'running');
  let paused = $derived($timerState === 'paused');
  // Effektiver Beginn = jetzt minus gespielte Zeit (ignoriert Pausen, reicht für „läuft seit“).
  let sinceText = $derived(
    running
      ? new Date(Date.now() - $timerElapsedSeconds * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : ''
  );

  onMount(() => {
    // Läuft schon eine Partie (z. B. Reload), gilt deren Spiel — nicht das zuletzt angesehene.
    const active = runningGameKey();
    if (active && active !== $currentGame) currentGame.set(active);

    // Auto-Start über #/partie?start=1; Query entfernen, damit ein Reload nicht neu startet.
    if ($currentRoute?.query.start === '1') {
      if ($timerState === 'stopped') startOrResumeMatchTimer();
      navigate(appHash.matchLive(), { replace: true });
    }
  });

  function toggle() {
    if (running) pauseMatchTimer();
    else startOrResumeMatchTimer();
  }

  function toScore() {
    finishMatchTimer();
    navigate(appHash.matchScore(), { replace: true });
  }

  async function abort() {
    if (!(await confirmDialog('Möchtest du das laufende Spiel wirklich abbrechen? Die erfasste Zeit geht verloren.'))) return;
    abortMatchTimer();
    currentGame.set(null);
    prefilledPlayerNames.set(null);
    navigate(appHash.home(), { replace: true });
  }
</script>

<Screen title={gameName} back={$currentGame ? appHash.game(toSlug($currentGame)) : appHash.home()}>
  <div class="-mx-4 h-1 sm:-mx-6" style:background={accent} aria-hidden="true"></div>

  <div class="flex flex-col items-center pt-8 text-center">
    <p class="text-xs font-bold uppercase tracking-[0.08em] text-fg-2">Spielzeit</p>
    <p class="tabular mt-2.5 text-timer font-semibold tracking-tight" role="timer" aria-label="Spielzeit {$timerText}">{$timerText}</p>
    <p class="mt-2 flex items-center gap-2 text-sm text-fg-2" aria-live="polite">
      {#if running}
        <span class="size-2 rounded-full bg-success" aria-hidden="true"></span>läuft seit {sinceText}
      {:else if paused}
        Pausiert
      {:else}
        Bereit
      {/if}
    </p>

    {#if players.length > 0}
      <ul class="mt-5 flex flex-wrap justify-center gap-2" aria-label="Mitspieler">
        {#each players as name, i}
          <li class="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface pl-1.5 pr-3 text-sm font-semibold">
            <PlayerDot size="md" {name} color={$playerColors?.[i]} />{name}
          </li>
        {/each}
      </ul>
    {/if}

    <button type="button" onclick={toggle}
      class="mt-7 grid size-21 place-items-center rounded-full border border-line-strong bg-surface text-fg shadow-1 hover:bg-surface-2"
      aria-label={running ? 'Pausieren' : paused ? 'Fortsetzen' : 'Starten'}>
      {#if running}<Pause class="size-9" fill="currentColor" aria-hidden="true" />{:else}<Play class="size-9" fill="currentColor" aria-hidden="true" />{/if}
    </button>
    <p class="mt-2 text-[0.8rem] text-fg-2" aria-hidden="true">{running ? 'Pausieren' : paused ? 'Fortsetzen' : 'Starten'}</p>
  </div>

  <div class="mt-8 flex flex-wrap justify-center gap-2.5">
    <Button variant="secondary" onclick={() => (ui.startPlayerOpen = true)}><Dices class="size-5" aria-hidden="true" />Startspieler</Button>
    {#if hasWiki}
      <Button variant="secondary" onclick={() => openWiki($currentGame)}><BookOpen class="size-5" aria-hidden="true" />Wiki</Button>
    {/if}
  </div>

  {#snippet dock()}
    <div class="flex w-full flex-col gap-1.5">
      <Button variant="primary" size="lg" block onclick={toScore}><Trophy class="size-5" aria-hidden="true" />Wertung eintragen</Button>
      <Button variant="danger-ghost" block onclick={abort}>Partie abbrechen</Button>
    </div>
  {/snippet}
</Screen>
