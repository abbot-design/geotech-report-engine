// tests/accessibility/assistive-tech.spec.js
//
// What a screen reader gets that a sighted user does not, and vice versa.
// Text meant only for assistive tech must be clipped out of the layout, not
// hidden from the accessibility tree; a count that changes as the engineer
// types must be announced without stealing focus.
const { test, expect } = require('@playwright/test');
const { newReport, gotoTab } = require('../helpers');

test.describe('screen-reader-only text', () => {
  test('sr-only text is present for assistive tech but not visible', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Boreholes');
    await page.click('#addbh');
    await page.click('[data-startlayer="0:0"]');

    const srSpan = page.locator('[data-dellayer="0:0"] .sr-only');
    await expect(srSpan).toHaveCount(1);
    const box = await srSpan.boundingBox();
    expect(box.width, 'sr-only text must be clipped, not laid out').toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(1);
    // the button must read as just the glyph at normal size
    const btnBox = await page.locator('[data-dellayer="0:0"]').boundingBox();
    expect(btnBox.width).toBeLessThan(120);
  });

  test('photo caption labels do not render as visible text', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Photos');
    // inject a photo directly — no camera in headless
    await page.evaluate(() => {
      report().photos.push({ caption: '', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' });
      saveDb(); renderEditor();
    });
    const lbl = page.locator('#photogrid label.sr-only');
    await expect(lbl).toHaveCount(1);
    const box = await lbl.boundingBox();
    expect(box.width, 'the caption label must not be laid out as visible text').toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(1);
  });
});

test.describe('live regions', () => {
  test('the section count is announced as a status, not left silent', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await expect(page.locator('#stratalabel')).toHaveAttribute('role', 'status');
  });
});
