<!-- src/lib/components/wiki/WikiModuleRenderer.svelte -->
<script>
  // @ts-check
  import ReferenceRenderer from './renderers/ReferenceRenderer.svelte';
  import ChecklistRenderer from './renderers/ChecklistRenderer.svelte';
  import GlossaryRenderer from './renderers/GlossaryRenderer.svelte';
  import FaqRenderer from './renderers/FaqRenderer.svelte';
  import ScoringRenderer from './renderers/ScoringRenderer.svelte';
  import ArticleRenderer from './renderers/ArticleRenderer.svelte';
  import TipsRenderer from './renderers/TipsRenderer.svelte';
  import VoidfallGroupedRenderer from './renderers/voidfall/VoidfallGroupedRenderer.svelte';
  import VoidfallIconLexikonRenderer from './renderers/voidfall/VoidfallIconLexikonRenderer.svelte';
  import VoidfallLeisteRenderer from './renderers/voidfall/VoidfallLeisteRenderer.svelte';

  /**
   * @type {{
   *   module: { id: string, type: string, layout?: string, title: string, data: any, error?: string },
   *   gameName?: string,
   *   entryHref?: (entry: any) => string
   * }}
   */
  let { module, gameName, entryHref = () => '#/wiki' } = $props();

  const RENDERER_MAP = {
    reference: ReferenceRenderer,
    checklist: ChecklistRenderer,
    glossary:  GlossaryRenderer,
    faq:       FaqRenderer,
    scoring:   ScoringRenderer,
    article:   ArticleRenderer,
    tips:      TipsRenderer
  };

  const LAYOUT_MAP = {
    // Neutrale, spielunabhängige Keys — die Renderer selbst enthalten keinerlei
    // Voidfall-Bezug (datengetrieben über groups[]), nur Name/Ordner suggerieren
    // Bespoke. Neue Manifeste (z. B. Scythe) sollen nur noch diese Keys nutzen.
    grouped: VoidfallGroupedRenderer,
    'icon-grid': VoidfallIconLexikonRenderer,
    // Alte Voidfall-Keys bleiben als Alias erhalten (Rückwärtskompatibilität,
    // bestehendes Voidfall-Manifest ändert sich nicht).
    'voidfall-grouped': VoidfallGroupedRenderer,
    'voidfall-icons': VoidfallIconLexikonRenderer,
    'voidfall-leiste': VoidfallLeisteRenderer
  };

  const Renderer = $derived(
    (module?.layout ? LAYOUT_MAP[module.layout] : null) ?? 
    RENDERER_MAP[module?.type] ?? null
  );
</script>

{#if module?.error}
  <div class="wiki-card p-4 text-sm" style="border-color: var(--color-danger)">
    <p class="m-0 font-medium text-text-primary">⚠️ Fehler beim Laden des Moduls</p>
    <p class="m-0 mt-1 text-text-secondary">{module.error}</p>
  </div>
{:else if Renderer}
  {@const DynamicComponent = Renderer}
  <DynamicComponent
    {module}
    data={module.data}
    {gameName}
    {entryHref}
  />
{:else}
  <div class="p-4 rounded-xl bg-white/5 border border-white/5 text-sm text-[var(--color-text-secondary)]">
    <p class="m-0">Unbekannter Modultyp: <code class="font-mono bg-white/10 px-1.5 py-0.5 rounded-md text-[var(--color-text-primary)]">{module?.type}</code></p>
  </div>
{/if}
