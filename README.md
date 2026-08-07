# ClubPlanner 4.1 – Modul 1 / Phase 2.2

Frontend-/Cache-Fix:
- Der Testlauf verwendet direkt die vorhandene Bearbeitungsvariable `pin`.
- Die alte fehlerhafte PIN-Variable wurde aus dem Programmcode vollständig entfernt.
- HTML und 4.1-Test-API werden ohne Browser-Cache ausgeliefert.
- Root-index.html und public/index.html sind identisch.
- In der App muss sichtbar stehen:
  `ClubPlanner 4.1 Phase 2.2 · BUILD 4.1.2.2`

Wenn dort eine ältere Versionsnummer steht, ist noch ein altes Deployment aktiv.
