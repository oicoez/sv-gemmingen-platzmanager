# ClubPlanner 5.0 – Sprint 4.4.4

## Korrektur FUSSBALL.DE
- SV Gemmingen ist bei identischen Partien jetzt die Hauptquelle.
- 1. FC Stebbach bleibt nur Fallback, wenn ein Spiel im Gemminger Vereinsspielplan fehlt.
- Identische Spiele werden weiterhin über Spielnummer bzw. externe ID zusammengeführt.
- Dadurch wird ein aktueller Gemminger Termin nicht mehr durch einen älteren Stebbacher Stand überschrieben.

## Neuer Vollreset für Spiele
Im Bereich Spiele gibt es „Alle Spiele löschen“.
- löscht ausschließlich aus FUSSBALL.DE importierte Spiele
- Trainings und Trainingsserien bleiben unangetastet
- Mannschaften, Plätze und Kabinen bleiben unangetastet
- doppelte Sicherheitsabfrage
- danach FUSSBALL.DE synchronisieren = kompletter Neuaufbau der Spiele aus dem aktuellen offiziellen Spielplan

Manuelle Spiel- und Trainingsbearbeitung bleibt erhalten.
