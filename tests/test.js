// End-to-end checks of the AranyaHR API against made-up sheets.
const { load } = require('./mock.js'), assert = require('assert');
const { books: makeBooks, OFF_H } = require('./seed.js');
const books = makeBooks();
const T = load(process.argv[2] || __dirname + '/../apps-script', books, { SHEET_IDS: { OFF: 'OFF', FV: 'FV', CDL: 'CDL', ASDEO: 'ASDEO', HR: 'HR' }, ACCOUNTS: { grv: { role: 'admin', name: 'PMC admin', password: 'admin-pass-1' } } });
// an old CDL+BS user, with the old 500-round hash
const oldHash = T.run("oldHash_('salt1', 'oldpassword')");
books.CDL.getSheetByName('Users').v.push(['old@x.in', 'Hill', 'Kurseong', 'Old User', 'RO', '9876543210', 'Active', '01-10-2026', '', 'salt1', oldHash]);
const ok = r => { if (!r.ok) throw new Error(r.error); return r.data; };
const bad = (r, re) => { assert(!r.ok, 'expected an error'); assert(re.test(r.error), r.error); };

T.run('hrSetup()');
const divs = books.HR.getSheetByName('Divisions').v; console.log('Divisions:', JSON.stringify(divs.slice(1)));
assert.deepStrictEqual(divs[1], ['Hill', 'Kurseong', 'Hill | Kurseong Dn.', 'Hill | Kurseong Dn.', 'Hill | Kurseong']);
console.log('Ranges:', JSON.stringify(books.HR.getSheetByName('Ranges').v.slice(1)));
assert(books.ASDEO.getSheetByName('Aranya Sathi') && books.ASDEO.getSheetByName('DEO'), 'AS+DEO tabs');

// moved CDL user signs in with the old password; the password is kept as text after that
const s0 = ok(T.post({ action: 'login', username: 'old@x.in', password: 'oldpassword' }));
const urow = books.HR.getSheetByName('Users').v.find(r => r[0] === 'old@x.in'), H = books.HR.getSheetByName('Users').v[0];
assert.strictEqual(urow[H.indexOf('Password')], 'oldpassword'); assert.strictEqual(urow[H.indexOf('Old hash')], '');
ok(T.post({ action: 'login', username: 'old@x.in', password: 'oldpassword' }));

// sign-up: every new account waits for approval; Kurseong already has old@x.in, so that one is told it is the second user
const base = { name: 'New Person', desig: 'DFO', phone: '9876500000', password: 'password12' };
assert.strictEqual(ok(T.post({ action: 'divisionUsers', division: 'Kurseong' })).count, 1);
const sec = ok(T.post(Object.assign({ action: 'signup', email: 'two@x.in', level: 'Division', circle: 'Hill', division: 'Kurseong' }, base)));
assert(sec.pending && sec.second && /second user/.test(sec.message), JSON.stringify(sec));
bad(T.post({ action: 'login', username: 'two@x.in', password: 'password12' }), /waiting for the admin/);
const first = ok(T.post(Object.assign({ action: 'signup', email: 'dj@x.in', level: 'Division', circle: 'Hill', division: 'Darjeeling' }, base)));
assert(first.pending && !first.second && !first.token, 'first user of a division waits too');
bad(T.post({ action: 'login', username: 'dj@x.in', password: 'password12' }), /waiting for the admin/);
const circ = ok(T.post(Object.assign({ action: 'signup', email: 'ccf@x.in', level: 'Circle', circle: 'Hill' }, base)));
assert(circ.pending && !circ.second);
ok(T.post(Object.assign({ action: 'signup', email: 'state@x.in', level: 'State' }, base)));

// admin approves the circle user
const adm = ok(T.post({ action: 'login', username: 'grv', password: 'admin-pass-1' })).token;
bad(T.post({ action: 'login', username: 'grv', password: 'nope' }), /Wrong/);
const ov0 = ok(T.post({ action: 'overview', token: adm })); assert.strictEqual(ov0.pendingUsers, 4);
const us = ok(T.post({ action: 'users', token: adm })); assert(us.rows.find(r => r.email === 'two@x.in').password === 'password12');
ok(T.post({ action: 'userDecide', token: adm, email: 'ccf@x.in', approve: true }));
assert(T.mail.some(m => m.to === 'ccf@x.in' && /approved/.test(m.subject)));
const ccf = ok(T.post({ action: 'login', username: 'ccf@x.in', password: 'password12' })).token;
ok(T.post({ action: 'userDecide', token: adm, email: 'dj@x.in', approve: true }));
const djTok = ok(T.post({ action: 'login', username: 'dj@x.in', password: 'password12' })).token;

// division user: home shows all cadres of their own division, ranges matched
const ku = s0.token;
const h = ok(T.post({ action: 'home', token: ku, division: 'Darjeeling' }));   // asks for another division: gets their own
assert.strictEqual(h.division, 'Kurseong');
console.log('Home Kurseong:', h.people.map(p => p.cadre + ':' + p.name + '@' + p.range).join(', '));
assert.deepStrictEqual(h.people.map(p => p.cadre).sort(), ['CDL', 'DFR', 'FG', 'FR']);
const fr1 = h.people.find(p => p.id === 'FR1'), d1 = h.people.find(p => p.id === 'D1'), c1 = h.people.find(p => p.id === 'C1');
assert.strictEqual(fr1.range, d1.range, 'Sukna Range and Sukna are one range'); assert.strictEqual(c1.range, fr1.range, 'Sukna R. too');
assert.strictEqual(h.people.find(p => p.id === 'G1').range, 'Div HQ');

// officers: own division verified; another division refused even when asked by ID
const od = ok(T.post({ action: 'off.division', token: ku, circle: 'Hill', division: 'Darjeeling' }));
assert.deepStrictEqual(od.officers.map(o => o.id).sort(), ['D1', 'FR1', 'G1']);
ok(T.post({ action: 'off.verify', token: ku, cadre: 'FR', id: 'FR1' }));
assert.strictEqual(books.OFF.getSheetByName('FR').v[1][OFF_H.indexOf('Verification')], 'Verified - All correct');
bad(T.post({ action: 'off.verify', token: ku, cadre: 'FR', id: 'FR2' }), /only Kurseong/);
const op = books.OFF.getSheetByName('Change Log').v.find(r => r[9] === 'FR1'); assert.strictEqual(op[4], 'Old User'); assert.strictEqual(op[5], 'RO');
bad(T.post({ action: 'off.adminData', token: ku, cadre: 'FR' }), /administrators/);
assert.strictEqual(typeof ok(T.post({ action: 'off.adminSummary', token: adm })).pending, 'number');
assert(Array.isArray(ok(T.post({ action: 'off.adminChanges', token: adm })))); 

// FV: saves into Kurseong's FV name
const fvm = ok(T.post({ action: 'fv.meta', token: ku }));
const fvs = ok(T.post({ action: 'fv.save', token: ku, circle: 'Northern', division: 'Jalpaiguri', base: 0, rows: [{ key: 'k1', name: 'Gopal Lama', placeType: 'Range', placeName: 'Sukna', placeSub: 'Range HQ' }] }));
assert.strictEqual(fvs.changes > 0, true);
assert.strictEqual(books.FV.getSheetByName('Volunteers').v[1][2], 'Kurseong Dn.', 'saved to own division (FV spelling)');

// CDL module: AS and DEO added straight away; a new DL waits; confirm and certify
const asId = 'AS-0000ABCD', deoId = 'DEO-0000ABCD';
const per = (id, cadre) => ({ id, cadre, name: 'Hari ' + cadre, mode: 'Agency', agency: 'X', date: '2024', district: 'Darjeeling', range: 'Sukna', place: 'Office', duty: 'Driver', pay: 9000 });
assert.strictEqual(ok(T.post({ action: 'cdl.add', token: ku, person: per(asId, 'AS') })).rows[0].state, 'active');
ok(T.post({ action: 'cdl.add', token: ku, person: per(deoId, 'DEO') }));
assert.strictEqual(ok(T.post({ action: 'cdl.add', token: ku, person: per('NEW-0000ABCD', 'CDL') })).rows[0].state, 'add-pending');
assert.strictEqual(books.ASDEO.getSheetByName('Aranya Sathi').v[1][0], asId); assert.strictEqual(books.ASDEO.getSheetByName('DEO').v[1][2], 'Kurseong');
const cl = ok(T.post({ action: 'cdl.load', token: ku, division: 'Darjeeling' }));
assert.strictEqual(cl.division, 'Kurseong'); assert.deepStrictEqual(cl.rows.map(r => r.cadre).sort(), ['AS', 'CDL', 'CDL', 'DEO']);
const cf = ok(T.post({ action: 'cdl.confirm', token: ku, ids: [asId] })); assert.strictEqual(cf.done, 1);
ok(T.post({ action: 'cdl.certify', token: ku, division: 'x', cadre: 'AS', name: 'DFO', desig: 'DFO Kurseong' }));
bad(T.post({ action: 'cdl.update', token: ku, id: asId, ch: { remarks: 'x' } }), /certified/);
const cm = ok(T.post({ action: 'cdl.meta', token: adm })); const km = cm.divisions.find(d => d.division === 'Kurseong');
assert.strictEqual(km.AS.confirmed, 1); assert.strictEqual(km.DEO.all, 1); assert.strictEqual(cm.userCounts.Kurseong, 1);
assert.strictEqual(ok(T.post({ action: 'cdl.pending', token: adm })).rows.length, 1);
const log = ok(T.post({ action: 'cdl.log', token: adm })); assert(log.rows.some(r => r.cadre === 'AS'), 'AS in the log');

// circle user: reads inside the circle, cannot change anything, cannot see another circle
const hc = ok(T.post({ action: 'home', token: ccf, division: 'Darjeeling' })); assert.strictEqual(hc.division, 'Darjeeling');
bad(T.post({ action: 'home', token: ccf, division: 'Jalpaiguri' }), /Hill circle only/);
bad(T.post({ action: 'off.verify', token: ccf, cadre: 'FR', id: 'FR2', circle: 'Hill', division: 'Darjeeling' }), /only view/);
bad(T.post({ action: 'off.division', token: ccf, circle: 'Northern', division: 'Jalpaiguri' }), /Hill circle only/);
const ovc = ok(T.post({ action: 'overview', token: ccf })); assert(ovc.rows.every(r => r.circle === 'Hill'));

// overview and ranges for admins
const ov = ok(T.post({ action: 'overview', token: adm })); const ko = ov.rows.find(r => r.division === 'Kurseong').c;
console.log('Overview Kurseong:', JSON.stringify(ko));
assert.strictEqual(ko.FR.done, 1); assert.strictEqual(ko.FV.total, 1); assert.strictEqual(ko.AS.done, 1);
books.HR.getSheetByName('Ranges').v.push(['Hill', 'Kurseong', 'Bagdogra', '']); T.run("CacheService.getScriptCache().remove('hr:ranges')");
ok(T.post({ action: 'off.submit', token: ku, cadre: 'DFR', id: 'D1', changes: [{ field: 'Present Range / Office', value: 'Bagdogra Rng' }] }));
const rg = ok(T.post({ action: 'ranges', token: adm, division: 'Kurseong' })); console.log('Ranges Kurseong:', JSON.stringify(rg));
ok(T.post({ action: 'rangeAlias', token: adm, division: 'Kurseong', range: 'Bagdogra', value: 'Bagdogra R' }));

// settings: email code at sign-up; admin's verify link
ok(T.post({ action: 'setSetting', token: adm, key: 'Email code at sign-up', value: 'Yes' }));
assert(ok(T.post({ action: 'lists' })).emailCode);
assert(ok(T.post(Object.assign({ action: 'signup', email: 'jal@x.in', level: 'Division', circle: 'Northern', division: 'Jalpaiguri' }, base))).sent);
const code = /code is (\d{6})/.exec(T.mail[T.mail.length - 1].body)[1];
assert(ok(T.post({ action: 'signupVerify', email: 'jal@x.in', code })).pending);
ok(T.post({ action: 'sendVerify', token: adm, email: 'dj@x.in' }));
const tok = /verify=(\w+)/.exec(T.mail[T.mail.length - 1].body)[1];
assert(/is verified/.test(T.ctx.doGet({ parameter: { verify: tok } })));
assert.strictEqual(ok(T.post({ action: 'users', token: adm })).rows.find(r => r.email === 'dj@x.in').verified, 'Yes');
ok(T.post({ action: 'userStatus', token: adm, email: 'dj@x.in', active: false }));
bad(T.post({ action: 'home', token: djTok }), /disabled/);
console.log('All checks passed.');
