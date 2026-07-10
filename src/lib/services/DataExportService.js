// @ts-check
import { getAuthService } from './AuthService.js';
import { db, pullFromRemote } from './DbService.js';

/**
 * Normalisiert Match-Daten für den CSV-Export
 * @param {any[]} matches 
 * @returns {any[]}
 */
function normalizeMatchesForCsv(matches) {
    const rows = [];
    for (const match of matches) {
        const scores = match.player_scores ?? match.expand?.player_scores ?? [];
        const winner = scores.reduce((/** @type {any} */ best, /** @type {any} */ cur) => ((cur.total_score ?? 0) > (best?.total_score ?? 0) ? cur : best), null);
        
        for (const ps of scores) {
            rows.push({
                Match_ID: match.id || match.local_id || '',
                Datum: match.date ? new Date(match.date).toISOString().split('T')[0] : '',
                Spiel: match.game_name || '',
                Spieler: ps.player_name || '',
                Punkte: ps.total_score || 0,
                Sieger: (winner && winner.player_name === ps.player_name) ? 'Ja' : 'Nein',
                Dauer_Minuten: match.duration ? Math.round(match.duration / 60) : 0,
            });
        }
    }
    return rows;
}

/**
 * Generiert einen CSV String aus Objekten
 * @param {any[]} data 
 * @returns {string}
 */
function generateCsv(data) {
    if (!data || !data.length) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header];
            const escaped = ('' + val).replace(/"/g, '""');
            if (escaped.search(/("|,|\n)/g) >= 0) {
                return `"${escaped}"`;
            }
            return escaped;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
}

/**
 * Startet den CSV Export aller lokal verfügbaren Matches
 * @returns {Promise<void>}
 */
export async function exportMatchesToCsv() {
    try {
        const authSvc = getAuthService();
        const cachedUser = await db.get('bg_user');
        
        // Versuche alle remote matches zu laden, ansonsten lokaler cache
        let matches = [];
        try {
            if (authSvc.getToken() && cachedUser?.id) {
                matches = await pullFromRemote(cachedUser.id);
            }
        } catch(e) {
            console.warn("Konnte Remote-Matches nicht für Export laden, nutze lokalen Cache", e);
            matches = (await db.get('bg_matches')) || [];
        }

        if (!matches || matches.length === 0) {
            throw new Error("Keine Matches zum Exportieren gefunden.");
        }

        const normalized = normalizeMatchesForCsv(matches);
        const csvString = generateCsv(normalized);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute("download", `brettspiel_matches_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Fehler beim CSV Export:", error);
        throw error;
    }
}
