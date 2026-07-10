<script>
  import {
    activeScreen,
    historyFilter,
    cachedMatches,
    isOnline,
    pocketbaseHost,
    authService,
    showToast,
    gamesCatalog,
    navigateTo,
    currentUser,
  } from "$lib/stores/app.js";
  import { db, pullFromRemote } from "$lib/services/DbService.js";
  import { getMatchRepository } from "$lib/services/MatchRepository.js";
  import { mergeMatches } from "$lib/services/StatsService.js";
  import { shareMatchAsImage } from "$lib/services/MatchShareService.js";
  import { onMount } from "svelte";
  import { get } from "svelte/store";

  /** @type {(event: string, ...args: any[]) => void} */
  const { dispatch = () => {} } = $props();
  const matchRepo = getMatchRepository();

  /** @type {any[]} */
  let matches = $state([]);
  let loading = $state(false);

  // Accordion state für Runden-Details
  let expandedMatchIndex = $state(null);

  let filteredMatches = $derived(
    $historyFilter === "all"
      ? matches
      : matches.filter((m) => m.game_name === $historyFilter),
  );

  // Spielte Spiele mit Anzahl für Filter-Pill-Badges
  let matchCountByGame = $derived.by(() => {
    /** @type {Record<string, number>} */
    const counts = { all: matches.length };
    matches.forEach((m) => {
      counts[m.game_name] = (counts[m.game_name] || 0) + 1;
    });
    return counts;
  });

  // Nur Filter-Optionen für tatsächlich gespielte Spiele
  let activeFilterOptions = $derived([
    { key: "all", label: "Alle" },
    ...Object.values($gamesCatalog)
      .filter((g) => matchCountByGame[g.name] > 0)
      .map((g) => ({ key: g.name, label: g.name })),
  ]);

  onMount(async () => {
    await loadHistory();
    const handleRefresh = async () => {
      await loadHistory();
    };
    window.addEventListener("bg-refresh-data", handleRefresh);
    return () => {
      window.removeEventListener("bg-refresh-data", handleRefresh);
    };
  });

  $effect(() => {
    // Reaktiv auf Änderungen des aktiven Screens und des angemeldeten Benutzers reagieren
    const screen = $activeScreen;
    const user = $currentUser;
    if (screen === "match-history") {
      loadHistory();
    }
  });

  let needsReauth = $state(false);

  async function loadHistory() {
    loading = true;
    needsReauth = false;
    const token = authService.getToken();
    const user = get(currentUser);

    // Offline-first: lokal gespeicherte Matches IMMER laden – unabhängig von
    // Login oder Netzverbindung. So gehen Partien in der Ansicht nie verloren.
    let localMatches = [];
    try {
      localMatches = await matchRepo.getLocalMatches();
    } catch (e) {
      console.warn('History: Lokale Matches konnten nicht geladen werden', e);
    }

    let remoteMatches = [];
    if (token && user?.id) {
      try {
        remoteMatches = await pullFromRemote(user.id);
      } catch (e) {
        // Kein harter Fehler: lokale Matches werden weiterhin angezeigt.
        console.warn('History: PocketBase fetch failed', e);
      }
    } else if (localMatches.length === 0) {
      // Weder angemeldet noch lokale Daten → Hinweis zum Anmelden.
      console.warn(`History: Kein Token (${!!token}) oder User-ID (${user?.id}) — Anmeldung nötig.`);
      needsReauth = true;
    }

    matches = mergeMatches(localMatches, remoteMatches);
    loading = false;
  }

  // Auto-reload history when a fresh token arrives after re-login
  $effect(() => {
    if (
      authService.getToken() &&
      needsReauth &&
      $activeScreen === "match-history"
    ) {
      needsReauth = false;
      loadHistory();
    }
  });

  // Lösch-Verwaltung mit Undo-Timer
  let pendingDeleteIndex = $state(/** @type {number|null} */ (null));
  let undoTimer = /** @type {any} */ (null);

  /** @param {number} i */
  function confirmDeleteMatch(i) {
    pendingDeleteIndex = i;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => executeDelete(), 5000);
  }

  function undoDelete() {
    clearTimeout(undoTimer);
    pendingDeleteIndex = null;
  }

  async function executeDelete() {
    if (pendingDeleteIndex === null) return;
    const match = filteredMatches[pendingDeleteIndex];
    pendingDeleteIndex = null;
    if (!match) return;

    // Remote-Record-ID bestimmen: pb_id ist der PocketBase-Record. Fallback auf
    // match.id nur, wenn das Match als synced gilt (dann ist id == PB-ID, weil der
    // Eintrag direkt aus pullFromRemote stammt). Bei rein lokalen Matches → null.
    const remoteId =
      match.pb_id ||
      (!match.sync_status || match.sync_status === "synced" ? match.id : null);

    // Remote ZUERST löschen, damit lokal und Server konsistent bleiben. Würde nur
    // lokal gelöscht und der Server-Record bliebe bestehen, käme das Match beim
    // nächsten Pull als „Geist-Eintrag" zurück — und der Nutzer hätte fälschlich
    // eine Erfolgsmeldung gesehen (genau dieser Bug).
    if (remoteId) {
      if (!get(isOnline)) {
        showToast(
          "Offline — synchronisierte Einträge lassen sich nur mit Internetverbindung löschen.",
          "error",
        );
        return;
      }
      const token = authService.getToken();
      if (!token) {
        showToast("Bitte neu anmelden, um diesen Eintrag zu löschen.", "error");
        return;
      }

      const host = get(pocketbaseHost);
      let resp;
      try {
        resp = await fetch(
          `${host}/api/collections/matches/records/${remoteId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (e) {
        console.warn("History: Remote-Delete Netzwerkfehler", e);
        showToast("Verbindungsfehler — Eintrag wurde nicht gelöscht.", "error");
        return;
      }

      // 204/200 = gelöscht. PocketBase liefert 404, wenn der Record nicht (mehr)
      // über die deleteRule (user = auth.id) erreichbar ist — entweder bereits
      // gelöscht ODER fremder Eintrag (Gast-Match). Ein fremdes Match darf nicht
      // als „gelöscht" gemeldet werden, sonst verschwindet es lokal und kommt
      // beim nächsten Pull wieder.
      if (resp.status === 404) {
        const ownerId = get(currentUser)?.id;
        if (match.user && ownerId && match.user !== ownerId) {
          showToast(
            "Dieser Eintrag gehört einem anderen Konto und kann nicht gelöscht werden.",
            "error",
          );
          return;
        }
        // sonst: serverseitig bereits weg → als Erfolg behandeln (lokal aufräumen).
      } else if (!resp.ok) {
        console.warn("History: Remote-Delete fehlgeschlagen", resp.status);
        showToast("Löschen auf dem Server fehlgeschlagen.", "error");
        return;
      }
    }

    // Lokales Löschen (entfernt auch aus SyncService falls vorhanden)
    await matchRepo.deleteMatch(match.local_id || match.id);

    await loadHistory();
    showToast("Eintrag gelöscht.", "success");
  }

  async function handleShareMatch(match) {
    try {
      showToast("Bild wird generiert...", "info");
      const cover = getGameCover(match.game_name);
      await shareMatchAsImage(match, cover);
    } catch (e) {
      console.error(e);
      showToast("Teilen fehlgeschlagen.", "error");
    }
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

  /** @param {string} gameName */
  function getGameCover(gameName) {
    const game = Object.values($gamesCatalog).find((g) => g.name === gameName);
    return game?.cover || "";
  }

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

</script>

<div class="history-wrapper">
  <h1 class="sr-only">Spielarchiv</h1>
  <div class="history-sticky-header">
    <div class="history-header-panel glass-panel">

      <!-- Zeile 1: Navigation -->
      <div class="action-bar">
        <div class="action-left">
          <button
            class="btn-back"
            id="btn-close-history"
            onclick={() => {
              navigateTo("game-selection");
              dispatch("close");
            }}
          >
            <svg
              class="icon-svg"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Zurück</span>
          </button>
        </div>
        <h2 class="scoresheet-title">Spielarchiv</h2>
        <div class="action-right"></div>
      </div>

      <!-- Zeile 2: Filter Pills -->
      {#if matches.length > 0}
        <div class="filter-pills-bar">
          {#each activeFilterOptions as opt}
            <button
              class="filter-pill"
              class:active={$historyFilter === opt.key}
              data-filter={opt.key}
              onclick={() => historyFilter.set(opt.key)}
            >
              {opt.label}
              {#if matchCountByGame[opt.key]}<span class="pill-count">{matchCountByGame[opt.key]}</span>{/if}
            </button>
          {/each}
        </div>
      {/if}

    </div>
  </div>

  <div class="history-container">
    {#if loading}
      <div class="history-list">
        {#each Array(3) as _}
          <div class="match-card skeleton-card" style="--accent-color: var(--color-primary)">
            <div class="skeleton-shimmer"></div>
            <div class="card-main">
              <div class="card-thumb" style="background: rgba(255,255,255,0.04)"></div>
              <div class="card-body">
                <div style="height:14px; width:65%; background:rgba(255,255,255,0.08); border-radius:4px; margin-bottom:8px;"></div>
                <div style="height:10px; width:40%; background:rgba(255,255,255,0.05); border-radius:3px; margin-bottom:14px;"></div>
                <div style="height:30px; background:rgba(255,255,255,0.05); border-radius:8px; margin-bottom:5px;"></div>
                <div style="height:26px; background:rgba(255,255,255,0.03); border-radius:8px;"></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else if matches.length === 0}
      <div class="history-empty glass-panel">
        {#if needsReauth}
          <span class="empty-icon">🔑</span>
          <p>Sitzung abgelaufen</p>
          <p class="empty-hint">
            Deine Cloud-Runden sind nicht sichtbar, weil nach dem Seitenneustart
            keine aktive Sitzung mehr vorliegt. Melde dich kurz neu an &mdash;
            deine Daten gehen nicht verloren.
          </p>
          <button
            class="btn btn-primary"
            style="margin-top:12px;"
            onclick={() =>
              window.dispatchEvent(new CustomEvent("open-auth-modal"))}
          >
            Neu anmelden
          </button>
        {:else}
          <span class="empty-icon">📁</span>
          <p>Noch keine Runden aufgezeichnet.</p>
          <p class="empty-hint">
            Spiele eine Runde und speichere sie, um Statistiken und Geschichte
            freizuschalten!
          </p>
        {/if}
      </div>
    {:else}
        <div class="history-content-main">
          {#if needsReauth}
            <div
              class="offline-sync-banner glass-panel"
              style="border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.07);"
            >
              <div class="sync-banner-content">
                <span class="sync-banner-icon">🔒</span>
                <div class="sync-banner-text">
                  <strong>Anmeldung erforderlich</strong>
                  <span>Bitte melde dich an, um dein Spielarchiv zu laden.</span
                  >
                </div>
              </div>
              <button
                class="btn btn-primary btn-sm sync-now-btn"
                onclick={() =>
                  window.dispatchEvent(new CustomEvent("open-auth-modal"))}
              >
                Anmelden
              </button>
            </div>
          {/if}

          <div class="history-split-pane">
            <div class="history-list" id="history-list">
              {#if pendingDeleteIndex !== null}
                <div class="swipe-delete-banner" role="alert">
                  <span>Eintrag wird gelöscht...</span>
                  <button class="btn-undo-delete" onclick={undoDelete}
                    >↩ Rückgängig</button
                  >
                </div>
              {/if}
              {#if matches.length === 0}
                <div class="empty-state-card" id="history-empty-state">
                  <div class="empty-state-icon float-icon">🏆</div>
                  <h3 class="empty-state-title">Deine erste Partie wartet!</h3>
                  <p class="empty-state-text">
                    Hier findest du später alle deine gespielten Partien, Statistiken und Duelle.
                  </p>
                  <button class="btn btn-primary" onclick={() => navigateTo('game-selection')}>
                    Erstes Spiel starten →
                  </button>
                </div>
              {:else if filteredMatches.length === 0}
                <div class="empty-state-card" id="history-filter-empty-state">
                  <div class="empty-state-icon">🔍</div>
                  <h3 class="empty-state-title">Keine Treffer</h3>
                  <p class="empty-state-text">
                    Für dieses Spiel wurden noch keine Partien aufgezeichnet.
                  </p>
                </div>
              {:else}
                {#each filteredMatches as match, i}
                  {@const sortedPlayers = [...(match.player_scores ?? [])].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))}
                  {@const winner = sortedPlayers[0] ?? null}
                  {@const cover = getGameCover(match.game_name)}
                  {@const color = getGameColor(match.game_name)}
                  {@const hasCategories = getGameCategories(match.game_name).length > 0}

                  <div
                    class="match-card"
                    class:selected-card={expandedMatchIndex === i}
                    style="--accent-color: {color};"
                  >

                    <!-- Hauptbereich: Thumbnail + Inhalt -->
                    <div class="card-main">

                      <!-- Klick-Overlay: macht den Hauptbereich tastatur- & screenreader-tauglich klickbar,
                           ohne verschachtelte interaktive Elemente (echte Buttons liegen per z-index darüber) -->
                      <button
                        type="button"
                        class="card-expand-overlay"
                        aria-expanded={expandedMatchIndex === i}
                        aria-label="Details für {match.game_name} ein- oder ausklappen"
                        onclick={() => { expandedMatchIndex = expandedMatchIndex === i ? null : i; }}
                      ></button>


                      <!-- Cover-Thumbnail links -->
                      <div
                        class="card-thumb"
                        style="{cover ? `background-image: url('${cover}')` : ''}"
                        data-initial="{match.game_name.charAt(0)}"
                      >
                        {#if !cover}
                          <span class="thumb-letter" style="color:{color}">{match.game_name.charAt(0)}</span>
                        {/if}
                        <div class="thumb-accent" style="background: {color}"></div>
                      </div>

                      <!-- Inhalt rechts -->
                      <div class="card-body">
                        <!-- Spielname + Dauer + Host/Gast Badge -->
                        <div class="card-head">
                          <span class="match-game">{match.game_name}</span>
                          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: auto;">
                            {#if match.user === $currentUser?.id}
                              <span class="host-badge" style="margin-left: 0;" title="Du hast dieses Match erstellt">Host</span>
                            {:else if match.user}
                              <span class="guest-badge" style="margin-left: 0;" title="Du wurdest zu diesem Match eingeladen">Gast</span>
                            {/if}
                            <span class="duration-chip">⏱ {formatDuration(match)}</span>
                            <button
                              class="btn-delete-match-icon"
                              onclick={(e) => { e.stopPropagation(); confirmDeleteMatch(i); }}
                              title="Eintrag löschen"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        </div>

                        <!-- Datum -->
                        <time class="match-date">
                          {new Date(match.date).toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                          {" · "}
                          {new Date(match.date).toLocaleTimeString("de-DE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })} Uhr
                        </time>

                        <!-- Rangliste aller Spieler -->
                        {#if sortedPlayers.length > 0}
                          <div class="card-players-list">
                            {#each sortedPlayers as ps, rank}
                              <div class="rank-row" class:rank-first={rank === 0}>
                                <span class="rank-medal">
                                  {#if rank === 0}🥇{:else if rank === 1}🥈{:else if rank === 2}🥉{:else}{rank + 1}.{/if}
                                </span>
                                <span class="rank-name">{ps.player_name}</span>
                                <span class="rank-pts">{ps.total_score} Pkt.</span>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>

                    <!-- Details-Footer -->
                    <div class="card-footer" style="display: flex; gap: 8px;">
                      {#if hasCategories}
                        <button
                          class="btn-details"
                          style="flex: 1;"
                          onclick={(e) => { e.stopPropagation(); expandedMatchIndex = expandedMatchIndex === i ? null : i; }}
                        >
                          {expandedMatchIndex === i ? "▲ Details ausblenden" : "▼ Details einblenden"}
                        </button>
                      {/if}
                      <button 
                        class="btn-details" 
                        style="flex: 0 0 auto; padding: 0 16px;" 
                        onclick={(e) => { e.stopPropagation(); handleShareMatch(match); }}
                        title="Ergebnis als Bild teilen"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="18" cy="5" r="3"></circle>
                          <circle cx="6" cy="12" r="3"></circle>
                          <circle cx="18" cy="19" r="3"></circle>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                      </button>
                    </div>

                    <!-- Ausgeklappte Kategorie-Details -->
                    {#if expandedMatchIndex === i}
                      <div class="match-expanded-details">
                        <h4 class="details-sub-title">Kategorie-Aufschlüsselung</h4>
                        <div class="details-grid-wrapper">
                          <table class="details-table">
                            <thead>
                              <tr>
                                <th>Kategorie</th>
                                {#each match.player_scores ?? [] as ps}
                                  <th class:highlight-player={ps === winner}>{ps.player_name}</th>
                                {/each}
                              </tr>
                            </thead>
                            <tbody>
                              {#each getGameCategories(match.game_name) as cat}
                                <tr>
                                  <td class="category-td">
                                    {#if cat.icon}<img src={cat.icon} alt={cat.label} loading="lazy" decoding="async" class="cat-mini-icon" />{/if}
                                    <span>{cat.label}</span>
                                  </td>
                                  {#each match.player_scores ?? [] as ps}
                                    <td class="score-td" class:highlight-player={ps === winner}>{ps.score_details?.[cat.id] ?? 0}</td>
                                  {/each}
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>

                        {#if match.player_scores?.length > 1}
                          <div class="category-comparison-chart-container">
                            <h4 class="details-sub-title" style="margin-top: 16px;">Visualisierter Kategorie-Vergleich</h4>
                            <div class="category-bars-grid">
                              {#each getGameCategories(match.game_name) as cat}
                                {@const maxVal = Math.max(...(match.player_scores ?? []).map((ps) => ps.score_details?.[cat.id] ?? 0), 1)}
                                <div class="cat-bar-group animate-scale-up">
                                  <div class="cat-bar-header">
                                    {#if cat.icon}<img src={cat.icon} alt={cat.label} loading="lazy" decoding="async" class="cat-mini-icon" />{/if}
                                    <span class="cat-bar-label">{cat.label}</span>
                                  </div>
                                  <div class="cat-players-bars">
                                    {#each match.player_scores ?? [] as ps, idx}
                                      {@const val = ps.score_details?.[cat.id] ?? 0}
                                      {@const percent = Math.max(0, Math.min(100, (val / maxVal) * 100))}
                                      {@const pColor = `var(--player-${idx + 1}-color, hsl(${(idx * 135) % 360}, 85%, 60%))`}
                                      <div class="player-bar-row">
                                        <span class="player-bar-name">{ps.player_name}</span>
                                        <div class="player-bar-track">
                                          <div class="player-bar-fill" style="width: {percent}%; background: {pColor};" title="{val} Punkte"></div>
                                        </div>
                                        <span class="player-bar-value">{val}</span>
                                      </div>
                                    {/each}
                                  </div>
                                </div>
                              {/each}
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/if}

                  </div>
                {/each}
              {/if}
            </div>

            <!-- Detail Sidebar (Desktop Split-View) -->
            <div class="history-detail-sidebar glass-panel">
              {#if expandedMatchIndex !== null && filteredMatches[expandedMatchIndex]}
                {@const match = filteredMatches[expandedMatchIndex]}
                {@const sortedPlayers = [...(match.player_scores ?? [])].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))}
                {@const winner = sortedPlayers[0] ?? null}
                {@const cover = getGameCover(match.game_name)}
                {@const color = getGameColor(match.game_name)}
                <div class="match-expanded-details active-sidebar animate-scale-up" style="display:block; --accent-color: {color};">
                  <div class="sidebar-header" style="display: flex; gap: 16px; margin-bottom: 20px; align-items: center;">
                    {#if cover}
                      <div class="sidebar-thumb" style="width: 60px; height: 60px; border-radius: 12px; background-size: cover; background-position: center; background-image: url('{cover}')"></div>
                    {/if}
                    <div>
                      <h3 class="sidebar-game-title" style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 800; color: var(--color-text-primary); margin: 0;">{match.game_name}</h3>
                      <time class="match-date" style="font-size: 0.78rem; color: var(--color-text-secondary); display: block; margin-top: 4px;">
                        {new Date(match.date).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })} um {new Date(match.date).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })} Uhr
                      </time>
                    </div>
                  </div>

                  <h4 class="details-sub-title">Kategorie-Aufschlüsselung</h4>
                  <div class="details-grid-wrapper">
                    <table class="details-table">
                      <thead>
                        <tr>
                          <th>Kategorie</th>
                          {#each match.player_scores ?? [] as ps}
                            <th class:highlight-player={ps === winner}>{ps.player_name}</th>
                          {/each}
                        </tr>
                      </thead>
                      <tbody>
                        {#each getGameCategories(match.game_name) as cat}
                          <tr>
                            <td class="category-td">
                              {#if cat.icon}<img src={cat.icon} alt={cat.label} loading="lazy" decoding="async" class="cat-mini-icon" />{/if}
                              <span>{cat.label}</span>
                            </td>
                            {#each match.player_scores ?? [] as ps}
                              <td class="score-td" class:highlight-player={ps === winner}>{ps.score_details?.[cat.id] ?? 0}</td>
                            {/each}
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>

                  {#if match.player_scores?.length > 1}
                    <div class="category-comparison-chart-container">
                      <h4 class="details-sub-title" style="margin-top: 16px;">Visualisierter Kategorie-Vergleich</h4>
                      <div class="category-bars-grid">
                        {#each getGameCategories(match.game_name) as cat}
                          {@const maxVal = Math.max(...(match.player_scores ?? []).map((ps) => ps.score_details?.[cat.id] ?? 0), 1)}
                          <div class="cat-bar-group animate-scale-up">
                            <div class="cat-bar-header">
                              {#if cat.icon}<img src={cat.icon} alt={cat.label} loading="lazy" decoding="async" class="cat-mini-icon" />{/if}
                              <span class="cat-bar-label">{cat.label}</span>
                            </div>
                            <div class="cat-players-bars">
                              {#each match.player_scores ?? [] as ps, idx}
                                {@const val = ps.score_details?.[cat.id] ?? 0}
                                {@const percent = Math.max(0, Math.min(100, (val / maxVal) * 100))}
                                {@const pColor = `var(--player-${idx + 1}-color, hsl(${(idx * 135) % 360}, 85%, 60%))`}
                                <div class="player-bar-row">
                                  <span class="player-bar-name">{ps.player_name}</span>
                                  <div class="player-bar-track">
                                    <div class="player-bar-fill" style="width: {percent}%; background: {pColor};" title="{val} Punkte"></div>
                                  </div>
                                  <span class="player-bar-value">{val}</span>
                                </div>
                              {/each}
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {:else}
                <div class="sidebar-empty" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; text-align: center; color: var(--color-text-secondary); gap: 12px;">
                  <span class="sidebar-empty-icon" style="font-size: 2.5rem;">📊</span>
                  <p style="font-size: 0.88rem; font-weight: 600; margin: 0;">Wähle eine Partie links aus,</p>
                  <p style="font-size: 0.78rem; margin: 0; max-width: 220px; color: var(--color-text-muted);">um die detaillierte Punkteaufschlüsselung anzuzeigen.</p>
                </div>
              {/if}
            </div>
          </div>
        </div>
    {/if}
  </div>
</div>

<style>
  /*
   * LAYOUT: history-wrapper IST der Scroll-Container.
   *
   * padding-top = calc(var(--header-height) / 2) erfüllt zwei Anforderungen
   * gleichzeitig:
   *   1. Der history-sticky-header startet in seiner natürlichen Position exakt
   *      auf Höhe des Sticky-Schwellenwerts (top = padding-top) → kein Push-down
   *      bei Scroll-Position 0, keine Überlappung mit dem history-container.
   *   2. Der optische Abstand zwischen app-header und history-sticky-header
   *      beträgt nur noch die Hälfte des vorherigen Wertes (var(--header-height)/2
   *      statt var(--header-height)).
   *
   * history-container scrollt NICHT mehr selbst – Scroll liegt beim Wrapper.
   */
  .history-wrapper {
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

  .history-wrapper::-webkit-scrollbar {
    display: none;
  }

  .history-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 12px 0 40px;
    /* Kein overflow-y, kein flex:1 – Scroll liegt jetzt beim Wrapper */
  }

  /*
   * Sticky-Header: klebt beim Scrollen innerhalb von .history-wrapper.
   * top = padding-top des Wrappers → bei Scroll=0 befindet sich das Element
   * exakt an seinem Schwellenwert, wird NICHT sofort nach unten gedrückt.
   */
  .history-sticky-header {
    position: sticky;
    top: calc(var(--header-height) / 4);
    z-index: 10;
    width: 100%;
    padding: 0 0 10px;
  }

  .history-header-panel {
    border-radius: var(--radius-md);
    /* background, backdrop-filter, border → von .glass-panel */
    overflow: hidden;
  }

  /* Nav-Zeile (Zurück + Titel) */
  .action-bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 12px 16px 10px;
    border-bottom: 1px solid var(--color-border-glass);
  }

  .action-left {
    justify-self: start;
    display: flex;
    align-items: center;
  }

  .action-right {
    justify-self: end;
  }

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


  /* Filter-Pill-Zeile */
  .filter-pills-bar {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 8px 10px;
    scrollbar-width: none;
  }

  .filter-pills-bar::-webkit-scrollbar {
    display: none;
  }

  .filter-pill {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 20px;
    font-family: var(--font-heading);
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    background: var(--color-surface-glass);
    border: 1px solid var(--color-border-glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    cursor: pointer;
    transition: var(--transition-fast);
    white-space: nowrap;
  }

  .filter-pill:hover {
    background: rgba(255, 255, 255, 0.09);
    color: var(--color-text-primary);
  }

  .filter-pill.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-text-primary);
    box-shadow: 0 3px 10px var(--color-primary-glow);
  }

  .pill-count {
    font-size: 0.68rem;
    font-weight: 900;
    background: rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    padding: 1px 5px;
    min-width: 16px;
    text-align: center;
    line-height: 1.4;
  }

  .filter-pill.active .pill-count {
    background: rgba(255, 255, 255, 0.22);
  }

  /* ── MATCH-LISTE ── */
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .swipe-delete-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
    padding: 10px 16px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #f87171;
    gap: 12px;
  }

  .btn-undo-delete {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
    border-radius: 8px;
    padding: 5px 12px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition-fast);
    white-space: nowrap;
  }

  .btn-undo-delete:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  .btn-delete-match-icon {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--color-border-glass);
    color: var(--color-text-muted);
    padding: 6px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .btn-delete-match-icon:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: var(--color-primary);
    transform: scale(1.08);
  }

  .btn-delete-match-icon:active {
    transform: scale(0.92);
  }

  /* ── NEUE MATCH-CARD ── */
  .match-card {
    touch-action: pan-y pinch-zoom;
    position: relative;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-surface-glass);
    border: 1px solid var(--color-border-glass);
    border-left: 3px solid var(--accent-color, var(--color-primary));
    transition:
      transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
      box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1),
      border-color 0.3s ease;
  }

  .match-card:hover {
    transform: translateY(-2px);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.35),
      0 0 0 1px color-mix(in srgb, var(--accent-color, var(--color-primary)) 35%, transparent);
  }

  /* Haupt-Layout: Thumbnail + Body */
  .card-main {
    display: flex;
    align-items: stretch;
    position: relative;
  }

  /* Transparentes Klick-Overlay über dem Hauptbereich (Auf-/Zuklappen) */
  .card-expand-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  .card-expand-overlay:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .card-thumb {
    width: 80px;
    min-height: 110px;
    flex-shrink: 0;
    background-size: cover;
    background-position: center;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.03);
  }

  .thumb-letter {
    font-family: var(--font-heading);
    font-size: 2.4rem;
    font-weight: 900;
    opacity: 0.7;
    user-select: none;
  }

  /* Farbiger Akzent-Balken links auf dem Thumbnail */
  .thumb-accent {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 3px;
    opacity: 0.7;
  }

  .card-body {
    flex: 1;
    padding: 12px 14px 10px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .match-game {
    font-family: var(--font-heading);
    font-size: 0.97rem;
    font-weight: 800;
    color: var(--color-text-primary);
    line-height: 1.2;
    /* Allow up to 2 lines on mobile */
  }

  .duration-chip {
    flex-shrink: 0;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border-glass);
    padding: 3px 8px;
    border-radius: 8px;
    white-space: nowrap;
    margin-top: 1px;
  }

  .match-date {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    letter-spacing: 0.01em;
  }

  /* Rangliste */
  .card-players-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-top: 6px;
  }

  .rank-row {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 8px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
  }

  .rank-row.rank-first {
    background: linear-gradient(
      90deg,
      rgba(245, 158, 11, 0.1) 0%,
      rgba(245, 158, 11, 0.03) 100%
    );
    border: 1px solid rgba(245, 158, 11, 0.18);
  }

  .rank-medal {
    font-size: 0.88rem;
    width: 20px;
    text-align: center;
    flex-shrink: 0;
    line-height: 1;
  }

  .rank-name {
    flex: 1;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rank-row.rank-first .rank-name {
    color: var(--color-text-primary);
    font-weight: 700;
  }

  .rank-pts {
    font-family: var(--font-heading);
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-text-primary);
    flex-shrink: 0;
  }

  /* Details Footer */
  .card-footer {
    border-top: 1px solid var(--color-border-glass);
    padding: 7px 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-details {
    font-family: var(--font-heading);
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 12px;
    transition: color 0.2s;
  }

  .btn-details:hover {
    color: var(--color-primary);
  }

  /* Skeleton */
  .skeleton-card {
    border-left-color: var(--color-primary) !important;
    pointer-events: none;
    user-select: none;
  }

  /* Ausgeklappte Details – unverändert */
  .match-expanded-details {
    margin: 0 14px 14px;
    padding-top: 14px;
    border-top: 1px dashed var(--color-border-glass);
    animation: fadeInSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes fadeInSlide {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .details-sub-title {
    font-family: var(--font-heading);
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin-bottom: 10px;
    letter-spacing: 0.05em;
  }

  .details-grid-wrapper {
    overflow-x: auto;
    border-radius: 10px;
    border: 1px solid var(--color-border-glass);
    background: rgba(0, 0, 0, 0.2);
  }

  .details-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    text-align: left;
  }

  .details-table th,
  .details-table td {
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    white-space: nowrap;
  }

  .details-table th {
    background: rgba(255, 255, 255, 0.03);
    font-family: var(--font-heading);
    font-weight: 700;
    color: var(--color-text-secondary);
  }

  .details-table th.highlight-player {
    color: hsl(42, 95%, 65%);
    background: rgba(245, 158, 11, 0.06);
  }

  .details-table td.highlight-player {
    font-weight: 700;
    color: hsl(42, 95%, 65%);
    background: rgba(245, 158, 11, 0.04);
  }

  .category-td {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .cat-mini-icon {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    object-fit: cover;
  }

  .score-td {
    font-family: var(--font-heading);
    font-weight: 700;
    color: var(--color-text-secondary);
  }

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
    grid-column: 1 / -1;
    width: 100%;
    max-width: 480px;
    margin: 40px auto;
  }

  .empty-icon {
    font-size: 3rem;
  }
  .empty-hint {
    font-size: 0.82rem;
    color: var(--color-text-muted);
  }


  /* Split View Layout */
  .history-split-pane {
    display: flex;
    gap: 20px;
    width: 100%;
    align-items: flex-start;
  }

  .history-list {
    flex: 1;
    min-width: 0;
  }

  .history-detail-sidebar {
    width: 380px;
    position: sticky;
    top: calc(var(--header-height) + 16px);
    max-height: calc(100vh - var(--header-height) - 180px);
    overflow-y: auto;
    padding: 24px;
    display: none;
    border: 1px solid var(--color-border-glass);
    border-radius: 16px;
    background-color: var(--color-surface-glass);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    box-sizing: border-box;
  }

  @media (min-width: 1024px) {
    .history-wrapper {
      max-width: 1400px;
    }

    .history-list {
      flex: 0 0 460px;
    }

    .history-detail-sidebar {
      display: block;
      width: auto;
      flex: 1;
    }

    .history-detail-sidebar .category-bars-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .match-card .match-expanded-details {
      display: none !important;
    }

    .match-card .card-footer {
      display: none !important;
    }

    .match-card {
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    }

    .match-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .match-card.selected-card {
      border-color: var(--accent-color) !important;
      box-shadow: 0 0 14px var(--accent-color);
      background: rgba(255, 255, 255, 0.05) !important;
    }
  }


  @media (max-width: 600px) {
    .action-bar {
      padding: 10px 14px;
    }

    .scoresheet-title {
      font-size: 1rem;
    }

    .btn-back {
      padding: 6px 12px;
      font-size: 0.78rem;
    }

  }

  @media (max-width: 480px) {
    .card-body {
      padding: 10px 12px 8px;
    }

    .match-game {
      font-size: 0.9rem;
    }

    .card-thumb {
      width: 68px;
    }

  }

  @media (max-width: 360px) {
    .btn-back {
      padding: 5px 10px;
      font-size: 0.72rem;
      gap: 4px;
    }

    .filter-pill {
      padding: 5px 10px;
      font-size: 0.72rem;
    }

    .card-thumb {
      width: 60px;
    }
  }

  /* U12: Category Comparison Chart Styles */
  .category-comparison-chart-container {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px dashed var(--color-border-glass);
  }
  .category-bars-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    margin-top: 12px;
  }
  .cat-bar-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.03);
    padding: 10px 12px;
    border-radius: 12px;
  }
  .cat-bar-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cat-bar-label {
    font-family: var(--font-heading);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--color-text-secondary);
  }
  .cat-players-bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .player-bar-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .player-bar-name {
    width: 80px;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  .player-bar-track {
    flex: 1;
    height: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    overflow: hidden;
  }
  .player-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s ease-out;
  }
  .player-bar-value {
    width: 24px;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text-primary);
    text-align: right;
  }
  .offline-sync-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 14px;
    margin-bottom: 12px;
    border: 1px solid rgba(99, 102, 241, 0.25);
    background: rgba(99, 102, 241, 0.07);
    flex-wrap: wrap;
  }
  .sync-banner-content {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }
  .sync-banner-icon {
    font-size: 1.3rem;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .sync-banner-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .sync-banner-text strong {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }
  .sync-banner-text span {
    font-size: 0.78rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }
  .sync-now-btn {
    flex-shrink: 0;
    white-space: nowrap;
  }

  /* Kleine Displays: Header kompakter */
  @media (max-width: 480px) {
    .action-bar {
      padding: 10px 12px 8px;
      grid-template-columns: auto 1fr;
      gap: 10px;
    }
    .scoresheet-title {
      grid-column: 2;
      text-align: left;
      font-size: 0.95rem;
    }
    .action-right {
      display: none;
    }
  }

  @media (max-width: 360px) {
    .action-bar {
      padding: 8px 10px 6px;
      gap: 8px;
    }
    .scoresheet-title {
      font-size: 0.88rem;
    }
  }

  /* Galaxy Z Fold 6 / extrem schmale Displays < 320 px */
  @media (max-width: 320px) {
    .btn-back span {
      display: none;
    }
    .btn-back {
      padding: 6px 8px;
    }
    .card-thumb {
      width: 52px;
    }
  }

  .host-badge {
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.4);
    color: #818cf8;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    margin-left: auto;
  }

  .guest-badge {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #34d399;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    margin-left: auto;
  }

  @media (max-width: 1023px) {
    .history-wrapper {
      height: auto;
      overflow-y: visible;
      overscroll-behavior: auto;
    }
  }
</style>
