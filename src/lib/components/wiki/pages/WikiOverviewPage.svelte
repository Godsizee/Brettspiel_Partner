<script>
  // @ts-check
  import WikiOverview from '$lib/components/wiki/WikiOverview.svelte';

  /**
   * @type {{
   *   games: any[],
   *   gameHref: (g: any) => string
   * }}
   */
  let { games, gameHref } = $props();
</script>

<header class="mb-8 md:mb-10">
  <h1 tabindex="-1" class="wiki-page-title">Spiele-Wiki</h1>
  <p class="wiki-page-lead">Regeln, Komponenten und Hinweise schnell nachschlagen.</p>
</header>
<WikiOverview {games} {gameHref} />
