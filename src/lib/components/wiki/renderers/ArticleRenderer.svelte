<!-- src/lib/components/wiki/renderers/ArticleRenderer.svelte -->
<script>
  // @ts-check
  import { formatWikiMarkdown } from '$lib/utils/formatWikiMarkdown.js';

  /** @type {{ data: { title?: string, content?: string, sections?: Array<{ title?: string, content: string }> } }} */
  let { data } = $props();

  const sections = $derived(
    data?.sections
      ? data.sections
      : data?.content
        ? [{ title: data.title || '', content: data.content }]
        : []
  );
</script>

<article class="flex flex-col gap-7 w-full">
  {#if data?.content && data?.sections}
    <p class="wiki-prose italic m-0 pb-5 border-b border-border-glass">
      {@html formatWikiMarkdown(data.content)}
    </p>
  {/if}

  {#if sections.length === 0}
    <p class="text-text-muted italic text-sm m-0">Keine Inhalte vorhanden.</p>
  {:else}
    {#each sections as section}
      <section class="flex flex-col gap-2.5">
        {#if section.title}
          <h2 class="font-heading font-bold text-lg text-text-primary leading-tight m-0">{section.title}</h2>
        {/if}
        <div class="wiki-prose">
          {@html formatWikiMarkdown(section.content)}
        </div>
      </section>
    {/each}
  {/if}
</article>
