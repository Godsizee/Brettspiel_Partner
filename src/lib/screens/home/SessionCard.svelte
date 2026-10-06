<script>
  import Dices from '@lucide/svelte/icons/dices';
  import Trophy from '@lucide/svelte/icons/trophy';
  import Card from '$lib/ui/Card.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Sheet from '$lib/ui/Sheet.svelte';
  import { activeSession, showToast } from '$lib/stores/app.js';

  let podiumOpen = $state(false);

  function startSession() {
    activeSession.set({ id: 'session_' + Date.now(), date: new Date().toISOString(), matches: [] });
    showToast('Spielabend-Session gestartet. Viel Erfolg!', 'success');
  }

  function confirmEndSession() {
    const previousSession = $activeSession;
    activeSession.set(null);
    podiumOpen = false;
    showToast('Spielabend beendet.', 'success', 5000, {
      label: 'Rückgängig',
      onClick: () => { activeSession.set(previousSession); podiumOpen = true; },
    });
  }

  /** @param {any[]} matches */
  function standings(matches) {
    /** @type {Record<string, {name: string, wins: number, totalPoints: number, matchesPlayed: number}>} */
    const stats = {};
    for (const m of matches) {
      const scores = m.player_scores ?? [];
      const maxScore = Math.max(-Infinity, ...scores.map((/** @type {any} */ ps) => ps.total_score));
      for (const ps of scores) {
        const row = (stats[ps.player_name] ??= { name: ps.player_name, wins: 0, totalPoints: 0, matchesPlayed: 0 });
        row.totalPoints += ps.total_score;
        row.matchesPlayed += 1;
        if (ps.total_score === maxScore) row.wins += 1;
      }
    }
    return Object.values(stats).sort((a, b) => (b.wins !== a.wins ? b.wins - a.wins : b.totalPoints - a.totalPoints));
  }

  let sessionStandings = $derived($activeSession?.matches?.length ? standings($activeSession.matches) : []);
</script>

{#if !$activeSession}
  <Card padded class="flex items-center gap-3">
    <span class="grid size-10 shrink-0 place-items-center rounded-md bg-surface-2 text-fg-2"><Dices class="size-5" aria-hidden="true" /></span>
    <div class="min-w-0 flex-1">
      <p class="font-display text-h2 font-semibold">Spielabend-Modus aktiv</p>
      <p class="text-sm text-fg-2">Bündele mehrere Partien zu einer Session mit Gesamtsieger.</p>
    </div>
    <Button variant="primary" class="shrink-0" onclick={startSession}>Starten</Button>
  </Card>
{:else}
  <Card padded class="flex items-center gap-3">
    <span class="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-soft-fg"><Trophy class="size-5" aria-hidden="true" /></span>
    <div class="min-w-0 flex-1">
      <p class="font-display text-h2 font-semibold">Spielabend läuft</p>
      <p class="text-sm text-fg-2">Bisher gespielt: {$activeSession.matches.length} Runden</p>
    </div>
    <div class="flex shrink-0 gap-2">
      {#if $activeSession.matches.length > 0}
        <Button variant="secondary" onclick={() => (podiumOpen = true)}>Gesamtwertung</Button>
      {/if}
      <Button variant="danger-ghost" onclick={confirmEndSession}>Beenden</Button>
    </div>
  </Card>
{/if}

<Sheet bind:open={podiumOpen} title="Gesamtwertung" description="{$activeSession?.matches?.length ?? 0} Runden gespielt">
  <ol class="flex flex-col">
    {#each sessionStandings as player, i (player.name)}
      <li class="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
        <span class={['grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold', i === 0 ? 'bg-gold-soft text-gold' : 'bg-surface-2 text-fg-2']}>{i + 1}</span>
        <span class="min-w-0 flex-1 truncate font-medium">{player.name} <span class="text-sm font-normal text-fg-2">({player.matchesPlayed} Rnd.)</span></span>
        <span class="shrink-0 text-sm font-semibold text-fg-2">{player.wins} Siege · {player.totalPoints} SP</span>
      </li>
    {/each}
  </ol>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (podiumOpen = false)}>Schließen</Button>
    <Button variant="danger-ghost" onclick={confirmEndSession}>Spielabend beenden</Button>
  {/snippet}
</Sheet>
