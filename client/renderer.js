const { ipcRenderer } = require('electron');
const crypto = require('crypto');
const _fb = require('firebase/compat/app');
const firebase = _fb.default || _fb;
require('firebase/compat/auth'); require('firebase/compat/firestore'); require('firebase/compat/database');
firebase.initializeApp(require('./firebase-config.js'));
const SCHOOLS = require('./schools.json'); // Uva Province school list (census 2024)

const FLUSH_EVERY = 5; // minutes between Firestore writes (keeps you inside the free quota)
const auth = firebase.auth(), db = firebase.firestore(), rtdb = firebase.database();
const TS = () => firebase.firestore.FieldValue.serverTimestamp();
const $ = id => document.getElementById(id);
const log = m => { $('info').textContent = m; };
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- registration form: District > Zone > School ----------
const uniq = a => [...new Set(a)].sort((x, y) => x.localeCompare(y));
function fill(sel, items, placeholder) { // items: [value, text]
  sel.innerHTML = '';
  sel.appendChild(new Option(placeholder, ''));
  items.forEach(([v, t]) => sel.appendChild(new Option(t, v)));
}
fill($('dist'), uniq(SCHOOLS.map(s => s.d)).map(d => [d, d]), 'Select district');
fill($('zone'), [], 'Select zone');
fill($('school'), [], 'Select school');
$('dist').onchange = () => {
  fill($('zone'), uniq(SCHOOLS.filter(s => s.d === $('dist').value).map(s => s.z)).map(z => [z, z]), 'Select zone');
  fill($('school'), [], 'Select school');
};
$('zone').onchange = () => {
  const list = SCHOOLS.filter(s => s.d === $('dist').value && s.z === $('zone').value)
    .sort((a, b) => a.n.localeCompare(b.n));
  fill($('school'), list.map(s => [s.c, `${s.n} (${s.c})`]), 'Select school');
};

let board = null;
try { board = JSON.parse(localStorage.getItem('board') || 'null'); } catch (e) {}
if (board && !(board.email && board.census)) board = null; // old registration format: register again
if (board) start(board);
else { $('setup').style.display = 'block'; log('Register this Smart Board.'); ipcRenderer.send('show'); }

$('reset').onclick = () => { localStorage.removeItem('board'); location.reload(); };

$('save').onclick = () => {
  const census = $('school').value, name = $('name').value.trim(), loc = $('loc').value.trim();
  if (!census || !name || !loc) { log('Select the school and fill in the board name and classroom.'); return; }
  const sc = SCHOOLS.find(s => s.c === census);
  // Each board gets its own login, stored only on this PC. This keeps the same
  // uid after every restart (anonymous sign-in can lose it).
  board = {
    name, loc, census, school: sc ? sc.n : census,
    email: 'board-' + crypto.randomBytes(6).toString('hex') + '@smartboard.local',
    pw: crypto.randomBytes(18).toString('base64')
  };
  localStorage.setItem('board', JSON.stringify(board));
  $('setup').style.display = 'none';
  start(board);
};

// ---------- connection ----------
async function signIn(b) {
  try { return (await auth.signInWithEmailAndPassword(b.email, b.pw)).user; }
  catch (e) {
    const notFound = ['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'];
    if (!notFound.includes(e.code)) throw e;
    return (await auth.createUserWithEmailAndPassword(b.email, b.pw)).user; // first run
  }
}
const isTransient = e => e && (e.code === 'auth/network-request-failed' || e.code === 'unavailable'
  || /offline|network/i.test(e.message || ''));

async function start(b) {
  // At Windows start-up the network may not be ready yet: keep retrying quietly.
  let ref, attempts = 0;
  for (;;) {
    try {
      log(attempts ? `Connecting... (retry ${attempts})` : 'Connecting...');
      const user = await signIn(b);
      ref = db.collection('boards').doc(user.uid); // board id = auth uid
      const snap = await ref.get();
      if (!snap.exists) await ref.set({ name: b.name, location: b.loc, census: b.census, approved: false, createdAt: TS() });
      break;
    } catch (e) {
      attempts++;
      console.error(e);
      log('Error: ' + (e.message || e));
      if (!isTransient(e)) { ipcRenderer.send('show'); $('reset').style.display = 'block'; return; }
      if (attempts >= 5) ipcRenderer.send('show'); // offline for a few minutes: let someone see it
      await sleep(30000);
    }
  }

  try {
    // Online/Offline presence (server flips to offline automatically on disconnect)
    const st = rtdb.ref('status/' + ref.id);
    const stamp = firebase.database.ServerValue.TIMESTAMP;
    rtdb.ref('.info/connected').on('value', s => {
      if (s.val()) st.onDisconnect().set({ state: 'offline', last: stamp })
        .then(() => st.set({ state: 'online', last: stamp }))
        .catch(console.error);
    });

    let approved = false, started = false, hidden = false;
    ref.onSnapshot(s => {
      if (!s.exists) {
        approved = false;
        log('This board was removed by the admin.\nClick "Reset registration" to register again.');
        $('reset').style.display = 'block';
        ipcRenderer.send('show');
        return;
      }
      approved = !!s.data().approved;
      log(`${b.school || ''}\n${b.name} (${b.loc})\n` + (approved ? 'Approved. Tracking active.' : 'Waiting for admin approval...'));
      if (approved && !started) {
        started = true;
        ref.collection('logs').add({ type: 'start', t: TS() }).catch(console.error);
      }
      if (approved && !hidden) { hidden = true; setTimeout(() => ipcRenderer.send('hide'), 4000); }
    }, e => log('Error: ' + e.message));

    // Usage: sample every minute, write to Firestore every FLUSH_EVERY minutes
    let day = null, on = 0, act = 0, dirty = 0;
    const loadDay = async d => {
      const s = await ref.collection('days').doc(d).get();
      const x = s.exists ? s.data() : {};
      day = d; on = x.onSeconds || 0; act = x.activeSeconds || 0; dirty = 0;
    };
    const flush = async () => {
      if (!dirty) return;
      const batch = db.batch();
      batch.set(ref.collection('days').doc(day), { onSeconds: on, activeSeconds: act }, { merge: true });
      batch.update(ref, { lastSeen: TS(), todayDate: day, todayOn: on, todayActive: act });
      await batch.commit();
      dirty = 0;
    };

    setInterval(async () => {
      if (!approved) return;
      try {
        const idle = await ipcRenderer.invoke('idle');
        const d = today();
        if (d !== day) { if (day) await flush(); await loadDay(d); }
        on += 60; if (idle < 60) act += 60; dirty++;
        if (dirty >= FLUSH_EVERY) await flush();
      } catch (e) { console.error(e); }
    }, 60000);
  } catch (e) {
    console.error(e);
    log('Error: ' + (e.message || e));
    ipcRenderer.send('show');
    $('reset').style.display = 'block';
  }
}
