/// <reference path="../pb_data/types.d.ts" />

// P0.1 — Rollen-Eskalation verhindern:
// `users.createRule` verbietet ein client-seitiges `role`-Feld
// (`@request.body.role:isset = false`). Da `role` aber required ist,
// setzt dieser Hook den Default serverseitig, bevor validiert wird.
// Superuser (PB-Admin-UI) dürfen die Rolle weiterhin explizit setzen.
//
// Deployment: Ordner `pb_hooks/` neben der PocketBase-Binary ablegen
// bzw. auf dem Live-Server aktualisieren und PocketBase neu starten.
onRecordCreateRequest((e) => {
    if (!e.hasSuperuserAuth()) {
        e.record.set("role", "user");
    }
    e.next();
}, "users");
