# ClubPlanner 5.0 – Sprint 4.3.7

## Trainingsserien-Fix auf dem richtigen clubplanner-v5 Stand

Dieser Sprint baut direkt auf Sprint 4.3.6 auf.
Der funktionierende FUSSBALL.DE-Auswärtsspiel-Fix bleibt unverändert.

### Korrekturen
- Beim Modus „Wiederkehrendes Training“ wird das einzelne Feld „Datum“ ausgeblendet.
- Für Serien gelten nur Rhythmus, Wochentag, Startdatum, Enddatum, Uhrzeit, Team, Ort, Platz und Belegung.
- Der Speichern-Button verwendet bei Serien die API `/api/v5/training-series`.
- Alle berechneten Serientermine werden als einzelne Trainings gespeichert.
- Wochenplan, Monatsansicht und Dashboard werden nach dem Speichern neu geladen.

### Beispiel
B-Jugend, wöchentlich, Montag, 07.09.2026 bis 31.05.2027, 18:00–19:30
=> jeder Montag im Zeitraum wird angelegt.
