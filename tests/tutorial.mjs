// Spielt das Tutorial von Mission 1 über die echte Oberfläche durch, prüft Rückgängig, Spielstände und Einstellungen.
import { startServer } from './serve.mjs';
import { chromium, openPage, startMission, freeTile, tileCenter } from './helpers.mjs';
const fail = m => { console.error('✗ ' + m); process.exitCode = 1; };
const ok = m => console.log('✓ ' + m);
const srv = await startServer();
const browser = await chromium.launch();
const shotDir = process.argv[2];
try {
  for (const [name, viewport] of [['Hochformat', { width: 390, height: 844 }], ['Querformat', { width: 844, height: 390 }]]) {
    const { ctx, page, errors } = await openPage(browser, srv.url, viewport);
    await startMission(page, 0);
    const coach = page.locator('#coach');
    if (!(await coach.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false))) { fail(name + ': Tutorial erscheint nicht'); continue; }
    const tapTile = async k => { const t = await freeTile(page, k); const p = await tileCenter(page, t[0], t[1]); await page.mouse.click(p.x, p.y); };
    const clickTarget = async () => { await page.locator('.coach-target').first().click(); await page.waitForTimeout(300); };
    for (const k of ['holzf', 'obst', 'haus']) {
      // Bauen → Karte (ggf. vorher Fertig)
      for (let i = 0; i < 3 && (await page.evaluate(() => sel)) !== k; i++) await clickTarget();
      await tapTile(k); await page.waitForTimeout(400);
    }
    if (shotDir) await page.screenshot({ path: `${shotDir}/tutorial-${name}.png` });
    await clickTarget(); // Fertig
    await clickTarget(); // Hof öffnen
    await clickTarget(); // Hof schließen
    const c = await page.evaluate(() => { const r = cv.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.move(c.x, c.y);
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60); }
    await page.waitForTimeout(400);
    for (let i = 0; i < 3 && (await page.evaluate(() => sel)) !== 'mauer'; i++) await clickTarget();
    // Mauer per Wischen: drei waagrechte Nachbarfelder suchen, die frei und sichtbar sind
    const line = await page.evaluate(() => {
      const r0 = cv.getBoundingClientRect();
      let best = null, bd = 1e9;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c + 3 < COLS; c++) {
        let good = true; for (let k = 0; k < 4; k++) if (reason('mauer', r, c + k)) good = false;
        if (!good) continue;
        const pts = [0, 3].map(k => ({ x: r0.left + sx(c + k + .5, r + .5), y: r0.top + sy(c + k + .5, r + .5) }));
        const d = Math.hypot(pts[0].x - innerWidth / 2, pts[0].y - innerHeight * .4);
        if (pts.every(p => p.x > 20 && p.y > 20 && p.x < innerWidth - 20 && p.y < innerHeight - 20) && document.elementFromPoint(pts[0].x, pts[0].y) === cv && document.elementFromPoint(pts[1].x, pts[1].y) === cv && d < bd) { bd = d; best = pts; }
      }
      return best;
    });
    if (!line) { fail(name + ': kein Platz für die Mauer gefunden'); continue; }
    await page.mouse.move(line[0].x, line[0].y); await page.mouse.down();
    for (let s = 1; s <= 12; s++) await page.mouse.move(line[0].x + (line[1].x - line[0].x) * s / 12, line[0].y + (line[1].y - line[0].y) * s / 12);
    await page.mouse.up(); await page.waitForTimeout(500);
    const walls = await page.evaluate(() => count('mauer'));
    if (walls < 3) fail(name + ': Mauer nicht gebaut (' + walls + ')');
    await page.locator('#coachNext').click().catch(() => {});
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => ({ on: TUT.on, done: SET.tutDone }));
    if (st.on || !st.done) fail(name + ': Tutorial nicht abgeschlossen ' + JSON.stringify(st) + ' Schritt ' + await page.evaluate(() => TUT.i));
    else ok(name + ': Tutorial vollständig durchgespielt');
    // Rückgängig: die ganze Mauerlinie ist ein Schritt
    const before = await page.evaluate(() => ({ n: count('mauer'), stein: S.res.stein }));
    await page.locator('#tUndo').click(); await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({ n: count('mauer'), stein: S.res.stein }));
    if (after.n !== 0 || after.stein !== before.stein + before.n) fail(name + ': Rückgängig fehlerhaft ' + JSON.stringify([before, after]));
    else ok(name + ': Rückgängig nimmt die Mauerlinie samt Kosten zurück');
    if (errors.length) fail(name + ': Konsolenfehler ' + errors.join(' | '));
    await ctx.close();
  }
  // Spielstände und Einstellungen
  const { ctx, page, errors } = await openPage(browser, srv.url, { width: 390, height: 844 });
  await startMission(page, 0);
  await page.locator('#coachSkip').click();
  await page.evaluate(() => { S.day = 9; });
  await page.locator('#menuBtn').click();
  await page.locator('#slots li').nth(2).locator('button', { hasText: 'Speichern' }).click();
  const txt = await page.locator('#slots li').nth(2).textContent();
  if (!/Tag 9/.test(txt) || !/Herbst|Sommer/.test(txt)) fail('Spielstand-Vorschau falsch: ' + txt); else ok('Speicherplatz 2 mit Vorschau: ' + txt.replace(/\s+/g, ' ').slice(0, 70));
  await page.evaluate(() => { S.day = 1; });
  await page.locator('#slots li').nth(2).locator('button', { hasText: 'Laden' }).click();
  if ((await page.evaluate(() => S.day)) !== 9) fail('Laden aus Platz 2 fehlgeschlagen'); else ok('Laden aus Platz 2');
  await page.locator('#menuBtn').click(); await page.locator('#openSettings').click();
  await page.locator('#qualseg button', { hasText: 'Niedrig' }).click();
  await page.locator('#setClose').click(); await page.locator('#cont').click(); await page.waitForTimeout(500);
  const q = await page.evaluate(() => ({ q: SET.quality, stored: JSON.parse(localStorage.getItem('zinnenwerk-settings')).quality, dpr }));
  if (q.q !== 'niedrig' || q.stored !== 'niedrig') fail('Grafikstufe nicht gespeichert'); else ok('Grafikstufe „Niedrig“ gespeichert');
  // Migration: alter v3-Spielstand wird übernommen
  await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('zinnenwerk-auto')); delete o.ver; delete o.cols; delete o.rows; delete o.kr; delete o.kc; o.day = 33; localStorage.setItem('zinnenwerk-v3', JSON.stringify(o)); localStorage.removeItem('zinnenwerk-auto'); });
  await page.reload(); await page.waitForFunction(() => typeof S !== 'undefined' && S);
  if ((await page.evaluate(() => S.day)) !== 33) fail('Alter Spielstand (v3) nicht übernommen'); else ok('Alter Spielstand (v3) wird übernommen');
  if (errors.length) fail('Konsolenfehler ' + errors.join(' | '));
  await ctx.close();
} catch (e) { fail(e.stack || e.message); }
await browser.close(); srv.close();
if (process.exitCode) console.error('Tutorial-Test fehlgeschlagen'); else console.log('Tutorial-Test bestanden');
