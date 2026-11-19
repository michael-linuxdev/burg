# Zinnenwerk – Spielregeln und Zahlenwerte

Dieses Dokument beschreibt die Spielmechanik vollständig und unabhängig von der Darstellung, sodass eine spätere Unity-Portierung danach gebaut werden kann. Maßgeblich ist der Code in `js/data.js`, `js/core.js`, `js/economy.js` und `js/combat.js` (keine DOM-Zugriffe). Die Darstellung (`render.js`, `ui.js`) liest den Zustand nur und hängt sich über die Rückrufe in `H` ein.

## 1. Zeit

| Größe | Wert |
|---|---|
| Ein Spieltag | 4 s Echtzeit bei Tempo 1× (`DAY`) |
| Tempo | 0 (Pause), 1×, 3× – bei 3× wird der Simulationsschritt dreimal pro Bild ausgeführt |
| Simulationsschritt | Bildzeit, höchstens 0,05 s |
| Jahreszeit | 6 Tage (`SLEN`), Reihenfolge Frühling → Sommer → Herbst → Winter |
| Jahreszeit von Tag d | `floor((d − 1) / 6) mod 4` (0 Frühling … 3 Winter) |
| Tag-Nacht-Zyklus | 6 Tage (`CYC`), rein optisch |

Ablauf pro Simulationsschritt (`step(dt)`): Uhr um `dt` erhöhen; jedes Mal, wenn sie `DAY` überschreitet, `dayTick()` ausführen; danach `update(dt)` (Echtzeit: Feinde, Feuer, Schützen).

## 2. Karte

- Raster `COLS × ROWS` (Standard 12 × 20), Feld-Index `i = r · COLS + c`.
- Gelände: Gras (0, bebaubar), Wald (1), Fels (2), Wasser (3). Nur Gras ist bebaubar und begehbar.
- Bergfried bei `(KR, KC) = (11, 5)`. Im Umkreis von 2 Feldern um den Bergfried ist immer Gras.
- Kartengenerator: deterministischer Zufall (Mulberry32) aus dem Missions-Seed; Wald-, Fels- und Wasserflecken („Blobs“) an festen Ankerpunkten mit Zufallsversatz ±0,8. Ein Feld im Radius `rad` um das Zentrum wird mit Wahrscheinlichkeit `den · (1 − d/rad · 0,55)` umgewandelt.
- Im Querformat wird die Karte nur transponiert dargestellt; die Logik bleibt gleich. Himmelsrichtungen werden für Meldungen gedreht (Norden ↔ Westen, Süden ↔ Osten).

## 3. Rohstoffe

Holz, Stein, Weizen, Mehl, Brot, Äpfel, Gold. Startwerte (`BASE`): 40 Holz, 15 Äpfel, 60 Gold, sonst 0. Missionen überschreiben einzelne Werte.

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
| `turm` | Turm | 10 Stein | – | 90 LP, bis 3 Bogenschützen, Reichweite 4,6 |
| `kaserne` | Kaserne | 10 Holz, 6 Stein | – | erlaubt das Ausbilden von Bogenschützen |
| `abriss` | Abreißen | – | – | Werkzeug: entfernt Gebäude, erstattet `floor(Kosten/2)` |

Gebäude ohne Mauer-Eigenschaft haben 40 LP (nur für Feuer relevant). Bauregeln: Feld ist Gras, frei, kein Feind steht darauf oder läuft gerade hinein, Nähe-Bedingung erfüllt, Kosten vorhanden.

### Arbeiter
Bei jeder Änderung werden Arbeiter neu verteilt: freie Leute = Einwohner − Bogenschützen. Gebäude mit Arbeitsbedarf werden nach Bau-Reihenfolge (ID) besetzt, sofern sie erreichbar sind und genug freie Leute da sind. Übrige Leute sind „frei“.

### Erreichbarkeit
Produktionsgebäude arbeiten nur, wenn ein Weg für eigene Leute zum Bergfried existiert (Breitensuche über Gras; Mauern und Türme blockieren, Tore nicht). Abgeschnittene Gebäude („cut“) produzieren nichts.

## 5. Tageslauf (`dayTick`)

Reihenfolge:
1. Tag erhöhen, Jahreszeit bestimmen, Arbeiter verteilen.
2. **Produktion** in drei Durchgängen: erst Gebäude ohne Verbrauch, dann Mühlen, dann Bäckereien (so wird frischer Weizen am selben Tag gemahlen). Ein Gebäude mit Verbrauch arbeitet nur, wenn der volle Verbrauch vorrätig ist (sonst „wartet auf Rohstoffe“).
3. **Essen**: Nahrung = Brot + Äpfel. Bedarf = `ceil(Einwohner · r)` mit `r` aus der Rationsstufe. Reicht die Nahrung nicht, sinkt die effektive Ration stufenweise. Verbraucht wird gleichmäßig über die vorhandenen Sorten (kleinster Vorrat zuerst). Abwechslung = Anzahl Sorten mit Vorrat > 0.
4. **Brennholz** im Winter: `ceil(Einwohner / 10)` Holz pro Tag, sonst „Kälte“.
5. **Steuern**: Gold += `round(Einwohner · g)`; Gold fällt nie unter 0. „Geschenk“ schaltet automatisch auf „Keine“, wenn das Gold nicht mehr für einen Tag reicht.
   **Sold**: danach `ceil(Bogenschützen · 1)` Gold (`SOLD`). Reicht das Gold nicht, wird es auf 0 gesetzt und „Sold nicht bezahlt“ (−3 Beliebtheit) gilt bis zum nächsten bezahlten Tag.
6. **Beliebtheit** (0–100): `pp += 0,5 · Σ Faktoren`.
7. **Bevölkerung**: bei pp ≥ 50 Zuzug +1 (bei pp ≥ 75 +2) bis zur Kapazität; bei pp < 50 Wegzug −1 (bei pp < 25 −2), nie unter die Zahl der Bogenschützen. Kapazität = `12 + 8 · Hütten`.
8. **Angriffsplan** (siehe 7.) und Siegprüfung, dann automatisch speichern.

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
Ration (oben), Abwechslung beim Essen (+2 bei ≥ 2 Sorten), Steuer (oben), Kapellen (+2 je Kapelle, max. 3), Sold nicht bezahlt (−3), Angst nach Bränden (−3 für 3 Tage nach einem abgebrannten Gebäude), Kälte ohne Brennholz (−4).

Startwerte: Beliebtheit 60, Steuer „Niedrig“, Ration „Normal“.

## 6. Feuer

- Brandstifter zünden alle 4 s ein brennbares Gebäude in den 8 Nachbarfeldern an (Suche alle 0,5 s, wenn keins da ist).
- Brennende Gebäude verlieren 3 LP/s. Pro Sekunde springt das Feuer mit Wahrscheinlichkeit 0,12 über; dann wird jedes der 4 Nachbarfelder mit 50 % entzündet.
- Ein Brunnen im Umkreis 3 (Chebyshev) löscht ein Feuer, das länger als 2,5 s brennt.
- Der Spieler kann ein brennendes Gebäude für 2 Gold löschen (antippen).
- Brennbar ist alles außer Bergfried, Mauern/Türmen/Toren und Brunnen.

## 7. Angriffe

Missionsparameter `raid = {start, every, fire, ram, scale}`:
- Erster Angriff nach `start` Tagen, danach alle `every` Tage. 3 Tage vorher melden Späher die Richtung (in den ersten zwei Wellen Norden/Osten/Westen, danach auch Süden).
- Welle k: Anzahl `n = max(1, round((1 + 2k) · scale))`, Grund-LP `8 + 3k`.
- Brandstifter ab Welle `fire`: `1 + floor((k − fire)/2)`, sie ersetzen Räuber. Rammböcke ab Welle `ram`: `1 + floor((k − ram)/2)`, zusätzlich.
- Feinde erscheinen auf freien Grasfeldern am Rand der gemeldeten Seite, im Abstand von 0,7 s.
- Jeder Feind gehört zu seiner Welle (`w`). Eine Welle gilt als abgewehrt, sobald ihr letzter Feind fällt – auch wenn schon die nächste Welle angreift (Wellen können sich überlappen, z. B. Mission 5: alle 20 s).
- Belohnung (`KILL_GOLD`, `RAM_GOLD`, `WAVE_GOLD`): 2 Gold pro Feind, 6 pro Rammbock, +10 Gold je abgewehrter Welle.

| Feind | LP-Faktor | Tempo (Felder/s) | Schaden/s | Rüstung (Faktor auf Pfeilschaden) |
|---|---|---|---|---|
| Räuber | 1 | 1,1 | 3 | 1 |
| Brandstifter | 0,7 | 1,3 | 2 | 1 |
| Rammbock | 3,5 | 0,45 | 14 (Bergfried: 10) | 0,34 |

### Wegfindung der Feinde
Dijkstra vom Bergfried aus über Gras. Kosten: freies Gras 1, Mauerfeld `1 + LP/5`, sonst unpassierbar (Gebäude ohne Mauer-Eigenschaft sind begehbar). Ein Feind geht stets auf das Nachbarfeld mit den geringsten Restkosten. Ist es eine Mauer/ein Tor/ein Turm, greift er es an (1 Schlag/s) bis es fällt; ist es der Bergfried, greift er diesen an. Die Kostenkarte wird bei jeder Gebäudeänderung neu berechnet, daher suchen Feinde automatisch die schwächste Stelle.

### Verteidigung
- Bergfried: 150 LP. Fällt er, ist das Spiel verloren. Zwei Wachen schießen immer (Reichweite 3,5).
- Bogenschützen: 12 Gold (`ARCHER_GOLD`) plus 1 Gold Sold pro Tag, brauchen eine Kaserne und eine freie Person. Die ersten 3 stehen im Bergfried, dann je 3 pro Turm (Reichweite 4,6), der Rest im Bergfried.
- Schussrate: 1 Pfeil pro Schütze und Sekunde, Ziel ist der nächste Feind in Reichweite, Schaden `3 · Rüstung`.

## 8. Ziele und Missionen

Zieltypen: `pop` (Einwohner ≥ n), `brot` (Brot auf Vorrat ≥ n), `raids` (abgewehrte Wellen ≥ n), `pp` (Beliebtheit ≥ n). Eine Mission ist gewonnen, sobald alle Ziele gleichzeitig erfüllt sind.

| # | Name | Seed | Start | Einw. | Ziele | Angriffe |
|---|---|---|---|---|---|---|
| 1 | Ein neuer Anfang | 1201 | Basis | 10 | 24 Einwohner | keine |
| 2 | Brot für alle | 3307 | 60 Holz, 20 Äpfel | 14 | 40 Brot | ab Tag 10, alle 9, scale 0,6 |
| 3 | Steinerne Wacht | 4411 | 50 Holz, 20 Stein, 20 Äpfel, 80 Gold | 14 | 3 Wellen | ab 7, alle 6 |
| 4 | Flammen im Tal | 5519 | 60 Holz, 20 Stein, 20 Äpfel, 100 Gold | 16 | 4 Wellen, 50 Beliebtheit | ab 7, alle 6, Brandstifter ab Welle 1 |
| 5 | Die Belagerung | 6623 | 80 Holz, 40 Stein, 10 Brot, 20 Äpfel, 150 Gold | 18 | 5 Wellen | ab 8, alle 5, Brandstifter und Rammböcke ab Welle 2, scale 1,4 |
| – | Freies Spiel | zufällig | Basis + 5 Brot | 10 | – | ab 8, alle 7, Brand ab 3, Ramm ab 5 |

## 9. Speichern

- Automatischer Spielstand: `localStorage['zinnenwerk-auto']`, nach jedem Tag, jeder Welle und beim Laden.
- Drei feste Plätze: `zinnenwerk-slot-1` … `-3`, im Menü mit Vorschau (Mission, Tag, Jahreszeit, Zeitpunkt).
- Jeder Stand trägt `ver` (aktuell 2) sowie `cols`, `rows`, `kr`, `kc`. `migrate()` hebt ältere Stände an: Version 1 (Schlüssel `zinnenwerk-v3`) bekommt 12 × 20 / Bergfried (11, 5), Feinde ohne Wellennummer werden der letzten Welle zugeordnet. Ein alter v3-Stand wird beim ersten Start in den automatischen Spielstand übernommen; der alte Schlüssel bleibt unangetastet.
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
| `shot(x1, y1, x2, y2)` | Pfeilflug zeichnen |
| `side(s)` | Himmelsrichtung für die Anzeige übersetzen |
| `vibrate(muster)` | Vibration |
| `won()`, `lost()` | Mission gewonnen bzw. Burg gefallen |

Geräuschnamen für `sfx`: `bau`, `stein` (Mauerteil gesetzt), `abriss`, `feuer`, `treffer`, `ramme`, `einsturz`, `glocke` (Angriff), `sieg`, `niederlage`, `klick`. Die Darstellung ergänzt `pfeil`, `holz` und `steinbruch`.

Die Darstellung darf den Zustand nur über die Logik-Funktionen ändern (`act`, `startGame`, Hof-Einstellungen in `S.tax`/`S.ration`, Ausbilden).

## 11. Balancing

Werkzeug: `node tools/sim.mjs [mission|all] [läufe] [--log] [--check]`. Lädt die Logikdateien headless und lässt einen einfachen Bot spielen (feste Prioritätenliste: Holzfäller, Obst, Hütten nach Bedarf, Steinbruch, Brotkette, Mauerring mit Radius 3 um den Bergfried mit Tor im Süden und Türmen an Ecken und Seitenmitten, Kaserne, Brunnen bei Brandstiftern, Schützen bis 3 + 3 je Turm mit 15 Gold Reserve; Steuer runter unter 52 Beliebtheit, rauf über 68). `--check` prüft die Zielbereiche und läuft in CI.

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
