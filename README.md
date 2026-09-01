# ClubPlanner 5.0 – Sprint 4.3.1

## Fehlerkorrektur Trainingsserien

Sprint 4.3 erzeugte wiederkehrende Trainingstermine bereits korrekt.
Beim Laden der Übersicht `Trainingsserien` trat jedoch ein interner Serverfehler auf.

### Ursache
Die bestehende Tabelle `cp5_training_series` speichert `team_id` als Text.
Die Mannschaftstabelle `cp5_teams` verwendet UUID.
Beim Join der Serienübersicht verglich PostgreSQL deshalb UUID mit Text.

### Korrektur
Der Join wird nun explizit kompatibel ausgeführt (`t.id::text = s.team_id`).

### Unverändert
- bereits erzeugte Trainingstermine
- wöchentlich
- alle 2 Wochen
- monatlich
- 1./2./3./4./letzter Wochentag im Monat
- Wochenplan
- Monatsansicht
- Dashboard
- Gesamt / Hälfte A / Hälfte B
- Spiel-vs-Training-Konflikte
- Kabinenkonflikte
- FUSSBALL.DE-Import
