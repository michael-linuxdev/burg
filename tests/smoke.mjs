// Smoke-Test für CI: Spiel startet, Mission 1 lässt sich beginnen, ein Gebäude lässt sich setzen,
// Manifest/Icons/Service Worker werden ausgeliefert, und die App startet offline.
import { startServer } from './serve.mjs';
import { chromium, openPage, startMission, buildViaUi } from './helpers.mjs';

const fail = m => { console.error('✗ ' + m); process.exitCode = 1; };
const ok = m => console.log('✓ ' + m);
const srv = await startServer();
const browser = await chromium.launch();
try {
  for (const [name, viewport] of [['Hochformat', { width: 390, height: 844 }], ['Querformat', { width: 844, height: 390 }], ['Desktop', { width: 1280, height: 800 }]]) {
    const { ctx, page, errors } = await openPage(browser, srv.url, viewport);
    await page.locator('#menu').waitFor({ state: 'visible', timeout: 3000 }).catch(() => fail(name + ': Menü nicht sichtbar'));
    await startMission(page, 0);
    const before = await page.evaluate(() => S.res.holz);
    await buildViaUi(page, 'holzf');
    const st = await page.evaluate(() => ({ n: count('holzf'), holz: S.res.holz, mi: S.mi }));
    if (st.mi !== 0) fail(name + ': Mission 1 nicht gestartet');
    if (st.n !== 1 || st.holz !== before - 3) fail(name + ': Holzfäller wurde nicht gebaut ' + JSON.stringify(st));
    await page.waitForTimeout(1500);
    if (errors.length) fail(name + ': Konsolenfehler: ' + errors.join(' | '));
    else ok(name + ': Mission 1 gestartet, Holzfäller gesetzt, keine Konsolenfehler');
    await ctx.close();
  }
  // PWA: Manifest, Icons, Service Worker, Offline-Start
  const { ctx, page, errors } = await openPage(browser, srv.url, { width: 390, height: 844 });
  const man = await (await page.request.get(srv.url + 'manifest.webmanifest')).json();
  for (const ic of man.icons) { const r = await page.request.get(srv.url + ic.src); if (!r.ok()) fail('Icon fehlt: ' + ic.src); }
  if (!man.icons.some(i => i.sizes === '512x512') || !man.start_url || !man.name) fail('Manifest unvollständig');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // Alle Dateien aus SHELL müssen erreichbar sein
  const sw = await (await page.request.get(srv.url + 'sw.js')).text();
  const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  for (const f of shell) { const r = await page.request.get(srv.url + f.replace(/^\.\//, '')); if (!r.ok()) fail('SHELL-Datei fehlt: ' + f); }
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => typeof S !== 'undefined' && S, null, { timeout: 5000 });
  const fontOk = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 16px "Cinzel"'); });
  if (!fontOk) fail('Schrift Cinzel offline nicht geladen');
  if (errors.length) fail('PWA: Konsolenfehler: ' + errors.join(' | '));
  else ok('PWA: Manifest und Icons ok, Service Worker aktiv, ' + shell.length + ' Dateien im Cache, Offline-Start ok');
  await ctx.close();
} catch (e) { fail(e.stack || e.message); }
await browser.close();
srv.close();
if (process.exitCode) console.error('Smoke-Test fehlgeschlagen'); else console.log('Smoke-Test bestanden');
