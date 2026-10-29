/**
 * AranyaHR — one JSON API for FR, DR/Fr, FG/HFG (Officers.gs), FV (Volunteers.gs) and DL/CDL, BS, AS, DEO (Cdlbs.gs).
 * Each module is the code of the earlier app (UPMC2, FV, CDL+BS) inside one wrapper, reading its own Google Sheet.
 * This file: sign-in, sign-up, users, divisions, ranges, settings, and the router that keeps every user to their own division.
 * Data: the "AranyaHR · Users" sheet — tabs Users, Divisions, Ranges, Settings.
 * Private settings (sheet IDs, admin accounts) live in Config.local.gs, which is NOT in GitHub.
 * Deploy: Web app · Execute as: Me · Who has access: Anyone.
 */

const HR = { TZ: 'Asia/Kolkata', USERS: 'Users', DIVS: 'Divisions', RANGES: 'Ranges', SETTINGS: 'Settings', APP: 'AranyaHR' };
const HR_SESSION_HOURS = 6, HR_MAX_FAILS = 5, HR_LOCK_MIN = 15, HR_CODE_MIN = 30;
const USER_COLS = [['email', 'Email'], ['level', 'Level'], ['circle', 'Circle'], ['division', 'Division'], ['name', 'Name'], ['desig', 'Designation'],
  ['phone', 'Mobile'], ['status', 'Status'], ['verified', 'Email verified'], ['password', 'Password'], ['on', 'Signed up on'], ['approvedBy', 'Approved by'],
  ['approvedOn', 'Approved on'], ['last', 'Last sign-in'], ['oldSalt', 'Old salt'], ['oldHash', 'Old hash']];
const LEVELS = ['Division', 'Circle', 'State'];
const ST = { active: 'Active', pending: 'Pending approval', disabled: 'Disabled', rejected: 'Rejected' };
// the column of the Divisions tab that holds each module's own "Circle | Division"
const MOD_COL = { off: 'In FR DFR FG', fv: 'In FV', cdl: 'In CDL+BS' };
const DIV_HQ = 'Div HQ', NOT_MATCHED = 'Range not matched';
const SETTINGS_DEFAULT = { 'Email code at sign-up': 'No' };

function modules_() { return { off: Officers, fv: Volunteers, cdl: Cdlbs }; }
function hrLocal_() {
  const L = (typeof LOCAL_CONFIG !== 'undefined') ? LOCAL_CONFIG : {};
  return { accounts: L.ACCOUNTS || {}, ids: L.SHEET_IDS || {} };
}
/** The sheet ID of a module (OFF, FV, CDL, ASDEO) for the module wrappers. */
function sheetId_(k) { const id = hrLocal_().ids[k]; if (!id) throw new Error('Put SHEET_IDS.' + k + ' in Config.local.gs.'); return id; }

/* ============================================================ wrappers given to each module
 * The modules use CacheService and PropertiesService as before; these give each module its own key prefix,
 * so their keys ('meta', 'div|…', 'ver|…') never meet in the one shared script cache. */

function prefixedCache_(p) {
  const strip = o => Object.keys(o).reduce((a, k) => (a[k.slice(p.length)] = o[k], a), {});
  const add = o => Object.keys(o).reduce((a, k) => (a[p + k] = o[k], a), {});
  return { getScriptCache: () => { const c = CacheService.getScriptCache(); return {
    get: k => c.get(p + k), put: (k, v, t) => c.put(p + k, v, t), remove: k => c.remove(p + k),
    getAll: ks => strip(c.getAll(ks.map(k => p + k))), putAll: (o, t) => c.putAll(add(o), t), removeAll: ks => c.removeAll(ks.map(k => p + k)) }; } };
}
function prefixedProps_(p) {
  return { getScriptProperties: () => { const s = PropertiesService.getScriptProperties(); return {
    getProperty: k => s.getProperty(p + k), setProperty: (k, v) => s.setProperty(p + k, v), deleteProperty: k => s.deleteProperty(p + k),
    getProperties: () => { const all = s.getProperties(), o = {}; Object.keys(all).forEach(k => { if (k.indexOf(p) === 0) o[k.slice(p.length)] = all[k]; }); return o; } }; } };
}

/* ============================================================ HTTP */

/** GET: a health check, or ?verify=<token> from the "verify your email" link. */
function doGet(e) {
  const t = e && e.parameter && e.parameter.verify;
  if (!t) return hrJson_({ ok: true, app: 'AranyaHR API', time: hrNow_() });
  let msg;
  try { msg = 'Thank you. ' + verifyEmail_(t) + ' is verified.'; } catch (err) { msg = err.message; }
  return HtmlService.createHtmlOutput('<div style="font:16px sans-serif;padding:40px;text-align:center"><b>AranyaHR</b><p>' + msg + '</p></div>');
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}'), a = String(body.action || '');
    if (a === 'logout') { hrLogout_(body.token); return hrJson_({ ok: true, data: {} }); }
    const open = { login: hrLogin_, lists: lists_, divisionUsers: divisionUsers_, signup: signup_, signupVerify: signupVerify_,
      forgotStart: forgotStart_, forgotVerify: forgotVerify_ };
    if (open[a]) return hrJson_({ ok: true, data: open[a](body) });
    const user = hrAuth_(body.token);
    if (a.indexOf('.') > 0) return hrJson_({ ok: true, data: callModule_(a, body, user) });
    const core = { home: home_, overview: overview_, users: users_, userDecide: userDecide_, userStatus: userStatus_, userPassword: userPassword_,
      sendVerify: sendVerify_, settings: settings_, setSetting: setSetting_, ranges: ranges_, rangeAlias: rangeAlias_ };
    const fn = core[a];
    if (!fn) throw new Error('Unknown action: ' + a);
    if (a !== 'home' && a !== 'overview' && !user.isAdmin) throw new Error('Only administrators can do this.');
    return hrJson_({ ok: true, data: fn(body, user) });
  } catch (err) {
    return hrJson_({ ok: false, error: String(err && err.message || err), conflict: !!(err && err.conflict) });
  }
}
function hrJson_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/**
 * "module.action": Core checks what the user may do, puts their own division (in that sheet's spelling) into the request,
 * fills in who is saving, and calls the module's action with a user object in the module's own terms.
 */
function callModule_(a, body, user) {
  const [m, act] = a.split('.'), mod = modules_()[m];
  if (!mod || !mod.actions[act]) throw new Error('Unknown action: ' + a);
  const admin = mod.admin.indexOf(act) >= 0, write = mod.writes.indexOf(act) >= 0;
  if (admin && !user.isAdmin) throw new Error('Only administrators can do this.');
  if (admin && user.mods && user.mods.indexOf(m) < 0) throw new Error('This admin account is not for this cadre.');
  const mu = Object.assign({}, user);
  if (!user.isAdmin) {
    if (write && user.level !== 'Division') throw new Error('Your account can only view. Changes are made by the division.');
    body.operator = { name: user.name, designation: user.desig, mobile: user.phone };
    if (user.level === 'Division') {
      const own = nameIn_(m, user.circle, user.division);
      body.circle = own.circle; body.division = own.division;
      if (body.person) body.person.division = own.division;
      mu.circle = own.circle; mu.division = own.division;
    } else if (user.level === 'Circle' && body.division) {
      const canon = canonOf_(m, body.circle, body.division);
      if (!canon || canon.circle !== user.circle) throw new Error('Your account is for ' + user.circle + ' circle only.');
    }
  }
  return mod.actions[act](body, mu);
}

/* ============================================================ sheet and helpers */

let HR_SS_ = null;
function hrSs_() { return HR_SS_ || (HR_SS_ = SpreadsheetApp.openById(sheetId_('HR'))); }
function hrTab_(name) { return hrSs_().getSheetByName(name); }
function hrIsDate_(v) { return Object.prototype.toString.call(v) === '[object Date]'; }
function hrFmt_(v) {
  if (v === null || v === undefined) return '';
  if (hrIsDate_(v)) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, HR.TZ, 'dd-MM-yyyy HH:mm');
  return String(v).trim();
}
function hrNow_() { return Utilities.formatDate(new Date(), HR.TZ, 'dd-MM-yyyy HH:mm:ss'); }
const hrEmail_ = s => String(s || '').trim().toLowerCase();
const HR_EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function hrSha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}
/** CDL+BS's password hash (500 rounds), only to let users moved from CDL+BS sign in once with their old password. */
function oldHash_(salt, pw) { let h = hrSha_(salt + pw); for (let i = 1; i < 500; i++) h = hrSha_(salt + h); return h; }
function hrMail_(to, subject, text) { MailApp.sendEmail({ to, subject, body: text, name: HR.APP }); }
function hrLock_(fn) { const l = LockService.getScriptLock(); l.waitLock(25000); try { return fn(); } finally { l.releaseLock(); } }
function readTabRows_(name, cols) {
  const sh = hrTab_(name), v = sh.getDataRange().getValues(), head = (v[0] || []).map(h => String(h).trim()), rows = [];
  for (let r = 1; r < v.length; r++) { const o = { _r: r + 1 }; cols.forEach(c => { const i = head.indexOf(c[1]); o[c[0]] = i < 0 ? '' : hrFmt_(v[r][i]); }); rows.push(o); }
  return { sh, head, rows };
}
function setCells_(t, r, vals) {
  Object.keys(vals).forEach(k => { const c = USER_COLS.find(x => x[0] === k), i = t.head.indexOf(c[1]); if (i >= 0) t.sh.getRange(r._r, i + 1).setNumberFormat('@').setValue(vals[k]); });
}

/* ============================================================ settings */

function settingsAll_() {
  const c = CacheService.getScriptCache(), s = c.get('hr:settings');
  if (s) return JSON.parse(s);
  const o = Object.assign({}, SETTINGS_DEFAULT);
  hrTab_(HR.SETTINGS).getDataRange().getValues().slice(1).forEach(r => { if (hrFmt_(r[0])) o[hrFmt_(r[0])] = hrFmt_(r[1]); });
  c.put('hr:settings', JSON.stringify(o), 600);
  return o;
}
const emailCodeOn_ = () => /^yes$/i.test(settingsAll_()['Email code at sign-up']);
function settings_() { return { settings: settingsAll_() }; }
function setSetting_(body) {
  const key = String(body.key || ''), value = String(body.value || '');
  if (!(key in SETTINGS_DEFAULT)) throw new Error('Unknown setting.');
  hrLock_(() => {
    const sh = hrTab_(HR.SETTINGS), v = sh.getDataRange().getValues(), i = v.findIndex(r => hrFmt_(r[0]) === key);
    sh.getRange(i > 0 ? i + 1 : sh.getLastRow() + 1, 1, 1, 2).setNumberFormat('@').setValues([[key, value]]);
  });
  CacheService.getScriptCache().remove('hr:settings');
  return settings_();
}

/* ============================================================ divisions
 * Divisions tab: Circle, Division (the names AranyaHR uses), and each module's own "Circle | Division". */

function divs_() {
  const c = CacheService.getScriptCache(), s = c.get('hr:divs');
  if (s) return JSON.parse(s);
  const v = hrTab_(HR.DIVS).getDataRange().getValues(), head = v[0].map(h => String(h).trim()), out = [];
  v.slice(1).forEach(r => {
    const d = { circle: hrFmt_(r[head.indexOf('Circle')]), division: hrFmt_(r[head.indexOf('Division')]) };
    if (!d.circle || !d.division) return;
    Object.keys(MOD_COL).forEach(m => { const x = hrFmt_(r[head.indexOf(MOD_COL[m])]).split('|').map(s => s.trim()); d[m] = x[1] ? { circle: x[0], division: x[1] } : null; });
    out.push(d);
  });
  c.put('hr:divs', JSON.stringify(out), 3600);
  return out;
}
/** A division's name in one module's sheet (the division itself when it has no entry there). */
function nameIn_(m, circle, division) {
  const d = divs_().find(x => x.circle === circle && x.division === division);
  return (d && d[m]) || { circle, division };
}
/** The AranyaHR division for a module's own names. */
function canonOf_(m, circle, division) {
  return divs_().find(x => x[m] && x[m].division === division && (!circle || x[m].circle === circle)) || null;
}
function lists_() {
  const circles = [], by = {};
  divs_().forEach(d => { if (!by[d.circle]) { by[d.circle] = { circle: d.circle, divisions: [] }; circles.push(by[d.circle]); } by[d.circle].divisions.push(d.division); });
  return { circles, levels: LEVELS, emailCode: emailCodeOn_() };
}

/* ============================================================ ranges
 * Ranges tab: Circle, Division, Range, Aliases (other spellings, separated by ";").
 * Each person's range (as written in their cadre's sheet) is matched to one of these. */

const normRange_ = s => String(s || '').toLowerCase().replace(/\b(range|rng|r|forest|office)\b/g, ' ').replace(/[^a-z0-9]+/g, '');
const isHq_ = s => /^\s*(div(ision)?\.?\s*(hq|h\.q\.?|head\s*quarters?)|hq|dfo\s*office)\s*$/i.test(String(s || ''));
function rangesAll_() {
  const c = CacheService.getScriptCache(), s = c.get('hr:ranges');
  if (s) return JSON.parse(s);
  const out = {};
  hrTab_(HR.RANGES).getDataRange().getValues().slice(1).forEach(r => {
    const d = hrFmt_(r[1]), name = hrFmt_(r[2]); if (!d || !name) return;
    const list = out[d] = out[d] || [];
    list.push({ range: name, keys: [name].concat(hrFmt_(r[3]).split(';')).map(normRange_).filter(Boolean) });
  });
  c.put('hr:ranges', JSON.stringify(out), 3600);
  return out;
}
/** The AranyaHR range for a raw value in a division: a range name, Div HQ, or Range not matched. */
function canonRange_(division, raw, ranges) {
  if (!String(raw || '').trim() || isHq_(raw)) return DIV_HQ;
  const k = normRange_(raw), hit = ((ranges || rangesAll_())[division] || []).find(x => x.keys.indexOf(k) >= 0);
  return hit ? hit.range : NOT_MATCHED;
}

/* ============================================================ sign-in */

function userObj_(r) {
  return { name: r.name, username: r.email, email: r.email, level: r.level || 'Division', circle: r.circle, division: r.division, desig: r.desig,
    phone: r.phone, isAdmin: false, verified: r.verified === 'Yes' };
}
function readUsers_() { const t = readTabRows_(HR.USERS, USER_COLS); t.rows = t.rows.filter(r => (r.email = hrEmail_(r.email))); return t; }

/** {username or email, password} -> {token, user}. Admins (Config.local.gs) sign in with their username, everyone else with their email. */
function hrLogin_(body) {
  const cache = CacheService.getScriptCache();
  const u = hrEmail_(body.username), pw = String(body.password || '');
  if (!u || !pw) throw new Error('Enter your email and password.');
  const failKey = 'hr:fail|' + u, fails = Number(cache.get(failKey) || 0);
  if (fails >= HR_MAX_FAILS) throw new Error('Too many wrong attempts. Try again after ' + HR_LOCK_MIN + ' minutes, or reset your password.');
  const wrong = () => { cache.put(failKey, String(fails + 1), HR_LOCK_MIN * 60); return new Error('Wrong email or password.'); };
  let user;
  const acc = hrLocal_().accounts[u];
  if (acc) {
    if (acc.password ? acc.password !== pw : hrSha_(acc.salt + pw) !== acc.hash) throw wrong();
    user = { name: acc.name || u, username: u, email: acc.email || u, level: 'State', isAdmin: acc.role === 'admin', mods: acc.modules || null };
    PropertiesService.getScriptProperties().setProperty('hr:last|' + u, hrNow_());
  } else {
    user = hrLock_(() => {
      const t = readUsers_(), r = t.rows.find(x => x.email === u);
      if (!r) throw wrong();
      const ok = r.password ? r.password === pw : (r.oldHash && oldHash_(r.oldSalt, pw) === r.oldHash);
      if (!ok) throw wrong();
      if (r.status === ST.pending) throw new Error('Your account is waiting for the admin’s approval. Please contact the admin.');
      if (r.status !== ST.active) throw new Error('This account is ' + (r.status || 'not active').toLowerCase() + '. Please contact the admin.');
      const set = { last: hrNow_() };
      if (!r.password) Object.assign(set, { password: pw, oldSalt: '', oldHash: '' });   // moved from CDL+BS: keep the password from now on
      setCells_(t, r, set);
      return userObj_(r);
    });
    cache.remove('hr:off|' + u);
  }
  cache.remove(failKey);
  const token = 'hr.' + Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  cache.put('hr:sess|' + token, JSON.stringify(user), HR_SESSION_HOURS * 3600);
  return { token, user };
}
function hrLogout_(token) { if (token) CacheService.getScriptCache().remove('hr:sess|' + token); }
function hrAuth_(token) {
  if (!token || String(token).indexOf('hr.') !== 0) throw new Error('Please sign in.');
  const cache = CacheService.getScriptCache(), s = cache.get('hr:sess|' + token);
  if (!s) throw new Error('Your sign-in has expired. Please sign in again.');
  const user = JSON.parse(s);
  if (!user.isAdmin && cache.get('hr:off|' + user.email)) { cache.remove('hr:sess|' + token); throw new Error('This account is disabled. Please sign in again.'); }
  return user;
}

/* ============================================================ sign-up and password reset */

/** How many users a division already has (for the "second user" note on the sign-up form). */
function divisionUsers_(body) {
  const d = String(body.division || '');
  return { count: readUsers_().rows.filter(r => (r.level || 'Division') === 'Division' && r.division === d && (r.status === ST.active || r.status === ST.pending)).length };
}
function cleanSignup_(body) {
  const u = { email: hrEmail_(body.email), level: LEVELS.indexOf(body.level) >= 0 ? body.level : 'Division',
    name: String(body.name || '').replace(/\s+/g, ' ').trim(), desig: String(body.desig || '').replace(/\s+/g, ' ').trim(),
    phone: String(body.phone || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''), password: String(body.password || ''), circle: '', division: '' };
  if (u.level !== 'State') {
    const c = lists_().circles.find(x => x.circle === String(body.circle || ''));
    if (!c) throw new Error('Choose your circle.');
    u.circle = c.circle;
    if (u.level === 'Division') {
      if (c.divisions.indexOf(String(body.division || '')) < 0) throw new Error('Choose your division.');
      u.division = String(body.division);
    }
  }
  if (!HR_EMAIL_OK.test(u.email)) throw new Error('Write a valid email address.');
  if (u.name.length < 3) throw new Error('Write your name.');
  if (u.desig.length < 2) throw new Error('Write your designation.');
  if (!/^[6-9]\d{9}$/.test(u.phone)) throw new Error('Write a 10-digit mobile number.');
  if (u.password.length < 8) throw new Error('The password must have at least 8 characters.');
  if (hrLocal_().accounts[u.email] || readUsers_().rows.some(r => r.email === u.email)) throw new Error('This email already has an account. Sign in, or use "Forgot password".');
  return u;
}
/** Sign-up. With "Email code at sign-up" on, a code is emailed first (signupVerify finishes it); otherwise the account is made at once. */
function signup_(body) {
  const u = cleanSignup_(body);
  if (!emailCodeOn_()) return createUser_(u, false);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  CacheService.getScriptCache().put('hr:su|' + u.email, JSON.stringify({ code, user: u }), HR_CODE_MIN * 60);
  hrMail_(u.email, HR.APP + ': your sign-up code', 'Your sign-up code is ' + code + '.\nIt is valid for ' + HR_CODE_MIN + ' minutes.\n\nIf you did not sign up, ignore this email.');
  return { sent: true };
}
function signupVerify_(body) { const o = takeCode_('hr:su|' + hrEmail_(body.email), body.code); return createUser_(o.user, true); }
/**
 * The first user of a division works at once; a second user of the division, and every circle and state user, waits for the admin.
 * Returns a session when the account is active, else {pending, message}.
 */
function createUser_(u, verified) {
  const r = hrLock_(() => {
    const t = readUsers_();
    if (t.rows.some(x => x.email === u.email)) throw new Error('This email already has an account. Please sign in.');
    const taken = u.level === 'Division' && t.rows.some(x => (x.level || 'Division') === 'Division' && x.division === u.division && (x.status === ST.active || x.status === ST.pending));
    const o = Object.assign({}, u, { status: u.level === 'Division' && !taken ? ST.active : ST.pending, verified: verified ? 'Yes' : 'No', on: hrNow_(), last: '' });
    const row = t.head.map(h => { const c = USER_COLS.find(x => x[1] === h); return c ? (o[c[0]] || '') : ''; });
    t.sh.getRange(t.sh.getLastRow() + 1, 1, 1, row.length).setNumberFormat('@').setValues([row]);
    return Object.assign(o, { taken });
  });
  if (r.status === ST.active) return hrLogin_({ username: u.email, password: u.password });
  return { pending: true, second: r.taken, message: r.taken
    ? 'You are the second user for ' + u.division + '. Your account is made, but please contact the admin to approve it.'
    : 'Your account is made. It will work after the admin approves it.' };
}
function takeCode_(key, code) {
  const cache = CacheService.getScriptCache(), s = cache.get(key);
  if (!s) throw new Error('The code has expired. Please ask for a new one.');
  const o = JSON.parse(s);
  if (String(code || '').trim() !== o.code) {
    o.tries = (o.tries || 0) + 1;
    if (o.tries >= 5) cache.remove(key); else cache.put(key, JSON.stringify(o), HR_CODE_MIN * 60);
    throw new Error(o.tries >= 5 ? 'Too many wrong codes. Please ask for a new one.' : 'That code is not right. Please check the email.');
  }
  cache.remove(key);
  return o;
}
function forgotStart_(body) {
  const email = hrEmail_(body.email);
  if (!HR_EMAIL_OK.test(email)) throw new Error('Write the email you signed up with.');
  if (readUsers_().rows.some(x => x.email === email && x.status === ST.active)) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    CacheService.getScriptCache().put('hr:rs|' + email, JSON.stringify({ code }), HR_CODE_MIN * 60);
    hrMail_(email, HR.APP + ': password reset code', 'Your password reset code is ' + code + '.\nIt is valid for ' + HR_CODE_MIN + ' minutes.\n\nIf you did not ask for this, ignore this email; your password stays the same.');
  }
  return { sent: true };
}
function forgotVerify_(body) {
  const email = hrEmail_(body.email), pw = String(body.password || '');
  if (pw.length < 8) throw new Error('The password must have at least 8 characters.');
  takeCode_('hr:rs|' + email, body.code);
  setPassword_(email, pw, { verified: 'Yes' });   // the code reached their inbox
  CacheService.getScriptCache().remove('hr:fail|' + email);
  return { done: true };
}
function setPassword_(email, pw, extra) {
  hrLock_(() => {
    const t = readUsers_(), r = t.rows.find(x => x.email === email);
    if (!r) throw new Error('No account with this email.');
    setCells_(t, r, Object.assign({ password: pw, oldSalt: '', oldHash: '' }, extra || {}));
  });
}

/* ============================================================ admin: users */

function users_() {
  const props = PropertiesService.getScriptProperties(), accs = hrLocal_().accounts;
  return { rows: readUsers_().rows.map(r => { const o = Object.assign({}, r); delete o._r; delete o.oldSalt; delete o.oldHash; o.level = o.level || 'Division'; return o; }),
    accounts: Object.keys(accs).map(u => ({ username: u, name: accs[u].name || u, role: accs[u].role, last: props.getProperty('hr:last|' + u) || '' })),
    circles: lists_().circles };
}
function withUser_(email, fn) {
  return hrLock_(() => { const t = readUsers_(), r = t.rows.find(x => x.email === hrEmail_(email)); if (!r) throw new Error('No account with this email.'); return fn(t, r); });
}
/** Approve or reject a pending account; the user is told by email (if that fails, the decision still stands). */
function userDecide_(body, user) {
  const ok = !!body.approve;
  const r = withUser_(body.email, (t, r) => { setCells_(t, r, { status: ok ? ST.active : ST.rejected, approvedBy: user.name, approvedOn: hrNow_() }); return r; });
  try { if (ok) hrMail_(r.email, HR.APP + ': your account is approved', 'Your AranyaHR account (' + (r.division || r.circle || 'State') + ') is approved. You can sign in now.'); } catch (e) {}
  return users_();
}
function userStatus_(body) {
  const on = !!body.active;
  withUser_(body.email, (t, r) => setCells_(t, r, { status: on ? ST.active : ST.disabled }));
  const c = CacheService.getScriptCache(), k = 'hr:off|' + hrEmail_(body.email);
  if (on) c.remove(k); else c.put(k, '1', HR_SESSION_HOURS * 3600);
  return users_();
}
function userPassword_(body) {
  const pw = String(body.password || '');
  if (pw.length < 8) throw new Error('The password must have at least 8 characters.');
  setPassword_(hrEmail_(body.email), pw);
  return users_();
}
/** Emails a link that marks the address as verified (valid 7 days). */
function sendVerify_(body) {
  const email = hrEmail_(body.email);
  withUser_(email, () => 0);
  const token = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('hr:ev|' + token, JSON.stringify({ email, until: Date.now() + 7 * 864e5 }));
  hrMail_(email, HR.APP + ': please verify your email', 'Please open this link to verify your email for AranyaHR:\n' + ScriptApp.getService().getUrl() + '?verify=' + token + '\n\nIf you do not use AranyaHR, ignore this email.');
  return { sent: true };
}
function verifyEmail_(token) {
  const props = PropertiesService.getScriptProperties(), s = props.getProperty('hr:ev|' + token);
  const o = s && JSON.parse(s);
  if (!o || o.until < Date.now()) throw new Error('This link has expired. Please ask the admin for a new one.');
  withUser_(o.email, (t, r) => setCells_(t, r, { verified: 'Yes' }));
  props.deleteProperty('hr:ev|' + token);
  return o.email;
}

/* ============================================================ home, overview, ranges */

/** The division a request is about: a division user's own; a circle user's choice inside their circle; anyone else's choice. */
function scopeDiv_(body, user) {
  if (!user.isAdmin && user.level === 'Division') return { circle: user.circle, division: user.division };
  const d = divs_().find(x => x.division === String(body.division || '') && (!body.circle || x.circle === body.circle));
  if (!d) return null;
  if (!user.isAdmin && user.level === 'Circle' && d.circle !== user.circle) throw new Error('Your account is for ' + user.circle + ' circle only.');
  return { circle: d.circle, division: d.division };
}
/** Everyone in one division, all cadres, with their AranyaHR range. */
function home_(body, user) {
  const d = scopeDiv_(body, user);
  if (!d) return { division: null, people: [], lists: lists_() };
  const ranges = rangesAll_(), people = [];
  Object.keys(modules_()).forEach(m => {
    const own = nameIn_(m, d.circle, d.division);
    modules_()[m].people(own.circle, own.division).forEach(p => { p.mod = m; p.rawRange = p.range; p.range = canonRange_(d.division, p.range, ranges); people.push(p); });
  });
  return { circle: d.circle, division: d.division, people, ranges: (ranges[d.division] || []).map(x => x.range), lists: lists_() };
}
/** Every division with each cadre's counts: {total, done} (done = verified / complete). */
function overview_(body, user) {
  const rows = divs_().map(d => ({ circle: d.circle, division: d.division, c: {} }));
  const at = {}; rows.forEach(r => at[r.division] = r);
  Object.keys(modules_()).forEach(m => modules_()[m].counts().forEach(x => {
    const canon = canonOf_(m, x.circle, x.division), r = canon && at[canon.division];
    if (r) r.c[x.cadre] = x;
  }));
  const shown = !user.isAdmin && user.level === 'Circle' ? rows.filter(r => r.circle === user.circle) : user.isAdmin || user.level === 'State' ? rows : [];
  return { rows: shown, pendingUsers: user.isAdmin ? readUsers_().rows.filter(r => r.status === ST.pending).length : 0 };
}
/** Admins: the Ranges tab and, per division, the range spellings that did not match. */
function ranges_(body) {
  const d = divs_().find(x => x.division === String(body.division || ''));
  if (!d) return { divisions: divs_().map(x => ({ circle: x.circle, division: x.division })) };
  const h = home_({ division: d.division, circle: d.circle }, { isAdmin: true });
  const odd = {}; h.people.forEach(p => { if (p.range === NOT_MATCHED) odd[p.rawRange] = (odd[p.rawRange] || 0) + 1; });
  return { circle: d.circle, division: d.division, ranges: h.ranges, unmatched: Object.keys(odd).map(k => ({ value: k, count: odd[k] })) };
}
/** Admins: adds a spelling to a range (or makes a new range when `range` is not in the list yet). */
function rangeAlias_(body) {
  const d = divs_().find(x => x.division === String(body.division || '')), range = String(body.range || '').trim(), alias = String(body.value || '').trim();
  if (!d || !range) throw new Error('Choose a division and a range.');
  hrLock_(() => {
    const sh = hrTab_(HR.RANGES), v = sh.getDataRange().getValues();
    const i = v.findIndex((r, j) => j > 0 && hrFmt_(r[1]) === d.division && hrFmt_(r[2]) === range);
    if (i > 0) { const al = hrFmt_(v[i][3]).split(';').map(s => s.trim()).filter(Boolean); if (alias && al.indexOf(alias) < 0) al.push(alias); sh.getRange(i + 1, 4).setNumberFormat('@').setValue(al.join('; ')); }
    else sh.getRange(sh.getLastRow() + 1, 1, 1, 4).setNumberFormat('@').setValues([[d.circle, d.division, range, alias && alias !== range ? alias : '']]);
  });
  CacheService.getScriptCache().remove('hr:ranges');
  return ranges_({ division: d.division });
}

/* ============================================================ setup and timer */

/**
 * Run once from the editor (and again after updating the script): adds the AranyaHR tabs, fills Divisions and Ranges
 * the first time, runs each module's setup, and sets the 10-minute timer (warm).
 */
function hrSetup() {
  const ss = hrSs_();
  const want = [[HR.USERS, USER_COLS.map(c => c[1])], [HR.DIVS, ['Circle', 'Division', MOD_COL.off, MOD_COL.fv, MOD_COL.cdl]],
    [HR.RANGES, ['Circle', 'Division', 'Range', 'Aliases (other spellings, separated by ;)']], [HR.SETTINGS, ['Setting', 'Value']]];
  want.forEach(([name, headers]) => {
    if (ss.getSheetByName(name)) return;
    const first = ss.getSheets()[0], blank = ss.getSheets().length === 1 && first.getLastRow() === 0 && want.every(w => w[0] !== first.getName());
    const sh = blank ? first.setName(name) : ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setWrap(true);
    sh.setFrozenRows(1);
    if (name === HR.SETTINGS) sh.getRange(2, 1, 1, 2).setValues([['Email code at sign-up', 'No']]);
  });
  Object.keys(modules_()).forEach(m => { modules_()[m].setup(); Logger.log(m + ': ready'); });
  if (hrTab_(HR.DIVS).getLastRow() < 2) seedDivisions_();
  CacheService.getScriptCache().removeAll(['hr:divs', 'hr:ranges', 'hr:settings']);
  if (hrTab_(HR.RANGES).getLastRow() < 2) seedRanges_();
  if (hrTab_(HR.USERS).getLastRow() < 2) moveCdlUsers_();
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'warm')) ScriptApp.newTrigger('warm').timeBased().everyMinutes(10).create();
  Logger.log('AranyaHR sheet: ' + ss.getUrl());
  Logger.log('Divisions: ' + divs_().length + ' · users: ' + readUsers_().rows.length + ' · admins: ' + Object.keys(hrLocal_().accounts).join(', '));
}
/** Every 10 minutes: each module refills its cache before it expires. */
function warm() { Object.keys(modules_()).forEach(m => { try { modules_()[m].warm(); } catch (e) { Logger.log(m + ': ' + e.message); } }); }

const normDiv_ = s => String(s || '').toLowerCase().replace(/\b(division|dn|div|forest|circle)\b\.?/g, '').replace(/[^a-z0-9]+/g, '');
/** First fill of the Divisions tab: CDL+BS's divisions, matched by name to the other two sheets. Check the blanks by hand. */
function seedDivisions_() {
  const lists = {}; Object.keys(modules_()).forEach(m => lists[m] = modules_()[m].divisions());
  const rows = lists.cdl.map(d => [d.circle, d.division].concat(Object.keys(MOD_COL).map(m => {
    const hit = lists[m].find(x => normDiv_(x.division) === normDiv_(d.division)) ;
    return hit ? hit.circle + ' | ' + hit.division : '';
  })));
  const sh = hrTab_(HR.DIVS);
  if (rows.length) sh.getRange(2, 1, rows.length, 5).setNumberFormat('@').setValues(rows);
  Logger.log('Divisions tab filled: ' + rows.length + ' rows. Fill any blank "In …" cell by hand.');
}
/** First fill of the Ranges tab: each different range spelling found in the division (one row per spelling; merge them later). */
function seedRanges_() {
  const rows = [];
  divs_().forEach(d => {
    const seen = {};
    Object.keys(modules_()).forEach(m => {
      const own = nameIn_(m, d.circle, d.division);
      modules_()[m].people(own.circle, own.division).forEach(p => {
        const raw = String(p.range || '').trim(), k = normRange_(raw);
        if (raw && !isHq_(raw) && k && !seen[k]) { seen[k] = 1; rows.push([d.circle, d.division, raw, '']); }
      });
    });
  });
  const sh = hrTab_(HR.RANGES);
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setNumberFormat('@').setValues(rows);
  Logger.log('Ranges tab filled: ' + rows.length + ' ranges.');
}
/** Users from the CDL+BS sheet's Users tab: Active division users with their old hash (replaced by the password at their next sign-in). */
function moveCdlUsers_() {
  const old = Cdlbs.oldUsers();
  if (!old.length) return;
  const t = readUsers_();
  const rows = old.map(u => {
    const canon = canonOf_('cdl', u.circle, u.division) || { circle: u.circle, division: u.division };
    const o = { email: u.email, level: 'Division', circle: canon.circle, division: canon.division, name: u.name, desig: u.desig, phone: u.phone,
      status: u.status === 'Active' ? ST.active : ST.disabled, verified: 'Yes', password: '', on: u.on, approvedBy: 'Moved from CDL+BS', approvedOn: hrNow_(),
      last: u.last, oldSalt: u.salt, oldHash: u.hash };
    return t.head.map(h => { const c = USER_COLS.find(x => x[1] === h); return c ? (o[c[0]] || '') : ''; });
  });
  t.sh.getRange(t.sh.getLastRow() + 1, 1, rows.length, t.head.length).setNumberFormat('@').setValues(rows);
  Logger.log('Users moved from CDL+BS: ' + rows.length);
}
