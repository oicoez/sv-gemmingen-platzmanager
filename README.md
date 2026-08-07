# ClubPlanner 5.0 – Sprint 2.2

## Änderungen
- FUSSBALL.DE `ABSE.` wird als `cancelled`/`abgesetzt` behandelt.
- Abgesetzte Spiele bleiben rot; in der Spalte **Ort** steht `abgesetzt` statt `noch offen`.
- Standardansicht zeigt nur Spiele, deren Datum und Anstoßzeit in Europe/Berlin noch nicht vergangen sind.
- Button **Vergangene Spiele anzeigen** blendet die Historie bei Bedarf wieder ein.
- Die Synchronisierung ergänzt Detail-Spielort/Adresse nur noch für kommende Heimspiele. Das reduziert externe Abrufe und beschleunigt den Sync.
- Vergangene Datensätze bleiben in `cp5_events` erhalten.
- Abgesetzte Spiele werden in späteren Konfliktprüfungen grundsätzlich ausgeschlossen.
