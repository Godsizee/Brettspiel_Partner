<script>
  // @ts-check
  import { splitByTerms } from '$lib/components/wiki/utils/wikiHighlight.js';
  import { currentRoute } from '$lib/router/router.js';

  /**
   * Eintragskarte als echter Link auf die Eintragsseite (P1.1) —
   * Mittelklick, „In neuem Tab öffnen“ und Teilen funktionieren nativ.
   * `highlight` markiert Suchtreffer in Name/Zusammenfassung (P4.2).
   * @type {{ entry: any, href: string, highlight?: string }}
   */
  let { entry, href, highlight = '' } = $props();

  const KIND_LABELS = {
    reference: 'Referenz',
    tips: 'Tipp',
    faq: 'FAQ',
    article: 'Artikel',
    checklist: 'Checkliste',
    scoring: 'Wertung',
    glossary: 'Glossar'
  };

  // Karten-Vorschau zeigt reinen Text (kein {@html}) — Markdown-Syntax und
  // [[icon:...]]-Tags aus dem summary-Feld müssen hier zu lesbarem Text
  // werden, sonst sieht man literale ** und eckige Klammern.
  function stripPreviewMarkup(text) {
    return text
      .replace(/\[\[icon:([a-z0-9-]+)\]\]/g, (_match, slug) => slug.replace(/-/g, ' '))
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1');
  }

  const isVoidfall = $derived($currentRoute?.params?.game === 'voidfall');
  const isLarge = $derived(isVoidfall && !(entry.tags?.includes('icons') || entry.category?.toLowerCase() === 'icons'));

  let meta = $derived([entry.moduleTitle || entry.category, ...(entry.timing || [])].filter(Boolean).join(' · '));
  let nameParts = $derived(splitByTerms(entry.name ?? '', highlight));
  let summaryParts = $derived(splitByTerms(stripPreviewMarkup(entry.summary ?? ''), highlight));
</script>

{#snippet highlighted(parts)}
  {#each parts as part}{#if part.hit}<mark class="wiki-mark">{part.text}</mark>{:else}{part.text}{/if}{/each}
{/snippet}

<a
  class="wiki-card wiki-card-hover wiki-entry-card group w-full text-left flex items-center no-underline {isLarge ? 'p-4 sm:p-5 gap-5' : 'p-3.5 gap-4'}"
  {href}
>
  {#if entry.image}
    <span class="wiki-entry-thumb shrink-0 rounded-lg flex items-center justify-center overflow-hidden p-1" class:is-large={isLarge}>
      <img src={entry.image} alt="" loading="lazy" decoding="async" class="max-w-full max-h-full w-auto h-auto object-contain select-none" />
    </span>
  {/if}

  <span class="flex-1 min-w-0 flex flex-col gap-0.5">
    <div class="flex flex-wrap items-center gap-1.5">
      {#if meta}
        <span class="wiki-eyebrow truncate">{meta}</span>
      {/if}
      {#if entry.kind && entry.kind !== 'reference'}
        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-[var(--wiki-accent-soft)] text-[var(--color-primary)] shrink-0">
          {KIND_LABELS[entry.kind] ?? entry.kind}
        </span>
      {/if}
    </div>
    <span class="wiki-entry-title font-heading font-semibold text-text-primary leading-snug group-hover:text-primary transition-colors {isLarge ? 'text-base sm:text-lg font-bold' : 'text-[0.95rem]'}">
      {@render highlighted(nameParts)}
    </span>
    {#if entry.summary && !isVoidfall}
      <span class="text-sm text-text-secondary leading-relaxed line-clamp-2">{@render highlighted(summaryParts)}</span>
    {/if}
  </span>

  <svg class="shrink-0 w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
  </svg>
</a>

<style>
  .wiki-entry-thumb {
    /* Feste Fläche + object-contain: kein Layout-Shift beim Bild-Laden (P3.4) */
    width: 48px;
    height: 48px;
    aspect-ratio: 1 / 1;
    background: var(--wiki-hover);
    border: 1px solid var(--color-border-glass);
  }
  .wiki-entry-thumb.is-large {
    width: 96px;
    height: 96px;
  }
  .wiki-entry-title {
    overflow-wrap: anywhere;
  }
  @media (max-width: 479px) {
    .wiki-entry-card { padding: 0.7rem; gap: 0.8rem; }
    .wiki-entry-thumb { width: 40px; height: 40px; }
    .wiki-entry-thumb.is-large { width: 80px; height: 80px; }
  }
</style>
