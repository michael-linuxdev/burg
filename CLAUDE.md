# Hinweise für Claude Code

## Projekt
Zinnenwerk ist ein Burgenbau-Strategiespiel (inspiriert von Stronghold, aber mit eigenen Namen, Figuren und Grafik) als statische PWA auf GitHub Pages unter `burg.micana.de`. Eine spätere Portierung nach Unity ist geplant, daher Spielmechanik sauber von Darstellung trennen und in `docs/DESIGN.md` dokumentieren.

## Technik
- Vanilla JavaScript, Canvas 2D, kein Framework, kein Build-Schritt. Alles muss direkt von GitHub Pages laufen.
- Die Skripte in `js/` sind klassische Skripte und teilen sich den globalen Gültigkeitsbereich (Reihenfolge: data, core, economy, combat, render, ui, pwa). ES-Module wurden bewusst nicht eingeführt: So bleiben die Logikdateien ohne Build in Node (`vm`) ladbar, siehe `tools/sim.mjs`.
- Spiellogik (`data.js`, `core.js`, `economy.js`, `combat.js`) greift nie auf `document`/`window` zu. Ausgaben laufen über die Rückrufe in `H` (`H.say`, `H.fx`, `H.sfx` …). Regeln und Zahlen stehen in `docs/DESIGN.md` und werden mit jeder Änderung aktualisiert.
- Keine externen Laufzeit-Abhängigkeiten. Schriften liegen selbst gehostet in `fonts/`. Sound wird mit der Web Audio API erzeugt oder als kleine, selbst erstellte Dateien im Repo abgelegt.
- Spielstand in `localStorage` (Schlüssel `zinnenwerk-v3`, Kampagnenfortschritt `zinnenwerk-progress`). Bei Formatänderungen eine Migration schreiben, Fortschritt nie verlieren.
- Nach jeder Änderung an ausgelieferten Dateien `VERSION` in `sw.js` erhöhen und neue Dateien in `SHELL` aufnehmen.

## Wichtige Eigenheiten
- Die Karte ist logisch `COLS × ROWS` (12 × 20). Im Querformat wird sie transponiert dargestellt (`TRANS`). Bildschirmkoordinaten immer über `sx()/sy()` bzw. `tileAtP()` umrechnen, Partikel liegen in Bildschirmfeldern (`fx(..., screen)`).
- Zeichenreihenfolge läuft nach Bildschirmreihen (Tiefensortierung). Figuren werden über `put()` in die richtige Reihe eingeordnet.
- Wege: `ensure()` berechnet bei jeder Gebäudeänderung (`bump()`) die Feind-Kostenkarte (`dist`) und die Erreichbarkeit für eigene Leute (`reach`, Tore passierbar).
- Jahreszeiten: 6 Tage je Jahreszeit (`SLEN`), Tag/Nacht-Zyklus über 6 Tage (`CYC`), ein Tag dauert 4 s bei 1×.

## Gestaltung
- Oberfläche komplett auf Deutsch, mit typografischen Anführungszeichen („ “) und Apostrophen (’).
- Farben über CSS-Variablen mit Hell- und Dunkelmodus, sichere Bereiche (`env(safe-area-inset-*)`) beachten.
- Hochformat (Statusleiste oben, Knöpfe unten) und Querformat (Seitenleiste links, Menüs von rechts) müssen beide funktionieren.
- Touch zuerst: Pinch-Zoom, Ein-Finger-Verschieben, Mauern per Wischen. Tippziele mindestens 40 px.

## Testen
- `npm run check` (`node --check` auf alle Skripte) und `npm run smoke` (läuft auch in CI).
- `npm run e2e` erzeugt Screenshots aller Ansichten in Hell und Dunkel.
- Mit Playwright über einen lokalen HTTP-Server testen: Hochformat 390×844, Querformat 844×390, Desktop 1280×800. Screenshots von Tag, Nacht, Winter, offenen Menüs und einem laufenden Angriff prüfen. Keine Konsolenfehler.
- Für Balancing eine Headless-Simulation der Spiellogik schreiben (z. B. `tools/sim.mjs`), die Missionen mit einer einfachen Bot-Strategie durchspielt.

## Arbeitsweise
Pro Etappe ein eigener Branch, ein PR mit Beschreibung und Screenshots, dann selbst per Squash in `main` mergen und den Branch löschen.
