'use strict';
// Critical Hit Studio — Firebase Cloud Sync (Auth + Firestore real-time sync)
// Works identically on Desktop (Electron / browser), Mobile browser, and standalone Android Capacitor APK.
// Fails gracefully when offline so local-first operation is never blocked.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CHL_CLOUD = api;
}(typeof self !== 'undefined' ? self : this, function () {
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyCLKELz9SKWskIUzvJGaLiQNnTjeMugjiQ',
    authDomain: 'critical-hit-studio.firebaseapp.com',
    projectId: 'critical-hit-studio',
    storageBucket: 'critical-hit-studio.firebasestorage.app',
    messagingSenderId: '998077465300',
    appId: '1:998077465300:web:6f232fac70823bac987141'
  };
  const FB_VER = '11.4.0';
  const CLIENT_ID = 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  // Pure helper: merge two planner state docs by item id + timestamp (newer wins per game & journal entry)
  function tsOf(item) {
    if (!item || typeof item !== 'object') return 0;
    return Number(item.updatedAt || item.stageChangedAt || item.createdAt || 0) || 0;
  }
  function mergeLists(localList, remoteList, preserveLocalKeys) {
    const map = new Map();
    (Array.isArray(localList) ? localList : []).forEach((it) => { if (it && it.id) map.set(it.id, Object.assign({}, it)); });
    (Array.isArray(remoteList) ? remoteList : []).forEach((rem) => {
      if (!rem || !rem.id) return;
      const loc = map.get(rem.id);
      if (!loc) { map.set(rem.id, Object.assign({}, rem)); return; }
      const winner = tsOf(rem) >= tsOf(loc) ? Object.assign({}, loc, rem) : Object.assign({}, rem, loc);
      // Preserve non-empty media / PC-only fields from either side so a device without art never wipes it
      if (preserveLocalKeys) {
        preserveLocalKeys.forEach((k) => {
          if (winner[k] == null || winner[k] === '') {
            if (loc[k]) winner[k] = loc[k];
            else if (rem[k]) winner[k] = rem[k];
          }
        });
      }
      map.set(rem.id, winner);
    });
    return Array.from(map.values());
  }
  function mergeStates(localState, remoteState) {
    const loc = localState && typeof localState === 'object' ? localState : { version: 1, games: [], journal: [] };
    const rem = remoteState && typeof remoteState === 'object' ? remoteState : null;
    if (!rem) return loc;
    const locEmpty = (!loc.games || !loc.games.length) && (!loc.journal || !loc.journal.length);
    const remEmpty = (!rem.games || !rem.games.length) && (!rem.journal || !rem.journal.length);
    if (locEmpty && !remEmpty) return Object.assign({}, loc, rem);
    if (remEmpty && !locEmpty) return loc;
    return Object.assign({}, loc, rem, {
      version: Math.max(loc.version || 1, rem.version || 1),
      games: mergeLists(loc.games, rem.games, ['launchTarget', 'projectFolder', 'cover', 'coverId', 'coverRemote', 'coverThumb', 'banner', 'logo']),
      journal: mergeLists(loc.journal, rem.journal),
      formats: rem.formats || loc.formats || null,
      ownerships: rem.ownerships || loc.ownerships || null,
      templates: rem.templates || loc.templates || null,
      display: loc.display || rem.display || null,
      cadence: rem.cadence || loc.cadence || null
    });
  }

  // Strip undefined values so Firestore never rejects a write
  function cleanForFirestore(obj) {
    return JSON.parse(JSON.stringify(obj == null ? {} : obj));
  }

  let sdk = null;       // { app, auth, db, fns }
  let currentUser = null;
  let unsubSnap = null;
  let callbacks = { onAuth: null, onRemoteState: null, onStatus: null };
  let readyPromise = null;
  let lastPushedAt = 0;

  async function loadSdk() {
    if (sdk) return sdk;
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      const base = `https://www.gstatic.com/firebasejs/${FB_VER}`;
      const [appMod, authMod, fsMod] = await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-auth.js`),
        import(`${base}/firebase-firestore.js`)
      ]);
      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);
      sdk = { app, auth, db, authMod, fsMod };
      return sdk;
    })().catch((err) => {
      readyPromise = null;
      throw err;
    });
    return readyPromise;
  }

  function docRef(uid) {
    return sdk.fsMod.doc(sdk.db, 'users', uid, 'planner', 'state');
  }

  function stopListener() {
    if (unsubSnap) { try { unsubSnap(); } catch (e) {} unsubSnap = null; }
  }

  function startListener(uid) {
    stopListener();
    unsubSnap = sdk.fsMod.onSnapshot(docRef(uid), (snap) => {
      if (!snap.exists()) return;
      const payload = snap.data();
      if (!payload || !payload.data) return;
      if (payload.clientId === CLIENT_ID) return; // ignore our own write echo
      if (payload.updatedAt && payload.updatedAt <= lastPushedAt) return;
      if (callbacks.onRemoteState) callbacks.onRemoteState(payload.data, { updatedAt: payload.updatedAt || 0 });
    }, (err) => {
      if (callbacks.onStatus) callbacks.onStatus('error', err.message);
    });
  }

  async function init(cbs) {
    callbacks = Object.assign(callbacks, cbs || {});
    try {
      await loadSdk();
    } catch (e) {
      if (callbacks.onStatus) callbacks.onStatus('offline', 'Cloud sync unavailable offline');
      return false;
    }
    sdk.authMod.onAuthStateChanged(sdk.auth, (user) => {
      currentUser = user || null;
      if (user) startListener(user.uid);
      else stopListener();
      if (callbacks.onAuth) callbacks.onAuth(currentUser);
    });
    return true;
  }

  function friendlyAuthError(e) {
    const code = (e && e.code) || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Incorrect email or password.';
    if (code === 'auth/email-already-in-use') return 'An account with that email already exists. Try Sign In.';
    if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
    if (code === 'auth/invalid-email') return 'Enter a valid email address.';
    if (code === 'auth/network-request-failed') return 'No internet connection.';
    return (e && e.message) || 'Authentication failed.';
  }

  async function signUp(email, password) {
    await loadSdk();
    try {
      const cred = await sdk.authMod.createUserWithEmailAndPassword(sdk.auth, String(email || '').trim(), String(password || ''));
      return cred.user;
    } catch (e) { throw new Error(friendlyAuthError(e)); }
  }

  async function signIn(email, password) {
    await loadSdk();
    try {
      const cred = await sdk.authMod.signInWithEmailAndPassword(sdk.auth, String(email || '').trim(), String(password || ''));
      return cred.user;
    } catch (e) { throw new Error(friendlyAuthError(e)); }
  }

  async function resetPassword(email) {
    await loadSdk();
    try {
      await sdk.authMod.sendPasswordResetEmail(sdk.auth, String(email || '').trim());
    } catch (e) { throw new Error(friendlyAuthError(e)); }
  }

  async function signOut() {
    await loadSdk();
    stopListener();
    await sdk.authMod.signOut(sdk.auth);
  }

  async function pullOnce() {
    if (!currentUser) return null;
    await loadSdk();
    const snap = await sdk.fsMod.getDoc(docRef(currentUser.uid));
    if (!snap.exists()) return null;
    const payload = snap.data();
    return (payload && payload.data) || null;
  }

  async function pushState(stateObj) {
    if (!currentUser) return false;
    await loadSdk();
    const now = Date.now();
    lastPushedAt = now;
    const payload = {
      data: cleanForFirestore(stateObj),
      updatedAt: now,
      clientId: CLIENT_ID
    };
    await sdk.fsMod.setDoc(docRef(currentUser.uid), payload);
    return true;
  }

  return {
    init, signUp, signIn, signOut, resetPassword, pullOnce, pushState,
    getUser: () => currentUser,
    mergeStates, cleanForFirestore
  };
}));
