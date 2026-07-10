// @ts-check

/**
 * Service to manage mobile device haptic feedback using Web Vibration API.
 */
export class HapticService {
    /**
     * Trigger vibration pattern if supported
     * @param {number | number[]} pattern
     * @returns {boolean} Success state
     */
    static vibrate(pattern) {
        if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return false;
        }
        if (typeof localStorage !== 'undefined') {
            const savedSettings = localStorage.getItem('bg_settings');
            if (savedSettings) {
                try {
                    const settings = JSON.parse(savedSettings);
                    if (settings.hapticsEnabled === false) {
                        return false;
                    }
                } catch (_) {}
            }
        }
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
                return navigator.vibrate(pattern);
            } catch (e) {
                console.warn('HapticService: Vibration failed', e);
            }
        }
        return false;
    }

    /**
     * Light haptic tap for general button clicks
     * @returns {boolean}
     */
    static lightTap() {
        return this.vibrate(10);
    }

    /**
     * Medium impact haptic feedback for significant user actions
     * @returns {boolean}
     */
    static mediumImpact() {
        return this.vibrate(35);
    }

    /**
     * Success feedback for saving scores
     * @returns {boolean}
     */
    static success() {
        return this.vibrate([100, 50, 100]);
    }

    /**
     * Feedback when timer starts or resumes
     * @returns {boolean}
     */
    static timerStart() {
        return this.vibrate([20, 50, 20]);
    }

    /**
     * Feedback when timer is paused
     * @returns {boolean}
     */
    static timerPause() {
        return this.vibrate(30);
    }

    /**
     * Feedback when timer is stopped or finished
     * @returns {boolean}
     */
    static timerStop() {
        return this.vibrate([50, 100, 50, 100]);
    }
}
