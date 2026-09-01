# ClubPlanner 5.0 – Sprint 4.3.3

## FUSSBALL.DE: alte falsch importierte Auswärtsspiele bereinigen

Sprint 4.3.2 verhindert neue lokale Platzbelegungen für externe Spielorte.
Bereits früher falsch importierte Datensätze blieben jedoch bisher in der Datenbank stehen.

Sprint 4.3.3 entfernt beim nächsten FUSSBALL.DE-Sync automatisch einen alten Datensatz,
wenn das Spiel nun als Auswärtsspiel bzw. externer Spielort erkannt wird.

Beispiel:
Frauen SV Gemmingen – FC Odenheim 2, tatsächlicher Spielort
`Am Felsenkeller 12, 76684 Östringen` → keine lokale Platzbelegung.

Die Render-Logs zeigen zusätzlich den erkannten Venue-Text zur Kontrolle.

Unverändert bleiben ABSE.-Logik, Trainingsserien, A/B-Aufteilung,
Kabinen- und Konfliktlogik sowie Woche/Monat/Dashboard.
