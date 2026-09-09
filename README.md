# ClubPlanner 5.0 – Sprint 4.4.6

Basis: Sprint 4.4.5.

Zusätzlicher Fix beim FUSSBALL.DE-Mannschaftsabgleich:
- `SG Stebbach/Gemmingen 2` = `SG Stebbach/Gemmingen2`
- `JSG Gemmingen/Stebbach 2` = `JSG Gemmingen/Stebbach2`
- gilt entsprechend auch für weitere Mannschaftsnummern

Weiterhin ignoriert:
- Leerzeichen rund um `/`
- Mehrfach-Leerzeichen
- geschützte Leerzeichen / unsichtbare Unicode-Zeichen
- Groß-/Kleinschreibung

Die Mannschaftsnummer selbst wird NICHT ignoriert. D1 und D2 bleiben also unterschiedliche Mannschaften.

Alle Funktionen aus 4.4.5 bleiben erhalten, einschließlich Spiele-Reset, Neuabgleich sowie manueller Spiel-/Trainingsbearbeitung.
