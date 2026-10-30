// A larger made-up state (about 60 divisions, varied progress) for previewing the dashboard: node tests/devserver.js 8780 --big
const { Book } = require('./mock.js'), { OFF_H, CDL_H, OLD_U } = require('./seed.js');
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const CIRCLES = { Hill: ['Darjeeling', 'Kalimpong', 'Kurseong'], Northern: ['Jalpaiguri', 'Baikunthapur', 'Coochbehar', 'NTFP'], 'Wild Life North': ['Darjeeling WL', 'Gorumara WL', 'Jaldapara WL'],
  'North West': ['Malda', 'Raiganj', 'Siliguri S.F'], Central: ['Bankura (N)', 'Bankura (S)', 'Panchet'], Western: ['Medinipur', 'Purba Medinipur', 'Kharagpur', 'Jhargram', 'Rupnarayan'],
  'South East': ['Burdwan', 'Birbhum', 'Durgapur'], 'South West': ['Purulia', 'Kangsabati (N)', 'Kangsabati (S)'], SBR: ['24 Parganas (S)', '24 Parganas (N)', 'Nadia-Murshidabad'],
  BTR: ['B.T.R (East)', 'B.T.R (West)'], STR: ['S.T.R'], 'Parks & Gardens': ['Howrah', 'URF'], Research: ['Silviculture Hill', 'Silviculture North', 'Silviculture South'] };
const NAMES = ['Amit', 'Bina', 'Chandan', 'Dipa', 'Esha', 'Faruk', 'Gopal', 'Hari', 'Indra', 'Jaya', 'Kamal', 'Lata', 'Mohan', 'Nupur', 'Om', 'Pinki', 'Rakesh', 'Sima', 'Tapas', 'Uma'];
const SUR = ['Roy', 'Das', 'Pal', 'Sen', 'Rai', 'Ali', 'Lama', 'Tamang', 'Mondal', 'Ghosh', 'Barman', 'Hansda', 'Murmu', 'Oraon', 'Sarkar'];
const name = () => pick(NAMES) + ' ' + pick(SUR);
const day = () => { const d = new Date(Date.now() - int(0, 60) * 864e5 * (rnd() < 0.15 ? 4 : 1)); return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear() + ' 1' + int(0, 7) + ':' + String(int(10, 59)); };
function books() {
  const off = { FR: [OFF_H], DFR: [OFF_H], 'FG-HFG': [OFF_H] }, cdl = { 'DL-CDL': [CDL_H], 'Ban Sahayak': [CDL_H] }, as = { 'Aranya Sathi': [CDL_H.slice(0, -1)], DEO: [CDL_H.slice(0, -1)] };
  const offLists = [['Circle', 'Office', 'Division', 'Districts', 'Deceased/Retired/Absconding etc', 'Verification'], ['', '', '', 'Darjeeling', 'Retired', 'Verified - All correct']];
  const cdlLists = [['Circle', 'Division']], fvLists = [['Circle', 'Office', 'Division']];
  let id = 1;
  Object.keys(CIRCLES).forEach(c => CIRCLES[c].forEach(d => {
    offLists.push([c, 'CCF, ' + c, d, '', '', '']); cdlLists.push([c, d]); fvLists.push([c, 'CCF, ' + c, d]);
    const ranges = [d.split(' ')[0] + ' Range', pick(['Sukna', 'Ghum', 'Mal', 'Lataguri', 'Binpur', 'Belpahari', 'Bishnupur', 'Sonamukhi']) + ' Range', pick(['North', 'South', 'East', 'West']) + ' Range'];
    const pace = rnd(), idle = rnd() < 0.12;   // how far this division has got; some have not started
    const st = () => idle ? 0 : rnd() < pace ? 2 : rnd() < 0.3 ? 1 : 0;
    [['FR', 'FR', int(2, 6)], ['DFR', 'DR/Fr', int(3, 12)], ['FG-HFG', 'FG', int(8, 40)]].forEach(([tab, desig, k]) => { for (let i = 0; i < k; i++) {
      const s = st(), r = rnd() < 0.15 ? 'Div HQ' : pick(ranges);
      off[tab].push(['E' + id++, name(), tab === 'FG-HFG' && rnd() < 0.3 ? 'HFG' : desig, c, d, r, 'Darjeeling', 'Nadia', '01-01-2020', '01-01-2021', '', ['', 'Verified - Posting and home district', 'Verified - All correct'][s], s ? day() : '', s ? 'Operator' : '']); } });
    const person = (pre, cad, tab) => { const s = st(), full = s || rnd() < 0.5;
      tab.push([pre + String(id++).padStart(8, '0'), c, d, name(), 'Direct', '', '2019', full ? 'Darjeeling' : '', rnd() < 0.2 ? 'Division HQ' : pick(ranges), '', full ? 'Office' : '', '', full ? 'Driver' : '', '', '', 9000,
        '', s === 2 ? 'Verified' : '', rnd() < 0.03 ? 'Removal pending' : 'Working', '', '', s ? day() : '', s ? 'Operator' : '', ''].slice(0, tab[0].length)); };
    for (let i = 0, k = int(10, 70); i < k; i++) person('C', 'CDL', cdl['DL-CDL']);
    if (rnd() < 0.7) for (let i = 0, k = int(2, 15); i < k; i++) person('BS-', 'BS', cdl['Ban Sahayak']);
    if (rnd() < 0.5) for (let i = 0, k = int(1, 8); i < k; i++) person('AS-', 'AS', as['Aranya Sathi']);
    if (rnd() < 0.6) for (let i = 0, k = int(1, 3); i < k; i++) person('DEO-', 'DEO', as.DEO);
  }));
  const fvRows = [['Volunteer ID', 'Circle', 'Division', 'Sl No', 'Name of Forest Volunteer Engaged', 'Date of Birth', 'Educational Qualification', "Forest Dept.'s approval ref",
    "Forest Directorate's Ref no sent to the Circle in Charge", 'Appointment Order issued by / reference', 'Date of Joining', 'Posted at (Div HQ / Range)', 'Range name', 'Within the range (Range HQ / Beat / Camp)', 'Nature of Works assigned', 'Last Updated On', 'Last Updated By']];
  Object.keys(CIRCLES).forEach(c => CIRCLES[c].forEach(d => { if (rnd() < 0.35) return; for (let i = 1, k = int(1, 12); i <= k; i++) { const full = rnd() < 0.6;
    fvRows.push(['FV-' + id++, c, d, i, name(), '01-01-1995', 'HS', 'R1', 'R2', full ? 'R3' : '', '01-01-2024', 'Range', d.split(' ')[0] + ' Range', 'Range HQ', full ? 'Nursery Operations' : '', day(), 'Operator']); } }));
  off['Change Log'] = [['Change ID', 'Submission ID', 'Submitted On', 'Submitted By (email)', 'Submitter Name', 'Submitter Designation', 'Submitter Mobile', 'Cadre', 'Type', 'Employee ID', 'Name', 'Circle', 'Division', 'Field', 'Old Value', 'New Value', 'Status', 'Reviewed On', 'Review Note']];
  off.Lists = offLists;
  return {
    OFF: new Book('OFF', off), FV: new Book('FV', { Volunteers: fvRows, 'Change Log': [['When']], Lists: fvLists }),
    CDL: new Book('CDL', Object.assign(cdl, { 'Change Log': [['When', 'Username', 'By', 'Circle', 'Division', 'Cadre', 'ID', 'Person', 'Action', 'Field', 'Old value', 'New value']],
      Certificates: [['Division', 'Cadre', 'Certified by', 'Designation', 'On', 'Entered by']], Lists: cdlLists, Users: [OLD_U] })),
    ASDEO: new Book('ASDEO', as), HR: new Book('HR', {}),
  };
}
module.exports = { books };
