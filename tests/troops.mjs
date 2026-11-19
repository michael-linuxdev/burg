// Oberflächentest Truppen: Ausbilden im Hof, Truppenmodus, Auswahl per Rahmen und per Chip, Bewegungs- und Angriffsbefehl.
import { startServer } from './serve.mjs';
import { chromium, openPage, startMission, tileCenter } from './helpers.mjs';

const fail = m => { console.error('✗ ' + m); process.exitCode = 1; };
const ok = m => console.log('✓ ' + m);
const srv = await startServer();
const browser = await chromium.launch();
try {
  for (const [name, viewport] of [['Hochformat', { width: 390, height: 844 }], ['Querformat', { width: 844, height: 390 }]]) {
    const { ctx, page, errors } = await openPage(browser, srv.url, viewport);
    await startMission(page, 2);
    await page.evaluate(() => { setSpeed(0); S.res.holz = 200; S.res.stein = 200; S.res.gold = 300; S.res.speer = 5; S.res.bogen = 5; S.pop = 30; act('kaserne', KR + 2, KC + 2, true); assignWorkers(); hud(true); });
    // Ausbilden über den Hof
    await page.locator('#openCourt').click();
    for (let i = 0; i < 3; i++) await page.locator('#recruits .ubtn[data-t="spear"]').click();
    await page.locator('#recruits .ubtn[data-t="archer"]').click();
    const n = await page.evaluate(() => [S.units.filter(u => u.type === 'spear').length, S.units.filter(u => u.type === 'archer').length]);
    if (n[0] !== 3 || n[1] !== 1) fail(name + ': Ausbilden im Hof ' + JSON.stringify(n)); else ok(name + ': 3 Speerträger und 1 Bogenschütze im Hof ausgebildet');
    await page.locator('#courtWrap [data-close]').click();
    // Einheiten laufen lassen, bis sie vor dem Bergfried stehen
    await page.evaluate(() => { order(S.units.filter(u => u.type === 'spear'), (KR - 4) * COLS + KC); for (let i = 0; i < 150; i++) updateUnits(.1); });
    await page.locator('#openTroops').click();
    await page.waitForTimeout(300); // Werkzeugleiste wird höher, die Karte rückt im nächsten Bild nach
    if (!(await page.locator('#chips .chip').first().isVisible())) fail(name + ': Truppenleiste nicht sichtbar');
    // Rahmen um die Speerträger ziehen (Bildschirmpositionen aus der Darstellung)
    const box = await page.evaluate(() => { const r = cv.getBoundingClientRect(); const ps = S.units.filter(u => u.type === 'spear').map(u => unitXY(u));
      return { x0: r.left + Math.min(...ps.map(p => p.X)) - 25, y0: r.top + Math.min(...ps.map(p => p.Y)) - 30, x1: r.left + Math.max(...ps.map(p => p.X)) + 25, y1: r.top + Math.max(...ps.map(p => p.Y)) + 15 }; });
    await page.mouse.move(box.x0, box.y0); await page.mouse.down(); await page.mouse.move((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, { steps: 4 }); await page.mouse.move(box.x1, box.y1, { steps: 4 }); await page.mouse.up();
    const sel = await page.evaluate(() => S.units.filter(u => picked.has(u.id)).map(u => u.type));
    if (sel.length !== 3 || sel.some(t => t !== 'spear')) fail(name + ': Rahmenauswahl ' + JSON.stringify(sel)); else ok(name + ': Rahmen wählt genau die 3 Speerträger');
    // Befehl: auf ein freies Feld zwei Reihen südlich laufen
    const dest = await page.evaluate(() => { for (let r = KR + 6; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (groundOk(r * COLS + c) && !S.grid[r * COLS + c].b && unitPath(S.units[0].i, r * COLS + c)) return [r, c]; return null; });
    const p = await tileCenter(page, dest[0], dest[1]); await page.mouse.click(p.x, p.y);
    const moving = await page.evaluate(() => S.units.filter(u => picked.has(u.id) && u.dest != null).length);
    if (moving !== 3) fail(name + ': Bewegungsbefehl ' + moving); else ok(name + ': Bewegungsbefehl an alle 3');
    // Chip „Bogenschützen“ wählt nur den Schützen
    await page.locator('#chips .chip[data-t="archer"]').click();
    const sel2 = await page.evaluate(() => S.units.filter(u => picked.has(u.id)).map(u => u.type));
    if (sel2.join() !== 'archer') fail(name + ': Chip ' + JSON.stringify(sel2)); else ok(name + ': Chip wählt die Bogenschützen');
    // Angriffsbefehl: Feind antippen
    await page.locator('#chips .chip[data-t="alle"]').click();
    const ep = await page.evaluate(() => { S.enemies.push({ w: 1, type: 'raider', r: KR - 5, c: KC, x: KC + .5, y: KR - 4.5, tr: null, tc: null, hp: 50, max: 50, cd: 0, ign: 1, wait: 0, atk: null, ang: 0, climb: 0 }); S.raids = 1; draw(0);
      const r = cv.getBoundingClientRect(), q = enemyXY(S.enemies[0]); return { x: r.left + q.X, y: r.top + q.Y - cell * .1 }; });
    await page.mouse.click(ep.x, ep.y);
    const atk = await page.evaluate(() => S.units.filter(u => u.tgt === S.enemies[0]).length);
    if (atk !== 4) fail(name + ': Angriffsbefehl ' + atk); else ok(name + ': Angriffsbefehl auf den Feind');
    // Fertig beendet den Modus, Tippen auf eine Einheit öffnet ihn wieder
    await page.locator('#tDone').click();
    const up = await page.evaluate(() => { draw(0); const r = cv.getBoundingClientRect(), q = unitXY(S.units[3]); return { x: r.left + q.X, y: r.top + q.Y - cell * .1 }; });
    await page.mouse.click(up.x, up.y);
    const st = await page.evaluate(() => [sel, picked.size]);
    if (st[0] !== 'truppen' || st[1] !== 1) fail(name + ': Antippen öffnet Truppenmodus ' + JSON.stringify(st)); else ok(name + ': Antippen einer Einheit öffnet den Truppenmodus');
    if (errors.length) fail(name + ': Konsolenfehler: ' + errors.join(' | '));
    await ctx.close();
  }
} catch (e) { fail(e.stack || e.message); }
await browser.close(); srv.close();
if (process.exitCode) console.error('Truppen-Test fehlgeschlagen'); else console.log('Truppen-Test bestanden');
