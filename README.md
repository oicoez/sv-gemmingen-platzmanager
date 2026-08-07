# ClubPlanner – Sprint 3.4

## Korrekturen
- Fehler `externalIdFromUrl is not defined` behoben.
- FUSSBALL.DE-Synchronisierung kann wieder gestartet werden.
- Importierte Spiele erhalten keine Heim-/Gastkabine mehr.
- Bereits vorhandene FUSSBALL.DE-Spiele werden beim Start/Sync von alten Kabinenzuordnungen bereinigt.
- Bei manuell gewählter Art `Heimspiel` werden die Kabinenfelder ausgeblendet.

## Kalender zurücksetzen
Im Bearbeitungsmodus gibt es einen neuen Button `Kalender zurücksetzen`.

Sicherheitsablauf:
1. Warnabfrage.
2. Bearbeitungs-PIN erneut eingeben.
3. PIN wird serverseitig geprüft.
4. Zweite letzte Bestätigung.
5. Erst dann werden ALLE Kalendertermine gelöscht.

Nicht gelöscht werden:
- Mannschaften
- Plätze
- Kabinen
- Datenbankstruktur

Danach kann der FUSSBALL.DE-Spielplan komplett frisch synchronisiert werden.

## Deployment
Wie bisher gesamten Inhalt nach GitHub hochladen und vorhandene Dateien ersetzen.
Dann Render -> Manual Deploy -> Deploy latest commit.

Im Log:
- Sprint 3.4 Datenbankstruktur ist bereit.
- ClubPlanner Sprint 3.4 läuft auf Port 10000
