// AranyaHR — sign-in, sign-up, the division home (all cadres, by range) and the admin pages.
// Each cadre's own work (verify, edit, approve) is done on its own page: officers.html, fv.html, cdl.html.
(function () {
  const API = window.HR_API, CFG = API.config, HELP = CFG.HELP, ADMIN = CFG.ADMIN;
  const $ = (s, el = document) => el.querySelector(s);
  const app = $('#app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = encodeURIComponent;
  const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;
  const go = h => { location.hash = h; };
  function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.className = 'toast', 3800); }

  // each cadre: its page, and (for the CDL+BS page) which tab to open
  const CADRES = [
    { k: 'FR', label: 'Forest Rangers', mod: 'off' }, { k: 'DFR', label: 'Deputy Rangers / Foresters', mod: 'off' }, { k: 'FG', label: 'Forest Guards & HFG', mod: 'off' },
    { k: 'FV', label: 'Forest Volunteers', mod: 'fv' }, { k: 'CDL', label: 'DL / CDL', mod: 'cdl', tab: ['cdl-cadre', 'CDL'] }, { k: 'BS', label: 'Ban Sahayaks', mod: 'cdl', tab: ['cdl-cadre', 'BS'] },
    { k: 'AS', label: 'Aranya Sathis', mod: 'cdl', set: 'sathi', tab: ['cdl-cadre-sathi', 'AS'] }, { k: 'DEO', label: 'DEOs', mod: 'cdl', set: 'sathi', tab: ['cdl-cadre-sathi', 'DEO'] },
  ];
  const CAD = CADRES.reduce((a, c) => (a[c.k] = c, a), {});
  function pageOf(c, own) {
    const o = own && own[c.mod];
    if (c.mod === 'cdl') return 'cdl.html' + (c.set ? '?set=' + c.set : '') + (o ? '#/d/' + enc(o.division) : '#/');
    return (c.mod === 'off' ? 'officers.html' : 'fv.html') + (o ? '#/d/' + enc(o.circle) + '/' + enc(o.division) : '#/');
  }
  // status words of the three apps, and how they count on the home page
  const STATUS = { verified: ['Verified', 'verified'], partial: ['Posting verified', 'partial'], pending: ['Awaiting approval', 'pending'], unverified: ['Not verified', 'unverified'],
    added: ['Complete', 'verified'], missing: ['Details missing', 'attn'], confirmed: ['Verified', 'verified'], ready: ['Ready to verify', 'partial'], problem: ['Problem', 'attn'], remove: ['Removal pending', 'pending'] };
  const isDone = s => (STATUS[s] || [])[1] === 'verified';

  /* ---------------- loading animation (UPMC's tree) ---------------- */
  const TREE = `<svg class="tree" viewBox="0 0 64 64" aria-hidden="true">
    <path class="canopy" d="M32 7c-8 0-14 6-14 13.5 0 1.6.3 3 .8 4.4C14.2 27 11 31.3 11 36.5 11 43.4 16.8 49 24 49h16c7.2 0 13-5.6 13-12.5 0-5.2-3.2-9.5-7.8-11.6.5-1.4.8-2.8.8-4.4C46 13 40 7 32 7Z"/>
    <path class="trunk" d="M32 57V30M32 42l-7-6M32 37l6-5"/><path class="ground" d="M17 57h30"/></svg>`;
  const loader = (title, step) => `<div class="loader">${TREE}<b class="ld-title">${esc(title)}</b><div class="ibar"><i></i></div><p class="ld-step">${esc(step || 'Almost there…')}</p>
    <p class="ld-help">Need help? ${esc(HELP.name)}, ${esc(HELP.office)} · <a href="tel:${HELP.tel}">${esc(HELP.phone)}</a></p></div>`;
  async function guard(fn) {
    try { return await fn(); }
    catch (e) { toast(e.message || 'Something went wrong.', true); if (e.auth) { go('#/'); route(); } throw e; }
  }
  const helpStrip = () => `<div class="help-strip"><span class="hq" aria-hidden="true">?</span>
    <span>Need help? Contact <b>${esc(HELP.name)}</b>, ${esc(HELP.office)} · <a href="tel:${HELP.tel}">${esc(HELP.phone)}</a></span></div>`;

  /* ---------------- header ---------------- */
  // the header (header.js) shows who is signed in, the menus and Sign out
  const renderWho = () => window.HR_HEADER && window.HR_HEADER.render();

  /* ---------------- sign in, sign up, forgot password ---------------- */
  const A = { email: '', msg: '', lists: null, form: {}, pw: '' };
  const card = (title, sub, body) => `<section class="signin"><div class="card hr-auth"><img class="emb" src="assets/emblem.svg" alt="National Emblem of India">
    <h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}${A.msg ? `<div class="notice info">${esc(A.msg)}</div>` : ''}${body}${helpStrip()}</div></section>`;
  const field = (name, label, type = 'text', extra = '') => `<label>${label}<input name="${name}" type="${type}" ${extra}></label>`;
  const formErr = '<div id="ferr" class="hr-err" role="alert"></div>';
  async function submitting(form, label, fn) {
    const btn = form.querySelector('button[type=submit]'), was = btn.textContent;
    btn.disabled = true; btn.textContent = label; $('#ferr').textContent = '';
    try { await fn(); } catch (e) { $('#ferr').textContent = e.message; btn.disabled = false; btn.textContent = was; }
  }

  function renderSignin() {
    app.innerHTML = card('AranyaHR', 'Directorate of Forests, West Bengal. FR, DR/Fr, FG, FV, DL / CDL, Ban Sahayak, Aranya Sathi and DEO, division by division.',
      API.DEMO ? `<button class="btn primary" id="demoBtn" style="width:100%">Try with demo data</button>
        <p class="faint" style="margin:12px 0 0">This copy is not connected to the live sheets. All names and numbers are made up.</p>`
      : `<form class="form" id="f" autocomplete="on">
        ${field('username', 'Email', 'text', `autocomplete="username" autocapitalize="none" required value="${esc(A.email)}"`)}
        <label>Password<span class="pw"><input name="password" type="password" autocomplete="current-password" required><button type="button" class="btn sm ghost" id="showPw">Show</button></span></label>
        <button class="btn primary" type="submit">Sign in</button>${formErr}</form>
        <p class="hr-alt"><a href="#/forgot">Forgot password?</a> · New here? <a href="#/signup">Create an account</a></p>`);
    A.msg = '';
    if (API.DEMO) { $('#demoBtn').onclick = () => { API.demoSignIn(); start(); }; return; }
    $('#showPw').onclick = () => { const i = $('#f').password; i.type = i.type === 'password' ? 'text' : 'password'; $('#showPw').textContent = i.type === 'password' ? 'Show' : 'Hide'; };
    $('#f').onsubmit = e => {
      e.preventDefault(); const f = e.target; A.email = f.username.value.trim();
      submitting(f, 'Signing in…', async () => { await API.signIn(A.email, f.password.value); start(); });
    };
  }

  async function renderSignup() {
    if (!A.lists) { app.innerHTML = loader('Getting the list of divisions…'); A.lists = await API.open('lists').catch(e => { app.innerHTML = card('Create an account', esc(e.message), ''); throw e; }); }
    const L = A.lists, ff = A.form, level = ff.level || 'Division';
    const circle = L.circles.find(c => c.circle === ff.circle);
    app.innerHTML = card('Create an account', '', `<form class="form" id="f" novalidate>
      <label>Account for<div class="seg hr-seg">${L.levels.map(l => `<button type="button" data-level="${l}" class="${l === level ? 'on' : ''}">${l === 'State' ? 'State (Directorate)' : l}</button>`).join('')}</div></label>
      <div class="notice info">${level === 'Division' ? 'Your account will work after the admin approves it.' : `${level} accounts can view every division ${level === 'Circle' ? 'of the circle' : ''}, not change them. They work after the admin approves them.`}</div>
      ${level === 'State' ? '' : `<label>Circle<select name="circle"><option value="">— Choose —</option>${L.circles.map(c => `<option ${c.circle === ff.circle ? 'selected' : ''}>${esc(c.circle)}</option>`).join('')}</select></label>`}
      ${level === 'Division' ? `<label>Division<select name="division" ${circle ? '' : 'disabled'}><option value="">— Choose —</option>${circle ? circle.divisions.map(d => `<option ${d === ff.division ? 'selected' : ''}>${esc(d)}</option>`).join('') : ''}</select></label><div id="taken"></div>` : ''}
      ${field('email', 'Email <span class="faint">(you will sign in with it)</span>', 'email', `autocomplete="email" value="${esc(ff.email || '')}"`)}
      ${field('name', 'Your name', 'text', `autocomplete="name" value="${esc(ff.name || '')}"`)}
      <div class="hr-two">${field('desig', 'Designation', 'text', `value="${esc(ff.desig || '')}" placeholder="e.g. Head Clerk"`)}${field('phone', 'Mobile number', 'tel', `inputmode="numeric" autocomplete="tel" value="${esc(ff.phone || '')}"`)}</div>
      <div class="hr-two">${field('password', 'Password <span class="faint">(8+ characters)</span>', 'password', 'autocomplete="new-password"')}${field('password2', 'Password again', 'password', 'autocomplete="new-password"')}</div>
      <button class="btn primary" type="submit">${L.emailCode ? 'Send me a code' : 'Create my account'}</button>${formErr}</form>
      <p class="hr-alt">Already have an account? <a href="#/">Sign in</a></p>`);
    const f = $('#f'), keep = () => { ['circle', 'division', 'email', 'name', 'desig', 'phone'].forEach(k => { if (f[k]) ff[k] = f[k].value; }); };
    f.querySelectorAll('[data-level]').forEach(b => b.onclick = () => { keep(); ff.level = b.dataset.level; renderSignup(); });
    if (f.circle) f.circle.onchange = () => { keep(); ff.division = ''; renderSignup(); };
    if (f.division) {
      const check = () => {
        const d = f.division.value, box = $('#taken'); box.innerHTML = ''; if (!d) return;
        API.open('divisionUsers', { division: d }).then(r => {
          if (r.count && f.division.value === d) box.innerHTML = `<div class="notice attn">${esc(d)} already has a user. You will be the second user: you can sign up, but please contact the admin (${esc(ADMIN.email)}) to approve your account.</div>`;
        }, () => {});
      };
      f.division.onchange = check; if (ff.division) check();
    }
    f.onsubmit = e => {
      e.preventDefault(); keep();
      submitting(f, 'Please wait…', async () => {
        if (f.password.value !== f.password2.value) throw new Error('The two passwords are not the same.');
        if (level === 'Division' && !ff.division) throw new Error('Choose your circle and division.');
        A.pw = f.password.value;
        const r = await API.open('signup', Object.assign({}, ff, { level, password: A.pw }));
        signedUp(r, ff.email);
      });
    };
  }
  function signedUp(r, email) {
    A.email = email;
    if (r.token) { A.form = {}; toast('Welcome! Your account is ready.'); start(); return; }
    if (r.sent) { renderCode(); return; }
    A.form = {};
    app.innerHTML = card('Waiting for approval', esc(r.message), `<p>Admin: <b>${esc(ADMIN.name)}</b>, <a href="mailto:${esc(ADMIN.email)}">${esc(ADMIN.email)}</a></p>
      <p class="hr-alt"><a href="#/">Back to sign in</a></p>`);
  }
  function renderCode() {
    app.innerHTML = card('Check your email', `We sent a 6-digit code to <b>${esc(A.email)}</b>. It may be in the spam folder.`, `<form class="form" id="f">
      ${field('code', 'Code', 'text', 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" required')}
      <button class="btn primary" type="submit">Create my account</button>${formErr}</form><p class="hr-alt"><a href="#/signup">Change the details</a></p>`);
    $('#f').onsubmit = e => { e.preventDefault(); submitting(e.target, 'Please wait…', async () => signedUp(await API.open('signupVerify', { email: A.email, code: e.target.code.value }), A.email)); };
  }
  function renderForgot(step) {
    if (step !== 'reset') {
      app.innerHTML = card('Forgot password', 'We will email you a code to set a new password.', `<form class="form" id="f">
        ${field('email', 'Email you signed up with', 'email', `autocomplete="email" required value="${esc(A.email)}"`)}
        <button class="btn primary" type="submit">Send me a code</button>${formErr}</form><p class="hr-alt"><a href="#/">Back to sign in</a></p>`);
      $('#f').onsubmit = e => { e.preventDefault(); A.email = e.target.email.value.trim(); submitting(e.target, 'Please wait…', async () => { await API.open('forgotStart', { email: A.email }); renderForgot('reset'); }); };
      return;
    }
    app.innerHTML = card('Set a new password', `If <b>${esc(A.email)}</b> has an account, a code is on its way. It may be in the spam folder.`, `<form class="form" id="f">
      ${field('code', 'Code', 'text', 'inputmode="numeric" autocomplete="one-time-code" maxlength="6" required')}
      <div class="hr-two">${field('password', 'New password <span class="faint">(8+ characters)</span>', 'password', 'autocomplete="new-password"')}${field('password2', 'New password again', 'password', 'autocomplete="new-password"')}</div>
      <button class="btn primary" type="submit">Set the new password</button>${formErr}</form><p class="hr-alt"><a href="#/forgot">Send a new code</a></p>`);
    $('#f').onsubmit = e => {
      e.preventDefault(); const f = e.target;
      submitting(f, 'Please wait…', async () => {
        if (f.password.value !== f.password2.value) throw new Error('The two passwords are not the same.');
        await API.open('forgotVerify', { email: A.email, code: f.code.value, password: f.password.value });
        A.msg = 'Your password has been changed. Please sign in.'; go('#/'); route();
      });
    };
  }

  /* ---------------- home: one division, every cadre, by range ---------------- */
  const H = { data: null, range: 'all', cadre: 'all', q: '' };
  function renderDemoHome() {
    app.innerHTML = `<div class="head"><div><h1 class="page-title">Demo.</h1><p class="page-sub">The cadre pages run on made-up data in this browser. The division home and admin pages need the live API.</p></div></div>
      <div class="tiles">${[['officers.html', 'FR, DR/Fr, FG', 'Officer verification'], ['fv.html', 'Forest Volunteers', 'List of volunteers'], ['cdl.html', 'DL / CDL and Ban Sahayak', 'Verify and update'], ['cdl.html?set=sathi', 'Aranya Sathi and DEO', 'Verify and update']]
        .map(([h, t, s]) => `<a class="tile" href="${h}" style="text-decoration:none"><div class="t"><b>${t}</b><span>${s}</span></div></a>`).join('')}</div>`;
  }
  async function renderHome(division) {
    const u = API.user;
    if (API.DEMO) { renderDemoHome(); return; }
    if (!division && (u.isAdmin || u.level !== 'Division')) { await renderPicker(); return; }
    if (!H.data || H.data.division !== division) {
      app.innerHTML = loader(division ? `Opening ${division}…` : 'Opening your division…', 'Collecting every cadre’s list…');
      const d = await guard(() => API.call('home', { division }));
      if (H.data && H.data.division !== d.division) Object.assign(H, { range: 'all', cadre: 'all', q: '' });
      H.data = d;
    }
    drawHome();
  }
  function drawHome() {
    const D = H.data, u = API.user, all = D.people;
    const inR = p => H.range === 'all' || p.range === H.range;
    const here = all.filter(inR), q = H.q.toLowerCase();
    const list = here.filter(p => (H.cadre === 'all' || p.cadre === H.cadre) && (!q || (p.name + ' ' + p.place + ' ' + p.rawRange).toLowerCase().includes(q)))
      .sort((a, b) => CADRES.findIndex(c => c.k === a.cadre) - CADRES.findIndex(c => c.k === b.cadre) || a.name.localeCompare(b.name));
    const ranges = ['Div HQ'].concat(D.ranges.filter(r => r !== 'Div HQ')).concat(all.some(p => p.range === 'Range not matched') ? ['Range not matched'] : []);
    const n = r => all.filter(p => p.range === r).length;
    const by = CADRES.map(c => { const ps = here.filter(p => p.cadre === c.k); return { c, total: ps.length, done: ps.filter(p => isDone(p.status)).length }; });
    app.innerHTML = `${u.level === 'Division' && !u.isAdmin ? '' : `<div class="crumbs"><a href="#/">All divisions</a><span class="sep">/</span><span>${esc(D.circle)}</span><span class="sep">/</span><span>${esc(D.division)}</span></div>`}
      <div class="head"><div><h1 class="page-title">${esc(D.division)}</h1><p class="page-sub">${esc(D.circle)} circle · ${all.length} people in all cadres${u.isAdmin || u.level === 'Division' ? '' : ' · view only'}</p></div>
        <span class="sp"></span><button class="btn soft" id="dlBtn">↓ Download staff list</button></div>
      <div class="hr-ranges"><span class="faint">Range</span><div class="chips">
        <button class="chip ${H.range === 'all' ? 'on' : ''}" data-range="all">All<span class="n">${all.length}</span></button>
        ${ranges.map(r => `<button class="chip ${H.range === r ? 'on' : ''}" data-range="${esc(r)}">${esc(r)}<span class="n">${n(r)}</span></button>`).join('')}</div></div>
      <div class="tiles hr-cadres">${by.map(({ c, total, done }) => `<a class="tile${total ? '' : ' empty'}" href="${pageOf(c, D.own)}" data-open="${c.k}" style="text-decoration:none">
        <div class="ring" style="--p:${pct(done, total)}"><i>${pct(done, total)}%</i></div>
        <div class="t"><b>${esc(c.label)}</b><span class="num">${total} · ${done} ${c.k === 'FV' ? 'complete' : 'verified'}</span><br><span class="hr-open">Open ›</span></div></a>`).join('')}</div>
      <div class="toolbar hr-toolbar"><div class="chips"><button class="chip ${H.cadre === 'all' ? 'on' : ''}" data-cadre="all">All cadres<span class="n">${here.length}</span></button>
        ${by.filter(x => x.total).map(({ c, total }) => `<button class="chip ${H.cadre === c.k ? 'on' : ''}" data-cadre="${c.k}">${c.k}<span class="n">${total}</span></button>`).join('')}</div>
        <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" type="search" placeholder="Search name or place" value="${esc(H.q)}"></label></div>
      <div class="tablecard"><div class="tscroll"><table class="hr-table"><thead><tr><th>Name</th><th>Cadre</th><th>Range</th><th>Beat / place</th><th>Status</th></tr></thead><tbody>
        ${list.length ? list.map(p => { const st = STATUS[p.status] || [p.status, 'unverified']; return `<tr data-open="${p.cadre}" tabindex="0"><td><b>${esc(p.name)}</b>${p.desig && p.desig !== CAD[p.cadre].label && p.desig !== p.cadre ? `<div class="faint">${esc(p.desig)}</div>` : ''}</td>
          <td>${esc(p.cadre)}</td><td>${esc(p.range)}${p.range === 'Range not matched' || (p.rawRange && p.rawRange !== p.range && p.range !== 'Div HQ') ? `<div class="faint">${esc(p.rawRange)}</div>` : ''}</td>
          <td>${esc(p.place)}</td><td><span class="pill ${st[1]}">${esc(st[0])}</span></td></tr>`; }).join('') : '<tr><td colspan="5" class="faint" style="padding:22px">No one here with this filter.</td></tr>'}
      </tbody></table></div></div>`;
    $('#dlBtn').onclick = () => window.HR_DOWNLOAD.open(D);
    app.querySelectorAll('[data-range]').forEach(b => b.onclick = () => { H.range = b.dataset.range; drawHome(); });
    app.querySelectorAll('[data-cadre]').forEach(b => b.onclick = () => { H.cadre = b.dataset.cadre; drawHome(); });
    $('#q').oninput = e => { H.q = e.target.value; const at = e.target.selectionStart; drawHome(); const i = $('#q'); i.focus(); i.setSelectionRange(at, at); };
    app.querySelectorAll('[data-open]').forEach(el => {
      const open = e => { e.preventDefault(); openCadre(el.dataset.open); };
      el.onclick = open; el.onkeydown = e => { if (e.key === 'Enter') open(e); };
    });
  }
  /** Opens a cadre's page at this division, with the range chosen here (and the right tab on the CDL+BS page). */
  function openCadre(k) {
    const c = CAD[k], D = H.data;
    if (c.tab) try { localStorage.setItem(c.tab[0], c.tab[1]); } catch (e) {}
    if (H.range === 'all') API.setRange(null);
    else {
      // not FV: its list is saved as a whole, so it always shows the whole division
      const ids = { off: [], cdl: [] }, known = { off: [], cdl: [] };
      D.people.forEach(p => { if (!known[p.mod]) return; known[p.mod].push(p.id); if (p.range === H.range) ids[p.mod].push(p.id); });
      API.setRange({ division: D.division, range: H.range, divs: { off: D.own.off.division, cdl: D.own.cdl.division }, ids, known });
    }
    location.href = pageOf(c, D.own);
  }

  /* ---------------- picker and overview (admins, circle and state users) ---------------- */
  let OV = null;
  const loadOverview = async force => { if (!OV || force) OV = await guard(() => API.call('overview')); return OV; };
  const sumOf = (r, ks) => ks.reduce((a, k) => { const x = r.c[k]; if (x) { a.total += x.total; a.done += x.done; } return a; }, { total: 0, done: 0 });
  async function renderPicker(circle) {
    if (!OV) app.innerHTML = loader('Opening the divisions…', 'Counting every cadre…');
    const o = await loadOverview(), u = API.user;
    const circles = [...new Set(o.rows.map(r => r.circle))];
    if (circles.length === 1) circle = circles[0];
    const tile = (title, sub, s, href) => `<a class="tile${s.total ? '' : ' empty'}" href="${href}" style="text-decoration:none"><div class="ring" style="--p:${pct(s.done, s.total)}"><i>${pct(s.done, s.total)}%</i></div>
      <div class="t"><b>${esc(title)}</b><span>${esc(sub)}</span><br><span class="num">${s.total} people · ${s.done} verified</span></div></a>`;
    const ks = CADRES.map(c => c.k);
    if (!circle) {
      app.innerHTML = `<div class="head"><div><h1 class="page-title">Choose a circle.</h1><p class="page-sub">Then a division to see all its people, in every cadre.</p></div></div>
        ${u.isAdmin && o.pendingUsers ? `<div class="notice attn" style="margin:0 0 16px"><a href="#/users">${o.pendingUsers} account${o.pendingUsers > 1 ? 's' : ''} waiting for your approval ›</a></div>` : ''}
        <div class="tiles">${circles.map(c => { const rs = o.rows.filter(r => r.circle === c); const s = rs.reduce((a, r) => { const x = sumOf(r, ks); a.total += x.total; a.done += x.done; return a; }, { total: 0, done: 0 });
          return tile(c, rs.length + (rs.length === 1 ? ' division' : ' divisions'), s, '#/c/' + enc(c)); }).join('')}</div>`;
      return;
    }
    app.innerHTML = `${circles.length > 1 ? `<div class="crumbs"><a href="#/">All circles</a><span class="sep">/</span><span>${esc(circle)}</span></div>` : ''}
      <div class="head"><div><h1 class="page-title">${esc(circle)} circle.</h1><p class="page-sub">Choose a division.</p></div></div>
      <div class="tiles">${o.rows.filter(r => r.circle === circle).map(r => tile(r.division, 'Division', sumOf(r, ks), '#/d/' + enc(r.division))).join('')}</div>`;
  }
  /* ---------------- admin: approvals ---------------- */
  async function renderApprovals() {
    app.innerHTML = loader('Collecting what is waiting…', 'Asking every cadre…');
    const [ov, off, cdl] = await Promise.all([loadOverview(true), API.call('off.adminSummary').catch(() => null), API.call('cdl.pending').catch(() => null)]);
    const n = ks => cdl ? cdl.rows.filter(p => ks.includes(p.cadre)).length : '—';
    const box = (title, count, sub, href) => `<a class="tile" href="${href}" style="text-decoration:none"><div class="t"><b>${esc(title)}</b><span>${sub}</span><br><span class="num hr-big">${count}</span> <span class="faint">waiting</span></div></a>`;
    app.innerHTML = `<div class="head"><div><h1 class="page-title">Approvals.</h1><p class="page-sub">What is waiting for an admin, cadre by cadre. Each opens that cadre’s own approval screen.</p></div></div>
      <div class="tiles">
        ${box('User accounts', ov.pendingUsers, 'New accounts waiting for approval', '#/users')}
        ${box('FR, DR/Fr, FG', off ? off.pending : '—', 'Corrections and new officers sent by divisions', 'officers.html#/admin')}
        ${box('DL / CDL and Ban Sahayak', n(['CDL', 'BS']), 'New DLs / CDLs and removals', 'cdl.html#/approvals')}
        ${box('Aranya Sathi and DEO', n(['AS', 'DEO']), 'Removals', 'cdl.html?set=sathi#/approvals')}
        <a class="tile" href="fv.html#/admin" style="text-decoration:none"><div class="t"><b>Forest Volunteers</b><span>Saves go in directly; every change is in the change log.</span><br><span class="hr-open">Open the change log ›</span></div></a>
      </div>`;
  }

  /* ---------------- admin: users ---------------- */
  const U = { data: null, filter: 'Pending approval', level: '', q: '', show: {} };
  async function renderUsers(reload) {
    if (!U.data || reload) { app.innerHTML = loader('Reading the users…'); U.data = await guard(() => API.call('users')); }
    const rows = U.data.rows, q = U.q.toLowerCase();
    const count = s => rows.filter(r => !s || r.status === s).length;
    const list = rows.filter(r => (!U.filter || r.status === U.filter) && (!U.level || r.level === U.level) && (!q || (r.name + r.email + r.division + r.circle + r.phone).toLowerCase().includes(q)));
    const chip = (v, t) => `<button class="chip ${U.filter === v ? 'on' : ''}" data-f="${v}">${t}<span class="n">${count(v)}</span></button>`;
    const pill = s => `<span class="pill ${s === 'Active' ? 'verified' : s === 'Pending approval' ? 'pending' : 'unverified'}">${esc(s)}</span>`;
    const where = r => r.level === 'Division' ? `${esc(r.division)}<div class="faint">${esc(r.circle)}</div>` : r.level === 'Circle' ? `${esc(r.circle)} circle<div class="faint">view only</div>` : 'State<div class="faint">view only</div>';
    app.innerHTML = `<div class="head"><div><h1 class="page-title">Users.</h1><p class="page-sub">Every new account waits for your approval here.</p></div></div>
      <div class="toolbar"><div class="chips">${chip('Pending approval', 'Waiting')}${chip('Active', 'Active')}${chip('Disabled', 'Disabled')}${chip('Rejected', 'Rejected')}${chip('', 'Everyone')}</div>
        <select id="ul" class="hr-select"><option value="">All levels</option>${['Division', 'Circle', 'State'].map(l => `<option ${U.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="uq" type="search" placeholder="Search name, email, division" value="${esc(U.q)}"></label></div>
      <div class="tablecard"><div class="tscroll"><table class="hr-table"><thead><tr><th>Name</th><th>For</th><th>Email · Mobile</th><th>Status</th><th>Email verified</th><th>Password</th><th></th></tr></thead><tbody>
        ${list.length ? list.map(r => `<tr><td><b>${esc(r.name)}</b><div class="faint">${esc(r.desig)} · signed up ${esc(r.on)}</div></td><td>${where(r)}</td>
          <td>${esc(r.email)}<div class="faint">${esc(r.phone)}</div></td><td>${pill(r.status)}${r.approvedBy ? `<div class="faint">${esc(r.approvedBy)}, ${esc(r.approvedOn)}</div>` : ''}</td>
          <td>${r.verified === 'Yes' ? '<span class="pill verified">Yes</span>' : `<span class="pill unverified">No</span> <button class="btn sm ghost" data-a="verify" data-e="${esc(r.email)}">Send email</button>`}</td>
          <td>${r.password ? (U.show[r.email] ? `<code>${esc(r.password)}</code>` : `<button class="btn sm ghost" data-a="show" data-e="${esc(r.email)}">Show</button>`) : '<span class="faint">set at next sign-in</span>'}</td>
          <td><div class="hr-acts">${r.status === 'Pending approval' ? `<button class="btn sm good" data-a="approve" data-e="${esc(r.email)}">Approve</button><button class="btn sm" data-a="reject" data-e="${esc(r.email)}">Reject</button>`
            : r.status === 'Active' ? `<button class="btn sm" data-a="disable" data-e="${esc(r.email)}">Disable</button>` : `<button class="btn sm" data-a="enable" data-e="${esc(r.email)}">Enable</button>`}
            <button class="btn sm ghost" data-a="pass" data-e="${esc(r.email)}">Set password</button></div></td></tr>`).join('') : '<tr><td colspan="7" class="faint" style="padding:22px">No one here.</td></tr>'}
      </tbody></table></div></div>
      <div class="tablecard" style="margin-top:18px;padding:14px 16px"><b>Admin accounts</b> <span class="faint">(in Config.local.gs in Apps Script)</span>
        <div class="faint" style="margin-top:6px">${U.data.accounts.map(a => `${esc(a.username)} · ${esc(a.name)} · last sign-in ${esc(a.last || 'not yet')}`).join('<br>')}</div></div>`;
    app.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { U.filter = b.dataset.f; renderUsers(); });
    $('#ul').onchange = e => { U.level = e.target.value; renderUsers(); };
    $('#uq').oninput = e => { U.q = e.target.value; const at = e.target.selectionStart; renderUsers(); const i = $('#uq'); i.focus(); i.setSelectionRange(at, at); };
    app.querySelectorAll('[data-a]').forEach(b => b.onclick = () => userAct(b.dataset.a, b.dataset.e, b));
  }
  async function userAct(a, email, btn) {
    if (a === 'show') { U.show[email] = 1; renderUsers(); return; }
    let body = { email }, action = { approve: 'userDecide', reject: 'userDecide', disable: 'userStatus', enable: 'userStatus', pass: 'userPassword', verify: 'sendVerify' }[a];
    if (a === 'approve' || a === 'reject') body.approve = a === 'approve';
    if (a === 'disable' || a === 'enable') body.active = a === 'enable';
    if (a === 'pass') { const pw = prompt('New password for ' + email + ' (8+ characters):'); if (!pw) return; body.password = pw; }
    if (a === 'reject' && !confirm('Reject the account of ' + email + '?')) return;
    btn.disabled = true;
    try {
      const r = await API.call(action, body);
      if (r && r.rows) U.data = r;
      toast({ approve: 'Approved. They have been told by email.', reject: 'Rejected', disable: 'Disabled; they are signed out', enable: 'Enabled', pass: 'Password set', verify: 'Verification email sent' }[a]);
      renderUsers();
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  }

  /* ---------------- admin: ranges ---------------- */
  async function renderRanges(division) {
    if (!division) {
      app.innerHTML = loader('Opening the divisions…');
      const d = await guard(() => API.call('ranges'));
      const by = {}; d.divisions.forEach(x => (by[x.circle] = by[x.circle] || []).push(x.division));
      app.innerHTML = `<div class="head"><div><h1 class="page-title">Ranges.</h1><p class="page-sub">Each cadre writes its range in its own way. Here every spelling is joined to one range, so the range filter works across cadres. The cadre sheets are not changed.</p></div></div>
        ${Object.keys(by).map(c => `<h3 style="margin:18px 0 8px">${esc(c)}</h3><div class="chips">${by[c].map(x => `<a class="chip" href="#/ranges/${enc(x)}" style="display:inline-flex;align-items:center;text-decoration:none">${esc(x)}</a>`).join('')}</div>`).join('')}`;
      return;
    }
    app.innerHTML = loader(`Reading the ranges of ${division}…`, 'Matching every cadre’s spelling…');
    drawRanges(await guard(() => API.call('ranges', { division })));
  }
  function drawRanges(d) {
    app.innerHTML = `<div class="crumbs"><a href="#/ranges">All divisions</a><span class="sep">/</span><span>${esc(d.division)}</span></div>
      <div class="head"><div><h1 class="page-title">${esc(d.division)}: ranges.</h1><p class="page-sub">${d.ranges.length} ranges. Join each spelling that did not match to its range, or make it a new range.</p></div></div>
      <div class="chips" style="margin-bottom:18px">${d.ranges.map(r => `<span class="chip" style="display:inline-flex;align-items:center;cursor:default">${esc(r)}</span>`).join('') || '<span class="faint">No ranges yet.</span>'}</div>
      <div class="tablecard"><div class="tscroll"><table class="hr-table"><thead><tr><th>Spelling that did not match</th><th class="num">People</th><th>Join it to</th><th></th></tr></thead><tbody>
        ${d.unmatched.length ? d.unmatched.map((x, i) => `<tr><td><b>${esc(x.value)}</b></td><td class="num">${x.count}</td>
          <td><select class="hr-select" id="r${i}">${d.ranges.map(r => `<option>${esc(r)}</option>`).join('')}<option value="__new">A new range: “${esc(x.value)}”</option></select></td>
          <td><button class="btn sm soft" data-i="${i}">Save</button></td></tr>`).join('') : '<tr><td colspan="4" class="faint" style="padding:22px">Every range in this division is matched.</td></tr>'}
      </tbody></table></div></div>`;
    app.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
      const x = d.unmatched[+b.dataset.i], sel = $('#r' + b.dataset.i).value;
      b.disabled = true;
      try { drawRanges(await API.call('rangeAlias', { division: d.division, range: sel === '__new' ? x.value : sel, value: x.value })); H.data = null; toast('Saved'); }
      catch (e) { toast(e.message, true); b.disabled = false; }
    });
  }

  /* ---------------- admin: settings ---------------- */
  async function renderSettings() {
    app.innerHTML = loader('Reading the settings…');
    const s = (await guard(() => API.call('settings'))).settings, on = /^yes$/i.test(s['Email code at sign-up']);
    app.innerHTML = `<div class="head"><div><h1 class="page-title">Settings.</h1></div></div>
      <div class="tablecard" style="padding:18px 20px"><b>Email code at sign-up</b>
        <p class="faint" style="margin:4px 0 12px">On: a 6-digit code is emailed and must be entered before the account is made. Off: the account is made at once; you can send anyone a verification email from the Users page.</p>
        <div class="seg hr-seg"><button data-v="Yes" class="${on ? 'on' : ''}">On</button><button data-v="No" class="${on ? '' : 'on'}">Off</button></div></div>`;
    app.querySelectorAll('[data-v]').forEach(b => b.onclick = async () => {
      try { await API.call('setSetting', { key: 'Email code at sign-up', value: b.dataset.v }); toast('Saved'); renderSettings(); } catch (e) { toast(e.message, true); }
    });
  }

  /* ---------------- router ---------------- */
  function start() { renderWho(); if (!location.hash || location.hash === '#/' || location.hash === '#/signup') { history.replaceState(null, '', '#/'); } route(); }
  async function route() {
    renderWho();
    const parts = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').map(decodeURIComponent), u = API.user;
    try {
      if (!u) {
        if (parts[0] === 'signup') await renderSignup(); else if (parts[0] === 'forgot') renderForgot(); else renderSignin();
        return;
      }
      if (parts[0] === 'd' && parts[1]) await renderHome(parts[1]);
      else if (parts[0] === 'c' && parts[1]) await renderPicker(parts[1]);
      else if ((parts[0] === 'dash' || parts[0] === 'admin') && (u.isAdmin || u.level !== 'Division')) await window.HR_DASH.render(app);
      else if (u.isAdmin && parts[0] === 'approvals') await renderApprovals();
      else if (u.isAdmin && parts[0] === 'users') await renderUsers(true);
      else if (u.isAdmin && parts[0] === 'ranges') await renderRanges(parts[1]);
      else if (u.isAdmin && parts[0] === 'settings') await renderSettings();
      else await renderHome('');
    } catch (e) { /* toast already shown */ }
    window.scrollTo(0, 0);
  }
  window.HR_SHELL = { esc, loader, guard, CAD, pageOf };   // for the dashboard (dash.js)
  window.addEventListener('hashchange', route);
  route();
})();
