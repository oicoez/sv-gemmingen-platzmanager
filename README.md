# ClubPlanner 5.0 – Sprint 1

Dieser Branch beginnt den sauberen Neuaufbau von ClubPlanner 5.0.

## Was Sprint 1 enthält
- schlanker `server.js`
- neue Modulstruktur unter `src/`
- zentrale Konfiguration
- zentraler PostgreSQL/Supabase-Client
- neues `cp5_*` Datenbankschema
- getrennte API-Routen und Services
- neues Ressourcenmodell mit `Gesamt`, `Hälfte A`, `Hälfte B`
- acht offizielle Mannschaften als Startdaten
- Sync-Historie und Settings-Grundlage
- alte 4.x Tabellen bleiben unangetastet
- vorhandenes Frontend bleibt in Sprint 1 als Übergangsoberfläche erreichbar

## Neue API-Endpunkte
- `GET /health`
- `GET /api/v5/system/status`
- `POST /api/v5/auth/login`
- `GET /api/v5/teams`
- `GET /api/v5/resources`

## Nach dem Deploy im Render-Log
Es muss erscheinen:

`[CP5] ... ClubPlanner 5.0 Sprint 1 Datenbankschema bereit`

`[CP5] ... ClubPlanner 5.0 Sprint 1 läuft auf Port 10000`

## Wichtig
Sprint 1 importiert noch keine FUSSBALL.DE-Spiele in die neuen `cp5_*` Tabellen.
Das kommt im nächsten Sprint auf diesem sauberen Fundament.
