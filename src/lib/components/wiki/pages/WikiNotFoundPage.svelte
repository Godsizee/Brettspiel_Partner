<script>
  // @ts-check
  import { wikiHash } from '$lib/components/wiki/utils/wikiRoutes.js';
</script>

<div class="wiki-card p-6 flex flex-col gap-4 items-start max-w-[480px] m-auto mt-10">
  <p class="m-0 text-[var(--color-text-primary)] font-medium">⚠ Seite nicht gefunden.</p>
  <p class="text-sm text-text-muted m-0">Die angeforderte Wiki-Seite existiert nicht.</p>
  <a class="wiki-nav-item is-active justify-center w-auto px-4 mt-2" href={wikiHash.overview()}>
    Zurück zur Übersicht
  </a>
</div>
