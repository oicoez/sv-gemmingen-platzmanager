# ClubPlanner 5.0 – Sprint 4.3.2

## Korrektur wiederkehrende Trainings

Bei `Wiederkehrendes Training` wird das einzelne Feld `Datum` ausgeblendet.
Eine Serie wird ausschließlich über Rhythmus, Wochentag, Startdatum und Enddatum gesteuert.

Der Speichern-Button verwendet jetzt tatsächlich die Trainingsserien-API.
Dadurch werden alle Termine im gewählten Zeitraum erzeugt.

Beispiel:
- wöchentlich
- Montag
- Start 07.09.2026
- Ende 31.05.2027

=> jeder Montag im Zeitraum wird als eigener Trainingstermin angelegt und erscheint in
Wochenplan, Monatsansicht und Dashboard.

## Korrektur FUSSBALL.DE Heim/Auswärts

ClubPlanner ist ein lokaler Platzbelegungsplaner.
Ein geplantes Spiel wird nur als lokale Belegung importiert, wenn:

- unsere Mannschaft Heimteam ist und
- der tatsächliche Spielort Gemmingen oder Stebbach ist.

Ein externer Spielort darf nicht allein wegen des Textes `SV Gemmingen`
als Gemmingen erkannt werden.

Damit soll z. B. das Auswärtsspiel der Frauen beim FC Odenheim 2 am 19.09.2026
nicht mehr im lokalen Kalender erscheinen.

Abgesetzte Spiele bleiben von der bisherigen ABSE.-Logik unberührt.

## Unverändert

- A/B-Platzaufteilung
- Trainings-/Spiel-Konflikte
- Kabinenkonflikte
- Dashboard
- Wochenansicht
- Monatsansicht
- Trainingsserienübersicht
