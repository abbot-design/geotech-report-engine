# Abbot Geotech Report Engine — V1 MVP

Offline-first PWA for capturing geotechnical field data and generating certifier-ready reports.
No framework, no build step, no paid services. One HTML file, a manifest and a service worker.

## Quick start (free hosting on GitHub Pages)

1. Open the published URL (live: https://abbot-design.github.io/geotech-report-engine/) on the engineer's phone/tablet:
   - **iOS Safari:** Share → *Add to Home Screen*.
   - **Android Chrome / desktop Chrome & Edge:** the install prompt appears, or menu → *Install app*.
2. The service worker caches the whole app on first load — after that it runs with **zero signal**,
   which is the normal condition on a rural NSW site.

> HTTPS is required for PWA install and the service worker; GitHub Pages provides it automatically.
> Opening `index.html` directly from disk still works as a plain web page (no offline install).

## What V1 does

- **Three report types** (Desktop Assessment / Site Classification + Wind / Comprehensive
  Investigation) sharing one data spine; switching type hides sections without deleting data.
- **Tab navigation + Next/Back** — jump anywhere, or walk the sections in field order.
- **Single-source data**: address, dates, job number, class are entered once and flow through the
  entire document (WCAG 2.2 “redundant entry”, and the fix for the internal-contradiction failures
  seen in competitor samples).
- **Dynamic field records**: boreholes with layered soil profiles, DCP tests, lab samples (LL/LS).
- **Photo capture** from the device camera, compressed on-device (~1400 px JPEG) into the report
  appendix with captions. Site imagery lives there, in Appendix B, rather than on the cover: the
  cover carries the brand photo, and a client looking for the site sees it with the rest of the
  photographic record.
- **Completeness engine**: required content per report type. The section tabs are the progress
  indicator — green when a section is complete, orange-dashed when started, plain when untouched —
  and a section only counts as complete once something has actually been entered in it. PDF is
  available at any time but carries a **DRAFT — NOT FOR CONSTRUCTION** watermark until every
  requirement is met and the report is formally issued with a named reviewer.
- **PDF via the browser print engine** (File → Print → Save as PDF) — works on iOS, Android,
  Windows, macOS and Linux with no dependencies; A4 print stylesheet included.
- **Paginated preview**: a *Page view* toggle lays the report into A4 sheets so the engineer can see
  where breaks fall before issuing, with a running footer and page numbers. It mirrors the rules in
  the print stylesheet but is a **simulation** — a browser does not expose its print pagination to
  the DOM, and the finished PDF is still produced by the engineer's own browser. Print always
  renders `#rpt`, never the paginated copy, so the issued document cannot be affected by it.
- **Appendix D information sheets**: third-party guidance documents (currently the CSIRO
  *Foundation Maintenance and Footing Performance* guide) are stored in `info-sheets/` and appended
  to the report, ticked on by default and unticked per report where they don't apply, e.g. the
  landslide guidance on a flat site. One manifest entry drives the tick box, the **References**
  citation, the **Further guidance** sentence and the appended pages together, so the report can
  never cite a document it doesn't contain or contain one it doesn't cite. The **appendix map** in
  Review & issue shows what will land in Appendix A, B, C and D before the report is built.
  **Adding or replacing a sheet is a file swap plus one command, never a code change:
  `info-sheets/README.md`.**
- **Export / import (.json)** for device-to-device transfer and office review.
- **Quickbase prefill**: a Formula-URL button in Abbot Design's Quickbase app opens the engine with
  the client and site details already filled in, carried in the URL fragment — no API, no token and
  no backend. Provenance lands in `report.source`. **Contract: `docs/qb-contract.md`.**
- **Send to another device**: renders the same payload as a QR code, drawn locally from the
  vendored library in `vendor/` so nothing is sent to a third party. Job details only, not photos.
- **Autosave** on every input to device storage, with a graceful in-memory fallback and a visible
  warning where storage is unavailable.

## Compliance mapping (why each element exists)

| Report element | Why it's required |
|---|---|
| Lot & DP + full street address | NSW certifiers reject non-lot-specific reports before CC/CDC issue |
| Document status table (author/reviewer/version/date) | Professional accountability; DBP Act duty of care context |
| Single fieldwork date reused everywhere | Prevents the contradictory-dates defect observed in a competitor sample |
| AS 2870 class + written justification | The engineer classifies; the app never computes the standard |
| Calculated class vs class adopted for design | AS 2870 allows a more conservative design class; the override is what a certifier checks, so it must be justified |
| Slope stability & landslide risk (AGS 2007), optional | Required by councils with geotechnical slope guidelines; adds risk-to-property, risk-to-life, retaining parameters and the council declaration |
| AS 4055 inputs + class, optional AS 1170.2 note | Wind class required for Class 1/10 design; the note is Abbot's refinement upsell |
| Borehole logs with method/depth/water/profile | AS 1726 investigation records; certifier evidence |
| Founding advice & bearing pressures | The differentiator — a report a structural engineer can act on |
| Hold points list | Keeps the report valid through construction and re-engages Abbot |
| Limitations | Liability boundary, present in every competitor sample |
| Appendix D information sheets, per-report | Certifiers and councils expect the referenced guidance appended; a sheet that doesn't apply to the site (landslide guidance on a flat lot) is a defect, not a bonus |
| DRAFT watermark until issue | Stops incomplete reports reaching clients while lab results are pending |

## Report typography

Benchmarked against a competitor report accepted by NSW certifiers (AscentGeo), measured from the
PDF rather than eyeballed:

| | Benchmark | This engine |
|---|---|---|
| Body size | 11.0 pt | 11.0 pt |
| Leading | 1.36 | 1.40 |
| Text measure | 160 mm | 160 mm (210 less 25 mm margins) |
| Font | Calibri (embedded) | **Carlito (embedded)**, metric-compatible with Calibri |
| Characters/line | ~100 | ~96 |
| Alignment | Justified | **Ragged right** |

**Body copy is deliberately not justified.** Measured, browser justification gives 2.44× word-space
stretch against the benchmark's 1.19×, because browsers break lines greedily where Word composes a
paragraph as a whole; even with `hyphens:auto` it only reaches 1.88×. `tests/pageview.spec.js` pins
all of these, so they cannot drift back.

**The report is set in an embedded font, the interface is not.** `system-ui` resolves to SF Pro on
iOS/macOS, Segoe UI on Windows and Roboto on Android, so the same report issued from different
devices used to have different line breaks and a different page count. The report now uses Carlito
(`vendor/fonts/`, SIL OFL, ~180 KB for four faces), which is metric-compatible with Calibri, so
output is identical on every device *and* matches the standard the reports are benchmarked against.
The editor keeps the platform font — only the printed document needs to be device-independent.

Watch for anything appended to a preview page rather than to `.rptpagebody`: it sits outside `.rpt`
and will inherit the interface font unless `.rptpage` covers it. That bug made the preview measure a
footer 11 mm wider than it prints.

## Accessibility (WCAG 2.2 AA highlights)

Labels on every control; 44 px minimum targets; visible focus rings; skip link; `aria-current`
step tabs; status messages via live regions; redundant entry eliminated by design; `autocomplete`
attributes on personal fields; reduced motion respected; colour contrast checked against AA on
all token pairs; photo inputs have text alternatives via captions.

## Architecture notes for the next developer

- **`info-sheets/manifest.js` is the only place an Appendix D sheet is described.** It is a plain
  script in the browser and a CommonJS module under Node, so `tools/build-info-sheets.mjs` reads the
  same file the app does. Reports store only the engineer's *overrides* (`d.infoDocs`, id to
  true/false), never the documents, so device storage, the `.json` export and the QR handoff are
  unaffected, and a sheet added to the manifest later reaches reports already in progress.
- **`store` wrapper is the only persistence surface.** Phase 2 = replace its four methods with
  Supabase calls (auth + `reports` table with row-level security + Storage bucket for photos).
  Nothing else in the app needs to change.
- All state lives in one `db` object (`id → report`); rendering is stateless from it.
- Section templates are plain functions in `TPL`; add a section by adding to `SECTIONS` + `TPL`
  + (optionally) `requirements()`.
- The report document is built in `buildReport()` — one function, straight from state, so the
  preview and the PDF can never disagree with the entered data.
- Escaping: all user text passes through `esc()`/`nl()` before entering the DOM.

## Roadmap

**Phase 2 — Supabase (free tier):** email/OTP auth, multi-device sync, photo originals in
Storage, office review workflow (engineer submits → reviewer approves → issue), report templates
per report type versioned in a table.
**Phase 3 — output fidelity:** merge uploaded PDF attachments (lab/DCP reports) into the issued
document server-side (Appendix D sheets already avoid this by being rasterised at commit time, but
engineer-uploaded attachments still can't be merged by the browser); vendor pdf.js so PDF
attachments can render as embedded pages offline; server-side PDF render (headless Chromium via a free-tier worker)
for pixel-identical letterhead, page headers/footers with job number on every page, and archival
PDF/A output.
**Phase 4 — intake integration:** ~~quote/CRM prefill into `report.source`~~ **done — see
`docs/qb-contract.md`**; still to come: write-back of the issued PDF into Quickbase (needs a
serverless hop, as `api.quickbase.com` sends no CORS headers to other origins), client portal
delivery links, and automatic hold-point booking reminders.

## Housekeeping that must not regress

- **Do not upload an older `index.html` over a newer one.** Commit 7048cdc (slope module +
  classification split) was wiped by a later "Add files via upload" and had to be recovered from
  git history. Uploading whole files through the web UI replaces, it does not merge.

- **Never hand-edit the `info-sheets/pages` entries in `sw.js`.** They are generated. Run
  `node tools/build-info-sheets.mjs` after any change under `info-sheets/`; it rasterises the pages,
  prunes orphans, rewrites the shell list and bumps the cache version, and it is idempotent.
  `--check` verifies without writing. `tests/info-sheets.spec.js` fails if the two drift.

- **Cite the edition you actually append.** The engine cited the 2012 CSIRO "BTF-18" edition for a
  document it never appended; the file now in `info-sheets/` is the December 2024 edition, which has
  a different title and no BTF-18 designation. Citation and pages come from the same manifest entry
  so they cannot diverge again.

- **Every URL in the `sw.js` SHELL array must resolve.** `cache.addAll()` rejects on a single 404,
  which rejects the install handler, which means no offline cache at all — the one thing the app
  exists to do. `tests/ux-round.spec.js` checks this on every run.
- **Bump `CACHE` in `sw.js` on every deploy**, or installed apps keep serving the old shell.
- **`tests/prefill.spec.js` is the only automated guard on the Quickbase contract.** There is no
  schema-checking script and no active maintainer for the integration, so if a `report.d` key is
  renamed, that spec is what catches it. Update it and `docs/qb-contract.md` in the same commit as
  any change to `PREFILL_MAP`.
- **The prefill payload must stay in the URL *fragment*, never the query string.** A fragment is
  never sent to the server; a query string is, and would put client names and addresses into
  GitHub's access logs. It is scrubbed with `history.replaceState()` before the first render.

- **Field binding is registered on both `input` and `change`.** Autofill, and `<select>` /
  `<input type=date>` on some platforms, fire `change` without `input`. Do not collapse this back
  to a single listener.

## Known MVP limits (deliberate)

- Data lives on one device until exported (Phase 2 fixes). A Quickbase link opens the job on
  whichever device clicked it — engineers click it on the tablet they will work on, or hand it over
  with **Send to another device**.
- **iOS clears `localStorage` after 7 days without opening the app** (WebKit policy; home-screen
  PWAs are no longer exempt). An in-progress report left for a week can be lost. Until Phase 2,
  export a .json backup as soon as a report has real data.
- Print headers/footers per page depend on the browser (Phase 3 fixes).
- No authentication — do not store sensitive client data on shared devices.
- The app structures standards *inputs* but never computes AS 2870/AS 4055 outcomes: engineering
  judgement is the product.
