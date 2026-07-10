// @ts-check
import { fetchWithTimeout } from '../utils/timeout.js';
/**
 * ==========================================================================
 * BOARDGAME COMPANION - AUTH SERVICE MODULE
 * ==========================================================================
 * Dedicated REST service for interacting with the PocketBase Auth APIs.
 * Supports credentials login, signup, token refreshing, and state validation.
 * 
 * SECURITY: Tokens are stored ONLY in memory, never in IndexedDB or localStorage.
 */
/**
 * @typedef {Object} AuthResponse
 * @property {string} token
 * @property {any} record
 */

/**
 * Client-Side Rate Limiter for Authentication attempts
 * @private
 */
class ClientRateLimiter {
    /**
     * @param {number} maxAttempts Maximum login attempts allowed
     * @param {number} windowMs Time window in milliseconds
     */
    constructor(maxAttempts = 5, windowMs = 600000) { // 10 minutes
        /** @type {number[]} */
        this.attempts = [];
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
    }

    /**
     * Check if rate limit is exceeded
     * @returns {{ isLimited: boolean, remainingTime?: number, attemptsLeft?: number }}
     */
    check() {
        const now = Date.now();
        this.attempts = this.attempts.filter(t => now - t < this.windowMs);

        if (this.attempts.length >= this.maxAttempts) {
            const remainingTime = Math.ceil((this.attempts[0] + this.windowMs - now) / 1000);
            return { isLimited: true, remainingTime };
        }

        return { isLimited: false, attemptsLeft: this.maxAttempts - this.attempts.length };
    }

    /**
     * Record a failed attempt
     */
    record() {
        this.attempts.push(Date.now());
    }

    /**
     * Reset limiter
     */
    reset() {
        this.attempts = [];
    }
}

export class AuthService {
    /**
     * @param {string} host PocketBase API Base Host (e.g. 'https://pocketbase-boardgame.dasdann.jetzt')
     */
    constructor(host) {
        /** @type {string} */
        this.host = host;
        
        /** @type {string|null} - Token stored ONLY in memory */
        this.currentToken = null;
        
        /** @type {number|null} - Token expiry timestamp */
        this.tokenExpiry = null;
        
        /** @type {any} - Refresh timer ID */
        this._refreshTimer = null;
        
        /** @type {ClientRateLimiter} */
        this.loginLimiter = new ClientRateLimiter(5, 600000); // 5 attempts per 10 minutes
        
        /** @type {ClientRateLimiter} */
        this.registerLimiter = new ClientRateLimiter(3, 3600000); // 3 per hour

        /** @type {ClientRateLimiter} */
        this.forgotPasswordLimiter = new ClientRateLimiter(3, 3600000); // 3 per hour

        // Restore token from secure session cookie if available (F5 resilience)
        if (typeof document !== 'undefined' && typeof document.cookie === 'string') {
            const match = document.cookie.match(/(^|;)\s*bg_jwt\s*=\s*([^;]+)/);
            if (match) {
                this.currentToken = match[2];
                // Use actual JWT exp so tokenExpiry reflects real server-side validity
                this.tokenExpiry = this._getTokenExpiry(this.currentToken);
                this._scheduleTokenRefresh(this.currentToken);
                console.log('🔄 AuthService: Session restored from secure cookie.');
            }
        }
    }

    /**
     * Get the current auth token (memory only)
     * @returns {string|null}
     */
    getToken() {
        // Check if token is expired
        if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
            console.warn('⚠️ AuthService: Token expired, clearing.');
            this.currentToken = null;
            this.tokenExpiry = null;
        }
        return this.currentToken;
    }

    /**
     * Check if user is currently authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.getToken() !== null;
    }

    /**
     * Alias for isAuthenticated() — used by MatchRepository/SyncService to
     * decide whether a saved match can be enqueued for remote sync.
     * @returns {boolean}
     */
    isLoggedIn() {
        return this.isAuthenticated();
    }

    /**
     * Clear the current auth token
     */
    clearToken() {
        this.currentToken = null;
        this.tokenExpiry = null;
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }
        // Clear secure session cookie
        if (typeof document !== 'undefined') {
            document.cookie = 'bg_jwt=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict';
        }
        console.log('🔓 AuthService: Token cleared.');
    }

    /**
     * Authenticates a user using identity and password credentials
     * @param {string} email User email or username
     * @param {string} password Password
     * @returns {Promise<AuthResponse>} Object containing { token, record }
     * @throws {Error} If rate limited or login fails
     */
    async login(email, password) {
        // Check rate limit BEFORE making request
        const limitCheck = this.loginLimiter.check();
        if (limitCheck.isLimited) {
            const msg = `Too many login attempts. Try again in ${limitCheck.remainingTime}s.`;
            console.warn(`⚠️ AuthService: ${msg}`);
            throw new Error(msg);
        }

        const url = `${this.host}/api/collections/users/auth-with-password`;
        console.log('📡 AuthService: Login attempt...');

        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ identity: email, password })
            }, 30000);

            if (!response.ok) {
                
                let errorMsg = 'Login fehlgeschlagen. Bitte überprüfe deine Daten.';
                try {
                    const errData = await response.json();
                    errorMsg = errData.message || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
            }

            const data = await response.json();
            
            // Store token ONLY in memory (not in IndexedDB/localStorage)
            this.currentToken = data.token;
            // Use actual JWT exp claim so expiry matches the real token lifetime
            this.tokenExpiry = this._getTokenExpiry(data.token);

            // Save in secure session cookie — max-age derived from JWT exp so the
            // cookie survives exactly as long as the token is valid server-side
            if (typeof document !== 'undefined') {
                document.cookie = `bg_jwt=${data.token}; path=/; max-age=${this._getTokenMaxAge(data.token)}; Secure; SameSite=Strict`;
            }
            
            // Reset rate limiter on successful login
            this.loginLimiter.reset();
            console.log('✅ AuthService: Login successful, token stored in memory and cookie.');
            
            this._scheduleTokenRefresh(data.token);
            
            return data;
        } catch (e) {
            const error = /** @type {any} */ (e);
            if (error.name === 'AbortError') {
                throw new Error('Login-Timeout (30s). Bitte überprüfe deine Verbindung.');
            }
            // If it's not already a rate limit error, record attempt
            if (!error.message.includes('Too many login attempts')) {
                this.loginLimiter.record();
            }
            throw error;
        }
    }

    /**
     * Registers a new user record in the PocketBase users collection
     * @param {string} email User email address
     * @param {string} password Password
     * @param {string} passwordConfirm Password confirmation matching password
     * @param {string} name User display name
     * @returns {Promise<Object>} Newly created user record (without token)
     * @throws {Error} If rate limited or registration fails
     */
    async register(email, password, passwordConfirm, name) {
        // Check rate limit BEFORE making request
        const limitCheck = this.registerLimiter.check();
        if (limitCheck.isLimited) {
            const msg = `Too many registration attempts. Try again in ${limitCheck.remainingTime}s.`;
            console.warn(`⚠️ AuthService: ${msg}`);
            throw new Error(msg);
        }

        const url = `${this.host}/api/collections/users/records`;
        console.log('📡 AuthService: Registration attempt...');

        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password,
                    passwordConfirm,
                    name: name || email.split('@')[0],
                    emailVisibility: false
                })
            }, 30000);

            if (!response.ok) {
                
                let errorMsg = 'Registrierung fehlgeschlagen. Bitte verwende eine gültige E-Mail.';
                try {
                    const errData = await response.json();
                    if (errData.data) {
                        // Extract detailed field validations if available
                        const fields = Object.keys(errData.data).map(k => `${k}: ${errData.data[k].message}`).join(', ');
                        errorMsg = `${errData.message} (${fields})`;
                    } else {
                        errorMsg = errData.message || errorMsg;
                    }
                } catch (_) {}
                throw new Error(errorMsg);
            }

            // Reset rate limiter on successful registration
            this.registerLimiter.reset();
            console.log('✅ AuthService: Registration successful.');
            return await response.json();
        } catch (e) {
            const error = /** @type {any} */ (e);
            if (error.name === 'AbortError') {
                throw new Error('Registrierungs-Timeout (30s). Bitte überprüfe deine Verbindung.');
            }
            // If it's not already a rate limit error, record attempt
            if (!error.message.includes('Too many registration attempts')) {
                this.registerLimiter.record();
            }
            throw error;
        }
    }

    /**
     * Refreshes the active auth session to maintain persistent authentication
     * Uses the current token from memory if not provided
     * @param {string} [token] Active JWT token (uses internal token if not provided)
     * @returns {Promise<AuthResponse>} Object containing refreshed { token, record }
     * @throws {Error} If no token available or refresh fails
     */
    async refresh(token) {
        const tokenToRefresh = token || this.currentToken;
        
        if (!tokenToRefresh) {
            throw new Error('No token available for refresh.');
        }

        const url = `${this.host}/api/collections/users/auth-refresh`;
        console.log('📡 AuthService: Refreshing session token...');

        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenToRefresh}`
                }
            }, 30000);

            if (!response.ok) {
                // Clear token if refresh failed (e.g., token revoked)
                this.clearToken();
                throw new Error('Sitzungs-Refresh fehlgeschlagen. Bitte erneut anmelden.');
            }

            const data = await response.json();
            
            // Update token in memory
            this.currentToken = data.token;
            this.tokenExpiry = this._getTokenExpiry(data.token);

            // Update secure session cookie with the real token lifetime
            if (typeof document !== 'undefined') {
                document.cookie = `bg_jwt=${data.token}; path=/; max-age=${this._getTokenMaxAge(data.token)}; Secure; SameSite=Strict`;
            }
            
            console.log('✅ AuthService: Token refreshed successfully and updated in cookie.');
            
            this._scheduleTokenRefresh(data.token);
            
            return data;
        } catch (e) {
            const error = /** @type {any} */ (e);
            if (error.name === 'AbortError') {
                throw new Error('Verbindungs-Timeout beim Sitzungs-Refresh (30s).');
            }
            if (error.message.includes('No token') || error.message.includes('Sitzungs-Refresh fehlgeschlagen')) {
                throw error;
            }
            // Netzfehler: Token nicht verwerfen, da Verbindung wiederkommen kann
            throw error;
        }
    }

    /**
     * Deletes the user record from the PocketBase users collection
     * @param {string} userId PocketBase user ID
     * @param {string} [token] Active JWT token (uses internal token if not provided)
     * @returns {Promise<boolean>} True on success
     * @throws {Error} If deletion fails
     */
    async deleteUser(userId, token) {
        const tokenToUse = token || this.currentToken;
        
        if (!tokenToUse) {
            throw new Error('No token available for delete operation.');
        }

        const url = `${this.host}/api/collections/users/records/${userId}`;
        console.log(`📡 AuthService: Deleting user ID: ${userId}`);

        try {
            const response = await fetchWithTimeout(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${tokenToUse}`
                }
            }, 30000);

            if (!response.ok) {
                let errorMsg = 'Konto konnte nicht gelöscht werden.';
                try {
                    const errData = await response.json();
                    errorMsg = errData.message || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
            }

            // Clear token after successful deletion
            this.currentToken = null;
            this.clearToken();
            console.log('✅ AuthService: User deleted and logged out.');
            return true;
        } catch (e) {
            const error = /** @type {any} */ (e);
            if (error.name === 'AbortError') {
                throw new Error('Timeout beim Löschen des Kontos (30s).');
            }
            throw error;
        }
    }

    /**
     * Updates the user profile details (like name)
     * @param {string} userId PocketBase user ID
     * @param {Object} data Key-value pairs to update
     * @returns {Promise<Object>} Updated user record
     * @throws {Error} If update fails
     */
    async updateProfile(userId, data) {
        if (!this.currentToken) {
            throw new Error('No token available for update operation.');
        }

        const url = `${this.host}/api/collections/users/records/${userId}`;
        console.log(`📡 AuthService: Updating user ID: ${userId}`);

        try {
            const response = await fetchWithTimeout(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.currentToken}`
                },
                body: JSON.stringify(data)
            }, 30000);

            if (!response.ok) {
                let errorMsg = 'Profil konnte nicht aktualisiert werden.';
                try {
                    const errData = await response.json();
                    errorMsg = errData.message || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
            }

            const updatedRecord = await response.json();
            console.log('✅ AuthService: Profile updated successfully.');
            return updatedRecord;
        } catch (e) {
            const error = /** @type {any} */ (e);
            if (error.name === 'AbortError') {
                throw new Error('Timeout beim Aktualisieren des Profils (30s).');
            }
            throw error;
        }
    }

    /**
     * Changes the user password
     * @param {string} userId PocketBase user ID
     * @param {string} oldPassword Current password
     * @param {string} password New password
     * @param {string} passwordConfirm New password confirmation
     * @returns {Promise<Object>} Updated user record
     * @throws {Error} If update fails
     */
    async changePassword(userId, oldPassword, password, passwordConfirm) {
        // Uses the updateProfile method under the hood, but specific for passwords
        return this.updateProfile(userId, { oldPassword, password, passwordConfirm });
    }

    /**
     * Requests an email change
     * @param {string} newEmail The new email address
     * @returns {Promise<boolean>} True on success
     * @throws {Error} If request fails
     */
    async requestEmailChange(newEmail) {
        if (!this.currentToken) {
            throw new Error('No token available for email change operation.');
        }

        const url = `${this.host}/api/collections/users/request-email-change`;
        console.log(`📡 AuthService: Requesting email change to: ${newEmail}`);

        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.currentToken}`
                },
                body: JSON.stringify({ newEmail })
            }, 30000);

            if (!response.ok) {
                let errorMsg = 'E-Mail-Änderung konnte nicht angefragt werden.';
                try {
                    const errData = await response.json();
                    errorMsg = errData.message || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
            }

            console.log('✅ AuthService: Email change requested successfully.');
            return true;
        } catch (e) {
            const error = /** @type {any} */ (e);
            if (error.name === 'AbortError') {
                throw new Error('Timeout beim Anfragen der E-Mail-Änderung (30s).');
            }
            throw error;
        }
    }

    /**
     * Confirms a user email verification using the verification token.
     * @param {string} token Verification JWT token
     * @returns {Promise<boolean>} True on success
     * @throws {Error} If verification fails
     */
    async confirmVerification(token) {
        const url = `${this.host}/api/collections/users/confirm-verification`;
        console.log('📡 AuthService: Confirming email verification...');

        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            }, 30000);

            if (!response.ok) {
                let errorMsg = 'E-Mail-Verifizierung fehlgeschlagen.';
                try {
                    const errData = await response.json();
                    errorMsg = errData.message || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
            }

            console.log('✅ AuthService: Email verified successfully.');
            return true;
        } catch (e) {
            const error = /** @type {any} */ (e);
            if (error.name === 'AbortError') {
                throw new Error('Verbindungs-Timeout bei der E-Mail-Verifizierung.');
            }
            throw error;
        }
    }

    /**
     * Requests a password reset email for the given email address.
     * @param {string} email User email address
     * @returns {Promise<boolean>} True on success
     * @throws {Error} If rate limited or request fails
     */
    async requestPasswordReset(email) {
        const limitCheck = this.forgotPasswordLimiter.check();
        if (limitCheck.isLimited) {
            const msg = `Zu viele Anfragen. Bitte versuche es in ${limitCheck.remainingTime}s erneut.`;
            console.warn(`⚠️ AuthService: ${msg}`);
            throw new Error(msg);
        }

        const url = `${this.host}/api/collections/users/request-password-reset`;
        console.log('📡 AuthService: Requesting password reset...');

        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            }, 30000);

            if (!response.ok) {
                let errorMsg = 'Fehler beim Anfordern des Passwort-Resets.';
                try {
                    const errData = await response.json();
                    errorMsg = errData.message || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
            }

            this.forgotPasswordLimiter.reset();
            console.log('✅ AuthService: Password reset email requested successfully.');
            return true;
        } catch (e) {
            const error = /** @type {any} */ (e);
            if (error.name === 'AbortError') {
                throw new Error('Verbindungs-Timeout. Bitte überprüfe deine Verbindung.');
            }
            if (!error.message.includes('Zu viele Anfragen')) {
                this.forgotPasswordLimiter.record();
            }
            throw error;
        }
    }

    /**
     * Confirms a user password reset request.
     * @param {string} token Password reset JWT token
     * @param {string} password New password
     * @param {string} passwordConfirm New password confirmation
     * @returns {Promise<boolean>} True on success
     * @throws {Error} If password reset fails
     */
    async confirmPasswordReset(token, password, passwordConfirm) {
        const url = `${this.host}/api/collections/users/confirm-password-reset`;
        console.log('📡 AuthService: Confirming password reset...');

        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token, password, passwordConfirm })
            }, 30000);

            if (!response.ok) {
                let errorMsg = 'Passwort-Zurücksetzen fehlgeschlagen.';
                try {
                    const errData = await response.json();
                    errorMsg = errData.message || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
            }

            console.log('✅ AuthService: Password reset successfully.');
            return true;
        } catch (e) {
            const error = /** @type {any} */ (e);
            if (error.name === 'AbortError') {
                throw new Error('Verbindungs-Timeout beim Passwort-Zurücksetzen.');
            }
            throw error;
        }
    }

    /**
     * Confirms a user email change request.
     * @param {string} token Email change JWT token
     * @param {string} password User password
     * @returns {Promise<boolean>} True on success
     * @throws {Error} If email change confirmation fails
     */
    async confirmEmailChange(token, password) {
        const url = `${this.host}/api/collections/users/confirm-email-change`;
        console.log('📡 AuthService: Confirming email change...');

        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token, password })
            }, 30000);

            if (!response.ok) {
                let errorMsg = 'Bestätigung der E-Mail-Änderung fehlgeschlagen.';
                try {
                    const errData = await response.json();
                    errorMsg = errData.message || errorMsg;
                } catch (_) {}
                throw new Error(errorMsg);
            }

            console.log('✅ AuthService: Email changed successfully.');
            return true;
        } catch (e) {
            const error = /** @type {any} */ (e);
            if (error.name === 'AbortError') {
                throw new Error('Verbindungs-Timeout bei der E-Mail-Änderung.');
            }
            throw error;
        }
    }

    /**
     * Parses the JWT exp claim and returns the remaining validity in seconds.
     * Falls back to 86 400 s (1 day) if parsing fails.
     * @param {string} token
     * @returns {number} remaining seconds (minimum 60)
     */
    _getTokenMaxAge(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const remainingMs = payload.exp * 1000 - Date.now();
            return Math.max(60, Math.floor(remainingMs / 1000));
        } catch (_) {
            return 86400; // 1 day fallback
        }
    }

    /**
     * Parses the JWT exp claim and returns the absolute expiry timestamp in ms.
     * Falls back to 50 minutes from now if parsing fails.
     * @param {string} token
     * @returns {number} Unix timestamp in milliseconds
     */
    _getTokenExpiry(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            // Refresh 5 minutes early to avoid last-second failures
            return payload.exp * 1000 - (5 * 60 * 1000);
        } catch (_) {
            return Date.now() + (50 * 60 * 1000);
        }
    }

    /**
     * Schedules the automatic token refresh using setTimeout based on the token expiration.
     * @param {string} token
     */
    _scheduleTokenRefresh(token) {
        if (typeof window === 'undefined') return;
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        try {
            // Parse JWT payload
            const payloadPart = token.split('.')[1];
            // Decode base64 utf-8 safely
            const payloadStr = atob(payloadPart);
            const payload = JSON.parse(payloadStr);
            const expiresAtMs = payload.exp * 1000;
            const nowMs = Date.now();
            const expiresInMs = expiresAtMs - nowMs;
            
            // Refresh 5 minutes (300 seconds) before expiration
            const refreshInMs = expiresInMs - (300 * 1000);
            
            console.log(`📡 AuthService: Scheduling token refresh in ${Math.max(0, Math.floor(refreshInMs / 1000))}s.`);
            
            this._refreshTimer = setTimeout(async () => {
                try {
                    const refreshed = await this.refresh();
                    window.dispatchEvent(new CustomEvent('auth-token-refreshed', { detail: refreshed }));
                } catch (e) {
                    const error = /** @type {any} */ (e);
                    console.error('❌ AuthService: Automatic token refresh failed:', error);
                    const isNetworkError = error.name === 'AbortError' || 
                                           error.message?.includes('Failed to fetch') || 
                                           error.message?.includes('Timeout') || 
                                           error.message?.includes('network') ||
                                           (typeof navigator !== 'undefined' && !navigator.onLine);
                    if (isNetworkError) {
                        console.log('📡 AuthService: Netzfehler beim Auto-Refresh, versuche erneut in 60s...');
                        this._refreshTimer = setTimeout(() => {
                            this._scheduleTokenRefresh(token);
                        }, 60000);
                    } else {
                        this.clearToken();
                        window.dispatchEvent(new CustomEvent('auth-session-expired', { detail: { error: error.message } }));
                    }
                }
            }, Math.max(0, refreshInMs));
        } catch (err) {
            console.error('❌ AuthService: Failed to schedule token refresh', err);
        }
    }
}

/**
 * Global singleton instance of AuthService
 * Initialized with PocketBase host from environment
 * @type {AuthService|null}
 */
let authServiceInstance = null;

/**
 * Initialize and get the AuthService singleton
 * @param {string} [host] PocketBase host (if not initialized yet)
 * @returns {AuthService}
 */
export function getAuthService(host) {
    if (!authServiceInstance) {
        if (!host) {
            throw new Error('AuthService not initialized. Provide host on first call.');
        }
        authServiceInstance = new AuthService(host);
    }
    return authServiceInstance;
}

// Export for module access
export { authServiceInstance };
