<script>
  // @ts-check
  import Trophy from '@lucide/svelte/icons/trophy';
  import Cloud from '@lucide/svelte/icons/cloud';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import HardDrive from '@lucide/svelte/icons/hard-drive';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Share2 from '@lucide/svelte/icons/share-2';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Dices from '@lucide/svelte/icons/dices';
  import { DEFAULT_PLAYER_COLORS } from '$lib/stores/app.js';
  import { getScores } from '$lib/services/StatsService.js';
  import { validateGameImageUrl } from '$lib/utils/urlValidator.js';
  import { safeCssColor } from '$lib/ui/color.js';
  import { categoryIconUrl } from '$lib/scoring/categoryIcon.js';
  import Badge from '$lib/ui/Badge.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import PlayerDot from '$lib/ui/PlayerDot.svelte';

  /**
   * @type {{ match: any, game?: any, expanded?: boolean, isHost?: boolean, isGuest?: boolean,
   *   ontoggle: () => void, onshare: () => void, ondelete: () => void }}
   */
  let { match, game = undefined, expanded = false, isHost = false, isGuest = false, ontoggle, onshare, ondelete } = $props();
  const uid = $props.id();

  let players = $derived([...getScores(match)].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0)));
  let winner = $derived(players[0] ?? null);
  let cover = $derived(game?.cover ? validateGameImageUrl(game.cover) : null);
  let accent = $derived(safeCssColor(game?.theme?.primary, 'var(--accent)'));
  let scores = $derived(getScores(match));

  // Basis-Kategorien; Erweiterungs-Kategorien nur, wenn dort Werte stehen.
  let cats = $derived.by(() => {
    const base = (game?.categories ?? []).filter((/** @type {any} */ c) => c.type !== 'info');
    const extra = (game?.expansion?.extraCategories ?? []).filter((/** @type {any} */ c) =>
      scores.some((ps) => (ps.score_details?.[c.id] ?? 0) !== 0));
    return [...base, ...extra];
  });

  const SYNC = {
    synced: { icon: Cloud, label: 'Gesichert' },
    pending: { icon: RefreshCw, label: 'Wartet auf Sicherung' },
    local_only: { icon: HardDrive, label: 'Nur auf diesem Gerät' },
    failed: { icon: CircleAlert, label: 'Sicherung fehlgeschlagen' },
  };
  let sync = $derived(SYNC[/** @type {keyof typeof SYNC} */ (match.sync_status || 'synced')] ?? SYNC.synced);

  let duration = $derived.by(() => {
    const secs = match.duration ?? 0;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  });

  let when = $derived(`${new Date(match.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })} · ${new Date(match.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`);
  const colorOf = (/** @type {number} */ i) => DEFAULT_PLAYER_COLORS[i % DEFAULT_PLAYER_COLORS.length];
</script>

<article class="overflow-hidden rounded-md border border-line bg-surface shadow-1" style:border-left="4px solid {accent}">
  <div class="flex items-center gap-1 pr-1">
    <button type="button" class="flex min-w-0 flex-1 items-center gap-3 p-3 text-left" aria-expanded={expanded} aria-controls="{uid}-d" onclick={ontoggle}>
      <span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-surface-2 text-fg-2" aria-hidden="true">
        {#if cover}<img src={cover} alt="" width="48" height="48" loading="lazy" decoding="async" class="size-full object-cover" />{:else}<Dices class="size-6" />{/if}
      </span>
      <span class="min-w-0 flex-1 leading-tight">
        <span class="flex items-center gap-2">
          <strong class="truncate font-display text-[17px] font-semibold">{match.game_name}</strong>
          {#if isHost}<Badge tone="neutral">Host</Badge>{:else if isGuest}<Badge tone="neutral">Gast</Badge>{/if}
        </span>
        <span class="mt-0.5 block text-[0.8rem] text-fg-2">{when} · {duration}</span>
        {#if winner}
          <span class="mt-1 flex items-center gap-1.5 text-sm font-medium">
            <Trophy class="size-4 shrink-0 text-gold" aria-hidden="true" /><span class="truncate">{winner.player_name}</span>
            <span class="tabular text-fg-2">{winner.total_score} Pkt.</span>
          </span>
        {/if}
      </span>
    </button>
    <span class="grid size-8 shrink-0 place-items-center text-fg-3" role="img" aria-label={sync.label} title={sync.label}><sync.icon class="size-4" /></span>
    <ChevronDown class={['size-5 shrink-0 text-fg-2 transition-transform', expanded && 'rotate-180'].join(' ')} aria-hidden="true" />
  </div>

  {#if expanded}
    <div id="{uid}-d" class="flex flex-col gap-4 border-t border-line p-3">
      <ol class="flex flex-col">
        {#each players as ps, rank}
          <li class="flex min-h-11 items-center gap-3">
            <span class="tabular grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold {rank === 0 ? 'bg-gold-soft text-gold' : 'bg-surface-2 text-fg-2'}">{rank + 1}</span>
            <span class="min-w-0 flex-1 truncate font-medium">{ps.player_name}</span>
            <span class="tabular font-semibold">{ps.total_score} Pkt.</span>
          </li>
        {/each}
      </ol>

      {#if cats.length > 0}
        <section>
          <h3 class="mb-1.5 text-sm font-semibold text-fg-2">Kategorie-Aufschlüsselung</h3>
          <div class="overflow-x-auto rounded-md border border-line" role="region" aria-label="Kategorie-Aufschlüsselung, seitlich scrollbar" tabindex="0">
            <table class="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr class="bg-surface-2 text-left">
                  <th scope="col" class="px-3 py-2 font-semibold">Kategorie</th>
                  {#each scores as ps}
                    <th scope="col" class={['px-3 py-2 text-right font-semibold', ps === winner && 'text-gold']}>{ps.player_name}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each cats as cat (cat.id)}
                  {@const icon = categoryIconUrl(cat.icon)}
                  <tr class="border-t border-line">
                    <th scope="row" class="px-3 py-2 text-left font-normal">
                      <span class="flex items-center gap-2">
                        {#if icon}<img src={icon} alt="" width="20" height="20" loading="lazy" decoding="async" class="size-5 shrink-0 object-contain" />{/if}{cat.label}
                      </span>
                    </th>
                    {#each scores as ps}
                      <td class="tabular px-3 py-2 text-right">{ps.score_details?.[cat.id] ?? 0}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>

        {#if scores.length > 1}
          <section>
            <h3 class="mb-1.5 text-sm font-semibold text-fg-2">Kategorie-Vergleich</h3>
            <div class="flex flex-col gap-3">
              {#each cats as cat (cat.id)}
                {@const max = Math.max(...scores.map((ps) => ps.score_details?.[cat.id] ?? 0), 1)}
                <div>
                  <p class="mb-1 text-[0.8rem] font-medium">{cat.label}</p>
                  <ul class="flex flex-col gap-1">
                    {#each scores as ps, idx}
                      {@const val = ps.score_details?.[cat.id] ?? 0}
                      <li class="flex items-center gap-2 text-[0.8rem]">
                        <span class="flex w-20 shrink-0 items-center gap-1.5 truncate"><PlayerDot color={colorOf(idx)} />{ps.player_name}</span>
                        <span class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span class="block h-full rounded-full" style:width="{Math.max(0, Math.min(100, (val / max) * 100))}%" style:background={colorOf(idx)}></span>
                        </span>
                        <span class="tabular w-9 shrink-0 text-right font-semibold">{val}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          </section>
        {/if}
      {/if}

      <div class="flex justify-end gap-1">
        <IconButton label="Ergebnis als Bild teilen" variant="outline" onclick={onshare}><Share2 class="size-5" aria-hidden="true" /></IconButton>
        <IconButton label="Eintrag löschen" variant="outline" class="text-danger" onclick={ondelete}><Trash2 class="size-5" aria-hidden="true" /></IconButton>
      </div>
    </div>
  {/if}
</article>
