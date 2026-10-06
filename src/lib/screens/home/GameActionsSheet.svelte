<script>
  import BookOpen from '@lucide/svelte/icons/book-open';
  import History from '@lucide/svelte/icons/history';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Sheet from '$lib/ui/Sheet.svelte';
  import Switch from '$lib/ui/Switch.svelte';
  import ListRow from '$lib/ui/ListRow.svelte';

  /**
   * @type {{ open?: boolean, game: any, isFavorite?: boolean, isOwned?: boolean, isWishlisted?: boolean,
   *   ontogglefavorite?: (key: string) => void, ontoggleowned?: (key: string) => void,
   *   ontogglewishlist?: (key: string) => void, onopenwiki?: (key: string) => void,
   *   onshowhistory?: (key: string) => void, ondelete?: (key: string) => void }}
   */
  let {
    open = $bindable(false), game, isFavorite = false, isOwned = false, isWishlisted = false,
    ontogglefavorite, ontoggleowned, ontogglewishlist, onopenwiki, onshowhistory, ondelete,
  } = $props();

  /** @param {(key: string) => void | undefined} fn */
  function act(fn) {
    open = false;
    fn?.(game.key);
  }
</script>

<Sheet bind:open title={game?.name ?? ''}>
  <div class="flex flex-col">
    <Switch label="Favorit" checked={isFavorite} onchange={() => ontogglefavorite?.(game.key)} />
    <Switch label="In meiner Sammlung" checked={isOwned} onchange={() => ontoggleowned?.(game.key)} />
    <Switch label="Auf der Wunschliste" checked={isWishlisted} onchange={() => ontogglewishlist?.(game.key)} />
  </div>
  <div class="-mx-4 mt-1 sm:-mx-6">
    {#if game?.wiki?.categories?.length}
      <ListRow title="Regeln & Wiki" onclick={() => act(onopenwiki)}>
        {#snippet leading()}<BookOpen class="size-5" aria-hidden="true" />{/snippet}
      </ListRow>
    {/if}
    <ListRow title="Letzte Ergebnisse" onclick={() => act(onshowhistory)}>
      {#snippet leading()}<History class="size-5" aria-hidden="true" />{/snippet}
    </ListRow>
    {#if game?.custom}
      <ListRow title={game.status === 'pending_review' ? 'Einreichung zurückziehen' : 'Spiel löschen'} tone="danger" onclick={() => act(ondelete)}>
        {#snippet leading()}<Trash2 class="size-5" aria-hidden="true" />{/snippet}
      </ListRow>
    {/if}
  </div>
</Sheet>
