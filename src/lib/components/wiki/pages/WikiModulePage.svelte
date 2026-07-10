<script>
  // @ts-check
  import WikiModuleRenderer from '$lib/components/wiki/WikiModuleRenderer.svelte';

  /**
   * @type {{
   *   activeModule: any,
   *   gameName: string,
   *   entryHref: (e: any) => string
   * }}
   */
  let { activeModule, gameName, entryHref } = $props();
</script>

<header class="mb-6">
  <h1 tabindex="-1" class="wiki-page-title">{activeModule.title}</h1>
</header>
<WikiModuleRenderer
  module={activeModule}
  {gameName}
  {entryHref}
/>
