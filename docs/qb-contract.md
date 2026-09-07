# Quickbase → Report Engine prefill contract

**Version 1.** This document is the agreement between two systems that do not talk to each other
any other way. If you are picking this up cold, read this page first — it is the only place both
halves are written down.

- **Quickbase** is the system of record. (Realm and app id are deliberately not recorded here — this
  repository is public, and they are reconnaissance for a phishing attempt at no benefit.)
- **The Report Engine** is a static offline PWA. It has no server, no database and no login.
- A **Formula-URL button** in Quickbase opens the engine with job details already filled in.

**There is no API call anywhere in this design.** No user token, no app token, no backend. The
button is a plain external `https://` link, so the app's *Require Application Tokens* setting does
not affect it and should stay switched on.

---

## How the payload travels

The data rides in the **URL fragment** — the part after `#`:

```
https://abbot-design.github.io/geotech-report-engine/#qb=1&cl=Smith&ld=Lot%2012%20DP%201234567
```

**A fragment is never transmitted to the server.** It does not reach GitHub, appear in any access
log, or leak through a `Referer` header. The engine also scrubs it from the address bar with
`history.replaceState()` before the first render, so it does not persist in history or a bookmark.

This is why the payload must **never** be moved into the query string (`?cl=…`), which *is* sent to
the server and *does* get logged.

### Why not send just a record ID and fetch the rest?

Because the engine has no login. An endpoint that returns project details for any record ID would
be an unauthenticated read of Abbot's CRM — strictly worse than a link containing details the
person clicking it is already looking at. The button only renders on records the user can already
see, and it grants no access to anything else.

Once the engine has authentication (Supabase, the repo's Phase 2), switch to reference-only prefill.
**Identity first, then reference-only** — the other order is the insecure one.

---

## The payload

Percent-encoded `key=value` pairs, `&`-separated, after `#`. Chosen over base64 JSON because
formula-string escaping is the fiddliest part of Quickbase and this avoids it entirely.

`qb=1` must come first. It is the **encoding** version — bump it only if the encoding itself changes
(e.g. moving to base64). **Adding or removing fields never requires a version bump.**

### Field map

| Key | → engine `report.d` | Geotech Reports field | fid |
|---|---|---|---|
| `rid` | *(→ `report.source.recordId`)* | `Record ID#` | 3 |
| `ty` | *(→ `report.type`)* | `Report Type` | 6 |
| `jn` | `jobNo` | `Job No` | 7 |
| `cl` | `client` | `Project - Customer` *(lookup)* | 20 |
| `co` | `careOf` | `Project - Customer Contact` *(lookup)* | 21 |
| `cp` | `clientPhone` | `Project - Customer Contact Ph` *(lookup)* | 24 |
| `ce` | `clientEmail` | `Project - Customer Contact Email` *(lookup, Email type)* | 25 |
| `pd` | `projectDesc` | `Project Detail` *(lookup)* | 22 |
| `st` | `street` | `Street` 8, falling back to `Project Address` *(lookup)* | 8 / 23 |
| `sb` | `suburb` | `Suburb` | 9 |
| `sa` | `state` | `State` | 10 |
| `pc` | `postcode` | `Postcode` | 11 |
| `ld` | `lotDp` | `Lot and DP` | 12 |
| `cc` | `council` | `Council` | 13 |
| `au` | `author` | `Author - Name` *(lookup)* | 27 |
| `aq` | `authorQual` | `Author - Qualifications` *(lookup)* | 28 |
| `ar` | `authorReg` | `Author - Registrations` *(lookup)* | 29 |
| `rv` | `reviewer` | `Reviewer - Name` *(lookup)* | 31 |
| `rq` | `reviewerQual` | `Reviewer - Qualifications` *(lookup)* | 32 |
| `rr` | `reviewerReg` | `Reviewer - Registrations` *(lookup)* | 33 |

**These are the field IDs as actually built** (Geotech Reports, 33 fields, confirmed 7 September
2026) — not assumed. Reference fields: `Related Project` 19, `Author` 26, `Reviewer` 30. Fields the
button does not read: `Report ID` 14, `Status` 15, `Issued Date` 16, `Site Class (AS 2870)` 17,
`Report PDF` 18.

Note the Projects lookups carry **no `Related ` prefix**, and `Project Detail` / `Project Address`
carry no prefix at all. That is what Quickbase generated.


**`ar` and `rr` are multi-line**, one jurisdiction per line — an engineer registered in several
states holds a separate number in each. Newline-separated, not comma-separated: the qualification
line is itself `CPEng, NER, 1234567`, so commas are part of the data. Quickbase sends CRLF; the
engine normalises it to LF on arrival so no stray carriage return reaches the rendered document.

`ty` must be one of `desktop`, `classification`, `comprehensive`. Anything else falls back to
`classification`.

**On the contact's phone and email.** These were originally left out on the grounds that they were
"the most sensitive values available". That was wrong on two counts. The payload already carries the
client's name and the exact site address, which are more identifying than a business phone number,
so singling these out was inconsistent. And it already carries that same contact's *name* as
`careOf` — moving someone's name but not their number is the worst of both worlds, because the
personal data has travelled anyway and the engineer still has to go and look the number up.

`buildReport()` never prints either value; they are captured so the engineer can arrange site
access. They travel for that reason and no other. Use the **project contact** fields (25, 26), not
the customer-level ones — the contact is the person actually on site, and is the same person `co`
names.

### What Quickbase cannot supply

Measured across all 7,079 project records. These have **no source field in Quickbase** and the
engineer must always enter them:

`slopeDeg` · `geologyUnit` · `siteClass` · everything from fieldwork onward.

Author and reviewer names, qualifications and registration numbers **were** on this list. They now
come from Staff Details via two relationships — see Step 5 of the build sheet. Those three values
per person are identical on every report and were previously retyped each time, which made them the
highest-value prefill available.

Before the Geotech Reports table existed, `lotDp`, `suburb`, `state`, `postcode` and `council` were
also unavailable — **that table is what makes this integration worth building.**

### Do not parse `Project Address`

Projects' `Project Address` (fid 28) is one free-text field. Only **28% contain a postcode** and
**40% a state**. Real values range from `1341 DANDENONG ROAD, MALVERN EAST VIC 3141` to
`Corner of Boundary Rd and, Hume Hwy, Liverpool NSW 2170` to just `Myer Sydney`.

It is passed through into `street` unchanged as a typing head-start when the geotech Street field is
empty. **Never write code that splits it into street/suburb/state/postcode.** It would be guesswork
and would be the most fragile thing in the system.

---

## The Quickbase side

### Geotech Reports table (child of Projects)

**Feeds the button** — entered in Quickbase:

| Field | Type |
|---|---|
| Report Type | Text - Multiple Choice: `desktop`, `classification`, `comprehensive` |
| Job No | Text |
| Street | Text |
| Suburb | Text |
| State | Text - Multiple Choice, default `NSW` |
| Postcode | Text |
| Lot and DP | Text |
| Council | Text |
| Author | Text |

**Record-keeping** — filled after the report is issued (by hand for now; by write-back later):

| Field | Type |
|---|---|
| Report ID | Text — the engine's `r.id`, shown on the report |
| Status | Text - Multiple Choice: Draft / In review / Issued |
| Date Issued | Date |
| Site Class | Text - Multiple Choice: A, S, M, M-D, H1, H1-D, H2, H2-D, E, E-D, P |
| Report PDF | File Attachment |

**Lookups from Projects** so nothing is re-typed: `Customer` (10), `Customer Contact` (24),
`Project Detail` (9), `Project Address` (28).

> ⚠️ **Verify the lookups actually resolve in the Quickbase UI before wiring the formula to them.**
> `Related Customer` (fid 14) and `Customer - Email` (fid 16) on Projects came back 0% populated in
> a CSV export — Quickbase exports do not always carry lookup values, so that may be an export
> artifact rather than empty data. Check in the UI; do not assume either way.

Field names above avoid `&` and `/` (hence `Lot and DP`, not `Lot & DP`) purely to keep the formula
free of escaping doubt.

### The Formula-URL field

**Step-by-step build instructions, with the exact current Quickbase UI flow, are in
[`qb-build-sheet.md`](qb-build-sheet.md).** The formula there is the authoritative one — it adds a
`Case()` block so staff pick readable report-type names while the engine still receives the values
it expects.

Create a **Formula - URL** field named `Send to Report Engine`, tick **Display as a button**, and
restrict it by role to staff who start geotech reports.

```
var text BASE = "https://abbot-design.github.io/geotech-report-engine/";

var text P =
    "#qb=1"
  & "&rid=" & URLEncode(ToText([Record ID#]))
  & "&ty="  & URLEncode([Report Type])
  & "&jn="  & URLEncode([Job No])
  & "&cl="  & URLEncode([Project - Customer])
  & "&co="  & URLEncode([Project - Customer Contact])
  & "&pd="  & URLEncode([Project - Project Detail])
  & "&st="  & URLEncode(If(Trim([Street]) = "", [Project - Project Address], [Street]))
  & "&sb="  & URLEncode([Suburb])
  & "&sa="  & URLEncode([State])
  & "&pc="  & URLEncode([Postcode])
  & "&ld="  & URLEncode([Lot and DP])
  & "&cc="  & URLEncode([Council])
  & "&au="  & URLEncode([Author]);

$BASE & $P
```

Adjust the lookup field names (`[Project - Customer]` etc.) to match whatever Quickbase actually
named them when the lookups were created.

Empty values are harmless — the engine ignores any key whose value is blank.

---

## Cross-device: where the report ends up

**Clicking the button puts the report on the device that clicked it, and nowhere else.** The engine
stores reports in that browser's `localStorage`; there is no sync.

1. **Normal use — click it on the device that will do the work.** The engineer opens Quickbase on
   the iPad, taps the button, and the engine opens prefilled on the iPad. Needs signal at that
   moment; everything afterwards works offline.
2. **Desktop → iPad — use "Send to another device".** The engine renders the same payload as a QR
   code, drawn locally (the QR library is vendored in `vendor/`, nothing is sent to any service).
   Scan it with the iPad camera.
3. **Not solved: the return trip.** A finished report still gets back to the office as a `.json`
   export. That needs Supabase.

### ⚠️ Known data-loss risk

Since iOS 13.4, WebKit clears `localStorage` after **7 days without interaction with the site**.
Home-screen PWAs were originally exempt; that exemption was removed. **An in-progress report on an
iPad left for a week can vanish.**

Accepted for now. **The process mitigation is to export a `.json` backup as soon as a report has
real data.** Fixing it properly means Supabase.

---

## When something drifts

There is no scheduled maintenance and no one running scripts. Drift is caught by two things:

**1. The engine reports it to the engineer.** Only keys present in `blank()` are applied; anything
else is counted and named in the banner that appears when a prefilled report opens. If Quickbase
stops sending a field, the payload simply lacks that key and the banner says what is still needed —
in front of the person who can fix it, at the moment they can fix it. Nothing fails silently.

**2. The Playwright spec** (`tests/prefill.spec.js`) asserts the canonical payload lands in every
field. If a `report.d` key is renamed in `index.html`, it goes red. **This is the only automated
guard in the system — do not delete it.**

| Change in Quickbase | Breaks? | Caught by |
|---|---|---|
| Field renamed | No — Quickbase references fields by ID | n/a |
| Field deleted | Yes, loudly — the formula errors in Quickbase | Quickbase itself |
| Field added | No | n/a |
| Field repurposed | Yes, silently | **Nothing.** Residual risk |
| Engine `report.d` key renamed | Yes | The Playwright spec |

### Editing the map

`PREFILL_MAP` in `index.html` is the **only** place the engine-side mapping lives. There is
deliberately no admin UI: this changes perhaps twice a year, and an admin UI would be a whole
product — auth, storage, validation — to replace a 13-line object.

Change the map, change this document, run the tests.
