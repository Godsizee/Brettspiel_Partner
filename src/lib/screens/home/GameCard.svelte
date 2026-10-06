<script>
  import Dices from '@lucide/svelte/icons/dices';
  import Star from '@lucide/svelte/icons/star';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import IconButton from '$lib/ui/IconButton.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { appHash } from '$lib/router/appRoutes.js';
  import { toSlug } from '$lib/components/wiki/utils/wikiKeys.js';
  import { validateGameImageUrl } from '$lib/utils/urlValidator.js';

  /**
   * @type {{ game: any, isFavorite?: boolean, onselect?: (key: string) => void,
   *   ontogglefavorite?: (key: string) => void, onopenactions?: (key: string) => void }}
   */
  let { game, isFavorite = false, onselect, ontogglefavorite, onopenactions } = $props();

  let href = $derived(appHash.game(toSlug(game.key)));
  let cover = $derived(game.cover ? validateGameImageUrl(game.cover) : null);
  let playersShort = $derived((game.players ?? '1–5 Spieler').replace(/\s*Spieler$/, ''));
  let metaLine = $derived(game.badge ? `${playersShort} · ${game.badge}` : playersShort);

  function handleClick(/** @type {MouseEvent} */ e) {
    e.preventDefault();
    onselect?.(game.key);
  }
</script>

<article class="relative overflow-hidden rounded-md border border-line bg-surface shadow-1">
  <a {href} onclick={handleClick} class="block" aria-label="{game.name} auswählen"
    style:view-transition-name={'cover-' + toSlug(game.key).replace(/[^a-z0-9-]/gi, '_')}>
    <div class="relative aspect-[4/3] bg-surface-2">
      {#if cover}
        <img src={cover} alt={game.name} loading="lazy" decoding="async" width="400" height="300" class="size-full object-cover" />
      {:else}
        <div class="grid size-full place-items-center text-fg-2"><Dices class="size-10" aria-hidden="true" /></div>
      {/if}
      {#if game.status === 'pending_review'}
        <span class="absolute left-2 top-2"><Badge tone="warning">In Prüfung</Badge></span>
      {:else if game.status === 'rejected'}
        <span class="absolute left-2 top-2"><Badge tone="danger">Abgelehnt</Badge></span>
      {/if}
    </div>
    <div class="px-3 pb-3 pt-2.5">
      <strong class="block truncate font-display text-[17px] font-semibold leading-tight">{game.name}</strong>
      <span class="block truncate text-xs text-fg-2">{metaLine}</span>
    </div>
  </a>
  <div class="absolute right-1.5 top-1.5 flex gap-1.5">
    <IconButton variant="overlay" label={isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
      class="size-9" onclick={() => ontogglefavorite?.(game.key)}>
      <Star class="size-4" fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
    </IconButton>
    <IconButton variant="overlay" label="Weitere Aktionen" class="size-9" onclick={() => onopenactions?.(game.key)}>
      <Ellipsis class="size-4" aria-hidden="true" />
    </IconButton>
  </div>
</article>
