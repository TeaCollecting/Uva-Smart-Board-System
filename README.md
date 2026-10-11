# Uva Province Smart Board Monitor (GitHub + Firebase)

What it does
- Windows app on every Smart Board: starts by itself when Windows starts, runs hidden, reports online/offline and daily usage.
- Dashboard for the education department: filter by district, zone, division, school type, medium, gender, status; search by school/census no; per-school and per-board views; 7-day history; CSV export.
- The Uva Province school list (854 schools, census 2024) is built into both the app and the dashboard (`client/schools.json`, `dashboard/schools.js`).

## 1. Firebase
1. Project `uva-smartboard`: enable Authentication (**Email/Password** only), Firestore, Realtime Database.
2. Authentication > Users: make sure the admin account `sudanchamalka@gmail.com` exists (email + password).
3. Keep email/password **sign-up enabled**: each Smart Board creates its own login automatically.
4. Config is already in `client/firebase-config.js` and `dashboard/firebase-config.js`. Check `databaseURL` in Console > Realtime Database.
5. Publish the rules: paste `firebase/firestore.rules` into Firestore > Rules and `firebase/database.rules.json` into Realtime Database > Rules.
6. Authentication > Settings > Authorized domains: add `YOUR_USER.github.io`.
7. Optional: set a budget alert in Google Cloud Billing.

### Adding education officers (read-only)
1. Authentication > Users > add the officer's email + password FIRST.
2. `firestore.rules`: add the email to the list in `isStaff()`.
3. `database.rules.json`: extend the `.read` rule of `status`, e.g. `... && (auth.token.email == 'sudanchamalka@gmail.com' || auth.token.email == 'officer@example.gov.lk')`.
4. Publish both rules again. Officers can view everything; only the admin can approve or delete boards.
Never add an email to the rules before its account exists, or anyone could sign up with that address.

## 2. GitHub
1. Push this folder to a repo. Set `repository` in `client/package.json`.
2. Settings > Pages > Source: GitHub Actions. Dashboard goes live on push to main (changes under `dashboard/`).
3. Release the .exe: set `version` in `client/package.json` (e.g. 1.0.0), then `git tag v1.0.0 && git push --tags` (installer appears under Releases).

## 3. Each Smart Board
1. Install the .exe while logged in to the Windows account the board uses (auto-start is per Windows account).
2. First run: choose District > Zone > School, enter board name + classroom, click Register.
3. Admin clicks Approve on the dashboard. The window then hides; from now on the app starts hidden with Windows.
Launching it again shows the window. If a board shows an error, click "Reset registration" and register again (delete the old row in the dashboard).

## Test locally
cd client && npm install && npm start
