<script>
  // @ts-check
  import { untrack, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import X from '@lucide/svelte/icons/x';
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Info from '@lucide/svelte/icons/info';
  import Check from '@lucide/svelte/icons/check';
  import {
    currentGame, currentSessionDuration, prefilledPlayerNames, playerColors, gamesCatalog, showToast, activeSession,
    settings, currentUser,
  } from '$lib/stores/app.js';
  import { navigate } from '$lib/router/router.js';
  import { appHash } from '$lib/router/appRoutes.js';
  import { toSlug } from '$lib/components/wiki/utils/wikiKeys.js';
  import { db, pullFromRemote } from '$lib/services/DbService.js';
  import { HapticService } from '$lib/services/HapticService.js';
  import { checkAchievements } from '$lib/services/AchievementService.js';
  import { shareMatchAsImage } from '$lib/services/MatchShareService.js';
  import { validateGameImageUrl } from '$lib/utils/urlValidator.js';
  import { ScoreSheetState } from '$lib/scoring/scoreSheetState.svelte.js';
  import { rankOf } from '$lib/scoring/engine.js';
  import { groupCategories } from '$lib/scoring/sections.js';
  import { safeCssColor } from '$lib/ui/color.js';
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Button from '$lib/ui/Button.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import Switch from '$lib/ui/Switch.svelte';
  import Sheet from '$lib/ui/Sheet.svelte';
  import PlayerDot from '$lib/ui/PlayerDot.svelte';
  import ScoreRow from './ScoreRow.svelte';
  import PlayerSwitcher from './PlayerSwitcher.svelte';
  import ResultSheet from './ResultSheet.svelte';
  import { triggerConfetti } from './confetti.js';

  let template = $derived($currentGame ? $gamesCatalog[$currentGame] : null);
  let gameName = $derived(template?.name ?? 'Wertungszettel');

  /** @type {ScoreSheetState | null} */
  let sheet = $state(null);
  let draftRestored = $state(false);

  // SECURITY: Prevent double-click/double-save
  let saveState = $state('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  let postSaveMessage = $state('Ergebnis gespeichert!');
  let postSaveTone = $state(/** @type {'success'|'accent'|'warning'} */ ('success'));

  let activeDraftId = $derived(`draft_${$currentGame}`);
  /** @type {ReturnType<typeof setTimeout> | null} */
  let autosaveTimeout = null;
  // Verhindert, dass ein noch ausstehender Autosave den Draft NACH dem
  // erfolgreichen Speichern neu anlegt ("Wertung fortsetzen" trotz beendeter Partie).
  let matchSaved = false;
  let baseline = '';
  let initFor = '';

  // ─── Initialisierung (Entwurf bevorzugt, sonst Namen aus dem Spieler-Setup) ─────────────
  $effect(() => {
    const key = $currentGame;
    if (template && key && initFor !== key) {
      initFor = key;
      untrack(() => init(key));
    }
  });

  /** @param {string} key */
  async function init(key) {
    matchSaved = false;
    const drafts = (await db.get('bg_drafts')) ?? [];
    const draft = drafts.find((/** @type {any} */ d) => d.id === `draft_${key}`);
    const colors = get(playerColors) ?? [];
    let next;
    if (draft?.player_scores?.length) {
      next = ScoreSheetState.fromPayload(template, draft.player_scores, colors);
      // Erweiterungswerte im Entwurf → Erweiterung wieder einschalten, sonst bleiben sie unsichtbar
      const extras = (template.expansion?.extraCategories ?? []).map((/** @type {any} */ c) => c.id);
      if (next.players.some((p) => extras.some((id) => (p.scores[id] ?? 0) !== 0))) next.expansionActive = true;
      draftRestored = true;
    } else {
      next = new ScoreSheetState(template, get(prefilledPlayerNames) ?? [], colors);
    }
    baseline = JSON.stringify($state.snapshot(next.players));
    sheet = next;
  }

  onDestroy(() => {
    if (autosaveTimeout) clearTimeout(autosaveTimeout);
  });

  // ─── Autosave (nur bei echter Änderung gegenüber dem Ausgangszustand) ───────────────────
  $effect(() => {
    if (!sheet) return;
    const json = JSON.stringify($state.snapshot(sheet.players));
    if (json === baseline) return;
    untrack(scheduleAutosave);
  });

  function scheduleAutosave() {
    if (matchSaved) return;
    if (autosaveTimeout) clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(performAutosave, 500);
  }

  async function performAutosave() {
    // Partie bereits abgeschlossen → keinen neuen Draft mehr anlegen
    if (matchSaved || !sheet || !$currentGame) return;
    try {
      const game = $currentGame;
      const draft = {
        id: activeDraftId,
        game_name: (game && $gamesCatalog[game]?.name) || game || 'Unbekannt',
        game_key: game,
        duration: $currentSessionDuration,
        date: new Date().toISOString(),
        player_scores: sheet.toPayload(),
        status: 'draft',
      };
      const drafts = (await db.get('bg_drafts')) ?? [];
      const index = drafts.findIndex((/** @type {any} */ d) => d.id === activeDraftId);
      if (index >= 0) drafts[index] = draft;
      else drafts.push(draft);
      await db.set('bg_drafts', drafts);
    } catch (err) {
      console.warn('Autosave failed', err);
    }
  }

  /** @param {string} draftId */
  async function deleteDraft(draftId) {
    if (!draftId) return;
    try {
      const drafts = (await db.get('bg_drafts')) ?? [];
      await db.set('bg_drafts', drafts.filter((/** @type {any} */ d) => d.id !== draftId));
    } catch (e) {}
  }

  // ─── Eingabe ────────────────────────────────────────────────────────────────────────────
  /** @param {string} catId @param {string} label @param {number} value @param {number} before */
  function commit(catId, label, value, before) {
    if (value > 400 || value < -50) showToast(`Ungewöhnliche Punktzahl (${value}) bei ${label}. Absicht?`, 'warning', 4000);
    sheet?.commitScore(catId, value, before);
  }

  let expandedCat = $state(/** @type {string|null} */ (null));
  let helpCat = $state(/** @type {any} */ (null));
  let helpOpen = $state(false);
  let modalOpen = $state(false);

  let sections = $derived(groupCategories(template));
  let whiteIcon = $derived(template?.theme?.icon_style === 'white-circle');

  // ─── Speichern ──────────────────────────────────────────────────────────────────────────
  let resultOpen = $state(false);
  /** @type {any[]} */
  let resultRows = $state([]);
  /** @type {any} */
  let matchRecord = $state(null);
  let isSharing = $state(false);
  let leaving = false;

  async function saveMatch() {
    if (saveState !== 'idle') return;
    if (!sheet) {
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
      const playerScores = sheet.toPayload();
      try {
        const linkedUsers = JSON.parse(localStorage.getItem('bg_linked_users') || '{}');
        playerScores.forEach((/** @type {any} */ p, /** @type {number} */ i) => {
          if (linkedUsers[i]) p.user_id = linkedUsers[i];
        });
      } catch (e) {}

      const names = playerScores.map((/** @type {any} */ p) => p.player_name);
      localStorage.setItem('bg_last_players', JSON.stringify(names));

      const game = $currentGame;
      const catalog = $gamesCatalog;

      const record = {
        game_name: (game && catalog[game]?.name) || game || 'Unbekannt',
        duration: $currentSessionDuration,
        date: new Date().toISOString(),
        player_scores: playerScores,
      };

      const { getMatchRepository } = await import('$lib/services/MatchRepository.js');
      const savedMatch = await getMatchRepository().saveCompletedMatch(record);
      matchRecord = savedMatch ?? record;

      // Cleanup draft after successful save
      await deleteDraft(activeDraftId);

      const status = savedMatch.sync_status;
      if (status === 'local_only') { postSaveMessage = 'Partie lokal gespeichert'; postSaveTone = 'accent'; }
      else if (status === 'pending') { postSaveMessage = 'Partie gespeichert, Cloud-Sicherung folgt automatisch'; postSaveTone = 'accent'; }
      else if (status === 'synced') { postSaveMessage = 'Partie gespeichert und gesichert'; postSaveTone = 'success'; }
      else { postSaveMessage = 'Partie ist lokal sicher, Cloud-Sicherung steht noch aus'; postSaveTone = 'warning'; }

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
        activeSession.update((s) => {
          const session = s || { id: 'session_' + Date.now(), date: new Date().toISOString(), matches: [] };
          return { ...session, matches: [...session.matches, { ...record, gameKey: game }] };
        });
      }

      // Show saved state and wait a bit
      saveState = 'saved';
      await new Promise((resolve) => setTimeout(resolve, 1000));

      triggerConfetti();
      HapticService.success();

      const colorOf = new Map(sheet.players.map((p) => [p.name, safeCssColor(p.color) || null]));
      resultRows = playerScores
        .slice()
        .sort((/** @type {any} */ a, /** @type {any} */ b) => b.total_score - a.total_score)
        .map((/** @type {any} */ p) => ({ ...p, color: colorOf.get(p.player_name) ?? null }));
      resultOpen = true;
      saveState = 'idle';
    } catch (error) {
      console.error('Error saving match:', error);
      // Speichern fehlgeschlagen → Autosave wieder zulassen, damit der Entwurf nicht verloren geht.
      matchSaved = false;
      saveState = 'error';
      showToast('Fehler beim lokalen Speichern.', 'error');
      await new Promise((resolve) => setTimeout(resolve, 1500));
      saveState = 'idle';
    }
  }

  function finishMatchAndQuit() {
    if (leaving) return;
    leaving = true;
    resultOpen = false;
    navigate(appHash.home(), { replace: true });
    currentGame.set(null);
    currentSessionDuration.set(0);
    prefilledPlayerNames.set(null);
    showToast(postSaveMessage, 'success');
  }

  function rematchMatch() {
    if (leaving) return;
    leaving = true;
    resultOpen = false;
    currentSessionDuration.set(0);

    const currentNames = get(prefilledPlayerNames);
    if (currentNames && currentNames.length > 1) {
      const rotated = [...currentNames];
      rotated.push(/** @type {string} */ (rotated.shift()));
      prefilledPlayerNames.set(rotated);

      const currentColors = get(playerColors);
      if (currentColors && currentColors.length > 1) {
        const rotatedColors = [...currentColors];
        rotatedColors.push(/** @type {string} */ (rotatedColors.shift()));
        playerColors.set(rotatedColors);
      }
    }
    navigate(appHash.matchLive(true), { replace: true });
  }

  async function shareResults() {
    if (isSharing || !matchRecord) return;
    isSharing = true;
    try {
      await shareMatchAsImage(matchRecord, validateGameImageUrl(template?.cover) ?? '');
    } catch (e) {
      console.error('Sharing failed:', e);
      showToast('Teilen fehlgeschlagen.', 'error');
    } finally {
      isSharing = false;
    }
  }

  function abortScoring() {
    // Entwurf bleibt erhalten (wie bisher)
    const game = $currentGame;
    navigate(game ? appHash.game(toSlug(game)) : appHash.home(), { replace: true });
    currentSessionDuration.set(0);
    prefilledPlayerNames.set(null);
  }
</script>

<div class="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[44rem] flex-col px-4 sm:px-6">
  <header class="sticky top-0 z-20 -mx-4 flex h-14 items-center gap-1 bg-canvas/95 px-2 sm:-mx-6">
    <IconButton label="Schließen" onclick={abortScoring}><X class="size-6" aria-hidden="true" /></IconButton>
    <h1 tabindex="-1" data-screen-title class="min-w-0 flex-1 truncate text-center text-base font-semibold">Wertung · {gameName}</h1>
    <IconButton label="Rückgängig" disabled={!sheet?.undoDepth} onclick={() => sheet?.undo()}><Undo2 class="size-5" aria-hidden="true" /></IconButton>
    <Button variant="primary" loading={saveState === 'saving'} disabled={!sheet || saveState !== 'idle'} onclick={saveMatch}>
      {#if saveState === 'saved'}<Check class="size-5" aria-hidden="true" />Gespeichert{:else if saveState === 'error'}Fehler{:else}Speichern{/if}
    </Button>
  </header>

  {#if sheet}
    <div class="sticky top-14 z-10 -mx-4 bg-canvas/95 px-4 sm:-mx-6 sm:px-6">
      <PlayerSwitcher players={sheet.players} totals={sheet.totals} active={sheet.activeIndex} onselect={(i) => sheet?.setActive(i)} />
    </div>

    <div class="flex flex-1 flex-col gap-3 pb-6 pt-2">
      {#if draftRestored}
        <p class="rounded-md bg-accent-soft px-3 py-2 text-sm font-medium text-accent-soft-fg" role="status">Entwurf wiederhergestellt</p>
      {/if}

      {#if $currentGame === 'next_station_london'}
        <Card padded class="flex flex-col gap-2 text-sm text-fg-2">
          <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
            <Info class="size-4" aria-hidden="true" />Wertungshilfe: Next Station: London
          </div>
          <p><strong class="text-fg">Rundenwertung:</strong> Trage die Anzahl der befahrenen <strong class="text-fg">Stadtbezirke</strong> ein. Ermittle dann den Stadtbezirk, in dem deine U-Bahn-Linie die <strong class="text-fg">meisten Stationen</strong> anfährt. Schreib die Anzahl dieser Stationen in das entsprechende Feld. Trage zuletzt ein, wie oft du diese Runde die <strong class="text-fg">Themse überquert</strong> hast. Die Berechnung geschieht automatisch.</p>
          <p class="border-t border-line pt-2"><strong class="text-fg">Endwertung (Umsteigemöglichkeiten):</strong> Tragt nur die Anzahl der entsprechenden Umsteigemöglichkeiten auf eurem Plan ein. Die Punkte werden automatisch berechnet.</p>
        </Card>
      {/if}

      {#if sheet.results[sheet.activeIndex]?.panel}
        {@const panel = sheet.results[sheet.activeIndex].panel}
        {#if panel}
          <Card padded class="flex flex-col gap-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-semibold">{panel.title}</span>
              <Badge tone={panel.tone}>{panel.label}</Badge>
            </div>
            <ul class="flex justify-between gap-2 rounded-md bg-surface-2 p-2.5 text-sm text-fg-2">
              {#each panel.items as item}<li>{item.label}: <strong class="text-fg">{item.value}</strong></li>{/each}
            </ul>
          </Card>
        {/if}
      {/if}

      {#if template?.expansion}
        <Card class="px-4">
          <Switch label={template.expansion.label} checked={sheet.expansionActive} onchange={(v) => sheet?.setExpansion(v)} />
        </Card>
      {/if}

      {#snippet infoBlock(/** @type {any} */ cat)}
        {@const lines = cat.lines ?? []}
        <div class="my-1 flex flex-col gap-1 rounded-md border border-line border-l-[3px] border-l-accent bg-surface-2 px-4 py-3.5">
          {#if cat.label}<span class="text-[0.82rem] font-bold">{cat.label}</span>{/if}
          {#each lines as line, li}
            {#if li === lines.length - 1}
              <span class="mt-0.5 border-t border-line pt-2 text-[0.82rem] font-bold text-accent">{line}</span>
            {:else}
              <span class="text-[0.8rem] leading-relaxed text-fg-2">{line}</span>
            {/if}
          {/each}
        </div>
      {/snippet}

      {#snippet row(/** @type {any} */ cat)}
        {#if cat.type === 'info'}
          {@render infoBlock(cat)}
        {:else}
          <ScoreRow {cat} {whiteIcon}
            value={sheet?.active?.scores[cat.id] ?? 0}
            badge={sheet?.results[sheet.activeIndex]?.badges[cat.id] ?? ''}
            expanded={expandedCat === cat.id}
            ontoggle={() => (expandedCat = expandedCat === cat.id ? null : cat.id)}
            oninput={(v) => sheet?.setScore(cat.id, v)}
            oncommit={(v, before) => commit(cat.id, cat.label, v, before)}
            onhelp={() => { helpCat = cat; helpOpen = true; }}>
            {#snippet comparison()}
              {@const max = Math.max(0, ...(sheet?.players ?? []).map((p) => p.scores[cat.id] || 0))}
              <ul class="flex flex-col gap-2">
                {#each sheet?.players ?? [] as p, pi}
                  {@const val = p.scores[cat.id] || 0}
                  <li class="flex items-center gap-2.5 text-sm">
                    <span class={['w-20 shrink-0 truncate', pi === sheet?.activeIndex ? 'font-semibold' : 'text-fg-2']}>{p.name}</span>
                    <span class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <span class="block h-full rounded-full" style:width="{max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0}%"
                        style:background={safeCssColor(p.color, 'var(--text-3)')}></span>
                    </span>
                    <span class="tabular w-9 shrink-0 text-right font-semibold">{val}</span>
                  </li>
                {/each}
              </ul>
            {/snippet}
          </ScoreRow>
        {/if}
      {/snippet}

      {#each sections as sec (sec.name)}
        {#if !sec.expansionOnly || sheet.expansionActive}
          {@const cats = sec.cats.filter((/** @type {any} */ c) => !c.isExpansion || sheet?.expansionActive)}
          {#if sec.name}
            <details class="group overflow-hidden rounded-md border border-line bg-surface shadow-1">
              <summary class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
                {sec.name}
                <ChevronDown class="size-5 text-fg-2 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div class="border-t border-line">
                {#each cats as cat (cat.id)}{@render row(cat)}{/each}
              </div>
            </details>
          {:else}
            <Card>
              {#each cats as cat (cat.id)}{@render row(cat)}{/each}
            </Card>
          {/if}
        {/if}
      {/each}

      {#if template?.modal}
        <Button variant="secondary" class="self-center" onclick={() => (modalOpen = true)}>
          <BookOpen class="size-5" aria-hidden="true" />Wertungsregeln anzeigen
        </Button>
      {/if}
    </div>

    <div class="sticky bottom-[var(--nav-space)] z-10 -mx-4 flex items-center gap-3 border-t border-line bg-surface px-4 py-2.5 sm:-mx-6 sm:px-6"
      aria-live="polite">
      <PlayerDot size="md" name={sheet.active.name} color={sheet.active.color} />
      <div class="min-w-0 flex-1 leading-tight">
        <div class="truncate font-semibold">{sheet.active.name}</div>
        <div class="text-sm text-fg-2">Platz {rankOf(sheet.totals, sheet.activeIndex)} von {sheet.players.length}</div>
      </div>
      <span class="tabular text-score font-bold" aria-label="Gesamtpunktzahl {sheet.totals[sheet.activeIndex] ?? 0}">{sheet.totals[sheet.activeIndex] ?? 0}</span>
    </div>
  {:else}
    <div class="h-[60dvh]" aria-busy="true"></div>
  {/if}
</div>

<Sheet bind:open={helpOpen} title={helpCat?.label ?? ''} size="sm">
  <p class="text-fg-2">{helpCat?.description}</p>
</Sheet>

{#if template?.modal}
  <Sheet bind:open={modalOpen} title={template.modal.title} size="lg">
    <div class="flex flex-col gap-4">
      <div>
        <h3 class="mb-1.5 text-sm font-semibold text-fg-2">Standard-Wertungsregeln</h3>
        <img src={validateGameImageUrl(template.modal.image) ?? ''} alt={template.modal.title} class="max-h-[50dvh] w-full rounded-md border border-line object-contain" />
      </div>
      {#if sheet?.expansionActive && template.expansion?.expansionModal}
        <div class="border-t border-dashed border-line-strong pt-4">
          <h3 class="mb-1.5 text-sm font-semibold text-fg-2">Erweiterungs-Wertung ({template.expansion.label})</h3>
          <img src={validateGameImageUrl(template.expansion.expansionModal) ?? ''} alt="Erweiterung" class="max-h-[50dvh] w-full rounded-md border border-line object-contain" />
        </div>
      {/if}
    </div>
  </Sheet>
{/if}

<ResultSheet bind:open={resultOpen} {gameName} rows={resultRows} message={postSaveMessage} tone={postSaveTone}
  sharing={isSharing} sessionMode={$settings.gameSessionMode} onshare={shareResults} onrematch={rematchMatch} onfinish={finishMatchAndQuit} />
