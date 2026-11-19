// Oberflächentest Etappe 4: freies Spiel auf großer Karte, Kamera am Bergfried, Brücke bauen,
// Ereignis-Dialog mit Entscheidung, Handel am Markt. Hoch- und Querformat, keine Konsolenfehler.
import { startServer } from './serve.mjs';
import { chromium, openPage, tileCenter } from './helpers.mjs';

const fail = m => { console.error('✗ ' + m); process.exitCode = 1; };
const ok = m => console.log('✓ ' + m);
const srv = await startServer();
const browser = await chromium.launch();
try {
  for (const [name, viewport] of [['Hochformat', { width: 390, height: 844 }], ['Querformat', { width: 844, height: 390 }]]) {
    const { ctx, page, errors } = await openPage(browser, srv.url, viewport);
    await page.locator('#free').click();
    await page.locator('#sizeseg button[data-size="gross"]').click();
    await page.locator('#mBtns .btn.primary').click();
    await page.waitForTimeout(300);
    const st = await page.evaluate(() => { setSpeed(0); const r = cv.getBoundingClientRect(); return { cols: COLS, rows: ROWS, kx: r.left + sx(KC + .5, KR + .5), ky: r.top + sy(KC + .5, KR + .5), cell, w: innerWidth, h: innerHeight }; });
    if (st.cols !== 32 || st.rows !== 40) fail(name + ': Kartengröße ' + st.cols + '×' + st.rows); else ok(name + ': große Karte 32 × 40 gestartet');
    if (st.kx < 0 || st.kx > st.w || st.ky < 0 || st.ky > st.h || st.cell < 25) fail(name + ': Kamera nicht am Bergfried ' + JSON.stringify(st)); else ok(name + ': Kamera startet am Bergfried (Feld ' + Math.round(st.cell) + ' px)');
    // Brücke über die Oberfläche bauen: Wasserfeld in Bildmitte-Nähe suchen und dorthin schauen
    // Wasserfeld wählen, das nach dem Verschieben der Kamera frei sichtbar ist (nicht unter HUD oder Leiste)
    const w = await page.evaluate(() => { S.res.holz = 200; const cand = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!reason('bruecke', r, c)) cand.push([Math.hypot(r - KR, c - KC), r, c]);
      cand.sort((a, b) => a[0] - b[0]); const rc = cv.getBoundingClientRect();
      for (const [, r, c] of cand) { const x = sx(c + .5, r + .5), y = sy(c + .5, r + .5); ox += (padL + (vw - padL - padR) / 2) - x; oy += (padT + (vh - padT - padB) / 2) - y; clampCam();
        const px = rc.left + sx(c + .5, r + .5), py = rc.top + sy(c + .5, r + .5);
        if (px > 0 && px < innerWidth && py > 0 && py < innerHeight - 90 && document.elementFromPoint(px, py) === cv) return [r, c]; }
      return null; });
    if (!w) throw new Error('kein sichtbares Wasserfeld');
    await page.locator('#openBuild').click(); await page.locator('.card[data-k="bruecke"]').click();
    await page.waitForTimeout(200); // Werkzeugleiste erscheint, die Karte rückt nach
    const p = await tileCenter(page, w[0], w[1]); await page.mouse.click(p.x, p.y);
    const br = await page.evaluate(([r, c]) => { ensure(); const i = r * COLS + c; return [T(r, c).b && T(r, c).b.type, walkT(S.grid[i])]; }, w);
    if (br[0] !== 'bruecke' || !br[1]) fail(name + ': Brücke ' + JSON.stringify(br)); else ok(name + ': Brücke auf dem Fluss gebaut und begehbar');
    await page.locator('#tDone').click();
    // Ereignis mit Entscheidung
    await page.evaluate(() => { S.res.gold = 100; S.pop = 20; S.pp = 50; triggerEvent('tourney'); });
    await page.locator('#modal').waitFor({ state: 'visible' });
    const title = await page.locator('#mTitle').textContent();
    await page.locator('#mBtns .btn.primary').first().click();
    const ev = await page.evaluate(() => [S.res.gold, Math.round(S.pp), S.ev.pending, uiPause]);
    if (!/Turnier/.test(title) || ev[0] !== 50 || ev[1] !== 60 || ev[2] !== null || ev[3]) fail(name + ': Ereignis ' + title + ' ' + JSON.stringify(ev)); else ok(name + ': Ereignis „Turnier“ angenommen (−50 Gold, +10 Beliebtheit)');
    // Markt: bauen, im Hof Stein kaufen
    await page.evaluate(() => { S.res.holz = 100; S.res.stein = 20; for (let r = KR + 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!count('markt') && !reason('markt', r, c)) act('markt', r, c, true); S.res.stein = 0; S.res.gold = 100; hud(true); });
    await page.locator('#openCourt').click();
    await page.locator('#market button[data-k="stein"][data-d="1"]').click();
    const m = await page.evaluate(() => [S.res.stein, S.res.gold]);
    if (m[0] !== 5 || m[1] !== 85) fail(name + ': Markt ' + JSON.stringify(m)); else ok(name + ': Markt: 5 Stein für 15 Gold gekauft');
    await page.locator('#courtWrap [data-close]').click();
    if (errors.length) fail(name + ': Konsolenfehler: ' + errors.join(' | '));
    await ctx.close();
  }
} catch (e) { fail(e.stack || e.message); }
await browser.close(); srv.close();
if (process.exitCode) console.error('Welt-Test fehlgeschlagen'); else console.log('Welt-Test bestanden');
