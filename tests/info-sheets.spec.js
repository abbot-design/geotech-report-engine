// tests/info-sheets.spec.js
//
// Appendix D information sheets. Same rules as the other specs: dev-only,
// never referenced by index.html or sw.js, so it is never downloaded by
// anyone using the live app.
//
// What this file is actually guarding:
//
//   1. The offline shell. cache.addAll() rejects on a single 404, which
//      rejects the install handler, which means no offline cache at all.
//      Page images are generated, so the manifest and sw.js can drift apart
//      in a way no human review reliably catches.
//   2. The one-entry rule. A sheet is appended, cited in References and
//      named under Further guidance from a single manifest entry, so the
//      report can never cite a document it does not contain, or contain one
//      it does not cite. That invariant is easy to break by adding a
//      citation back into buildReport() by hand.
//
// Run with:
//   cd tests && npm install && npx playwright install chromium && npm test
//
const { test, expect } = require('@playwright/test');

async function newReport(page, type) {
  await page.goto('/index.html');
  await page.click(`button[data-newtype="${type}"]`);
  await page.waitForSelector('#view-editor:not([hidden])');
}
async function gotoTab(page, label) {
  await page.click(`#tabrail button:text-is("${label}")`);
}

/* Read the manifest the same way the app does, out of the running page. */
async function manifest(page) {
  return page.evaluate(() => INFO_SHEETS.sheets.map(s => ({
    id: s.id, file: s.file, pageCount: s.pageCount, title: s.title,
    citation: s.citation, furtherInfo: s.furtherInfo,
    pages: INFO_SHEETS.pagePaths(s)
  })));
}

async function previewHtml(page) {
  await gotoTab(page, 'Review & issue');
  await page.click('#nextbtn'); // "Preview report →" on the last tab
  await page.waitForSelector('#view-preview:not([hidden])');
  return page.$eval('#rpt', el => el.innerHTML);
}

/* ------------------------------------------------------------------ *
 * The files themselves                                                *
 * ------------------------------------------------------------------ */
test.describe('information sheet assets', () => {
  test('every file the manifest names actually exists', async ({ page, request }) => {
    await page.goto('/index.html');
    const sheets = await manifest(page);
    expect(sheets.length, 'at least one sheet should be installed').toBeGreaterThan(0);

    for (const s of sheets) {
      const pdf = await request.get('/' + s.file);
      expect(pdf.status(), `${s.file} is the source of truth and the View original link`).toBe(200);

      expect(s.pages.length, `${s.id}: pageCount drives the page paths`).toBe(s.pageCount);
      for (const p of s.pages) {
        const res = await request.get('/' + p);
        expect(res.status(), `${p} must not 404 — it is in the service worker shell`).toBe(200);
      }
    }
  });

  test('every page image is in the service worker shell, and the PDF deliberately is not',
    async ({ page, request }) => {
      await page.goto('/index.html');
      const sheets = await manifest(page);
      const sw = await (await request.get('/sw.js')).text();
      const shell = JSON.parse(sw.match(/const SHELL = (\[[^\]]*\])/)[1].replace(/'/g, '"'));

      expect(shell, 'the registry itself must be cached or the app cannot read it offline')
        .toContain('./info-sheets/manifest.js');

      for (const s of sheets) {
        for (const p of s.pages) {
          expect(shell, `${p} must be cached — Appendix D has to build with zero signal`)
            .toContain('./' + p);
        }
        // Roughly a megabyte per sheet that every tablet would download for a
        // link it can only follow when it already has signal. Deliberate.
        expect(shell, `${s.file} should stay out of the shell; it is not needed offline`)
          .not.toContain('./' + s.file);
      }
    });

  test('no orphan page images are left in the repo', async ({ page, request }) => {
    await page.goto('/index.html');
    const sheets = await manifest(page);
    const wanted = new Set(sheets.flatMap(s => s.pages));
    const sw = await (await request.get('/sw.js')).text();
    const shell = JSON.parse(sw.match(/const SHELL = (\[[^\]]*\])/)[1].replace(/'/g, '"'));

    for (const url of shell.filter(u => u.startsWith('./info-sheets/pages/'))) {
      expect(wanted, `${url} is cached but no manifest entry claims it`)
        .toContain(url.replace(/^\.\//, ''));
    }
  });
});

/* ------------------------------------------------------------------ *
 * Defaults                                                            *
 * ------------------------------------------------------------------ */
test.describe('which sheets arrive ticked', () => {
  for (const [type, expected] of [['desktop', false], ['classification', true], ['comprehensive', true]]) {
    test(`CSIRO sheet default for a ${type} report is ${expected}`, async ({ page }) => {
      await newReport(page, type);
      const on = await page.evaluate(() =>
        includedSheets(report()).map(s => s.id));
      expect(on.includes('csiro-foundation-maintenance'),
        'a desktop assessment involves no site testing, so there is nothing to maintain against')
        .toBe(expected);
    });
  }

  test('a sheet added to the manifest later reaches a report already in progress', async ({ page }) => {
    await newReport(page, 'classification');
    // A report saved before the sheet existed has no override recorded for it.
    // Storing the resulting list instead of the overrides would freeze this
    // report against the manifest of the day it was created.
    const on = await page.evaluate(() => {
      const r = report();
      r.d.infoDocs = {};
      INFO.sheets.push({ id: 'later', short: 'Later', title: 'Added Later',
        citation: 'Later citation.', furtherInfo: '', file: 'x.pdf', pageCount: 1,
        edition: '2026', defaultOn: () => true });
      const ids = includedSheets(r).map(s => s.id);
      INFO.sheets.pop();
      return ids;
    });
    expect(on).toContain('later');
  });

  test('an engineer can tick on a sheet that is off by default', async ({ page }) => {
    await newReport(page, 'desktop');
    const on = await page.evaluate(() => {
      const r = report();
      r.d.infoDocs = { 'csiro-foundation-maintenance': true };
      return includedSheets(r).map(s => s.id);
    });
    expect(on, 'the override map has to work in both directions')
      .toContain('csiro-foundation-maintenance');
  });
});

/* ------------------------------------------------------------------ *
 * The one-entry rule                                                  *
 * ------------------------------------------------------------------ */
test.describe('a ticked sheet is appended, cited and named together', () => {
  test('ticked: pages, citation and further guidance all appear', async ({ page }) => {
    await newReport(page, 'classification');
    const sheets = await manifest(page);
    const s = sheets[0];
    const html = await previewHtml(page);

    for (const p of s.pages) {
      expect(html, `${p} should be reproduced in Appendix D`).toContain(p);
    }
    expect(html, 'the sheet must be cited in References').toContain(s.citation);
    expect(html, 'and named under Further guidance').toContain('Further guidance');
    expect(html).toContain('Appendix D');
  });

  test('unticked: pages, citation and further guidance all disappear together',
    async ({ page }) => {
      await newReport(page, 'classification');
      const sheets = await manifest(page);
      const s = sheets[0];

      await gotoTab(page, 'Review & issue');
      await page.uncheck(`input[data-sheet="${s.id}"]`);
      const html = await previewHtml(page);

      for (const p of s.pages) {
        expect(html, `${p} must not be appended once unticked`).not.toContain(p);
      }
      expect(html, 'a report must never cite a document it does not contain')
        .not.toContain(s.citation);
      expect(html, 'the Further guidance sentence goes with it')
        .not.toContain(s.furtherInfo.slice(0, 60));
    });

  test('the sheet is named once in References, not again above its pages', async ({ page }) => {
    // The sheet carries its own title on its first page, and it is cited in
    // References. A heading and a citation line above the pages as well put
    // the same title in the document three times.
    await newReport(page, 'classification');
    const sheets = await manifest(page);
    const s = sheets[0];
    const html = await previewHtml(page);

    expect(html, 'still cited').toContain(s.citation);
    expect((html.match(/Reproduced in full/g) || []).length,
      'the appendix should not restate the citation').toBe(0);
    const titleHits = (html.match(new RegExp(s.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    expect(titleHits, 'the title belongs in the References entry only').toBe(1);
    // and the pages are still there, still named for screen readers
    expect(html).toContain(s.pages[0]);
    expect(html).toContain('page 1 of ' + s.pageCount);
  });

  test('the citation lives only in the manifest, never hard-coded in the report builder',
    async ({ page, request }) => {
      await page.goto('/index.html');
      const sheets = await manifest(page);
      const app = await (await request.get('/index.html')).text();
      for (const s of sheets) {
        expect(app, `the citation for ${s.id} belongs in info-sheets/manifest.js only`)
          .not.toContain(s.citation);
      }
    });
});

/* ------------------------------------------------------------------ *
 * The appendix map                                                    *
 * ------------------------------------------------------------------ */
test.describe('the appendix map', () => {
  test('it lists A to D and marks the empty ones as not included', async ({ page }) => {
    await newReport(page, 'classification');
    await gotoTab(page, 'Review & issue');

    const letters = await page.$$eval('.approw .applet', els => els.map(e => e.textContent.trim()));
    expect(letters).toEqual(['A', 'B', 'C', 'D']);

    // Nothing has been uploaded, so A, B and C are empty and D has the notes.
    const empties = await page.$$eval('.approw.empty .applet', els => els.map(e => e.textContent.trim()));
    expect(empties).toEqual(['A', 'B', 'C']);
    await expect(page.locator('.approw:has(.applet:text-is("D")) .appcount'))
      .toContainText('1 sheet');
  });

  test('the map calls each appendix exactly what the report calls it', async ({ page }) => {
    // These used to be two sets of literals and had already drifted: the map
    // said "Bore logs and DCP results" while the report heading said
    // "Bore logs | DCP test results". Both now read APPENDIX_TITLES.
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Review & issue');

    const mapTitles = await page.$$eval('.approw',
      els => els.map(e => [e.querySelector('.applet').textContent.trim(),
                           e.querySelector('.apptitle').textContent.trim()]));
    const titles = await page.evaluate(() => APPENDIX_TITLES);

    for (const [letter, shown] of mapTitles) {
      expect(shown, `the map row for ${letter} must match the report heading`)
        .toBe(titles[letter]);
    }
    expect(titles.D).toBe('Information sheets and notes');
  });

  test('the appendix heading in the report matches the map', async ({ page }) => {
    await newReport(page, 'classification');
    const titles = await page.evaluate(() => APPENDIX_TITLES);
    const html = await previewHtml(page);
    // D is the only appendix with content on a report with nothing uploaded.
    expect(html).toContain(`Appendix D: ${titles.D}`);
  });

  test('an empty appendix says why and offers a way there', async ({ page }) => {
    await newReport(page, 'classification');
    await gotoTab(page, 'Review & issue');
    await page.click('.approw:has(.applet:text-is("B")) button[data-goto="photos"]');
    await expect(page.locator('#tabrail button[aria-current="step"]')).toHaveText('Photos');
  });

  test('the Appendix A jump lands on the tab that actually uploads site plans',
    async ({ page }) => {
      // It used to point at Setup, which has no upload control at all.
      await newReport(page, 'classification');
      await gotoTab(page, 'Review & issue');
      await page.click('.approw:has(.applet:text-is("A")) button[data-goto]');
      await expect(page.locator('#tabrail button[aria-current="step"]'))
        .toHaveText('Client & site ID');
      await expect(page.locator('#addplan'), 'the upload control has to be on the tab we sent them to')
        .toBeVisible();
    });

  test('site plans count towards the section that now holds them', async ({ page }) => {
    await newReport(page, 'classification');
    const touched = await page.evaluate(() => {
      const r = report();
      r.plans.push({ caption: 'test', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' });
      return { client: sectionTouched(r, 'client'), site: sectionTouched(r, 'site') };
    });
    expect(touched.client, 'plans live with the drawing fields on Client & site ID').toBe(true);
    expect(touched.site, 'Site description should not read as started because of them').toBe(false);
  });

  test('the D count follows the ticks', async ({ page }) => {
    await newReport(page, 'classification');
    await gotoTab(page, 'Review & issue');
    const count = page.locator('.approw:has(.applet:text-is("D")) .appcount');
    await expect(count).toContainText('1 sheet, 4 pages');

    await page.uncheck('input[data-sheet="csiro-foundation-maintenance"]');
    await expect(count, 'the notes stay, the sheet goes').toHaveText('3 notes');
  });

  test('turning everything off drops the Appendix D section', async ({ page }) => {
    await newReport(page, 'desktop');
    await gotoTab(page, 'Review & issue');
    await page.uncheck('input[data-bool="incGeneral"]');
    await previewHtml(page);

    const state = await page.evaluate(() => {
      const heads = [...document.querySelectorAll('#rpt h2')].map(h => h.textContent.trim());
      const row = [...document.querySelectorAll('#rpt .toc li')]
        .find(li => /Appendix D/.test(li.textContent));
      return {
        sectionRendered: heads.some(h => /^Appendix D:/.test(h)),
        tocRow: row && row.textContent.trim().replace(/\s+/g, ' '),
        tocRowEmpty: row && row.classList.contains('tempty')
      };
    });
    expect(state.sectionRendered, 'no contents means no appendix section').toBe(false);
    // The contents still lists it, marked absent: the A-D scheme is fixed, so
    // a reader is told what D would hold and that it holds nothing.
    expect(state.tocRowEmpty).toBe(true);
    expect(state.tocRow).toMatch(/None$/);
  });
});
