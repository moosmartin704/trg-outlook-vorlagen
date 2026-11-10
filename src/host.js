// Brücke zu Outlook (Office.js). Außerhalb von Outlook (z. B. im Browser zum Testen) gibt es eine Ersatzfunktion.

let inOutlook = false;

export const isOutlook = () => inOutlook;

export async function initHost() {
  if (typeof Office === 'undefined') return false;
  const info = await Promise.race([
    new Promise((resolve) => Office.onReady(resolve)),
    new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
  inOutlook = !!(info && info.host && Office.context && Office.context.mailbox && Office.context.mailbox.item);
  return inOutlook;
}

const call = (fn) =>
  new Promise((resolve, reject) =>
    fn((r) => (r.status === Office.AsyncResultStatus.Succeeded ? resolve(r.value) : reject(new Error((r.error && r.error.message) || 'Outlook-Fehler')))));

/** Liest Empfänger, Betreff und eigenen Namen der geöffneten Nachricht. */
export async function getContext() {
  if (!inOutlook) {
    return { to: [{ displayName: 'Erika Beispiel', emailAddress: 'erika.beispiel@example.com' }], subject: '', me: 'Max Absender' };
  }
  const item = Office.context.mailbox.item;
  const [to, subject] = await Promise.all([
    item.to && item.to.getAsync ? call((cb) => item.to.getAsync(cb)).catch(() => []) : [],
    item.subject && item.subject.getAsync ? call((cb) => item.subject.getAsync(cb)).catch(() => '') : '',
  ]);
  const me = (Office.context.mailbox.userProfile && Office.context.mailbox.userProfile.displayName) || '';
  return { to, subject, me };
}

/** Fügt HTML an der Cursorposition ein (oder am Anfang, falls der Cursor nicht im Text steht). */
export async function insertHtml(html) {
  if (!inOutlook) {
    try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })]); } catch { /* ok */ }
    return;
  }
  const body = Office.context.mailbox.item.body;
  try {
    await call((cb) => body.setSelectedDataAsync(html, { coercionType: Office.CoercionType.Html }, cb));
  } catch {
    await call((cb) => body.prependAsync(html, { coercionType: Office.CoercionType.Html }, cb));
  }
}

export async function setSubject(text) {
  if (!inOutlook) return;
  await call((cb) => Office.context.mailbox.item.subject.setAsync(text, cb));
}
