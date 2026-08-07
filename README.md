# ClubPlanner – Sprint 3.3

Diese Version ersetzt den fehleranfälligen Playwright/Chromium-Scraper vollständig.

## Anstoßzeit
FUSSBALL.DE wird über die serverseitige Vereinsspielplan-Tabelle gelesen.
Für jede Spiel-ID werden Datum, Anstoßzeit und Status aus dem direkt zugehörigen Tabellenblock ermittelt.

## ABSE.
`ABSE.` / `Absetzung` wird nur aus derselben Spielzeile ausgewertet.
Ein Status aus einem benachbarten Spiel kann nicht mehr versehentlich übernommen werden.
Abgesetzte Spiele erzeugen weiterhin keine Platz- oder Kabinenkonflikte.

## Kein Hängen mehr
- kein Chromium / Playwright
- jeder FUSSBALL.DE-Abruf: 12–15 Sekunden Timeout
- gesamter Sync: 90 Sekunden Sicherheitsgrenze
- Fortschritt zusätzlich im Render-Log als `[FUSSBALL-SYNC] ...`
- Oberfläche zeigt während des Syncs `· aktiv`

## Geschwindigkeit
Bekannte Spiele werden direkt aus EINER geladenen Spielplanseite aktualisiert.
Detailseiten werden ausschließlich für neue, wahrscheinlich echte Heimspiele benötigt und bis zu fünf gleichzeitig geladen.

## Bestehende falsche 00:00-Werte
Beim Start werden alte FUSSBALL.DE-Einträge mit `00:00` zunächst als `Anstoßzeit offen` gekennzeichnet.
Beim nächsten erfolgreichen Sync werden sie mit den echten Tabellenzeiten ersetzt.
In der Oberfläche erscheint bis dahin `OFFEN`, nicht irreführend `00:00`.

## Deployment
1. Kompletten Inhalt in das bestehende GitHub-Repository hochladen und Dateien ersetzen.
2. Render -> Manual Deploy -> Deploy latest commit.
3. Log prüfen:
   - `Sprint 3.3 Datenbankstruktur ist bereit.`
   - `ClubPlanner Sprint 3.3 läuft auf Port 10000`
4. Einmal `FUSSBALL.DE synchronisieren` drücken.
