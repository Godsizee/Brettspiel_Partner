# Brettspiel Partner

Moin. Das hier ist mein digitaler Brettspiel-Begleiter für Scoring, Zeitmessung und Spielverlauf-Historie. Gebaut als installierbare, offline-fähige Progressive Web App (PWA) – falls der Spieleabend mal wieder im Keller ohne Netz stattfindet.

## Features

- **Offline-First:** Läuft komplett ohne Internet. Aktionen landen in einer lokalen IndexedDB-Warteschlange und syncen im Hintergrund, sobald wieder Netz da ist.
- **Resilienter Timer:** Der Game-Timer basiert auf absoluten Zeitstempeln. Browser-Suspendierungen, geschlossene Tabs oder Akkusparmodi bringen ihn nicht aus dem Takt.
- **Wertungsbögen:** Dynamisch je nach Spiel konfigurierbar.
- **Verlauf & Stats:** Auswertung der Partien inklusive Head-to-Head Duellen, Trends und Radar-Charts.
- **User-Profile:** Passwort-Reset per Mail, Farbwahl für den Spieler und DSGVO-konformer JSON-Datenexport.
- **Wiki & Regelfragen:** Integriertes Mini-Wiki mit taktischen Tipps und Lightbox für Regelauszüge – direkt im Spiel als Overlay aufrufbar.

## Tech Stack

- **Frontend:** Svelte 5 (Runes), Tailwind CSS v4, Vite 8, Lucide Icons
- **Datenbank & Sync:** IndexedDB (lokal), PocketBase (remote)
- **Validierung:** Zod v3
- **Deployment:** Docker-ready, optimiert für Coolify.
- **Tests:** Vitest für Unit-Tests, Playwright für E2E-User-Flows.

## Security-Härtung

- **Memory-Only Tokens:** JWT-Tokens liegen nur im flüchtigen RAM, um XSS-Angriffe (Auslesen von localStorage) abzuwehren.
- **Rate Limiting:** Brute-Force-Schutz für Login und Registrierung direkt im Frontend.
- **Race-Condition-Schutz:** Mehrfachklicks beim Speichern werden blockiert, um Dubletten im Backend zu verhindern.
- **API-Timeout-Wrapper:** Verhindert Hänger bei instabilem Edge-Netzwerk im Keller.
