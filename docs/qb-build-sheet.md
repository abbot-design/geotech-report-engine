# Build sheet — Geotech Reports table in Quickbase

One-time setup, roughly 20–30 minutes. It adds no data and changes no existing record. It is not
quite invisible, though: creating a relationship also adds two convenience fields to the *parent*
table, so Projects and Staff Details each gain columns. Step 5c deals with those.

App: **Abbot Design** · Parent table: **Projects**

> The realm and the app and table ids are deliberately not written down here — this repository is
> public, and while they are not credentials, they tell anyone reading exactly where to aim a
> phishing attempt at Abbot. You do not need them for this build; every step is done through the
> Quickbase UI. If you ever want them, they are in your browser's address bar while the app is
> open: `https://<realm>.quickbase.com/nav/app/<app-id>/table/<table-id>/…`

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
| `Report ID` | **Text** — not Numeric |
| `Status` | Text - Multiple Choice |
| `Date Issued` | Date |
| `Site Class` | Text - Multiple Choice |
| `Report PDF` | File Attachment |

> ⚠️ **`Report ID` must be Text.** The engine's report id is alphanumeric — `"R" + a base-36
> timestamp`, e.g. `R1m8x9kq` — so a Numeric field will reject it. This is a record-keeping field
> the button never reads, so a wrong type causes no error now; it only bites later, when someone
> tries to file the issued report's id against the record.

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
| `Qualifications` | Text | `CPEng, NER, 1234567` |
| `Registrations` | **Text - Multi-line** | see below |

Fill them in for the engineers who sign reports. Leave them blank for admin staff.

**`Registrations` must be multi-line, one jurisdiction per line**, because an engineer registered in
several states holds a separate number in each. Ryan's block is the worked example:

```
Qualifications:  CPEng, NER, 1234567

Registrations:   NSW & TAS BDC0000
                 VIC PE0000000
                 QLD RPEQ 00000
```

> **Not comma-separated.** The qualification line is itself `CPEng, NER, 1234567` — commas are part
> of the data, so splitting on them would break that line into three. Newlines are unambiguous, and
> the engine prints one per line exactly as typed. The `&` in `NSW & TAS` is safe: it is a field
> *value*, not part of the formula, and `URLEncode()` handles it.

> ⚠️ **Check every name is a full name while you are here.** Some staff records hold a first name
> only. This field prints verbatim on the cover, and a certifier-facing report that says
> *"Prepared by: Ryan"* is not acceptable.

### 5b. Two relationships, both to Staff Details

A parent table can have many children, and you can relate the same two tables more than once — that
is how one table gets both an author and a reviewer.

> **The wizard will not let you name the reference field.** Its dropdown only offers fields that
> already exist, plus the default one Quickbase creates for you (`Related Staff Detail`). You accept
> that default and **rename it afterwards**. Renaming is safe: Quickbase references fields by ID,
> not by label, so nothing breaks — which is the same reason this whole contract is keyed on field
> IDs.

**Do the two relationships one at a time, renaming in between.** If you create both first, the
second set of lookups arrives with names like `Staff Detail - Name 2` and you will not be able to
tell which set belongs to the author and which to the reviewer.

#### Relationship 1 — Author

1. **Geotech Reports** → **Settings** → **Table-to-table relationships** → **+ New Relationship**.
2. **Tables:** parent = **Staff Details**, child = **Geotech Reports**.
3. **How to relate child records to a parent:** leave the reference field as **`Related Staff
   Detail`**. ⚠️ Do not pick `Report ID` from that dropdown — it is a different field that happens
   to be listed.
4. **Add lookup fields:** `Name`, `Qualifications`, `Registrations` — **add `Name` first**, because
   the first lookup automatically becomes the *reference proxy*, which is what makes the field
   present as a staff-name dropdown instead of a record number.
5. Select **Create Relationship**.
6. Now go to **Settings** → **Fields** and rename the four fields it just created:

| Quickbase created | Rename it to |
|---|---|
| `Related Staff Detail` | `Author` |
| `Staff Detail - Name` | `Author - Name` |
| `Staff Detail - Qualifications` | `Author - Qualifications` |
| `Staff Detail - Registrations` | `Author - Registrations` |

*(To rename: select the field name on the Fields page, edit the **Label**, then **Save**.)*

#### Relationship 2 — Reviewer

Repeat exactly the same steps. Because the Author fields are already renamed, the new ones come
back with the plain `Staff Detail - …` names again — so there is no ambiguity about which is which.
Rename them to `Reviewer`, `Reviewer - Name`, `Reviewer - Qualifications`,
`Reviewer - Registrations`.

> **Shortcut, if you would rather not rename:** create a **Numeric** field called `Author` *before*
> starting the wizard, and it should appear in that reference-field dropdown for you to select. I
> could not verify this against your app, so the rename route above is the one I know works.

> Whatever the fields end up called, **Step 6's formula must match them exactly.** Use the
> **Fields & Functions** picker in the formula editor rather than typing the names.

**Why not the other options:**

| Option | Why not |
|---|---|
| **Text** | Free typing, inconsistent spelling on a legal document — and you still retype quals and registration every time |
| **Text - Multiple Choice** | A second staff list that drifts from Staff Details. Two places to update whenever someone joins or leaves |
| **User field** | Lists only people who hold a **Quickbase login**. Staff Details is an HR-ish table — home address, emergency contacts — so it includes people who may have no account. The Quickbase display name is also not necessarily the professional name a certifier needs, and there is nowhere to hang qualifications or registration. It is the right type for *"who is assigned"*, which is what Projects' `Assigned To` already does; it is the wrong type for *"whose registration number goes on a legal document"* |

## Step 5c — Tidy the fields the relationships added to the parent tables

Creating a relationship adds two fields to the **parent** table: a *Report Link* listing the child
records, and a *Formula - URL* button to add one. Two relationships to Staff Details means four new
columns there — `Geotech Report records`, `Add Geotech Report`, `Geotech Report records2`,
`Add Geotech Report2`.

> This is the one place the build is **not** purely additive. It adds no data and touches no
> existing record, but it does change what the Staff Details table shows.

**On Staff Details — delete the two Add buttons.** Nobody raises a geotech report starting from a
staff member, so `Add Geotech Report` and `Add Geotech Report2` are pure clutter.

**The two `Geotech Report records` links are worth a moment's thought before deleting.** They answer
*"what has this engineer authored?"* and *"what have they reviewed?"* — which is a question Abbot may
well want later. If that appeals, rename them `Reports authored` and `Reports reviewed` and drop
them from the default report instead of deleting. If not, delete all four.

To delete: **Staff Details** → **Settings** → **Fields**, tick the fields, **Delete**. Neither type
stores data — a report link is a live view and a formula-URL is computed — so nothing is lost.
Quickbase permits this: the only relationship field that cannot be deleted is the *reference* field,
and both of those (`Author` 26, `Reviewer` 30) sit in Geotech Reports, not here.

To hide instead of delete: open the **Default report** → report settings → remove the columns.

**On Projects — keep them.** The same pair was added there, and both earn their place: the link
shows a project's geotech reports, and `Add Geotech Report` is the natural way to raise one. That
button is arguably where the whole workflow starts.

## Step 5d — Make the pickers show names, not record ids

Straight after the relationships, parent records will appear in pickers as bare numbers — `Author`
showing `8`, `Reviewer` showing `1`. That is not a fault: Quickbase populates a record picker from
the parent's **key field**, which is `Record ID#`.

Fix it on each **parent** table, not on Geotech Reports. It is a table-level setting, so it corrects
every picker in the app at once:

| Table | Settings → **Advanced settings** → *Identifying Records* |
|---|---|
| **Staff Details** | `Name` |
| **Projects** | `Project`, `Customer`, `Project Address` *(up to three)* |

The Projects one is worth doing even aside from this build — by default that picker offers
*Project Type* and *PO Received Date*, neither of which identifies a project to a human.

## Step 5e — Job No

**Leave it as free text for now.** `Job No` prints on the report cover, appears in the running
header, is required before a report can be issued, and names the exported `.json` file — so it
matters — but *who generates it* is a business question that has not been settled yet. It may be
Abbot's own reference, or it may be one the client supplies. Do not encode a scheme until that is
known; a formula field cannot be overridden by hand, so guessing wrong is worse than typing.

**When it is settled, avoid a visible sequential counter.** An obvious format like `AD-2026-0014`
tells any client who reads the report roughly how many geotech jobs Abbot has done this year, which
is not information worth giving away on a document you hand to a customer.

A date-derived reference leaks nothing about volume. Ascent Geo use the pattern `AG25231` — firm
initials, then a date encoded in a way that is not obvious at a glance. The one thing such a scheme
needs is a way to distinguish two jobs raised on the same day, and a same-day suffix reveals far
less than a running annual total.

Worth deciding with Ryan before the first report goes out, since the number appears on every issued
document and is awkward to change afterwards.

## Step 5f — Put the form in entry order

The default form lists fields in the order they were created, so the record-keeping fields sit in
the middle of the ones you actually fill in. Display a Geotech Report record, select **Customize
this form** in the page bar, and on the **Elements** tab use the **Up** / **Down** arrows.

Move these five to the end — they are all filled in *after* a report is issued, not when raising it:
`Report ID`, `Status`, `Issued Date`, `Site Class (AS 2870)`, `Report PDF`.

Arrows move one slot per click, so select the five as a group and move them together.

> **Fill in Qualifications and Registrations for every engineer who signs.** They live on the Staff
> Details record, and a blank there means those values simply never reach the report — the button
> will still work, and the engineer will find themselves retyping their own registration numbers.

## Step 5g — Show the button in the grid on a Project

A Project record displays its geotech reports in an embedded grid. That grid is a *Geotech Reports
report*, so the button appears there only once it is a column in that report:

**Geotech Reports → Reports → open the report the link uses (normally the default) → Customize →
add `Send To Report Engine` to the columns → Save.**

The field property *"Add this field to all new reports"* only affects reports created after it was
ticked; it does not retrofit the existing default report. The button works from the grid because
those are saved records, so `Record ID#` exists.

## Step 5h — Separate the two addresses on the form

The form ends up showing two addresses with nothing to say which is which, and people will
reasonably assume one is a mistake. They are different things:

| Field | What it is |
|---|---|
| `Project Address` | Read-only lookup — what **Projects** holds. One free-text line, often with no postcode |
| `Street` · `Suburb` · `State` · `Postcode` | The split address that goes **on the report** |

Make the distinction visible with section headings (Form Builder → any **Make a selection**
dropdown → **Section heading**):

- **From the project (read-only)** — `Project - Customer`, `Project - Customer Contact`,
  `Project Detail`, `Project Address`, `Project - Customer Contact Ph`,
  `Project - Customer Contact Email`
- **Site address for the report** — `Street`, `Suburb`, `State`, `Postcode`, `Lot and DP`, `Council`

Also relabel the lookup to **`Project Address (as recorded on the project)`**, so it explains itself
even to someone who never sees the section heading.

**Why keep the lookup at all:** it is the typing head-start — you can see what Projects holds and
split it into the fields below — and the formula falls back to it when `Street` is blank, so a
half-filled record still sends the engineer something rather than nothing.

**The stricter alternative**, if the duplication still grates: drop the `If(Trim([Street]) = "", …)`
fallback from the formula and remove `Project Address` from the form. Conceptually cleaner, but a
blank `Street` then sends no address at all.

## Step 6 — Create the button

**Settings** → **Fields** → **+ New Fields** → Field Label `Send to Report Engine`, Type
**Formula - URL** → **Add**. Then open it and paste this into the **Formula** box:

> ⚠️ **`BASE` will change once more.** This is the GitHub Pages address. When
> `reports.abbotdesign.com.au` is pointed at Pages, update this one line and nothing else — the app
> itself uses only relative paths. Do both changes **before** engineers start saving real reports:
> the browser scopes saved reports to the origin, so changing it strands anything already on a
> device.

```
var text BASE = "https://abbot-design.github.io/geotech-report-engine/";

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
  & "&cl="  & URLEncode([Project - Customer])
  & "&co="  & URLEncode([Project - Customer Contact])
  & "&cp="  & URLEncode([Project - Customer Contact Ph])
  & "&ce="  & URLEncode(ToText([Project - Customer Contact Email]))
  & "&pd="  & URLEncode([Project Detail])
  & "&st="  & URLEncode(If(Trim([Street]) = "", [Project Address], [Street]))
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

**These are the real field names as built** — read off the Geotech Reports table on 7 September
2026, not assumed. Paste as-is.

Two things worth knowing about them:
- The Projects lookups came back **without** a `Related ` prefix, and `Project Detail` and
  `Project Address` carry no prefix at all. That is simply what Quickbase generated.
- `Project - Customer Contact Email` is an **Email** field rather than Text, so it is wrapped in
  `ToText()` before `URLEncode()`.

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
