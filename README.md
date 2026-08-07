# ClubPlanner 4.1 – Modul 1 / Phase 1

Diese Phase ersetzt noch NICHT den produktiven Kalenderimport. Sie baut und testet zuerst die neue FUSSBALL.DE-Erkennung isoliert.

## Neu
`services/fussballde-v41-engine.js`

Die Engine:
- lädt die aktuelle Vereinsseite von SV Gemmingen,
- findet alle eindeutigen Spiel-Links,
- ordnet jedem Spiel Datum, Anstoßzeit, Wettbewerb, Spielnummer, Heimteam, Gastteam und Status zu,
- schreibt dabei noch nichts in Supabase.

## Test-Endpunkt
Im Bearbeitungsmodus kann technisch `/api/v41/preview` mit der Bearbeitungs-PIN aufgerufen werden.
Die Antwort enthält:
- `validation.total`
- `validation.withKickoff`
- `validation.withTeams`
- `validation.issues`
- alle erkannten Spiele

Im Render-Log erscheint:
`[FUSSBALL-4.1] Preview: ...`

Phase 2 wird erst auf diesen geprüften Datensätzen aufbauen und dann Detailseiten für Spielstätte/Adresse ergänzen.
