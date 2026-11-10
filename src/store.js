// Speicher für Vorlagen: Firestore (bearbeitbar, mit Anmeldung) oder templates.json (nur lesen).
import { firebaseConfig } from './config.js';

const FB_VERSION = '10.14.1';
const COLLECTION = 'templates';
const CACHE_KEY = 'trg-vorlagen-cache-v1';

export const mode = firebaseConfig ? 'firebase' : 'static';
export const canEdit = mode === 'firebase';

let fb = null;

async function firebase() {
  if (fb) return fb;
  const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
  const [appM, authM, fsM] = await Promise.all([
    import(base + 'firebase-app.js'),
    import(base + 'firebase-auth.js'),
    import(base + 'firebase-firestore.js'),
  ]);
  const app = appM.initializeApp(firebaseConfig);
  // Long-Polling-Erkennung: manche Outlook-Webviews blockieren Streaming-Verbindungen
  const db = fsM.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  fb = { auth: authM.getAuth(app), db, authM, fsM };
  return fb;
}

// ---------- Anmeldung ----------

/** Meldet Änderungen des Anmeldestatus. Im statischen Modus sofort "angemeldet" ohne Konto. */
export async function watchUser(callback) {
  if (mode === 'static') { callback({ email: null, anonymous: true }); return () => {}; }
  const { auth, authM } = await firebase();
  return authM.onAuthStateChanged(auth, (u) => callback(u ? { email: u.email } : null));
}

export async function signIn(email, password) {
  const { auth, authM } = await firebase();
  await authM.signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  const { auth, authM } = await firebase();
  await authM.signOut(auth);
}

export function authErrorText(e) {
  const code = (e && e.code) || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return 'E-Mail-Adresse oder Passwort stimmt nicht.';
  if (/too-many-requests/.test(code)) return 'Zu viele Versuche. Bitte kurz warten und erneut probieren.';
  if (/network/.test(code)) return 'Keine Verbindung zu Firebase.';
  return 'Anmeldung fehlgeschlagen.' + (code ? ` (${code})` : '');
}

// ---------- Vorlagen ----------

const normalize = (t) => ({
  id: t.id,
  title: String(t.title || '').trim() || 'Ohne Titel',
  folder: String(t.folder || '').trim(),
  subject: String(t.subject || '').trim(),
  body: String(t.body || ''),
});

const sortList = (list) =>
  list.sort((a, b) => a.folder.localeCompare(b.folder, 'de') || a.title.localeCompare(b.title, 'de'));

export function cached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function remember(list) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* Speicher gesperrt: egal */ }
}

export async function loadTemplates() {
  let list;
  if (mode === 'static') {
    const res = await fetch('templates.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('templates.json konnte nicht geladen werden (' + res.status + ')');
    const data = await res.json();
    list = (data.templates || []).map((t, i) => normalize({ ...t, id: t.id || 'static-' + i }));
  } else {
    const { db, fsM } = await firebase();
    const snap = await fsM.getDocs(fsM.collection(db, COLLECTION));
    list = snap.docs.map((d) => normalize({ ...d.data(), id: d.id }));
  }
  sortList(list);
  remember(list);
  return list;
}

export async function saveTemplate(t) {
  if (!canEdit) throw new Error('Bearbeiten ist nur mit Firebase möglich.');
  const { db, auth, fsM } = await firebase();
  const data = {
    title: t.title.trim(), folder: t.folder.trim(), subject: t.subject.trim(), body: t.body,
    updatedAt: fsM.serverTimestamp(), updatedBy: auth.currentUser ? auth.currentUser.email : '',
  };
  if (t.id) {
    await fsM.setDoc(fsM.doc(db, COLLECTION, t.id), data, { merge: true });
    return t.id;
  }
  const ref = await fsM.addDoc(fsM.collection(db, COLLECTION), data);
  return ref.id;
}

export async function deleteTemplate(id) {
  if (!canEdit) throw new Error('Bearbeiten ist nur mit Firebase möglich.');
  const { db, fsM } = await firebase();
  await fsM.deleteDoc(fsM.doc(db, COLLECTION, id));
}

/** Legt die Beispielvorlagen aus templates.json in Firestore an (nur sinnvoll bei leerer Sammlung). */
export async function importSamples() {
  const res = await fetch('templates.json?t=' + Date.now(), { cache: 'no-store' });
  const data = await res.json();
  for (const t of data.templates || []) await saveTemplate({ ...t, id: undefined });
  return (data.templates || []).length;
}
