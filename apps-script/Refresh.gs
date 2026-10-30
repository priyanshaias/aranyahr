/**
 * Brings what divisions entered in the earlier apps into the AranyaHR copies: Forest Volunteers (old FV sheet)
 * and Ban Sahayaks (old CDL+BS sheet). Run from the editor:
 *   refreshFromOldCheck()  shows what would change and writes nothing;
 *   refreshFromOld()       makes the change.
 * Old sheet IDs: OLD_SHEET_IDS in Config.local.gs. The old sheets are only read.
 *
 * People are matched by their ID:
 *   in both sheets       → the row with the later "last updated" is kept (on a tie, AranyaHR's: they are the same);
 *   only in the old one  → added (entered in the old app after the copy was made);
 *   only in AranyaHR     → kept if it was saved in AranyaHR after COPIED_ON, else dropped (removed in the old app).
 * Change Log and Certificates rows of the old sheet that AranyaHR does not have yet are added. Running it twice changes nothing.
 */
const COPIED_ON = '29-10-2026 12:41:11';   // when the AranyaHR copies were made (IST, from Drive)

const REFRESH = [
  { name: 'Forest Volunteers', old: 'FV', to: () => SpreadsheetApp.openById(sheetId_('FV')), tab: 'Volunteers', id: 'Volunteer ID', when: 'Last Updated On',
    dates: ['Date of Birth', 'Date of Joining'], log: { tab: 'Change Log' } },
  { name: 'Ban Sahayaks', old: 'CDL', to: () => SpreadsheetApp.openById(sheetId_('CDL')), tab: 'Ban Sahayak', id: 'ID', when: 'Last updated on', dates: [],
    log: { tab: 'Change Log', only: ['Cadre', 'Ban Sahayak'] }, certs: { tab: 'Certificates', only: ['Cadre', 'BS'] } },
];

function refreshFromOldCheck() { refreshFromOld_(false); }
function refreshFromOld() { refreshFromOld_(true); }

function refreshFromOld_(write) {
  const L = (typeof LOCAL_CONFIG !== 'undefined' && LOCAL_CONFIG.OLD_SHEET_IDS) || {};
  hrLock_(() => REFRESH.forEach(r => {
    if (!L[r.old]) throw new Error('Put OLD_SHEET_IDS.' + r.old + ' in Config.local.gs.');
    const from = SpreadsheetApp.openById(L[r.old]), to = r.to();
    const p = mergePeople_(from.getSheetByName(r.tab), to.getSheetByName(r.tab), r, write);
    const lg = r.log ? addMissing_(from.getSheetByName(r.log.tab), to.getSheetByName(r.log.tab), r.log.only, write) : 0;
    const ce = r.certs ? addMissing_(from.getSheetByName(r.certs.tab), to.getSheetByName(r.certs.tab), r.certs.only, write) : 0;
    Logger.log((write ? '' : 'CHECK ONLY, nothing written. ') + r.name + ': ' + p.total + ' people after the refresh · ' + p.added + ' added from the old app · '
      + p.updated + ' updated from the old app · ' + p.dropped + ' removed (removed in the old app) · ' + p.keptNew + ' kept (saved in AranyaHR) · '
      + lg + ' change-log rows added' + (r.certs ? ' · ' + ce + ' certificates added' : ''));
    if (p.samples.length) Logger.log('  for example: ' + p.samples.join('; '));
    // FV saves a division's whole list: a new version makes anyone who had it open reload before saving over the refreshed rows
    if (write && r.old === 'FV') Object.keys(p.touched).forEach(k => {
      const [c, d] = p.touched[k], props = prefixedProps_('fv:').getScriptProperties(), key = 'ver|' + c + '|' + d;
      const v = JSON.parse(props.getProperty(key) || '{"n":0}');
      props.setProperty(key, JSON.stringify({ n: (v.n || 0) + 1, on: hrNow_(), by: 'Refreshed from the old FV app' }));
    });
  }));
  if (write) { Cdlbs.setup(); Logger.log('Done. The CDL+BS cache is rebuilt; the dashboard shows the new numbers on Refresh.'); }
}

/** "dd-mm-yyyy HH:mm(:ss)" or a date → "yyyymmddHHmmss", for comparing. */
function stamp_(v) {
  if (hrIsDate_(v)) return Utilities.formatDate(v, HR.TZ, 'yyyyMMddHHmmss');
  const m = /^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(v || '').trim());
  return m ? m[3] + m[2] + m[1] + (m[4] || '00') + (m[5] || '00') + (m[6] || '00') : '';
}

/** One people tab: the merge described at the top, written in the AranyaHR tab's own column order. */
function mergePeople_(fromSh, toSh, r, write) {
  if (!fromSh || !toSh) throw new Error('Tab "' + r.tab + '" is missing in the old or the AranyaHR sheet.');
  const read = sh => { const v = sh.getDataRange().getValues(), head = v[0].map(h => String(h).trim()); return { head, rows: v.slice(1).filter(x => String(x[head.indexOf(r.id)] || '').trim()) }; };
  const A = read(fromSh), B = read(toSh), since = stamp_(COPIED_ON);
  [r.id, r.when].forEach(h => { if (A.head.indexOf(h) < 0 || B.head.indexOf(h) < 0) throw new Error('Column "' + h + '" is missing in ' + r.tab + '.'); });
  const idOf = (t, x) => String(x[t.head.indexOf(r.id)]).trim(), whenOf = (t, x) => stamp_(x[t.head.indexOf(r.when)]);
  const inB = row => B.head.map(h => { const i = A.head.indexOf(h); return i < 0 ? '' : row[i]; });   // an old row in AranyaHR's columns
  const old = {}; A.rows.forEach(x => old[idOf(A, x)] = x);
  const out = [], seen = {}, s = { added: 0, updated: 0, dropped: 0, keptNew: 0, samples: [] };
  const name = x => x[B.head.findIndex(h => /^Name/.test(h))] || '';
  s.touched = {}; const touch = (x, t) => { const c = x[t.head.indexOf('Circle')], d = x[t.head.indexOf('Division')]; s.touched[c + '|' + d] = [c, d]; };
  B.rows.forEach(x => {   // AranyaHR's rows, in their order
    const id = idOf(B, x), o = old[id]; seen[id] = 1;
    if (o) {
      if (whenOf(A, o) > whenOf(B, x)) { out.push(inB(o)); s.updated++; touch(o, A); if (s.samples.length < 5) s.samples.push('updated ' + name(inB(o))); }
      else out.push(x);
    } else if (whenOf(B, x) > since) { out.push(x); s.keptNew++; }
    else { s.dropped++; touch(x, B); if (s.samples.length < 5) s.samples.push('removed ' + name(x)); }
  });
  A.rows.forEach(x => { const id = idOf(A, x); if (!seen[id]) { out.push(inB(x)); s.added++; touch(x, A); if (s.samples.length < 5) s.samples.push('added ' + name(inB(x))); } });
  s.total = out.length;
  if (write && (s.added || s.updated || s.dropped)) {
    const n = B.head.length, last = toSh.getLastRow();
    if (last > 1) toSh.getRange(2, 1, last - 1, Math.max(n, toSh.getLastColumn())).clearContent();
    if (out.length) {
      toSh.getRange(2, 1, out.length, n).setNumberFormat('@');   // plain text everywhere, real dates in the date columns (as the apps write them)
      r.dates.forEach(h => { const i = B.head.indexOf(h); if (i >= 0) toSh.getRange(2, i + 1, out.length, 1).setNumberFormat('dd-mm-yyyy'); });
      toSh.getRange(2, 1, out.length, n).setValues(out);
    }
  }
  return s;
}

/** Log or certificate rows of the old tab that the AranyaHR tab does not have yet (only: [column, value] to take). */
function addMissing_(fromSh, toSh, only, write) {
  if (!fromSh || !toSh) return 0;
  const A = fromSh.getDataRange().getValues(), B = toSh.getDataRange().getValues();
  const ha = A[0].map(h => String(h).trim()), hb = (B[0] || []).map(h => String(h).trim());
  const key = row => row.map(v => hrIsDate_(v) ? stamp_(v) : String(v).trim()).join('|');
  const have = {}; B.slice(1).forEach(x => have[key(x)] = 1);
  const add = A.slice(1).filter(x => x.some(v => String(v).trim()) && (!only || String(x[ha.indexOf(only[0])]).trim() === only[1]))
    .map(x => hb.map(h => { const i = ha.indexOf(h); return i < 0 ? '' : x[i]; })).filter(x => !have[key(x)]);
  if (write && add.length) toSh.getRange(toSh.getLastRow() + 1, 1, add.length, hb.length).setNumberFormat('@').setValues(add.map(x => x.map(v => hrIsDate_(v) ? hrFmt_(v) : v)));
  return add.length;
}
