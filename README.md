# ClubPlanner 4.2

## Neue Import-Architektur
Der Vereinsspielplan wird nur noch verwendet, um alle eindeutigen FUSSBALL.DE-Spiel-Links einzusammeln.

Danach wird JEDE Detailseite einzeln gelesen.

Pro Spiel versucht ClubPlanner 4.2 zu ermitteln:
- Datum
- Anstoßzeit
- Heimteam
- Gastteam
- Wettbewerb
- Status
- Spielnummer
- Spielstätte
- Ort
- Adresse

## Datum/Anstoßzeit – mehrere Methoden
1. `<time datetime="...">`
2. JSON-LD / eingebettete JSON-Daten
3. expliziter sichtbarer Datum-/Uhrzeittext auf der Detailseite

## Stabilität
- jede Detailseite: 12 Sekunden Timeout
- maximal 5 Seiten parallel
- einzelne Fehler stoppen den Gesamtlauf nicht
- ausführliche Render-Logs pro Spiel

## Sicherer Test
Der Button `4.2 Detailseiten-Test` schreibt noch NICHT in den Kalender.

Ziel:
- möglichst alle Detailseiten parsed
- Heimspiele mit echten Datum/Anstoßzeit
- bekannte Heimspielstätten mit Ort/Adresse

Erst nach einem erfolgreichen Test wird die produktive Supabase-Synchronisierung auf 4.2 umgestellt.
