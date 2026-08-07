# ClubPlanner 4.1 – Modul 1 / Phase 2

Phase 2 ist ein sicherer Testlauf. Sie schreibt noch keine Spiele in Supabase.

## Ablauf
1. Vereinsspielplan wird über zwei serverseitige FUSSBALL.DE-Quellen geladen.
2. Die Quelle mit der besten Datenqualität wird gewählt.
3. Datum, Anstoßzeit, Mannschaftsart, Wettbewerb, Spielnummer, Heim/Gast und Status werden aus der Spielplan-Tabelle gelesen.
4. Nur erkannte Heimspiele werden einzeln geöffnet.
5. Von der Detailseite werden Spielstätte, Adresse und Spielnummer ergänzt.
6. Ergebnis erscheint auf der ClubPlanner-Seite und im Render-Log.

## Button
Im Bearbeitungsmodus gibt es `4.1 Testlauf`.

Dieser Button verändert NICHT:
- Kalendertermine
- Mannschaften
- Plätze
- Supabase-Events

## Render-Log
Beispiele:
[FUSSBALL-4.1-P2] Übersicht: 95 Spiele · 95 Zeiten · 95 Paarungen
[FUSSBALL-4.1-P2] 1/48 | 2026-08-07 19:30 | ... | Gemmingen | Beim Sportplatz 3, 75050 Gemmingen
[FUSSBALL-4.1-P2] Test fertig: 48 Heimspiele · 48 mit Anstoßzeit · ... mit Spielort/Adresse

Erst wenn die Zahlen plausibel sind, wird Phase 3 mit Supabase verbunden.
