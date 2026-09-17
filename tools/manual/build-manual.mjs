// tools/manual/build-manual.mjs
//
// Renders tools/manual/engine-manual.html to ../../engine-manual.pdf using
// the Chromium that the tests already install. The manual is written in
// the app's own face (Carlito) so it matches the reports it describes.
//
//   node tools/manual/build-manual.mjs
//
// It must stay one page: the script refuses to write a PDF that runs over.
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
// Playwright is a dev dependency of tests/, not of the repo root.
const { chromium } = createRequire(path.join(here, '..', '..', 'tests', 'package.json'))('@playwright/test');
const src = path.join(here, 'engine-manual.html');
const out = path.join(here, '..', '..', 'engine-manual.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + src);
await page.evaluate(() => document.fonts.ready);
const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();

const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
if (pages !== 1) {
  fs.writeFileSync(out + '.overflow.pdf', pdf);
  console.error(`manual runs to ${pages} pages; trim it (see engine-manual.pdf.overflow.pdf)`); process.exit(1);
}
fs.writeFileSync(out, pdf);
console.log(`wrote ${path.relative(process.cwd(), out)} (${pdf.length} bytes, 1 page)`);
