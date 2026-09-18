// tests/e2e/field-editor.spec.js
//
// The field tabs as an engineer uses them on site: a borehole is one table,
// one row per 100 mm, described where the material changes; readings go
// down a ladder that never runs out; the pickers follow the class the
// standard gives the layer; one card is open at a time.
const { test, expect } = require('@playwright/test');
const { newReport, gotoTab, openPreview } = require('../helpers');

test.describe('field editor', () => {
  test('boreholes and DCP tests are separate tabs, each with its own remarks', async ({ page }) => {
    await newReport(page, 'classification');
    await expect(page.locator('#tabrail button:text-is("Boreholes")')).toHaveCount(1);
    await expect(page.locator('#tabrail button:text-is("DCP tests")')).toHaveCount(1);
    await expect(page.locator('#tabrail button:text-is("Fieldwork")')).toHaveCount(0);
    await gotoTab(page, 'Boreholes');
    await expect(page.locator('#f_bhRemarks')).toHaveCount(1);
    await expect(page.locator('#dcplist')).toHaveCount(0);
    await gotoTab(page, 'DCP tests');
    await expect(page.locator('#f_dcpRemarks')).toHaveCount(1);
    await expect(page.locator('#bhlist')).toHaveCount(0);
  });

  test('one card open at a time; adding a hole opens it and closes the rest', async ({ page }) => {
    await newReport(page, 'classification');
    await gotoTab(page, 'Boreholes');
    await page.click('#addbh');
    await page.click('#addbh');
    const open = () => page.$$eval('details[data-bhcard]', els => els.map(d => d.open));
    expect(await open()).toEqual([false, true]);
    await page.click('details[data-bhcard="0"] > summary');
    expect(await open()).toEqual([true, false]);
  });

  test('the pickers follow the class: coarse, fine and rock carry different terms', async ({ page }) => {
    await newReport(page, 'classification');
    await gotoTab(page, 'Boreholes');
    await page.click('#addbh');
    const pickers = () => page.$$eval('select[data-bh="0"][data-layer="0"]', els => els.map(s => s.dataset.f));

    // Every row has real controls; a class on an empty row starts the layer there.
    await expect(page.locator('details[data-bhcard="0"] tbody select[data-f="uscs"]')).toHaveCount(10);
    await page.selectOption('select[data-bh="0"][data-newlayer="0"][data-f="uscs"]', 'SC');
    expect(await pickers()).toEqual(['uscs', 'prefix', 'moisture', 'density', 'origin']);
    await expect(page.locator('select[data-bh="0"][data-layer="0"][data-f="moisture"] option')).toContainText(['Dry', 'Moist', 'Wet']);

    await page.selectOption('select[data-bh="0"][data-layer="0"][data-f="uscs"]', 'CI');
    expect(await pickers()).toEqual(['uscs', 'prefix', 'moisture', 'consistency', 'origin']);
    await expect(page.locator('select[data-bh="0"][data-layer="0"][data-f="moisture"] option')).toContainText(['Moist, near plastic limit']);
    await page.selectOption('select[data-bh="0"][data-layer="0"][data-f="consistency"]', 'Stiff');
    await page.fill('input[data-bh="0"][data-layer="0"][data-f="desc"]', 'red-brown');
    await expect(page.locator('[data-reads="0:0"]')).toHaveText('CI CLAY, medium plasticity, red-brown; stiff.');

    await page.selectOption('select[data-bh="0"][data-layer="0"][data-f="uscs"]', 'SANDSTONE');
    expect(await pickers()).toEqual(['uscs', 'weathering', 'strength', 'moisture']);
    // A term chosen for clay did not survive into rock.
    const L = await page.evaluate(() => report().boreholes[0].layers[0]);
    expect(L.consistency).toBeUndefined();
    expect(L.desc).toBe('red-brown');
  });

  test('the class list is grouped and has no dashes', async ({ page }) => {
    await newReport(page, 'classification');
    await gotoTab(page, 'Boreholes');
    await page.click('#addbh');
    const groups = await page.$$eval('select[data-bh="0"][data-newlayer="0"][data-f="uscs"] optgroup', els => els.map(g => g.label));
    expect(groups).toEqual(['Soil', 'Rock', 'Not classified']);
    const labels = await page.$$eval('select[data-bh="0"][data-newlayer="0"][data-f="uscs"] option', els => els.map(o => o.textContent));
    expect(labels).toContain('SC clayey SAND');
    expect(labels).toContain('Pt PEAT');
    expect(labels).toContain('COBBLES and BOULDERS');
    for (const l of labels) expect(l).not.toMatch(/[–—-]\s/);
  });

  test('water depth appears only when groundwater was seen', async ({ page }) => {
    await newReport(page, 'classification');
    await gotoTab(page, 'Boreholes');
    await page.click('#addbh');
    await expect(page.locator('input[data-bh="0"][data-f="waterDepth"]')).toHaveCount(0);
    await page.selectOption('select[data-bh="0"][data-f="water"]', 'Seepage');
    await expect(page.locator('input[data-bh="0"][data-f="waterDepth"]')).toHaveCount(1);
    await page.selectOption('select[data-bh="0"][data-f="water"]', 'Not encountered');
    await expect(page.locator('input[data-bh="0"][data-f="waterDepth"]')).toHaveCount(0);
  });

  test('the ladder opens at one metre, grows as the last row is filled, and Add 1 m never stops', async ({ page }) => {
    await newReport(page, 'classification');
    await gotoTab(page, 'DCP tests');
    await page.click('#adddcp');
    const rows = () => page.locator('details[data-dcpcard="0"] tbody tr').count();
    expect(await rows()).toBe(10);
    for (let k = 0; k < 10; k++) {
      await page.fill(`input[data-dcp="0"][data-cell="blows"][data-k="${k}"]`, String(k + 1));
    }
    expect(await rows(), 'filling the last row adds a metre').toBe(20);
    for (let i = 0; i < 5; i++) await page.click('[data-adddcprows="0"]');
    expect(await rows()).toBe(70);
    await page.fill('input[data-dcp="0"][data-cell="blows"][data-k="59"]', '20 R');
    await expect(page.locator('[data-dcpsum="0"]')).toHaveText('DCP 1 · refusal at 6.0 m');
    // Enter walks down the ladder.
    await page.focus('input[data-dcp="0"][data-cell="blows"][data-k="60"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('input[data-dcp="0"][data-cell="blows"][data-k="61"]')).toBeFocused();
  });

  test('a description typed on an empty row starts a layer there, with the caret kept', async ({ page }) => {
    await newReport(page, 'classification');
    await gotoTab(page, 'Boreholes');
    await page.click('#addbh');
    await page.type('input[data-bh="0"][data-newlayer="4"][data-f="desc"]', 'grey');
    await expect(page.locator('input[data-bh="0"][data-layer="0"][data-f="desc"]')).toHaveValue('grey');
    await expect(page.locator('input[data-bh="0"][data-layer="0"][data-f="desc"]')).toBeFocused();
    expect(await page.evaluate(() => report().boreholes[0].layers[0].from)).toBe('0.4');
  });

  test('an added metre can be taken back while it is empty', async ({ page }) => {
    await newReport(page, 'classification');
    await gotoTab(page, 'Boreholes');
    await page.click('#addbh');
    await expect(page.locator('[data-droprows="0"]')).toBeHidden();
    await page.click('[data-addrows="0"]');
    await expect(page.locator('details[data-bhcard="0"] tbody tr')).toHaveCount(20);
    await expect(page.locator('[data-droprows="0"]')).toBeVisible();
    await page.click('[data-droprows="0"]');
    await expect(page.locator('details[data-bhcard="0"] tbody tr')).toHaveCount(10);
    await page.click('[data-addrows="0"]');
    await page.fill('input[data-bh="0"][data-cell="pp"][data-k="15"]', '200');
    await expect(page.locator('[data-droprows="0"]'), 'not offered once the metre holds a reading').toBeHidden();
  });

  test('info icons open a panel on tap and say the description is the engineer\'s', async ({ page }) => {
    await newReport(page, 'classification');
    await gotoTab(page, 'Boreholes');
    await page.click('#addbh');
    const btn = page.locator('button.info[data-tip="tip-desc-bh0"]');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#tip-desc-bh0')).toBeHidden();
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#tip-desc-bh0')).toBeVisible();
    await expect(page.locator('#tip-desc-bh0')).toContainText('Engineer defined');
    await expect(page.locator('#tip-desc-bh0')).not.toContainText('e.g.');
    const box = await btn.boundingBox();
    expect(box.width, 'tap target').toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('a hole logged before the table existed opens in it and keeps its words', async ({ page }) => {
    await newReport(page, 'classification');
    await page.evaluate(() => {
      report().boreholes.push({ method: 'Hand auger', depth: '1.2', water: 'E = encountered', waterDepth: '0.9',
        layers: [{ from: '0', to: '0.25', uscs: 'SC', desc: 'Clayey SAND, brown, moist, loose; TOPSOIL' },
                 { from: '0.25', to: '1.2', uscs: 'CI', desc: 'Sandy CLAY, red-brown, moist, stiff; residual' }] });
      saveDb();
    });
    await gotoTab(page, 'Boreholes');
    await expect(page.locator('select[data-bh="0"][data-f="water"]')).toHaveValue('Water level observed');
    await expect(page.locator('input[data-bh="0"][data-f="waterDepth"]')).toHaveValue('0.9');
    // The 0.25 m layer sits in the 0.2–0.3 row, its depth untouched.
    await expect(page.locator('input[data-bh="0"][data-layer="1"][data-f="desc"]')).toHaveValue('Sandy CLAY, red-brown, moist, stiff; residual');
    expect(await page.evaluate(() => report().boreholes[0].layers[1].from)).toBe('0.25');
    expect(await page.locator('details[data-bhcard="0"] tbody tr:not(.pk)').count(), '1.2 m of rows for a 1.2 m hole').toBe(20);
    // Untouched, it prints exactly as it always did.
    const html = await openPreview(page);
    expect(html).toContain('<td>0.25 – 1.2</td><td>CI</td><td>Sandy CLAY, red-brown, moist, stiff; residual</td>');
    expect(html).toContain('E = encountered');
  });
});
