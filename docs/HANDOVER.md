# Übergabe: Stand des Ausbaus zur PWA (19.11.2026, nach Etappe 5)

Auftrag: `docs/CLAUDE_CODE_PROMPT.md` (Etappen 0–6). Arbeitsweise und Tests: `CLAUDE.md`. Alle Regeln und Zahlen: `docs/DESIGN.md`.

## Erledigt und in `main` gemergt

| PR | Etappe | Inhalt |
|---|---|---|
| #1 | 0 Grundlage | Logik von Darstellung getrennt (`data/core/economy/combat.js` ohne DOM, Rückrufe in `H`), Schriften selbst gehostet (`fonts/`, OFL), Hinweis „Neue Version verfügbar“, CI (`.github/workflows/ci.yml`), `docs/DESIGN.md` |
| #2 | 1 Feinschliff | Web-Audio-Musik und Geräusche (`audio.js`), Rückgängig (20 Schritte), 3 Speicherplätze + Auto, Tutorial Mission 1 (`tutorial.js`), Einstellungen/Grafikstufen (`settings.js`), `tools/sim.mjs` + Balancing, Fehler bei überlappenden Wellen behoben, Sold |
| #3 | 2 Wirtschaft | Lager/Kornkammer/Rüstkammer mit Kapazität, Waffenkette (Eisenmine, Schmied, Viehweide, Gerberei, Bogenmacher), Burgstufen Holzburg/Steinburg/Festung |
| #4 | 3 Militär | Truppen als Einheiten (`js/units.js`): Bogenschütze, Speerträger, Schwertkämpfer, Ritter; Laufen auf Mauern, Truppenmodus mit Auswahlrahmen, Chips und Befehlen; feindliche Bogenschützen und Leitermänner; Deckung hinter Zinnen; Gefallene senken die Einwohnerzahl; Spielstand v4 |
| #5 | 4 Welt | Freies Spiel auf Karten bis 32 × 40 mit Fluss und Furt, Brücke, Hügel, Sumpf, Eisenvorkommen; Kamera am Bergfried, nur Sichtbares wird gezeichnet; Ereignisse (Seuche/Apotheke, Missernte, Wölfe, Blitz, Händler, Turnier, Festtag); Markt; neues spielerisches HUD (Tagesmedaille, Ressourcen-Plaketten, Auftrag mit Fortschrittsleisten, Berater mit Sprechblase, Meldungsbanner); Spielstand v5 |
| #6 | 5 Inhalte | Kampagne mit 10 Missionen und kleiner Geschichte (6–10 auf großen Karten), Angriffsmission „Sturm auf Rabenfels“ mit feindlicher Burg, Verteidigern, Belagerungswerkstatt, Rammbock und Katapult; Kartenschmiede mit Malen, Einstellungen, Testlauf, Speichern, Teilen-Link (#karte=…) und Datei-Export/-Import; Spielprotokoll für Playtests (Menü → „Spielprotokoll“) |

## Als Nächstes

Etappe 6: `docs/MULTIPLAYER.md` (nur Konzept, kein Einbau). Das Kartenformat aus `js/maps.js` (Version 1) ist als Grundlage für das Burgformat gedacht; es müsste um Gebäude, Truppenaufstellung und eine Prüfsumme erweitert werden.

## Hinweise für die nächste Sitzung

- Tests: `npm test` (Syntax, Logik, Balancing, Smoke, Tutorial, Truppen, Welt, Kartenschmiede; das Balancing aller 10 Missionen dauert rund 2 Minuten) und `node tests/e2e.mjs <ordner>` für Screenshots. Playwright ist lokal vorinstalliert.
- Nach jeder Etappe `VERSION` in `sw.js` erhöhen (zuletzt `burgwacht-v5.9.0`) und neue Dateien in `SHELL` eintragen.
- PRs per GitHub-MCP-Werkzeug (`create_pull_request`, `merge_pull_request`). Remote-Branches ließen sich aus der Umgebung nicht löschen: `feat/etappe-0-grundlage` … `feat/etappe-3-militaer` sowie die `claude/…`-Branches bitte in GitHub löschen.
- **GitHub Pages ist noch nicht aktiviert** (aus der Umgebung nicht möglich): Settings → Pages → „Deploy from a branch“ → `main` / `/ (root)` → Save; Custom domain `burg.micana.de` → Save; nach der DNS-Prüfung „Enforce HTTPS“ anhaken. DNS bei micana.de: CNAME `burg` → `michael-linuxdev.github.io`.
- Offene Ideen aus Etappe 3: Wachen im Bergfried werden nicht als Figuren gezeichnet; Einheiten haben keine Formationen oder Haltungen (z. B. „Stellung halten“); feindliche Bogenschützen wählen immer die nächste Einheit.
- Offene Ideen aus Etappe 4: Minikarte für große Karten; Wölfe greifen wie Räuber auch Mauern an; das freie Spiel auf großen Karten ist für den Bot eher leicht (Bevölkerung wächst stark) und könnte stärkere Wellen vertragen.
- Umbenannt in **Burgwacht** (Schriften Cinzel und Fira Sans). Die `localStorage`-Schlüssel heißen weiter `zinnenwerk-…`, damit Spielstände und Kampagnenfortschritt erhalten bleiben. `docs/CLAUDE_CODE_PROMPT.md` ist der ursprüngliche Auftrag und nennt noch den alten Namen.
- Offene Ideen aus Etappe 5: Belagerungsgerät kann noch nicht auf eigene Mauern/Türme steigen; die Kartenschmiede setzt keine Gebäude oder feindlichen Burgen; eigene Karten haben kein Vorschaubild.
- Playtest-Rückmeldungen: Im Menü unter „📋 Spielprotokoll“ lässt sich das Protokoll als Textdatei speichern; Notizen des Spielers stehen dort mit Zeit und Spieltag.
