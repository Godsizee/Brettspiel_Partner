<script>
  // @ts-check
  import { onMount, untrack } from 'svelte';
  import ChartColumn from '@lucide/svelte/icons/chart-column';
  import Flame from '@lucide/svelte/icons/flame';
  import Swords from '@lucide/svelte/icons/swords';
  import Trophy from '@lucide/svelte/icons/trophy';
  import { gamesCatalog, currentUser, DEFAULT_PLAYER_COLORS } from '$lib/stores/app.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import {
    listPlayers, computeOverview, computeWinRateSegments, computeStreaks, computeAvgDurationsByGame,
    computePlayerTrend, computeHeadToHead, getHeadToHeadMatches, listHeadToHeadGames, computeRadarAverages,
    computeTimeline, getWinner,
  } from '$lib/services/StatsService.js';
  import { safeCssColor, onColor } from '$lib/ui/color.js';
  import SyncChip from '$lib/shell/SyncChip.svelte';
  import Screen from '$lib/ui/Screen.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Segmented from '$lib/ui/Segmented.svelte';
  import SelectField from '$lib/ui/SelectField.svelte';
  import EmptyState from '$lib/ui/EmptyState.svelte';
  import Skeleton from '$lib/ui/Skeleton.svelte';
  import ChronikTabs from '$lib/screens/history/ChronikTabs.svelte';
  import { loadAllMatches } from '$lib/screens/history/loadMatches.js';
  import BarList from './BarList.svelte';
  import TrendChart from './TrendChart.svelte';

  /** @type {any[]} */
  let matches = $state([]);
  let loading = $state(true);
  let tab = $state('overview'); // 'overview' | 'duel' | 'timeline'

  let trendPlayer = $state('');
  let playerA = $state('');
  let playerB = $state('');
  let duelGame = $state('');

  let allPlayers = $derived(listPlayers(matches));
  // Feste Farbe je Spieler (alphabetische Reihenfolge) — in allen Diagrammen dieselbe
  const colorOf = (/** @type {string} */ name) => DEFAULT_PLAYER_COLORS[Math.max(0, allPlayers.indexOf(name)) % DEFAULT_PLAYER_COLORS.length];

  // Default-Auswahlen setzen, sobald Spieler vorhanden sind
  $effect(() => {
    if (allPlayers.length > 0) {
      if (!trendPlayer || !allPlayers.includes(trendPlayer)) trendPlayer = allPlayers[0];
      if (!playerA || !allPlayers.includes(playerA)) playerA = allPlayers[0];
      if ((!playerB || !allPlayers.includes(playerB)) && allPlayers.length > 1)
        playerB = allPlayers.find((p) => p !== playerA) ?? allPlayers[1];
    }
  });

  async function load() {
    loading = true;
    matches = (await loadAllMatches()).matches;
    loading = false;
  }
  $effect(() => { $currentUser; untrack(load); });
  onMount(() => {
    window.addEventListener('bg-refresh-data', load);
    return () => window.removeEventListener('bg-refresh-data', load);
  });

  // ─── Katalog-Helfer ──────────────────────────────────────────────────────────
  /** @param {string} gameName */
  const gameByName = (gameName) => Object.values($gamesCatalog).find((g) => g.name === gameName);
  /** @param {any} match */
  function formatDuration(match) {
    const secs = match.duration ?? 0;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }
  /** @param {string} iso */
  function shortDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }

  // ─── Übersicht ───────────────────────────────────────────────────────────────
  let overview = $derived(computeOverview(matches));
  let winRates = $derived(computeWinRateSegments(matches));
  let streaks = $derived(computeStreaks(matches));
  let durations = $derived(computeAvgDurationsByGame(matches));
  let trend = $derived(computePlayerTrend(matches, trendPlayer).map((d) => ({ score: d.score, game: d.game, date: shortDate(d.dateISO) })));

  // ─── Duell ───────────────────────────────────────────────────────────────────
  let duelMatches = $derived(getHeadToHeadMatches(matches, playerA, playerB));
  let duel = $derived(computeHeadToHead(matches, playerA, playerB));
  let duelGames = $derived(listHeadToHeadGames(matches, playerA, playerB));
  $effect(() => { if (duelGame && !duelGames.includes(duelGame)) duelGame = ''; });
  let categoryAverages = $derived(
    duelGame
      ? computeRadarAverages(matches, playerA, playerB, duelGame,
          (gameByName(duelGame)?.categories ?? []).filter((/** @type {any} */ c) => c.type !== 'info'))
      : null
  );

  // ─── Verlauf ─────────────────────────────────────────────────────────────────
  let timeline = $derived(computeTimeline(matches));

  const TABS = [{ value: 'overview', label: 'Übersicht' }, { value: 'duel', label: 'Duell' }, { value: 'timeline', label: 'Verlauf' }];
  let playerOptions = $derived(allPlayers.map((p) => ({ value: p, label: p })));
</script>

<Screen title="Chronik">
  {#snippet actions()}<SyncChip class="lg:hidden" />{/snippet}

  <div class="flex flex-col gap-3">
    <ChronikTabs active="stats" />
    {#if !loading && matches.length > 0}
      <Segmented label="Ansicht der Statistik" options={TABS} bind:value={tab} />
    {/if}
  </div>

  <div class="mt-4 flex flex-col gap-3">
    {#if loading && matches.length === 0}
      <div class="grid grid-cols-2 gap-2.5"><Skeleton class="h-20" /><Skeleton class="h-20" /></div>
      <Skeleton class="h-40" /><Skeleton class="h-40" />
    {:else if matches.length === 0}
      <EmptyState title="Noch keine Daten" icon={ChartColumn}
        text="Spiele eine Runde und speichere sie, um Auswertungen, Duelle und den Verlauf freizuschalten.">
        {#snippet action()}<Button variant="primary" href={appHash.home()}>Spiel wählen</Button>{/snippet}
      </EmptyState>

    {:else if tab === 'overview'}
      <div class="grid grid-cols-2 gap-2.5">
        <Card class="p-3">
          <div class="tabular text-[22px] font-bold leading-tight">{overview.totalMatches}</div>
          <div class="mt-0.5 text-[0.8rem] text-fg-2">Partien</div>
        </Card>
        <Card class="p-3">
          <div class="tabular text-[22px] font-bold leading-tight">{overview.avgDurationMin} Min.</div>
          <div class="mt-0.5 text-[0.8rem] text-fg-2">Ø Spieldauer</div>
        </Card>
        <Card class="col-span-2 p-3">
          {#if overview.highscore}
            <div class="tabular text-[22px] font-bold leading-tight">{overview.highscore.score} Pkt.</div>
            <div class="mt-0.5 text-[0.8rem] text-fg-2">Highscore: {overview.highscore.playerName} in {overview.highscore.gameName}</div>
          {:else}
            <div class="text-[22px] font-bold leading-tight">–</div>
            <div class="mt-0.5 text-[0.8rem] text-fg-2">Highscore</div>
          {/if}
        </Card>
      </div>

      <Card padded>
        <h2 class="mb-3 font-display text-h2 font-semibold">Siegquote</h2>
        <BarList rows={winRates.map((s) => ({ label: s.name, value: s.count, text: `${s.count} (${Math.round(s.percent)} %)`, color: colorOf(s.name) }))} />
      </Card>

      <Card padded>
        <h2 class="mb-3 font-display text-h2 font-semibold">Aktuelle Siegesserien</h2>
        <ol class="flex flex-col">
          {#each streaks as s, i}
            <li class="flex min-h-11 items-center gap-3 border-t border-line first:border-t-0">
              <span class="tabular grid size-7 place-items-center rounded-full bg-surface-2 text-sm font-bold text-fg-2">{i + 1}</span>
              <span class="min-w-0 flex-1 truncate font-medium">{s.name}</span>
              {#if s.streak > 0}
                <span class="inline-flex items-center gap-1 text-sm font-semibold text-gold"><Flame class="size-4" aria-hidden="true" />{s.streak} in Folge</span>
              {:else}
                <span class="tabular text-sm text-fg-2">0</span>
              {/if}
            </li>
          {/each}
        </ol>
      </Card>

      <Card padded>
        <h2 class="mb-3 font-display text-h2 font-semibold">Ø Dauer je Spiel</h2>
        {#if durations.length === 0}
          <p class="text-fg-2">Keine Dauer-Daten vorhanden.</p>
        {:else}
          <BarList labelWidth="7rem" rows={durations.map((d) => ({ label: d.name, value: d.avgMin, text: `${d.avgMin} Min.`, color: safeCssColor(gameByName(d.name)?.theme?.primary, 'var(--accent)') }))} />
        {/if}
      </Card>

      <Card padded>
        <div class="mb-3 flex items-end justify-between gap-3">
          <h2 class="font-display text-h2 font-semibold">Punkte-Trend</h2>
          <div class="w-40"><SelectField label="Spieler für den Trend" hideLabel bind:value={trendPlayer} options={playerOptions} /></div>
        </div>
        {#if trend.length < 2}
          <p class="py-6 text-center text-fg-2">Spiele mindestens 2 Runden mit {trendPlayer}, um einen Trend zu sehen.</p>
        {:else}
          <TrendChart points={trend} player={trendPlayer} color={colorOf(trendPlayer)} />
        {/if}
      </Card>

    {:else if tab === 'duel'}
      {#if allPlayers.length < 2}
        <EmptyState title="Für ein Duell fehlen Spieler" icon={Swords} text="Sobald in deinen Partien mindestens zwei verschiedene Namen vorkommen, kannst du sie hier vergleichen." />
      {:else}
        <div class="grid grid-cols-2 gap-3">
          <SelectField label="Spieler A" bind:value={playerA} options={allPlayers.map((p) => ({ value: p, label: p, disabled: p === playerB }))} />
          <SelectField label="Spieler B" bind:value={playerB} options={allPlayers.map((p) => ({ value: p, label: p, disabled: p === playerA }))} />
        </div>

        {#if duelMatches.length === 0}
          <EmptyState title="Noch kein Duell" icon={Swords} text="Zwischen {playerA} und {playerB} wurde bisher keine gemeinsame Partie aufgezeichnet." />
        {:else}
          <Card padded class="flex flex-col gap-3">
            <div class="flex items-baseline justify-between">
              <h2 class="font-display text-h2 font-semibold">Bilanz</h2>
              <span class="text-sm text-fg-2">{duel.count} gemeinsame {duel.count === 1 ? 'Partie' : 'Partien'}</span>
            </div>
            <div class="flex h-9 overflow-hidden rounded-md text-sm font-semibold" role="img" aria-label="{playerA} {duel.aWins} Siege, {playerB} {duel.bWins} Siege">
              <span class="grid place-items-center text-center" style:width="{duel.count ? (duel.aWins / duel.count) * 100 : 50}%" style:background={colorOf(playerA)} style:color={onColor(colorOf(playerA))}>{duel.aWins > 0 ? duel.aWins : ''}</span>
              <span class="grid place-items-center text-center" style:width="{duel.count ? (duel.bWins / duel.count) * 100 : 50}%" style:background={colorOf(playerB)} style:color={onColor(colorOf(playerB))}>{duel.bWins > 0 ? duel.bWins : ''}</span>
            </div>
            <table class="w-full border-collapse text-sm">
              <thead><tr class="text-left text-fg-2">
                <th scope="col" class="py-1.5 font-semibold">{playerA}</th>
                <th scope="col" class="py-1.5 text-center font-normal"><span class="sr-only">Kennzahl</span></th>
                <th scope="col" class="py-1.5 text-right font-semibold">{playerB}</th>
              </tr></thead>
              <tbody>
                {#each [
                  { l: 'Siege', a: duel.aWins, b: duel.bWins, u: '' },
                  { l: 'Ø Punkte', a: duel.aAvg, b: duel.bAvg, u: ' Pkt.' },
                  { l: 'Höchste Punktzahl', a: duel.aMax, b: duel.bMax, u: ' Pkt.' },
                ] as r}
                  <tr class="border-t border-line">
                    <td class={['tabular py-2', r.a > r.b && 'font-bold']}>{r.a}{r.u}</td>
                    <td class="py-2 text-center text-fg-2">{r.l}</td>
                    <td class={['tabular py-2 text-right', r.b > r.a && 'font-bold']}>{r.b}{r.u}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
            <p class="border-t border-line pt-2 text-sm text-fg-2">Lieblingsspiel im Duell: <strong class="text-fg">{duel.favGame}</strong></p>
          </Card>

          <Card padded>
            <div class="mb-3 flex items-end justify-between gap-3">
              <h2 class="font-display text-h2 font-semibold">Kategorien im Vergleich</h2>
              <div class="w-44">
                <SelectField label="Spiel wählen" hideLabel bind:value={duelGame}
                  options={[{ value: '', label: 'Spiel wählen …', disabled: true }, ...duelGames.map((g) => ({ value: g, label: g }))]} />
              </div>
            </div>
            {#if !duelGame}
              <p class="py-4 text-center text-fg-2">Wähle ein Spiel, um die durchschnittlichen Kategorie-Werte beider Spieler zu vergleichen.</p>
            {:else if !categoryAverages}
              <p class="py-4 text-center text-fg-2">Keine Kategorie-Details für dieses Spiel vorhanden.</p>
            {:else}
              <div class="flex flex-col gap-4">
                {#each categoryAverages as c (c.id)}
                  <div>
                    <p class="mb-1.5 text-sm font-medium">{c.label}</p>
                    <BarList labelWidth="5rem" max={Math.max(c.aAvg, c.bAvg, 1)} rows={[
                      { label: playerA, value: c.aAvg, text: String(c.aAvg), color: colorOf(playerA), bold: c.aAvg > c.bAvg },
                      { label: playerB, value: c.bAvg, text: String(c.bAvg), color: colorOf(playerB), bold: c.bAvg > c.aAvg },
                    ]} />
                  </div>
                {/each}
              </div>
            {/if}
          </Card>
        {/if}
      {/if}

    {:else}
      {#each timeline as group (group.key)}
        <section class="flex flex-col gap-2" aria-label={group.label}>
          <Card padded>
            <h2 class="font-display text-h2 font-semibold">{group.label}</h2>
            <dl class="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div><dt class="text-[0.8rem] text-fg-2">Partien</dt><dd class="font-semibold">{group.count}</dd></div>
              <div><dt class="text-[0.8rem] text-fg-2">Favorit</dt><dd class="truncate font-semibold">{group.favGame}</dd></div>
              <div><dt class="text-[0.8rem] text-fg-2">Monats-MVP</dt><dd class="truncate font-semibold">{group.mvp}</dd></div>
            </dl>
          </Card>
          <ol class="flex flex-col gap-2">
            {#each group.matches as match (match.local_id || match.id)}
              {@const winner = getWinner(match)}
              <li class="rounded-md border border-line bg-surface px-3 py-2.5" style:border-left="4px solid {safeCssColor(gameByName(match.game_name)?.theme?.primary, 'var(--accent)')}">
                <div class="flex items-baseline justify-between gap-2">
                  <strong class="truncate font-display font-semibold">{match.game_name}</strong>
                  <span class="tabular shrink-0 text-[0.8rem] text-fg-2">{shortDate(match.date)} · {formatDuration(match)}</span>
                </div>
                {#if winner}
                  <p class="mt-0.5 flex items-center gap-1.5 text-sm"><Trophy class="size-4 text-gold" aria-hidden="true" />{winner.player_name} <span class="tabular text-fg-2">({winner.total_score} Pkt.)</span></p>
                {/if}
              </li>
            {/each}
          </ol>
        </section>
      {/each}
    {/if}
  </div>
</Screen>
