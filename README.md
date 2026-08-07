# ClubPlanner 4.3

## Architektur
4.3 verwendet erstmals einen echten Chromium-Browser über Playwright.

### Vereinsseite
- JavaScript wird vollständig ausgeführt.
- `Mehr laden` wird automatisch geklickt.
- alle sichtbaren Spiel-Links werden gesammelt.

### Einzelne Spiele
Bis zu vier Detailseiten werden parallel geöffnet.
ClubPlanner überwacht dabei:
- `fetch`
- XHR
- JSON-Antworten
- JSON-LD
- eingebettete JSON-Daten
- vollständig gerenderten DOM

Aus diesen Quellen werden gesucht:
- Datum
- Anstoßzeit
- Heimteam
- Gastteam
- Wettbewerb
- Status
- Spielnummer
- Spielstätte
- Adresse

## Render
Der Docker-Build installiert Chromium automatisch:
`npx playwright install --with-deps chromium`

Der erste Build kann deshalb deutlich länger dauern als bisher.

## Sicherheit
Der Button `4.3 Browser-/Netzwerk-Test` verändert noch keine Kalenderdaten.

Render-Log:
[FUSSBALL-4.3] TEST START
[FUSSBALL-4.3] 1/95 | 2026-08-09 10:30 | ... | NET:3 | ...
...
[FUSSBALL-4.3] Test fertig: ...

Wichtigster Wert:
`withNetworkData` zeigt, bei wie vielen Spielen JSON/XHR/Fetch-Daten abgefangen wurden.
