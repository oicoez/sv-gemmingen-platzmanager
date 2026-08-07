# ClubPlanner – Sprint 3.2

- Belegungsplan: nur noch Spalte **Anstoßzeit**, keine Von/Bis-Anzeige für Spiele.
- Wochenansicht zeigt Anstoßzeiten wie 12:30, 13:15, 15:30 korrekt im passenden Stundenblock.
- Anstoßzeit und ABSE.-Status werden aus der FUSSBALL.DE-Vereinsspielplan-Übersicht gelesen.
- ABSE. wird als ABGESETZT dargestellt und erzeugt keinen Platz-/Kabinenkonflikt.

## Speed
Bei erneuter Synchronisierung werden bekannte Spiele nicht mehr über 95 Detailseiten geprüft:
1. Vereinsspielplan einmal laden.
2. Bekannte Spiele anhand ihrer FUSSBALL.DE-ID direkt mit Anstoßzeit/Status aktualisieren.
3. Nur wirklich neue Spiele öffnen Detailseiten.
4. Neue Detailseiten werden bis zu 4-fach parallel verarbeitet.

Deployment wie bisher über GitHub und Render.
