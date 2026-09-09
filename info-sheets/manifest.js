/* ============================================================
   Appendix D information sheets - the registry.

   This file is the single source of truth for every third-party
   information sheet the engine can append. One entry here drives
   four places in the report at once:

     1. the tick box in the Appendices section of the editor
     2. the citation in the References section
     3. the sentence in the Further guidance block
     4. the reproduced pages in Appendix D

   so a sheet can never be appended without being cited, or cited
   without being appended.

   TO ADD OR REPLACE A SHEET: see info-sheets/README.md. In short,
   drop the PDF in info-sheets/docs/, add or edit an entry here,
   then run  node tools/build-info-sheets.mjs  which rasterises the
   pages, rewrites the sw.js shell list and bumps the cache version.

   Loaded as a plain script by index.html (sets window.INFO_SHEETS)
   and required by the build tool under Node. No build step, no
   bundler, no dependency.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.INFO_SHEETS = api;
})(typeof self !== "undefined" ? self : globalThis, function () {

  const sheets = [
    {
      id: "csiro-foundation-maintenance",
      short: "CSIRO Foundation Maintenance",
      title: "Foundation Maintenance and Footing Performance: Preventing Soil-Related Building Movement",

      /* Bibliography line for the References section. This is the 2024
         Building Technology Resources edition, which supersedes the 2012
         Building Technology File BTF-18 the engine used to cite. The
         citation and the appended pages must always describe the same
         edition, which is why both live in this one entry. */
      citation: "CSIRO 2024, Foundation Maintenance and Footing Performance: Preventing "
              + "Soil-Related Building Movement, Building Technology Resources, "
              + "Commonwealth Scientific and Industrial Research Organisation.",

      /* Sentence used in the Further guidance block. Written to read as
         prose after "For further information:" and to say the document is
         reproduced here, not available on request. */
      furtherInfo: "For homeowner guidance on foundation maintenance and the prevention of "
                 + "soil-related building movement, refer to the CSIRO guide Foundation "
                 + "Maintenance and Footing Performance, reproduced in this appendix.",

      file: "info-sheets/docs/csiro-foundation-maintenance.pdf",
      pageCount: 4,

      edition: "December 2024",
      sourceUrl: "https://research.csiro.au/infratech/wp-content/uploads/sites/38/2024/12/2979_FoundationMaintenanceandFootingPerformance_WCAG.pdf",
      retrieved: "2026-09-08",

      /* Recorded so the provenance of a redistributed document can be
         checked without archaeology. The source PDF permits printing and
         forbids content extraction; the pages here are rendered images,
         not extracted text. */
      licence: "Copyright CSIRO 2024. Published by CSIRO as a homeowner guide for "
             + "distribution with geotechnical reports. Contains tables reproduced "
             + "from AS 2870-2011 with the permission of Standards Australia Limited.",

      /* When this sheet arrives already ticked. Mirrors the rule the
         engine previously hard-coded for the CSIRO citation: every report
         type except a desktop assessment, which involves no site testing
         and so gives a homeowner nothing to maintain against. */
      defaultOn: r => r.type !== "desktop"
    }
  ];

  /* Page image paths are derived, never listed by hand, so the manifest
     and the files on disk cannot drift apart. pageCount is the one number
     that has to be right, and the build tool verifies it. */
  const pagePaths = s =>
    Array.from({ length: s.pageCount }, (_, i) =>
      `info-sheets/pages/${s.id}-${String(i + 1).padStart(2, "0")}.jpg`);

  return { sheets, pagePaths };
});
