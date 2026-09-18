// tests/e2e/field-logs.spec.js
//
// Borehole logs and DCP sheets. Readings are recorded every 100 mm and the
// appendix prints them every 300 mm; the report body carries a summary and
// no row data at all. A hole or test saved before readings existed must
// still print as it did.
const { test, expect } = require('@playwright/test');
const { openPreview } = require('../helpers');
const fs = require('fs');
const path = require('path');

const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/fieldwork-sample.json'), 'utf8'));

async function importSample(page) {
  await page.goto('/index.html');
  await page.evaluate((rep) => {
    const file = new File([JSON.stringify(rep)], 'sample.json', { type: 'application/json' });
    const dt = new DataTransfer(); dt.items.add(file);
    const input = document.getElementById('importfile');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, sample);
  await page.waitForTimeout(300);
  await page.click('button[data-open]');
  await page.waitForSelector('#view-editor:not([hidden])');
}

test.describe('field logs', () => {
  test('the body summarises; the layers and readings appear only in Appendix C', async ({ page }) => {
    await importSample(page);
    const html = await openPreview(page);
    // The contents page names the appendix too; split at its heading.
    const [body, appendix] = html.split('<h2 class="pagebreak">Appendix C:');
    expect(appendix, 'Appendix C exists').toBeTruthy();

    // Body: counts, labels and one-line summaries only.
    expect(body).toContain('Two boreholes (BH1 and BH2) were put down by hand auger');
    expect(body).toContain('Seven DCP tests were carried out');   // six standalone + the one beside BH1
    expect(body).toContain('Refusal at 0.6 m. Bouncing on bedrock. Brown sand on dry tip.');
    expect(body).not.toContain('fine to medium, brown');
    expect(body).not.toContain('0.3 – 0.6');

    // Appendix: the structured hole in 300 mm rows, composed to AS 1726 order.
    expect(appendix).toContain('TOPSOIL: SC clayey SAND, fine to medium, brown; M; L; topsoil.');
    expect(appendix).toContain('CI CLAY, medium plasticity, red-brown, with fine gravel; M (w≈PL); St; residual.');
    expect(appendix).toContain('SANDSTONE, fine grained, pale grey; M; XW; VL.');
    expect(appendix).toContain('▽ 0.5 m');
    expect(appendix).toContain('<td>120, 150, 250</td><td>19</td>');
    expect(appendix).toContain('<td>0.6 – 0.7</td>');
    expect(appendix).toContain('<td>15 R</td>');
    expect(appendix).toContain('Borehole terminated at 0.7 m below ground level: refusal on rock');

    // The legacy hole keeps one row per layer and its text as typed.
    expect(appendix).toContain('<td>0.2 – 1.2</td><td>CI</td><td>Sandy CLAY, red-brown, moist, stiff; residual</td>');

    // DCP sheet: blows summed per 300 mm, a legacy test still has its summary.
    expect(appendix).toContain('DCP at BH1');
    expect(appendix).toContain('<td>0.3 – 0.6</td><td>20 R</td>');         // DCP 1: 5+7+8, refusal in the interval
    expect(appendix).toContain('<td>5.7 – 6.0</td>');                      // the 6 m test reaches the sheet
    expect(appendix).toContain('Refusal at 0.5 m. Bouncing on bedrock.');  // legacy DCP 3
    expect(appendix).toContain('Test locations limited by large trees');
    expect(appendix).toContain('AS 1289.6.3.2');
  });

  test('every appendix page still fits its sheet', async ({ page }) => {
    await importSample(page);
    await openPreview(page);
    await page.click('#pageview');
    await page.waitForSelector('.rptpage');
    // Same rule as paginated-preview.spec.js: the cover's photo band is
    // positioned past the body on purpose.
    const bad = await page.$$eval('.rptpage:not(.grow):not(.coverpage) .rptpagebody', els =>
      els.filter(b => b.scrollHeight > b.clientHeight + 1).length);
    expect(bad, 'pages whose body overflows').toBe(0);
    const grown = await page.$$eval('.rptpage.grow', els => els.length);
    expect(grown, 'pages the paginator had to stretch').toBe(0);
  });
});
