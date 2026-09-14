// tests/helpers.js
//
// The handful of user actions every spec starts from. Each one stands for
// something an engineer does with the mouse, named for the action rather
// than the selector, so a spec reads as a sequence of steps and a selector
// change is fixed here once instead of in every file.

// Home screen: click the tile for a report type and wait for the editor.
// `type` is the data-newtype on the tile: 'desktop', 'classification',
// 'comprehensive'.
async function newReport(page, type) {
  await page.goto('/index.html');
  await page.click(`button[data-newtype="${type}"]`);
  await page.waitForSelector('#view-editor:not([hidden])');
}

// Editor: click a tab on the left-hand rail by its visible label,
// e.g. 'Setup', 'Fieldwork', 'Review & issue'.
async function gotoTab(page, label) {
  await page.click(`#tabrail button:text-is("${label}")`);
}

// Editor -> preview: go to the last tab, press "Preview report", and wait
// for the preview to show. Returns the generated report HTML (#rpt), which
// is what most specs assert on - the document the engineer will issue, not
// the form state that produced it.
async function openPreview(page) {
  await gotoTab(page, 'Review & issue');
  await page.click('#nextbtn');
  await page.waitForSelector('#view-preview:not([hidden])');
  return page.$eval('#rpt', el => el.innerHTML);
}

module.exports = { newReport, gotoTab, openPreview };
