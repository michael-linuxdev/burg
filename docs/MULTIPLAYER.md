# Burgwacht – Konzept für einen asynchronen Mehrspielermodus

Stand: Etappe 6 (nur Konzept). Nichts davon ist im Spiel eingebaut. Burgwacht läuft weiterhin rein statisch auf GitHub Pages; ein Mehrspielermodus braucht einen Server und kommt, wenn überhaupt, als eigenes Projekt dazu.

Vorbereitet ist im Code nur das **Burgformat** (`js/maps.js`: `castleFromState`, `validateCastle`, `castlePower`, mit Logik-Test). Es baut auf dem Kartenformat der Kartenschmiede auf.

## 1. Idee in einem Satz

Spieler stellen ihre Burg als Verteidigung online. Andere greifen sie mit einem selbst gewählten Heer an, und die Verteidigung führt die KI. Niemand muss gleichzeitig online sein.

## 2. Ablauf

1. **Burg hochladen.** Im Spiel gibt es einen Knopf „Als Verteidigung freigeben“. Er erzeugt aus dem aktuellen Spielstand eine Burg (`castleFromState`): Gelände, Gebäude, Burgstufe und die Aufstellung der Truppen. Rohstoffe, Wirtschaft und Zeit werden nicht übertragen.
   - Der Server prüft die Burg (Abschnitt 5) und speichert sie als neue Version. Ältere Versionen bleiben für laufende Angriffe und Wiederholungen erhalten.
2. **Gegner finden.** Der Server schlägt drei Burgen mit ähnlichem Stärkewert vor (`castlePower`, ± 20 %). Burgen, die gerade angegriffen wurden, haben eine Schutzzeit von 8 Stunden.
3. **Heer zusammenstellen.** Der Angreifer wählt Einheiten im Rahmen eines Budgets. Das Budget richtet sich nach seiner eigenen Burg oder seinem Ruhm. Belagerungsgerät zählt mit.
4. **Angriff.** Der Server liefert die Burg, einen Zufalls-Seed und eine Angriffskennung. Gespielt wird lokal und vollständig deterministisch:
   - Der Angreifer gibt dieselben Befehle wie im Truppenmodus.
   - Die Verteidiger verhalten sich wie die Burgverteidiger in „Sturm auf Rabenfels“: Schützen bleiben auf Türmen und Mauern, Wachen stellen Angreifer in der Nähe ihres Postens.
   - Ein Zeitlimit von 3 Minuten Spielzeit beendet den Angriff.
5. **Ergebnis.** Der Client schickt nur die **Eingaben** (Wiederholung), nicht das Ergebnis. Der Server simuliert den Angriff mit denselben Logikdateien nach und berechnet daraus das Ergebnis.
   - Bewertet werden: zerstörter Anteil der Burg, ob der Bergfried gefallen ist (Sterne 0–3) und die benötigte Zeit.
   - Ruhm geht an den Angreifer. Der Verteidiger bekommt Ruhm, wenn seine Burg hält.
6. **Wiederholung.** Beide Seiten können sich den Angriff ansehen. Dazu wird die Wiederholung mit derselben Burgversion und demselben Seed abgespielt.

## 3. Datenformate

Alle Formate sind JSON, kompakt und mit einer Versionsnummer versehen. Gelände wird wie in der Kartenschmiede als Lauflängen kodiert.

### Burg (`cv: 1`, schon im Code)

```json
{
  "cv": 1,
  "map": { "v": 1, "n": "Feste Talwacht", "s": "", "cols": 20, "rows": 28, "kr": 15, "kc": 10,
           "t": "0*40.1*3.0*12…", "res": {}, "pop": 0, "goals": [], "raid": null, "events": false },
  "keepLv": 1,
  "b": [["mauer", 12, 7], ["turm", 12, 10], ["tor", 18, 10], ["schmied", 14, 8, "schwert"]],
  "d": [["archer", 12, 10], ["spear", 17, 10]],
  "power": 812
}
```

- `b`: Gebäude als `[Typ, Reihe, Spalte, Modus?]`. Erlaubt sind alle baubaren Typen, keine Werkzeuge und keine feindlichen Bauten.
- `d`: Verteidiger als `[Einheit, Reihe, Spalte]`. Erlaubt sind Bodenfelder sowie Mauer, Turm und Bergfried.
- `power`: der Stärkewert. Der Server berechnet ihn selbst neu und verlässt sich nie auf den mitgeschickten Wert.

### Hülle auf dem Server

```json
{ "id": "c_7f3a…", "owner": "p_19b2…", "version": 4, "created": "2026-11-20T18:04:00Z",
  "rules": "5.9.0", "hash": "sha256:…", "castle": { … } }
```

- `rules`: Version der Spielregeln (Logikdateien). Angriffe werden immer mit genau dieser Version nachgerechnet.
- `hash`: SHA-256 über die Burg in kanonischer Form (Schlüssel sortiert). So erkennt der Server unveränderte Uploads und Wiederholungen bleiben eindeutig zuzuordnen.

### Angriff und Wiederholung

```json
{
  "attack": "a_51c0…", "castle": "c_7f3a…", "castleVersion": 4, "rules": "5.9.0", "seed": 918273645,
  "army": [["kat", 2], ["sram", 1], ["sword", 4], ["knight", 2]],
  "step": 0.05,
  "inputs": [
    [0,   "deploy", 3, 10],
    [42,  "order",  [1, 2, 3], 412],
    [180, "attackB", [0, 1], 389],
    [260, "attack", [4, 5], 17]
  ]
}
```

- `inputs`: Liste aus `[Tick, Befehl, Argumente]`. Ein Tick dauert 0,05 s Spielzeit.
- Befehle: `deploy` (Einheiten am Kartenrand absetzen), `order` (Einheiten-IDs, Zielfeld), `attack` (auf einen Feind), `attackB` (auf ein Gebäude). Das entspricht `order`, `orderAttack` und `orderAttackB` in `js/units.js`.
- Ergebnis, nur vom Server berechnet: `{ "stars": 2, "destroyed": 0.64, "keep": false, "ticks": 3120, "fame": +18 }`.

### Spieler

```json
{ "id": "p_19b2…", "name": "Burgherr Anton", "fame": 1240, "created": "…", "castle": "c_7f3a…" }
```

Der Anzeigename ist frei wählbar und wird gefiltert. Weitere personenbezogene Daten werden nicht gespeichert (Abschnitt 8).

## 4. Determinismus

Die Logik (`data.js`, `core.js`, `economy.js`, `combat.js`, `units.js`, `events.js`, `maps.js`) greift nicht auf das DOM zu. Sie läuft heute schon headless in Node (`tools/sim.mjs`). Für Wiederholungen braucht es zusätzlich:

1. **Fester Zeitschritt** von 0,05 s statt der Bildzeit. Im Angriffsmodus läuft die Darstellung unabhängig davon.
2. **Eigener Zufall statt `Math.random`.** Die Logik bekommt einen Zufallsgenerator mit Seed (Mulberry32 wie im Kartengenerator). `tools/sim.mjs` macht das heute schon, indem es `Math.random` im vm-Kontext ersetzt.
3. **Keine Abhängigkeit von der Uhr** im Angriffsmodus: keine Ereignisse, kein Tageswechsel, keine Wirtschaft.
4. **Zahlen:** JavaScript rechnet überall in IEEE-754-Doppelgenauigkeit, Browser und Node liefern dieselben Ergebnisse, solange keine Funktionen mit plattformabhängiger Genauigkeit vorkommen. `Math.hypot`, `Math.sin` und `Math.atan2` stecken in der Bewegung und gelten nicht überall als bitgenau. Deshalb: Abstände für Spielentscheidungen über `Math.sqrt` (bitgenau laut Standard) und Winkel nur für die Darstellung. Diese Umstellung ist vor dem Start nötig, ein Prüftest vergleicht Browser und Node.
5. **Regelversion:** Jede Burg und jeder Angriff trägt `rules`. Der Server hält alte Logikversionen vor, solange Wiederholungen darauf verweisen.

## 5. Schutz gegen Schummeln

Grundsatz: **Der Server glaubt dem Client nichts, was er selbst nachrechnen kann.**

| Angriffspunkt | Gegenmaßnahme |
|---|---|
| Unmögliche Burg (Mauern auf dem Bergfried, fremde Bautypen, zu viele Türme) | `validateCastle` auf dem Server: bekannte Typen, passendes Gelände, keine Doppelbelegung, Obergrenzen (400 Gebäude, 60 Verteidiger). Dazu ein Baubudget aus dem Fortschritt des Spielers: Die Summe der Baukosten ist begrenzt. |
| Unbezwingbare Burg (Bergfried komplett ohne Lücke eingemauert, nur Türme) | Erlaubt, Mauern sind zerstörbar. Aber: Mindestabstand des Bergfrieds zum Rand und eine Obergrenze für Türme je Fläche. Der Stärkewert sorgt dafür, dass starke Burgen nur von starken Spielern angegriffen werden. |
| Gefälschtes Ergebnis | Der Client schickt nur Eingaben. Das Ergebnis berechnet der Server per Nachsimulation. |
| Manipulierte Eingaben (Befehle an fremde Einheiten, Absetzen mitten in der Burg) | Befehle werden in der Nachsimulation geprüft: nur eigene Einheiten-IDs, `deploy` nur auf Randfelder, höchstens 10 Befehle pro Sekunde, Ticks aufsteigend und innerhalb des Zeitlimits. |
| Zu großes Heer | Das Heer wird gegen das Budget des Angreifers geprüft, das der Server aus Ruhm und Burg berechnet. |
| Mehrfaches Einreichen, Angriff „ausprobieren“ und abbrechen | Die Angriffskennung ist einmalig und läuft nach 10 Minuten ab. Ein abgebrochener Angriff zählt als verloren. Seed und Burgversion legt der Server fest. |
| Abgefangene Daten | HTTPS, kurzlebige Sitzungstoken. Zugriff auf die Datenbank nur über Regeln auf Zeilenebene oder Serverfunktionen. |
| Massenkonten, Ruhm-Schieben | Ruhm hängt vom Stärkeunterschied ab (wie bei Elo). Wiederholte Angriffe auf dieselbe Burg innerhalb von 24 h bringen nichts. Anmeldungen sind pro Gerät und Stunde begrenzt. |

Bewusst nicht vorgesehen: Code-Verschleierung oder Prüfungen im Client. Bei einer offenen PWA bringen sie wenig; die Nachsimulation auf dem Server reicht aus.

## 6. Vorschlag für das Backend

**Empfehlung: Supabase** (Postgres, Auth, Edge Functions, Storage). Rechenzentrum in der EU wählbar.

- **Warum:** relationale Daten mit Regeln auf Zeilenebene passen gut zu Burgen, Versionen und Angriffen. Anonyme Anmeldung ist möglich, später mit E-Mail- oder Passkey-Verknüpfung. Edge Functions laufen in Deno, die Logikdateien funktionieren dort ohne Build, ähnlich wie in `tools/sim.mjs`.
- **Alternative: Firebase** (Firestore, Cloud Functions in Node, Hosting). Ebenso gut machbar. Cloud Functions können `tools/sim.mjs` direkt wiederverwenden. Nachteile: Dokumentdatenbank statt SQL, für Ranglisten und Gegnersuche umständlicher, EU-Region muss bewusst gewählt werden.

### Tabellen (Supabase)

| Tabelle | Inhalt |
|---|---|
| `players` | id (= auth.uid), name, fame, created_at |
| `castles` | id, owner, current_version, power, shield_until |
| `castle_versions` | castle_id, version, rules, hash, data (jsonb), created_at |
| `attacks` | id, attacker, castle_id, castle_version, seed, army, status (offen/fertig/abgelaufen), result (jsonb), created_at, expires_at |
| `replays` | attack_id, inputs (jsonb, gzip im Storage ab 64 KB) |
| `rules` | version, Logikdateien als Bundle (für die Nachsimulation alter Angriffe) |

Regeln auf Zeilenebene: Spieler lesen alle Burgversionen, die gerade angreifbar sind, und alle eigenen Angriffe. Schreiben geht nur über Edge Functions.

### Schnittstellen (Edge Functions)

| Aufruf | Zweck |
|---|---|
| `POST /castle` | Burg hochladen, Prüfung mit `validateCastle` und Baubudget, neue Version speichern |
| `GET /opponents` | drei Gegner mit passendem Stärkewert, ohne Schutzzeit, nicht die eigene Burg |
| `POST /attack/start` | Angriff anmelden: legt Seed, Burgversion und Ablaufzeit fest und liefert die Burg |
| `POST /attack/finish` | Eingaben einreichen, Nachsimulation (höchstens ca. 3600 Ticks, unter 1 s Rechenzeit), Ergebnis, Ruhm, Schutzzeit |
| `GET /replay/:id` | Wiederholung mit Burgversion und Seed zum Abspielen |
| `GET /ladder` | Rangliste nach Ruhm (Saisons optional) |

### Kosten und Betrieb

Eine Nachsimulation dauert auf einer kleinen Instanz unter einer Sekunde (gemessen: 60 Spieltage auf der großen Karte in unter 1 s). Für einige tausend Angriffe am Tag reicht der kostenlose oder kleinste bezahlte Tarif. Die PWA bleibt auf GitHub Pages; die Backend-Adresse kommt in eine Konfigurationsdatei. Ohne Netz bleibt alles Bisherige spielbar, der Mehrspielerknopf ist dann ausgegraut.

## 7. Spielregeln für den Mehrspielermodus

- **Angriffsmodus:** Es gibt keine Wirtschaft, kein Wetter, keine Ereignisse und keinen Tageswechsel. Die Uhr steht auf Mittag, damit die Darstellung bei beiden Spielern gleich aussieht.
- **Einheiten absetzen:** Der Angreifer setzt seine Einheiten an einem Kartenrand seiner Wahl ab, höchstens 20 % des Heeres pro Sekunde.
- **Verteidiger:**
  - Bogenschützen bleiben auf ihren Mauer- und Turmfeldern und behalten Reichweiten- und Deckungsbonus.
  - Nahkämpfer bewachen ihren Posten im Umkreis von 3,2 Feldern.
  - Die Wachen des Bergfrieds schießen wie im Einzelspiel.
- **Sterne:**
  - ★ für 50 % zerstörte Verteidigungsbauten (Mauern, Türme, Tore),
  - ★ für den gefallenen Bergfried,
  - ★ für beides in weniger als der Hälfte der Zeit.
- **Ruhm:** Elo-artig mit K = 24, berechnet aus Sternen und dem Stärkeunterschied.

## 8. Datenschutz

- Anonyme Konten. Gespeichert werden nur Anzeigename, Ruhm, Burgen, Angriffe und Wiederholungen. Es gibt keine Analyse-Werkzeuge und keine Werbung.
- „Konto löschen“ entfernt Spieler, Burgen und Wiederholungen. Fremde Wiederholungen mit der eigenen Burg werden anonymisiert.
- Das lokale Spielprotokoll (`js/playlog.js`) bleibt lokal und wird nie automatisch hochgeladen.
- Hinweise zum Datenschutz und ein Impressum müssen vor dem Start auf `burg.micana.de` stehen.

## 9. Umsetzung in Schritten

1. **Determinismus:** fester Schritt, Zufall mit Seed, `Math.hypot` durch `Math.sqrt` ersetzen, Test Browser gegen Node. Etwa 2 Tage.
2. **Angriffsmodus im Spiel:** Burg laden, Heer wählen, absetzen, Zeitlimit, Sterne, Eingaben aufzeichnen und Wiederholung abspielen. Zuerst offline mit eigenen Burgen aus der Kartenschmiede. Etwa 4 Tage.
3. **Backend:** Supabase-Projekt, Tabellen, Edge Functions, Nachsimulation mit derselben Logik. Etwa 3 Tage.
4. **Oberfläche:** Freigeben, Gegnersuche, Angriffsliste, Rangliste, Wiederholungen. Etwa 3 Tage.
5. **Test und Balancing:** Bot-Angriffe gegen Bot-Burgen mit `tools/sim.mjs`, Budgets und Ruhm abstimmen. Etwa 2 Tage.

## 10. Offene Fragen

- Soll ein Spieler mehrere Burgen gleichzeitig freigeben dürfen, etwa eine je Kampagnenkarte?
- Saisons mit Zurücksetzen des Ruhms, oder ein Ruhm für immer?
- Soll der Verteidiger nach einem Angriff etwas verlieren (Rohstoffe), oder nur Ruhm? Für ein entspanntes Handyspiel empfehle ich: nur Ruhm.
- Freundschaftsangriffe per Link (ohne Ruhm), ähnlich wie der Teilen-Link der Kartenschmiede? Das wäre ein guter, kleiner erster Schritt.
