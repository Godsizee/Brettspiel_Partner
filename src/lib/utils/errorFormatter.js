// @ts-check

/**
 * Format raw server/API errors into user-friendly localized messages.
 * Prevents leaking technical internal details (collection/field names).
 * @param {any} error Raw error object
 * @returns {string} User-friendly message
 */
export function formatUserError(error) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return 'Keine Internetverbindung. Bitte überprüfe dein Netzwerk.';
    }
    
    const message = error?.message || '';
    
    // Check for network timeout or abort
    if (message.includes('timeout') || message.includes('Timeout') || message.includes('AbortError') || error?.name === 'AbortError') {
        return 'Die Verbindung zum Server hat zu lange gedauert (Timeout).';
    }

    const status = error?.status || error?.statusCode;
    
    if (status === 401) {
        return 'Sitzung abgelaufen. Bitte melde dich erneut an. 🔒';
    }
    if (status === 403) {
        return 'Keine ausreichenden Berechtigungen für diese Aktion. 🚫';
    }
    if (status === 429 || message.includes('Too many login attempts') || message.includes('Too many attempts')) {
        return 'Zu viele Versuche. Bitte warte einen Moment und versuche es erneut. ⏱';
    }
    if (status >= 500) {
        return 'Serverfehler. Unser Dienst ist vorübergehend nicht erreichbar. Bitte versuche es später noch einmal. ☁️';
    }

    // Default mask for generic errors
    return 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.';
}
