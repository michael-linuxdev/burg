// Ausführlicher Oberflächentest mit Screenshots (lokal): node tests/e2e.mjs [Zielordner]
// Prüft Hoch-, Querformat und Desktop: Menü, Tag, Nacht, Winter, offene Menüs, laufender Angriff, Truppenmodus, große Karte, Ereignis, Markt. Keine Konsolenfehler.
import fs from 'node:fs';
import { startServer } from './serve.mjs';
import { chromium, openPage, startMission, buildViaUi } from './helpers.mjs';

const out = process.argv[2] || 'test-results';
fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const browser = await chromium.launch();
let bad = 0;
const VIEWS = [['hoch', { width: 390, height: 844 }], ['quer', { width: 844, height: 390 }], ['desktop', { width: 1280, height: 800 }]];
for (const [name, viewport] of VIEWS) {
  for (const scheme of ['light', 'dark']) {
    const { ctx, page, errors } = await openPage(browser, srv.url, viewport, { colorScheme: scheme });
    const shot = async n => page.screenshot({ path: `${out}/${name}-${scheme}-${n}.png` });
    if (scheme === 'dark') { await shot('menue'); await startMission(page, 0); await shot('tag'); await ctx.close(); if (errors.length) { bad++; console.error(name, scheme, errors); } continue; }
    await shot('menue');
    await startMission(page, 2);
    await page.evaluate(() => { S.res.holz = 200; S.res.stein = 200; S.res.gold = 200; });
    await page.evaluate(() => { S.res.eisen = 50; S.keepLv = 1; });
    for (const k of ['holzf', 'obst', 'haus', 'farm', 'kaserne', 'brunnen', 'lager', 'korn', 'bogner', 'schmied', 'weide', 'gerber', 'ruest', 'mine']) await buildViaUi(page, k).catch(e => console.warn(e.message));
    if (await page.locator('#tDone').isVisible()) await page.locator('#tDone').click();
    // Mauerring per Code (Wischen ist schwer automatisch zu treffen)
    await page.evaluate(() => { for (let r = KR - 3; r <= KR + 3; r++) for (let c = KC - 3; c <= KC + 3; c++) if (Math.max(Math.abs(r - KR), Math.abs(c - KC)) === 3) { const k = (r === KR + 3 && c === KC) ? 'tor' : (Math.abs(r - KR) === 3 && Math.abs(c - KC) === 3) ? 'turm' : 'mauer'; act(k, r, c, true); } S.pop = 30; S.res.bogen = 9; S.res.speer = 3; S.res.schwert = 4; S.res.leder = 4; S.res.gold = 400; for (const t of ['archer','archer','archer','archer','archer','archer','spear','spear','sword','knight']) recruit(t); });
    await page.waitForTimeout(800); await shot('tag');
    await page.locator('#openBuild').click(); await page.waitForTimeout(300); await shot('baumenue'); await page.locator('#buildWrap [data-close]').click();
    await page.locator('#openCourt').click(); await page.waitForTimeout(300); await shot('hof'); await page.locator('#courtWrap [data-close]').click();
    await page.evaluate(() => { S.day = 4; S.clock = 3.2; }); await page.waitForTimeout(400); await shot('nacht');
    await page.evaluate(() => { S.keepLv = 2; S.keepMax = 500; S.keepHp = 500; zoomAt(innerWidth / 2, innerHeight / 2, 1); }); await page.waitForTimeout(300); await shot('festung');
    await page.evaluate(() => { S.keepLv = 0; }); await page.waitForTimeout(300); await shot('holzburg-nacht'); await page.evaluate(() => { S.keepLv = 1; });
    await page.evaluate(() => { S.day = 20; S.clock = 1; }); await page.waitForTimeout(600); await shot('winter');
    await page.evaluate(() => { S.day = 13; S.clock = 1; S.raids = 5; S.raidSide = 'Norden'; spawnWave(); }); await page.waitForTimeout(4500); await shot('angriff');
    // Truppenmodus: alle auswählen, Nahkämpfer auf die Nordmauer schicken
    await page.locator('#openTroops').click(); await page.locator('#chips .chip[data-t="alle"]').click();
    await page.evaluate(() => order(S.units.filter(u => u.type !== 'archer'), (KR - 3) * COLS + KC)); await page.waitForTimeout(2500); await shot('truppen');
    await page.locator('#tDone').click();
    // Bildrate während des Angriffs grob messen (headless, nur als Vergleich zwischen den Grafikstufen)
    for (const q of ['hoch', 'niedrig']) {
      const fps = await page.evaluate(async q => { SET.quality = q; terrKey = ''; resize(); let n = 0; const t0 = performance.now(); await new Promise(r => { const f = () => { n++; performance.now() - t0 < 1500 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }); return Math.round(n / ((performance.now() - t0) / 1000)); }, q);
      console.log(`  ${name}: Grafik ${q} ≈ ${fps} fps (headless)`);
    }
    await page.evaluate(() => { SET.quality = 'hoch'; terrKey = ''; resize(); });
    await page.evaluate(() => openMenu()); await page.waitForTimeout(200); await shot('menue-im-spiel');
    await page.locator('#openSettings').click(); await page.waitForTimeout(200); await shot('einstellungen'); await page.locator('#setClose').click();
    // Etappe 4: große Karte mit Fluss, Ereignis-Dialog und Markt
    await page.evaluate(() => { freeSize = 'gross'; newGame(-1); closeModal(); }); await page.waitForTimeout(800); await shot('welt');
    await page.evaluate(() => { zoomAt(innerWidth / 2, innerHeight / 2, 1); }); await page.waitForTimeout(300); await shot('welt-ganz');
    await page.evaluate(() => { focusKeep(); S.res.gold = 120; S.pop = 20; triggerEvent('trader'); }); await page.waitForTimeout(300); await shot('ereignis');
    await page.locator('#mBtns .btn').last().click();
    await page.evaluate(() => { S.res.holz = 100; S.res.stein = 50; for (let r = KR + 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!count('markt') && !reason('markt', r, c)) act('markt', r, c, true); });
    await page.locator('#openCourt').click(); await page.evaluate(() => $('marketH').scrollIntoView()); await page.waitForTimeout(200); await shot('markt'); await page.locator('#courtWrap [data-close]').click();
    if (errors.length) { bad++; console.error(name, errors); } else console.log('✓', name, 'ohne Konsolenfehler');
    await ctx.close();
  }
}
await browser.close(); srv.close();
console.log(bad ? '✗ Fehler gefunden' : '✓ Alle Ansichten ohne Fehler', '– Screenshots in', out);
process.exitCode = bad ? 1 : 0;
