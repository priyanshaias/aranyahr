// A small in-memory stand-in for the Apps Script services the AranyaHR API uses.
const zlib = require('zlib'), crypto = require('crypto'), fs = require('fs'), vm = require('vm');
function Sheet(name, rows) { this.name = name; this.v = rows || []; }
Sheet.prototype = {
  getName() { return this.name; }, setName(n) { this.name = n; return this; }, setFrozenRows() {},
  getLastRow() { let n = this.v.length; while (n && this.v[n - 1].every(x => x === '' || x == null)) n--; return n; },
  getLastColumn() { return Math.max(0, ...this.v.map(r => { let n = r.length; while (n && (r[n - 1] === '' || r[n - 1] == null)) n--; return n; })); },
  getMaxRows() { return Math.max(1000, this.v.length); },
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); },
  deleteRow(r) { this.v.splice(r - 1, 1); },
  getRange(r, c, nr = 1, nc = 1) {
    const sh = this, ensure = () => { while (sh.v.length < r - 1 + nr) sh.v.push([]); };
    const rg = {
      getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = sh.v[r - 1 + i] || []; const o = []; for (let j = 0; j < nc; j++) o.push(row[c - 1 + j] == null ? '' : row[c - 1 + j]); out.push(o); } return out; },
      setValues(vals) { ensure(); vals.forEach((row, i) => row.forEach((x, j) => { const R = sh.v[r - 1 + i]; while (R.length < c - 1 + j) R.push(''); R[c - 1 + j] = x; })); return rg; },
      setValue(x) { return rg.setValues([[x]]); }, clearContent() { ensure(); for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sh.v[r - 1 + i][c - 1 + j] = ''; return rg; },
      setNumberFormat() { return rg; }, setNumberFormats() { return rg; }, setFontWeight() { return rg; }, setWrap() { return rg; }, setDataValidation() { return rg; },
    };
    return rg;
  },
};
function Book(id, tabs) { this.id = id; this.sheets = Object.keys(tabs).map(k => new Sheet(k, tabs[k])); if (!this.sheets.length) this.sheets.push(new Sheet('Sheet1')); }
Book.prototype = {
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }, getSheets() { return this.sheets; },
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }, getUrl() { return 'https://sheet/' + this.id; }, getName() { return this.id; }, getId() { return this.id; },
};
function services(books, mail) {
  const cache = {}, props = {}, chain = new Proxy({}, { get: (t, k) => k === 'build' ? () => ({}) : () => chain });
  const pad = n => String(n).padStart(2, '0');
  return {
    SpreadsheetApp: { openById: id => { if (!books[id]) throw new Error('no sheet ' + id); return books[id]; }, getActiveSpreadsheet: () => null, newDataValidation: () => chain },
    CacheService: { getScriptCache: () => ({
      get: k => k in cache ? cache[k] : null, put: (k, v) => { if (String(v).length > 100000) throw new Error('cache value too big: ' + k); cache[k] = String(v); }, remove: k => { delete cache[k]; },
      getAll: ks => ks.reduce((a, k) => (k in cache && (a[k] = cache[k]), a), {}), putAll: o => Object.keys(o).forEach(k => cache[k] = String(o[k])), removeAll: ks => ks.forEach(k => delete cache[k]) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => k in props ? props[k] : null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => Object.assign({}, props) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail: o => mail.push(o) },
    ContentService: { createTextOutput: s => ({ setMimeType() { return s; } }), MimeType: { JSON: 'json' } },
    HtmlService: { createHtmlOutput: s => s },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => chain, getService: () => ({ getUrl: () => 'https://script/exec' }) },
    Logger: { log: s => (global.LOGS = global.LOGS || []).push(s) },
    Utilities: {
      getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (a, s) => [...crypto.createHash('sha256').update(s, 'utf8').digest()].map(b => b > 127 ? b - 256 : b),
      newBlob: (d) => ({ getBytes: () => Buffer.isBuffer(d) ? d : Buffer.from(d), getDataAsString: () => Buffer.from(d).toString() }),
      gzip: b => ({ getBytes: () => zlib.gzipSync(b.getBytes()) }), ungzip: b => ({ getDataAsString: () => zlib.gunzipSync(b.getBytes()).toString() }),
      base64Encode: b => Buffer.from(b).toString('base64'), base64Decode: s => Buffer.from(s, 'base64'),
      formatDate: (d, tz, f) => f.replace('yyyy', d.getFullYear()).replace('yy', String(d.getFullYear()).slice(2)).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate()))
        .replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())).replace('ss', pad(d.getSeconds())),
    },
  };
}
function load(dir, books, config) {
  const mail = [], ctx = vm.createContext(Object.assign(services(books, mail), { console }));
  ['Core.gs', 'Officers.gs', 'Volunteers.gs', 'Cdlbs.gs', 'Refresh.gs'].filter(f => fs.existsSync(dir + '/' + f)).forEach(f => vm.runInContext(fs.readFileSync(dir + '/' + f, 'utf8'), ctx, { filename: f }));
  vm.runInContext('var LOCAL_CONFIG = ' + JSON.stringify(config), ctx);
  const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }));
  return { ctx, post, mail, run: s => vm.runInContext(s, ctx) };
}
module.exports = { Book, load };
