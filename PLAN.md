# AranyaHR: plan

One web app for the staff of the Directorate of Forests, West Bengal: **FR, DR/Fr, FG/HFG, FV, DL/CDL, Ban Sahayak, Aranya Sathi and DEO**. A user signs in for their division, circle or the state and sees all the staff in it together, filtered by range. Admins get a dashboard for each cadre, user control and approvals.

> **Built (29-10-2026).** See README.md for how it works and how to set it up. Three things differ from the plan below:
> - **Website:** the old screens were not merged into one page. Each stays a page of its own (`officers.html`, `fv.html`, `cdl.html`) with its own router and styling, unchanged except for small hooks. They share the AranyaHR sign-in (`docs/js/api.js`). `index.html` has sign-in, the division home and the admin pages.
> - **AS and DEO** use CDL+BS's code and screens (`cdl.html?set=sathi`). Their people are in the AS+DEO sheet; their Change Log and certificates are in the CDL+BS sheet, with the other two cadres.
> - **No `map_ranges.py`:** `hrSetup()` fills the Divisions and Ranges tabs from the sheets. Merge the ranges on the Ranges page.

**Rule for this build: reuse, don't rewrite.** The three live apps (UPMC2, FV, CDL+BS) work. AranyaHR moves their code into one repo with small, mechanical changes, and deletes only what becomes duplicated (three sign-ins, three `api.js`, repeated helpers). The sheet tabs and columns, and the screens people already know, stay as they are.

```
GitHub Pages (docs/)        ──►  "AranyaHR API" (one Apps Script project)  ──►  Google Drive folder "AranyaHR"
 aranyahr.forestwb.in             Core: sign-in, users, divisions, ranges        AranyaHR · FR DFR FG     (copy of "UPMC2")
 shell: sign-in · home            Officers   = UPMC2 Code.gs, wrapped            AranyaHR · FV            (copy of "Forest Volunteers")
 + the old screens as modules     Volunteers = FV Code.gs, wrapped               AranyaHR · CDL+BS        (copy of "CDL+BS Verification and Update")
                                  Cdlbs      = CDL+BS Code.gs, wrapped,          AranyaHR · AS+DEO        (new; CDL+BS's columns)
                                               also serves AS and DEO            AranyaHR · Users         (new: Users · Divisions · Ranges · Settings)
```

## 1. Google Drive: folder "AranyaHR"

All in `gouravsharmaifs@gmail.com`'s Drive, which already owns the three sheets.

| File in the folder | Made from | Tabs |
|---|---|---|
| AranyaHR · FR DFR FG | copy of **UPMC2** (`1AFVXKpv…`) | FR · DFR · FG-HFG · Change Log · Lists (unchanged) |
| AranyaHR · FV | copy of **Forest Volunteers** (`1Et6CxK4…`) | Volunteers · Change Log · Lists (unchanged) |
| AranyaHR · CDL+BS | copy of **CDL+BS Verification and Update** (`1x3Xi24w…`) | DL-CDL · Ban Sahayak · Change Log · Certificates · Lists (unchanged; its Users tab moves to AranyaHR · Users) |
| AranyaHR · AS+DEO | new, made by `hrSetup()` | Aranya Sathi · DEO · Change Log · Certificates · Lists |
| AranyaHR · Users | new, made by `hrSetup()` | Users · Divisions · Ranges · Settings |
| AranyaHR API | new Apps Script project, moved into the folder | Core.gs · Officers.gs · Volunteers.gs · Cdlbs.gs · Config.local.gs · appsscript.json |

- The copies are AranyaHR's own sheets. **The old sheets and old apps are not touched** and keep running until the cut-over (section 10).
- The Apps Script code is pasted in by hand, the same way as the three apps today. No new tools.

## 2. Repo layout (`priyanshaias/aranyahr`)

```
aranyahr/
  apps-script/
    Core.gs            sign-in, sessions, Users, Divisions, Ranges, Settings, doPost router, shared helpers   (from cdl-app, ~300 lines)
    Officers.gs        FR / DFR / FG   — UPMC2 Code.gs inside one wrapper                                      (~700)
    Volunteers.gs      FV              — fv Code.gs inside one wrapper                                         (~330)
    Cdlbs.gs           DL/CDL, BS, AS, DEO — cdl-app Code.gs; its sign-up code moves to Core                    (~560)
    Config.example.gs  Config.local.gs (git-ignored): SHEET_IDS of the 5 sheets, ACCOUNTS for admins
    appsscript.json
  docs/
    index.html  css/app.css (UPMC2's, unchanged) + css/hr.css (new screens only, ~80 lines)  assets/emblem.svg  CNAME
    js/config.js  js/api.js (one, from UPMC2)  js/shell.js (new, ~400)
    js/officers/  app.js fields.js pdf.js dashboard.js report.js   (UPMC2)
    js/fv/        app.js fv.css                                     (FV)
    js/cdl/       app.js store.js                                   (CDL+BS; also draws AS and DEO)
  scripts/map_ranges.py   first fill of the Divisions and Ranges tabs
  README.md  PLAN.md
```

The first commit copies the old files in **as they are**, so every later change is visible as a diff against the working version.

## 3. Server: one Apps Script project

- **Why one project:** one sign-in and one session for every cadre, and the "your own division only" check is done once, in Core, for every call.
- **Wrapping, not rewriting.** All `.gs` files in a project share one global scope, and the old files use the same names (`login_`, `meta_`, `load_`, `ss_`…). Each old file goes inside
  `const Officers = (() => { …old code… ; return { meta: meta_, division: division_, verify: verify_, … }; })();`
  so its insides stay unchanged. Only these change:
  - `ss_()` opens its sheet from `SHEET_IDS` (Officers, FV, CDL+BS; AS and DEO open the AS+DEO sheet).
  - Its `doPost`, `login_`, `logout_`, `authenticate_`, `sha256hex_`, `json_`, `now_`, `fmt_` are deleted; Core has one copy.
  - Cache keys get a prefix (`off:`, `fv:`, `cdl:`), because the script cache is now shared.
- **Router (Core):** actions are `module.action` (`off.division`, `fv.save`, `cdl.update`…) plus Core's own (`login`, `signup`, `home`, `users`…). Core checks the session, then sets `circle` / `division` from the user's level (section 4) before calling the module. Admin-only actions are listed once.
- **Timers:** one `warm()` every 10 minutes calls UPMC2's `keepWarm` and CDL+BS's `warm`.
- **Deploy:** Web app · Execute as: Me (gouravsharmaifs@gmail.com) · Who has access: Anyone.

## 4. Sign-in, sign-up and users

**Levels**

| Level | Signs up with | Sees | Can change | Active |
|---|---|---|---|---|
| Division | circle + division | own division | own division, all cadres | 1st user of the division: at once. 2nd and later: after admin approval |
| Circle | circle | all divisions of the circle | nothing (read only) | after admin approval |
| State | — | everything | nothing (read only) | after admin approval |
| Admin | in `Config.local.gs` | everything | everything, approvals, users | always |

- **Admin:** `grv` (gouravsharmaifs@gmail.com). Each admin entry can carry `cadres: [...]` to limit which cadres' approvals and dashboards they handle; `grv` has all.
- **Sign-up form** (from CDL+BS): level, circle, division, email (the username), name, designation, mobile, password.
  - If the division already has a user, the form says: *"You are the second user for this division. You can sign up, but please contact the admin to approve your account."* The account is saved as **Pending approval**.
  - Circle and State sign-ups say: *"Your account will work after the admin approves it."*
  - A pending user who signs in sees only that message and the admin's contact.
- **Passwords are kept as plain text** in the Password column of the Users tab, as decided. So that this stays as safe as it can be:
  - the AranyaHR · Users sheet is shared with nobody, and the Users tab is hidden and protected;
  - the API never sends a password to the website, except to an admin on the Users page;
  - admin passwords are in `Config.local.gs`, which is not in GitHub.
- **Moving the CDL+BS users:** their rows are copied to the Users tab as Active division users. CDL+BS only has hashes, not the passwords. Each user's hash is kept until they next sign in: the hash is checked once, then the typed password is saved and the hash removed. Admins can also set a new password for anyone.
- **Email verification is optional.** No code is needed to sign up. Admins get:
  - a switch in **Settings: "Ask for an email code at sign-up"** (off by default);
  - an **Email verified** column on the Users page, with **Send verification email** for any user;
  - "Forgot password" still sends a code by email, because that proves it is their address.
  The emails use MailApp from gouravsharmaifs@gmail.com (about 100 a day on a normal Gmail account).
- **Users page (admins):** filter by level, circle, status. Approve / reject pending users, disable / enable, see or set the password, send verification email. The home page shows a badge with the number of pending users.
- **Users tab columns:** Email · Level · Circle · Division · Name · Designation · Mobile · Status (Active / Pending approval / Disabled / Rejected) · Email verified · Password · Signed up on · Approved by · Approved on · Last sign-in · Old hash (removed after first sign-in).
- Wrong password 5 times → that email is locked for 15 minutes. A session lasts 6 hours. Both as today.

## 5. Divisions and ranges (the only new data)

- **Divisions tab:** one row per division: Circle, Division, and the name it has in each sheet (`Name in FR DFR FG`, `Name in FV`, `Name in CDL+BS`). The Lists tabs of the sheets are not touched; Core translates.
- **Ranges tab:** Circle, Division, Range, Aliases. Each person's range comes from the column the cadre already has:

  | Cadre | Range column |
  |---|---|
  | FR, DR/Fr, FG/HFG | `Present Range / Office` |
  | FV | `Range name` when `Posted at` is Range, else Div HQ |
  | DL/CDL, BS, AS, DEO | `Range (or Division HQ)` |

  Each value is matched to a range through the Aliases. A value that doesn't match shows as **Range not matched**; an admin adds that spelling as an alias on the Ranges page. Nothing in the cadre sheets is rewritten.
- `scripts/map_ranges.py` makes the first version of both tabs from the distinct values in the sheets and the `Range Mapping` workbooks.

## 6. Aranya Sathi and DEO

- **Same columns as DL/CDL** (`ID, Circle, Division, Name, Mode of engagement, Agency name, Engagement date, District, Range (or Division HQ), Beat, Place of work, Name of the place, Main duty, Other duties, Duty details, Monthly pay (Rs), Remarks, Verification, Status, Problem, Removal request, Last updated on, Last updated by`). The column `As in the return (do not edit)` is left out, as there is no return to compare against.
- So no new module: CDL+BS's code already handles two cadres with one set of columns (DL-CDL and Ban Sahayak). AS and DEO are added as two more cadres in its `CONFIG.TAB` list, with IDs `AS-…` and `DEO-…`, read from the AS+DEO sheet. The screens are CDL+BS's: table, Edit / Save / Verify, Certify list.
- Additions by a division count straight away, as for Ban Sahayaks; removals wait for an admin, as for DL/CDL. Pay is entered (not fixed at Rs 12,000).

## 7. Website

- **Look:** UPMC2's `app.css` (Acads-Notion tokens, Schibsted Grotesk, topbar, tiles, cards), the emblem, the footer and UPMC's loading animation. New screens use existing classes plus a small `hr.css`.
- **Shell (`shell.js`, new):** sign-in / sign-up / pending screen, top bar with cadre tabs, and routes:
  - `#/` **Home.** Division user: one card per cadre (total, verified/added, pending, details missing), a **range filter** bar (All · Div HQ · each range · Range not matched) and one combined table of everyone in the division: Name, Cadre, Designation, Range, Beat/place, Status. Clicking a row opens the person in their cadre's own screen. The chosen range stays when switching cadre tabs. Circle and State users get the same view with a division picker (and circle picker for State), read only.
  - `#/fr/…`, `#/dfr/…`, `#/fg/…` → UPMC2 screens · `#/fv/…` → FV · `#/cdl/…`, `#/bs/…`, `#/as/…`, `#/deo/…` → CDL+BS screens.
  - Admins: `#/admin` (all-cadre overview), `#/admin/<cadre>` (that app's own dashboard), `#/approvals`, `#/users`, `#/ranges`, `#/settings`.
- **Old screens as modules.** Each old `app.js` is already one IIFE. Changes in each are limited to:
  - routes get the cadre prefix; for division users the circle → division pages are skipped;
  - a two-line shim (`window.UPMC_API = window.FV_API = window.CDL_API = HR_API.for('off' | 'fv' | 'cdl')`), so calls inside are unchanged;
  - the shell's range filter is applied to the list it draws (one `filter()` each);
  - its own sign-in screen, top bar and `api.js` are deleted;
  - read-only users get the screens with Edit / Verify / Save hidden.
- **Demo mode** (no `API_URL`, or `?demo`) is kept for training.

## 8. Admin

- **Dashboards per cadre:** UPMC2's Dashboard and Reports (FR/DFR/FG), FV's Dashboard and change log, CDL+BS's admin (DL/CDL, BS, AS, DEO). `#/admin` adds one overview: rows = divisions, columns = cadres, cells = count and % complete, filterable by circle, plus pending users and pending approvals.
- **Approvals, cadre-wise** (one page, a tab per cadre): FR/DFR/FG = UPMC2's corrections; DL/CDL = additions and not-working; BS, AS, DEO = removals. FV saves directly, so it has a change log, not approvals.
- **Users** and **Settings** as in section 4, **Ranges** as in section 5.

## 9. Steps

| # | Step | Done when |
|---|---|---|
| 0 | Copy the old files into the repo unchanged; first commit | repo has the UPMC2, FV, CDL+BS sources as they are |
| 1 | Drive: make the AranyaHR folder and the three copies | 3 copies in the folder, IDs in `Config.local.gs` |
| 2 | Core.gs + wrap the three modules; AranyaHR API project; `hrSetup()` makes AS+DEO and Users | every old action works through `module.action` on the copies |
| 3 | Sign-up levels, approval, plain-text passwords, CDL users moved, Settings | division, circle, state and pending users behave as in section 4 |
| 4 | Divisions + Ranges tabs, `map_ranges.py` | every person has a range or "Range not matched" |
| 5 | Shell, home, range filter; mount the old screens | a division user does an FR verify, an FV save and a CDL verify |
| 6 | AS and DEO in the CDL+BS module | add / edit / verify / certify work for both |
| 7 | Admin: overview, cadre dashboards, approvals, users, ranges | |
| 8 | GitHub repo `priyanshaias/aranyahr`, Pages, `aranyahr.forestwb.in` | site live on the copies |
| 9 | Cut-over (below) | |

## 10. Cut-over

The old apps keep writing to the old sheets while AranyaHR is built on the copies, so the copies fall behind. On the switch-over day:

1. Close the old apps: replace `docs/index.html` in upmc2, fv and cdlbs with a one-line page linking to aranyahr.forestwb.in.
2. Refresh the copies from the old sheets (the people tabs, Change Log and Certificates), with a `refreshFromOld()` function in Core, and run `hrSetup()` again to rebuild the caches.
3. Copy any CDL+BS users who signed up since step 3.
4. The old sheets stay as a frozen backup, and the old repos stay on GitHub as history. Going back means restoring the old `index.html`.

## 11. Size

| | Today (3 apps) | AranyaHR |
|---|---|---|
| Apps Script | ~1,860 lines | ~1,900 (old code minus ~300 duplicate lines, plus Core) |
| Website JS | ~3,700 | ~3,500 (one `api.js`, no three sign-ins, plus shell ~400) |
| CSS | 547 + 356 + 228 | 547 + 228 + ~80 (CDL's `app.css` folds into UPMC2's) |
