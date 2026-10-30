// Forest Volunteers — admin dashboard: filters, clickable charts, the volunteer list, division progress, the change log, and reports (PDF and Excel).
(function () {
  const A = () => window.FV_APP, API = window.FV_API;
  const $ = s => document.querySelector(s);
  const esc = s => A().esc(s);
  const n = x => Number(x || 0).toLocaleString('en-IN');
  const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;
  const p2 = x => String(x).padStart(2, '0');
  const DAY = 864e5;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /** "dd-mm-yyyy" or "dd-mm-yyyy hh:mm:ss" → Date (null when it cannot be read) */
  const when = s => { const m = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(s || ''); return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) : null; };
  const dstr = d => `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()}`;
  const day0 = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const stamp = () => { const d = new Date(); return `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const plain = s => String(s || '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const ico = p => `<svg viewBox="0 0 24 24">${p}</svg>`;
  const IC = {
    pdf: ico('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
    xls: ico('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
    copy: ico('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
    prog: ico('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    flag: ico('<path d="M5 21V4h11l-2 4 2 4H5"/>'),
    list: ico('<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
    sum: ico('<path d="M18 4H6l6 8-6 8h12"/>'),
    log: ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),
  };

  const AGES = [['Under 25', 0, 25], ['25–29', 25, 30], ['30–34', 30, 35], ['35–39', 35, 40], ['40–49', 40, 50], ['50 and above', 50, 200]];
  const SUBS = ['Range HQ', 'Beat', 'Camp'];
  const PLACES = ['Div HQ', 'Range HQ', 'Beat', 'Camp', 'Range (not specified)', 'Not given'];
  const PLACE_COL = { 'Div HQ': '#2f6fdb', 'Range HQ': '#1f8a70', 'Beat': '#2f9e44', 'Camp': '#7c4ddb', 'Range (not specified)': '#d9731a', 'Not given': '#d6d4cf' };
  const MISS = ['Name', 'Date of birth', 'Qualification', 'Dept. approval ref', 'Directorate ref', 'Appointment order', 'Date of joining', 'Place of posting',
    'Range name', 'Range HQ / Beat / Camp', 'Name of the beat', 'Name of the camp', 'Nature of works', 'Work details'];
  const SHORT = { 'Cleaning/Sweeping/Maintenance': 'Cleaning', 'Nursery Operations': 'Nursery', 'Timber Depot': 'Timber depot', 'Mali/Gardener': 'Mali',
    'Forest Protection and Patrolling': 'Protection', 'Human-Animal Conflict Management': 'Man-animal conflict', 'Night Guard/Security': 'Night guard',
    'Below Class VIII': 'Below VIII', 'Class VIII': 'VIII', 'Madhyamik (Class X)': 'X', 'Higher Secondary (Class XII)': 'XII', 'ITI / Diploma': 'ITI / Dip.', 'Graduate': 'Graduate', 'Post Graduate': 'PG' };
  // labels that fit a chart row (the full name shows on hover)
  const CHART = { 'Cleaning/Sweeping/Maintenance': 'Cleaning / maintenance', 'Nursery Operations': 'Nursery', 'Mali/Gardener': 'Mali / gardener',
    'Forest Protection and Patrolling': 'Protection & patrolling', 'Human-Animal Conflict Management': 'Man-animal conflict', 'Night Guard/Security': 'Night guard / security',
    'Madhyamik (Class X)': 'Madhyamik (X)', 'Higher Secondary (Class XII)': 'Higher Sec. (XII)' };
  const TABS = [['overview', 'Overview'], ['volunteers', 'Volunteers'], ['divisions', 'Divisions'], ['log', 'Change log'], ['reports', 'Reports']];
  const SELS = [['circle', 'Circle'], ['division', 'Division'], ['status', 'Details'], ['place', 'Place of posting'], ['duty', 'Nature of works'], ['qual', 'Qualification'], ['age', 'Age'], ['miss', 'Missing detail']];
  const EMPTY = { q: '', circle: '', division: '', status: '', place: '', duty: '', qual: '', age: '', joined: '', miss: '' };
  const D = {
    f: Object.assign({}, EMPTY), tab: 'overview', at: 0, rows: [], log: [], logTotal: 0, sheetUrl: '', meta: null,
    by: 'circle', dsort: 'low', sort: { k: 'circle', dir: 1 }, shown: 100,
    dv: { show: 'all', sort: 'circle' }, L: { act: 'all', days: '', who: '', q: '', day: '' }, rp: { only: false, days: '30' },
  };

  /* ---------------- data ---------------- */
  function derive(r) {
    const v = A().fromServer(Object.assign({}, r)), miss = A().missingOfSaved(r), dob = when(r.dob), doj = when(r.doj);
    const age = dob ? Math.floor((Date.now() - dob) / (365.2425 * DAY)) : null;
    const place = v.placeType === 'Div HQ' ? 'Div HQ' : v.placeType === 'Range' ? (SUBS.includes(v.subType) ? v.subType : 'Range (not specified)') : 'Not given';
    return { r, v, miss, done: !miss.length, age, ageBand: age == null ? 'Not given' : (AGES.find(b => age >= b[1] && age < b[2]) || AGES[0])[0],
      doj, jk: doj ? doj.getFullYear() + '-' + p2(doj.getMonth() + 1) : '', place, duty: v.duty || 'Not given', qual: r.qual || 'Not given',
      text: [r.name, r.circle, r.division, r.qual, r.deptRef, r.dirRef, r.apptRef, r.placeName, r.placeSub, r.works, r.id, r.updBy].join(' ').toLowerCase() };
  }
  const order = () => { const c = {}, d = {}; D.meta.circles.forEach((x, i) => { c[x.circle] = i; x.divisions.forEach((y, j) => d[x.circle + '|' + y] = j); }); return { c, d }; };
  /** volunteers matching every filter except `skip` (a chart shows its own spread under the other filters) */
  function view(skip) {
    const f = D.f, q = f.q.trim().toLowerCase(), sk = k => skip === k || (skip === 'circle' && k === 'division');
    return D.rows.filter(x => (sk('circle') || !f.circle || x.r.circle === f.circle) && (sk('division') || !f.division || x.r.division === f.division)
      && (sk('status') || !f.status || (f.status === 'done') === x.done) && (sk('place') || !f.place || x.place === f.place)
      && (sk('duty') || !f.duty || x.duty === f.duty) && (sk('qual') || !f.qual || x.qual === f.qual) && (sk('age') || !f.age || x.ageBand === f.age)
      && (sk('joined') || !f.joined || x.jk.startsWith(f.joined)) && (sk('miss') || !f.miss || x.miss.includes(f.miss)) && (sk('q') || !q || x.text.includes(q)));
  }
  /** the divisions in the circle / division chosen (all when none) */
  const scopeDivs = () => [].concat(...D.meta.circles.filter(c => !D.f.circle || c.circle === D.f.circle)
    .map(c => c.divisions.filter(d => !D.f.division || d === D.f.division).map(d => ({ c: c.circle, d }))));
  const logScope = () => D.log.filter(l => (!D.f.circle || l.circle === D.f.circle) && (!D.f.division || l.division === D.f.division));
  const hasF = () => Object.keys(EMPTY).some(k => D.f[k]);
  const tally = (list, fn) => { const c = {}; list.forEach(x => [].concat(fn(x)).forEach(k => c[k] = (c[k] || 0) + 1)); return c; };
  // the values of a filter in their natural order, then anything else that turns up
  const withRest = (base, c) => base.concat(Object.keys(c).filter(k => !base.includes(k) && k !== 'Not given').sort(), c['Not given'] && !base.includes('Not given') ? ['Not given'] : []);
  const LISTS = {
    place: c => withRest(PLACES, c), duty: c => withRest(A().DUTIES, c), qual: c => withRest(A().QUALS, c),
    age: c => withRest(AGES.map(a => a[0]), c), miss: c => withRest(MISS, c),
  };
  const joinedLabel = k => k.length === 7 ? `${MON[+k.slice(5) - 1]} ${k.slice(0, 4)}` : k;
  function filterLabels() {
    const f = D.f, out = [];
    if (f.q) out.push(['q', `Search: “${f.q}”`]);
    if (f.circle) out.push(['circle', `Circle: ${f.circle}`]);
    if (f.division) out.push(['division', `Division: ${f.division}`]);
    if (f.status) out.push(['status', f.status === 'done' ? 'Added (all details)' : 'Details missing']);
    if (f.place) out.push(['place', `Posted at: ${f.place}`]);
    if (f.duty) out.push(['duty', `Works: ${f.duty}`]);
    if (f.qual) out.push(['qual', `Qualification: ${f.qual}`]);
    if (f.age) out.push(['age', `Age: ${f.age}`]);
    if (f.joined) out.push(['joined', `Joined: ${joinedLabel(f.joined)}`]);
    if (f.miss) out.push(['miss', `Missing: ${f.miss}`]);
    return out;
  }
  const covers = () => filterLabels().map(x => x[1]).join(' · ') || 'All circles and divisions';

  /* ---------------- page ---------------- */
  async function render(app) {
    const t = (location.hash.split('/')[2] || '').split('?')[0];
    D.tab = TABS.some(x => x[0] === t) ? t : 'overview';
    app.innerHTML = `<div class="dash">
      <div class="head"><div><h1 class="page-title">Dashboard.</h1><p class="page-sub" id="asof">Collecting all divisions…</p></div><span class="sp"></span>
        <div class="dash-actions"><button class="btn sm" id="dRefresh" title="Read the Google Sheet again">↻ Refresh</button>
          <a class="btn sm soft hidden" id="dSheet" target="_blank" rel="noopener">${A().icon.sheet} Google Sheet</a></div></div>
      <div id="dwrap">${A().loading('Collecting all divisions…')}</div></div>`;
    $('#dRefresh').onclick = () => load(true).catch(() => {});
    await load(false);
  }
  async function load(force) {
    if (force || !D.meta || Date.now() - D.at > 120000) {
      if (force) $('#dwrap').innerHTML = A().loading('Reading the Google Sheet again…');
      const [m, d] = await Promise.all([A().meta(true), A().guard(() => API.call('admin'))]);
      D.meta = m; D.rows = d.rows.map(derive); D.log = d.log || []; D.logTotal = d.logTotal || D.log.length; D.sheetUrl = d.sheetUrl || ''; D.at = Date.now();
      if (force) A().toast('Dashboard refreshed.');
    }
    if (!$('#dwrap')) return;
    const started = new Set(D.rows.map(x => x.r.circle + '|' + x.r.division)).size;
    $('#asof').textContent = `As of ${stamp()} · ${n(D.rows.length)} volunteers from ${n(started)} divisions · click any card, bar or slice to filter.`;
    const sh = $('#dSheet'); if (D.sheetUrl) { sh.href = D.sheetUrl; sh.classList.remove('hidden'); }
    $('#dwrap').innerHTML = `<div class="kpis dk" id="kpis"></div><div class="dtabs" id="dtabs" role="tablist"></div>
      <div class="fbar" id="fbar"></div><div id="dbody"></div>`;
    drawFbar(); wire(); drawAll();
  }
  function setTab(t) {
    D.tab = t; history.replaceState(null, '', '#/admin' + (t === 'overview' ? '' : '/' + t));
    drawTabs(); drawBody();
  }
  function setF(patch) { Object.assign(D.f, patch); D.shown = 100; drawAll(); }
  function drawAll() { fillSelects(); chips(); kpis(); drawTabs(); drawBody(); }
  function drawTabs() {
    const cnt = { volunteers: view().length, divisions: scopeDivs().length, log: logScope().length };
    $('#dtabs').innerHTML = TABS.map(([k, l]) => `<button role="tab" aria-selected="${D.tab === k}" class="${D.tab === k ? 'on' : ''}" data-tab="${k}">${l}${cnt[k] != null ? `<span class="ct num">${n(cnt[k])}</span>` : ''}</button>`).join('');
    $('#fbar').classList.toggle('hidden', D.tab === 'log');
  }
  function drawBody() {
    const b = $('#dbody');
    if (D.tab === 'volunteers') b.innerHTML = volunteersHtml();
    else if (D.tab === 'divisions') b.innerHTML = divisionsHtml();
    else if (D.tab === 'log') { b.innerHTML = logHtml(); logTable(); }
    else if (D.tab === 'reports') b.innerHTML = reportsHtml();
    else b.innerHTML = overviewHtml();
  }

  /* ---------------- filter bar ---------------- */
  function drawFbar() {
    $('#fbar').innerHTML = `<div class="frow">
        <label class="fs grow">Search<input id="fq" type="search" placeholder="Name, reference, range, beat, work…" value="${esc(D.f.q)}" autocomplete="off"></label>
        ${SELS.map(([k, l]) => `<label class="fs">${l}<select data-k="${k}"></select></label>`).join('')}</div>
      <div class="chips-row" id="chips"></div>`;
  }
  function fillSelects() {
    const f = D.f, opt = (v, l, c, on) => `<option value="${esc(v)}"${on ? ' selected' : ''}>${esc(l)}${c != null ? ` (${n(c)})` : ''}</option>`;
    $('#fbar').querySelectorAll('select').forEach(s => {
      const k = s.dataset.k; let h;
      if (k === 'circle') { const c = tally(view('circle'), x => x.r.circle); h = opt('', 'All circles') + D.meta.circles.map(x => opt(x.circle, x.circle, c[x.circle] || 0, f.circle === x.circle)).join(''); }
      else if (k === 'division') {
        const c = tally(view('division'), x => x.r.circle + '|' + x.r.division);
        h = opt('', 'All divisions') + D.meta.circles.filter(x => !f.circle || x.circle === f.circle).map(x => `<optgroup label="${esc(x.circle)}">${x.divisions
          .map(d => opt(x.circle + '|' + d, d, c[x.circle + '|' + d] || 0, f.circle === x.circle && f.division === d)).join('')}</optgroup>`).join('');
      } else if (k === 'status') { const c = tally(view('status'), x => x.done ? 'done' : 'missing'); h = opt('', 'All') + opt('done', 'Added (all details)', c.done || 0, f.status === 'done') + opt('missing', 'Details missing', c.missing || 0, f.status === 'missing'); }
      else { const c = tally(view(k), x => k === 'miss' ? x.miss : x[k === 'age' ? 'ageBand' : k]); h = opt('', 'All') + LISTS[k](c).filter(v => c[v] || f[k] === v).map(v => opt(v, v, c[v] || 0, f[k] === v)).join(''); }
      s.innerHTML = h;
    });
  }
  function chips() {
    const l = filterLabels();
    $('#chips').innerHTML = `<span class="count"><b class="num">${n(view().length)}</b> of ${n(D.rows.length)} volunteers</span>
      ${l.map(([k, t]) => `<button class="fchip" data-clear="${k}">${esc(t)} <span aria-hidden="true">×</span></button>`).join('')}
      ${l.length ? '<button class="btn sm ghost" id="clearF">Clear all</button>' : '<span class="faint">No filters. Choose above, or click a card, bar or slice.</span>'}`;
  }

  /* ---------------- events (one set for the whole page; the parts inside are redrawn) ---------------- */
  function wire() {
    const w = $('#dwrap');
    w.addEventListener('click', e => {
      const t = e.target, at = s => t.closest(s);
      let el;
      if ((el = at('[data-kpi]'))) return kpiClick(el.dataset.kpi);
      if ((el = at('[data-tab]'))) return setTab(el.dataset.tab);
      if ((el = at('[data-clear]'))) { const k = el.dataset.clear; return setF(k === 'circle' ? { circle: '', division: '' } : { [k]: '' }); }
      if (at('#clearF')) { D.f = Object.assign({}, EMPTY); $('#fq').value = ''; return drawAll(); }
      if ((el = at('[data-f]'))) {
        const k = el.dataset.f, v = el.dataset.v;
        return setF(k === 'circle' ? (D.f.circle === v && !D.f.division ? { circle: '', division: '' } : { circle: v, division: '' }) : { [k]: D.f[k] === v ? '' : v });
      }
      if ((el = at('[data-dv]'))) { const [c, d] = el.dataset.dv.split('|'); return setF(D.f.division === d && D.f.circle === c ? { division: '' } : { circle: c, division: d }); }
      if ((el = at('[data-day]'))) { Object.assign(D.L, { day: el.dataset.day, days: '' }); return setTab('log'); }
      if ((el = at('[data-by]'))) { D.by = el.dataset.by; return drawBody(); }
      if ((el = at('[data-show]'))) { D.dv.show = el.dataset.show; return drawBody(); }
      if ((el = at('[data-act]'))) { D.L.act = el.dataset.act; w.querySelectorAll('[data-act]').forEach(b => b.classList.toggle('on', b === el)); return logTable(); }
      if ((el = at('[data-days]'))) { Object.assign(D.L, { days: el.dataset.days, day: '' }); return drawBody(); }
      if (at('#dayX')) { D.L.day = ''; return drawBody(); }
      if ((el = at('th[data-s]'))) { const k = el.dataset.s; D.sort = { k, dir: D.sort.k === k ? -D.sort.dir : 1 }; return drawBody(); }
      if (at('#vMore')) { D.shown += 200; return drawBody(); }
      if ((el = at('[data-rep]'))) return runReport(el.dataset.rep, el.dataset.out, el);
      if ((el = at('[data-goto]'))) { D.dv.show = el.dataset.goto; return setTab('divisions'); }
      if ((el = at('tr[data-go]'))) return A().go(el.dataset.go);
    });
    w.addEventListener('keydown', e => { const tr = e.target.closest('tr[data-go]'); if (tr && e.key === 'Enter') A().go(tr.dataset.go); });
    w.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('#fbar select')) {
        const k = t.dataset.k, v = t.value;
        if (k === 'division') { if (!v) return setF({ division: '' }); const [c, d] = v.split('|'); return setF({ circle: c, division: d }); }
        return setF(k === 'circle' ? { circle: v, division: '' } : { [k]: v });
      }
      if (t.id === 'dsort') { D.dsort = t.value; return drawBody(); }
      if (t.id === 'dvSort') { D.dv.sort = t.value; return drawBody(); }
      if (t.id === 'logCircle') { D.f.circle = t.value; D.f.division = ''; D.L.who = ''; return drawAll(); }
      if (t.id === 'logWho') { D.L.who = t.value; return logTable(); }
      if (t.id === 'rpOnly') { D.rp.only = t.checked; return; }
      if (t.id === 'rpDays') { D.rp.days = t.value; return; }
    });
    w.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'fq') { D.f.q = t.value; D.shown = 100; clearTimeout(D.qt); D.qt = setTimeout(drawAll, 180); }
      if (t.id === 'logQ') { D.L.q = t.value; clearTimeout(D.qt); D.qt = setTimeout(logTable, 180); }
    });
  }
  function kpiClick(k) {
    const f = D.f;
    if (k === 'all') { D.f = Object.assign({}, EMPTY); $('#fq').value = ''; return drawAll(); }
    if (k === 'done' || k === 'missing') return setF({ status: f.status === k ? '' : k });
    if (k === 'divs' || k === 'notstarted') { D.dv.show = k === 'divs' ? 'all' : 'notstarted'; return setTab('divisions'); }
    if (k === 'log') { Object.assign(D.L, { days: '7', day: '' }); return setTab('log'); }
    if (k === 'age' || k === 'field') {
      if (D.tab !== 'overview') setTab('overview');
      const el = $(k === 'age' ? '#chAge' : '#chPlace'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); }
    }
  }

  /* ---------------- KPI cards ---------------- */
  function kpis() {
    const v = view(), f = D.f, done = v.filter(x => x.done).length, miss = v.length - done;
    const divs = scopeDivs(), has = new Set(D.rows.map(x => x.r.circle + '|' + x.r.division)), started = divs.filter(d => has.has(d.c + '|' + d.d)).length;
    const ages = v.filter(x => x.age != null), avg = ages.length ? ages.reduce((a, x) => a + x.age, 0) / ages.length : null;
    const field = v.filter(x => x.place === 'Beat' || x.place === 'Camp').length;
    const wk = day0(Date.now() - 6 * DAY), ch = logScope().filter(l => (when(l.on) || 0) >= wk).length;
    const T = [
      ['all', 'Volunteers entered', n(v.length), v.length === D.rows.length ? 'every saved entry' : `of ${n(D.rows.length)} in all`, 'muted', 100, !hasF()],
      ['done', 'Added', n(done), `${pct(done, v.length)}% have all details`, 'good', pct(done, v.length), f.status === 'done'],
      ['missing', 'Details missing', n(miss), 'saved, not complete', 'warn', pct(miss, v.length), f.status === 'missing'],
      ['divs', 'Divisions reporting', `${n(started)}<small class="of"> / ${n(divs.length)}</small>`, `${pct(started, divs.length)}% have started`, 'blue', pct(started, divs.length)],
      ['notstarted', 'Not started', n(divs.length - started), 'divisions with no entry', divs.length - started ? 'hot' : 'muted', pct(divs.length - started, divs.length)],
      ['age', 'Average age', avg == null ? '—' : avg.toFixed(1), `${n(ages.length)} with date of birth`, 'violet', null],
      ['field', 'In beats & camps', n(field), `${pct(field, v.length)}% of these volunteers`, 'good', pct(field, v.length)],
      ['log', 'Changes this week', n(ch), 'last 7 days, change log', 'blue', null],
    ];
    $('#kpis').innerHTML = T.map(([k, l, b, s, cls, bar, on]) => `<button class="kpi dkpi ${cls}${on ? ' on' : ''}" data-kpi="${k}"><span>${l}</span><b class="num">${b}</b><small>${s}</small>${bar != null ? `<i class="kbar"><em style="width:${bar}%"></em></i>` : ''}</button>`).join('');
  }

  /* ---------------- overview charts ---------------- */
  const hbars = (items, key, cls) => {
    const max = Math.max(1, ...items.map(x => x.n));
    return items.map(x => `<button class="hrow w${D.f[key] === x.k ? ' on' : ''}" data-f="${key}" data-v="${esc(x.k)}" title="${esc(x.k)}: ${n(x.n)}">
      <span class="hl">${esc(x.label || x.k)}</span><span class="hb"><span class="stack" style="width:${x.n ? Math.max(3, x.n * 100 / max) : 0}%"><i class="${cls || 'sb'}" style="flex:1"></i></span></span>
      <span class="hn num">${n(x.n)}${x.sub ? `<small> · ${x.sub}</small>` : ''}</span></button>`).join('') || '<p class="faint">Nothing in this view.</p>';
  };
  const colsChart = (items, key, dense) => {
    const max = Math.max(1, ...items.map(x => x.n));
    return `<div class="cols${dense ? ' dense' : ''}">${items.map(x => `<button class="col${x.cls ? ' ' + x.cls : ''}${key && D.f[key] === x.k ? ' on' : ''}" ${key ? `data-f="${key}" data-v="${esc(x.k)}"` : x.day ? `data-day="${x.day}"` : ''} title="${esc(x.title || x.label)}: ${n(x.n)}">
      <span class="cn num">${x.n || (dense ? '' : 0)}</span><span class="cb"><i style="height:${x.n ? Math.max(3, x.n * 100 / max) : 0}%"></i></span><span class="cl">${esc(x.label)}</span></button>`).join('')}</div>`;
  };
  function overviewHtml() {
    const f = D.f, o = order();
    if (!D.rows.length) return '<div class="empty-state"><b>No volunteers yet.</b>The charts appear once divisions start saving.</div>';
    // 1. progress by circle or division: added (green) and details missing (orange)
    const vc = view('circle');
    let prog;
    if (D.by === 'circle') {
      const by = {}; vc.forEach(x => { const c = by[x.r.circle] = by[x.r.circle] || { t: 0, d: 0, divs: new Set() }; c.t++; if (x.done) c.d++; c.divs.add(x.r.division); });
      const max = Math.max(1, ...Object.values(by).map(c => c.t));
      prog = D.meta.circles.map(c => { const x = by[c.circle] || { t: 0, d: 0, divs: new Set() };
        return `<button class="hrow w${f.circle === c.circle && !f.division ? ' on' : ''}" data-f="circle" data-v="${esc(c.circle)}" title="${esc(c.circle)}: ${x.d} added, ${x.t - x.d} with details missing">
          <span class="hl"><b>${esc(c.circle)}</b><small>${x.divs.size} of ${c.divisions.length} divisions</small></span>
          <span class="hb"><span class="stack" style="width:${x.t ? Math.max(3, x.t * 100 / max) : 0}%"><i class="sv" style="flex:${x.d}"></i><i class="sx" style="flex:${x.t - x.d}"></i></span></span>
          <span class="hn num">${x.t ? `${n(x.t)}<small> · ${pct(x.d, x.t)}% added</small>` : '<span class="ns">Not started</span>'}</span></button>`; }).join('');
    } else {
      const by = {}; vc.forEach(x => { const k = x.r.circle + '|' + x.r.division, c = by[k] = by[k] || { t: 0, d: 0 }; c.t++; if (x.done) c.d++; });
      const list = [].concat(...D.meta.circles.filter(c => !f.circle || c.circle === f.circle)
        .map(c => c.divisions.map(d => { const s = by[c.circle + '|' + d] || { t: 0, d: 0 }; return { c: c.circle, dv: d, t: s.t, dn: s.d }; })));
      const tie = (a, b) => o.c[a.c] - o.c[b.c] || (o.d[a.c + '|' + a.dv] - o.d[b.c + '|' + b.dv]);
      list.sort(D.dsort === 'size' ? (a, b) => b.t - a.t || tie(a, b) : D.dsort === 'miss' ? (a, b) => (b.t - b.dn) - (a.t - a.dn) || tie(a, b)
        : D.dsort === 'order' ? tie : (a, b) => (a.t ? a.dn / a.t : -1) - (b.t ? b.dn / b.t : -1) || b.t - a.t || tie(a, b));
      const max = Math.max(1, ...list.map(x => x.t));
      prog = `<select class="dsort" id="dsort" aria-label="Sort divisions">${[['low', 'Least added first (not started on top)'], ['miss', 'Most details missing'], ['size', 'Most volunteers'], ['order', 'Circle order']]
        .map(([k, l]) => `<option value="${k}"${D.dsort === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <div class="dvlist">${list.map(x => `<button class="hrow w${f.division === x.dv && f.circle === x.c ? ' on' : ''}" data-dv="${esc(x.c + '|' + x.dv)}" title="${esc(x.dv)}, ${esc(x.c)}: ${x.dn} added, ${x.t - x.dn} with details missing">
          <span class="hl"><b>${esc(x.dv)}</b><small>${esc(x.c)}</small></span>
          <span class="hb"><span class="stack" style="width:${x.t ? Math.max(3, x.t * 100 / max) : 0}%"><i class="sv" style="flex:${x.dn}"></i><i class="sx" style="flex:${x.t - x.dn}"></i></span></span>
          <span class="hn num">${x.t ? `${n(x.t)}<small> · ${pct(x.dn, x.t)}%</small>` : '<span class="ns">Not started</span>'}</span></button>`).join('')}</div>
        <p class="foot">${list.length} divisions${f.circle ? ' in ' + esc(f.circle) : ''} · ${list.filter(x => !x.t).length} not started</p>`;
    }
    const byToggle = `<span class="seg" role="group" aria-label="Show by">${[['circle', 'Circle'], ['division', 'Division']].map(([k, l]) => `<button class="${D.by === k ? 'on' : ''}" data-by="${k}" aria-pressed="${D.by === k}">${l}</button>`).join('')}</span>`;

    // 2. place of posting (donut)
    const vp = view('place'), pc = tally(vp, x => x.place), pl = LISTS.place(pc).filter(k => pc[k]), tot = Math.max(1, vp.length), R = 42, CIR = 2 * Math.PI * R;
    let off = 0;
    const segs = pl.map(k => { const len = pc[k] / tot * CIR, s = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${PLACE_COL[k] || '#9d9b96'}" stroke-width="16" stroke-dasharray="${len} ${CIR - len}" stroke-dashoffset="${-off}" class="dseg${f.place === k ? ' on' : ''}" data-f="place" data-v="${esc(k)}"><title>${esc(k)}: ${pc[k]}</title></circle>`; off += len; return s; }).join('');
    const field = (pc.Beat || 0) + (pc.Camp || 0);
    const donut = `<div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="Place of posting"><g transform="rotate(-90 60 60)">${segs}</g>
        <text x="60" y="57" text-anchor="middle" class="dbig">${pct(field, vp.length)}%</text><text x="60" y="73" text-anchor="middle" class="dsm">beats & camps</text></svg>
      <div class="dleg">${pl.map(k => `<button class="lg${f.place === k ? ' on' : ''}" data-f="place" data-v="${esc(k)}"><i style="background:${PLACE_COL[k] || '#9d9b96'}"></i>${esc(k)}<b class="num">${n(pc[k])}</b></button>`).join('')}</div></div>`;

    // 3. nature of works, 4. qualification
    const dc = tally(view('duty'), x => x.duty), duty = LISTS.duty(dc).filter(k => dc[k] || f.duty === k).map(k => ({ k, label: CHART[k], n: dc[k] || 0 }));
    const qc = tally(view('qual'), x => x.qual), qual = LISTS.qual(qc).filter(k => qc[k] || f.qual === k).map(k => ({ k, label: CHART[k], n: qc[k] || 0 }));
    // 5. age bands
    const ac = tally(view('age'), x => x.ageBand), age = LISTS.age(ac).filter(k => k !== 'Not given' || ac[k]).map(k => ({ k, label: k === '50 and above' ? '50 +' : k, n: ac[k] || 0 }));
    // 6. date of joining: month by month, or year by year over a long span
    const vj = view('joined').filter(x => x.jk), keys = vj.map(x => x.jk).sort(), noDate = view('joined').length - vj.length;
    let join = [];
    if (keys.length) {
      const [y0, m0] = keys[0].split('-').map(Number), [y1, m1] = keys[keys.length - 1].split('-').map(Number), span = (y1 - y0) * 12 + m1 - m0 + 1;
      if (span <= 18) { const jc = tally(vj, x => x.jk); for (let i = 0; i < span; i++) { const y = y0 + Math.floor((m0 - 1 + i) / 12), m = (m0 - 1 + i) % 12, k = y + '-' + p2(m + 1); join.push({ k, label: `${MON[m]} ’${String(y).slice(2)}`, title: `${MON[m]} ${y}`, n: jc[k] || 0 }); } }
      else { const jc = tally(vj, x => x.jk.slice(0, 4)); for (let y = y0; y <= y1; y++) join.push({ k: String(y), label: String(y), n: jc[y] || 0 }); }
    }
    // 7. what is missing most
    const mc = tally(view('miss').filter(x => !x.done), x => x.miss), missing = LISTS.miss(mc).filter(k => mc[k] || f.miss === k).map(k => ({ k, n: mc[k] || 0 }));
    const incomplete = view('miss').filter(x => !x.done).length;
    // 8. activity: changes per day for 30 days
    const lg = logScope(), t0 = day0(Date.now()), dayC = {}, saveC = {};
    lg.forEach(l => { const w = when(l.on); if (!w) return; const k = dstr(w); dayC[k] = (dayC[k] || 0) + 1; (saveC[k] = saveC[k] || new Set()).add(l.on.slice(0, 16) + l.division); });
    const days = []; for (let i = 29; i >= 0; i--) { const d = new Date(t0 - i * DAY), k = dstr(d); days.push({ day: k, label: String(d.getDate()), title: `${k} · ${saveC[k] ? saveC[k].size : 0} saves, changes`, n: dayC[k] || 0, cls: i === 0 ? 'today' : '' }); }
    const active = days.filter(x => x.n).length, saves30 = days.reduce((a, x) => a + (saveC[x.day] ? saveC[x.day].size : 0), 0);
    // 9. divisions to follow up
    const dv = {}; view('division').filter(x => !f.circle || x.r.circle === f.circle).forEach(x => { const k = x.r.circle + '|' + x.r.division, c = dv[k] = dv[k] || { c: x.r.circle, d: x.r.division, t: 0, m: 0 }; c.t++; if (!x.done) c.m++; });
    const fol = Object.values(dv).filter(x => x.m).sort((a, b) => b.m - a.m || b.t - a.t).slice(0, 7), maxF = Math.max(1, ...fol.map(x => x.t));
    const has = new Set(D.rows.map(x => x.r.circle + '|' + x.r.division)), notStarted = scopeDivs().filter(d => !has.has(d.c + '|' + d.d)).length;
    const follow = (fol.map(x => `<button class="arow${f.division === x.d && f.circle === x.c ? ' on' : ''}" data-dv="${esc(x.c + '|' + x.d)}">
        <span class="al"><b>${esc(x.d)}</b><small>${esc(x.c)}</small></span>
        <span class="ab"><i class="sx" style="width:${x.m * 100 / maxF}%"></i><i class="sv" style="width:${(x.t - x.m) * 100 / maxF}%"></i></span>
        <span class="an num">${x.m} <small>of ${x.t} missing</small></span></button>`).join('') || '<p class="faint">Every volunteer entered here has all details.</p>')
      + (notStarted ? `<button class="btn sm ghost nsbtn" data-goto="notstarted"><span class="ns">${notStarted} division${notStarted === 1 ? '' : 's'} not started</span> · see the list ›</button>` : '');

    return `<section class="fvcharts">
      <div class="chart wide" id="chProg"><div class="chart-h"><h3>Progress by ${D.by}</h3>${byToggle}</div>
        <div class="legend-s"><span class="lv">Added (all details)</span><span class="lm">Details missing</span></div>${prog}</div>
      <div class="chart" id="chPlace"><h3>Place of posting</h3>${donut}</div>
      <div class="chart"><h3>Nature of works</h3>${hbars(duty, 'duty')}</div>
      <div class="chart"><h3>Educational qualification</h3>${hbars(qual, 'qual', 'sq')}</div>
      <div class="chart" id="chAge"><h3>Age</h3>${colsChart(age, 'age')}<p class="foot ctr">Age today, from the date of birth</p></div>
      <div class="chart wide"><h3>Date of joining</h3>${join.length ? colsChart(join, 'joined', join.length > 12) : '<p class="faint">No dates of joining in this view.</p>'}
        <p class="foot ctr">${join.length && join[0].k.length === 4 ? 'Volunteers joining each year' : 'Volunteers joining each month'}${noDate ? ` · ${noDate} without a date` : ''} · click a bar to filter</p></div>
      <div class="chart"><h3>What is missing most</h3>${hbars(missing, 'miss', 'sx')}<p class="foot">${n(incomplete)} volunteer${incomplete === 1 ? ' has' : 's have'} at least one detail missing</p></div>
      <div class="chart wide"><h3>Activity, last 30 days</h3>${colsChart(days, null, true)}
        <p class="foot ctr">Changes saved each day · ${saves30} saves on ${active} day${active === 1 ? '' : 's'} · click a day to see its changes</p></div>
      <div class="chart"><h3>Divisions to follow up</h3><div class="legend-s"><span class="lm">Details missing</span><span class="lv">Added</span></div>${follow}</div>
    </section>`;
  }

  /* ---------------- volunteers table ---------------- */
  const VCOLS = [
    ['name', 'Volunteer', x => x.r.name.toLowerCase()], ['circle', 'Circle / division', null], ['age', 'Age', x => x.age, 'r'], ['qual', 'Qualification', x => x.qual],
    ['doj', 'Joined', x => x.doj ? +x.doj : null], ['place', 'Place of posting', x => x.place + '|' + x.r.placeName + '|' + x.r.placeSub], ['duty', 'Nature of works', x => x.duty],
    ['status', 'Details', x => x.miss.length],
  ];
  function sortedView() {
    const o = order(), c = VCOLS.find(x => x[0] === D.sort.k) || VCOLS[1], dir = D.sort.dir;
    const pos = x => [o.c[x.r.circle] == null ? 99 : o.c[x.r.circle], o.d[x.r.circle + '|' + x.r.division] == null ? 999 : o.d[x.r.circle + '|' + x.r.division], +x.r.sl || 0];
    const byPos = (a, b) => { const p = pos(a), q = pos(b); return p[0] - q[0] || p[1] - q[1] || p[2] - q[2]; };
    return view().sort((a, b) => {
      if (!c[2]) return byPos(a, b) * dir;
      const x = c[2](a), y = c[2](b);
      if (x == null && y == null) return byPos(a, b); if (x == null) return 1; if (y == null) return -1;
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * dir || byPos(a, b);
    });
  }
  function volunteersHtml() {
    const list = sortedView(), rows = list.slice(0, D.shown);
    const tools = `<div class="tc-head"><h2>Volunteers</h2><span class="tc-sum">${n(list.length)} in this view · click a row to open its division</span><span class="sp"></span>
      <button class="btn sm" data-rep="statement" data-out="xls">${IC.xls} Excel</button><button class="btn sm" data-rep="statement" data-out="pdf">${IC.pdf} PDF</button></div>`;
    if (!list.length) return `<div class="tablecard">${tools}<div class="empty-state small"><b>No volunteers match these filters.</b>Remove a filter above to see more.</div></div>`;
    const th = VCOLS.map(([k, l, , cls]) => `<th data-s="${k}" class="${cls || ''}${D.sort.k === k ? ' sorted' : ''}">${l}${D.sort.k === k ? (D.sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('');
    return `<div class="tablecard">${tools}<div class="tscroll"><table class="dtable vtable"><thead><tr>${th}</tr></thead><tbody>${rows.map(x => {
      const r = x.r, v = x.v;
      const place = x.place === 'Div HQ' ? 'Div HQ' : r.placeType === 'Range' || r.placeName ? `${esc(r.placeName || 'Range')}<div class="faint">${esc(r.placeSub || 'Range HQ / Beat / Camp not given')}</div>` : '<span class="faint">—</span>';
      return `<tr data-go="#/d/${A().enc(r.circle)}/${A().enc(r.division)}" tabindex="0">
        <td><div class="tn">${esc(r.name) || '<span class="faint">No name</span>'}</div><div class="faint num">${r.dob ? 'Born ' + esc(r.dob) : 'No date of birth'}</div></td>
        <td>${esc(r.division)}<div class="faint">${esc(r.circle)}</div></td>
        <td class="r num">${x.age == null ? '<span class="faint">—</span>' : x.age}</td>
        <td>${esc(r.qual) || '<span class="faint">—</span>'}</td>
        <td class="num" style="white-space:nowrap">${esc(r.doj) || '<span class="faint">—</span>'}</td>
        <td>${place}</td>
        <td>${v.duty ? esc(v.duty) : '<span class="faint">—</span>'}${v.wdet ? `<div class="faint">${esc(v.wdet)}</div>` : ''}</td>
        <td>${x.done ? '<span class="pill verified">Complete</span>' : `<span class="pill attn">${x.miss.length} missing</span><div class="faint">${esc(x.miss.slice(0, 3).join(', '))}${x.miss.length > 3 ? '…' : ''}</div>`}</td></tr>`;
    }).join('')}</tbody></table></div>
      <div class="tfoot"><span class="faint">Showing ${n(rows.length)} of ${n(list.length)} · Excel and PDF include every matching volunteer</span>
        ${list.length > rows.length ? `<button class="btn sm" id="vMore">Show ${n(Math.min(200, list.length - rows.length))} more</button>` : ''}</div></div>`;
  }

  /* ---------------- divisions ---------------- */
  function divStats() {
    const by = {}; D.rows.forEach(x => { const k = x.r.circle + '|' + x.r.division, c = by[k] = by[k] || { t: 0, dn: 0 }; c.t++; if (x.done) c.dn++; });
    return scopeDivs().map((d, i) => { const c = by[d.c + '|' + d.d] || { t: 0, dn: 0 }, s = A().divSaved(d.c, d.d), at = s && when(s.on);
      return Object.assign({ i, m: c.t - c.dn, s, idle: at ? Math.floor((day0(Date.now()) - day0(+at)) / DAY) : null }, d, c); });
  }
  const DV_SHOW = [['all', 'All'], ['followup', 'Need follow-up'], ['notstarted', 'Not started'], ['complete', 'Complete']];
  const dvKeep = (x, show) => show === 'followup' ? !x.t || x.m > 0 : show === 'notstarted' ? !x.t : show === 'complete' ? x.t && !x.m : true;
  const DV_SORT = { circle: ['Circle order', (a, b) => a.i - b.i], low: ['Least added first', (a, b) => (a.t ? a.dn / a.t : -1) - (b.t ? b.dn / b.t : -1) || a.i - b.i],
    miss: ['Most details missing', (a, b) => b.m - a.m || a.i - b.i], size: ['Most volunteers', (a, b) => b.t - a.t || a.i - b.i],
    idle: ['Longest since last save', (a, b) => (b.idle == null ? 1e9 : b.idle) - (a.idle == null ? 1e9 : a.idle) || a.i - b.i], az: ['Division A–Z', (a, b) => a.d.localeCompare(b.d)] };
  function divisionsHtml() {
    const all = divStats(), list = all.filter(x => dvKeep(x, D.dv.show)).sort(DV_SORT[D.dv.sort][1]);
    const cnt = k => all.filter(x => dvKeep(x, k)).length, grouped = D.dv.sort === 'circle';
    const row = x => `<tr data-go="#/d/${A().enc(x.c)}/${A().enc(x.d)}" tabindex="0"><td class="tn">${esc(x.d)}${grouped ? '' : `<div class="faint">${esc(x.c)}</div>`}</td>
      <td class="r num">${x.t || '<span class="faint">0</span>'}</td><td class="r num">${x.dn ? `<span class="ok-n">${x.dn}</span>` : '0'}</td><td class="r num">${x.m ? `<span class="miss-n">${x.m}</span>` : '0'}</td>
      <td>${x.t ? `<span class="dvbar"><span><i class="g" style="width:${pct(x.dn, x.t)}%"></i><i class="o" style="width:${100 - pct(x.dn, x.t)}%"></i></span><b class="num">${pct(x.dn, x.t)}%</b></span>` : '<span class="not-started">Not started</span>'}</td>
      <td class="num" style="white-space:nowrap">${x.s ? esc(A().shortWhen(x.s.on)) : '<span class="faint">—</span>'}${x.idle != null ? `<div class="faint">${x.idle === 0 ? 'today' : x.idle === 1 ? 'yesterday' : x.idle + ' days ago'}</div>` : ''}</td>
      <td>${x.s ? esc(x.s.by) : ''}</td></tr>`;
    let body = '';
    if (grouped) D.meta.circles.forEach(c => { const g = list.filter(x => x.c === c.circle); if (!g.length) return;
      const t = g.reduce((a, x) => a + x.t, 0), dn = g.reduce((a, x) => a + x.dn, 0);
      body += `<tr class="plainrow"><td colspan="7" class="circle-h">${esc(c.circle)} <span class="faint">· ${g.filter(x => x.t).length} of ${g.length} started · ${dn} added · ${t - dn} details missing</span></td></tr>` + g.map(row).join(''); });
    else body = list.map(row).join('');
    return `<div class="tablecard"><div class="tc-head"><h2>Divisions</h2>
        <div class="seg" role="group" aria-label="Show">${DV_SHOW.map(([k, l]) => `<button data-show="${k}" class="${D.dv.show === k ? 'on' : ''}">${l} <span class="num">${cnt(k)}</span></button>`).join('')}</div>
        <select class="dsort" id="dvSort" aria-label="Sort">${Object.entries(DV_SORT).map(([k, v]) => `<option value="${k}"${D.dv.sort === k ? ' selected' : ''}>${v[0]}</option>`).join('')}</select>
        <span class="sp"></span><button class="btn sm" data-rep="progress" data-out="xls">${IC.xls} Excel</button><button class="btn sm" data-rep="progress" data-out="pdf">${IC.pdf} PDF</button></div>
      <div class="tscroll"><table class="dtable"><thead><tr><th>Division</th><th class="r">Volunteers</th><th class="r">Added</th><th class="r">Details missing</th><th>Progress</th><th>Last saved</th><th>By</th></tr></thead>
        <tbody>${body || '<tr class="plainrow"><td colspan="7" class="muted" style="padding:24px;text-align:center">No divisions here.</td></tr>'}</tbody></table></div>
      <div class="tfoot"><span class="faint">Counts include every volunteer of the division; only the circle and division filters apply here. Click a division to open its list.</span></div></div>`;
  }

  /* ---------------- change log ---------------- */
  function logList() {
    const L = D.L, q = L.q.toLowerCase().trim(), from = L.days ? day0(Date.now() - (+L.days - 1) * DAY) : 0;
    return logScope().filter(l => (L.act === 'all' || l.action === L.act) && (!L.who || l.by === L.who) && (!L.day || l.on.startsWith(L.day))
      && (!from || (when(l.on) || 0) >= from) && (!q || [l.by, l.desig, l.username, l.division, l.circle, l.vname, l.field, l.old, l.value].join(' ').toLowerCase().includes(q)));
  }
  function logHtml() {
    const L = D.L, people = [...new Set(logScope().map(l => l.by))].filter(Boolean).sort();
    return `<div class="logbar">
        <select id="logCircle" aria-label="Circle"><option value="">All circles</option>${D.meta.circles.map(c => `<option${D.f.circle === c.circle ? ' selected' : ''}>${esc(c.circle)}</option>`).join('')}</select>
        <div class="seg" role="group" aria-label="Action">${['all', 'Added', 'Edited', 'Removed'].map(a => `<button data-act="${a}" class="${L.act === a ? 'on' : ''}">${a === 'all' ? 'All' : a}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Period">${[['1', 'Today'], ['7', '7 days'], ['30', '30 days'], ['', 'All time']].map(([k, l]) => `<button data-days="${k}" class="${!L.day && L.days === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${L.day ? `<button class="fchip" id="dayX">On ${esc(L.day)} <span aria-hidden="true">×</span></button>` : ''}
        <select id="logWho" aria-label="Saved by"><option value="">Everyone</option>${people.map(p => `<option${L.who === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select>
        <input id="logQ" type="search" placeholder="Search name, division, value…" value="${esc(L.q)}" aria-label="Search the change log">
        ${D.f.division ? `<button class="fchip" data-clear="division">Division: ${esc(D.f.division)} <span aria-hidden="true">×</span></button>` : ''}</div>
      <div class="tablecard"><div class="tc-head"><h2>Change log</h2><span class="tc-sum" id="logSum"></span><span class="sp"></span>
          <button class="btn sm" data-rep="changes" data-out="xls">${IC.xls} Excel</button><button class="btn sm" data-rep="changes" data-out="pdf">${IC.pdf} PDF</button></div>
        <div class="tscroll"><table class="dtable"><thead><tr><th>When</th><th>Saved by</th><th>Division</th><th>Volunteer</th><th>What</th><th>Old → new</th></tr></thead><tbody id="logBody"></tbody></table></div>
        <div class="faint" id="logMore" style="padding:10px 16px"></div></div>`;
  }
  function logTable() {
    const list = logList(), saves = new Set(list.map(l => l.on.slice(0, 16) + l.division)).size;
    $('#logSum').textContent = `${n(list.length)} change${list.length === 1 ? '' : 's'} · ${n(saves)} save${saves === 1 ? '' : 's'} · ${n(new Set(list.map(l => l.by)).size)} people · ${n(new Set(list.map(l => l.circle + l.division)).size)} divisions`;
    $('#logBody').innerHTML = list.slice(0, 400).map(l => `<tr class="plainrow"><td class="num" style="white-space:nowrap">${esc(A().shortWhen(l.on))}</td>
      <td><b>${esc(l.by)}</b><div class="faint">${esc(l.desig)}${l.mobile ? ' · ' + esc(l.mobile) : ''}${l.username ? ' · ' + esc(l.username) : ''}</div></td>
      <td>${esc(l.division)}<div class="faint">${esc(l.circle)}</div></td><td>${esc(l.vname)}</td>
      <td><span class="act-tag ${esc(l.action)}">${esc(l.action)}</span>${l.field ? `<div class="faint">${esc(l.field)}</div>` : ''}</td>
      <td>${l.old ? `<span class="chg-old">${esc(l.old)}</span>` : ''}${l.old && l.value ? ' → ' : ''}${l.value ? `<span class="chg-new">${esc(l.value)}</span>` : ''}</td></tr>`).join('')
      || '<tr class="plainrow"><td colspan="6" class="muted" style="padding:24px;text-align:center">No changes match.</td></tr>';
    $('#logMore').textContent = list.length > 400 ? `Showing the latest 400 of ${n(list.length)}. Excel and PDF include all of them.` : D.logTotal > D.log.length ? `The dashboard reads the latest ${n(D.log.length)} of ${n(D.logTotal)} changes; the Google Sheet has them all.` : '';
  }

  /* ---------------- reports ---------------- */
  const REPORTS = [
    ['progress', IC.prog, 'Division progress', 'Circle by circle: each division’s volunteers, how many are added, how many have details missing, and when it last saved.', ['pdf', 'xls'],
      () => `<label class="ropt"><input type="checkbox" id="rpOnly"${D.rp.only ? ' checked' : ''}> Only divisions that need follow-up</label>`],
    ['followup', IC.flag, 'Follow-up list', 'Divisions that have not started, and each volunteer whose details are missing, with what is missing. Copy it as a message for WhatsApp or e-mail.', ['pdf', 'xls', 'copy']],
    ['statement', IC.list, 'List of Forest Volunteers', 'The volunteers in the circular’s format, division by division, with every column.', ['pdf', 'xls']],
    ['abstract', IC.sum, 'Abstract', 'Circle-wise totals (division-wise when one circle is chosen): volunteers added, place of posting, nature of works, qualification and age.', ['pdf', 'xls']],
    ['changes', IC.log, 'Change log', 'Additions, edits and removals in a period, division by division, with who made them.', ['pdf', 'xls'],
      () => `<label class="ropt">Period <select id="rpDays">${[['1', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['', 'All time']].map(([k, l]) => `<option value="${k}"${D.rp.days === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`],
  ];
  function reportsHtml() {
    return `<p class="rpnote">Reports use the filters above. <b>Covers:</b> ${esc(covers())}</p>
      <div class="rcards">${REPORTS.map(([k, ic, t, p, outs, opts]) => `<div class="rcard"><h3><span class="ri">${ic}</span>${t}</h3><p>${p}</p>${opts ? `<div class="ropts">${opts()}</div>` : ''}
        <div class="rbtns">${outs.map(o => `<button class="btn sm${o === 'pdf' ? ' soft' : ''}" data-rep="${k}" data-out="${o}">${IC[o]} ${o === 'pdf' ? 'PDF' : o === 'xls' ? 'Excel' : 'Copy as message'}</button>`).join('')}</div></div>`).join('')}</div>`;
  }

  // Each report is built once as a spec { title, subtitle, kpis, blocks: [{ heading, columns, rows }] } and written out as PDF or Excel (CSV).
  // A row is an array of cells; { _h: text } is a heading row across the table; row._b marks a total row.
  const col = (label, o) => Object.assign({ label }, o || {});
  function unitTotals(list, keyFn) { const by = {}; list.forEach(x => { const k = keyFn(x), c = by[k] = by[k] || { t: 0, dn: 0 }; c.t++; if (x.done) c.dn++; }); return by; }
  function specProgress() {
    const v = view('status'), by = unitTotals(v, x => x.r.circle + '|' + x.r.division), rows = [], o = { t: 0, dn: 0, divs: 0, st: 0 };
    D.meta.circles.filter(c => !D.f.circle || c.circle === D.f.circle).forEach(c => {
      const ds = c.divisions.filter(d => !D.f.division || d === D.f.division).map(d => Object.assign({ d }, by[c.circle + '|' + d] || { t: 0, dn: 0 }, { s: A().divSaved(c.circle, d) }))
        .filter(x => !D.rp.only || !x.t || x.t > x.dn);
      if (!ds.length) return;
      const t = ds.reduce((a, x) => a + x.t, 0), dn = ds.reduce((a, x) => a + x.dn, 0), st = ds.filter(x => x.t).length;
      rows.push({ _h: `${c.circle} circle · ${st} of ${ds.length} divisions started` });
      ds.forEach((x, i) => rows.push([i + 1, x.d, x.t, x.dn, x.t - x.dn, x.t ? pct(x.dn, x.t) + '%' : '', x.t ? (x.s ? A().shortWhen(x.s.on) : '') : 'Not started', x.s ? x.s.by : '']));
      rows.push(Object.assign(['', 'Total, ' + c.circle, t, dn, t - dn, t ? pct(dn, t) + '%' : '', '', ''], { _b: true }));
      o.t += t; o.dn += dn; o.divs += ds.length; o.st += st;
    });
    if (rows.length) rows.push(Object.assign(['', 'Grand total', o.t, o.dn, o.t - o.dn, o.t ? pct(o.dn, o.t) + '%' : '', '', ''], { _b: true }));
    return { title: 'Division progress', file: 'Division_progress', landscape: false,
      kpis: [['Divisions', o.divs], ['Started', o.st, 'blue'], ['Not started', o.divs - o.st, 'orange'], ['Volunteers', o.t], ['Added', o.dn, 'green'], ['Details missing', o.t - o.dn, 'orange']],
      blocks: [{ columns: [col('Sl', { w: 18 }), col('Division', { w: '*' }), col('Volunteers', { num: 1, w: 50 }), col('Added', { num: 1, w: 38 }), col('Details missing', { num: 1, w: 50, warn: r => r[4] > 0 }),
        col('% added', { num: 1, w: 38 }), col('Last saved', { w: 72, warn: r => r[6] === 'Not started' }), col('Saved by', { w: 120 })], rows }] };
  }
  function specFollowup() {
    const has = new Set(D.rows.map(x => x.r.circle + '|' + x.r.division));
    const ns = scopeDivs().filter(d => !has.has(d.c + '|' + d.d));
    const inc = view('status').filter(x => !x.done), o = order(), by = {};
    inc.forEach(x => (by[x.r.circle + '|' + x.r.division] = by[x.r.circle + '|' + x.r.division] || []).push(x));
    const keys = Object.keys(by).sort((a, b) => { const [ac, ad] = a.split('|'), [bc, bd] = b.split('|'); return (o.c[ac] - o.c[bc]) || (o.d[a] - o.d[b]) || ad.localeCompare(bd); });
    const rows = [];
    keys.forEach(k => { const [c, d] = k.split('|'), l = by[k].sort((a, b) => (+a.r.sl || 0) - (+b.r.sl || 0)); rows.push({ _h: `${d} division, ${c} circle · ${l.length} volunteer${l.length === 1 ? '' : 's'} with details missing` });
      l.forEach((x, i) => rows.push([i + 1, x.r.name || '(no name)', x.miss.join(', '), x.r.updOn ? A().shortWhen(x.r.updOn) : ''])); });
    return { title: 'Follow-up list', file: 'Follow_up_list', landscape: false,
      kpis: [['Divisions not started', ns.length, 'orange'], ['Divisions with details missing', keys.length, 'orange'], ['Volunteers with details missing', inc.length, 'orange']],
      blocks: [
        { heading: `Divisions that have not started (${ns.length})`, empty: 'Every division has started.',
          columns: [col('Sl', { w: 18 }), col('Circle', { w: 140 }), col('Division', { w: '*' })], rows: ns.map((x, i) => [i + 1, x.c, x.d]) },
        { heading: `Volunteers with details missing (${inc.length})`, empty: 'No volunteer has details missing.',
          columns: [col('Sl', { w: 18 }), col('Volunteer', { w: 130 }), col('What is missing', { w: '*' }), col('Last saved', { w: 72 })], rows }],
      ns, by, keys };
  }
  function followupText() {
    const s = specFollowup(), lines = [`*Forest Volunteers: follow-up* (${stamp().slice(0, 10)})`, covers() === 'All circles and divisions' ? '' : covers(), ''];
    D.meta.circles.forEach(c => {
      const ns = s.ns.filter(x => x.c === c.circle), ks = s.keys.filter(k => k.split('|')[0] === c.circle);
      if (!ns.length && !ks.length) return;
      lines.push(`*${c.circle} circle*`);
      ns.forEach(x => lines.push(`• ${x.d}: not started. Please enter the list of Forest Volunteers.`));
      ks.forEach(k => { const l = s.by[k]; lines.push(`• ${k.split('|')[1]}: ${l.length} volunteer${l.length === 1 ? '' : 's'} with details missing`);
        l.slice(0, 15).forEach(x => lines.push(`   – ${x.r.name || '(no name)'}: ${x.miss.join(', ')}`)); if (l.length > 15) lines.push(`   – and ${l.length - 15} more`); });
      lines.push('');
    });
    lines.push('Please complete them at https://fv.forestwb.in');
    return lines.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
  }
  function specStatement() {
    const list = sortedView().sort((a, b) => { const o = order(); return (o.c[a.r.circle] - o.c[b.r.circle]) || (o.d[a.r.circle + '|' + a.r.division] - o.d[b.r.circle + '|' + b.r.division]) || (+a.r.sl || 0) - (+b.r.sl || 0); });
    const rows = []; let k = '', i = 0;
    list.forEach(x => {
      const r = x.r, kk = r.circle + '|' + r.division;
      if (kk !== k) { k = kk; i = 0; const c = list.filter(y => y.r.circle === r.circle && y.r.division === r.division).length; rows.push({ _h: `${r.division} division, ${r.circle} circle · ${c} volunteer${c === 1 ? '' : 's'}` }); }
      rows.push([++i, r.name, r.dob, r.qual, r.deptRef, r.dirRef, r.apptRef, r.doj, r.placeType, r.placeName, r.placeSub, r.works, x.done ? 'Complete' : 'Missing: ' + x.miss.join(', ')]);
    });
    const done = list.filter(x => x.done).length;
    return { title: 'List of Forest Volunteers', file: 'List_of_Forest_Volunteers', landscape: true, small: true,
      kpis: [['Volunteers', list.length], ['Added (all details)', done, 'green'], ['Details missing', list.length - done, 'orange'], ['Divisions', new Set(list.map(x => x.r.circle + x.r.division)).size]],
      blocks: [{ columns: [col('Sl', { w: 14 }), col('Name of Forest Volunteer Engaged', { w: 70 }), col('Date of Birth', { w: 40 }), col('Educational Qualification', { w: 48 }),
        col('Forest Dept.’s approval ref', { w: 58 }), col('Forest Directorate’s Ref no sent to the Circle in Charge', { w: 58 }), col('Appointment Order issued by / reference', { w: 62 }),
        col('Date of Joining', { w: 40 }), col('Posted at', { w: 30 }), col('Range name', { w: 48 }), col('Within the range', { w: 50 }), col('Nature of Works assigned', { w: '*' }),
        col('Details', { w: 56, warn: r => r[12] !== 'Complete' })], rows }] };
  }
  function specAbstract() {
    const v = view(), byDiv = !!D.f.circle, unit = x => byDiv ? x.r.division : x.r.circle;
    const units = byDiv ? D.meta.circles.find(c => c.circle === D.f.circle).divisions.filter(d => !D.f.division || d === D.f.division) : D.meta.circles.map(c => c.circle);
    const name = byDiv ? 'Division' : 'Circle', g = {}; units.forEach(u => g[u] = []); v.forEach(x => (g[unit(x)] = g[unit(x)] || []).push(x));
    const table = (heading, keys, fn, labels, extra) => {
      const cnt = {}; units.forEach(u => cnt[u] = tally(g[u] || [], fn)); const tot = tally(v, fn);
      const ks = keys.filter(k => tot[k] || !/^(Not given|Other|Range \(not specified\))$/.test(k));
      const rows = units.map(u => [u, ...(extra ? extra(u) : []), ...ks.map(k => cnt[u][k] || 0), (g[u] || []).length]);
      rows.push(Object.assign(['Total', ...(extra ? extra(null) : []), ...ks.map(k => tot[k] || 0), v.length], { _b: true }));
      return { heading, columns: [col(name, { w: byDiv ? 130 : 110 }), ...(extra ? extra('cols') : []), ...ks.map(k => col(labels ? labels(k) : k, { num: 1, w: 58 })), col('Total', { num: 1, w: 44 })], rows };
    };
    const has = new Set(D.rows.map(x => x.r.circle + '|' + x.r.division));
    const prog = u => {
      if (u === 'cols') return [col('Divisions', { num: 1, w: 42 }), col('Started', { num: 1, w: 38 })].slice(byDiv ? 2 : 0);
      if (byDiv) return [];
      const cs = u ? D.meta.circles.filter(c => c.circle === u) : D.meta.circles;
      const ds = [].concat(...cs.map(c => c.divisions.map(d => c.circle + '|' + d)));
      return [ds.length, ds.filter(k => has.has(k)).length];
    };
    const status = table('Volunteers, added and details missing', ['Added', 'Details missing'], x => x.done ? 'Added' : 'Details missing', null, prog);
    const place = table('Place of posting', PLACES, x => x.place, k => k === 'Range (not specified)' ? 'Range (no beat / camp)' : k);
    const duty = table('Nature of works', LISTS.duty(tally(v, x => x.duty)), x => x.duty, k => SHORT[k] || k);
    const qual = table('Educational qualification', LISTS.qual(tally(v, x => x.qual)), x => x.qual, k => SHORT[k] || k);
    const age = table('Age', LISTS.age(tally(v, x => x.ageBand)), x => x.ageBand);
    const done = v.filter(x => x.done).length;
    return { title: 'Abstract of Forest Volunteers', file: 'Abstract', landscape: true,
      kpis: [['Volunteers', v.length], ['Added', done, 'green'], ['Details missing', v.length - done, 'orange'], ['In beats & camps', v.filter(x => x.place === 'Beat' || x.place === 'Camp').length], ['At Div HQ', v.filter(x => x.place === 'Div HQ').length]],
      blocks: [status, place, duty, qual, age] };
  }
  function specChanges() {
    const from = D.rp.days ? day0(Date.now() - (+D.rp.days - 1) * DAY) : 0;
    const list = logScope().filter(l => !from || (when(l.on) || 0) >= from), by = {};
    list.forEach(l => { const k = l.circle + '|' + l.division, c = by[k] = by[k] || { c: l.circle, d: l.division, saves: new Set(), Added: new Set(), Edited: new Set(), Removed: 0, n: 0, last: l.on, who: l.by };
      c.n++; c.saves.add(l.on.slice(0, 16)); if (l.action === 'Removed') c.Removed++; else c[l.action] && c[l.action].add(l.vid); });
    const o = order(), sum = Object.values(by).sort((a, b) => (o.c[a.c] - o.c[b.c]) || (o.d[a.c + '|' + a.d] - o.d[b.c + '|' + b.d]));
    const period = { '1': 'today', '7': 'in the last 7 days', '30': 'in the last 30 days', '': 'since the start' }[D.rp.days];
    return { title: 'Change log', file: 'Change_log', landscape: true, subtitle: `Changes ${period}`,
      kpis: [['Changes', list.length], ['Saves', new Set(list.map(l => l.on.slice(0, 16) + l.division)).size], ['Divisions', sum.length], ['People', new Set(list.map(l => l.by)).size],
        ['Volunteers added', list.filter(l => l.action === 'Added' && /^Name/.test(l.field)).length, 'green'], ['Volunteers removed', list.filter(l => l.action === 'Removed').length, 'orange']],
      blocks: [
        { heading: 'Division by division', empty: 'No changes in this period.', columns: [col('Circle', { w: 80 }), col('Division', { w: 110 }), col('Saves', { num: 1, w: 34 }), col('Changes', { num: 1, w: 40 }),
          col('Volunteers added', { num: 1, w: 50 }), col('Volunteers edited', { num: 1, w: 50 }), col('Removed', { num: 1, w: 40 }), col('Last saved', { w: 70 }), col('Last saved by', { w: '*' })],
          rows: sum.map(x => [x.c, x.d, x.saves.size, x.n, x.Added.size, x.Edited.size, x.Removed, A().shortWhen(x.last), x.who]) },
        { heading: 'Every change', empty: 'No changes in this period.', columns: [col('When', { w: 64 }), col('Saved by', { w: 90 }), col('Division', { w: 80 }), col('Volunteer', { w: 80 }),
          col('Action', { w: 38 }), col('Field', { w: 90 }), col('Old value', { w: '*' }), col('New value', { w: '*' })],
          rows: list.map(l => [A().shortWhen(l.on), l.by + (l.desig ? ' (' + l.desig + ')' : ''), l.division, l.vname, l.action, l.field, l.old, l.value]) }] };
  }
  const SPECS = { progress: specProgress, followup: specFollowup, statement: specStatement, abstract: specAbstract, changes: specChanges };

  async function runReport(k, out, btn) {
    if (out === 'copy') {
      const t = followupText();
      try { await navigator.clipboard.writeText(t); A().toast('Copied. Paste it into WhatsApp or an e-mail.'); }
      catch (e) { const d = document.createElement('textarea'); d.value = t; document.body.appendChild(d); d.select(); document.execCommand('copy'); d.remove(); A().toast('Copied. Paste it into WhatsApp or an e-mail.'); }
      return;
    }
    const s = SPECS[k](), scope = plain(D.f.division || D.f.circle || 'All');
    s.covers = covers(); s.file = `FV_${s.file}_${scope}_${stamp().slice(0, 10).split('-').reverse().join('')}`;
    if (out === 'xls') { A().download(s.file + '.csv', toRows(s)); A().toast(`${s.title} downloaded for Excel.`); return; }
    const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'Preparing…';
    try { await toPdf(s); A().toast(`${s.title} downloaded as PDF.`); }
    catch (e) { A().toast(e.message || 'The PDF could not be made.', true); }
    finally { btn.disabled = false; btn.innerHTML = old; }
  }
  function toRows(s) {
    const out = [[s.title + (s.subtitle ? ' · ' + s.subtitle : '')], ['Covers: ' + s.covers], ['Generated: ' + stamp()], [], s.kpis.map(k => k[0]), s.kpis.map(k => k[1])];
    s.blocks.forEach(b => {
      out.push([]); if (b.heading) out.push([b.heading]);
      out.push(b.columns.map(c => c.label));
      b.rows.forEach(r => out.push(r._h ? [r._h] : r));
      if (!b.rows.length) out.push([b.empty || 'Nothing to show.']);
    });
    return out;
  }

  /* ---------------- PDF (pdfmake, loaded the first time it is needed) ---------------- */
  let pdfLib = null, emblem = null;
  function loadPdf() {
    if (window.pdfMake && window.pdfMake.vfs) return Promise.resolve();
    const add = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('The PDF tool could not be loaded. Please check the internet connection.')); document.head.appendChild(s); });
    return pdfLib = pdfLib || add('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js')
      .then(() => add('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js')).catch(e => { pdfLib = null; throw e; });
  }
  async function emblemPng() {
    if (emblem) return emblem;
    const img = new Image(); img.src = 'assets/emblem.svg'; await img.decode();
    const h = 300, w = Math.round(h * 550 / 876.55), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    return (emblem = cv.toDataURL('image/png'));
  }
  const C = { ink: '#191918', body: '#55534e', subtle: '#6b6a66', faint: '#8f8d88', line: '#ecebe8', border: '#e3e2df', green: '#1d6b31', orange: '#8a4510', blue: '#1f4f9e', band: '#eef2f7', zebra: '#fbfbfa' };
  async function toPdf(s) {
    await loadPdf(); const img = await emblemPng();
    const W = s.landscape ? 762 : 515, fs = s.small ? 6.6 : 8;
    const content = [
      { columns: [{ image: img, width: 26 },
        { width: '*', margin: [10, 1, 0, 0], stack: [{ text: 'Government of West Bengal', bold: true, fontSize: 11, color: C.ink },
          { text: 'Directorate of Forests  ·  Forest Volunteers', fontSize: 8.5, color: C.body }, { text: 'Aranya Bhawan, LA-10A, Sector-III, Salt Lake, Kolkata - 700106', fontSize: 7.5, color: C.subtle }] },
        { width: 'auto', stack: [{ text: s.title, bold: true, fontSize: 14, color: C.ink, alignment: 'right' },
          { text: (s.subtitle ? s.subtitle + '  ·  ' : '') + 'As of ' + stamp(), fontSize: 8, color: C.subtle, alignment: 'right', margin: [0, 2, 0, 0] }] }] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: W, y2: 0, lineWidth: 1.1, lineColor: C.ink }], margin: [0, 7, 0, 7] },
      { text: [{ text: 'Covers: ', bold: true, color: C.ink }, s.covers], fontSize: 8, color: C.body, margin: [0, 0, 0, 7] },
      { table: { widths: s.kpis.map(() => '*'), body: [s.kpis.map(k => ({ stack: [{ text: k[0], fontSize: 7.5, color: C.subtle }, { text: n(k[1]), fontSize: 14, bold: true, color: C[k[2]] || C.ink }], margin: [6, 4, 6, 4] }))] },
        layout: { hLineColor: () => C.border, vLineColor: () => C.border, hLineWidth: () => 0.7, vLineWidth: () => 0.7 }, margin: [0, 0, 0, 6] },
    ];
    s.blocks.forEach(b => {
      if (b.heading) content.push({ text: b.heading, bold: true, fontSize: 10.5, color: C.ink, margin: [0, 10, 0, 4], headlineLevel: 1 });
      if (!b.rows.length) { content.push({ text: b.empty || 'Nothing to show.', italics: true, fontSize: 9, color: C.faint, margin: [0, 2, 0, 4] }); return; }
      const cols = b.columns, body = [cols.map(c => ({ text: c.label, bold: true, fontSize: fs, color: '#ffffff', fillColor: C.ink, margin: [2, 3, 2, 3], alignment: c.num ? 'right' : 'left' }))];
      b.rows.forEach(r => {
        if (r._h) { body.push([{ text: r._h, colSpan: cols.length, bold: true, fontSize: fs + 0.8, color: C.ink, fillColor: C.band, margin: [3, 3, 3, 3] }, ...Array.from({ length: cols.length - 1 }, () => ({}))]); return; }
        body.push(cols.map((c, i) => {
          const v = r[i], blank = v == null || v === '', cell = { text: blank ? '—' : String(v), fontSize: fs, color: blank ? C.faint : C.ink, margin: [2, 2, 2, 2], alignment: c.num ? 'right' : 'left' };
          if (c.warn && c.warn(r)) Object.assign(cell, { color: C.orange, bold: true });
          if (r._b) Object.assign(cell, { bold: true, fillColor: C.band });
          return cell;
        }));
      });
      content.push({ table: { headerRows: 1, dontBreakRows: true, widths: cols.map(c => c.w || 'auto'), body },
        layout: { hLineWidth: i => i < 2 ? 0 : 0.4, vLineWidth: () => 0, hLineColor: () => C.line, fillColor: i => i > 0 && i % 2 === 0 ? C.zebra : null } });
    });
    const doc = {
      pageSize: 'A4', pageOrientation: s.landscape ? 'landscape' : 'portrait', pageMargins: [40, 30, 40, 40], content,
      // a section heading never sits alone at the foot of a page
      pageBreakBefore: (node, after) => node.headlineLevel === 1 && after.length < 8,
      defaultStyle: { font: 'Roboto', fontSize: 9, color: C.body, lineHeight: 1.12 },
      footer: (page, pages) => ({ margin: [40, 12, 40, 0], columns: [{ text: `Forest Volunteers  ·  ${s.title}  ·  Generated ${stamp()}`, fontSize: 7.5, color: C.faint },
        { text: `Page ${page} of ${pages}`, fontSize: 7.5, color: C.faint, alignment: 'right' }] }),
      info: { title: s.title, author: 'Directorate of Forests, West Bengal', creator: 'Forest Volunteers' },
    };
    await new Promise(ok => window.pdfMake.createPdf(doc).download(s.file + '.pdf', ok));
  }

  window.FV_DASH = { render };
})();
