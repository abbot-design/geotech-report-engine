// tests/fixtures/quickbase-payload.js
//
// The canonical Quickbase payload: what the formula-URL button on a Geotech
// Reports record puts in the URL fragment when an engineer clicks it. Every
// key is defined in the field-map table of docs/qb-contract.md, and the
// integration spec checks that this file, that table and PREFILL_MAP in
// index.html still agree.
//
// Values are invented but shaped like the real thing: a multi-word client,
// a contact with phone and email, an NSW address, NER registrations.

const PAYLOAD = {
  qb:  '1',              // contract version; anything else starts the app unprefilled
  ty:  'classification', // report type: desktop | classification | comprehensive
  rid: '4821',           // Quickbase Record ID#, kept as provenance in report.source
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

// Payload key -> the DOM id of the input it must land in. qb, ty and rid are
// not fields; they steer the import and are asserted separately.
const LANDS_IN = {
  jn: '#f_jobNo',   cl: '#f_client',   co: '#f_careOf', pd: '#f_projectDesc',
  cp: '#f_clientPhone', ce: '#f_clientEmail',
  st: '#f_street',  sb: '#f_suburb',   sa: '#f_state',  pc: '#f_postcode',
  ld: '#f_lotDp',   cc: '#f_council',  au: '#f_author',
  aq: '#f_authorQual',   ar: '#f_authorReg',
  rv: '#f_reviewer',     rq: '#f_reviewerQual', rr: '#f_reviewerReg',
};

// Encode a payload the way the Quickbase formula does: a URL fragment of
// key=value pairs.
const hash = (obj) => '#' + new URLSearchParams(obj).toString();

// Launch the engine as if the Quickbase button had been clicked.
async function openPrefilled(page, payload) {
  await page.goto('/index.html' + hash(payload));
  await page.waitForSelector('#view-editor:not([hidden])');
}

module.exports = { PAYLOAD, LANDS_IN, hash, openPrefilled };
