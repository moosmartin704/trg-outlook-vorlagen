import { PLACEHOLDERS, buildValues, fillHtml, fillText } from './placeholders.js';
import * as store from './store.js';
import { initHost, getContext, insertHtml, setSubject, isOutlook } from './host.js';

const $ = (id) => document.getElementById(id);
const views = { login: $('view-login'), liste: $('view-liste'), edit: $('view-edit') };

const state = { templates: [], folder: '', query: '', user: null, editing: null, loading: false };

// ---------- Hilfen ----------

function show(name) {
  for (const [k, el] of Object.entries(views)) el.hidden = k !== name;
  $('btn-neu').hidden = !(store.canEdit && state.user && name === 'liste');
  $('btn-user').hidden = !(store.mode === 'firebase' && state.user && name !== 'login');
}

let toastTimer;
function toast(text, kind = '') {
  const el = $('toast');
  el.textContent = text;
  el.className = 'toast ' + kind;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'warn' ? 7000 : 3500);
}

const plain = (html) => {
  const spaced = String(html || '').replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi, ' $&');
  const doc = new DOMParser().parseFromString(spaced, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

/** Entfernt aktive Inhalte und Fremdformatierung aus dem Editor-HTML, damit die Mail die Schrift von Outlook übernimmt. */
export function sanitize(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button,svg').forEach((n) => n.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase();
      const v = a.value.trim().toLowerCase();
      if (n.startsWith('on') || n === 'style' || n === 'class' || n === 'contenteditable') el.removeAttribute(a.name);
      else if ((n === 'href' || n === 'src') && /^(javascript|data|vbscript):/.test(v)) el.removeAttribute(a.name);
    }
    if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
  });
  return doc.body.innerHTML.trim();
}

// ---------- Liste ----------

function visibleTemplates() {
  const q = state.query.trim().toLowerCase();
  return state.templates.filter((t) => {
    if (state.folder && t.folder !== state.folder) return false;
    if (!q) return true;
    return (t.title + ' ' + t.folder + ' ' + t.subject + ' ' + plain(t.body)).toLowerCase().includes(q);
  });
}

function renderFolders() {
  const folders = [...new Set(state.templates.map((t) => t.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  const box = $('ordner');
  box.replaceChildren();
  box.hidden = folders.length === 0;
  for (const name of ['', ...folders]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(state.folder === name));
    b.textContent = name || 'Alle';
    b.addEventListener('click', () => { state.folder = name; renderList(); });
    box.append(b);
  }
  $('ordner-vorschlaege').replaceChildren(...folders.map((f) => Object.assign(document.createElement('option'), { value: f })));
}

function renderList() {
  renderFolders();
  const ul = $('liste');
  ul.replaceChildren();
  const items = visibleTemplates();
  for (const t of items) {
    const li = document.createElement('li');
    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'eintrag';
    main.title = 'In die Nachricht einfügen';
    const titel = Object.assign(document.createElement('span'), { className: 'titel', textContent: t.title });
    main.append(titel);
    if (t.folder) main.append(Object.assign(document.createElement('span'), { className: 'ordner', textContent: t.folder }));
    main.append(Object.assign(document.createElement('span'), { className: 'vorschau', textContent: plain(t.body) }));
    main.addEventListener('click', () => insertTemplate(t, main));
    li.append(main);
    if (store.canEdit) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'bearbeiten';
      edit.title = 'Vorlage bearbeiten';
      edit.setAttribute('aria-label', 'Vorlage „' + t.title + '“ bearbeiten');
      edit.textContent = '✎';
      edit.addEventListener('click', () => openEditor(t));
      li.append(edit);
    }
    ul.append(li);
  }
  const leer = $('leer');
  leer.hidden = items.length > 0 || state.loading;
  if (state.loading) { leer.hidden = false; leer.textContent = 'Vorlagen werden geladen …'; }
  else if (!state.templates.length) leer.textContent = store.canEdit ? 'Noch keine Vorlagen. Lege mit „+ Neu“ die erste an.' : 'Keine Vorlagen vorhanden.';
  else leer.textContent = 'Keine Treffer.';
  $('btn-beispiele').hidden = !(store.canEdit && !state.loading && state.templates.length === 0);
}

async function refresh() {
  state.loading = true;
  const warm = store.cached();
  if (warm && !state.templates.length) state.templates = warm;
  renderList();
  try {
    state.templates = await store.loadTemplates();
  } catch (e) {
    toast(store.mode === 'firebase' ? 'Vorlagen konnten nicht geladen werden. Stand ggf. veraltet. (' + (e.code || e.message) + ')' : e.message, 'warn');
  }
  state.loading = false;
  renderList();
}

// ---------- Einfügen ----------

async function insertTemplate(t, button) {
  button.disabled = true;
  try {
    const ctx = await getContext();
    const values = buildValues(ctx);
    const { html, missing } = fillHtml(t.body, values);
    await insertHtml(html);

    const notes = [...missing];
    let subjectNote = '';
    if (t.subject && !String(ctx.subject || '').trim()) {
      const s = fillText(t.subject, values);
      if (s.missing.length) subjectNote = ' Betreff nicht gesetzt (Platzhalter ohne Wert).';
      else await setSubject(s.text);
    }
    if (!isOutlook()) toast('Testmodus im Browser: Text liegt in der Zwischenablage.', 'ok');
    else if (notes.length) toast('Eingefügt. Gelb markiert, weil unbekannt: ' + notes.map((n) => '{{' + n + '}}').join(', ') + '.' + subjectNote, 'warn');
    else toast('Vorlage „' + t.title + '“ eingefügt.' + subjectNote, subjectNote ? 'warn' : 'ok');
  } catch (e) {
    toast('Einfügen fehlgeschlagen: ' + e.message, 'warn');
  } finally {
    button.disabled = false;
  }
}

// ---------- Bearbeiten ----------

const editor = $('e-text');
let savedRange = null;
let deleteArmed = false;

function rememberSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount && editor.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
}
function restoreSelection() {
  editor.focus();
  if (savedRange) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
}
document.addEventListener('selectionchange', rememberSelection);

function openEditor(t) {
  state.editing = t || null;
  $('e-titel').value = t ? t.title : '';
  $('e-ordner').value = t ? t.folder : state.folder;
  $('e-betreff').value = t ? t.subject : '';
  editor.innerHTML = t ? sanitize(t.body) : '<p><br></p>';
  $('e-fehler').hidden = true;
  $('e-loeschen').hidden = !t;
  $('e-loeschen').textContent = 'Löschen';
  deleteArmed = false;
  $('link-zeile').hidden = true;
  savedRange = null;
  show('edit');
  window.scrollTo(0, 0);
  $('e-titel').focus();
}

function buildPlaceholderChips() {
  const box = $('platzhalter');
  for (const p of PLACEHOLDERS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = '{{' + p.key + '}}';
    b.title = p.hint;
    b.addEventListener('mousedown', (e) => e.preventDefault()); // Cursor im Editor behalten
    b.addEventListener('click', () => { restoreSelection(); document.execCommand('insertText', false, '{{' + p.key + '}}'); });
    box.append(b);
  }
}

function buildToolbar() {
  document.execCommand('defaultParagraphSeparator', false, 'p');
  for (const b of document.querySelectorAll('.toolbar [data-cmd]')) {
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      const cmd = b.dataset.cmd;
      if (cmd === 'createLink') { rememberSelection(); $('link-zeile').hidden = false; $('link-url').focus(); return; }
      restoreSelection();
      document.execCommand(cmd, false, null);
    });
  }
  $('link-ok').addEventListener('click', applyLink);
  $('link-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } });
}

function applyLink() {
  let url = $('link-url').value.trim();
  if (url && !/^(https?:|mailto:|tel:)/i.test(url)) url = 'https://' + url;
  $('link-zeile').hidden = true;
  $('link-url').value = '';
  if (!url) return;
  restoreSelection();
  const sel = window.getSelection();
  if (sel.isCollapsed) document.execCommand('insertHTML', false, '<a href="' + url.replace(/"/g, '&quot;') + '">' + url.replace(/[<>&]/g, '') + '</a>');
  else document.execCommand('createLink', false, url);
}

$('form-edit').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = sanitize(editor.innerHTML);
  const err = $('e-fehler');
  if (!plain(body)) { err.textContent = 'Der Text der Vorlage ist leer.'; err.hidden = false; return; }
  const btn = e.submitter;
  btn.disabled = true;
  try {
    await store.saveTemplate({
      id: state.editing && state.editing.id,
      title: $('e-titel').value, folder: $('e-ordner').value, subject: $('e-betreff').value, body,
    });
    toast('Gespeichert.', 'ok');
    show('liste');
    await refresh();
  } catch (ex) {
    err.textContent = 'Speichern fehlgeschlagen: ' + (ex.code || ex.message);
    err.hidden = false;
  } finally { btn.disabled = false; }
});

$('e-abbrechen').addEventListener('click', () => show('liste'));

$('e-loeschen').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (!deleteArmed) {
    deleteArmed = true;
    btn.textContent = 'Wirklich löschen?';
    setTimeout(() => { deleteArmed = false; btn.textContent = 'Löschen'; }, 4000);
    return;
  }
  try {
    await store.deleteTemplate(state.editing.id);
    toast('Vorlage gelöscht.', 'ok');
    show('liste');
    await refresh();
  } catch (ex) {
    toast('Löschen fehlgeschlagen: ' + (ex.code || ex.message), 'warn');
  }
});

// ---------- Anmeldung ----------

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('login-fehler');
  err.hidden = true;
  e.submitter.disabled = true;
  try {
    await store.signIn($('login-mail').value.trim(), $('login-pw').value);
    $('login-pw').value = '';
  } catch (ex) {
    err.textContent = store.authErrorText(ex);
    err.hidden = false;
  } finally { e.submitter.disabled = false; }
});

$('btn-user').addEventListener('click', async () => { await store.signOut(); });
$('btn-neu').addEventListener('click', () => openEditor(null));
$('suche').addEventListener('input', (e) => { state.query = e.target.value; renderList(); });

$('btn-beispiele').addEventListener('click', async (e) => {
  e.currentTarget.disabled = true;
  try {
    const n = await store.importSamples();
    toast(n + ' Beispielvorlagen angelegt.', 'ok');
    await refresh();
  } catch (ex) {
    toast('Import fehlgeschlagen: ' + (ex.code || ex.message), 'warn');
  } finally { e.currentTarget.disabled = false; }
});

// ---------- Start ----------

buildPlaceholderChips();
buildToolbar();
await initHost();

await store.watchUser(async (user) => {
  state.user = user;
  if (!user) { state.templates = []; show('login'); return; }
  $('btn-user').textContent = user.email ? user.email + ' · Abmelden' : '';
  show('liste');
  await refresh();
});
