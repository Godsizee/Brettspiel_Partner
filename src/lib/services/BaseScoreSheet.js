// @ts-check
import { showToast } from '../stores/app.js';

/**
 * ==========================================================================
 * BOARDGAME COMPANION - BASESCORESHEET COMPONENT (PHASE 4 - MULTIPLAYER)
 * ==========================================================================
 * Abstract base class for all board game score sheets.
 * Handles the state management and standardizes CSS styling rules.
 */

export class BaseScoreSheet extends HTMLElement {
    constructor() {
        super();
        
        // Array of player score entities: { name: 'Spieler 1', scores: {}, total: 0 }
        /** @type {Array<{ name: string, scores: Record<string, number>, total: number }>} */
        this.players = [{ name: 'Spieler 1', scores: {}, total: 0 }];
        /** @type {number} */
        this.activePlayerIndex = 0;
        
        /** @type {Array<string>} - Stack of JSON strings representing past states */
        this._undoStack = [];
    }

    /**
     * Getter for current active player scores map
     * @returns {Record<string, number>}
     */
    get scores() {
        if (!this.players || this.players.length === 0 || !this.players[this.activePlayerIndex]) {
            return {};
        }
        return this.players[this.activePlayerIndex].scores;
    }

    /**
     * Setter for current active player scores map
     * @param {Record<string, number>} val
     */
    set scores(val) {
        if (this.players && this.players[this.activePlayerIndex]) {
            this.players[this.activePlayerIndex].scores = val;
        }
    }

    /**
     * Getter for current active player grand total
     * @returns {number}
     */
    get totalScore() {
        if (!this.players || this.players.length === 0 || !this.players[this.activePlayerIndex]) {
            return 0;
        }
        return this.players[this.activePlayerIndex].total || 0;
    }

    /**
     * Setter for current active player grand total
     * @param {number} val
     */
    set totalScore(val) {
        if (this.players && this.players[this.activePlayerIndex]) {
            this.players[this.activePlayerIndex].total = val;
        }
    }

    /**
     * Configures the player list and sets up initial structures
     * @param {Array<string>} playerNames 
     */
    setPlayers(playerNames) {
        if (!playerNames || playerNames.length === 0) return;
        
        this.players = playerNames.map(name => ({
            name: name,
            scores: {},
            total: 0
        }));
        
        this.activePlayerIndex = 0;
        
        const rootNode = /** @type {ShadowRoot | HTMLElement} */ (this.shadowRoot || this);
        this.renderPlayerTabs(rootNode);
        this.loadActivePlayerScores(rootNode);
    }

    /**
     * Setzt die persistenten Farben für die Spieler als CSS Variablen im Shadow Root
     * @param {Array<string>} colors
     */
    setPlayerColors(colors) {
        if (!colors || colors.length === 0) return;
        const rootNode = /** @type {ShadowRoot | HTMLElement} */ (this.shadowRoot || this);
        colors.forEach((color, idx) => {
            // @ts-ignore
            if (typeof rootNode.style?.setProperty === 'function') {
                // @ts-ignore
                rootNode.style.setProperty(`--player-${idx + 1}-color`, color);
            }
        });
        
        this.renderPlayerTabs(rootNode);
        this.updateExpansionPanels();
    }

    /**
     * Set up row click listeners on all DOM elements with the [data-category] attribute
     * @param {ShadowRoot | HTMLElement} [rootNode]
     */
    initScoreSheetHooks(rootNode = /** @type {ShadowRoot | HTMLElement} */ (this.shadowRoot || this)) {
        /** @type {NodeListOf<HTMLElement>} */
        const scoreCells = rootNode.querySelectorAll('.score-trigger');
        scoreCells.forEach(cell => {
            const category = cell.getAttribute('data-category');
            if (!category) return;
            const label = cell.getAttribute('data-label') || category;
            
            // Pre-initialize empty values for players if not populated
            this.players.forEach(p => {
                if (p.scores[category] === undefined) {
                    let initialVal = 0;
                    if (cell.tagName === 'INPUT') {
                        initialVal = parseFloat(/** @type {HTMLInputElement} */ (cell).value);
                    } else {
                        initialVal = parseFloat(cell.textContent ? cell.textContent.trim() : '');
                    }
                    p.scores[category] = isNaN(initialVal) ? 0 : initialVal;
                }
            });

            if (cell.tagName === 'INPUT') {
                const input = /** @type {HTMLInputElement} */ (cell);
                
                // Set initial active value
                const value = this.scores[category] || 0;
                input.value = String(value);
                
                let originalValueOnFocus = 0;
                input.addEventListener('focus', () => {
                    originalValueOnFocus = parseFloat(input.value) || 0;
                    input.select();
                });
                
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        input.blur();
                    }
                });
                
                input.addEventListener('input', () => {
                    let newValue = parseFloat(input.value);
                    if (isNaN(newValue)) newValue = 0;
                    
                    this.scores[category] = newValue;
                    if (newValue !== 0) {
                        input.classList.add('populated');
                    } else {
                        input.classList.remove('populated');
                    }
                    this.recalculate();
                });
                
                input.addEventListener('change', () => {
                    let newValue = parseFloat(input.value);
                    if (isNaN(newValue)) {
                        newValue = 0;
                        input.value = '0';
                    }
                    if (newValue > 400 || newValue < -50) {
                        showToast(`Ungewöhnliche Punktzahl (${newValue}) bei ${label}. Absicht?`, 'warning', 4000);
                    }
                    if (newValue !== originalValueOnFocus) {
                        const tempScores = { ...this.scores };
                        this.scores[category] = originalValueOnFocus;
                        this.pushUndoState();
                        this.scores = tempScores;
                        this.scores[category] = newValue;
                        this.recalculate();
                    }
                });
            } else {
                cell.style.cursor = 'pointer';
                cell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._openNumpadForCell(cell, category, label);
                });
            }
        });

        // Toggle category expansion on click on row meta
        const rows = rootNode.querySelectorAll('.score-row');
        rows.forEach(row => {
            const category = row.getAttribute('data-category');
            if (!category) return;
            const rowMeta = /** @type {HTMLElement|null} */ (row.querySelector('.row-meta'));
            if (rowMeta) {
                rowMeta.style.cursor = 'pointer';
                rowMeta.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleCategoryExpansion(category);
                });
            }
        });

        // Dynamic render player switcher
        this.renderPlayerTabs(rootNode);
        this.loadActivePlayerScores(rootNode);
    }

    /**
     * Dynamic rendering of horizontal scrollable player switcher tabs inside grid container
     * @param {ShadowRoot | HTMLElement} [rootNode]
     */
    renderPlayerTabs(rootNode = /** @type {ShadowRoot | HTMLElement} */ (this.shadowRoot || this)) {
        /** @type {HTMLElement | null} */
        let tabsBar = rootNode.querySelector('.player-tabs-bar');
        
        if (!tabsBar) {
            /** @type {HTMLElement | null} */
            const grid = rootNode.querySelector('.scoresheet-grid');
            if (!grid) return;
            
            tabsBar = document.createElement('div');
            tabsBar.className = 'player-tabs-bar';
            grid.insertBefore(tabsBar, grid.firstChild);
        }

        tabsBar.innerHTML = '';
        
        // Add Undo Button at the start of tabsBar (U4)
        const undoBtn = document.createElement('button');
        undoBtn.type = 'button';
        undoBtn.className = 'tab-btn btn-undo-scoresheet';
        undoBtn.title = 'Rückgängig (Undo)';
        undoBtn.style.padding = '10px 12px';
        undoBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
                <path d="M3 7v6h6"></path>
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
            </svg>
        `;
        undoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.undo();
        });
        tabsBar.appendChild(undoBtn);
        this.updateUndoButtonVisibility();
        
        this.players.forEach((player, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `tab-btn ${index === this.activePlayerIndex ? 'active' : ''}`;
            btn.style.setProperty('--player-color', `var(--player-${index + 1}-color, var(--color-primary))`);
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = player.name;
            btn.appendChild(nameSpan);

            const totalBadge = document.createElement('span');
            totalBadge.className = 'tab-total';
            totalBadge.textContent = String(player.total || 0);
            btn.appendChild(totalBadge);

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.activePlayerIndex === index) return;
                
                this.activePlayerIndex = index;
                this.loadActivePlayerScores(rootNode);
                this.renderPlayerTabs(rootNode);
            });

            if (tabsBar) {
                tabsBar.appendChild(btn);
            }
        });
    }

    /**
     * Refreshes cell display values to match active player score state
     * @param {ShadowRoot | HTMLElement} [rootNode]
     */
    loadActivePlayerScores(rootNode = /** @type {ShadowRoot | HTMLElement} */ (this.shadowRoot || this)) {
        /** @type {NodeListOf<HTMLElement>} */
        const scoreCells = rootNode.querySelectorAll('.score-trigger');
        scoreCells.forEach(cell => {
            const category = cell.getAttribute('data-category');
            if (!category) return;
            const value = this.scores[category] || 0;
            
            if (cell.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (cell).value = String(value);
            } else {
                cell.textContent = String(value);
            }
            if (value !== 0) {
                cell.classList.add('populated');
            } else {
                cell.classList.remove('populated');
            }
        });

        // Trigger sub-total logic
        this.recalculate();
    }

    /**
     * Abstract method that concrete subclasses MUST implement to calculate scores
     */
    calculateTotals() {
        throw new Error('❌ calculateTotals() must be implemented by the concrete subclass.');
    }

    /**
     * Recalculates points and dispatches change events
     */
    recalculate() {
        try {
            const oldTotal = this.totalScore;
            this.calculateTotals();
            
            // Live update the active player tab score badge value
            const rootNode = /** @type {ShadowRoot | HTMLElement} */ (this.shadowRoot || this);
            const activeBadge = rootNode.querySelector('.tab-btn.active .tab-total');
            if (activeBadge) {
                activeBadge.textContent = String(this.totalScore);
            }

            // Odometer count-up animation for grand total
            const totalEl = /** @type {HTMLElement|null} */ (rootNode.querySelector('#total-score-value'));
            if (totalEl) {
                if (oldTotal !== this.totalScore) {
                    this.animateCountUp(totalEl, oldTotal, this.totalScore, 400);
                } else {
                    totalEl.textContent = String(this.totalScore);
                }
            }

            this.updateExpansionPanels();
            this._dispatchChangedEvent();
        } catch (err) {
            console.error('❌ BaseScoreSheet: Error during score recalculation:', err);
        }
    }

    /**
     * Animate numeric value changes smoothly
     * @param {HTMLElement} element
     * @param {number} startVal
     * @param {number} endVal
     * @param {number} duration
     */
    animateCountUp(element, startVal, endVal, duration = 400) {
        if (!element) return;
        const startTime = performance.now();
        const run = (/** @type {number} */ now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = progress * (2 - progress);
            const currentVal = Math.round(startVal + (endVal - startVal) * easeProgress);
            element.textContent = String(currentVal);
            if (progress < 1) {
                requestAnimationFrame(run);
            } else {
                element.textContent = String(endVal);
            }
        };
        requestAnimationFrame(run);
    }

    /**
     * Toggles category detail card accordion panel
     * @param {string} category
     */
    toggleCategoryExpansion(category) {
        const rootNode = /** @type {ShadowRoot | HTMLElement} */ (this.shadowRoot || this);
        const panel = rootNode.querySelector(`.expansion-panel[data-for-category="${category}"]`);
        const row = rootNode.querySelector(`.score-row[data-category="${category}"]`);
        
        if (panel && row) {
            const isHidden = panel.classList.contains('hidden');
            
            // Collapse others
            rootNode.querySelectorAll('.expansion-panel').forEach(p => {
                if (p !== panel) {
                    p.classList.add('hidden');
                    const r = rootNode.querySelector(`.score-row[data-category="${p.getAttribute('data-for-category')}"]`);
                    if (r) r.classList.remove('expanded');
                }
            });
            
            if (isHidden) {
                panel.classList.remove('hidden');
                row.classList.add('expanded');
            } else {
                panel.classList.add('hidden');
                row.classList.remove('expanded');
            }
        }
    }

    /**
     * Sync progress visualizer inside category details panel
     */
    updateExpansionPanels() {
        const rootNode = /** @type {ShadowRoot | HTMLElement} */ (this.shadowRoot || this);
        const panels = rootNode.querySelectorAll('.expansion-panel');
        panels.forEach(panel => {
            const category = panel.getAttribute('data-for-category');
            if (!category) return;
            
            const listContainer = panel.querySelector('.player-progress-list');
            if (!listContainer) return;
            
            let maxVal = 0;
            this.players.forEach(p => {
                const val = p.scores[category] || 0;
                if (val > maxVal) maxVal = val;
            });
            
            listContainer.innerHTML = this.players.map((player, idx) => {
                const val = player.scores[category] || 0;
                const percent = maxVal > 0 ? Math.max(0, Math.min(100, (val / maxVal) * 100)) : 0;
                const isCurrent = idx === this.activePlayerIndex;
                const playerColor = `var(--player-${idx + 1}-color, var(--color-primary))`;
                const playerBg = `var(--player-${idx + 1}-color, var(--color-text-muted))`;
                
                return `
                    <div class="player-progress-row ${isCurrent ? 'is-current' : ''}">
                        <span class="player-progress-name" style="color: ${isCurrent ? playerColor : 'var(--color-text-secondary)'}">${player.name}</span>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: ${percent}%; background: ${isCurrent ? playerColor : playerBg}"></div>
                        </div>
                        <span class="player-progress-value">${val}</span>
                    </div>
                `;
            }).join('');
        });
    }

    /**
     * Exports a standardized unified multiplayer match score payload ready for SyncService
     * @returns {Array<Object>} Multi-player scores
     */
    getScorePayload() {
        return this.players.map(p => ({
            player_name: p.name,
            score_details: { ...p.scores },
            total_score: p.total || 0
        }));
    }

    /**
     * Restores a draft state
     * @param {Array<{player_name: string, score_details: Record<string, number>, total_score: number}>} playerScores 
     */
    restoreDraft(playerScores) {
        if (!playerScores || !playerScores.length) return;
        this.players = playerScores.map(p => ({
            name: p.player_name,
            scores: { ...p.score_details },
            total: p.total_score || 0
        }));
        this.activePlayerIndex = 0;
        const rootNode = /** @type {ShadowRoot | HTMLElement} */ (this.shadowRoot || this);
        this.renderPlayerTabs(rootNode);
        this.loadActivePlayerScores(rootNode);
    }

    /* --------------------------------------------------------------------------
     * Private Operations
     * -------------------------------------------------------------------------- */

    /**
     * Fallback for custom numpad opening (Deprecated: native keyboards preferred)
     * @param {HTMLElement} cellElement
     * @param {string} category
     * @param {string} label
     */
    _openNumpadForCell(cellElement, category, label) {
        // Native inputs preferred - no fallback virtual numpad needed anymore
    }

    /**
     * Pushes the current state of players to the undo stack (U4).
     */
    pushUndoState() {
        const stateStr = JSON.stringify({
            players: this.players.map(p => ({
                name: p.name,
                scores: { ...p.scores },
                total: p.total
            })),
            activePlayerIndex: this.activePlayerIndex
        });
        
        this._undoStack.push(stateStr);
        if (this._undoStack.length > 15) {
            this._undoStack.shift();
        }
        this.updateUndoButtonVisibility();
    }

    /**
     * Restores the previous score sheet state from the undo stack (U4).
     */
    undo() {
        if (this._undoStack.length === 0) return;
        
        const prevStateStr = this._undoStack.pop();
        if (!prevStateStr) return;
        
        try {
            const prevState = JSON.parse(prevStateStr);
            this.players = prevState.players;
            this.activePlayerIndex = prevState.activePlayerIndex;
            
            const rootNode = /** @type {ShadowRoot | HTMLElement} */ (this.shadowRoot || this);
            this.loadActivePlayerScores(rootNode);
            this.renderPlayerTabs(rootNode);
            this.updateUndoButtonVisibility();
            
            this._dispatchChangedEvent();
            console.log('↩️ BaseScoreSheet: Undo successful!');
        } catch (e) {
            console.error('❌ BaseScoreSheet: Undo failed:', e);
        }
    }

    /**
     * Updates the status of the undo button.
     */
    updateUndoButtonVisibility() {
        const rootNode = /** @type {ShadowRoot | HTMLElement} */ (this.shadowRoot || this);
        const undoBtn = /** @type {HTMLElement|null} */ (rootNode.querySelector('.btn-undo-scoresheet'));
        if (undoBtn) {
            if (this._undoStack.length > 0) {
                undoBtn.removeAttribute('disabled');
                undoBtn.style.opacity = '1';
                undoBtn.style.pointerEvents = 'auto';
            } else {
                undoBtn.setAttribute('disabled', 'true');
                undoBtn.style.opacity = '0.35';
                undoBtn.style.pointerEvents = 'none';
            }
        }
    }

    /**
     * Dispatches change event containing the current score mapping
     */
    _dispatchChangedEvent() {
        const event = new CustomEvent('score-sheet-changed', {
            bubbles: true,
            composed: true,
            detail: {
                players: this.players.map(p => ({ ...p })),
                activePlayerIndex: this.activePlayerIndex
            }
        });
        this.dispatchEvent(event);
    }

    /**
     * Returns highly-polished obsidian style tokens for scoresheet grids
     */
    static getSharedStyles() {
        return `
            :host {
                display: block;
                width: 100%;
                container-type: inline-size;
            }

            .scoresheet-grid {
                display: flex;
                flex-direction: column;
                gap: 12px;
                width: 100%;
                box-sizing: border-box;
            }

            @container (min-width: 580px) and (max-width: 799px) {
                .scoresheet-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 16px;
                }
                .player-tabs-bar, 
                .score-summary-card, 
                .expansion-toggle-container, 
                .popularity-info-panel, 
                .reference-container {
                    grid-column: span 2;
                }
            }

            @container (min-width: 800px) {
                .scoresheet-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 20px;
                }
                .player-tabs-bar {
                    grid-column: 1 / -1;
                }
                .expansion-toggle-container, 
                .popularity-info-panel, 
                .reference-container,
                .scoresheet-section-card {
                    grid-column: 1;
                }
                .score-summary-card {
                    grid-column: 2;
                    grid-row: 2 / 100;
                    position: sticky;
                    top: 24px;
                    align-self: start;
                    margin-top: 0;
                    box-shadow: var(--shadow-premium);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
            }

            /* Score Sheet Player Tabs bar */
            .player-tabs-bar {
                display: flex;
                gap: 8px;
                overflow-x: auto;
                padding: 6px 0;
                margin-bottom: 8px;
                box-sizing: border-box;
                width: 100%;
                flex-shrink: 0;
                scrollbar-width: none;
            }

            .player-tabs-bar::-webkit-scrollbar {
                display: none;
            }

            .tab-btn {
                background-color: var(--color-surface-glass);
                border: 1px solid var(--color-border-glass);
                color: var(--color-text-secondary);
                padding: 10px 16px;
                border-radius: 12px;
                font-family: var(--font-heading);
                font-size: 0.9rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
                white-space: nowrap;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .tab-btn.active {
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0.2) 100%);
                border-color: var(--player-color, var(--color-primary));
                color: var(--color-text-primary);
                box-shadow: var(--shadow-premium);
            }

            .tab-total {
                font-size: 0.8rem;
                background-color: rgba(0, 0, 0, 0.15);
                color: var(--color-secondary);
                padding: 1px 6px;
                border-radius: 6px;
                font-weight: 700;
            }

            .tab-btn.active .tab-total {
                color: var(--color-text-primary);
                background-color: var(--player-color, var(--color-primary));
            }

            /* Wertungsreihe (Scoring Row) */
            .score-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 14px 18px;
                background-color: var(--color-surface-glass);
                border: 1px solid var(--color-border-glass);
                border-radius: 16px;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
            }

            .score-row:hover {
                border-color: var(--color-primary);
                background-color: var(--color-surface-solid);
            }

            .score-row.expanded {
                border-radius: 16px 16px 0 0;
                border-bottom: 1px dashed var(--color-border-glass);
                background-color: var(--color-surface-solid);
            }

            .row-meta {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
                margin-right: 12px;
            }

            .cat-help-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-left: 6px;
                color: var(--color-primary);
                font-size: 0.75rem;
                font-weight: 800;
                background: rgba(99, 102, 241, 0.15);
                border: 1px solid rgba(99, 102, 241, 0.3);
                border-radius: 50%;
                width: 18px;
                height: 18px;
                cursor: help;
                transition: background 0.2s, transform 0.2s;
            }

            .cat-help-icon:hover {
                background: rgba(99, 102, 241, 0.3);
                transform: scale(1.1);
            }

            .row-icon {
                font-size: 1.3rem;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                background-color: rgba(255, 255, 255, 0.03);
                border-radius: 8px;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: 0 0 8px var(--color-icon-glow, rgba(255,255,255,0.05));
            }

            .score-row:hover .row-icon,
            .score-row.expanded .row-icon {
                box-shadow: 0 0 14px 4px var(--color-icon-glow, var(--color-primary-glow));
                transform: scale(1.08);
            }

            .row-title {
                font-family: var(--font-heading);
                font-size: 0.95rem;
                font-weight: 600;
                color: var(--color-text-primary);
            }

            /* Hide spin buttons for type="number" */
            .score-trigger::-webkit-outer-spin-button,
            .score-trigger::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }

            /* Score value input */
            .score-trigger {
                -moz-appearance: textfield;
                background-color: rgba(0, 0, 0, 0.05);
                border: 1px dashed var(--color-border-glass);
                color: var(--color-text-secondary);
                font-family: var(--font-heading);
                font-size: 1.15rem;
                font-weight: 700;
                min-width: 64px;
                max-width: 72px;
                height: 38px;
                border-radius: 10px;
                text-align: center;
                outline: none;
                box-sizing: border-box;
                cursor: text;
                transition: all 0.15s ease;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
            }

            .score-trigger.populated {
                color: var(--color-secondary);
                border-style: solid;
                border-color: var(--color-secondary);
                background-color: var(--color-secondary-glow);
                text-shadow: none;
            }

            .score-trigger:focus {
                border-color: var(--color-primary);
                box-shadow: 0 0 0 2px var(--color-primary-glow);
            }

            /* Accordion category expansion detail panel */
            .expansion-panel {
                background-color: rgba(10, 15, 25, 0.3);
                border: 1px solid var(--color-border-glass);
                border-top: none;
                border-radius: 0 0 16px 16px;
                margin-top: -12px;
                margin-bottom: 4px;
                padding: 14px 18px;
                box-sizing: border-box;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                overflow: hidden;
            }

            .expansion-panel.hidden {
                display: none;
            }

            .player-progress-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .player-progress-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                transition: all 0.2s ease;
            }

            .player-progress-name {
                font-size: 0.8rem;
                color: var(--color-text-secondary);
                min-width: 90px;
                max-width: 120px;
                white-space: nowrap;
                text-overflow: ellipsis;
                overflow: hidden;
            }

            .progress-bar-container {
                flex: 1;
                height: 8px;
                background-color: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
                overflow: hidden;
            }

            .progress-bar-fill {
                height: 100%;
                border-radius: 4px;
                transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .player-progress-value {
                font-size: 0.8rem;
                font-weight: 700;
                color: var(--color-text-primary);
                min-width: 32px;
                text-align: right;
            }

            /* Animations */
            @keyframes flip-up {
                0% { transform: rotateX(0deg); }
                50% { transform: rotateX(90deg); background-color: var(--color-border-glass); }
                100% { transform: rotateX(0deg); }
            }
            @keyframes flip-down {
                0% { transform: rotateX(0deg); }
                50% { transform: rotateX(-90deg); background-color: var(--color-border-glass); }
                100% { transform: rotateX(0deg); }
            }
            .flip-up {
                animation: flip-up 0.28s ease-out;
            }
            .flip-down {
                animation: flip-down 0.28s ease-out;
            }

            @keyframes category-pulse {
                0% { background-color: var(--color-surface-glass); box-shadow: 0 0 0 0px var(--color-secondary-glow); }
                30% { background-color: var(--color-secondary-glow); box-shadow: 0 0 15px 4px var(--color-secondary-glow); }
                100% { background-color: var(--color-surface-glass); box-shadow: 0 0 0 0px transparent; }
            }
            .pulse-row {
                animation: category-pulse 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
            }

            /* Grand Total Summary Display */
            .score-summary-card {
                margin-top: 10px;
                padding: 16px 20px;
                background: linear-gradient(135deg, var(--color-primary-glow) 0%, var(--color-secondary-glow) 100%);
                border: 1px solid var(--color-primary);
                border-radius: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), var(--shadow-premium);
                flex-shrink: 0;
                position: sticky;
                bottom: 24px;
                z-index: 100;
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
            }

            .summary-title {
                font-family: var(--font-heading);
                font-weight: 700;
                font-size: 1.1rem;
                color: var(--color-text-primary);
            }

            .summary-value {
                font-family: var(--font-heading);
                font-weight: 800;
                font-size: 1.8rem;
                color: var(--color-secondary);
                text-shadow: none;
            }

            /* Section Card Styles (Next Station: London) */
            .scoresheet-section-card {
                background-color: rgba(255, 255, 255, 0.02);
                border: 1px solid var(--color-border-glass);
                border-radius: 20px;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                box-shadow: var(--shadow-inner);
                grid-column: 1 / -1;
                margin-bottom: 8px;
            }

            .section-card-header {
                font-family: var(--font-heading);
                font-size: 0.95rem;
                font-weight: 800;
                color: var(--color-secondary);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                padding-bottom: 8px;
                margin-bottom: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                user-select: none;
            }

            .section-card-arrow {
                transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                color: var(--color-text-muted);
            }

            .scoresheet-section-card:hover .section-card-arrow {
                color: var(--color-secondary);
            }

            .scoresheet-section-card.collapsed .section-card-grid {
                display: none !important;
            }

            .scoresheet-section-card.collapsed .section-card-arrow {
                transform: rotate(-90deg);
            }

            .section-card-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 12px;
            }

            @container (min-width: 480px) {
                .section-card-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 16px;
                }
            }

            :global([data-theme="light"]) .scoresheet-section-card {
                background-color: rgba(0, 0, 0, 0.02);
            }

            /* Stufe 2: Standard-Smartphones (360px – 479px) */
            @container (max-width: 479px) {
                .scoresheet-section-card {
                    padding: 12px;
                    margin-bottom: 6px;
                }
                .score-row {
                    padding: 10px 12px;
                }
                .row-title {
                    font-size: 0.88rem;
                }
                .score-trigger {
                    height: 34px;
                    min-width: 56px;
                    max-width: 60px;
                }
                .row-icon {
                    width: 28px;
                    height: 28px;
                }
                .scoresheet-grid {
                    gap: 8px;
                }
            }

            /* Stufe 1: Ultra-Kompakt (< 360px) */
            @container (max-width: 359px) {
                .scoresheet-section-card {
                    padding: 8px;
                    margin-bottom: 4px;
                }
                .score-row {
                    padding: 8px 8px;
                }
                .row-title {
                    font-size: 0.8rem;
                }
                .score-trigger {
                    height: 32px;
                    min-width: 48px;
                    max-width: 52px;
                    font-size: 1rem;
                }
                .row-icon {
                    width: 24px;
                    height: 24px;
                }
                .scoresheet-grid {
                    gap: 6px;
                }
            }
        `;
    }
}
