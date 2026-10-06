<script>
  import Dices from '@lucide/svelte/icons/dices';
  import X from '@lucide/svelte/icons/x';
  import Card from '$lib/ui/Card.svelte';
  import Button from '$lib/ui/Button.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import { validateGameImageUrl } from '$lib/utils/urlValidator.js';

  /** @type {{ draft: any, game: any, onresume?: (draft: any) => void, ondiscard?: (draftId: string) => void }} */
  let { draft, game, onresume, ondiscard } = $props();

  let cover = $derived(game?.cover ? validateGameImageUrl(game.cover) : null);
  let players = $derived((draft.player_scores ?? []).map((/** @type {any} */ p) => p.player_name).join(', '));

  /** @param {string} iso */
  function timeAgo(iso) {
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return 'gerade eben';
    if (diffMin < 60) return `vor ${diffMin} Min.`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `vor ${diffH} Std.`;
    return `vor ${Math.round(diffH / 24)} Tg.`;
  }
</script>

<Card padded class="flex items-center gap-3">
  {#if cover}
    <img src={cover} alt="" width="56" height="56" class="size-14 shrink-0 rounded-[10px] object-cover" />
  {:else}
    <span class="grid size-14 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-fg-2">
      <Dices class="size-6" aria-hidden="true" />
    </span>
  {/if}
  <div class="min-w-0 flex-1">
    <p class="text-xs font-semibold uppercase tracking-wide text-fg-2">Wertung offen</p>
    <p class="truncate font-medium">{draft.game_name}</p>
    <p class="truncate text-sm text-fg-2">{players} · {timeAgo(draft.date)}</p>
  </div>
  <div class="flex shrink-0 items-center gap-1">
    <Button variant="primary" onclick={() => onresume?.(draft)}>Fortsetzen</Button>
    <IconButton label="Entwurf verwerfen" onclick={() => ondiscard?.(draft.id)}><X class="size-5" aria-hidden="true" /></IconButton>
  </div>
</Card>
