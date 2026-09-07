// tests/prefill.spec.js
//
// Guards the Quickbase -> engine prefill contract documented in
// docs/qb-contract.md.
//
// There is deliberately no schema-checking script and no active maintainer
// for this integration, so THIS FILE IS THE ONLY AUTOMATED GUARD on the
// contract. If a report.d key is renamed in index.html, or the payload map
// drifts from the document, these tests are what catch it. Do not delete
// them, and update them in the same commit as any map change.
//
const { test, expect } = require('@playwright/test');

// The canonical payload. Mirrors the field map table in docs/qb-contract.md
// and the Quickbase formula in the same document.
const PAYLOAD = {
  qb:  '1',
  ty:  'classification',
  rid: '4821',
  jn:  'AD-2026-014',
  cl:  'Example Client Pty Ltd',
  co:  'Jane Architect',
  cp:  '0412 345 678',
  ce:  'jane@example.com',
  pd:  'New single-storey dwelling and detached garage',
  st:  '12 Example Road',
  sb:  'Cessnock',
  sa:  'NSW',
  pc:  '2325',
  ld:  'Lot 12 DP 1234567',
  cc:  'Cessnock City Council',
  au:  'Ryan Chalmers',
  aq:  'BEng (Civil) MIEAust CPEng',
  ar:  'NER 1234567',
  rv:  'Simon Carroll',
  rq:  'BEng (Civil) MIEAust',
  rr:  'NER 7654321',
};

// Payload key -> the DOM id of the field it must land in.
const LANDS_IN = {
  jn: '#f_jobNo',   cl: '#f_client',   co: '#f_careOf', pd: '#f_projectDesc',
  cp: '#f_clientPhone', ce: '#f_clientEmail',
  st: '#f_street',  sb: '#f_suburb',   sa: '#f_state',  pc: '#f_postcode',
  ld: '#f_lotDp',   cc: '#f_council',  au: '#f_author',
  aq: '#f_authorQual',   ar: '#f_authorReg',
  rv: '#f_reviewer',     rq: '#f_reviewerQual', rr: '#f_reviewerReg',
};

const PAYLOAD_LD = PAYLOAD.ld;

const hash = (obj) => '#' + new URLSearchParams(obj).toString();

async function open(page, payload) {
  await page.goto('/index.html' + hash(payload));
  await page.waitForSelector('#view-editor:not([hidden])');
}

async function gotoTab(page, label) {
  await page.click(`#tabrail button:text-is("${label}")`);
}

test.describe('Quickbase prefill', () => {

  test('every mapped field lands in the right input', async ({ page }) => {
    await open(page, PAYLOAD);

    // Setup section fields.
    await gotoTab(page, 'Setup');
    for (const key of ['jn', 'au', 'aq', 'ar', 'rv', 'rq', 'rr']) {
      await expect(page.locator(LANDS_IN[key]), `payload key "${key}"`)
        .toHaveValue(PAYLOAD[key]);
    }

    // Client & site fields.
    await gotoTab(page, 'Client & site ID');
    for (const key of ['cl', 'co', 'cp', 'ce', 'pd', 'st', 'sb', 'sa', 'pc', 'ld', 'cc']) {
      await expect(page.locator(LANDS_IN[key]), `payload key "${key}"`)
        .toHaveValue(PAYLOAD[key]);
    }
  });

  test('report type from the payload is honoured', async ({ page }) => {
    await open(page, { ...PAYLOAD, ty: 'comprehensive' });
    const type = await page.evaluate(() => report().type);
    expect(type).toBe('comprehensive');
  });

  test('an unknown report type falls back rather than failing', async ({ page }) => {
    await open(page, { ...PAYLOAD, ty: 'not-a-real-type' });
    const type = await page.evaluate(() => report().type);
    expect(type).toBe('classification');
  });

  test('provenance is recorded in report.source', async ({ page }) => {
    await open(page, PAYLOAD);
    const src = await page.evaluate(() => report().source);
    expect(src).toMatchObject({ system: 'quickbase', recordId: '4821' });
    expect(src.receivedAt).toBeTruthy();
  });

  // The whole reason the payload rides in the fragment rather than the query
  // string: it must not reach a server, and must not linger anywhere after.
  test('the fragment is scrubbed from the URL before the user sees it', async ({ page }) => {
    await open(page, PAYLOAD);
    expect(page.url()).not.toContain('#');
    expect(page.url()).not.toContain('Example Client');
  });

  test('client details never appear in a history entry', async ({ page }) => {
    await open(page, PAYLOAD);
    const entries = await page.evaluate(() => history.length);
    expect(entries).toBeGreaterThan(0);
    // replaceState overwrote the payload entry, so going back cannot resurrect it.
    expect(page.url()).not.toContain('Example');
  });

  test('clicking the Quickbase button twice yields one report, not two', async ({ page }) => {
    await open(page, PAYLOAD);
    await open(page, PAYLOAD);
    const count = await page.evaluate(() => Object.keys(db).length);
    expect(count).toBe(1);
  });

  test('a different job from the same app makes a separate report', async ({ page }) => {
    await open(page, PAYLOAD);
    await open(page, { ...PAYLOAD, rid: '4822', cl: 'Second Client' });
    const count = await page.evaluate(() => Object.keys(db).length);
    expect(count).toBe(2);
  });

  // Contract drift must be visible to the engineer, never silent.
  test('an unrecognised key is reported, not silently dropped', async ({ page }) => {
    await open(page, { ...PAYLOAD, zz: 'something new' });
    const bar = page.locator('#prefillbar');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('not recognised');
    await expect(bar).toContainText('zz');
  });

  test('a complete payload reports no outstanding setup or client gaps', async ({ page }) => {
    await open(page, PAYLOAD);
    const bar = page.locator('#prefillbar');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('Prefilled');
    await expect(bar).not.toContainText('still need entering');
  });

  test('the banner names what Quickbase could not supply', async ({ page }) => {
    // Drop the fields a thin Quickbase setup would not have.
    const thin = { ...PAYLOAD };
    delete thin.rv; delete thin.ld; delete thin.sb; delete thin.pc;
    await open(page, thin);
    const bar = page.locator('#prefillbar');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('still need entering');
    await expect(bar).toContainText('Reviewer for issue');
    await expect(bar).toContainText('Lot and DP');
    await expect(bar).toContainText('Full site address');
  });

  test('the banner can be dismissed', async ({ page }) => {
    await open(page, PAYLOAD);
    await page.click('#prefilldismiss');
    await expect(page.locator('#prefillbar')).toBeHidden();
  });

  // A bad link is the one thing an engineer may have on site. It must degrade,
  // never block the app from starting.
  test('a wrong contract version starts the app instead of breaking it', async ({ page }) => {
    await page.goto('/index.html' + hash({ ...PAYLOAD, qb: '999' }));
    await page.waitForSelector('#view-home:not([hidden])');
    const count = await page.evaluate(() => Object.keys(db).length);
    expect(count).toBe(0);
  });

  // A link declaring itself a prefill link still opens a report; the point is
  // that junk inside it raises no error and never blocks the app from starting.
  test('a malformed payload raises no error and still starts the app', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/index.html#qb=1&&&=%%%&cl');
    await page.waitForSelector('#view-editor:not([hidden]), #view-home:not([hidden])');
    expect(errors).toEqual([]);
  });

  // The fragment is scrubbed after use, so a second link into the same tab is
  // a same-document navigation that does not reload the page.
  test('a second link in an already-open tab still opens its job', async ({ page }) => {
    await open(page, PAYLOAD);
    await page.evaluate(h => { location.hash = h; },
      '#' + new URLSearchParams({ ...PAYLOAD, rid: '4901', cl: 'Third Client' }).toString());
    // The editor reopens at Setup, so assert the state rather than the DOM.
    await expect.poll(() => page.evaluate(() => report().d.client)).toBe('Third Client');
    const count = await page.evaluate(() => Object.keys(db).length);
    expect(count).toBe(2);
  });

  test('an ordinary launch is untouched by any of this', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('#view-home:not([hidden])');
    await expect(page.locator('#prefillbar')).toBeHidden();
  });

  test('empty values in the payload do not overwrite defaults', async ({ page }) => {
    // State defaults to NSW in blank(); an empty sa must not blank it.
    await open(page, { ...PAYLOAD, sa: '' });
    const state = await page.evaluate(() => report().d.state);
    expect(state).toBe('NSW');
  });
});

// The office correcting a value after the job was raised is the exact defect
// the engine exists to prevent, so a re-click must surface the difference.
test.describe('updates from Quickbase on a second click', () => {

  test('a changed value is offered, not applied silently', async ({ page }) => {
    await open(page, PAYLOAD);
    await open(page, { ...PAYLOAD, ld: 'Lot 99 DP 9999999' });

    const bar = page.locator('#prefillbar');
    await expect(bar).toContainText('1 value that differs');
    await expect(bar).toContainText('Lot & DP');
    await expect(bar).toContainText('Lot 99 DP 9999999');

    // Not applied until the engineer says so.
    expect(await page.evaluate(() => report().d.lotDp)).toBe(PAYLOAD_LD);
  }, );

  test('applying writes the new values and keeps one report', async ({ page }) => {
    await open(page, PAYLOAD);
    await open(page, { ...PAYLOAD, ld: 'Lot 99 DP 9999999', cc: 'Maitland City Council' });
    await expect(page.locator('#prefillbar')).toContainText('2 values that differ');
    await page.click('#prefillapply');
    const d = await page.evaluate(() => ({ ld: report().d.lotDp, cc: report().d.council }));
    expect(d.ld).toBe('Lot 99 DP 9999999');
    expect(d.cc).toBe('Maitland City Council');
    expect(await page.evaluate(() => Object.keys(db).length)).toBe(1);
  });

  test('declining keeps what the engineer has', async ({ page }) => {
    await open(page, PAYLOAD);
    await open(page, { ...PAYLOAD, ld: 'Lot 99 DP 9999999' });
    await page.click('#prefilldismiss');
    expect(await page.evaluate(() => report().d.lotDp)).toBe(PAYLOAD_LD);
    await expect(page.locator('#prefillbar')).toBeHidden();
  });

  test('an unchanged re-click offers nothing', async ({ page }) => {
    await open(page, PAYLOAD);
    await open(page, PAYLOAD);
    await expect(page.locator('#prefillbar')).toBeHidden();
  });

  test("a value the engineer typed is offered, not overwritten behind them", async ({ page }) => {
    await open(page, PAYLOAD);
    await page.evaluate(() => { report().d.suburb = 'Corrected By Engineer'; saveDb(); });
    await open(page, PAYLOAD);
    await expect(page.locator('#prefillbar')).toContainText('Suburb');
    expect(await page.evaluate(() => report().d.suburb)).toBe('Corrected By Engineer');
  });

  // A blank in the link means "not set in Quickbase", not "clear this".
  test('a blank incoming value never wipes an existing one', async ({ page }) => {
    await open(page, PAYLOAD);
    const thin = { ...PAYLOAD }; thin.cc = '';
    await open(page, thin);
    expect(await page.evaluate(() => report().d.council)).toBe(PAYLOAD.cc);
    await expect(page.locator('#prefillbar')).toBeHidden();
  });
});

test.describe('multi-jurisdiction registrations', () => {

  // Engineers registered in several states hold a separate number in each.
  // Ryan's own block is the worked example, and note that its first line
  // contains commas — which is why these are newline-separated, not
  // comma-separated.
  const REG = 'NSW & TAS BDC0000\nVIC PE0000000\nQLD RPEQ 00000';

  test('a multi-line registration survives the URL fragment intact', async ({ page }) => {
    await open(page, { ...PAYLOAD, ar: REG, aq: 'CPEng, NER, 1234567' });
    const d = await page.evaluate(() => ({ ar: report().d.authorReg, aq: report().d.authorQual }));
    expect(d.ar).toBe(REG);
    // The comma-bearing qualification line must not be split or mangled.
    expect(d.aq).toBe('CPEng, NER, 1234567');
  });

  test('Quickbase CRLF is normalised so no stray carriage return renders', async ({ page }) => {
    await open(page, { ...PAYLOAD, ar: 'NSW BDC0000\r\nVIC PE0000000' });
    const ar = await page.evaluate(() => report().d.authorReg);
    expect(ar).toBe('NSW BDC0000\nVIC PE0000000');
    expect(ar).not.toContain('\r');
  });

  test('each registration prints on its own line in the report', async ({ page }) => {
    await open(page, { ...PAYLOAD, ar: REG });
    await page.click('#previewbtn');
    const html = await page.locator('#rpt').innerHTML();
    // Three jurisdictions, separated by line breaks rather than run together.
    expect(html).toContain('NSW &amp; TAS BDC0000<br>VIC PE0000000<br>QLD RPEQ 00000');
    const text = await page.locator('#rpt').innerText();
    expect(text).toContain('QLD RPEQ 00000');
  });

  test('the ampersand in a registration is escaped, not injected', async ({ page }) => {
    await open(page, { ...PAYLOAD, ar: 'NSW & TAS <script>alert(1)</script>' });
    await page.click('#previewbtn');
    const html = await page.locator('#rpt').innerHTML();
    expect(html).toContain('&amp;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

test.describe('Device handoff QR', () => {

  test('produces a scannable link that round-trips through the same map', async ({ page }) => {
    await open(page, PAYLOAD);
    const url = await page.evaluate(() => buildPrefillUrl(report()));
    expect(url).toContain('#qb=1');

    const parsed = new URLSearchParams(new URL(url).hash.slice(1));
    for (const key of ['jn', 'cl', 'co', 'pd', 'st', 'sb', 'sa', 'pc', 'ld', 'cc',
                       'au', 'aq', 'ar', 'rv', 'rq', 'rr', 'cp', 'ce']) {
      expect(parsed.get(key), `round-trip of "${key}"`).toBe(PAYLOAD[key]);
    }
    expect(parsed.get('ty')).toBe('classification');
    expect(parsed.get('rid')).toBe('4821');
  });

  test('the QR dialog renders an actual code', async ({ page }) => {
    await open(page, PAYLOAD);
    await gotoTab(page, 'Review & issue');
    await page.click('#qrthis');
    await expect(page.locator('#qrdlg')).toBeVisible();
    await expect(page.locator('#qrbox svg')).toBeVisible();
    await page.click('#qrclose');
    await expect(page.locator('#qrdlg')).toBeHidden();
  });

  test('the QR library is vendored, not loaded from a CDN', async ({ page }) => {
    const external = [];
    page.on('request', r => {
      const u = r.url();
      if (!u.startsWith('http://localhost') && !u.startsWith('data:')) external.push(u);
    });
    await open(page, PAYLOAD);
    await gotoTab(page, 'Review & issue');
    await page.click('#qrthis');
    await expect(page.locator('#qrbox svg')).toBeVisible();
    expect(external, 'the app must make no third-party requests').toEqual([]);
  });
});

// The Quickbase table and button may not exist yet, and the engine is used
// standalone regardless. Nothing added for the integration may affect that.
test.describe('inert when the Quickbase side does not exist', () => {

  test('ordinary launch is completely unaffected', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/index.html');
    await page.waitForSelector('#view-home:not([hidden])');
    await expect(page.locator('#prefillbar')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('a report created by hand still works end to end', async ({ page }) => {
    await page.goto('/index.html');
    await page.click('button[data-newtype="classification"]');
    await page.waitForSelector('#view-editor:not([hidden])');
    await page.fill('#f_jobNo', 'AD-MANUAL-1');
    await page.click('#tabrail button:text-is("Client & site ID")');
    await page.fill('#f_client', 'Hand Typed Client');
    await page.click('#previewbtn');
    await expect(page.locator('#rpt')).toContainText('Hand Typed Client');
    const src = await page.evaluate(() => report().source);
    expect(src).toBeNull();
  });

  test('a report saved before this change still opens', async ({ page }) => {
    await page.goto('/index.html');
    // A report with no `source` key at all, as pre-existing saved data has.
    await page.evaluate(() => {
      const r = blank('classification');
      delete r.source;
      r.d.client = 'Legacy Report';
      db[r.id] = r; saveDb(); renderHome();
    });
    await page.reload();
    await page.waitForSelector('#view-home:not([hidden])');
    await page.click('ul.reports li button[data-open]');
    await page.waitForSelector('#view-editor:not([hidden])');
    const client = await page.evaluate(() => report().d.client);
    expect(client).toBe('Legacy Report');
  });

  test('the app survives the QR library failing to load', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/vendor/qrcode.min.js', r => r.abort());
    await page.goto('/index.html');
    await page.click('button[data-newtype="classification"]');
    await page.waitForSelector('#view-editor:not([hidden])');
    await page.click('#tabrail button:text-is("Review & issue")');
    await page.click('#qrthis');
    // Degrades to a message, does not throw and does not open an empty dialog.
    await expect(page.locator('.toast')).toContainText('Export');
    await expect(page.locator('#qrdlg')).toBeHidden();
    expect(errors).toEqual([]);
  });
});
