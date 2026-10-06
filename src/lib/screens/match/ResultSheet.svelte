<script>
  // @ts-check
  import Crown from '@lucide/svelte/icons/crown';
  import Share2 from '@lucide/svelte/icons/share-2';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Handshake from '@lucide/svelte/icons/handshake';
  import Sheet from '$lib/ui/Sheet.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import PlayerDot from '$lib/ui/PlayerDot.svelte';

  /**
   * @type {{ open?: boolean, gameName: string, rows: Array<{ player_name: string, total_score: number, color?: string|null }>,
   *   message?: string, tone?: 'success'|'accent'|'warning', sharing?: boolean, sessionMode?: boolean,
   *   onshare: () => void, onrematch: () => void, onfinish: () => void }}
   */
  let { open = $bindable(false), gameName, rows, message = '', tone = 'success', sharing = false, sessionMode = false, onshare, onrematch, onfinish } = $props();

  let isDraw = $derived(rows.length > 1 && rows[0]?.total_score === rows[1]?.total_score);
  let topNames = $derived(rows.filter((r) => r.total_score === rows[0]?.total_score).map((r) => r.player_name));
  // Podium-Reihenfolge 2-1-3; bei Gleichstand nur die gemeinsame Spitze.
  let podium = $derived(
    isDraw
      ? [{ place: 1, name: topNames.join(' & '), score: rows[0].total_score, color: null, h: 96 }]
      : [
          rows[1] && { place: 2, name: rows[1].player_name, score: rows[1].total_score, color: rows[1].color, h: 64 },
          rows[0] && { place: 1, name: rows[0].player_name, score: rows[0].total_score, color: rows[0].color, h: 96 },
          rows[2] && { place: 3, name: rows[2].player_name, score: rows[2].total_score, color: rows[2].color, h: 48 },
        ].filter(Boolean)
  );
</script>

<Sheet bind:open title="Ergebnis" description={gameName} size="full" onclose={onfinish}>
  <div class="flex flex-col gap-5">
    <div class="flex items-end justify-center gap-3 pt-6" role="img"
      aria-label={isDraw ? `Unentschieden: ${topNames.join(' und ')}` : `Sieger: ${rows[0]?.player_name}`}>
      {#each /** @type {any[]} */ (podium) as p (p.place)}
        <div class="flex w-28 flex-col items-center gap-1 text-center">
          {#if p.place === 1}
            {#if isDraw}<Handshake class="size-8 text-gold" aria-hidden="true" />{:else}<Crown class="size-8 text-gold" aria-hidden="true" />{/if}
          {/if}
          {#if !isDraw}<PlayerDot size="md" name={p.name} color={p.color} />{/if}
          <span class="w-full truncate text-sm font-semibold">{p.name}</span>
          <span class="tabular font-display text-xl font-semibold">{p.score} SP</span>
          <div class={['grid w-full place-items-start justify-center rounded-t-md pt-2 font-display text-2xl font-semibold',
              p.place === 1 ? 'bg-gold-soft text-gold' : 'bg-surface-2 text-fg-2']} style:height="{p.h}px" aria-hidden="true">{isDraw ? '=' : p.place}</div>
        </div>
      {/each}
    </div>

    {#if isDraw}<p class="text-center text-sm font-semibold text-fg-2">Unentschieden an der Spitze</p>{/if}

    <ol class="overflow-hidden rounded-md border border-line bg-surface">
      {#each rows as r, i}
        {@const tied = r.total_score === rows[0]?.total_score}
        <li class="flex min-h-14 items-center gap-3 border-t border-line px-4 first:border-t-0">
          <span class={['tabular grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold', tied && i === 0 ? 'bg-gold-soft text-gold' : 'bg-surface-2 text-fg-2']}>{tied ? (isDraw ? '=' : 1) : i + 1}</span>
          <PlayerDot size="md" name={r.player_name} color={r.color} />
          <span class="min-w-0 flex-1 truncate font-medium">{r.player_name}</span>
          <span class="tabular font-semibold">{r.total_score} SP</span>
        </li>
      {/each}
    </ol>

    {#if message}<div class="self-center"><Badge {tone}>{message}</Badge></div>{/if}
    {#if sessionMode}<p class="text-center text-sm text-fg-2">Spielabend läuft: den Zwischenstand siehst du auf der Startseite.</p>{/if}
  </div>

  {#snippet footer()}
    <div class="flex w-full flex-col gap-2.5">
      <div class="flex gap-2.5">
        <Button variant="secondary" size="lg" class="flex-1" loading={sharing} onclick={onshare}><Share2 class="size-5" aria-hidden="true" />Teilen</Button>
        <Button variant="secondary" size="lg" class="flex-1" onclick={onrematch}><RotateCcw class="size-5" aria-hidden="true" />Nochmal spielen</Button>
      </div>
      <Button variant="primary" size="lg" block onclick={onfinish}>Fertig</Button>
    </div>
  {/snippet}
</Sheet>
