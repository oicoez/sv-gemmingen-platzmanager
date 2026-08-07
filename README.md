# ClubPlanner – Sprint 3.5

## FUSSBALL.DE
- Anstoßzeit wird aus dem aktuellen SV-Gemmingen-Vereinsspielplan gelesen.
- Heimspiel-Spielstätte und Adresse werden zusätzlich auf der jeweiligen Spiel-Detailseite geprüft.
- ABSE./Absetzung wird nur dem konkreten Spiel zugeordnet.
- Alte falsche 00:00/ABGESETZT-Werte werden beim Sync durch den aktuellen Stand überschrieben.

## 8 offizielle Mannschaften
Die Mannschaftsverwaltung enthält die aktuell auf FUSSBALL.DE geführten Teams:
1. Herren - SG Stebbach/Gemmingen
2. Herren - SG Stebbach/Gemmingen 2
3. A-Junioren - JSG Gemmingen / Stebbach
4. B-Junioren - JSG Gemmingen/Stebbach
5. C-Junioren - JSG Gemmingen/Stebbach
6. C-Junioren - JSG Gemmingen/Stebbach 2
7. D-Junioren - JSG Gemmingen/Stebbach
8. Frauen - SV Gemmingen

Selbst angelegte zusätzliche Mannschaften bleiben erhalten.

## Platzaufteilung
Je Standort:
- Hauptplatz – Gesamt
- Hauptplatz – Hälfte A
- Hauptplatz – Hälfte B
- Trainingsplatz – Gesamt
- Trainingsplatz – Hälfte A
- Trainingsplatz – Hälfte B

Konfliktlogik:
- Hälfte A + Hälfte B = erlaubt.
- Gesamt + Hälfte A/B = Konflikt.
- A + A bzw. B + B = Konflikt.
- Hauptplatz und Trainingsplatz sind unabhängig.

Heimspiele werden immer einer Gesamtfläche zugeordnet.

## Deployment
Dateien in GitHub ersetzen, danach Render -> Manual Deploy -> Deploy latest commit.
Im Log:
- Sprint 3.5 Datenbankstruktur ist bereit.
- ClubPlanner Sprint 3.5 läuft auf Port 10000

Danach am besten:
1. Kalender zurücksetzen (PIN-Bestätigung).
2. FUSSBALL.DE synchronisieren.
