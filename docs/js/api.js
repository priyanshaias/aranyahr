// AranyaHR: talks to the one Apps Script API. One sign-in serves every page; each earlier app (UPMC2, FV, CDL+BS)
// gets an object shaped like its own API (HR_API.module), so its screens work unchanged.
(function () {
  const cfg = window.HR_CONFIG || {};
  const DEMO = !cfg.API_URL || /[?&]demo\b/.test(location.search);
  const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  let token = ls.get('hr_token'), user = ls.get('hr_user');

  function setSession(t, u) {
    token = t; user = u; ls.set('hr_token', t); ls.set('hr_user', u);
    if (!t) ['upmc_operator', 'fv_operator', 'hr_range'].forEach(k => ls.set(k, null));
  }

  // Reads are retried when Google's servers hiccup; a save is sent once, so a slow reply can never apply it twice.
  const SAFE = /^(login|logout|lists|divisionUsers|home|overview|users|settings|ranges|off\.(meta|division|search|history|admin(Summary|Changes|Queue|Data))|fv\.(meta|load|admin)|cdl\.(meta|load|pending|log))$/;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function post(payload) {
    const tries = SAFE.test(payload.action) ? 3 : 1;
    let last = 'The server could not be reached. Please check the internet connection and try again.';
    for (let i = 0; i < tries; i++) {
      if (i) await sleep(1500 * i);
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 60000);
      try {
        const res = await fetch(cfg.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: ctl.signal });
        const txt = await res.text();
        try { return JSON.parse(txt); } catch (e) { last = 'Google’s server is busy. Please try again in a minute.'; }
      } catch (e) {
        last = e.name === 'AbortError' ? 'Google’s server is taking too long. Please try again in a minute.' : last;
      } finally { clearTimeout(t); }
    }
    return { ok: false, error: last };
  }

  async function call(action, body = {}) {
    if (!token) throw Object.assign(new Error('Please sign in.'), { auth: true });
    const out = await post(Object.assign({ action, token }, body));
    if (!out.ok) {
      const err = Object.assign(new Error(out.error || 'Something went wrong.'), { conflict: !!out.conflict });
      if (/sign in|sign-in|expired|disabled/i.test(out.error || '')) { err.auth = true; setSession(null, null); }
      throw err;
    }
    return out.data;
  }
  /** Before sign-in: sign-up and password reset. A reply with a token signs in. */
  async function open(action, body = {}) {
    const out = await post(Object.assign({ action }, body));
    if (!out.ok) throw new Error(out.error || 'Something went wrong.');
    if (out.data && out.data.token) setSession(out.data.token, out.data.user);
    return out.data;
  }
  async function signIn(username, password) {
    const out = await post({ action: 'login', username, password });
    if (!out.ok) throw new Error(out.error || 'Could not sign in.');
    setSession(out.data.token, out.data.user);
    return out.data.user;
  }
  function signOut() { if (!DEMO && token) post({ action: 'logout', token }).catch(() => {}); setSession(null, null); }
  const DEMO_USER = { name: 'Demo admin', username: 'demo', email: 'demo@example.com', level: 'State', isAdmin: true };
  function demoSignIn() { setSession('demo', DEMO_USER); }

  /* ---------------- range chosen on the AranyaHR home page, applied on the cadre pages ---------------- */
  // hr_range: { division, range, divs: { off: <that sheet's division name>, … }, ids: { off: [in the range], … }, known: { off: [everyone], … } }.
  // It applies only in that division; someone added after the home page was opened is always shown.
  const range = (mod, division) => { const r = ls.get('hr_range'); return r && r.ids[mod] && r.divs[mod] === division ? r : null; };
  const inRange = (mod, id, division) => { const r = range(mod, division); return !r || r.ids[mod].indexOf(id) >= 0 || r.known[mod].indexOf(id) < 0; };
  const rangeBar = (mod, division) => { const r = range(mod, division); return r ? `<div class="notice info hr-range">Showing only <b>${String(r.range).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';')}</b>, as chosen on the AranyaHR home page. <button class="btn sm ghost" data-hr-range-clear>Show the whole division</button></div>` : ''; };
  document.addEventListener('click', e => { if (e.target.closest('[data-hr-range-clear]')) { ls.set('hr_range', null); location.reload(); } });

  /**
   * An object shaped like one earlier app's API. mod: 'off' (UPMC2), 'fv' (FV) or 'cdl' (CDL+BS).
   * On a cadre page: not signed in → the AranyaHR sign-in; a division user starts at their own division.
   */
  function module(mod) {
    if (!DEMO && !token) { location.replace('index.html'); }
    const own = () => user && user.own && user.own[mod];
    const viewOnly = () => !!user && !user.isAdmin && user.level !== 'Division';
    const shaped = () => {
      if (!user) return null;
      const u = Object.assign({}, user);
      if (mod === 'cdl') Object.assign(u, { role: user.isAdmin ? 'admin' : 'operator', division: own() ? own().division : '', viewOnly: viewOnly() });
      if (mod === 'off') u.email = user.email || user.username;
      return u;
    };
    // UPMC2 and FV ask for the operator's name and designation once; AranyaHR already has them
    if (user && !user.isAdmin) {
      const op = { name: user.name, designation: [user.desig, user.division || user.circle].filter(Boolean).join(', '), mobile: user.phone || '' };
      if (!ls.get('upmc_operator')) ls.set('upmc_operator', op);
      if (!ls.get('fv_operator')) ls.set('fv_operator', op);
    }
    if (user && user.isAdmin && !ls.get('upmc_operator')) ls.set('upmc_operator', { name: user.name, designation: 'Administrator', mobile: '' });
    // a division user opens at their own division; the circle and division lists are not shown to them
    const o = own();
    if (o && !user.isAdmin) {
      const home = mod === 'cdl' ? '#/d/' + encodeURIComponent(o.division) : '#/d/' + encodeURIComponent(o.circle) + '/' + encodeURIComponent(o.division);
      if (!location.hash || location.hash === '#/' || location.hash === '#/circles') history.replaceState(null, '', home);
      document.documentElement.classList.add('hr-division');
    }
    const demoCall = { off: () => window.UPMC_DEMO, fv: () => window.FV_DEMO };
    return {
      DEMO,
      call: (a, b) => DEMO ? (demoCall[mod] ? demoCall[mod]().call(a, b, shaped()) : Promise.reject(new Error('The demo keeps everything in this browser.'))) : call(mod + '.' + a, b),
      open, get user() { return shaped(); }, get token() { return token; },
      signIn, passwordSignIn: signIn, demoSignIn,
      signOut() { signOut(); location.href = 'index.html'; },
      setAdmin() {},
    };
  }

  // <script src="js/api.js" data-module="off|fv|cdl">: also sets the API object that page's earlier app expects
  const mod = document.currentScript && document.currentScript.dataset.module;
  const NAME = { off: 'UPMC_API', fv: 'FV_API', cdl: 'CDL_API' };
  if (mod) window[NAME[mod]] = module(mod);

  window.HR_API = { DEMO, call, open, signIn, signOut, demoSignIn, module, range, inRange, rangeBar, setRange: v => ls.set('hr_range', v),
    get user() { return user; }, get token() { return token; }, config: cfg };
})();
