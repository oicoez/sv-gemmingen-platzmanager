# ClubPlanner 5.0 – Sprint 2

## Neu
Sprint 2 enthält den ersten produktiven Baustein der neuen Architektur: den komplett neu integrierten FUSSBALL.DE-Importer.

### Ablauf
1. Saisonspielplan wird direkt über `ajax.club.matchplan` geladen.
2. Datum, Anstoßzeit, Heim/Gast, Wettbewerb, Spielnummer und Status werden aus dem Spielplan gelesen.
3. Nur Heimspiele von SV Gemmingen / SG Stebbach-Gemmingen / JSG Gemmingen-Stebbach werden übernommen.
4. Die Spiel-Detailseite wird nur für Spielort/Adresse geöffnet.
5. Mannschaften werden über `external_name` sauber auf `cp5_teams` gemappt bzw. ergänzt.
6. Spiele werden per Delta-Upsert in `cp5_events` gespeichert.
7. Bereits unveränderte Spiele werden nur als synchronisiert markiert – keine Dubletten.

## Statuswerte
- `planned` = geplant
- `cancelled` = abgesetzt / ausgefallen / abgebrochen
- `rescheduled` = verlegt

## API
- `GET /api/v5/sync/status`
- `POST /api/v5/sync/fussballde` (Bearbeitungs-PIN erforderlich)
- `GET /api/v5/events`

## Sicherheit
Version 4.x wird nicht angefasst. Sprint 2 arbeitet ausschließlich mit `cp5_*`-Tabellen.
