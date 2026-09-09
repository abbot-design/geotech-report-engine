// tests/pageview.spec.js
//
// Paginated preview. Dev-only, never referenced by index.html or sw.js.
//
// The behaviour worth guarding is not "it makes pages" but the two ways it
// can be quietly wrong:
//
//   1. Laying out against a hidden container. Every height measures 0, so
//      nothing overflows and the report collapses onto a handful of pages
//      broken only where a .pagebreak falls. The result looks plausible,
//      which is what makes it dangerous.
//   2. Touching the issued document. Print always prints #rpt; if page view
//      ever emptied or replaced it, an engineer in page view would save a
//      broken PDF.
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
async function openPreview(page) {
  await gotoTab(page, 'Review & issue');
  await page.click('#nextbtn');
  await page.waitForSelector('#view-preview:not([hidden])');
}

test.describe('paginated preview', () => {
  test('it starts in continuous view and remembers the choice', async ({ page }) => {
    await newReport(page, 'classification');
    await openPreview(page);
    await expect(page.locator('#pageview')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.rptpage')).toHaveCount(0);

    await page.click('#pageview');
    await expect(page.locator('#pageview')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('.rptpage').count()).toBeGreaterThan(1);

    // The preference survives a reload, on the same device.
    await page.reload();
    await page.click('button[data-open]');
    await openPreview(page);
    await expect(page.locator('#pageview')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('.rptpage').count()).toBeGreaterThan(1);
  });

  test('no page overflows its own body', async ({ page }) => {
    await newReport(page, 'classification');
    await openPreview(page);
    await page.click('#pageview');
    await page.waitForSelector('.rptpage');

    const bad = await page.$$eval('.rptpage', els => els.filter(p => {
      const b = p.querySelector('.rptpagebody');
      // A page allowed to grow holds one block too tall to fit anywhere, and
      // the cover's photo band is positioned past the body's box on purpose.
      return !p.classList.contains('grow') && !p.classList.contains('coverpage')
             && b.scrollHeight > b.clientHeight + 1;
    }).length);
    expect(bad, 'content spilling past the sheet edge would be hidden by overflow:hidden').toBe(0);
  });

  test('pagination is measured on screen, not against a hidden section', async ({ page }) => {
    // Regression: renderPages() used to run from buildReport() while
    // #view-preview was still hidden, so clientHeight was 0, over() was never
    // true, and the whole report packed onto the few explicit .pagebreaks.
    await newReport(page, 'classification');
    await openPreview(page);
    await page.click('#pageview');
    await page.waitForSelector('.rptpage');

    const heights = await page.$$eval('.rptpage',
      els => els.map(p => Math.round(p.getBoundingClientRect().height)));
    // 297mm at 96dpi. Every page is a real sheet, not a collapsed one.
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(1000);

    const explicitBreaks = await page.$$eval('#rpt > *',
      els => els.filter(e => e.classList.contains('pagebreak')
                          || e.style.breakBefore === 'page').length);
    expect(heights.length,
      'more pages than there are hard breaks means real overflow was measured')
      .toBeGreaterThan(explicitBreaks + 1);
  });

  test('page view never touches what gets printed', async ({ page }) => {
    await newReport(page, 'classification');
    await openPreview(page);
    const before = await page.$eval('#rpt', el => el.children.length);

    await page.click('#pageview');
    await page.waitForSelector('.rptpage');

    const after = await page.$eval('#rpt', el => el.children.length);
    expect(after, '#rpt is what Print / Save as PDF renders').toBe(before);
    expect(after).toBeGreaterThan(0);

    // and the print stylesheet hides the paginated copy
    const hidden = await page.evaluate(() => {
      const css = [...document.styleSheets[0].cssRules].map(r => r.cssText).join('\n');
      return /@media print[\s\S]*?#rptpages\s*\{\s*display:\s*none/.test(css);
    });
    expect(hidden, 'otherwise the PDF would contain both renderings').toBe(true);
  });

  test('the title page, contents and references each get a page of their own',
    async ({ page }) => {
      await newReport(page, 'classification');
      await openPreview(page);
      await page.click('#pageview');
      await page.waitForSelector('.rptpage');

      const firstOf = await page.$$eval('.rptpage', els => els.map(p => {
        const b = p.querySelector('.rptpagebody');
        return (b.textContent || '').trim().slice(0, 30);
      }));

      // The cover owns page 1 and nothing else follows it onto that sheet.
      // Assert the cover element, not its wordmark: the firm name is artwork,
      // so it is not in the text content.
      const coverOnPageOne = await page.$$eval('.rptpage',
        els => !!els[0].querySelector('.rpt-cover') &&
               els.slice(1).every(p => !p.querySelector('.rpt-cover')));
      expect(coverOnPageOne).toBe(true);
      const coverTitle = await page.$eval('.rptpage .rpt-cover h1', el => el.textContent.trim());
      expect(coverTitle).toBe('Geotechnical Assessment');
      // Contents starts page 2 and ends it.
      expect(firstOf[1]).toContain('Contents');
      expect(firstOf[2], 'Contents must not share its page').not.toContain('Contents');
      // References starts a page of its own.
      const refPage = firstOf.findIndex(t => /References/.test(t));
      expect(refPage, 'References should begin a sheet, not run on').toBeGreaterThan(0);
    });

  test('the breaks are declared in the document, not only in the preview',
    async ({ page }) => {
      // The paginated view is a simulation; these classes are what the real
      // print engine acts on, so they have to be on the report itself.
      await newReport(page, 'classification');
      await openPreview(page);
      const marks = await page.evaluate(() => ({
        contents: !!document.querySelector('#rpt .toc.breakafter'),
        references: [...document.querySelectorAll('#rpt h2')]
          .some(h => /References/.test(h.textContent) && h.classList.contains('pagebreak')),
        cover: !!document.querySelector('#rpt .rpt-cover')
      }));
      expect(marks.contents).toBe(true);
      expect(marks.references).toBe(true);
      expect(marks.cover).toBe(true);
    });

  test('the footer runs at the foot of every page instead of flowing', async ({ page }) => {
    // It used to be an ordinary block at the end of the column, so when the
    // preceding page filled up it was stranded alone at the top of a final
    // sheet.
    await newReport(page, 'classification');
    await openPreview(page);
    await page.click('#pageview');
    await page.waitForSelector('.rptpage');

    const pages = await page.locator('.rptpage').count();
    await expect(page.locator('.rptpage > .rptfoot')).toHaveCount(pages);

    const inFlow = await page.$$eval('.rptpagebody > .rptfoot', els => els.length);
    expect(inFlow, 'a running footer must not consume content space').toBe(0);

    const lastHasContent = await page.$$eval('.rptpage',
      els => els[els.length - 1].querySelector('.rptpagebody').children.length);
    expect(lastHasContent, 'the last sheet should carry report content').toBeGreaterThan(0);
  });

  test('the footer carries the firm and the job, not the street address', async ({ page }) => {
    await newReport(page, 'classification');
    await openPreview(page);
    const text = await page.$eval('#rpt .rptfoot', el => el.textContent);
    expect(text).toContain('ABBOT DESIGN');
    expect(text).toContain('ABN');
    expect(text).toContain('Job');
    expect(text, 'the street address is on the cover, it does not belong on every page')
      .not.toContain('Palmer Street');
  });

  test('the preview page height matches the printed page box', async ({ page }) => {
    // If these drift, the preview paginates against a page size the PDF does
    // not use and every break after the first is wrong.
    await newReport(page, 'classification');
    await openPreview(page);
    await page.click('#pageview');
    await page.waitForSelector('.rptpage');

    const geom = await page.evaluate(() => {
      const css = [...document.styleSheets[0].cssRules].map(r => r.cssText).join('\n');
      const at = css.match(/@page\s*\{[^}]*margin:\s*([\d.]+)mm\s+([\d.]+)mm\s+([\d.]+)mm/);
      const bodyPx = document.querySelector('.rptpagebody').clientHeight;
      return { top: +at[1], bottom: +at[3], bodyMm: Math.round(bodyPx / (96 / 25.4)) };
    });
    expect(geom.bodyMm).toBe(297 - geom.top - geom.bottom);
  });

  // Typography targets taken from the report this one is benchmarked against
  // (AscentGeo, measured from the PDF): 11pt body, 1.36 leading, 160mm measure.
  // These are deliberate values, not defaults, so they are pinned.
  test('body typography matches the benchmarked report', async ({ page }) => {
    await newReport(page, 'classification');
    await openPreview(page);
    await page.click('#pageview');
    await page.waitForSelector('.rptpage');

    const t = await page.evaluate(() => {
      const p = [...document.querySelectorAll('.rptpagebody p')]
        .filter(x => !x.closest('.rpt-cover'))[0];
      const cs = getComputedStyle(p);
      return {
        pt: +(parseFloat(cs.fontSize) * 0.75).toFixed(2),   // 1in=96px, 1pt=1/72in
        leading: +(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2),
        measureMm: Math.round(document.querySelector('.rptpagebody').clientWidth / (96 / 25.4)),
        align: cs.textAlign
      };
    });
    // Exactly the benchmark's size. Carlito is metric-compatible with the
    // Calibri it is set in, so at the same nominal size the two documents are
    // directly comparable. 12pt would be larger than the benchmark, not
    // "professional standard".
    expect(t.pt).toBe(11);
    expect(t.leading).toBe(1.4);
    expect(t.measureMm, '210mm less 25mm margins').toBe(160);
    // Measured: justifying in a browser gives 2.44x word-space stretch against
    // the benchmark's 1.19x, because browsers break lines greedily.
    expect(t.align, 'body copy stays ragged right').not.toBe('justify');
  });

  test('the cover carries the logo artwork and the standard title', async ({ page }) => {
    await newReport(page, 'classification');
    await openPreview(page);

    const cover = await page.evaluate(() => {
      const c = document.querySelector('#rpt .rpt-cover');
      const logo = c.querySelector('img.logo');
      const proj = [...c.querySelectorAll('.proj')][0];
      const groups = [...c.querySelectorAll('.cgroup')];
      return {
        logoSrc: logo && logo.getAttribute('src'),
        logoAlt: logo && logo.getAttribute('alt'),
        title: c.querySelector('h1').textContent.trim(),
        projLabel: proj.querySelector('b') && proj.querySelector('b').textContent.trim(),
        projBoldIsLabelOnly: proj.querySelector('b').textContent.trim() === 'Project:',
        groupLabels: groups.map(g => g.querySelector('.chead').textContent.trim()),
        // each label is centred on the page, its lines start at its own left edge
        labelsCentred: groups.every(g => {
          const pg = document.querySelector('.rptpage') || document.getElementById('rpt');
          const h = g.querySelector('.chead').getBoundingClientRect();
          const p = pg.getBoundingClientRect();
          return Math.abs((h.left + h.right) / 2 - (p.left + p.right) / 2) < 2;
        }),
        valuesAlignToLabel: groups.every(g =>
          Math.abs(g.querySelector('.cvals').getBoundingClientRect().left
                 - g.querySelector('.chead').getBoundingClientRect().left) < 2)
      };
    });
    expect(cover.logoSrc).toBe('assets/abbot-logo.svg');
    expect(cover.logoAlt, 'the firm name is artwork, so it needs a text alternative')
      .toBeTruthy();
    // A fixed title, not the report type: the type still appears in the
    // Overview sentence, which is where it reads naturally.
    expect(cover.title).toBe('Geotechnical Assessment');
    expect(cover.projLabel).toBe('Project:');
    expect(cover.projBoldIsLabelOnly, 'the label is bold, the value is not').toBe(true);
    expect(cover.groupLabels).toEqual(['Prepared for:', 'Job No:']);
    expect(cover.labelsCentred, 'the labels are centred on the page').toBe(true);
    expect(cover.valuesAlignToLabel,
      'their lines are left aligned to their own label, not to the page').toBe(true);
  });

  test('the cover text clears the photo band', async ({ page }) => {
    // The band's arc is deepest at the centre of the page, which is where the
    // detail block sits, so that is the edge the text has to clear.
    //
    // Fill the cover first: on a blank report the labels have no values, the
    // block is shorter, and the test passes while a real cover overlaps.
    await newReport(page, 'classification');
    await gotoTab(page, 'Setup');
    await page.fill('#f_jobNo', 'AD-2026-014');
    await gotoTab(page, 'Client & site ID');
    await page.fill('#f_client', 'ABC Corp');
    await page.fill('#f_projectDesc', 'New single storey dwelling and detached garage');
    await page.fill('#f_street', '123 ABC Street');
    await page.fill('#f_suburb', 'Newcastle');
    await page.fill('#f_postcode', '2300');
    await page.fill('#f_lotDp', 'Lot 12 DP 12345');
    await openPreview(page);
    await page.click('#pageview');
    await page.waitForSelector('.rptpage');
    await page.evaluate(() => document.fonts.ready);

    const g = await page.evaluate(() => {
      const mm = px => +(px / (96 / 25.4)).toFixed(1);
      const pg = document.querySelector('.rptpage');
      const r = e => e.getBoundingClientRect();
      const ph = pg.querySelector('.rpt-cover .coverphoto');
      // the lowest text on the cover, whichever block it belongs to
      const lowest = [...pg.querySelectorAll('.rpt-cover .coverblock, .rpt-cover .cgroup')]
        .reduce((m, e) => Math.max(m, r(e).bottom), 0);
      const SAG = 17.2;                       // measured from the reference artwork
      return { textBottom: mm(lowest - r(pg).top),
               bandTopAtCentre: mm(r(ph).top - r(pg).top) + SAG };
    });
    expect(g.textBottom, 'the job block must not sit over the photo')
      .toBeLessThan(g.bandTopAtCentre);
  });

  test('the cover rules run to the paper edge and the detail block is left aligned',
    async ({ page }) => {
      await newReport(page, 'classification');
      await openPreview(page);
      await page.click('#pageview');
      await page.waitForSelector('.rptpage');
      await page.evaluate(() => document.fonts.ready);

      const geom = await page.evaluate(() => {
        const pg = document.querySelector('.rptpage');
        const cov = pg.querySelector('.rpt-cover');
        const h1 = cov.querySelector('h1');
        const blk = cov.querySelector('.coverblock');
        const rg = document.createRange(); rg.selectNodeContents(h1);
        const r = e => e.getBoundingClientRect();
        return {
          bleedLeft: +(r(cov).left - r(pg).left).toFixed(1),
          bleedRight: +(r(pg).right - r(cov).right).toFixed(1),
          // the detail block starts where the centred title's text starts
          offset: +(r(blk).left - rg.getBoundingClientRect().left).toFixed(1),
          // the firm's contact details are on the running footer, not repeated
          // in a block of their own on the cover
          noContactStrip: !cov.querySelector('.contactstrip')
        };
      });
      // A clip on .rptpagebody used to cut the bleed back to the text measure.
      expect(Math.abs(geom.bleedLeft), 'the rules must reach the paper edge').toBeLessThan(1.5);
      expect(Math.abs(geom.bleedRight)).toBeLessThan(1.5);
      expect(Math.abs(geom.offset), 'detail block aligns under the title').toBeLessThan(1.5);
      expect(geom.noContactStrip).toBe(true);
    });

  test('the cover photo band bleeds and stops above the sky rule', async ({ page }) => {
    await newReport(page, 'classification');
    await openPreview(page);
    await page.click('#pageview');
    await page.waitForSelector('.rptpage');

    const g = await page.evaluate(() => {
      const mm = px => +(px / (96 / 25.4)).toFixed(1);
      const pg = document.querySelector('.rptpage');
      const ph = pg.querySelector('.rpt-cover .coverphoto');
      const ft = pg.querySelector('.rptfoot');
      const r = e => e.getBoundingClientRect();
      return {
        bleedL: mm(r(ph).left - r(pg).left),
        bleedR: mm(r(pg).right - r(ph).right),
        gapToRule: mm(r(ft).top - r(ph).bottom),
        hasCurve: !!ph.querySelector('.curve'),
        decorative: ph.getAttribute('aria-hidden'),
        pageIsFixedHeight: !pg.classList.contains('grow')
      };
    });
    expect(Math.abs(g.bleedL), 'the band runs to the paper edge').toBeLessThan(1.5);
    expect(Math.abs(g.bleedR)).toBeLessThan(1.5);
    // It tucks a hair behind the rule rather than leaving a white sliver, so a
    // small negative gap is intended; a large one would mean it overshot.
    expect(g.gapToRule, 'no white is wasted between photo and rule').toBeGreaterThan(-3);
    expect(g.gapToRule, 'and it does not run past the rule').toBeLessThan(2);
    expect(g.hasCurve, 'the curved top edge is drawn in CSS, not baked into the file').toBe(true);
    expect(g.decorative, 'it carries no information, so screen readers skip it').toBe('true');
    expect(g.pageIsFixedHeight,
      'the band overflows the body deliberately; the sheet must stay A4').toBe(true);
  });

  test('the head and foot rules are the same distance from the page edges',
    async ({ page }) => {
      await newReport(page, 'classification');
      await openPreview(page);
      await page.click('#pageview');
      await page.waitForSelector('.rptpage');
      await page.evaluate(() => document.fonts.ready);

      const g = await page.evaluate(() => {
        const mm = px => +(px / (96 / 25.4)).toFixed(1);
        const pg = document.querySelector('.rptpage');
        const cov = pg.querySelector('.rpt-cover');
        const ft = pg.querySelector('.rptfoot');
        const r = e => e.getBoundingClientRect();
        return {
          navyFromTop: mm(r(cov).top - r(pg).top),
          skyFromBottom: mm(r(pg).bottom - r(ft).top),
          skyIsFooterRule: getComputedStyle(ft).borderTopWidth,
          footerBleedL: mm(r(ft).left - r(pg).left),
          footerBleedR: mm(r(pg).right - r(ft).right)
        };
      });
      expect(Math.abs(g.navyFromTop - g.skyFromBottom),
        'the sky rule sits as far from the foot as the navy rule is from the head')
        .toBeLessThan(0.5);
      expect(g.skyIsFooterRule).toBe('6px');
      expect(Math.abs(g.footerBleedL), 'the footer rule bleeds too').toBeLessThan(1.5);
      expect(Math.abs(g.footerBleedR)).toBeLessThan(1.5);
    });

  test('body copy, lists and the contents are all set at the same size', async ({ page }) => {
    // Bullet lists had no rule and inherited 1rem, so the References list and
    // the hold points set 12pt against 11pt prose.
    await newReport(page, 'classification');
    await openPreview(page);
    await page.evaluate(() => document.fonts.ready);

    const pt = await page.evaluate(() => {
      const size = el => el ? +(parseFloat(getComputedStyle(el).fontSize) * 0.75).toFixed(2) : null;
      const notCover = s => [...document.querySelectorAll(s)].filter(e => !e.closest('.rpt-cover'))[0];
      return {
        para: size(notCover('#rpt > p')),
        li: size([...document.querySelectorAll('#rpt li')].filter(e => !e.closest('.toc'))[0]),
        toc: size(document.querySelector('#rpt .toc li')),
        kv: size(document.querySelector('#rpt .kv > div'))
      };
    });
    expect(pt.li, 'lists must not out-set the prose around them').toBe(pt.para);
    expect(pt.toc).toBe(pt.para);
    expect(pt.kv).toBe(pt.para);
  });

  test('section headings are plain bold with a hanging number', async ({ page }) => {
    await newReport(page, 'classification');
    await openPreview(page);

    const h = await page.evaluate(() => {
      const el = document.querySelector('#rpt h2.numbered');
      const cs = getComputedStyle(el);
      return {
        text: el.textContent.trim(),
        borderLeft: parseFloat(cs.borderLeftWidth),
        background: cs.backgroundImage,
        numberInOwnColumn: !!el.querySelector('.secno')
      };
    });
    expect(h.numberInOwnColumn).toBe(true);
    expect(h.text, 'the number must not run into the title for a screen reader')
      .toMatch(/^\d+ \S/);
    expect(h.borderLeft, 'the coloured bar read as a web component').toBe(0);
    expect(h.background, 'as did the gradient wash').toBe('none');
  });

  test('every page carries the draft stamp until the report is issued', async ({ page }) => {
    await newReport(page, 'classification');
    await openPreview(page);
    await page.click('#pageview');
    await page.waitForSelector('.rptpage');
    const pages = await page.locator('.rptpage').count();
    await expect(page.locator('.rptpage .wm')).toHaveCount(pages);
  });
});
