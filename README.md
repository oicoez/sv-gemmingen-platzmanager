# ClubPlanner 5.0 – Sprint 4.4.8
Der Import nutzt jetzt vorrangig den sichtbaren öffentlichen Vereinsspielplan von SV Gemmingen,
also dieselbe FUSSBALL.DE-Seite, auf der die aktuellen Termine im Browser angezeigt werden.

Priorität je Spielnummer:
1. sichtbarer SV-Gemmingen-Vereinsspielplan
2. sichtbarer 1.-FC-Stebbach-Vereinsspielplan
3. Gemmingen-AJAX als Fallback
4. Stebbach-AJAX als Fallback

Der AJAX-Datensatz kann damit einen aktuelleren sichtbaren Termin nicht mehr überschreiben.
Referenzfall 920109004: JSG Gemmingen / Stebbach – FC Astoria Walldorf 2,
17.09.2026, 19:00 Uhr.

Zusätzlich versteht der Parser ausgeschriebene Wochentage. Im Render-Log werden Spielnummer,
Quelle und Quellentyp ausgegeben. Alle Funktionen und Mannschafts-Normalisierungen aus 4.4.6
bleiben erhalten.
