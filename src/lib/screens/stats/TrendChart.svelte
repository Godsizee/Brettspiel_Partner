<script>
  // @ts-check
  /**
   * Punkte-Trend als Linie. SVG mit viewBox, Breite 100 %; Datentabelle für Screenreader.
   * @type {{ points: Array<{ score: number, game: string, date: string }>, player: string, color?: string }}
   */
  let { points, player, color = 'var(--accent)' } = $props();

  const W = 400, H = 170, PL = 34, PR = 44, PT = 18, PB = 36;
  let geo = $derived.by(() => {
    const max = Math.max(...points.map((p) => p.score), 10);
    const min = Math.max(0, Math.min(...points.map((p) => p.score)) - 10);
    const range = max - min || 1;
    const dots = points.map((p, i) => ({
      ...p,
      x: PL + (i * (W - PL - PR)) / Math.max(points.length - 1, 1),
      y: PT + (H - PT - PB) * (1 - (p.score - min) / range),
    }));
    return { dots, min, max, mid: Math.round((max + min) / 2), path: 'M ' + dots.map((d) => `${d.x} ${d.y}`).join(' L ') };
  });
  let step = $derived(points.length > 6 ? 2 : 1);
  const yFor = (/** @type {number} */ f) => PT + (H - PT - PB) * f;
</script>

<figure class="m-0">
  <svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img" aria-label="Punkte-Trend von {player}, {points.length} Partien">
    {#each [[0, geo.max], [0.5, geo.mid], [1, geo.min]] as [f, label]}
      <line x1={PL} x2={W - PR} y1={yFor(f)} y2={yFor(f)} stroke="var(--line)" stroke-width="1" />
      <text x={PL - 6} y={yFor(f) + 4} text-anchor="end" font-size="12" fill="var(--text-2)" class="tabular">{label}</text>
    {/each}
    <path d={geo.path} fill="none" stroke={color} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    {#each geo.dots as d, i}
      <circle cx={d.x} cy={d.y} r="4" fill="var(--surface)" stroke={color} stroke-width="2.5" />
      {#if i % step === 0 || i === geo.dots.length - 1}
        <text x={d.x} y={H - 18} text-anchor="middle" font-size="11" fill="var(--text-2)" class="tabular">{d.date}</text>
      {/if}
    {/each}
    {#each geo.dots as d, i}
      {#if i === geo.dots.length - 1}
        <text x={d.x + 8} y={d.y + 4} font-size="13" font-weight="700" fill="var(--text)" class="tabular">{d.score}</text>
      {/if}
    {/each}
  </svg>
  <figcaption class="sr-only">Punkte von {player} in den letzten {points.length} Partien</figcaption>
  <table class="sr-only">
    <caption>Punkte-Trend {player}</caption>
    <thead><tr><th scope="col">Datum</th><th scope="col">Spiel</th><th scope="col">Punkte</th></tr></thead>
    <tbody>{#each points as p}<tr><td>{p.date}</td><td>{p.game}</td><td>{p.score}</td></tr>{/each}</tbody>
  </table>
</figure>
