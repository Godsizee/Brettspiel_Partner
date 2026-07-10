<script>
  // @ts-check
  import WikiModuleGrid from '$lib/components/wiki/WikiModuleGrid.svelte';
  import { openLightbox } from '$lib/components/wiki/wikiLightboxStore.svelte.js';
  import { wikiHash } from '$lib/components/wiki/utils/wikiRoutes.js';

  /**
   * @type {{
   *   game: any,
   *   manifest: any,
   *   modules?: any[],
   *   moduleHref: (m: any) => string,
   *   onPrefetch?: (m: any) => void,
   *   recents?: any[]
   * }}
   */
  let { game, manifest, modules = [], moduleHref, onPrefetch = () => {}, recents = [] } = $props();

  let featuredModules = $derived(modules.filter((m) => m.featured));
  let otherModules    = $derived(modules.filter((m) => !m.featured));
</script>

<div class="flex flex-col gap-8 w-full">

  <!-- Hero -->
  <div class="wiki-landing-hero relative overflow-hidden">
    {#if game?.cover}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="relative cursor-zoom-in" onclick={() => openLightbox(game.cover, game.name ?? '')}>
        <img src={game.cover} alt={game.name} loading="lazy" decoding="async" class="w-full aspect-21/9 object-cover object-center select-none" />
        <div class="absolute inset-0" style="background: linear-gradient(to bottom, transparent 30%, color-mix(in srgb, var(--color-bg-base) 75%, transparent) 75%, var(--color-bg-base))"></div>
        <div class="absolute bottom-0 left-0 right-0 wiki-pad pb-5">
          <h1 tabindex="-1" class="font-heading font-extrabold text-2xl sm:text-3xl text-white leading-tight m-0 drop-shadow-lg">{game?.name}</h1>
          <p class="text-xs text-white/70 m-0 mt-1 leading-snug">
            {game?.publisher || manifest?.game?.publisher || 'Unbekannter Verlag'}
            {#if game?.badge}<span class="mx-1.5 opacity-50">·</span>{game.badge}{/if}
            {#if game?.players}<span class="mx-1.5 opacity-50">·</span>{game.players}{/if}
          </p>
        </div>
      </div>
    {:else}
      <div class="wiki-pad pt-6 pb-2">
        <h1 tabindex="-1" class="wiki-page-title">{game?.name}</h1>
        <p class="text-sm text-text-secondary m-0 mt-1">{game?.publisher || manifest?.game?.publisher || 'Unbekannter Verlag'}</p>
      </div>
    {/if}
  </div>

  <div class="flex flex-col gap-8 w-full">
    <!-- Zuletzt angesehen -->
    {#if recents.length > 0}
      <section class="flex flex-col gap-3">
        <span class="wiki-eyebrow">Zuletzt angesehen</span>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {#each recents as item (item.moduleId + '-' + item.entryId)}
            <a
              class="wiki-card wiki-card-hover p-3 flex items-center justify-center text-center no-underline group min-h-[48px]"
              href={wikiHash.entry(item.slug, item.moduleId, item.entryId)}
            >
              <span class="text-xs sm:text-sm font-bold text-text-primary group-hover:text-primary transition-colors uppercase tracking-wider truncate w-full">{item.moduleId}</span>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Module: mobil als Liste; auf Desktop liegt die Navigation in der linken Spalte -->
    <div class="lg:hidden flex flex-col gap-8">
      {#if featuredModules.length}
        <section class="flex flex-col gap-3">
          <span class="wiki-eyebrow">Häufig genutzt</span>
          <WikiModuleGrid modules={featuredModules} {moduleHref} {onPrefetch} />
        </section>
      {/if}
      {#if otherModules.length}
        <section class="flex flex-col gap-3">
          <span class="wiki-eyebrow">Alle Bereiche</span>
          <WikiModuleGrid modules={otherModules} {moduleHref} {onPrefetch} />
        </section>
      {/if}
    </div>

    <!-- Desktop: kurzer Hinweis, wo die Navigation liegt, statt leerer Seite -->
    <div class="hidden lg:block">
      {#if modules.length}
        <p class="text-sm text-text-muted m-0">
          Wähle links einen Bereich, um Regeln und Einträge zu öffnen.
        </p>
      {/if}
    </div>
  </div>

</div>

<style>
  /* Hero bündig an die Body-Padding-Kanten legen — folgt --wiki-pad-x (P3) */
  .wiki-landing-hero {
    margin-top: -2rem;
    margin-left: calc(-1 * var(--wiki-pad-x));
    margin-right: calc(-1 * var(--wiki-pad-x));
  }
  @media (min-width: 768px) {
    .wiki-landing-hero { margin-top: -2.75rem; }
  }
</style>
