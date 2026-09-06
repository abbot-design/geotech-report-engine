# Build sheet — Geotech Reports table in Quickbase

One-time setup, roughly 20–30 minutes. **Everything here is additive**: a new child table plus
lookups. Nothing modifies Projects, Customers, or any existing record.

App: **Abbot Design** (`bkhasky43`) · realm `ryanchalmers.quickbase.com`
Parent table: **Projects** (`bkhasky79`)

Field map and rationale live in [`qb-contract.md`](qb-contract.md). This sheet is just the clicks.

> **Three steps need you to check reality against what I have assumed** — Step 4 and Step 5 (the
> names Quickbase generates for lookup fields) and Step 7 (the button property label). All are
> flagged inline. Everything else is fixed.

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
   Fields** at the bottom of the **Child Table** section, and add three more:
   **`Project Address`**, **`Customer Contact Ph`**, **`Customer Contact Email`**.

> The contact's phone and email travel because the engineer has to arrange site access, and the
> payload already carries that same person's name as `Customer Contact`. Carrying someone's name but
> not their number is the worst of both worlds — you have moved the personal data and still made the
> engineer go and look it up. Neither value is ever printed on the report; they exist so the
> engineer can make a phone call.

> ⚠️ **Check this before Step 6.** Quickbase names lookup fields itself, usually
> `Related Project - Customer` or `Project - Customer`. **Go to the Fields page and write down the
> four exact labels it generated** — the formula must match them character for character. This is
> the single most likely thing to go wrong, and it fails loudly (the formula won't save), not
> silently.

> ⚠️ Also worth confirming here: open any Geotech Reports record, pick a parent project, and check
> the four lookups actually populate. Projects' own `Related Customer` and `Customer - Email` came
> back empty in a CSV export — probably an export quirk rather than real emptiness, but this is the
> moment to find out for certain.

## Step 5 — Author and reviewer, from Staff Details

**Do not make these text fields.** The names are the small half of the prize: the engine also needs
each engineer's **qualifications** and **registration number** for the document status table, which
exists for professional accountability under the DBP Act. Those are identical every time for a given
person and are currently retyped on every single report. A relationship gets all three, forever.

### 5a. Add two fields to Staff Details

Open **Staff Details** → **Settings** → **+ New Fields**:

| Field Label | Type | Example |
|---|---|---|
| `Qualifications` | Text | `CPEng, NER, 3826369` |
| `Registrations` | **Text - Multi-line** | see below |

Fill them in for the engineers who sign reports. Leave them blank for admin staff.

**`Registrations` must be multi-line, one jurisdiction per line**, because an engineer registered in
several states holds a separate number in each. Ryan's block is the worked example:

```
Qualifications:  CPEng, NER, 3826369

Registrations:   NSW & TAS BDC3431
                 VIC PE0000408
                 QLD RPEQ 21681
```

> **Not comma-separated.** The qualification line is itself `CPEng, NER, 3826369` — commas are part
> of the data, so splitting on them would break that line into three. Newlines are unambiguous, and
> the engine prints one per line exactly as typed. The `&` in `NSW & TAS` is safe: it is a field
> *value*, not part of the formula, and `URLEncode()` handles it.

> ⚠️ **Fix three names while you are here.** Of the 13 staff records, `Ryan`, `Nerrine` and `Max`
> are first-name only. A certifier-facing report that says *"Prepared by: Ryan"* is not acceptable,
> and this field is printed verbatim on the cover. The other ten are already full names.

### 5b. Two relationships, both to Staff Details

Back in **Geotech Reports** → **Settings** → **Table-to-table relationships** → **+ New
Relationship**. A parent table can have many children, and you can relate the same two tables more
than once — that is how one table gets both an author and a reviewer.

Create the relationship **twice**, parent = **Staff Details**, child = **Geotech Reports**:

| Relationship | Name the reference field | Lookups to add |
|---|---|---|
| 1st | `Author` | `Name`, `Qualifications`, `Registrations` |
| 2nd | `Reviewer` | `Name`, `Qualifications`, `Registrations` |

Both fit inside the three-lookup limit, so no second pass needed.

> ⚠️ Name the reference fields **`Author`** and **`Reviewer`** during the wizard. Quickbase derives
> the lookup names from them, so you should end up with `Author - Name`, `Reviewer - Name` and so
> on. If it names them something else, write down what it actually produced — Step 6 must match.

> The first lookup becomes the *reference proxy*, which is what the dropdown shows when picking a
> parent. Adding `Name` first means both fields present as a staff-name dropdown rather than a
> record ID.

**Why not the other options:**

| Option | Why not |
|---|---|
| **Text** | Free typing, inconsistent spelling on a legal document — and you still retype quals and registration every time |
| **Text - Multiple Choice** | A second staff list that drifts from Staff Details. Two places to update whenever someone joins or leaves |
| **User field** | Lists only people who hold a **Quickbase login**. Staff Details is an HR-ish table — home address, emergency contacts — so it includes people who may have no account. The Quickbase display name is also not necessarily the professional name a certifier needs, and there is nowhere to hang qualifications or registration. It is the right type for *"who is assigned"*, which is what Projects' `Assigned To` already does; it is the wrong type for *"whose registration number goes on a legal document"* |

## Step 6 — Create the button

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
  & "&cp="  & URLEncode([Related Project - Customer Contact Ph])
  & "&ce="  & URLEncode([Related Project - Customer Contact Email])
  & "&pd="  & URLEncode([Related Project - Project Detail])
  & "&st="  & URLEncode(If(Trim([Street]) = "", [Related Project - Project Address], [Street]))
  & "&sb="  & URLEncode([Suburb])
  & "&sa="  & URLEncode([State])
  & "&pc="  & URLEncode([Postcode])
  & "&ld="  & URLEncode([Lot and DP])
  & "&cc="  & URLEncode([Council])
  & "&au="  & URLEncode([Author - Name])
  & "&aq="  & URLEncode([Author - Qualifications])
  & "&ar="  & URLEncode([Author - Registrations])
  & "&rv="  & URLEncode([Reviewer - Name])
  & "&rq="  & URLEncode([Reviewer - Qualifications])
  & "&rr="  & URLEncode([Reviewer - Registrations]);

$BASE & $P
```

**Replace the `[Related Project - …]` and `[Author - …]` / `[Reviewer - …]` names with whatever you
wrote down in Steps 4 and 5.** Easiest
way to get them exactly right: click into the Formula box and use the **Fields & Functions** list to
insert them rather than typing.

Notes on the formula:
- The `Case()` block means staff pick readable options while the engine still receives the exact
  values it expects. Anything unrecognised falls back to `classification`.
- `Street` falls back to the parent's `Project Address` when it is blank, so you get a typing
  head-start on day one without re-entering the address.
- Empty fields are harmless — the engine ignores any key with a blank value.

## Step 7 — Make it look like a button

Still in the field's properties, under the display options:

- ☑ **Display as a button** — and pick a colour next to **Choose button color**
- ☑ **Open Target in New Window** — keeps the Quickbase record open behind it

> ⚠️ Label wording varies slightly by Quickbase version. If you see **"Display as a link"** with a
> dropdown instead, choose the button option there. If there is no button option at all, tell me and
> I will convert the formula to the HTML-anchor style Quickbase uses in newer builds
> (`"<a class='Vibrant Success' href='" & $BASE & $P & "'>Send to Report Engine</a>"`).

## Step 8 — Restrict who sees it

**Settings** → **Access** (under Workflow & Permissions). Hide `Send to Report Engine` from any role
that has no business starting geotech reports. It is not a security boundary — the link only ever
carries what is already on the record — it just keeps the interface honest.

## Step 9 — Smoke test

1. Create one Geotech Reports record against a real project. Fill `Lot and DP`, `Suburb`,
   `Postcode`, and pick a `Report Type`.
2. Click **Send to Report Engine**.
3. The engine should open with a banner reading **"Prefilled N fields from Quickbase record …"**.
   With Step 5 done and a reviewer chosen, it should list **nothing** as still needed — author and
   reviewer names, qualifications and registration numbers all arrive from Staff Details.
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
