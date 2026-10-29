// Made-up sheets for the tests and the dev server.
const { Book } = require('./mock.js');
const OFF_H = ['Employee ID', 'Name', 'Designation', 'Circle', 'Division', 'Present Range / Office', 'District in which Range lies', 'Home District',
  'Division Date', 'Since when in this Range', 'Present Beat', 'Verification', 'Last Updated On', 'Last Updated By'];
const off = (id, name, desig, c, d, range) => [id, name, desig, c, d, range, 'Darjeeling', 'Nadia', '01-01-2020', '01-01-2021', '', '', '', ''];
const CDL_H = ['ID', 'Circle', 'Division', 'Name', 'Mode of engagement', 'Agency name', 'Engagement date', 'District', 'Range (or Division HQ)', 'Beat', 'Place of work',
  'Name of the place', 'Main duty', 'Other duties', 'Duty details', 'Monthly pay (Rs)', 'Remarks', 'Verification', 'Status', 'Problem', 'Removal request', 'Last updated on', 'Last updated by', 'As in the return (do not edit)'];
const cdl = (id, c, d, name, range) => [id, c, d, name, 'Direct', '', '2019', 'Darjeeling', range, '', 'Office', '', 'Driver', '', '', 12000, '', '', 'Working', '', '', '', '', ''];
const OLD_U = ['Email', 'Circle', 'Division', 'Name', 'Designation', 'Phone', 'Status', 'Signed up on', 'Last sign-in', 'Salt', 'Password hash'];
function books() { return {
  OFF: new Book('OFF', {
    FR: [OFF_H, off('FR1', 'Amit Roy', 'FR', 'Hill', 'Kurseong Dn.', 'Sukna Range'), off('FR2', 'Bina Das', 'FR', 'Hill', 'Darjeeling', 'Ghum')],
    DFR: [OFF_H, off('D1', 'Chandan Pal', 'DR/Fr', 'Hill', 'Kurseong Dn.', 'Sukna')],
    'FG-HFG': [OFF_H, off('G1', 'Dipa Sen', 'FG', 'Hill', 'Kurseong Dn.', 'Div HQ')],
    'Change Log': [['Change ID', 'Submission ID', 'Submitted On', 'Submitted By (email)', 'Submitter Name', 'Submitter Designation', 'Submitter Mobile', 'Cadre', 'Type', 'Employee ID', 'Name', 'Circle', 'Division', 'Field', 'Old Value', 'New Value', 'Status', 'Reviewed On', 'Review Note']],
    Lists: [['Circle', 'Office', 'Division', 'Districts', 'Deceased/Retired/Absconding etc', 'Verification'],
      ['Hill', 'CCF, Hill', 'Kurseong Dn.', 'Darjeeling', 'Retired', 'Verified - All correct'], ['Hill', 'CCF, Hill', 'Darjeeling', 'Nadia', '', ''], ['Northern', 'CCF, Northern', 'Jalpaiguri', '', '', '']],
  }),
  FV: new Book('FV', {}),
  CDL: new Book('CDL', {
    'DL-CDL': [CDL_H, cdl('C1', 'Hill', 'Kurseong', 'Esha Rai', 'Sukna R.'), cdl('C2', 'Hill', 'Darjeeling', 'Faruk Ali', 'Division HQ')],
    'Ban Sahayak': [CDL_H], 'Change Log': [['When', 'Username', 'By', 'Circle', 'Division', 'Cadre', 'ID', 'Person', 'Action', 'Field', 'Old value', 'New value']],
    Certificates: [['Division', 'Cadre', 'Certified by', 'Designation', 'On', 'Entered by']], Lists: [['Circle', 'Division'], ['Hill', 'Kurseong'], ['Hill', 'Darjeeling'], ['Northern', 'Jalpaiguri']],
    Users: [OLD_U],
  }),
  ASDEO: new Book('ASDEO', {}), HR: new Book('HR', {}),
}; }
module.exports = { books, OFF_H, CDL_H, OLD_U };
