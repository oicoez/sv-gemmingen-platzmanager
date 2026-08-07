# ClubPlanner 5.0 – Sprint 2.3

Korrektur der Spielort-Erkennung.

## Kritischer Fix
Ein externer Platz wie

`Rasenplatz, TB Richen, Stebbacher Straße, 75031 Eppingen`

darf nicht wegen des Wortteils `Stebbach` in `Stebbacher Straße` dem lokalen
Standort Stebbach zugeordnet werden.

Lokale Standorte werden ab jetzt ausschließlich an den exakten Adressen erkannt:

- Gemmingen: `Beim Sportplatz 3, 75050 Gemmingen`
- Stebbach: `Jahnweg 1, 75050 Gemmingen-Stebbach`

Alle anderen Plätze bleiben externe/neutrale Spielorte und werden mit dem
echten Namen und der echten Adresse aus FUSSBALL.DE gespeichert. Sie bekommen
keine lokale Platz-Ressource und erzeugen später daher keinen lokalen
Platzkonflikt.

## Weiterhin gültig
- ABSE./Absetzung => Status `cancelled`, Anzeige `abgesetzt`
- vergangene Spiele sind standardmäßig ausgeblendet
- über `Vergangene Spiele anzeigen` bleiben sie bei Bedarf abrufbar
- der Sync verarbeitet diesmal auch bestehende vergangene Importdaten, damit
  alte falsche Spielorte einmalig sauber korrigiert werden.
