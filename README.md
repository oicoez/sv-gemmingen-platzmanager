# ClubPlanner 5.0 – Sprint 2.4

## Fachlogik der Platzbelegung

ClubPlanner listet FUSSBALL.DE-Spiele nur dann in der Platzbelegung, wenn sie
tatsächlich auf einem unserer beiden Standorte stattfinden:

- Gemmingen
- Stebbach

Die Heim-/Gaststellung in FUSSBALL.DE reicht nicht aus.

### Beispiel TB Richen
`SG Stebbach/Gemmingen 2 – SGM MassenbachHausen / SV Schluchtern II`
am 07.08.2026 wird bei TB Richen in Eppingen gespielt.
Dieses Spiel belegt weder Gemmingen noch Stebbach und wird daher aus der
ClubPlanner-Belegung entfernt.

### Stebbach
Spielstätten mit
`Jahnweg 1, 75050 Gemmingen`
oder
`Jahnweg 1, 75050 Gemmingen-Stebbach`
werden als lokaler Standort `Stebbach` erkannt.

Anzeige:
- Ort: `Stebbach`
- Platz: `Hauptplatz – Gesamt` (sofern FUSSBALL.DE keinen Trainingsplatz nennt)
- Adresse: `Jahnweg 1, 75050 Gemmingen-Stebbach`

### ABSE.
Abgesetzte Spiele bleiben als rote Information sichtbar:
- Ort: `abgesetzt`
- keine lokale Ressource
- später kein Konflikt

### Bereinigung
Beim Sync werden bestätigte externe/neutrale Spielorte aus bereits importierten
FUSSBALL.DE-Belegungsdaten entfernt.
