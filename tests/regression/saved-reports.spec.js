// tests/regression/saved-reports.spec.js
//
// Reports saved by earlier versions of the engine must keep opening. The
// stored shape grows a key now and then (waterDepth on a borehole was the
// first); a report from before the key existed has to import, render, and
// not print a stray separator where the value would have gone.
//
// Engineers have been storing real reports since 14 September 2026, so a
// failure here is a data-loss bug, not a cosmetic one.
const { test, expect } = require('@playwright/test');
const { gotoTab, openPreview } = require('../helpers');

test.describe('Backward compatibility', () => {
  test('old report saved before waterDepth existed imports and renders cleanly', async ({ page }) => {
    await page.goto('/index.html');
    const oldReport = await page.evaluate(() => {
      const now = new Date();
      return {
        id: 'ROLDTEST', type: 'classification', created: now.toISOString(), updated: now.toISOString(),
        issued: null, status: 'draft', submitted: null,
        d: {
          jobNo: 'OLD-001', version: '1', dateIssued: now.toISOString().slice(0, 10),
          author: 'A', authorQual: '', authorReg: '', reviewer: 'R', reviewerQual: '', reviewerReg: '',
          client: 'Old Client', careOf: '', clientPhone: '', clientEmail: '',
          projectDesc: 'Old project', street: '1 Old St', suburb: 'Oldtown', state: 'NSW', postcode: '2000',
          lotDp: 'Lot 1 DP 1', council: '', drawingsBy: '', drawingNos: '', drawingsDate: '',
          access: '', existing: '', vegetation: '', slopeDeg: '3', aspect: '', drainage: '',
          geologyMap: '', geologyUnit: 'Old geology', history: '', neighbours: '',
          fieldDate: '2020-01-01', operator: '', weather: '', equipment: '', groundwater: 'Not encountered',
          labName: '', labDate: '', siteClass: 'M', classJust: 'Old basis', bearing: '', ys: '',
          windRegion: 'A', terrain: '', topo: '', shielding: '', windClass: 'N2', windNote: false,
          footings: [], founding: 'Old founding advice', excavation: '', retaining: '', fills: '',
          drainageRec: '', hazards: '', extraRecs: '',
          holds: [], limitations: 'Old limitations', authorSig: '', reviewerSig: '',
          incLegend: true, incClassDefs: true, incGeneral: true, appGeneral: 'General notes',
          distribution: '', dist: [], recRows: [], awaitingResults: false,
        },
        boreholes: [{ method: 'Hand auger', depth: '1.2', water: 'E = encountered',
          layers: [{ from: '0', to: '1.2', uscs: 'CL', desc: 'CLAY, brown' }] }], // no waterDepth key
        dcps: [], samples: [], photos: [], plans: [], attachments: [],
        source: null,
      };
    });
    await page.evaluate((rep) => {
      const blob = new Blob([JSON.stringify(rep)], { type: 'application/json' });
      const file = new File([blob], 'old-report.json', { type: 'application/json' });
      const dt = new DataTransfer();
      dt.items.add(file);
      document.getElementById('importfile').files = dt.files;
      document.getElementById('importfile').dispatchEvent(new Event('change', { bubbles: true }));
    }, oldReport);
    await page.waitForTimeout(300);
    await page.click('button[data-open]');
    await page.waitForSelector('#view-editor:not([hidden])');

    await gotoTab(page, 'Fieldwork');
    await expect(page.locator('input[data-bh="0"][data-f="waterDepth"]')).toHaveValue('');

    const html = await openPreview(page);
    expect(html).toContain('E = encountered');
    expect(html).not.toContain('E = encountered @');
  });
});
