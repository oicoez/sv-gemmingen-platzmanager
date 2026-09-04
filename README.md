# ClubPlanner 5.0 – Sprint 4.3.4

## Bereinigung bereits falsch gespeicherter Auswärtsspiele

Der Screenshot nach Sprint 4.3.3 zeigt: FUSSBALL.DE erkennt einen externen Spielort, der alte Datensatz bleibt aber bestehen. Ursache: Der alte Datensatz kann eine andere `external_id` besitzen.

Sprint 4.3.4 löscht deshalb beim Erkennen eines Auswärtsspiels nicht nur über `external_id`, sondern zusätzlich über die Spielidentität **Datum + externer Gegner + Gemmingen/Stebbach-Mannschaft**.

Damit wird insbesondere der alte Datensatz vom **19.09.2026 Frauen – SV Gemmingen / FC Odenheim 2** beim nächsten Sync entfernt, wenn die Detailseite FC Odenheim 2 als Heimteam bzw. einen externen Spielort liefert.

Die übrige Kalender-, Trainingsserien-, A/B-, Kabinen- und Konfliktlogik bleibt unverändert.
