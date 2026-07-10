<script>
  // @ts-check
  /**
   * Übersicht aller Wiki-Spiele. Karten sind echte Links auf die Spiel-Landing.
   * @type {{ games?: any[], gameHref: (g: any) => string }}
   */
  let { games = [], gameHref } = $props();
</script>

{#if games.length === 0}
  <div class="flex flex-col items-center gap-3 py-16 px-6 w-full text-center">
    <span class="text-5xl opacity-20">🎲</span>
    <h3 class="font-heading font-bold text-text-primary text-base m-0">Noch keine Wiki-Spiele</h3>
    <p class="text-text-muted text-sm m-0 max-w-[42ch] leading-relaxed">
      Für deine Spiele sind aktuell noch keine Wiki-Inhalte hinterlegt. Schau später wieder vorbei.
    </p>
  </div>
{:else}
  <div class="wiki-content grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
    {#each games as game (game.key)}
      <a
        class="wiki-card wiki-card-hover group flex flex-col text-left w-full overflow-hidden no-underline"
        href={gameHref(game)}
      >
        <div class="aspect-video w-full overflow-hidden" style="background: var(--wiki-hover)">
          {#if game.cover}
            <img
              src={game.cover}
              alt=""
              loading="lazy"
              decoding="async"
              class="w-full h-full object-cover select-none group-hover:scale-[1.03] transition-transform duration-500 ease-out"
            />
          {:else}
            <div class="w-full h-full flex items-center justify-center">
              <span class="font-heading font-extrabold text-lg text-text-primary px-4 text-center">{game.name}</span>
            </div>
          {/if}
        </div>

        <div class="wiki-overview-card-body flex flex-col gap-2.5 min-w-0">
          {#if game.badge}
            <span class="wiki-chip self-start mb-1">{game.badge}</span>
          {/if}
          <h3 class="font-heading font-bold text-[1.05rem] text-text-primary leading-tight m-0 truncate group-hover:text-primary transition-colors">
            {game.name}
          </h3>
          <p class="text-xs text-text-muted mt-0.5 m-0 leading-normal truncate">{game.publisher || 'Unbekannter Verlag'}</p>
        </div>
      </a>
    {/each}
  </div>
{/if}

<style>
  .wiki-overview-card-body {
    padding: 1.1rem 1.25rem 1.25rem;
  }
  @media (min-width: 768px) {
    .wiki-overview-card-body { padding: 1.25rem 1.5rem 1.5rem; }
  }
</style>
