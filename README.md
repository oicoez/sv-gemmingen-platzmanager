# ClubPlanner – Sprint 3

## Neu
- FUSSBALL.DE-Synchronisierung direkt aus ClubPlanner
- Import läuft im Hintergrund mit Fortschrittsanzeige
- bereits importierte Spiele werden aktualisiert statt doppelt angelegt
- Heimspiele werden als Quelle `fussball.de` gespeichert
- Gegner, Wettbewerb, Datum, Uhrzeit, Status, Spielort, Adresse und Link werden übernommen
- Gemmingen/Stebbach werden automatisch erkannt, sofern FUSSBALL.DE die Spielstätte liefert
- unbekannter Spielort wird nicht verworfen, sondern mit `PRÜFEN` markiert
- Live-Konfliktprüfung beim manuellen Eintragen
- bestehende Sprint-2-Funktionen bleiben erhalten

## Render
Environment Variablen bleiben:
- EDIT_PIN
- DATABASE_URL

Optional:
- FUSSBALL_CLUB_ID = 00ES8GN9B8000051VV0AG08LVUPGND5I
- MIN_GAP_MINUTES = 180

## Wichtig
Sprint 3 verwendet Playwright/Chromium, damit FUSSBALL.DE wie über einen echten Browser gelesen werden kann.
Deshalb ändert sich auch der Dockerfile auf das offizielle Playwright-Image.

Auf dem Render-Free-Tarif kann die Synchronisierung je nach Anzahl der Spiele einige Minuten dauern.
Wenn FUSSBALL.DE seine Seitenstruktur stark ändert oder den Cloud-Browser blockiert, erscheint eine klare Fehlermeldung; bestehende Daten werden dabei nicht gelöscht.

## Deployment
Alle Dateien dieses Pakets in GitHub hochladen und vorhandene Dateien ersetzen.
Danach Render -> Manual Deploy -> Deploy latest commit.

Im Log sollte erscheinen:
Sprint 3 Datenbankstruktur ist bereit.
ClubPlanner Sprint 3 läuft auf Port 10000
