// tests/e2e/report-types.spec.js
//
// The core promise of the engine: each report type gets the content it
// earned and nothing more. A Desktop Assessment must not carry footing
// advice or cite standards it never applied; a Comprehensive report must
// cite AS 3798 only when there is a fills recommendation to hang it on.
// Every test here fills the form, opens the preview and asserts on the
// generated report HTML, because the form and the document can drift apart
// in ways that look fine on screen.
const { test, expect } = require('@playwright/test');
const { newReport, gotoTab, openPreview } = require('../helpers');

async function fillCommon(page) {
  await gotoTab(page, 'Setup');
  await page.fill('#f_author', 'Ryan Chalmers');
  await page.fill('#f_reviewer', 'Test Reviewer');

  await gotoTab(page, 'Client & site ID');
  await page.fill('#f_client', 'Test Client');
  await page.fill('#f_street', '1 Test St');
  await page.fill('#f_suburb', 'Testville');
  await page.fill('#f_postcode', '2323');
  await page.fill('#f_lotDp', 'Lot 1 DP 123456');
  await page.fill('#f_projectDesc', 'New single-storey dwelling');

  await gotoTab(page, 'Site description');
  await page.fill('#f_slopeDeg', '2');
  await page.fill('#f_geologyUnit', 'Mulbring Siltstone');
}

async function readinessGapLabels(page) {
  await gotoTab(page, 'Review & issue');
  return page.$$eval('#reviewgaps ul li', els => els.map(e => e.textContent.trim()));
}

test.describe('Desktop Assessment — no footing advice, no over-claimed standards', () => {
  test('Foundations fieldset is hidden and not required', async ({ page }) => {
    await newReport(page, 'desktop');
    await fillCommon(page);

    await gotoTab(page, 'Recommendations');
    await expect(page.locator('fieldset:has(legend:text-is("Foundations"))')).toHaveCount(0);
    await expect(
      page.locator('fieldset:has(legend:text-is("Geotechnical recommendations")) p.hint')
    ).toContainText('desk-study');

    await gotoTab(page, 'Review & issue');
    await page.fill('#f_limitations', 'Test limitations statement.');
    const gaps = await readinessGapLabels(page);
    expect(gaps.some(g => g.includes('Footing recommendation'))).toBe(false);
  });

  test('report body and references cite only what was actually done', async ({ page }) => {
    await newReport(page, 'desktop');
    await fillCommon(page);
    await gotoTab(page, 'Review & issue');
    await page.fill('#f_limitations', 'Test limitations statement.');
    const html = await openPreview(page);

    expect(html).toContain('AS 1726'); // desk study is in scope even for a desktop assessment
    expect(html).not.toContain('AS 2870');
    expect(html).not.toContain('AS 4055');
    expect(html).not.toContain('AS 3798');
    expect(html).not.toContain('BTF-18');
    expect(html).not.toContain('GeoGuide');
    expect(html).not.toContain('Suitable footing systems');
    expect(html).not.toContain('Founding requirements');
  });
});

test.describe('Site Classification + Wind — Foundations present, groundwater depth, Class label', () => {
  test('borehole fields, hints, placeholders and report output', async ({ page }) => {
    await newReport(page, 'classification');
    await fillCommon(page);

    await gotoTab(page, 'Boreholes');
    await page.fill('#f_fieldDate', '2026-08-01');
    await page.click('#addbh');
    await page.selectOption('select[data-bh="0"][data-f="method"]', 'Push tube (rig)');
    await page.fill('input[data-bh="0"][data-f="depth"]', '1.5');
    await page.selectOption('select[data-bh="0"][data-f="water"]', 'Water level observed');
    await page.fill('input[data-bh="0"][data-f="waterDepth"]', '2.4');
    // The first layer starts from the table, at 0.0 m; its class is an AS 1726
    // symbol and its description is the engineer's own words.
    await page.click('[data-startlayer="0:0"]');
    await page.selectOption('select[data-bh="0"][data-layer="0"][data-f="uscs"]', 'CI');
    await page.fill('input[data-bh="0"][data-layer="0"][data-f="desc"]', 'red-brown');
    await page.selectOption('select[data-bh="0"][data-layer="0"][data-f="consistency"]', 'Stiff');

    await expect(page.locator('th:has-text("Class")')).toHaveCount(1);
    await expect(page.locator('th:has-text("USCS")')).toHaveCount(0);
    await expect(
      page.locator('fieldset:has(legend:text-is("Boreholes / test pits")) p.hint')
    ).toContainText('One row per 100 mm');

    await gotoTab(page, 'Classification');
    await page.selectOption('#f_siteClass', 'M');
    await page.fill('#f_classJust', 'Test classification basis.');
    await gotoTab(page, 'Wind');
    await page.selectOption('#f_windClass', 'N2');

    await gotoTab(page, 'Recommendations');
    await expect(page.locator('fieldset:has(legend:text-is("Foundations"))')).toHaveCount(1);
    await page.fill('#f_founding', 'Test founding advice.');

    await gotoTab(page, 'Review & issue');
    await page.fill('#f_limitations', 'Test limitations statement.');
    const html = await openPreview(page);

    expect(html).toContain('AS 1726');
    expect(html).toContain('AS 2870');
    expect(html).toContain('AS 4055');
    expect(html).not.toContain('AS 3798'); // no Fills recommendation given
    // The CSIRO sheet is appended and cited from info-sheets/manifest.js, and
    // is on by default for every type except a desktop assessment. This is the
    // 2024 Building Technology Resources edition; the engine used to cite the
    // superseded 2012 "BTF-18" designation while appending nothing at all.
    expect(html).toContain('Foundation Maintenance and Footing Performance');
    expect(html).toContain('CSIRO 2024');
    expect(html).not.toContain('BTF-18');
    expect(html).not.toContain('GeoGuide'); // no hazards commentary
    expect(html).toContain('Water level observed @ 2.4 m');
    expect(html, 'the layer prints composed to AS 1726 in Appendix C').toContain('CI CLAY, medium plasticity, red-brown; St.');
    expect(html).toContain('>Class<');
    expect(html).not.toContain('>USCS<');
  });
});

test.describe('Comprehensive with Fills recommendation + hazards commentary', () => {
  test('AS 3798 / GeoGuide LR8 / AGS 2007 appear only when actually relevant', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await fillCommon(page);

    await gotoTab(page, 'Boreholes');
    await page.fill('#f_fieldDate', '2026-08-01');
    await page.click('#addbh');
    await page.selectOption('select[data-bh="0"][data-f="method"]', 'Push tube (rig)');
    await page.fill('input[data-bh="0"][data-f="depth"]', '3');
    await page.selectOption('select[data-bh="0"][data-f="water"]', 'Not encountered');

    await gotoTab(page, 'Classification');
    await page.selectOption('#f_siteClass', 'H1');
    await page.fill('#f_classJust', 'Test classification basis.');
    await gotoTab(page, 'Wind');
    await page.selectOption('#f_windClass', 'N3');

    await gotoTab(page, 'Recommendations');
    await page.fill('#f_founding', 'Test founding advice.');
    await page.click('#addrec');
    await page.selectOption('select[data-rec="0"][data-f="area"]', 'Fills');
    await page.fill('textarea[data-rec="0"][data-f="desc"]', 'Fill to be placed in accordance with AS 3798.');
    await page.fill('#f_hazards', 'Sloping site; landslide risk considered low but noted.');

    await gotoTab(page, 'Review & issue');
    await page.fill('#f_limitations', 'Test limitations statement.');
    const html = await openPreview(page);

    expect(html).toContain('AS 3798');
    expect(html).toContain('GeoGuide');
    expect(html).toContain('Landslide Risk Management');
    expect(html).toContain('hillside sites');
  });
});

test.describe('borehole and layer rows', () => {
  test('add/remove borehole and layer without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Boreholes');
    await page.click('#addbh');
    await page.click('[data-startlayer="0:0"]');
    await page.click('[data-dellayer="0:0"]');
    await page.click('[data-delbh="0"]');

    expect(errors).toEqual([]);
  });
});
