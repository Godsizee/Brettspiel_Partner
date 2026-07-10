<!-- src/lib/components/wiki/renderers/TipsRenderer.svelte -->
<script>
  // @ts-nocheck
  import { sanitizeWikiHtml } from '$lib/utils/formatWikiMarkdown.js';
  import WikiIcon from '../WikiIcon.svelte';

  let { data, gameName = 'dem Spiel' } = $props();

  /** @param {unknown} raw */
  function parseTags(raw) {
    if (!raw) return /** @type {string[]} */ ([]);
    if (Array.isArray(raw)) return raw.map(String);
    try {
      const parsed = JSON.parse(String(raw));
      return Array.isArray(parsed) ? parsed.map(String) : [String(raw)];
    } catch { return [String(raw)]; }
  }

  /** @param {string} tag */
  function cleanTag(tag) {
    return tag.replace(/^\p{Emoji_Presentation}\s*/u, '').replace(/\s*\(.*?\)\s*$/, '').trim();
  }

  const entries = $derived(data?.entries || []);

  const difficulties = $derived.by(() => {
    const groups = new Set();
    entries.forEach(e => groups.add(e.difficulty));
    const order = ['Allgemein', 'Anfänger', 'Fortgeschritten', 'Experte'];
    return Array.from(groups).sort((a, b) => {
      const ai = order.indexOf(a), bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return String(a).localeCompare(String(b));
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  });

  let activeTab = $state(0);
  let activeTagFilter = $state('');

  const diffEntries = $derived(
    entries.filter(e => e.difficulty === difficulties[activeTab])
  );

  const availableTags = $derived.by(() => {
    const set = new Set();
    diffEntries.forEach(e => parseTags(e.tags).forEach(t => set.add(cleanTag(t))));
    return Array.from(set).filter(Boolean).sort();
  });

  const activeEntries = $derived(
    activeTagFilter
      ? diffEntries.filter(e => parseTags(e.tags).map(cleanTag).includes(activeTagFilter))
      : diffEntries
  );

  function switchTab(idx) {
    activeTab = idx;
    activeTagFilter = '';
  }

  /** @param {string} diff */
  function getDifficultyIcon(diff) {
    if (diff === 'Anfänger') return 'sprout';
    if (diff === 'Fortgeschritten') return 'swords';
    if (diff === 'Experte') return 'crown';
    return 'dice-5';
  }

  /** @param {string} diff */
  function getDifficultyColor(diff) {
    if (diff === 'Anfänger') return 'var(--color-success, #22c55e)';
    if (diff === 'Fortgeschritten') return 'var(--color-warning, #eab308)';
    if (diff === 'Experte') return 'var(--color-error, #ef4444)';
    return 'var(--color-primary, #3b82f6)';
  }

  /** @param {string} diff */
  function getDifficultyBgClass(diff) {
    if (diff === 'Anfänger') return 'bg-green-500/15 text-green-400';
    if (diff === 'Fortgeschritten') return 'bg-yellow-500/15 text-yellow-400';
    if (diff === 'Experte') return 'bg-red-500/15 text-red-400';
    return 'bg-blue-500/15 text-blue-400';
  }
</script>

<div class="flex flex-col gap-4 w-full">
  {#if entries.length === 0}
    <div class="flex flex-col items-center gap-3 py-12 px-6 w-full text-center">
      <span class="text-4xl opacity-20">💡</span>
      <p class="text-text-muted text-sm m-0">Für dieses Spiel sind noch keine Tipps hinterlegt.</p>
    </div>
  {:else}
    <!-- Difficulty tabs -->
    <div class="tips-tab-bar border border-border-glass rounded-xl p-1 flex gap-1.5 overflow-x-auto scrollbar-hide">
      {#each difficulties as diff, idx}
        {@const count = entries.filter(e => e.difficulty === diff).length}
        <button
          type="button"
          class="tips-tab-segment shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap relative
            {activeTab === idx ? 'tips-tab--active text-text-primary' : 'text-text-muted hover:text-text-secondary hover:bg-white/5'}"
          onclick={() => switchTab(idx)}
        >
          <WikiIcon name={getDifficultyIcon(diff)} size={16} class="shrink-0" />
          <span>{diff}</span>
          <span class="text-xs font-normal opacity-70 tabular-nums">{count}</span>
          {#if activeTab === idx}
            <div class="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style="background-color: {getDifficultyColor(diff)}"></div>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Tag filter + count header -->
    <div class="pt-1 pb-3 border-b border-border-glass flex flex-col gap-3">
      {#if availableTags.length > 0}
        <div class="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          <button
            type="button"
            class="tag-chip shrink-0 {activeTagFilter === '' ? 'tag-chip--active' : ''}"
            onclick={() => { activeTagFilter = ''; }}
          >Alle</button>
          {#each availableTags as tag}
            <button
              type="button"
              class="tag-chip shrink-0 {activeTagFilter === tag ? 'tag-chip--active' : ''}"
              onclick={() => { activeTagFilter = activeTagFilter === tag ? '' : tag; }}
            >{tag}</button>
          {/each}
        </div>
      {/if}
      <span class="text-xs text-text-muted font-bold tabular-nums tracking-wide uppercase px-1">
        {activeEntries.length} {activeEntries.length === 1 ? 'Tipp' : 'Tipps'}
        {#if activeTagFilter}<span class="opacity-60"> · gefiltert</span>{/if}
      </span>
    </div>

    <!-- Fully expanded tip list -->
    <div class="flex flex-col gap-4">
      {#each activeEntries as entry, idx (entry.id)}
        <div
          class="tips-entry"
          style="--tips-accent-color: {getDifficultyColor(entry.difficulty)}"
        >
          <!-- Header row: number badge + title -->
          <div class="flex items-start gap-3 mb-3">
            <span class="tips-num shrink-0 mt-0.5 {getDifficultyBgClass(entry.difficulty)}">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <h3 class="font-heading font-bold text-text-primary text-sm sm:text-base m-0 leading-snug">
              {entry.title}
            </h3>
          </div>

          <!-- Content -->
          {#if entry.content}
            <div class="wiki-tip-content text-sm text-text-secondary leading-relaxed ml-10">
              {@html sanitizeWikiHtml(entry.content)}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

  .tips-tab-segment { min-height: 2.25rem; }
  .tips-tab--active { background: var(--wiki-accent-soft); }

  .tips-entry {
    background: var(--color-surface-solid);
    border: 1px solid var(--color-border-glass);
    border-left: 3px solid var(--tips-accent-color);
    border-radius: var(--wiki-radius-sm);
    padding: 1.25rem 1.5rem;
    transition: border-color 140ms ease, background-color 140ms ease;
  }
  .tips-entry:hover {
    background: var(--wiki-hover);
    border-color: color-mix(in srgb, var(--tips-accent-color) 40%, var(--color-border-glass));
  }

  .tag-chip {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
    transition: all 150ms ease;
    background: var(--color-surface-solid);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-muted);
    min-height: 1.75rem;
  }
  .tag-chip:hover { background: var(--wiki-hover); color: var(--color-text-secondary); }
  .tag-chip--active {
    background: var(--wiki-accent-soft);
    border-color: var(--wiki-accent-line);
    color: var(--color-primary);
  }

  .tips-num {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .wiki-tip-content :global(p) { margin-bottom: 0.625rem; }
  .wiki-tip-content :global(p:last-child) { margin-bottom: 0; }
  .wiki-tip-content :global(strong) { color: var(--color-text-primary); font-weight: 700; }
  .wiki-tip-content :global(ul) { padding-left: 1.25rem; margin-bottom: 0.625rem; }
  .wiki-tip-content :global(li) { margin-bottom: 0.25rem; }
</style>
