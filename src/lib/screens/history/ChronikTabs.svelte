<script>
  // @ts-check
  import { appHash } from '$lib/router/appRoutes.js';

  /** @type {{ active: 'history'|'stats' }} */
  let { active } = $props();
  const TABS = [
    { id: 'history', label: 'Partien', href: appHash.history() },
    { id: 'stats', label: 'Statistik', href: appHash.stats() },
  ];
</script>

<nav aria-label="Chronik" class="flex gap-0.5 rounded-md border border-line bg-surface-2 p-[3px]">
  {#each TABS as t (t.id)}
    <a href={t.href} aria-current={active === t.id ? 'page' : undefined}
      class={['grid h-9 flex-1 place-items-center rounded-[9px] px-3 text-sm font-semibold', active === t.id ? 'bg-surface text-fg shadow-1' : 'text-fg-2']}>{t.label}</a>
  {/each}
</nav>
