# ClubPlanner – Sprint 1.1 (Supabase/PostgreSQL)

## Neu
Mannschaften und Termine werden dauerhaft in Supabase/PostgreSQL gespeichert. `data.json` wird nicht mehr verwendet.

Beim ersten Start legt ClubPlanner automatisch diese Tabellen an:
- `clubplanner_teams`
- `clubplanner_events`

Die Standardmannschaften werden ebenfalls automatisch angelegt.

## Render Environment Variables
Es müssen vorhanden sein:
- `EDIT_PIN`
- `DATABASE_URL`

Das Datenbankpasswort gehört ausschließlich in `DATABASE_URL` bei Render und niemals nach GitHub.

## GitHub-Update
Diese Dateien hochladen und vorhandene Dateien ersetzen:
- Dockerfile
- package.json
- render.yaml
- server.js
- public/index.html
- README.md

Danach Render -> Manual Deploy -> Deploy latest commit.

## Erfolgreicher Start
Im Render-Log muss stehen:
- `Supabase/PostgreSQL Tabellen sind bereit.`
- `ClubPlanner Sprint 1.1 / Supabase läuft auf Port 10000`

Auf der ClubPlanner-Seite erscheint oben `Cloud-DB aktiv`.

## Permanenz-Test
1. Bearbeiten öffnen.
2. Einen Testtermin speichern.
3. Render erneut deployen.
4. Ist der Termin danach noch vorhanden, läuft die dauerhafte Cloud-Speicherung korrekt.
