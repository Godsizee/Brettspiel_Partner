# AGENTS.md – Brettspiel Partner

> KI-Anweisungen für dieses Projekt. Gültig für Claude, Copilot, Perplexity und alle weiteren Agenten.

---

## Projektkontext (kurz)

**Brettspiel Partner** ist eine offline-fähige PWA für Scoring, Timer und Spielverlauf-Tracking.  
Stack: **Svelte 5 (Runes) · Tailwind CSS v4 · PocketBase · IndexedDB · Zod · Vite · Docker/Coolify**  
Prinzip: **Offline-First, resilient, datenschutzfreundlich (DSGVO), sicherheitsgehärtet.**

---

## 🪙 Token-Sparregeln — IMMER einhalten

Token sind Geld. Jede unnötige Ausgabe kostet Ressourcen. Halte dich strikt an diese Regeln:

- **Kein unaufgefodertes Wiederholen** von Code, der bereits existiert. Zeige nur geänderte Teile.
- **Kein Boilerplate-Füller.** Keine Kommentare wie `// rest of component remains the same`.
- **Diff-Stil bevorzugen.** Bei kleinen Änderungen nur den relevanten Block zeigen, nicht die ganze Datei.
- **Keine Erklärungen, die nicht verlangt wurden.** Direkt zur Lösung, kein Preamble.
- **Keine alternativen Lösungen anbieten**, es sei denn, der User fragt explizit danach.
- **Keine Zusammenfassungen** am Ende einer Antwort, die das Gesagte paraphrasieren.
- **Imports weglassen**, wenn sie offensichtlich sind oder bereits vorhanden. Nur neue/unbekannte Imports zeigen.
- **Typen und Schemas kompakt halten.** Kein ausschweifendes JSDoc für triviale Felder.

---

## Architektur-Prinzipien

### Offline-First
- Alle Datenmutationen gehen zuerst in **IndexedDB** (Sync-Queue), dann zum PocketBase-Backend.
- Kein direktes API-Schreiben ohne Queue-Fallback.
- Timer basieren immer auf **absoluten Zeitstempeln** (`Date.now()`), nie auf Intervall-Counting.

### Svelte 5 Runes
- State ausschließlich mit `$state`, `$derived`, `$effect` — **kein Legacy-`writable`-Store**.
- Reaktivität minimal halten: `$derived` statt `$effect` wo möglich.
- Keine unnötigen `$effect`-Chains. Side-Effects so selten wie möglich.

### PocketBase-Integration
- API-Calls immer mit **Timeout-Wrapper** absichern (Referenz: bestehende Implementierung in `src/lib/api`).
- JWT-Tokens **nur im RAM** (kein localStorage, kein sessionStorage).
- Zod-Schemas für alle eingehenden API-Responses validieren.

### Security — nicht verhandelbar
- **Kein Token im persistenten Storage.** Memory-only.
- Rate-Limiting-Guards bei Auth-Endpunkten beibehalten.
- Race-Condition-Schutz bei Schreiboperationen: Mehrfachklicks blockieren.

### UI/Styling
- Tailwind CSS v4 — keine inline-`style`-Attribute, außer für dynamische Werte (z. B. Spielerfarben).
- Lucide Icons als einzige Icon-Library.
- Kein eigenes CSS schreiben, wenn Tailwind-Klassen ausreichen.

---

## Dateistruktur-Konventionen

```
src/
  lib/
    api/        # PocketBase-Wrapper, Timeout-Logik
    db/         # IndexedDB-Queue-Logik
    schemas/    # Zod-Validierungsschemas
    stores/     # Svelte 5 Runes-State (kein writable)
  routes/       # SvelteKit-Routen
  components/   # Wiederverwendbare UI-Komponenten
pb_hooks/       # PocketBase Server-Hooks (JS)
games_config.json  # Spiel-Konfiguration (scoring, wiki, etc.)
```

- Neue Spiele ausschließlich in `games_config.json` — kein Hardcoding in Komponenten.
- Komponenten sind **single-responsibility**: Eine Komponente, eine Aufgabe.

---

## Testing

- **Unit-Tests** mit Vitest: Alle Berechnungslogiken (Scoring, Timer, Sync-Queue).
- **E2E-Tests** mit Playwright: Kritische User-Flows (Login, Spiel starten, Score speichern, Offline → Sync).
- Tests beim Ändern bestehender Logik mitpflegen — kein Dead-Code in Tests lassen.

---

## Was Agents NICHT tun sollen

- ❌ `localStorage` oder `sessionStorage` für Auth-Daten vorschlagen
- ❌ Svelte Legacy-Stores (`writable`, `readable`) neu einführen
- ❌ Externe Styling-Libraries (Bootstrap, MUI etc.) vorschlagen
- ❌ Direkte API-Aufrufe ohne Offline-Fallback implementieren
- ❌ Vollständige Dateien ausgeben, wenn nur ein Diff nötig ist
- ❌ Ungebetene Refactorings außerhalb des besprochenen Scopes

---

## Schnellreferenz Tech-Stack

| Bereich | Technologie |
|---|---|
| Frontend | Svelte 5 (Runes), Tailwind v4 |
| Build | Vite 8 |
| Validierung | Zod v3 |
| Lokale DB | IndexedDB |
| Remote DB | PocketBase |
| Deployment | Docker, Coolify |
| Tests | Vitest, Playwright |
| Icons | Lucide |

---

*Letzte Aktualisierung: Juli 2026*
