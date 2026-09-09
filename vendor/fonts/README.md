# Carlito

Metric-compatible with Calibri, under the SIL Open Font License 1.1 (`carlito.LICENSE`).

Source: https://github.com/googlefonts/carlito — `fonts/ttf/Carlito-{Regular,Bold,Italic,BoldItalic}.ttf`

## Why the report has an embedded font

`system-ui` resolves to SF Pro on iOS/macOS, Segoe UI on Windows and Roboto on Android. The
issued PDF is produced by the engineer's own browser, so the *same report* had different line
breaks, different page count and different typography depending on who issued it. That is not
acceptable for a document a certifier relies on.

Carlito is metric-compatible with Calibri, which is what the reports this engine is benchmarked
against are set in, so the measure and page count now match that standard rather than the local
machine.

## Regenerating

Subset with fontTools (`pip install "fonttools[woff]"`), keeping Latin-1, general punctuation,
currency, trademark, arrows, minus and the fi/fl ligatures:

```
pyftsubset Carlito-Regular.ttf \
  --unicodes="U+0020-007E,U+00A0-00FF,U+2000-206F,U+20A0-20BF,U+2122,U+2190-2193,U+2212,U+FB01-FB02" \
  --layout-features='*' --flavor=woff2 --output-file=carlito-regular.woff2
```

Four faces, ~180 KB total. Full unsubsetted TTFs are 2.7 MB, which the offline shell should not
carry.

**If you add a face or widen the subset, add it to the `SHELL` list in `sw.js` and bump `CACHE`.**
`cache.addAll()` rejects on a single 404, which means no offline cache at all.
