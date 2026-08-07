# ClubPlanner 4.0 – Phase 1.1

## Korrektur Anstoßzeiten
Der Vereinsspielplan wird jetzt zeilenweise in Originalreihenfolge gelesen.
FUSSBALL.DE zeigt Datum/Anstoßzeit in der Tabellenzeile direkt vor der Begegnung.
Der Parser merkt sich diese Daten und ordnet sie genau der folgenden Spiel-ID zu.

Beispiel aus dem aktuellen SV-Gemmingen-Spielplan:
- 09.08.2026 10:30 – Frauen: SV Gemmingen
- 09.08.2026 15:30 – Herren: SG Stebbach/Gemmingen 2

## Detailseite
Jede Spielseite wird weiterhin einzeln geöffnet.
Von dort werden insbesondere Spielstätte/Adresse und weitere Detaildaten gelesen.
Die Anstoßzeit von der Detailseite wird nur verwendet, wenn sie dort eindeutig
als maschinenlesbarer Wert oder direkt als Anstoß/Spielbeginn ausgezeichnet ist.
Ansonsten gilt die eindeutige Zeit aus der Vereinsspielplan-Tabelle.

## Diagnose
Render schreibt für jedes gelesene Spiel z.B.:
[FUSSBALL-4.0] <ID> | 2026-08-09 | 10:30 | SV Gemmingen : ... | Gemmingen

Damit sieht man sofort, bei welchem Spiel Datum, Zeit oder Ort fehlen.

## Installation
Alle Dateien in GitHub hochladen und vorhandene Dateien ersetzen.
Dann Render -> Manual Deploy -> Deploy latest commit.

Danach Kalender zurücksetzen und einmal FUSSBALL.DE synchronisieren.
