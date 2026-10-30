// Checks refreshFromOld (apps-script/Refresh.gs): FV and Ban Sahayak rows and logs from the old sheets into the AranyaHR copies.
const { Book, load } = require('./mock.js'), { books: makeBooks, CDL_H } = require('./seed.js'), assert = require('assert'), path = require('path');
const FV_H = ['Volunteer ID', 'Circle', 'Division', 'Sl No', 'Name of Forest Volunteer Engaged', 'Date of Birth', 'Educational Qualification', "Forest Dept.'s approval ref",
  "Forest Directorate's Ref no sent to the Circle in Charge", 'Appointment Order issued by / reference', 'Date of Joining', 'Posted at (Div HQ / Range)', 'Range name',
  'Within the range (Range HQ / Beat / Camp)', 'Nature of Works assigned', 'Last Updated On', 'Last Updated By'];
const fv = (id, name, on, extra) => Object.assign([id, 'Hill', 'Kurseong Dn.', 1, name, new Date(1995, 0, 1), 'HS', 'R1', 'R2', 'R3', new Date(2024, 0, 1), 'Range', 'Sukna', 'Range HQ', 'Nursery Operations', on, 'Op'], extra || {});
const FVLOG_H = ['When', 'Username', 'Saved by', 'Designation', 'Mobile', 'Circle', 'Division', 'Volunteer ID', 'Volunteer', 'Action', 'Field', 'Old value', 'New value'];
const LOG_H = ['When', 'Username', 'By', 'Circle', 'Division', 'Cadre', 'ID', 'Person', 'Action', 'Field', 'Old value', 'New value'];
const CERT_H = ['Division', 'Cadre', 'Certified by', 'Designation', 'On', 'Entered by'];
const bs = (id, name, on, extra) => { const r = CDL_H.map(() => ''); Object.assign(r, { 0: id, 1: 'Hill', 2: 'Kurseong', 3: name, 4: 'Direct', 15: 12000, 18: 'Working', 21: on, 22: 'Op' }, extra || {}); return r; };

const books = makeBooks();
// the AranyaHR copies, as copied on 29-10-2026 12:40, plus later AranyaHR saves
books.FV = new Book('FV', { Volunteers: [FV_H, fv('FV-1', 'Asha', '20-10-2026 10:00:00'), fv('FV-2', 'Bimal', '30-10-2026 09:00:00', { 6: 'Graduate' }), fv('FV-4', 'Dhiren', '21-10-2026 10:00:00'), fv('FV-5', 'Esha', '30-10-2026 11:00:00')],
  'Change Log': [FVLOG_H, ['20-10-2026 10:00:00', 'u', 'Op', '', '', 'Hill', 'Kurseong Dn.', 'FV-1', 'Asha', 'Added', '', '', '']], Lists: [['Circle', 'Office', 'Division'], ['Hill', 'CCF, Hill', 'Kurseong Dn.']] });
const cdl = books.CDL;
cdl.getSheetByName('Ban Sahayak').v.push(bs('BS-00000001', 'Gita', '20-10-2026 10:00:00'), bs('BS-00000004', 'Jagat', '21-10-2026 10:00:00'));
cdl.getSheetByName('Change Log').v.push(['20-10-2026 10:00:00', 'u', 'Op', 'Hill', 'Kurseong', 'Ban Sahayak', 'BS-00000001', 'Gita', 'Added', '', '', 'Ban Sahayak']);
const dlBefore = JSON.stringify(cdl.getSheetByName('DL-CDL').v);
// the old apps' sheets, after more work by the divisions
books.OLDFV = new Book('OLDFV', { Volunteers: [FV_H, fv('FV-1', 'Asha Rai', '30-10-2026 08:00:00'), fv('FV-2', 'Bimal', '29-10-2026 15:00:00'), fv('FV-3', 'Chhaya', '30-10-2026 08:30:00')],
  'Change Log': [FVLOG_H, ['20-10-2026 10:00:00', 'u', 'Op', '', '', 'Hill', 'Kurseong Dn.', 'FV-1', 'Asha', 'Added', '', '', ''], ['30-10-2026 08:00:00', 'u', 'Op', '', '', 'Hill', 'Kurseong Dn.', 'FV-1', 'Asha Rai', 'Edited', 'Name', 'Asha', 'Asha Rai']] });
books.OLDCDL = new Book('OLDCDL', {
  'Ban Sahayak': [CDL_H, bs('BS-00000001', 'Gita Lama', '30-10-2026 08:00:00'), bs('BS-00000003', 'Indu', '30-10-2026 08:30:00')],
  'DL-CDL': [CDL_H, bs('C9', 'Should not move', '30-10-2026 08:00:00')],
  'Change Log': [LOG_H, ['20-10-2026 10:00:00', 'u', 'Op', 'Hill', 'Kurseong', 'Ban Sahayak', 'BS-00000001', 'Gita', 'Added', '', '', 'Ban Sahayak'],
    ['30-10-2026 08:00:00', 'u', 'Op', 'Hill', 'Kurseong', 'Ban Sahayak', 'BS-00000001', 'Gita Lama', 'Edit', 'Name', 'Gita', 'Gita Lama'],
    ['30-10-2026 08:10:00', 'u', 'Op', 'Hill', 'Kurseong', 'DL / CDL', 'C9', 'X', 'Edit', 'Name', 'a', 'b']],
  Certificates: [CERT_H, ['Kurseong', 'BS', 'DFO', 'DFO Kurseong', '30-10-2026 09:00:00', 'Op'], ['Kurseong', 'CDL', 'DFO', 'DFO Kurseong', '30-10-2026 09:00:00', 'Op']],
});
const T = load(path.join(__dirname, '../apps-script'), books, { SHEET_IDS: { OFF: 'OFF', FV: 'FV', CDL: 'CDL', ASDEO: 'ASDEO', HR: 'HR' }, OLD_SHEET_IDS: { FV: 'OLDFV', CDL: 'OLDCDL' },
  ACCOUNTS: { grv: { role: 'admin', name: 'A', password: 'x' } } });
T.run('hrSetup()');
const snap = () => JSON.stringify([books.FV.getSheetByName('Volunteers').v, cdl.getSheetByName('Ban Sahayak').v, books.FV.getSheetByName('Change Log').v, cdl.getSheetByName('Change Log').v, cdl.getSheetByName('Certificates').v]);

// check only: nothing changes, and the log says what would
const before = snap(); global.LOGS = [];
T.run('refreshFromOldCheck()');
assert.strictEqual(snap(), before, 'check writes nothing');
console.log(global.LOGS.filter(l => /CHECK/.test(l)).join('\n'));
assert(/Forest Volunteers: 4 people after the refresh · 1 added from the old app · 1 updated from the old app · 1 removed .* · 1 kept .* · 1 change-log rows added/.test(global.LOGS.join('\n')));
assert(/Ban Sahayaks: 2 people after the refresh · 1 added .* · 1 updated .* · 1 removed .* · 0 kept .* · 1 change-log rows added · 1 certificates added/.test(global.LOGS.join('\n')));

T.run('refreshFromOld()');
const V = books.FV.getSheetByName('Volunteers').v.slice(1), byId = id => V.find(r => r[0] === id);
assert.deepStrictEqual(V.map(r => r[0]), ['FV-1', 'FV-2', 'FV-5', 'FV-3'], 'FV rows: updated, kept, kept (saved in AranyaHR), added; FV-4 removed');
assert.strictEqual(byId('FV-1')[4], 'Asha Rai', 'newer old-app edit wins');
assert.strictEqual(byId('FV-2')[6], 'Graduate', 'newer AranyaHR edit wins');
assert(byId('FV-3')[5] instanceof Date, 'dates stay dates');
const B = cdl.getSheetByName('Ban Sahayak').v.slice(1);
assert.deepStrictEqual(B.map(r => r[0]), ['BS-00000001', 'BS-00000003']); assert.strictEqual(B[0][3], 'Gita Lama');
assert.strictEqual(JSON.stringify(cdl.getSheetByName('DL-CDL').v), dlBefore, 'DL / CDL is not touched');
const CL = cdl.getSheetByName('Change Log').v; assert(CL.some(r => r[7] === 'Gita Lama') && !CL.some(r => r[6] === 'C9'), 'only Ban Sahayak log rows');
const CE = cdl.getSheetByName('Certificates').v; assert(CE.some(r => r[1] === 'BS') && !CE.some(r => r[1] === 'CDL'), 'only BS certificates');
assert.strictEqual(books.FV.getSheetByName('Change Log').v.length, 3);
assert(/"n":1/.test(T.run("PropertiesService.getScriptProperties().getProperty('fv:ver|Hill|Kurseong Dn.')")), 'FV division version moved on');
// the app reads the refreshed rows
const tok = T.post({ action: 'login', username: 'grv', password: 'x' }).data.token;
const bsl = T.post({ action: 'cdl.load', token: tok, division: 'Kurseong' }).data.rows.filter(r => r.cadre === 'BS').map(r => r.name).sort();
assert.deepStrictEqual(bsl, ['Gita Lama', 'Indu'], 'CDL+BS cache rebuilt');
// running it again changes nothing
const after = snap(); T.run('refreshFromOld()'); assert.strictEqual(snap(), after, 'second run changes nothing');
console.log('All refresh checks passed.');
