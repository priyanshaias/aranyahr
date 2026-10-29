// TEMPLATE. Copy to Config.local.gs (kept out of GitHub), fill in, and paste it into Apps Script as a second file.
const LOCAL_CONFIG = {
  SHEET_IDS: {   // the long part of each sheet's link: docs.google.com/spreadsheets/d/<THIS PART>/edit
    OFF: '',     // AranyaHR · FR DFR FG
    FV: '',      // AranyaHR · FV
    CDL: '',     // AranyaHR · CDL+BS
    ASDEO: '',   // AranyaHR · AS+DEO
    HR: '',      // AranyaHR · Users
  },
  ACCOUNTS: {    // admins sign in with this username; modules: optional list ('off', 'fv', 'cdl') to limit an admin to some cadres
    // grv: { role: 'admin', name: 'PMC admin', email: 'someone@gmail.com', password: '<password>' },
  },
};
