# ClubPlanner 4.1 – Modul 1 / Phase 3

Phase 3 behebt ausschließlich die fehlende Zuordnung von Datum und Anstoßzeit.

## Drei unabhängige Methoden
1. Nächstliegender vorheriger Datum-/Uhrzeit-Block in echter DOM-Reihenfolge.
2. Zuordnung Spiel-Link ↔ Datum-/Uhrzeit-Block nach Dokumentreihenfolge.
3. Roh-HTML-Rückwärtssuche direkt vor der exakten FUSSBALL.DE-Spiel-ID.

Die Detailseiten bleiben für Spielort und Adresse zuständig.

## Test
Der Button heißt `4.1 Phase-3 Testlauf`.
Der Kalender wird weiterhin NICHT verändert.

Render zeigt z.B.:
[FUSSBALL-4.1-P3] Übersicht: 111 Spiele · 111 Zeiten · 111 Paarungen
[FUSSBALL-4.1-P3] Zeitquellen: {"nearest-previous-dom":85,"document-sequence":26}
[FUSSBALL-4.1-P3] 1/52 | 2026-08-09 10:30 [nearest-previous-dom] | ... | Gemmingen | Beim Sportplatz 3, 75050 Gemmingen

Ziel vor Phase 4:
- withKickoff muss nahe/gleich total sein
- erkannte Heimspiele müssen eine echte Anstoßzeit besitzen
- Spielort/Adresse aus Phase 2 bleiben erhalten
