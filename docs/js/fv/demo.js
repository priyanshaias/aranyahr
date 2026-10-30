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
  const KEY = 'fv_demo_db_v3';
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
    // more made-up volunteers across most divisions, so the dashboard has something to show
    let sd = 7; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
    const FIRST = ['Ratan', 'Sumana', 'Bapi', 'Pemba', 'Anita', 'Sanjay', 'Mithu', 'Rakesh', 'Puja', 'Tapas', 'Bishnu', 'Laxmi', 'Dipankar', 'Sonali', 'Amit', 'Rinku', 'Gopal',
      'Shibu', 'Sabita', 'Manoj', 'Karma', 'Dawa', 'Rupa', 'Biswajit', 'Chandan', 'Mousumi', 'Haru', 'Suraj', 'Phulmani', 'Jitu'];
    const LAST = ['Mandi', 'Kisku', 'Hansda', 'Murmu', 'Tudu', 'Soren', 'Mahato', 'Barman', 'Roy', 'Das', 'Mondal', 'Ghosh', 'Sherpa', 'Tamang', 'Rai', 'Oraon', 'Munda', 'Sarkar', 'Pradhan', 'Lepcha'];
    const QL = ['Class VIII', 'Madhyamik (Class X)', 'Madhyamik (Class X)', 'Higher Secondary (Class XII)', 'Higher Secondary (Class XII)', 'Graduate', 'Graduate', 'ITI / Diploma', 'Post Graduate', 'Below Class VIII'];
    const WK = ['Forest Protection and Patrolling', 'Forest Protection and Patrolling: night patrolling', 'Human-Animal Conflict Management', 'Human-Animal Conflict Management: elephant drive (hulla party)',
      'Nursery Operations', 'Nursery Operations: seedling raising', 'Timber Depot', 'Driver', 'Mali/Gardener', 'Night Guard/Security', 'Cleaning/Sweeping/Maintenance',
      'Others: Mahut of elephant Champa', 'Others: Data entry in range office', 'Others: Boatman for river patrolling'];
    const BEATS = ['Dhalpara', 'Mohanpur', 'Kalikapur', 'Bhalukjhora', 'Patharghata', 'Sitarampur', 'Chandipur', 'Nischintapur', 'Lataguri', 'Rampur'];
    const OPS = [['Subhas Pal', 'Head Clerk'], ['Nirmal Saha', 'UDC'], ['Tanmoy Dey', 'Range Officer'], ['Asit Bera', 'Head Clerk'], ['Kakali Sen', 'LDC']];
    const dt = (y0, y1) => `${pad(1 + Math.floor(rnd() * 28))}-${pad(1 + Math.floor(rnd() * 12))}-${y0 + Math.floor(rnd() * (y1 - y0 + 1))}`;
    const extra = {};
    CIRCLES.forEach(C => C.divisions.forEach(d => {
      if (d === 'Circle HQ' || rnd() < 0.28 || (C.circle === 'Central' && d === 'Bankura (N)') || (C.circle === 'Hill' && d === 'Darjeeling')) return;
      const ago = Math.floor(rnd() * rnd() * 26), t = new Date(Date.now() - ago * 864e5), [opn, opd] = pick(OPS);
      const on = `${pad(t.getDate())}-${pad(t.getMonth() + 1)}-${t.getFullYear()} ${pad(ago ? 10 + Math.floor(rnd() * 7) : Math.max(0, t.getHours() - 1))}:${pad(Math.floor(rnd() * 60))}:00`;
      const by = `${opn} (${opd}, ${d} Dn.)`, k = 2 + Math.floor(rnd() * 10), short = d.replace(/[^A-Za-z].*$/, '');
      for (let i = 0; i < k; i++) {
        const div = rnd() < 0.15, sub = rnd(), r = { id: uid(), circle: C.circle, division: d, sl: i + 1, name: pick(FIRST) + ' ' + pick(LAST), dob: dt(1972, 2003), qual: pick(QL),
          deptRef: 'No. ' + (900 + Math.floor(rnd() * 400)) + '/FD/2025', dirRef: 'No. ' + (300 + Math.floor(rnd() * 300)) + '/PCCF(HoFF)/2025', apptRef: 'DFO, ' + d + ' · Memo ' + (100 + i) + '/' + short.slice(0, 3).toUpperCase(),
          doj: rnd() < 0.5 ? dt(2025, 2025) : dt(2024, 2024).replace(/-\d{2}-/, '-' + pad(7 + Math.floor(rnd() * 6)) + '-'), placeType: div ? 'Div HQ' : 'Range',
          placeName: div ? '' : short + ' ' + pick(['North', 'South', 'East', 'West', 'Sadar']), placeSub: div ? '' : sub < 0.25 ? 'Range HQ' : sub < 0.75 ? 'Beat: ' + pick(BEATS) : 'Camp: ' + pick(BEATS) + ' camp',
          works: pick(WK), updOn: on, updBy: by };
        const gap = rnd();
        if (gap < 0.1) r.dirRef = ''; else if (gap < 0.17) r.apptRef = ''; else if (gap < 0.22) r.dob = ''; else if (gap < 0.26 && !div) r.placeSub = 'Beat'; else if (gap < 0.29) r.works = 'Others';
        rows.push(r); extra[r.id] = [opn, opd];
      }
    }));
    const log = rows.map(r => ({ on: r.updOn, username: 'user', by: r.updBy.split(' (')[0], desig: (r.updBy.split(' (')[1] || '').replace(/[,)].*$/, ''), mobile: '',
      circle: r.circle, division: r.division, vid: r.id, vname: r.name, action: 'Added', field: LABEL.name, old: '', value: r.name }));
    rows.filter((r, i) => i % 6 === 2).forEach(r => log.push({ on: r.updOn.replace(/:00$/, ':30'), username: 'user', by: r.updBy.split(' (')[0], desig: (r.updBy.split(' (')[1] || '').replace(/[,)].*$/, ''),
      mobile: '', circle: r.circle, division: r.division, vid: r.id, vname: r.name, action: 'Edited', field: LABEL.doj, old: '01-01-2025', value: r.doj }));
    const ts = s => s.replace(/^(\d{2})-(\d{2})-(\d{4})/, '$3$2$1');
    log.sort((a, b) => ts(b.on).localeCompare(ts(a.on)));
    const ver = {};
    rows.forEach(r => { const k = r.circle + '|' + r.division; if (!ver[k] || ts(r.updOn) > ts(ver[k].on)) ver[k] = { n: 1, on: r.updOn, by: r.updBy }; });
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
