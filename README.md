# ClubPlanner – Sprint 1

Enthalten:
- öffentliches Dashboard / Lesemodus
- Bearbeitungsmodus per PIN
- Monatskalender
- Belegungsplan
- Trainings-, Spiel-, Turnier- und Platzsperrtermine
- Mannschaftsverwaltung
- Gemmingen und Stebbach
- Hauptplatz / Trainingsplatz
- Heimkabine / Gastkabine je Standort
- Konflikterkennung für Plätze und Kabinen
- Excel-Export
- JSON-Backup

## Render
Unter Environment eine Variable anlegen:
EDIT_PIN = deine gewünschte Bearbeitungs-PIN

Wichtig: Render Free besitzt keinen persistenten Datenträger. Für den echten Vereinsbetrieb binden wir als nächsten Schritt eine permanente Cloud-Datenbank an. Bis dahin bitte die Backup-Funktion verwenden.
