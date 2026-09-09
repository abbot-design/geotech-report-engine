// tests/fonts.spec.js
//
// The report is set in Carlito, embedded and served from the repo. Dev-only,
// never referenced by index.html or sw.js.
//
// Why this matters enough to test: the report used to be set in `system-ui`,
// which resolves to SF Pro on iOS/macOS, Segoe UI on Windows and Roboto on
// Android. The issued PDF is produced by the engineer's own browser, so the
// same report had different line breaks and a different page count depending
// on who issued it. These tests guard the fix.
//
// Run with:
//   cd tests && npm install && npx playwright install chromium && npm test
//
const { test, expect } = require('@playwright/test');

const FACES = ['regular', 'bold', 'italic', 'bolditalic'];

async function newReport(page, type) {
  await page.goto('/index.html');
  await page.click(`button[data-newtype="${type}"]`);
  await page.waitForSelector('#view-editor:not([hidden])');
}
async function openPreview(page) {
  await page.click('#tabrail button:text-is("Review & issue")');
  await page.click('#nextbtn');
  await page.waitForSelector('#view-preview:not([hidden])');
}

test.describe('embedded report font', () => {
  test('every face exists and is in the offline shell', async ({ request }) => {
    const sw = await (await request.get('/sw.js')).text();
    const shell = JSON.parse(sw.match(/const SHELL = (\[[^\]]*\])/)[1].replace(/'/g, '"'));

    for (const f of FACES) {
      const url = `/vendor/fonts/carlito-${f}.woff2`;
      const res = await request.get(url);
      expect(res.status(), `${url} must not 404`).toBe(200);
      expect(shell, `${url} must be cached, or the report reflows to a fallback with no signal`)
        .toContain('.' + url);
    }
    const licence = await request.get('/vendor/fonts/carlito.LICENSE');
    expect(licence.status(), 'the OFL text ships with the fonts').toBe(200);
  });

  test('the cover logo resolves and is cached for offline use', async ({ request }) => {
    const res = await request.get('/assets/abbot-logo.svg');
    expect(res.status()).toBe(200);
    expect((await res.text()).slice(0, 400)).toContain('viewBox');

    const sw = await (await request.get('/sw.js')).text();
    const shell = JSON.parse(sw.match(/const SHELL = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
    expect(shell, 'the cover would print without its wordmark on a site with no signal')
      .toContain('./assets/abbot-logo.svg');
  });

  test('the report actually renders in Carlito, not the platform font', async ({ page }) => {
    await newReport(page, 'classification');
    await openPreview(page);
    await page.evaluate(() => document.fonts.ready);

    const used = await page.evaluate(() => {
      const p = [...document.querySelectorAll('#rpt p')].filter(x => !x.closest('.rpt-cover'))[0];
      const h = document.querySelector('#rpt h2');
      return {
        body: getComputedStyle(p).fontFamily.split(',')[0].trim(),
        heading: getComputedStyle(h).fontFamily.split(',')[0].trim(),
        loaded: [...document.fonts].some(f => f.family === 'Carlito' && f.status === 'loaded')
      };
    });
    expect(used.loaded).toBe(true);
    expect(used.body).toBe('Carlito');
    expect(used.heading, 'headings must be deterministic too').toBe('Carlito');
  });

  test('the interface keeps the platform font', async ({ page }) => {
    // Only the printed document needs to be device-independent. The editor
    // should still look native.
    await newReport(page, 'classification');
    const ui = await page.$eval('#form', el => getComputedStyle(el).fontFamily);
    expect(ui).not.toMatch(/^Carlito/);
  });

  test('page furniture uses the same font as the report body', async ({ page }) => {
    // Regression: the running footer and the draft stamp are appended to the
    // page, not to .rptpagebody, so they sat outside .rpt and inherited the
    // interface font while the print path used the report font. The preview
    // measured 114mm for a footer that prints at 103mm.
    await newReport(page, 'classification');
    await openPreview(page);
    await page.click('#pageview');
    await page.waitForSelector('.rptpage');
    await page.evaluate(() => document.fonts.ready);

    const fonts = await page.evaluate(() => {
      const first = f => getComputedStyle(f).fontFamily.split(',')[0].trim();
      return {
        body: first(document.querySelector('.rptpagebody')),
        footer: first(document.querySelector('.rptpage > .rptfoot')),
        stamp: first(document.querySelector('.rptpage > .wm'))
      };
    });
    expect(fonts.footer).toBe(fonts.body);
    expect(fonts.stamp).toBe(fonts.body);
  });

  test('the footer fits on one line at the text measure', async ({ page }) => {
    await newReport(page, 'classification');
    await page.click('#tabrail button:text-is("Setup")');
    await page.fill('#f_jobNo', 'AD-2026-0147');   // long job number
    await openPreview(page);
    await page.click('#pageview');
    await page.waitForSelector('.rptpage');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);                 // the image re-render settles

    const fits = await page.evaluate(() => {
      const f = document.querySelector('.rptpage > .rptfoot');
      const lh = parseFloat(getComputedStyle(f).lineHeight);
      return [...f.children].every(s => s.getBoundingClientRect().height <= lh + 1);
    });
    expect(fits, 'the contact line and the job line share one row').toBe(true);
  });
});
