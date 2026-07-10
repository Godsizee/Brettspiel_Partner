# Boardgame Companion - API Dokumentation

Diese Datei dokumentiert die Kern-Service-APIs im Frontend des **Boardgame Companion**. Alle Netzwerk-Schnittstellen verfügen über integrierte Timeouts (`fetchWithTimeout`) und Resilience-Fallbacks.

---

## 1. AuthService

Verantwortlich für die Registrierung, Anmeldung, Sitzungsverwaltung (Memory-Only) und Client-seitige Ratenbegrenzung.

### Singleton-Initialisierung
```javascript
import { getAuthService } from '$lib/services/AuthService.js';

// Erste Initialisierung (mit Host-Angabe)
const auth = getAuthService('https://pocketbase.example.com');
```

### Methoden

#### `login(email, password)`
Authentifiziert einen Benutzer mit E-Mail/Benutzername und Passwort.
*   **Parameter:**
    *   `email` (string): E-Mail-Adresse oder Benutzername.
    *   `password` (string): Passwort.
*   **Rückgabewert:** `Promise<AuthResponse>` - Objekt mit `{ token, record }`.
*   **Sicherheit:** Speichert den Token ausschließlich im Speicher (`AuthService.currentToken`), niemals im `localStorage` oder `IndexedDB`.
*   **Fehlerbehandlung:** Wirft Fehler bei Timeout (30s) oder falschen Zugangsdaten. Löst Client-seitige Ratenbegrenzung aus.

#### `register(email, password, passwordConfirm, name)`
Erstellt ein neues Benutzerkonto.
*   **Parameter:**
    *   `email` (string): Gültige E-Mail.
    *   `password` (string): Passwort.
    *   `passwordConfirm` (string): Passwortbestätigung.
    *   `name` (string, optional): Anzeigename.
*   **Rückgabewert:** `Promise<UserRecord>`
*   **Fehlerbehandlung:** Wirft Fehler bei ungleichen Passwörtern, zu einfachen Passwörtern oder Rate Limit.

#### `refresh()`
Erneuert die aktuelle Sitzung mit dem Backend und verlängert den Gültigkeitszeitraum.
*   **Rückgabewert:** `Promise<AuthResponse>` - Aktualisierter Token und Benutzerdatensatz.

#### `deleteUser(userId)`
Löscht das Benutzerkonto endgültig und meldet den Benutzer ab.
*   **Parameter:**
    *   `userId` (string): PocketBase-ID des Benutzers.
*   **Rückgabewert:** `Promise<boolean>` - `true` bei Erfolg.

#### `getToken()`
Gibt den aktuell aktiven JWT-Token zurück (sofern gültig und nicht abgelaufen).
*   **Rückgabewert:** `string | null`

#### `isAuthenticated()`
Prüft, ob der Benutzer angemeldet ist.
*   **Rückgabewert:** `boolean`

#### `clearToken()`
Meldet den Benutzer lokal ab, indem alle Sitzungsdaten im Arbeitsspeicher gelöscht werden.

---

## 2. DbService

Promise-basierter, leichtgewichtiger Wrapper um IndexedDB für das Offline-First Datenmanagement.

```javascript
import { db, storeMatchData, getMatchData } from '$lib/services/DbService.js';
```

### Methoden

#### `db.get(key)`
Liest einen Wert aus der Datenbank.
*   **Parameter:** `key` (string)
*   **Rückgabewert:** `Promise<any | undefined>`

#### `db.set(key, value)`
Speichert einen beliebigen serialisierbaren Wert in der Datenbank.
*   **Parameter:**
    *   `key` (string)
    *   `value` (any)
*   **Rückgabewert:** `Promise<void>`

#### `db.delete(key)`
Löscht einen Eintrag aus der Datenbank.
*   **Parameter:** `key` (string)
*   **Rückgabewert:** `Promise<void>`

#### `db.clear()`
Löscht die gesamte Datenbank.
*   **Rückgabewert:** `Promise<void>`

#### `storeMatchData(key, matchData)`
Validiert ein Match-Ergebnis anhand des **Zod-Schemas** (`matchSchema.js`) und speichert es ab.
*   **Parameter:**
    *   `key` (string)
    *   `matchData` (MatchPayload)
*   **Rückgabewert:** `Promise<void>`
*   **Fehlerbehandlung:** Wirft einen Fehler, wenn die Datenstruktur nicht dem Zod-Schema entspricht (z. B. fehlende Spieler oder Namen).

#### `getMatchData(key)`
Liest ein Match-Ergebnis aus und validiert es erneut vor der Rückgabe.
*   **Parameter:** `key` (string)
*   **Rückgabewert:** `Promise<MatchPayload | null>` - Gibt `null` zurück, wenn der Eintrag ungültig oder nicht vorhanden ist.

---

## 3. SyncService

Asynchrone Offline-First-Warteschlange (FIFO) zur Zwischenspeicherung und Synchronisierung von Spielergebnissen im Hintergrund.

```javascript
import { getSyncService } from '$lib/services/SyncService.js';
const syncService = getSyncService();
```

### Methoden

#### `enqueue(matchPayload)`
Fügt ein Match-Ergebnis der Warteschlange hinzu.
*   **Parameter:** `matchPayload` (MatchPayload)
*   **Sicherheit & Konsistenz:** Generiert automatisch eine eindeutige ID (`match_...`) und einen ISO-Zeitstempel, falls diese noch nicht existieren.
*   **UI-Integration:** Löst das Window-Event `sync-queue-updated` aus.

#### `dequeue()`
Entfernt das älteste Element (FIFO-Prinzip) aus der Warteschlange nach erfolgreichem Server-Upload.
*   **Rückgabewert:** `Promise<MatchPayload | null>`

#### `getQueue()`
Gibt ein Array aller aktuell wartenden Elemente zurück.
*   **Rückgabewert:** `Promise<MatchPayload[]>`

#### `size()`
Gibt die Anzahl der wartenden Elemente zurück.
*   **Rückgabewert:** `Promise<number>`

#### `processQueue(syncHandler)`
Verarbeitet alle anstehenden Uploads nacheinander.
*   **Parameter:** `syncHandler` (function): Asynchrone Callback-Funktion `(payload) => Promise<any>`.
*   **Resilienz-Strategie:**
    *   Bricht sofort ab, wenn das Gerät offline ist (`navigator.onLine === false`).
    *   Bricht die Verarbeitung sofort ab, wenn ein einzelner Upload fehlschlägt, um die chronologische Reihenfolge der Matches im Backend zu garantieren.
*   **Rückgabewert:** `Promise<boolean>` - `true` wenn alle Elemente erfolgreich hochgeladen wurden.

---

## 4. GamesCatalogService

Verantwortlich für das Laden und Cachen der Spiele-Konfiguration (Katalog).

```javascript
import { loadGamesCatalog } from '$lib/services/GamesCatalogService.js';
```

### Methoden

#### `loadGamesCatalog()`
Lädt die Spiele-Konfiguration über eine mehrstufige Ausfallstrategie.
1.  **Stufe 1 (Cache):** Liest die lokale Datenbank (`DbService`).
2.  **Stufe 2 (Online-Abruf):** Versucht, den Katalog vom PocketBase-Server mit einem Timeout von 10s abzurufen. Bei Erfolg wird der lokale DB-Cache überschrieben.
3.  **Stufe 3 (Fallback):** Schlägt der Abruf fehl (Timeout oder Offline), wird die lokale Fallback-Datei `games_config.json` geladen.
*   **Rückgabewert:** `Promise<Game[]>` - Liste aller verfügbaren Spiele.
