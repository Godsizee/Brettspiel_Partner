<script>
  import { activeScreen, currentGame, currentSessionDuration, prefilledPlayerNames, playerColors, gamesCatalog, showToast, pocketbaseHost, isOnline, openWiki, navigateTo, activeSession, settings, authService, currentUser, confirmDialog } from '$lib/stores/app.js';
  import { get } from 'svelte/store';
  import { db, pullFromRemote } from '$lib/services/DbService.js';
  import { onDestroy } from 'svelte';
  import { HapticService } from '$lib/services/HapticService.js';
  import { checkAchievements } from '$lib/services/AchievementService.js';

  /** @type {HTMLElement|null} */
  let scoresheetContainer = null;
  /** @type {any} */
  let scoresheetInstance = null;



  let template = $derived($currentGame ? $gamesCatalog[$currentGame] : null);
  let gameName = $derived(template?.name ?? 'Wertungszettel');
  
  // SECURITY: Prevent double-click/double-save
  let saveState = $state('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  let isSaving = $derived(saveState === 'saving');
  let confettiInProgress = $state(false);
  let postSaveMessage = $state('Ergebnis gespeichert!');

  let activeDraftId = $state(null);
  let autosaveTimeout = null;
  // Verhindert, dass ein noch ausstehender Autosave den Draft NACH dem
  // erfolgreichen Speichern neu anlegt ("Wertung fortsetzen" trotz beendeter Partie).
  let matchSaved = false;

  $effect(() => {
    if ($activeScreen === 'score-sheet' && scoresheetContainer) {
      activeDraftId = `draft_${$currentGame}`;
      loadScoreSheet();
    }
  });

  onDestroy(() => {
    // Web Component and state cleanup
    if (scoresheetContainer) {
      scoresheetContainer.innerHTML = '';
      scoresheetContainer.removeEventListener('wiki-open', _handleWikiOpen);
      scoresheetContainer.removeEventListener('score-sheet-changed', scheduleAutosave);
    }
    scoresheetInstance = null;
    saveState = 'idle';
    confettiInProgress = false;
    clearTimeout(autosaveTimeout);
  });

  function _handleWikiOpen(e) {
    // Die frühere categoryId aus dem Event stammte aus dem alten Kategorien-
    // System und wurde nie konsumiert — Landing des Spiels ist das Ziel.
    // W5.4: Wenn im Event-Detail ein Modul/Eintrag angegeben ist, tief verlinken.
    const detail = e?.detail || {};
    const moduleId = detail.moduleId || detail.categoryId || null;
    const entryId = detail.entryId || null;
    openWiki($currentGame, moduleId, entryId);
  }

  async function loadScoreSheet() {
    if (!scoresheetContainer || !template) return;
    // Neue/fortgesetzte Wertung: Autosave wieder zulassen
    matchSaved = false;
    scoresheetContainer.innerHTML = '';

    // GenericScoreSheet laden (Web Component aus lib/services)
    const { GenericScoreSheet } = await import('$lib/services/GenericScoreSheet.js');
    const sheet = new GenericScoreSheet();
    sheet.loadTemplate(template);
    scoresheetContainer.appendChild(sheet);
    scoresheetInstance = sheet;

    // Wiki-Event aus Shadow DOM abfangen (composed:true überquert Shadow Boundary)
    scoresheetContainer.addEventListener('wiki-open', _handleWikiOpen);
    scoresheetContainer.addEventListener('score-sheet-changed', scheduleAutosave);

    // Draft prüfen und ggf. laden (wenn Spieler-Scores aus Draft vorliegen)
    const drafts = (await db.get('bg_drafts')) ?? [];
    const draft = drafts.find(d => d.id === activeDraftId);
    
    // Spielernamen/Punkte setzen (Draft bevorzugt)
    if (draft && typeof sheet.restoreDraft === 'function') {
      sheet.restoreDraft(draft.player_scores);
      showToast('Entwurf wiederhergestellt', 'info');
    } else {
      const names = get(prefilledPlayerNames);
      if (names && typeof sheet.setPlayers === 'function') {
        sheet.setPlayers(names);
      }
    }

    // Spieler-Farben setzen
    const colors = get(playerColors);
    if (colors && typeof sheet.setPlayerColors === 'function') {
      sheet.setPlayerColors(colors);
    }
  }

  function scheduleAutosave() {
    if (matchSaved) return;
    if (autosaveTimeout) clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(performAutosave, 500);
  }

  async function performAutosave() {
    // Partie bereits abgeschlossen → keinen neuen Draft mehr anlegen
    if (matchSaved) return;
    if (!scoresheetInstance || !activeDraftId) return;
    try {
      const playerScores = scoresheetInstance.getScorePayload();
      const game = $currentGame;
      const draft = {
        id: activeDraftId,
        game_name: (game && $gamesCatalog[game]?.name) || game || 'Unbekannt',
        game_key: game,
        duration: $currentSessionDuration,
        date: new Date().toISOString(),
        player_scores: playerScores,
        status: 'draft'
      };
      const drafts = (await db.get('bg_drafts')) ?? [];
      const index = drafts.findIndex(d => d.id === activeDraftId);
      if (index >= 0) drafts[index] = draft;
      else drafts.push(draft);
      await db.set('bg_drafts', drafts);
    } catch (err) {
      console.warn('Autosave failed', err);
    }
  }

  async function abortScoring() {
    navigateTo('game-selection');
    currentGame.set(null);
    currentSessionDuration.set(0);
    prefilledPlayerNames.set(null);
  }

  async function deleteDraft(draftId) {
    if (!draftId) return;
    try {
      const drafts = (await db.get('bg_drafts')) ?? [];
      const newDrafts = drafts.filter(d => d.id !== draftId);
      await db.set('bg_drafts', newDrafts);
    } catch(e) {}
  }

  let showFotoFinish = $state(false);
  let matchResultsForPodium = $state([]);
  let activePedestal = $state(false);
  let isSharing = $state(false);

  let isDraw = $derived(
    matchResultsForPodium.length > 1 &&
    matchResultsForPodium[0]?.total_score === matchResultsForPodium[1]?.total_score
  );

  $effect(() => {
    if (showFotoFinish) {
      setTimeout(() => { activePedestal = true; }, 100);
    } else {
      activePedestal = false;
    }
  });

  async function loadHtml2Canvas() {
    if (window.html2canvas) return window.html2canvas;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = () => resolve(window.html2canvas);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function saveMatch() {
    // SECURITY: Prevent double-click/double-save
    if (saveState !== 'idle') return;
    
    if (!scoresheetInstance) {
      showToast('Konnte Wertungszettel nicht auslesen.', 'error');
      return;
    }

    HapticService.mediumImpact();
    saveState = 'saving';
    // Ausstehenden Autosave abbrechen, damit er den Draft nicht nach dem
    // Speichern neu anlegt. matchSaved blockt zusätzlich spätere Trigger.
    matchSaved = true;
    if (autosaveTimeout) { clearTimeout(autosaveTimeout); autosaveTimeout = null; }
    try {
      const playerScores = scoresheetInstance.getScorePayload();
      try {
        const linkedUsers = JSON.parse(localStorage.getItem('bg_linked_users') || '{}');
        playerScores.forEach((p, i) => {
          if (linkedUsers[i]) p.user_id = linkedUsers[i];
        });
      } catch(e) {}
      
      const names = playerScores.map(p => p.player_name);
      localStorage.setItem('bg_last_players', JSON.stringify(names));
      
      const game = $currentGame;
      const catalog = $gamesCatalog;

      const matchRecord = {
        game_name: (game && catalog[game]?.name) || game || 'Unbekannt',
        duration: $currentSessionDuration,
        date: new Date().toISOString(),
        player_scores: playerScores,
      };

      const { getMatchRepository } = await import('$lib/services/MatchRepository.js');
      const savedMatch = await getMatchRepository().saveCompletedMatch(matchRecord);
      
      // Cleanup draft after successful save
      await deleteDraft(activeDraftId);

      const status = savedMatch.sync_status;
      if (status === 'local_only') postSaveMessage = 'Partie lokal gespeichert. 💾';
      else if (status === 'pending') postSaveMessage = 'Partie gespeichert. Cloud-Sicherung folgt automatisch. ⏳';
      else if (status === 'synced') postSaveMessage = 'Partie gespeichert und gesichert. ☁️';
      else postSaveMessage = 'Partie ist lokal sicher. Cloud-Sicherung konnte noch nicht abgeschlossen werden. ⚠️';

      // F10: Achievement-Check
      try {
        const user = $currentUser;
        if (user?.id) {
          const allMatches = await pullFromRemote(user.id);
          const winner = playerScores.slice().sort((/** @type {any} */ a, /** @type {any} */ b) => (b.total_score ?? 0) - (a.total_score ?? 0))[0];
          await checkAchievements(allMatches, winner?.player_name ?? '');
        }
      } catch (_) {}

      if ($settings.gameSessionMode) {
        activeSession.update(s => {
          const session = s || { id: 'session_' + Date.now(), date: new Date().toISOString(), matches: [] };
          return {
            ...session,
            matches: [...session.matches, { ...matchRecord, gameKey: game }]
          };
        });
      }

      // Show saved state and wait a bit
      saveState = 'saved';
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Trigger Confetti & Haptic Feedback
      triggerConfetti();
      HapticService.success();

      // Setup and activate Foto-Finish view
      matchResultsForPodium = playerScores.slice().sort((a, b) => b.total_score - a.total_score);
      showFotoFinish = true;
      saveState = 'idle';
    } catch (error) {
      console.error('Error saving match:', error);
      // Speichern fehlgeschlagen → Autosave wieder zulassen, damit der
      // Entwurf nicht verloren geht.
      matchSaved = false;
      saveState = 'error';
      showToast('Fehler beim lokalen Speichern.', 'error');
      await new Promise(resolve => setTimeout(resolve, 1500));
      saveState = 'idle';
    }
  }

  function finishMatchAndQuit() {
    showFotoFinish = false;
    navigateTo('game-selection');
    currentGame.set(null);
    currentSessionDuration.set(0);
    prefilledPlayerNames.set(null);
    showToast(postSaveMessage, 'success');
  }

  function rematchMatch() {
    showFotoFinish = false;
    currentSessionDuration.set(0);

    const currentNames = get(prefilledPlayerNames);
    if (currentNames && currentNames.length > 1) {
       const rotated = [...currentNames];
       const first = rotated.shift();
       rotated.push(first);
       prefilledPlayerNames.set(rotated);
       
       const currentColors = get(playerColors);
       if (currentColors && currentColors.length > 1) {
           const rotatedColors = [...currentColors];
           const firstColor = rotatedColors.shift();
           rotatedColors.push(firstColor);
           playerColors.set(rotatedColors);
       }
    }

    navigateTo('game-timer');
    showToast('Rematch gestartet! 🎲 Startspieler wurde rotiert.', 'success');
  }

  async function shareResults() {
    if (isSharing) return;
    isSharing = true;
    
    try {
      const resultsCard = document.getElementById('results-card-to-capture');
      if (!resultsCard) throw new Error('Card element not found');

      // Load html2canvas dynamically from CDN
      const h2c = await loadHtml2Canvas();
      
      // Render canvas
      const canvas = await h2c(resultsCard, {
        backgroundColor: '#0c0f19', // Match app background
        scale: 2, // Double resolution for crisp text
        useCORS: true
      });

      // Convert canvas to Blob
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Blob creation failed');

      // Try Web Share API with File
      const file = new File([blob], `brettspiel_ergebnis_${Date.now()}.png`, { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Brettspiel-Partner Ergebnis: ${gameName}`,
          text: `Schau dir unser Foto-Finish in ${gameName} an! 🏆`
        });
        showToast('Ergebnis geteilt! 📤', 'success');
      } else if (navigator.share) {
        // Fallback for browsers supporting Web Share but not files
        await navigator.share({
          title: `Brettspiel-Partner Ergebnis: ${gameName}`,
          text: getTextSummary()
        });
        showToast('Ergebnis geteilt! 📤', 'success');
      } else {
        // Desktop or unsupported browser fallback: copy text summary + trigger PNG download!
        navigator.clipboard.writeText(getTextSummary());
        
        // Trigger download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ergebnis_${gameName.toLowerCase().replace(/\s+/g, '_')}.png`;
        link.click();
        URL.revokeObjectURL(url);
        
        showToast('Bild heruntergeladen & Text-Zusammenfassung in Zwischenablage kopiert! 💾', 'success');
      }
    } catch (err) {
      console.error('Sharing failed:', err);
      // Absolute fallback to clipboard copy
      try {
        await navigator.clipboard.writeText(getTextSummary());
        showToast('Zusammenfassung in Zwischenablage kopiert! 📋', 'success');
      } catch (_) {
        showToast('Teilen fehlgeschlagen.', 'error');
      }
    } finally {
      isSharing = false;
    }
  }

  function getTextSummary() {
    const topScore = matchResultsForPodium[0]?.total_score;
    const listText = matchResultsForPodium.map((r, i) => {
      const tied = isDraw && r.total_score === topScore;
      let medal = '';
      if (tied) medal = ' 🤝';
      else if (i === 0) medal = ' 👑';
      else if (i === 1) medal = ' 🥈';
      else if (i === 2) medal = ' 🥉';
      return `${tied ? '=' : i + 1}. ${r.player_name}: ${r.total_score} SP${medal}`;
    }).join('\n');

    const header = isDraw ? '🤝 Unentschieden in' : '🏆 Foto-Finish in';
    return `${header} ${gameName}!\n\n${listText}\n\nGespeichert mit Brettspiel-Partner 🎲`;
  }

  function triggerConfetti() {
    if (confettiInProgress) return;
    confettiInProgress = true;

    const colors = ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e'];
    for (let i = 0; i < 80; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
          position:fixed;
          width:${6 + Math.random()*6}px;
          height:${6 + Math.random()*6}px;
          background:${colors[Math.floor(Math.random()*colors.length)]};
          left:${Math.random()*100}vw;
          top:-10px;
          border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
          z-index:9999;
          pointer-events:none;
          animation:confettiFall ${1.2 + Math.random()*1.5}s ease-in forwards;
          transform:rotate(${Math.random()*360}deg);
        `;
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 2800);
      }, i * 30);
    }

    setTimeout(() => {
      confettiInProgress = false;
    }, 3000);
  }
</script>

<svelte:head>
  <style>
    @keyframes confettiFall {
      to { transform: translateY(105vh) rotate(720deg); opacity: 0; }
    }
  </style>
</svelte:head>

<div class="scoresheet-wrapper">
  <h1 class="sr-only">Wertungszettel</h1>
  <!-- Action Bar -->
  <div class="action-bar glass-panel">
    <button class="btn-back" id="btn-abort-scoring" onclick={abortScoring}>
      <svg class="icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
      Abbrechen
    </button>

    <h2 class="scoresheet-title" id="scoresheet-game-title">{gameName}</h2>

    <button 
      class="btn btn-primary" 
      id="btn-save-match" 
      onclick={saveMatch}
      disabled={saveState !== 'idle'}
      class:btn-saving={saveState === 'saving'}
      class:btn-saved={saveState === 'saved'}
      class:btn-error={saveState === 'error'}
    >
      {#if saveState === 'saving'}
        <span class="btn-spinner"></span>
        Speichern...
      {:else if saveState === 'saved'}
        ✓ Gespeichert!
      {:else if saveState === 'error'}
        ✕ Fehler
      {:else}
        Speichern
        <svg class="icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:6px">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
      {/if}
    </button>
  </div>

  <!-- ScoreSheet Container (Web Component Injection) -->
  {#if $currentGame === 'next_station_london'}
    <div class="london-info-card glass-panel mb-6 p-5 md:p-6 text-sm md:text-base text-[var(--color-text-secondary)] rounded-2xl border border-[var(--color-border-glass)] bg-white/[0.02] flex flex-col gap-3">
      <div class="flex items-center gap-2 font-heading font-extrabold text-[var(--color-secondary)] uppercase tracking-wider text-xs md:text-sm">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>Wertungshilfe: Next Station: London</span>
      </div>
      <div class="flex flex-col gap-2.5">
        <p class="m-0 leading-relaxed md:leading-loose">
          <strong>Rundenwertung:</strong> Trage die Anzahl der befahrenen <strong>Stadtbezirke</strong> ein. Ermittle dann den Stadtbezirk, in dem deine U-Bahn-Linie die <strong>meisten Stationen</strong> anfährt. Schreib die Anzahl dieser Stationen in das entsprechende Feld. Trage zuletzt ein, wie oft du diese Runde die <strong>Themse überquert</strong> hast. Die Berechnung geschieht automatisch.
        </p>
        <p class="m-0 leading-relaxed md:leading-loose border-t border-white/5 pt-2.5">
          <strong>Endwertung (Umsteigemöglichkeiten):</strong> Tragt nur die Anzahl der entsprechenden Umsteigemöglichkeiten auf eurem Plan ein. Die Punkte werden automatisch berechnet.
        </p>
      </div>
    </div>
  {/if}
  <div id="scoresheet-container" class="scoresheet-container" bind:this={scoresheetContainer}></div>
</div>

<!-- Foto-Finish Post-Match Celebratory Overlay -->
{#if showFotoFinish}
  <div class="foto-finish-backdrop fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="foto-finish-card glass-panel animate-scale-up flex flex-col gap-4 w-full max-w-[420px] max-h-[90vh] overflow-y-auto p-5 rounded-3xl">
      
      <!-- The Card to Capture -->
      <div class="results-capture-card flex flex-col gap-3 p-5 rounded-2xl bg-black/20 border border-white/10" id="results-card-to-capture">
        <div class="capture-header flex flex-col items-center text-center pb-3 border-b border-white/10 mb-1">
          <span class="capture-subtitle text-[0.7rem] font-bold tracking-widest" class:draw-subtitle={isDraw} style={isDraw ? 'color:#14b8a6' : 'color:#f59e0b'}>{isDraw ? '🤝 UNENTSCHIEDEN' : 'FOTO-FINISH'}</span>
          <h3 class="capture-game-title font-heading text-[1.4rem] font-extrabold text-white leading-tight mt-1 mb-0.5">{gameName}</h3>
          <span class="capture-date text-[0.75rem] text-[var(--color-text-muted)]">{new Date().toLocaleDateString('de-DE')}</span>
        </div>

        <!-- 3D Animated Pedestal Podium -->
        <div class="podium-container" class:active-pedestal={activePedestal}>
          <!-- 2nd Place (Silver) — hidden when draw (both players share step-1) -->
          {#if matchResultsForPodium[1] && !isDraw}
            <div class="podium-col silver-col">
              <div class="podium-avatar silver-avatar">
                {matchResultsForPodium[1].player_name.slice(0, 2).toUpperCase()}
              </div>
              <span class="podium-name">{matchResultsForPodium[1].player_name}</span>
              <span class="podium-score">{matchResultsForPodium[1].total_score} SP</span>
              <div class="podium-step step-2">🥈</div>
            </div>
          {/if}

          <!-- 1st Place (Gold) / Draw -->
          {#if matchResultsForPodium[0]}
            <div class="podium-col" class:gold-col={!isDraw} class:draw-col={isDraw}>
              <div class="podium-avatar" class:gold-avatar={!isDraw} class:draw-avatar={isDraw}>
                <span class="crown-icon">{isDraw ? '🤝' : '👑'}</span>
                {isDraw
                  ? matchResultsForPodium.filter(p => p.total_score === matchResultsForPodium[0].total_score).map(p => p.player_name.slice(0, 2).toUpperCase()).join(' · ')
                  : matchResultsForPodium[0].player_name.slice(0, 2).toUpperCase()}
              </div>
              {#if isDraw}
                <span class="podium-name">{matchResultsForPodium.filter(p => p.total_score === matchResultsForPodium[0].total_score).map(p => p.player_name).join(' & ')}</span>
              {:else}
                <span class="podium-name">{matchResultsForPodium[0].player_name}</span>
              {/if}
              <span class="podium-score">{matchResultsForPodium[0].total_score} SP</span>
              <div class="podium-step step-1">{isDraw ? '🤝' : '🥇'}</div>
            </div>
          {/if}

          <!-- 3rd Place (Bronze) — only shown when no draw -->
          {#if matchResultsForPodium[2] && !isDraw}
            <div class="podium-col bronze-col">
              <div class="podium-avatar bronze-avatar">
                {matchResultsForPodium[2].player_name.slice(0, 2).toUpperCase()}
              </div>
              <span class="podium-name">{matchResultsForPodium[2].player_name}</span>
              <span class="podium-score">{matchResultsForPodium[2].total_score} SP</span>
              <div class="podium-step step-3">🥉</div>
            </div>
          {/if}
        </div>

        <!-- Detailed Standings List -->
        <div class="capture-standings-list">
          {#each matchResultsForPodium as player, index}
            {@const isTied = player.total_score === matchResultsForPodium[0]?.total_score}
            <div class="capture-standing-item" class:is-winner={index === 0 && !isDraw} class:is-draw={isDraw && isTied}>
              <span class="standing-rank-badge">{isDraw && isTied ? '🤝' : index + 1}</span>
              <span class="standing-player-name">{player.player_name}</span>
              <span class="standing-player-score">{player.total_score} SP</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="foto-finish-actions flex flex-col gap-2.5">
        <button class="btn btn-secondary btn-share-results" onclick={shareResults} disabled={isSharing}>
          {#if isSharing}
            Generiere...
          {:else}
            <svg class="icon-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            Teilen / Bild sichern
          {/if}
        </button>

        <button class="btn btn-secondary btn-rematch" onclick={rematchMatch}>
          <svg class="icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Nochmal spielen!
        </button>

        {#if $settings.gameSessionMode}
          <button class="btn btn-secondary" onclick={() => { showFotoFinish = false; navigateTo('game-selection'); setTimeout(() => { const btn = document.querySelector('.banner-actions button'); if (btn) btn.click(); }, 200); }}>
            🏆 Spielabend-Stand
          </button>
        {/if}

        <button class="btn btn-primary btn-close-finish" onclick={finishMatchAndQuit}>
          Spiel beenden
          <svg class="icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>

    </div>
  </div>
{/if}



<style>


  .scoresheet-wrapper {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 32px;
  }

  .action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    gap: 12px;
    flex-shrink: 0;
  }

  .btn-back {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-heading);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--color-border-glass);
    padding: 8px 14px;
    border-radius: 10px;
    transition: var(--transition-fast);
    white-space: nowrap;
  }

  .btn-back:hover {
    color: var(--color-text-primary);
    background: rgba(255,255,255,0.09);
  }

  .scoresheet-title {
    font-family: var(--font-heading);
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text-primary);
    text-align: center;
    flex: 1;
  }

  .action-bar .btn {
    flex: unset;
    padding: 8px 16px;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .scoresheet-container {
    width: 100%;
  }

  .scoresheet-container :global(generic-score-sheet),
  .scoresheet-container :global(base-score-sheet) {
    display: block;
    width: 100%;
  }

  @media (max-width: 479px) {
    .london-info-card {
      padding: 16px !important;
    }
  }

  @media (max-width: 360px) {
    .action-bar {
      padding: 8px 10px !important;
      gap: 6px !important;
      border-radius: 12px !important;
    }
    .btn-back {
      padding: 6px 10px !important;
      font-size: 0.78rem !important;
      gap: 4px !important;
    }
    .scoresheet-title {
      font-size: 0.88rem !important;
    }
    .action-bar .btn {
      padding: 6px 12px !important;
      font-size: 0.78rem !important;
    }
    .london-info-card {
      padding: 12px !important;
      font-size: 0.82rem !important;
    }
  }

  /* ==========================================================================
     FOTO-FINISH POST-MATCH OVERLAY STYLES
     ========================================================================== */
  .foto-finish-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(11, 15, 25, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 16px;
    box-sizing: border-box;
  }

  .foto-finish-card {
    width: 100%;
    max-width: 440px;
    padding: 24px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 20px;
    border-radius: var(--radius-lg);
  }

  .animate-scale-up {
    animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }



  /* 3D animated podium container */
  .podium-container {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 14px;
    height: 190px;
    margin: 10px 0;
    box-sizing: border-box;
  }

  .podium-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    max-width: 90px;
  }

  .podium-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 0.85rem;
    color: #ffffff;
    margin-bottom: 6px;
    position: relative;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
  }

  .crown-icon {
    position: absolute;
    top: -14px;
    font-size: 1.15rem;
    animation: crownBob 1.5s infinite alternate ease-in-out;
  }

  .gold-avatar {
    background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
    border: 2px solid #ffbe0b;
  }

  .draw-col {
    z-index: 2;
  }

  .draw-avatar {
    background: linear-gradient(135deg, #14b8a6 0%, #0891b2 100%);
    border: 2px solid #2dd4bf;
    font-size: 0.6rem;
    letter-spacing: 0.05em;
  }

  .active-pedestal .draw-col .step-1 {
    background: linear-gradient(180deg, #0d9488 0%, rgba(13, 148, 136, 0.15) 100%);
    border-color: #14b8a6;
  }

  .silver-avatar {
    background: linear-gradient(135deg, #e2e8f0 0%, #64748b 100%);
    border: 2px solid #cbd5e1;
  }

  .bronze-avatar {
    background: linear-gradient(135deg, #cd7f32 0%, #8b4513 100%);
    border: 2px solid #b45309;
  }

  .podium-name {
    font-size: 0.75rem;
    font-weight: 700;
    color: #ffffff;
    text-align: center;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 1px;
  }

  .podium-score {
    font-size: 0.7rem;
    font-weight: 800;
    color: var(--color-secondary);
    margin-bottom: 6px;
  }

  .podium-step {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.85);
    border-radius: 8px 8px 0 0;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    transition: height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    height: 0px;
  }

  .active-pedestal .step-1 {
    height: 90px;
    background: linear-gradient(180deg, #ff8c00 0%, rgba(255, 140, 0, 0.15) 100%);
    border: 1px solid #ffd700;
    border-bottom: none;
  }

  .active-pedestal .step-2 {
    height: 65px;
    background: linear-gradient(180deg, #64748b 0%, rgba(100, 116, 139, 0.15) 100%);
    border: 1px solid #cbd5e1;
    border-bottom: none;
  }

  .active-pedestal .step-3 {
    height: 45px;
    background: linear-gradient(180deg, #8b4513 0%, rgba(139, 69, 19, 0.15) 100%);
    border: 1px solid #cd7f32;
    border-bottom: none;
  }

  .capture-standings-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 12px;
  }

  .capture-standing-item {
    display: flex;
    align-items: center;
    gap: 12px;
    background-color: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 8px 12px;
    border-radius: 10px;
  }

  .capture-standing-item.is-winner {
    background-color: rgba(251, 191, 36, 0.06);
    border-color: rgba(251, 191, 36, 0.15);
  }

  .capture-standing-item.is-draw {
    background-color: rgba(20, 184, 166, 0.06);
    border-color: rgba(20, 184, 166, 0.2);
  }

  .standing-rank-badge {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 0.85rem;
    color: var(--color-text-muted);
    width: 16px;
  }

  .capture-standing-item.is-winner .standing-rank-badge {
    color: #ffbe0b;
  }

  .capture-standing-item.is-draw .standing-rank-badge {
    font-size: 0.95rem;
    width: 20px;
  }

  .standing-player-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: #e2e8f0;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .capture-standing-item.is-winner .standing-player-name {
    color: #ffffff;
    font-weight: 700;
  }

  .capture-standing-item.is-draw .standing-player-name {
    color: #ffffff;
    font-weight: 700;
  }

  .standing-player-score {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 0.95rem;
    color: var(--color-secondary);
  }

  .btn-share-results {
    background-color: var(--color-surface-glass);
    border-color: var(--color-border-glass);
    color: var(--color-text-primary);
  }

  .btn-share-results:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }

  @keyframes crownBob {
    from { transform: translateY(0); }
    to { transform: translateY(-4px); }
  }

  @media (max-width: 380px) {
    .foto-finish-card {
      padding: 14px;
    }
    .results-capture-card {
      padding: 14px;
    }
    .podium-container {
      height: 160px;
    }
    .active-pedestal .step-1 { height: 75px; }
    .active-pedestal .step-2 { height: 50px; }
    .active-pedestal .step-3 { height: 35px; }
  }
</style>
