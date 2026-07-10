<script>
  // @ts-check
  import WikiGameLanding from '$lib/components/wiki/WikiGameLanding.svelte';
  import { getRecentEntries } from '$lib/components/wiki/utils/wikiRecents.js';

  /**
   * @type {{
   *   overview: any,
   *   visibleModules: any[],
   *   moduleHref: (m: any) => string,
   *   prefetchModule: (m: any) => void
   * }}
   */
  let { overview, visibleModules, moduleHref, prefetchModule } = $props();

  /** @type {any[]} */
  let recents = $state([]);

  $effect(() => {
    if (overview?.slug) {
      getRecentEntries(overview.slug).then((items) => {
        recents = items;
      });
    }
  });
</script>

<WikiGameLanding
  game={overview.catalogEntry}
  manifest={overview.manifest}
  modules={visibleModules}
  {moduleHref}
  onPrefetch={prefetchModule}
  {recents}
/>

