# ClubPlanner 5.0 – Sprint 2.1

Korrekturen nach dem ersten produktiven V5-Import:

- Datum wird in der Oberfläche als `TT.MM.JJJJ` dargestellt.
- Mannschaften werden nicht mehr nur über den externen Namen erkannt.
- Altersklasse + Mannschaftsname bilden gemeinsam die Zuordnung.
- Damit werden gleichnamige JSG-Mannschaften aus B- und C-Junioren nicht mehr verwechselt.
- Beim nächsten FUSSBALL.DE-Sync werden bereits importierte Events per `external_id` automatisch auf die korrekte Mannschaft aktualisiert.
- Status wird in der UI deutsch dargestellt (`geplant`, `abgesetzt`, `verlegt`).

## Testfall
Das Spiel vom 08.09.2026 mit `JSG Richen / Eppingen 3` muss nach erneutem Sync als **C-Junioren** erscheinen.
