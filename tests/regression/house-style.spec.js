// tests/regression/house-style.spec.js
//
// Typographic rules the firm has decided on, checked everywhere a user can
// see text: placeholders must not read as entered values, and there is no em
// dash anywhere, at any report status. A hyphen is acceptable where genuinely
// needed; an em dash is not.
const { test, expect } = require('@playwright/test');
const { newReport, gotoTab } = require('../helpers');

test.describe('house style', () => {
  test('placeholders are visually distinct from entered values', async ({ page }) => {
    await newReport(page, 'classification');
    await gotoTab(page, 'Setup');
    const style = await page.evaluate(() => {
      const el = document.getElementById('f_jobNo');
      return getComputedStyle(el, '::placeholder').fontStyle;
    });
    expect(style, 'placeholder must not read as an entered value').toBe('italic');
  });

  // House style: no em dashes anywhere a user can see them, at any status.
  // A hyphen is acceptable where genuinely needed; an em dash is not.
  test('no em dash appears anywhere in the report, at any status', async ({ page }) => {
    await newReport(page, 'comprehensive');
    const found = await page.evaluate(() => {
      const d = report().d;
      // Fill enough that every branch of the document renders something.
      d.jobNo = 'ABC-1'; d.author = 'A Author'; d.reviewer = 'A Reviewer';
      d.client = 'A Client'; d.street = '1 Test St'; d.suburb = 'Testville';
      d.postcode = '2000'; d.lotDp = 'Lot 1 DP 1'; d.projectDesc = 'A dwelling';
      d.siteClass = 'M'; d.designClass = 'M'; d.classJust = 'x'; d.windClass = 'N2';
      d.slopeDeg = '3'; d.geologyUnit = 'Test Unit'; d.fieldDate = '2026-01-01';
      d.includeSlope = true; d.slopeConclusion = 'x'; d.reportClass = 'B';
      d.founding = 'x'; d.hazards = 'x';
      report().boreholes.push({ method: 'Hand auger', depth: '2.0', water: 'NE = not encountered',
                                waterDepth: '', layers: [{ from: '0', to: '1', uscs: 'SC', desc: 'Clay' }] });
      d.slopeHazards.push({ desc: '', likelihood: '', consequence: '' });
      d.riskLifeRows.push({ desc: '', ph: '', psh: '', pts: '', vdt: '' });
      saveDb();

      const scan = [];
      for (const status of ['draft', 'review', 'issued']) {
        report().status = status;
        report().issued = status === 'issued' ? new Date().toISOString() : null;
        buildReport();
        const t = document.getElementById('rpt').innerText;
        if (t.includes('\u2014')) {
          const i = t.indexOf('\u2014');
          scan.push(status + ': …' + t.slice(Math.max(0, i - 45), i + 45) + '…');
        }
      }
      return scan;
    });
    expect(found, 'em dash found in the rendered report').toEqual([]);
  });

  test('no em dash appears in the editor interface', async ({ page }) => {
    await newReport(page, 'comprehensive');
    // Turn on the optional slope module so every tab is reachable.
    await page.evaluate(() => { report().d.includeSlope = true; saveDb(); renderEditor({ focus: false }); });

    const tabs = await page.$$eval('#tabrail button', els => els.map(e => e.textContent.trim()));
    const found = [];
    for (const label of tabs) {
      await page.click(`#tabrail button:text-is("${label}")`);
      const hit = await page.evaluate(() => {
        const t = document.body.innerText;
        if (!t.includes('\u2014')) return null;
        const i = t.indexOf('\u2014');
        return '…' + t.slice(Math.max(0, i - 45), i + 45) + '…';
      });
      if (hit) found.push(`${label}: ${hit}`);
    }
    expect(tabs.length, 'expected the full tab set').toBeGreaterThan(8);
    expect(found, 'em dash found in the editor').toEqual([]);
  });
});
