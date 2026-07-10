// @ts-check
/**
 * ==========================================================================
 * BOARDGAME COMPANION - GAMETIMER MODULE (PHASE 2)
 * ==========================================================================
 * A highly resilient timekeeper that persists its state in localStorage.
 * Invulnerable to browser suspension, backgrounding, or tab closures.
 * Uses setInterval solely for UI updates; all math is based on absolute timestamps.
 */
export class GameTimer {
    constructor() {
        this.STORAGE_KEYS = {
            STATE: 'bg_timer_state',
            START_TIME: 'bg_timer_start_time',
            ACCUMULATED: 'bg_timer_accumulated_time'
        };

        /** @type {string} */
        this.state = 'stopped'; // 'running' | 'paused' | 'stopped'
        /** @type {number} */
        this.startTime = 0; // Milliseconds timestamp of current running segment start
        /** @type {number} */
        this.accumulatedTime = 0; // Cumulative duration (ms) of finished segments
        
        /** @type {any} */
        this.intervalId = null;
        /** @type {(function(string, number): void) | null} */
        this.tickCallback = null;

        // Restore state from previous session if it exists
        this._loadState();
    }

    /**
     * Start or resume the timer
     * @param {function(string, number): void} onTick Callback executed every second with (formattedTime, totalSeconds)
     */
    start(onTick) {
        if (this.state === 'running') return;

        this.tickCallback = onTick;

        if (this.state === 'stopped') {
            this.accumulatedTime = 0;
            this.startTime = Date.now();
            this.state = 'running';
        } else if (this.state === 'paused') {
            // Resuming from pause: set new segment start
            this.startTime = Date.now();
            this.state = 'running';
        }

        this._saveState();
        this._startTickLoop();
    }

    /**
     * Pause the timer, freezing cumulative elapsed time
     */
    pause() {
        if (this.state !== 'running') return;

        const segmentElapsed = Date.now() - this.startTime;
        this.accumulatedTime += segmentElapsed;
        this.startTime = 0;
        this.state = 'paused';

        this._saveState();
        this._stopTickLoop();

        // One final tick to update UI with exact paused values
        this._triggerTick();
    }

    /**
     * Stop and clear the timer
     * @returns {number} The total elapsed time in SECONDS
     */
    stop() {
        const totalDurationMs = this.getDurationInMilliseconds();
        const totalDurationSeconds = Math.round(totalDurationMs / 1000);

        // Reset state
        this.state = 'stopped';
        this.startTime = 0;
        this.accumulatedTime = 0;
        this._clearState();
        this._stopTickLoop();

        return totalDurationSeconds;
    }

    /**
     * Computes absolute running time in milliseconds
     * @returns {number} Elapsed duration in milliseconds
     */
    getDurationInMilliseconds() {
        if (this.state === 'running') {
            return this.accumulatedTime + (Date.now() - this.startTime);
        }
        if (this.state === 'paused') {
            return this.accumulatedTime;
        }
        return 0;
    }

    /**
     * Computes absolute running time in seconds
     * @returns {number} Elapsed duration in seconds
     */
    getDurationInSeconds() {
        return Math.round(this.getDurationInMilliseconds() / 1000);
    }

    /**
     * Formats milliseconds into HH:MM:SS format
     * @param {number} ms Milliseconds elapsed
     * @returns {string} Formatted duration
     */
    static formatDuration(ms) {
        if (ms < 0) ms = 0;
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (/** @type {number} */ num) => String(num).padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }

    /**
     * Recovers any active timer state on app startup
     * If the timer was running, it resumes ticking. If paused, it triggers one UI update.
     * @param {function(string, number): void} onTick Callback executed for UI updates
     * @returns {boolean} True if a timer was recovered (running or paused)
     */
    recoverActiveTimer(onTick) {
        this._loadState();
        if (this.state === 'stopped') return false;

        this.tickCallback = onTick;

        if (this.state === 'running') {
            console.log('🔄 GameTimer auto-recovered a RUNNING timer.');
            this._startTickLoop();
            return true;
        }

        if (this.state === 'paused') {
            console.log('⏸️ GameTimer auto-recovered a PAUSED timer.');
            this._triggerTick();
            return true;
        }

        return false;
    }

    /* --------------------------------------------------------------------------
       Private / Helper Methods
       -------------------------------------------------------------------------- */

    /**
     * Reads values from localStorage and updates instance properties
     */
    _loadState() {
        const storedState = localStorage.getItem(this.STORAGE_KEYS.STATE);
        const storedStartTime = localStorage.getItem(this.STORAGE_KEYS.START_TIME);
        const storedAccumulated = localStorage.getItem(this.STORAGE_KEYS.ACCUMULATED);

        if (storedState) {
            this.state = storedState;
            this.startTime = storedStartTime ? parseInt(storedStartTime, 10) : 0;
            this.accumulatedTime = storedAccumulated ? parseInt(storedAccumulated, 10) : 0;
        }
    }

    /**
     * Writes instance properties to localStorage
     */
    _saveState() {
        localStorage.setItem(this.STORAGE_KEYS.STATE, this.state);
        localStorage.setItem(this.STORAGE_KEYS.START_TIME, this.startTime.toString());
        localStorage.setItem(this.STORAGE_KEYS.ACCUMULATED, this.accumulatedTime.toString());
    }

    /**
     * Deletes timer-related keys from localStorage
     */
    _clearState() {
        localStorage.removeItem(this.STORAGE_KEYS.STATE);
        localStorage.removeItem(this.STORAGE_KEYS.START_TIME);
        localStorage.removeItem(this.STORAGE_KEYS.ACCUMULATED);
    }

    /**
     * Initiates the ticking interval loop (cosmetic only)
     */
    _startTickLoop() {
        this._stopTickLoop(); // Prevent parallel interval leaks
        
        // Execute immediate tick for visual response
        this._triggerTick();

        this.intervalId = setInterval(() => {
            this._triggerTick();
        }, 1000);
    }

    /**
     * Stops the cosmetic ticking interval
     */
    _stopTickLoop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Calculates absolute time and dispatches update to UI callback
     */
    _triggerTick() {
        if (!this.tickCallback) return;
        
        const elapsedMs = this.getDurationInMilliseconds();
        const formatted = GameTimer.formatDuration(elapsedMs);
        const totalSeconds = Math.round(elapsedMs / 1000);

        try {
            this.tickCallback(formatted, totalSeconds);
        } catch (err) {
            console.error('❌ GameTimer tick callback execution failed:', err);
        }
    }
}
