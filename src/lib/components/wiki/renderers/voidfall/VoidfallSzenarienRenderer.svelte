<!-- src/lib/components/wiki/renderers/voidfall/VoidfallSzenarienRenderer.svelte
     Bespoke-Renderer fuer das Voidfall-Modul "Szenarien" (layout: "voidfall-szenarien").
     Solo- und kompetitive Szenarien mit Aufbau-Galaxie als Held, Komplexitaets-/
     Aggressions-Punktemeter, 2/3/4-Spieler-Umschalter bei kompetitiven Familien und
     klickbaren Chips (Haeuser/Ereignisse/Technologien), die per entryHref direkt in die
     jeweiligen Referenz-Module springen. -->
<script>
  // @ts-check
  import { openLightbox } from '$lib/components/wiki/wikiLightboxStore.svelte.js';
  import { ensureHouseIcons, houseIconUrl } from '$lib/components/wiki/voidfallHouseIcons.svelte.js';

  // Verfuegbarkeits-Index der tintbaren Haus-Symbol-Icons einmalig laden.
  ensureHouseIcons();

  /** @type {{ module: any, data: any, gameName?: string, entryHref?: (e: any) => string }} */
  let { data, entryHref = () => '#/wiki' } = $props();

  // Root-absolute Bildpfade (scenarios[] durchlaeuft NICHT die Zod-Pipeline aus
  // wikiLoader.js, die entries[].image sonst gegen die Vite-Base aufloest — hier
  // manuell nachholen, sonst 404 sobald die App unter einer Sub-Base laeuft.
  const BASE_URL = import.meta.env.BASE_URL || '/';
  function resolveImg(path) {
    if (!path || !path.startsWith('/') || path.startsWith('//')) return path;
    return `${BASE_URL.replace(/\/$/, '')}${path}`;
  }

  /** @param {{ moduleId: string, entryId: string } | null | undefined} ref */
  function refHref(ref) {
    if (!ref) return null;
    return entryHref({ moduleId: ref.moduleId, id: ref.entryId, kind: 'reference' });
  }

  let scenarios = $derived(Array.isArray(data?.scenarios) ? data.scenarios : []);
  let groupDefs = $derived(
    Array.isArray(data?.groups) ? [...data.groups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : []
  );

  let soloScenarios = $derived(
    scenarios.filter((s) => s.mode === 'solo').sort((a, b) => a.code.localeCompare(b.code))
  );

  /** @typedef {{ key: string, name: string, instances: Record<number, any> }} CompFamily */
  let compFamilies = $derived.by(() => {
    /** @type {Map<string, CompFamily>} */
    const map = new Map();
    for (const s of scenarios) {
      if (s.mode !== 'kompetitiv') continue;
      const famKey = s.code.slice(0, 3); // "X012" -> "X01"
      if (!map.has(famKey)) map.set(famKey, { key: famKey, name: s.name, instances: {} });
      const fam = /** @type {CompFamily} */ (map.get(famKey));
      fam.instances[s.players] = s;
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  });

  // Ausgewaehlte Spielerzahl je Familie (Segmented Control) + Detail-Expand-Status.
  /** @type {Record<string, number>} */
  let selectedPlayers = $state({});
  /** @type {Set<string>} */
  let expanded = $state(new Set());

  function playerOptions(fam) {
    return Object.keys(fam.instances).map(Number).sort((a, b) => a - b);
  }
  function currentInstance(fam) {
    const opts = playerOptions(fam);
    const wanted = selectedPlayers[fam.key] ?? opts[0];
    return fam.instances[wanted] ?? fam.instances[opts[0]];
  }
  function selectPlayers(fam, n) {
    selectedPlayers = { ...selectedPlayers, [fam.key]: n };
  }
  function toggleExpanded(key) {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expanded = next;
  }

  function meterDots(value, max = 4) {
    return Array.from({ length: max }, (_, i) => i < (value ?? 0));
  }

  // Ereignisse: pro Zyklus liegen dieselben 3 Buchstaben-Karten aus dem jeweiligen
  // Zyklus-Stapel bereit, aus denen im Spiel 1 zufaellig gezogen wird.
  let eventsByCycle = (scn) => [...(scn?.galacticEvents ?? [])].sort((a, b) => a.cycle - b.cycle);
</script>

{#snippet meter(label, value, max = 4, colorVar = '--color-primary')}
  <span class="szen-meter" title="{label}: {value ?? '–'} / {max}">
    <span class="szen-meter-label">{label}</span>
    <span class="szen-meter-dots" aria-hidden="true">
      {#each meterDots(value, max) as filled}
        <span class="szen-dot" class:filled style={filled ? `background: var(${colorVar})` : ''}></span>
      {/each}
    </span>
  </span>
{/snippet}

{#snippet refChip(name, ref)}
  {#if ref}
    <a class="wiki-chip szen-chip" href={refHref(ref)}>{name}</a>
  {:else}
    <span class="wiki-chip szen-chip szen-chip-muted" title="Keine Verknüpfung gefunden">{name}</span>
  {/if}
{/snippet}

{#snippet houseChip(name, ref)}
  {@const icon = houseIconUrl(name)}
  {#if ref}
    <a class="wiki-chip szen-chip szen-haus-chip" href={refHref(ref)}>
      {#if icon}<span class="haus-icon" style="--haus-icon:url('{icon}')" aria-hidden="true"></span>{/if}<span>{name}</span>
    </a>
  {:else}
    <span class="wiki-chip szen-chip szen-chip-muted szen-haus-chip" title="Keine Verknüpfung gefunden">
      {#if icon}<span class="haus-icon" style="--haus-icon:url('{icon}')" aria-hidden="true"></span>{/if}<span>{name}</span>
    </span>
  {/if}
{/snippet}

<div class="flex flex-col gap-8 w-full">
  {#if groupDefs.length > 0}
    <nav class="wiki-chipnav border-t-0 -mx-(--wiki-pad-x) sm:mx-0" aria-label="Szenario-Bereiche">
      <div class="wiki-chipnav-track sm:px-0">
        {#each groupDefs as g (g.id)}
          <a class="wiki-chipnav-item" href="#szen-{g.id}">{g.title}</a>
        {/each}
      </div>
    </nav>
  {/if}

  <!-- ============================= SOLO ============================= -->
  <section id="szen-solo" class="flex flex-col gap-4" style="scroll-margin-top: 5rem">
    <div class="flex items-baseline gap-2">
      <h2 class="text-lg font-bold text-text-primary m-0">Solo-Szenarien</h2>
      <span class="text-xs text-text-muted">{soloScenarios.length}</span>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {#each soloScenarios as scn (scn.id)}
        {@const isOpen = expanded.has(scn.id)}
        <article class="wiki-card szen-card flex flex-col overflow-hidden">
          <button
            type="button"
            class="szen-hero"
            onclick={() => scn.aufbauImage && openLightbox(resolveImg(scn.aufbauImage), scn.name)}
            aria-label="Aufbau-Galaxie von {scn.name} vergrößern"
          >
            {#if scn.aufbauImage}
              <img src={resolveImg(scn.aufbauImage)} alt="Aufbau-Galaxie: {scn.name}" loading="lazy" decoding="async" />
            {/if}
            <span class="szen-code-badge">{scn.code}</span>
          </button>

          <div class="flex flex-col gap-2.5 p-4">
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-base font-bold text-text-primary m-0">{scn.name}</h3>
            </div>
            {@render meter('Komplexität', scn.complexity, 4)}
            <p class="text-sm text-text-secondary leading-relaxed m-0" class:line-clamp-3={!isOpen}>
              {scn.fluff}
            </p>

            {#if isOpen}
              <div class="flex flex-col gap-3 pt-1">
                {#if scn.specialRules}
                  <div class="szen-special">
                    <span class="wiki-eyebrow">Sonderregel</span>
                    <p class="text-sm text-text-secondary m-0">{scn.specialRules}</p>
                  </div>
                {/if}
                {#if scn.refugesImage}
                  <div class="flex flex-col gap-1.5">
                    <span class="wiki-eyebrow">Zuflüchte</span>
                    <button
                      type="button"
                      class="szen-refuges-btn"
                      onclick={() => openLightbox(resolveImg(scn.refugesImage), 'Zuflüchte: ' + scn.name)}
                      aria-label="Zuflüchte von {scn.name} vergrößern"
                    >
                      <img src={resolveImg(scn.refugesImage)} alt="Zuflüchte: {scn.name}" loading="lazy" decoding="async" />
                    </button>
                  </div>
                {/if}
                <span class="text-xs text-text-muted">Kompendium, S. {scn.source?.page}</span>
              </div>
            {/if}

            <button type="button" class="szen-expand-btn" onclick={() => toggleExpanded(scn.id)}>
              {isOpen ? 'Weniger anzeigen' : 'Details anzeigen'}
            </button>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <!-- =========================== KOMPETITIV =========================== -->
  <section id="szen-kompetitiv" class="flex flex-col gap-4" style="scroll-margin-top: 5rem">
    <div class="flex items-baseline gap-2">
      <h2 class="text-lg font-bold text-text-primary m-0">Kompetitive Szenarien</h2>
      <span class="text-xs text-text-muted">{compFamilies.length} · je 2–4 Spieler</span>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {#each compFamilies as fam (fam.key)}
        {@const scn = currentInstance(fam)}
        {@const isOpen = expanded.has(fam.key)}
        <article class="wiki-card szen-card flex flex-col overflow-hidden">
          <button
            type="button"
            class="szen-hero"
            onclick={() => scn.aufbauImage && openLightbox(resolveImg(scn.aufbauImage), scn.name)}
            aria-label="Aufbau-Galaxie von {scn.name} ({scn.players} Spieler) vergrößern"
          >
            {#if scn.aufbauImage}
              {#key scn.aufbauImage}
                <img src={resolveImg(scn.aufbauImage)} alt="Aufbau-Galaxie: {scn.name}" loading="lazy" decoding="async" />
              {/key}
            {/if}
            <span class="szen-code-badge">{scn.code}</span>
          </button>

          <div class="flex flex-col gap-2.5 p-4">
            <div class="flex items-start justify-between gap-2 flex-wrap">
              <h3 class="text-base font-bold text-text-primary m-0">{fam.name}</h3>
              <div class="szen-segmented" role="group" aria-label="Spielerzahl">
                {#each playerOptions(fam) as n}
                  <button
                    type="button"
                    class="szen-segmented-btn"
                    class:is-active={(selectedPlayers[fam.key] ?? playerOptions(fam)[0]) === n}
                    onclick={() => selectPlayers(fam, n)}
                  >{n}</button>
                {/each}
              </div>
            </div>

            <div class="flex flex-wrap gap-x-5 gap-y-1.5">
              {@render meter('Komplexität', scn.complexity, 4)}
              {@render meter('Aggression', scn.aggression, 4, '--color-danger, #c14b3f')}
            </div>

            <p class="text-sm text-text-secondary leading-relaxed m-0" class:line-clamp-3={!isOpen}>
              {scn.fluff}
            </p>

            {#if isOpen}
              <div class="flex flex-col gap-3 pt-1">
                <div class="flex flex-col gap-1.5">
                  <span class="wiki-eyebrow">Empfohlene Häuser</span>
                  <div class="flex flex-wrap gap-1.5">
                    {#each scn.recommendedHouses ?? [] as h}
                      {@render houseChip(h.name, h.ref)}
                    {/each}
                  </div>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="wiki-eyebrow">Gefallene Häuser</span>
                  <div class="flex flex-wrap gap-1.5">
                    {#each scn.fallenHouses ?? [] as h}
                      {@render houseChip(h.name, h.ref)}
                    {/each}
                  </div>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="wiki-eyebrow">Galaktische Ereignisse für jeden Zyklus</span>
                  <p class="szen-events-hint m-0">
                    Legt in <strong>jedem</strong> Zyklus die Karten
                    <strong>{(scn.galacticEventLetters ?? []).join(' · ')}</strong> aus dem Stapel des
                    Zyklus bereit — davon wird 1 zufällig gezogen.
                  </p>
                  {#each eventsByCycle(scn) as cyc}
                    <div class="szen-cycle-row">
                      <span class="szen-cycle-label">Zyklus {cyc.cycle}</span>
                      <div class="flex flex-wrap gap-1.5">
                        {#each cyc.cards as card}
                          {@render refChip(card.letter, card.ref)}
                        {/each}
                      </div>
                    </div>
                  {/each}
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="wiki-eyebrow">Technologien</span>
                  <div class="flex flex-wrap gap-1.5">
                    {#each scn.technologies ?? [] as t}
                      {@render refChip(t.name, t.ref)}
                    {/each}
                  </div>
                </div>
                <span class="text-xs text-text-muted">Kompendium, S. {scn.source?.page}</span>
              </div>
            {/if}

            <button type="button" class="szen-expand-btn" onclick={() => toggleExpanded(fam.key)}>
              {isOpen ? 'Weniger anzeigen' : 'Details anzeigen'}
            </button>
          </div>
        </article>
      {/each}
    </div>
  </section>
</div>

<style>
  .szen-hero {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    background: var(--color-bg-deep);
    border: none;
    border-bottom: 1px solid var(--color-border-glass);
    padding: 0;
    cursor: zoom-in;
  }
  .szen-hero img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 0.5rem;
  }
  .szen-code-badge {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    font-family: var(--font-heading);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    background: color-mix(in srgb, var(--color-bg-base) 78%, transparent);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border-glass);
  }

  .szen-meter {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .szen-meter-label {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
  .szen-meter-dots { display: inline-flex; gap: 0.22rem; }
  .szen-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--color-border-glass);
    border: 1px solid var(--color-border-glass);
  }
  .szen-dot.filled { border-color: transparent; }

  .szen-expand-btn {
    align-self: flex-start;
    margin-top: 0.15rem;
    padding: 0;
    border: none;
    background: none;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-primary);
    cursor: pointer;
  }
  .szen-expand-btn:hover { text-decoration: underline; }

  .szen-special {
    border-left: 3px solid var(--wiki-accent-line);
    background: var(--wiki-accent-soft);
    border-radius: 0 var(--wiki-radius-sm) var(--wiki-radius-sm) 0;
    padding: 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .szen-refuges-btn {
    display: block;
    width: 100%;
    padding: 0;
    border: 1px solid var(--color-border-glass);
    border-radius: var(--wiki-radius-sm);
    background: var(--color-bg-deep);
    cursor: zoom-in;
    overflow: hidden;
  }
  .szen-refuges-btn img { display: block; width: 100%; height: auto; }

  .szen-events-hint {
    font-size: 0.75rem;
    line-height: 1.45;
    color: var(--color-text-muted);
  }
  .szen-events-hint strong { color: var(--color-text-secondary); }

  /* Zyklus-Zeile: schmales Label + die 3 Karten dieses Zyklus. Die Buchstaben sind
     je Zyklus gleich, die dahinterliegenden Karten aber nicht -> 9 eigene Links. */
  .szen-cycle-row {
    display: grid;
    grid-template-columns: 4.6rem 1fr;
    align-items: center;
    gap: 0.5rem;
  }
  .szen-cycle-label {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .szen-chip { cursor: pointer; }
  .szen-chip-muted {
    background: var(--wiki-hover);
    color: var(--color-text-muted);
    cursor: default;
  }

  /* Haus-Chip mit tintbarem Symbol-Icon (CSS-Maske faerbt sich nach currentColor,
     also automatisch theme-adaptiv: dunkel im Light-, hell im Dark-Mode). */
  .szen-haus-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
  }
  .haus-icon {
    flex: 0 0 auto;
    width: 1.15em;
    height: 1.15em;
    background-color: currentColor;
    -webkit-mask: var(--haus-icon) center / contain no-repeat;
    mask: var(--haus-icon) center / contain no-repeat;
  }

  .szen-segmented {
    display: inline-flex;
    border: 1px solid var(--color-border-glass);
    border-radius: 999px;
    overflow: hidden;
  }
  .szen-segmented-btn {
    padding: 0.2rem 0.6rem;
    border: none;
    background: none;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    cursor: pointer;
    min-width: 1.75rem;
  }
  .szen-segmented-btn + .szen-segmented-btn { border-left: 1px solid var(--color-border-glass); }
  .szen-segmented-btn.is-active {
    background: var(--color-primary);
    color: var(--color-bg-base);
  }

  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
