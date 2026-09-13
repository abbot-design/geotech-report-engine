// tests/regression/certification-dates.spec.js
//
// The date beside a signature is the day that person signed, and nothing
// else. A date against an unsigned line implies a certification that has not
// happened; a date copied from the report's creation says the wrong day. Both
// are on a document a certifier relies on, so both are pinned here.
const { test, expect } = require('@playwright/test');
const { newReport } = require('../helpers');

test.describe('certification dates', () => {
  // A date against an unsigned certification line implies a certification that
  // has not happened — on a document a certifier relies on.
  test('an unsigned certification line carries no date', async ({ page }) => {
    await newReport(page, 'classification');
    const cert = await page.evaluate(() => {
      report().d.author = 'Test Author';
      report().d.reviewer = 'Test Reviewer';
      saveDb(); buildReport();
      const t = document.getElementById('rpt').innerText;
      return t.slice(t.indexOf('For and on behalf of'));
    });
    // Both lines unsigned, so neither may show a date.
    expect(cert.match(/Date: Not signed/g) || []).toHaveLength(2);
    expect(cert).not.toMatch(/Date: \d/);
  });

  test('signing stamps that signatory only, on the day they signed', async ({ page }) => {
    await newReport(page, 'classification');
    const cert = await page.evaluate(() => {
      const d = report().d;
      d.author = 'Test Author'; d.reviewer = 'Test Reviewer';
      d.authorSig = 'data:image/png;base64,iVBORw0KGgo=';
      d.authorSigDate = '2026-09-07';
      saveDb(); buildReport();
      const t = document.getElementById('rpt').innerText;
      return t.slice(t.indexOf('For and on behalf of'));
    });
    expect(cert, 'the signatory gets their signing date').toContain('07/09/2026');
    expect(cert, 'the unsigned reviewer still gets none').toContain('Date: Not signed');
  });

  // The date must be the day of signing, not the day the report was created.
  test('the certification date is not the report creation date', async ({ page }) => {
    await newReport(page, 'classification');
    const out = await page.evaluate(() => {
      const d = report().d;
      d.dateIssued = '2026-01-15';          // report raised in January
      d.authorSig = 'data:image/png;base64,iVBORw0KGgo=';
      d.authorSigDate = '2026-06-30';       // signed in June
      saveDb(); buildReport();
      const t = document.getElementById('rpt').innerText;
      return t.slice(t.indexOf('For and on behalf of'));
    });
    expect(out).toContain('30/06/2026');
    expect(out, 'must not fall back to the document date').not.toContain('15/01/2026');
  });
});
