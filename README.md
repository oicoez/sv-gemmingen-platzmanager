# ClubPlanner 5.1.0 – Mobile & PWA

Sprint 5.1.0 baut auf dem stabilen ClubPlanner 5.0 RC1 auf.

- Ohne PIN: Dashboard, Wochenplan, Monatskalender und PDF/Druck im reinen Lesemodus.
- Admin-PIN: blendet Training eintragen, Plätze & Kabinen, Mannschaften und Spiele ein.
- Admin-Abmeldung über denselben Button.
- Smartphone: feste Bottom-Navigation, vertikaler Wochenplan, Monatsansicht als Tageskarten, einspaltige Formulare, größere Touch-Flächen und mobile Dialoge.
- PWA: Manifest, App-Icons und Service Worker. Installation auf Home-Bildschirm möglich.
- API-Daten werden absichtlich nicht offline gecacht, damit keine veralteten Platzbelegungen angezeigt werden.
- Fachlogik aus 5.0 bleibt unverändert: FUSSBALL.DE, Konflikte, Serien, manuelle Termine, Hallenteilung, D-Junioren-Regel, PDF/Druck.


## Sprint 5.1.1 – Mobile Dialog Fix
Terminfenster mobil scrollbar; Abbrechen/Speichern erreichbar; zusätzliches × oben rechts; Hintergrundscroll gesperrt.


## Sprint 5.1.3 – Turnier-Anzeige
Der Backend-Planer überträgt bei manuellen Kalenderterminen jetzt die gespeicherte Art (z. B. Turnier) bis ins Dashboard. Dadurch erscheint ein als Turnier angelegter Termin dort als TURNIER statt TERMIN.


## Sprint 5.1.4 – Konfliktdiagnose
Konfliktberechnung unverändert. Klick auf Konflikt-Badge zeigt Datum, Zeit, Ort/Platz, Grund und betroffene Termine in Woche und Monat.


## Sprint 5.1.5 – Platzüberschneidung
Kabinen werden nicht mehr als Konflikt gezählt. Erlaubte gemeinsame Platzbelegungen bis 30 Minuten werden in Woche und Monat orange als „ÜBERSCHNEIDUNG · PLATZ GETEILT“ gekennzeichnet, bleiben aber konfliktfrei.
