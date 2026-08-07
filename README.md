# ClubPlanner 5.0 – Sprint 3.1

## Korrektur Wochenplan
PostgreSQL liefert `date`-Felder im Node-Treiber teilweise als Date-Objekt.
Sprint 3 hat diese Werte mit `String(...).slice(0,10)` behandelt. Dadurch
entstanden Schlüssel wie `Tue Aug 11` statt `2026-08-11`; die gespeicherten
Termine konnten den Tagen im Wochenplan nicht zugeordnet werden.

Sprint 3.1 normalisiert Datenbank-Datumswerte jetzt zuverlässig auf YYYY-MM-DD.

Damit erscheinen:
- manuelle Trainings
- synchronisierte lokale Heimspiele
- reale Konflikte

im selben Wochenplan.

## Konfliktbeispiel
Drei Belegungen 18:00–19:30 auf demselben Hauptplatz – insbesondere mit
`Gesamtplatz exklusiv` – werden jetzt sichtbar und als Konflikt markiert.

## Monatsübersicht
Neue Ansicht `Monat`:
- alle lokalen Spiele
- alle Trainings
- Uhrzeiten
- Gemmingen / Stebbach
- Hauptplatz / Trainingsplatz
- A/B-Teilung
- Konflikte

Die Wochen- und Monatsansicht greifen auf dieselbe Planner-Engine zu.
