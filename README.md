# ClubPlanner – Sprint 3.1

Korrekturen:
- Anstoßzeit wird primär aus dem FUSSBALL.DE-Vereinsspielplan gelesen.
- Bestehende importierte Spiele werden beim erneuten Sync mit der echten Uhrzeit aktualisiert.
- `ABSE.` / Absetzung / Spielabsetzung wird als `abgesetzt` gespeichert.
- Abgesetzte Spiele blockieren weder Platz noch Kabinen.
- Abgesetzte Spiele werden im Kalender und Belegungsplan als `ABGESETZT` angezeigt.
- Bei einem abgesetzten Spiel ohne Spielort erscheint nicht mehr irreführend `PRÜFEN`.
- Wochenansicht funktioniert nach dem erneuten Sync mit den echten Anstoßzeiten.
- Cloud-DB-Zähler wird nach einer Synchronisierung aktualisiert.

Nach dem Deploy einmal `FUSSBALL.DE synchronisieren` drücken.
Die vorhandenen importierten Spiele werden anhand ihrer FUSSBALL.DE-ID aktualisiert und nicht doppelt angelegt.
