# ClubPlanner 5.0 – Sprint 4.4.2

## Spiele direkt bearbeiten
- Spiele im Monatskalender, Wochenplan und in der Spieleliste sind anklickbar.
- Änderbar: Datum, Anstoßzeit, Ort und Platz.
- Die manuelle Änderung gilt bis zum nächsten FUSSBALL.DE-Sync.
- Beim nächsten Sync wird wieder der offizielle FUSSBALL.DE-Stand übernommen.

## FUSSBALL.DE Vollabgleich
Bei jeder Synchronisierung wird der komplette Saisonspielplan der aktiven Mannschaften frisch geladen.
Der Abruf erfolgt ausdrücklich ohne Cache.

Bereits importierte Spiele werden nicht nur anhand der externen Spiel-ID erkannt,
sondern zusätzlich über:
- Spielnummer
- Mannschaft
- Gegner

Dadurch können auch Verlegungen erkannt werden, wenn sich eine externe Kennung ändert.
Geänderte Werte werden aktualisiert:
- Datum
- Uhrzeit
- Spielort
- Platz/Adresse
- Status
- Gegner/Wettbewerb

Alte Dubletten derselben offiziellen Partie werden entfernt.
Der vorhandene Auswärtsspiel-/externe-Spielort-Fix bleibt erhalten.
