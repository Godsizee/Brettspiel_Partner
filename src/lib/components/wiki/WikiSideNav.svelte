<script>
  // @ts-check
  import WikiIcon from '$lib/components/wiki/WikiIcon.svelte';

  /**
   * Desktop-Seitennavigation (≥ 1024 px). Alle Ziele sind echte Links auf
   * Wiki-Routen — Mittelklick/„In neuem Tab öffnen“ funktionieren nativ.
   *
   * @type {{
   *   gameName?: string,
   *   cover?: string,
   *   publisher?: string,
   *   modules?: Array<{ id: string, title: string, icon?: string }>,
   *   activeModuleId?: string | null,
   *   moduleHref: (m: any) => string,
   *   homeHref: string,
   *   overviewHref: string,
   *   onPrefetch?: (m: any) => void
   * }}
   */
  let {
    gameName = '',
    cover = '',
    publisher = '',
    modules = [],
    activeModuleId = null,
    moduleHref,
    homeHref,
    overviewHref,
    onPrefetch = () => {}
  } = $props();
</script>

<aside class="wiki-sidenav hidden lg:flex flex-col shrink-0 min-h-0">
  <!-- Zurück zur Übersicht -->
  <div class="px-3 pt-4 pb-2 shrink-0">
    <a class="wiki-nav-item text-text-muted" href={overviewHref}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" class="wiki-nav-icon" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      <span>Alle Spiele</span>
    </a>
  </div>

  <!-- Spiel-Kopf -->
  <a class="wiki-game-head" href={homeHref}>
    {#if cover}
      <img src={cover} alt="" loading="lazy" decoding="async" class="wiki-game-cover" />
    {:else}
      <span class="wiki-game-cover wiki-game-cover--ph" aria-hidden="true">{gameName.slice(0, 1)}</span>
    {/if}
    <span class="min-w-0 flex flex-col">
      <span class="font-heading font-bold text-sm text-text-primary leading-tight truncate">{gameName}</span>
      {#if publisher}
        <span class="text-[0.7rem] text-text-muted leading-snug truncate">{publisher}</span>
      {/if}
    </span>
  </a>

  <!-- Modul-Navigation -->
  <nav class="flex flex-col gap-0.5 px-2 pb-4 pt-1 overflow-y-auto min-h-0" aria-label="Wiki-Bereiche">
    <span class="wiki-eyebrow px-2 pt-2 pb-1.5">Bereiche</span>
    {#each modules as mod (mod.id)}
      <a
        class="wiki-nav-item"
        class:is-active={activeModuleId === mod.id}
        aria-current={activeModuleId === mod.id ? 'page' : undefined}
        href={moduleHref(mod)}
        onpointerenter={() => onPrefetch(mod)}
      >
        {#if mod.icon}
          <WikiIcon name={mod.icon} size={16} class="wiki-nav-icon" />
        {/if}
        <span class="truncate">{mod.title}</span>
      </a>
    {/each}
  </nav>
</aside>

<style>
  .wiki-sidenav {
    width: var(--wiki-rail-w);
    border-right: 1px solid var(--color-border-glass);
    background: var(--color-bg-base);
  }

  .wiki-game-head {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.75rem 1rem 1rem;
    text-align: left;
    text-decoration: none;
    border-bottom: 1px solid var(--color-border-glass);
    transition: background-color 140ms ease;
    cursor: pointer;
  }
  .wiki-game-head:hover { background: var(--wiki-hover); }

  .wiki-game-cover {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid var(--color-border-glass);
  }
  .wiki-game-cover--ph {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--wiki-accent-soft);
    color: var(--color-primary);
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 1.1rem;
    text-transform: uppercase;
  }
</style>
