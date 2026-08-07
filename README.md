# ClubPlanner 5.0 – Sprint 3.2

## Korrekturen
1. `Aktuelle Woche` kommt jetzt vom Server mit Zeitzone Europe/Berlin.
   Die Browser-Uhr wird dafür nicht mehr verwendet.

2. Monatsansicht:
   - alle lokalen Spiele
   - alle Trainings
   - automatische A/B-Teilung
   - Konflikte
   - sichtbare Fehlermeldung statt leerer Ansicht, falls die API nicht antwortet.

3. Trainingsliste:
   Die Tabelle fragt gleichzeitig die Planner-Engine ab. Betroffene Trainings
   werden rot markiert und zeigen den Konfliktpartner, auch wenn dieser ein
   synchronisiertes FUSSBALL.DE-Spiel ist.

4. Neues Dashboard:
   Startseite mit der aktuellen Woche:
   - Anzahl Spiele
   - Anzahl Trainings
   - Anzahl Konflikte
   - chronologische Liste aller Wochen-Termine
   - Platz und dynamische Belegung Gesamt/A/B

## Fachlogik
Die Planner-Engine bleibt die einzige Quelle für Wochenplan, Monat, Dashboard
und Konfliktanzeige. Dadurch sollen unterschiedliche Ergebnisse zwischen den
Ansichten vermieden werden.
