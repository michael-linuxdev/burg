// Oberflächentest Etappe 5: Kartenschmiede (malen, Einstellungen, speichern, testen), Teilen per Link und Datei,
// Angriffsbefehl auf die feindliche Burg in „Sturm auf Rabenfels“. Hoch- und Querformat, keine Konsolenfehler.
import fs from 'node:fs';
import { startServer } from './serve.mjs';
import { chromium, openPage, tileCenter } from './helpers.mjs';

const fail = m => { console.error('✗ ' + m); process.exitCode = 1; };
const ok = m => console.log('✓ ' + m);
const srv = await startServer();
const browser = await chromium.launch();
try {
  for (const [name, viewport] of [['Hochformat', { width: 390, height: 844 }], ['Querformat', { width: 844, height: 390 }]]) {
    const { ctx, page, errors } = await openPage(browser, srv.url, viewport, { acceptDownloads: true });
    await page.locator('#edNew').click(); await page.waitForTimeout(300);
    // Wasser malen: eine Linie neben dem Bergfried
    await page.locator('#edBrushes .chip[aria-label="Wasser"]').click();
    const [r0, c0, c1] = await page.evaluate(() => [KR + 3, KC - 2, KC + 2]);
    const a = await tileCenter(page, r0, c0), b = await tileCenter(page, r0, c1);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 10 }); await page.mouse.up();
    const painted = await page.evaluate(([r, c0, c1]) => { let n = 0; for (let c = c0; c <= c1; c++) if (T(r, c).t === WATER) n++; return n; }, [r0, c0, c1]);
    if (painted !== c1 - c0 + 1) fail(name + ': gemalt ' + painted); else ok(name + ': Wasser mit dem Finger gemalt');
    // Einstellungen: Name und Ziel
    await page.locator('#edSet').click();
    await page.locator('#edN').fill('Testtal ' + name);
    await page.locator('#edG_pop').fill('20'); await page.locator('#edG_raids').fill('');
    await page.locator('#edWrap [data-close]').click();
    await page.locator('#edSave').click();
    const saved = await page.evaluate(() => loadMaps().map(m => [m.n, m.goals]));
    if (saved.length !== 1 || saved[0][0] !== 'Testtal ' + name || JSON.stringify(saved[0][1]) !== '[["pop",20]]') fail(name + ': gespeichert ' + JSON.stringify(saved)); else ok(name + ': Karte mit Name und Ziel gespeichert');
    // Testen startet ein Spiel auf der Karte
    await page.locator('#edTest').click(); await page.waitForTimeout(300);
    const st = await page.evaluate(([r, c]) => [S.mi, mission().n, T(r, c).t === WATER, S.edit, document.body.classList.contains('editing')], [r0, c0]);
    if (st[0] !== -2 || st[1] !== 'Testtal ' + name || !st[2] || st[3] || st[4]) fail(name + ': Testlauf ' + JSON.stringify(st)); else ok(name + ': Testlauf auf der eigenen Karte');
    // Menü: Liste, Datei-Export
    await page.evaluate(() => openMenu());
    const dl = page.waitForEvent('download'); await page.locator('#mymaps .btn', { hasText: 'Datei' }).click(); const file = await dl;
    const fp = await file.path(); const json = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (json.n !== 'Testtal ' + name || json.v !== 1) fail(name + ': Export'); else ok(name + ': Export als Datei');
    // Import derselben Datei
    await page.locator('#edFile').setInputFiles(fp); await page.waitForTimeout(300);
    if ((await page.evaluate(() => loadMaps().length)) !== 2) fail(name + ': Import'); else ok(name + ': Import aus Datei');
    // Teilen-Link in neuem Browser öffnen
    const link = await page.evaluate(async () => location.origin + location.pathname + '#karte=' + await packMap(loadMaps()[0]));
    const c2 = await browser.newContext({ viewport }); const p2 = await c2.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message));
    await p2.goto(link); await p2.waitForFunction(() => typeof loadMaps === 'function' && loadMaps().length === 1, null, { timeout: 5000 }).catch(() => {});
    const imp = await p2.evaluate(() => [loadMaps().map(m => m.n), location.hash]);
    if (imp[0][0] !== 'Testtal ' + name || imp[1] !== '' || e2.length) fail(name + ': Link-Import ' + JSON.stringify(imp) + e2.join()); else ok(name + ': Teilen-Link (' + link.length + ' Zeichen) bringt die Karte in einen anderen Browser');
    await c2.close();
    if (errors.length) fail(name + ': Konsolenfehler: ' + errors.join(' | '));
    await ctx.close();
  }
  // Angriffsmission: Truppen wählen und auf das feindliche Tor tippen
  const { ctx, page, errors } = await openPage(browser, srv.url, { width: 390, height: 844 });
  await page.evaluate(() => brief(9)); await page.locator('#mBtns .btn.primary').click(); await page.waitForTimeout(200);
  await page.evaluate(() => { setSpeed(0); S.res.holz = 999; S.res.stein = 999; S.res.gold = 999; S.pop = 40; act('kaserne', KR - 2, KC + 2, true); act('werkstatt', KR - 2, KC - 2, true); assignWorkers(); recruit('sram'); recruit('kat'); hud(true); });
  await page.locator('#openTroops').click(); await page.locator('#chips .chip[data-t="alle"]').click(); await page.waitForTimeout(300);
  const gate = await page.evaluate(() => { const i = S.grid.findIndex(t => t.b && t.b.type === 'ftor'); const r = i / COLS | 0, c = i % COLS; ox += (vw / 2) - sx(c + .5, r + .5); oy += (vh / 2) - sy(c + .5, r + .5); clampCam(); return [r, c, i]; });
  const gp = await tileCenter(page, gate[0], gate[1]); await page.mouse.click(gp.x, gp.y);
  const tg = await page.evaluate(i => S.units.map(u => u.tgtB === i), gate[2]);
  if (tg.length !== 2 || !tg.every(Boolean)) fail('Rabenfels: Angriffsbefehl auf das Tor ' + JSON.stringify(tg)); else ok('Rabenfels: Rammbock und Katapult greifen das Tor an');
  if (errors.length) fail('Rabenfels: Konsolenfehler: ' + errors.join(' | '));
  await ctx.close();
} catch (e) { fail(e.stack || e.message); }
await browser.close(); srv.close();
if (process.exitCode) console.error('Kartenschmiede-Test fehlgeschlagen'); else console.log('Kartenschmiede-Test bestanden');
