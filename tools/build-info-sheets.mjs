#!/usr/bin/env node
/* ============================================================
   Rasterise the Appendix D information sheets and keep the
   offline shell in step with them.

     node tools/build-info-sheets.mjs           rebuild
     node tools/build-info-sheets.mjs --check   verify only, exit 1 on drift

   This is a MAINTENANCE tool, not a build step. It runs only when a
   sheet is added, removed or replaced, and its output is committed.
   The app itself still has no build step and no dependencies.

   Why rasterise at all: the engine's PDF is the browser print engine,
   which cannot merge a PDF into its output. Appendix A already solves
   this for site plans by rendering PDF pages to images, so Appendix D
   uses the same mechanism. Doing it here rather than in the browser
   keeps it working with zero signal, which is the normal condition on
   site - the runtime pdf.js loader in index.html is a CDN fetch and
   would fail there.

   Needs poppler's pdftoppm:  brew install poppler
   ============================================================ */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = path.join(ROOT, "info-sheets", "pages");
const SW = path.join(ROOT, "sw.js");
const CHECK = process.argv.includes("--check");

/* 130 dpi renders A4 at 1075 px wide. Above this the file size climbs
   fast on the colour pages for no visible gain at A4 print size, and
   every kilobyte here is downloaded by every tablet that installs the
   app. Comparable to the 1400 px / q0.72 the app already uses for
   photos and site plans. */
const DPI = 130, QUALITY = 72;

const { sheets, pagePaths } = createRequire(import.meta.url)("../info-sheets/manifest.js");

const problems = [];
const fail = m => { problems.push(m); };

function have(cmd) {
  try { execFileSync("which", [cmd], { stdio: "ignore" }); return true; } catch { return false; }
}

function rasterise(sheet) {
  const pdf = path.join(ROOT, sheet.file);
  if (!fs.existsSync(pdf)) return fail(`${sheet.id}: missing source PDF at ${sheet.file}`);

  const want = pagePaths(sheet);

  if (CHECK) {
    const missing = want.filter(p => !fs.existsSync(path.join(ROOT, p)));
    if (missing.length) fail(`${sheet.id}: ${missing.length} page image(s) not generated. Run without --check.`);
    return want;
  }

  /* Render to a temp prefix first. pdftoppm numbers pages without
     zero padding below 10 files, so the names are normalised after. */
  const tmp = fs.mkdtempSync(path.join(ROOT, ".info-sheets-tmp-"));
  try {
    execFileSync("pdftoppm", ["-jpeg", "-r", String(DPI), "-jpegopt", `quality=${QUALITY}`,
                              pdf, path.join(tmp, "p")], { stdio: "pipe" });

    const made = fs.readdirSync(tmp).filter(f => f.endsWith(".jpg"))
      .sort((a, b) => (+a.match(/(\d+)\.jpg$/)[1]) - (+b.match(/(\d+)\.jpg$/)[1]));

    if (made.length !== sheet.pageCount) {
      return fail(`${sheet.id}: manifest says pageCount ${sheet.pageCount}, the PDF has ${made.length}. `
                + `Fix pageCount in info-sheets/manifest.js.`);
    }

    fs.mkdirSync(PAGES, { recursive: true });
    made.forEach((f, i) => fs.renameSync(path.join(tmp, f), path.join(ROOT, want[i])));

    const kb = want.reduce((n, p) => n + fs.statSync(path.join(ROOT, p)).size, 0) / 1024;
    console.log(`  ${sheet.id}: ${made.length} page(s), ${Math.round(kb)} KB`);
    return want;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* The service worker's cache.addAll() rejects on a single 404, which
   rejects the install handler, which means no offline cache at all -
   the one thing the app exists to do. So the shell list is generated
   from the manifest rather than hand-edited.

   Existing entries are preserved and only the info-sheets/pages ones
   are replaced, so the tool never needs its own copy of the app shell
   and running it twice changes nothing. The array is rewritten as a
   plain single-line JSON literal because tests/ux-round.spec.js parses
   it with JSON.parse - no comments or trailing commas may go inside. */
function syncServiceWorker(generated) {
  const before = fs.readFileSync(SW, "utf8");
  const m = before.match(/const SHELL = (\[[^\]]*\]);/);
  if (!m) return fail("sw.js: could not find the SHELL array literal.");

  const kept = JSON.parse(m[1].replace(/'/g, '"')).filter(u => !u.startsWith("./info-sheets/pages/"));
  const wanted = kept.concat(generated.map(p => `./${p}`));

  let after = before.replace(m[0], `const SHELL = ${JSON.stringify(wanted)};`);

  /* Bump the cache version, or installed apps keep serving the old
     shell and never fetch the new pages. */
  if (after !== before) {
    after = after.replace(/const CACHE = "abbot-engine-v(\d+)";/,
      (_, n) => `const CACHE = "abbot-engine-v${+n + 1}";`);
  }

  if (after === before) { console.log("  sw.js already in step"); return; }
  if (CHECK) return fail("sw.js shell list is out of step with the manifest. Run without --check.");

  fs.writeFileSync(SW, after);
  console.log(`  sw.js: ${wanted.length} shell entries, cache bumped to `
            + after.match(/abbot-engine-v\d+/)[0]);
}

/* A renamed or removed sheet leaves page images behind. They would sit
   in the repo unreferenced and, worse, could be re-added to the shell
   by a later hand edit. */
function pruneOrphans(generated) {
  if (!fs.existsSync(PAGES)) return;
  const keep = new Set(generated.map(p => path.basename(p)));
  for (const f of fs.readdirSync(PAGES)) {
    if (f.endsWith(".jpg") && !keep.has(f)) {
      if (CHECK) { fail(`orphan page image: info-sheets/pages/${f}`); continue; }
      fs.unlinkSync(path.join(PAGES, f));
      console.log(`  removed orphan info-sheets/pages/${f}`);
    }
  }
}

console.log(CHECK ? "Checking information sheets..." : "Building information sheets...");

if (!CHECK && !have("pdftoppm")) {
  console.error("\npdftoppm not found. It comes with poppler:\n\n  brew install poppler\n");
  process.exit(1);
}

const generated = [];
for (const s of sheets) {
  const pages = rasterise(s);
  if (pages) generated.push(...pages);
}
pruneOrphans(generated);
syncServiceWorker(generated);

if (problems.length) {
  console.error("\n" + problems.map(p => `  ! ${p}`).join("\n") + "\n");
  process.exit(1);
}
console.log(`Done. ${sheets.length} sheet(s), ${generated.length} page(s).`);
