// Gemeinsame Helfer für die Playwright-Tests.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');

// Seite öffnen und Konsolenfehler sammeln
export async function openPage(browser, url, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => typeof S !== 'undefined' && S);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}
// Mission aus dem Menü starten
export async function startMission(page, i) {
  const btn = page.locator('#mlist button').nth(i);
  if (await btn.isEnabled()) await btn.click(); else await page.evaluate(i => brief(i), i); // gesperrte Missionen direkt öffnen
  await page.locator('#mBtns .btn.primary').click();
  await page.waitForTimeout(200);
}
// Bildschirmposition (Mitte) eines Kartenfelds
export async function tileCenter(page, r, c) {
  return page.evaluate(([r, c]) => {
    const rect = cv.getBoundingClientRect();
    return { x: rect.left + sx(c + .5, r + .5), y: rect.top + sy(c + .5, r + .5) };
  }, [r, c]);
}
// Erstes Feld, auf dem das Gebäude k erlaubt ist (nahe am Bergfried bevorzugt)
export async function freeTile(page, k) {
  return page.evaluate(k => {
    let best = null, bd = 1e9;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!reason(k, r, c)) {
      const d = Math.hypot(r - KR, c - KC); if (d < bd) { bd = d; best = [r, c]; }
    }
    return best;
  }, k);
}
// Gebäude über die echte Oberfläche bauen: Baumenü öffnen, Karte wählen, auf das Feld tippen
export async function buildViaUi(page, k) {
  if (await page.locator('#tDone').isVisible()) await page.locator('#tDone').click();
  await page.locator('#openBuild').click();
  await page.locator(`.card[data-k="${k}"]`).click();
  const t = await freeTile(page, k);
  if (!t) throw new Error('Kein freies Feld für ' + k);
  // Feld sichtbar machen: Kamera ist am Anfang nicht gezoomt, daher liegt alles im Bild
  const p = await tileCenter(page, t[0], t[1]);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(100);
  return t;
}
