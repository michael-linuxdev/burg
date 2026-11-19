# Zinnenwerk

Ein Burgenbau-Strategiespiel für Handy und Browser: Wirtschaft aufbauen, das Volk bei Laune halten, durch den Winter kommen und die Burg gegen Räuber, Brandstifter und Rammböcke verteidigen.

**Spielen:** https://burg.micana.de

Läuft als installierbare PWA (offline spielbar). Auf dem Handy im Browser öffnen und „Zum Startbildschirm hinzufügen“ wählen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst der Seite, lädt CSS und Skripte, registriert den Service Worker |
| `css/style.css` | Gesamtes Layout inkl. Hell/Dunkel, Hoch- und Querformat |
| `js/game.js` | Daten (Gebäude, Missionen), Kartengenerator, Wirtschaft, Jahreszeiten, Kampf, Speichern |
| `js/render.js` | Canvas-Grafik: Gelände, Gebäude, Figuren, Partikel, Tag/Nacht, Wetter |
| `js/ui.js` | Kamera und Gesten (Pinch-Zoom), Statusleiste, Bau- und Hof-Menü, Dialoge, Hauptschleife |
| `sw.js` | Service Worker, macht die App offline verfügbar |
| `manifest.webmanifest` | PWA-Manifest |
| `icons/` | App-Icons (aus der Bergfried-Grafik des Spiels erzeugt) |
| `CNAME` | Eigene Domain für GitHub Pages |

Kein Build-Schritt: Die Dateien werden direkt von GitHub Pages ausgeliefert.

## Lokal starten

```bash
python3 -m http.server 8080
# dann http://localhost:8080 öffnen
```

Der Service Worker läuft nur über `http(s)`, nicht über `file://`.

## Veröffentlichen

1. GitHub Pages aktivieren: *Settings → Pages → Deploy from a branch → `main` / root*.
2. Custom Domain `burg.micana.de` eintragen (steht bereits in `CNAME`) und „Enforce HTTPS“ aktivieren.
3. Beim DNS-Anbieter von `micana.de` einen CNAME-Eintrag anlegen: `burg` → `<github-benutzername>.github.io`.

## Updates ausliefern

Bei jeder Änderung an Spieldateien in `sw.js` die Konstante `VERSION` erhöhen und neue Dateien in `SHELL` aufnehmen. Sonst sehen Spieler mit installierter App die alte Version.
