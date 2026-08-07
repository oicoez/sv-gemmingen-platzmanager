# ClubPlanner 4.0 – Phase 1

Phase 1 ersetzt den bisherigen FUSSBALL.DE-Importer vollständig durch ein eigenes Modul.

## Neue Projektstruktur

```text
server.js

database/
  db.js

services/
  fussballde-importer.js
  sync-state.js

public/
  index.html
```

## Neuer FUSSBALL.DE-Import

Ablauf:

1. Vollständigen Vereinsspielplan des SV Gemmingen laden.
2. Alle eindeutigen FUSSBALL.DE-Spiel-IDs sammeln.
3. Jede Spiel-Detailseite einzeln öffnen.
4. Heim-/Auswärtsteam aus dem Seitentitel bestimmen.
5. Nur echte Heimspiele des Vereins in ClubPlanner übernehmen.
6. Pro Heimspiel speichern/aktualisieren:
   - FUSSBALL.DE-Spiel-ID
   - Spielnummer
   - Mannschaft
   - Gegner
   - Wettbewerb
   - Datum
   - Anstoßzeit
   - Status
   - Spielort
   - Adresse
   - Platz
   - Link zur Original-Spielseite
   - Zeitpunkt der letzten Synchronisierung
7. Bereits bekannte Spiele werden anhand der Spiel-ID aktualisiert statt dupliziert.
8. Unveränderte Spiele werden über einen Daten-Hash erkannt.

## Status / ABSE.

Der Spielstatus wird aus der konkreten Spielzeile des Vereinsspielplans übernommen. Die globale FUSSBALL.DE-Legende auf Detailseiten wird bewusst nicht für die Statusbestimmung verwendet, damit nicht versehentlich alle Spiele als `abgesetzt` erkannt werden.

`ABSE.` / `Absetzung` => `abgesetzt`.

Abgesetzte Spiele bleiben im Kalender sichtbar, blockieren aber keine Platz-/Kabinenressourcen.

## Anstoßzeit

Die Detailseite wird mit mehreren Strategien nach der Anstoßzeit durchsucht (sichtbarer Text, HTML-/JSON-Daten). Als verlässlicher Fallback wird die eindeutig dem Spiel zugeordnete Uhrzeit aus dem Vereinsspielplan verwendet.

Wenn FUSSBALL.DE wirklich keine Uhrzeit veröffentlicht, wird `kickoff_known=false` gespeichert und die Oberfläche zeigt `OFFEN` statt fälschlich `00:00`.

## Spielort / Adresse

Auf der Detailseite wird die Spielstätte einschließlich Karten-/Adresslink ausgewertet. Für die bekannten Anlagen werden normalisiert:

- Gemmingen: `Beim Sportplatz 3, 75050 Gemmingen`
- Stebbach: `Jahnweg 1, 75050 Gemmingen-Stebbach`

Ein Heimspiel nutzt die Gesamtfläche des erkannten Haupt-/Trainingsplatzes. Kabinenfelder bleiben bei Spielen leer.

## Offizielle Mannschaften

Die acht FUSSBALL.DE-Mannschaftsbezeichnungen werden weiter als Standardteams geführt. Selbst angelegte zusätzliche Mannschaften bleiben erhalten.

## Stabilität / Geschwindigkeit

- 6 Detailseiten parallel
- 12 Sekunden Timeout pro Detailseite
- 15 Sekunden Timeout für Vereinsspielplan
- 120 Sekunden Gesamtsicherheitsgrenze
- Fehler eines einzelnen Spiels stoppen den Gesamtimport nicht
- `/api/sync/report` liefert bis zu 30 aktuelle Importhinweise/Fehler
- Render-Log beginnt mit `[FUSSBALL-4.0]`

## Datenbank-Erweiterung

Beim Start werden automatisch ergänzt:

- `game_number`
- `import_hash`
- `last_synced_at`

Bestehende Supabase-Datenbank und manuell angelegte Termine bleiben erhalten.

## Deployment

1. Kompletten Inhalt dieses Pakets in das bestehende GitHub-Repository hochladen und vorhandene Dateien ersetzen.
2. `EDIT_PIN` und `DATABASE_URL` in Render unverändert lassen.
3. Render: `Manual Deploy -> Deploy latest commit`.
4. Im Log müssen erscheinen:

```text
ClubPlanner 4.0 Phase 1 Datenbankstruktur ist bereit.
ClubPlanner 4.0 Phase 1 läuft auf Port 10000
```

5. Danach im ClubPlanner den Kalender für einen sauberen Test optional zurücksetzen und `FUSSBALL.DE synchronisieren` drücken.

Im Render-Log sind Fortschrittsmeldungen sichtbar, z. B.:

```text
[FUSSBALL-4.0] 95 Spiele gefunden. Detailseiten werden geprüft …
[FUSSBALL-4.0] Spiel 1/95 wird geöffnet …
```
