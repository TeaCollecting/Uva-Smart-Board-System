# Smart Board Monitor (GitHub + Firebase)

## 1. Firebase
1. Project `uva-smartboard`: enable Authentication (**Email/Password** only; Anonymous is no longer needed), Firestore, Realtime Database.
2. Authentication > Users: make sure the admin account `sudanchamalka@gmail.com` exists (email + password).
3. Keep email/password **sign-up enabled**: each Smart Board creates its own login automatically.
4. Config is already in `client/firebase-config.js` and `dashboard/firebase-config.js`. Check `databaseURL` in Console > Realtime Database.
5. Publish the rules: paste `firebase/firestore.rules` into Firestore > Rules and `firebase/database.rules.json` into Realtime Database > Rules.
6. Authentication > Settings > Authorized domains: add `YOUR_USER.github.io`.
7. Optional: set a budget alert in Google Cloud Billing.

## 2. GitHub
1. Push this folder to a repo. Set `repository` in `client/package.json`.
2. Settings > Pages > Source: GitHub Actions. Dashboard goes live on push to main (changes under `dashboard/`).
3. Release the .exe: set `version` in `client/package.json` (e.g. 1.0.0), then `git tag v1.0.0 && git push --tags` (installer appears under Releases).

## 3. Each Smart Board
Install the .exe > enter board name + classroom > Admin clicks Approve on the dashboard.
Closing the window hides it; the app keeps running and auto-starts with Windows. Launching it again shows the window.
If a board shows an error, click "Reset registration" and register it again (delete the old row in the dashboard).

## Test locally
cd client && npm install && npm start
