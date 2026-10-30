# AranyaHR

One web app for the staff of the Directorate of Forests, West Bengal: **FR, DR/Fr, FG/HFG, Forest Volunteers, DL/CDL, Ban Sahayak, Aranya Sathi and DEO**. A user signs in for their division, circle or the state. The home page shows everyone in the division in every cadre, and can be filtered by range. Admins get an overview of every division, approvals for each cadre, users, ranges and settings.

AranyaHR is built from the three earlier apps. Their code is reused with small changes, and their screens, sheet tabs and columns stay the same:

| Earlier app | In AranyaHR | Sheet in the AranyaHR folder |
|---|---|---|
| UPMC2 | `apps-script/Officers.gs`, `docs/officers.html` | AranyaHR · FR DFR FG |
| FV | `apps-script/Volunteers.gs`, `docs/fv.html` | AranyaHR · FV |
| CDL+BS | `apps-script/Cdlbs.gs`, `docs/cdl.html` | AranyaHR · CDL+BS |
| (new) Aranya Sathi, DEO | the CDL+BS code and screens: `docs/cdl.html?set=sathi` | AranyaHR · AS+DEO |
| (new) sign-in, users, home | `apps-script/Core.gs`, `docs/index.html`, `docs/js/shell.js` | AranyaHR · Users |

```
GitHub Pages (docs/)                 ──►  "AranyaHR API" (one Apps Script project)   ──►  Google Drive folder "AranyaHR"
 index.html   sign-in · home · admin       Core.gs  sign-in, users, divisions, ranges        AranyaHR · Users      Users · Divisions · Ranges · Settings
 officers.html  UPMC2's screens            Officers.gs    (UPMC2's code)                     AranyaHR · FR DFR FG  FR · DFR · FG-HFG · Change Log · Lists
 fv.html        FV's screens               Volunteers.gs  (FV's code)                        AranyaHR · FV         Volunteers · Change Log · Lists
 cdl.html       CDL+BS's screens           Cdlbs.gs       (CDL+BS's code, + AS and DEO)      AranyaHR · CDL+BS     DL-CDL · Ban Sahayak · Change Log · Certificates · Lists
                                                                                             AranyaHR · AS+DEO     Aranya Sathi · DEO
```

## Accounts

| Account for | Sees | Can change | Works |
|---|---|---|---|
| Division | their own division | their own division, every cadre | after the admin approves |
| Circle | every division of the circle | nothing | after the admin approves |
| State | everything | nothing | after the admin approves |
| Admin (`Config.local.gs`) | everything | everything, approvals, users | always |

- **Sign-up** is on the AranyaHR page. Every new account waits on the admin's **Users** page until it is approved; the person is emailed when it is. When a division already has a user, the form tells the new person that they will be the second user and must ask the admin to approve the account.
- **Passwords are kept as plain text**, as decided: in the Password column of the Users tab, and admins' in `Config.local.gs`. Keep the **AranyaHR · Users** sheet shared with nobody, and hide and protect its Users tab. The website shows a password only to an admin, on the Users page.
- **Users moved from CDL+BS** keep their old password. CDL+BS kept only a hash, so the hash is checked once at their next sign-in; the typed password is saved then and the hash is removed.
- **Email verification is optional.** Settings → "Email code at sign-up" (off by default) asks for a 6-digit code before the account is made. On the Users page, **Send email** mails anyone a link that marks their address as verified. "Forgot password" always sends a code.
- The server enforces all of this. A division user's request is always for their own division, whatever the website sends.

## Divisions and ranges

- **Divisions tab:** one row per division, with its name in each sheet (`In FR DFR FG`, `In FV`, `In CDL+BS`, each as `Circle | Division`). `hrSetup()` fills it the first time by matching names; **check it and fill any blank cell by hand.**
- **Ranges tab:** Circle, Division, Range, and other spellings of it separated by `;`. `hrSetup()` fills it the first time with every spelling found in the sheets, one row each, so **merge the rows that are the same range** (move a spelling into the Aliases of the other row and delete its row), or do it on the **Ranges** page.
- Each person's range is matched through these tabs. A spelling that matches nothing shows as **Range not matched** until an admin joins it to a range on the Ranges page. The cadre sheets are never rewritten.
- A range chosen on the home page carries over to the FR/DR/FG and CDL pages. The FV page always shows the whole division, because FV saves the division's list as a whole.

## Setup (once)

The sheets are already made, in Drive → **AranyaHR** (owned by gouravsharmaifs@gmail.com). Their IDs are in the private `apps-script/Config.local.gs`.

### 1. Apps Script API
1. Go to https://script.google.com, signed in as gouravsharmaifs@gmail.com. Click **New project** and rename it `AranyaHR API`. Move it into the AranyaHR folder in Drive (optional).
2. Add five script files and paste in the contents of `apps-script/`: `Core.gs` (replace the default `Code.gs` with it), `Officers.gs`, `Volunteers.gs`, `Cdlbs.gs`, and the private `Config.local.gs` from this computer (`Config.example.gs` is the blank template).
3. In **Project Settings (⚙)**, tick **Show "appsscript.json" manifest file in editor**, then replace it with `apps-script/appsscript.json`.
4. Select **hrSetup** and click **Run**. Allow the permissions (Sheets, sending email, the timer). For "Google hasn't verified this app", click **Advanced → Go to AranyaHR API (unsafe)**; it is your own script. The log shows each sheet, the number of divisions and users, and sets up the 10-minute `warm` timer.
5. Check the **Divisions** and **Ranges** tabs of AranyaHR · Users (see above).
6. **Deploy → New deployment → ⚙ → Web app**: Execute as **Me**, Who has access **Anyone**. Copy the URL that ends in `/exec`.

### 2. Website
1. Put the `/exec` URL in `docs/js/config.js` (`API_URL`).
2. Push to GitHub (`priyanshaias/aranyahr`). In **Settings → Pages**: Source **Deploy from a branch**, branch `main`, folder `/docs`.
3. For **aranyahr.forestwb.in**: add a DNS CNAME record `aranyahr` → `priyanshaias.github.io`, then put `aranyahr.forestwb.in` in `docs/CNAME` and push.

### Changing the script later
Paste the changed files, run **hrSetup** once, then **Deploy → Manage deployments → ✎ → Version: New version → Deploy**. The `/exec` URL stays the same.

### Admin password
In `Config.local.gs`, set `password: '…'` in the admin's entry (or keep the `salt` and `hash` copied from UPMC2, which still work). No redeploy is needed.

## Before going live (cut-over)

The old apps still write to the old sheets, so the copies in the AranyaHR folder fall behind. On the day:
1. Replace `docs/index.html` in the upmc2, fv and cdlbs repos with a short page that links to AranyaHR.
2. Copy the latest people tabs, Change Log and Certificates from the old sheets into the AranyaHR copies, then run **hrSetup** to rebuild the caches.
3. Anyone who signed up on CDL+BS since the copy: add them to the Users tab (or clear the Users tab and run hrSetup, which moves them all again).

The old sheets stay as they are, as a backup.

## Local preview and tests
```bash
node tests/test.js
```
This runs the real `.gs` files against made-up sheets and checks sign-up, approval, the division lock, ranges, AS/DEO and settings.

```bash
node tests/devserver.js 8780
```
This serves the website at http://localhost:8780 on the same made-up sheets. Sign in as `grv` / `admin-pass-1` (admin) or `old@x.in` / `oldpassword` (a Kurseong division user moved from CDL+BS). With `API_URL` empty, or `?demo` in the address, the cadre pages run on their own demo data instead.
