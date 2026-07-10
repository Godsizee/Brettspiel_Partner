<script>
  // @ts-check
  /**
   * Mobile Modulnavigation (P3.2): horizontale, scrollbare Chip-Leiste unter
   * dem Wiki-Header. Modulwechsel in einem Tap — ersetzt den früheren Umweg
   * über Zurück → Landing → Modul. Ab 1024 px übernimmt die WikiSideNav.
   */
  import WikiIcon from '$lib/components/wiki/WikiIcon.svelte';

  /**
   * @type {{
   *   modules?: Array<{ id: string, title: string, icon?: string }>,
   *   activeModuleId?: string | null,
   *   homeHref: string,
   *   homeActive?: boolean,
   *   moduleHref: (m: any) => string,
   *   onPrefetch?: (m: any) => void
   * }}
   */
  let {
    modules = [],
    activeModuleId = null,
    homeHref,
    homeActive = false,
    moduleHref,
    onPrefetch = () => {}
  } = $props();

  /** @type {HTMLElement | null} */
  let listEl = $state(null);

  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Aktiven Chip in Sicht scrollen, wenn sich die Auswahl ändert.
  $effect(() => {
    activeModuleId;
    homeActive;
    const active = listEl?.querySelector('[aria-current="page"]');
    active?.scrollIntoView?.({
      inline: 'center',
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  });
</script>

<nav class="wiki-chipnav lg:hidden" aria-label="Wiki-Bereiche">
  <div class="wiki-chipnav-track" bind:this={listEl}>
    <a
      class="wiki-chipnav-item"
      href={homeHref}
      aria-current={homeActive ? 'page' : undefined}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"></path>
      </svg>
      <span>Start</span>
    </a>
    {#each modules as mod (mod.id)}
      <a
        class="wiki-chipnav-item"
        href={moduleHref(mod)}
        aria-current={activeModuleId === mod.id ? 'page' : undefined}
        onpointerenter={() => onPrefetch(mod)}
        ontouchstart={() => onPrefetch(mod)}
      >
        {#if mod.icon}
          <WikiIcon name={mod.icon} size={14} />
        {/if}
        <span>{mod.title}</span>
      </a>
    {/each}
  </div>
</nav>
