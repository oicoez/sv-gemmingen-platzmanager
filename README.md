# ClubPlanner 5.0 – Sprint 4.4.3

## FUSSBALL.DE Mehrquellen-Abgleich

Problem:
FUSSBALL.DE kann nach einer Spielverlegung in verschiedenen Ansichten vorübergehend
unterschiedliche Termine liefern. Beispiel Spiel 920109004:
- alter JSG-Stand: 16.09.2026 18:30
- aktueller 1.FC-Stebbach-/Gegner-Stand: 17.09.2026 19:00

Lösung:
- Beim Sync werden Vereinsspielpläne von SV Gemmingen UND 1.FC Stebbach geladen.
- Identische Partien werden über Spielnummer, ersatzweise externe ID, zusammengeführt.
- Für JSG/SG/Gemmingen-Stebbach-Mannschaften wird der 1.FC-Stebbach-Spielplan bevorzugt.
- Für reine SV-Gemmingen-Mannschaften wird SV Gemmingen bevorzugt.
- Anschließend laufen weiterhin Spielortprüfung, Auswärtsspiel-Bereinigung und Upsert.
- Manuelle Spielbearbeitung aus Sprint 4.4.2 bleibt erhalten.
