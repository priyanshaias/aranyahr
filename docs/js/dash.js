// AranyaHR — the dashboard. State, circle and division views of the workforce (who is where) and of the
// divisions' progress (how much of each list is filled and verified), for every cadre or one at a time.
// Data: the "overview" action (every division × cadre) and, for one division, "home" (everyone, by range).
(function () {
  const API = window.HR_API, SH = () => window.HR_SHELL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = encodeURIComponent;
  const n = x => Number(x || 0).toLocaleString('en-IN');
  const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;

  // the eight cadres in a fixed colour order (validated for colour-blind separation; never re-assigned when filtering)
  const COL = { FR: '#2a78d6', DFR: '#eb6834', FG: '#1baf7a', FV: '#eda100', CDL: '#e87ba4', BS: '#008300', AS: '#6250d6', DEO: '#e34948' };
  const KS = Object.keys(COL);
  // progress stages, in UPMC's colours: verified green, partly verified light green, awaiting the admin violet, not yet grey
  const STAGES = [['done', 'Verified', 'var(--prelims)'], ['mid', 'Partly verified / ready', '#8fd19e'], ['wait', 'Awaiting the admin', 'var(--interview)'], ['todo', 'Not yet', '#d6d4cf']];
  // divisions by how much is verified (ordered: dark green = all, orange = far behind)
  const DIVST = [['complete', 'All verified', '#1d6b31'], ['high', '75–99% verified', '#2f9e44'], ['mid', '25–74% verified', '#8fd19e'], ['low', 'Under 25% verified', 'var(--optional)'], ['empty', 'No one listed', '#d6d4cf']];
  // green heat scale for "% verified" (light = none, dark = all)
  const HEAT = ['#eef8f0', '#dff3e2', '#b5e2bf', '#8fd19e', '#5bb672', '#2f9e44', '#1d6b31'];
  const heat = p => HEAT[Math.min(HEAT.length - 1, Math.floor(p / 100 * (HEAT.length - 1) + 0.0001))];

  const S = { data: null, home: {}, circle: '', division: '', cadre: '', view: 'progress', sort: 'low', tsort: { k: 'pct', dir: 1 } };
  const label = k => SH().CAD[k].label;

  /* ---------------- numbers ---------------- */
  const zero = () => ({ total: 0, done: 0, mid: 0, wait: 0, todo: 0, appr: 0, last: '' });
  const whenKey = s => { const m = /^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}))?/.exec(s || ''); return m ? m[3] + m[2] + m[1] + (m[4] || '00') + (m[5] || '00') : ''; };
  const ks = () => S.cadre ? [S.cadre] : KS;
  function add(a, x) { ['total', 'done', 'mid', 'wait', 'todo', 'appr'].forEach(f => a[f] += x[f] || 0); if (whenKey(x.last) > whenKey(a.last)) a.last = x.last; return a; }
  const ofRow = (r, list = ks()) => list.reduce((a, k) => r.c[k] ? add(a, r.c[k]) : a, zero());
  const ofRows = (rows, list = ks()) => rows.reduce((a, r) => add(a, ofRow(r, list)), zero());
  const stage = x => { if (!x.total) return 'empty'; const p = x.done / x.total; return p >= 1 ? 'complete' : p >= 0.75 ? 'high' : p >= 0.25 ? 'mid' : 'low'; };
  const notStarted = x => x.total && !(x.done + x.mid + x.wait);
  const daysSince = s => { const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(s || ''); return m ? Math.floor((Date.now() - new Date(+m[3], +m[2] - 1, +m[1])) / 864e5) : null; };
  const ago = s => { const d = daysSince(s); return d == null ? 'never' : d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 31 ? d + ' days ago' : d < 365 ? Math.round(d / 30) + ' months ago' : 'over a year ago'; };
  const AGE = [['today', 'Today', d => d === 0], ['week', 'This week', d => d > 0 && d <= 7], ['month', '8–30 days', d => d > 7 && d <= 30], ['older', 'Older', d => d > 30], ['never', 'Never', d => d == null]];

  /* ---------------- small pieces: bars, rings, donut, tooltips ---------------- */
  const tip = html => ` data-tip="${esc(html)}"`;
  const tipLines = (title, lines) => `<b>${esc(title)}</b>` + lines.map(([c, t, v]) => `<div class="hd-tl"><i style="background:${c || 'transparent'}${c ? '' : ';box-shadow:none'}"></i><span>${esc(t)}</span><b>${v}</b></div>`).join('');
  /** 100% stacked progress bar. */
  function progBar(x, title) {
    if (!x.total) return '<div class="hd-bar empty"></div>';
    const t = tip(tipLines(title, STAGES.map(([k, l, c]) => [c, l, `${n(x[k])} · ${pct(x[k], x.total)}%`])));
    return `<div class="hd-bar"${t}>${STAGES.map(([k, l, c]) => x[k] ? `<i style="flex:${x[k]} 1 0;background:${c}"></i>` : '').join('')}</div>`;
  }
  /** Stacked bar of people by cadre, as long as its total against max. */
  function mixBar(r, max, title) {
    const parts = ks().map(k => [k, r.c[k] ? r.c[k].total : 0]).filter(p => p[1]), tot = parts.reduce((a, p) => a + p[1], 0);
    if (!tot) return '<div class="hd-bar empty"></div>';
    const t = tip(tipLines(title + ' · ' + n(tot), parts.map(([k, v]) => [COL[k], label(k), `${n(v)} · ${pct(v, tot)}%`])));
    return `<div class="hd-track"><div class="hd-bar" style="width:${Math.max(2, tot / max * 100)}%"${t}>${parts.map(([k, v]) => `<i style="flex:${v} 1 0;background:${COL[k]}"></i>`).join('')}</div></div>`;
  }
  const ring = (p, size) => `<span class="ring${size ? ' ' + size : ''}" style="--p:${p}"><i>${p}%</i></span>`;
  const legend = items => `<div class="hd-legend">${items.map(([c, t]) => `<span><i style="background:${c}"></i>${esc(t)}</span>`).join('')}</div>`;
  function donut(parts, center, sub) {
    const tot = parts.reduce((a, p) => a + p.v, 0) || 1, R = 52, C = 2 * Math.PI * R;
    let off = 0;
    const segs = parts.filter(p => p.v).map(p => {
      const len = p.v / tot * C, gap = parts.filter(q => q.v).length > 1 ? 2 : 0;
      const s = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${p.c}" stroke-width="16" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}"
        transform="rotate(-90 70 70)" class="hd-seg"${tip(tipLines(p.t, [[p.c, 'Divisions', `${n(p.v)} · ${pct(p.v, tot)}%`]]))}${p.go ? ` data-go="${esc(p.go)}"` : ''}/>`;
      off += len; return s;
    }).join('');
    return `<svg viewBox="0 0 140 140" class="hd-donut" role="img" aria-label="${esc(center + ' ' + sub)}"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--track)" stroke-width="16"/>${segs}
      <text x="70" y="68" text-anchor="middle" class="hd-dnum">${esc(center)}</text><text x="70" y="86" text-anchor="middle" class="hd-dsub">${esc(sub)}</text></svg>`;
  }
  // one tooltip for every chart: any element with data-tip
  let tipEl = null;
  document.addEventListener('mousemove', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { if (tipEl) tipEl.hidden = true; return; }
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'hd-tip'; document.body.appendChild(tipEl); }
    if (tipEl._for !== t) { tipEl.innerHTML = t.dataset.tip; tipEl._for = t; }
    tipEl.hidden = false;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight, x = Math.min(e.clientX + 14, innerWidth - w - 8), y = e.clientY + h + 22 > innerHeight ? e.clientY - h - 12 : e.clientY + 16;
    tipEl.style.transform = `translate(${x}px,${y}px)`;
  });
  document.addEventListener('scroll', () => { if (tipEl) tipEl.hidden = true; }, true);

  /* ---------------- url and data ---------------- */
  function readUrl() {
    const q = new URLSearchParams(location.hash.split('?')[1] || ''), u = API.user;
    S.circle = q.get('circle') || ''; S.division = q.get('division') || ''; S.cadre = KS.includes(q.get('cadre')) ? q.get('cadre') : '';
    S.view = q.get('view') === 'workforce' ? 'workforce' : 'progress'; S.sort = ['low', 'size', 'az'].includes(q.get('sort')) ? q.get('sort') : 'low';
    if (!u.isAdmin && u.level === 'Circle') S.circle = u.circle;
  }
  function saveUrl() {
    const p = new URLSearchParams();
    [['circle', S.circle], ['division', S.division], ['cadre', S.cadre], ['view', S.view === 'progress' ? '' : S.view], ['sort', S.sort === 'low' ? '' : S.sort]].forEach(([k, v]) => { if (v) p.set(k, v); });
    history.replaceState(null, '', '#/dash' + (p.toString() ? '?' + p : ''));
  }
  const set = patch => { Object.assign(S, patch); saveUrl(); draw(); };
  async function loadHome(d) {
    if (!S.home[d]) S.home[d] = await SH().guard(() => API.call('home', { division: d }));
    return S.home[d];
  }

  /* ---------------- page ---------------- */
  let app;
  async function render(el, force) {
    app = el; readUrl();
    if (!S.data || force) { app.innerHTML = SH().loader('Building the dashboard…', 'Counting every division and cadre…'); S.data = await SH().guard(() => API.call('overview')); S.home = {}; }
    draw();
  }
  function scopeRows() { return S.data.rows.filter(r => (!S.circle || r.circle === S.circle) && (!S.division || r.division === S.division)); }

  async function draw() {
    const u = API.user, rows = S.data.rows, circles = [...new Set(rows.map(r => r.circle))];
    if (S.circle && !circles.includes(S.circle)) S.circle = '';
    if (S.division && !rows.some(r => r.division === S.division && (!S.circle || r.circle === S.circle))) S.division = '';
    const inScope = scopeRows(), divs = rows.filter(r => r.circle === S.circle), tot = ofRows(inScope);
    const where = S.division ? S.division + ' division' : S.circle ? S.circle + ' circle' : 'West Bengal';
    const circleFixed = !u.isAdmin && u.level === 'Circle';
    const allTot = ofRows(inScope, KS);
    app.innerHTML = `<div class="dash hd">
      <div class="head"><div><h1 class="page-title">${esc(where)}.</h1>
        <p class="page-sub">${n(tot.total)} ${S.cadre ? esc(label(S.cadre)) : 'people in all cadres'}${S.division ? '' : ` · ${inScope.length} division${inScope.length === 1 ? '' : 's'}`} · ${pct(tot.done, tot.total)}% verified · data as of ${esc(S.data.builtAt || 'now')}</p></div>
        <span class="sp"></span><div class="dash-actions"><button class="btn sm" id="hdRefresh">↻ Refresh</button><button class="btn sm" id="hdCsv">↓ CSV</button></div></div>
      <div class="hd-filters">
        <div class="hd-scope"><span class="faint">View</span>
          <button class="hd-crumb ${!S.circle ? 'on' : ''}" data-scope="state" ${circleFixed ? 'disabled' : ''}>State</button><span class="sep">›</span>
          <select id="hdC" class="hr-select" ${circleFixed ? 'disabled' : ''}><option value="">All circles</option>${circles.map(c => `<option ${c === S.circle ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><span class="sep">›</span>
          <select id="hdD" class="hr-select" ${S.circle ? '' : 'disabled'}><option value="">${S.circle ? 'All divisions' : 'Division'}</option>${divs.map(r => `<option ${r.division === S.division ? 'selected' : ''}>${esc(r.division)}</option>`).join('')}</select></div>
        <div class="seg hr-seg hd-view"><button data-view="progress" class="${S.view === 'progress' ? 'on' : ''}">Progress</button><button data-view="workforce" class="${S.view === 'workforce' ? 'on' : ''}">Workforce</button></div>
        <div class="chips hd-cadres"><button class="chip ${!S.cadre ? 'on' : ''}" data-cadre="">All cadres<span class="n">${n(allTot.total)}</span></button>
          ${KS.map(k => { const x = ofRows(inScope, [k]); return `<button class="chip ${S.cadre === k ? 'on' : ''}" data-cadre="${k}" title="${esc(label(k))}"><i class="hd-dot" style="background:${COL[k]}"></i>${k}<span class="n">${n(x.total)}</span></button>`; }).join('')}</div>
      </div>
      <div id="hdBody"></div></div>`;
    $('#hdRefresh').onclick = () => render(app, true);
    $('#hdCsv').onclick = csv;
    app.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => set({ circle: '', division: '' }));
    $('#hdC').onchange = e => set({ circle: e.target.value, division: '' });
    $('#hdD').onchange = e => set({ division: e.target.value });
    app.querySelectorAll('[data-view]').forEach(b => b.onclick = () => set({ view: b.dataset.view }));
    app.querySelectorAll('[data-cadre]').forEach(b => b.onclick = () => set({ cadre: b.dataset.cadre }));
    const body = $('#hdBody');
    if (S.division) {
      body.innerHTML = SH().loader(`Opening ${S.division}…`, 'Collecting every cadre’s list…');
      const h = await loadHome(S.division);
      if (S.division !== h.division) return;
      body.innerHTML = S.view === 'workforce' ? divisionWorkforce(h, inScope[0]) : divisionProgress(h, inScope[0]);
    } else body.innerHTML = S.view === 'workforce' ? workforce(inScope) : progress(inScope);
    wire(body);
  }
  function wire(el) {
    el.querySelectorAll('[data-drill]').forEach(x => { x.onclick = () => { const [c, d] = x.dataset.drill.split('|'); set(d ? { circle: c, division: d } : { circle: c, division: '' }); }; x.onkeydown = e => { if (e.key === 'Enter') x.onclick(); }; });
    el.querySelectorAll('[data-go]').forEach(x => x.onclick = () => { location.hash = x.dataset.go; });
    el.querySelectorAll('[data-setcadre]').forEach(x => x.onclick = () => set({ cadre: x.dataset.setcadre }));
    el.querySelectorAll('[data-sort]').forEach(x => x.onclick = () => set({ sort: x.dataset.sort }));
    el.querySelectorAll('[data-tsort]').forEach(x => x.onclick = () => { const k = x.dataset.tsort; S.tsort = { k, dir: S.tsort.k === k ? -S.tsort.dir : 1 }; draw(); });
    el.querySelectorAll('[data-open]').forEach(x => x.onclick = () => openCadre(x.dataset.open));
  }
  function openCadre(k) {
    const h = S.home[S.division], c = SH().CAD[k];
    if (c.tab) try { localStorage.setItem(c.tab[0], c.tab[1]); } catch (e) {}
    API.setRange(null);
    location.href = SH().pageOf(c, h && h.own);
  }

  /* ---------------- state and circle: progress ---------------- */
  // the units the ranked charts show: circles (state view) or divisions (circle view)
  function units(rows) {
    if (S.circle) return rows.map(r => ({ name: r.division, drill: r.circle + '|' + r.division, rows: [r], x: ofRow(r), r }));
    const by = {}; rows.forEach(r => (by[r.circle] = by[r.circle] || []).push(r));
    return Object.keys(by).map(c => ({ name: c, drill: c, rows: by[c], x: ofRows(by[c]), r: null }));
  }
  const sorter = (a, b) => S.sort === 'az' ? a.name.localeCompare(b.name) : S.sort === 'size' ? b.x.total - a.x.total
    : (pct(a.x.done, a.x.total) - pct(b.x.done, b.x.total)) || (b.x.total - a.x.total);
  const sortSeg = (list = [['low', 'Lowest first'], ['size', 'Largest'], ['az', 'A–Z']]) => `<div class="seg hd-sortseg">${list.map(([k, t]) => `<button data-sort="${k}" class="${S.sort === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;

  function progress(rows) {
    const t = ofRows(rows), st = {}; DIVST.forEach(([k]) => st[k] = []);
    rows.forEach(r => st[stage(ofRow(r))].push(r));
    const listed = rows.length - st.empty.length, users = rows.filter(r => r.users).length, ns = rows.filter(r => notStarted(ofRow(r)));
    const stale = rows.filter(r => { const x = ofRow(r), d = daysSince(x.last); return x.total && x.done < x.total && (d == null || d > 7); });
    const U = units(rows).sort(sorter), kind = S.circle ? 'division' : 'circle';
    const age = AGE.map(([k, l, f]) => [k, l, rows.filter(r => ofRow(r).total && f(daysSince(ofRow(r).last)))]);
    const amax = Math.max(1, ...age.map(a => a[2].length));
    const kpi = (cls, title, big, small, p) => `<div class="kpi dkpi ${cls}"><span>${title}</span><b>${big}</b><small>${small}</small>${p == null ? '' : `<i class="kbar"><em style="width:${p}%"></em></i>`}</div>`;
    return `
      <div class="kpis hd-kpis">
        ${kpi('good', 'Verified', pct(t.done, t.total) + '%', `${n(t.done)} of ${n(t.total)} people`, pct(t.done, t.total))}
        ${kpi('good', 'Divisions complete', `${st.complete.length}<small> / ${listed}</small>`, 'everyone listed is verified', pct(st.complete.length, listed))}
        ${kpi('warn', 'Not started', ns.length, 'divisions with people listed, nothing done yet', pct(ns.length, listed))}
        ${kpi('violet', 'Awaiting the admin', n(t.appr), API.user.isAdmin ? '<a href="#/approvals">open approvals ›</a>' : 'changes sent by divisions')}
        ${kpi('blue', 'Divisions with a user', `${users}<small> / ${rows.length}</small>`, 'active AranyaHR sign-in', pct(users, rows.length))}
        ${kpi('hot', 'No save for 7+ days', stale.length, 'divisions not finished', pct(stale.length, listed || 1))}
      </div>
      <div class="hd-grid">
        <section class="chart hd-wide"><div class="chart-h"><h3>Progress by ${kind}</h3>${sortSeg()}</div>
          ${legend(STAGES.map(s => [s[2], s[1]]))}
          <div class="hd-rank">${U.map(x => `<div class="hd-row" data-drill="${esc(x.drill)}" tabindex="0" role="button">
            <div class="hd-name"><b>${esc(x.name)}</b><small>${n(x.x.total)} people${x.r ? ` · ${x.r.users ? x.r.users + ' user' + (x.r.users > 1 ? 's' : '') : '<span class="hd-warn">no user</span>'}` : ` · ${x.rows.length} division${x.rows.length === 1 ? '' : 's'}`} · saved ${esc(ago(x.x.last))}</small></div>
            ${progBar(x.x, x.name)}<div class="hd-pct">${x.x.total ? pct(x.x.done, x.x.total) + '%' : '—'}</div></div>`).join('') || '<p class="faint">No divisions here.</p>'}</div></section>
        <div class="hd-col">
          <section class="chart"><h3>Divisions by % verified</h3><div class="hd-donutwrap">${donut(DIVST.map(([k, l, c]) => ({ t: l, v: st[k].length, c })), (st.complete.length + st.high.length) + ' / ' + listed, '75%+ verified')}
            <div class="hd-dleg">${DIVST.map(([k, l, c]) => `<div${tip(tipLines(l, st[k].slice(0, 12).map(r => ['', r.division, pct(ofRow(r).done, ofRow(r).total) + '%']).concat(st[k].length > 12 ? [['', '…and ' + (st[k].length - 12) + ' more', '']] : [])))}><i style="background:${c}"></i><span>${l}</span><b>${st[k].length}</b></div>`).join('')}</div></div></section>
          <section class="chart"><h3>Last save in the division</h3><p class="faint hd-note">Divisions with people listed, by their latest change in any cadre in view.</p>
            <div class="hd-hist">${age.map(([k, l, list]) => `<div class="hd-hcol"${tip(tipLines(l + ' · ' + list.length + ' divisions', list.slice(0, 12).map(r => ['', r.division, esc(ago(ofRow(r).last))]).concat(list.length > 12 ? [['', '…and ' + (list.length - 12) + ' more', '']] : [])))}>
              <b>${list.length}</b><div class="hd-hbar"><i style="height:${list.length / amax * 100}%;background:${k === 'never' || k === 'older' ? 'var(--optional)' : '#2a78d6'}"></i></div><span>${l}</span></div>`).join('')}</div></section>
        </div>
      </div>
      ${heatmap(rows)}
      ${cadreCards(rows)}
      ${table(rows)}`;
  }
  function heatmap(rows) {
    const byC = {}; rows.forEach(r => (byC[r.circle] = byC[r.circle] || []).push(r));
    const cell = (r, k) => { const x = r.c[k]; if (!x || !x.total) return `<td class="hd-hc none"${tip(tipLines(r.division + ' · ' + k, [['', 'No one listed', '']]))}>·</td>`;
      const p = pct(x.done, x.total); return `<td class="hd-hc${S.cadre && S.cadre !== k ? ' dim' : ''}" style="background:${heat(p)};color:${p >= 72 ? '#fff' : 'var(--ink)'}"
        ${tip(tipLines(r.division + ' · ' + label(k), STAGES.map(([f, l, c]) => [c, l, n(x[f])]).concat([['', 'Last save', esc(ago(x.last))]])))} data-drill="${esc(r.circle + '|' + r.division)}">${p}</td>`; };
    return `<section class="chart hd-block"><div class="chart-h"><h3>Division × cadre · % verified</h3>
        <div class="hd-scale"><span>0%</span>${HEAT.map(c => `<i style="background:${c}"></i>`).join('')}<span>100%</span><span class="hd-none">· no one listed</span></div></div>
      <div class="tscroll hd-heatwrap"><table class="hd-heat"><thead><tr><th>Division</th>${KS.map(k => `<th${tip(esc(label(k)))}><i class="hd-dot" style="background:${COL[k]}"></i>${k}</th>`).join('')}<th>All</th></tr></thead><tbody>
        ${Object.keys(byC).map(c => `${S.circle ? '' : `<tr class="hd-grp"><td colspan="${KS.length + 2}">${esc(c)}</td></tr>`}
          ${byC[c].map(r => { const a = ofRow(r, KS); return `<tr><td class="hd-dn" data-drill="${esc(r.circle + '|' + r.division)}">${esc(r.division)}</td>${KS.map(k => cell(r, k)).join('')}
            <td class="hd-all">${a.total ? pct(a.done, a.total) + '%' : '—'}</td></tr>`; }).join('')}`).join('')}
      </tbody></table></div></section>`;
  }
  function cadreCards(rows) {
    return `<section class="hd-block"><h3 class="hd-h3">By cadre</h3><div class="hd-cards">${KS.map(k => {
      const x = ofRows(rows, [k]), none = rows.filter(r => !r.c[k] || !r.c[k].total).length, ns = rows.filter(r => r.c[k] && notStarted(r.c[k])).length;
      return `<button class="hd-card${S.cadre === k ? ' on' : ''}${x.total ? '' : ' empty'}" data-setcadre="${S.cadre === k ? '' : k}" style="--c:${COL[k]}">
        <div class="hd-ch">${ring(pct(x.done, x.total), 'sm')}<div><b>${esc(label(k))}</b><small>${n(x.total)} people · ${n(x.done)} ${k === 'FV' ? 'complete' : 'verified'}</small></div></div>
        ${progBar(x, label(k))}
        <small class="hd-foot">${ns ? `<span class="hd-warn">${ns} not started</span> · ` : ''}${none ? `${none} division${none > 1 ? 's' : ''} with no one listed` : 'listed in every division'}</small></button>`;
    }).join('')}</div></section>`;
  }
  function table(rows) {
    const list = rows.map(r => { const x = ofRow(r); return { r, x, p: x.total ? pct(x.done, x.total) : -1, d: daysSince(x.last) }; });
    const key = { name: o => o.r.division, circle: o => o.r.circle + o.r.division, total: o => o.x.total, pct: o => o.p, appr: o => o.x.appr, users: o => o.r.users, last: o => o.d == null ? 1e9 : o.d };
    const f = key[S.tsort.k] || key.pct; list.sort((a, b) => { const A = f(a), B = f(b); return (A > B ? 1 : A < B ? -1 : 0) * S.tsort.dir; });
    const th = (k, t, cls) => `<th class="${cls || ''}${S.tsort.k === k ? ' sorted' : ''}" data-tsort="${k}">${t}${S.tsort.k === k ? (S.tsort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
    const pill = s => { const d = DIVST.find(x => x[0] === s); return `<span class="hd-st"><i style="background:${d[2]}"></i>${d[1]}</span>`; };
    return `<section class="tablecard hd-block"><div class="chart-h hd-tabh"><h3>Every division</h3><span class="faint">Click a column to sort, a row to open the division.</span></div>
      <div class="tscroll"><table class="dtable"><thead><tr>${th('name', 'Division')}${S.circle ? '' : th('circle', 'Circle')}${th('total', 'People', 'r')}${th('pct', 'Verified', 'r')}<th>Progress</th>${th('appr', 'Awaiting admin', 'r')}${th('users', 'Users', 'r')}${th('last', 'Last save')}<th>Status</th></tr></thead><tbody>
      ${list.map(o => `<tr data-drill="${esc(o.r.circle + '|' + o.r.division)}"><td class="tn">${esc(o.r.division)}</td>${S.circle ? '' : `<td>${esc(o.r.circle)}</td>`}<td class="r num">${n(o.x.total)}</td>
        <td class="r num"><b>${o.p < 0 ? '—' : o.p + '%'}</b></td><td style="min-width:140px">${progBar(o.x, o.r.division)}</td><td class="r num">${o.x.appr ? `<b class="hd-viol">${o.x.appr}</b>` : '0'}</td>
        <td class="r num">${o.r.users ? o.r.users : '<span class="hd-warn">0</span>'}</td><td class="faint">${esc(ago(o.x.last))}</td><td>${pill(stage(o.x))}</td></tr>`).join('')}
      </tbody></table></div></section>`;
  }

  /* ---------------- state and circle: workforce ---------------- */
  function workforce(rows) {
    if (S.sort === 'low') S.sort = 'size';   // the workforce lists start with the largest
    const t = ofRows(rows), all = ofRows(rows, KS), U = units(rows).sort((a, b) => S.sort === 'az' ? a.name.localeCompare(b.name) : b.x.total - a.x.total);
    const comb = u => ({ c: KS.reduce((a, k) => { a[k] = u.rows.reduce((s, r) => add(s, r.c[k] || zero()), zero()); return a; }, {}) });
    const max = Math.max(1, ...U.map(u => u.x.total)), kind = S.circle ? 'division' : 'circle';
    const groups = [['Officers', ['FR', 'DFR', 'FG'], 'FR, DR/Fr, FG/HFG'], ['Forest Volunteers', ['FV'], 'engaged by divisions'], ['DL / CDL', ['CDL'], 'daily and casual labourers'], ['Ban Sahayak, Aranya Sathi, DEO', ['BS', 'AS', 'DEO'], 'engaged by divisions']];
    const per = rows.length ? Math.round(all.total / rows.length) : 0;
    const cad = KS.map(k => [k, ofRows(rows, [k]).total]), cmax = Math.max(1, ...cad.map(c => c[1]));
    const gaps = KS.map(k => [k, rows.filter(r => !r.c[k] || !r.c[k].total)]);
    return `
      <div class="kpis hd-kpis">
        <div class="kpi dkpi muted"><span>People listed</span><b>${n(t.total)}</b><small>${S.cadre ? esc(label(S.cadre)) : 'all cadres'} · about ${n(S.cadre ? Math.round(t.total / (rows.length || 1)) : per)} per division</small></div>
        ${groups.map(([g, list, sub]) => { const x = ofRows(rows, list); return `<div class="kpi dkpi"><span>${g}</span><b>${n(x.total)}</b><small>${sub} · ${pct(x.total, all.total)}% of all</small>
          <i class="kbar hd-kmix">${list.map(k => { const v = ofRows(rows, [k]).total; return v ? `<em style="flex:${v} 1 0;background:${COL[k]}"></em>` : ''; }).join('')}</i></div>`; }).join('')}
      </div>
      <div class="hd-grid">
        <section class="chart hd-wide"><div class="chart-h"><h3>People by ${kind}</h3>${sortSeg([['size', 'Largest'], ['az', 'A–Z']])}</div>
          ${legend(ks().map(k => [COL[k], k + ' · ' + label(k)]))}
          <div class="hd-rank">${U.map(u => `<div class="hd-row" data-drill="${esc(u.drill)}" tabindex="0" role="button"><div class="hd-name"><b>${esc(u.name)}</b><small>${S.circle ? 'Division' : u.rows.length + ' division' + (u.rows.length === 1 ? '' : 's')}</small></div>
            ${mixBar(comb(u), max, u.name)}<div class="hd-pct">${n(u.x.total)}</div></div>`).join('')}</div></section>
        <div class="hd-col">
          <section class="chart"><h3>People by cadre</h3><div class="hd-cbars">${cad.map(([k, v]) => `<div class="hd-cbar${S.cadre && S.cadre !== k ? ' dim' : ''}" data-setcadre="${S.cadre === k ? '' : k}"${tip(tipLines(label(k), [[COL[k], 'People', n(v)], ['', 'Share', pct(v, all.total) + '%']]))}>
            <span>${k}</span><div><i style="width:${Math.max(v ? 1.5 : 0, v / cmax * 100)}%;background:${COL[k]}"></i></div><b>${n(v)}</b></div>`).join('')}</div></section>
          <section class="chart"><h3>Where no one is listed yet</h3><p class="faint hd-note">Divisions with nobody entered for the cadre. Point at a bar to see which.</p>
            <div class="hd-cbars">${gaps.map(([k, list]) => `<div class="hd-cbar"${tip(tipLines(label(k) + ' · ' + list.length + ' divisions', list.slice(0, 14).map(r => ['', r.division, esc(r.circle)]).concat(list.length > 14 ? [['', '…and ' + (list.length - 14) + ' more', '']] : [])))}>
              <span>${k}</span><div><i style="width:${list.length / (rows.length || 1) * 100}%;background:var(--optional)"></i></div><b>${list.length}<small> / ${rows.length}</small></b></div>`).join('')}</div></section>
        </div>
      </div>
      ${countTable(rows)}`;
  }
  function countTable(rows) {
    const list = rows.slice().sort((a, b) => ofRow(b, KS).total - ofRow(a, KS).total), sum = ofRows(rows, KS);
    return `<section class="tablecard hd-block"><div class="chart-h hd-tabh"><h3>People in each division, by cadre</h3><span class="faint">Click a row to open the division.</span></div>
      <div class="tscroll"><table class="dtable hd-counts"><thead><tr><th>Division</th>${S.circle ? '' : '<th>Circle</th>'}${KS.map(k => `<th class="r${S.cadre === k ? ' sorted' : ''}"><i class="hd-dot" style="background:${COL[k]}"></i>${k}</th>`).join('')}<th class="r">All</th></tr></thead><tbody>
      ${list.map(r => `<tr data-drill="${esc(r.circle + '|' + r.division)}"><td class="tn">${esc(r.division)}</td>${S.circle ? '' : `<td>${esc(r.circle)}</td>`}${KS.map(k => `<td class="r num${S.cadre && S.cadre !== k ? ' faint' : ''}">${r.c[k] && r.c[k].total ? n(r.c[k].total) : '<span class="faint">·</span>'}</td>`).join('')}<td class="r num"><b>${n(ofRow(r, KS).total)}</b></td></tr>`).join('')}
      <tr class="hd-sum"><td class="tn">Total</td>${S.circle ? '' : '<td></td>'}${KS.map(k => `<td class="r num">${n(ofRows(rows, [k]).total)}</td>`).join('')}<td class="r num"><b>${n(sum.total)}</b></td></tr>
      </tbody></table></div></section>`;
  }

  /* ---------------- one division ---------------- */
  const bucket = s => ({ verified: 'done', added: 'done', confirmed: 'done', partial: 'mid', ready: 'mid', pending: 'wait', remove: 'wait' }[s] || 'todo');
  function byRange(h, everyCadre) {
    const people = h.people.filter(p => everyCadre || !S.cadre || p.cadre === S.cadre), order = ['Div HQ'].concat(h.ranges.filter(r => r !== 'Div HQ'), ['Range not matched']);
    const by = {}; people.forEach(p => { const x = by[p.range] = by[p.range] || { name: p.range, x: zero(), c: {} }; x.x.total++; x.x[bucket(p.status)]++; const c = x.c[p.cadre] = x.c[p.cadre] || zero(); c.total++; c[bucket(p.status)]++; });
    return order.filter(r => by[r]).map(r => by[r]).concat(Object.keys(by).filter(r => !order.includes(r)).map(r => by[r]));
  }
  function divisionHead(h, r) {
    const x = ofRow(r), stl = stage(x);
    return `<div class="hd-divhead"><div class="hd-dbig">${ring(pct(x.done, x.total))}<div><b>${n(x.done)} of ${n(x.total)} verified</b><small>${S.cadre ? esc(label(S.cadre)) : 'all cadres'} · last save ${esc(ago(x.last))}</small></div></div>
      <div class="hd-dfacts"><span><b>${h.ranges.length}</b> ranges</span><span><b class="hd-viol">${x.appr}</b> awaiting the admin</span><span><b class="${r.users ? '' : 'hd-warn'}">${r.users}</b> AranyaHR user${r.users === 1 ? '' : 's'}</span>
        <span class="hd-st"><i style="background:${DIVST.find(d => d[0] === stl)[2]}"></i>${DIVST.find(d => d[0] === stl)[1]}</span></div>
      <a class="btn soft" href="#/d/${enc(h.division)}">Open the division’s people ›</a></div>`;
  }
  function divisionProgress(h, r) {
    const ranges = byRange(h);
    return `${divisionHead(h, r)}
      <div class="hd-grid hd-even">
        <section class="chart"><h3>By cadre</h3>${legend(STAGES.map(s => [s[2], s[1]]))}
          <div class="hd-rank">${ks().filter(k => r.c[k] && r.c[k].total).map(k => { const x = r.c[k]; return `<div class="hd-row" data-open="${k}" tabindex="0" role="button" title="Open ${esc(label(k))}">
            <div class="hd-name"><b><i class="hd-dot" style="background:${COL[k]}"></i>${esc(label(k))}</b><small>${n(x.total)} · saved ${esc(ago(x.last))}${x.appr ? ` · <span class="hd-viol">${x.appr} awaiting admin</span>` : ''}</small></div>
            ${progBar(x, label(k))}<div class="hd-pct">${pct(x.done, x.total)}%</div></div>`; }).join('') || '<p class="faint">No one listed yet.</p>'}</div>
          ${ks().filter(k => !r.c[k] || !r.c[k].total).length ? `<p class="faint hd-note">No one listed yet: ${ks().filter(k => !r.c[k] || !r.c[k].total).map(k => esc(label(k))).join(', ')}.</p>` : ''}</section>
        <section class="chart"><h3>By range</h3>${legend(STAGES.map(s => [s[2], s[1]]))}
          <div class="hd-rank">${ranges.map(g => `<div class="hd-row"><div class="hd-name"><b>${esc(g.name)}</b><small>${n(g.x.total)} people</small></div>${progBar(g.x, g.name)}<div class="hd-pct">${pct(g.x.done, g.x.total)}%</div></div>`).join('') || '<p class="faint">No one listed yet.</p>'}</div></section>
      </div>
      ${rangeHeat(h, byRange(h, true))}`;
  }
  /** Range × cadre, % verified: where in the division the work is left. */
  function rangeHeat(h, ranges) {
    const present = KS.filter(k => h.people.some(p => p.cadre === k));
    if (!ranges.length) return '';
    const cell = (g, k) => { const x = g.c[k]; if (!x) return '<td class="hd-hc none">·</td>';
      const p = pct(x.done, x.total); return `<td class="hd-hc${S.cadre && S.cadre !== k ? ' dim' : ''}" style="background:${heat(p)};color:${p >= 72 ? '#fff' : 'var(--ink)'};cursor:default"
        ${tip(tipLines(g.name + ' · ' + label(k), STAGES.map(([f, l, c]) => [c, l, n(x[f])])))}>${p}</td>`; };
    return `<section class="chart hd-block"><div class="chart-h"><h3>Range × cadre · % verified</h3>
        <div class="hd-scale"><span>0%</span>${HEAT.map(c => `<i style="background:${c}"></i>`).join('')}<span>100%</span><span class="hd-none">· no one listed</span></div></div>
      <div class="tscroll"><table class="hd-heat"><thead><tr><th>Range</th>${present.map(k => `<th${tip(esc(label(k)))}><i class="hd-dot" style="background:${COL[k]}"></i>${k}</th>`).join('')}<th>All</th></tr></thead><tbody>
        ${ranges.map(g => `<tr><td class="hd-dn" style="cursor:default">${esc(g.name)}</td>${present.map(k => cell(g, k)).join('')}<td class="hd-all">${pct(g.x.done, g.x.total)}%</td></tr>`).join('')}
      </tbody></table></div></section>`;
  }
  function divisionWorkforce(h, r) {
    const ranges = byRange(h), max = Math.max(1, ...ranges.map(g => g.x.total)), present = KS.filter(k => h.people.some(p => p.cadre === k));
    return `${divisionHead(h, r)}
      <div class="hd-grid hd-even">
        <section class="chart"><h3>People by range</h3>${legend(ks().filter(k => present.includes(k)).map(k => [COL[k], k + ' · ' + label(k)]))}
          <div class="hd-rank">${ranges.map(g => `<div class="hd-row"><div class="hd-name"><b>${esc(g.name)}</b></div>${mixBar(g, max, g.name)}<div class="hd-pct">${n(g.x.total)}</div></div>`).join('') || '<p class="faint">No one listed yet.</p>'}</div></section>
        <section class="chart"><h3>People by cadre</h3><div class="hd-cbars">${KS.map(k => { const v = r.c[k] ? r.c[k].total : 0, m = Math.max(1, ...KS.map(q => r.c[q] ? r.c[q].total : 0));
          return `<div class="hd-cbar${S.cadre && S.cadre !== k ? ' dim' : ''}" data-open="${k}" title="Open ${esc(label(k))}"><span>${k}</span><div><i style="width:${Math.max(v ? 1.5 : 0, v / m * 100)}%;background:${COL[k]}"></i></div><b>${n(v)}</b></div>`; }).join('')}</div></section>
      </div>
      <section class="tablecard hd-block"><div class="chart-h hd-tabh"><h3>Range × cadre</h3></div><div class="tscroll"><table class="dtable hd-counts"><thead><tr><th>Range</th>${present.map(k => `<th class="r"><i class="hd-dot" style="background:${COL[k]}"></i>${k}</th>`).join('')}<th class="r">All</th></tr></thead><tbody>
        ${ranges.map(g => `<tr><td class="tn">${esc(g.name)}</td>${present.map(k => `<td class="r num">${g.c[k] ? n(g.c[k].total) : '<span class="faint">·</span>'}</td>`).join('')}<td class="r num"><b>${n(g.x.total)}</b></td></tr>`).join('')}
      </tbody></table></div></section>`;
  }

  /* ---------------- CSV of what is in view ---------------- */
  function csv() {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const head = ['Circle', 'Division', 'Cadre', 'People', 'Verified', 'Partly verified / ready', 'Awaiting the admin', 'Not yet', 'Changes awaiting admin', 'Last save', 'Division users'];
    const lines = [head.map(q).join(',')];
    scopeRows().forEach(r => ks().forEach(k => { const x = r.c[k] || zero(); lines.push([r.circle, r.division, label(k), x.total, x.done, x.mid, x.wait, x.todo, x.appr, x.last, r.users].map(q).join(',')); }));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }));
    a.download = 'AranyaHR ' + (S.division || S.circle || 'West Bengal') + (S.cadre ? ' ' + S.cadre : '') + '.csv';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  window.HR_DASH = { render };
})();
