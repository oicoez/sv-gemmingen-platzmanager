# ClubPlanner 4.4 – direkter FUSSBALL.DE-Spielplan

4.4 entfernt Playwright wieder vollständig.

## Datenquelle
Verwendet wird der FUSSBALL.DE-Endpunkt:
`/ajax.club.matchplan/...`

Dieser Spielplan enthält bereits:
- Datum
- Anstoßzeit
- Mannschaftsart
- Wettbewerb
- Spielnummer
- Heimteam
- Gastteam
- Status / Absetzung
- Link zum Spiel

ClubPlanner testet mehrere URL-Varianten:
- ajax-default
- ajax-max-a
- ajax-max-b
- ajax-season
- print-season

Die Ergebnisse werden über Spiel-ID bzw. Spielnummer zusammengeführt.

## Test
Button: `4.4 Direkt-Spielplan-Test`

Der Kalender wird noch nicht verändert.

Render zeigt pro Quelle:
`[FUSSBALL-4.4] QUELLE ajax-default | 10 Spiele | 10 Datum | 10 Zeiten | ...`

Danach:
`[FUSSBALL-4.4] Test fertig: ...`

Das wichtigste Ziel ist zunächst, mindestens eine Quelle mit echten Datum-/Anstoßzeitwerten auf Render zu bestätigen.
