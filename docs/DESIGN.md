# Burgwacht – Spielregeln und Zahlenwerte

Dieses Dokument beschreibt die Spielmechanik vollständig und unabhängig von der Darstellung, sodass eine spätere Unity-Portierung danach gebaut werden kann. Maßgeblich ist der Code in `js/data.js`, `js/core.js`, `js/economy.js`, `js/combat.js` und `js/units.js` (keine DOM-Zugriffe). Die Darstellung (`render.js`, `ui.js`) liest den Zustand nur und hängt sich über die Rückrufe in `H` ein.

## 1. Zeit

| Größe | Wert |
|---|---|
| Ein Spieltag | 4 s Echtzeit bei Tempo 1× (`DAY`) |
| Tempo | 0 (Pause), 1×, 3× – bei 3× wird der Simulationsschritt dreimal pro Bild ausgeführt |
| Simulationsschritt | Bildzeit, höchstens 0,05 s |
| Jahreszeit | 10 Tage (`SLEN`, bis Etappe 4: 6), Reihenfolge Frühling → Sommer → Herbst → Winter |
| Jahreszeit von Tag d | `floor((d − 1) / SLEN) mod 4` (0 Frühling … 3 Winter) |
| Tag-Nacht-Zyklus | 6 Tage (`CYC`), rein optisch |

Ablauf pro Simulationsschritt (`step(dt)`): Uhr um `dt` erhöhen; jedes Mal, wenn sie `DAY` überschreitet, `dayTick()` ausführen; danach `update(dt)` (Echtzeit: Feinde, Feuer, Wachen, Truppen).

## 2. Karte

- Raster `COLS × ROWS`, Feld-Index `i = r · COLS + c`. Kampagne: 12 × 20, Bergfried bei `(KR, KC) = (11, 5)`. Freies Spiel wählbar (`MAPSIZE`): Klein 12 × 20, Mittel 20 × 28, Groß 32 × 40; Bergfried bei `(round(0,55 · ROWS), floor(COLS / 2))`. Eine Mission kann `map: {cols, rows}` setzen.
- Im Umkreis von 2 Feldern um den Bergfried ist immer Gras.

| Gelände | Wert | begehbar | bebaubar | Besonderheit |
|---|---|---|---|---|
| Gras | 0 | ja | ja | |
| Wald | 1 | nein | nein | Holzfäller im Umkreis 2 |
| Fels | 2 | nein | nein | Steinbruch direkt daneben |
| Wasser | 3 | nur mit Brücke | nur Brücke | Teiche und Fluss |
| Hügel | 4 | ja | ja | Bogenschützen darauf +1 Reichweite (`HILL_RANGE`), auch auf Mauer/Turm |
| Sumpf | 5 | ja (Feinde und Truppen mit halbem Tempo, `SWAMP_SLOW`) | nein | Wegkosten für Feinde 2 |
| Eisenvorkommen | 6 | nein | nein | Eisenmine direkt daneben |

- Kartengenerator: deterministischer Zufall (Mulberry32) aus dem Seed. **Klassisch** (12 × 20, `genClassic`): Wald-, Fels- und Wasserflecken („Blobs“) an festen Ankerpunkten mit Zufallsversatz ±0,8, dazu ein Eisenvorkommen am Westfelsen. Ein Feld im Radius `rad` um das Zentrum wird mit Wahrscheinlichkeit `den · (1 − d/rad · 0,55)` umgewandelt. **Weit** (alle anderen Größen, `genWide`): Anzahl der Flecken proportional zur Fläche (`A = N/240`): 4A Hügel, 6A Wälder, 3,2A Felsen, max(2, 1,6A) Eisen, 1,2A Sumpf, eventuell ein Teich – jeweils mit Mindestabstand zum Bergfried. Ab 16 Spalten ein Fluss von oben nach unten, mindestens 4 Spalten neben dem Bergfried, 1–2 Felder breit, mit einer **Furt** (2 Reihen Sumpf) nahe dem oberen oder unteren Rand und Sumpf an den Ufern. Danach prüft eine Breitensuche, ob jede Kartenseite den Bergfried erreicht; sonst wird eine gerade Schneise geschlagen (Wald/Fels → Gras, Wasser → Sumpf).
- Im Querformat wird die Karte nur transponiert dargestellt; die Logik bleibt gleich. Himmelsrichtungen werden für Meldungen gedreht (Norden ↔ Westen, Süden ↔ Osten).

## 3. Rohstoffe

Holz, Stein, Weizen, Mehl, Brot, Äpfel, Gold, Eisen, Häute sowie die Waffen Bögen, Speere, Schwerter und Lederrüstungen. Startwerte (`BASE`): 40 Holz, 15 Äpfel, 60 Gold, sonst 0. Missionen überschreiben einzelne Werte.

### Lager
Jeder Rohstoff außer Gold gehört zu einer Lagerart (`STORE`). Die Grenze gilt **je Rohstoff**:

| Lagerart | Rohstoffe | Grundlager (Holzburg / Steinburg / Festung) | je Gebäude |
|---|---|---|---|
| Lager | Holz, Stein, Eisen, Weizen, Mehl, Häute | 100 / 150 / 220 | +100 je Lager |
| Kornkammer | Brot, Äpfel | 60 / 90 / 130 | +80 je Kornkammer |
| Rüstkammer | Bögen, Speere, Schwerter, Lederrüstungen | 6 / 10 / 15 | +20 je Rüstkammer |

Nach der Tagesproduktion (und nach Abriss eines Lagers oder Rückgängig) wird auf die Grenze gekappt (`clampRes`). Die verfallene Menge steht in `S.spill` (für Anzeige und Meldung „Lager voll: … verfallen“) und wird zu Beginn jedes Tages geleert. Erstattungen beim Abriss und Kopfgeld werden erst beim nächsten Kappen begrenzt.

## 4. Gebäude

| Schlüssel | Name | Kosten | Arbeiter | Wirkung |
|---|---|---|---|---|
| `haus` | Hütte | 6 Holz | – | +8 Platz für Einwohner |
| `holzf` | Holzfäller | 3 Holz | 1 | +3 Holz/Tag; Wald im Umkreis 2 (Chebyshev) nötig |
| `obst` | Obstgarten | 5 Holz | 1 | +3 Äpfel/Tag; im Herbst ×2, im Winter 0 |
| `farm` | Weizenhof | 10 Holz | 1 | +4 Weizen/Tag; im Winter 0 |
| `muehle` | Mühle | 15 Holz | 1 | 4 Weizen → 4 Mehl |
| `baecker` | Bäckerei | 10 Holz | 1 | 4 Mehl → 10 Brot |
| `stein` | Steinbruch | 8 Holz | 2 | +3 Stein/Tag; Fels im Umkreis 1 nötig |
| `brunnen` | Brunnen | 4 Holz, 4 Stein | – | löscht Brände im Umkreis 3; brennt selbst nicht |
| `kapelle` | Kapelle | 8 Stein, 30 Gold | – | +2 Beliebtheit/Tag, höchstens 3 Kapellen zählen |
| `mauer` | Mauer | 1 Stein | – | 30 LP, blockiert alle |
| `tor` | Tor | 4 Holz, 8 Stein | – | 150 LP, eigene Leute passieren |
| `turm` | Turm | 10 Stein | – | 90 LP, oben Platz für 3 Einheiten, Bogenschützen +1,4 Reichweite |
| `kaserne` | Kaserne | 10 Holz, 6 Stein | – | erlaubt das Ausbilden von Truppen |
| `lager` | Lager | 12 Holz | – | +100 Platz je Lager-Rohstoff |
| `korn` | Kornkammer | 10 Holz, 4 Stein | – | +80 Platz für Brot und Äpfel |
| `ruest` | Rüstkammer | 8 Holz, 12 Stein | – | +20 Platz je Waffenart |
| `mine` | Eisenmine | 15 Holz, 5 Stein | 2 | +2 Eisen/Tag; Eisenvorkommen im Umkreis 1 nötig |
| `bruecke` | Brücke | 12 Holz | – | nur auf Wasser; macht das Feld begehbar für eigene Leute und Feinde (Engstelle); brennt nicht |
| `markt` | Markt | 20 Holz, 6 Stein | – | Handel im Hof (siehe Markt) |
| `apotheke` | Apotheke | 10 Holz, 6 Stein, 25 Gold | 1 | besetzt: beendet eine Seuche am nächsten Tag, verhindert neue zu 70 % |
| `weide` | Viehweide | 8 Holz | 1 | +2 Häute/Tag, im Winter 1 |
| `gerber` | Gerberei | 12 Holz | 1 | 2 Häute → 1 Lederrüstung |
| `bogner` | Bogenmacher | 12 Holz | 1 | 2 Holz → 1 Bogen |
| `schmied` | Schmied | 10 Holz, 10 Stein | 1 | Modus Speer: 1 Eisen + 1 Holz → 1 Speer; Modus Schwert: 2 Eisen → 1 Schwert (antippen schaltet um) |
| `abriss` | Abreißen | – | – | Werkzeug: entfernt Gebäude, erstattet `floor(Kosten/2)` |

Gebäude ohne Mauer-Eigenschaft haben 40 LP (nur für Feuer relevant). Bauregeln: Feld ist Gras, frei, kein Feind steht darauf oder läuft gerade hinein, Nähe-Bedingung erfüllt, Kosten vorhanden.

### Arbeiter
Bei jeder Änderung werden Arbeiter neu verteilt: freie Leute = Einwohner − Truppen (jede Einheit zählt als eine Person). Gebäude mit Arbeitsbedarf werden nach Bau-Reihenfolge (ID) besetzt, sofern sie erreichbar sind und genug freie Leute da sind. Übrige Leute sind „frei“.

### Erreichbarkeit
Produktionsgebäude arbeiten nur, wenn ein Weg für eigene Leute zum Bergfried existiert (Breitensuche über Gras; Mauern und Türme blockieren, Tore nicht). Abgeschnittene Gebäude („cut“) produzieren nichts.

## 5. Tageslauf (`dayTick`)

Reihenfolge:
1. Tag erhöhen, Jahreszeit bestimmen, Arbeiter verteilen.
2. **Produktion** in drei Stufen (`tier`): 0 = Gebäude ohne Verbrauch, 1 = Mühle, 2 = Bäckerei und Werkstätten (Gerberei, Bogenmacher, Schmied). So wird frisch Geerntetes am selben Tag weiterverarbeitet. Faktor nach Jahreszeit (`prodMult`): Obstgarten im Herbst ×2, Viehweide im Winter ×0,5 (gerundet), Obst und Weizen im Winter 0. Danach Lagergrenzen anwenden. Ein Gebäude mit Verbrauch arbeitet nur, wenn der volle Verbrauch vorrätig ist (sonst „wartet auf Rohstoffe“).
3. **Essen**: Nahrung = Brot + Äpfel. Bedarf = `ceil(Einwohner · r)` mit `r` aus der Rationsstufe. Reicht die Nahrung nicht, sinkt die effektive Ration stufenweise. Verbraucht wird gleichmäßig über die vorhandenen Sorten (kleinster Vorrat zuerst). Abwechslung = Anzahl Sorten mit Vorrat > 0.
4. **Brennholz** im Winter: `ceil(Einwohner / 10)` Holz pro Tag, sonst „Kälte“.
5. **Steuern**: Gold += `round(Einwohner · g)`; Gold fällt nie unter 0. „Geschenk“ schaltet automatisch auf „Keine“, wenn das Gold nicht mehr für einen Tag reicht.
   **Sold**: danach Summe des Solds aller Einheiten (`UNIT[typ].sold`: Bogenschütze und Speerträger 1, Schwertkämpfer 2, Ritter 3 Gold). Reicht das Gold nicht, wird es auf 0 gesetzt und „Sold nicht bezahlt“ (−3 Beliebtheit) gilt bis zum nächsten bezahlten Tag.
6. **Beliebtheit** (0–100): `pp += 0,5 · Σ Faktoren`.
7. **Bevölkerung**: bei pp ≥ 50 Zuzug +1 (bei pp ≥ 75 +2) bis zur Kapazität; bei pp < 50 Wegzug −1 (bei pp < 25 −2), nie unter die Zahl der Truppen. Kapazität = `Grundplätze der Burgstufe + 8 · Hütten` (12 / 20 / 28).
8. **Angriffsplan** (siehe 7.).
9. **Ereignisse** (`eventTick`, siehe unten), dann Siegprüfung und automatisch speichern.

### Rationen und Steuern

| Ration | r (Essen/Kopf) | Beliebtheit |
|---|---|---|
| Keine | 0 | −8 |
| Halb | 0,15 | −4 |
| Normal | 0,3 | 0 |
| Doppelt | 0,6 | +4 |

| Steuer | Gold/Kopf | Beliebtheit |
|---|---|---|
| Geschenk | −0,4 | +3 |
| Keine | 0 | +1 |
| Niedrig | 0,5 | −2 |
| Mittel | 0,8 | −4 |
| Hoch | 1,2 | −7 |

### Beliebtheitsfaktoren
Ration (oben), Abwechslung beim Essen (+2 bei ≥ 2 Sorten), Steuer (oben), Kapellen (+2 je Kapelle, max. 3), Sold nicht bezahlt (−3), Angst nach Bränden (−3 für 3 Tage nach einem abgebrannten Gebäude), Kälte ohne Brennholz (−4), Seuche (−4, solange sie dauert).

Startwerte: Beliebtheit 60, Steuer „Niedrig“, Ration „Normal“.

### Markt
Mit mindestens einem Markt lässt sich im Hof handeln, in Paketen zu `TRADE_N` = 5 Stück. Kaufen kostet `ceil(5 · Kaufpreis)`, Verkaufen bringt `floor(5 · Verkaufspreis)` Gold. Gekauftes muss ins Lager passen.

| Ware | Kauf/Stück | Verkauf/Stück | | Ware | Kauf/Stück | Verkauf/Stück |
|---|---|---|---|---|---|---|
| Holz | 2 | 1 | | Brot | 2 | 1 |
| Stein | 3 | 1,5 | | Äpfel | 1,6 | 0,6 |
| Eisen | 6 | 3 | | Häute | 3 | 1,4 |
| Weizen | 2 | 1 | | Bögen, Speere | 10 | 5 |
| Mehl | 3 | 1,5 | | Schwerter | 16 | 8 |
| | | | | Lederrüstungen | 10 | 5 |

### Ereignisse (`js/events.js`)

Einmal am Tag (nicht in Missionen mit `events: false`, also nicht in Mission 1; erst ab Tag 6): Hat die Abklingzeit (`EVENT_COOL` = 5 Tage nach dem letzten Ereignis) 0 erreicht, tritt mit 12 % (`EVENT_CHANCE`) ein Ereignis ein. Gewählt wird gewichtet unter den Ereignissen, deren Bedingung gerade erfüllt ist.

| Ereignis | Gewicht | Bedingung | Wirkung |
|---|---|---|---|
| Seuche | 2 | ≥ 18 Einwohner, keine laufende | `PEST_DAYS` = 5 Tage: jeden Tag −1 Einwohner (nicht unter Truppen + 1), Beliebtheit −4. Eine besetzte Apotheke verhindert sie zu 70 % und beendet sie am nächsten Tag. |
| Missernte | 2 | nicht im Winter, Höfe oder Obstgärten vorhanden | 6 Tage lang Weizenhof und Obstgarten ×0,5 |
| Wölfe | 3 | Winter | 2 + floor(Tag/18) Wölfe von einem zufälligen Rand (siehe Feinde); zählen nicht als Welle |
| Blitzschlag | 2 | Sommer, brennbares Gebäude vorhanden | ein zufälliges brennbares Gebäude fängt Feuer |
| Händler | 3 | immer | Entscheidung: 10 Stück einer Ware für 75 % des Marktpreises kaufen und/oder 10 Stück einer vorrätigen Ware für 140 % des Verkaufspreises verkaufen |
| Turnier | 2 | ≥ 60 Gold, ≥ 16 Einwohner | Entscheidung: 50 Gold für +10 Beliebtheit |
| Festtag | 2 | ≥ 25 Gold | Entscheidung: 20 Gold und 10 Essen (erst Äpfel, dann Brot) für +5 Beliebtheit |

Entscheidungen liegen in `S.ev.pending` und werden über `H.event` gezeigt; `resolveEvent(i)` setzt Option i um (−1 = ablehnen). Eine offene Entscheidung gilt am nächsten Tag als abgelehnt.

## 6. Feuer

- Brandstifter zünden alle 4 s ein brennbares Gebäude in den 8 Nachbarfeldern an (Suche alle 0,5 s, wenn keins da ist).
- Brennende Gebäude verlieren 3 LP/s. Pro Sekunde springt das Feuer mit Wahrscheinlichkeit 0,12 über; dann wird jedes der 4 Nachbarfelder mit 50 % entzündet.
- Ein Brunnen im Umkreis 3 (Chebyshev) löscht ein Feuer, das länger als 2,5 s brennt.
- Der Spieler kann ein brennendes Gebäude für 2 Gold löschen (antippen).
- Brennbar ist alles außer Bergfried, Mauern/Türmen/Toren und Brunnen.

## 7. Angriffe

Missionsparameter `raid = {start, every, fire, ram, archer, ladder, scale}`:
- Erster Angriff nach `start` Tagen, danach alle `every` Tage. 3 Tage vorher melden Späher die Richtung (in den ersten zwei Wellen Norden/Osten/Westen, danach auch Süden).
- Welle k: Anzahl `n = max(1, round((1 + 2k) · scale))`, Grund-LP `8 + 3k`.
- Zusammensetzung (`waveList`): Brandstifter ab Welle `fire`, feindliche Bogenschützen ab Welle `archer`, Leitermänner ab Welle `ladder`, jeweils `1 + floor((k − ab)/2)`; sie ersetzen Räuber (mindestens 1 Räuber bleibt). Rammböcke ab Welle `ram`: `1 + floor((k − ram)/2)`, zusätzlich und als Letzte.
- Feinde erscheinen auf freien Grasfeldern am Rand der gemeldeten Seite, im Abstand von 0,7 s.
- Jeder Feind gehört zu seiner Welle (`w`). Eine Welle gilt als abgewehrt, sobald ihr letzter Feind fällt – auch wenn schon die nächste Welle angreift (Wellen können sich überlappen, z. B. Mission 5: alle 20 s).
- Belohnung (`KILL_GOLD`, `RAM_GOLD`, `WAVE_GOLD`): 2 Gold pro Feind, 6 pro Rammbock, +10 Gold je abgewehrter Welle.

| Feind | LP-Faktor | Tempo (Felder/s) | Schaden/s | Rüstung (Faktor auf Pfeilschaden) |
|---|---|---|---|---|
| Räuber | 1 | 1,1 | 3 | 1 |
| Brandstifter | 0,7 | 1,3 | 2 | 1 |
| Rammbock | 3,5 | 0,45 | 14 (Bergfried: 10) | 0,34 |
| Wolf (Ereignis) | 0,6 (Grund-LP 8 + 0,4 · Tag) | 1,7 | 2 | 1 |
| Feindlicher Bogenschütze | 0,8 | 1,0 | 2 (Fernkampf, Reichweite 3,5) | 1 |
| Leitermann | 0,9 | 1,1 | 2 | 1 |

Die Rüstung wirkt auf allen Schaden durch eigene Truppen und Wachen.

- **Feindliche Bogenschützen** bleiben stehen, sobald eine eigene Einheit (auch auf Mauer oder Turm) in Reichweite 3,5 ist, und schießen 1 Pfeil/s auf die nächste. **Deckung**: Steht die Einheit oben (nicht im Laufen), wirkt nur ein Teil des Schadens: Mauer und Bergfried ×0,5, Turm ×0,4 (`COVER`). Ohne Einheit in Reichweite schießen sie auf den Bergfried, wenn er in Reichweite ist, sonst laufen sie weiter.
- **Leitermänner** nutzen eine eigene Kostenkarte `distL`: Mauern und Türme kosten nur 3 (Kletterzeit), Tore wie gehabt. Steht als Nächstes eine Mauer oder ein Turm an, legen sie 2,5 s die Leiter an (`climb`), steigen hinauf, laufen über das Mauerfeld und springen auf der Innenseite herab. Tore schlagen sie ein wie Räuber.
- **Nahkampf**: Räuber, Brandstifter und Leitermänner bleiben stehen und schlagen (1 Schlag/s) eine eigene Einheit am Boden, die stillsteht und näher als 0,75 Felder ist (oder im Vorbeilaufen näher als 0,45). Einheiten oben auf Mauern werden im Nahkampf nicht angegriffen. Rammböcke kämpfen nicht.
- Stürzt eine Mauer ein, erleiden alle Einheiten darauf 99 Schaden.

### Wegfindung der Feinde
Dijkstra vom Bergfried aus über Gras. Kosten: freies Gras 1, Mauerfeld `1 + LP/5`, sonst unpassierbar (Gebäude ohne Mauer-Eigenschaft sind begehbar). Ein Feind geht stets auf das Nachbarfeld mit den geringsten Restkosten. Ist es eine Mauer/ein Tor/ein Turm, greift er es an (1 Schlag/s) bis es fällt; ist es der Bergfried, greift er diesen an. Die Kostenkarte wird bei jeder Gebäudeänderung neu berechnet, daher suchen Feinde automatisch die schwächste Stelle.

### Burgstufen (`KEEP_LV`)

| Stufe | LP | Grundplätze | Wachen | Ausbaukosten |
|---|---|---|---|---|
| Holzburg | 150 | 12 | 2 | – (Start) |
| Steinburg | 300 | 20 | 3 | 30 Holz, 60 Stein, 80 Gold |
| Festung | 500 | 28 | 5 | 120 Stein, 30 Eisen, 180 Gold |

Beim Ausbau steigen die aktuellen LP um die Differenz der Maximalwerte (Schaden bleibt erhalten). Ausbau im Hof-Menü.

### Verteidigung
- Bergfried: LP nach Burgstufe. Fällt er, ist das Spiel verloren. Die Wachen der Burgstufe schießen immer (Reichweite 3,5, 1 Pfeil pro Wache und Sekunde, Schaden `3 · Rüstung`).

### Truppen (`js/units.js`)

Ausbilden im Hof (`recruit(typ)`): braucht eine Kaserne, eine freie Person, Gold und die Waffen aus der Rüstkammer. Jede Einheit ist eine Figur auf der Karte (`S.units`) mit eigener Position, LP und Befehl.

#### Kampfwerte und Konter (`UNIT`)

| Einheit | Kosten | Sold/Tag | LP | Tempo | Schaden × Schläge/s | Reichweite | Rüstung | Besonderheit |
|---|---|---|---|---|---|---|---|---|
| Bogenschütze | 12 Gold, 1 Bogen | 1 | 10 | 1,2 | 3 × 1 | 3,2 (Fernkampf) | 1 | Reichweite auf Mauer +0,8, Turm +1,4, Bergfried +0,3 |
| Speerträger | 8 Gold, 1 Speer | 1 | 16 | 1,1 | 3 × 1 | 1,15 | 0,9 | ×3 Schaden gegen Rammböcke |
| Schwertkämpfer | 15 Gold, 1 Schwert, 1 Lederrüstung | 2 | 26 | 0,85 | 6 × 1 | 0,9 | 0,6 | zäh und schlagkräftig |
| Ritter | 40 Gold, 1 Schwert, 1 Lederrüstung | 3 | 34 | 2,3 | 7 × 1,2 | 1 | 0,6 | schnell, für Ausfälle |
| Rammbock | 20 Gold, 15 Holz (Werkstatt) | 1 | 70 | 0,5 | 18 × 0,5 | 1 | 0,4 | nur gegen Gebäude |
| Katapult | 35 Gold, 20 Holz, 10 Stein (Werkstatt) | 2 | 30 | 0,4 | 14 × 0,25 | 6 (Fernkampf) | 0,8 | nur gegen Gebäude, zielt selbst auf das nächste feindliche Gebäude in Reichweite |

Schaden eines Schlags auf einen Feind = `Schaden · Rüstung des Feindes` (· 3 für Speerträger gegen Rammböcke). Erlittener Schaden einer Einheit = `Schaden · Rüstung der Einheit`.

Konter in Kürze:
- **Rammböcke** (Rüstung 0,34) halten Pfeile gut aus → Speerträger (effektiv 3,1 je Schlag statt 1,0).
- **Leitermänner** kommen über Mauern → Nahkämpfer auf oder hinter die Mauer stellen; Bogenschützen auf Türmen treffen sie beim Klettern.
- **Feindliche Bogenschützen** schwächen Schützen auf der Mauer → Ritter oder Schwertkämpfer durch das Tor schicken (Ausfall).
- **Räuber und Brandstifter** → Bogenschützen auf Türmen, Nahkämpfer am Tor.

#### Bewegung
- Felder: Bodenfelder (Gras, keine Mauer, Tore passierbar, nicht der Bergfried) und „erhöhte“ Felder (Mauer, Turm, Bergfried). Laufen auf erhöhten Feldern ist frei. Hinauf- oder hinabsteigen geht nur zwischen einem erhöhten Feld und einem Bodenfeld, das für eigene Leute mit dem Bergfried verbunden ist (`reach`). So kommt niemand über die Mauer nach draußen, der nicht auch durch ein Tor käme.
- Wegfindung: Breitensuche (`unitPath`), 4 Nachbarn. Wird ein Weg unterwegs versperrt, wird neu gesucht; ohne Weg bleibt die Einheit stehen.
- Plätze: Bodenfeld 3 Einheiten, Mauerfeld 2, Turm 3, Bergfried 5. Ein Befehl an eine Gruppe (`order`) verteilt sie per Breitensuche ab dem Zielfeld auf freie Plätze derselben Art (bei Mauern entlang der Mauer).
- Höhe für Darstellung und Pfeile (`tileLift`): Mauer 0,36, Turm 0,64, Bergfried 0,85 Felder.
- Neue Einheiten: Bogenschützen zuerst in den Bergfried (5 Plätze), dann auf freie Turmplätze; Nahkämpfer vor die Tür des Bergfrieds.

#### Kampf
- Ziel: befohlener Feind (`orderAttack`), sonst der nächste Feind in Reichweite. Nahkämpfer verteidigen zusätzlich ihren Posten: Feinde innerhalb von 2,2 Feldern um den Posten werden angegriffen (nicht von Mauern aus).
- Ist das Ziel außer Reichweite, läuft die Einheit hinterher (Weg alle 0,5 s neu); Bogenschützen nur bis auf Reichweite. Ohne Ziel kehren Nahkämpfer zu ihrem Posten zurück.
- Gefallene Einheiten werden entfernt, die Einwohnerzahl sinkt um 1 je Gefallenem (nie unter die Zahl der übrigen Truppen).

#### Steuerung (Darstellung, `ui.js`)
- Knopf „Truppen“ (sichtbar ab Kaserne oder erster Einheit) oder Antippen einer Einheit öffnet den Truppenmodus.
- Ein Finger ziehen: Auswahlrahmen. Tippen auf eine Einheit: hinzufügen. Chips in der Werkzeugleiste: alle einer Art bzw. „Alle“ (nochmal tippen hebt die Auswahl auf).
- Mit Auswahl: Tippen auf einen Feind → Angriffsbefehl; auf ein Feld, eine Mauer oder einen Turm → Bewegungsbefehl. Zwei Finger verschieben und zoomen.

## 8. Ziele und Missionen

Zieltypen: `pop` (Einwohner ≥ n), `brot` (Brot auf Vorrat ≥ n), `raids` (abgewehrte Wellen ≥ n), `pp` (Beliebtheit ≥ n), `schwert` (Schwerter auf Vorrat ≥ n), `day` (Tag n erreicht), `siege` (feindlicher Bergfried zerstört). Eine Mission ist gewonnen, sobald alle Ziele gleichzeitig erfüllt sind.

| # | Name | Seed | Start | Einw. | Ziele | Angriffe |
|---|---|---|---|---|---|---|
| 1 | Ein neuer Anfang | 1201 | Basis | 10 | 24 Einwohner | keine |
| 2 | Brot für alle | 3307 | 60 Holz, 20 Äpfel | 14 | 40 Brot | ab Tag 10, alle 9, scale 0,6 |
| 3 | Steinerne Wacht | 4411 | 50 Holz, 20 Stein, 20 Äpfel, 80 Gold, 4 Bögen | 14 | 3 Wellen | ab 7, alle 6 |
| 4 | Flammen im Tal | 5519 | 60 Holz, 20 Stein, 20 Äpfel, 100 Gold, 4 Bögen | 16 | 4 Wellen, 50 Beliebtheit | ab 7, alle 6, Brandstifter ab Welle 1, Leitermänner ab Welle 3 |
| 5 | Die Belagerung | 6623 | 80 Holz, 40 Stein, 30 Brot, 30 Äpfel, 170 Gold, 6 Bögen, 4 Speere | 18 | 5 Wellen | ab 8, alle 5, Brandstifter und Rammböcke ab Welle 2, feindliche Bogenschützen ab Welle 3, scale 1,4 |
| – | Freies Spiel | zufällig | Basis + 5 Brot, 3 Bögen | 10 | – | ab 8, alle 7, Brand ab 3, Leiter ab 4, Ramm ab 5, Bogen ab 6 |

### Belagerung (Angriffsmission)
Eine Mission mit `fort: {r, c, rad, guards, archers}` hat eine feindliche Burg (`buildFort`): Mauerring mit Chebyshev-Radius `rad` um den feindlichen Bergfried (`fkeep`, 400 LP), Türme (`fturm`, 120 LP) an Ecken und Seitenmitten, Tor (`ftor`, 180 LP) auf der Seite zum eigenen Bergfried, sonst Mauern (`fmauer`, 60 LP). Feindliche Bauten lassen sich nicht abreißen, sind für Angreiferwellen unpassierbar und für eigene Leute geschlossen (auch das Tor). Der Kartengenerator räumt den Platz frei und schlägt bei Bedarf eine Schneise vom eigenen Bergfried zum Tor.

- **Verteidiger** (`def`, Welle −1, zählen nicht als Angriff): je Turm `archers` Bogenschützen (16 LP, Reichweite 3,5 + 1 auf dem Turm, fallen mit dem Turm) und `guards` Wachen (22 LP) im Hof. Wachen greifen eigene Einheiten im Umkreis von 3,2 Feldern um ihren Posten an und kehren dann zurück.
- **Gebäude angreifen** (`orderAttackB`): Nahkämpfer, Rammböcke und Katapulte; Bogenschützen nicht. Schaden je Schlag = `Schaden · Gebäudefaktor` (Belagerungsgerät 1, Nahkämpfer 0,3). Nahkämpfer schlagen von einem Nachbarfeld (Abstand ≤ 1,2), Katapulte aus bis zu 6,3 Feldern. Ein zerstörtes Tor oder eine zerstörte Mauer wird zu Gras.
- Fällt der feindliche Bergfried, fallen alle Verteidiger, und das Ziel `siege` ist erreicht.
- Belagerungswerkstatt (`werkstatt`): 20 Holz, 10 Stein. Ausbilden im Hof wie andere Truppen.

| # | Name | Karte | Start | Einw. | Ziele | Angriffe |
|---|---|---|---|---|---|---|
| 6 | Über den Fluss | 20 × 28, Seed 7101 | 90 Holz, 20 Stein, 25 Äpfel, 110 Gold, 4 Bögen | 16 | 32 Einwohner, 3 Wellen | ab 10, alle 7, Brand ab 2, Leiter ab 3 |
| 7 | Eisen aus den Bergen | 20 × 28, Seed 7207 | 100 Holz, 60 Stein, 30 Äpfel, 140 Gold, 4 Bögen, 2 Speere | 18 | 6 Schwerter, 3 Wellen | ab 9, alle 7, Bogen ab 2, Leiter ab 3, scale 1,1 |
| 8 | Der lange Winter | 20 × 28, Seed 7313, Start Tag 14 | 110 Holz, 20 Stein, 40 Äpfel, 120 Gold, 4 Bögen | 18 | Tag 46, 28 Einwohner | ab 14, alle 8, Brand ab 2, Ramm ab 4 |
| 9 | Die große Belagerung | 32 × 40, Seed 7419 | 140 Holz, 80 Stein, 30 Brot, 40 Äpfel, 220 Gold, 8 Bögen, 6 Speere | 22 | 6 Wellen | ab 10, alle 5, Brand ab 2, Leiter/Bogen/Ramm ab 3, scale 1,8 |
| 10 | Sturm auf Rabenfels | 32 × 40, Seed 7523, eigener Bergfried (34, 16), Burg (8, 16), Radius 3, 8 Wachen, 2 Schützen je Turm | 160 Holz, 90 Stein, 40 Äpfel, 20 Brot, 320 Gold, 10 Eisen, 6 Bögen, 6 Speere, 4 Schwerter, 4 Lederrüstungen | 24 | feindlichen Bergfried zerstören | ab 10, alle 7, Leiter/Bogen ab 3, Ramm ab 4, scale 1,3 |

### Eigene Karten (Kartenschmiede, `js/maps.js`)
Format Version 1 (JSON), auch für den späteren Mehrspielermodus gedacht:

```
{ v: 1, n: Name, s: Beschreibung, cols, rows, kr, kc,
  t: Gelände als Lauflängen "Wert*Anzahl" mit Punkt getrennt (Werte 0–6 wie Geländetabelle), z. B. "0*40.1*3",
  res: {Rohstoff: Menge}, pop, goals: [[Typ, Ziel]], raid: {start, every, scale, fire, ram, ladder, archer} | null, events }
```

`validateMap` prüft und begrenzt alle Werte (8–40 Spalten, 8–48 Reihen, Bergfried mindestens 2 Felder vom Rand, Ziele aus `pop/brot/raids/pp/day/schwert`, höchstens 4). Gespielt wird eine Karte als Mission `CUSTOM` (−2); die Karte reist im Spielstand mit (`S.custom`). Eigene Karten zählen nicht zum Kampagnenfortschritt. Gespeichert unter `localStorage['zinnenwerk-maps']`. Teilen: JSON → `deflate-raw` (CompressionStream; ohne Unterstützung unkomprimiert, Präfix `j` statt `z`) → Base64url im URL-Fragment `#karte=…`. Beim Öffnen eines solchen Links wird die Karte geprüft, in die Liste übernommen und das Fragment entfernt. Export/Import als `.json`-Datei.

## 9. Speichern

- Automatischer Spielstand: `localStorage['zinnenwerk-auto']`, nach jedem Tag, jeder Welle und beim Laden.
- Drei feste Plätze: `zinnenwerk-slot-1` … `-3`, im Menü mit Vorschau (Mission, Tag, Jahreszeit, Zeitpunkt).
- Jeder Stand trägt `ver` (aktuell 5) sowie `cols`, `rows`, `kr`, `kc`. `migrate()` hebt ältere Stände an: Version 1 (Schlüssel `zinnenwerk-v3`) bekommt 12 × 20 / Bergfried (11, 5), Feinde ohne Wellennummer werden der letzten Welle zugeordnet. Version 2 → 3: fehlende Rohstoffe (Eisen, Häute, Waffen) = 0, Burgstufe Holzburg, leeres `spill`. Version 3 → 4: die Zahl `archers` wird zu ebenso vielen Bogenschützen-Einheiten im Bergfried (`units`). Version 4 → 5: Ereigniszustand `ev`; Eisenvorkommen werden nachgetragen, indem die Karte aus dem gespeicherten Seed neu erzeugt wird und ihre Eisenfelder auf freies Gras oder Wald übernommen werden. Ein alter v3-Stand wird beim ersten Start in den automatischen Spielstand übernommen; der alte Schlüssel bleibt unangetastet.
- Kampagnenfortschritt: `localStorage['zinnenwerk-progress'] = {done: [Missionsindizes]}`. Wird nie gelöscht.
- Einstellungen: `localStorage['zinnenwerk-settings']` (Lautstärken, Grafikstufe, Starttempo, Vibration, Tutorial).
- Mission n ist spielbar, wenn n = 0 oder Mission n − 1 geschafft ist.

### Rückgängig
Bis zu 20 Schritte (`UNDO_MAX`). Eine Wisch-Geste ist ein Schritt. Bauen zurücknehmen erstattet die vollen Kosten (nur wenn das Gebäude noch steht und nicht brennt); Abriss zurücknehmen stellt das Gebäude mit seinem alten Zustand wieder her und zieht die Erstattung wieder ab. Nur Aktionen von heute und gestern sind rücknehmbar, sonst ließe sich Produktion „zurückkaufen“. Der Verlauf wird nicht gespeichert.

## 10. Schnittstelle Logik ↔ Darstellung

Die Logik ruft nur diese Rückrufe auf (`H` in `core.js`):

| Rückruf | Bedeutung |
|---|---|
| `say(text)` | Meldung anzeigen |
| `fx(x, y, art, n)` | Effekt an Kartenkoordinate (Staub, Rauch, Glut, Späne) |
| `sfx(name)` | Geräusch abspielen |
| `shot(x1, y1, x2, y2, feindlich, h1, h2)` | Pfeilflug zeichnen; `h1`/`h2` = Höhe von Schütze und Ziel in Feldern (Mauer, Turm, Bergfried), feindliche Pfeile andersfarbig |
| `side(s)` | Himmelsrichtung für die Anzeige übersetzen |
| `event(p)` | Ereignis mit Entscheidung anzeigen (`p.text`, `p.opts`) |
| `vibrate(muster)` | Vibration |
| `won()`, `lost()` | Mission gewonnen bzw. Burg gefallen |

Geräuschnamen für `sfx`: `bau`, `stein` (Mauerteil gesetzt), `abriss`, `feuer`, `treffer`, `ramme`, `einsturz`, `glocke` (Angriff), `sieg`, `niederlage`, `klick`. Die Darstellung ergänzt `pfeil`, `holz` und `steinbruch`.

Die Darstellung darf den Zustand nur über die Logik-Funktionen ändern (`act`, `startGame`, Hof-Einstellungen in `S.tax`/`S.ration`, Ausbilden, Befehle `order`/`orderAttack`, `trade`, `resolveEvent`).

Nacht: Abdunklung höchstens 48 % (einfache Grafikstufe 40 %), Lichtquellen schneiden Lichtkegel heraus. Mauern verbinden sich optisch nicht mit dem Bergfried; der Bergfried wird nach den übrigen Gebäuden seiner Reihe gezeichnet.

Spielprotokoll (`js/playlog.js`, reine Darstellung): umhüllt Logik-Funktionen (`startGame`, `act`, `recruit`, `order…`, `trade`, `resolveEvent`, `dayTick`, `spawnWave` …) und `H.say/won/lost`, ohne ihr Verhalten zu ändern, und schreibt Einträge `[Zeit, Tag, Art, Text]` nach `localStorage['zinnenwerk-playlog']` (höchstens 4000, älteste fallen weg). Dazu alle 15 s die Bildrate, Fehler und eigene Notizen. Abschaltbar in den Einstellungen.

Das HUD (Statusleiste) ist reine Darstellung. Hochformat kompakt in drei schmalen Zeilen: Tagesmedaille mit Fortschrittsring und Tempo; Ressourcen-Plaketten als wischbare Zeile (gold umrandet ab 90 % Lagerfüllung, rot bei Verfall); Einwohner, Beliebtheitsleiste, Auftrag (Symbol, Leiste, Zahl) und Angriffs-Plakette. „▾“ klappt alles aus (alle Ressourcen, Zielbeschreibungen, freie Leute). Der Berater sitzt als Porträt unter der Leiste; seine Sprechblase öffnet sich bei jedem neuen Hinweis für 7 s, Antippen öffnet oder schließt sie. Quer und am Desktop steht alles in der 250 px breiten Seitenleiste. Meldungen erscheinen als Banner; Farbe nach Art (Gefahr rot, Erfolg grün).

## 11. Balancing

Zusätzlich prüft `tests/logic.mjs` einzelne Regeln headless (Lager, Waffenkette, Burgausbau, Truppenkosten, Migration, Wellenzählung, Truppen-Wegfindung über Mauern, Leitermänner, Speer gegen Ramme, feindliche Bogenschützen).

Werkzeug: `node tools/sim.mjs [mission|all] [läufe] [--log] [--check]`. Lädt die Logikdateien headless und lässt einen einfachen Bot spielen (feste Prioritätenliste: Holzfäller, Obst, Hütten nach Bedarf, Steinbruch, Brotkette, Mauerring mit Radius 3 um den Bergfried mit Tor im Süden und Türmen an Ecken und Seitenmitten, Kaserne, Brunnen bei Brandstiftern, Schützen bis 3 + 3 je Turm mit 15 Gold Reserve; Steuer runter unter 52 Beliebtheit, rauf über 68; ab Etappe 2 außerdem Bogenmacher, Lager/Kornkammer/Rüstkammer bei 85 % Füllstand und Burgausbau, sobald der Ring steht). `--check` prüft die Zielbereiche und läuft in CI.

Zielwerte: Mission 1–3 ≥ 90 % Siege, Mission 4 ≥ 80 %, Mission 5 zwischen 50 und 90 %. Gold soll im späteren Spiel knapp bleiben.

Ergebnis nach Etappe 1 (30 Läufe je Mission, verschiedene Zufallsfolgen für Angriffsrichtungen):

| Mission | Siege | Ø Tage | Ø Einwohner | Ø Gold am Ende | min. Bergfried-LP |
|---|---|---|---|---|---|
| 1 Ein neuer Anfang | 100 % | 15 | 24 | 125 | 150 |
| 2 Brot für alle | 100 % | 11 | 21 | 99 | 150 |
| 3 Steinerne Wacht | 100 % | 23 | 33 | 17 | 149 |
| 4 Flammen im Tal | 100 % | 29 | 39 | 90 | 150 |
| 5 Die Belagerung | 73 % | 38 | 49 | 269 | 66 |

Änderungen in dieser Etappe und warum:
- **Wellenzählung** (Fehlerbehebung): Vorher zählte eine Welle erst als abgewehrt, wenn gar kein Feind mehr auf der Karte war. In Mission 5 überlappen sich die Wellen, das Ziel war dadurch praktisch unerreichbar (Bot 0 %).
- **Steuern** leicht gesenkt (0,5 / 0,8 / 1,2 statt 0,6 / 1,0 / 1,5) und **Sold** 1 Gold pro Schütze und Tag: Vorher lagen am Ende von Mission 5 über 900 Gold ungenutzt herum. Jetzt sind es rund 270, in Mission 3 ist Gold richtig knapp.
- **Kopfgeld** gesenkt (2 statt 3, Rammbock 6 statt 8), damit Angriffe kein Goldesel sind.
- **Mission 5** stärker (scale 1,4 statt 1,2): Mit funktionierender Wellenzählung gewann der Bot sonst 95 %; jetzt etwa drei von vier Partien, mit deutlich angeschlagenem Bergfried.

Ergebnis nach Etappe 2 (Lager, Waffenkette, Burgstufen; 20 Läufe):

| Mission | Siege | Ø Tage | Ø Gold am Ende | min. Bergfried-LP |
|---|---|---|---|---|
| 1 | 100 % | 15 | 125 | 150 |
| 2 | 100 % | 11 | 141 | 150 |
| 3 | 100 % | 23 | 34 | 150 |
| 4 | 100 % | 30 | 15 | 146 |
| 5 | 70 % | 38 | 352 | 67 |

Da Bogenschützen jetzt Bögen brauchen, bekommen Mission 3–5 einige Bögen zum Start (4/4/6), damit die erste Welle nicht an der neuen Werkstatt scheitert. Gold ist in Mission 3 und 4 knapp; in Mission 5 fließt ein Teil in den Burgausbau.

Ergebnis nach Etappe 3 (Truppen als Einheiten, feindliche Bogenschützen und Leitermänner; 20 Läufe, Mission 5 zusätzlich 80 Läufe):

| Mission | Siege | Ø Tage | Ø Gold am Ende | min. Bergfried-LP |
|---|---|---|---|---|
| 1 | 100 % | 15 | 125 | 150 |
| 2 | 100 % | 11 | 141 | 150 |
| 3 | 100 % | 23 | 34 | 150 |
| 4 | 100 % | 30 | 14 | 147 |
| 5 | 65 % (80 Läufe: 64 %) | 40 | 214 | 51 |

Mission 4 bekommt Leitermänner ab Welle 3, Mission 5 feindliche Bogenschützen ab Welle 3 und 4 Speere zum Start. Der Bot stellt Speerträger auf, sobald Rammböcke drohen.

Änderungen in dieser Etappe und warum:
- **Gefallene zählen**: Vorher kehrte ein gefallener Soldat stillschweigend als Arbeiter zurück. Jetzt sinkt die Einwohnerzahl. Dadurch fiel Mission 5 auf 40 %: Die Simulation zeigte rund 14 tote Bogenschützen je Partie, fast alle durch feindliche Pfeile auf Mauern und Türmen.
- **Deckung hinter Zinnen** (Pfeilschaden oben ×0,5, Turm ×0,4): Mauern und Türme schützen ihre Besatzung spürbar, wie man es erwartet. Mission 5 liegt damit bei rund 65 %.

Ergebnis nach Etappe 4 (Welt, Ereignisse, Markt; 20 Läufe, Mission 5 zusätzlich 80 Läufe):

| Mission | Siege | Ø Tage | Ø Gold am Ende | min. Bergfried-LP |
|---|---|---|---|---|
| 1 | 100 % | 15 | 125 | 150 |
| 2 | 100 % | 11 | 140 | 150 |
| 3 | 100 % | 23 | 32 | 150 |
| 4 | 90 % | 30 | 219 | 131 |
| 5 | 75 % (80 Läufe: 66 %) | 39 | 170 | 60 |

Änderungen und warum:
- **Ereignisse** kosteten Mission 5 rund 8 Prozentpunkte (Seuche, Wölfe). Deshalb seltener (12 % statt 16 %, Abklingzeit 5 Tage) und Mission 5 startet mit 170 statt 150 Gold. Der Bot baut bei einer Seuche eine Apotheke und richtet Feste aus, wenn er mehr als 110 Gold hat und die Beliebtheit unter 62 liegt.
- **Jahreszeiten 10 statt 6 Tage** (Rückmeldung: Wechsel zu schnell). Der Winter fällt in Mission 5 damit genau in die späten, schweren Angriffe (Bot 35–48 %). Ausgleich: Mission 5 startet mit 30 Brot und 30 Äpfeln (vorher 10 und 20).
- **Eisenvorkommen** auf den Kampagnenkarten liegt am Westfelsen: An anderen Stellen verdrängte es Bäume und Bauplätze und senkte Mission 5 um rund 10 Prozentpunkte.
- Freies Spiel auf großen Karten (Bot, 60 Tage, je 4 Karten Mittel/Groß): keine Niederlage, 5–6 abgewehrte Angriffe, 60 Tage in unter 1 s Rechenzeit.

Ergebnis nach Etappe 5 (20 Läufe; Missionen 1–5 unverändert):

| Mission | Siege | Ø Tage | min. Bergfried-LP |
|---|---|---|---|
| 6 Über den Fluss | 100 % | 29 | 150 |
| 7 Eisen aus den Bergen | 100 % | 30 | 150 |
| 8 Der lange Winter | 100 % | 46 | 150 |
| 9 Die große Belagerung | 70 % | 62 | 105 |
| 10 Sturm auf Rabenfels | 85 % | 71 | 134 |

Zielbereiche: 6–7 ≥ 80 %, 8 ≥ 70 %, 9–10 zwischen 50 und 90 %. Der Bot nutzt ab Mission 6 zusätzliche Regeln (Kaserne und Steinbrüche vor dem Mauerring, Bauplätze nur in Reichweite der eigenen Leute, mehr Holzfäller bei Holzmangel, Mine und Schwertschmiede beim Schwertziel, Goldüberschuss in Bögen vom Markt und Schützen) und bei der Belagerung eine feste Reihenfolge: Katapulte schleifen die Türme am Tor, dann Rammböcke und Nahkämpfer ans Tor, danach Nahkämpfer gegen die Wachen und Rammböcke gegen den Bergfried. Die Regeln für Missionen 1–5 sind unverändert, ihre Ergebnisse auch.

Änderungen und warum:
- **Mission 7**: 60 statt 30 Stein zum Start, sonst fehlte dem Bot der Stein für Kaserne und Schmied.
- **Mission 9**: Angriffe alle 5 Tage, Stärke 1,8 – mit sinnvoll eingesetztem Gold gewann der Bot sonst fast immer.
- **Mission 10**: Die Verteidiger allein machten kaum einen Unterschied (Katapulte schießen weiter als die Turmschützen). Schwierigkeit kommt aus den Ausfällen von Rabenfels gegen das eigene Lager (Stärke 1,3, mit Leitern, Bogenschützen und Rammböcken).
