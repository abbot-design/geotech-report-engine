# Report engine tests

End-to-end tests for `index.html`, driven by real headless browsers
(Playwright, in Chromium, Firefox and WebKit). Wherever possible they assert on the generated report HTML
(`#rpt`) — the document an engineer will sign and issue — rather than on
the form that produced it, because the two can drift apart in ways that
look fine on screen.

The suite is the living specification of what the app guarantees.
`npm run test:list` prints every guarantee as a sentence:

```
regression/ux.spec.js:368:3 › destructive row actions are recoverable › a deleted borehole comes back at the same index with its layers
integration/quickbase-prefill.spec.js:208:3 › updates from Quickbase on a second click › a changed value is offered, not applied silently
```

## What kind of test is this?

Each folder answers a different question. File a new test by asking which
question it answers, not which feature it touches.

| Folder | The question it answers | When one of these fails |
|---|---|---|
| `e2e/` | Does the engine still do the job it exists to do? | Core behaviour is broken. Fix the app. |
| `regression/` | Has a bug we fixed, or a decision we made, quietly come back? | Either a regression, or the decision has changed. If the latter, change the test in the same commit and say why. |
| `integration/` | Does the engine still honour its contract with Quickbase? | The contract has drifted. Change `PREFILL_MAP`, `docs/qb-contract.md` and the payload fixture together. |
| `accessibility/` | Does the interface still work for someone not using a mouse and a screen? | An assistive-tech user has lost something. Fix the app. |

A regression test can graduate: if a finding from a review turns out to be
a core rule of the product, move it to `e2e/` and drop the review-item
comment.

### The files

| File | What it guards | Why it exists |
|---|---|---|
| `e2e/report-types.spec.js` | Each report type gets the content it earned and nothing more: no footing advice on a Desktop Assessment, AS 3798 only when there is a fills recommendation. | The AS 2870/AS 4055 over-citation bug on Desktop Assessments — a fix that worked for one report type and left a stale assumption in another. |
| `e2e/field-logs.spec.js` | Borehole logs and DCP sheets: 100 mm data printed at 300 mm, AS 1726 wording, row data in Appendix C only, legacy holes and tests unchanged, appendix pages fit their sheets. | The fieldwork redesign of September 2026; the sample job in `fixtures/fieldwork-sample.json` is the reference output. |
| `e2e/information-sheets.spec.js` | Appendix D. Every asset the manifest names exists and is in the offline shell; a ticked sheet is appended, cited and named from a single manifest entry. | `cache.addAll()` rejects on one 404 and the app has no offline cache at all. Page images are generated, so the manifest and `sw.js` drift in ways no review catches. |
| `e2e/paginated-preview.spec.js` | Page view and print: A4 sheets, nothing overflowing, headers and footers on every page, breaks declared in the document. | Laying out against a hidden container measures every height as 0, so nothing overflows and the report collapses onto a few plausible-looking pages. |
| `regression/ux.spec.js` | The findings of the UI/UX review of August 2026: hint copy policy, completeness indicator, undo on row delete, scroll position, form layout. | The review. Each describe carries its review-item code as a comment so the two can be read side by side. If you change interface copy, expect the hint-policy block to complain. |
| `regression/fonts.spec.js` | The report renders in Carlito, embedded and served from the repo; the interface keeps the platform font. | The report used to be set in `system-ui`, so the same report paginated differently depending on whose browser issued the PDF. |
| `regression/certification-dates.spec.js` | The date beside a signature is the day that person signed, and nothing else. | A date against an unsigned line implied a certification that had not happened. |
| `regression/house-style.spec.js` | No em dash anywhere a user can see, at any report status; placeholders read as placeholders. | House style, decided once and pinned. |
| `regression/saved-reports.spec.js` | A report saved before a stored key existed still opens and renders. | Engineers have stored real reports since 14 September 2026. A failure here is data loss. |
| `integration/quickbase-prefill.spec.js` | The Quickbase → engine prefill contract. See below. | This is the only automated guard on the contract. |
| `accessibility/assistive-tech.spec.js` | Screen-reader-only text is clipped out of the layout, not out of the accessibility tree; the section count is a live region. | Hidden text that is merely `display:none` disappears for assistive tech too. |

## The Quickbase integration

Quickbase raises a job; a formula-URL button on the Geotech Reports record
opens the engine with the job's details in the URL fragment, and the engine
prefills a report from them. The contract is documented in
[`docs/qb-contract.md`](../docs/qb-contract.md); the Quickbase side is built
by hand from [`docs/qb-build-sheet.md`](../docs/qb-build-sheet.md).

`integration/quickbase-prefill.spec.js` tests everything from the URL
fragment onwards: each key lands in the right input, provenance is
recorded, client details never reach browser history, a second click on
the same job updates rather than duplicates, a malformed or out-of-date
payload starts the app instead of breaking it. It also reads the field-map
table out of `docs/qb-contract.md` and `PREFILL_MAP` out of the running
page and fails if the two disagree — so "change the map, change the
document" cannot be half done.

What it does **not** test is Quickbase itself. There is no sandbox, so the
table, the relationships and the formula are checked by the smoke test at
the end of the build sheet, by hand. The residual risk the contract
document names — a field repurposed in Quickbase, sending the right key
with the wrong meaning — is unguarded by design.

The canonical payload lives in `fixtures/quickbase-payload.js`. Adding a
key to the contract means adding it there, to `PREFILL_MAP`, and to the
table in the contract document; the integration spec will tell you which
one you forgot.

## Does this affect the live app?

No. Nothing in `index.html` or `sw.js` references this folder. A
visitor's browser only downloads files that are linked or fetched from
those two files, so this folder is invisible to page load speed — it's
inert until you deliberately run it from the command line.

## Running the tests

Needs Node.js. Always run from this folder — Playwright writes its
`test-results/` next to wherever it is invoked. First time only:

```
cd tests
npm install
npx playwright install chromium
```

Then, any time:

```
npm test                  # everything, in all three engines, about a minute
npm run test:list         # read the suite as a specification, run nothing
npm run test:e2e          # one category: e2e | regression | integration | a11y
npx playwright test --project=chromium     # one engine, ~20 s
npx playwright test -g "Quickbase"         # anything whose name matches
npx playwright test --ui                   # step through with DOM snapshots
```

`npm test` starts a local static server over the repo root and runs the
suite against it — no manual server setup needed.

Every test runs once per engine. WebKit is the one that matters most and
was untested until September 2026: an engineer on an iPad or a Mac issues
the PDF from Safari, and the font and pagination specs exist because the
same report used to paginate differently depending on whose browser
printed it.

The first-time install above fetches Chromium only; add the others with
`npx playwright install firefox webkit`.

## When to run it

Before pushing any change to `index.html` or `sw.js`. Before touching
`PREFILL_MAP`, run `npm run test:integration` first so you can see it go
red and then green.

## Writing a test

The conventions that keep the suite readable:

- **The name is a sentence stating a guarantee.** "a blank incoming value
  never wipes an existing one", not "test blank values". Someone reading
  `test:list` should learn what the app promises without opening a file.
- **Every spec opens with the bug it stops**, not with how to run it. The
  "why" is the part a reader cannot recover from the code.
- **Assert on `#rpt`** — the generated report — wherever the behaviour
  reaches the document. Form state is a means, not the end.
- **Shared steps live in `helpers.js`.** `newReport`, `gotoTab` and
  `openPreview` are the actions an engineer takes; a spec should read as a
  sequence of them. If a selector moves, fix it there once.
- **Fixtures live in `fixtures/`.** Data shaped like the real thing, with
  a comment saying where the shape comes from.
- **File by the question, not the feature** (see the folder table above).

## Housekeeping

`node_modules/`, `test-results/` and `playwright-report/` are ignored and
must not be committed.
