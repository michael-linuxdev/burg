# Auftrag: Zinnenwerk zur vollständigen PWA ausbauen

Du arbeitest im Repo dieses Projekts. Lies zuerst `CLAUDE.md` und `README.md` und spiel das Spiel einmal lokal an (`python3 -m http.server`), bevor du etwas änderst.

**Ziel:** Zinnenwerk unter `https://burg.micana.de` als installierbare, offline spielbare PWA mit allen unten genannten Erweiterungen. Eine Unity-Version kommt später, also halte die Spielmechanik von der Darstellung getrennt und dokumentiere sie.

## Arbeitsweise (verbindlich)

- Arbeite die Etappen der Reihe nach ab. Jede Etappe bekommt einen eigenen Branch (`feat/<etappe>`).
- Committe in kleinen, sinnvollen Schritten mit deutschen Commit-Nachrichten.
- Am Ende jeder Etappe:
  1. alle Tests aus `CLAUDE.md` ausführen (Syntax, Playwright in Hoch-, Querformat und Desktop, keine Konsolenfehler),
  2. `VERSION` in `sw.js` erhöhen und neue Dateien in `SHELL` eintragen,
  3. mit `gh pr create` einen PR öffnen (Beschreibung: was, warum, wie getestet, Screenshots),
  4. selbst mit `gh pr merge --squash --delete-branch` in `main` mergen,
  5. `main` aktualisieren und mit der nächsten Etappe weitermachen.
- Wenn etwas technisch nicht sinnvoll umsetzbar ist, entscheide selbst eine gute Alternative und schreib die Begründung in den PR.
- Bestehende Spielstände dürfen nicht kaputtgehen: Schreib Migrationen und erhöhe den Speicherschlüssel nur, wenn es nötig ist. Den Kampagnenfortschritt nie löschen.

## Etappe 0: Grundlage und Veröffentlichung

- GitHub Pages für `main` (Root) aktivieren und die Custom Domain `burg.micana.de` mit HTTPS setzen, zum Beispiel über `gh api repos/{owner}/{repo}/pages`. Falls das nicht automatisch geht, sag mir genau, was ich in den Einstellungen klicken muss.
- Prüfe, dass `CNAME`, Manifest, Icons und Service Worker korrekt ausgeliefert werden. Die App muss installierbar sein und offline starten.
- Schriften selbst hosten (Pirata One und Alegreya Sans, OFL-Lizenz, Lizenzdatei mitliefern) statt Google Fonts zu laden.
- Ein kleines „Neue Version verfügbar, tippen zum Aktualisieren“-Hinweisfenster, wenn ein neuer Service Worker wartet.
- GitHub Action für CI: Syntaxprüfung und ein Playwright-Smoke-Test (Spiel startet, Mission 1 lässt sich beginnen, ein Gebäude lässt sich setzen).
- Optional, wenn es die Wartbarkeit klar verbessert: Umstellung auf ES-Module und eine weitere Aufteilung (z. B. `data.js`, `economy.js`, `combat.js`, `map.js`).
- `docs/DESIGN.md` anlegen: alle Regeln, Zahlenwerte und Formeln (Wirtschaft, Beliebtheit, Jahreszeiten, Kampf, Wegfindung), damit die Unity-Portierung später danach gebaut werden kann. Diese Datei in jeder Etappe aktuell halten.

## Etappe 1: Feinschliff

- **Sound** mit der Web Audio API: dezente Hintergrundmusik (mittelalterlich, prozedural oder selbst komponiert), dazu Geräusche für Bauen, Abreißen, Holzhacken, Steinbruch, Pfeile, Treffer an Mauern, Feuer, Glocke bei Angriff, Sieg und Niederlage. Getrennte Regler für Musik und Effekte, standardmäßig an, erst nach der ersten Berührung starten (Browser-Regel).
- **Rückgängig** für die letzten Bauaktionen (mindestens 10 Schritte, Kosten zurück), als Knopf in der Werkzeugleiste.
- **Mehrere Spielstände**: drei Speicherplätze plus automatisches Speichern, im Menü wählbar, mit Vorschau (Mission, Tag, Jahreszeit).
- **Interaktives Tutorial** für Mission 1, das Schritt für Schritt durch Holzfäller, Obstgarten, Hütte, Hof-Menü, Zoomen und die erste Mauer führt. Abschaltbar und später wiederholbar.
- **Einstellungen**: Grafikqualität (Partikel, Licht, Wetter reduzieren), Lautstärken, Spieltempo-Standard, Vibration an/aus.
- **Balancing**: Schreib `tools/sim.mjs`, das die Spiellogik headless mit einem einfachen Bot durchspielt. Stimme damit alle Missionen ab, sodass Mission 1 bis 3 gut machbar sind und Mission 5 fordernd, aber schaffbar ist. Gold soll im späteren Spiel knapp bleiben. Halte die Ergebnisse in `docs/DESIGN.md` fest.

## Etappe 2: Wirtschaftstiefe

- **Lager und Kornkammer** mit Kapazität. Der Bergfried hat ein kleines Grundlager, weitere Lager und Kornkammern erhöhen es. Überschüsse verfallen, das wird angezeigt.
- **Waffenkette**: Eisenmine (an Felsen), Schmied (Eisen zu Schwertern oder Speeren), Gerberei (braucht eine neue Viehweide für Leder), Bogenmacher (Holz zu Bögen), Rüstkammer als Lager für Waffen. Truppen kosten künftig Gold und die passende Waffe.
- **Burgausbau**: Der Bergfried hat drei Stufen (Holzburg, Steinburg, Festung) mit mehr Lebenspunkten, mehr Grundbevölkerung, mehr Wachen und neuem Aussehen.
- Alle neuen Gebäude im gleichen gezeichneten Diorama-Stil, mit Jahreszeiten, Nachtlicht und Icons im Baumenü. Das Baumenü bekommt dafür eine passende neue Gruppe.

## Etappe 3: Militär

- **Neue eigene Truppen**: Speerträger (stark gegen Rammböcke, kurze Reichweite), Schwertkämpfer, Ritter (schnell, für Ausfälle). Bogenschützen bleiben.
- **Einheiten steuern**: Einheiten oder Gruppen antippen, auswählen und per Tippen auf Mauer, Turm oder Feld schicken. Eigene Truppen nutzen die Wegfindung der eigenen Leute (Tore passierbar). Ein Ausfall durch das Tor ist möglich. Bedienung per Touch muss sich gut anfühlen, Auswahl auch per Rahmen-Ziehen mit gewähltem Werkzeug „Truppen“.
- **Neue Feinde**: feindliche Bogenschützen, die Verteidiger auf Mauern beschießen, und Leitermänner, die Mauern ohne Tor überwinden. Einbinden in die Angriffswellen.
- Kampfwerte und Konter in `docs/DESIGN.md` dokumentieren.

## Etappe 4: Welt

- **Größere Karten**: Kartengröße pro Mission einstellbar (bis etwa 32 × 40), die Kamera startet am Bergfried. Alles muss in Hoch- und Querformat (transponiert) funktionieren. Achte auf die Leistung (Gelände vorgerendert, nur Sichtbares zeichnen).
- **Neue Landschaften**: Fluss mit baubarer Brücke (Engstelle für Feinde), Hügel (Türme darauf schießen weiter), Sumpf (verlangsamt Feinde, nicht bebaubar), Eisenvorkommen für die Mine.
- **Ereignisse** mit kurzen Meldungen und Entscheidungen: Pest (Apotheke als neues Gebäude), Missernte, Wölfe im Winter, durchreisender Händler (Handel mit Ressourcen), Turnier und Festtag (Beliebtheit gegen Gold), Brand durch Blitz im Sommer.
- **Markt** als Gebäude für An- und Verkauf von Ressourcen.

## Etappe 5: Inhalte

- **Angriffsmissionen**: Belagere eine gegnerische Burg. Eigenes Lager außerhalb aufbauen, Belagerungsgerät bauen (Rammbock, Katapult), Truppen steuern. Als Finale der Kampagne einbauen.
- **Kampagne erweitern** auf etwa 10 Missionen mit kleiner Geschichte, steigender Schwierigkeit und den neuen Systemen.
- **Kartenschmiede**: Gelände malen, Startressourcen, Ziele und Angriffswellen festlegen, testen und speichern. Teilen ohne Server: Export und Import als Datei sowie ein Teilen-Link, der die Karte komprimiert im URL-Fragment enthält. Geteilte Karten im Menü unter „Eigene Karten“.

## Etappe 6: Vorbereitung Mehrspieler (nur Konzept)

Der asynchrone Mehrspielermodus braucht einen Server und ist auf GitHub Pages allein nicht möglich. Baue ihn **nicht** ein. Lege stattdessen `docs/MULTIPLAYER.md` an mit Datenformat für eine Burg, Ablauf (eigene Burg hochladen, fremde Burgen gegen KI-Verteidigung angreifen, Replays), Schutz gegen Schummeln und einem Vorschlag für ein Backend (z. B. Supabase oder Firebase). Sorge dafür, dass sich das Burgformat aus der Kartenschmiede dafür wiederverwenden lässt.

## Qualitätsanforderungen für alle Etappen

- Läuft flüssig auf einem mittelklassigen Handy (Ziel 60 fps, bei Grafikstufe „niedrig“ mindestens 30 fps).
- Hoch- und Querformat, Hell- und Dunkelmodus, sichere Bereiche, Touch und Maus.
- Deutsche Texte mit typografischen Anführungszeichen, klar und freundlich. Neue Spielmechaniken bekommen passende Hinweise in der Hinweiszeile.
- Keine Namen, Figuren oder Grafiken aus Stronghold oder anderen geschützten Spielen.
- Am Ende eine kurze Zusammenfassung aller gemergten PRs und offener Punkte.
