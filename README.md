# ClubPlanner 5.0 – Sprint 4.3.5

## Korrektur am tatsächlich verwendeten FUSSBALL.DE-Import

Die bisherige Bereinigung in Sprint 4.3.3/4.3.4 griff teilweise in einem älteren Importer.
Die ClubPlanner-5.0-Oberfläche verwendet jedoch den aktiven Import unter:

- `src/services/fussballde/sync-service.js`
- `src/repositories/event-repository.js`
- Tabelle `cp5_events`

Sprint 4.3.5 korrigiert genau diesen produktiven Pfad.

### Externe Spiele / alte falsche Heimspiele

Wenn FUSSBALL.DE auf der offiziellen Spieldetailseite einen externen Spielort erkennt,
wird ein eventuell früher falsch gespeicherter lokaler Datensatz jetzt gelöscht über:

1. `external_id`, oder – falls ein alter Import eine andere ID besitzt –
2. `Datum + Heimteam + Gegner`.

Beispiel:
- 19.09.2026
- Frauen – SV Gemmingen
- Gegner FC Odenheim 2
- tatsächlicher Spielort Am Felsenkeller 12, 76684 Östringen

Nach dem nächsten FUSSBALL.DE-Sync darf dieser Datensatz nicht mehr in
„Lokale Spiele / Platzbelegung“, Wochenplan oder Monatskalender vorhanden sein.

Die bestehende Trainingsserien-, A/B-, Kabinen-, ABSE.- und Konfliktlogik bleibt unverändert.
