// Demo backend for Forest Volunteers: made-up names, kept only in this browser. Mirrors apps-script/Code.gs.
(function () {
  const CIRCLES = [
    ['Central', 'CCF, Central', ['Circle HQ', 'Bankura (N)', 'Bankura (S)', 'Panchet']],
    ['Western', 'CCF, Western', ['Circle HQ', 'Medinipur', 'Purba Medinipur', 'Kharagpur', 'Jhargram', 'Rupnarayan']],
    ['South East', 'CCF, South East', ['Circle HQ', 'Burdwan', 'Birbhum', 'Durgapur']],
    ['South West', 'CCF, South West', ['Circle HQ', 'Purulia', 'Kangsabati (N)', 'Kangsabati (S)', 'Extn. Forestry']],
    ['North West', 'CF, North West', ['Circle HQ', 'Malda', 'Raiganj', 'Siliguri S.F', 'Jalpaiguri S.F.']],
    ['Hill', 'CCF, Hill', ['Circle HQ', 'Darjeeling', 'Kalimpong', 'Kurseong Dn.']],
    ['Northern', 'CCF, Northern', ['Circle HQ', 'Jalpaiguri', 'Baikunthapur', 'NTFP', 'Coochbehar']],
    ['Wild Life North', 'CCF, WL North', ['Circle HQ', 'Darjeeling WL', 'Gorumara WL', 'Jaldapara WL']],
    ['BTR', 'CCF & FD, BTR', ['Circle HQ', 'B.T.R (East)', 'B.T.R (West)']],
    ['SBR', 'Joint Director, SBR', ['Circle HQ', '24 Parganas (S)', '24 Parganas (N)', 'Nadia-Murshidabad']],
  ].map(([circle, office, divisions]) => ({ circle, office, divisions }));
  const FIELDS = ['name', 'dob', 'qual', 'deptRef', 'dirRef', 'apptRef', 'doj', 'placeType', 'placeName', 'placeSub', 'works'];
  const LABEL = { name: 'Name of Forest Volunteer Engaged', dob: 'Date of Birth', qual: 'Educational Qualification', deptRef: "Forest Dept.'s approval ref",
    dirRef: "Forest Directorate's Ref no sent to the Circle in Charge", apptRef: 'Appointment Order issued by / reference', doj: 'Date of Joining',
    placeType: 'Posted at (Div HQ / Range)', placeName: 'Range name', placeSub: 'Within the range (Range HQ / Beat / Camp)', works: 'Nature of Works assigned' };
  const KEY = 'fv_demo_db_v2';
  const pad = n => String(n).padStart(2, '0');
  const now = () => { const d = new Date(); return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  const uid = () => 'FV-' + Math.random().toString(16).slice(2, 10).toUpperCase();

  function seed() {
    const mk = (c, d, list, by, on) => list.map(([name, dob, qual, place, pname, works], i) => ({ id: uid(), circle: c, division: d, sl: i + 1, name, dob, qual,
      deptRef: 'No. 1123/FD/2025 dt 12-06-2025', dirRef: 'No. 482/PCCF(HoFF)/2025', apptRef: 'DFO, ' + d + ' · Memo ' + (310 + i) + '/' + d.slice(0, 3).toUpperCase(),
      doj: '0' + (1 + i % 9) + '-07-2025', updOn: on, updBy: by, works,
      // place: "Div HQ", or [range, "Range HQ" | "Beat: x" | "Camp: x"]
      placeType: place === 'Div HQ' ? 'Div HQ' : 'Range', placeName: place === 'Div HQ' ? '' : place[0], placeSub: place === 'Div HQ' ? '' : place[1] }));
    const rows = [].concat(
      mk('Central', 'Bankura (N)', [
        ['Ratan Mandi', '14-03-1998', 'Higher Secondary (Class XII)', ['Beliatore', 'Range HQ'], '', 'Human-Animal Conflict Management'],
        ['Sumana Kisku', '02-11-2000', 'Graduate', 'Div HQ', '', 'Others: Office work and data entry in DFO office'],
        ['Bapi Lohar', '21-08-1996', 'Madhyamik (Class X)', ['Barjora', 'Beat: Barjora'], '', 'Nursery Operations'],
      ], 'Demo operator (Head clerk, Bankura (N) Dn.)', '27-10-2026 16:12:40'),
      mk('Hill', 'Darjeeling', [
        ['Pemba Sherpa', '09-05-1999', 'Graduate', ['Ghoom', 'Camp: Tonglu'], '', 'Forest Protection and Patrolling: anti-poaching camp'],
        ['Anita Rai', '30-01-2001', 'Higher Secondary (Class XII)', ['Ghoom', 'Beat: Ghoom'], '', 'Forest Protection and Patrolling: fire watch'],
      ], 'Demo operator (UDC, Darjeeling Dn.)', '28-10-2026 10:05:11'));
    const log = rows.map(r => ({ on: r.updOn, username: 'user', by: r.updBy.split(' (')[0], desig: (r.updBy.split(' (')[1] || '').replace(')', ''), mobile: '',
      circle: r.circle, division: r.division, vid: r.id, vname: r.name, action: 'Added', field: LABEL.name, old: '', value: r.name })).reverse();
    const ver = { 'Central|Bankura (N)': { n: 1, on: '27-10-2026 16:12:40', by: rows[0].updBy }, 'Hill|Darjeeling': { n: 1, on: '28-10-2026 10:05:11', by: rows[3].updBy } };
    return { rows, log, ver };
  }
  function db() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d) return d; } catch (e) {} const d = seed(); put(d); return d; }
  function put(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  const pub = r => FIELDS.reduce((o, k) => (o[k] = r[k] || '', o), { id: r.id });
  // same rule as complete_() in Code.gs
  const done = r => ['name', 'dob', 'qual', 'deptRef', 'dirRef', 'apptRef', 'doj', 'placeType', 'works'].every(k => String(r[k] || '').trim())
    && (r.placeType === 'Div HQ' || (r.placeType === 'Range' && String(r.placeName || '').trim() && /^(Range HQ|(Beat|Camp):\s*\S)/.test(r.placeSub || '')))
    && !/^Others(:\s*.{0,9})?$/.test(String(r.works).trim());
  const dateOk = s => !s || /^\d{2}-\d{2}-\d{4}$/.test(s);

  const H = {
    meta(b, user) {
      const d = db(), counts = {}, complete = {}, saved = {};
      d.rows.forEach(r => { const k = r.circle + '|' + r.division; counts[k] = (counts[k] || 0) + 1; if (done(r)) complete[k] = (complete[k] || 0) + 1; });
      Object.keys(d.ver).forEach(k => saved[k] = { on: d.ver[k].on, by: d.ver[k].by });
      return { circles: CIRCLES, counts, complete, saved, user: { name: user.name, isAdmin: true, username: 'demo' }, placeV: 2 };
    },
    load(b) {
      const d = db();
      return { rows: d.rows.filter(r => r.circle === b.circle && r.division === b.division).sort((a, c) => a.sl - c.sl).map(pub), ver: d.ver[b.circle + '|' + b.division] || { n: 0, on: '', by: '' } };
    },
    save(b, user) {
      const d = db(), k = b.circle + '|' + b.division, ver = d.ver[k] || { n: 0, on: '', by: '' };
      const op = b.operator || {}, who = (op.name || user.name) + (op.designation ? ' (' + op.designation + ')' : '');
      const sent = (b.rows || []).map(r => FIELDS.reduce((o, f) => (o[f] = String(r[f] || '').replace(/\s+/g, ' ').trim(), o), { id: r.id || '', key: r.key })).filter(o => FIELDS.some(f => o[f]));
      const bad = [];
      sent.forEach((o, i) => { if (!o.name) bad.push('Row ' + (i + 1) + ': name is missing'); ['dob', 'doj'].forEach(f => { if (!dateOk(o[f])) bad.push('Row ' + (i + 1) + ': ' + LABEL[f] + ' is not a date'); }); });
      if (bad.length) throw new Error(bad.join('; '));
      if (!b.force && Number(b.base || 0) !== ver.n) return { conflict: true, message: (ver.by || 'Someone') + ' saved this division at ' + ver.on + ', after you opened it.', ver };
      const mine = d.rows.filter(r => r.circle === b.circle && r.division === b.division), byId = {}; mine.forEach(r => byId[r.id] = r);
      const when = now(), log = [], ids = {};
      const L = (r, action, f, old, value) => log.push({ on: when, username: 'demo', by: op.name || user.name, desig: op.designation || '', mobile: op.mobile || '', circle: b.circle, division: b.division, vid: r.id, vname: r.name, action, field: f ? LABEL[f] : '', old: old || '', value: value || '' });
      const kept = sent.map((o, i) => {
        const prev = o.id && byId[o.id], r = prev ? Object.assign({}, prev) : { id: uid(), circle: b.circle, division: b.division };
        if (!prev) ids[o.key] = r.id;
        let ch = !prev;
        FIELDS.forEach(f => { const ov = prev ? prev[f] || '' : ''; if (ov !== o[f]) { ch = true; r[f] = o[f]; if (prev) L(r, 'Edited', f, ov, o[f]); } });
        if (!prev) FIELDS.forEach(f => { if (r[f]) L(r, 'Added', f, '', r[f]); });
        r.sl = i + 1; if (ch) { r.updOn = when; r.updBy = who; }
        return r;
      });
      const keep = {}; kept.forEach(r => keep[r.id] = 1);
      mine.forEach(r => { if (!keep[r.id]) L(r, 'Removed', '', r.name, ''); });
      if (!log.length) return { rows: kept.map(pub), ver, ids, changes: 0 };
      d.rows = d.rows.filter(r => !(r.circle === b.circle && r.division === b.division)).concat(kept);
      d.log = log.reverse().concat(d.log);
      d.ver[k] = { n: ver.n + 1, on: when, by: who };
      put(d);
      return { rows: kept.map(pub), ver: d.ver[k], ids, changes: log.length };
    },
    admin() { const d = db(); return { rows: d.rows, log: d.log, logTotal: d.log.length, sheetUrl: '', labels: LABEL }; },
  };

  window.FV_DEMO = {
    call(action, body, user) {
      const fn = H[action]; if (!fn) return Promise.reject(new Error('Unknown action: ' + action));
      return new Promise((ok, no) => setTimeout(() => { try { ok(JSON.parse(JSON.stringify(fn(body, user)))); } catch (e) { no(e); } }, 350));
    },
  };
})();
