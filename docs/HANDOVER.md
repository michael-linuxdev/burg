# Übergabe: Stand des Ausbaus zur PWA (19.11.2026)

Auftrag: `docs/CLAUDE_CODE_PROMPT.md` (Etappen 0–6). Arbeitsweise und Tests: `CLAUDE.md`. Alle Regeln und Zahlen: `docs/DESIGN.md`.

## Erledigt und in `main` gemergt

| PR | Etappe | Inhalt |
|---|---|---|
| #1 | 0 Grundlage | Logik von Darstellung getrennt (`data/core/economy/combat.js` ohne DOM, Rückrufe in `H`), Schriften selbst gehostet (`fonts/`, OFL), Hinweis „Neue Version verfügbar“, CI (`.github/workflows/ci.yml`), `docs/DESIGN.md` |
| #2 | 1 Feinschliff | Web-Audio-Musik und Geräusche (`audio.js`), Rückgängig (20 Schritte), 3 Speicherplätze + Auto, Tutorial Mission 1 (`tutorial.js`), Einstellungen/Grafikstufen (`settings.js`), `tools/sim.mjs` + Balancing, Fehler bei überlappenden Wellen behoben, Sold |
| #3 | 2 Wirtschaft | Lager/Kornkammer/Rüstkammer mit Kapazität, Waffenkette (Eisenmine, Schmied, Viehweide, Gerberei, Bogenmacher), Burgstufen Holzburg/Steinburg/Festung |

## In Arbeit: Etappe 3 (Branch `feat/etappe-3-militaer`, nicht gemergt)

Fertig (Logik, headless getestet):
- `js/units.js`: Truppen als Einheiten auf der Karte (`S.units`), Wegfindung wie eigene Leute plus Laufen auf Mauern, `order()` verteilt Gruppen, `orderAttack()`, Reichweitenbonus auf Mauer/Turm/Bergfried, Nahkampf, `recruit(typ)`.
- `UNIT` in `data.js`: Bogenschütze, Speerträger (×3 gegen Rammböcke), Schwertkämpfer, Ritter.
- `combat.js` neu: feindliche Bogenschützen (schießen auf Truppen, sonst Bergfried), Leitermänner (eigene Kostenkarte `distL`, klettern 2,5 s über Mauern), Wellen-Zusammensetzung `waveList()`, Dijkstra mit Heap.
- Spielstand-Version 4: `S.archers` → `S.units` (Migration in `core.js`).
- Bot nutzt Speerträger. Balancing aktuell: Mission 1–4 100 %, Mission 5 ≈ 63 % (Ziel 50–90 %).

Noch offen in Etappe 3:
1. **Grafik** (`render.js`): Einheiten zeichnen (Farbe `UNIT.col`, Waffe, Ritter auf Pferd, auf Mauern um `unitLift()` angehoben, über `put()` einsortieren), Auswahlringe, Zielmarker, Lebensbalken. Die alte Turmbesatzung `b.arch` in `drawWallish` entfernen. `drawEnemy` für `archer` und `ladder` (Leiter beim Klettern, `e.climb`). `H.shot(..., true)` für feindliche Pfeile (andere Farbe).
2. **Steuerung** (`ui.js`): dritter Knopf „Truppen“ im Dock → Werkzeug `sel='truppen'`: Ein-Finger-Ziehen = Auswahlrahmen, Tippen auf Einheit = auswählen, Tippen auf Feld/Mauer/Turm = `order()`, Tippen auf Feind = `orderAttack()`. Zwei Finger verschieben/zoomen. Werkzeugleiste mit Typ-Chips (Anzahl je Typ) und „Alle“. Ohne Werkzeug: Tippen auf Einheit öffnet den Truppenmodus.
3. **Hof**: Ausbilden-Knöpfe für alle vier Typen (Kosten aus `UNIT`, Gründe aus `recruitWhy(typ)`).
4. Hinweise in der Hinweiszeile, `docs/DESIGN.md` Abschnitt Kampfwerte und Konter, Tests (Logik: Wegfindung über Mauern, Leitermänner, Speer gegen Ramme; Playwright: Auswahl per Rahmen und Befehl), `e2e.mjs` Screenshots, PR, Merge.

## Danach

Etappen 4 (größere Karten bis 32 × 40, Fluss/Brücke, Hügel, Sumpf, Eisenvorkommen, Ereignisse, Markt), 5 (Angriffsmissionen, 10 Missionen, Kartenschmiede mit Teilen-Link) und 6 (`docs/MULTIPLAYER.md`, nur Konzept) sind noch nicht begonnen. Vorbereitet: Spielstände speichern bereits `cols/rows/kr/kc`, `setMapSize()` existiert, Wegfindung nutzt einen Heap.

## Hinweise für die nächste Sitzung

- Tests: `npm test` (Syntax, Logik, Balancing, Smoke, Tutorial) und `node tests/e2e.mjs <ordner>` für Screenshots. Playwright ist lokal vorinstalliert.
- Nach jeder Etappe `VERSION` in `sw.js` erhöhen (zuletzt `zinnenwerk-v5.4.0` auf dem Etappe-3-Branch) und neue Dateien in `SHELL` eintragen.
- PRs per GitHub-MCP-Werkzeug (`create_pull_request`, `merge_pull_request`). Remote-Branches ließen sich aus der Umgebung nicht löschen: `feat/etappe-0-grundlage`, `feat/etappe-1-feinschliff` und `feat/etappe-2-wirtschaft` bitte in GitHub löschen.
- **GitHub Pages ist noch nicht aktiviert** (aus der Umgebung nicht möglich): Settings → Pages → „Deploy from a branch“ → `main` / `/ (root)` → Save; Custom domain `burg.micana.de` → Save; nach der DNS-Prüfung „Enforce HTTPS“ anhaken. DNS bei micana.de: CNAME `burg` → `michael-linuxdev.github.io`.
