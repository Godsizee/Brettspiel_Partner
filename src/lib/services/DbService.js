// @ts-check
/**
 * ==========================================================================
 * BOARDGAME COMPANION - DATABASE SERVICE (PHASE 4)
 * ==========================================================================
 * A lightweight, zero-dependency Promise-based wrapper around IndexedDB.
 * Acts as a drop-in replacement for localStorage for complex offline datasets.
 * 
 * SECURITY: Token is retrieved from AuthService (memory only), never from IndexedDB.
 */

const DB_NAME = 'boardgame_companion_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

/**
 * Store for auth token (set by app during initialization)
 * @type {string|null}
 * @private
 */
let storedAuthToken = null;

/**
 * Set the auth token (called from app.js)
 * @param {string|null} token
 */
export function setAuthToken(token) {
    storedAuthToken = token;
}

/**
 * Get current auth token from memory
 * @returns {string|null}
 */
function getAuthToken() {
    return storedAuthToken;
}

function getDB() {
    /** @type {Promise<IDBDatabase>} */
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Store match data with validation
 * @param {string} key Key to store match under
 * @param {any} matchData Match object to validate and store
 * @returns {Promise<void>}
 * @throws {Error} If validation fails
 */
export async function storeMatchData(key, matchData) {
    try {
        // Dynamically import to avoid circular dependency
        const { validateMatch } = await import('../schemas/matchSchema.js');
        
        // Validate match before storing
        const validated = validateMatch(matchData);
        
        // Store validated data
        await db.set(key, validated);
        console.log(`✅ DbService: Match stored and validated (key: ${key})`);
    } catch (error) {
        console.error(`❌ DbService: Match validation failed:`, error);
        throw new Error(`Match validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Get and validate match data
 * @param {string} key Key to fetch
 * @returns {Promise<any|null>} Validated match or null if invalid
 */
export async function getMatchData(key) {
    try {
        const data = await db.get(key);
        if (!data) return null;
        
        // Dynamically import to avoid circular dependency
        const { validateMatch } = await import('../schemas/matchSchema.js');
        
        // Validate retrieved data
        const validated = validateMatch(data);
        return validated;
    } catch (error) {
        console.warn(`⚠️ DbService: Match data invalid or corrupted (key: ${key}):`, error);
        return null;
    }
}

export const db = {
    /**
     * Retrieve a value from the database
     * @param {string} key Key to fetch
     * @returns {Promise<any>} Resolves with the value or undefined
     */
    async get(key) {
        try {
            const database = await getDB();
            return new Promise((resolve, reject) => {
                const transaction = database.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);
                
                request.onsuccess = () => {
                    resolve(request.result);
                };
                
                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(`❌ DbService: Failed to get key "${key}":`, error);
            return undefined;
        }
    },

    /**
     * Store a value in the database
     * @param {string} key Key to identify the value
     * @param {any} value Value to store
     * @returns {Promise<void>}
     */
    async set(key, value) {
        try {
            const database = await getDB();
            return new Promise((resolve, reject) => {
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(value, key);
                
                request.onsuccess = () => {
                    resolve();
                };
                
                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(`❌ DbService: Failed to set key "${key}":`, error);
        }
    },

    /**
     * Remove a value from the database
     * @param {string} key Key to delete
     * @returns {Promise<void>}
     */
    async delete(key) {
        try {
            const database = await getDB();
            return new Promise((resolve, reject) => {
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(key);
                
                request.onsuccess = () => {
                    resolve();
                };
                
                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error(`❌ DbService: Failed to delete key "${key}":`, error);
        }
    },

    /**
     * Clear all key/value pairs from the store
     * @returns {Promise<void>}
     */
    async clear() {
        try {
            const database = await getDB();
            return new Promise((resolve, reject) => {
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.clear();
                
                request.onsuccess = () => {
                    resolve();
                };
                
                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('❌ DbService: Failed to clear store:', error);
        }
    }
};

/**
 * Holt alle Spieler-Profile
 * @returns {Promise<Array<any>>}
 */
export async function getProfiles() {
    try {
        const data = await db.get('bg_player_profiles');
        if (!data) return [];
        return data;
    } catch (error) {
        console.error('❌ DbService: Fehler beim Laden der Profile:', error);
        return [];
    }
}

/**
 * Speichert ein neues Spieler-Profil (oder aktualisiert es)
 * @param {any} profile
 * @returns {Promise<void>}
 */
export async function storeProfile(profile) {
    try {
        const { validatePlayerProfile } = await import('../schemas/playerProfileSchema.js');
        const validated = validatePlayerProfile(profile);
        
        let profiles = await getProfiles();
        const existingIdx = profiles.findIndex(p => p.id === validated.id || p.name.toLowerCase() === validated.name.toLowerCase());
        
        if (existingIdx !== -1) {
            // Aktualisieren
            if (!validated.id) validated.id = profiles[existingIdx].id;
            profiles[existingIdx] = validated;
        } else {
            // Neu anlegen
            if (!validated.id) validated.id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
            profiles.push(validated);
        }
        
        await db.set('bg_player_profiles', profiles);
        console.log(`✅ DbService: Profil gespeichert: ${validated.name}`);
        // Fire-and-forget: Profil auch in PocketBase synchronisieren
        pushProfileToRemote(validated).catch(() => {});
    } catch (error) {
        console.error('❌ DbService: Fehler beim Speichern des Profils:', error);
        throw error;
    }
}

/**
 * Löscht ein Spieler-Profil
 * @param {string} profileId
 * @returns {Promise<void>}
 */
export async function deleteProfile(profileId) {
    try {
        let profiles = await getProfiles();
        profiles = profiles.filter(p => p.id !== profileId);
        await db.set('bg_player_profiles', profiles);
        console.log(`bg_player_profiles: Profil gelöscht: ${profileId}`);
        // Fire-and-forget: Profil auch aus PocketBase löschen
        deleteProfileFromRemote(profileId).catch(() => {});
    } catch (error) {
        console.error('❌ DbService: Fehler beim Löschen des Profils:', error);
        throw error;
    }
}

/**
 * Gibt alle benutzerdefinierten Spiele zurück
 * @returns {Promise<Array<any>>}
 */
export async function getCustomGames() {
    try {
        return (await db.get('bg_custom_games')) ?? [];
    } catch (error) {
        console.error('❌ DbService: Fehler beim Laden der Custom Games:', error);
        return [];
    }
}

/**
 * Speichert ein neues benutzerdefiniertes Spiel
 * @param {any} game
 * @returns {Promise<void>}
 */
export async function storeCustomGame(game) {
    try {
        const { validateCustomGame } = await import('../schemas/customGameSchema.js');
        const validated = validateCustomGame(game);
        const games = await getCustomGames();
        const id = validated.key || ('custom_' + Date.now());
        const existingIdx = games.findIndex((/** @type {any} */ g) => g.key === id);
        const entry = {
            ...validated,
            key: id,
            badge: validated.badge || 'Benutzerdefiniert',
            custom: true,
            status: validated.status ?? 'local',
            pb_id: validated.pb_id ?? null,
            cover_url: validated.cover_url ?? ''
        };
        if (existingIdx !== -1) {
            games[existingIdx] = entry;
        } else {
            games.push(entry);
        }
        await db.set('bg_custom_games', games);
        console.log(`✅ DbService: Custom Game gespeichert: ${id}`);
    } catch (error) {
        console.error('❌ DbService: Fehler beim Speichern des Custom Games:', error);
        throw error;
    }
}

/**
 * Löscht ein benutzerdefiniertes Spiel lokal und zieht ggf. die PocketBase-Einreichung zurück.
 * @param {string} gameKey
 * @param {{host?: string, token?: string}} [pbContext]
 * @returns {Promise<void>}
 */
export async function deleteCustomGame(gameKey, pbContext) {
    try {
        const games = await getCustomGames();
        const entry = games.find((/** @type {any} */ g) => g.key === gameKey);
        if (entry?.pb_id && pbContext?.host && pbContext?.token) {
            try {
                const { withdrawPendingGame } = await import('./AdminService.js');
                await withdrawPendingGame(pbContext.host, pbContext.token, entry.pb_id);
            } catch (e) {
                console.warn('⚠️ Remote-Delete fehlgeschlagen (ignoriert):', e);
            }
        }
        await db.set('bg_custom_games', games.filter((/** @type {any} */ g) => g.key !== gameKey));
    } catch (error) {
        console.error('❌ DbService: Fehler beim Löschen des Custom Games:', error);
        throw error;
    }
}

// ─── PocketBase Remote-Sync ───────────────────────────────────────────────────

/**
 * Schreibt ein validiertes Match-Objekt nach PocketBase.
 * Alle Requests laufen über fetchWithTimeout (Netzwerk-Resilienz).
 * @param {any} match Vollständiges Match-Objekt (muss local_id enthalten)
 * @returns {Promise<{id: string}>} PocketBase-Record mit der vergebenen ID
 * @throws {Error} Bei Netzwerkfehler, Timeout oder fehlender Auth
 */
export async function pushToRemote(match) {
    const { fetchWithTimeout } = await import('../utils/timeout.js');
    const { getAuthService } = await import('./AuthService.js');
    const { validateMatch } = await import('../schemas/matchSchema.js');

    // Validierung vor jedem Remote-Push (Fail-Fast)
    const validated = validateMatch(match);

    const authSvc = getAuthService();
    const token = authSvc.getToken();
    if (!token) throw new Error('pushToRemote: Nicht authentifiziert.');

    const host = authSvc.host;
    const cachedUser = await db.get('bg_user');
    const userId = cachedUser?.id ?? null;

    const localId = validated.id ?? null;

    const body = {
        game_name:        validated.game_name,
        game_id:          /** @type {any} */ (validated).game_id ?? validated.game_name,
        duration:         validated.duration ?? 0,
        duration_seconds: validated.duration ?? 0,
        date:             validated.date ?? new Date().toISOString(),
        user:             userId,
        local_id:         localId,
        scores:           validated.player_scores ?? [],
        players:          (validated.player_scores ?? []).map((/** @type {any} */ ps) => ps.name ?? ps.player_name),
        participants:     (validated.player_scores ?? []).map((/** @type {any} */ ps) => ps.user_id).filter(Boolean),
        is_draft:         false,
        synced_at:        new Date().toISOString()
    };

    // Idempotenter Upsert über local_id: verhindert doppelte Match-Records, wenn
    // dasselbe Match mehrfach eingereiht wird (Retry nach verlorenem Response oder
    // erneutes Einreihen nach Login via migrateLocalMatchesAfterLogin).
    let existing = null;
    if (localId) {
        const filter = encodeURIComponent(`local_id = '${localId}'`);
        const existResp = await fetchWithTimeout(
            `${host}/api/collections/matches/records?filter=${filter}&perPage=1`,
            { headers: { 'Authorization': `Bearer ${token}` } },
            15000
        );
        if (existResp.ok) {
            const data = await existResp.json().catch(() => ({}));
            existing = data.items?.[0] ?? null;
        }
    }

    const resp = existing
        ? await fetchWithTimeout(
            `${host}/api/collections/matches/records/${existing.id}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            },
            30000
        )
        : await fetchWithTimeout(
            `${host}/api/collections/matches/records`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            },
            30000
        );

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(`pushToRemote: ${err.message || resp.statusText}`);
    }

    const created = await resp.json();
    console.log(`✅ DbService.pushToRemote: Match synchronisiert (${existing ? 'aktualisiert' : 'neu'}, PB-ID: ${created.id})`);
    return created;
}

/**
 * Lädt alle Matches eines Nutzers von PocketBase und gibt sie zurück.
 * Führt keine lokale Persistenz durch – das obliegt dem SyncService.
 * @param {string} userId PocketBase User-ID
 * @returns {Promise<any[]>} Array von Match-Records aus PocketBase
 * @throws {Error} Bei Netzwerkfehler, Timeout oder fehlender Auth
 */
export async function pullFromRemote(userId) {
    const { fetchWithTimeout } = await import('../utils/timeout.js');
    const { getAuthService } = await import('./AuthService.js');

    const authSvc = getAuthService();
    const token = authSvc.getToken();
    if (!token) throw new Error('pullFromRemote: Nicht authentifiziert.');

    const host = authSvc.host;
    const filter = encodeURIComponent(`user ~ '${userId}'`);
    const url = `${host}/api/collections/matches/records?filter=${filter}&sort=-date&perPage=200`;

    const resp = await fetchWithTimeout(
        url,
        { headers: { 'Authorization': `Bearer ${token}` } },
        30000
    );

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(`pullFromRemote: ${err.message || resp.statusText}`);
    }

    const data = await resp.json();
    const items = (data.items ?? []).map((/** @type {any} */ m) => ({
        ...m,
        player_scores: m.scores ?? m.player_scores ?? []
    }));
    console.log(`✅ DbService.pullFromRemote: ${items.length} Matches geladen.`);
    return items;
}

// ─── Spieler-Profil Remote-Sync ───────────────────────────────────────────────
//
// Strategie: local_id (= lokale UUID des Profils) dient als stabiler Schlüssel
// zwischen IndexedDB und der PocketBase-Collection player_profiles.
// Alle drei Funktionen sind fire-and-forget: Netzwerkfehler sind nicht-fatal.
//

/**
 * Schreibt ein Spieler-Profil nach PocketBase (Upsert via local_id).
 * Wird nach jedem lokalen storeProfile() aufgerufen.
 * @param {{ id?: string, name: string, color: string, avatar?: string }} profile
 * @returns {Promise<void>}
 */
export async function pushProfileToRemote(profile) {
    try {
        if (!profile.id) return;
        const { fetchWithTimeout } = await import('../utils/timeout.js');
        const { getAuthService } = await import('./AuthService.js');

        const authSvc = getAuthService();
        const token = authSvc.getToken();
        if (!token) return;

        const host = authSvc.host;
        const cachedUser = await db.get('bg_user');
        const userId = /** @type {string|null} */ (cachedUser?.id ?? null);
        if (!userId) return;

        // Prüfe ob ein PB-Datensatz mit dieser local_id bereits existiert
        const filter = encodeURIComponent(`local_id='${profile.id}'`);
        const existResp = await fetchWithTimeout(
            `${host}/api/collections/player_profiles/records?filter=${filter}&perPage=1`,
            { headers: { Authorization: `Bearer ${token}` } },
            10000
        );
        if (!existResp.ok) return;

        const existing = await existResp.json();
        const pbRecord = existing.items?.[0];
        const body = { user: userId, name: profile.name, color: profile.color, avatar: profile.avatar ?? '🎲', local_id: profile.id };

        if (pbRecord) {
            await fetchWithTimeout(
                `${host}/api/collections/player_profiles/records/${pbRecord.id}`,
                { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) },
                10000
            );
        } else {
            await fetchWithTimeout(
                `${host}/api/collections/player_profiles/records`,
                { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) },
                10000
            );
        }
        console.log(`✅ DbService.pushProfileToRemote: "${profile.name}" synchronisiert.`);
    } catch (err) {
        console.warn('⚠️ DbService.pushProfileToRemote fehlgeschlagen (ignoriert):', /** @type {Error} */ (err).message);
    }
}

/**
 * Löscht ein Spieler-Profil aus PocketBase anhand der local_id.
 * Wird nach jedem lokalen deleteProfile() aufgerufen.
 * @param {string} localId Lokale UUID des Profils (= profile.id)
 * @returns {Promise<void>}
 */
export async function deleteProfileFromRemote(localId) {
    try {
        const { fetchWithTimeout } = await import('../utils/timeout.js');
        const { getAuthService } = await import('./AuthService.js');

        const authSvc = getAuthService();
        const token = authSvc.getToken();
        if (!token) return;

        const host = authSvc.host;
        const filter = encodeURIComponent(`local_id='${localId}'`);
        const findResp = await fetchWithTimeout(
            `${host}/api/collections/player_profiles/records?filter=${filter}&perPage=1`,
            { headers: { Authorization: `Bearer ${token}` } },
            10000
        );
        if (!findResp.ok) return;

        const found = await findResp.json();
        const pbRecord = found.items?.[0];
        if (!pbRecord) return;

        await fetchWithTimeout(
            `${host}/api/collections/player_profiles/records/${pbRecord.id}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
            10000
        );
        console.log(`✅ DbService.deleteProfileFromRemote: ${localId} gelöscht.`);
    } catch (err) {
        console.warn('⚠️ DbService.deleteProfileFromRemote fehlgeschlagen (ignoriert):', /** @type {Error} */ (err).message);
    }
}

/**
 * Zieht alle Spieler-Profile des angemeldeten Nutzers aus PocketBase und
 * merged sie mit dem lokalen IndexedDB-Bestand. PocketBase gewinnt bei Konflikten.
 * Lokale Profile ohne PB-Gegenstück werden hochgeladen (Initial-Push).
 * @returns {Promise<void>}
 */
export async function pullProfilesFromRemote() {
    try {
        const { fetchWithTimeout } = await import('../utils/timeout.js');
        const { getAuthService } = await import('./AuthService.js');

        const authSvc = getAuthService();
        const token = authSvc.getToken();
        if (!token) return;

        const host = authSvc.host;
        const cachedUser = await db.get('bg_user');
        const userId = /** @type {string|null} */ (cachedUser?.id ?? null);
        if (!userId) return;

        const filter = encodeURIComponent(`user='${userId}'`);
        const resp = await fetchWithTimeout(
            `${host}/api/collections/player_profiles/records?filter=${filter}&perPage=200&sort=name`,
            { headers: { Authorization: `Bearer ${token}` } },
            15000
        );
        if (!resp.ok) return;

        const data = await resp.json();
        const remoteProfiles = /** @type {any[]} */ (data.items ?? []);
        const localProfiles  = await getProfiles();

        if (remoteProfiles.length === 0) {
            // Noch nichts in PB → alle lokalen Profile initial hochladen
            for (const p of localProfiles) await pushProfileToRemote(p);
            console.log(`✅ DbService.pullProfilesFromRemote: ${localProfiles.length} lokale Profile initial nach PB gepusht.`);
            return;
        }

        // Merge: PB gewinnt bei Konflikten, lokale Profile ohne PB-Gegenstück pushen
        /** @type {Map<string, any>} */
        const remoteByLocalId = new Map(remoteProfiles.map(r => [r.local_id, r]));
        const merged = /** @type {any[]} */ ([...localProfiles]);

        for (const remote of remoteProfiles) {
            if (!remote.local_id) continue;
            const idx = merged.findIndex(p => p.id === remote.local_id);
            const mapped = { id: remote.local_id, name: remote.name, color: remote.color, avatar: remote.avatar || '🎲' };
            if (idx !== -1) {
                merged[idx] = mapped; // PB überschreibt lokalen Eintrag
            } else {
                merged.push(mapped); // Neues Profil aus PB lokal anlegen
            }
        }

        // Lokale Profile, die noch nicht in PB sind, hochladen
        for (const local of localProfiles) {
            if (local.id && !remoteByLocalId.has(local.id)) {
                await pushProfileToRemote(local);
            }
        }

        await db.set('bg_player_profiles', merged);
        console.log(`✅ DbService.pullProfilesFromRemote: ${merged.length} Profile nach Merge gespeichert.`);
    } catch (err) {
        console.warn('⚠️ DbService.pullProfilesFromRemote fehlgeschlagen (ignoriert):', /** @type {Error} */ (err).message);
    }
}

// ─── Mitspieler & Einladungen ────────────────────────────────────────────────

/**
 * Sucht nach Nutzern anhand von E-Mail oder Name (über Custom PB Hook).
 * @param {string} query
 * @returns {Promise<any[]>}
 */
export async function lookupUser(query) {
    if (!query || query.length < 3) return [];
    
    try {
        const { fetchWithTimeout } = await import('../utils/timeout.js');
        const { getAuthService } = await import('./AuthService.js');

        const authSvc = getAuthService();
        const token = authSvc.getToken();
        if (!token) return [];

        const host = authSvc.host;
        const resp = await fetchWithTimeout(
            `${host}/api/users/lookup?q=${encodeURIComponent(query)}`,
            { headers: { Authorization: `Bearer ${token}` } },
            10000
        );

        if (!resp.ok) return [];
        const data = await resp.json();
        return data.items || [];
    } catch (err) {
        console.warn('⚠️ lookupUser fehlgeschlagen:', /** @type {Error} */ (err).message);
        return [];
    }
}

/**
 * Lädt einen Nutzer per E-Mail ein, dem aktuellen Spiel beizutreten.
 * @param {string} email 
 * @param {string|null} [matchId]
 * @returns {Promise<void>}
 */
export async function inviteUser(email, matchId = null) {
    try {
        const { fetchWithTimeout } = await import('../utils/timeout.js');
        const { getAuthService } = await import('./AuthService.js');

        const authSvc = getAuthService();
        const token = authSvc.getToken();
        if (!token) throw new Error("Nicht authentifiziert");

        const host = authSvc.host;
        const cachedUser = await db.get('bg_user');
        const userId = /** @type {string|null} */ (cachedUser?.id ?? null);
        if (!userId) throw new Error("Benutzer-ID nicht gefunden");

        const body = {
            email: email,
            invited_by: userId,
            status: "pending"
        };
        if (matchId) /** @type {any} */ (body).match_id = matchId;

        const resp = await fetchWithTimeout(
            `${host}/api/collections/invitations/records`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body)
            },
            10000
        );

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || resp.statusText);
        }
        console.log(`✅ DbService.inviteUser: Einladung an ${email} gesendet.`);
    } catch (err) {
        console.error('❌ DbService.inviteUser fehlgeschlagen:', err);
        throw err;
    }
}

