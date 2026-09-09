# Appendix D information sheets

Third-party guidance documents that the engine appends to a report as **Appendix D**,
cites in **References**, and names under **Further guidance**.

There is no admin UI. This folder *is* the admin UI: adding, replacing or retiring a
sheet is a file change plus one command, and never a change to `index.html`.

```
info-sheets/
  manifest.js   the registry, and the only file you edit by hand
  docs/         the source PDFs, kept as the source of truth
  pages/        generated page images, committed, and what actually prints
```

## Why page images and not the PDF

The engine's PDF is the browser's own print engine, which cannot merge a PDF into its
output. Appendix A already solves this for site plans by rendering PDF pages to images,
so Appendix D uses the same mechanism.

Rendering the pages here rather than in the browser keeps it working with **zero signal**,
which is the normal condition on a rural site. The runtime pdf.js loader in `index.html`
is a CDN fetch and would fail there.

The source PDF stays in `docs/` as the source of truth and the "View original PDF" link,
but it is deliberately **not** in the `sw.js` shell: it is not needed offline, and leaving
it out keeps roughly a megabyte off every tablet that installs the app.

## Add or replace a sheet

1. Put the PDF in `docs/`. Name it after the manifest `id`.
2. Add or edit its entry in `manifest.js`. Every field is commented there; `pageCount`
   is the one that has to be right, and the build tool will tell you if it is not.
3. Run the build tool:

```bash
node tools/build-info-sheets.mjs
```

It rasterises the pages, deletes page images left behind by a renamed or removed sheet,
rewrites the `SHELL` list in `sw.js` and bumps the cache version. It is idempotent, so
running it twice changes nothing.

4. Commit the PDF, the generated pages, `manifest.js` and `sw.js` together.

To retire a sheet, delete its entry from `manifest.js` and run the tool. Reports already
issued are unaffected; reports still in progress simply stop appending it.

`node tools/build-info-sheets.mjs --check` verifies without writing, and exits non-zero on
drift.

It needs poppler's `pdftoppm`:

```bash
brew install poppler
```

This is a maintenance tool, not a build step. It runs only when a sheet changes, and its
output is committed. The app itself still has no build step and no dependencies.

## Rules that must not regress

- **`pageCount` must match the PDF.** It is what generates the page paths, the shell list
  and the "reproduced in full, N pages" line. The build tool refuses to continue if it is
  wrong.
- **Never hand-edit the `info-sheets/pages` entries in `sw.js`.** `cache.addAll()` rejects
  on a single 404, which rejects the install handler, which means no offline cache at all.
  Let the tool write them.
- **A sheet is appended, cited and named from one manifest entry.** Do not add a citation
  for a sheet anywhere in `index.html`; the report would then be able to cite a document
  it does not contain.
- **Check redistribution terms before committing a PDF.** This repo is public and the
  documents are reproduced in commercial reports. Record what you found in the entry's
  `licence` field, with `sourceUrl` and `retrieved` so the provenance can be re-checked
  without archaeology.
- **Cite the edition you are actually appending.** The engine previously cited the 2012
  BTF-18 edition of the CSIRO guide; the file here is the December 2024 Building
  Technology Resources edition, which is a different document with a different title.
