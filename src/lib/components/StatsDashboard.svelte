<script>
  import {
    activeScreen,
    authService,
    gamesCatalog,
    navigateTo,
    currentUser,
  } from "$lib/stores/app.js";
  import { pullFromRemote } from "$lib/services/DbService.js";
  import { getMatchRepository } from "$lib/services/MatchRepository.js";
  import {
    mergeMatches,
    listPlayers,
    computeOverview,
    computeWinRateSegments,
    computeStreaks,
    computeAvgDurationsByGame,
    computePlayerTrend,
    computeHeadToHead,
    getHeadToHeadMatches,
    listHeadToHeadGames,
    computeRadarAverages,
    computeTimeline,
    getWinner,
  } from "$lib/services/StatsService.js";
  import { onMount } from "svelte";
  import { get } from "svelte/store";

  const matchRepo = getMatchRepository();

  /** @type {any[]} */
  let matches = $state([]);
  let loading = $state(false);

  // Sub-Tabs: 'dashboard' | 'head-to-head' | 'timeline'
  let currentTab = $state("dashboard");

  // Auswahl-Zustände
  let selectedTrendPlayer = $state("");
  let h2hPlayerA = $state("");
  let h2hPlayerB = $state("");
  let h2hSelectedGame = $state("all");

  let allPlayers = $derived(listPlayers(matches));

  // Default-Auswahlen setzen, sobald Spieler vorhanden sind
  $effect(() => {
    if (allPlayers.length > 0) {
      if (!selectedTrendPlayer || !allPlayers.includes(selectedTrendPlayer))
        selectedTrendPlayer = allPlayers[0];
      if (!h2hPlayerA || !allPlayers.includes(h2hPlayerA))
        h2hPlayerA = allPlayers[0];
      if ((!h2hPlayerB || !allPlayers.includes(h2hPlayerB)) && allPlayers.length > 1)
        h2hPlayerB = allPlayers.find((p) => p !== h2hPlayerA) ?? allPlayers[1];
    }
  });

  onMount(() => {
    loadMatches();
    const handleRefresh = () => loadMatches();
    window.addEventListener("bg-refresh-data", handleRefresh);
    return () => window.removeEventListener("bg-refresh-data", handleRefresh);
  });

  $effect(() => {
    if ($activeScreen === "stats") loadMatches();
  });

  async function loadMatches() {
    loading = true;
    const token = authService.getToken();
    const user = get(currentUser);

    let localMatches = [];
    try {
      localMatches = await matchRepo.getLocalMatches();
    } catch (e) {
      console.warn("Stats: Lokale Matches konnten nicht geladen werden", e);
    }

    let remoteMatches = [];
    if (token && user?.id) {
      try {
        remoteMatches = await pullFromRemote(user.id);
      } catch (e) {
        console.warn("Stats: PocketBase fetch failed", e);
      }
    }

    matches = mergeMatches(localMatches, remoteMatches);
    loading = false;
  }

  // ─── Katalog-Helfer (Präsentation) ─────────────────────────────────────────
  /** @param {string} gameName */
  function getGameColor(gameName) {
    const game = Object.values($gamesCatalog).find((g) => g.name === gameName);
    return game?.theme?.primary || "var(--color-primary)";
  }
  /** @param {string} gameName */
  function getGameCategories(gameName) {
    const game = Object.values($gamesCatalog).find((g) => g.name === gameName);
    return game?.categories || [];
  }
  /** @param {any} match */
  function formatDuration(match) {
    const secs = match.duration ?? 0;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }
  /** @param {string} iso */
  function formatShortDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "–";
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }

  // ─── DASHBOARD ──────────────────────────────────────────────────────────────
  let overview = $derived(computeOverview(matches));
  let winRateSegments = $derived(
    computeWinRateSegments(matches).map((seg, i) => ({
      ...seg,
      color: `hsl(${(i * 135) % 360}, 85%, 60%)`,
    })),
  );
  let activeStreaks = $derived(computeStreaks(matches));
  let avgGameDurations = $derived(computeAvgDurationsByGame(matches));
  let maxAvgDuration = $derived(
    Math.max(...avgGameDurations.map((d) => d.avgMin), 1),
  );

  let playerTrendData = $derived(
    computePlayerTrend(matches, selectedTrendPlayer).map((d, idx) => ({
      index: idx,
      score: d.score,
      game: d.game,
      date: formatShortDate(d.dateISO),
    })),
  );

  let lineChartPoints = $derived.by(() => {
    if (playerTrendData.length < 2) return { path: "", area: "", dots: [] };
    const maxScore = Math.max(...playerTrendData.map((d) => d.score), 10);
    const minScore = Math.max(
      0,
      Math.min(...playerTrendData.map((d) => d.score)) - 10,
    );
    const width = 340;
    const height = 100;
    const padLeft = 40;
    const padTop = 15;

    const dots = playerTrendData.map((d, i) => {
      const x = padLeft + (i * width) / (playerTrendData.length - 1);
      const valRange = maxScore - minScore;
      const y = padTop + height * (1 - (d.score - minScore) / (valRange || 1));
      return { x, y, score: d.score, date: d.date, game: d.game };
    });

    const path = "M " + dots.map((p) => `${p.x} ${p.y}`).join(" L ");
    const area =
      path +
      ` L ${dots[dots.length - 1].x} ${padTop + height} L ${dots[0].x} ${padTop + height} Z`;

    return { path, area, dots, minScore, maxScore };
  });

  // ─── HEAD-TO-HEAD ─────────────────────────────────────────────────────────
  let h2hMatches = $derived(getHeadToHeadMatches(matches, h2hPlayerA, h2hPlayerB));
  let h2hStats = $derived(computeHeadToHead(matches, h2hPlayerA, h2hPlayerB));
  let h2hGames = $derived(listHeadToHeadGames(matches, h2hPlayerA, h2hPlayerB));

  // Beim Wechsel der Duellanten ungültige Spielauswahl zurücksetzen
  $effect(() => {
    if (h2hSelectedGame !== "all" && !h2hGames.includes(h2hSelectedGame)) {
      h2hSelectedGame = "all";
    }
  });

  let h2hRadarData = $derived.by(() => {
    const averages = computeRadarAverages(
      matches,
      h2hPlayerA,
      h2hPlayerB,
      h2hSelectedGame === "all" ? "" : h2hSelectedGame,
      getGameCategories(h2hSelectedGame),
    );
    if (!averages) return null;

    const center = 100;
    const radius = 70;
    const numCats = averages.length;

    const points = averages.map((c, idx) => {
      const angle = (Math.PI * 2 * idx) / numCats - Math.PI / 2;
      const maxVal = Math.max(c.aAvg, c.bAvg, 1);
      const aFactor = c.aAvg / maxVal;
      const bFactor = c.bAvg / maxVal;
      return {
        id: c.id,
        label: c.label,
        ax: center + radius * aFactor * Math.cos(angle),
        ay: center + radius * aFactor * Math.sin(angle),
        bx: center + radius * bFactor * Math.cos(angle),
        by: center + radius * bFactor * Math.sin(angle),
        labelX: center + (radius + 15) * Math.cos(angle),
        labelY: center + (radius + 12) * Math.sin(angle),
        aAvg: c.aAvg,
        bAvg: c.bAvg,
        angle,
      };
    });

    const aPath = points.map((p) => `${p.ax},${p.ay}`).join(" ");
    const bPath = points.map((p) => `${p.bx},${p.by}`).join(" ");
    const ringPaths = [0.25, 0.5, 0.75, 1.0].map((scale) =>
      averages
        .map((_, idx) => {
          const angle = (Math.PI * 2 * idx) / numCats - Math.PI / 2;
          const x = center + radius * scale * Math.cos(angle);
          const y = center + radius * scale * Math.sin(angle);
          return `${x},${y}`;
        })
        .join(" "),
    );

    return { points, aPath, bPath, ringPaths, center, radius };
  });

  // ─── TIMELINE ────────────────────────────────────────────────────────────
  let timelineGroups = $derived(computeTimeline(matches));
</script>

<div class="stats-wrapper">
  <h1 class="sr-only">Statistiken</h1>
  <div class="stats-sticky-header">
    <div class="stats-header-panel glass-panel">
      <!-- Navigation -->
      <div class="action-bar">
        <div class="action-left">
          <button class="btn-back" onclick={() => navigateTo("game-selection")}>
            <svg class="icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Zurück</span>
          </button>
        </div>
        <h2 class="scoresheet-title">Statistiken</h2>
        <div class="action-right"></div>
      </div>

      <!-- Sub-Tab-Navigation -->
      <div class="history-tabs-bar">
        <button class="tab-btn" class:active={currentTab === "dashboard"} onclick={() => (currentTab = "dashboard")}>
          <svg viewBox="0 0 24 24" class="tab-icon"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
          <span>Übersicht</span>
        </button>
        <button class="tab-btn" class:active={currentTab === "head-to-head"} onclick={() => (currentTab = "head-to-head")}>
          <svg viewBox="0 0 24 24" class="tab-icon"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 14v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          <span>Duell</span>
        </button>
        <button class="tab-btn" class:active={currentTab === "timeline"} onclick={() => (currentTab = "timeline")}>
          <svg viewBox="0 0 24 24" class="tab-icon"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>Timeline</span>
        </button>
      </div>
    </div>
  </div>

  <div class="stats-container">
    {#if loading && matches.length === 0}
      <div class="history-empty glass-panel">
        <span class="empty-icon">📊</span>
        <p>Statistiken werden geladen…</p>
      </div>
    {:else if matches.length === 0}
      <div class="history-empty glass-panel">
        <span class="empty-icon">📊</span>
        <p>Noch keine Daten für Statistiken.</p>
        <p class="empty-hint">
          Spiele eine Runde und speichere sie, um Auswertungen, Duelle und die
          Timeline freizuschalten!
        </p>
        <button class="btn btn-primary" style="margin-top:12px;" onclick={() => navigateTo("game-selection")}>
          Erstes Spiel starten →
        </button>
      </div>

    <!-- TAB: ÜBERSICHT -->
    {:else if currentTab === "dashboard"}
      <div class="dashboard-grid">
        <div class="stats-highlights">
          <div class="highlight-box glass-panel">
            <span class="highlight-icon">🎮</span>
            <span class="highlight-val">{overview.totalMatches}</span>
            <span class="highlight-lbl">Spiele</span>
          </div>
          <div class="highlight-box glass-panel">
            <span class="highlight-icon">⏱</span>
            <span class="highlight-val">{overview.avgDurationMin} Min.</span>
            <span class="highlight-lbl">Ø Spieldauer</span>
          </div>
          <div class="highlight-box glass-panel long-box">
            <span class="highlight-icon">🏆</span>
            <div class="highscore-wrapper">
              {#if overview.highscore}
                <span class="highscore-val">{overview.highscore.score} Pkt.</span>
                <span class="highscore-meta">{overview.highscore.playerName} in {overview.highscore.gameName}</span>
              {:else}
                <span class="highscore-val">-</span>
              {/if}
            </div>
            <span class="highlight-lbl">All-Time Highscore</span>
          </div>
        </div>

        <!-- Win-Rate Donut -->
        <div class="dashboard-card glass-panel donut-card">
          <h3>Win-Rate Verteilung</h3>
          <div class="donut-container">
            <svg viewBox="0 0 42 42" class="donut-svg">
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(255,255,255,0.06)" stroke-width="4.2"></circle>
              {#each winRateSegments as seg}
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke={seg.color} stroke-width="4.3"
                  stroke-dasharray="{seg.percent} {100 - seg.percent}" stroke-dashoffset={seg.offset}
                  stroke-linecap="round" class="donut-segment"></circle>
              {/each}
            </svg>
            <div class="donut-labels">
              {#each winRateSegments as seg}
                <div class="label-row">
                  <span class="label-dot" style="background: {seg.color}"></span>
                  <span class="label-name">{seg.name}</span>
                  <span class="label-value">{seg.count} {seg.count === 1 ? "Sieg" : "Siege"} ({Math.round(seg.percent)}%)</span>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Streaks -->
        <div class="dashboard-card glass-panel streaks-card">
          <h3>Aktuelle Siegessträhnen</h3>
          <div class="streaks-list">
            {#each activeStreaks as s, i}
              <div class="streak-row" class:top-streak={s.streak > 0 && i === 0}>
                <span class="streak-rank">{i + 1}</span>
                <span class="streak-name">{s.name}</span>
                {#if s.streak > 0}
                  <span class="streak-badge">🔥 {s.streak} in Folge</span>
                {:else}
                  <span class="streak-badge neutral">0</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Ø Dauer pro Spiel -->
        <div class="dashboard-card glass-panel duration-card">
          <h3>Durchschnittliche Dauer pro Spiel</h3>
          <div class="bar-chart-container">
            {#if avgGameDurations.length === 0}
              <p class="neutral-hint">Keine Dauer-Daten vorhanden.</p>
            {:else}
              {#each avgGameDurations as gd}
                {@const color = getGameColor(gd.name)}
                <div class="bar-row">
                  <span class="bar-label">{gd.name}</span>
                  <div class="bar-wrapper">
                    <div class="bar-fill" style="width: {(gd.avgMin / maxAvgDuration) * 100}%; background: linear-gradient(90deg, {color} 0%, var(--color-secondary) 100%)"></div>
                  </div>
                  <span class="bar-value">{gd.avgMin} Min.</span>
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <!-- Punkte-Trend -->
        <div class="dashboard-card glass-panel trend-card">
          <div class="card-header-with-select">
            <h3>Punkte-Trend (Letzte 10 Spiele)</h3>
            <select class="trend-select" bind:value={selectedTrendPlayer}>
              {#each allPlayers as p}
                <option value={p}>{p}</option>
              {/each}
            </select>
          </div>

          <div class="trend-chart-container">
            {#if playerTrendData.length < 2}
              <p class="neutral-hint" style="padding: 40px 0;">
                Spiele mindestens 2 Runden mit {selectedTrendPlayer}, um einen Trend anzuzeigen.
              </p>
            {:else}
              <svg viewBox="0 0 400 150" class="trend-svg">
                <defs>
                  <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.3"></stop>
                    <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0.0"></stop>
                  </linearGradient>
                </defs>
                <line x1="40" y1="15" x2="380" y2="15" stroke="rgba(255,255,255,0.05)" stroke-width="1"></line>
                <line x1="40" y1="65" x2="380" y2="65" stroke="rgba(255,255,255,0.05)" stroke-width="1"></line>
                <line x1="40" y1="115" x2="380" y2="115" stroke="rgba(255,255,255,0.05)" stroke-width="1"></line>
                <text x="32" y="19" class="grid-text">{lineChartPoints.maxScore}</text>
                <text x="32" y="69" class="grid-text">{Math.round((lineChartPoints.maxScore + lineChartPoints.minScore) / 2)}</text>
                <text x="32" y="119" class="grid-text">{lineChartPoints.minScore}</text>
                <path d={lineChartPoints.area} fill="url(#trendAreaGrad)"></path>
                <path d={lineChartPoints.path} fill="none" stroke="var(--color-primary)" stroke-width="3.5" stroke-linecap="round"></path>
                {#each lineChartPoints.dots as d}
                  <g class="trend-point-group">
                    <circle cx={d.x} cy={d.y} r="8" fill="var(--color-primary)" opacity="0.15" class="point-glow"></circle>
                    <circle cx={d.x} cy={d.y} r="4" fill="var(--color-secondary)" stroke="var(--color-primary)" stroke-width="2" class="point-dot"></circle>
                    <text x={d.x} y={d.y - 12} text-anchor="middle" class="point-value">{d.score}</text>
                  </g>
                {/each}
                {#each lineChartPoints.dots as d}
                  <text x={d.x} y="138" text-anchor="middle" class="axis-text axis-date">{d.date}</text>
                  <text x={d.x} y="147" text-anchor="middle" class="axis-text axis-game">{d.game.substring(0, 5)}...</text>
                {/each}
              </svg>
            {/if}
          </div>
        </div>
      </div>

    <!-- TAB: DUELL -->
    {:else if currentTab === "head-to-head"}
      <div class="h2h-setup-bar glass-panel">
        <div class="select-wrapper">
          <label for="h2h-a">Spieler A</label>
          <select id="h2h-a" bind:value={h2hPlayerA}>
            {#each allPlayers as p}
              <option value={p} disabled={p === h2hPlayerB}>{p}</option>
            {/each}
          </select>
        </div>
        <span class="vs-text">VS</span>
        <div class="select-wrapper">
          <label for="h2h-b">Spieler B</label>
          <select id="h2h-b" bind:value={h2hPlayerB}>
            {#each allPlayers as p}
              <option value={p} disabled={p === h2hPlayerA}>{p}</option>
            {/each}
          </select>
        </div>
      </div>

      {#if h2hMatches.length === 0}
        <div class="history-empty glass-panel">
          <span class="empty-icon">⚔️</span>
          <p>Bisher keine direkten Duelle zwischen {h2hPlayerA} und {h2hPlayerB} aufgezeichnet.</p>
        </div>
      {:else}
        <div class="h2h-dashboard">
          <div class="h2h-stats-grid">
            <div class="h2h-stat-card glass-panel">
              <span class="h2h-stat-val font-heading">{h2hStats.count}</span>
              <span class="h2h-stat-lbl">Gemeinsame Spiele</span>
            </div>
            <div class="h2h-stat-card glass-panel h2h-win-ratio-card">
              <div class="ratio-bars-container">
                <div class="ratio-bar-a" style="width: {h2hStats.count ? (h2hStats.aWins / h2hStats.count) * 100 : 50}%">
                  <span>{h2hStats.aWins} Siege</span>
                </div>
                <div class="ratio-bar-b" style="width: {h2hStats.count ? (h2hStats.bWins / h2hStats.count) * 100 : 50}%">
                  <span>{h2hStats.bWins} Siege</span>
                </div>
              </div>
              <div class="ratio-labels">
                <span class="label-player-a">{h2hPlayerA}</span>
                <span class="label-versus">Siegesverhältnis</span>
                <span class="label-player-b">{h2hPlayerB}</span>
              </div>
            </div>
          </div>

          <div class="dashboard-card glass-panel h2h-compare-card">
            <h3>Direkter Vergleich</h3>
            <table class="h2h-table">
              <thead>
                <tr>
                  <th>{h2hPlayerA}</th>
                  <th class="table-center-metric">Metrik</th>
                  <th>{h2hPlayerB}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class:higher-val={h2hStats.aWins > h2hStats.bWins}>{h2hStats.aWins}</td>
                  <td class="metric-name">Siege insgesamt</td>
                  <td class:higher-val={h2hStats.bWins > h2hStats.aWins}>{h2hStats.bWins}</td>
                </tr>
                <tr>
                  <td class:higher-val={h2hStats.aAvg > h2hStats.bAvg}>{h2hStats.aAvg} Pkt.</td>
                  <td class="metric-name">Ø Gesamtpunktzahl</td>
                  <td class:higher-val={h2hStats.bAvg > h2hStats.aAvg}>{h2hStats.bAvg} Pkt.</td>
                </tr>
                <tr>
                  <td class:higher-val={h2hStats.aMax > h2hStats.bMax}>{h2hStats.aMax} Pkt.</td>
                  <td class="metric-name">Höchste Punktzahl</td>
                  <td class:higher-val={h2hStats.bMax > h2hStats.aMax}>{h2hStats.bMax} Pkt.</td>
                </tr>
                <tr>
                  <td colspan="3" class="fav-game-td">
                    <span class="game-meta-lbl">Lieblingsspiel im Duell:</span>
                    <span class="game-meta-val">{h2hStats.favGame}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="dashboard-card glass-panel radar-card">
            <div class="card-header-with-select">
              <h3>Kategorie-Vergleich im Detail</h3>
              <select class="trend-select" bind:value={h2hSelectedGame}>
                <option value="all" disabled>Wähle ein Spiel...</option>
                {#each h2hGames as g}
                  <option value={g}>{g}</option>
                {/each}
              </select>
            </div>

            {#if h2hSelectedGame === "all" || !h2hSelectedGame}
              <p class="neutral-hint" style="padding: 60px 0;">
                Wähle oben ein Spiel aus, um die durchschnittlichen Kategorie-Stärken grafisch als Spider-Chart zu vergleichen.
              </p>
            {:else if !h2hRadarData}
              <p class="neutral-hint" style="padding: 60px 0;">
                Keine Kategorie-Details für dieses Spiel vorhanden.
              </p>
            {:else}
              <div class="radar-chart-wrapper">
                <svg viewBox="0 0 200 200" class="radar-svg">
                  {#each h2hRadarData.ringPaths as path, index}
                    <polygon points={path} fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.8" stroke-dasharray={index < 3 ? "2 2" : "none"}></polygon>
                  {/each}
                  {#each h2hRadarData.points as p}
                    <line x1={h2hRadarData.center} y1={h2hRadarData.center}
                      x2={(p.ax / (p.aAvg || 1)) * (h2hRadarData.radius * 1.1 + h2hRadarData.center)}
                      y2={(p.ay / (p.aAvg || 1)) * (h2hRadarData.radius * 1.1 + h2hRadarData.center)}
                      stroke="rgba(255,255,255,0.05)" stroke-width="0.7" stroke-dasharray="1 3"></line>
                    <text x={p.labelX} y={p.labelY} class="radar-axis-label" text-anchor="middle" dominant-baseline="middle">{p.label.substring(0, 10)}...</text>
                  {/each}
                  <polygon points={h2hRadarData.aPath} fill="hsla(172, 90%, 45%, 0.18)" stroke="hsl(172, 90%, 45%)" stroke-width="2" class="radar-polygon"></polygon>
                  <polygon points={h2hRadarData.bPath} fill="hsla(42, 95%, 55%, 0.18)" stroke="hsl(42, 95%, 55%)" stroke-width="2" class="radar-polygon"></polygon>
                  <circle cx={h2hRadarData.center} cy={h2hRadarData.center} r="2" fill="var(--color-text-muted)"></circle>
                </svg>

                <div class="radar-stats-list">
                  <div class="radar-legend">
                    <div class="legend-item">
                      <span class="legend-dot" style="background: hsl(172, 90%, 45%)"></span> <span class="legend-name">{h2hPlayerA}</span>
                    </div>
                    <div class="legend-item">
                      <span class="legend-dot" style="background: hsl(42, 95%, 55%)"></span> <span class="legend-name">{h2hPlayerB}</span>
                    </div>
                  </div>
                  <div class="radar-metrics-rows">
                    {#each h2hRadarData.points as p}
                      <div class="radar-metric-row">
                        <span class="radar-row-lbl">{p.label}</span>
                        <div class="radar-row-vals">
                          <span class="val-a" class:bold={p.aAvg > p.bAvg}>{p.aAvg}</span>
                          <span class="val-sep">|</span>
                          <span class="val-b" class:bold={p.bAvg > p.aAvg}>{p.bAvg}</span>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

    <!-- TAB: TIMELINE -->
    {:else if currentTab === "timeline"}
      <div class="timeline-container">
        {#each timelineGroups as group}
          <div class="timeline-group">
            <div class="timeline-chapter-card glass-panel">
              <h3 class="chapter-title">{group.label}</h3>
              <div class="chapter-stats">
                <div class="chapter-stat">
                  <span class="chapter-stat-lbl">Matches</span><span class="chapter-stat-val">{group.count} Runden</span>
                </div>
                <div class="chapter-stat">
                  <span class="chapter-stat-lbl">Monats-Favorit</span><span class="chapter-stat-val">{group.favGame}</span>
                </div>
                <div class="chapter-stat">
                  <span class="chapter-stat-lbl">Monats-MVP 🎖</span><span class="chapter-stat-val">{group.mvp}</span>
                </div>
              </div>
            </div>

            <div class="timeline-list">
              <div class="timeline-line"></div>
              {#each group.matches as match}
                {@const winner = getWinner(match)}
                {@const color = getGameColor(match.game_name)}
                <div class="timeline-item">
                  <div class="timeline-dot" style="background: {color}; box-shadow: 0 0 10px {color}"></div>
                  <div class="timeline-card glass-panel" style="border-left: 3px solid {color}">
                    <div class="timeline-card-meta">
                      <span class="game-title">{match.game_name}</span>
                      <span class="play-date">{formatShortDate(match.date)} • ⏱ {formatDuration(match)}</span>
                    </div>
                    {#if winner}
                      <div class="timeline-card-winner">
                        <span class="crown">🏆</span>
                        <span class="name">{winner.player_name}</span>
                        <span class="score">({winner.total_score} Pkt.)</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .stats-wrapper {
    flex: 1;
    height: 100%;
    min-height: 0;
    width: 100%;
    max-width: 780px;
    margin: 0 auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    scrollbar-width: none;
    padding-top: calc(var(--header-height) / 4);
  }
  .stats-wrapper::-webkit-scrollbar { display: none; }

  .stats-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 12px 0 40px;
  }

  .stats-sticky-header {
    position: sticky;
    top: calc(var(--header-height) / 4);
    z-index: 10;
    width: 100%;
    padding: 0 0 10px;
  }

  .stats-header-panel {
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  /* Nav-Zeile */
  .action-bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 12px 16px 10px;
    border-bottom: 1px solid var(--color-border-glass);
  }
  .action-left { justify-self: start; display: flex; align-items: center; }
  .action-right { justify-self: end; }

  .btn-back {
    display: flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-heading);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border-glass);
    padding: 7px 14px;
    border-radius: 10px;
    transition: var(--transition-fast);
    cursor: pointer;
  }
  .btn-back:hover {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(-2px);
  }

  .scoresheet-title {
    grid-column: 2;
    font-family: var(--font-heading);
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--color-text-primary);
    text-align: center;
    margin: 0;
    letter-spacing: -0.01em;
  }

  /* Tab-Zeile */
  .history-tabs-bar {
    display: flex;
    gap: 4px;
    padding: 6px 8px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .history-tabs-bar::-webkit-scrollbar { display: none; }

  .history-tabs-bar .tab-btn {
    flex: 1;
    min-width: max-content;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 9px 16px;
    border-radius: 10px;
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .history-tabs-bar .tab-btn.active {
    background: var(--color-primary);
    color: var(--color-text-primary);
    box-shadow: 0 3px 12px var(--color-primary-glow);
  }
  .tab-icon {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Empty State */
  .history-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 60px 24px;
    text-align: center;
    color: var(--color-text-secondary);
    background: var(--color-surface-glass);
    border: 1px solid var(--color-border-glass);
    border-radius: var(--radius-md);
    width: 100%;
    max-width: 480px;
    margin: 40px auto;
  }
  .empty-icon { font-size: 3rem; }
  .empty-hint { font-size: 0.82rem; color: var(--color-text-muted); }

  /* Dashboard Grid */
  .dashboard-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .stats-highlights {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .highlight-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    border-radius: var(--radius-md);
    background: var(--color-surface-glass);
    border: 1px solid var(--color-border-glass);
    text-align: center;
    aspect-ratio: 1.35;
  }
  .long-box {
    grid-column: span 2;
    aspect-ratio: auto;
    padding: 20px 24px;
    flex-direction: row;
    justify-content: flex-start;
    gap: 20px;
  }
  .highlight-icon { font-size: 2rem; }
  .highlight-val {
    font-family: var(--font-heading);
    font-size: 1.65rem;
    font-weight: 800;
    color: var(--color-text-primary);
    margin: 4px 0 2px 0;
  }
  .highlight-lbl {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }
  .highscore-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    align-items: flex-start;
  }
  .highscore-val {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--color-text-primary);
  }
  .highscore-meta {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .dashboard-card {
    padding: 20px;
    border-radius: var(--radius-md);
    background: var(--color-surface-glass);
    border: 1px solid var(--color-border-glass);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .dashboard-card h3 {
    font-family: var(--font-heading);
    font-size: 0.95rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-primary);
    border-left: 3px solid var(--color-primary);
    padding-left: 10px;
    margin: 0;
  }

  /* Donut */
  .donut-card { gap: 20px; }
  .donut-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }
  .donut-svg { width: 150px; height: 150px; transform: rotate(-90deg); }
  .donut-segment { transition: stroke-width 0.3s ease; }
  .donut-segment:hover { stroke-width: 5.2; cursor: pointer; }
  .donut-labels {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .label-row { display: flex; align-items: center; font-size: 0.85rem; }
  .label-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 12px;
    flex-shrink: 0;
  }
  .label-name { font-weight: 700; color: var(--color-text-primary); flex: 1; }
  .label-value {
    color: var(--color-text-secondary);
    font-family: var(--font-heading);
    font-weight: 600;
  }

  /* Streaks */
  .streaks-list { display: flex; flex-direction: column; gap: 10px; }
  .streak-row {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--color-border-glass);
    font-size: 0.88rem;
  }
  .top-streak {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%);
    border-color: rgba(245, 158, 11, 0.28);
  }
  .streak-rank {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 0.85rem;
    color: var(--color-text-muted);
    width: 28px;
  }
  .top-streak .streak-rank { color: hsl(42, 95%, 65%); }
  .streak-name { font-weight: 700; color: var(--color-text-primary); flex: 1; }
  .streak-badge {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 0.8rem;
    color: hsl(42, 95%, 65%);
  }
  .streak-badge.neutral { color: var(--color-text-muted); font-weight: 500; }

  /* Duration Chart */
  .bar-chart-container { display: flex; flex-direction: column; gap: 14px; }
  .bar-row { display: flex; align-items: center; gap: 14px; font-size: 0.85rem; }
  .bar-label {
    width: 90px;
    font-weight: 700;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar-wrapper {
    flex: 1;
    height: 10px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 5px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 5px;
    transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .bar-value {
    width: 60px;
    text-align: right;
    font-family: var(--font-heading);
    font-weight: 700;
    color: var(--color-text-primary);
  }

  /* Trend */
  .card-header-with-select {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  .trend-select {
    font-family: var(--font-heading);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border-glass);
    padding: 6px 14px;
    border-radius: 10px;
    outline: none;
    cursor: pointer;
  }
  .trend-chart-container { width: 100%; margin-top: 12px; overflow-x: auto; }
  .trend-svg { width: 100%; min-width: 320px; height: auto; }
  .grid-text {
    font-family: var(--font-heading);
    font-size: 6px;
    fill: var(--color-text-muted);
    font-weight: 700;
    text-anchor: end;
  }
  .axis-text {
    font-family: var(--font-heading);
    font-size: 5px;
    fill: var(--color-text-muted);
    font-weight: 600;
  }
  .axis-game { font-size: 4px; fill: var(--color-text-muted); opacity: 0.6; }
  .point-value {
    font-family: var(--font-heading);
    font-size: 5px;
    fill: var(--color-text-primary);
    font-weight: 700;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .trend-point-group:hover .point-value { opacity: 1; }
  .trend-point-group:hover .point-glow { r: 11; }

  /* Duell Setup */
  .h2h-setup-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-radius: var(--radius-md);
    background: var(--color-surface-glass);
    border: 1px solid var(--color-border-glass);
  }
  .select-wrapper { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .select-wrapper label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
    letter-spacing: 0.06em;
  }
  .select-wrapper select {
    font-family: var(--font-heading);
    font-size: 0.9rem;
    font-weight: 800;
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--color-border-glass);
    padding: 10px 14px;
    border-radius: 10px;
    cursor: pointer;
    outline: none;
  }
  .vs-text {
    font-family: var(--font-heading);
    font-weight: 900;
    font-size: 1.15rem;
    color: var(--color-secondary);
    padding: 0 20px;
    margin-top: 18px;
  }

  .h2h-dashboard { display: flex; flex-direction: column; gap: 20px; }
  .h2h-stats-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
  .h2h-stat-card {
    padding: 20px;
    border-radius: var(--radius-md);
    background: var(--color-surface-glass);
    border: 1px solid var(--color-border-glass);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .h2h-stat-val { font-size: 2.2rem; font-weight: 800; color: var(--color-text-primary); }
  .h2h-stat-lbl {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }
  .h2h-win-ratio-card { justify-content: space-between; gap: 16px; }
  .ratio-bars-container {
    width: 100%;
    height: 24px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--color-border-glass);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
  }
  .ratio-bar-a {
    background: linear-gradient(90deg, var(--color-secondary-glow) 0%, var(--color-secondary) 100%);
    height: 100%;
    display: flex;
    align-items: center;
    padding-left: 12px;
    font-family: var(--font-heading);
    font-size: 0.75rem;
    font-weight: 700;
    color: white;
    transition: width 0.5s ease;
  }
  .ratio-bar-b {
    background: linear-gradient(90deg, var(--color-warning) 0%, hsl(35, 100%, 50%) 100%);
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 12px;
    font-family: var(--font-heading);
    font-size: 0.75rem;
    font-weight: 700;
    color: white;
    transition: width 0.5s ease;
  }
  .ratio-labels {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    gap: 8px;
  }
  .label-player-a {
    font-weight: 700;
    color: var(--color-secondary);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .label-player-b {
    font-weight: 700;
    color: var(--color-warning);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .label-versus {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .h2h-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
    margin-top: 10px;
  }
  .h2h-table th,
  .h2h-table td {
    padding: 12px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    text-align: center;
  }
  .h2h-table th {
    font-family: var(--font-heading);
    font-weight: 800;
    color: var(--color-text-secondary);
  }
  .table-center-metric {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
    letter-spacing: 0.06em;
  }
  .metric-name {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
  }
  .higher-val {
    font-family: var(--font-heading);
    font-weight: 800;
    color: var(--color-text-primary);
  }
  .fav-game-td { padding: 18px 8px !important; text-align: center; }
  .game-meta-lbl { font-size: 0.78rem; color: var(--color-text-muted); margin-right: 8px; }
  .game-meta-val {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 0.95rem;
    color: var(--color-secondary);
  }

  /* Radar */
  .radar-card { gap: 16px; }
  .radar-chart-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 100%;
  }
  .radar-svg { width: 220px; height: 220px; }
  .radar-axis-label {
    font-family: var(--font-heading);
    font-size: 5px;
    fill: var(--color-text-muted);
    font-weight: 700;
  }
  .radar-polygon { transition: all 0.3s ease; }
  .radar-polygon:hover { fill-opacity: 0.3; }
  .radar-legend { display: flex; justify-content: center; gap: 24px; margin-bottom: 12px; }
  .legend-item { display: flex; align-items: center; font-size: 0.8rem; font-weight: 700; }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
  .legend-name { color: var(--color-text-primary); }
  .radar-stats-list { width: 100%; }
  .radar-metrics-rows { display: flex; flex-direction: column; gap: 8px; }
  .radar-metric-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    font-size: 0.8rem;
  }
  .radar-row-lbl { color: var(--color-text-secondary); font-weight: 600; }
  .radar-row-vals {
    display: flex;
    gap: 12px;
    font-family: var(--font-heading);
    font-weight: 600;
    color: var(--color-text-muted);
  }
  .radar-row-vals .val-a { color: var(--color-secondary); }
  .radar-row-vals .val-b { color: var(--color-warning); }
  .radar-row-vals .bold { font-weight: 900; }

  /* Timeline */
  .timeline-container { display: flex; flex-direction: column; gap: 24px; padding-left: 4px; }
  .timeline-group { display: flex; flex-direction: column; gap: 16px; }
  .timeline-chapter-card {
    padding: 16px 20px;
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
  }
  .chapter-title {
    font-family: var(--font-heading);
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--color-text-primary);
    margin-bottom: 12px;
  }
  .chapter-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .chapter-stat { display: flex; flex-direction: column; gap: 2px; }
  .chapter-stat-lbl {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
    letter-spacing: 0.05em;
  }
  .chapter-stat-val {
    font-family: var(--font-heading);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-text-secondary);
  }
  .timeline-list {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-left: 24px;
  }
  .timeline-line {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 8px;
    width: 2px;
    background: rgba(255, 255, 255, 0.08);
    z-index: 1;
  }
  .timeline-item { position: relative; display: flex; align-items: center; z-index: 2; }
  .timeline-dot {
    position: absolute;
    left: -20px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    z-index: 3;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .timeline-item:hover .timeline-dot { transform: scale(1.4); }
  .timeline-card {
    flex: 1;
    padding: 14px 18px;
    border-radius: 14px;
    background: var(--color-surface-glass);
    border: 1px solid var(--color-border-glass);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .timeline-card:hover {
    transform: translateX(6px);
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.04);
  }
  .timeline-card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    margin-bottom: 6px;
    gap: 12px;
    flex-wrap: wrap;
  }
  .timeline-card-meta .game-title {
    font-family: var(--font-heading);
    font-size: 0.9rem;
    font-weight: 850;
    color: var(--color-text-primary);
  }
  .timeline-card-winner {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: var(--color-text-secondary);
  }
  .timeline-card-winner .name { font-weight: 700; color: hsl(42, 95%, 65%); }

  /* Responsive */
  @media (min-width: 768px) {
    .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .stats-highlights { grid-column: span 2; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .long-box {
      grid-column: auto;
      aspect-ratio: 1.35;
      flex-direction: column;
      justify-content: center;
      padding: 20px;
    }
    .highscore-wrapper { align-items: center; }
    .donut-card { grid-column: span 1; }
    .donut-container { flex-direction: row; justify-content: center; gap: 32px; }
    .donut-labels { max-width: 240px; }
    .h2h-stats-grid { grid-template-columns: 200px 1fr; }
    .radar-chart-wrapper { flex-direction: row; justify-content: space-around; gap: 24px; }
    .radar-stats-list { max-width: 260px; }
  }

  @media (min-width: 1024px) {
    .stats-wrapper { max-width: 1080px; }
  }

  @media (max-width: 600px) {
    .action-bar { padding: 10px 14px; }
    .scoresheet-title { font-size: 1rem; }
    .btn-back { padding: 6px 12px; font-size: 0.78rem; }
    .h2h-setup-bar { flex-direction: column; gap: 12px; padding: 16px; }
    .vs-text {
      margin-top: 0;
      padding: 4px 14px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 20px;
      font-size: 0.85rem;
    }
    .select-wrapper { width: 100%; }
    .h2h-stats-grid { grid-template-columns: 1fr; }
    .stats-highlights { grid-template-columns: 1fr; }
    .long-box { grid-column: span 1; flex-direction: column; align-items: center; text-align: center; padding: 16px; }
    .highscore-wrapper { align-items: center; }
  }

  @media (max-width: 480px) {
    .dashboard-card { padding: 14px; }
    .radar-svg { width: 180px; height: 180px; }
    .h2h-table th,
    .h2h-table td { padding: 8px 4px; font-size: 0.78rem; }
    .metric-name { font-size: 0.68rem; }
    .action-bar { padding: 10px 12px 8px; grid-template-columns: auto 1fr; gap: 10px; }
    .scoresheet-title { grid-column: 2; text-align: left; font-size: 0.95rem; }
    .action-right { display: none; }
    .history-tabs-bar .tab-btn { padding: 8px 10px; font-size: 0.75rem; gap: 4px; }
    .tab-icon { width: 13px; height: 13px; }
  }

  @media (max-width: 360px) {
    .btn-back { padding: 5px 10px; font-size: 0.72rem; gap: 4px; }
    .history-tabs-bar { gap: 3px; padding: 5px 6px; }
    .history-tabs-bar .tab-btn { padding: 7px 10px; font-size: 0.74rem; gap: 4px; }
    .tab-icon { width: 13px; height: 13px; }
    .scoresheet-title { font-size: 0.88rem; }
  }

  @media (max-width: 320px) {
    .btn-back span { display: none; }
    .btn-back { padding: 6px 8px; }
    .history-tabs-bar .tab-btn span { display: none; }
    .history-tabs-bar .tab-btn { padding: 7px; min-width: 0; flex: 1; }
    .tab-icon { width: 15px; height: 15px; margin: 0 auto; }
  }

  @media (max-width: 1023px) {
    .stats-wrapper { height: auto; overflow-y: visible; overscroll-behavior: auto; }
  }
</style>
