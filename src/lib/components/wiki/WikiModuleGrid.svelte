<script>
  // @ts-check
  import WikiIcon from './WikiIcon.svelte';
  /** @type {{ modules?: any[], moduleHref: (m: any) => string, columns?: number, onPrefetch?: (m: any) => void }} */
  let { modules = [], moduleHref, columns = 1, onPrefetch = () => {} } = $props();
</script>

<div class="wiki-content grid gap-2.5" style="grid-template-columns: repeat({columns}, minmax(0, 1fr))">
  {#each modules as module (module.id)}
    <a
      class="wiki-card wiki-card-hover group flex items-center gap-3 p-3.5 text-left w-full no-underline"
      href={moduleHref(module)}
      onpointerenter={() => onPrefetch(module)}
      ontouchstart={() => onPrefetch(module)}
    >
      {#if module.icon}
        <span class="shrink-0 text-text-muted group-hover:text-primary transition-colors">
          <WikiIcon name={module.icon} size={18} />
        </span>
      {/if}
      <span class="flex flex-col gap-0.5 min-w-0 flex-1">
        <span class="font-heading font-semibold text-sm text-text-primary leading-snug truncate group-hover:text-primary transition-colors">
          {module.title}
        </span>
        {#if module.description}
          <span class="text-xs text-text-muted leading-snug truncate">{module.description}</span>
        {/if}
      </span>
      <svg class="shrink-0 w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </a>
  {/each}
</div>
