// Forest Volunteers — screens: sign in, your details, circle, division, the volunteer sheet, and the admin dashboard.
(function () {
  const API = window.FV_API;
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = encodeURIComponent;
  const icon = {
    save: '<svg viewBox="0 0 24 24"><path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
    sheet: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
  };
  const HELP = { name: 'Sudipta Kundu', office: 'Aranya Bhawan', phone: '+91 70442 30806', tel: '+917044230806' };

  // the columns of the sheet, as in the "List of Volunteers" format sent to divisions
  const COLS = [
    { k: 'name', label: 'Name of Forest Volunteer Engaged', w: 280, req: true, cls: 'nm' },
    { k: 'dob', label: 'Date of Birth', w: 124, date: true },
    { k: 'qual', label: 'Educational Qualification', w: 190 },
    { k: 'deptRef', label: 'Forest Dept.’s approval ref', w: 200 },
    { k: 'dirRef', label: 'Forest Directorate’s Ref no sent to the Circle in Charge', w: 210 },
    { k: 'apptRef', label: 'Appointment Order issued by / reference', w: 210 },
    { k: 'doj', label: 'Date of Joining', w: 124, date: true },
    // present place of posting, in three columns (as in the sheet)
    { k: 'posted', label: 'Posted at (Div HQ / Range)', w: 130, place: 'posted' },
    { k: 'range', label: 'Range name', w: 210, place: 'range' },
    { k: 'within', label: 'Within the range (Range HQ / Beat / Camp)', w: 220, place: 'within' },
    { k: 'works', label: 'Nature of Works assigned', w: 430, duty: true },
  ];
  // what is edited on screen; the sheet keeps duty and details together in one column ("Others: Mahut of elephant Champa")
  // what is edited on screen; the sheet keeps "Within the range" in one column ("Beat: Duttar") and duty with its details in another
  const FIELDS = ['name', 'dob', 'qual', 'deptRef', 'dirRef', 'apptRef', 'doj', 'placeType', 'placeName', 'subType', 'subName', 'duty', 'wdet'];
  const SENT = ['name', 'dob', 'qual', 'deptRef', 'dirRef', 'apptRef', 'doj', 'placeType', 'placeName', 'placeSub', 'works'];
  // place of posting: Div HQ, or a Range and, inside it, the Range HQ, a Beat or a Camp
  const PLACES = ['Div HQ', 'Range'];
  const SUBS = ['Range HQ', 'Beat', 'Camp'];
  const QUALS = ['Below Class VIII', 'Class VIII', 'Madhyamik (Class X)', 'Higher Secondary (Class XII)', 'ITI / Diploma', 'Graduate', 'Post Graduate'];
  // the main duties used for DLs / CDLs; anything else is "Others" with the work written out
  const DUTIES = ['Cleaning/Sweeping/Maintenance', 'Nursery Operations', 'Timber Depot', 'Driver', 'Mali/Gardener',
    'Forest Protection and Patrolling', 'Human-Animal Conflict Management', 'Night Guard/Security', 'Others'];
  const VAGUE = /^\s*(do|d\.o\.?|various|misc\.?|miscellaneous|other|others|field work|field duty|forestry work|general|all work|-)?\s*$/i;
  // free text pasted from Excel → the closest duty (else Others, keeping the text)
  const GUESS = [[/elephant|hulla|conflict|depredation|wild ?animal|rescue/i, 'Human-Animal Conflict Management'], [/patrol|protect|anti.?poach|check ?post|fire|watch ?tower|beat duty/i, 'Forest Protection and Patrolling'],
    [/nurs[ae]ry|seedling|plantation|pltn/i, 'Nursery Operations'], [/garden|\bmali\b|\bpark\b|lawn/i, 'Mali/Gardener'], [/driv/i, 'Driver'],
    [/night|security|chowkidar|darwan|guard/i, 'Night Guard/Security'], [/depot|timber/i, 'Timber Depot'], [/clean|sweep|maintenance|safai/i, 'Cleaning/Sweeping/Maintenance']];
  function splitWorks(r) {
    const w = String(r.works == null ? '' : r.works).trim(), m = /^([^:]+):\s*(.*)$/.exec(w);
    delete r.works;
    if (r.duty !== undefined && !w) return r;                           // already split (a draft)
    if (DUTIES.includes(w)) { r.duty = w; r.wdet = ''; }
    else if (m && DUTIES.includes(m[1].trim())) { r.duty = m[1].trim(); r.wdet = m[2]; }
    else if (w) { const g = GUESS.find(x => x[0].test(w)); r.duty = g ? g[1] : 'Others'; r.wdet = w; }
    else { r.duty = ''; r.wdet = ''; }
    return r;
  }
  /** A volunteer counts as "added" only when every detail is filled. Returns the labels of what is still missing. */
  function missingOf(r) {
    const m = [], has = k => String(r[k] || '').trim();
    [['name', 'Name'], ['dob', 'Date of birth'], ['qual', 'Qualification'], ['deptRef', 'Dept. approval ref'], ['dirRef', 'Directorate ref'],
      ['apptRef', 'Appointment order'], ['doj', 'Date of joining'], ['placeType', 'Place of posting']].forEach(([k, l]) => { if (!has(k)) m.push(l); });
    if (r.placeType === 'Range') {
      if (!has('placeName')) m.push('Range name');
      if (!has('subType')) m.push('Range HQ / Beat / Camp');
      else if (r.subType !== 'Range HQ' && !has('subName')) m.push('Name of the ' + r.subType.toLowerCase());
    }
    if (!has('duty')) m.push('Nature of works');
    else if (r.duty === 'Others' && (VAGUE.test(r.wdet || '') || has('wdet').length < 10)) m.push('Work details');
    return m;
  }
  /** Same rule for a row as the server stores it (duty and details in one "works" value). */
  const missingOfSaved = r => missingOf(fromServer(Object.assign({}, r)));
  /** Places saved in the earlier format (Beat / Camp / Range + "X under Y Range") become Range + Range HQ / Beat / Camp. Same rule as newPlace_() in Code.gs. */
  function newPlace(o) {
    const t = o.placeType;
    if (t === 'Div HQ' || (t === 'Range' && o.placeSub) || ['Range', 'Beat', 'Camp', 'Other'].indexOf(t) < 0) return o;
    const name = String(o.placeName || '').replace(/\s+/g, ' ').trim(), m = /^(.*?)\s+under\s+(?:the\s+)?(.+?)\s*(?:range)?\s*$/i.exec(name);
    const tc = s => s.toLowerCase().replace(/(^|[\s(\-\/])([a-z])/g, (a, b, c) => b + c.toUpperCase()).replace(/\bHq\b/g, 'HQ').replace(/\bWls\b/g, 'WLS');
    o.placeType = 'Range';
    if (m) { const what = tc(m[1]).replace(/\s+Beat$/i, ''); o.placeName = tc(m[2]); o.placeSub = t === 'Camp' ? 'Camp: ' + what : t === 'Other' ? '' : 'Beat: ' + what; }
    else if (t === 'Range') { o.placeName = name; o.placeSub = ''; }
    else if (t === 'Beat' || t === 'Camp') { o.placeName = ''; o.placeSub = name ? t + ': ' + name : ''; }
    else { o.placeName = ''; o.placeSub = name; }
    return o;
  }
  function splitPlace(r) {
    if (r.placeSub === undefined && r.subType !== undefined) return r;   // already split (a draft)
    newPlace(r);
    const sub = String(r.placeSub || '').trim(), m = /^(Beat|Camp)(?::\s*(.*))?$/.exec(sub);
    delete r.placeSub;
    if (sub === 'Range HQ') { r.subType = 'Range HQ'; r.subName = ''; }
    else if (m) { r.subType = m[1]; r.subName = (m[2] || '').trim(); }
    else { r.subType = ''; r.subName = sub; }
    return r;
  }
  const joinSub = r => r.placeType !== 'Range' ? '' : r.subType === 'Range HQ' ? 'Range HQ' : r.subType ? (String(r.subName || '').trim() ? r.subType + ': ' + String(r.subName).trim() : r.subType) : String(r.subName || '').trim();
  /** A row as the server sends it → the fields edited on screen. */
  const fromServer = r => splitPlace(splitWorks(r));
  const joinWorks = r => { const d = String(r.duty || '').trim(), t = String(r.wdet || '').trim(); return d && t ? d + ': ' + t : d || t; };

  /* ---------------- small helpers ---------------- */
  function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.className = 'toast', 4200); }
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  // there is one admin (GS): admins are never asked for their details, and their saves are recorded as GS
  const ADMIN_OP = { name: 'GS', designation: 'Administrator', mobile: '' };
  const op = () => API.user && API.user.isAdmin && !API.DEMO ? ADMIN_OP : store.get('fv_operator');
  const go = h => { location.hash = h; };
  const initials = s => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  async function guard(fn) {
    try { return await fn(); }
    catch (e) { toast(e.message || 'Something went wrong.', true); if (e.auth) { go('#/'); route(); } throw e; }
  }
  const loading = text => `<div class="loader"><b class="ld-title">${esc(text)}</b><div class="ibar"><i></i></div>
    <p class="ld-step faint">The first load of the day can take up to 20 seconds.</p></div>`;
  const helpStrip = () => `<div class="help-strip"><span class="hq" aria-hidden="true">?</span>
    <span>Need help? Contact <b>${HELP.name}</b>, ${HELP.office} · <a href="tel:${HELP.tel}">${HELP.phone}</a></span>
    <button class="btn sm ghost" data-help>How to use</button></div>`;
  const shortWhen = s => { const m = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}:\d{2})/.exec(s || ''); return m ? `${m[1]}-${m[2]}-${m[3]}, ${m[4]}` : (s || ''); };

  /** "1/7/25", "01.07.2025", "2025-07-01" → "01-07-2025". Returns null when it cannot be read as a real date. */
  function normDate(s) {
    s = String(s || '').trim(); if (!s) return '';
    let d, m, y, x;
    if ((x = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s))) { y = +x[1]; m = +x[2]; d = +x[3]; }
    else if ((x = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})$/.exec(s))) { d = +x[1]; m = +x[2]; y = +x[3]; if (y < 100) y += y > 40 ? 1900 : 2000; }
    else return null;
    const t = new Date(y, m - 1, d);
    if (t.getFullYear() !== y || t.getMonth() !== m - 1 || t.getDate() !== d || y < 1940 || y > 2075) return null;
    return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
  }
  function download(name, rows) {
    const csv = '﻿' + rows.map(r => r.map(v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function dialog(title, sub, bodyHtml, buttons) {
    const el = document.createElement('div'); el.className = 'scrim';
    el.innerHTML = `<div class="dialog small-dlg" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="dhead"><div><h2>${esc(title)}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="x" aria-label="Close">×</button></div>
      <div class="dbody">${bodyHtml}</div>
      ${buttons ? `<div class="dfoot"><span class="sp"></span>${buttons}</div>` : ''}</div>`;
    document.body.appendChild(el);
    const close = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 250); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('.x')) close(); });
    requestAnimationFrame(() => el.classList.add('on'));
    return { el, close };
  }

  /* ---------------- help ---------------- */
  function openHelp() {
    dialog('How to use', 'Forest Volunteers · whom to call for help', `
      <div class="help-contact"><div><span class="faint">For any help, please contact</span><b>${HELP.name}</b><span>${HELP.office}</span></div>
        <a class="btn primary" href="tel:${HELP.tel}">Call ${HELP.phone}</a></div>
      <ol class="help-steps">
        <li><b>Choose your circle, then your division.</b></li>
        <li><b>Click any row</b> (or <b>Add volunteer</b>). A panel opens with a calendar for dates and buttons for qualification, place and duty. Use <b>Next ›</b> to go to the next volunteer.</li>
        <li><b>Save often</b> with the ${icon.save.replace('<svg', '<svg style="width:15px;height:15px;vertical-align:-2px;stroke:currentColor;fill:none;stroke-width:2"')} <b>Save</b> button or <span class="kbd">Ctrl</span> + <span class="kbd">S</span>. You can come back any time and continue.</li>
        <li><b>A volunteer is counted as added only when every detail is filled.</b> You can save part-filled entries; cells marked <b>missing</b> show what is left. Press <b>Details missing</b> at the top to go to the next one.</li>
        <li><b>Yellow cells</b> are changed but not saved yet. <b>Red cells</b> need fixing (a missing name or a wrong date).</li>
        <li><b>Dates</b> are typed as DD-MM-YYYY, for example 01-07-2025.</li>
        <li><b>Nature of works:</b> choose the main duty from the list. If none fits, choose <b>Others</b> and write the actual work, for example “Mahut of elephant Champa”.</li>
        <li>To remove a volunteer, open it and press <b>Remove this volunteer</b>, then Save.</li>
      </ol>
      <p class="faint">Every save is recorded with your name and designation. Your sign-in lasts 6 hours.</p>`);
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-help]')) { e.preventDefault(); openHelp(); } });

  /* ---------------- header ---------------- */
  function renderWho() {
    const u = API.user, o = op();
    $('#demoFlag').classList.toggle('hidden', !API.DEMO);
    if (!u) { $('#who').innerHTML = ''; return; }
    const nm = (o && o.name) || u.name;
    $('#who').innerHTML = `${u.isAdmin ? '<a class="btn sm ghost hide-sm" href="#/admin">Dashboard</a>' : ''}
      <button class="menu-btn" id="menuBtn" aria-haspopup="true" aria-expanded="false">
        <span class="av">${esc(initials(nm))}</span><span class="hide-sm">${esc(nm)}</span><span aria-hidden="true">▾</span></button>
      <div class="menu hidden" id="menu" role="menu">
        <div class="menu-who"><b>${esc(nm)}</b><span>${esc(o && o.designation || '')}${u.username ? ' · signed in as ' + esc(u.username) : ''}</span></div>
        ${u.isAdmin ? '<a role="menuitem" href="#/admin">Dashboard</a><a role="menuitem" href="#/admin/reports">Reports</a>' : ''}
        <a role="menuitem" href="#/circles">All circles</a>
        ${u.isAdmin && !API.DEMO ? '' : '<button role="menuitem" id="meBtn">My details</button>'}
        <button role="menuitem" id="outBtn">Sign out</button>
      </div>`;
    const menu = $('#menu'), mb = $('#menuBtn');
    mb.onclick = e => { e.stopPropagation(); mb.setAttribute('aria-expanded', menu.classList.toggle('hidden') === false); };
    menu.querySelectorAll('a').forEach(a => a.onclick = () => menu.classList.add('hidden'));
    $('#outBtn').onclick = () => { if (G && dirty()) { toast('Save your changes before signing out.', true); return; } API.signOut(); META = null; go('#/'); route(); };
    const me = $('#meBtn'); if (me) me.onclick = () => { menu.classList.add('hidden'); renderOperator(true); };
  }
  document.addEventListener('click', e => { const m = $('#menu'); if (m && !e.target.closest('#menu')) m.classList.add('hidden'); });

  /* ---------------- sign in & your details ---------------- */
  function renderSignin() {
    app.innerHTML = `<section class="signin"><div class="card">
      <img class="emb" src="assets/emblem.svg" alt="National Emblem of India">
      <h1>Forest Volunteers</h1>
      <p class="muted">Directorate of Forests, West Bengal. Sign in to enter the Forest Volunteers engaged in your division.</p>
      ${API.DEMO ? `<button class="btn primary" id="demoBtn" style="width:100%">Try with demo data</button>
        <p class="faint" style="margin:12px 0 0">This copy is not connected to the live sheet. All names are made up and stay in this browser.</p>`
        : `<form class="form" id="pwForm" autocomplete="on">
            <label>Username<input name="username" id="username" autocomplete="username" autocapitalize="none" required></label>
            <label>Password<span class="pw"><input name="password" id="password" type="password" autocomplete="current-password" required>
              <button type="button" class="btn sm ghost" id="showPw" aria-label="Show password">Show</button></span></label>
            <button class="btn primary" type="submit" id="pwBtn">Sign in</button>
            <div id="pwMsg" class="faint" role="alert"></div>
            <p class="faint" style="margin:0">Use the same username and password as UPMC2.</p>
          </form>`}
      ${helpStrip()}
    </div></section>`;
    if (API.DEMO) { $('#demoBtn').onclick = () => { API.demoSignIn(); start(); }; return; }
    $('#showPw').onclick = () => { const i = $('#password'); i.type = i.type === 'password' ? 'text' : 'password'; $('#showPw').textContent = i.type === 'password' ? 'Show' : 'Hide'; };
    $('#pwForm').onsubmit = async e => {
      e.preventDefault();
      const btn = $('#pwBtn'); btn.disabled = true; btn.textContent = 'Signing in…'; $('#pwMsg').textContent = '';
      try { await API.signIn($('#username').value.trim(), $('#password').value); start(); }
      catch (err) { $('#pwMsg').textContent = err.message; $('#pwMsg').style.color = 'var(--danger-ink)'; btn.disabled = false; btn.textContent = 'Sign in'; }
    };
  }
  function renderOperator(editing) {
    const o = op() || {};
    app.innerHTML = `<section class="signin"><div class="card" style="text-align:left">
      <h1 style="font-size:26px">${editing ? 'Your details' : 'One more step'}</h1>
      <p class="muted" style="margin-bottom:0">Every change you save is recorded with these details.</p>
      <form class="form" id="opForm">
        <label>Your name<input name="name" id="opName" required value="${esc(o.name || '')}"></label>
        <label>Designation and office<input name="designation" id="opDesig" required placeholder="e.g. Head Clerk, Bankura (N) Division" value="${esc(o.designation || '')}"></label>
        <label>Mobile number (optional)<input name="mobile" id="opMobile" inputmode="numeric" maxlength="10" value="${esc(o.mobile || '')}"></label>
        <button class="btn primary" type="submit">Save and continue</button>
      </form></div></section>`;
    $('#opForm').onsubmit = e => {
      e.preventDefault();
      const d = { name: $('#opName').value.trim(), designation: $('#opDesig').value.trim(), mobile: $('#opMobile').value.trim() };
      if (d.mobile && !/^\d{10}$/.test(d.mobile)) { toast('Mobile number should have 10 digits.', true); return; }
      store.set('fv_operator', d); renderWho(); route();
    };
  }
  function start() { if (!op()) { renderWho(); renderOperator(false); return; } if (!location.hash || location.hash === '#/') go('#/circles'); else route(); }

  /* ---------------- circles & divisions ---------------- */
  let META = null;
  async function meta(force) {
    if (META && !force) return META;
    META = await guard(() => API.call('meta'));
    renderWho(); return META;
  }
  const divCount = (c, d) => (META.counts || {})[c + '|' + d] || 0;
  const divDone = (c, d) => META.complete ? (META.complete[c + '|' + d] || 0) : null;
  const doneLine = (n, done) => done == null ? `${n} entered` : `<b class="ok-n">${done} added</b>${n - done ? ` · <span class="miss-n">${n - done} details missing</span>` : ''}`;
  const divSaved = (c, d) => (META.saved || {})[c + '|' + d];
  function tile(title, sub, n, extra, href, i) {
    return `<a class="tile" href="${href}" style="animation-delay:${Math.min(i, 20) * 30}ms;text-decoration:none">
      <div class="cnt${n ? ' has' : ''}">${n}</div>
      <div class="t"><b>${esc(title)}</b><span>${esc(sub)}</span>${extra ? `<span class="when">${extra}</span>` : ''}</div></a>`;
  }
  async function renderCircles() {
    app.innerHTML = `<div class="head"><div><h1 class="page-title">Choose your circle.</h1><p class="page-sub">Then pick your division and fill the list of Forest Volunteers.</p></div></div>
      ${helpStrip()}${META ? '' : loading('Opening the volunteer register…')}<div class="tiles">${'<div class="skeleton"></div>'.repeat(8)}</div>`;
    const m = await meta();
    const ld = app.querySelector('.loader'); if (ld) ld.remove();
    app.querySelector('.tiles').innerHTML = m.circles.map((c, i) => {
      const n = c.divisions.reduce((a, d) => a + divCount(c.circle, d), 0), started = c.divisions.filter(d => divCount(c.circle, d)).length;
      const done = META.complete ? c.divisions.reduce((a, d) => a + divDone(c.circle, d), 0) : null;
      return tile(c.circle, c.office, done == null ? n : done, `${n ? doneLine(n, done) + ' · ' : ''}${started} of ${c.divisions.length} divisions started`, `#/c/${enc(c.circle)}`, i);
    }).join('');
  }
  async function renderDivisions(circle) {
    if (!META) app.innerHTML = loading('Opening the volunteer register…');
    const m = await meta(), c = m.circles.find(x => x.circle === circle);
    if (!c) { go('#/circles'); return; }
    app.innerHTML = `<div class="crumbs"><a href="#/circles">All circles</a><span class="sep">/</span><span>${esc(circle)}</span></div>
      <div class="head"><div><h1 class="page-title">${esc(circle)} circle.</h1><p class="page-sub">Choose your division.</p></div></div>
      <div class="tiles">${c.divisions.map((d, i) => {
        const s = divSaved(circle, d), n = divCount(circle, d), done = divDone(circle, d);
        return tile(d, 'Division', done == null ? n : done, n ? doneLine(n, done) + (s ? ' · saved ' + esc(shortWhen(s.on)) : '') : '<span class="not-started">Not started</span>', `#/d/${enc(circle)}/${enc(d)}`, i);
      }).join('')}</div>`;
  }

  /* ---------------- the volunteer sheet ---------------- */
  // G: the division open on screen. rows: what is on screen; saved: what the server has, by id; base: version it was loaded at
  let G = null, keySeq = 0;
  const newKey = () => 'k' + Date.now().toString(36) + (keySeq++);
  const blankRow = () => FIELDS.reduce((o, k) => (o[k] = '', o), { key: newKey(), id: '' });
  const isBlank = r => FIELDS.every(k => !String(r[k] || '').trim());
  const draftKey = () => 'fv_draft|' + G.circle + '|' + G.division;

  function cellChanged(r, k) {
    const s = r.id && G.saved[r.id];
    return s ? String(s[k] || '') !== String(r[k] || '').trim() : !!String(r[k] || '').trim();
  }
  function rowChanged(r) { return r.del ? !!r.id : (r.id ? FIELDS.some(k => cellChanged(r, k)) : !isBlank(r)); }
  function dirty() { return !!G && (G.rows.some(rowChanged) || G.orderChanged); }
  function changedCount() { return G.rows.filter(rowChanged).length; }
  function rowProblems(r) {
    if (r.del || isBlank(r)) return {};
    const p = {};
    if (!String(r.name || '').trim()) p.name = 'Name is needed';
    const det = String(r.wdet || '').trim();
    if (!r.duty && det) p.duty = 'Choose the nature of work';
    if (r.duty === 'Others' && (VAGUE.test(det) || det.length < 10)) p.wdet = 'For “Others”, write the actual work, e.g. Mahut of elephant Champa (not “various” or “misc”)';
    ['dob', 'doj'].forEach(k => { if (r[k] && normDate(r[k]) === null) p[k] = 'Not a date. Type DD-MM-YYYY'; });
    return p;
  }

  async function renderDivision(circle, division) {
    app.innerHTML = `<div class="crumbs"><a href="#/circles">All circles</a><span class="sep">/</span><a href="#/c/${enc(circle)}">${esc(circle)}</a><span class="sep">/</span><span>${esc(division)}</span></div>
      <div class="head"><div><h1 class="page-title">${esc(division)}</h1><p class="page-sub">${esc(circle)} circle · List of Forest Volunteers</p></div></div>
      ${loading('Fetching the volunteers of ' + division + '…')}`;
    await meta();
    const d = await guard(() => API.call('load', { circle, division }));
    if (location.hash !== `#/d/${enc(circle)}/${enc(division)}`) return;
    G = { circle, division, base: d.ver.n, ver: d.ver, saved: {}, rows: [], orderChanged: false, saving: false };
    d.rows.forEach(r => G.saved[r.id] = fromServer(r));
    G.rows = d.rows.map(r => Object.assign({ key: newKey() }, r));
    // unsaved work from an earlier visit on this device
    const dr = store.get(draftKey());
    let restored = null;
    if (dr && dr.rows && dr.rows.some(r => !isBlank(r) || r.del)) {
      if (dr.base === G.base) { G.rows = dr.rows.map(r => fromServer(Object.assign({}, r, { key: r.key || newKey() }))); restored = 'same'; }
      else restored = 'stale';
    }
    padRows();
    drawSheet();
    if (restored === 'same' && dirty()) note(`Your unsaved changes from ${esc(dr.at)} on this device are back. Press <b>Save</b> to keep them, or <button class="btn sm ghost" id="discardDraft">${icon.undo} Discard them</button>`, 'attn');
    if (restored === 'stale') note(`You had unsaved changes from ${esc(dr.at)} on this device, but ${esc(G.ver.by || 'someone')} has saved this division since then, so the saved list is shown. <button class="btn sm ghost" id="dlDraft">${icon.down} Download my old changes</button> <button class="btn sm ghost" id="discardDraft">Forget them</button>`, 'attn');
    const dd = $('#discardDraft'); if (dd) dd.onclick = () => { store.del(draftKey()); renderDivision(circle, division); };
    const dl = $('#dlDraft'); if (dl) dl.onclick = () => download(`${division} - unsaved volunteers.csv`, csvRows(dr.rows.filter(r => !r.del && !isBlank(r))));
  }
  function note(html, kind) { const n = $('#sheetNote'); if (n) { n.innerHTML = html; n.className = 'notice ' + (kind || 'info'); n.classList.remove('hidden'); } }
  /** Keeps exactly one empty row at the end of the list: the "Add a volunteer" row. */
  function padRows() {
    const spare = r => r && isBlank(r) && !r.del && !r.id;
    while (G.rows.length > 1 && spare(G.rows[G.rows.length - 1]) && spare(G.rows[G.rows.length - 2]) && P.i !== G.rows.length - 1) G.rows.pop();
    if (!spare(G.rows[G.rows.length - 1])) G.rows.push(blankRow());
  }

  // The sheet only shows the list. Every change is made in the edit panel, which opens on a click anywhere in a row.
  function cellText(r, c) {
    if (c.place === 'posted') return r.placeType || '';
    if (c.place === 'range') return r.placeType === 'Range' ? r.placeName || '' : '';
    if (c.place === 'within') return joinSub(r);
    if (c.duty) return joinWorks(r);
    return r[c.k] || '';
  }
  const PLACE_KEYS = { posted: ['placeType'], range: ['placeName'], within: ['subType', 'subName'] };
  const PLACE_GAP = { posted: /^Place of posting$/, range: /^Range name$/, within: /^Range HQ \/ Beat \/ Camp$|^Name of the (beat|camp)$/ };
  const fieldOf = c => c.place ? { posted: 'placeType', range: 'placeName', within: 'subType' }[c.place] : c.duty ? 'duty' : c.k;
  function rowHtml(r, i, sl) {
    if (isBlank(r) && !r.id && !r.del) {
      return `<tr data-r="${i}" class="addrow" tabindex="0" aria-label="Add a volunteer"><td class="sl">${icon.plus}</td>
        <td colspan="${COLS.length}"><span class="addtxt">Add a volunteer</span> <span class="faint">Click here to fill the next one</span></td></tr>`;
    }
    const p = rowProblems(r), incomplete = !r.del && missingOf(r).length, tdc = c => {
      const ks = c.place ? PLACE_KEYS[c.place] : c.duty ? ['duty', 'wdet'] : [c.k];
      const gap = incomplete && (c.place ? missingOf(r).some(x => PLACE_GAP[c.place].test(x)) : c.duty ? !r.duty || (r.duty === 'Others' && missingOf(r).includes('Work details')) : !String(r[c.k] || '').trim());
      const cl = [c.cls || '', ks.some(k => p[k]) ? 'bad' : '', ks.some(k => cellChanged(r, k)) && !r.del ? 'chg' : '', gap ? 'gap' : ''].join(' ').trim();
      const tip = ks.map(k => p[k]).filter(Boolean)[0], t = cellText(r, c);
      const txt = t ? esc(t) : gap ? '<span class="empty miss">missing</span>' : '<span class="empty">—</span>';
      if (c.k === 'name') {   // the Edit button sits right after the name, so it stays in view when the sheet scrolls sideways
        return `<td class="${cl}" data-f="name"${tip ? ` title="${esc(tip)}"` : ''}><div class="cv nmv"><span class="nmt">${txt}</span>
          <button type="button" class="ebtn" data-e="${i}" aria-label="Edit ${esc(r.name || 'this volunteer')}">${r.del ? icon.undo + '<span>Removed</span>' : icon.edit + '<span>Edit</span>'}</button></div></td>`;
      }
      return `<td class="${cl}" data-f="${fieldOf(c)}"${tip ? ` title="${esc(tip)}"` : t ? ` title="${esc(t)}"` : gap ? ' title="Missing: click to fill"' : ''}><div class="cv">${txt}</div></td>`;
    };
    return `<tr data-r="${i}" tabindex="0" class="${r.del ? 'del' : ''}${!r.id ? ' new' : ''}" aria-label="${esc(r.name || 'Volunteer')}: open to edit"><td class="sl${incomplete ? ' inc' : ''}"${incomplete ? ' title="Details missing"' : ''}>${sl}</td>${COLS.map(tdc).join('')}</tr>`;
  }
  function drawSheet(focusId) {
    const filled = G.rows.filter(r => !r.del && !isBlank(r)).length;
    let sl = 0;
    app.innerHTML = `<div class="crumbs"><a href="#/circles">All circles</a><span class="sep">/</span><a href="#/c/${enc(G.circle)}">${esc(G.circle)}</a><span class="sep">/</span><span>${esc(G.division)}</span></div>
      <div class="head"><div><h1 class="page-title">${esc(G.division)}</h1><p class="page-sub">${esc(G.circle)} circle · ${filled} volunteer${filled === 1 ? '' : 's'}${G.ver.on ? ` · last saved ${esc(shortWhen(G.ver.on))} by ${esc(G.ver.by)}` : ' · not saved yet'}</p></div></div>
      ${(() => {
        const list = G.rows.filter(r => !r.del && !isBlank(r)), done = list.filter(r => !missingOf(r).length).length, miss = list.length - done;
        return `<div class="tally">
          <div class="tl ok"><span>Total volunteers added</span><b>${done}</b><small>all details complete</small></div>
          <button type="button" class="tl miss${miss ? '' : ' none'}" id="tallyMiss" ${miss ? '' : 'disabled'}><span>Details missing</span><b>${miss}</b><small>${miss ? 'press to fill the next one ›' : 'nothing missing'}</small></button>
          <p class="tl-note">A volunteer is counted as <b>added</b> only when every detail is filled. You can save a part-filled entry and complete it later.</p></div>`;
      })()}
      <div id="sheetNote" class="notice hidden" style="margin:0 0 14px"></div>
      <div class="sheetbar">
        <button class="btn primary save" id="saveBtn" title="Save (Ctrl + S)">${icon.save} Save</button>
        <span class="state" id="state"></span>
        <span class="sp"></span>
        <button class="btn sm soft" id="addOne">${icon.plus} Add volunteer</button>
        <button class="btn sm ghost" id="dlBtn" title="Download this list as an Excel (CSV) file">${icon.down}<span class="hide-sm">Download</span></button>
        <button class="btn sm ghost" data-help>? <span class="hide-sm">How to fill</span></button>
      </div>
      <div class="grid-wrap" id="gridWrap"><div class="grid-title">List of Volunteers · ${esc(G.division)}</div>
        <table class="grid" id="grid" style="width:${54 + COLS.reduce((a, c) => a + c.w, 0)}px"><colgroup><col style="width:54px">${COLS.map(c => `<col style="width:${c.w}px">`).join('')}</colgroup>
          <thead><tr><th class="sl">Sl No</th>${COLS.map(c => `<th class="${c.cls || ''}">${esc(c.label)}${c.req ? ' <span class="req">*</span>' : ''}</th>`).join('')}</tr></thead>
          <tbody>${G.rows.map((r, i) => rowHtml(r, i, r.del || isBlank(r) ? (r.del ? '—' : '') : ++sl)).join('')}</tbody></table></div>
      <div class="gridfoot"><span><i class="legend-sq" style="background:var(--chg)"></i>changed, not saved</span><span><i class="legend-sq" style="background:var(--bad);border-color:var(--danger)"></i>needs fixing</span>
        <span>· Click any row to open it and make changes.</span></div>`;
    const grid = $('#grid');
    const rowOf = e => e.target.closest('tbody tr[data-r]');
    grid.addEventListener('click', e => {
      const tr = rowOf(e); if (!tr) return;
      if (e.target.closest('[data-e]')) { openPanel(+tr.dataset.r); return; }   // the Edit button: open at the top
      const td = e.target.closest('td[data-f]');
      openPanel(+tr.dataset.r, td ? td.dataset.f : null);
    });
    grid.addEventListener('keydown', e => {
      const tr = rowOf(e); if (!tr || e.target !== tr) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(+tr.dataset.r); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling; if (n) n.focus(); }
    });
    $('#addOne').onclick = () => { padRows(); openPanel(G.rows.findIndex(r => isBlank(r) && !r.del && !r.id)); };
    const tm = $('#tallyMiss'); if (tm) tm.onclick = () => { const after = G.rows.findIndex((r, i) => i > P.i && !r.del && !isBlank(r) && missingOf(r).length); openNextMissing(after); };
    $('#saveBtn').onclick = save;
    $('#dlBtn').onclick = () => download(`${G.division} - Forest Volunteers.csv`, csvRows(G.rows.filter(r => !r.del && !isBlank(r))));
    setState();
    if (focusId) { const f = document.getElementById(focusId); if (f) f.focus(); }
  }
  /** Re-draws the sheet, keeping the scroll position of the grid and the page. */
  function redraw(focusId) {
    const w = $('#gridWrap'), st = w ? w.scrollTop : 0, sl = w ? w.scrollLeft : 0, y = window.scrollY, nt = $('#sheetNote');
    const noteHtml = nt && !nt.classList.contains('hidden') ? [nt.innerHTML, nt.className] : null;
    drawSheet();
    const w2 = $('#gridWrap'); w2.scrollTop = st; w2.scrollLeft = sl; window.scrollTo(0, y);
    if (noteHtml) { const n = $('#sheetNote'); n.innerHTML = noteHtml[0]; n.className = noteHtml[1]; const dd = $('#discardDraft'); if (dd) dd.onclick = () => { store.del(draftKey()); renderDivision(G.circle, G.division); }; }
    if (focusId) { const f = document.getElementById(focusId); if (f) f.focus({ preventScroll: false }); }
  }
  function csvRows(rows) {
    return [['Sl No', 'Name of Forest Volunteer Engaged', 'Date of Birth', 'Educational Qualification', 'Circle', 'Division', 'Forest Dept.\'s approval ref',
      'Forest Directorate\'s Ref no sent to the Circle in Charge', 'Appointment Order issued by/ reference', 'Date of Joining',
      'Posted at (Div HQ / Range)', 'Range name', 'Within the range (Range HQ / Beat / Camp)', 'Nature of Works assigned']]
      .concat(rows.map((r, i) => [i + 1, r.name, r.dob, r.qual, G.circle, G.division, r.deptRef, r.dirRef, r.apptRef, r.doj,
        r.placeType, r.placeType === 'Range' ? r.placeName : '', joinSub(r), joinWorks(r)]));
  }

  /* -- editing -- */
  let draftT = null;
  function saveDraft() {
    clearTimeout(draftT);
    draftT = setTimeout(() => {
      if (!G) return;
      if (dirty()) store.set(draftKey(), { base: G.base, at: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), rows: G.rows.filter(r => !isBlank(r) || r.del) });
      else store.del(draftKey());
    }, 300);
  }
  function setState(kind, text) {
    const s = $('#state'), b = $('#saveBtn'); if (!s) return;
    const n = changedCount();
    if (!kind) kind = G.saving ? 'saving' : dirty() ? 'dirty' : 'clean';
    s.className = 'state ' + kind;
    s.textContent = text || (kind === 'saving' ? 'Saving…' : kind === 'dirty' ? `Unsaved changes in ${n || 'the'} row${n === 1 ? '' : 's'}` : G.ver.on ? 'All changes saved' : 'Nothing entered yet');
    b.classList.toggle('dirty', kind === 'dirty');
    b.disabled = G.saving;
    const ps = $('#pnSave'); if (ps) { ps.disabled = G.saving; ps.classList.toggle('dirty', kind === 'dirty'); }
    pnState();
  }
  function toggleDel(i) {
    const r = G.rows[i]; if (!r) return;
    if (!r.id && !r.del) { G.rows.splice(i, 1); padRows(); }       // a row never saved just goes
    else r.del = !r.del;
    redraw(); setState(); saveDraft();
    if (r.del) toast(`${r.name || 'This volunteer'} will be removed when you press Save.`);
  }
  /* -- the edit panel: one volunteer at a time, big fields, a calendar for dates, tap-to-choose options -- */
  const P = { i: -1, cal: null };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const THIS_YEAR = new Date().getFullYear();
  const DATE_OPTS = { dob: { from: 1950, to: THIS_YEAR - 14, start: 2000 }, doj: { from: 2000, to: THIS_YEAR + 1, start: THIS_YEAR } };
  /** Values already used for a field in this division (most used first), so a reference typed once is one tap away for the next volunteer. */
  function used(k, cur, n, only) {
    const c = {};
    G.rows.forEach(r => { const v = String(r[k] || '').trim(); if (v && !r.del && v !== String(cur || '').trim() && (!only || only(r))) c[v] = (c[v] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, n || 3);
  }
  const chips = (k, vals, label) => vals.length ? `<div class="pf-use"><span class="faint">${label || 'Use'}:</span>${vals.map(v => `<button type="button" class="use-chip" data-set="${k}" data-v="${esc(v)}" title="${esc(v)}">${esc(v)}</button>`).join('')}</div>` : '';
  const ageOf = s => { const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s || ''); if (!m) return ''; const b = new Date(+m[3], +m[2] - 1, +m[1]), t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--; return a >= 0 && a < 120 ? a + ' years old' : ''; };
  const longDate = s => { const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s || ''); return m ? `${+m[1]} ${MONTHS[+m[2] - 1]} ${m[3]}` : ''; };

  function openPanel(i, focusField) {
    if (!G || !G.rows[i]) return;
    if (P.i !== i) P.tried = false;
    P.i = i;
    if (focusField === 'dob' || focusField === 'doj') { P.cal = focusField; P.view = null; }
    let el = $('#panel');
    if (!el) {
      el = document.createElement('div'); el.id = 'panelWrap';
      el.innerHTML = '<div class="pn-scrim" id="pnScrim"></div><aside class="panel" id="panel" role="dialog" aria-modal="true" aria-label="Edit volunteer"></aside>';
      document.body.appendChild(el);
      $('#pnScrim').onclick = closePanel;
      const p = $('#panel');
      p.addEventListener('input', e => { const f = e.target.dataset.f; if (f) setField(f, e.target.value, true); });
      p.addEventListener('change', e => { const f = e.target.dataset.f; if (!f) return; if (f === 'dob' || f === 'doj') { const n = normDate(e.target.value); if (n) setField(f, n); else drawPanel(); } });
      p.addEventListener('click', panelClick);
      p.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.dataset.cal == null) { e.preventDefault(); const all = Array.from(p.querySelectorAll('input[data-f], textarea[data-f]')); const n = all[all.indexOf(e.target) + 1]; if (n) n.focus(); } });
      el = $('#panel');
    }
    drawPanel();
    requestAnimationFrame(() => document.body.classList.add('pn-on'));
    const r = G.rows[i];
    setTimeout(() => {
      const want = focusField && focusField !== 'name' ? ($('#pf_' + focusField + ':not([data-f=qual])') || $(`#panel [data-set="${focusField}"].on`) || $(`#panel [data-set="${focusField}"]`)) : null;
      const f = want || $(r.name && !focusField ? '#pn_close' : '#pf_name');
      if (f) { f.focus({ preventScroll: true }); if (want) (P.cal ? $('#panel .cal') : f.closest('.pf') || f).scrollIntoView({ block: 'center' }); }
    }, 320);
    markRow();
  }
  function closePanel() {
    document.body.classList.remove('pn-on'); P.i = -1; P.cal = null; markRow();
    const last = $('#grid tr.editing'); if (last) last.classList.remove('editing');
  }
  function markRow() {
    document.querySelectorAll('#grid tr.editing').forEach(t => t.classList.remove('editing'));
    if (P.i >= 0) { const tr = document.querySelector(`#grid tbody tr[data-r="${P.i}"]`); if (tr) { tr.classList.add('editing'); tr.scrollIntoView({ block: 'nearest' }); } }
  }
  function setField(k, v, typing) {
    const r = G.rows[P.i]; if (!r) return;
    r[k] = v;
    clearTimeout(P.t); P.t = setTimeout(() => { padRows(); redraw(); markRow(); setState(); }, typing ? 250 : 0);
    saveDraft();
    if (!typing) drawPanel(); else refreshPanelChecks();
  }
  /** While typing, only the messages and the header change (redrawing would move the cursor). */
  function refreshPanelChecks() {
    const r = G.rows[P.i], p = panelProblems(r);
    document.querySelectorAll('#panel [data-err]').forEach(e => { const m = p[e.dataset.err]; e.textContent = m || ''; e.closest('.pf').classList.toggle('bad', !!m); });
    const h = $('#pnTitle'); if (h) h.textContent = r.name || 'New volunteer';
    const pm = $('#pnMiss'); if (pm) pm.innerHTML = missHtml(r);
    const a = $('#pnAge'); if (a) a.textContent = ageOf(r.dob);
    pnState();
  }
  function missHtml(r) {
    if (isBlank(r)) return '';
    const m = missingOf(r);
    return m.length ? `<div class="pn-miss"><b>Details missing (${m.length}):</b> ${m.map(esc).join(', ')}. <span class="faint">Not counted as added until complete.</span></div>`
      : '<div class="pn-done">✓ All details complete. Counted as added.</div>';
  }
  /** Opens the next volunteer whose details are missing (from `from`, wrapping round). */
  function openNextMissing(from) {
    const list = G.rows.map((r, i) => i).filter(i => !G.rows[i].del && !isBlank(G.rows[i]) && missingOf(G.rows[i]).length);
    if (!list.length) { toast('Every volunteer has all details. Nothing is missing.'); return; }
    const j = list.find(i => i >= (from == null || from < 0 ? 0 : from)) ?? list[0];
    const first = { 'Date of birth': 'dob', 'Date of joining': 'doj', 'Qualification': 'qual', 'Place of posting': 'placeType', 'Range name': 'placeName', 'Range HQ / Beat / Camp': 'subType', 'Nature of works': 'duty', 'Work details': 'wdet',
      'Dept. approval ref': 'deptRef', 'Directorate ref': 'dirRef', 'Appointment order': 'apptRef', 'Name': 'name' }[missingOf(G.rows[j])[0]] || 'subName';
    openPanel(j, first);
  }
  function pnState() {
    const s = $('#pnState'); if (!s) return;
    const d = dirty();
    s.className = 'state ' + (G.saving ? 'saving' : d ? 'dirty' : 'clean');
    s.textContent = G.saving ? 'Saving…' : d ? 'Not saved yet' : 'All saved';
  }
  function panelProblems(r) {
    const p = rowProblems(r);
    if (p.wdet && !P.tried && !String(r.wdet || '').trim()) delete p.wdet;
    return p;
  }
  function dateField(k, label, r, help) {
    return `<div class="pf ${rowProblems(r)[k] ? 'bad' : ''}"><label for="pf_${k}">${label}</label>
      <div class="datebox"><input id="pf_${k}" data-f="${k}" value="${esc(r[k] || '')}" placeholder="DD-MM-YYYY" inputmode="numeric" autocomplete="off">
        <button type="button" class="btn cal-btn" data-cal="${k}" aria-label="Open calendar for ${label}">${icon.cal} Pick</button></div>
      <div class="pf-hint">${k === 'dob' ? `<span id="pnAge">${ageOf(r.dob)}</span>` : esc(longDate(r[k]))}${help ? ' ' + help : ''}</div>
      <div class="pf-err" data-err="${k}">${esc(rowProblems(r)[k] || '')}</div>
      ${P.cal === k ? calendarHtml(k, r[k]) : ''}</div>`;
  }
  function calendarHtml(k, val) {
    const o = DATE_OPTS[k], m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(val || '');
    if (!P.view || P.view.k !== k) P.view = { k, y: m ? +m[3] : o.start, mo: m ? +m[2] - 1 : (k === 'doj' ? new Date().getMonth() : 0) };
    const { y, mo } = P.view, first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
    const sel = m && +m[3] === y && +m[2] - 1 === mo ? +m[1] : 0, t = new Date(), isT = d => t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d;
    const years = []; for (let yy = o.to; yy >= o.from; yy--) years.push(yy);
    const cells = []; for (let b = 0; b < (first + 6) % 7; b++) cells.push('<span></span>');
    for (let d = 1; d <= days; d++) cells.push(`<button type="button" class="day${d === sel ? ' on' : ''}${isT(d) ? ' today' : ''}" data-day="${d}">${d}</button>`);
    return `<div class="cal" role="dialog" aria-label="Choose a date">
      <div class="cal-head"><button type="button" class="cal-nav" data-mo="-1" aria-label="Previous month">‹</button>
        <select data-cmo aria-label="Month">${MONTHS.map((n, i) => `<option value="${i}"${i === mo ? ' selected' : ''}>${n}</option>`).join('')}</select>
        <select data-cy aria-label="Year">${years.map(yy => `<option${yy === y ? ' selected' : ''}>${yy}</option>`).join('')}</select>
        <button type="button" class="cal-nav" data-mo="1" aria-label="Next month">›</button></div>
      ${k === 'dob' ? `<div class="cal-decades">${[1970, 1980, 1990, 2000, 2005].filter(d => d <= o.to).map(d => `<button type="button" data-jump="${d}" class="${y >= d && y < d + (d === 2000 ? 5 : 10) ? 'on' : ''}">${d}s</button>`).join('')}</div>` : ''}
      <div class="cal-week">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${cells.join('')}</div>
      <div class="cal-foot">${k === 'doj' ? '<button type="button" class="btn sm ghost" data-today>Today</button>' : ''}<span class="sp"></span>
        <button type="button" class="btn sm ghost" data-clear>Clear</button><button type="button" class="btn sm" data-calclose>Close</button></div></div>`;
  }
  function panelClick(e) {
    const t = e.target.closest('button, select'); if (!t) return;
    const r = G.rows[P.i], d = t.dataset;
    if (t.id === 'pn_close') return closePanel();
    if (d.nav) { const j = P.i + (+d.nav); if (j >= 0 && j < G.rows.length) { P.cal = null; P.view = null; openPanel(j); } return; }
    if (d.set) { setField(d.set, d.v); if (d.set === 'duty') { const w = $('#pf_wdet'); if (w && d.v === 'Others') w.focus(); } return; }
    if (d.cal) { P.cal = P.cal === d.cal ? null : d.cal; P.view = null; drawPanel(); return; }
    if (d.day) { const k = P.cal, v = `${String(d.day).padStart(2, '0')}-${String(P.view.mo + 1).padStart(2, '0')}-${P.view.y}`; P.cal = null; P.view = null; setField(k, v); return; }
    if (d.mo) { let mo = P.view.mo + (+d.mo), y = P.view.y; if (mo < 0) { mo = 11; y--; } if (mo > 11) { mo = 0; y++; } const o = DATE_OPTS[P.cal]; if (y >= o.from && y <= o.to) { P.view.mo = mo; P.view.y = y; } drawPanel(); return; }
    if (d.jump) { P.view.y = Math.min(+d.jump, DATE_OPTS[P.cal].to); drawPanel(); return; }
    if (d.today != null) { const n = new Date(); P.view = null; const k = P.cal; P.cal = null; setField(k, `${String(n.getDate()).padStart(2, '0')}-${String(n.getMonth() + 1).padStart(2, '0')}-${n.getFullYear()}`); return; }
    if (d.clear != null) { const k = P.cal; P.cal = null; P.view = null; setField(k, ''); return; }
    if (d.calclose != null) { P.cal = null; P.view = null; drawPanel(); return; }
    if (t.id === 'pnSave') return save();
    if (t.id === 'pnNextMiss') { P.cal = null; P.view = null; return openNextMissing(P.i + 1); }
    if (t.id === 'pnDel') { toggleDel(P.i); if (G.rows[P.i] && G.rows[P.i] === r) drawPanel(); else closePanel(); return; }
  }
  document.addEventListener('change', e => {
    if (!e.target.closest('#panel .cal')) return;
    if (e.target.dataset.cmo != null) P.view.mo = +e.target.value;
    if (e.target.dataset.cy != null) P.view.y = +e.target.value;
    drawPanel();
  });
  function drawPanel() {
    const el = $('#panel'), r = G && G.rows[P.i]; if (!el || !r) return;
    const keep = el.querySelector('.pn-body') ? el.querySelector('.pn-body').scrollTop : 0, focused = document.activeElement && document.activeElement.id;
    const p = panelProblems(r), filled = G.rows.filter(x => !x.del && !isBlank(x)).length;
    const pos = G.rows.slice(0, P.i + 1).filter(x => !x.del && !isBlank(x)).length;
    const field = (k, label, help, extra) => `<div class="pf ${p[k] ? 'bad' : ''}"><label for="pf_${k}">${label}</label>
      <input id="pf_${k}" data-f="${k}" value="${esc(r[k] || '')}" autocomplete="off"${extra || ''}>
      ${help || ''}<div class="pf-err" data-err="${k}">${esc(p[k] || '')}</div></div>`;
    const pick = (k, opts, wide) => `<div class="opts${wide ? ' wide' : ''}" role="radiogroup">${opts.map(o => `<button type="button" role="radio" aria-checked="${r[k] === o}" class="opt${r[k] === o ? ' on' : ''}" data-set="${k}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    el.innerHTML = `
      <div class="pn-head"><div class="grow"><div class="faint">${r.id || !isBlank(r) ? `Volunteer ${pos || filled + 1} of ${Math.max(filled, pos)}` : 'New volunteer'} · ${esc(G.division)}</div>
        <h2 id="pnTitle">${esc(r.name || 'New volunteer')}</h2>${r.del ? '<span class="pill attn">Will be removed when you save</span>' : `<div id="pnMiss">${missHtml(r)}</div>`}</div>
        <button class="x" id="pn_close" aria-label="Close">×</button></div>
      <div class="pn-body">
        <section class="pn-sec"><h3>Volunteer</h3>
          ${field('name', 'Name of Forest Volunteer <span class="req">*</span>', '', ' autocapitalize="words"')}
          ${dateField('dob', 'Date of birth', r)}
          <div class="pf"><label>Educational qualification</label>${pick('qual', QUALS)}
            <input id="pf_qual" data-f="qual" class="mt" value="${esc(QUALS.includes(r.qual) ? '' : r.qual || '')}" placeholder="or type another, e.g. B.Sc. Forestry" autocomplete="off"></div>
        </section>
        <section class="pn-sec"><h3>Orders and references</h3>
          ${field('deptRef', 'Forest Dept.’s approval ref', chips('deptRef', used('deptRef', r.deptRef)), ' placeholder="e.g. No. 1123/FD/2025 dt 12-06-2025"')}
          ${field('dirRef', 'Forest Directorate’s Ref no sent to the Circle in Charge', chips('dirRef', used('dirRef', r.dirRef)))}
          ${field('apptRef', 'Appointment order issued by / reference', chips('apptRef', used('apptRef', r.apptRef)), ' placeholder="e.g. DFO, ' + esc(G.division) + ' · Memo 310/…"')}
        </section>
        <section class="pn-sec"><h3>Joining</h3>
          ${dateField('doj', 'Date of joining', r)}
          <div class="pf"><label>Present place of posting</label>${pick('placeType', PLACES)}</div>
          ${r.placeType === 'Range' ? `<div class="pf-sub">
            <div class="pf"><label for="pf_placeName">Range name</label>
              <input id="pf_placeName" data-f="placeName" value="${esc(r.placeName || '')}" placeholder="e.g. Sajnekhali Wildlife Sanctuary" autocomplete="off">
              ${chips('placeName', used('placeName', r.placeName, 5))}</div>
            <div class="pf"><label>Within the range</label>${pick('subType', SUBS)}
              ${r.subType === 'Beat' || r.subType === 'Camp' ? `<input id="pf_subName" data-f="subName" class="mt" value="${esc(r.subName || '')}" placeholder="Name of the ${r.subType.toLowerCase()}${r.subType === 'Beat' ? ', e.g. Duttar or Pakhirala HQ' : ', e.g. Kendo Protection Camp'}" autocomplete="off">
              ${chips('subName', used('subName', r.subName, 5, x => x.subType === r.subType && (!r.placeName || x.placeName === r.placeName)))}` : ''}</div></div>` : ''}
        </section>
        <section class="pn-sec"><h3>Nature of works assigned</h3>
          <div class="pf ${p.duty ? 'bad' : ''}"><label>Main duty</label>${pick('duty', DUTIES, true)}<div class="pf-err" data-err="duty">${esc(p.duty || '')}</div></div>
          <div class="pf ${p.wdet ? 'bad' : ''}"><label for="pf_wdet">${r.duty === 'Others' ? 'Write the actual work <span class="req">*</span>' : 'Details <span class="faint">(optional)</span>'}</label>
            <textarea id="pf_wdet" data-f="wdet" rows="2" placeholder="${r.duty === 'Others' ? 'e.g. Mahut of elephant Champa; peon in DFO office' : 'e.g. fire watch at Tonglu'}">${esc(r.wdet || '')}</textarea>
            ${chips('wdet', used('wdet', r.wdet, 4))}<div class="pf-err" data-err="wdet">${esc(p.wdet || '')}</div></div>
        </section>
        ${r.id || !isBlank(r) ? `<button type="button" class="btn sm ghost danger" id="pnDel">${r.del ? icon.undo + ' Keep this volunteer' : icon.x + ' Remove this volunteer'}</button>` : ''}
      </div>
      <div class="pn-foot">
        <button type="button" class="btn sm" data-nav="-1" ${P.i > 0 ? '' : 'disabled'}>‹ Previous</button>
        <button type="button" class="btn sm" data-nav="1" ${P.i < G.rows.length - 1 ? '' : 'disabled'}>Next ›</button>
        ${G.rows.some((x, j) => j !== P.i && !x.del && !isBlank(x) && missingOf(x).length) ? '<button type="button" class="btn sm ghost miss-btn" id="pnNextMiss" title="Go to the next volunteer with details missing">Next missing ›</button>' : ''}
        <span class="sp"></span><span class="state" id="pnState"></span>
        <button type="button" class="btn primary save" id="pnSave" title="Save (Ctrl + S)">${icon.save} Save</button></div>`;
    el.querySelector('.pn-body').scrollTop = keep;
    if (focused && focused.indexOf('pf_') === 0) { const f = document.getElementById(focused); if (f) { f.focus({ preventScroll: true }); if (f.setSelectionRange) try { f.setSelectionRange(f.value.length, f.value.length); } catch (er) {} } }
    if (P.cal) { const c = el.querySelector('.cal'); if (c) c.scrollIntoView({ block: 'nearest' }); }
    pnState();
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !document.body.classList.contains('pn-on')) return;
    if (P.cal) { P.cal = null; P.view = null; drawPanel(); } else closePanel();
  });

  /* -- saving -- */
  async function save(force) {
    if (!G || G.saving) return;
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    const bad = G.rows.map((r, i) => [i, rowProblems(r)]).filter(x => Object.keys(x[1]).length);
    if (bad.length) {
      redraw();
      const [i, p] = bad[0];
      P.tried = true; openPanel(i, Object.keys(p)[0]);
      toast(`Fix the red cell${bad.length > 1 ? 's' : ''} first: ${Object.values(p)[0]}.`, true); return;
    }
    if (!dirty() && force !== true) { setState('clean', 'Nothing to save. All changes are saved.'); return; }
    // the place of posting changed format; an older script would drop the Beat / Camp part, so wait for the updated one
    if (META && !META.placeV) {
      await meta(true);
      if (!META.placeV) { setState('err', 'Saving paused'); toast('The portal is being updated. Your changes are kept on this device; please press Save again in a few minutes.', true); return; }
    }
    const sent = G.rows.filter(r => !r.del && !isBlank(r));
    const open = P.i >= 0 ? G.rows[P.i] : null;
    G.saving = true; setState('saving');
    let res;
    try {
      res = await API.call('save', { circle: G.circle, division: G.division, base: G.base, force: force === true,
        rows: sent.map(r => SENT.reduce((o, k) => (o[k] = k === 'works' ? joinWorks(r) : k === 'placeSub' ? joinSub(r) : k === 'placeName' && r.placeType !== 'Range' ? '' : String(r[k] || '').trim(), o), { id: r.id, key: r.key })), operator: op() });
    } catch (e) {
      G.saving = false; setState('err', 'Not saved. ' + (e.message || '')); toast('Not saved: ' + (e.message || 'please try again.'), true);
      if (e.auth) { toast('Your sign-in has expired. Your changes are kept on this device. Sign in again and press Save.', true); setTimeout(() => { go('#/'); route(); }, 1800); }
      return;
    }
    G.saving = false;
    if (res.conflict) { setState('err', 'Not saved yet'); conflict(res); return; }
    G.saved = {}; res.rows.forEach(r => G.saved[r.id] = fromServer(r));
    G.rows = res.rows.map(r => Object.assign({ key: newKey() }, r));
    G.base = res.ver.n; G.ver = res.ver; G.orderChanged = false;
    store.del(draftKey());
    if (META && META.complete) META.complete[G.circle + '|' + G.division] = res.rows.filter(r => !missingOfSaved(r).length).length;
    if (META) { META.counts[G.circle + '|' + G.division] = res.rows.length; if (res.changes) META.saved[G.circle + '|' + G.division] = { on: res.ver.on, by: res.ver.by }; }
    padRows(); redraw();
    const nt = $('#sheetNote'); if (nt) nt.classList.add('hidden');   // "unsaved changes are back" no longer applies
    if (open) {   // stay on the same volunteer (a new one now has its id); a removed one closes the panel
      const id = open.id || (res.ids || {})[open.key], j = id ? G.rows.findIndex(r => r.id === id) : isBlank(open) ? G.rows.findIndex(r => isBlank(r)) : -1;
      if (j >= 0 && !open.del) { P.i = j; drawPanel(); markRow(); } else closePanel();
    }
    setState('clean', res.changes ? `Saved · ${res.rows.length} volunteer${res.rows.length === 1 ? '' : 's'}` : 'All changes saved');
    toast(res.changes ? `Saved. ${res.changes} change${res.changes === 1 ? '' : 's'} recorded.` : 'Nothing had changed.');
  }
  function conflict(res) {
    const d = dialog('Someone else saved this division', esc(res.message), `
      <p>Your changes are <b>not lost</b>. They are kept on this device.</p>
      <p>Choose one:</p>
      <ul class="help-steps"><li><b>See their list</b> opens what was saved. Download your changes first if you want to compare.</li>
      <li><b>Save mine anyway</b> replaces their list with yours. Their changes stay in the change log.</li></ul>`,
      `<button class="btn" id="cfDl">${icon.down} Download mine</button><button class="btn" id="cfTheirs">See their list</button><button class="btn primary" id="cfMine">Save mine anyway</button>`);
    d.el.querySelector('#cfDl').onclick = () => download(`${G.division} - my unsaved volunteers.csv`, csvRows(G.rows.filter(r => !r.del && !isBlank(r))));
    d.el.querySelector('#cfTheirs').onclick = () => { d.close(); store.del(draftKey()); renderDivision(G.circle, G.division); };
    d.el.querySelector('#cfMine').onclick = () => { d.close(); save(true); };
  }
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { if (G && $('#grid')) { e.preventDefault(); save(); } }
  });
  window.addEventListener('beforeunload', e => { if (G && $('#grid') && dirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------------- admin dashboard and reports (js/dashboard.js) ---------------- */
  window.FV_APP = { esc, enc, icon, toast, go, guard, loading, download, shortWhen, missingOfSaved, fromServer, DUTIES, QUALS, meta, divCount, divSaved };
  async function renderAdmin() {
    if (!API.user || !API.user.isAdmin) { go('#/circles'); return; }
    await window.FV_DASH.render(app);
  }

  /* ---------------- router ---------------- */
  async function route() {
    if (!API.user) { renderWho(); renderSignin(); return; }
    if (!op()) { renderWho(); renderOperator(false); return; }
    renderWho();
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    if (document.body.classList.contains('pn-on')) closePanel();
    if (parts[0] !== 'd') G = null;
    try {
      if (parts[0] === 'c' && parts[1]) await renderDivisions(parts[1]);
      else if (parts[0] === 'd' && parts[2]) await renderDivision(parts[1], parts[2]);
      else if (parts[0] === 'admin') await renderAdmin();
      else await renderCircles();
    } catch (e) { /* toast already shown */ }
    window.scrollTo(0, 0);
  }
  let lastHash = location.hash;
  window.addEventListener('hashchange', () => {
    if (G && $('#grid') && dirty() && !location.hash.startsWith(`#/d/${enc(G.circle)}/${enc(G.division)}`)) {
      // leaving a sheet with unsaved changes: they stay on this device as a draft, so just say so
      store.set(draftKey(), { base: G.base, at: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), rows: G.rows.filter(r => !isBlank(r) || r.del) });
      toast(`Unsaved changes in ${G.division} are kept on this device. Open it again to save them.`);
    }
    lastHash = location.hash; route();
  });
  // start once every script is in (the dashboard is in its own file, loaded after this one)
  const boot = () => { if (API.user) start(); else route(); };
  if (document.readyState === 'complete') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
