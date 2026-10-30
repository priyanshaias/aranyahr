// AranyaHR — the one header on every page. On a cadre's page (officers, FV, CDL+BS) that app's own bar sits below it as a sub-header.
// Dashboard ▾: Division wise, or Cadre wise › FR / DR / FG · DL / CDL and BS · FV · Aranya Sathi and DEO.
(function () {
  const API = window.HR_API;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // each cadre page: its dashboard (admins) and its lists (everyone else)
  const CADRE_PAGES = [
    ['FR · DR/Fr · FG/HFG', 'officers.html#/dash', 'officers.html#/', 'officers'],
    ['DL / CDL and Ban Sahayak', 'cdl.html#/', 'cdl.html#/', 'cdl'],
    ['Forest Volunteers', 'fv.html#/admin', 'fv.html#/', 'fv'],
    ['Aranya Sathi and DEO', 'cdl.html?set=sathi#/', 'cdl.html?set=sathi#/', 'sathi'],
  ];
  const page = () => { const p = location.pathname.split('/').pop() || 'index.html'; return p === 'cdl.html' && /set=sathi/.test(location.search) ? 'sathi' : p.replace('.html', ''); };

  function render() {
    const el = document.getElementById('hrTop'); if (!el) return;
    const u = API.user, here = page(), hash = location.hash;
    const sub = document.querySelector('.topbar.hr-sub');
    document.documentElement.classList.toggle('hr-subbed', !!sub);
    const viewer = u && (u.isAdmin || u.level !== 'Division');
    const on = (cond) => cond ? ' on' : '';
    const dashOn = here === 'index' ? /^#\/dash/.test(hash) : here !== 'index';
    const items = u ? [
      `<a class="hr-link${on(here === 'index' && !/^#\/(dash|approvals|users|ranges|settings)/.test(hash))}" href="index.html#/">Home</a>`,
      viewer ? `<div class="hr-dd"><button class="hr-link${on(dashOn)}" data-hr-dd aria-haspopup="true" aria-expanded="false">Dashboard <span aria-hidden="true">▾</span></button>
        <div class="hr-menu" role="menu">
          <a role="menuitem" href="index.html#/dash" class="${here === 'index' && /^#\/dash(?!.*by=cadre)/.test(hash) ? 'on' : ''}"><b>Division wise</b><small>State, circle and division: progress and people</small></a>
          <div class="hr-mh">Cadre wise</div>
          ${CADRE_PAGES.map(([t, dash, list, k]) => `<a role="menuitem" href="${u.isAdmin ? dash : list}" class="hr-sub-item${here === k ? ' on' : ''}">${esc(t)}</a>`).join('')}
          <a role="menuitem" href="index.html#/dash?by=cadre" class="hr-sub-item hr-faint${/by=cadre/.test(hash) ? ' on' : ''}">All cadres at a glance</a>
        </div></div>`
      : `<div class="hr-dd"><button class="hr-link${on(here !== 'index')}" data-hr-dd aria-haspopup="true" aria-expanded="false">Lists <span aria-hidden="true">▾</span></button>
        <div class="hr-menu" role="menu"><div class="hr-mh">${esc(u.division || '')}</div>
          ${CADRE_PAGES.map(([t, dash, list, k]) => `<a role="menuitem" href="${list}" class="hr-sub-item${here === k ? ' on' : ''}">${esc(t)}</a>`).join('')}</div></div>`,
      u.isAdmin ? `<a class="hr-link${on(/^#\/approvals/.test(hash) && here === 'index')}" href="index.html#/approvals">Approvals</a>` : '',
      u.isAdmin ? `<a class="hr-link${on(/^#\/users/.test(hash) && here === 'index')}" href="index.html#/users">Users</a>` : '',
    ].join('') : '';
    const where = !u ? '' : u.isAdmin ? 'Admin' : u.level === 'Division' ? u.division : u.level === 'Circle' ? u.circle + ' circle (view only)' : 'State (view only)';
    el.innerHTML = `<div class="hr-in">
      <a class="hr-mark" href="index.html#/" aria-label="AranyaHR home"><img src="assets/emblem.svg" alt=""></a>
      <a class="hr-brand" href="index.html#/">AranyaHR<small>Directorate of Forests · West Bengal</small></a>
      ${API.DEMO ? '<span class="hr-demo">Demo data</span>' : ''}
      ${u ? `<button class="hr-burger" data-hr-burger aria-label="Menu" aria-expanded="false">☰</button><nav class="hr-nav">${items}</nav>` : ''}
      <span class="hr-sp"></span>
      ${u ? `<div class="hr-dd hr-user"><button class="hr-me" data-hr-dd aria-haspopup="true" aria-expanded="false"><span class="hr-av">${esc(String(u.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span><span class="hr-hide-sm">${esc(u.name)}</span> <span aria-hidden="true">▾</span></button>
        <div class="hr-menu hr-right" role="menu"><div class="hr-who"><b>${esc(u.name)}</b><span>${esc(where)} · ${esc(u.email || u.username)}</span></div>
          ${u.isAdmin ? '<a role="menuitem" href="index.html#/ranges">Ranges</a><a role="menuitem" href="index.html#/settings">Settings</a>' : ''}
          <button role="menuitem" data-hr-out>Sign out</button></div></div>` : ''}
    </div>`;
  }

  // menus: open one at a time; close on a click outside, on Escape, or when a link is followed
  const closeAll = except => document.querySelectorAll('#hrTop .hr-dd.open').forEach(d => { if (d !== except) { d.classList.remove('open'); const b = d.querySelector('[data-hr-dd]'); b && b.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('click', e => {
    const top = document.getElementById('hrTop'); if (!top) return;
    const dd = e.target.closest('[data-hr-dd]'), burger = e.target.closest('[data-hr-burger]');
    if (e.target.closest('[data-hr-out]')) { API.signOut(); location.href = 'index.html'; return; }
    if (burger) { const o = top.classList.toggle('open'); burger.setAttribute('aria-expanded', o); return; }
    if (dd) { const d = dd.closest('.hr-dd'); closeAll(d); const o = d.classList.toggle('open'); dd.setAttribute('aria-expanded', o); return; }
    if (!e.target.closest('#hrTop .hr-menu') || e.target.closest('a')) { closeAll(); if (e.target.closest('#hrTop a')) top.classList.remove('open'); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeAll(); const t = document.getElementById('hrTop'); t && t.classList.remove('open'); } });
  window.addEventListener('hashchange', render);
  window.HR_HEADER = { render };
  render();
})();
