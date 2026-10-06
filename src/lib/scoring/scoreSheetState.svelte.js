// @ts-check
import { computeResults } from './engine.js';

const UNDO_LIMIT = 15; // wie BaseScoreSheet

/**
 * Zustand eines Wertungsbogens (Svelte-5-Runes). Kein DOM.
 * players[i] = { name, color, scores: { [kategorieId]: number } }
 */
export class ScoreSheetState {
  /** @type {Array<{ name: string, color: string|null, scores: Record<string, number> }>} */
  players = $state([]);
  activeIndex = $state(0);
  expansionActive = $state(false);
  undoDepth = $state(0);
  /** @type {string[]} */
  #undo = [];
  /** @type {any} */
  template;

  results = $derived(computeResults(this.template, this.players, { expansionActive: this.expansionActive }));
  totals = $derived(this.results.map((r) => r.total));
  active = $derived(this.players[this.activeIndex]);

  /**
   * @param {any} template
   * @param {string[]} names
   * @param {Array<string|null>} [colors]
   */
  constructor(template, names, colors = []) {
    this.template = template;
    const list = names?.length ? names : ['Spieler 1'];
    this.players = list.map((name, i) => ({ name, color: colors[i] ?? null, scores: this.#zeroScores() }));
  }

  /** Aus Entwurf (Payload-Form, B4) wiederherstellen. */
  static fromPayload(template, payload, colors = []) {
    const s = new ScoreSheetState(template, payload.map((p) => p.player_name), colors);
    payload.forEach((p, i) => { s.players[i].scores = { ...s.players[i].scores, ...p.score_details }; });
    return s;
  }

  #categories() {
    const t = this.template ?? {};
    return [...(t.categories ?? []), ...(t.expansion?.extraCategories ?? [])].filter((c) => c.type !== 'info');
  }

  #zeroScores() {
    return Object.fromEntries(this.#categories().map((c) => [c.id, 0]));
  }

  /** Live-Eingabe (jeder Tastendruck) — ohne Undo-Schritt. */
  setScore(catId, value) {
    this.players[this.activeIndex].scores[catId] = value;
  }

  /** Abschluss einer Eingabe (change-Event): Undo-Schritt mit dem Wert VOR der Eingabe. */
  commitScore(catId, value, before) {
    if (value === before) return;
    this.players[this.activeIndex].scores[catId] = before;
    this.#pushUndo();
    this.players[this.activeIndex].scores[catId] = value;
  }

  setActive(index) {
    if (index >= 0 && index < this.players.length) this.activeIndex = index;
  }

  /** Erweiterung aus → Zusatzkategorien aller Spieler auf 0 (alt: nur aktiver Spieler; Summen unverändert). */
  setExpansion(on) {
    this.expansionActive = on;
    if (on) return;
    for (const cat of this.template?.expansion?.extraCategories ?? []) {
      for (const p of this.players) p.scores[cat.id] = 0;
    }
  }

  #pushUndo() {
    this.#undo.push(JSON.stringify({ players: $state.snapshot(this.players), activeIndex: this.activeIndex }));
    if (this.#undo.length > UNDO_LIMIT) this.#undo.shift();
    this.undoDepth = this.#undo.length;
  }

  undo() {
    const prev = this.#undo.pop();
    this.undoDepth = this.#undo.length;
    if (!prev) return;
    const state = JSON.parse(prev);
    this.players = state.players;
    this.activeIndex = state.activeIndex;
  }

  /** Payload exakt in der gespeicherten Form (B4). */
  toPayload() {
    return this.players.map((p, i) => ({
      player_name: p.name,
      score_details: { ...$state.snapshot(p.scores) },
      total_score: this.totals[i] ?? 0,
    }));
  }
}
