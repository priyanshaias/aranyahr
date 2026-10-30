// AranyaHR — download a division's whole staff list:
//   FR, DR/Fr, FG/HFG as UPMC2's information sheets (one PDF, same pages as the "Download all PDFs" button there);
//   every cadre as an Excel workbook, one sheet per cadre.
// The PDF and Excel tools are loaded only when someone downloads.
(function () {
  const API = window.HR_API;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LIBS = {
    pdf: ['https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js', 'js/officers/fields.js', 'js/officers/pdf.js'],
    xlsx: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'],
  };
  const loaded = {};
  const script = src => loaded[src] || (loaded[src] = new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Could not load ' + src.split('/').pop() + '. Check the internet connection.')); document.head.appendChild(s); }));
  const need = async k => { for (const src of LIBS[k]) await script(src); };   // in order: fields.js before pdf.js

  // columns of each table, in the order of the earlier apps' sheets
  const FV_COLS = [['name', 'Name of Forest Volunteer Engaged'], ['dob', 'Date of Birth'], ['qual', 'Educational Qualification'], ['deptRef', "Forest Dept.'s approval ref"],
    ['dirRef', "Forest Directorate's Ref no sent to the Circle in Charge"], ['apptRef', 'Appointment Order issued by / reference'], ['doj', 'Date of Joining'],
    ['placeType', 'Posted at (Div HQ / Range)'], ['placeName', 'Range name'], ['placeSub', 'Within the range (Range HQ / Beat / Camp)'], ['works', 'Nature of Works assigned']];
  const CDL_COLS = [['name', 'Name'], ['mode', 'Mode of engagement'], ['agency', 'Agency name'], ['date', 'Engagement date'], ['district', 'District'], ['range', 'Range (or Division HQ)'],
    ['beat', 'Beat'], ['place', 'Place of work'], ['placeName', 'Name of the place'], ['duty', 'Main duty'], ['other', 'Other duties'], ['details', 'Duty details'], ['pay', 'Monthly pay (Rs)'],
    ['remarks', 'Remarks'], ['ver', 'Verified'], ['state', 'Status'], ['updOn', 'Last updated on'], ['updBy', 'Last updated by']];
  const CDL_SHEETS = [['CDL', 'DL - CDL'], ['BS', 'Ban Sahayak'], ['AS', 'Aranya Sathi'], ['DEO', 'DEO']];
  const STATE = { active: 'Working', 'add-pending': 'New - awaiting approval', 'remove-pending': 'Removal pending' };
  const OFF_STATUS = { verified: 'All details verified', partial: 'Posting verified', pending: 'Awaiting approval', unverified: 'Not verified' };
  const plain = x => String(x || '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const today = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()); };

  /** Everyone in one division, from each cadre's own data. own: the division's names in each sheet (from "home"). */
  async function fetchAll(own) {
    const [off, fv, cdl] = await Promise.all([
      API.call('off.division', { circle: own.off.circle, division: own.off.division }),
      API.call('fv.load', { circle: own.fv.circle, division: own.fv.division }),
      API.call('cdl.load', { division: own.cdl.division }),
    ]);
    const order = ['FR', 'DFR', 'FG'];
    return { officers: off.officers.slice().sort((a, b) => order.indexOf(a.cadre) - order.indexOf(b.cadre)), schema: off.schema, fv: fv.rows, cdl: cdl.rows.filter(p => p.state !== 'removed') };
  }

  async function pdf(d, D, set) {
    await need('pdf');
    if (!d.officers.length) throw new Error('No FR, DR/Fr or FG is listed in this division.');
    return window.UPMC_PDF.division(d.officers, d.schema, D.circle, D.division, set, { footer: 'AranyaHR · ' + D.division + ' division' });
  }

  async function excel(d, D) {
    await need('xlsx');
    const X = window.XLSX, wb = X.utils.book_new();
    const add = (name, head, rows) => { const ws = X.utils.aoa_to_sheet([head].concat(rows)); ws['!cols'] = head.map(h => ({ wch: Math.min(42, Math.max(10, String(h).length + 2)) })); X.utils.book_append_sheet(wb, ws, name.slice(0, 31)); };
    // officers: every column of their sheets, FR first
    const heads = []; ['FR', 'DFR', 'FG'].forEach(c => (d.schema[c] || []).forEach(f => { if (!heads.includes(f.name)) heads.push(f.name); }));
    const offCols = heads;
    const counts = [['FR, DR/Fr, FG/HFG', d.officers.filter(o => !o.incoming).length], ['Forest Volunteers', d.fv.length]];
    CDL_SHEETS.forEach(([c, n]) => counts.push([n, d.cdl.filter(p => p.cadre === c).length]));
    add('Summary', ['AranyaHR staff list', ''], [['Division', D.division], ['Circle', D.circle], ['Downloaded on', new Date().toLocaleString('en-IN')], ['', ''], ['Cadre', 'People']]
      .concat(counts).concat([['All', counts.reduce((a, c) => a + c[1], 0)]]));
    add('FR, DR, FG', ['Sl', 'Cadre', 'Status'].concat(offCols), d.officers.filter(o => !o.incoming).map((o, i) => [i + 1, o.cadre, OFF_STATUS[o.status] || o.status].concat(offCols.map(h => o.data[h] || ''))));
    add('Forest Volunteers', ['Sl'].concat(FV_COLS.map(c => c[1])), d.fv.map((r, i) => [i + 1].concat(FV_COLS.map(([k]) => r[k] || ''))));
    CDL_SHEETS.forEach(([c, n]) => add(n, ['Sl'].concat(CDL_COLS.map(x => x[1])), d.cdl.filter(p => p.cadre === c).map((p, i) => [i + 1].concat(CDL_COLS.map(([k]) =>
      k === 'other' ? (p.other || []).join(', ') : k === 'ver' ? (p.ver ? 'Yes' : '') : k === 'state' ? (STATE[p.state] || p.state) : k === 'pay' ? (p.pay == null ? '' : p.pay) : (p[k] || ''))))));
    const name = `${plain(D.division)}_staff_list_${today()}.xlsx`;
    X.writeFile(wb, name);
    return name;
  }

  /** The download window for one division. D: the "home" reply ({circle, division, own, people}). */
  function open(D) {
    const n = k => D.people.filter(p => k.includes(p.cadre)).length, off = n(['FR', 'DFR', 'FG']), rest = D.people.length - off;
    const el = document.createElement('div'); el.className = 'scrim';
    el.innerHTML = `<div class="dialog hr-dl" role="dialog" aria-modal="true" aria-label="Download the staff list">
      <div class="dhead"><div><h2>Download the staff list</h2><div class="sub">${esc(D.division)} division · ${esc(D.circle)} circle · ${D.people.length} people</div></div><button class="x" aria-label="Close">×</button></div>
      <div class="dbody">
        <button class="hr-dlopt" data-k="pdf" ${off ? '' : 'disabled'}><b>Information sheets (PDF)</b><span>FR, DR/Fr, FG/HFG · ${off} officers · one page each, as in the officer verification app</span></button>
        <button class="hr-dlopt" data-k="xlsx"><b>Staff list (Excel)</b><span>Every cadre, one sheet each: officers, Forest Volunteers, DL / CDL, Ban Sahayak, Aranya Sathi, DEO · ${D.people.length} people</span></button>
        <div class="hr-dlbar" hidden><div class="ibar"><i></i></div><p class="faint" id="dlMsg"></p></div>
        <p class="faint" style="margin:10px 0 0">${rest ? '' : 'Only officers are listed in this division so far. '}The files are made on this device from the latest saved data.</p>
      </div></div>`;
    document.body.appendChild(el);
    const close = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 250); };
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('.x')) close(); });
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
    requestAnimationFrame(() => el.classList.add('on'));
    let data = null;
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = async () => {
      const bar = el.querySelector('.hr-dlbar'), msg = el.querySelector('#dlMsg'), btns = el.querySelectorAll('[data-k]');
      btns.forEach(x => x.disabled = true); bar.hidden = false; bar.querySelector('.ibar').hidden = false;
      try {
        msg.textContent = 'Collecting every cadre’s list…';
        data = data || await fetchAll(D.own);
        msg.textContent = b.dataset.k === 'pdf' ? `Preparing ${data.officers.length} information sheets…` : 'Preparing the Excel file…';
        const name = b.dataset.k === 'pdf' ? await pdf(data, D, p => { msg.textContent = `Preparing information sheets… ${Math.round(p * 100)}%`; }) : await excel(data, D);
        msg.textContent = 'Downloaded ' + name;
      } catch (e) { msg.textContent = e.message || 'Something went wrong.'; }
      btns.forEach(x => x.disabled = x.dataset.k === 'pdf' && !off); bar.querySelector('.ibar').hidden = true;
    });
  }

  window.HR_DOWNLOAD = { open };
})();
