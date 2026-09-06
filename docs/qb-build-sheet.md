# Build sheet — Geotech Reports table in Quickbase

One-time setup, roughly 20–30 minutes. **Everything here is additive**: a new child table plus
lookups. Nothing modifies Projects, Customers, or any existing record.

App: **Abbot Design** (`bkhasky43`) · realm `ryanchalmers.quickbase.com`
Parent table: **Projects** (`bkhasky79`)

Field map and rationale live in [`qb-contract.md`](qb-contract.md). This sheet is just the clicks.

> **Two steps need you to check reality against what I have assumed** — Step 4 (lookup field names)
> and Step 6 (button label). Both are flagged inline. Everything else is fixed.

---

## Step 1 — Create the table

1. Open the **Abbot Design** app.
2. Select **New Table**, then **From scratch**.
3. Fill the dialog:
   - **Table name:** `Geotech Reports`
   - **Record term:** `Geotech Report` *(must be unique across the app — do not reuse "Project")*
   - **Icon:** anything; a document or layers icon suits
   - **Description:** `Geotechnical reports raised against a project. Feeds the Abbot Report Engine.`
4. Select **Create**.

The table opens as a shell with only built-in fields (`Record ID#`, `Date Created`, etc.).

## Step 2 — Add the fields that feed the button

Open the table → **Settings** → the **+** next to **Fields** (or the **+ New Fields** button on the
Fields page). The **Add New Fields** dialog lets you enter **all of these in one go** — type the
label, pick the type, repeat, then select **Add** once at the bottom.

| Field Label | Type |
|---|---|
| `Report Type` | Text - Multiple Choice |
| `Job No` | Text |
| `Street` | Text |
| `Suburb` | Text |
| `State` | Text - Multiple Choice |
| `Postcode` | Text |
| `Lot and DP` | Text |
| `Council` | Text |
| `Author` | Text |

> **Why `Lot and DP` and not `Lot & DP`:** the engine labels it "Lot & DP", but an ampersand in a
> Quickbase field name is the same character the formula language uses to join strings. It works
> inside brackets, but it is a needless thing to debug at 5pm. The label only ever appears in
> Quickbase.

### Set the choices on the two multiple-choice fields

On the **Fields** page, select each field name to open its properties, then add its choices:

**`Report Type`** — these are what staff will see, and Step 6's formula translates them for the
engine, so the wording here is free to be human:
```
Desktop assessment
Site classification + wind
Comprehensive investigation
```

**`State`** — set the **Default value** to `NSW`:
```
NSW · QLD · VIC · SA · WA · TAS · NT · ACT
```

## Step 3 — Add the record-keeping fields

Same **Add New Fields** dialog. These are filled *after* a report is issued — by hand for now, and
by write-back later if that gets built.

| Field Label | Type |
|---|---|
| `Report ID` | Text |
| `Status` | Text - Multiple Choice |
| `Date Issued` | Date |
| `Site Class` | Text - Multiple Choice |
| `Report PDF` | File Attachment |

**`Status`** choices: `Draft` · `In review` · `Issued`
**`Site Class`** choices (AS 2870): `A · S · M · M-D · H1 · H1-D · H2 · H2-D · E · E-D · P`

## Step 4 — Relate it to Projects, and pull the client details across

1. Still in **Geotech Reports** → **Settings** → **Table-to-table relationships**.
2. Select **+ New Relationship**.
3. In the **Create a table-to-table relationship** dialog:
   - **Tables:** parent = **Projects**, child = **Geotech Reports**
   - **How to relate child records to a parent:** accept the default reference field
   - **Add lookup fields:** choose **`Customer`**, **`Customer Contact`**, **`Project Detail`**
4. Select **Create Relationship**.
5. You can only add three lookups at a time, so reopen the relationship, select **Add Lookup
   Fields** at the bottom of the **Child Table** section, and add the fourth: **`Project Address`**.

> ⚠️ **Check this before Step 6.** Quickbase names lookup fields itself, usually
> `Related Project - Customer` or `Project - Customer`. **Go to the Fields page and write down the
> four exact labels it generated** — the formula must match them character for character. This is
> the single most likely thing to go wrong, and it fails loudly (the formula won't save), not
> silently.

> ⚠️ Also worth confirming here: open any Geotech Reports record, pick a parent project, and check
> the four lookups actually populate. Projects' own `Related Customer` and `Customer - Email` came
> back empty in a CSV export — probably an export quirk rather than real emptiness, but this is the
> moment to find out for certain.

## Step 5 — Create the button

**Settings** → **Fields** → **+ New Fields** → Field Label `Send to Report Engine`, Type
**Formula - URL** → **Add**. Then open it and paste this into the **Formula** box:

```
var text BASE = "https://clairethetester.github.io/abbot-geotech-report-engine/";

var text TY = Case([Report Type],
  "Desktop assessment",          "desktop",
  "Site classification + wind",  "classification",
  "Comprehensive investigation", "comprehensive",
  "classification");

var text P =
    "#qb=1"
  & "&rid=" & URLEncode(ToText([Record ID#]))
  & "&ty="  & URLEncode($TY)
  & "&jn="  & URLEncode([Job No])
  & "&cl="  & URLEncode([Related Project - Customer])
  & "&co="  & URLEncode([Related Project - Customer Contact])
  & "&pd="  & URLEncode([Related Project - Project Detail])
  & "&st="  & URLEncode(If(Trim([Street]) = "", [Related Project - Project Address], [Street]))
  & "&sb="  & URLEncode([Suburb])
  & "&sa="  & URLEncode([State])
  & "&pc="  & URLEncode([Postcode])
  & "&ld="  & URLEncode([Lot and DP])
  & "&cc="  & URLEncode([Council])
  & "&au="  & URLEncode([Author]);

$BASE & $P
```

**Replace the four `[Related Project - …]` names with whatever you wrote down in Step 4.** Easiest
way to get them exactly right: click into the Formula box and use the **Fields & Functions** list to
insert them rather than typing.

Notes on the formula:
- The `Case()` block means staff pick readable options while the engine still receives the exact
  values it expects. Anything unrecognised falls back to `classification`.
- `Street` falls back to the parent's `Project Address` when it is blank, so you get a typing
  head-start on day one without re-entering the address.
- Empty fields are harmless — the engine ignores any key with a blank value.

## Step 6 — Make it look like a button

Still in the field's properties, under the display options:

- ☑ **Display as a button** — and pick a colour next to **Choose button color**
- ☑ **Open Target in New Window** — keeps the Quickbase record open behind it

> ⚠️ Label wording varies slightly by Quickbase version. If you see **"Display as a link"** with a
> dropdown instead, choose the button option there. If there is no button option at all, tell me and
> I will convert the formula to the HTML-anchor style Quickbase uses in newer builds
> (`"<a class='Vibrant Success' href='" & $BASE & $P & "'>Send to Report Engine</a>"`).

## Step 7 — Restrict who sees it

**Settings** → **Access** (under Workflow & Permissions). Hide `Send to Report Engine` from any role
that has no business starting geotech reports. It is not a security boundary — the link only ever
carries what is already on the record — it just keeps the interface honest.

## Step 8 — Smoke test

1. Create one Geotech Reports record against a real project. Fill `Lot and DP`, `Suburb`,
   `Postcode`, and pick a `Report Type`.
2. Click **Send to Report Engine**.
3. The engine should open with a banner reading **"Prefilled N fields from Quickbase record …"**,
   and list what it could not supply (expect `Reviewer for issue` at minimum — Quickbase has no
   source for it).
4. Check the address landed sensibly. If the parent's one-line address came through, the banner
   will tell you to split out suburb/state/postcode.
5. Click the button a **second time** — you should return to the *same* report, not a duplicate.
6. Look at the browser address bar: the client details should be **gone** from it within a moment.
   That is the engine scrubbing the URL, and it is deliberate.

## If something is wrong

| Symptom | Cause |
|---|---|
| Formula won't save | A field name doesn't match — almost always one of the four lookups from Step 4 |
| Button opens the engine but nothing is filled in | `BASE` is wrong, or the fragment was dropped. The URL must contain `#qb=1` |
| Banner says values "not recognised" | A payload key has drifted from `PREFILL_MAP` in `index.html` — see `qb-contract.md` |
| Second click makes a duplicate report | `rid` isn't reaching the engine; check the `ToText([Record ID#])` line |
| Nothing happens on the second click, same tab | **Open Target in New Window** is off *and* the engine is already open at that URL |

When it works, tell me and I'll record the real lookup field names in `qb-contract.md` so the
document matches what was actually built.
