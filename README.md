# ClubPlanner 5.0 – Sprint 4.3.6

## Echte Auswärtsspiele werden jetzt aktiv bereinigt

Bisher wurden nur Heimspiele und externe Spielorte im Heimspiel-Pfad geprüft.
Ein echtes Auswärtsspiel wurde vorher aus diesem Pfad entfernt und konnte deshalb
einen alten falschen Heimspiel-Datensatz in ClubPlanner zurücklassen.

Sprint 4.3.6 prüft zusätzlich alle Spiele, bei denen unsere Mannschaft auf der
Auswärtsseite des FUSSBALL.DE-Spielplans steht.

Für solche Spiele wird ein eventuell alter lokaler Datensatz gelöscht über:
1. external_id
2. Fallback: Datum + lokales Team + externer Gegner

Beispiel:
19.09.2026
FC Odenheim 2 – SV Gemmingen
Am Felsenkeller 12, 76684 Östringen

Dieser Datensatz darf nach dem nächsten Sync nicht mehr in der lokalen
Spieleliste, Wochenansicht oder Monatsansicht stehen.

Die sichtbare Versionsanzeige wurde ebenfalls auf Sprint 4.3.6 vereinheitlicht.
