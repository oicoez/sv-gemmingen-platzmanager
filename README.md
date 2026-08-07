# ClubPlanner 5.0 – Sprint 3

## Neue Trainings- und Platzlogik
Jeder Haupt- und Trainingsplatz besitzt:
- Gesamt
- Hälfte A
- Hälfte B

Standardmodus eines Trainings ist `flexibel`.

Beispiel:
- B-Junioren 18:00–19:30 Hauptplatz Gemmingen
- Herren 19:00–20:30 Hauptplatz Gemmingen

ClubPlanner zeigt:
- 18:00–19:00 B-Junioren – Gesamt
- 19:00–19:30 B-Junioren – Hälfte A / Herren – Hälfte B
- 19:30–20:30 Herren – Gesamt

Das ist ausdrücklich KEIN Konflikt.

Konflikte entstehen u. a. bei:
- mehr als zwei Mannschaften gleichzeitig auf demselben Platz
- Spiel + Training gleichzeitig auf demselben Platz
- Gesamtplatz exklusiv + weitere Belegung
- zwei feste Buchungen derselben Hälfte

## Oberfläche
Neue Bereiche:
- Wochenplan
- Training eintragen
- Spiele

Neben `flexibel` können Trainings auch fest auf Hälfte A/B oder exklusiv auf Gesamt gebucht werden.
