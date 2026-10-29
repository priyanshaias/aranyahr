/**
 * Forest Volunteers (FV) — JSON API for the GitHub-hosted FV app.
 * Each division keeps the list of Forest Volunteers it has engaged. Saves go straight in (no approval);
 * every added, changed or removed value is written to the Change Log with who saved it.
 * Data: its own Google Sheet "Forest Volunteers", created by fvSetup() — tabs Volunteers, Change Log, Lists.
 * Auth: username/password (Config.local.gs, not in GitHub); the server issues a session token kept in the script cache.
 * Deploy: Web app · Execute as: Me · Who has access: Anyone.
 */

const CONFIG = { TZ: 'Asia/Kolkata', PROP: 'FV_SHEET_ID', TAB: 'Volunteers', LOG: 'Change Log', LISTS: 'Lists' };
const SESSION_HOURS = 6, MAX_FAILS = 5, LOCK_MIN = 15;

// [key, sheet header]; the order is the Volunteers tab's column order
const COLS = [
  ['id', 'Volunteer ID'], ['circle', 'Circle'], ['division', 'Division'], ['sl', 'Sl No'],
  ['name', 'Name of Forest Volunteer Engaged'], ['dob', 'Date of Birth'], ['qual', 'Educational Qualification'],
  ['deptRef', "Forest Dept.'s approval ref"], ['dirRef', "Forest Directorate's Ref no sent to the Circle in Charge"],
  ['apptRef', 'Appointment Order issued by / reference'], ['doj', 'Date of Joining'],
  ['placeType', 'Posted at (Div HQ / Range)'], ['placeName', 'Range name'], ['placeSub', 'Within the range (Range HQ / Beat / Camp)'],
  ['works', 'Nature of Works assigned'], ['updOn', 'Last Updated On'], ['updBy', 'Last Updated By'],
];
const LABEL = COLS.reduce((a, c) => (a[c[0]] = c[1], a), {});
// what a division fills, in the order of the on-screen table
const FIELDS = ['name', 'dob', 'qual', 'deptRef', 'dirRef', 'apptRef', 'doj', 'placeType', 'placeName', 'placeSub', 'works'];
// headings used by earlier versions of the sheet, so their data is still found
const OLD_HEADERS = { placeType: ['Present place of Joining (Div HQ / Range / Beat / Camp)'], placeName: ['Name of the place'] };
const DATES = ['dob', 'doj'];
const LOG_HEADERS = ['When', 'Username', 'Saved by', 'Designation', 'Mobile', 'Circle', 'Division', 'Volunteer ID', 'Volunteer', 'Action', 'Field', 'Old value', 'New value'];

// First fill of the Lists tab. After setup, edit circles and divisions in the sheet itself.
const SEED_LISTS = [
  ['APM', 'CF, APM', ['Admin', 'Utilization', 'Publicity']],
  ['WP & GIS', 'CF, WP & GIS', ['Circle HQ', 'WP North', 'WP South I', 'WP South II']],
  ['Central', 'CCF, Central', ['Circle HQ', 'Bankura (N)', 'Bankura (S)', 'Panchet']],
  ['Western', 'CCF, Western', ['Circle HQ', 'Medinipur', 'Purba Medinipur', 'Kharagpur', 'Jhargram', 'Rupnarayan']],
  ['South East', 'CCF, South East', ['Circle HQ', 'Burdwan', 'Birbhum', 'Durgapur']],
  ['South West', 'CCF, South West', ['Circle HQ', 'Purulia', 'Kangsabati (N)', 'Kangsabati (S)', 'Extn. Forestry']],
  ['Parks & Gardens', 'CF, Parks & Gardens', ['Circle HQ', 'Howrah', 'Parks & Gardens North', 'URF']],
  ['North West', 'CF, North West', ['Circle HQ', 'Malda', 'Raiganj', 'Siliguri S.F', 'Jalpaiguri S.F.']],
  ['Hill', 'CCF, Hill', ['Circle HQ', 'Darjeeling', 'Kalimpong', 'Kurseong Dn.']],
  ['Northern', 'CCF, Northern', ['Circle HQ', 'Jalpaiguri', 'Baikunthapur', 'NTFP', 'Coochbehar']],
  ['Wild Life North', 'CCF, WL North', ['Circle HQ', 'Darjeeling WL', 'Gorumara WL', 'Jaldapara WL']],
  ['BTR', 'CCF & FD, BTR', ['Circle HQ', 'B.T.R (East)', 'B.T.R (West)']],
  ['WL HQ', 'CF, WL HQ', ['Division HQ']],
  ['STR', 'CCF & FD, STR', ['S.T.R']],
  ['SBR', 'Joint Director, SBR', ['Circle HQ', '24 Parganas (S)', '24 Parganas (N)', 'Nadia-Murshidabad']],
  ['Research', 'CF, Research', ['Circle HQ', 'Silviculture Hill', 'Silviculture North', 'Silviculture South']],
  ['Development', 'CF, Development', ['Circle HQ', 'WB Forest School', 'SFTI Hizli']],
  ['Monitoring', 'CF, Monitoring', ['Circle HQ', 'Monitoring North', 'Monitoring South']],
  ['Soil Con (N)', 'CF, SC', ['Circle HQ', 'Kurseong SC', 'Jalpaiguri SC']],
];

function local_() {
  const L = (typeof LOCAL_CONFIG !== 'undefined') ? LOCAL_CONFIG : {};
  return { accounts: L.ACCOUNTS || {}, sheetId: L.SHEET_ID || '' };
}

/* ============================================================ HTTP */

function doGet() { return json_({ ok: true, app: 'FV API', time: now_() }); }

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'login') return json_({ ok: true, data: login_(body) });
    if (body.action === 'logout') { logout_(body.token); return json_({ ok: true, data: {} }); }
    const user = authenticate_(body.token);
    const handlers = { meta: meta_, load: load_, save: save_, admin: admin_ };
    const fn = handlers[body.action];
    if (!fn) throw new Error('Unknown action: ' + body.action);
    if (body.action === 'admin' && !user.isAdmin) throw new Error('Only administrators can do this.');
    return json_({ ok: true, data: fn(body, user) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ============================================================ auth */

function sha256hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

/** {username, password} -> {token, user}. Wrong attempts lock the username for LOCK_MIN minutes. */
function login_(body) {
  const cache = CacheService.getScriptCache();
  const u = String(body.username || '').trim().toLowerCase(), pw = String(body.password || '');
  if (!u || !pw) throw new Error('Enter your username and password.');
  const failKey = 'fail_' + u, fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_FAILS) throw new Error('Too many wrong attempts. Try again after ' + LOCK_MIN + ' minutes.');
  const acc = local_().accounts[u];
  if (!acc || sha256hex_(acc.salt + pw) !== acc.hash) {
    cache.put(failKey, String(fails + 1), LOCK_MIN * 60);
    throw new Error('Wrong username or password.');
  }
  cache.remove(failKey);
  const token = 'fv.' + Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  const user = { name: acc.name || u, isAdmin: acc.role === 'admin', username: u };
  cache.put('sess_' + token, JSON.stringify(user), SESSION_HOURS * 3600);
  return { token, user };
}
function logout_(token) { if (token) CacheService.getScriptCache().remove('sess_' + token); }
function authenticate_(token) {
  if (!token || String(token).indexOf('fv.') !== 0) throw new Error('Please sign in.');
  const s = CacheService.getScriptCache().get('sess_' + token);
  if (!s) throw new Error('Your sign-in has expired. Please sign in again.');
  return JSON.parse(s);
}

/* ============================================================ helpers */

function isDate_(v) { return Object.prototype.toString.call(v) === '[object Date]'; }
function fmt_(v) {
  if (v === null || v === undefined) return '';
  if (isDate_(v)) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, CONFIG.TZ, 'dd-MM-yyyy');
  return String(v).trim();
}
function fmtTs_(v) { return isDate_(v) ? Utilities.formatDate(v, CONFIG.TZ, 'dd-MM-yyyy HH:mm:ss') : fmt_(v); }
function now_() { return Utilities.formatDate(new Date(), CONFIG.TZ, 'dd-MM-yyyy HH:mm:ss'); }
function id8_() { return Utilities.getUuid().slice(0, 8).toUpperCase(); }
function parseDate_(s) {
  s = String(s || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) throw new Error('Invalid date "' + s + '" (use DD-MM-YYYY)');
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  if (d.getDate() !== +m[1] || d.getMonth() !== +m[2] - 1 || +m[3] < 1940 || +m[3] > 2075) throw new Error('Invalid date "' + s + '"');
  return d;
}

/* ============================================================ sheet */

/** Run once from the editor: creates the "Forest Volunteers" sheet (if not made yet) and logs its link. */
function fvSetup() {
  const ss = ss_();
  Logger.log('Forest Volunteers sheet: ' + ss.getUrl());
  Logger.log('Circles: ' + circles_().length + ' · volunteers so far: ' + readAll_().length);
  Logger.log('Users: ' + Object.keys(local_().accounts).join(', '));
}

/**
 * The Forest Volunteers sheet: SHEET_ID from Config.local.gs, else the sheet this script was opened from
 * (Extensions → Apps Script), else the one fvSetup() created earlier, else a new one. Missing tabs are added.
 */
function ss_() {
  const props = PropertiesService.getScriptProperties();
  const fixed = local_().sheetId || props.getProperty(CONFIG.PROP);
  if (fixed) return tabs_(SpreadsheetApp.openById(fixed));
  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) { props.setProperty(CONFIG.PROP, bound.getId()); return tabs_(bound); }
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const id = props.getProperty(CONFIG.PROP);
    if (id) return tabs_(SpreadsheetApp.openById(id));
    const ss = SpreadsheetApp.create('Forest Volunteers');
    props.setProperty(CONFIG.PROP, ss.getId());
    return tabs_(ss);
  } finally { lock.releaseLock(); }
}
/** Adds the Volunteers, Change Log and Lists tabs if the sheet does not have them yet. */
function tabs_(ss) {
  if (ss.getSheetByName(CONFIG.TAB) && ss.getSheetByName(CONFIG.LOG) && ss.getSheetByName(CONFIG.LISTS)) return ss;
  const add = (name, headers) => {
    let sh = ss.getSheetByName(name);
    if (sh) return null;
    const blank = ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0 && !ss.getSheetByName(CONFIG.TAB) && name === CONFIG.TAB;
    sh = blank ? ss.getSheets()[0].setName(name) : ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setWrap(true);
    sh.setFrozenRows(1);
    return sh;
  };
  add(CONFIG.TAB, COLS.map(c => c[1]));
  add(CONFIG.LOG, LOG_HEADERS);
  const li = add(CONFIG.LISTS, ['Circle', 'Office', 'Division']);
  if (li) {
    const rows = [];
    SEED_LISTS.forEach(([c, o, ds]) => ds.forEach(d => rows.push([c, o, d])));
    li.getRange(2, 1, rows.length, 3).setNumberFormat('@').setValues(rows);
  }
  return ss;
}
function tab_(name) { return ss_().getSheetByName(name); }

/** Circles with their divisions, from the Lists tab (one row per division). */
function circles_() {
  const v = tab_(CONFIG.LISTS).getDataRange().getValues(), out = [], by = {};
  v.slice(1).forEach(r => {
    const c = fmt_(r[0]), o = fmt_(r[1]), d = fmt_(r[2]);
    if (!c || !d) return;
    if (!by[c]) { by[c] = { circle: c, office: o, divisions: [] }; out.push(by[c]); }
    if (by[c].divisions.indexOf(d) < 0) by[c].divisions.push(d);
  });
  return out;
}

/** Rows of the Volunteers tab. Columns are found by their heading, so adding or moving a column never shifts data. */
function readAll_() {
  const v = tab_(CONFIG.TAB).getDataRange().getValues(), rows = [];
  const head = (v[0] || []).map(h => String(h).trim());
  const at = COLS.map(c => [c[1]].concat(OLD_HEADERS[c[0]] || []).map(h => head.indexOf(h)).filter(i => i >= 0)[0]);
  for (let r = 1; r < v.length; r++) {
    const o = {};
    COLS.forEach((c, j) => { const x = at[j] == null ? '' : v[r][at[j]]; o[c[0]] = c[0] === 'updOn' ? fmtTs_(x) : fmt_(x); });
    if (o.id) rows.push(newPlace_(o));
  }
  return rows;
}

/**
 * Place of posting is "Div HQ", or a Range with "Range HQ", "Beat: <name>" or "Camp: <name>" inside it.
 * Entries saved in the earlier format (Beat / Camp / Range + "X under Y Range") are converted here.
 */
function newPlace_(o) {
  const t = o.placeType;
  if (t === 'Div HQ' || (t === 'Range' && o.placeSub)) return o;
  if (['Range', 'Beat', 'Camp', 'Other'].indexOf(t) < 0) return o;
  const name = String(o.placeName || '').replace(/\s+/g, ' ').trim();
  const m = /^(.*?)\s+under\s+(?:the\s+)?(.+?)\s*(?:range)?\s*$/i.exec(name);
  const tc = s => s.toLowerCase().replace(/(^|[\s(\-\/])([a-z])/g, (a, b, c) => b + c.toUpperCase()).replace(/\bHq\b/g, 'HQ').replace(/\bWls\b/g, 'WLS');
  o.placeType = 'Range';
  if (m) {
    const what = tc(m[1]).replace(/\s+Beat$/i, '');
    o.placeName = tc(m[2]);
    o.placeSub = t === 'Camp' ? 'Camp: ' + what : t === 'Beat' || /\bHQ$/.test(what) ? 'Beat: ' + what : t === 'Range' ? 'Beat: ' + what : '';
  } else if (t === 'Range') { o.placeName = name; o.placeSub = ''; }
  else if (t === 'Beat' || t === 'Camp') { o.placeName = ''; o.placeSub = name ? t + ': ' + name : ''; }
  else { o.placeName = ''; o.placeSub = name; }
  return o;
}

/**
 * Run once from the editor after updating the script: rewrites places saved in the earlier format into the new columns
 * (Posted at, Range name, Within the range) and writes each change to the Change Log. Running it again changes nothing.
 */
function convertPlaces() {
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const sh = tab_(CONFIG.TAB), v = sh.getDataRange().getValues(), head = (v[0] || []).map(h => String(h).trim());
    const col = (k, names) => names.map(h => head.indexOf(h)).filter(i => i >= 0)[0];
    const ci = { id: col('id', ['Volunteer ID']), t: col('t', ['Posted at (Div HQ / Range)'].concat(OLD_HEADERS.placeType)), n: col('n', ['Range name'].concat(OLD_HEADERS.placeName)) };
    const before = {};
    v.slice(1).forEach(r => { if (r[ci.id]) before[fmt_(r[ci.id])] = { placeType: fmt_(r[ci.t]), placeName: fmt_(r[ci.n]) }; });
    const rows = readAll_(), when = now_(), log = [], touched = {};
    rows.forEach(r => {
      const b = before[r.id] || {}, changes = [['placeType', b.placeType, r.placeType], ['placeName', b.placeName, r.placeName], ['placeSub', '', r.placeSub]].filter(x => (x[1] || '') !== (x[2] || ''));
      if (!changes.length || (b.placeType === r.placeType && head.indexOf('Within the range (Range HQ / Beat / Camp)') >= 0)) return;
      changes.forEach(x => log.push([when, 'script', 'GS', 'Administrator', '', r.circle, r.division, r.id, r.name, 'Edited', LABEL[x[0]], x[1] || '', x[2] || '']));
      touched[r.circle + '|' + r.division] = [r.circle, r.division];
    });
    writeAll_(rows);
    if (log.length) { const lg = tab_(CONFIG.LOG); lg.getRange(lg.getLastRow() + 1, 1, log.length, LOG_HEADERS.length).setNumberFormat('@').setValues(log); }
    // anyone with a division open is asked to reload before saving over the converted places
    Object.keys(touched).forEach(k => { const [c, d] = touched[k], ver = ver_(c, d); setVer_(c, d, { n: ver.n + 1, on: when, by: 'GS (place format update)' }); });
    Logger.log('Places converted: ' + log.length + ' changes in ' + Object.keys(touched).length + ' division(s).');
  } finally { lock.releaseLock(); }
}

function writeAll_(rows) {
  const sh = tab_(CONFIG.TAB), n = COLS.length, last = sh.getLastRow(), width = Math.max(n, sh.getLastColumn());
  // headings follow COLS (the data below is written in the same order)
  sh.getRange(1, 1, 1, width).clearContent(); sh.getRange(1, 1, 1, n).setValues([COLS.map(c => c[1])]).setFontWeight('bold').setWrap(true);
  if (last > 1) sh.getRange(2, 1, last - 1, width).clearContent();
  if (!rows.length) return;
  const values = rows.map(o => COLS.map(c => DATES.indexOf(c[0]) >= 0 && o[c[0]] ? parseDate_(o[c[0]]) : (o[c[0]] == null ? '' : o[c[0]])));
  // plain text everywhere (so a reference like "12/2024" stays as typed), real dates in the two date columns
  sh.getRange(2, 1, values.length, n).setNumberFormat('@');
  DATES.forEach(k => sh.getRange(2, COLS.findIndex(c => c[0] === k) + 1, values.length, 1).setNumberFormat('dd-mm-yyyy'));
  sh.getRange(2, 1, values.length, n).setValues(values);
}

/** Version of a division's list: changes on every save, so two people editing the same division do not overwrite each other. */
function ver_(circle, division) {
  const s = PropertiesService.getScriptProperties().getProperty('ver|' + circle + '|' + division);
  return s ? JSON.parse(s) : { n: 0, on: '', by: '' };
}
function setVer_(circle, division, v) { PropertiesService.getScriptProperties().setProperty('ver|' + circle + '|' + division, JSON.stringify(v)); }
function pub_(r) { const o = { id: r.id }; FIELDS.forEach(k => o[k] = r[k] || ''); return o; }

/* ============================================================ actions */

/** A volunteer counts as "added" only when every detail is filled (same rule as missingOf() in the website). */
function complete_(r) {
  const has = k => String(r[k] || '').trim() !== '';
  if (!['name', 'dob', 'qual', 'deptRef', 'dirRef', 'apptRef', 'doj', 'placeType', 'works'].every(has)) return false;
  if (r.placeType !== 'Div HQ') {
    if (r.placeType !== 'Range' || !has('placeName') || !has('placeSub')) return false;
    if (r.placeSub !== 'Range HQ' && !/^(Beat|Camp):\s*\S/.test(r.placeSub)) return false;
  }
  const m = /^Others(?::\s*(.*))?$/.exec(String(r.works).trim());
  if (m && (!m[1] || m[1].trim().length < 10 || /^\s*(do|d\.o\.?|various|misc\.?|miscellaneous|other|others|field work|field duty|forestry work|general|all work|-)?\s*$/i.test(m[1]))) return false;
  return true;
}

function meta_(body, user) {
  const counts = {}, complete = {}, saved = {};
  readAll_().forEach(r => { const k = r.circle + '|' + r.division; counts[k] = (counts[k] || 0) + 1; if (complete_(r)) complete[k] = (complete[k] || 0) + 1; });
  const props = PropertiesService.getScriptProperties().getProperties();
  Object.keys(props).forEach(k => { if (k.indexOf('ver|') === 0) { const v = JSON.parse(props[k]); saved[k.slice(4)] = { on: v.on, by: v.by }; } });
  return { circles: circles_(), counts, complete, saved, user, placeV: 2 };   // placeV: the website saves the new place columns only to this version
}

function load_(body) {
  const circle = String(body.circle || ''), division = String(body.division || '');
  if (!circle || !division) throw new Error('Choose a circle and a division.');
  const rows = readAll_().filter(r => r.circle === circle && r.division === division).sort((a, b) => (+a.sl || 0) - (+b.sl || 0));
  return { rows: rows.map(pub_), ver: ver_(circle, division) };
}

/**
 * Saves the whole list of one division. body: {circle, division, rows: [{id?, key, ...fields}], base, force, operator}.
 * Rows without an id are new; saved ids missing from the list are removed.
 * Returns {rows, ver, ids: {key: newId}, changes}, or {conflict, message, ver} when someone else saved after `base`.
 */
function save_(body, user) {
  const circle = String(body.circle || ''), division = String(body.division || '');
  if (!circle || !division) throw new Error('Choose a circle and a division.');
  if (!circles_().some(c => c.circle === circle && c.divisions.indexOf(division) >= 0)) throw new Error('Unknown division: ' + circle + ' / ' + division);
  const op = body.operator || {};
  const who = (op.name || user.name) + (op.designation ? ' (' + op.designation + ')' : '');

  const sent = (body.rows || []).map(r => {
    const o = { id: String(r.id || ''), key: String(r.key || '') };
    FIELDS.forEach(k => o[k] = String(r[k] == null ? '' : r[k]).replace(/\s+/g, ' ').trim());
    return o;
  }).filter(o => FIELDS.some(k => o[k]));
  const bad = [];
  sent.forEach((o, i) => {
    if (!o.name) bad.push('Row ' + (i + 1) + ': name is missing');
    DATES.forEach(k => { try { parseDate_(o[k]); } catch (e) { bad.push('Row ' + (i + 1) + ': ' + LABEL[k] + ' "' + o[k] + '" is not a date (use DD-MM-YYYY)'); } });
  });
  if (bad.length) throw new Error(bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' …and ' + (bad.length - 5) + ' more' : ''));

  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const ver = ver_(circle, division);
    if (!body.force && Number(body.base || 0) !== ver.n)
      return { conflict: true, message: (ver.by || 'Someone') + ' saved this division at ' + ver.on + ', after you opened it.', ver };
    const all = readAll_();
    const mine = all.filter(r => r.circle === circle && r.division === division);
    const others = all.filter(r => !(r.circle === circle && r.division === division));
    const byId = mine.reduce((a, r) => (a[r.id] = r, a), {});
    const when = now_(), log = [], ids = {};
    const L = (r, action, field, oldV, newV) => log.push([when, user.username || '', op.name || user.name, op.designation || '', op.mobile || '',
      circle, division, r.id, r.name, action, field ? LABEL[field] : '', oldV || '', newV || '']);

    const kept = sent.map((o, i) => {
      const prev = o.id && byId[o.id];
      const r = prev ? Object.assign({}, prev) : { id: 'FV-' + id8_(), circle, division };
      if (!prev) ids[o.key] = r.id;
      let changed = !prev;
      FIELDS.forEach(k => {
        const oldV = prev ? (prev[k] || '') : '', newV = DATES.indexOf(k) >= 0 && o[k] ? fmt_(parseDate_(o[k])) : o[k];
        if (oldV !== newV) { changed = true; r[k] = newV; if (prev) L(r, 'Edited', k, oldV, newV); }
      });
      if (!prev) FIELDS.forEach(k => { if (r[k]) L(r, 'Added', k, '', r[k]); });
      if (String(r.sl) !== String(i + 1)) { r.sl = i + 1; }
      if (changed) { r.updOn = when; r.updBy = who; }
      return r;
    });
    const keptIds = kept.reduce((a, r) => (a[r.id] = 1, a), {});
    mine.forEach(r => { if (!keptIds[r.id]) L(r, 'Removed', '', r.name, ''); });

    if (!log.length) return { rows: kept.map(pub_), ver, ids, changes: 0 };
    writeAll_(others.concat(kept));
    const lg = tab_(CONFIG.LOG);
    lg.getRange(lg.getLastRow() + 1, 1, log.length, LOG_HEADERS.length).setNumberFormat('@').setValues(log);
    const nv = { n: ver.n + 1, on: when, by: who };
    setVer_(circle, division, nv);
    return { rows: kept.map(pub_), ver: nv, ids, changes: log.length };
  } finally { lock.releaseLock(); }
}

/** Admins: every volunteer and the change log (newest first, up to 3000 entries). */
function admin_() {
  const v = tab_(CONFIG.LOG).getDataRange().getValues(), log = [];
  for (let r = v.length - 1; r >= 1 && log.length < 3000; r--) {
    const x = v[r]; if (!x[0]) continue;
    log.push({ on: fmtTs_(x[0]), username: fmt_(x[1]), by: fmt_(x[2]), desig: fmt_(x[3]), mobile: fmt_(x[4]), circle: fmt_(x[5]), division: fmt_(x[6]),
      vid: fmt_(x[7]), vname: fmt_(x[8]), action: fmt_(x[9]), field: fmt_(x[10]), old: fmt_(x[11]), value: fmt_(x[12]) });
  }
  return { rows: readAll_(), log, logTotal: Math.max(0, v.length - 1), sheetUrl: ss_().getUrl() };
}
