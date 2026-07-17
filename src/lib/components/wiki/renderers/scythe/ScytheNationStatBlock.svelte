<script>
  // @ts-check
  import { formatWikiMarkdown } from '$lib/utils/formatWikiMarkdown.js';
  import { parseScytheNationSummary } from '$lib/components/wiki/utils/parseScytheNation.js';

  /** @type {{ entry: any }} */
  let { entry } = $props();

  const parsed = $derived(parseScytheNationSummary(entry?.summary ?? ''));

  // Deutsche Farbnamen aus dem Regeltext → Farbfeld. Unbekannte Namen zeigen
  // einfach keinen Farbpunkt, der Text bleibt trotzdem lesbar.
  const COLOR_SWATCHES = {
    rot: '#c14b3f',
    blau: '#3d6bc0',
    gelb: '#c99a25',
    'weiß': '#e8e6e0',
    weiss: '#e8e6e0',
    schwarz: '#3a3a3d'
  };
  const swatch = $derived(parsed ? (COLOR_SWATCHES[parsed.color.toLowerCase()] ?? null) : null);
</script>

{#if parsed}
  <div class="flex flex-col gap-5">
    <div class="wiki-card flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3.5">
      <span class="inline-flex items-center gap-2 text-sm text-text-secondary">
        {#if swatch}
          <span class="nation-swatch" style="background:{swatch}" aria-hidden="true"></span>
        {/if}
        Farbe: <strong class="text-text-primary font-semibold">{parsed.color}</strong>
      </span>
      <span class="text-sm text-text-secondary">
        Anführer: <strong class="text-text-primary font-semibold">{parsed.leader}</strong>
      </span>
    </div>

    <div class="wiki-card p-4 sm:p-5 nation-ability-highlight">
      <span class="wiki-eyebrow" style="color: var(--color-primary)">Nationalfähigkeit</span>
      <h3 class="text-base font-bold text-text-primary mt-1 mb-1.5">{parsed.nationalAbility.name}</h3>
      <div class="wiki-prose text-sm">
        {@html formatWikiMarkdown(parsed.nationalAbility.text)}
      </div>
    </div>

    <div class="flex flex-col gap-2.5">
      <div class="flex flex-col gap-0.5">
        <span class="wiki-eyebrow">Mech-Fähigkeiten</span>
        {#if parsed.mechAbilitiesNote}
          <p class="text-xs text-text-muted m-0">{parsed.mechAbilitiesNote}</p>
        {/if}
      </div>
      <div class="grid gap-2.5 sm:grid-cols-2 items-start">
        {#each parsed.mechAbilities as ability (ability.name)}
          <div class="wiki-card p-3.5">
            <h4 class="text-sm font-bold text-text-primary m-0 mb-1">{ability.name}</h4>
            <div class="wiki-prose text-sm">
              {@html formatWikiMarkdown(ability.text)}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{:else}
  <div class="flex flex-col gap-1.5">
    <span class="wiki-eyebrow">Kurz erklärt</span>
    <div class="wiki-prose text-sm text-text-primary leading-relaxed">
      {@html formatWikiMarkdown(entry?.summary ?? '')}
    </div>
  </div>
{/if}

<style>
  .nation-swatch {
    width: 13px;
    height: 13px;
    border-radius: 999px;
    display: inline-block;
    border: 1px solid var(--color-border-glass);
  }
  .nation-ability-highlight {
    border-color: var(--wiki-accent-line);
    background: color-mix(in srgb, var(--color-surface-solid) 100%, var(--color-primary) 5%);
  }
</style>
