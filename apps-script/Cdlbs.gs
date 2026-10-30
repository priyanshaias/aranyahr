/**
 * DL / CDL, Ban Sahayak, Aranya Sathi and DEO — the CDL+BS API inside this wrapper. Sign-in, sign-up and users are in Core.gs.
 * Divisions check their DLs / CDLs (pre-filled from the July 2026 returns) and enter their Ban Sahayaks, Aranya Sathis and DEOs.
 * Edits save straight in, one person at a time; new DLs / CDLs and removals wait for an admin; the DFO certifies each list.
 * Every change is written to the Change Log (in the CDL+BS sheet, for all four cadres) with who made it.
 * Data: "AranyaHR · CDL+BS" — tabs DL-CDL, Ban Sahayak, Change Log, Certificates, Lists;
 * "AranyaHR · AS+DEO" — tabs Aranya Sathi, DEO (the same columns as DL-CDL).
 * A division user can change only their own division.
 */
const Cdlbs = (() => {
// the same services, with this module's own key prefix (Core.gs); looked up when used, so the order of the files does not matter
const CacheService = { getScriptCache: () => prefixedCache_('cdl:').getScriptCache() };
const PropertiesService = { getScriptProperties: () => prefixedProps_('cdl:').getScriptProperties() };

const CONFIG = { TZ: 'Asia/Kolkata', TAB: { CDL: 'DL-CDL', BS: 'Ban Sahayak', AS: 'Aranya Sathi', DEO: 'DEO' }, LOG: 'Change Log', CERT: 'Certificates', LISTS: 'Lists', USERS: 'Users' };
const CADRES = ['CDL', 'BS', 'AS', 'DEO'];
const CACHE_SEC = 6 * 3600;
// the earlier Users tab of the CDL+BS sheet, read once by hrSetup to move its users to AranyaHR
const USER_HEADERS = ['Email', 'Circle', 'Division', 'Name', 'Designation', 'Phone', 'Status', 'Signed up on', 'Last sign-in', 'Salt', 'Password hash'];

// [key, sheet header]; the order is the column order of both people tabs. Columns are found by heading, so moving one is safe.
const COLS = [
  ['id', 'ID'], ['circle', 'Circle'], ['division', 'Division'], ['name', 'Name'], ['mode', 'Mode of engagement'], ['agency', 'Agency name'],
  ['date', 'Engagement date'], ['district', 'District'], ['range', 'Range (or Division HQ)'], ['beat', 'Beat'], ['place', 'Place of work'],
  ['placeName', 'Name of the place'], ['duty', 'Main duty'], ['other', 'Other duties'], ['details', 'Duty details'], ['pay', 'Monthly pay (Rs)'],
  ['remarks', 'Remarks'], ['ver', 'Verification'], ['state', 'Status'], ['flag', 'Problem'], ['removal', 'Removal request'],
  ['updOn', 'Last updated on'], ['updBy', 'Last updated by'], ['orig', 'As in the return (do not edit)'],
];
const LABEL = { name: 'Name', mode: 'Mode of engagement', agency: 'Agency name', date: 'Engagement date', district: 'District', range: 'Range',
  beat: 'Beat', place: 'Place of work', placeName: 'Name of the place', duty: 'Main duty', other: 'Other duties', details: 'Duty details',
  pay: 'Monthly pay, July 2026 (Rs)', remarks: 'Remarks' };
const EDITABLE = Object.keys(LABEL);
const LOG_HEADERS = ['When', 'Username', 'By', 'Circle', 'Division', 'Cadre', 'ID', 'Person', 'Action', 'Field', 'Old value', 'New value'];
const CERT_HEADERS = ['Division', 'Cadre', 'Certified by', 'Designation', 'On', 'Entered by'];
// Status column: words in the sheet, codes in the website
const STATE = { active: 'Working', 'add-pending': 'New - awaiting approval', 'remove-pending': 'Removal pending', removed: 'Removed' };
const STATE_OF = Object.keys(STATE).reduce((a, k) => (a[STATE[k]] = k, a), {});

// the same rules as store.js in the website
const DUTIES = ['Cleaning/Sweeping/Maintenance', 'Nursery Operations', 'Timber Depot', 'Driver', 'Mali/Gardener',
  'Forest Protection and Patrolling', 'Human-Animal Conflict Management', 'Night Guard/Security', 'Others'];
const HQ = 'Division HQ', BS_PAY = 12000;
const REQUIRED = { CDL: ['name', 'mode', 'date', 'district', 'range', 'place', 'duty', 'pay'], BS: ['name', 'date', 'district', 'range', 'place', 'duty'] };
REQUIRED.AS = REQUIRED.DEO = REQUIRED.CDL;
const VAGUE = /^\s*(do|d\.o\.?|various|variouss|misc\.?|miscellaneous|other|others|field work|field duty|forestry work|general|all work|-)?\s*$/i;
const CADRE_NAME = { CDL: 'DL / CDL', BS: 'Ban Sahayak', AS: 'Aranya Sathi', DEO: 'DEO' };

/* ============================================================ auth (sign-in is in Core.gs) */

const who_ = u => u.name + (u.desig ? ' (' + u.desig + ')' : '');
/** A division user may change only their own division (Core lets only division users and admins change anything). */
function mayEdit_(user, division) {
  if (user.isAdmin || !user.division || user.division === division) return;
  throw new Error('You can change only ' + user.division + '. ' + division + ' is for its own users.');
}

/* ============================================================ helpers */

function isDate_(v) { return Object.prototype.toString.call(v) === '[object Date]'; }
function fmt_(v) {
  if (v === null || v === undefined) return '';
  if (isDate_(v)) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, CONFIG.TZ, 'dd-MM-yyyy');
  return String(v).trim();
}
function fmtTs_(v) { return isDate_(v) ? Utilities.formatDate(v, CONFIG.TZ, 'dd-MM-yyyy HH:mm') : fmt_(v); }
// seconds too, so two saves in the same minute are still told apart
function now_() { return Utilities.formatDate(new Date(), CONFIG.TZ, 'dd-MM-yyyy HH:mm:ss'); }
function cadreOf_(id) { const m = /^(BS|AS|DEO)-/.exec(String(id)); return m ? m[1] : 'CDL'; }
function err_(msg, conflict) { const e = new Error(msg); e.conflict = !!conflict; return e; }
/** "dd-mm-yyyy HH:mm" -> sortable "yyyymmddHHmm" */
function sortKey_(s) { const m = /^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}))?/.exec(s || ''); return m ? m[3] + m[2] + m[1] + (m[4] || '00') + (m[5] || '00') : ''; }

/** Value as the website keeps it (same as fmt in store.js), for comparing and logging. */
function show_(f, v) { return f === 'other' ? (v || []).join(', ') : v == null ? '' : String(v); }

/* ============================================================ sheet */

/**
 * Run once from the editor (and again after updating the script): checks the sheet, logs its link and the numbers in it,
 * fills the cache, and sets up the 10-minute timer that keeps the cache filled (warm).
 */
function cdlSetup() {
  Logger.log('CDL+BS sheet: ' + ss_().getUrl() + ' · AS+DEO sheet: ' + ss2_().getUrl());
  Logger.log(CADRES.map(c => CADRE_NAME[c] + ': ' + readTab_(c).rows.length).join(' · ') + ' · divisions: ' + divisions_(true).length);
  buildAll_();
  Logger.log('Cache filled.');
}
/** Every 10 minutes (Core's timer): refills the cache before it expires, so no one waits for the whole sheet to be read. */
function warm() {
  if (gzGet_('meta') && CacheService.getScriptCache().get('warm')) return;
  buildAll_();
}

/** The CDL+BS sheet and the AS+DEO sheet, each opened once per request. Missing tabs are added. */
let SS_ = null, SS2_ = null;
function ss_() {
  return SS_ || (SS_ = tabs_(SpreadsheetApp.openById(sheetId_('CDL')), [[CONFIG.TAB.CDL, COLS.map(c => c[1])], [CONFIG.TAB.BS, COLS.map(c => c[1])],
    [CONFIG.LOG, LOG_HEADERS], [CONFIG.CERT, CERT_HEADERS], [CONFIG.LISTS, ['Circle', 'Division']]]));
}
function ss2_() {
  const cols = COLS.filter(c => c[0] !== 'orig').map(c => c[1]);   // no return to compare against
  return SS2_ || (SS2_ = tabs_(SpreadsheetApp.openById(sheetId_('ASDEO')), [[CONFIG.TAB.AS, cols], [CONFIG.TAB.DEO, cols]]));
}
/** Adds any missing tab with its headings. */
function tabs_(ss, want) {
  if (want.every(w => ss.getSheetByName(w[0]))) return ss;
  want.forEach(([name, headers]) => {
    if (ss.getSheetByName(name)) return;
    const first = ss.getSheets()[0];
    const sh = ss.getSheets().length === 1 && first.getLastRow() === 0 && want.every(w => w[0] !== first.getName()) ? first.setName(name) : ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setWrap(true);
    sh.setFrozenRows(1);
  });
  return ss;
}
function tab_(name) { return (name === CONFIG.TAB.AS || name === CONFIG.TAB.DEO ? ss2_() : ss_()).getSheetByName(name); }

/** All rows of one people tab, each with _r (its row number in the sheet). */
function readTab_(cadre) {
  const sh = tab_(CONFIG.TAB[cadre]), v = sh.getDataRange().getValues();
  const head = (v[0] || []).map(h => String(h).trim()), at = COLS.map(c => head.indexOf(c[1]));
  const rows = [];
  for (let r = 1; r < v.length; r++) { const o = rowObj_(cadre, at, v[r], r + 1); if (o.id) rows.push(o); }
  return { sh, head, rows };
}
function rowObj_(cadre, at, row, r) {
  const o = { cadre, _r: r };
  COLS.forEach((c, j) => { o[c[0]] = at[j] < 0 ? '' : (c[0] === 'updOn' ? fmtTs_(row[at[j]]) : fmt_(row[at[j]])); });
  return fromSheet_(o);
}
/** One person by ID without reading the whole tab: the ID column, then that one row. Same shape as readTab_. */
function findPerson_(id) {
  const cadre = cadreOf_(id), sh = tab_(CONFIG.TAB[cadre]), last = sh.getLastRow();
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const t = { sh, head, rows: [] };
  if (last < 2) return t;
  const ids = sh.getRange(2, head.indexOf('ID') + 1, last - 1, 1).getValues(), at = COLS.map(c => head.indexOf(c[1]));
  for (let i = 0; i < ids.length; i++) {
    if (fmt_(ids[i][0]) === id) { t.rows.push(rowObj_(cadre, at, sh.getRange(i + 2, 1, 1, head.length).getValues()[0], i + 2)); break; }
  }
  return t;
}
function fromSheet_(o) {
  o.other = o.other ? o.other.split(/\s*;\s*/).filter(Boolean) : [];
  o.pay = o.pay === '' ? null : Number(String(o.pay).replace(/[^\d.]/g, '')) || null;
  o.state = STATE_OF[o.state] || o.state || 'active';
  o.ver = o.ver ? 'Confirmed' : '';
  o.removal = o.removal ? safeJson_(o.removal) : null;
  o.orig = o.orig ? safeJson_(o.orig) : null;
  if (o.cadre === 'BS') { o.pay = BS_PAY; o.mode = 'Direct'; }
  return o;
}
function safeJson_(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function toSheet_(o, head) {
  const val = {
    other: (o.other || []).join('; '), pay: o.pay == null ? '' : o.pay, ver: o.ver ? 'Verified' : '', state: STATE[o.state] || o.state,
    removal: o.removal ? JSON.stringify(o.removal) : '', orig: o.orig ? JSON.stringify(o.orig) : '' };
  const row = head.map(() => '');
  COLS.forEach(c => { const i = head.indexOf(c[1]); if (i >= 0) row[i] = c[0] in val ? val[c[0]] : (o[c[0]] == null ? '' : o[c[0]]); });
  return row;
}
/** Writes rows that already exist in the sheet (each by its _r) and appends new ones. Everything is plain text. */
function writeRows_(t, rows) {
  rows.forEach(o => {
    const values = [toSheet_(o, t.head)];
    if (!o._r) o._r = t.sh.getLastRow() + 1;
    t.sh.getRange(o._r, 1, 1, t.head.length).setNumberFormat('@').setValues(values);
  });
}
/** What the website gets: everything except the row number. */
function pub_(o) { const p = Object.assign({}, o); delete p._r; return p; }

/** Circles and divisions from the Lists tab (quick: the people tabs are not read). withPeople: also any division that has people. */
function divisions_(withPeople) {
  const out = [], seen = {};
  const add = (c, d) => { if (c && d && !seen[d]) { seen[d] = 1; out.push({ circle: c, division: d }); } };
  tab_(CONFIG.LISTS).getDataRange().getValues().slice(1).forEach(r => add(fmt_(r[0]), fmt_(r[1])));
  if (withPeople) CADRES.forEach(c => readTab_(c).rows.forEach(r => add(r.circle, r.division)));
  return out;
}

function certs_() {
  const v = tab_(CONFIG.CERT).getDataRange().getValues(), out = {};
  v.slice(1).forEach(r => { const d = fmt_(r[0]); if (d) out[d + '|' + (fmt_(r[1]) || 'CDL')] = { name: fmt_(r[2]), desig: fmt_(r[3]), on: fmtTs_(r[4]), by: fmt_(r[5]) }; });
  return out;
}
const locked_ = (div, cadre) => !!certs_()[div + '|' + cadre];

function log_rows_(user, entries) {
  if (!entries.length) return;
  const when = now_(), lg = tab_(CONFIG.LOG);
  const by = (user.name || '') + (user.desig ? ' (' + user.desig + (user.division ? ', ' + user.division : '') + ')' : '');
  const rows = entries.map(x => [when, user.username || '', by, x.p ? x.p.circle : x.circle || '', x.p ? x.p.division : x.division || '',
    CADRE_NAME[x.p ? x.p.cadre : x.cadre] || '', x.p ? x.p.id : '', x.p ? x.p.name : '', x.type, x.field || '', x.old || '', x.new || '']);
  lg.getRange(lg.getLastRow() + 1, 1, rows.length, LOG_HEADERS.length).setNumberFormat('@').setValues(rows);
}

/* ============================================================ cache */

// Each division's people and the summary are cached (gzipped, split into pieces under the 100 KB limit).
// A change updates the cached division and its line of the summary instead of throwing them away, so reads stay quick.
const PIECE = 90000;
function gzPut_(key, obj) {
  const s = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(obj), 'application/json')).getBytes());
  const parts = {}, n = Math.ceil(s.length / PIECE) || 1;
  for (let i = 0; i < n; i++) parts[key + '#' + i] = s.slice(i * PIECE, (i + 1) * PIECE);
  parts[key] = 'parts:' + n;
  CacheService.getScriptCache().putAll(parts, CACHE_SEC);
}
function gzGet_(key) {
  const c = CacheService.getScriptCache(), head = c.get(key);
  if (!head || head.indexOf('parts:') !== 0) return null;
  const keys = []; for (let i = 0; i < +head.slice(6); i++) keys.push(key + '#' + i);
  const got = c.getAll(keys); if (keys.some(k => !got[k])) return null;
  try { return JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(keys.map(k => got[k]).join('')), 'application/x-gzip')).getDataAsString()); } catch (e) { return null; }
}
/** Reads both people tabs once and caches every division and the summary. */
function buildAll_() {
  const divs = divisions_(), seen = {}, by = {};
  divs.forEach(d => { seen[d.division] = 1; by[d.division] = []; });
  CADRES.forEach(c => readTab_(c).rows.forEach(p => {
    if (!seen[p.division]) { seen[p.division] = 1; divs.push({ circle: p.circle, division: p.division }); by[p.division] = []; }
    if (p.state !== 'removed') by[p.division].push(pub_(p));
  }));
  divs.forEach(d => gzPut_('div|' + d.division, by[d.division]));
  const m = { divisions: divs.map(d => Object.assign({ circle: d.circle, division: d.division }, summary_(by[d.division]))), certs: certs_() };
  gzPut_('meta', m);
  CacheService.getScriptCache().put('warm', '1', CACHE_SEC - 3600);
  return { m, by };
}
// for the dashboard: what each division's people look like, added up (same as dashX in store.js)
const TRACK_ = ['name', 'mode', 'agency', 'date', 'district', 'range', 'beat', 'place', 'placeName', 'duty', 'other', 'details', 'pay', 'remarks'];
const payBand_ = n => n < 6000 ? '<6k' : n < 8000 ? '6-8k' : n < 10000 ? '8-10k' : n < 12000 ? '10-12k' : n < 15000 ? '12-15k' : n < 20000 ? '15-20k' : '20k+';
const x0_ = () => ({ other: {}, place: {}, at: { HQ: 0, Range: 0, none: 0 }, years: {}, pay: {}, paySum: 0, payN: 0, mode: {}, miss: {}, vday: {}, changed: 0 });
const inc_ = (o, k) => { o[k] = (o[k] || 0) + 1; };
/** A division's line of the summary, from its people (every cadre). */
function summary_(rows) {
  const o = { last: {}, duty: {}, blank: {}, pending: 0, x: {} };
  CADRES.forEach(c => { o[c] = count0_(); o.last[c] = ''; o.duty[c] = {}; o.blank[c] = 0; o.x[c] = x0_(); });
  rows.forEach(p => {
    const c = CADRES.indexOf(p.cadre) >= 0 ? p.cadre : 'CDL', s = status_(p); if (s === 'removed') return;
    const k = o[c]; k.all++; k[s]++; if (p.state === 'add-pending') k.added++;
    if (p.state === 'add-pending' || p.state === 'remove-pending') o.pending++;
    if (s !== 'remove') {
      if (p.duty) o.duty[c][p.duty] = (o.duty[c][p.duty] || 0) + 1; else o.blank[c]++;
      const x = o.x[c], y = /(\d{4})$/.exec(p.date || '');
      (p.other || []).forEach(d => inc_(x.other, d));
      inc_(x.place, p.place || '');
      x.at[p.range === HQ ? 'HQ' : p.range ? 'Range' : 'none']++;
      if (y) inc_(x.years, y[1]);
      if (p.pay) { x.paySum += p.pay; x.payN++; inc_(x.pay, payBand_(p.pay)); }
      inc_(x.mode, p.mode || '');
      missing_(p).forEach(f => inc_(x.miss, f));
      if (p.ver && p.updOn) inc_(x.vday, p.updOn.slice(0, 10));
      if (p.orig && TRACK_.some(f => show_(f, p.orig[f]) !== show_(f, p[f]))) x.changed++;
    }
    if (sortKey_(p.updOn) > sortKey_(o.last[c])) o.last[c] = p.updOn;
  });
  CADRES.forEach(c => { o[c].active = o[c].all - o[c].remove; });
  return o;
}
/** After a change: puts the changed people into the cached division and updates its line of the summary. */
function refreshCache_(division, changed) {
  const rows = gzGet_('div|' + division);
  if (!rows) { CacheService.getScriptCache().remove('meta'); return; }   // rebuilt on the next read
  changed.forEach(p => {
    const q = pub_(p), i = rows.findIndex(r => r.id === q.id);
    if (q.state === 'removed') { if (i >= 0) rows.splice(i, 1); } else if (i >= 0) rows[i] = q; else rows.push(q);
  });
  gzPut_('div|' + division, rows);
  const m = gzGet_('meta'), d = m && m.divisions.find(x => x.division === division);
  if (!d) { CacheService.getScriptCache().remove('meta'); return; }
  Object.assign(d, summary_(rows));
  gzPut_('meta', m);
}
/** After certifying or reopening: the certificates in the cached summary. */
function refreshCerts_() { const m = gzGet_('meta'); if (m) { m.certs = certs_(); gzPut_('meta', m); } }

/* ============================================================ rules (same as store.js) */

const blank_ = v => v == null || (Array.isArray(v) ? !v.length : !String(v).trim());
function missing_(p) {
  const m = (REQUIRED[p.cadre] || REQUIRED.CDL).filter(f => blank_(p[f]));
  if (p.duty === 'Others' && (blank_(p.details) || VAGUE.test(p.details) || String(p.details).trim().length < 10)) m.push('details');
  return m;
}
function status_(p) {
  if (p.state === 'removed') return 'removed';
  if (p.state === 'remove-pending') return 'remove';
  if (p.flag) return 'problem';
  if (p.ver) return 'confirmed';
  return missing_(p).length ? 'missing' : 'ready';
}

/* ============================================================ actions */

/** Summary for the division picker, circle pages and the dashboard. */
function meta_(body, user) {
  const m = gzGet_('meta') || buildAll_().m;
  // state totals, added up from the divisions' lines
  const duty = {}, blank = {};
  let pending = 0;
  CADRES.forEach(c => { duty[c] = {}; blank[c] = 0; });
  m.divisions.forEach(d => {
    pending += d.pending || 0;
    CADRES.forEach(c => { blank[c] += (d.blank[c] || 0); Object.keys(d.duty[c] || {}).forEach(k => { duty[c][k] = (duty[c][k] || 0) + d.duty[c][k]; }); });
  });
  const out = { user, certs: m.certs, duty, blank, pending,
    divisions: m.divisions.map(d => { const o = { circle: d.circle, division: d.division, last: d.last, duty: d.duty, blank: d.blank, x: d.x }; CADRES.forEach(c => o[c] = d[c] || count0_()); return o; }) };
  if (user.isAdmin) {   // division users of AranyaHR (Core.gs), counted under this sheet's division names
    out.userCounts = {};
    readUsers_().rows.forEach(r => { if (r.status === 'Active' && (r.level || 'Division') === 'Division') { const d = nameIn_('cdl', r.circle, r.division).division; out.userCounts[d] = (out.userCounts[d] || 0) + 1; } });
  }
  return out;
}
function count0_() { return { all: 0, missing: 0, ready: 0, problem: 0, confirmed: 0, remove: 0, added: 0, changed: 0, active: 0 }; }

/** One division: both cadres and its certificates. */
function load_(body) {
  const division = String(body.division || '');
  if (!division) throw new Error('Choose a division.');
  const rows = gzGet_('div|' + division) || buildAll_().by[division] || [];
  const certs = certs_(), mine = {};
  CADRES.forEach(c => { if (certs[division + '|' + c]) mine[c] = certs[division + '|' + c]; });
  return { division, rows, certs: mine };
}

/**
 * Runs fn(t, p) on one person under the script lock: t is their tab, p their row. fn returns log entries.
 * base: the person's "Last updated on" as the website last saw it; if someone saved after that, nothing is written.
 */
function withPerson_(id, base, user, fn) {
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const cadre = cadreOf_(id), t = findPerson_(id), p = t.rows[0];
    if (!p) throw err_('This person is no longer in the list. The page has been refreshed.', true);
    mayEdit_(user, p.division);
    if (base != null && String(base) !== String(p.updOn || ''))
      throw err_(p.name + ' was changed by ' + (p.updBy || 'someone') + ' at ' + p.updOn + '. The list has been refreshed; please check and try again.', true);
    if (locked_(p.division, cadre)) throw new Error('This list is certified and locked.');
    const before = JSON.stringify(p), entries = fn(t, p) || [];
    if (JSON.stringify(p) !== before) { p.updOn = now_(); p.updBy = who_(user); writeRows_(t, [p]); refreshCache_(p.division, [p]); }
    log_rows_(user, entries);
    return { rows: [pub_(p)] };
  } finally { lock.releaseLock(); }
}

/** Saves changed fields. A verified person stays verified only while still complete. */
function update_(body, user) {
  const ch = body.ch || {};
  return withPerson_(String(body.id), body.base, user, (t, p) => {
    const out = [];
    Object.keys(ch).forEach(f => {
      if (EDITABLE.indexOf(f) < 0) return;
      let v = ch[f];
      if (f === 'pay') v = v === '' || v == null ? null : Number(v);
      else if (f === 'other') v = (Array.isArray(v) ? v : []).map(String).filter(x => DUTIES.indexOf(x) >= 0 && x !== (ch.duty || p.duty));
      else v = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
      if (f === 'duty' && v && DUTIES.indexOf(v) < 0) throw new Error('Unknown duty: ' + v);
      if (f === 'date' && v && !/^(\d{2}-\d{2}-\d{4}|\d{4})$/.test(v)) throw new Error('Engagement date: use dd-mm-yyyy or just the year');
      if (p.cadre === 'BS' && (f === 'pay' || f === 'mode' || f === 'agency')) return;
      if (show_(f, p[f]) === show_(f, v)) return;
      out.push({ p, type: 'Edit', field: LABEL[f], old: show_(f, p[f]), new: show_(f, v) });
      p[f] = v;
    });
    if (p.other && p.duty) p.other = p.other.filter(x => x !== p.duty);
    if (out.length && p.ver && missing_(p).length) { p.ver = ''; out.push({ p, type: 'Verification removed', old: 'Verified' }); }
    return out;
  });
}

/** Verifies everyone in ids who is complete and has no open problem. */
function confirm_(body, user) {
  const ids = (body.ids || []).map(String);
  if (!ids.length) return { rows: [], done: 0, skipped: 0 };
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const out = [], log = [], divs = {}, certs = certs_();
    let done = 0, skipped = 0;
    CADRES.forEach(cadre => {
      const mine = ids.filter(id => cadreOf_(id) === cadre); if (!mine.length) return;
      const t = readTab_(cadre), changed = [];
      mine.forEach(id => {
        const p = t.rows.find(r => r.id === id); if (!p || certs[p.division + '|' + cadre]) return;
        mayEdit_(user, p.division);
        const s = status_(p);
        if (s === 'ready') { p.ver = 'Confirmed'; p.updOn = now_(); p.updBy = who_(user); log.push({ p, type: 'Verified', new: 'Verified' }); changed.push(p); done++; divs[p.division] = 1; }
        else if (s !== 'confirmed') skipped++;
        out.push(pub_(p));
      });
      writeRows_(t, changed);
      Object.keys(divs).forEach(d => refreshCache_(d, changed.filter(p => p.division === d)));
    });
    log_rows_(user, log);
    return { rows: out, done, skipped };
  } finally { lock.releaseLock(); }
}

function unconfirm_(body, user) {
  return withPerson_(String(body.id), null, user, (t, p) => {
    if (!p.ver) return [];
    p.ver = ''; return [{ p, type: 'Verification removed', old: 'Verified' }];
  });
}

/** "Not working": a new person not yet approved is simply withdrawn; anyone else waits for the admin. */
function notWorking_(body, user) {
  const reason = String(body.reason || '').trim(), remark = String(body.remark || '').trim();
  if (!reason) throw new Error('Choose a reason.');
  return withPerson_(String(body.id), null, user, (t, p) => {
    if (p.state === 'add-pending') { p.state = 'removed'; return [{ p, type: 'New person withdrawn', new: reason }]; }
    if (p.state !== 'active') return [];
    p.state = 'remove-pending'; p.removal = { reason, remark, by: who_(user), on: now_() };
    return [{ p, type: 'Marked not working', field: 'Reason', new: reason + (remark ? ' (' + remark + ')' : '') }];
  });
}
function undoRemoval_(body, user) {
  return withPerson_(String(body.id), null, user, (t, p) => {
    if (p.state !== 'remove-pending') return [];
    p.state = 'active'; p.removal = null; return [{ p, type: 'Removal withdrawn' }];
  });
}

/** Double entry: either both are real people, or this one is the duplicate (then it waits for the admin to remove). */
function resolveFlag_(body, user) {
  const id = String(body.id), dup = !!body.dup;
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const cadre = cadreOf_(id), t = readTab_(cadre), p = t.rows.find(r => r.id === id);
    if (!p) throw err_('This person is no longer in the list.', true);
    mayEdit_(user, p.division);
    if (locked_(p.division, cadre)) throw new Error('This list is certified and locked.');
    const twins = t.rows.filter(x => x.flag && x.division === p.division && x.name === p.name && x.date === p.date);
    twins.forEach(x => { x.flag = ''; if (x !== p) { x.updOn = now_(); x.updBy = who_(user); } });
    p.updOn = now_(); p.updBy = who_(user);
    const log = [];
    if (dup && p.state === 'active') { p.state = 'remove-pending'; p.removal = { reason: 'Duplicate entry', remark: '', by: who_(user), on: now_() }; log.push({ p, type: 'Marked not working', field: 'Reason', new: 'Duplicate entry' }); }
    else log.push({ p, type: 'Problem resolved', new: 'Different people' });
    const changed = twins.indexOf(p) < 0 ? twins.concat(p) : twins;
    writeRows_(t, changed);
    refreshCache_(p.division, changed);
    log_rows_(user, log);
    return { rows: twins.concat(twins.indexOf(p) < 0 ? [p] : []).map(pub_) };
  } finally { lock.releaseLock(); }
}

/** A DL / CDL not in the list waits for the admin; Ban Sahayaks, Aranya Sathis and DEOs count straight away. The website picks the ID. */
function add_(body, user) {
  const d = body.person || {}, cadre = CADRES.indexOf(d.cadre) >= 0 ? d.cadre : 'CDL';
  const id = String(d.id || '');
  if (!new RegExp('^' + (cadre === 'CDL' ? 'NEW' : cadre) + '-[0-9A-F]{8}$').test(id)) throw new Error('Bad ID for a new person.');
  const name = String(d.name || '').replace(/\s+/g, ' ').trim();
  if (name.length < 3) throw new Error('Write the name.');
  const div = divisions_().find(x => x.division === d.division);
  if (!div) throw new Error('Unknown division: ' + d.division);
  mayEdit_(user, div.division);
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    if (locked_(div.division, cadre)) throw new Error('This list is certified and locked.');
    const t = findPerson_(id);
    if (t.rows.length) return { rows: [pub_(t.rows[0])] };   // sent twice
    const p = { id, cadre, circle: div.circle, division: div.division, name, ver: '', state: cadre === 'CDL' ? 'add-pending' : 'active', flag: '', removal: null, orig: null,
      updOn: now_(), updBy: who_(user) };
    EDITABLE.forEach(f => { if (f !== 'name') p[f] = f === 'other' ? (d.other || []).filter(x => DUTIES.indexOf(x) >= 0) : f === 'pay' ? (d.pay == null || d.pay === '' ? null : Number(d.pay)) : String(d[f] || '').trim(); });
    if (cadre === 'BS') Object.assign(p, { mode: 'Direct', agency: '', pay: BS_PAY });
    writeRows_(t, [p]);
    refreshCache_(p.division, [p]);
    log_rows_(user, [{ p, type: 'Added', new: cadre === 'CDL' ? 'New person' : CADRE_NAME[cadre] }]);
    return { rows: [pub_(p)] };
  } finally { lock.releaseLock(); }
}

/** The DFO certifies one cadre's list of a division once everyone working is verified. */
function certify_(body, user) {
  const division = String(body.division || ''), cadre = CADRES.indexOf(body.cadre) >= 0 ? body.cadre : 'CDL';
  const name = String(body.name || '').trim(), desig = String(body.desig || '').trim();
  if (!name || !desig) throw new Error('Write the name and designation of the DFO.');
  mayEdit_(user, division);
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    if (locked_(division, cadre)) throw new Error('Already certified.');
    const mine = (gzGet_('div|' + division) || readTab_(cadre).rows).filter(p => p.division === division && (p.cadre || 'CDL') === cadre && p.state !== 'removed');
    const active = mine.filter(p => p.state !== 'remove-pending');
    if (!active.length || active.some(p => status_(p) !== 'confirmed')) throw new Error('Verify everyone first.');
    const cert = { name, desig, on: now_(), by: who_(user) };
    const sh = tab_(CONFIG.CERT);
    sh.getRange(sh.getLastRow() + 1, 1, 1, CERT_HEADERS.length).setNumberFormat('@').setValues([[division, cadre, name, desig, cert.on, who_(user)]]);
    log_rows_(user, [{ division, circle: mine[0].circle, cadre, type: CADRE_NAME[cadre] + ' list certified', new: name + ', ' + desig }]);
    refreshCerts_();
    return { cert };
  } finally { lock.releaseLock(); }
}
function reopen_(body, user) {
  const division = String(body.division || ''), cadre = CADRES.indexOf(body.cadre) >= 0 ? body.cadre : 'CDL';
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const sh = tab_(CONFIG.CERT), v = sh.getDataRange().getValues();
    for (let r = v.length - 1; r >= 1; r--) if (fmt_(v[r][0]) === division && (fmt_(v[r][1]) || 'CDL') === cadre) sh.deleteRow(r + 1);
    log_rows_(user, [{ division, cadre, type: CADRE_NAME[cadre] + ' list reopened' }]);
    refreshCerts_();
    return {};
  } finally { lock.releaseLock(); }
}

/** Admins: new people and removals waiting for a decision. */
function pending_() {
  const rows = [];
  CADRES.forEach(c => readTab_(c).rows.forEach(p => { if (p.state === 'add-pending' || p.state === 'remove-pending') rows.push(pub_(p)); }));
  return { rows };
}
function decide_(body, user) {
  return withPerson_(String(body.id), null, user, (t, p) => {
    const ok = !!body.approve;
    if (p.state === 'add-pending') { p.state = ok ? 'active' : 'removed'; return [{ p, type: ok ? 'Addition approved' : 'Addition rejected' }]; }
    if (p.state === 'remove-pending') { p.state = ok ? 'removed' : 'active'; if (!ok) p.removal = null; return [{ p, type: ok ? 'Removal approved' : 'Removal rejected' }]; }
    return [];
  });
}

/** Admins: the change log, newest first (up to 1000 entries). */
function log_() {
  const sh = tab_(CONFIG.LOG), last = sh.getLastRow(), n = Math.min(1000, last - 1);
  if (n < 1) return { rows: [], total: 0 };
  const v = sh.getRange(last - n + 1, 1, n, LOG_HEADERS.length).getValues().reverse();
  const cadre = CADRES.reduce((a, c) => (a[CADRE_NAME[c]] = c, a), {});
  return { total: last - 1, rows: v.map(x => ({ on: fmtTs_(x[0]), username: fmt_(x[1]), by: fmt_(x[2]), circle: fmt_(x[3]), division: fmt_(x[4]), cadre: cadre[fmt_(x[5])] || '',
    id: fmt_(x[6]), name: fmt_(x[7]), type: fmt_(x[8]), field: fmt_(x[9]), old: fmt_(x[10]), new: fmt_(x[11]) })) };
}

/* ============================================================ for Core: home page, overview, divisions, users moved */

function people_(circle, division) {
  return load_({ division }).rows.filter(p => p.state !== 'removed').map(p => ({ cadre: p.cadre, id: p.id, name: p.name,
    desig: CADRE_NAME[p.cadre] || '', range: p.range === HQ ? 'Div HQ' : p.range, place: p.beat || p.placeName || '', status: status_(p) }));
}
function counts_() {
  const m = gzGet_('meta') || buildAll_().m, out = [];
  // done verified · mid ready to verify · wait removal waiting for the admin · todo missing details or a problem
  m.divisions.forEach(d => CADRES.forEach(c => {
    const k = d[c]; if (!k || !k.all) return;
    out.push(Object.assign(countRow_(d.circle, d.division, c), { total: k.all, done: k.confirmed, mid: k.ready, wait: k.remove, todo: k.missing + k.problem,
      appr: k.remove + k.added, last: (d.last && d.last[c]) || '' }));
  }));
  return out;
}
/** The users of the earlier CDL+BS app (its Users tab), for hrSetup to move to AranyaHR. */
function oldUsers_() {
  const sh = ss_().getSheetByName(CONFIG.USERS); if (!sh) return [];
  const v = sh.getDataRange().getValues(), head = (v[0] || []).map(h => String(h).trim()), at = k => head.indexOf(k);
  const keys = ['email', 'circle', 'division', 'name', 'desig', 'phone', 'status', 'on', 'last', 'salt', 'hash'];
  return v.slice(1).map(r => { const o = {}; keys.forEach((k, j) => { const i = at(USER_HEADERS[j]); o[k] = i < 0 ? '' : fmtTs_(r[i]); }); o.email = o.email.toLowerCase(); return o; }).filter(o => o.email);
}

return {
  actions: { meta: meta_, load: load_, update: update_, confirm: confirm_, unconfirm: unconfirm_, notWorking: notWorking_, undoRemoval: undoRemoval_,
    resolveFlag: resolveFlag_, add: add_, certify: certify_, pending: pending_, decide: decide_, reopen: reopen_, log: log_ },
  admin: ['pending', 'decide', 'reopen', 'log'],
  writes: ['update', 'confirm', 'unconfirm', 'notWorking', 'undoRemoval', 'resolveFlag', 'add', 'certify'],
  people: people_, counts: counts_, divisions: () => divisions_(), oldUsers: oldUsers_, setup: cdlSetup, warm,
};
})();
