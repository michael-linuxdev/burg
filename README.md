# Zinnenwerk

Ein Burgenbau-Strategiespiel für Handy und Browser: Wirtschaft aufbauen, das Volk bei Laune halten, durch den Winter kommen und die Burg gegen Räuber, Brandstifter und Rammböcke verteidigen.

**Spielen:** https://burg.micana.de

Läuft als installierbare PWA (offline spielbar). Auf dem Handy im Browser öffnen und „Zum Startbildschirm hinzufügen“ wählen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst der Seite, lädt CSS, Schriften und Skripte |
| `css/style.css` | Gesamtes Layout inkl. Hell/Dunkel, Hoch- und Querformat |
| `fonts/` | Selbst gehostete Schriften (Pirata One, Alegreya Sans) mit OFL-Lizenztexten |
| `js/data.js` | Spieldaten: Gebäude, Feinde, Missionen, Steuern, Rationen |
| `js/core.js` | Spielzustand, Kartengenerator, Wegfindung, Bauen, Arbeiter, Speichern |
| `js/economy.js` | Tageslauf: Produktion, Essen, Beliebtheit, Bevölkerung, Ziele |
| `js/combat.js` | Echtzeit: Angriffswellen, Feinde, Feuer, Wachen |
| `js/units.js` | Eigene Truppen: Einheiten, Wegfindung über Mauern, Befehle, Kampf |
| `js/settings.js` | Einstellungen (Lautstärken, Grafikstufe, Starttempo, Vibration, Tutorial) |
| `js/audio.js` | Prozedurale Musik und Geräusche (Web Audio API, keine Audiodateien) |
| `js/render.js` | Canvas-Grafik: Gelände, Gebäude, Figuren, Partikel, Tag/Nacht, Wetter |
| `js/ui.js` | Kamera und Gesten, Statusleiste, Menüs, Dialoge, Hauptschleife |
| `js/tutorial.js` | Interaktives Tutorial für Mission 1 |
| `js/pwa.js` | Service Worker anmelden, Hinweis „Neue Version verfügbar“ |
| `sw.js` | Service Worker, macht die App offline verfügbar |
| `manifest.webmanifest` | PWA-Manifest |
| `icons/` | App-Icons |
| `docs/DESIGN.md` | Alle Spielregeln, Zahlen und Formeln (Grundlage für die Unity-Portierung) |
| `tests/` | Logik-Tests (headless) und Playwright-Tests: Smoke, Tutorial/Spielstände, Truppen, Screenshots |
| `tools/sim.mjs` | Headless-Simulation mit Bot zum Abstimmen der Missionen |
| `CNAME` | Eigene Domain für GitHub Pages |

Die Spiellogik (`data`, `core`, `economy`, `combat`) greift nicht auf das DOM zu und läuft auch headless in Node.

Kein Build-Schritt: Die Dateien werden direkt von GitHub Pages ausgeliefert.

## Lokal starten

```bash
python3 -m http.server 8080      # oder: npm run serve
# dann http://localhost:8080 öffnen
```

## Testen

```bash
npm install                      # einmalig, holt Playwright
npx playwright install chromium  # einmalig
npm test                         # Syntax, Balancing-Simulation, Smoke- und Tutorial-Test
npm run sim                      # Balancing-Tabelle aller Missionen
npm run e2e                      # Screenshots aller Ansichten nach test-results/
```

Die GitHub Action `.github/workflows/ci.yml` führt Syntaxprüfung, Balancing-Prüfung, Smoke- und Tutorial-Test bei jedem Push auf `main` und bei Pull Requests aus.

Der Service Worker läuft nur über `http(s)`, nicht über `file://`.

## Veröffentlichen

1. GitHub Pages aktivieren: *Settings → Pages → Deploy from a branch → `main` / root*.
2. Custom Domain `burg.micana.de` eintragen (steht bereits in `CNAME`) und „Enforce HTTPS“ aktivieren.
3. Beim DNS-Anbieter von `micana.de` einen CNAME-Eintrag anlegen: `burg` → `michael-linuxdev.github.io`.

## Updates ausliefern

Bei jeder Änderung an Spieldateien in `sw.js` die Konstante `VERSION` erhöhen und neue Dateien in `SHELL` aufnehmen. Sonst sehen Spieler mit installierter App die alte Version.
